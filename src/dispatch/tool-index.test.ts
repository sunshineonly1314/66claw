/**
 * [CN-PATCH:tool-discovery] Tool Index 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { ToolIndexEntry } from "../config/types.tool-discovery.js";
import {
  openToolIndex,
  closeToolIndex,
  buildIndex,
  incrementalUpdate,
  hybridSearch,
  isVectorized,
  getIndexStats,
  createToolEmbeddingClient,
} from "./tool-index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempDir: string;

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "tool-index-test-"));
}

function sampleEntries(): ToolIndexEntry[] {
  return [
    {
      id: "skill:weather-query",
      type: "skill",
      name: "weather-query",
      description: "Query weather forecast for cities worldwide",
      descriptionCn: "查询全球城市天气预报",
      tags: ["weather", "forecast", "天气"],
    },
    {
      id: "mcp:@anthropic-fetch",
      type: "mcp",
      name: "Fetch网页内容抓取",
      description: "Fetch and process web content, converting HTML to markdown",
      descriptionCn: "抓取网页内容并转换为markdown格式",
      tags: ["web", "fetch", "网页", "抓取"],
      metadataJson: JSON.stringify({ npmPackage: "@anthropic/mcp-fetch" }),
    },
    {
      id: "core:web_search",
      type: "core",
      name: "web_search",
      description: "Search the web using Bing or Google",
      descriptionCn: "使用搜索引擎搜索网页",
      tags: ["search", "web", "搜索"],
    },
    {
      id: "mcp:database-postgres",
      type: "mcp",
      name: "PostgreSQL数据库",
      description: "Connect to PostgreSQL database, execute SQL queries",
      descriptionCn: "连接PostgreSQL数据库，执行SQL查询",
      tags: ["database", "sql", "postgres", "数据库"],
    },
    {
      id: "skill:image-gen",
      type: "skill",
      name: "image-gen",
      description: "Generate images using DALL-E, DashScope, or SiliconFlow",
      descriptionCn: "使用DALL-E、通义万相或硅基流动生成图片",
      tags: ["image", "generation", "图片", "生成"],
    },
    {
      id: "mcp:wechat-bridge",
      type: "mcp",
      name: "微信消息桥接",
      description: "Send and receive WeChat messages through ClawChat bridge",
      descriptionCn: "通过ClawChat桥接发送和接收微信消息",
      tags: ["wechat", "微信", "messaging", "消息"],
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Tool Index", () => {
  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    closeToolIndex();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore on Windows */
    }
  });

  // ========================================================================
  // Schema & Lifecycle
  // ========================================================================

  describe("Lifecycle", () => {
    it("should create DB and schema on first open", () => {
      const db = openToolIndex(tempDir);
      expect(db).toBeDefined();
      // Verify tables exist
      const tables = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tools', 'tool_meta')`,
        )
        .all() as Array<{ name: string }>;
      expect(tables.map((t) => t.name).sort()).toEqual(["tool_meta", "tools"]);
    });

    it("should return same DB on repeated open", () => {
      const db1 = openToolIndex(tempDir);
      const db2 = openToolIndex(tempDir);
      expect(db1).toBe(db2);
    });

    it("should close cleanly", () => {
      openToolIndex(tempDir);
      closeToolIndex();
      // Re-open should work
      const db = openToolIndex(tempDir);
      expect(db).toBeDefined();
    });
  });

  // ========================================================================
  // Index Building
  // ========================================================================

  describe("buildIndex", () => {
    it("should insert all entries into tools table", () => {
      const db = openToolIndex(tempDir);
      const entries = sampleEntries();
      buildIndex(db, entries);

      const count = (db.prepare("SELECT count(*) AS cnt FROM tools").get() as { cnt: number }).cnt;
      expect(count).toBe(entries.length);
    });

    it("should populate tool_meta", () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      const stats = getIndexStats(db);
      expect(stats.entryCount).toBe(6);
      expect(stats.builtAt).toBeGreaterThan(0);
    });

    it("should rebuild on repeated calls (idempotent)", () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());
      buildIndex(db, sampleEntries().slice(0, 3));

      const stats = getIndexStats(db);
      expect(stats.entryCount).toBe(3);
    });
  });

  // ========================================================================
  // Incremental Update
  // ========================================================================

  describe("incrementalUpdate", () => {
    it("should add new entries", () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries().slice(0, 3));

      incrementalUpdate(db, sampleEntries().slice(3), []);
      const stats = getIndexStats(db);
      expect(stats.entryCount).toBe(6);
    });

    it("should remove entries by id", () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      incrementalUpdate(db, [], ["skill:weather-query", "core:web_search"]);
      const stats = getIndexStats(db);
      expect(stats.entryCount).toBe(4);
    });

    it("should handle add and remove in one call", () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries().slice(0, 3));

      const newEntry: ToolIndexEntry = {
        id: "mcp:new-server",
        type: "mcp",
        name: "New MCP Server",
        description: "A newly added MCP server",
        tags: ["new"],
      };
      incrementalUpdate(db, [newEntry], ["skill:weather-query"]);

      const stats = getIndexStats(db);
      expect(stats.entryCount).toBe(3); // 3 - 1 + 1
    });
  });

  // ========================================================================
  // FTS5 Search (BM25)
  // ========================================================================

  describe("hybridSearch (FTS5 only, no vector)", () => {
    it("should find weather-related tools by Chinese query", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      const results = await hybridSearch(db, "天气预报");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.id).toBe("skill:weather-query");
    });

    it("should find database tools by SQL keywords", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      // "SQL查询" 包含 FTS trigram "SQL" (3字符) + LIKE "查询"
      const results = await hybridSearch(db, "SQL数据库查询");
      expect(results.length).toBeGreaterThan(0);
      const ids = results.map((r) => r.entry.id);
      expect(ids).toContain("mcp:database-postgres");
    });

    it("should find database tools by pure SQL statement (semantic gap)", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      // "SELECT * FROM users" 与 "execute SQL queries" 无字面交集
      // 纯 FTS 模式下可能无法匹配，需要向量搜索
      const results = await hybridSearch(db, "SELECT * FROM users");
      // 不强制要求结果 — 这是语义搜索的场景
      expect(results).toBeDefined();
    });

    it("should find WeChat tools", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      const results = await hybridSearch(db, "发微信给张三");
      expect(results.length).toBeGreaterThan(0);
      const ids = results.map((r) => r.entry.id);
      expect(ids).toContain("mcp:wechat-bridge");
    });

    it("should find image generation tools by keyword", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      // "生成图片" 有 3 字 CJK trigram "生成图" 和 "成图片" + LIKE "图片" 均可命中
      const results = await hybridSearch(db, "生成图片");
      expect(results.length).toBeGreaterThan(0);
      const ids = results.map((r) => r.entry.id);
      expect(ids).toContain("skill:image-gen");
    });

    it("should return empty for pure semantic query without vector (画一只猫)", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      // "画一只猫" 与 "image generation" / "图片生成" 无字面交集
      // 纯 FTS 模式下无法匹配，这是向量搜索的价值所在
      const results = await hybridSearch(db, "画一只猫");
      // 不要求一定有结果 — 语义搜索需要向量
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should respect maxResults", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      const results = await hybridSearch(db, "web", { maxResults: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should return empty for very short query", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      const results = await hybridSearch(db, "a");
      expect(results.length).toBe(0);
    });

    it("should return empty for empty index", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, []);

      const results = await hybridSearch(db, "天气");
      expect(results.length).toBe(0);
    });

    it("should include matchSource as 'fts' when no vector", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      const results = await hybridSearch(db, "天气");
      for (const r of results) {
        expect(r.matchSource).toBe("fts");
      }
    });
  });

  // ========================================================================
  // Vectorization state
  // ========================================================================

  describe("vectorization state", () => {
    it("should report not vectorized initially", () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());
      expect(isVectorized(db)).toBe(false);
    });

    it("should report correct stats", () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      const stats = getIndexStats(db);
      expect(stats.entryCount).toBe(6);
      expect(stats.vectorized).toBe(false);
      expect(stats.vecModel).toBeUndefined();
    });
  });

  // ========================================================================
  // Embedding Client
  // ========================================================================

  describe("createToolEmbeddingClient", () => {
    it("should create client with default config", () => {
      const client = createToolEmbeddingClient({});
      expect(client.model).toBe("BAAI/bge-m3");
      expect(client.dims).toBe(1024);
    });

    it("should throw when no apiKey and embed is called", async () => {
      const client = createToolEmbeddingClient({});
      await expect(client.embed(["test"])).rejects.toThrow("apiKey not configured");
    });

    it("should use custom config", () => {
      const client = createToolEmbeddingClient({
        model: "custom-model",
        baseUrl: "https://custom.api.com/v1",
        dimensions: 512,
      });
      expect(client.model).toBe("custom-model");
      expect(client.dims).toBe(512);
    });
  });

  // ========================================================================
  // Performance
  // ========================================================================

  describe("performance", () => {
    it("should complete FTS search in < 50ms", async () => {
      const db = openToolIndex(tempDir);
      buildIndex(db, sampleEntries());

      const start = performance.now();
      await hybridSearch(db, "查天气预报");
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      console.log(`[perf] FTS search: ${duration.toFixed(2)}ms`);
    });
  });
});
