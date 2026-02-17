/**
 * Typing 通知模块单元测试
 * Typing Notification Unit Tests
 *
 * 测试覆盖:
 * - 正常发送 typing 通知
 * - apiKey URL 编码
 * - 错误处理（不抛出）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();

import { notifyTyping } from "./typing.js";
import { BRIDGE_URL } from "./constants.js";

describe("notifyTyping", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("发送 start 状态", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await notifyTyping("test-key", "start");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(`${BRIDGE_URL}/bottest-key/typing`);
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body.status).toBe("start");
  });

  it("发送 stop 状态", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await notifyTyping("test-key", "stop");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.status).toBe("stop");
  });

  it("apiKey 中的冒号被正确编码", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await notifyTyping("key:with:colons", "start");

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("key%3Awith%3Acolons");
  });

  it("HTTP 错误时记录日志但不抛出", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Server Error",
    });

    const mockLog = { info: vi.fn(), error: vi.fn() };

    // 不应该抛出
    await expect(
      notifyTyping("key", "start", mockLog),
    ).resolves.toBeUndefined();

    expect(mockLog.error).toHaveBeenCalledWith(
      expect.stringContaining("typing notify failed"),
    );
  });

  it("网络错误时记录日志但不抛出", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const mockLog = { info: vi.fn(), error: vi.fn() };

    await expect(
      notifyTyping("key", "start", mockLog),
    ).resolves.toBeUndefined();

    expect(mockLog.error).toHaveBeenCalledWith(
      expect.stringContaining("typing notify failed"),
    );
  });
});
