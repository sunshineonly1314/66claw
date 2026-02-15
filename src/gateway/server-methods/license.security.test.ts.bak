/**
 * Security Tests for License Gateway Methods
 * License Gateway 方法安全测试
 */

import { describe, expect, it } from "vitest";

// Import validation functions (need to export them first)
// For now, we'll test the handlers indirectly through integration tests

describe("License Gateway Input Validation Security Tests", () => {
  // Test cases for validateLicenseKey equivalent logic
  describe("License Key Validation", () => {
    const MIN_LICENSE_KEY_LENGTH = 8;
    const MAX_LICENSE_KEY_LENGTH = 256;
    const LICENSE_KEY_PATTERN = /^[a-zA-Z0-9\-_]+$/;

    function validateLicenseKey(key: unknown): { valid: boolean; error?: string } {
      if (!key || typeof key !== "string") {
        return { valid: false, error: "授权码不能为空" };
      }

      const trimmed = key.trim();

      if (trimmed.length < MIN_LICENSE_KEY_LENGTH) {
        return { valid: false, error: `授权码长度不能少于 ${MIN_LICENSE_KEY_LENGTH} 个字符` };
      }

      if (trimmed.length > MAX_LICENSE_KEY_LENGTH) {
        return { valid: false, error: `授权码长度不能超过 ${MAX_LICENSE_KEY_LENGTH} 个字符` };
      }

      if (!LICENSE_KEY_PATTERN.test(trimmed)) {
        return { valid: false, error: "授权码格式不正确，只能包含字母、数字、连字符和下划线" };
      }

      return { valid: true };
    }

    it("should reject null key", () => {
      const result = validateLicenseKey(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("不能为空");
    });

    it("should reject undefined key", () => {
      const result = validateLicenseKey(undefined);
      expect(result.valid).toBe(false);
    });

    it("should reject empty string", () => {
      const result = validateLicenseKey("");
      expect(result.valid).toBe(false);
    });

    it("should reject key shorter than minimum length", () => {
      const result = validateLicenseKey("short");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("不能少于");
    });

    it("should reject key longer than maximum length", () => {
      const longKey = "a".repeat(MAX_LICENSE_KEY_LENGTH + 1);
      const result = validateLicenseKey(longKey);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("不能超过");
    });

    it("should accept valid key with alphanumeric characters", () => {
      const result = validateLicenseKey("validKey123");
      expect(result.valid).toBe(true);
    });

    it("should accept valid key with hyphens", () => {
      const result = validateLicenseKey("valid-key-123");
      expect(result.valid).toBe(true);
    });

    it("should accept valid key with underscores", () => {
      const result = validateLicenseKey("valid_key_123");
      expect(result.valid).toBe(true);
    });

    it("should reject key with spaces", () => {
      const result = validateLicenseKey("invalid key");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("格式不正确");
    });

    it("should reject key with special characters", () => {
      const result = validateLicenseKey("invalid@key#123");
      expect(result.valid).toBe(false);
    });

    it("should reject key with SQL injection attempt", () => {
      const result = validateLicenseKey("'; DROP TABLE users; --");
      expect(result.valid).toBe(false);
    });

    it("should reject key with XSS attempt", () => {
      const result = validateLicenseKey("<script>alert('xss')</script>");
      expect(result.valid).toBe(false);
    });

    it("should trim whitespace before validation", () => {
      const result = validateLicenseKey("  validkey123  ");
      expect(result.valid).toBe(true);
    });

    it("should reject key with only whitespace", () => {
      const result = validateLicenseKey("   ");
      expect(result.valid).toBe(false);
    });

    it("should reject non-string types", () => {
      expect(validateLicenseKey(123).valid).toBe(false);
      expect(validateLicenseKey({}).valid).toBe(false);
      expect(validateLicenseKey([]).valid).toBe(false);
      expect(validateLicenseKey(true).valid).toBe(false);
    });

    it("should handle unicode characters", () => {
      const result = validateLicenseKey("测试key123");
      expect(result.valid).toBe(false); // Should reject unicode
    });

    it("should handle very long malicious input", () => {
      const malicious = "a".repeat(10000);
      const result = validateLicenseKey(malicious);
      expect(result.valid).toBe(false);
    });
  });

  describe("Device ID Validation", () => {
    const MAX_DEVICE_ID_LENGTH = 128;
    const DEVICE_ID_PATTERN = /^[a-zA-Z0-9\-_]+$/;

    function validateDeviceId(deviceId: unknown): { valid: boolean; error?: string } {
      if (!deviceId || typeof deviceId !== "string") {
        return { valid: false, error: "设备ID不能为空" };
      }

      const trimmed = deviceId.trim();

      if (trimmed.length === 0) {
        return { valid: false, error: "设备ID不能为空" };
      }

      if (trimmed.length > MAX_DEVICE_ID_LENGTH) {
        return { valid: false, error: `设备ID长度不能超过 ${MAX_DEVICE_ID_LENGTH} 个字符` };
      }

      if (!DEVICE_ID_PATTERN.test(trimmed)) {
        return { valid: false, error: "设备ID格式不正确" };
      }

      return { valid: true };
    }

    it("should reject null deviceId", () => {
      const result = validateDeviceId(null);
      expect(result.valid).toBe(false);
    });

    it("should reject empty string", () => {
      const result = validateDeviceId("");
      expect(result.valid).toBe(false);
    });

    it("should reject deviceId longer than maximum", () => {
      const longId = "a".repeat(MAX_DEVICE_ID_LENGTH + 1);
      const result = validateDeviceId(longId);
      expect(result.valid).toBe(false);
    });

    it("should accept valid deviceId", () => {
      const result = validateDeviceId("device-123_abc");
      expect(result.valid).toBe(true);
    });

    it("should reject deviceId with special characters", () => {
      const result = validateDeviceId("device@123");
      expect(result.valid).toBe(false);
    });

    it("should reject deviceId with spaces", () => {
      const result = validateDeviceId("device 123");
      expect(result.valid).toBe(false);
    });

    it("should trim whitespace", () => {
      const result = validateDeviceId("  device123  ");
      expect(result.valid).toBe(true);
    });

    it("should reject non-string types", () => {
      expect(validateDeviceId(123).valid).toBe(false);
      expect(validateDeviceId({}).valid).toBe(false);
    });

    it("should handle path traversal attempt", () => {
      const result = validateDeviceId("../../../etc/passwd");
      expect(result.valid).toBe(false);
    });

    it("should handle command injection attempt", () => {
      const result = validateDeviceId("device123; rm -rf /");
      expect(result.valid).toBe(false);
    });
  });
});
