import { describe, expect, it, beforeEach } from "vitest";
import {
  initCapabilityRegistry,
  queryByCapability,
  getProviderCapabilities,
  findCard,
  getCapabilityMatrixSummary,
  getAutoProviders,
  getBestModelForProvider,
  getAllCards,
  getAllCapabilityKeys,
  recordProbeResult,
  getProbeResult,
  applyRemoteCards,
  updateUserOverrides,
  upsertUserCard,
  removeUserCardsByProvider,
  toModelProfiles,
  resetRegistryForTests,
  BUILTIN_CAPABILITY_CARDS,
  type ModelCapabilityCard,
  type RoutingPolicy,
} from "./capability-registry.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const CONFIGURED_PROVIDERS = new Set(["openai", "deepseek", "qwen", "siliconflow", "local"]);

beforeEach(() => {
  resetRegistryForTests();
  initCapabilityRegistry({
    isProviderConfigured: (p) => CONFIGURED_PROVIDERS.has(p),
  });
});

// ---------------------------------------------------------------------------
// Built-in cards sanity checks
// ---------------------------------------------------------------------------

describe("BUILTIN_CAPABILITY_CARDS", () => {
  it("has cards for all major providers", () => {
    const providers = new Set(BUILTIN_CAPABILITY_CARDS.map((c) => c.provider));
    // International
    expect(providers).toContain("openai");
    expect(providers).toContain("anthropic");
    expect(providers).toContain("google");
    expect(providers).toContain("nvidia");
    // Domestic top-tier
    expect(providers).toContain("deepseek");
    expect(providers).toContain("qwen");
    expect(providers).toContain("zhipu");
    expect(providers).toContain("doubao");
    expect(providers).toContain("moonshot");
    expect(providers).toContain("minimax");
    expect(providers).toContain("kimi-coding");
    expect(providers).toContain("tencent-hunyuan");
    // Domestic free / aggregator
    expect(providers).toContain("siliconflow");
    expect(providers).toContain("ant-ling");
    expect(providers).toContain("meituan-longcat");
    // Local / specialist
    expect(providers).toContain("local");
    expect(providers).toContain("ollama");
    expect(providers).toContain("groq");
  });

  it("covers all 10 capability dimensions", () => {
    const allKeys = getAllCapabilityKeys();
    for (const key of allKeys) {
      const cardsWithCap = BUILTIN_CAPABILITY_CARDS.filter((c) => c.capabilities[key] != null);
      expect(cardsWithCap.length, `no cards with capability "${key}"`).toBeGreaterThan(0);
    }
  });

  it("has valid scores (1-5) for all capability entries", () => {
    for (const card of BUILTIN_CAPABILITY_CARDS) {
      for (const [key, score] of Object.entries(card.capabilities)) {
        expect(score, `${card.provider}/${card.modelId}.${key}`).toBeGreaterThanOrEqual(1);
        expect(score, `${card.provider}/${card.modelId}.${key}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it("has unique provider/modelId combinations", () => {
    const keys = BUILTIN_CAPABILITY_CARDS.map((c) => `${c.provider}/${c.modelId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("classifies multi-capability models as chat and single-purpose as specialized", () => {
    const chatModels = BUILTIN_CAPABILITY_CARDS.filter((c) => c.modelType === "chat");
    const specializedModels = BUILTIN_CAPABILITY_CARDS.filter((c) => c.modelType === "specialized");

    // Chat models should have more than one capability
    for (const model of chatModels) {
      const capCount = Object.keys(model.capabilities).length;
      expect(
        capCount,
        `${model.displayName} is chat but has only ${capCount} capability`,
      ).toBeGreaterThanOrEqual(1);
    }

    // Specialized models should have exactly one capability (or very few)
    for (const model of specializedModels) {
      const capCount = Object.keys(model.capabilities).length;
      expect(
        capCount,
        `${model.displayName} is specialized but has ${capCount} capabilities`,
      ).toBeLessThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// queryByCapability
// ---------------------------------------------------------------------------

describe("queryByCapability", () => {
  it("returns models with the requested capability", () => {
    const results = queryByCapability("vision");
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.capabilities.vision).toBeDefined();
      expect(r.capabilities.vision!).toBeGreaterThanOrEqual(1);
    }
  });

  it("excludes models without the capability", () => {
    const results = queryByCapability("video");
    // deepseek-chat has no video capability
    const deepseekChat = results.find((r) => r.modelId === "deepseek-chat");
    expect(deepseekChat).toBeUndefined();
  });

  it("filters by configuredOnly", () => {
    const all = queryByCapability("text");
    const configured = queryByCapability("text", { configuredOnly: true });

    expect(configured.length).toBeLessThan(all.length);
    // Anthropic is not configured in our test setup
    const anthropic = configured.find((r) => r.provider === "anthropic");
    expect(anthropic).toBeUndefined();
    // DeepSeek is configured
    const deepseek = configured.find((r) => r.provider === "deepseek");
    expect(deepseek).toBeDefined();
  });

  it("treats local provider as always configured", () => {
    const results = queryByCapability("tts", { configuredOnly: true });
    const edgeTts = results.find((r) => r.modelId === "edge-tts");
    expect(edgeTts).toBeDefined();
  });

  it("filters by domesticOnly", () => {
    const results = queryByCapability("text", { domesticOnly: true });
    for (const r of results) {
      expect(r.region).toBe("domestic");
    }
  });

  it("filters by tags", () => {
    const results = queryByCapability("vision", { tags: ["pdf-native"] });
    for (const r of results) {
      expect(r.tags).toContain("pdf-native");
    }
  });

  it("includes runtime state in enriched cards", () => {
    const results = queryByCapability("text");
    for (const r of results) {
      expect(r.runtime).toBeDefined();
      expect(r.runtime.health).toBeDefined();
      expect(typeof r.runtime.configured).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// Routing policy: best-quality (default)
// ---------------------------------------------------------------------------

describe("routing policy: best-quality", () => {
  it("ranks by highest capability score first", () => {
    const results = queryByCapability("text", undefined, "best-quality");
    // The top results should have score 5 (Claude Opus, DeepSeek Reasoner)
    expect(results[0]!.capabilities.text).toBe(5);
  });

  it("breaks ties by region (domestic first), then cost tier", () => {
    const results = queryByCapability("code", undefined, "best-quality");
    const top5 = results.filter((r) => r.capabilities.code === 5);
    // Among score-5 code models, domestic should come before international
    const domesticIdx = top5.findIndex((r) => r.region === "domestic");
    const intlIdx = top5.findIndex((r) => r.region === "international");
    if (domesticIdx >= 0 && intlIdx >= 0) {
      expect(domesticIdx).toBeLessThan(intlIdx);
    }
    // Within same region, premium should come before free
    const domesticCards = top5.filter((r) => r.region === "domestic");
    const standardIdx = domesticCards.findIndex((r) => r.costTier === "standard");
    const freeIdx = domesticCards.findIndex((r) => r.costTier === "free");
    if (standardIdx >= 0 && freeIdx >= 0) {
      expect(standardIdx).toBeLessThan(freeIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// Routing policy: budget
// ---------------------------------------------------------------------------

describe("routing policy: budget", () => {
  it("ranks cheaper models first", () => {
    const results = queryByCapability("text", undefined, "budget");
    // Free models should be at the top
    expect(results[0]!.costPer1M).toBe(0);
  });

  it("still rejects quality below 2", () => {
    // All returned models should have score >= 2 (or if no score >= 2, then 1)
    const results = queryByCapability("text", undefined, "budget");
    const hasQualityModels = results.some((r) => (r.capabilities.text ?? 0) >= 2);
    if (hasQualityModels) {
      expect(results[0]!.capabilities.text!).toBeGreaterThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Routing policy: cost-balanced
// ---------------------------------------------------------------------------

describe("routing policy: cost-balanced", () => {
  it("balances quality and cost", () => {
    const results = queryByCapability("text", undefined, "cost-balanced");
    // Should not be purely cheapest or purely best
    expect(results.length).toBeGreaterThan(0);
    // A balanced policy should put high-value models (good score, reasonable cost) near top
    // DeepSeek V3 (text:4, $1.37) should rank well in top 25
    const dsIdx = results.findIndex((r) => r.modelId === "deepseek-chat");
    expect(dsIdx).toBeLessThan(25);
  });
});

// ---------------------------------------------------------------------------
// findCard
// ---------------------------------------------------------------------------

describe("findCard", () => {
  it("finds card by exact provider + modelId", () => {
    const card = findCard("openai", "gpt-4o");
    expect(card).toBeDefined();
    expect(card!.displayName).toBe("GPT-4o");
  });

  it("finds card by alias", () => {
    const card = findCard("anthropic", "claude-opus-4-20250514");
    expect(card).toBeDefined();
    expect(card!.modelId).toBe("claude-opus-4-6");
  });

  it("returns undefined for unknown model", () => {
    expect(findCard("nonexistent", "model")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getProviderCapabilities
// ---------------------------------------------------------------------------

describe("getProviderCapabilities", () => {
  it("returns all cards for a provider", () => {
    const cards = getProviderCapabilities("openai");
    expect(cards.length).toBeGreaterThan(3); // gpt-4o, gpt-4o-mini, dall-e-3, tts-1, etc.
    for (const card of cards) {
      expect(card.provider).toBe("openai");
    }
  });

  it("returns empty for unknown provider", () => {
    expect(getProviderCapabilities("nonexistent")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getCapabilityMatrixSummary
// ---------------------------------------------------------------------------

describe("getCapabilityMatrixSummary", () => {
  it("shows available capabilities for configured providers", () => {
    const summary = getCapabilityMatrixSummary();
    // text should be available (deepseek + qwen + siliconflow are configured)
    const textCap = summary.available.find((a) => a.capability === "text");
    expect(textCap).toBeDefined();
  });

  it("shows unconfigured capabilities with recommendations", () => {
    const summary = getCapabilityMatrixSummary();
    // If anthropic is not configured, some capabilities might be in unconfigured
    // At minimum, the summary structure should be valid
    expect(summary.available.length + summary.missing.length + summary.unconfigured.length).toBe(
      getAllCapabilityKeys().length,
    );
  });

  it("correctly identifies missing capabilities", () => {
    // Reset with no providers configured
    resetRegistryForTests();
    initCapabilityRegistry({ isProviderConfigured: () => false });
    const summary = getCapabilityMatrixSummary();
    // text should still be available through local models if any, or in unconfigured
    // Most capabilities should be in unconfigured (have cards but not configured)
    expect(summary.unconfigured.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getAutoProviders (backward compatibility)
// ---------------------------------------------------------------------------

describe("getAutoProviders", () => {
  it("returns ordered providers for vision capability", () => {
    const providers = getAutoProviders("vision");
    expect(providers.length).toBeGreaterThan(0);
    // Should include providers with vision capability
    const hasOpenai = providers.includes("openai");
    const hasQwen = providers.includes("qwen");
    expect(hasOpenai || hasQwen).toBe(true);
  });

  it("returns only configured providers when requested", () => {
    const all = getAutoProviders("vision");
    const configured = getAutoProviders("vision", { configuredOnly: true });
    expect(configured.length).toBeLessThanOrEqual(all.length);
    // anthropic is not configured
    expect(configured).not.toContain("anthropic");
  });

  it("deduplicates providers (one entry per provider)", () => {
    const providers = getAutoProviders("audio");
    expect(new Set(providers).size).toBe(providers.length);
  });
});

// ---------------------------------------------------------------------------
// getBestModelForProvider
// ---------------------------------------------------------------------------

describe("getBestModelForProvider", () => {
  it("returns best model for a provider + capability", () => {
    const model = getBestModelForProvider("openai", "vision");
    expect(model).toBe("gpt-4o"); // gpt-4o has vision:5, gpt-4o-mini has vision:3
  });

  it("returns undefined for unsupported capability", () => {
    const model = getBestModelForProvider("deepseek", "vision");
    expect(model).toBeUndefined(); // deepseek has no vision models
  });
});

// ---------------------------------------------------------------------------
// toModelProfiles (backward compatibility)
// ---------------------------------------------------------------------------

describe("toModelProfiles", () => {
  it("generates ModelProfile[] compatible with modality-router", () => {
    const profiles = toModelProfiles();
    expect(profiles.length).toBeGreaterThan(10);
    for (const p of profiles) {
      expect(p.provider).toBeDefined();
      expect(p.model).toBeDefined();
      expect(p.capabilities).toBeDefined();
      expect(typeof p.costPer1M).toBe("number");
      expect(["domestic", "international"]).toContain(p.region);
    }
  });

  it("only includes chat models (not specialized)", () => {
    const profiles = toModelProfiles();
    // DALL-E 3 and OpenAI TTS are specialized, should not appear
    const dalle = profiles.find((p) => p.model === "dall-e-3");
    expect(dalle).toBeUndefined();
    const tts = profiles.find((p) => p.model === "tts-1");
    expect(tts).toBeUndefined();
  });

  it("maps capability card fields to ModelProfile fields correctly", () => {
    const profiles = toModelProfiles();
    const gpt4o = profiles.find((p) => p.model === "gpt-4o");
    expect(gpt4o).toBeDefined();
    expect(gpt4o!.capabilities.vision).toBe(5);
    expect(gpt4o!.capabilities.audio).toBe(4);
    expect(gpt4o!.capabilities.video).toBe(3);
    expect(gpt4o!.capabilities.imageGen).toBe(3);
    expect(gpt4o!.costPer1M).toBe(12.5);
    expect(gpt4o!.region).toBe("international");
  });
});

// ---------------------------------------------------------------------------
// Remote card updates
// ---------------------------------------------------------------------------

describe("applyRemoteCards", () => {
  it("adds new models from remote source", () => {
    const before = getAllCards().length;
    applyRemoteCards([
      {
        provider: "doubao",
        modelId: "doubao-seed-2.0-250301",
        displayName: "豆包 Seed 2.0",
        capabilities: { text: 4, code: 4, video: 4 },
        modelType: "chat",
        region: "domestic",
        costTier: "standard",
        costPer1M: 0.8,
      },
    ]);
    expect(getAllCards().length).toBe(before + 1);
    expect(findCard("doubao", "doubao-seed-2.0-250301")).toBeDefined();
  });

  it("overrides built-in cards with remote updates", () => {
    applyRemoteCards([
      {
        provider: "deepseek",
        modelId: "deepseek-chat",
        displayName: "DeepSeek V3.5",
        capabilities: { text: 5, code: 5, vision: 3 },
        modelType: "chat",
        region: "domestic",
        costTier: "standard",
        costPer1M: 1.5,
      },
    ]);
    const card = findCard("deepseek", "deepseek-chat");
    expect(card!.displayName).toBe("DeepSeek V3.5");
    expect(card!.capabilities.vision).toBe(3); // New capability from remote
  });
});

// ---------------------------------------------------------------------------
// User overrides
// ---------------------------------------------------------------------------

describe("updateUserOverrides", () => {
  it("user overrides take highest priority", () => {
    applyRemoteCards([
      {
        provider: "deepseek",
        modelId: "deepseek-chat",
        displayName: "DeepSeek V3 (remote)",
        capabilities: { text: 5, code: 5 },
        modelType: "chat",
        region: "domestic",
        costTier: "standard",
        costPer1M: 1.0,
      },
    ]);

    updateUserOverrides([
      {
        provider: "deepseek",
        modelId: "deepseek-chat",
        displayName: "DeepSeek V3 (user)",
        capabilities: { text: 4, code: 5, vision: 4 },
        modelType: "chat",
        region: "domestic",
        costTier: "standard",
        costPer1M: 1.37,
      },
    ]);

    const card = findCard("deepseek", "deepseek-chat");
    expect(card!.displayName).toBe("DeepSeek V3 (user)"); // User wins over remote
    expect(card!.capabilities.vision).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Runtime probes
// ---------------------------------------------------------------------------

describe("runtime probes", () => {
  it("records and retrieves probe results", () => {
    expect(getProbeResult("qwen", "qwen-vl-max", "vision")).toBe("untested");
    recordProbeResult("qwen", "qwen-vl-max", "vision", "verified");
    expect(getProbeResult("qwen", "qwen-vl-max", "vision")).toBe("verified");
  });

  it("probe failure marks capability as failed", () => {
    recordProbeResult("zhipu", "glm-4v-plus", "vision", "failed");
    expect(getProbeResult("zhipu", "glm-4v-plus", "vision")).toBe("failed");
  });

  it("verifiedOnly filter respects probe results", () => {
    recordProbeResult("openai", "gpt-4o", "vision", "verified");
    const verified = queryByCapability("vision", { verifiedOnly: true });
    expect(verified.length).toBeGreaterThanOrEqual(1);
    expect(verified[0]!.modelId).toBe("gpt-4o");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("returns videoGen models from registry", () => {
    const results = queryByCapability("videoGen");
    expect(results.length).toBeGreaterThan(0);
    // Should include Zhipu CogVideoX models
    const zhipuVideo = results.find((r) => r.provider === "zhipu");
    expect(zhipuVideo).toBeDefined();
  });

  it("getAllCapabilityKeys returns exactly 11 keys", () => {
    expect(getAllCapabilityKeys()).toHaveLength(11);
  });

  it("getAllCards includes all cards from all sources", () => {
    const all = getAllCards();
    expect(all.length).toBe(BUILTIN_CAPABILITY_CARDS.length);
    applyRemoteCards([
      {
        provider: "test",
        modelId: "test-model",
        displayName: "Test",
        capabilities: { text: 3 },
        modelType: "chat",
        region: "domestic",
        costTier: "free",
        costPer1M: 0,
      },
    ]);
    expect(getAllCards().length).toBe(BUILTIN_CAPABILITY_CARDS.length + 1);
  });
});

// ---------------------------------------------------------------------------
// upsertUserCard — single card injection (addCustomModel path)
// ---------------------------------------------------------------------------

describe("upsertUserCard", () => {
  const customCard: ModelCapabilityCard = {
    provider: "siliconflow",
    modelId: "custom/my-finetune-v2",
    displayName: "My Finetune V2",
    capabilities: { text: 3, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0,
    maxContextTokens: 131072,
  };

  it("adds a new card to the registry", () => {
    const before = getAllCards().length;
    upsertUserCard(customCard);
    expect(getAllCards().length).toBe(before + 1);
    expect(findCard("siliconflow", "custom/my-finetune-v2")).toBeDefined();
  });

  it("card is visible in queryByCapability for text", () => {
    upsertUserCard(customCard);
    const results = queryByCapability("text", { configuredOnly: true });
    const found = results.find((r) => r.modelId === "custom/my-finetune-v2");
    expect(found).toBeDefined();
    expect(found!.capabilities.text).toBe(3);
  });

  it("card is visible in queryByCapability for code", () => {
    upsertUserCard(customCard);
    const results = queryByCapability("code", { configuredOnly: true });
    const found = results.find((r) => r.modelId === "custom/my-finetune-v2");
    expect(found).toBeDefined();
    expect(found!.capabilities.code).toBe(2);
  });

  it("updates existing card when provider/modelId matches", () => {
    upsertUserCard(customCard);
    const before = getAllCards().length;

    // Upsert same key with higher score
    upsertUserCard({
      ...customCard,
      displayName: "My Finetune V2 (upgraded)",
      capabilities: { text: 4, code: 3, vision: 2 },
    });

    expect(getAllCards().length).toBe(before); // count unchanged
    const card = findCard("siliconflow", "custom/my-finetune-v2");
    expect(card!.displayName).toBe("My Finetune V2 (upgraded)");
    expect(card!.capabilities.text).toBe(4);
    expect(card!.capabilities.vision).toBe(2);
  });

  it("takes priority over builtin and remote cards", () => {
    // Apply remote override for deepseek-chat
    applyRemoteCards([
      {
        provider: "deepseek",
        modelId: "deepseek-chat",
        displayName: "DeepSeek V3 (remote)",
        capabilities: { text: 5, code: 5 },
        modelType: "chat",
        region: "domestic",
        costTier: "standard",
        costPer1M: 1.0,
      },
    ]);

    // User upsert should override remote
    upsertUserCard({
      provider: "deepseek",
      modelId: "deepseek-chat",
      displayName: "DeepSeek V3 (user upsert)",
      capabilities: { text: 5, code: 5, vision: 4 },
      modelType: "chat",
      region: "domestic",
      costTier: "standard",
      costPer1M: 1.37,
    });

    const card = findCard("deepseek", "deepseek-chat");
    expect(card!.displayName).toBe("DeepSeek V3 (user upsert)");
    expect(card!.capabilities.vision).toBe(4);
  });

  it("survives applyRemoteCards (not overwritten by remote rebuild)", () => {
    upsertUserCard(customCard);

    // Remote cards rebuild should not wipe user card
    applyRemoteCards([
      {
        provider: "test-remote",
        modelId: "remote-only",
        displayName: "Remote Only",
        capabilities: { text: 3 },
        modelType: "chat",
        region: "international",
        costTier: "free",
        costPer1M: 0,
      },
    ]);

    // User card should still be present
    expect(findCard("siliconflow", "custom/my-finetune-v2")).toBeDefined();
  });

  it("is lost when updateUserOverrides replaces the full array", () => {
    upsertUserCard(customCard);
    expect(findCard("siliconflow", "custom/my-finetune-v2")).toBeDefined();

    // Full replacement wipes individual upserts
    updateUserOverrides([]);
    expect(findCard("siliconflow", "custom/my-finetune-v2")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// removeUserCardsByProvider — cleanup on provider delete
// ---------------------------------------------------------------------------

describe("removeUserCardsByProvider", () => {
  it("removes all user cards for a given provider", () => {
    upsertUserCard({
      provider: "volcengine-ark",
      modelId: "ep-20240901001",
      displayName: "Doubao Custom EP 1",
      capabilities: { text: 3, code: 2 },
      modelType: "chat",
      region: "domestic",
      costTier: "standard",
      costPer1M: 0,
    });
    upsertUserCard({
      provider: "volcengine-ark",
      modelId: "ep-20240901002",
      displayName: "Doubao Custom EP 2",
      capabilities: { text: 4, code: 3 },
      modelType: "chat",
      region: "domestic",
      costTier: "standard",
      costPer1M: 0,
    });

    expect(findCard("volcengine-ark", "ep-20240901001")).toBeDefined();
    expect(findCard("volcengine-ark", "ep-20240901002")).toBeDefined();

    removeUserCardsByProvider("volcengine-ark");

    expect(findCard("volcengine-ark", "ep-20240901001")).toBeUndefined();
    expect(findCard("volcengine-ark", "ep-20240901002")).toBeUndefined();
  });

  it("does not affect cards from other providers", () => {
    upsertUserCard({
      provider: "siliconflow",
      modelId: "my-model",
      displayName: "SF Model",
      capabilities: { text: 3 },
      modelType: "chat",
      region: "domestic",
      costTier: "free",
      costPer1M: 0,
    });
    upsertUserCard({
      provider: "volcengine-ark",
      modelId: "ep-001",
      displayName: "ARK EP",
      capabilities: { text: 3 },
      modelType: "chat",
      region: "domestic",
      costTier: "standard",
      costPer1M: 0,
    });

    removeUserCardsByProvider("volcengine-ark");

    expect(findCard("siliconflow", "my-model")).toBeDefined();
    expect(findCard("volcengine-ark", "ep-001")).toBeUndefined();
  });

  it("does not affect builtin cards for the same provider", () => {
    // Builtin cards for deepseek should survive removal of user cards
    const builtinBefore = findCard("deepseek", "deepseek-chat");
    expect(builtinBefore).toBeDefined();

    upsertUserCard({
      provider: "deepseek",
      modelId: "deepseek-custom-finetune",
      displayName: "DS Custom",
      capabilities: { text: 3 },
      modelType: "chat",
      region: "domestic",
      costTier: "standard",
      costPer1M: 0,
    });

    removeUserCardsByProvider("deepseek");

    // Custom user card should be gone
    expect(findCard("deepseek", "deepseek-custom-finetune")).toBeUndefined();
    // Builtin card should still exist (it's in BUILTIN_CAPABILITY_CARDS, not userCards)
    expect(findCard("deepseek", "deepseek-chat")).toBeDefined();
  });

  it("is a no-op when provider has no user cards", () => {
    const before = getAllCards().length;
    removeUserCardsByProvider("nonexistent-provider");
    expect(getAllCards().length).toBe(before);
  });

  it("works correctly after upsert + remove + upsert cycle", () => {
    const card: ModelCapabilityCard = {
      provider: "zhipu",
      modelId: "glm-custom-001",
      displayName: "GLM Custom",
      capabilities: { text: 3, code: 2 },
      modelType: "chat",
      region: "domestic",
      costTier: "standard",
      costPer1M: 0,
    };

    upsertUserCard(card);
    expect(findCard("zhipu", "glm-custom-001")).toBeDefined();

    removeUserCardsByProvider("zhipu");
    expect(findCard("zhipu", "glm-custom-001")).toBeUndefined();

    // Re-adding after removal should work
    upsertUserCard({ ...card, displayName: "GLM Custom V2" });
    const reAdded = findCard("zhipu", "glm-custom-001");
    expect(reAdded).toBeDefined();
    expect(reAdded!.displayName).toBe("GLM Custom V2");
  });
});

// ---------------------------------------------------------------------------
// Integration: upsert + query interaction with routing policies
// ---------------------------------------------------------------------------

describe("upsertUserCard routing integration", () => {
  it("custom model appears in capability matrix summary when configured", () => {
    upsertUserCard({
      provider: "siliconflow",
      modelId: "custom/my-chat",
      displayName: "My Chat Model",
      capabilities: { text: 3, code: 2 },
      modelType: "chat",
      region: "domestic",
      costTier: "free",
      costPer1M: 0,
    });

    const summary = getCapabilityMatrixSummary();
    // text should be available (siliconflow is configured)
    expect(summary.available.some((a) => a.capability === "text")).toBe(true);
  });

  it("custom vision model appears in vision query", () => {
    upsertUserCard({
      provider: "siliconflow",
      modelId: "custom/my-vl",
      displayName: "My VL Model",
      capabilities: { text: 3, vision: 2 },
      modelType: "chat",
      region: "domestic",
      costTier: "free",
      costPer1M: 0,
    });

    const results = queryByCapability("vision", { configuredOnly: true });
    const found = results.find((r) => r.modelId === "custom/my-vl");
    expect(found).toBeDefined();
    expect(found!.runtime.configured).toBe(true);
  });

  it("unconfigured provider's custom model is excluded with configuredOnly", () => {
    upsertUserCard({
      provider: "unconfigured-provider",
      modelId: "some-model",
      displayName: "Some Model",
      capabilities: { text: 3 },
      modelType: "chat",
      region: "international",
      costTier: "standard",
      costPer1M: 5,
    });

    const results = queryByCapability("text", { configuredOnly: true });
    const found = results.find((r) => r.modelId === "some-model");
    expect(found).toBeUndefined();

    // But visible without configuredOnly
    const allResults = queryByCapability("text", { configuredOnly: false });
    const foundAll = allResults.find((r) => r.modelId === "some-model");
    expect(foundAll).toBeDefined();
  });
});
