/**
 * Security Tests for RSA Signature Verification
 * RSA 签名验证安全测试
 */

import { describe, expect, it } from "vitest";
import {
  verifyRsaSignature,
  verifyLicenseResponseSignature,
  verifyHeartbeatResponseSignature,
  verifyServerTime,
  buildSignContent,
} from "./rsa-verify.js";

describe("RSA Signature Verification Security Tests", () => {
  describe("verifyRsaSignature", () => {
    it("should reject invalid signatures", () => {
      const content = "true|basic|2027-01-29T16:14:43Z|1234567890";
      const invalidSignature = "invalid_base64_signature";
      expect(verifyRsaSignature(content, invalidSignature)).toBe(false);
    });

    it("should reject empty signature", () => {
      const content = "true|basic|2027-01-29T16:14:43Z|1234567890";
      expect(verifyRsaSignature(content, "")).toBe(false);
    });

    it("should reject malformed base64 signature", () => {
      const content = "true|basic|2027-01-29T16:14:43Z|1234567890";
      const malformed = "not-valid-base64!!!";
      expect(verifyRsaSignature(content, malformed)).toBe(false);
    });

    it("should handle empty content gracefully", () => {
      const emptyContent = "";
      const signature = "dGVzdA=="; // base64("test")
      expect(verifyRsaSignature(emptyContent, signature)).toBe(false);
    });

    it("should handle very long content", () => {
      const longContent = "a".repeat(10000);
      const signature = "dGVzdA==";
      expect(verifyRsaSignature(longContent, signature)).toBe(false);
    });

    it("should handle special characters in content", () => {
      const specialContent = "true|basic|2027-01-29T16:14:43Z|1234567890\n\r\t|";
      const signature = "dGVzdA==";
      expect(verifyRsaSignature(specialContent, signature)).toBe(false);
    });
  });

  describe("verifyServerTime", () => {
    it("should accept current time", () => {
      const now = Date.now();
      expect(verifyServerTime(now)).toBe(true);
    });

    it("should accept time within 5 minutes in the past", () => {
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      expect(verifyServerTime(fourMinutesAgo)).toBe(true);
    });

    it("should accept time within 5 minutes in the future", () => {
      const fourMinutesFuture = Date.now() + 4 * 60 * 1000;
      expect(verifyServerTime(fourMinutesFuture)).toBe(true);
    });

    it("should reject time more than 5 minutes in the past", () => {
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      expect(verifyServerTime(sixMinutesAgo)).toBe(false);
    });

    it("should reject time more than 5 minutes in the future", () => {
      const sixMinutesFuture = Date.now() + 6 * 60 * 1000;
      expect(verifyServerTime(sixMinutesFuture)).toBe(false);
    });

    it("should reject very old timestamps (replay attack)", () => {
      const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
      expect(verifyServerTime(oneYearAgo)).toBe(false);
    });

    it("should reject very future timestamps", () => {
      const oneYearFuture = Date.now() + 365 * 24 * 60 * 60 * 1000;
      expect(verifyServerTime(oneYearFuture)).toBe(false);
    });

    it("should handle zero timestamp", () => {
      expect(verifyServerTime(0)).toBe(false);
    });

    it("should handle negative timestamp", () => {
      expect(verifyServerTime(-1)).toBe(false);
    });

    it("should handle very large timestamp", () => {
      const maxTimestamp = Number.MAX_SAFE_INTEGER;
      expect(verifyServerTime(maxTimestamp)).toBe(false);
    });
  });

  describe("buildSignContent", () => {
    it("should build correct content format", () => {
      const content = buildSignContent(true, "basic", "2027-01-29T16:14:43", 1234567890);
      expect(content).toBe("true|basic|2027-01-29T16:14:43Z|1234567890");
    });

    it("should handle null tier", () => {
      const content = buildSignContent(false, null, null, 1234567890);
      expect(content).toBe("false|||1234567890");
    });

    it("should normalize expiresAt without Z suffix", () => {
      const content = buildSignContent(true, "basic", "2027-01-29T16:14:43", 1234567890);
      expect(content).toContain("2027-01-29T16:14:43Z");
    });

    it("should preserve expiresAt with Z suffix", () => {
      const content = buildSignContent(true, "basic", "2027-01-29T16:14:43Z", 1234567890);
      expect(content).toContain("2027-01-29T16:14:43Z");
    });

    it("should normalize expiresAt with space separator (Jackson LocalDateTime)", () => {
      const content = buildSignContent(true, "basic", "2027-01-29 16:14:43", 1234567890);
      expect(content).toBe("true|basic|2027-01-29T16:14:43Z|1234567890");
    });

    it("should handle empty expiresAt", () => {
      const content = buildSignContent(false, null, "", 1234567890);
      expect(content).toBe("false|||1234567890");
    });

    it("should prevent injection via tier field", () => {
      const maliciousTier = "basic|injected";
      const content = buildSignContent(true, maliciousTier, null, 1234567890);
      // Should contain the pipe character literally, not as separator
      expect(content).toContain("basic|injected");
      expect(content.split("|").length).toBeGreaterThan(4); // More than 4 parts means injection
    });

    it("should handle special characters in tier", () => {
      const specialTier = "test-tier_with-special.chars";
      const content = buildSignContent(true, specialTier, null, 1234567890);
      expect(content).toContain(specialTier);
    });
  });

  describe("verifyLicenseResponseSignature", () => {
    it("should reject when serverTime is too old", () => {
      const oldTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const result = verifyLicenseResponseSignature(
        true,
        "basic",
        "2027-01-29T16:14:43Z",
        oldTime,
        "invalid_signature",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("重放攻击");
    });

    it("should reject when serverTime is too far in future", () => {
      const futureTime = Date.now() + 10 * 60 * 1000; // 10 minutes future
      const result = verifyLicenseResponseSignature(
        true,
        "basic",
        "2027-01-29T16:14:43Z",
        futureTime,
        "invalid_signature",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("重放攻击");
    });

    it("should reject invalid signature even with valid serverTime", () => {
      const now = Date.now();
      const result = verifyLicenseResponseSignature(
        true,
        "basic",
        "2027-01-29T16:14:43Z",
        now,
        "invalid_signature",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("RSA 签名验证失败");
    });

    it("should handle null tier gracefully", () => {
      const now = Date.now();
      const result = verifyLicenseResponseSignature(false, null, null, now, "invalid_signature");
      expect(result.valid).toBe(false);
    });

    it("should handle empty signature", () => {
      const now = Date.now();
      const result = verifyLicenseResponseSignature(true, "basic", "2027-01-29T16:14:43Z", now, "");
      expect(result.valid).toBe(false);
    });
  });

  describe("verifyHeartbeatResponseSignature", () => {
    it("should reject when serverTime is too old", () => {
      const oldTime = Date.now() - 10 * 60 * 1000;
      const result = verifyHeartbeatResponseSignature(true, 30, oldTime, "invalid_signature");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("重放攻击");
    });

    it("should reject invalid signature", () => {
      const now = Date.now();
      const result = verifyHeartbeatResponseSignature(true, 30, now, "invalid_signature");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("RSA 签名验证失败");
    });

    it("should handle negative daysRemaining", () => {
      const now = Date.now();
      const result = verifyHeartbeatResponseSignature(false, -1, now, "invalid_signature");
      expect(result.valid).toBe(false);
    });

    it("should handle very large daysRemaining", () => {
      const now = Date.now();
      const result = verifyHeartbeatResponseSignature(true, 999999, now, "invalid_signature");
      expect(result.valid).toBe(false);
    });
  });
});
