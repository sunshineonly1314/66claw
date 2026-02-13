import { describe, expect, it, vi } from "vitest";
import { validateDispatchConfig } from "./config-loader.js";

describe("validateDispatchConfig", () => {
  it("validates a minimal config with defaults", () => {
    const config = validateDispatchConfig({
      version: 1,
      intents: [],
    });

    expect(config.version).toBe(1);
    expect(config.settings.enabled).toBe(true);
    expect(config.settings.ruleConfidenceThreshold).toBe(0.7);
    expect(config.settings.timeoutMs).toBe(3000);
    expect(config.settings.debug).toBe(false);
    expect(config.classifier.model).toBe("anthropic/claude-haiku-3");
    expect(config.intents).toEqual([]);
    expect(config.defaults.model).toBeNull();
  });

  it("validates a config with intents", () => {
    const config = validateDispatchConfig({
      version: 1,
      intents: [
        {
          id: "test_intent",
          description: "A test intent",
          patterns: {
            keywords: ["hello", "world"],
            regex: ["(?i)hello.*world"],
            semanticTags: ["greeting"],
          },
          routing: { model: "anthropic/claude-haiku-3" },
          skills: ["test-skill"],
          mcpTools: ["mcp_test_*"],
          systemHint: "This is a test hint",
        },
      ],
    });

    expect(config.intents.length).toBe(1);
    expect(config.intents[0].id).toBe("test_intent");
    expect(config.intents[0].patterns.keywords).toEqual(["hello", "world"]);
    expect(config.intents[0].patterns.regex).toEqual(["(?i)hello.*world"]);
    expect(config.intents[0].routing.model).toBe("anthropic/claude-haiku-3");
    expect(config.intents[0].skills).toEqual(["test-skill"]);
    expect(config.intents[0].mcpTools).toEqual(["mcp_test_*"]);
    expect(config.intents[0].systemHint).toBe("This is a test hint");
  });

  it("fills in missing optional fields with defaults", () => {
    const config = validateDispatchConfig({
      intents: [{ id: "minimal" }],
    });

    expect(config.version).toBe(1);
    expect(config.intents[0].patterns.keywords).toEqual([]);
    expect(config.intents[0].patterns.regex).toEqual([]);
    expect(config.intents[0].routing.model).toBeNull();
    expect(config.intents[0].skills).toEqual([]);
    expect(config.intents[0].mcpTools).toEqual([]);
  });

  it("overrides specific settings while keeping others as default", () => {
    const config = validateDispatchConfig({
      settings: {
        debug: true,
        ruleConfidenceThreshold: 0.5,
      },
      intents: [],
    });

    expect(config.settings.debug).toBe(true);
    expect(config.settings.ruleConfidenceThreshold).toBe(0.5);
    expect(config.settings.enabled).toBe(true); // default
    expect(config.settings.timeoutMs).toBe(3000); // default
  });

  it("throws on null config", () => {
    expect(() => validateDispatchConfig(null)).toThrow("non-null object");
  });

  it("throws on non-object config", () => {
    expect(() => validateDispatchConfig("string")).toThrow("non-null object");
  });

  it("throws on intent without id", () => {
    expect(() =>
      validateDispatchConfig({
        intents: [{ description: "no id" }],
      }),
    ).toThrow("intents[0].id is required");
  });

  it("handles model routing with null (default model)", () => {
    const config = validateDispatchConfig({
      intents: [
        {
          id: "test",
          routing: { model: null },
        },
      ],
    });

    expect(config.intents[0].routing.model).toBeNull();
  });

  it("handles fallback model", () => {
    const config = validateDispatchConfig({
      intents: [
        {
          id: "test",
          routing: {
            model: "seeddance/seeddance-2.0",
            fallbackModel: "openai/dall-e-3",
          },
        },
      ],
    });

    expect(config.intents[0].routing.model).toBe("seeddance/seeddance-2.0");
    expect(config.intents[0].routing.fallbackModel).toBe("openai/dall-e-3");
  });

  it("validates classifier config", () => {
    const config = validateDispatchConfig({
      classifier: {
        model: "custom/model",
        maxTokens: 200,
      },
      intents: [],
    });

    expect(config.classifier.model).toBe("custom/model");
    expect(config.classifier.maxTokens).toBe(200);
    // systemPrompt should have default
    expect(config.classifier.systemPrompt).toContain("intent classifier");
  });

  it("parses mediaTypes in patterns", () => {
    const config = validateDispatchConfig({
      intents: [
        {
          id: "image_gen",
          patterns: {
            keywords: ["画"],
            mediaTypes: ["image", "video"],
          },
          routing: { model: null },
        },
      ],
    });

    expect(config.intents[0].patterns.mediaTypes).toEqual(["image", "video"]);
  });

  it("defaults mediaTypes to undefined when not provided", () => {
    const config = validateDispatchConfig({
      intents: [
        {
          id: "test",
          patterns: { keywords: ["test"] },
        },
      ],
    });

    expect(config.intents[0].patterns.mediaTypes).toBeUndefined();
  });
});
