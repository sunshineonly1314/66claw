/**
 * 钉钉 Webhook 处理增强测试
 * DingTalk Webhook Handler Enhancement Tests
 *
 * 主要测试 handleRobotMessage 对非文本消息类型的增强处理
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDingtalkWebhookHandler } from "./webhook.js";
import type { DingtalkRobotMessageEvent } from "./types.js";

describe("webhook", () => {
  describe("handleRobotMessage (非文本消息增强)", () => {
    const createMockReq = (body: DingtalkRobotMessageEvent) => {
      const data = JSON.stringify(body);
      const chunks = [Buffer.from(data)];
      let dataHandler: ((chunk: Buffer) => void) | null = null;
      let endHandler: (() => void) | null = null;

      return {
        method: "POST",
        headers: {},
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === "data") dataHandler = handler as (chunk: Buffer) => void;
          if (event === "end") endHandler = handler as () => void;
          if (event === "error") { /* noop */ }
        }),
        destroy: vi.fn(),
        // 在 handler 被调用后触发数据
        emit: () => {
          for (const chunk of chunks) dataHandler?.(chunk);
          endHandler?.();
        },
      };
    };

    const createMockRes = () => ({
      statusCode: 0,
      writableEnded: false,
      setHeader: vi.fn(),
      end: vi.fn(function (this: { writableEnded: boolean }) {
        this.writableEnded = true;
      }),
    });

    it("语音消息提取识别文本", async () => {
      const receivedMessages: Array<{ text: string }> = [];
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const handler = createDingtalkWebhookHandler({
        config: {},
        onMessage: async (msg) => {
          receivedMessages.push(msg);
        },
        log: mockLog,
      });

      const event: DingtalkRobotMessageEvent = {
        msgId: "msg1",
        msgtype: "audio",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        audio: { downloadCode: "audio_code", duration: 5000, recognition: "你好世界" },
      };

      const req = createMockReq(event);
      const res = createMockRes();

      // 启动 handler，然后触发数据
      const promise = handler(req as any, res as any);
      req.emit();
      await promise;

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].text).toContain("识别内容: 你好世界");
    });

    it("语音消息无识别文本时使用占位符", async () => {
      const receivedMessages: Array<{ text: string }> = [];
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const handler = createDingtalkWebhookHandler({
        config: {},
        onMessage: async (msg) => {
          receivedMessages.push(msg);
        },
        log: mockLog,
      });

      const event: DingtalkRobotMessageEvent = {
        msgId: "msg2",
        msgtype: "audio",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        audio: { downloadCode: "audio_code", duration: 3000 },
      };

      const req = createMockReq(event);
      const res = createMockRes();

      const promise = handler(req as any, res as any);
      req.emit();
      await promise;

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].text).toBe("[语音消息]");
    });

    it("图片消息返回占位文本", async () => {
      const receivedMessages: Array<{ text: string }> = [];
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const handler = createDingtalkWebhookHandler({
        config: {},
        onMessage: async (msg) => {
          receivedMessages.push(msg);
        },
        log: mockLog,
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

      const req = createMockReq(event);
      const res = createMockRes();

      const promise = handler(req as any, res as any);
      req.emit();
      await promise;

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].text).toBe("[图片]");
    });

    it("视频消息返回占位文本", async () => {
      const receivedMessages: Array<{ text: string }> = [];
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const handler = createDingtalkWebhookHandler({
        config: {},
        onMessage: async (msg) => {
          receivedMessages.push(msg);
        },
        log: mockLog,
      });

      const event: DingtalkRobotMessageEvent = {
        msgId: "msg4",
        msgtype: "video",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        video: { downloadCode: "vid_code", duration: 10000 },
      };

      const req = createMockReq(event);
      const res = createMockRes();

      const promise = handler(req as any, res as any);
      req.emit();
      await promise;

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].text).toBe("[视频]");
    });

    it("文件消息包含文件名", async () => {
      const receivedMessages: Array<{ text: string }> = [];
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const handler = createDingtalkWebhookHandler({
        config: {},
        onMessage: async (msg) => {
          receivedMessages.push(msg);
        },
        log: mockLog,
      });

      const event: DingtalkRobotMessageEvent = {
        msgId: "msg5",
        msgtype: "file",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        file: { downloadCode: "file_code", fileName: "report.xlsx", fileSize: 1024 },
      };

      const req = createMockReq(event);
      const res = createMockRes();

      const promise = handler(req as any, res as any);
      req.emit();
      await promise;

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].text).toBe("[文件: report.xlsx]");
    });

    it("文本消息正常处理", async () => {
      const receivedMessages: Array<{ text: string }> = [];
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const handler = createDingtalkWebhookHandler({
        config: {},
        onMessage: async (msg) => {
          receivedMessages.push(msg);
        },
        log: mockLog,
      });

      const event: DingtalkRobotMessageEvent = {
        msgId: "msg6",
        msgtype: "text",
        conversationId: "conv1",
        conversationType: "1",
        senderId: "user1",
        senderNick: "TestUser",
        createAt: Date.now(),
        text: { content: "Hello World" },
      };

      const req = createMockReq(event);
      const res = createMockRes();

      const promise = handler(req as any, res as any);
      req.emit();
      await promise;

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].text).toBe("Hello World");
    });

    it("非 POST 请求返回 405", async () => {
      const handler = createDingtalkWebhookHandler({
        config: {},
        onMessage: async () => {},
      });

      const req = { method: "GET", headers: {} };
      const res = createMockRes();

      await handler(req as any, res as any);

      expect(res.statusCode).toBe(405);
    });
  });
});
