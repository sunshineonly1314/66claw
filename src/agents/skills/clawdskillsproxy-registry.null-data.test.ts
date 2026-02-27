/**
 * Bug fix test: fetchProxySkillsIndex handles null/undefined data.skills
 *
 * Reproduces: "Cannot read properties of undefined (reading '0')"
 * when ClawdSkillsProxy returns code=200 but data is null/empty
 * (common in incremental sync with no new skills).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock undici to control HTTP responses
const mockFetch = vi.fn();
vi.mock("undici", () => ({
  Agent: class FakeAgent {},
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

// Mock SSRF validation (allow all URLs in test)
vi.mock("../../infra/net/ssrf.js", () => ({
  validateUrlForSsrf: vi.fn(),
}));

// Mock cn-mirrors config
vi.mock("../../config/cn-mirrors.js", () => ({
  CLAWDSKILLSPROXY_CONFIG: {
    baseUrl: "https://test-proxy.example.com",
    token: "test-token",
  },
}));

import { fetchProxySkillsIndex } from "./clawdskillsproxy-registry.js";
import type { ProxyRegistryConfig } from "./clawdskillsproxy-registry.js";

const TEST_CONFIG: ProxyRegistryConfig = {
  baseUrl: "https://test-proxy.example.com",
  token: "test-token",
  timeoutMs: 5000,
  batchSize: 200,
};

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  };
}

describe("fetchProxySkillsIndex - null data defense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("crashes without fix: code=200 but data is null (incremental)", async () => {
    // This is what the proxy returns when there are no new skills
    mockFetch.mockResolvedValue(mockResponse({ code: 200, message: "ok", data: null }));

    const result = await fetchProxySkillsIndex(TEST_CONFIG, /* sinceVersion */ 42);

    // With the fix: should NOT crash, should return ok with empty skills
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.index.skills).toEqual([]);
      expect(result.index.version).toBe(42);
    }
  });

  it("crashes without fix: code=200 but data is undefined (incremental)", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ code: 200, message: "ok" }), // data field missing entirely
    );

    const result = await fetchProxySkillsIndex(TEST_CONFIG, /* sinceVersion */ 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.index.skills).toEqual([]);
      expect(result.index.version).toBe(10);
    }
  });

  it("crashes without fix: code=200 but data.skills is null (incremental)", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        code: 200,
        message: "ok",
        data: { globalVersion: 42, totalCount: 0, skills: null },
      }),
    );

    const result = await fetchProxySkillsIndex(TEST_CONFIG, /* sinceVersion */ 42);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.index.skills).toEqual([]);
    }
  });

  it("returns error for null data on full sync (no sinceVersion)", async () => {
    mockFetch.mockResolvedValue(mockResponse({ code: 200, message: "ok", data: null }));

    const result = await fetchProxySkillsIndex(TEST_CONFIG); // no sinceVersion

    // Full sync with null data is a real error
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("missing data.skills");
    }
  });

  it("works normally when data.skills is a valid array", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        code: 200,
        message: "ok",
        data: {
          globalVersion: 5,
          totalCount: 1,
          skills: [
            {
              skillId: "test-skill",
              version: 1,
              sha256: "abc",
              size: 100,
              updatedAt: Date.now(),
              path: "test-skill",
              status: "active",
              name: "Test Skill",
              description: "A test skill",
            },
          ],
        },
      }),
    );

    const result = await fetchProxySkillsIndex(TEST_CONFIG);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.index.skills).toHaveLength(1);
      expect(result.index.skills[0].name).toBe("Test Skill");
      expect(result.index.version).toBe(5);
    }
  });

  it("handles API error code correctly", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ code: 500, message: "Internal Server Error", data: null }),
    );

    const result = await fetchProxySkillsIndex(TEST_CONFIG);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("API error");
    }
  });

  it("handles data.skills as string instead of array (malformed)", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        code: 200,
        message: "ok",
        data: { globalVersion: 1, totalCount: 0, skills: "not-an-array" },
      }),
    );

    const result = await fetchProxySkillsIndex(TEST_CONFIG, 1);

    // sinceVersion set, so should return empty index (not crash)
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.index.skills).toEqual([]);
    }
  });
});
