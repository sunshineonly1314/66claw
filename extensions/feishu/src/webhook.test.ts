import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// Mocks (hoisted)
// ============================================================================

const downloadImageFeishuMock = vi.hoisted(() => vi.fn());
const downloadMessageResourceFeishuMock = vi.hoisted(() => vi.fn());
const saveMediaBufferMock = vi.hoisted(() => vi.fn());

vi.mock("./media.js", () => ({
  downloadImageFeishu: downloadImageFeishuMock,
  downloadMessageResourceFeishu: downloadMessageResourceFeishuMock,
}));

vi.mock("./runtime.js", () => ({
  getFeishuRuntime: () => ({
    channel: {
      media: {
        saveMediaBuffer: saveMediaBufferMock,
      },
    },
  }),
}));

import {
  resolveFeishuInboundMedia,
  feishuMediaPlaceholder,
  extractPostContent,
  createFeishuWebhookHandler,
  type FeishuWebhookContext,
} from "./webhook.ts";
import type { FeishuChannelConfig, FeishuMessageReceiveEvent } from "./types.ts";

// ============================================================================
// Helpers
// ============================================================================

const baseCfg: FeishuChannelConfig = {
  appId: "app_id",
  appSecret: "app_secret",
  domain: "feishu",
} as any;

function makeEvent(overrides: {
  message_type: string;
  content: string;
  message_id?: string;
  chat_id?: string;
  chat_type?: "p2p" | "group";
  mentions?: FeishuMessageReceiveEvent["event"]["message"]["mentions"];
}): FeishuMessageReceiveEvent {
  return {
    schema: "2.0",
    header: {
      event_id: "evt_1",
      event_type: "im.message.receive_v1",
      create_time: "1700000000000",
      token: "tok",
      app_id: "app_id",
      tenant_key: "tenant_1",
    },
    event: {
      sender: {
        sender_id: { open_id: "ou_sender", user_id: "uid_sender" },
        sender_type: "user",
      },
      message: {
        message_id: overrides.message_id ?? "msg_1",
        create_time: "1700000000000",
        update_time: "1700000000000",
        chat_id: overrides.chat_id ?? "oc_chat1",
        chat_type: overrides.chat_type ?? "p2p",
        message_type: overrides.message_type,
        content: overrides.content,
        mentions: overrides.mentions,
      },
    },
  };
}

// ============================================================================
// feishuMediaPlaceholder
// ============================================================================

describe("feishuMediaPlaceholder", () => {
  it("returns <media:image> for image", () => {
    expect(feishuMediaPlaceholder("image")).toBe("<media:image>");
  });

  it("returns <media:audio> for audio", () => {
    expect(feishuMediaPlaceholder("audio")).toBe("<media:audio>");
  });

  it("returns <media:video> for media (video)", () => {
    expect(feishuMediaPlaceholder("media")).toBe("<media:video>");
  });

  it("returns <media:sticker> for sticker", () => {
    expect(feishuMediaPlaceholder("sticker")).toBe("<media:sticker>");
  });

  it("returns <media:document> for file", () => {
    expect(feishuMediaPlaceholder("file")).toBe("<media:document>");
  });

  it("returns <media:document> for unknown type", () => {
    expect(feishuMediaPlaceholder("unknown_type")).toBe("<media:document>");
  });
});

// ============================================================================
// extractPostContent
// ============================================================================

