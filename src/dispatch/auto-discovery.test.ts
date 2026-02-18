import { describe, it, expect } from "vitest";
import { autoDiscover } from "./auto-discovery.js";

describe("Auto-Discovery", () => {
  it("should discover weather-related skills", async () => {
    const result = await autoDiscover("帮我查一下北京天气");

    expect(result.skillHints.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    console.log("[weather] skillHints:", result.skillHints);
    console.log("[weather] mcpToolHints:", result.mcpToolHints);
    console.log("[weather] toolHints:", result.toolHints);
    console.log("[weather] matchDetails:", result.matchDetails);
  });

  it("should discover wechat-related skills and tools", async () => {
    const result = await autoDiscover("发微信给张三");

    expect(result.toolHints).toContain("wechat_send");
    console.log("[wechat] skillHints:", result.skillHints);
    console.log("[wechat] toolHints:", result.toolHints);
    console.log("[wechat] matchDetails:", result.matchDetails);
  });

  it("should discover image generation skills and tools", async () => {
    const result = await autoDiscover("画一只猫");

    expect(result.toolHints).toContain("image_gen");
    console.log("[image] skillHints:", result.skillHints);
    console.log("[image] mcpToolHints:", result.mcpToolHints);
    console.log("[image] toolHints:", result.toolHints);
    console.log("[image] matchDetails:", result.matchDetails);
  });

  it("should discover database-related skills and MCP", async () => {
    const result = await autoDiscover("SELECT * FROM users WHERE age > 25");

    expect(result.skillHints.length).toBeGreaterThan(0);
    console.log("[database] skillHints:", result.skillHints);
    console.log("[database] mcpToolHints:", result.mcpToolHints);
    console.log("[database] matchDetails:", result.matchDetails);
  });

  it("should discover web search tools", async () => {
    const result = await autoDiscover("搜索一下最新的AI新闻");

    expect(result.toolHints).toContain("web_search");
    console.log("[search] toolHints:", result.toolHints);
    console.log("[search] matchDetails:", result.matchDetails);
  });

  it("should discover desktop control tools", async () => {
    const result = await autoDiscover("帮我打开Chrome浏览器");

    expect(result.toolHints).toContain("open_app");
    console.log("[desktop] toolHints:", result.toolHints);
    console.log("[desktop] matchDetails:", result.matchDetails);
  });

  it("should return low confidence for unrelated queries", async () => {
    const result = await autoDiscover("今天天气真好啊");

    // Should still try to find something, but with lower confidence
    console.log("[generic] skillHints:", result.skillHints);
    console.log("[generic] confidence:", result.confidence);
    console.log("[generic] matchDetails:", result.matchDetails);
  });

  it("should complete in < 100ms", async () => {
    const start = performance.now();
    await autoDiscover("帮我查一下北京天气");
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // < 100ms 目标
    console.log(`[performance] Auto-discovery completed in ${duration.toFixed(2)}ms`);
  });
});
