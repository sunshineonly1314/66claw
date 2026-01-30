import type { OAuthCredentials } from "@mariozechner/pi-ai";
import { resolveClawdbotAgentDir } from "../agents/agent-paths.js";
import { upsertAuthProfile } from "../agents/auth-profiles.js";

const resolveAuthAgentDir = (agentDir?: string) => agentDir ?? resolveClawdbotAgentDir();

export async function writeOAuthCredentials(
  provider: string,
  creds: OAuthCredentials,
  agentDir?: string,
): Promise<void> {
  // Write to resolved agent dir so gateway finds credentials on startup.
  upsertAuthProfile({
    profileId: `${provider}:${creds.email ?? "default"}`,
    credential: {
      type: "oauth",
      provider,
      ...creds,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setAnthropicApiKey(key: string, agentDir?: string) {
  // Write to resolved agent dir so gateway finds credentials on startup.
  upsertAuthProfile({
    profileId: "anthropic:default",
    credential: {
      type: "api_key",
      provider: "anthropic",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setGeminiApiKey(key: string, agentDir?: string) {
  // Write to resolved agent dir so gateway finds credentials on startup.
  upsertAuthProfile({
    profileId: "google:default",
    credential: {
      type: "api_key",
      provider: "google",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setMinimaxApiKey(key: string, agentDir?: string) {
  // Write to resolved agent dir so gateway finds credentials on startup.
  upsertAuthProfile({
    profileId: "minimax:default",
    credential: {
      type: "api_key",
      provider: "minimax",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setMoonshotApiKey(key: string, agentDir?: string) {
  // Write to resolved agent dir so gateway finds credentials on startup.
  upsertAuthProfile({
    profileId: "moonshot:default",
    credential: {
      type: "api_key",
      provider: "moonshot",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setKimiCodeApiKey(key: string, agentDir?: string) {
  // Write to resolved agent dir so gateway finds credentials on startup.
  upsertAuthProfile({
    profileId: "kimi-code:default",
    credential: {
      type: "api_key",
      provider: "kimi-code",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setSyntheticApiKey(key: string, agentDir?: string) {
  // Write to resolved agent dir so gateway finds credentials on startup.
  upsertAuthProfile({
    profileId: "synthetic:default",
    credential: {
      type: "api_key",
      provider: "synthetic",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setVeniceApiKey(key: string, agentDir?: string) {
  // Write to resolved agent dir so gateway finds credentials on startup.
  upsertAuthProfile({
    profileId: "venice:default",
    credential: {
      type: "api_key",
      provider: "venice",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export const ZAI_DEFAULT_MODEL_REF = "zai/glm-4.7";
export const OPENROUTER_DEFAULT_MODEL_REF = "openrouter/auto";
export const VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF = "vercel-ai-gateway/anthropic/claude-opus-4.5";

export async function setZaiApiKey(key: string, agentDir?: string) {
  // Write to resolved agent dir so gateway finds credentials on startup.
  upsertAuthProfile({
    profileId: "zai:default",
    credential: {
      type: "api_key",
      provider: "zai",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setOpenrouterApiKey(key: string, agentDir?: string) {
  upsertAuthProfile({
    profileId: "openrouter:default",
    credential: {
      type: "api_key",
      provider: "openrouter",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setVercelAiGatewayApiKey(key: string, agentDir?: string) {
  upsertAuthProfile({
    profileId: "vercel-ai-gateway:default",
    credential: {
      type: "api_key",
      provider: "vercel-ai-gateway",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setOpencodeZenApiKey(key: string, agentDir?: string) {
  upsertAuthProfile({
    profileId: "opencode:default",
    credential: {
      type: "api_key",
      provider: "opencode",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

// ============================================================================
// 中国区提供商 (China Region Providers)
// ============================================================================

export const SILICONFLOW_DEFAULT_MODEL_REF = "siliconflow/deepseek-ai/DeepSeek-V3";
export const DEEPSEEK_DEFAULT_MODEL_REF = "deepseek/deepseek-chat";
export const GLM_DEFAULT_MODEL_REF = "glm/glm-4-plus";

export async function setSiliconFlowApiKey(key: string, agentDir?: string) {
  upsertAuthProfile({
    profileId: "siliconflow:default",
    credential: {
      type: "api_key",
      provider: "siliconflow",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setDeepSeekApiKey(key: string, agentDir?: string) {
  upsertAuthProfile({
    profileId: "deepseek:default",
    credential: {
      type: "api_key",
      provider: "deepseek",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setGlmApiKey(key: string, agentDir?: string) {
  upsertAuthProfile({
    profileId: "glm:default",
    credential: {
      type: "api_key",
      provider: "glm",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setAliyunBailianApiKey(key: string, agentDir?: string) {
  upsertAuthProfile({
    profileId: "aliyun-bailian:default",
    credential: {
      type: "api_key",
      provider: "aliyun-bailian",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setVolcengineArkApiKey(key: string, agentDir?: string) {
  upsertAuthProfile({
    profileId: "volcengine-ark:default",
    credential: {
      type: "api_key",
      provider: "volcengine-ark",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}

export async function setTencentHunyuanApiKey(key: string, agentDir?: string) {
  upsertAuthProfile({
    profileId: "tencent-hunyuan:default",
    credential: {
      type: "api_key",
      provider: "tencent-hunyuan",
      key,
    },
    agentDir: resolveAuthAgentDir(agentDir),
  });
}
