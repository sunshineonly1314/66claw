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

  // Qwen-Image models use different parameters than FLUX/SD/Kolors.
  // Qwen-Image: num_inference_steps + cfg (NO image_size, NO batch_size)
  // Others: image_size + batch_size
  const isQwenImage = /qwen[/-]image/i.test(modelId) && !/edit/i.test(modelId);
  const body: Record<string, unknown> = { model: modelId, prompt };
  if (isQwenImage) {
    body.num_inference_steps = 50;
    body.cfg = 4.0;
  } else {
    body.image_size = size;
    body.batch_size = Math.min(n, 4);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
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
      "Generates one image per call. Supports different sizes and style presets.",
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
      quality: Type.Optional(
        Type.String({
          description: "Quality: standard (default), hd",
        }),
      ),
    }),
    execute: async (_toolCallId: string, args: unknown) => {
      const record = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
      const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
      if (!prompt) {
        return {
          content: [
            { type: "text" as const, text: "Error: prompt is required for image generation." },
          ],
          details: { error: "missing_prompt" },
        };
      }

      const size = typeof record.size === "string" ? record.size.trim() : "1024x1024";
      const style = typeof record.style === "string" ? record.style.trim() : "vivid";
      const quality = typeof record.quality === "string" ? record.quality.trim() : "standard";
      const n = 1;

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

        let results: ImageGenResult[] = [];

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
          // 2. Cloud provider resolution
          //
          // Priority:
          //   a) User's explicit modelCapability.capabilities["image-generation"] config
          //   b) Auto-discover from model registry by ID pattern matching

          if (agentDir) await ensureOpenClawCNModelsJson(cfg, agentDir);
          const authStorage = agentDir ? discoverAuthStorage(agentDir) : null;
          const registry = authStorage && agentDir ? discoverModels(authStorage, agentDir) : null;
          const models = registry ? registry.getAll() : [];

          // 2a. Check user's explicit image-generation model selection
          let imageGenModel: (typeof models)[number] | undefined;

          const mcCaps = (cfg as Record<string, unknown>).modelCapability as
            | { capabilities?: Record<string, { providerId?: string; modelId?: string }> }
            | undefined;
          const imgCfg = mcCaps?.capabilities?.["image-generation"];
          if (imgCfg?.providerId && imgCfg?.modelId) {
            // [CN-FIX] Qwen-Image-Edit is an *editing* model that requires a source
            // image.  For pure text-to-image generation, prefer Qwen-Image instead.
            let resolvedModelId = imgCfg.modelId;
            if (/^Qwen\/Qwen-Image-Edit/i.test(resolvedModelId)) {
              resolvedModelId = "Qwen/Qwen-Image";
              log.info(
                `Remapped image-edit model ${imgCfg.modelId} → ${resolvedModelId} ` +
                  `(text-to-image generation does not support editing models)`,
              );
            }

            // Find this exact model in registry
            imageGenModel = models.find(
              (m) =>
                m.provider === imgCfg.providerId &&
                (m.id === resolvedModelId || m.id.endsWith(`/${resolvedModelId}`)),
            );
            if (!imageGenModel) {
              // Not in registry — build a synthetic entry so we can still use it
              // (user configured it in settings, we trust the provider is available)
              const providerConfig = (
                (cfg as Record<string, unknown>).models as
                  | { providers?: Record<string, { baseUrl?: string }> }
                  | undefined
              )?.providers?.[imgCfg.providerId];
              imageGenModel = {
                id: resolvedModelId,
                provider: imgCfg.providerId,
                baseUrl: providerConfig?.baseUrl ?? "",
              } as (typeof models)[number];
              log.info(
                `Using user-configured image-gen model (not in registry): ` +
                  `${imgCfg.providerId}/${resolvedModelId}`,
              );
            }
          }

          // 2b. Fallback: auto-discover by model ID pattern
          if (!imageGenModel) {
            imageGenModel = models.find((m) => {
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
                id.includes("kolors") ||
                id.includes("qwen-image") ||
                id.includes("cogview")
              );
            });
          }

          if (!imageGenModel) {
            return {
              content: [
                {
                  type: "text" as const,
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

          // [CN-FIX] Fallback chain: if the primary model fails with 400/404,
          // try well-known alternatives from the same provider before giving up.
          const SILICONFLOW_FALLBACKS = [
            "Qwen/Qwen-Image",
            "black-forest-labs/FLUX.1-schnell",
            "Kwai-Kolors/Kolors",
          ];

          let lastError: Error | undefined;
          const modelsToTry = [imageGenModel.id];
          if (imageGenModel.provider === "siliconflow") {
            for (const fb of SILICONFLOW_FALLBACKS) {
              if (!modelsToTry.includes(fb)) modelsToTry.push(fb);
            }
          }

          for (const candidateModelId of modelsToTry) {
            try {
              results = await handler({
                apiKey,
                prompt,
                size,
                style,
                quality,
                n,
                baseUrl: imageGenModel.baseUrl,
                modelId: candidateModelId,
              });
              if (candidateModelId !== imageGenModel.id) {
                log.info(
                  `Primary model ${imageGenModel.id} failed, succeeded with fallback: ${candidateModelId}`,
                );
              }
              lastError = undefined;
              break;
            } catch (err) {
              lastError = err instanceof Error ? err : new Error(String(err));
              const msg = lastError.message;
              // Only retry on "model not exist" / 400 / 404 errors
              if (msg.includes("400") || msg.includes("404") || msg.includes("does not exist")) {
                log.warn(
                  `Image gen model ${candidateModelId} failed (${msg.substring(0, 100)}), trying next...`,
                );
                continue;
              }
              // Other errors (auth, timeout, etc.) — don't retry
              throw lastError;
            }
          }
          if (lastError) {
            throw lastError;
          }
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
          type: "text" as const,
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
          content: [{ type: "text" as const, text: lines.join("\n") }, imageMetaBlock],
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
              type: "text" as const,
              text: `Image generation failed: ${errorMsg}`,
            },
          ],
          details: { error: errorMsg, prompt, size, style },
        };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Image Edit Tool — edits an existing image based on text instructions
// ---------------------------------------------------------------------------

type ImageEditProviderHandler = (params: {
  apiKey: string;
  prompt: string;
  image: string;
  image2?: string;
  image3?: string;
  baseUrl?: string;
  modelId: string;
}) => Promise<ImageGenResult[]>;

const editWithSiliconFlow: ImageEditProviderHandler = async ({
  apiKey,
  prompt,
  image,
  image2,
  image3,
  baseUrl,
  modelId,
}) => {
  const url = `${normalizeBaseUrl(baseUrl, "https://api.siliconflow.cn")}/v1/images/generations`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  const body: Record<string, unknown> = {
    model: modelId,
    prompt,
    image,
    num_inference_steps: 50,
    cfg: 4.0,
  };
  if (image2) body.image2 = image2;
  if (image3) body.image3 = image3;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`SiliconFlow image edit failed (${response.status}): ${errorText}`);
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
    throw new Error("SiliconFlow returned empty image edit data");
  }
  return results;
};

