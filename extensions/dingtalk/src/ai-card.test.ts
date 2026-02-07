/**
 * 钉钉 AI Card 流式响应模块测试
 * DingTalk AI Card Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AICardStatus } from "./types.js";

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock api.ts 的 getDingtalkAccessToken
vi.mock("./api.js", () => ({
  getDingtalkAccessToken: vi.fn().mockResolvedValue("mock_access_token"),
}));

describe("ai-card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("AICardStatus constants", () => {
    it("定义了正确的状态值", () => {
      expect(AICardStatus.PROCESSING).toBe("1");
      expect(AICardStatus.INPUTING).toBe("2");
      expect(AICardStatus.FINISHED).toBe("3");
      expect(AICardStatus.EXECUTING).toBe("4");
      expect(AICardStatus.FAILED).toBe("5");
    });
  });

  describe("createAICard", () => {
    it("缺少 appKey 时返回 null", async () => {
      const { createAICard } = await import("./ai-card.js");
      const mockLog = { info: vi.fn(), error: vi.fn() };

      const result = await createAICard(
        { app: { appKey: "", appSecret: "secret" } },
        { conversationType: "1", conversationId: "conv1", senderId: "user1" },
        mockLog,
      );

      expect(result).toBeNull();
      expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining("缺少 appKey"));
    });

    it("缺少 appSecret 时返回 null", async () => {
      const { createAICard } = await import("./ai-card.js");
      const mockLog = { info: vi.fn(), error: vi.fn() };

      const result = await createAICard(
        { app: { appKey: "key", appSecret: "" } },
        { conversationType: "1", conversationId: "conv1", senderId: "user1" },
        mockLog,
      );

      expect(result).toBeNull();
    });

    it("成功创建卡片实例 (单聊)", async () => {
      const { createAICard } = await import("./ai-card.js");
      const mockLog = { info: vi.fn(), error: vi.fn() };

      // Mock 成功响应
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const result = await createAICard(
        { app: { appKey: "test_key", appSecret: "test_secret" } },
        { conversationType: "1", conversationId: "conv1", senderId: "user1" },
        mockLog,
      );

      expect(result).not.toBeNull();
      expect(result?.cardInstanceId).toMatch(/^card_\d+_[a-z0-9]+$/);
      expect(result?.accessToken).toBe("mock_access_token");
      expect(result?.inputingStarted).toBe(false);
    });

    it("成功创建卡片实例 (群聊)", async () => {
      const { createAICard } = await import("./ai-card.js");
      const mockLog = { info: vi.fn(), error: vi.fn() };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const result = await createAICard(
        { app: { appKey: "test_key", appSecret: "test_secret" } },
        { conversationType: "2", conversationId: "group1", senderId: "user1" },
        mockLog,
      );

      expect(result).not.toBeNull();

      // 验证群聊的 deliver 请求包含正确的 openSpaceId
      const deliverCall = mockFetch.mock.calls[1];
      const deliverBody = JSON.parse(deliverCall[1].body);
      expect(deliverBody.openSpaceId).toContain("IM_GROUP");
    });

    it("创建卡片 API 失败时返回 null", async () => {
      const { createAICard } = await import("./ai-card.js");
      const mockLog = { info: vi.fn(), error: vi.fn() };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const result = await createAICard(
        { app: { appKey: "test_key", appSecret: "test_secret" } },
        { conversationType: "1", conversationId: "conv1", senderId: "user1" },
        mockLog,
      );

      expect(result).toBeNull();
      expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining("创建卡片失败"));
    });
  });

  describe("streamAICard", () => {
    it("首次调用时切换到 INPUTING 状态", async () => {
      const { streamAICard } = await import("./ai-card.js");
      const mockLog = { info: vi.fn(), error: vi.fn() };

      // Mock INPUTING 和 streaming 响应
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true });

      const card = {
        cardInstanceId: "test_card",
        accessToken: "test_token",
        inputingStarted: false,
      };

      await streamAICard(card, "Hello", false, mockLog);

      expect(card.inputingStarted).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // 验证第一个请求是 INPUTING 状态切换
      const inputingCall = mockFetch.mock.calls[0];
      expect(inputingCall[0]).toContain("/card/instances");
      const inputingBody = JSON.parse(inputingCall[1].body);
      expect(inputingBody.cardData.cardParamMap.flowStatus).toBe(AICardStatus.INPUTING);
    });

    it("后续调用跳过 INPUTING 切换", async () => {
      const { streamAICard } = await import("./ai-card.js");
      const mockLog = { info: vi.fn(), error: vi.fn() };

      mockFetch.mockResolvedValueOnce({ ok: true });

      const card = {
        cardInstanceId: "test_card",
        accessToken: "test_token",
        inputingStarted: true, // 已经开始
      };

      await streamAICard(card, "World", false, mockLog);

      // 只调用一次 (streaming API)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const streamCall = mockFetch.mock.calls[0];
      expect(streamCall[0]).toContain("/card/streaming");
    });

    it("使用 isFull=true 全量替换", async () => {
      const { streamAICard } = await import("./ai-card.js");

      mockFetch.mockResolvedValueOnce({ ok: true });

      const card = {
        cardInstanceId: "test_card",
        accessToken: "test_token",
        inputingStarted: true,
      };

      await streamAICard(card, "Test content", false);

      const streamBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(streamBody.isFull).toBe(true);
      expect(streamBody.content).toBe("Test content");
      expect(streamBody.isFinalize).toBe(false);
    });
  });

  describe("finishAICard", () => {
    it("先关闭流式通道再更新 FINISHED 状态", async () => {
      const { finishAICard } = await import("./ai-card.js");
      const mockLog = { info: vi.fn(), error: vi.fn() };

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // streaming (isFinalize=true)
        .mockResolvedValueOnce({ ok: true }); // FINISHED 状态

      const card = {
        cardInstanceId: "test_card",
        accessToken: "test_token",
        inputingStarted: true,
      };

      await finishAICard(card, "Final content", mockLog);

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // 验证第一个请求是 streaming 关闭
      const streamCall = mockFetch.mock.calls[0];
      const streamBody = JSON.parse(streamCall[1].body);
      expect(streamBody.isFinalize).toBe(true);

      // 验证第二个请求是 FINISHED 状态
      const finishCall = mockFetch.mock.calls[1];
      const finishBody = JSON.parse(finishCall[1].body);
      expect(finishBody.cardData.cardParamMap.flowStatus).toBe(AICardStatus.FINISHED);
      expect(finishBody.cardData.cardParamMap.msgContent).toBe("Final content");
    });
  });
});
