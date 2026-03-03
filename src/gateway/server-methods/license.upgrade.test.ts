/**
 * Tests for license.upgrade Gateway handler input validation
 * license.upgrade Gateway 方法输入验证测试
 */

import { describe, expect, it } from "vitest";

describe("License Upgrade Gateway Input Validation", () => {
  const MAX_UPGRADE_KEY_LENGTH = 256;
  const UPGRADE_KEY_PATTERN = /^[a-zA-Z0-9\-_]+$/;

  function validateUpgradeKey(key: unknown): { valid: boolean; error?: string } {
    if (!key || typeof key !== "string") {
      return { valid: false, error: "升级码不能为空" };
    }

    const trimmed = key.trim();

    if (trimmed.length < 8) {
      return { valid: false, error: "升级码长度不能少于 8 个字符" };
    }

    if (trimmed.length > MAX_UPGRADE_KEY_LENGTH) {
      return { valid: false, error: `升级码长度不能超过 ${MAX_UPGRADE_KEY_LENGTH} 个字符` };
    }

    if (!UPGRADE_KEY_PATTERN.test(trimmed)) {
      return { valid: false, error: "升级码格式不正确" };
    }

    return { valid: true };
  }

  function isUpgradePrefix(key: string): boolean {
    const lower = key.trim().toLowerCase();
    return lower.startsWith("upg-") || lower.startsWith("skill-");
  }

  describe("upgradeKey validation", () => {
    it("should reject null upgradeKey", () => {
      expect(validateUpgradeKey(null).valid).toBe(false);
    });

    it("should reject undefined upgradeKey", () => {
      expect(validateUpgradeKey(undefined).valid).toBe(false);
    });

    it("should reject empty string", () => {
      expect(validateUpgradeKey("").valid).toBe(false);
    });

    it("should reject key shorter than 8 chars", () => {
      expect(validateUpgradeKey("upg-ab").valid).toBe(false);
    });

    it("should accept valid upgrade key with upg- prefix", () => {
      expect(validateUpgradeKey("upg-bp-abc123def456").valid).toBe(true);
    });

    it("should accept valid upgrade key with skill- prefix", () => {
      expect(validateUpgradeKey("skill-s1-abc123def456").valid).toBe(true);
    });

    it("should reject key with special characters", () => {
      expect(validateUpgradeKey("upg-bp-<script>alert(1)</script>").valid).toBe(false);
    });

    it("should reject key with SQL injection attempt", () => {
      expect(validateUpgradeKey("upg-bp-'; DROP TABLE--").valid).toBe(false);
    });

    it("should reject key exceeding max length", () => {
      const longKey = "upg-bp-" + "a".repeat(MAX_UPGRADE_KEY_LENGTH);
      expect(validateUpgradeKey(longKey).valid).toBe(false);
    });

    it("should accept key at exact max length boundary", () => {
      const key = "upg-bp-" + "a".repeat(MAX_UPGRADE_KEY_LENGTH - 7);
      expect(validateUpgradeKey(key).valid).toBe(true);
    });

    it("should reject non-string types", () => {
      expect(validateUpgradeKey(12345).valid).toBe(false);
      expect(validateUpgradeKey({ key: "test" }).valid).toBe(false);
      expect(validateUpgradeKey(["upg-test"]).valid).toBe(false);
      expect(validateUpgradeKey(true).valid).toBe(false);
    });
  });

  describe("upgrade prefix detection", () => {
    it("should detect upg- prefix", () => {
      expect(isUpgradePrefix("upg-bp-abc123")).toBe(true);
    });

    it("should detect skill- prefix", () => {
      expect(isUpgradePrefix("skill-s1-abc123")).toBe(true);
    });

    it("should not detect clawd- as upgrade", () => {
      expect(isUpgradePrefix("clawd-standard-abc123")).toBe(false);
    });

    it("should not detect clpro- as upgrade", () => {
      expect(isUpgradePrefix("clpro-standard-abc123")).toBe(false);
    });

    it("should not detect test- as upgrade", () => {
      expect(isUpgradePrefix("test-abc123")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(isUpgradePrefix("UPG-BP-ABC123")).toBe(true);
      expect(isUpgradePrefix("SKILL-S1-ABC123")).toBe(true);
      expect(isUpgradePrefix("Upg-Bp-Abc123")).toBe(true);
    });

    it("should handle leading/trailing whitespace", () => {
      expect(isUpgradePrefix("  upg-bp-abc123  ")).toBe(true);
      expect(isUpgradePrefix("\tskill-s1-abc123\n")).toBe(true);
    });
  });

  describe("Upgrade response handling", () => {
    it("should handle successful tier upgrade response", () => {
      const response = {
        success: true,
        upgradeType: "tier_upgrade",
        fromTier: "basic",
        toTier: "pro",
        message: "成功升级到高级版",
        license: {
          tier: "pro",
          tierName: "高级版",
          keyType: "standard",
          expiresAt: "2026-12-31T23:59:59Z",
          features: ["basic_chat", "advanced_model", "agent-team"],
          addons: [],
          daysRemaining: 303,
        },
      };

      expect(response.success).toBe(true);
      expect(response.upgradeType).toBe("tier_upgrade");
      expect(response.license.tier).toBe("pro");
      expect(response.license.addons).toEqual([]);
    });

    it("should handle successful addon response", () => {
      const response = {
        success: true,
        upgradeType: "addon",
        message: "扩展包激活成功",
        license: {
          tier: "pro",
          features: ["basic_chat", "advanced_model"],
          addons: [
            {
              type: "skills_s1",
              name: "技能扩展包 S1",
              expiresAt: "2026-12-31T23:59:59Z",
              features: ["extra_skills_s1"],
            },
          ],
        },
      };

      expect(response.success).toBe(true);
      expect(response.upgradeType).toBe("addon");
      expect(response.license.addons).toHaveLength(1);
    });

    it("should handle upgrade key expired error with expiredAt", () => {
      const response = {
        success: false,
        errorCode: 2004,
        errorMessage: "升级码已过期",
        expiredAt: "2025-01-15T00:00:00Z",
      };

      expect(response.success).toBe(false);
      expect(response.errorCode).toBe(2004);
      expect(response.expiredAt).toBeTruthy();
      // expiredAt should be parseable as a date
      expect(new Date(response.expiredAt).getTime()).toBeGreaterThan(0);
    });

    it("should handle tier mismatch error (already pro)", () => {
      const response = {
        success: false,
        errorCode: 2002,
        errorMessage: "您已是高级版，无需升级",
      };

      expect(response.success).toBe(false);
      expect(response.errorCode).toBe(2002);
    });

    it("should handle addon duplicate error", () => {
      const response = {
        success: false,
        errorCode: 2005,
        errorMessage: "该扩展包已激活",
      };

      expect(response.success).toBe(false);
      expect(response.errorCode).toBe(2005);
    });
  });
});
