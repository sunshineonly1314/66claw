/**
 * 钉钉 Stream 客户端模块测试
 * DingTalk Stream Client Tests
 *
 * 测试 extractMessageContent (async) 的各类消息处理
 * 由于 extractMessageContent 是内部函数，通过 handleStreamMessage 间接测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DingtalkRobotMessageEvent, DingtalkChannelConfig } from "./types.js";

// Mock dingtalk-stream SDK
vi.mock("dingtalk-stream", () => ({
  DWClient: vi.fn(),
  TOPIC_ROBOT: "TOPIC_ROBOT",
}));

// Mock ai-card
vi.mock("./ai-card.js", () => ({
  createAICard: vi.fn().mockResolvedValue(null),
  finishAICard: vi.fn(),
  streamAICard: vi.fn(),
}));

// Mock api
vi.mock("./api.js", () => ({
  sendDingtalkMessageViaWebhook: vi.fn().mockResolvedValue(undefined),
  getDingtalkAccessToken: vi.fn().mockResolvedValue("mock_token"),
}));

// Mock media-archival
vi.mock("./media-archival.js", () => ({
  archiveInboundMedia: vi.fn().mockResolvedValue(undefined),
  startArchivalCleanup: vi.fn().mockReturnValue({ stop: vi.fn() }),
}));

// Mock media-download
const mockDownloadDingTalkFile = vi.fn();
const mockDownloadRichTextImages = vi.fn();
const mockExtractMediaFromMessage = vi.fn();
const mockExtractRichTextImageCodes = vi.fn();

vi.mock("./media-download.js", () => ({
  downloadDingTalkFile: (...args: unknown[]) => mockDownloadDingTalkFile(...args),
  downloadRichTextImages: (...args: unknown[]) => mockDownloadRichTextImages(...args),
  extractMediaFromMessage: (...args: unknown[]) => mockExtractMediaFromMessage(...args),
  extractRichTextImageCodes: (...args: unknown[]) => mockExtractRichTextImageCodes(...args),
}));

// Mock media-upload
vi.mock("./media-upload.js", () => ({
  buildMediaSystemPrompt: vi.fn().mockReturnValue("media prompt"),
  getOapiAccessToken: vi.fn().mockResolvedValue(null),
  processLocalImages: vi.fn().mockImplementation((content: string) => Promise.resolve(content)),
}));

// Mock runtime
vi.mock("./runtime.js", () => ({
  getDingtalkRuntime: vi.fn().mockReturnValue({
    channel: {
      text: {
        convertMarkdownTables: vi.fn().mockImplementation((text: string) => text),
      },
    },
  }),
}));

// Mock scheduler
vi.mock("./scheduler.js", () => ({
  startScheduler: vi.fn().mockReturnValue({ stop: vi.fn() }),
}));

// Mock session-manager
vi.mock("./session-manager.js", () => ({
  DEFAULT_SESSION_TIMEOUT: 30 * 60 * 1000,
  getSessionKey: vi.fn().mockReturnValue({ sessionKey: "dingtalk:user1", isNew: false }),
  isNewSessionCommand: vi.fn().mockReturnValue(false),
}));

// Mock fetch for Gateway streaming
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("stream-client", () => {
  const mockLog = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractMediaFromMessage.mockReturnValue([]);
    mockExtractRichTextImageCodes.mockReturnValue([]);
    mockDownloadDingTalkFile.mockResolvedValue(null);
    mockDownloadRichTextImages.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractMessageContent (via handleStreamMessage)", () => {
    /**
     * Helper: 调用 handleStreamMessage 并捕获发送到 webhook 的消息内容
     */
    async function processMessage(
      event: DingtalkRobotMessageEvent,
      config: Partial<DingtalkChannelConfig> = {},
    ): Promise<string | null> {
      const { handleStreamMessage } = await import("./stream-client.js");
      const { sendDingtalkMessageViaWebhook } = await import("./api.js");

      // 构造一个可读的 SSE 响应，模拟 Gateway
      const sseContent = `data: {"choices":[{"delta":{"content":"AI回复"}}]}\n\ndata: [DONE]\n\n`;
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseContent));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body,
      });

      const fullConfig: DingtalkChannelConfig = {
        app: { appKey: "key", appSecret: "secret" },
        ...config,
      };

      await handleStreamMessage({
        cfg: {},
        accountId: "test",
        data: event,
        sessionWebhook: "https://webhook.dingtalk.com/test",
        log: mockLog,
        dingtalkConfig: fullConfig,
        gatewayPort: 18789,
      });

      const mock = sendDingtalkMessageViaWebhook as ReturnType<typeof vi.fn>;
      if (mock.mock.calls.length > 0) {
        return mock.mock.calls[0][1]?.text?.content ?? null;
      }
      return null;
    }

    it("文本消息正常提取内容", async () => {
      const event: DingtalkRobotMessageEvent = {
        msgId: "msg1",
        msgtype: "text",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        text: { content: "你好" },
      };

      await processMessage(event);

      // 验证 Gateway 被调用且消息被正确传递
      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "你好" }),
        ]),
      );
    });

    it("图片消息 - 下载关闭时返回占位符", async () => {
      const event: DingtalkRobotMessageEvent = {
        msgId: "msg2",
        msgtype: "picture",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        picture: { downloadCode: "pic_code" },
      };

      await processMessage(event, { media: { enableDownload: false } });

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
      expect(userMsg.content).toBe("[图片]");
    });

    it("图片消息 - 下载成功返回文件路径", async () => {
      mockExtractMediaFromMessage.mockReturnValue([
        { type: "picture", downloadCode: "pic_code" },
      ]);
      mockDownloadDingTalkFile.mockResolvedValue({
        filePath: "/tmp/dingtalk-media/test.jpg",
        fileSize: 12345,
        mediaType: "picture",
      });

      const event: DingtalkRobotMessageEvent = {
        msgId: "msg3",
        msgtype: "picture",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        picture: { downloadCode: "pic_code" },
      };

      await processMessage(event);

      expect(mockDownloadDingTalkFile).toHaveBeenCalledWith(
        expect.anything(),
        "pic_code",
        "picture",
        expect.anything(),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
      expect(userMsg.content).toContain("file:///tmp/dingtalk-media/test.jpg");
    });

    it("语音消息 - 带识别文本", async () => {
      const event: DingtalkRobotMessageEvent = {
        msgId: "msg4",
        msgtype: "audio",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        audio: { downloadCode: "audio_code", duration: 5000, recognition: "你好世界" },
      };

      await processMessage(event, { media: { enableDownload: false } });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
      expect(userMsg.content).toContain("识别内容: 你好世界");
    });

    it("语音消息 - 无识别文本", async () => {
      const event: DingtalkRobotMessageEvent = {
        msgId: "msg5",
        msgtype: "audio",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        audio: { downloadCode: "audio_code", duration: 3000 },
      };

      await processMessage(event, { media: { enableDownload: false } });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
      expect(userMsg.content).toBe("[语音消息]");
    });

    it("视频消息 - 下载关闭", async () => {
      const event: DingtalkRobotMessageEvent = {
        msgId: "msg6",
        msgtype: "video",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        video: { downloadCode: "vid_code", duration: 10000 },
      };

      await processMessage(event, { media: { enableDownload: false } });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
      expect(userMsg.content).toBe("[视频]");
    });

    it("文件消息 - 包含文件名", async () => {
      const event: DingtalkRobotMessageEvent = {
        msgId: "msg7",
        msgtype: "file",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        file: { downloadCode: "file_code", fileName: "report.xlsx", fileSize: 1024 },
      };

      await processMessage(event, { media: { enableDownload: false } });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
      expect(userMsg.content).toBe("[文件: report.xlsx]");
    });

    it("富文本消息 - 提取文字", async () => {
      mockExtractRichTextImageCodes.mockReturnValue([]);

      const event: DingtalkRobotMessageEvent = {
        msgId: "msg8",
        msgtype: "richText",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        richText: {
          richTextList: [
            { type: "text", text: "第一段" },
            { type: "text", text: "第二段" },
          ],
        },
      };

      await processMessage(event);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
      expect(userMsg.content).toContain("第一段");
      expect(userMsg.content).toContain("第二段");
    });

    it("空消息不触发 Gateway 调用", async () => {
      const event: DingtalkRobotMessageEvent = {
        msgId: "msg9",
        msgtype: "text",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        text: { content: "" },
      };

      await processMessage(event);

      // 空消息应该直接返回，不调用 Gateway
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("未知消息类型降级为文本处理", async () => {
      const event: DingtalkRobotMessageEvent = {
        msgId: "msg10",
        msgtype: "location" as string,
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
      };

      await processMessage(event);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
      expect(userMsg.content).toContain("[location消息]");
    });
  });

  describe("calculateBackoff", () => {
    // calculateBackoff 是内部函数，通过观察行为间接测试
    // 它被 circuit breaker 使用，退避时间应在 [1s, 60s] 范围内

    it("可从 stream-client 模块正常导入", async () => {
      // 验证模块本身可以成功加载
      const mod = await import("./stream-client.js");
      expect(mod.handleStreamMessage).toBeDefined();
      expect(mod.createStreamClient).toBeDefined();
    });
  });
});
