/**
 * Tests for the provider-capability-mapping bridge layer.
 *
 * Verifies:
 *   - Capability key mapping (registry 10-key ↔ UI legacy 5-key)
 *   - cardToModelDef conversion
 *   - linkCapabilityRegistry / getModelsByCapability / getProviderCapabilities delegation
 *   - Provider ID alias resolution (glm→zhipu, volcengine-ark→doubao, etc.)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ModelCapabilityCard } from "../dispatch/capability-registry.js";
import {
  registryKeyToLegacy,
  legacyKeyToRegistry,
  cardToModelDef,
  linkCapabilityRegistry,
  getModelsByCapability,
  getProviderCapabilities,
  PROVIDER_CAPABILITY_MAPPINGS,
  type Capability,
} from "./provider-capability-mapping.js";

// ---------------------------------------------------------------------------
// registryKeyToLegacy
// ---------------------------------------------------------------------------

describe("registryKeyToLegacy", () => {
  it("maps text → text", () => {
    expect(registryKeyToLegacy("text")).toBe("text");
  });

  it("maps code → text (merged)", () => {
    expect(registryKeyToLegacy("code")).toBe("text");
  });

  it("maps vision → image-understanding", () => {
    expect(registryKeyToLegacy("vision")).toBe("image-understanding");
  });

  it("maps imageGen → image-generation", () => {
    expect(registryKeyToLegacy("imageGen")).toBe("image-generation");
  });

  it("maps video → video", () => {
    expect(registryKeyToLegacy("video")).toBe("video");
  });

  it("maps embedding → embedding", () => {
    expect(registryKeyToLegacy("embedding")).toBe("embedding");
  });

  it("maps videoGen → video-generation", () => {
    expect(registryKeyToLegacy("videoGen")).toBe("video-generation");
  });

  it("returns undefined for audio/tts/toolCall", () => {
    expect(registryKeyToLegacy("audio")).toBeUndefined();
    expect(registryKeyToLegacy("tts")).toBeUndefined();
    expect(registryKeyToLegacy("toolCall")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// legacyKeyToRegistry
// ---------------------------------------------------------------------------

describe("legacyKeyToRegistry", () => {
  it("text maps to [text, code]", () => {
    expect(legacyKeyToRegistry("text")).toEqual(["text", "code"]);
  });

  it("image-understanding maps to [vision]", () => {
    expect(legacyKeyToRegistry("image-understanding")).toEqual(["vision"]);
  });

  it("image-generation maps to [imageGen]", () => {
    expect(legacyKeyToRegistry("image-generation")).toEqual(["imageGen"]);
  });

  it("video maps to [video]", () => {
    expect(legacyKeyToRegistry("video")).toEqual(["video"]);
  });

  it("video-generation maps to [videoGen]", () => {
    expect(legacyKeyToRegistry("video-generation")).toEqual(["videoGen"]);
  });

  it("embedding maps to [embedding]", () => {
    expect(legacyKeyToRegistry("embedding")).toEqual(["embedding"]);
  });
});

// ---------------------------------------------------------------------------
// cardToModelDef
// ---------------------------------------------------------------------------

describe("cardToModelDef", () => {
  const multiCapCard: ModelCapabilityCard = {
    provider: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    capabilities: { text: 4, code: 4, vision: 5 },
    modelType: "chat",
    region: "international",
    costTier: "premium",
    costPer1M: 12.5,
    tags: ["pdf-native"],
    maxContextTokens: 128_000,
  };

  it("converts modelId and displayName", () => {
    const def = cardToModelDef(multiCapCard);
    expect(def.modelId).toBe("gpt-4o");
    expect(def.modelName).toBe("GPT-4o");
  });

  it("deduplicates legacy capabilities (text+code both → text)", () => {
    const def = cardToModelDef(multiCapCard);
    // text and code both map to "text" — should appear only once
    const textCount = def.capabilities.filter((c) => c === "text").length;
    expect(textCount).toBe(1);
    expect(def.capabilities).toContain("text");
    expect(def.capabilities).toContain("image-understanding"); // vision → image-understanding
  });

  it("maps pricing from costTier", () => {
    const def = cardToModelDef(multiCapCard);
    expect(def.pricing.type).toBe("paid");

    const freeCard: ModelCapabilityCard = {
      ...multiCapCard,
      costTier: "free",
      costPer1M: 0,
    };
    expect(cardToModelDef(freeCard).pricing.type).toBe("free");
  });

  it("maps maxContextTokens to contextWindow", () => {
    const def = cardToModelDef(multiCapCard);
    expect(def.contextWindow).toBe(128_000);
  });

  it("joins tags into pricing details", () => {
    const def = cardToModelDef(multiCapCard);
    expect(def.pricing.details).toBe("pdf-native");
  });

  it("omits unmapped capabilities (audio, tts, etc.)", () => {
    const audioCard: ModelCapabilityCard = {
      ...multiCapCard,
      capabilities: { audio: 5, tts: 4 },
    };
    const def = cardToModelDef(audioCard);
    expect(def.capabilities).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// linkCapabilityRegistry + getModelsByCapability delegation
// ---------------------------------------------------------------------------

describe("linkCapabilityRegistry", () => {
  const testCards: ModelCapabilityCard[] = [
    {
      provider: "zhipu",
      modelId: "glm-test-1",
      displayName: "GLM Test 1",
      capabilities: { text: 4, code: 3, vision: 3 },
      modelType: "chat",
      region: "domestic",
      costTier: "standard",
      costPer1M: 2.0,
    },
    {
      provider: "doubao",
      modelId: "doubao-test-1",
      displayName: "Doubao Test 1",
      capabilities: { text: 3, vision: 2 },
      modelType: "chat",
      region: "domestic",
      costTier: "standard",
      costPer1M: 0.5,
    },
    {
      provider: "qwen",
      modelId: "qwen-test-1",
      displayName: "Qwen Test 1",
      capabilities: { text: 4, embedding: 4 },
      modelType: "chat",
      region: "domestic",
      costTier: "standard",
      costPer1M: 5.0,
    },
  ];

  afterEach(() => {
    // Unlink registry after each test to avoid bleeding state
    linkCapabilityRegistry((() => []) as () => readonly ModelCapabilityCard[]);
  });

  it("delegates getModelsByCapability to registry when linked", () => {
    linkCapabilityRegistry(() => testCards);

    const textModels = getModelsByCapability("text");
    // Should find zhipu card via "glm" mapping alias
    const glmResult = textModels.find((m) => m.model.modelId === "glm-test-1");
    expect(glmResult).toBeDefined();
    // Provider ID in result should be the UI mapping key, not the registry key
    expect(glmResult!.providerId).toBe("glm");
    expect(glmResult!.providerName).toBe("智谱GLM");
  });

  it("resolves volcengine-ark → doubao alias", () => {
    linkCapabilityRegistry(() => testCards);

    const textModels = getModelsByCapability("text");
    const doubaoResult = textModels.find((m) => m.model.modelId === "doubao-test-1");
    expect(doubaoResult).toBeDefined();
    expect(doubaoResult!.providerId).toBe("volcengine-ark");
    expect(doubaoResult!.providerName).toBe("豆包");
  });

  it("resolves aliyun-bailian → qwen alias", () => {
    linkCapabilityRegistry(() => testCards);

    const embeddingModels = getModelsByCapability("embedding");
    const qwenResult = embeddingModels.find((m) => m.model.modelId === "qwen-test-1");
    expect(qwenResult).toBeDefined();
    expect(qwenResult!.providerId).toBe("aliyun-bailian");
  });

  it("falls back to static data when registry has no cards for a provider", () => {
    // Link an empty registry — all results come from static PROVIDER_CAPABILITY_MAPPINGS
    linkCapabilityRegistry(() => []);

    const textModels = getModelsByCapability("text");
    // Should still return static models (e.g., deepseek-chat from static mapping)
    const dsResult = textModels.find((m) => m.model.modelId === "deepseek-chat");
    expect(dsResult).toBeDefined();
  });

  it("falls back gracefully when not linked (null accessor)", () => {
    // Default state — _getAllCards is null, should use static data
    linkCapabilityRegistry((() => []) as () => readonly ModelCapabilityCard[]);

    const textModels = getModelsByCapability("text");
    expect(textModels.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getProviderCapabilities with alias resolution
// ---------------------------------------------------------------------------

describe("getProviderCapabilities with aliases", () => {
  const testCards: ModelCapabilityCard[] = [
    {
      provider: "zhipu",
      modelId: "glm-test",
      displayName: "GLM Test",
      capabilities: { text: 4, code: 3, vision: 3 },
      modelType: "chat",
      region: "domestic",
      costTier: "standard",
      costPer1M: 2.0,
    },
  ];

  afterEach(() => {
    linkCapabilityRegistry((() => []) as () => readonly ModelCapabilityCard[]);
  });

  it("resolves glm → zhipu for getProviderCapabilities", () => {
    linkCapabilityRegistry(() => testCards);

    const caps = getProviderCapabilities("glm");
    expect(caps).toContain("text");
    expect(caps).toContain("image-understanding"); // vision → image-understanding
  });

  it("returns static capabilities when not linked", () => {
    linkCapabilityRegistry((() => []) as () => readonly ModelCapabilityCard[]);

    // Should use static PROVIDER_CAPABILITY_MAPPINGS for deepseek
    const caps = getProviderCapabilities("deepseek");
    expect(caps).toContain("text");
  });
});

// ---------------------------------------------------------------------------
// PROVIDER_CAPABILITY_MAPPINGS consistency
// ---------------------------------------------------------------------------

describe("PROVIDER_CAPABILITY_MAPPINGS static data", () => {
  it("all providers have at least one model", () => {
    for (const [pid, mapping] of Object.entries(PROVIDER_CAPABILITY_MAPPINGS)) {
      if (pid === "openai-compatible") continue; // intentionally empty
      expect(mapping.models.length, `${pid} has no models`).toBeGreaterThan(0);
    }
  });

  it("all models have valid capabilities", () => {
    const validCaps: Capability[] = [
      "text",
      "image-understanding",
      "image-generation",
      "video",
      "video-generation",
      "embedding",
    ];
    for (const [pid, mapping] of Object.entries(PROVIDER_CAPABILITY_MAPPINGS)) {
      for (const model of mapping.models) {
        for (const cap of model.capabilities) {
          expect(validCaps, `${pid}/${model.modelId} has invalid capability "${cap}"`).toContain(
            cap,
          );
        }
      }
    }
  });
});
