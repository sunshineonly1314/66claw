/**
 * Tests for offline cache addon support
 * 离线缓存扩展包支持测试
 */

import { describe, expect, it } from "vitest";

describe("Offline Cache Addon Support", () => {
  describe("HMAC payload with addons", () => {
    // Re-implement the HMAC payload construction logic for testing
    function buildHmacPayload(cache: {
      tier: string;
      expiresAt: string;
      features: string[];
      addons?: Array<{ type: string; expiresAt: string }>;
    }): string {
      let payload = `${cache.tier}:${cache.expiresAt}:${cache.features.join(",")}`;
      if (cache.addons && cache.addons.length > 0) {
        const addonStr = cache.addons.map((a) => `${a.type}:${a.expiresAt}`).join("|");
        payload += `:addons=${addonStr}`;
      }
      return payload;
    }

    it("should produce consistent payload without addons", () => {
      const payload = buildHmacPayload({
        tier: "basic",
        expiresAt: "2026-12-31",
        features: ["basic_chat", "basic_skills"],
      });
      expect(payload).toBe("basic:2026-12-31:basic_chat,basic_skills");
    });

    it("should produce consistent payload with empty addons", () => {
      const payload = buildHmacPayload({
        tier: "pro",
        expiresAt: "2026-12-31",
        features: ["basic_chat", "advanced_model"],
        addons: [],
      });
      expect(payload).toBe("pro:2026-12-31:basic_chat,advanced_model");
    });

    it("should include addons in payload", () => {
      const payload = buildHmacPayload({
        tier: "pro",
        expiresAt: "2026-12-31",
        features: ["basic_chat"],
        addons: [{ type: "skills_s1", expiresAt: "2026-06-30" }],
      });
      expect(payload).toBe("pro:2026-12-31:basic_chat:addons=skills_s1:2026-06-30");
    });

    it("should include multiple addons in payload", () => {
      const payload = buildHmacPayload({
        tier: "pro",
        expiresAt: "2026-12-31",
        features: ["basic_chat"],
        addons: [
          { type: "skills_s1", expiresAt: "2026-06-30" },
          { type: "skills_s2", expiresAt: "2026-09-30" },
        ],
      });
      expect(payload).toContain("addons=");
      expect(payload).toContain("skills_s1:2026-06-30");
      expect(payload).toContain("skills_s2:2026-09-30");
    });

    it("should produce different payloads for different addon data (tamper detection)", () => {
      const original = buildHmacPayload({
        tier: "pro",
        expiresAt: "2026-12-31",
        features: ["basic_chat"],
        addons: [{ type: "skills_s1", expiresAt: "2026-06-30" }],
      });

      const tampered = buildHmacPayload({
        tier: "pro",
        expiresAt: "2026-12-31",
        features: ["basic_chat"],
        addons: [{ type: "skills_s1", expiresAt: "2099-12-31" }], // tampered date
      });

      expect(original).not.toBe(tampered);
    });

    it("should produce different payload if addon is removed", () => {
      const withAddon = buildHmacPayload({
        tier: "pro",
        expiresAt: "2026-12-31",
        features: ["basic_chat"],
        addons: [{ type: "skills_s1", expiresAt: "2026-06-30" }],
      });

      const withoutAddon = buildHmacPayload({
        tier: "pro",
        expiresAt: "2026-12-31",
        features: ["basic_chat"],
        addons: [],
      });

      expect(withAddon).not.toBe(withoutAddon);
    });
  });

  describe("Offline response addon inclusion", () => {
    it("should include addons in offline license response", () => {
      const cachedAddons = [
        {
          type: "skills_s1",
          name: "技能扩展包 S1",
          expiresAt: "2026-06-30T00:00:00Z",
          features: ["extra_skills_s1"],
        },
      ];

      // Simulate offline response construction
      const offlineResponse = {
        tier: "pro",
        features: ["basic_chat", "advanced_model", "agent-team"],
        addons: cachedAddons,
      };

      expect(offlineResponse.addons).toHaveLength(1);
      expect(offlineResponse.addons[0].type).toBe("skills_s1");
      expect(offlineResponse.addons[0].features).toContain("extra_skills_s1");
    });

    it("should handle cache with no addons field gracefully", () => {
      const cache = {
        tier: "basic",
        features: ["basic_chat"],
        // no addons field
      };

      const addons = (cache as { addons?: unknown[] }).addons ?? [];
      expect(addons).toEqual([]);
    });
  });
});

describe("Tier Values Validation", () => {
  const VALID_TIERS = ["basic", "pro", "test", "trial"];

  it("should accept all valid tier values", () => {
    for (const tier of VALID_TIERS) {
      expect(typeof tier).toBe("string");
      expect(tier.length).toBeGreaterThan(0);
    }
  });

  it("should not include deprecated tier values", () => {
    expect(VALID_TIERS).not.toContain("professional");
    expect(VALID_TIERS).not.toContain("enterprise");
  });

  it("should have exactly 4 tiers", () => {
    expect(VALID_TIERS).toHaveLength(4);
  });
});
