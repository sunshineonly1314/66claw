/**
 * 钉钉定时消息调度器测试
 * DingTalk Scheduler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { matchesCron, startScheduler } from "./scheduler.js";

describe("scheduler", () => {
  describe("matchesCron", () => {
    it("通配符匹配所有时间", () => {
      const date = new Date(2026, 1, 28, 14, 30); // 2026-02-28 14:30 周六
      expect(matchesCron("* * * * *", date)).toBe(true);
    });

    it("精确匹配分钟和小时", () => {
      const date = new Date(2026, 1, 28, 9, 0); // 09:00
      expect(matchesCron("0 9 * * *", date)).toBe(true);
      expect(matchesCron("30 9 * * *", date)).toBe(false);
      expect(matchesCron("0 10 * * *", date)).toBe(false);
    });

    it("匹配范围 (1-5 表示周一到周五)", () => {
      const monday = new Date(2026, 1, 23, 9, 0); // 2026-02-23 周一
      const saturday = new Date(2026, 1, 28, 9, 0); // 2026-02-28 周六

      expect(matchesCron("0 9 * * 1-5", monday)).toBe(true);
      expect(matchesCron("0 9 * * 1-5", saturday)).toBe(false);
    });

    it("匹配列表 (1,3,5)", () => {
      const monday = new Date(2026, 1, 23, 9, 0); // 周一 (1)
      const tuesday = new Date(2026, 1, 24, 9, 0); // 周二 (2)
      const wednesday = new Date(2026, 1, 25, 9, 0); // 周三 (3)

      expect(matchesCron("0 9 * * 1,3,5", monday)).toBe(true);
      expect(matchesCron("0 9 * * 1,3,5", tuesday)).toBe(false);
      expect(matchesCron("0 9 * * 1,3,5", wednesday)).toBe(true);
    });

    it("匹配步长 (*/10 每 10 分钟)", () => {
      const d0 = new Date(2026, 1, 28, 14, 0);
      const d10 = new Date(2026, 1, 28, 14, 10);
      const d20 = new Date(2026, 1, 28, 14, 20);
      const d5 = new Date(2026, 1, 28, 14, 5);

      expect(matchesCron("*/10 * * * *", d0)).toBe(true);
      expect(matchesCron("*/10 * * * *", d10)).toBe(true);
      expect(matchesCron("*/10 * * * *", d20)).toBe(true);
      expect(matchesCron("*/10 * * * *", d5)).toBe(false);
    });

    it("匹配月份和日期", () => {
      const jan1 = new Date(2026, 0, 1, 0, 0); // 1月1日
      const feb28 = new Date(2026, 1, 28, 0, 0); // 2月28日

      expect(matchesCron("0 0 1 1 *", jan1)).toBe(true);
      expect(matchesCron("0 0 1 1 *", feb28)).toBe(false);
      expect(matchesCron("0 0 28 2 *", feb28)).toBe(true);
    });

    it("周日可以用 0 或 7 表示", () => {
      const sunday = new Date(2026, 2, 1, 9, 0); // 2026-03-01 周日

      expect(matchesCron("0 9 * * 0", sunday)).toBe(true);
      expect(matchesCron("0 9 * * 7", sunday)).toBe(true);
    });

    it("无效的 cron 表达式返回 false", () => {
      const date = new Date();
      expect(matchesCron("", date)).toBe(false);
      expect(matchesCron("0 9", date)).toBe(false);
      expect(matchesCron("invalid", date)).toBe(false);
      expect(matchesCron("0 9 * * * *", date)).toBe(false); // 6 段
    });

    it("范围+步长组合 (1-30/5)", () => {
      const d1 = new Date(2026, 1, 28, 14, 1);
      const d6 = new Date(2026, 1, 28, 14, 6);
      const d11 = new Date(2026, 1, 28, 14, 11);
      const d3 = new Date(2026, 1, 28, 14, 3);
      const d31 = new Date(2026, 1, 28, 14, 31);

      expect(matchesCron("1-30/5 * * * *", d1)).toBe(true);
      expect(matchesCron("1-30/5 * * * *", d6)).toBe(true);
      expect(matchesCron("1-30/5 * * * *", d11)).toBe(true);
      expect(matchesCron("1-30/5 * * * *", d3)).toBe(false);
      expect(matchesCron("1-30/5 * * * *", d31)).toBe(false); // 超出范围
    });
  });

  describe("startScheduler", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("无任务配置时不启动定时器", () => {
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const handle = startScheduler({}, mockLog);
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining("无定时任务"));
      handle.stop();
    });

    it("空任务列表时不启动", () => {
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const handle = startScheduler({ scheduledTasks: [] }, mockLog);
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining("无定时任务"));
      handle.stop();
    });

    it("有任务配置时启动调度器并报告启用数", () => {
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const handle = startScheduler({
        scheduledTasks: [
          { id: "t1", cron: "0 9 * * *", targets: ["u1"], messageTemplate: "Hi {date}", enabled: true },
          { id: "t2", cron: "0 18 * * *", targets: ["u1"], messageTemplate: "Bye", enabled: false },
        ],
      }, mockLog);

      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining("1/2"));
      handle.stop();
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining("已停止"));
    });

    it("stop 幂等调用不抛出", () => {
      const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const handle = startScheduler({
        scheduledTasks: [
          { id: "t1", cron: "0 9 * * *", targets: ["u1"], messageTemplate: "Hi" },
        ],
      }, mockLog);

      handle.stop();
      expect(() => handle.stop()).not.toThrow();
    });
  });
});