function resolveImageEditProvider(provider: string): ImageEditProviderHandler {
  if (provider === "siliconflow") return editWithSiliconFlow;
  // Future: OpenAI edit, DashScope edit, etc.
  return editWithSiliconFlow; // Default fallback
}

export function createImageEditTool(options?: {
  config?: OpenClawCNConfig;
  agentDir?: string;
  sessionKey?: string;
}): AnyAgentTool {
  return {
    label: "Image Editing",
    name: "image_edit",
    description:
      "Edit an existing image based on text instructions. " +
      "Use this tool when the user sends an image and asks to modify, edit, change, remove, or add elements. " +
      "Requires a source image (base64 data URL or URL) and editing instructions. " +
      "Examples: change background color, remove watermark, add text overlay, change style.",
    parameters: Type.Object({
      prompt: Type.String({
        description:
          "Text description of the editing instructions (e.g., 'change the sky to sunset colors')",
      }),
      image: Type.String({
        description:
          "Source image as a base64 data URL (data:image/png;base64,...) or an HTTPS URL",
      }),
      image2: Type.Optional(
        Type.String({
          description:
            "Optional second reference image (for multi-image editing, Qwen-Image-Edit-2509 only)",
        }),
      ),
      image3: Type.Optional(
        Type.String({
          description:
            "Optional third reference image (for multi-image editing, Qwen-Image-Edit-2509 only)",
        }),
      ),
    }),
    execute: async (_toolCallId, args) => {
      const record = args as Record<string, unknown>;
      const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
      const image = typeof record.image === "string" ? record.image.trim() : "";

      if (!prompt) {
        return {
          content: [{ type: "text" as const, text: "Error: editing prompt is required." }],
          details: { error: "missing_prompt" },
        };
      }
      if (!image) {
        return {
          content: [
            { type: "text" as const, text: "Error: source image is required for editing." },
          ],
          details: { error: "missing_image" },
        };
      }

      const image2 = typeof record.image2 === "string" ? record.image2.trim() : undefined;
      const image3 = typeof record.image3 === "string" ? record.image3.trim() : undefined;
      const agentDir = options?.agentDir?.trim() || "";
      const cfg = options?.config;
      const sessionKey = options?.sessionKey || `default-${Date.now()}`;
      const startTime = Date.now();

      try {
        // Resolve editing model from user config
        if (agentDir) await ensureOpenClawCNModelsJson(cfg, agentDir);
        const authStorage = agentDir ? discoverAuthStorage(agentDir) : null;
        const registry = authStorage && agentDir ? discoverModels(authStorage, agentDir) : null;
        const models = registry ? registry.getAll() : [];

        let editModel: (typeof models)[number] | undefined;

        const mcCaps = (cfg as Record<string, unknown>)?.modelCapability as
          | { capabilities?: Record<string, { providerId?: string; modelId?: string }> }
          | undefined;
        const editCfg = mcCaps?.capabilities?.["image-editing"];
        if (editCfg?.providerId && editCfg?.modelId) {
          editModel = models.find(
            (m) =>
              m.provider === editCfg.providerId &&
              (m.id === editCfg.modelId || m.id.endsWith(`/${editCfg.modelId}`)),
          );
          if (!editModel) {
            const providerConfig = (
              (cfg as Record<string, unknown>)?.models as
                | { providers?: Record<string, { baseUrl?: string }> }
                | undefined
            )?.providers?.[editCfg.providerId];
            editModel = {
              id: editCfg.modelId,
              provider: editCfg.providerId,
              baseUrl: providerConfig?.baseUrl ?? "",
            } as (typeof models)[number];
            log.info(
              `Using user-configured image-edit model (not in registry): ` +
                `${editCfg.providerId}/${editCfg.modelId}`,
            );
          }
        }

        // Fallback: find editing models by pattern
        if (!editModel) {
          editModel = models.find((m) => {
            const id = m.id.toLowerCase();
            return id.includes("image-edit") || id.includes("kontext");
          });
        }

        // Final fallback: default to Qwen-Image-Edit on siliconflow
        if (!editModel) {
          editModel = {
            id: "Qwen/Qwen-Image-Edit",
            provider: "siliconflow",
            baseUrl: "",
          } as (typeof models)[number];
          log.info(
            "No image-editing model configured, defaulting to siliconflow/Qwen/Qwen-Image-Edit",
          );
        }

        log.info(`Using image edit model: ${editModel.provider}/${editModel.id}`);

        const authInfo = await getApiKeyForModel({
          model: editModel,
          cfg,
          agentDir,
        });
        const apiKey = requireApiKey(authInfo, editModel.provider);
        const handler = resolveImageEditProvider(editModel.provider);

        const results = await handler({
          apiKey,
          prompt,
          image,
          image2,
          image3,
          baseUrl: editModel.baseUrl,
          modelId: editModel.id,
        });

        const durationMs = Date.now() - startTime;
        log.info(
          `Image edited: ${results.length} image(s), ` +
            `provider=${results[0]?.provider}, model=${results[0]?.model}, ${durationMs}ms`,
        );

        // Persist edited images
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
              size: "original",
              style: "edit",
              durationMs,
            };
            const entry = await saveGeneratedImage({
              sessionKey,
              data: buffer,
              mimeType,
              meta,
            });
            if (entry) {
              persistedUrls.push(`/api/media/chat-images/${sessionKey}/${entry.file}`);
              persistedPaths.push(entry.file);
            } else {
              persistedUrls.push(result.imageUrl);
            }
          } catch (persistErr) {
            log.warn(`Failed to persist edited image: ${(persistErr as Error).message}`);
            persistedUrls.push(result.imageUrl);
          }
        }

        const firstResult = results[0]!;
        const lines = [`Image edited successfully.`];
        if (firstResult.revisedPrompt) {
          lines.push(`\nRevised prompt: ${firstResult.revisedPrompt}`);
        }

        const imageMetaBlock = {
          type: "text" as const,
          text: `<!--OPENCLAWCN_IMAGE_GEN:${JSON.stringify({
            imageUrl: persistedUrls[0],
            imageUrls: persistedUrls,
            imageFiles: persistedPaths,
            imageCount: results.length,
            model: `${firstResult.provider}/${firstResult.model}`,
            provider: firstResult.provider,
            prompt,
            size: "original",
            style: "edit",
            durationMs,
            revisedPrompt: firstResult.revisedPrompt,
          })}-->`,
        };

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }, imageMetaBlock],
          details: {
            model: `${firstResult.provider}/${firstResult.model}`,
            provider: firstResult.provider,
            imageUrl: persistedUrls[0],
            imageUrls: persistedUrls,
            imageFiles: persistedPaths,
            imageCount: results.length,
            prompt,
            durationMs,
          },
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(`Image editing failed: ${errorMsg}`);

        return {
          content: [{ type: "text" as const, text: `Image editing failed: ${errorMsg}` }],
          details: { error: errorMsg, prompt },
        };
      }
    },
  };
}
