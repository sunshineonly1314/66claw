import { describe, expect, it } from "vitest";
import { isThinkingSupported, resolveEffectiveThinkLevel } from "./utils.js";

describe("isThinkingSupported", () => {
  // ── Ollama ──────────────────────────────────────────────────────────────
  it("returns false for ollama API", () => {
    expect(isThinkingSupported("ollama", "ollama")).toBe(false);
  });

  it("returns false for ollama provider even with empty api", () => {
    expect(isThinkingSupported("ollama", "")).toBe(false);
  });

  it("returns false for ollama provider with openai-completions api", () => {
    // edge case: provider is ollama but api might be overridden
    expect(isThinkingSupported("ollama", "openai-completions")).toBe(false);
  });

  it("is case-insensitive for provider name", () => {
    expect(isThinkingSupported("Ollama", "")).toBe(false);
    expect(isThinkingSupported("OLLAMA", "")).toBe(false);
    expect(isThinkingSupported("OlLaMa", "")).toBe(false);
  });

  // ── Other local providers ───────────────────────────────────────────────
  it("returns false for vllm provider", () => {
    expect(isThinkingSupported("vllm", "openai-completions")).toBe(false);
  });

  it("returns false for lmstudio provider", () => {
    expect(isThinkingSupported("lmstudio", "openai-completions")).toBe(false);
  });

  it("returns false for llamacpp provider", () => {
    expect(isThinkingSupported("llamacpp", "")).toBe(false);
  });

  it("returns false for localai provider", () => {
    expect(isThinkingSupported("localai", "openai-completions")).toBe(false);
  });

  // ── Cloud providers should support thinking ─────────────────────────────
  it("returns true for anthropic provider", () => {
    expect(isThinkingSupported("anthropic", "anthropic")).toBe(true);
  });

  it("returns true for openai provider", () => {
    expect(isThinkingSupported("openai", "openai-completions")).toBe(true);
  });

  it("returns true for moonshot (kimi)", () => {
    expect(isThinkingSupported("moonshot", "openai-completions")).toBe(true);
  });

  it("returns true for kimi-coding", () => {
    expect(isThinkingSupported("kimi-coding", "openai-completions")).toBe(true);
  });

  it("returns true for qwen-portal", () => {
    expect(isThinkingSupported("qwen-portal", "openai-completions")).toBe(true);
  });

  it("returns true for aliyun-bailian (qwen)", () => {
    expect(isThinkingSupported("aliyun-bailian", "openai-completions")).toBe(true);
  });

  it("returns true for zhipu (glm)", () => {
    expect(isThinkingSupported("zhipu", "openai-completions")).toBe(true);
  });

  it("returns true for deepseek", () => {
    expect(isThinkingSupported("deepseek", "openai-completions")).toBe(true);
  });

  it("returns true for siliconflow", () => {
    expect(isThinkingSupported("siliconflow", "openai-completions")).toBe(true);
  });

  it("returns true for volcengine-ark (doubao)", () => {
    expect(isThinkingSupported("volcengine-ark", "openai-completions")).toBe(true);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────
  it("returns true for unknown provider with openai-completions api", () => {
    expect(isThinkingSupported("custom-provider", "openai-completions")).toBe(true);
  });

  it("returns true for empty provider and empty api", () => {
    expect(isThinkingSupported("", "")).toBe(true);
  });
});

describe("resolveEffectiveThinkLevel", () => {
  // ── Passthrough when thinking is supported ──────────────────────────────
  it("passes through requested level for anthropic", () => {
    expect(
      resolveEffectiveThinkLevel({
        requested: "high",
        provider: "anthropic",
        modelApi: "anthropic",
      }),
    ).toBe("high");
  });

  it("passes through requested level for openai", () => {
    expect(
      resolveEffectiveThinkLevel({
        requested: "medium",
        provider: "openai",
        modelApi: "openai-completions",
      }),
    ).toBe("medium");
  });

  it('passes through "off" even for unsupported providers', () => {
    expect(
      resolveEffectiveThinkLevel({ requested: "off", provider: "ollama", modelApi: "ollama" }),
    ).toBe("off");
  });

  // ── Downgrade for local providers ───────────────────────────────────────
  it('downgrades "high" to "off" for ollama', () => {
    expect(
      resolveEffectiveThinkLevel({ requested: "high", provider: "ollama", modelApi: "ollama" }),
    ).toBe("off");
  });

  it('downgrades "medium" to "off" for vllm', () => {
    expect(
      resolveEffectiveThinkLevel({
        requested: "medium",
        provider: "vllm",
        modelApi: "openai-completions",
      }),
    ).toBe("off");
  });

  it('downgrades "minimal" to "off" for lmstudio', () => {
    expect(
      resolveEffectiveThinkLevel({
        requested: "minimal",
        provider: "lmstudio",
        modelApi: "openai-completions",
      }),
    ).toBe("off");
  });

  it('downgrades "low" to "off" for localai', () => {
    expect(
      resolveEffectiveThinkLevel({
        requested: "low",
        provider: "localai",
        modelApi: "openai-completions",
      }),
    ).toBe("off");
  });

  it('downgrades "xhigh" to "off" for llamacpp', () => {
    expect(
      resolveEffectiveThinkLevel({ requested: "xhigh", provider: "llamacpp", modelApi: "" }),
    ).toBe("off");
  });

  // ── API-based detection ─────────────────────────────────────────────────
  it("downgrades when api is ollama even for unknown provider name", () => {
    expect(
      resolveEffectiveThinkLevel({
        requested: "high",
        provider: "my-custom-ollama",
        modelApi: "ollama",
      }),
    ).toBe("off");
  });

  // ── Does NOT downgrade cloud providers ──────────────────────────────────
  it("does not downgrade moonshot/kimi", () => {
    expect(
      resolveEffectiveThinkLevel({
        requested: "high",
        provider: "moonshot",
        modelApi: "openai-completions",
      }),
    ).toBe("high");
  });

  it("does not downgrade qwen-portal", () => {
    expect(
      resolveEffectiveThinkLevel({
        requested: "high",
        provider: "qwen-portal",
        modelApi: "openai-completions",
      }),
    ).toBe("high");
  });
});
