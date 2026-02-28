/**
 * 钉钉媒体归档模块测试
 * DingTalk Media Archival Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import { resolveArchivalDir } from "./media-archival.js";
import type { DingtalkChannelConfig, MediaDownloadResult } from "./types.js";

describe("media-archival", () => {
  describe("resolveArchivalDir", () => {
    it("使用默认基础路径", () => {
      const config: DingtalkChannelConfig = {};
      const dir = resolveArchivalDir(config, "picture");

      // 应包含 inbound/picture/日期
      expect(dir).toContain("inbound");
      expect(dir).toContain("picture");
      expect(dir).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it("使用自定义归档路径", () => {
      const customBase = path.join("custom", "media", "path");
      const config: DingtalkChannelConfig = {
        media: {
          archival: {
            basePath: customBase,
          },
        },
      };
      const dir = resolveArchivalDir(config, "audio");

      // 使用 path.sep 兼容的检查，避免 Windows/Unix 分隔符差异
      expect(dir).toContain(customBase);
      expect(dir).toContain("inbound");
      expect(dir).toContain("audio");
    });

    it("不同媒体类型生成不同路径", () => {
      const config: DingtalkChannelConfig = {};

      const picDir = resolveArchivalDir(config, "picture");
      const audioDir = resolveArchivalDir(config, "audio");
      const videoDir = resolveArchivalDir(config, "video");
      const fileDir = resolveArchivalDir(config, "file");

      expect(picDir).toContain("picture");
      expect(audioDir).toContain("audio");
      expect(videoDir).toContain("video");
      expect(fileDir).toContain("file");

      // 四个路径应该互不相同
      const dirs = new Set([picDir, audioDir, videoDir, fileDir]);
      expect(dirs.size).toBe(4);
    });

    it("日期目录格式为 YYYY-MM-DD", () => {
      const config: DingtalkChannelConfig = {};
      const dir = resolveArchivalDir(config, "picture");
      const dateStr = new Date().toISOString().slice(0, 10);
      expect(dir).toContain(dateStr);
    });
  });

  describe("startArchivalCleanup", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("启动后返回带 stop 方法的对象", async () => {
      // 动态导入以便在 fake timers 环境中运行
      const { startArchivalCleanup } = await import("./media-archival.js");
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const handle = startArchivalCleanup({}, mockLog);

      expect(handle).toBeDefined();
      expect(typeof handle.stop).toBe("function");

      handle.stop();
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining("已停止"));

      vi.useRealTimers();
    });
  });
});