describe("extractPostContent", () => {
  it("extracts text from zh_cn post", () => {
    const result = extractPostContent({
      zh_cn: {
        title: "标题",
        content: [
          [
            { tag: "text", text: "你好 " },
            { tag: "a", text: "链接", href: "https://example.com" },
          ],
          [{ tag: "text", text: "第二行" }],
        ],
      },
    });
    expect(result.text).toBe("标题\n你好 链接\n第二行");
    expect(result.imageKeys).toEqual([]);
  });

  it("extracts inline image keys", () => {
    const result = extractPostContent({
      zh_cn: {
        content: [
          [
            { tag: "text", text: "看这张图 " },
            { tag: "img", image_key: "img_v3_abc" },
          ],
          [{ tag: "img", image_key: "img_v3_def" }],
        ],
      },
    });
    expect(result.imageKeys).toEqual(["img_v3_abc", "img_v3_def"]);
    expect(result.text).toContain("<media:image>");
  });

  it("falls back to en_us when zh_cn is absent", () => {
    const result = extractPostContent({
      en_us: {
        title: "Title",
        content: [[{ tag: "text", text: "Hello" }]],
      },
    });
    expect(result.text).toBe("Title\nHello");
  });

  it("returns empty for empty post", () => {
    const result = extractPostContent({});
    expect(result.text).toBe("");
    expect(result.imageKeys).toEqual([]);
  });

  it("handles @at elements gracefully (skipped)", () => {
    const result = extractPostContent({
      zh_cn: {
        content: [
          [
            { tag: "at", user_id: "ou_xxx", user_name: "张三" },
            { tag: "text", text: " 请看" },
          ],
        ],
      },
    });
    expect(result.text).toBe("请看");
  });
});

// ============================================================================
// resolveFeishuInboundMedia
// ============================================================================

describe("resolveFeishuInboundMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveMediaBufferMock.mockResolvedValue({
      id: "media_1",
      path: "/tmp/media/inbound/image.jpg",
      size: 1024,
      contentType: "image/jpeg",
    });
  });

  it("downloads and saves image", async () => {
    downloadImageFeishuMock.mockResolvedValue({
      buffer: Buffer.from("imgdata"),
      contentType: "image/png",
    });

    const result = await resolveFeishuInboundMedia({
      config: baseCfg,
      messageId: "msg_1",
      messageType: "image",
      content: { image_key: "img_v3_abc" },
    });

    expect(downloadImageFeishuMock).toHaveBeenCalledWith({
      cfg: baseCfg,
      imageKey: "img_v3_abc",
    });
    expect(saveMediaBufferMock).toHaveBeenCalledWith(
      Buffer.from("imgdata"),
      "image/png",
      "inbound",
      undefined,
      undefined,
    );
    expect(result).toEqual({
      path: "/tmp/media/inbound/image.jpg",
      contentType: "image/jpeg",
    });
  });

  it("returns null when image_key is missing", async () => {
    const result = await resolveFeishuInboundMedia({
      config: baseCfg,
      messageId: "msg_1",
      messageType: "image",
      content: {},
    });
    expect(result).toBeNull();
    expect(downloadImageFeishuMock).not.toHaveBeenCalled();
  });

  it("downloads file with original filename", async () => {
    downloadMessageResourceFeishuMock.mockResolvedValue({
      buffer: Buffer.from("filedata"),
      contentType: "application/pdf",
    });

    await resolveFeishuInboundMedia({
      config: baseCfg,
      messageId: "msg_2",
      messageType: "file",
      content: { file_key: "file_v3_abc", file_name: "report.pdf" },
    });

    expect(downloadMessageResourceFeishuMock).toHaveBeenCalledWith({
      cfg: baseCfg,
      messageId: "msg_2",
      fileKey: "file_v3_abc",
      type: "file",
    });
    expect(saveMediaBufferMock).toHaveBeenCalledWith(
      Buffer.from("filedata"),
      "application/pdf",
      "inbound",
      undefined,
      "report.pdf",
    );
  });

  it("downloads audio with default ogg mime", async () => {
    downloadMessageResourceFeishuMock.mockResolvedValue({
      buffer: Buffer.from("audiodata"),
    });

    await resolveFeishuInboundMedia({
      config: baseCfg,
      messageId: "msg_3",
      messageType: "audio",
      content: { file_key: "file_v3_audio" },
    });

    expect(saveMediaBufferMock).toHaveBeenCalledWith(
      Buffer.from("audiodata"),
      "audio/ogg",
      "inbound",
      undefined,
      "voice.opus",
    );
  });

  it("downloads video (media type)", async () => {
    downloadMessageResourceFeishuMock.mockResolvedValue({
      buffer: Buffer.from("videodata"),
    });

    await resolveFeishuInboundMedia({
      config: baseCfg,
      messageId: "msg_4",
      messageType: "media",
      content: { file_key: "file_v3_video", file_name: "clip.mp4" },
    });

    expect(saveMediaBufferMock).toHaveBeenCalledWith(
      Buffer.from("videodata"),
      "video/mp4",
      "inbound",
      undefined,
      "clip.mp4",
    );
  });

  it("downloads sticker as image", async () => {
    downloadMessageResourceFeishuMock.mockResolvedValue({
      buffer: Buffer.from("stickerdata"),
    });

    await resolveFeishuInboundMedia({
      config: baseCfg,
      messageId: "msg_5",
      messageType: "sticker",
      content: { file_key: "file_v3_sticker" },
    });

    expect(downloadMessageResourceFeishuMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image" }),
    );
    expect(saveMediaBufferMock).toHaveBeenCalledWith(
      Buffer.from("stickerdata"),
      "image/png",
      "inbound",
      undefined,
      undefined,
    );
  });

  it("returns null for unknown message type", async () => {
    const result = await resolveFeishuInboundMedia({
      config: baseCfg,
      messageId: "msg_6",
      messageType: "share_chat",
      content: { chat_id: "oc_xxx" },
    });
    expect(result).toBeNull();
  });

  it("returns null and logs error on download failure", async () => {
    downloadImageFeishuMock.mockRejectedValue(new Error("network error"));
    const errorLog = vi.fn();

    const result = await resolveFeishuInboundMedia({
      config: baseCfg,
      messageId: "msg_7",
      messageType: "image",
      content: { image_key: "img_v3_fail" },
      log: { info: vi.fn(), warn: vi.fn(), error: errorLog },
    });

    expect(result).toBeNull();
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("下载媒体失败"),
    );
  });
});

