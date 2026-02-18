/**
 * Image Generation Tool — generates images from text prompts.
 *
 * Supports:
 *   - OpenAI DALL-E 3 (via /v1/images/generations)
 *   - Aliyun Wanx / 通义万相 (via DashScope API)
 *   - SiliconFlow image models
 *
 * CN-only module: registered in clawdbot-tools.ts, safe from upstream merge.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import type { OpenClawCNConfig } from "../../config/config.js";
import { getApiKeyForModel } from "../model-auth.js";
import { requireApiKey } from "../model-auth.js";
import { ensureAuthProfileStore } from "../auth-profiles.js";
import { ensureOpenClawCNModelsJson } from "../models-config.js";
import { discoverAuthStorage, discoverModels } from "../pi-model-discovery.js";
import { resolveConfiguredModelRef } from "../model-selection.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("tools/image-gen");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImageGenResult = {
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
  baseUrl?: string;
  modelId: string;
}) => Promise<ImageGenResult>;

// ---------------------------------------------------------------------------
// Provider Handlers
// ---------------------------------------------------------------------------

/**
 * OpenAI DALL-E 3 image generation.
 */
const generateWithOpenAI: ImageGenProviderHandler = async ({
  apiKey,
  prompt,
  size,
  style,
  baseUrl,
  modelId,
}) => {
  const url = `${baseUrl || "https://api.openai.com"}/v1/images/generations`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId || "dall-e-3",
      prompt,
      n: 1,
      size,
      style,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`OpenAI image generation failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string; url?: string }>;
  };
  const imageData = data.data?.[0];
  if (!imageData) {
    throw new Error("OpenAI returned empty image data");
  }

  const imageUrl = imageData.b64_json
    ? `data:image/png;base64,${imageData.b64_json}`
    : (imageData.url ?? "");

  return {
    imageUrl,
    revisedPrompt: imageData.revised_prompt,
    model: modelId || "dall-e-3",
    provider: "openai",
  };
};

/**
 * Aliyun DashScope (通义万相) image generation.
 */
const generateWithDashScope: ImageGenProviderHandler = async ({
  apiKey,
  prompt,
  size,
  modelId,
}) => {
  const url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";

  // Submit task
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
        n: 1,
      },
    }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text().catch(() => "unknown error");
    throw new Error(`DashScope submit failed (${submitResponse.status}): ${errorText}`);
  }

  const submitData = (await submitResponse.json()) as {
    output?: { task_id?: string; task_status?: string };
    request_id?: string;
  };
  const taskId = submitData.output?.task_id;
  if (!taskId) {
    throw new Error("DashScope returned no task_id");
  }

  // Poll for result (max 60 seconds)
  const taskUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
  const maxPollTime = 60_000;
  const pollInterval = 2_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const pollResponse = await fetch(taskUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollResponse.ok) continue;

    const pollData = (await pollResponse.json()) as {
      output?: {
        task_status?: string;
        results?: Array<{ url?: string; b64_image?: string }>;
      };
    };
    const status = pollData.output?.task_status;

    if (status === "SUCCEEDED") {
      const result = pollData.output?.results?.[0];
      if (!result) throw new Error("DashScope returned no image result");

      const imageUrl = result.b64_image
        ? `data:image/png;base64,${result.b64_image}`
        : (result.url ?? "");

      return {
        imageUrl,
        model: modelId || "wanx-v1",
        provider: "dashscope",
      };
    }

    if (status === "FAILED") {
      throw new Error("DashScope image generation task failed");
    }
  }

  throw new Error("DashScope image generation timed out (60s)");
};

/**
 * SiliconFlow / OpenAI-compatible image generation endpoint.
 */
const generateWithSiliconFlow: ImageGenProviderHandler = async ({
  apiKey,
  prompt,
  size,
  baseUrl,
  modelId,
}) => {
  const url = `${baseUrl || "https://api.siliconflow.cn"}/v1/images/generations`;
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
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`SiliconFlow image generation failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    images?: Array<{ url?: string }>;
    data?: Array<{ url?: string; b64_json?: string }>;
  };

  const imageData = data.images?.[0] || data.data?.[0];
  if (!imageData) {
    throw new Error("SiliconFlow returned empty image data");
  }

  const imageUrl = (imageData as { b64_json?: string }).b64_json
    ? `data:image/png;base64,${(imageData as { b64_json: string }).b64_json}`
    : (imageData.url ?? "");

  return {
    imageUrl,
    model: modelId,
    provider: "siliconflow",
  };
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
  if (provider === "dashscope" || provider === "tongyi" || provider === "aliyun") {
    return generateWithDashScope;
  }
  if (provider === "siliconflow") {
    return generateWithSiliconFlow;
  }
  if (modelId.includes("dall-e") || modelId.includes("gpt-image") || provider === "openai") {
    return generateWithOpenAI;
  }
  // Default: try OpenAI-compatible endpoint (works for many providers)
  return generateWithOpenAI;
}

