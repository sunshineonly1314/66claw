/**
 * Image Generation Tool — generates images from text prompts.
 *
 * Supports:
 *   - OpenAI DALL-E 3 / GPT-Image-1 (via /v1/images/generations)
 *   - Aliyun Wanx / 通义万相 (via DashScope API)
 *   - SiliconFlow image models (Flux, SDXL, Midjourney, etc.)
 *   - Local sd.cpp sidecar (OpenAI-compatible API on localhost)
 *   - External local models (A1111/ComfyUI/Forge via user-configured endpoint)
 *
 * Image persistence: generated images are saved to
 *   ~/.openclawcn/media/chat-images/{sessionKey}/ via chat-image-store
 *   so they survive session restarts and are accessible in history.
 *
 * CN-only module: registered in clawdbot-tools.ts, safe from upstream merge.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import type { OpenClawCNConfig } from "../../config/config.js";
import { getApiKeyForModel } from "../model-auth.js";
import { requireApiKey } from "../model-auth.js";
import { discoverAuthStorage, discoverModels } from "../pi-model-discovery.js";
import { ensureOpenClawCNModelsJson } from "../models-config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { saveGeneratedImage, type ImageGenerationMeta } from "../../media/chat-image-store.js";

const log = createSubsystemLogger("tools/image-gen");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImageGenResult = {
  /** base64 data URL or remote URL */
  imageUrl: string;
  revisedPrompt?: string;
  model: string;
  provider: string;
};

type ImageGenProviderHandler = (params: {
  apiKey: string;
  prompt: string;
  size: string;
  style: string;
  quality: string;
  n: number;
  baseUrl?: string;
  modelId: string;
}) => Promise<ImageGenResult[]>;

// ---------------------------------------------------------------------------
// Provider Handlers
// ---------------------------------------------------------------------------

/** Strip trailing /v1 (or /v1/) from a baseUrl to avoid double-prefixing. */
function normalizeBaseUrl(url: string | undefined, fallback: string): string {
  const base = (url || fallback).replace(/\/+$/, "");
  return base.endsWith("/v1") ? base.slice(0, -3) : base;
}

/**
 * OpenAI DALL-E 3 / GPT-Image-1 image generation.
 */
