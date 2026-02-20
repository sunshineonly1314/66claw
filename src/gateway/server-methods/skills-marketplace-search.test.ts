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
  getItemsByIds: vi.fn(),
  getStats: vi.fn(),
  getCategoryStats: vi.fn(),
  searchToolIndex: vi.fn(),
  loadConfig: vi.fn(),
}));

vi.mock("../../agents/skills/marketplace/db.js", () => ({
  searchItems: mocks.searchItems,
  getItemById: mocks.getItemById,
  getItemsByIds: mocks.getItemsByIds,
  getStats: mocks.getStats,
  getCategoryStats: mocks.getCategoryStats,
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock("../../dispatch/tool-discovery.js", () => ({
  searchToolIndex: mocks.searchToolIndex,
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
  const ftsResult = {
    items: [{ skillId: "test", name: "test" }],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  beforeEach(() => {
    mocks.searchItems.mockClear();
    mocks.getItemsByIds.mockClear();
    mocks.searchToolIndex.mockClear();
    mocks.loadConfig.mockClear();
    mocks.searchItems.mockReturnValue(ftsResult);
    mocks.loadConfig.mockReturnValue({});
  });

  // ── FTS5 fallback path (no keyword or short keyword) ──

  it("calls searchItems with default options (no keyword)", async () => {
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

  it("uses FTS5 for short keyword (1 char)", async () => {
    const opts = makeOpts({ keyword: "a" });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchToolIndex).not.toHaveBeenCalled();
    expect(mocks.searchItems).toHaveBeenCalled();
  });

  // ── Hybrid search path (keyword >= 2 chars) ──

  it("uses hybridSearch when keyword has 2+ chars", async () => {
    mocks.searchToolIndex.mockResolvedValue({
      ids: ["weather", "openweather"],
      scores: new Map([["weather", 0.92], ["openweather", 0.85]]),
    });
    mocks.getItemsByIds.mockReturnValue({
      items: [
        { skillId: "weather", name: "weather", category: "工具" },
        { skillId: "openweather", name: "openweather", category: "工具" },
      ],
      total: 2,
      page: 1,
      pageSize: 2,
      totalPages: 1,
    });

    const opts = makeOpts({ keyword: "天气" });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchToolIndex).toHaveBeenCalledWith("天气", expect.objectContaining({ type: "skill" }));
    expect(mocks.getItemsByIds).toHaveBeenCalledWith(
      ["weather", "openweather"],
      { page: 1, pageSize: 2 },
    );
    // Should NOT fall back to FTS5
    expect(mocks.searchItems).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ total: 2 }));
  });

  it("applies category filter on hybrid results", async () => {
    mocks.searchToolIndex.mockResolvedValue({
      ids: ["weather", "code-review"],
      scores: new Map([["weather", 0.9], ["code-review", 0.8]]),
    });
    mocks.getItemsByIds.mockReturnValue({
      items: [
        { skillId: "weather", name: "weather", category: "工具" },
        { skillId: "code-review", name: "code-review", category: "开发" },
      ],
      total: 2,
      page: 1,
      pageSize: 2,
      totalPages: 1,
    });

    const opts = makeOpts({ keyword: "天气", category: "工具" });
    await skillsMarketplaceSearch(opts);

    // Only the weather skill should pass the category filter
    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ total: 1, items: [expect.objectContaining({ skillId: "weather" })] }),
    );
  });

  it("applies tier and cnBlocked filters on hybrid results", async () => {
    mocks.searchToolIndex.mockResolvedValue({
      ids: ["weather", "code-review", "blocked-skill"],
      scores: new Map([["weather", 0.9], ["code-review", 0.8], ["blocked-skill", 0.7]]),
    });
    mocks.getItemsByIds.mockReturnValue({
      items: [
        { skillId: "weather", name: "weather", tier: "A", cnBlocked: false },
        { skillId: "code-review", name: "code-review", tier: "B", cnBlocked: false },
        { skillId: "blocked-skill", name: "blocked-skill", tier: "A", cnBlocked: true },
      ],
      total: 3,
      page: 1,
      pageSize: 3,
      totalPages: 1,
    });

    const opts = makeOpts({ keyword: "代码", tier: "A", cnBlocked: false });
    await skillsMarketplaceSearch(opts);

    // Only "weather" matches tier=A + cnBlocked=false
    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ total: 1, items: [expect.objectContaining({ skillId: "weather" })] }),
    );
  });

  it("paginates hybrid results correctly", async () => {
    const ids = Array.from({ length: 5 }, (_, i) => `skill-${i}`);
    mocks.searchToolIndex.mockResolvedValue({
      ids,
      scores: new Map(ids.map((id, i) => [id, 1 - i * 0.1])),
    });
    mocks.getItemsByIds.mockReturnValue({
      items: ids.map((id) => ({ skillId: id, name: id })),
      total: 5,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    });

    // Request page 2 with pageSize 2
    const opts = makeOpts({ keyword: "测试", page: 2, pageSize: 2 });
    await skillsMarketplaceSearch(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        total: 5,
        page: 2,
        pageSize: 2,
        totalPages: 3,
        items: [
          expect.objectContaining({ skillId: "skill-2" }),
          expect.objectContaining({ skillId: "skill-3" }),
        ],
      }),
    );
  });

  it("falls back to FTS5 when hybridSearch returns empty", async () => {
    mocks.searchToolIndex.mockResolvedValue({
      ids: [],
      scores: new Map(),
    });

    const opts = makeOpts({ keyword: "天气" });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchToolIndex).toHaveBeenCalled();
    expect(mocks.getItemsByIds).not.toHaveBeenCalled();
    expect(mocks.searchItems).toHaveBeenCalled();
  });

  it("falls back to FTS5 when searchToolIndex throws", async () => {
    mocks.searchToolIndex.mockRejectedValue(new Error("index unavailable"));

    const opts = makeOpts({ keyword: "天气" });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchItems).toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ total: 1 }));
  });

  // ── Filter passthrough (FTS5 path) ──

  it("passes keyword and category to searchItems (FTS5 path)", async () => {
    // Keyword < 2 chars → direct FTS5
    const opts = makeOpts({ keyword: "笔", category: "生产力工具" });
    await skillsMarketplaceSearch(opts);

    expect(mocks.searchItems).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: "笔",
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

  // ── Input validation ──

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
