import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { ReasoningLevel, ThinkLevel } from "../../auto-reply/thinking.js";

export function mapThinkingLevel(level?: ThinkLevel): ThinkingLevel {
  // pi-agent-core supports "xhigh"; OpenClawCN enables it for specific models.
  if (!level) {
    return "off";
  }
  return level;
}

// ===== OpenClawCN: Providers/APIs that do not support structured thinking =====
const THINKING_UNSUPPORTED_APIS = new Set(["ollama"]);
const THINKING_UNSUPPORTED_PROVIDERS = new Set([
  "ollama",
  "vllm",
  "lmstudio",
  "llamacpp",
  "localai",
]);

/**
 * Check whether a provider/API combination supports the structured thinking
 * protocol (extended thinking / chain-of-thought metadata).
 *
 * Local providers (ollama, vllm, lmstudio, llamacpp, localai) do not implement
 * the thinking block protocol, even when they expose OpenAI-compatible APIs.
 * Sending thinkingLevel != "off" to these providers causes pi-agent-core to
 * expect thinking blocks the model never sends → stopReason: "error".
 */
export function isThinkingSupported(provider: string, modelApi: string): boolean {
  if (THINKING_UNSUPPORTED_APIS.has(modelApi)) {
    return false;
  }
  if (THINKING_UNSUPPORTED_PROVIDERS.has(provider.toLowerCase())) {
    return false;
  }
  return true;
}

/**
 * Resolve the effective thinking level for a provider. Downgrades to "off"
 * for providers that cannot honour the structured thinking protocol.
 */
export function resolveEffectiveThinkLevel(params: {
  requested: ThinkLevel;
  provider: string;
  modelApi: string;
}): ThinkLevel {
  if (params.requested === "off") {
    return "off";
  }
  if (!isThinkingSupported(params.provider, params.modelApi)) {
    return "off";
  }
  return params.requested;
}
// ===== END =====

export function describeUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    const serialized = JSON.stringify(error);
    return serialized ?? "Unknown error";
  } catch {
    return "Unknown error";
  }
}

export type { ReasoningLevel, ThinkLevel };