const generateWithOpenAI: ImageGenProviderHandler = async ({
  apiKey,
  prompt,
  size,
  style,
  quality,
  n,
  baseUrl,
  modelId,
}) => {
  const url = `${normalizeBaseUrl(baseUrl, "https://api.openai.com")}/v1/images/generations`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId || "dall-e-3",
      prompt,
      n: Math.min(n, modelId?.includes("gpt-image") ? 4 : 1),
      size,
      style,
      quality,
      response_format: "b64_json",
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`OpenAI image generation failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string; url?: string }>;
  };

  const results: ImageGenResult[] = [];
  for (const item of data.data ?? []) {
    const imageUrl = item.b64_json ? `data:image/png;base64,${item.b64_json}` : (item.url ?? "");
    if (imageUrl) {
      results.push({
        imageUrl,
        revisedPrompt: item.revised_prompt,
        model: modelId || "dall-e-3",
        provider: "openai",
      });
    }
  }

  if (results.length === 0) {
    throw new Error("OpenAI returned empty image data");
  }
  return results;
};

/**
 * Aliyun DashScope (通义万相) image generation.
 */
const generateWithDashScope: ImageGenProviderHandler = async ({
  apiKey,
  prompt,
  size,
  n,
  modelId,
}) => {
  const url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";

  const submitController = new AbortController();
  const submitTimeout = setTimeout(() => submitController.abort(), 30_000);
  const submitResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: modelId || "wanx-v1",
      input: { prompt },
      parameters: {
        size: convertSizeToDashScope(size),
        n: Math.min(n, 4),
      },
    }),
    signal: submitController.signal,
  });
  clearTimeout(submitTimeout);

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text().catch(() => "unknown error");
    throw new Error(`DashScope submit failed (${submitResponse.status}): ${errorText}`);
  }

  const submitData = (await submitResponse.json()) as {
    output?: { task_id?: string; task_status?: string };
  };
  const taskId = submitData.output?.task_id;
  if (!taskId) {
    throw new Error("DashScope returned no task_id");
  }

  // Poll for result (max 120 seconds — Wan2.x can be slow)
  const taskUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
  const maxPollTime = 120_000;
  const pollInterval = 2_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const pollController = new AbortController();
    const pollTimeout = setTimeout(() => pollController.abort(), 15_000);
    const pollResponse = await fetch(taskUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: pollController.signal,
    });
    clearTimeout(pollTimeout);
    if (!pollResponse.ok) {
      // Surface auth/quota errors instead of silently retrying (M7 fix)
      if (pollResponse.status === 401 || pollResponse.status === 403) {
        throw new Error(`DashScope API auth failed (${pollResponse.status})`);
      }
      continue;
    }

    const pollData = (await pollResponse.json()) as {
      output?: {
        task_status?: string;
        results?: Array<{ url?: string; b64_image?: string }>;
      };
    };
    const status = pollData.output?.task_status;

    if (status === "SUCCEEDED") {
      const results: ImageGenResult[] = [];
      for (const result of pollData.output?.results ?? []) {
        const imageUrl = result.b64_image
          ? `data:image/png;base64,${result.b64_image}`
          : (result.url ?? "");
        if (imageUrl) {
          results.push({
            imageUrl,
            model: modelId || "wanx-v1",
            provider: "dashscope",
          });
        }
      }
      if (results.length === 0) throw new Error("DashScope returned no image result");
      return results;
    }

    if (status === "FAILED") {
      throw new Error("DashScope image generation task failed");
    }
  }

  throw new Error("DashScope image generation timed out (120s)");
};

/**
 * SiliconFlow / OpenAI-compatible image generation endpoint.
 */
const generateWithSiliconFlow: ImageGenProviderHandler = async ({
  apiKey,
  prompt,
  size,
  n,
  baseUrl,
  modelId,
}) => {
  const url = `${normalizeBaseUrl(baseUrl, "https://api.siliconflow.cn")}/v1/images/generations`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      prompt,
      image_size: size,
      batch_size: Math.min(n, 4),
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`SiliconFlow image generation failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    images?: Array<{ url?: string }>;
    data?: Array<{ url?: string; b64_json?: string }>;
  };

  const items = data.images ?? data.data ?? [];
  const results: ImageGenResult[] = [];
  for (const item of items) {
    const b64 = (item as { b64_json?: string }).b64_json;
    const imageUrl = b64 ? `data:image/png;base64,${b64}` : (item.url ?? "");
    if (imageUrl) {
      results.push({ imageUrl, model: modelId, provider: "siliconflow" });
    }
  }

  if (results.length === 0) {
    throw new Error("SiliconFlow returned empty image data");
  }
  return results;
};

/**
 * Local sd.cpp sidecar — OpenAI-compatible API on localhost.
 * Also works for any external local model (A1111 --api, ComfyUI, Forge).
 */
