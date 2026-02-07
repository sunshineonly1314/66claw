/**
 * 钉钉会话管理模块测试
 * DingTalk Session Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isNewSessionCommand,
  getSessionKey,
  clearUserSession,
  clearAllSessions,
  getSessionCount,
  getUserSession,
  DEFAULT_SESSION_TIMEOUT,
} from "./session-manager.js";

describe("session-manager", () => {
  beforeEach(() => {
    // 每个测试前清空会话缓存
    clearAllSessions();
  });

  describe("isNewSessionCommand", () => {
    it("识别英文新会话命令", () => {
      expect(isNewSessionCommand("/new")).toBe(true);
      expect(isNewSessionCommand("/reset")).toBe(true);
      expect(isNewSessionCommand("/clear")).toBe(true);
    });

    it("识别中文新会话命令", () => {
      expect(isNewSessionCommand("新会话")).toBe(true);
      expect(isNewSessionCommand("重新开始")).toBe(true);
      expect(isNewSessionCommand("清空对话")).toBe(true);
    });

    it("忽略大小写", () => {
      expect(isNewSessionCommand("/NEW")).toBe(true);
      expect(isNewSessionCommand("/Reset")).toBe(true);
      expect(isNewSessionCommand("/CLEAR")).toBe(true);
    });

    it("处理首尾空格", () => {
      expect(isNewSessionCommand("  /new  ")).toBe(true);
      expect(isNewSessionCommand("  新会话  ")).toBe(true);
    });

    it("非新会话命令返回 false", () => {
      expect(isNewSessionCommand("hello")).toBe(false);
      expect(isNewSessionCommand("/help")).toBe(false);
      expect(isNewSessionCommand("新会话开始")).toBe(false);
      expect(isNewSessionCommand("/new session")).toBe(false);
    });
  });

  describe("getSessionKey", () => {
    const mockLog = { info: vi.fn() };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("新用户首次会话", () => {
      const result = getSessionKey("user1", false, DEFAULT_SESSION_TIMEOUT, mockLog);

      expect(result.sessionKey).toBe("dingtalk:user1");
      expect(result.isNew).toBe(false);
      expect(getSessionCount()).toBe(1);
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining("新用户首次会话"));
    });

    it("同一用户继续会话", () => {
      // 首次
      getSessionKey("user1", false, DEFAULT_SESSION_TIMEOUT, mockLog);
      // 第二次
      const result = getSessionKey("user1", false, DEFAULT_SESSION_TIMEOUT, mockLog);

      expect(result.sessionKey).toBe("dingtalk:user1");
      expect(result.isNew).toBe(false);
      expect(getSessionCount()).toBe(1);
    });

    it("强制新会话", () => {
      // 首次
      getSessionKey("user1", false, DEFAULT_SESSION_TIMEOUT, mockLog);
      // 强制新会话
      const result = getSessionKey("user1", true, DEFAULT_SESSION_TIMEOUT, mockLog);

      expect(result.sessionKey).toMatch(/^dingtalk:user1:\d+$/);
      expect(result.isNew).toBe(true);
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining("用户主动开启新会话"));
    });

    it("会话超时自动新建", () => {
      // 首次会话
      getSessionKey("user1", false, DEFAULT_SESSION_TIMEOUT, mockLog);

      // 修改会话的 lastActivity 为很久以前
      const session = getUserSession("user1");
      if (session) {
        session.lastActivity = Date.now() - DEFAULT_SESSION_TIMEOUT - 1000;
      }

      // 再次获取会话 - 应该超时新建
      const result = getSessionKey("user1", false, DEFAULT_SESSION_TIMEOUT, mockLog);

      expect(result.sessionKey).toMatch(/^dingtalk:user1:\d+$/);
      expect(result.isNew).toBe(true);
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining("会话超时"));
    });

    it("短超时时间内不会新建", () => {
      // 首次
      const first = getSessionKey("user1", false, DEFAULT_SESSION_TIMEOUT, mockLog);
      // 立即再次
      const second = getSessionKey("user1", false, DEFAULT_SESSION_TIMEOUT, mockLog);

      expect(first.sessionKey).toBe(second.sessionKey);
      expect(second.isNew).toBe(false);
    });
  });

  describe("clearUserSession", () => {
    it("清除指定用户会话", () => {
      getSessionKey("user1", false);
      getSessionKey("user2", false);

      expect(getSessionCount()).toBe(2);

      clearUserSession("user1");

      expect(getSessionCount()).toBe(1);
      expect(getUserSession("user1")).toBeUndefined();
      expect(getUserSession("user2")).toBeDefined();
    });
  });

  describe("clearAllSessions", () => {
    it("清除所有会话", () => {
      getSessionKey("user1", false);
      getSessionKey("user2", false);
      getSessionKey("user3", false);

      expect(getSessionCount()).toBe(3);

      clearAllSessions();

      expect(getSessionCount()).toBe(0);
    });
  });
});
