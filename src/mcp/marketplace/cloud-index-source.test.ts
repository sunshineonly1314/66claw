/**
 * cloud-index-source.test.ts
 * Tests for the Tier 0 Cloud Index data source.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.stubGlobal("fetch", mocks.fetch);

import { fetchFromCloudIndex } from "./cloud-index-source.js";

describe("cloud-index-source", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    process.env.OPENCLAWCN_MCP_INDEX_URL = "https://cdn.example.com/mcp-index.json";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns empty array when URL is not configured", async () => {
    delete process.env.OPENCLAWCN_MCP_INDEX_URL;
    const items = await fetchFromCloudIndex();
    expect(items).toHaveLength(0);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("fetches and parses flat array format", async () => {
    const data = [
      { serverId: "fs", friendlyName: "Filesystem" },
      { serverId: "db", friendlyName: "Database" },
    ];
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const items = await fetchFromCloudIndex();
    expect(items).toHaveLength(2);
    expect(items[0].serverId).toBe("fs");
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://cdn.example.com/mcp-index.json",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/json" }),
      }),
    );
  });

  it("fetches and parses envelope {items: [...]} format", async () => {
    const envelope = {
      version: 2,
      generatedAt: "2026-02-17T03:00:00Z",
      itemCount: 1,
      items: [{ serverId: "wrapped", friendlyName: "Wrapped" }],
    };
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(envelope),
    });

    const items = await fetchFromCloudIndex();
    expect(items).toHaveLength(1);
    expect(items[0].serverId).toBe("wrapped");
  });

  it("returns empty array on HTTP error", async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const items = await fetchFromCloudIndex();
    expect(items).toHaveLength(0);
  });

  it("returns empty array on network failure", async () => {
    mocks.fetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const items = await fetchFromCloudIndex();
    expect(items).toHaveLength(0);
  });

  it("returns empty array on timeout (abort)", async () => {
    mocks.fetch.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    const items = await fetchFromCloudIndex();
    expect(items).toHaveLength(0);
  });

  it("returns empty array when response has no items", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 2 }),
    });

    const items = await fetchFromCloudIndex();
    expect(items).toHaveLength(0);
  });

  it("uses env var URL over default", async () => {
    process.env.OPENCLAWCN_MCP_INDEX_URL = "https://custom.example.com/index.json";
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ serverId: "custom" }]),
    });

    await fetchFromCloudIndex();
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://custom.example.com/index.json",
      expect.anything(),
    );
  });
});