const generateWithLocal: ImageGenProviderHandler = async ({
  apiKey,
  prompt,
  size,
  n,
  baseUrl,
  modelId,
}) => {
  if (!baseUrl) {
    throw new Error(
      "Local image generation not available: no endpoint configured. Is the sd.cpp sidecar running?",
    );
  }
  const url = `${normalizeBaseUrl(baseUrl, "http://127.0.0.1:50200")}/v1/images/generations`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // Local generation can be slow
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelId || "default",
      prompt,
      size,
      n: Math.min(n, 4),
      response_format: "b64_json",
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Local image generation failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const results: ImageGenResult[] = [];
  for (const item of data.data ?? []) {
    const imageUrl = item.b64_json ? `data:image/png;base64,${item.b64_json}` : (item.url ?? "");
    if (imageUrl) {
      results.push({
        imageUrl,
        model: modelId || "local",
        provider: "local",
      });
    }
  }

  if (results.length === 0) {
    throw new Error("Local model returned empty image data");
  }
  return results;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function convertSizeToDashScope(size: string): string {
  const mapping: Record<string, string> = {
    "1024x1024": "1024*1024",
    "1792x1024": "1792*1024",
    "1024x1792": "1024*1792",
    "512x512": "512*512",
    "768x768": "768*768",
  };
  return mapping[size] || "1024*1024";
}

function resolveImageGenProvider(provider: string, modelId: string): ImageGenProviderHandler {
  if (provider === "local") return generateWithLocal;
  if (provider === "dashscope" || provider === "tongyi" || provider === "aliyun") {
    return generateWithDashScope;
  }
  if (provider === "siliconflow") return generateWithSiliconFlow;
  if (modelId.includes("dall-e") || modelId.includes("gpt-image") || provider === "openai") {
    return generateWithOpenAI;
  }
  // Default: try OpenAI-compatible endpoint
  return generateWithOpenAI;
}

/**
 * Validate that a URL is safe to fetch (SSRF prevention).
 * Only allows https: (and http: for localhost only).
 */
function isSafeFetchUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    // Allow http only for localhost (sidecar)
    if (u.protocol === "http:") {
      const host = u.hostname;
      return host === "127.0.0.1" || host === "localhost" || host === "::1";
    }
    if (u.protocol !== "https:") return false;
    // Block private/internal IP ranges
    const host = u.hostname;
    if (host === "localhost" || host === "::1") return true;
    // Block metadata endpoints and private IPs
    if (
      host.startsWith("169.254.") || // Link-local / cloud metadata
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host === "0.0.0.0" ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith(".internal") ||
      host.endsWith(".local")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract base64 data from a data URL or fetch from remote URL.
 * Returns { buffer, mimeType }.
 */
async function resolveImageBuffer(
  imageData: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (imageData.startsWith("data:image/")) {
    const match = imageData.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match) {
      return {
        buffer: Buffer.from(match[2]!, "base64"),
        mimeType: match[1]!,
      };
    }
  }

  // SSRF check: only allow https and localhost http
  if (!isSafeFetchUrl(imageData)) {
    throw new Error(`Refused to fetch image from unsafe URL: ${new URL(imageData).hostname}`);
  }

  // Remote URL — download
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(imageData, {
      signal: controller.signal,
      headers: { "User-Agent": "OpenClawCN/ImageGen" },
      redirect: "manual", // Don't follow redirects to internal URLs
    });
    // Handle redirects safely
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      if (location && !isSafeFetchUrl(new URL(location, imageData).href)) {
        throw new Error("Image URL redirected to an unsafe internal address");
      }
      // Re-fetch with the validated redirect
      const resp2 = await fetch(new URL(location!, imageData).href, {
        signal: controller.signal,
        headers: { "User-Agent": "OpenClawCN/ImageGen" },
        redirect: "error",
      });
      if (!resp2.ok) throw new Error(`Download failed: ${resp2.status}`);
      const ab2 = await resp2.arrayBuffer();
      const buf2 = Buffer.from(ab2);
      if (buf2.length > 20_000_000) throw new Error("Image too large (>20MB)");
      return { buffer: buf2, mimeType: resp2.headers.get("content-type") || "image/png" };
    }
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    const ab = await resp.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length > 20_000_000) throw new Error("Image too large (>20MB)");
    const ct = resp.headers.get("content-type") || "image/png";
    return { buffer: buf, mimeType: ct };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if local sd.cpp sidecar is running at the default port.
 */
async function checkLocalSidecar(port: number = 50200): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tool Factory
// ---------------------------------------------------------------------------

