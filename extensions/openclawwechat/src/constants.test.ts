/**
 * 常量模块单元测试
 * Constants Module Unit Tests
 *
 * 测试覆盖:
 * - 常量值正确性
 * - BRIDGE_URL 格式
 * - DEFAULT_CONFIG 默认值
 */

import { describe, it, expect } from "vitest";
import {
  PLUGIN_VERSION,
  PLUGIN_ID,
  CHANNEL_ID,
  BRIDGE_URL,
  DEFAULT_CONFIG,
} from "./constants.js";

describe("Constants", () => {
  it("PLUGIN_ID 和 CHANNEL_ID 一致", () => {
    expect(PLUGIN_ID).toBe("openclawwechat");
    expect(CHANNEL_ID).toBe("openclawwechat");
    expect(PLUGIN_ID).toBe(CHANNEL_ID);
  });

  it("BRIDGE_URL 使用 HTTPS", () => {
    expect(BRIDGE_URL).toMatch(/^https:\/\//);
    expect(BRIDGE_URL).toBe("https://api.clawchat.mifengcdn.com");
  });

  it("BRIDGE_URL 末尾无斜杠", () => {
    expect(BRIDGE_URL).not.toMatch(/\/$/);
  });

  it("PLUGIN_VERSION 格式正确", () => {
    expect(PLUGIN_VERSION).toMatch(/^\d{4}\.\d+\.\d+$/);
  });

  it("DEFAULT_CONFIG 包含合理默认值", () => {
    expect(DEFAULT_CONFIG.pollIntervalMs).toBeGreaterThanOrEqual(1000);
    expect(DEFAULT_CONFIG.pollIntervalMs).toBeLessThanOrEqual(30000);
    expect(DEFAULT_CONFIG.sessionKey).toBe("agent:main:main");
    expect(DEFAULT_CONFIG.debug).toBe(false);
  });
});
