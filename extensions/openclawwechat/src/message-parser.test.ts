/**
 * 消息解析模块单元测试
 * Message Parser Unit Tests
 *
 * 测试覆盖:
 * - 文本消息解析
 * - 图片消息解析
 * - 视频消息解析
 * - 文档消息解析
 * - Caption 清理 (移除 media URL 和 upload_api_url 标记)
 * - 边界情况 (无 from, 无 message)
 */

import { describe, it, expect, vi } from "vitest";
import { parseTelegramUpdate } from "./message-parser.js";

// ============================================================================
// 测试辅助函数 (Test Helpers)
// ============================================================================

function createTextUpdate(text: string, openid = "user_openid_123") {
  return {
    update_id: 1001,
    message: {
      from: { username: openid },
      chat: { upload_api_url: "https://bridge.example.com/bot123/sendPhoto" },
      text,
    },
  };
}

function createPhotoUpdate(
  fileId = "photo_file_id_abc",
  caption = "",
  openid = "user_openid_123",
) {
  return {
    update_id: 1002,
    message: {
      from: { username: openid },
      chat: { upload_api_url: "https://bridge.example.com/bot123/sendPhoto" },
      photo: [
        { file_id: "small_thumb", width: 100, height: 100 },
        { file_id: fileId, width: 800, height: 600 },
      ],
      caption,
    },
  };
}

function createVideoUpdate(
  fileId = "video_file_id_xyz",
  caption = "",
  mimeType = "video/mp4",
) {
  return {
    update_id: 1003,
    message: {
      from: { username: "video_user" },
      chat: { upload_api_url: "https://bridge.example.com/bot123/sendVideo" },
      video: { file_id: fileId, mime_type: mimeType },
      caption,
    },
  };
}

function createDocumentUpdate(
  fileId = "doc_file_id_abc",
  mimeType = "application/pdf",
  caption = "",
) {
  return {
    update_id: 1004,
    message: {
      from: { username: "doc_user" },
      chat: {},
      document: { file_id: fileId, mime_type: mimeType },
      caption,
    },
  };
}

// ============================================================================
// 基础解析测试
// ============================================================================

describe("parseTelegramUpdate - 基础解析", () => {
  it("解析纯文本消息", () => {
    const update = createTextUpdate("你好世界");
    const result = parseTelegramUpdate(update, "test-account");

    expect(result).not.toBeNull();
    expect(result!.openid).toBe("user_openid_123");
    expect(result!.updateId).toBe(1001);
    expect(result!.text).toBe("你好世界");
    expect(result!.mediaUrls).toEqual([]);
    expect(result!.mediaTypes).toEqual([]);
  });

  it("没有 message 字段返回 null", () => {
    const update = { update_id: 999 };
    const result = parseTelegramUpdate(update, "test-account");
    expect(result).toBeNull();
  });

  it("没有 from 字段返回 null 并记录警告", () => {
    const mockLog = { warn: vi.fn() };
    const update = {
      update_id: 1000,
      message: { text: "hello", chat: {} },
    };

    const result = parseTelegramUpdate(update, "test-account", mockLog);

    expect(result).toBeNull();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.stringContaining("without openid"),
    );
  });

  it("优先使用 from.username 作为 openid", () => {
    const update = {
      update_id: 1001,
      message: {
        from: { username: "preferred_name", id: 12345 },
        chat: {},
        text: "test",
      },
    };

    const result = parseTelegramUpdate(update, "test-account");
    expect(result!.openid).toBe("preferred_name");
  });

  it("无 username 时回退到 from.id", () => {
    const update = {
      update_id: 1001,
      message: {
        from: { id: 67890 },
        chat: {},
        text: "test",
      },
    };

    const result = parseTelegramUpdate(update, "test-account");
    expect(result!.openid).toBe("67890");
  });
});

// ============================================================================
// 图片消息测试
// ============================================================================

describe("parseTelegramUpdate - 图片消息", () => {
  it("选择最大尺寸图片的 file_id", () => {
    const update = createPhotoUpdate("largest_photo_id");
    const result = parseTelegramUpdate(update, "test-account");

    expect(result!.mediaUrls).toEqual(["largest_photo_id"]);
    expect(result!.mediaTypes).toEqual(["image/jpeg"]);
    expect(result!.isVideo).toBe(false);
    expect(result!.isDocument).toBe(false);
  });

  it("图片带 caption 时 caption 作为 text", () => {
    const update = createPhotoUpdate("photo_id", "这是一张风景照");
    const result = parseTelegramUpdate(update, "test-account");

    expect(result!.text).toBe("这是一张风景照");
  });

  it("空 photo 数组不产生媒体", () => {
    const update = {
      update_id: 1002,
      message: {
        from: { username: "user1" },
        chat: {},
        photo: [],
        text: "no photo",
      },
    };

    const result = parseTelegramUpdate(update, "test-account");
    expect(result!.mediaUrls).toEqual([]);
    expect(result!.text).toBe("no photo");
  });
});