export function createImageGenTool(options?: {
  config?: OpenClawCNConfig;
  agentDir?: string;
  sessionKey?: string;
}): AnyAgentTool {
  return {
    label: "Image Generation",
    name: "image_gen",
    description:
      "Generate images from text descriptions. " +
      "Use this tool when the user asks to create, draw, paint, design, or generate an image, picture, illustration, logo, poster, etc. " +
      "Provide a detailed prompt describing the desired image. " +
      "Supports multiple images (n=1-4), different sizes, and style presets.",
    parameters: Type.Object({
      prompt: Type.String({
        description: "Detailed text description of the image to generate",
      }),
      size: Type.Optional(
        Type.String({
          description:
            "Image size. Options: 1024x1024 (square, default), 1792x1024 (landscape), 1024x1792 (portrait), 512x512 (fast)",
        }),
      ),
      style: Type.Optional(
        Type.String({
          description:
            "Image style. Options: vivid (default), natural, anime, watercolor, pixel, photorealistic",
        }),
      ),
      n: Type.Optional(
        Type.Number({
          description: "Number of images to generate (1-4, default 1)",
        }),
      ),
      quality: Type.Optional(
        Type.String({
          description: "Quality: standard (default), hd",
        }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const record = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
      const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
      if (!prompt) {
        return {
          content: [{ type: "text", text: "Error: prompt is required for image generation." }],
          details: { error: "missing_prompt" },
        };
      }

      const size = typeof record.size === "string" ? record.size.trim() : "1024x1024";
      const style = typeof record.style === "string" ? record.style.trim() : "vivid";
      const quality = typeof record.quality === "string" ? record.quality.trim() : "standard";
      const n = typeof record.n === "number" ? Math.max(1, Math.min(4, record.n)) : 1;

      const agentDir = options?.agentDir?.trim() || "";
      const cfg = options?.config;
      const sessionKey = options?.sessionKey || `default-${Date.now()}`;
      const startTime = Date.now();

      try {
        // --- Provider Resolution ---
        // 1. Check for local sidecar first (free, fast, private)
        const localEndpoint =
          (cfg as Record<string, unknown> | undefined)?.imagegen &&
          typeof ((cfg as Record<string, unknown>).imagegen as Record<string, unknown>)
            ?.localEndpoint === "string"
            ? ((cfg as Record<string, unknown>).imagegen as Record<string, string>).localEndpoint
            : undefined;

        let useLocal = false;
        let localBaseUrl = "";

        if (localEndpoint) {
          // User configured external local endpoint (A1111/ComfyUI/Forge)
          useLocal = true;
          localBaseUrl = localEndpoint;
        } else {
          // Check built-in sd.cpp sidecar
          const sidecarReady = await checkLocalSidecar();
          if (sidecarReady) {
            useLocal = true;
            localBaseUrl = "http://127.0.0.1:50200";
          }
        }

        let results: ImageGenResult[];

        if (useLocal) {
          log.info(`Using local image gen endpoint: ${localBaseUrl}`);
          results = await generateWithLocal({
            apiKey: "",
            prompt,
            size,
            style,
            quality,
            n,
            baseUrl: localBaseUrl,
            modelId: "default",
          });
        } else {
          // 2. Cloud provider resolution via model registry
          if (agentDir) await ensureOpenClawCNModelsJson(cfg, agentDir);
          const authStorage = agentDir ? discoverAuthStorage(agentDir) : null;
          const registry = authStorage && agentDir ? discoverModels(authStorage, agentDir) : null;
          const models = registry ? registry.getAll() : [];

          const imageGenModel = models.find((m) => {
            const id = m.id.toLowerCase();
            return (
              id.includes("dall-e") ||
              id.includes("gpt-image") ||
              id.includes("wanx") ||
              id.includes("wan-x") ||
              id.includes("wan2") ||
              id.includes("stable-diffusion") ||
              id.startsWith("sd-") ||
              id.includes("sdxl") ||
              id.includes("flux") ||
              id.includes("midjourney") ||
              id.includes("playground") ||
              id.includes("kolors")
            );
          });

          if (!imageGenModel) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "No image generation model configured. " +
                    "Please configure an image generation model (e.g., dall-e-3, wanx-v1, stable-diffusion-xl) " +
                    "in your agent settings, or install a local image generation model.",
                },
              ],
              details: { error: "no_image_gen_model" },
            };
          }

          log.info(`Using image gen model: ${imageGenModel.provider}/${imageGenModel.id}`);

          const authInfo = await getApiKeyForModel({
            model: imageGenModel,
            cfg,
            agentDir,
          });
          const apiKey = requireApiKey(authInfo, imageGenModel.provider);
          const handler = resolveImageGenProvider(imageGenModel.provider, imageGenModel.id);

          results = await handler({
            apiKey,
            prompt,
            size,
            style,
            quality,
            n,
            baseUrl: imageGenModel.baseUrl,
            modelId: imageGenModel.id,
          });
        }

        const durationMs = Date.now() - startTime;
        log.info(
          `Image generated: ${results.length} image(s), ` +
            `provider=${results[0]?.provider}, model=${results[0]?.model}, ${durationMs}ms`,
        );

        // --- Persist images to disk ---
        const persistedUrls: string[] = [];
        const persistedPaths: string[] = [];
        for (const result of results) {
          try {
            const { buffer, mimeType } = await resolveImageBuffer(result.imageUrl);
            const meta: ImageGenerationMeta = {
              prompt,
              revisedPrompt: result.revisedPrompt,
              model: result.model,
              provider: result.provider,
              size,
              style,
              durationMs,
            };
            const entry = await saveGeneratedImage({
              sessionKey,
              data: buffer,
              mimeType,
              meta,
            });
            if (entry) {
              // URL path that media server will serve
              persistedUrls.push(`/api/media/chat-images/${sessionKey}/${entry.file}`);
              persistedPaths.push(entry.file);
            } else {
              // Fallback: use the original URL/data URL
              persistedUrls.push(result.imageUrl);
            }
          } catch (persistErr) {
            log.warn(`Failed to persist image: ${(persistErr as Error).message}`);
            persistedUrls.push(result.imageUrl);
          }
        }

        // --- Build response ---
        const firstResult = results[0]!;
        const lines = [`Image generated successfully.`];
        if (firstResult.revisedPrompt) {
          lines.push(`\nRevised prompt: ${firstResult.revisedPrompt}`);
        }
        if (results.length > 1) {
          lines.push(`\n${results.length} images generated.`);
        }

        // [CN-FIX:image-display] Embed image metadata as a JSON content block
        // so PI SDK persists it in the session JSONL. The UI's
        // extractImageGenDetails reads this back for inline rendering.
        const imageMetaBlock = {
          type: "text",
          text: `<!--OPENCLAWCN_IMAGE_GEN:${JSON.stringify({
            imageUrl: persistedUrls[0],
            imageUrls: persistedUrls,
            imageFiles: persistedPaths,
            imageCount: results.length,
            model: `${firstResult.provider}/${firstResult.model}`,
            provider: firstResult.provider,
            prompt,
            size,
            style,
            durationMs,
            revisedPrompt: firstResult.revisedPrompt,
          })}-->`,
        };

        return {
          content: [{ type: "text", text: lines.join("\n") }, imageMetaBlock],
          details: {
            model: `${firstResult.provider}/${firstResult.model}`,
            provider: firstResult.provider,
            imageUrl: persistedUrls[0],
            imageUrls: persistedUrls,
            imageFiles: persistedPaths,
            imageCount: results.length,
            prompt,
            size,
            style,
            durationMs,
            revisedPrompt: firstResult.revisedPrompt,
          },
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(`Image generation failed: ${errorMsg}`);

        return {
          content: [
            {
              type: "text",
              text: `Image generation failed: ${errorMsg}`,
            },
          ],
          details: { error: errorMsg, prompt, size, style },
        };
      }
    },
  };
}
