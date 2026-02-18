/**
 * Skills Marketplace Search Gateway Handler Tests
 * CN-ONLY FILE
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GatewayRequestHandlerOptions } from "./types.js";

// ── Mock DB layer ──────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  searchItems: vi.fn(),
  getItemById: vi.fn(),
  getStats: vi.fn(),
  getCategoryStats: vi.fn(),
}));

vi.mock("../../agents/skills/marketplace/db.js", () => ({
  searchItems: mocks.searchItems,
  getItemById: mocks.getItemById,
  getStats: mocks.getStats,
  getCategoryStats: mocks.getCategoryStats,
}));

// Import handlers after mocks
import {
  skillsMarketplaceSearch,
  skillsMarketplaceGetById,
  skillsMarketplaceGetStats,
  skillsMarketplaceGetCategories,
} from "./skills-marketplace-search.js";

// ── Helpers ────────────────────────────────────────────────

function makeOpts(
  params: Record<string, unknown> = {},
): GatewayRequestHandlerOptions & { respond: ReturnType<typeof vi.fn> } {
  const respond = vi.fn();
  return {
    req: { type: "req" as const, id: "test-1", method: "skills_marketplace.search" },
    params,
    respond,
    context: {
      logGateway: { info: vi.fn(), error: vi.fn() },
      dedupe: new Map(),
      addChatRun: vi.fn(),
    } as unknown as GatewayRequestHandlerOptions["context"],
    client: null,
    isWebchatConnect: () => false,
  };
}

// ── Tests ──────────────────────────────────────────────────

describe("skills_marketplace.search", () => {
  beforeEach(() => {
    mocks.searchItems.mockClear();
    mocks.searchItems.mockReturnValue({
      items: [{ skillId: "test", name: "test" }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it("calls searchItems with default options", async () => {
    const opts = makeOpts({});
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchItems).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        orderBy: "updated_at",
        orderDirection: "DESC",
      }),
    );
    expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ total: 1 }));
  });

  it("passes keyword and category to searchItems", async () => {
    const opts = makeOpts({ keyword: "笔记", category: "生产力工具" });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchItems).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: "笔记",
        category: "生产力工具",
      }),
    );
  });

  it("passes tier, cnBlocked, installed filters", async () => {
    const opts = makeOpts({ tier: "A", cnBlocked: false, installed: true });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchItems).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: "A",
        cnBlocked: false,
        installed: true,
      }),
    );
  });

  it("rejects keyword over 500 chars", async () => {
    const opts = makeOpts({ keyword: "x".repeat(501) });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchItems).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("500"),
      }),
    );
  });

  it("rejects non-integer page", async () => {
    const opts = makeOpts({ page: 1.5 });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchItems).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("page"),
      }),
    );
  });

  it("rejects page out of range", async () => {
    const opts = makeOpts({ page: 0 });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchItems).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("page"),
      }),
    );
  });

  it("rejects pageSize out of range", async () => {
    const opts = makeOpts({ pageSize: 200 });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchItems).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("pageSize"),
      }),
    );
  });

  it("handles searchItems throwing", async () => {
    mocks.searchItems.mockImplementation(() => {
      throw new Error("DB crash");
    });
    const opts = makeOpts({});
    await skillsMarketplaceSearch(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("DB crash"),
      }),
    );
  });
});

describe("skills_marketplace.get_by_id", () => {
  beforeEach(() => {
    mocks.getItemById.mockClear();
  });

  it("returns item when found", async () => {
    mocks.getItemById.mockReturnValue({ skillId: "test", name: "test" });
    const opts = makeOpts({ skillId: "test" });
    await skillsMarketplaceGetById(opts);

    expect(mocks.getItemById).toHaveBeenCalledWith("test");
    expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ skillId: "test" }));
  });

  it("returns error for missing skillId", async () => {
    const opts = makeOpts({});
    await skillsMarketplaceGetById(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("skillId"),
      }),
    );
  });

  it("returns error for non-existent skill", async () => {
    mocks.getItemById.mockReturnValue(null);
    const opts = makeOpts({ skillId: "ghost" });
    await skillsMarketplaceGetById(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("ghost"),
      }),
    );
  });
});

describe("skills_marketplace.get_stats", () => {
  beforeEach(() => {
    mocks.getStats.mockClear();
  });

  it("returns stats", async () => {
    const statsData = { total: 10, installed: 3, cnBlocked: 2, tierDistribution: { A: 5, B: 5 } };
    mocks.getStats.mockReturnValue(statsData);
    const opts = makeOpts({});
    await skillsMarketplaceGetStats(opts);

    expect(opts.respond).toHaveBeenCalledWith(true, statsData);
  });

  it("handles error", async () => {
    mocks.getStats.mockImplementation(() => {
      throw new Error("stats fail");
    });
    const opts = makeOpts({});
    await skillsMarketplaceGetStats(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("stats fail"),
      }),
    );
  });
});

describe("skills_marketplace.get_categories", () => {
  beforeEach(() => {
    mocks.getCategoryStats.mockClear();
  });

  it("returns category stats", async () => {
    const catData = { 生产力工具: 5, 安全: 3 };
    mocks.getCategoryStats.mockReturnValue(catData);
    const opts = makeOpts({});
    await skillsMarketplaceGetCategories(opts);

    expect(opts.respond).toHaveBeenCalledWith(true, catData);
  });

  it("handles error", async () => {
    mocks.getCategoryStats.mockImplementation(() => {
      throw new Error("cat fail");
    });
    const opts = makeOpts({});
    await skillsMarketplaceGetCategories(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("cat fail"),
      }),
    );
  });
});