// ============================================================================
// 视频消息测试
// ============================================================================

describe("parseTelegramUpdate - 视频消息", () => {
  it("解析视频消息", () => {
    const update = createVideoUpdate("video_123", "", "video/mp4");
    const result = parseTelegramUpdate(update, "test-account");

    expect(result!.mediaUrls).toEqual(["video_123"]);
    expect(result!.mediaTypes).toEqual(["video/mp4"]);
    expect(result!.isVideo).toBe(true);
  });

  it("视频无 mime_type 时默认为 video/mp4", () => {
    const update = {
      update_id: 1003,
      message: {
        from: { username: "user1" },
        chat: {},
        video: { file_id: "vid_1" },
      },
    };

    const result = parseTelegramUpdate(update, "test-account");
    expect(result!.mediaTypes).toEqual(["video/mp4"]);
  });

  it("视频优先于图片（当同时存在时）", () => {
    const update = {
      update_id: 1003,
      message: {
        from: { username: "user1" },
        chat: {},
        video: { file_id: "vid_1", mime_type: "video/mp4" },
        photo: [{ file_id: "photo_1" }],
      },
    };

    const result = parseTelegramUpdate(update, "test-account");
    expect(result!.mediaUrls).toEqual(["vid_1"]);
    expect(result!.isVideo).toBe(true);
  });
});

// ============================================================================
// 文档消息测试
// ============================================================================

describe("parseTelegramUpdate - 文档消息", () => {
  it("解析文档消息", () => {
    const update = createDocumentUpdate("doc_abc", "application/pdf", "请查看附件");
    const result = parseTelegramUpdate(update, "test-account");

    expect(result!.mediaUrls).toEqual(["doc_abc"]);
    expect(result!.mediaTypes).toEqual(["application/pdf"]);
    expect(result!.isDocument).toBe(true);
    expect(result!.isVideo).toBe(false);
    expect(result!.text).toBe("请查看附件");
  });

  it("文档无 mime_type 时默认为 application/octet-stream", () => {
    const update = {
      update_id: 1004,
      message: {
        from: { username: "user1" },
        chat: {},
        document: { file_id: "doc_1" },
      },
    };

    const result = parseTelegramUpdate(update, "test-account");
    expect(result!.mediaTypes).toEqual(["application/octet-stream"]);
  });
});

// ============================================================================
// Caption 清理测试
// ============================================================================

describe("parseTelegramUpdate - Caption 清理", () => {
  it("移除 caption 中的媒体 URL", () => {
    const fileId = "photo_id_to_remove";
    const update = createPhotoUpdate(fileId, `看看这张图 ${fileId}`);
    const result = parseTelegramUpdate(update, "test-account");

    expect(result!.text).toBe("看看这张图");
  });

  it("移除 caption 中的 upload_api_url 标记", () => {
    const update = createPhotoUpdate(
      "photo_id",
      "描述文字 [upload_api_url: https://example.com/upload]",
    );
    const result = parseTelegramUpdate(update, "test-account");

    expect(result!.text).toBe("描述文字");
    expect(result!.text).not.toContain("upload_api_url");
  });

  it("连续多个换行符合并为单个", () => {
    const update = createPhotoUpdate("photo_id", "第一行\n\n\n第二行");
    const result = parseTelegramUpdate(update, "test-account");

    expect(result!.text).toBe("第一行\n第二行");
  });

  it("清理后只剩空白则 caption 为空字符串", () => {
    const fileId = "photo_id_only";
    const update = createPhotoUpdate(fileId, fileId);
    const result = parseTelegramUpdate(update, "test-account");

    // 当 caption 中只有 file_id，清理后为空，text 应该是 ""
    expect(result!.text).toBe("");
  });
});

// ============================================================================
// uploadAPIURL 测试
// ============================================================================

describe("parseTelegramUpdate - uploadAPIURL", () => {
  it("从 chat 对象提取 upload_api_url", () => {
    const update = createTextUpdate("test");
    const result = parseTelegramUpdate(update, "test-account");

    expect(result!.uploadAPIURL).toBe(
      "https://bridge.example.com/bot123/sendPhoto",
    );
  });

  it("chat 中无 upload_api_url 时记录警告", () => {
    const mockLog = { warn: vi.fn() };
    const update = {
      update_id: 1001,
      message: {
        from: { username: "user1" },
        chat: { id: 123 },
        text: "test",
      },
    };

    const result = parseTelegramUpdate(update, "test-account", mockLog);

    expect(result!.uploadAPIURL).toBeUndefined();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.stringContaining("No upload_api_url"),
    );
  });
});