// ============================================================================
// createFeishuWebhookHandler + handleMessageEvent (integration)
// ============================================================================

describe("webhook handleMessageEvent integration", () => {
  let onMessageMock: ReturnType<typeof vi.fn>;
  let handler: ReturnType<typeof createFeishuWebhookHandler>;
  const logMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    onMessageMock = vi.fn().mockResolvedValue(undefined);
    handler = createFeishuWebhookHandler({
      config: baseCfg,
      onMessage: onMessageMock,
      log: logMock,
    });

    saveMediaBufferMock.mockResolvedValue({
      id: "media_1",
      path: "/tmp/media/inbound/saved.jpg",
      size: 2048,
      contentType: "image/jpeg",
    });

    downloadImageFeishuMock.mockResolvedValue({
      buffer: Buffer.from("imgbytes"),
      contentType: "image/jpeg",
    });

    downloadMessageResourceFeishuMock.mockResolvedValue({
      buffer: Buffer.from("filebytes"),
    });
  });

  function mockReq(body: unknown) {
    const bodyStr = JSON.stringify(body);
    return {
      method: "POST",
      url: "/feishu/webhook",
      on: (event: string, cb: (...args: any[]) => void) => {
        if (event === "data") cb(Buffer.from(bodyStr));
        if (event === "end") cb();
      },
      destroy: vi.fn(),
    } as any;
  }

  function mockRes() {
    const res: any = {
      writableEnded: false,
      writeHead: vi.fn(),
      end: vi.fn(() => { res.writableEnded = true; }),
    };
    return res;
  }

  it("processes text message and calls onMessage with text", async () => {
    const event = makeEvent({
      message_type: "text",
      content: JSON.stringify({ text: "hello world" }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);
    // handleMessageEvent is async after 200 response, give it a tick
    await new Promise((r) => setTimeout(r, 50));

    expect(onMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "hello world",
        mediaPath: undefined,
        mediaType: undefined,
      }),
    );
  });

  it("processes image message with media download", async () => {
    const event = makeEvent({
      message_type: "image",
      content: JSON.stringify({ image_key: "img_v3_test" }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(downloadImageFeishuMock).toHaveBeenCalledWith(
      expect.objectContaining({ imageKey: "img_v3_test" }),
    );
    expect(onMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "<media:image>",
        mediaPath: "/tmp/media/inbound/saved.jpg",
        mediaType: "image/jpeg",
      }),
    );
  });

  it("processes file message with media download", async () => {
    const event = makeEvent({
      message_type: "file",
      content: JSON.stringify({ file_key: "file_v3_doc", file_name: "doc.pdf" }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(onMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "<media:document>",
        mediaPath: "/tmp/media/inbound/saved.jpg",
      }),
    );
  });

  it("processes audio message", async () => {
    const event = makeEvent({
      message_type: "audio",
      content: JSON.stringify({ file_key: "file_v3_voice" }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(onMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "<media:audio>" }),
    );
  });

  it("processes video (media) message", async () => {
    const event = makeEvent({
      message_type: "media",
      content: JSON.stringify({ file_key: "file_v3_vid", file_name: "vid.mp4" }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(onMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "<media:video>" }),
    );
  });

  it("processes sticker message", async () => {
    const event = makeEvent({
      message_type: "sticker",
      content: JSON.stringify({ file_key: "file_v3_stk" }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(onMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "<media:sticker>" }),
    );
  });

  it("processes post message with inline image", async () => {
    const event = makeEvent({
      message_type: "post",
      content: JSON.stringify({
        zh_cn: {
          title: "标题",
          content: [
            [
              { tag: "text", text: "看这个 " },
              { tag: "img", image_key: "img_v3_inline" },
            ],
          ],
        },
      }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(downloadImageFeishuMock).toHaveBeenCalledWith(
      expect.objectContaining({ imageKey: "img_v3_inline" }),
    );
    expect(onMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("看这个"),
        mediaPath: "/tmp/media/inbound/saved.jpg",
      }),
    );
  });

  it("processes post message without images (text-only post)", async () => {
    const event = makeEvent({
      message_type: "post",
      content: JSON.stringify({
        zh_cn: {
          title: "纯文本标题",
          content: [[{ tag: "text", text: "纯文本内容" }]],
        },
      }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(downloadImageFeishuMock).not.toHaveBeenCalled();
    expect(onMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("纯文本内容"),
        mediaPath: undefined,
      }),
    );
  });

  it("skips unsupported message types (interactive)", async () => {
    const event = makeEvent({
      message_type: "interactive",
      content: JSON.stringify({ elements: [] }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(onMessageMock).not.toHaveBeenCalled();
    expect(logMock.info).toHaveBeenCalledWith(
      expect.stringContaining("不支持的消息类型"),
    );
  });

  it("still calls onMessage with placeholder when media download fails", async () => {
    downloadImageFeishuMock.mockRejectedValue(new Error("download failed"));

    const event = makeEvent({
      message_type: "image",
      content: JSON.stringify({ image_key: "img_v3_fail" }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);
    await new Promise((r) => setTimeout(r, 50));

    // Should still call onMessage with the placeholder but no media path
    expect(onMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "<media:image>",
        mediaPath: undefined,
        mediaType: undefined,
      }),
    );
  });

  it("responds 200 immediately before processing media (within 3s window)", async () => {
    // Simulate slow download
    downloadImageFeishuMock.mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ buffer: Buffer.from("slow"), contentType: "image/png" }), 200)),
    );

    const event = makeEvent({
      message_type: "image",
      content: JSON.stringify({ image_key: "img_slow" }),
    });
    const req = mockReq(event);
    const res = mockRes();

    await handler(req, res);

    // 200 should be sent immediately, before download completes
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

    // Wait for async processing
    await new Promise((r) => setTimeout(r, 300));
    expect(onMessageMock).toHaveBeenCalled();
  });
});
