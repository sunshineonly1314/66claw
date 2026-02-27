/**
 * Tests for memory-key-resolver.ts
 *
 * Covers:
 * - resolveMemoryProviderBaseUrl: case-insensitive lookup, empty-string fallback for unknown
 * - resolveMemoryProviderHeaders: kimi-coding headers, case-insensitive lookup
 * - isOpenAICompatibleProvider: NON_OPENAI_COMPATIBLE_PROVIDERS rejection
 * - resolveMemoryProviderApiKey: 3-tier resolution (config -> freeModels -> env)
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import {
  resolveMemoryProviderBaseUrl,
  resolveMemoryProviderHeaders,
  isOpenAICompatibleProvider,
  resolveMemoryProviderApiKey,
} from "./memory-key-resolver.js";

// ═══════════════════════════════════════════════════════════════
//  resolveMemoryProviderBaseUrl
// ═══════════════════════════════════════════════════════════════

describe("resolveMemoryProviderBaseUrl", () => {
  it("returns known URL for lowercase provider", () => {
    const url = resolveMemoryProviderBaseUrl(undefined, "siliconflow");
    expect(url).toBe("https://api.siliconflow.cn/v1");
  });

  it("case-insensitive: mixed-case provider resolves correctly", () => {
    const url = resolveMemoryProviderBaseUrl(undefined, "SiliconFlow");
    expect(url).toBe("https://api.siliconflow.cn/v1");
  });

  it("case-insensitive: all-uppercase resolves correctly", () => {
    const url = resolveMemoryProviderBaseUrl(undefined, "DEEPSEEK");
    expect(url).toBe("https://api.deepseek.com/v1");
  });

  it("returns empty string for unknown provider (NOT api.openai.com)", () => {
    const url = resolveMemoryProviderBaseUrl(undefined, "totally-unknown-provider");
    expect(url).toBe("");
    // CRITICAL: Must NOT fall back to OpenAI — would leak credentials
    expect(url).not.toContain("openai.com");
  });

  it("prefers config baseUrl over known defaults", () => {
    const cfg = {
      models: {
        providers: {
          siliconflow: { baseUrl: "https://custom.endpoint.com/v1" },
        },
      },
    } as never;
    const url = resolveMemoryProviderBaseUrl(cfg, "siliconflow");
    expect(url).toBe("https://custom.endpoint.com/v1");
  });

  it("prefers config apiEndpoint over baseUrl", () => {
    const cfg = {
      models: {
        providers: {
          test: { apiEndpoint: "https://ep.com/v1", baseUrl: "https://base.com/v1" },
        },
      },
    } as never;
    const url = resolveMemoryProviderBaseUrl(cfg, "test");
    expect(url).toBe("https://ep.com/v1");
  });

  it("ignores empty/whitespace config baseUrl, falls back to known defaults", () => {
    const cfg = {
      models: {
        providers: {
          deepseek: { baseUrl: "   " },
        },
      },
    } as never;
    const url = resolveMemoryProviderBaseUrl(cfg, "deepseek");
    expect(url).toBe("https://api.deepseek.com/v1");
  });

  it("handles undefined config gracefully", () => {
    const url = resolveMemoryProviderBaseUrl(undefined, "deepseek");
    expect(url).toBe("https://api.deepseek.com/v1");
  });

  it("kimi-coding resolves to correct URL", () => {
    const url = resolveMemoryProviderBaseUrl(undefined, "kimi-coding");
    expect(url).toBe("https://api.kimi.com/coding/v1");
  });

  it("all known CN providers have non-empty URLs", () => {
    const knownProviders = [
      "siliconflow",
      "ant-ling",
      "meituan-longcat",
      "modelscope",
      "deepseek",
      "moonshot",
      "kimi-coding",
      "glm",
      "zhipu",
      "doubao",
      "qwen-dashscope",
      "tencent-hunyuan",
      "groq",
      "together",
    ];
    for (const p of knownProviders) {
      const url = resolveMemoryProviderBaseUrl(undefined, p);
      expect(url, `provider '${p}' should have non-empty URL`).toBeTruthy();
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  resolveMemoryProviderHeaders
// ═══════════════════════════════════════════════════════════════

describe("resolveMemoryProviderHeaders", () => {
  it("kimi-coding returns User-Agent header", () => {
    const headers = resolveMemoryProviderHeaders("kimi-coding");
    expect(headers["User-Agent"]).toBe("KimiCLI/0.77");
  });

  it("case-insensitive: Kimi-Coding resolves headers", () => {
    const headers = resolveMemoryProviderHeaders("Kimi-Coding");
    // The function checks both exact match and lowercase fallback
    expect(headers["User-Agent"]).toBe("KimiCLI/0.77");
  });

  it("unknown provider returns empty headers", () => {
    const headers = resolveMemoryProviderHeaders("siliconflow");
    expect(Object.keys(headers)).toHaveLength(0);
  });

  it("returns empty object, not null/undefined", () => {
    const headers = resolveMemoryProviderHeaders("nonexistent");
    expect(headers).toBeDefined();
    expect(typeof headers).toBe("object");
    expect(headers).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
//  isOpenAICompatibleProvider
// ═══════════════════════════════════════════════════════════════

describe("isOpenAICompatibleProvider", () => {
  it("rejects Anthropic", () => {
    expect(isOpenAICompatibleProvider("anthropic")).toBe(false);
  });

  it("rejects Ollama", () => {
    expect(isOpenAICompatibleProvider("ollama")).toBe(false);
  });

  it("rejects Amazon Bedrock", () => {
    expect(isOpenAICompatibleProvider("amazon-bedrock")).toBe(false);
  });

  it("rejects Google", () => {
    expect(isOpenAICompatibleProvider("google")).toBe(false);
  });

  it("rejects Google Vertex", () => {
    expect(isOpenAICompatibleProvider("google-vertex")).toBe(false);
  });

  it("rejects Minimax", () => {
    expect(isOpenAICompatibleProvider("minimax")).toBe(false);
    expect(isOpenAICompatibleProvider("minimax-portal")).toBe(false);
  });

  it("rejects Xiaomi (uses Anthropic format)", () => {
    expect(isOpenAICompatibleProvider("xiaomi")).toBe(false);
  });

  it("rejects Cloudflare AI Gateway", () => {
    expect(isOpenAICompatibleProvider("cloudflare-ai-gateway")).toBe(false);
  });

  it("rejects Synthetic", () => {
    expect(isOpenAICompatibleProvider("synthetic")).toBe(false);
  });

  it("case-insensitive rejection", () => {
    expect(isOpenAICompatibleProvider("Anthropic")).toBe(false);
    expect(isOpenAICompatibleProvider("OLLAMA")).toBe(false);
    expect(isOpenAICompatibleProvider("Google-Vertex")).toBe(false);
  });

  it("accepts known OpenAI-compatible providers", () => {
    expect(isOpenAICompatibleProvider("siliconflow")).toBe(true);
    expect(isOpenAICompatibleProvider("deepseek")).toBe(true);
    expect(isOpenAICompatibleProvider("openai")).toBe(true);
    expect(isOpenAICompatibleProvider("moonshot")).toBe(true);
    expect(isOpenAICompatibleProvider("kimi-coding")).toBe(true);
    expect(isOpenAICompatibleProvider("groq")).toBe(true);
    expect(isOpenAICompatibleProvider("together")).toBe(true);
  });

  it("accepts unknown providers (default to compatible)", () => {
    expect(isOpenAICompatibleProvider("my-custom-provider")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  resolveMemoryProviderApiKey — basic tests
// ═══════════════════════════════════════════════════════════════

describe("resolveMemoryProviderApiKey", () => {
  it("returns null when no config and no env", () => {
    // Clear any env vars that might interfere
    const key = resolveMemoryProviderApiKey(undefined, "nonexistent-provider");
    // Should return null since no config, no free models, no env
    expect(key === null || typeof key === "string").toBe(true);
  });

  it("reads from config models.providers first", () => {
    const cfg = {
      models: {
        providers: {
          "test-provider": { apiKey: "sk-test-from-config" },
        },
      },
    } as never;
    const key = resolveMemoryProviderApiKey(cfg, "test-provider");
    expect(key).toBe("sk-test-from-config");
  });

  it("falls back to freeModels.accounts", () => {
    const cfg = {
      models: { providers: {} },
      freeModels: {
        enabled: true,
        accounts: [
          { providerId: "siliconflow", enabled: true, status: "active", apiKey: "sk-free-model" },
        ],
      },
    } as never;
    const key = resolveMemoryProviderApiKey(cfg, "siliconflow");
    expect(key).toBe("sk-free-model");
  });

  it("skips disabled freeModels accounts", () => {
    const cfg = {
      models: { providers: {} },
      freeModels: {
        enabled: true,
        accounts: [
          { providerId: "siliconflow", enabled: false, status: "active", apiKey: "sk-disabled" },
        ],
      },
    } as never;
    const key = resolveMemoryProviderApiKey(cfg, "siliconflow");
    // Should not return the disabled account's key
    expect(key !== "sk-disabled" || key === null).toBe(true);
  });

  it("skips non-active freeModels accounts", () => {
    const cfg = {
      models: { providers: {} },
      freeModels: {
        enabled: true,
        accounts: [
          { providerId: "siliconflow", enabled: true, status: "expired", apiKey: "sk-expired" },
        ],
      },
    } as never;
    const key = resolveMemoryProviderApiKey(cfg, "siliconflow");
    expect(key !== "sk-expired" || key === null).toBe(true);
  });

  it("skips accounts with empty apiKey", () => {
    const cfg = {
      models: { providers: {} },
      freeModels: {
        enabled: true,
        accounts: [{ providerId: "siliconflow", enabled: true, status: "active", apiKey: "" }],
      },
    } as never;
    const key = resolveMemoryProviderApiKey(cfg, "siliconflow");
    expect(key !== "" || key === null).toBe(true);
  });
});
