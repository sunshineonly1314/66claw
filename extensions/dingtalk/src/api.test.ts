/**
 * 钉钉 API 模块测试
 * DingTalk API Tests
 *
 * 测试内容：
 * - getDingtalkAccessToken: Token 获取、缓存、并发去重
 * - sendDingtalkMessage: 文本/Markdown 消息发送
 * - sendDingtalkMediaMessage: 图片/语音/视频/文件 媒体消息发送
 * - sendDingtalkMessageViaWebhook: Session Webhook 发送
 * - probeDingtalkConnection: 连接探测
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getDingtalkAccessToken,
  sendDingtalkMessage,
  sendDingtalkMediaMessage,
  sendDingtalkMessageViaWebhook,
  probeDingtalkConnection,
  clearDingtalkTokenCache,
} from "./api.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    clearDingtalkTokenCache();
  });

  describe("getDingtalkAccessToken", () => {
    it("成功获取 token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: "test_token_123", expireIn: 7200 }),
      });

      const token = await getDingtalkAccessToken("appKey", "appSecret");
      expect(token).toBe("test_token_123");
    });

    it("使用缓存的 token (不重复请求)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: "cached_token", expireIn: 7200 }),
      });

      const token1 = await getDingtalkAccessToken("appKey", "appSecret");
      const token2 = await getDingtalkAccessToken("appKey", "appSecret");

      expect(token1).toBe("cached_token");
      expect(token2).toBe("cached_token");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("获取 token 失败时抛出异常", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: "error", message: "Invalid credentials" }),
      });

      await expect(getDingtalkAccessToken("bad_key", "bad_secret")).rejects.toThrow("获取钉钉 Token 失败");
    });

    it("HTTP 错误时抛出异常", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server Error"),
      });

      await expect(getDingtalkAccessToken("key", "secret")).rejects.toThrow("HTTP 错误");
    });
  });

  describe("sendDingtalkMessage", () => {
    it("缺少 appKey 时抛出异常", async () => {
      await expect(
        sendDingtalkMessage({ app: { appKey: "", appSecret: "s" } }, ["user1"], "hello"),
      ).rejects.toThrow("AppKey 或 AppSecret 未配置");
    });

    it("缺少 robotCode 时抛出异常", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: "token", expireIn: 7200 }),
      });

      await expect(
        sendDingtalkMessage({ app: { appKey: "k", appSecret: "s" } }, ["user1"], "hello"),
      ).rejects.toThrow("RobotCode 未配置");
    });

    it("发送文本消息使用 sampleText msgKey", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ accessToken: "tok", expireIn: 7200 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ processQueryKey: "pqk_123" }),
        });

      const result = await sendDingtalkMessage(
        { app: { appKey: "k", appSecret: "s", robotCode: "rc" } },
        ["user1"],
        "Hello!",
      );

      expect(result.processQueryKey).toBe("pqk_123");
      const sendCall = mockFetch.mock.calls[1];
      const body = JSON.parse(sendCall[1].body);
      expect(body.msgKey).toBe("sampleText");
      expect(body.robotCode).toBe("rc");
      expect(body.userIds).toEqual(["user1"]);
    });

    it("发送 Markdown 消息使用 sampleMarkdown msgKey", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ accessToken: "tok", expireIn: 7200 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ processQueryKey: "pqk_md" }),
        });

      await sendDingtalkMessage(
        { app: { appKey: "k", appSecret: "s", robotCode: "rc" } },
        ["user1"],
        "**bold text**",
        { msgType: "markdown", title: "Test" },
      );

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.msgKey).toBe("sampleMarkdown");
      const param = JSON.parse(body.msgParam);
      expect(param.title).toBe("Test");
      expect(param.text).toBe("**bold text**");
    });
  });

  describe("sendDingtalkMediaMessage", () => {
    it("缺少 appKey 时抛出异常", async () => {
      await expect(
        sendDingtalkMediaMessage({ app: { appKey: "", appSecret: "s" } }, ["u1"], "image", "mid"),
      ).rejects.toThrow("AppKey 或 AppSecret 未配置");
    });

    it("缺少 robotCode 时抛出异常", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: "tok", expireIn: 7200 }),
      });

      await expect(
        sendDingtalkMediaMessage({ app: { appKey: "k", appSecret: "s" } }, ["u1"], "image", "mid"),
      ).rejects.toThrow("RobotCode 未配置");
    });

    it("发送图片消息使用 sampleImageMsg", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ accessToken: "tok", expireIn: 7200 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ processQueryKey: "pqk_img" }),
        });

      const result = await sendDingtalkMediaMessage(
        { app: { appKey: "k", appSecret: "s", robotCode: "rc" } },
        ["u1"],
        "image",
        "media_id_123",
      );

      expect(result.processQueryKey).toBe("pqk_img");
      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.msgKey).toBe("sampleImageMsg");
      const param = JSON.parse(body.msgParam);
      expect(param.photoURL).toBe("media_id_123");
    });

    it("发送语音消息使用 sampleAudio", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ accessToken: "tok", expireIn: 7200 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ processQueryKey: "pqk_audio" }),
        });

      await sendDingtalkMediaMessage(
        { app: { appKey: "k", appSecret: "s", robotCode: "rc" } },
        ["u1"],
        "audio",
        "audio_mid",
        { duration: "5000" },
      );

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.msgKey).toBe("sampleAudio");
      const param = JSON.parse(body.msgParam);
      expect(param.mediaId).toBe("audio_mid");
      expect(param.duration).toBe("5000");
    });

    it("发送视频消息使用 sampleVideo", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ accessToken: "tok", expireIn: 7200 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ processQueryKey: "pqk_video" }),
        });

      await sendDingtalkMediaMessage(
        { app: { appKey: "k", appSecret: "s", robotCode: "rc" } },
        ["u1"],
        "video",
        "video_mid",
      );

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.msgKey).toBe("sampleVideo");
      const param = JSON.parse(body.msgParam);
      expect(param.mediaId).toBe("video_mid");
      expect(param.videoType).toBe("mp4");
    });

    it("发送文件消息使用 sampleFile", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ accessToken: "tok", expireIn: 7200 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ processQueryKey: "pqk_file" }),
        });

      await sendDingtalkMediaMessage(
        { app: { appKey: "k", appSecret: "s", robotCode: "rc" } },
        ["u1"],
        "file",
        "file_mid",
        { fileName: "report.xlsx", fileType: "xlsx" },
      );

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.msgKey).toBe("sampleFile");
      const param = JSON.parse(body.msgParam);
      expect(param.mediaId).toBe("file_mid");
      expect(param.fileName).toBe("report.xlsx");
      expect(param.fileType).toBe("xlsx");
    });

    it("API 返回错误码时抛出异常", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ accessToken: "tok", expireIn: 7200 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ code: "InvalidParameter", message: "Invalid media" }),
        });

      await expect(
        sendDingtalkMediaMessage(
          { app: { appKey: "k", appSecret: "s", robotCode: "rc" } },
          ["u1"],
          "image",
          "bad_mid",
        ),
      ).rejects.toThrow("Invalid media");
    });
  });

  describe("sendDingtalkMessageViaWebhook", () => {
    it("成功发送消息", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendDingtalkMessageViaWebhook("https://webhook.example.com/hook", {
        msgtype: "text",
        text: { content: "test" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://webhook.example.com/hook",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("HTTP 4xx 不重试直接抛出", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
      });

      await expect(
        sendDingtalkMessageViaWebhook("https://webhook.example.com/hook", {
          msgtype: "text",
          text: { content: "test" },
        }),
      ).rejects.toThrow("发送钉钉消息失败: 400");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("probeDingtalkConnection", () => {
    it("未配置凭证时返回错误", async () => {
      const result = await probeDingtalkConnection({});
      expect(result.ok).toBe(false);
      expect(result.error).toContain("未配置");
    });

    it("token 获取成功时返回 ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: "tok", expireIn: 7200 }),
      });

      const result = await probeDingtalkConnection({
        app: { appKey: "k", appSecret: "s", robotCode: "rc" },
      });

      expect(result.ok).toBe(true);
      expect(result.appKey).toBe("k");
      expect(result.robotCode).toBe("rc");
    });
  });
});
