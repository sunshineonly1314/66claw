import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveEnvApiKey } from "./model-auth.js";

describe("resolveEnvApiKey - CN providers", () => {
  let savedEnv: Record<string, string | undefined>;

  const CN_PROVIDER_ENV_MAP: Record<string, string> = {
    siliconflow: "SILICONFLOW_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    glm: "ZHIPU_API_KEY",
    zhipu: "ZHIPU_API_KEY",
    "qwen-dashscope": "DASHSCOPE_API_KEY",
    dashscope: "DASHSCOPE_API_KEY",
    doubao: "DOUBAO_API_KEY",
    ark: "ARK_API_KEY",
    "aliyun-bailian": "DASHSCOPE_API_KEY",
    "volcengine-ark": "ARK_API_KEY",
    "tencent-hunyuan": "HUNYUAN_API_KEY",
    moonshot: "MOONSHOT_API_KEY",
  };

  beforeEach(() => {
    savedEnv = {};
    for (const envVar of new Set(Object.values(CN_PROVIDER_ENV_MAP))) {
      savedEnv[envVar] = process.env[envVar];
      delete process.env[envVar];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  for (const [provider, envVar] of Object.entries(CN_PROVIDER_ENV_MAP)) {
    it("resolves " + provider + " via " + envVar, () => {
      process.env[envVar] = "test-key-123";
      const result = resolveEnvApiKey(provider);
      expect(result).not.toBeNull();
      expect(result?.apiKey).toBe("test-key-123");
      expect(result?.source).toContain(envVar);
      delete process.env[envVar];
    });
  }

  it("tencent-hunyuan uses HUNYUAN_API_KEY (not HUNYUAN_SECRET_ID)", () => {
    process.env.HUNYUAN_API_KEY = "hy-test-key";
    const result = resolveEnvApiKey("tencent-hunyuan");
    expect(result).not.toBeNull();
    expect(result?.apiKey).toBe("hy-test-key");
    expect(result?.source).toContain("HUNYUAN_API_KEY");
  });

  it("returns null for unknown provider", () => {
    expect(resolveEnvApiKey("nonexistent-provider")).toBeNull();
  });

  it("returns null when env var is not set", () => {
    expect(resolveEnvApiKey("tencent-hunyuan")).toBeNull();
  });

  it("trims whitespace from API keys", () => {
    process.env.DEEPSEEK_API_KEY = "  sk-deep-123  ";
    const result = resolveEnvApiKey("deepseek");
    expect(result).not.toBeNull();
    expect(result?.apiKey).toBe("sk-deep-123");
  });
});
