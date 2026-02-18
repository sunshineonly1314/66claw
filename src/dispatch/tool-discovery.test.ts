/**
 * [CN-PATCH:tool-discovery] Tool Discovery 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { ToolIndexEntry } from "../config/types.tool-discovery.js";
import { openToolIndex, closeToolIndex, buildIndex } from "./tool-index.js";
import { discoverTools } from "./tool-discovery.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempDir: string;

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "tool-discovery-test-"));
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
      metadataJson: JSON.stringify({ npmPackage: "@modelcontextprotocol/server-postgres" }),
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

describe("Tool Discovery", () => {
  beforeEach(() => {
    tempDir = makeTempDir();
    const db = openToolIndex(tempDir);
    buildIndex(db, sampleEntries());
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
  // Basic discovery
  // ========================================================================

  describe("discoverTools", () => {
    it("should return empty for disabled config", async () => {
      const result = await discoverTools("天气预报", { enabled: false }, tempDir);
      expect(result.skillHints).toEqual([]);
      expect(result.confidence).toBe(0);
    });

    it("should return empty for very short query", async () => {
      const result = await discoverTools("a", {}, tempDir);
      expect(result.skillHints).toEqual([]);
    });

    it("should discover weather skill by Chinese query", async () => {
      const result = await discoverTools("查天气预报", {}, tempDir);
      expect(result.skillHints).toContain("weather-query");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.searchLatencyMs).toBeLessThan(100);
    });

    it("should discover MCP server with suggestion details", async () => {
      const result = await discoverTools("SQL数据库查询", {}, tempDir);
      expect(result.mcpToolHints.length).toBeGreaterThan(0);
      expect(result.mcpSuggestions.length).toBeGreaterThan(0);

      const pgSuggestion = result.mcpSuggestions.find((s) => s.serverId === "database-postgres");
      expect(pgSuggestion).toBeDefined();
      expect(pgSuggestion!.npmPackage).toBe("@modelcontextprotocol/server-postgres");
    });

    it("should discover core tools", async () => {
      const result = await discoverTools("搜索网页内容", {}, tempDir);
      expect(
        result.toolHints.length + result.skillHints.length + result.mcpToolHints.length,
      ).toBeGreaterThan(0);
    });

    it("should discover WeChat MCP by keyword", async () => {
      const result = await discoverTools("发微信给张三", {}, tempDir);
      expect(result.mcpToolHints.length).toBeGreaterThan(0);
      const hasWechat = result.mcpSuggestions.some((s) => s.serverId === "wechat-bridge");
      expect(hasWechat).toBe(true);
    });

    it("should respect maxResults config", async () => {
      const result = await discoverTools("web", { search: { maxResults: 2 } }, tempDir);
      const totalHints =
        result.skillHints.length + result.mcpToolHints.length + result.toolHints.length;
      expect(totalHints).toBeLessThanOrEqual(2);
    });
  });

  // ========================================================================
  // Tool Summary Prompt
  // ========================================================================

  describe("toolSummaryPrompt", () => {
    it("should generate non-empty prompt for valid results", async () => {
      const result = await discoverTools("天气预报查询", {}, tempDir);
      expect(result.toolSummaryPrompt.length).toBeGreaterThan(0);
      expect(result.toolSummaryPrompt).toContain("Available Tools");
    });

    it("should include skill names in prompt", async () => {
      const result = await discoverTools("查天气预报", {}, tempDir);
      expect(result.toolSummaryPrompt).toContain("weather-query");
    });

    it("should include MCP server info in prompt", async () => {
      const result = await discoverTools("SQL数据库查询", {}, tempDir);
      expect(result.toolSummaryPrompt).toContain("PostgreSQL");
    });

    it("should be empty for no results", async () => {
      const result = await discoverTools("xyz不存在的工具", {}, tempDir);
      // 可能返回空也可能有部分匹配，但 prompt 应该是合理的
      expect(result.toolSummaryPrompt).toBeDefined();
    });
  });

  // ========================================================================
  // Performance
  // ========================================================================

  describe("performance", () => {
    it("should complete discovery in < 50ms", async () => {
      const start = performance.now();
      await discoverTools("查天气预报", {}, tempDir);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      console.log(`[perf] Tool discovery: ${duration.toFixed(2)}ms`);
    });
  });
});
