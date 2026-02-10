/**
 * Security test: SSRF Prevention in ClawdSkillsProxy Registry
 *
 * Tests that ClawdSkillsProxy registry properly validates URLs
 * to prevent SSRF attacks when fetching skills index or downloading.
 *
 * See: SECURITY_AUDIT_BATCH_1_PHASE_2.md - Vulnerability #7
 */

import { describe, expect, it } from "vitest";
import { fetchProxySkillsIndex } from "./clawdskillsproxy-registry.js";
import type { ProxyRegistryConfig } from "./clawdskillsproxy-registry.js";

describe("ClawdSkillsProxy Registry - SSRF prevention (Phase 2 #7)", () => {
  describe("fetchProxySkillsIndex SSRF protection", () => {
    it("blocks AWS metadata endpoint", async () => {
      const maliciousConfig: ProxyRegistryConfig = {
        baseUrl: "http://169.254.169.254/latest/meta-data",
        token: "test",
        timeoutMs: 5000,
        batchSize: 200,
      };

      const result = await fetchProxySkillsIndex(maliciousConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/SSRF.*blocked|private.*IP|internal.*network/i);
      }
    });

    it("blocks localhost access", async () => {
      const maliciousConfig: ProxyRegistryConfig = {
        baseUrl: "http://localhost:8080/admin",
        token: "test",
        timeoutMs: 5000,
        batchSize: 200,
      };

      const result = await fetchProxySkillsIndex(maliciousConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/SSRF.*blocked|localhost|loopback/i);
      }
    });

    it("blocks 127.0.0.1 loopback", async () => {
      const maliciousConfig: ProxyRegistryConfig = {
        baseUrl: "http://127.0.0.1:9000/secrets",
        token: "test",
        timeoutMs: 5000,
        batchSize: 200,
      };

      const result = await fetchProxySkillsIndex(maliciousConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/SSRF.*blocked|127\.0\.0\.1|loopback/i);
      }
    });

    it("blocks private network 10.0.0.0/8", async () => {
      const maliciousConfig: ProxyRegistryConfig = {
        baseUrl: "http://10.0.0.1/internal",
        token: "test",
        timeoutMs: 5000,
        batchSize: 200,
      };

      const result = await fetchProxySkillsIndex(maliciousConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/SSRF.*blocked|private.*IP/i);
      }
    });

    it("blocks private network 192.168.0.0/16", async () => {
      const maliciousConfig: ProxyRegistryConfig = {
        baseUrl: "http://192.168.1.1/router",
        token: "test",
        timeoutMs: 5000,
        batchSize: 200,
      };

      const result = await fetchProxySkillsIndex(maliciousConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/SSRF.*blocked|private.*IP/i);
      }
    });

    it("blocks private network 172.16.0.0/12", async () => {
      const maliciousConfig: ProxyRegistryConfig = {
        baseUrl: "http://172.16.0.1/admin",
        token: "test",
        timeoutMs: 5000,
        batchSize: 200,
      };

      const result = await fetchProxySkillsIndex(maliciousConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/SSRF.*blocked|private.*IP/i);
      }
    });

    it("blocks link-local addresses", async () => {
      const maliciousConfig: ProxyRegistryConfig = {
        baseUrl: "http://169.254.1.1/metadata",
        token: "test",
        timeoutMs: 5000,
        batchSize: 200,
      };

      const result = await fetchProxySkillsIndex(maliciousConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/SSRF.*blocked|link-local|169\.254/i);
      }
    });

    it("allows legitimate public URLs", async () => {
      // This will fail with network error or auth error, but NOT SSRF error
      const legitimateConfig: ProxyRegistryConfig = {
        baseUrl: "https://api.github.com",
        token: "test",
        timeoutMs: 5000,
        batchSize: 200,
      };

      const result = await fetchProxySkillsIndex(legitimateConfig);

      // Should not fail with SSRF error
      if (!result.ok) {
        expect(result.error).not.toMatch(/SSRF.*blocked|private.*IP|internal/i);
      }
    });
  });
});
