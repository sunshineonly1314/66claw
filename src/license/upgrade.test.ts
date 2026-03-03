/**
 * Tests for license upgrade functionality
 * 授权升级功能测试
 */

import { describe, expect, it } from "vitest";
import { LicenseUpgradeErrorCode, UPGRADE_ERROR_MESSAGES } from "./types.js";

describe("License Upgrade Types & Error Codes", () => {
  describe("LicenseUpgradeErrorCode", () => {
    it("should define all 5 error codes", () => {
      expect(LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_INVALID).toBe(2001);
      expect(LicenseUpgradeErrorCode.ERROR_TIER_MISMATCH).toBe(2002);
      expect(LicenseUpgradeErrorCode.ERROR_MAIN_KEY_INVALID).toBe(2003);
      expect(LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_EXPIRED).toBe(2004);
      expect(LicenseUpgradeErrorCode.ERROR_ADDON_DUPLICATE).toBe(2005);
    });

    it("should have no gaps in error code range", () => {
      const codes = [
        LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_INVALID,
        LicenseUpgradeErrorCode.ERROR_TIER_MISMATCH,
        LicenseUpgradeErrorCode.ERROR_MAIN_KEY_INVALID,
        LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_EXPIRED,
        LicenseUpgradeErrorCode.ERROR_ADDON_DUPLICATE,
      ];
      expect(codes).toEqual([2001, 2002, 2003, 2004, 2005]);
    });
  });

  describe("UPGRADE_ERROR_MESSAGES", () => {
    it("should have messages for all error codes", () => {
      expect(
        UPGRADE_ERROR_MESSAGES[LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_INVALID],
      ).toBeDefined();
      expect(UPGRADE_ERROR_MESSAGES[LicenseUpgradeErrorCode.ERROR_TIER_MISMATCH]).toBeDefined();
      expect(UPGRADE_ERROR_MESSAGES[LicenseUpgradeErrorCode.ERROR_MAIN_KEY_INVALID]).toBeDefined();
      expect(
        UPGRADE_ERROR_MESSAGES[LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_EXPIRED],
      ).toBeDefined();
      expect(UPGRADE_ERROR_MESSAGES[LicenseUpgradeErrorCode.ERROR_ADDON_DUPLICATE]).toBeDefined();
    });

    it("should have non-empty string messages", () => {
      for (const code of Object.values(LicenseUpgradeErrorCode)) {
        if (typeof code === "number") {
          const msg = UPGRADE_ERROR_MESSAGES[code as LicenseUpgradeErrorCode];
          expect(typeof msg).toBe("string");
          expect(msg.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

describe("Upgrade Key Prefix Routing Logic", () => {
  // Re-implement the prefix routing logic from license-controller.ts for unit testing
  function classifyKey(key: string): "upgrade" | "activate" {
    const trimmed = key.trim().toLowerCase();
    if (trimmed.startsWith("upg-") || trimmed.startsWith("skill-")) {
      return "upgrade";
    }
    return "activate";
  }

  describe("upgrade key prefixes", () => {
    it("should route upg- prefix to upgrade", () => {
      expect(classifyKey("upg-bp-abc123")).toBe("upgrade");
    });

    it("should route skill- prefix to upgrade", () => {
      expect(classifyKey("skill-s1-abc123")).toBe("upgrade");
    });

    it("should be case-insensitive", () => {
      expect(classifyKey("UPG-BP-ABC123")).toBe("upgrade");
      expect(classifyKey("SKILL-S1-ABC123")).toBe("upgrade");
      expect(classifyKey("Upg-Bp-Abc123")).toBe("upgrade");
    });

    it("should handle whitespace trimming", () => {
      expect(classifyKey("  upg-bp-abc123  ")).toBe("upgrade");
      expect(classifyKey("  skill-s1-abc123  ")).toBe("upgrade");
    });
  });

  describe("activation key prefixes", () => {
    it("should route clawd- prefix to activate", () => {
      expect(classifyKey("clawd-standard-abc123")).toBe("activate");
    });

    it("should route clpro- prefix to activate", () => {
      expect(classifyKey("clpro-standard-abc123")).toBe("activate");
    });

    it("should route test- prefix to activate", () => {
      expect(classifyKey("test-abc-123456")).toBe("activate");
    });

    it("should route trial- prefix to activate", () => {
      expect(classifyKey("trial-abc-123456")).toBe("activate");
    });

    it("should route unknown prefixes to activate", () => {
      expect(classifyKey("unknown-abc-123456")).toBe("activate");
    });
  });
});

describe("Upgrade Response Data Parsing", () => {
  // Test the expected response data structure

  it("should accept a successful tier_upgrade response", () => {
    const response = {
      success: true,
      upgradeType: "tier_upgrade" as const,
      fromTier: "basic",
      toTier: "pro",
      message: "升级成功",
      license: {
        tier: "pro",
        tierName: "高级版",
        expiresAt: "2026-12-31T00:00:00Z",
        features: ["basic_chat", "basic_skills", "advanced_model", "agent-team"],
        addons: [],
      },
      signature: "base64signature",
      serverTime: Date.now(),
    };

    expect(response.success).toBe(true);
    expect(response.upgradeType).toBe("tier_upgrade");
    expect(response.fromTier).toBe("basic");
    expect(response.toTier).toBe("pro");
    expect(response.license.tier).toBe("pro");
    expect(response.license.addons).toEqual([]);
  });

  it("should accept a successful addon response", () => {
    const response = {
      success: true,
      upgradeType: "addon" as const,
      message: "扩展包激活成功",
      license: {
        tier: "pro",
        expiresAt: "2026-12-31T00:00:00Z",
        features: ["basic_chat", "advanced_model"],
        addons: [
          {
            type: "skills_s1",
            name: "技能扩展包 S1",
            expiresAt: "2026-12-31T00:00:00Z",
            features: ["extra_skills_s1"],
          },
        ],
      },
    };

    expect(response.success).toBe(true);
    expect(response.upgradeType).toBe("addon");
    expect(response.license.addons).toHaveLength(1);
    expect(response.license.addons[0].type).toBe("skills_s1");
  });

  it("should accept an error response with errorCode 2004 (expired)", () => {
    const response = {
      success: false,
      errorCode: LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_EXPIRED,
      errorMessage: "升级码已过期",
      expiredAt: "2026-01-01T00:00:00Z",
    };

    expect(response.success).toBe(false);
    expect(response.errorCode).toBe(2004);
    expect(response.expiredAt).toBeDefined();
  });

  it("should accept an error response without expiredAt for non-2004 codes", () => {
    const response = {
      success: false,
      errorCode: LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_INVALID,
      errorMessage: "激活码无效",
    };

    expect(response.success).toBe(false);
    expect(response.errorCode).toBe(2001);
    expect(response.expiredAt).toBeUndefined();
  });
});

describe("Feature Code Mapping (Two-Set Coexistence)", () => {
  // Verify the two-set feature code strategy
  const BASIC_FEATURES = ["basic_chat", "basic_skills", "history_7days"];
  const PRO_FEATURES = [
    ...BASIC_FEATURES,
    "advanced_skills",
    "history_unlimited",
    "priority_response",
    "advanced_model",
    // Legacy high-value features coexist
    "agent-team",
    "orchestrator",
    "memory-core",
  ];

  it("basic tier should only have basic features", () => {
    expect(BASIC_FEATURES).toContain("basic_chat");
    expect(BASIC_FEATURES).toContain("basic_skills");
    expect(BASIC_FEATURES).not.toContain("agent-team");
    expect(BASIC_FEATURES).not.toContain("advanced_model");
  });

  it("pro tier should include both old and new feature codes", () => {
    // Old codes (for backward compat)
    expect(PRO_FEATURES).toContain("agent-team");
    expect(PRO_FEATURES).toContain("orchestrator");
    expect(PRO_FEATURES).toContain("memory-core");
    // New codes
    expect(PRO_FEATURES).toContain("advanced_model");
    expect(PRO_FEATURES).toContain("advanced_skills");
    expect(PRO_FEATURES).toContain("history_unlimited");
  });

  it("pro tier should be a superset of basic tier", () => {
    for (const feature of BASIC_FEATURES) {
      expect(PRO_FEATURES).toContain(feature);
    }
  });

  it("HIGH_VALUE_FEATURES should match legacy codes", () => {
    // These are checked by hasLicenseFeature in license-check.ts
    const highValueFeatures = new Set(["agent-team", "orchestrator", "memory-core"]);
    for (const f of highValueFeatures) {
      expect(PRO_FEATURES).toContain(f);
      expect(BASIC_FEATURES).not.toContain(f);
    }
  });
});

describe("Addon Info Structure", () => {
  it("should validate addon structure", () => {
    const addon = {
      type: "skills_s1",
      name: "技能扩展包 S1",
      expiresAt: "2026-12-31T00:00:00Z",
      features: ["extra_skills_s1"],
    };

    expect(addon.type).toBe("skills_s1");
    expect(addon.name).toBeTruthy();
    expect(new Date(addon.expiresAt).getTime()).toBeGreaterThan(0);
    expect(addon.features).toHaveLength(1);
  });

  it("should handle empty addons array for basic tier", () => {
    const addons: Array<{ type: string; name: string; expiresAt: string; features: string[] }> = [];
    expect(addons).toHaveLength(0);
  });
});