// ---------------------------------------------------------------------------
// Tool Factory
// ---------------------------------------------------------------------------

export function createImageGenTool(options?: {
  config?: OpenClawCNConfig;
  agentDir?: string;
}): AnyAgentTool {
  return {
    label: "Image Generation",
    name: "image_gen",
    description:
      "Generate images from text descriptions. " +
      "Use this tool when the user asks to create, draw, paint, design, or generate an image, picture, illustration, logo, poster, etc. " +
      "Provide a detailed prompt describing the desired image.",
    parameters: Type.Object({
      prompt: Type.String({
        description: "Detailed text description of the image to generate",
      }),
      size: Type.Optional(
        Type.String({
          description:
            "Image size. Options: 1024x1024 (square, default), 1792x1024 (landscape), 1024x1792 (portrait)",
        }),
      ),
      style: Type.Optional(
        Type.String({
          description:
            "Image style. Options: vivid (default, hyper-real/dramatic), natural (more natural, less hyper-real)",
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

      const agentDir = options?.agentDir?.trim() || "";
      const cfg = options?.config;

      try {
        // Discover available models and find one that supports image generation
        const modelsJson = agentDir ? await ensureOpenClawCNModelsJson(agentDir) : null;
        const models = modelsJson ? discoverModels(modelsJson) : [];

        // Find an image generation model
        const imageGenModel = models.find((m) => {
          const id = m.id.toLowerCase();
          return (
            id.includes("dall-e") ||
            id.includes("gpt-image") ||
            id.includes("wanx") ||
            id.includes("wan-x") ||
            id.includes("stable-diffusion") ||
            id.startsWith("sd-") ||
            id.includes("sdxl") ||
            id.includes("flux") ||
            id.includes("midjourney")
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
                  "in your agent settings.",
              },
            ],
            details: { error: "no_image_gen_model" },
          };
        }

        log.info(`Using image gen model: ${imageGenModel.provider}/${imageGenModel.id}`);

        // Get API key
        const authInfo = await getApiKeyForModel({
          model: imageGenModel,
          cfg,
          agentDir,
        });
        const apiKey = requireApiKey(authInfo, imageGenModel.provider);

        // Select provider handler
        const handler = resolveImageGenProvider(imageGenModel.provider, imageGenModel.id);

        // Generate image
        const result = await handler({
          apiKey,
          prompt,
          size,
          style,
          baseUrl: imageGenModel.baseUrl,
          modelId: imageGenModel.id,
        });

        log.info(`Image generated successfully: ${result.provider}/${result.model}`);

        // Build response text
        const lines = [`Image generated successfully.`];
        if (result.revisedPrompt) {
          lines.push(`\nRevised prompt: ${result.revisedPrompt}`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: {
            model: `${result.provider}/${result.model}`,
            imageUrl: result.imageUrl,
            prompt,
            size,
            style,
            revisedPrompt: result.revisedPrompt,
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
