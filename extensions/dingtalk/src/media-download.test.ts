/**
 * 钉钉媒体下载模块测试
 * DingTalk Media Download Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DingtalkRobotMessageEvent } from "./types.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock fs
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(() => ({
      write: vi.fn(),
      end: vi.fn((cb?: () => void) => cb?.()),
      destroy: vi.fn(),
      on: vi.fn(),
    })),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ mtimeMs: Date.now() }),
  },
}));

// Mock crypto
vi.mock("node:crypto", () => ({
  default: {
    randomUUID: vi.fn().mockReturnValue("test-uuid-1234"),
  },
}));

// Mock api.ts
vi.mock("./api.js", () => ({
  getDingtalkAccessToken: vi.fn().mockResolvedValue("mock_token"),
}));

describe("media-download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractMediaFromMessage", () => {
    it("提取图片消息的 downloadCode", async () => {
      const { extractMediaFromMessage } = await import("./media-download.js");

      const data: DingtalkRobotMessageEvent = {
        msgId: "msg1",
        msgtype: "picture",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        picture: { downloadCode: "pic_code_123" },
      };

      const media = extractMediaFromMessage(data);
      expect(media).toHaveLength(1);
      expect(media[0].type).toBe("picture");
      expect(media[0].downloadCode).toBe("pic_code_123");
    });

    it("提取语音消息的 downloadCode 和 duration", async () => {
      const { extractMediaFromMessage } = await import("./media-download.js");

      const data: DingtalkRobotMessageEvent = {
        msgId: "msg2",
        msgtype: "audio",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        audio: { downloadCode: "audio_code_456", duration: 5000 },
      };

      const media = extractMediaFromMessage(data);
      expect(media).toHaveLength(1);
      expect(media[0].type).toBe("audio");
      expect(media[0].downloadCode).toBe("audio_code_456");
      expect(media[0].duration).toBe(5000);
    });

    it("提取视频消息的 downloadCode", async () => {
      const { extractMediaFromMessage } = await import("./media-download.js");

      const data: DingtalkRobotMessageEvent = {
        msgId: "msg3",
        msgtype: "video",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        video: { downloadCode: "video_code_789", duration: 30000 },
      };

      const media = extractMediaFromMessage(data);
      expect(media).toHaveLength(1);
      expect(media[0].type).toBe("video");
      expect(media[0].downloadCode).toBe("video_code_789");
    });

    it("提取文件消息的 downloadCode 和 fileName", async () => {
      const { extractMediaFromMessage } = await import("./media-download.js");

      const data: DingtalkRobotMessageEvent = {
        msgId: "msg4",
        msgtype: "file",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        file: { downloadCode: "file_code_abc", fileName: "report.xlsx", fileSize: 102400 },
      };

      const media = extractMediaFromMessage(data);
      expect(media).toHaveLength(1);
      expect(media[0].type).toBe("file");
      expect(media[0].downloadCode).toBe("file_code_abc");
      expect(media[0].fileName).toBe("report.xlsx");
      expect(media[0].fileSize).toBe(102400);
    });

    it("文本消息不返回媒体", async () => {
      const { extractMediaFromMessage } = await import("./media-download.js");

      const data: DingtalkRobotMessageEvent = {
        msgId: "msg5",
        msgtype: "text",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        text: { content: "Hello" },
      };

      const media = extractMediaFromMessage(data);
      expect(media).toHaveLength(0);
    });
  });

  describe("extractRichTextImageCodes", () => {
    it("从富文本中提取图片 downloadCode", async () => {
      const { extractRichTextImageCodes } = await import("./media-download.js");

      const data: DingtalkRobotMessageEvent = {
        msgId: "msg6",
        msgtype: "richText",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        richText: {
          richTextList: [
            { type: "text", text: "看看这张图" },
            { type: "picture", pictureDownloadCode: "rich_pic_1" },
            { type: "text", text: "还有这张" },
            { type: "picture", downloadCode: "rich_pic_2" },
          ],
        },
      };

      const codes = extractRichTextImageCodes(data);
      expect(codes).toEqual(["rich_pic_1", "rich_pic_2"]);
    });

    it("非富文本消息返回空数组", async () => {
      const { extractRichTextImageCodes } = await import("./media-download.js");

      const data: DingtalkRobotMessageEvent = {
        msgId: "msg7",
        msgtype: "text",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        text: { content: "hello" },
      };

      const codes = extractRichTextImageCodes(data);
      expect(codes).toEqual([]);
    });

    it("没有图片的富文本返回空数组", async () => {
      const { extractRichTextImageCodes } = await import("./media-download.js");

      const data: DingtalkRobotMessageEvent = {
        msgId: "msg8",
        msgtype: "richText",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        richText: {
          richTextList: [
            { type: "text", text: "纯文本内容" },
          ],
        },
      };

      const codes = extractRichTextImageCodes(data);
      expect(codes).toEqual([]);
    });
  });

  describe("getDownloadUrl", () => {
    it("成功获取下载 URL", async () => {
      const { getDownloadUrl } = await import("./media-download.js");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ downloadUrl: "https://download.dingtalk.com/file123" }),
      });

      const url = await getDownloadUrl("code123", "robot1", "token1");
      expect(url).toBe("https://download.dingtalk.com/file123");

      // 验证请求格式
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.dingtalk.com/v1.0/robot/messageFiles/download",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-acs-dingtalk-access-token": "token1",
          }),
        }),
      );
    });

    it("API 返回错误时抛出异常", async () => {
      const { getDownloadUrl } = await import("./media-download.js");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      await expect(getDownloadUrl("code123", "robot1", "token1")).rejects.toThrow(
        "获取下载 URL 失败",
      );
    });

    it("API 返回无 downloadUrl 时抛出异常", async () => {
      const { getDownloadUrl } = await import("./media-download.js");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await expect(getDownloadUrl("bad_code", "robot1", "token1")).rejects.toThrow(
        "无 downloadUrl",
      );
    });
  });

  describe("downloadDingTalkFile", () => {
    it("缺少 appKey 时返回 null", async () => {
      const { downloadDingTalkFile } = await import("./media-download.js");
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const result = await downloadDingTalkFile(
        { app: { appKey: "", appSecret: "secret" } },
        "code123",
        "picture",
        { log: mockLog },
      );

      expect(result).toBeNull();
      expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining("appKey/appSecret"));
    });

    it("缺少 robotCode 时返回 null", async () => {
      const { downloadDingTalkFile } = await import("./media-download.js");
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const result = await downloadDingTalkFile(
        { app: { appKey: "key", appSecret: "secret" } },
        "code123",
        "picture",
        { log: mockLog },
      );

      expect(result).toBeNull();
      expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining("robotCode"));
    });
  });
});
