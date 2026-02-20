/**
 * Lightweight LLM classification — sends a single-shot classification request.
 *
 * Separated from intent-classifier.ts to isolate the model/provider dependency
 * and allow lazy importing (avoids circular deps with agent infrastructure).
 */

import type { OpenClawCNConfig } from "../config/config.js";
import { DEFAULT_PROVIDER } from "../agents/defaults.js";
import { parseModelRef } from "../agents/model-selection.js";
import { resolveApiKeyForProvider } from "../agents/model-auth.js";

export async function classifyWithLightweightModel(params: {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens: number;
  cfg: OpenClawCNConfig;
  agentDir: string;
  timeoutMs: number;
  /** External abort signal (e.g. from dispatch timeout). */
  signal?: AbortSignal;
}): Promise<string | null> {
  const { systemPrompt, userPrompt, maxTokens, cfg, agentDir, timeoutMs } = params;
  // "auto" → 动态读取用户配置的 text 能力模型
  let model = params.model;
  if (model === "auto") {
    const cap = (cfg as Record<string, unknown>).modelCapability as
      | { capabilities?: Record<string, { providerId?: string; modelId?: string }> }
      | undefined;
    const textCap = cap?.capabilities?.["text"];
    if (textCap?.providerId && textCap?.modelId) {
      model = `${textCap.providerId}/${textCap.modelId}`;
    }
  }

  // Early exit if already aborted
  if (params.signal?.aborted) return null;

  // Parse the model reference
  const modelRef = parseModelRef(model, DEFAULT_PROVIDER);
  if (!modelRef) {
    console.warn(`[dispatch] Invalid classifier model: ${model}`);
    return null;
  }

  try {
    // Get API key for the provider
    const auth = await resolveApiKeyForProvider({
      provider: modelRef.provider,
      cfg,
      agentDir,
    });

    if (!auth?.apiKey) {
      console.warn(
        `[dispatch] No API key for classifier model ${modelRef.provider}/${modelRef.model}`,
      );
      return null;
    }

    // Make a direct lightweight API call based on provider type
    const result = await callProvider({
      provider: modelRef.provider,
      model: modelRef.model,
      apiKey: auth.apiKey,
      systemPrompt,
      userPrompt,
      maxTokens,
      timeoutMs,
      externalSignal: params.signal,
    });

    return result;
  } catch (err) {
    console.warn("[dispatch] Lightweight model call failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider-specific API calls
// ---------------------------------------------------------------------------

async function callProvider(params: {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  timeoutMs: number;
  /** External abort signal (e.g. from dispatch timeout). */
  externalSignal?: AbortSignal;
}): Promise<string | null> {
  const { provider, model, apiKey, baseUrl, systemPrompt, userPrompt, maxTokens, timeoutMs } =
    params;

  // Compose internal timeout + external abort signal.
  // AbortSignal.any() merges both: fires when either triggers.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If an external signal is provided, listen for it and propagate abort
  let externalAbortHandler: (() => void) | undefined;
  if (params.externalSignal) {
    if (params.externalSignal.aborted) {
      clearTimeout(timer);
      return null;
    }
    externalAbortHandler = () => controller.abort();
    params.externalSignal.addEventListener("abort", externalAbortHandler, { once: true });
  }

  try {
    if (provider === "anthropic") {
      return await callAnthropic({
        model,
        apiKey,
        baseUrl,
        systemPrompt,
        userPrompt,
        maxTokens,
        signal: controller.signal,
      });
    }

    // Default: OpenAI-compatible API (works for openai, deepseek, qwen, etc.)
    return await callOpenAICompatible({
      model,
      apiKey,
      baseUrl: baseUrl ?? inferBaseUrl(provider),
      systemPrompt,
      userPrompt,
      maxTokens,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    if (externalAbortHandler && params.externalSignal) {
      params.externalSignal.removeEventListener("abort", externalAbortHandler);
    }
  }
}

async function callAnthropic(params: {
  model: string;
  apiKey: string;
  baseUrl?: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  signal: AbortSignal;
}): Promise<string | null> {
  const url = `${params.baseUrl || "https://api.anthropic.com"}/v1/messages`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.systemPrompt,
      messages: [{ role: "user", content: params.userPrompt }],
    }),
    signal: params.signal,
  });

  if (!resp.ok) {
    console.warn(`[dispatch] Anthropic API error: ${resp.status} ${resp.statusText}`);
    return null;
  }

  const data = (await resp.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.[0]?.text ?? null;
}

async function callOpenAICompatible(params: {
  model: string;
  apiKey: string;
  baseUrl: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  signal: AbortSignal;
}): Promise<string | null> {
  const url = `${params.baseUrl}/v1/chat/completions`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    }),
    signal: params.signal,
  });

  if (!resp.ok) {
    console.warn(`[dispatch] OpenAI-compatible API error: ${resp.status} ${resp.statusText}`);
    return null;
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? null;
}

function inferBaseUrl(provider: string): string {
  const providerUrls: Record<string, string> = {
    openai: "https://api.openai.com",
    deepseek: "https://api.deepseek.com",
    "qwen-portal": "https://dashscope.aliyuncs.com/compatible-mode",
    glm: "https://open.bigmodel.cn/api/paas",
    moonshot: "https://api.moonshot.cn",
  };
  return providerUrls[provider] ?? "https://api.openai.com";
}
