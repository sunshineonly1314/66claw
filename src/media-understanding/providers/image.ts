import type { Api, AssistantMessage, Context, Model } from "@mariozechner/pi-ai";
import { complete } from "@mariozechner/pi-ai";
import { discoverAuthStorage } from "@mariozechner/pi-coding-agent";

import { getApiKeyForModel, requireApiKey } from "../../agents/model-auth.js";
import { ensureClawdbotModelsJson, getMergedProvidersForAgent } from "../../agents/models-config.js";
import { resolveModel } from "../../agents/pi-embedded-runner/model.js";
import { minimaxUnderstandImage } from "../../agents/minimax-vlm.js";
import { coerceImageAssistantText } from "../../agents/tools/image-tool.helpers.js";
import type { ImageDescriptionRequest, ImageDescriptionResult } from "../types.js";

export async function describeImageWithModel(
  params: ImageDescriptionRequest,
): Promise<ImageDescriptionResult> {
  await ensureClawdbotModelsJson(params.cfg, params.agentDir);
  const mergedProviders = await getMergedProvidersForAgent(params.cfg, params.agentDir);
  const cfgForModel =
    Object.keys(mergedProviders).length > 0
      ? { ...params.cfg, models: { ...params.cfg?.models, providers: mergedProviders } }
      : params.cfg;
  const { model, error } = resolveModel(
    params.provider,
    params.model,
    params.agentDir,
    cfgForModel,
  );
  if (!model) {
    throw new Error(error ?? `Unknown model: ${params.provider}/${params.model}`);
  }
  const authStorage = discoverAuthStorage(params.agentDir);
  if (!model.input?.includes("image")) {
    throw new Error(`Model does not support images: ${params.provider}/${params.model}`);
  }
  const apiKeyInfo = await getApiKeyForModel({
    model,
    cfg: cfgForModel,
    agentDir: params.agentDir,
    profileId: params.profile,
    preferredProfile: params.preferredProfile,
  });
  const apiKey = requireApiKey(apiKeyInfo, model.provider);
  authStorage.setRuntimeApiKey(model.provider, apiKey);

  const base64 = params.buffer.toString("base64");
  if (model.provider === "minimax") {
    const text = await minimaxUnderstandImage({
      apiKey,
      prompt: params.prompt ?? "Describe the image.",
      imageDataUrl: `data:${params.mime ?? "image/jpeg"};base64,${base64}`,
      modelBaseUrl: model.baseUrl,
    });
    return { text, model: model.id };
  }

  const context: Context = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: params.prompt ?? "Describe the image." },
          { type: "image", data: base64, mimeType: params.mime ?? "image/jpeg" },
        ],
        timestamp: Date.now(),
      },
    ],
  };
  const message = (await complete(model, context, {
    apiKey,
    maxTokens: params.maxTokens ?? 512,
  })) as AssistantMessage;
  const text = coerceImageAssistantText({
    message,
    provider: model.provider,
    model: model.id,
  });
  return { text, model: model.id };
}
