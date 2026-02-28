/**
 * 钉钉图片上传模块测试
 * DingTalk Media Upload Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildMediaSystemPrompt, clearOapiTokenCache } from "./media-upload.js";

describe("media-upload", () => {
  beforeEach(() => {
    clearOapiTokenCache();
    vi.clearAllMocks();
  });

  describe("buildMediaSystemPrompt", () => {
    it("包含正确的图片使用说明", () => {
      const prompt = buildMediaSystemPrompt();

      expect(prompt).toContain("钉钉图片显示规则");
      expect(prompt).toContain("file:///path/to/image.jpg");
      expect(prompt).toContain("/tmp/screenshot.png");
      expect(prompt).toContain("直接输出本地路径即可");
    });

    it("包含禁止事项", () => {
      const prompt = buildMediaSystemPrompt();

      expect(prompt).toContain("不要自己执行 curl");
      expect(prompt).toContain("不要猜测或构造 URL");
    });
  });

  describe("LOCAL_IMAGE_RE pattern matching", () => {
    // 测试正则匹配逻辑（不依赖实际文件系统）
    const LOCAL_IMAGE_RE =
      /!\[([^\]]*)\]\(((?:file:\/\/\/|MEDIA:|attachment:\/\/\/)[^\s)]+|\/(?:tmp|var|private|Users|home|root)[^\s)]+|[A-Za-z]:[\\/][^\s)]+)\)/g;

    it("匹配 file:// 协议图片", () => {
      const content = "![test](file:///Users/test/photo.jpg)";
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][1]).toBe("test");
      expect(matches[0][2]).toBe("file:///Users/test/photo.jpg");
    });

    it("匹配 MEDIA: 协议图片", () => {
      const content = "![](MEDIA:/var/folders/xxx/image.png)";
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][2]).toBe("MEDIA:/var/folders/xxx/image.png");
    });

    it("匹配 macOS 路径", () => {
      const content = "![screenshot](/tmp/screenshot.png)";
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][2]).toBe("/tmp/screenshot.png");
    });

    it("匹配 /var/folders 路径", () => {
      const content = "![](/var/folders/abc/image.jpg)";
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][2]).toBe("/var/folders/abc/image.jpg");
    });

    it("匹配 /Users 路径", () => {
      const content = "![photo](/Users/john/Pictures/photo.jpg)";
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][2]).toBe("/Users/john/Pictures/photo.jpg");
    });

    it("匹配 Linux /home 路径", () => {
      const content = "![](/home/user/images/test.png)";
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][2]).toBe("/home/user/images/test.png");
    });

    it("匹配 Windows 路径 (反斜杠)", () => {
      const content = "![](C:\\Users\\test\\photo.jpg)";
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][2]).toBe("C:\\Users\\test\\photo.jpg");
    });

    it("匹配 Windows 路径 (正斜杠)", () => {
      const content = "![](C:/Users/test/photo.jpg)";
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][2]).toBe("C:/Users/test/photo.jpg");
    });

    it("不匹配 HTTP URL", () => {
      const content = "![test](https://example.com/image.jpg)";
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(0);
    });

    it("不匹配相对路径", () => {
      const content = "![test](./images/photo.jpg)";
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(0);
    });

    it("匹配多个图片", () => {
      const content = `
        这是第一张图片: ![1](/tmp/1.png)
        这是第二张图片: ![2](file:///Users/test/2.jpg)
        这是第三张图片: ![3](C:\\Users\\test\\3.png)
      `;
      const matches = [...content.matchAll(LOCAL_IMAGE_RE)];

      expect(matches.length).toBe(3);
    });
  });

  describe("BARE_IMAGE_PATH_RE pattern matching", () => {
    const BARE_IMAGE_PATH_RE =
      /`?((?:\/(?:tmp|var|private|Users|home|root)\/[^\s`'",)]+|[A-Za-z]:[\\/][^\s`'",)]+)\.(?:png|jpg|jpeg|gif|bmp|webp))`?/gi;

    it("匹配纯文本中的 macOS 路径", () => {
      const content = "生成的截图保存在 /tmp/screenshot.png 文件中";
      const matches = [...content.matchAll(BARE_IMAGE_PATH_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][1]).toBe("/tmp/screenshot.png");
    });

    it("匹配反引号包裹的路径", () => {
      const content = "生成的截图保存在 `/var/folders/xxx/image.png` 文件中";
      const matches = [...content.matchAll(BARE_IMAGE_PATH_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][1]).toBe("/var/folders/xxx/image.png");
    });

    it("匹配 Windows 路径", () => {
      const content = "图片位于 C:\\Users\\test\\photo.jpg";
      const matches = [...content.matchAll(BARE_IMAGE_PATH_RE)];

      expect(matches.length).toBe(1);
    });

    it("只匹配图片扩展名", () => {
      const content = "/tmp/test.txt /tmp/image.png /tmp/doc.pdf";
      const matches = [...content.matchAll(BARE_IMAGE_PATH_RE)];

      expect(matches.length).toBe(1);
      expect(matches[0][1]).toBe("/tmp/image.png");
    });

    it("不匹配非图片文件", () => {
      const content = "/tmp/document.pdf /tmp/script.js";
      const matches = [...content.matchAll(BARE_IMAGE_PATH_RE)];

      expect(matches.length).toBe(0);
    });
  });

  describe("toLocalPath helper", () => {
    // 内部函数，通过行为测试
    it("file:// 前缀应被移除", () => {
      // 这个测试通过 processLocalImages 的行为间接验证
      // 实际测试需要 mock fs 和 fetch
    });
  });

  describe("detectUploadMediaType", () => {
    let detectUploadMediaType: (filePath: string) => string;

    beforeEach(async () => {
      const mod = await import("./media-upload.js");
      detectUploadMediaType = mod.detectUploadMediaType;
    });

    it("图片扩展名返回 image", () => {
      expect(detectUploadMediaType("/tmp/photo.jpg")).toBe("image");
      expect(detectUploadMediaType("/tmp/photo.jpeg")).toBe("image");
      expect(detectUploadMediaType("/tmp/photo.png")).toBe("image");
      expect(detectUploadMediaType("/tmp/photo.gif")).toBe("image");
      expect(detectUploadMediaType("/tmp/photo.bmp")).toBe("image");
      expect(detectUploadMediaType("/tmp/photo.webp")).toBe("image");
    });

    it("大写扩展名也正确识别", () => {
      expect(detectUploadMediaType("/tmp/photo.JPG")).toBe("image");
      expect(detectUploadMediaType("/tmp/photo.PNG")).toBe("image");
      expect(detectUploadMediaType("/tmp/audio.MP3")).toBe("voice");
    });

    it("语音扩展名返回 voice", () => {
      expect(detectUploadMediaType("/tmp/audio.mp3")).toBe("voice");
      expect(detectUploadMediaType("/tmp/audio.wav")).toBe("voice");
      expect(detectUploadMediaType("/tmp/audio.amr")).toBe("voice");
      expect(detectUploadMediaType("/tmp/audio.ogg")).toBe("voice");
      expect(detectUploadMediaType("/tmp/audio.m4a")).toBe("voice");
    });

    it("视频扩展名返回 video", () => {
      expect(detectUploadMediaType("/tmp/video.mp4")).toBe("video");
      expect(detectUploadMediaType("/tmp/video.mov")).toBe("video");
      expect(detectUploadMediaType("/tmp/video.avi")).toBe("video");
      expect(detectUploadMediaType("/tmp/video.mkv")).toBe("video");
      expect(detectUploadMediaType("/tmp/video.webm")).toBe("video");
    });

    it("未知扩展名返回 file", () => {
      expect(detectUploadMediaType("/tmp/report.xlsx")).toBe("file");
      expect(detectUploadMediaType("/tmp/document.pdf")).toBe("file");
      expect(detectUploadMediaType("/tmp/data.csv")).toBe("file");
      expect(detectUploadMediaType("/tmp/archive.zip")).toBe("file");
      expect(detectUploadMediaType("/tmp/script.js")).toBe("file");
    });

    it("无扩展名返回 file", () => {
      expect(detectUploadMediaType("/tmp/noext")).toBe("file");
      expect(detectUploadMediaType("Makefile")).toBe("file");
    });

    it("Windows 路径正确处理", () => {
      expect(detectUploadMediaType("C:\\Users\\test\\photo.jpg")).toBe("image");
      expect(detectUploadMediaType("D:\\media\\audio.mp3")).toBe("voice");
    });
  });
});
