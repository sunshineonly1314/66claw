/**
 * TC-01/02/03/04: UI 端启动优雅期 (grace period) 逻辑测试
 *
 * 测试 connectGateway 中的 onClose handler 行为:
 * - TC-01: 首次启动期间（grace period 内）不显示红色错误
 * - TC-02: 120s 超时后显示错误
 * - TC-03: Auth 错误立即显示（不被 grace period 抑制）
 * - TC-04: 已连接后断开显示红色错误
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Since app-gateway.ts has heavy dependencies (controllers, i18n, etc.),
// we extract and test the CORE LOGIC of the onClose handler independently.
// This tests the decision algorithm, not the full integration.
// ============================================================================

/** Minimal host shape matching what onClose reads/writes */
type MockHost = {
  connected: boolean;
  hasEverConnected: boolean;
  startupWaiting: boolean;
  pageLoadedAt: number;
  lastError: string | null;
};

/** Port of isTokenAuthError logic from storage.ts */
function isTokenAuthError(msg: string): boolean {
  const authKeywords = [
    "token_missing",
    "token_mismatch",
    "unauthorized",
    "gateway token",
    "invalid token",
  ];
  const lower = msg.toLowerCase();
  return authKeywords.some((kw) => lower.includes(kw));
}

const STARTUP_GRACE_PERIOD_MS = 120_000;

/**
 * Simulates the onClose handler logic from app-gateway.ts (lines 304-345)
 */
function simulateOnClose(
  host: MockHost,
  code: number,
  reason: string,
): { action: "suppress" | "auth_recovery" | "show_error" | "ignore_1012" } {
  host.connected = false;
  const reasonText = reason || "No reason given";
  const errorMsg = `WebSocket disconnected (${code}): ${reasonText}`;

  // 1012 = service restart
  if (code === 1012) {
    return { action: "ignore_1012" };
  }

  // Auth error detection (always bypasses grace period)
  if (isTokenAuthError(errorMsg) || isTokenAuthError(reason)) {
    return { action: "auth_recovery" };
  }

  // Startup grace period
  if (!host.hasEverConnected) {
    const elapsed = Date.now() - (host.pageLoadedAt || Date.now());
    if (elapsed < STARTUP_GRACE_PERIOD_MS) {
      host.startupWaiting = true;
      host.lastError = null;
      return { action: "suppress" };
    }
    host.startupWaiting = false;
  }

  host.lastError = errorMsg;
  return { action: "show_error" };
}

describe("UI 启动优雅期逻辑测试", () => {

  // =========================================================================
  // TC-01: 首次启动期间不显示红色错误
  // =========================================================================
  describe("TC-01: 首次启动优雅等待", () => {
    it("grace period 内 WebSocket 失败不设置 lastError", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: false,
        pageLoadedAt: Date.now() - 5_000, // 5 seconds ago
        lastError: null,
      };

      const result = simulateOnClose(host, 1006, "");

      expect(result.action).toBe("suppress");
      expect(host.lastError).toBeNull();
      expect(host.startupWaiting).toBe(true);
    });

    it("grace period 内多次失败都被抑制", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: false,
        pageLoadedAt: Date.now() - 30_000, // 30 seconds ago
        lastError: null,
      };

      // First failure
      simulateOnClose(host, 1006, "");
      expect(host.lastError).toBeNull();
      expect(host.startupWaiting).toBe(true);

      // Second failure (still within grace period)
      simulateOnClose(host, 1006, "ECONNREFUSED");
      expect(host.lastError).toBeNull();
      expect(host.startupWaiting).toBe(true);

      // Third failure at 90s (still within 120s)
      host.pageLoadedAt = Date.now() - 90_000;
      simulateOnClose(host, 1006, "connection refused");
      expect(host.lastError).toBeNull();
      expect(host.startupWaiting).toBe(true);
    });
  });

  // =========================================================================
  // TC-02: 120s 超时后显示错误
  // =========================================================================
  describe("TC-02: 120s 超时后显示错误", () => {
    it("grace period 过期后显示 lastError", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: true,
        pageLoadedAt: Date.now() - 121_000, // 121 seconds ago (past 120s)
        lastError: null,
      };

      const result = simulateOnClose(host, 1006, "connection refused");

      expect(result.action).toBe("show_error");
      expect(host.lastError).toContain("connection refused");
      expect(host.startupWaiting).toBe(false);
    });

    it("恰好 120s 边界时仍然抑制", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: false,
        pageLoadedAt: Date.now() - 119_999, // Just under 120s
        lastError: null,
      };

      const result = simulateOnClose(host, 1006, "");

      expect(result.action).toBe("suppress");
      expect(host.lastError).toBeNull();
    });
  });

  // =========================================================================
  // TC-03: Auth 错误立即显示
  // =========================================================================
  describe("TC-03: Auth 错误绕过 grace period", () => {
    it("token_missing 错误立即触发 auth recovery", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: true,
        pageLoadedAt: Date.now() - 5_000, // Well within grace period
        lastError: null,
      };

      const result = simulateOnClose(host, 4008, "unauthorized: gateway token missing");

      expect(result.action).toBe("auth_recovery");
    });

    it("token_mismatch 错误立即触发 auth recovery", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: true,
        pageLoadedAt: Date.now() - 3_000,
        lastError: null,
      };

      const result = simulateOnClose(host, 4008, "token_mismatch: expected abc got xyz");

      expect(result.action).toBe("auth_recovery");
    });

    it("invalid token 错误也触发 auth recovery", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: true,
        pageLoadedAt: Date.now() - 10_000,
        lastError: null,
      };

      const result = simulateOnClose(host, 4008, "Invalid Token provided");

      expect(result.action).toBe("auth_recovery");
    });

    it("非 auth 错误在 grace period 内被抑制", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: false,
        pageLoadedAt: Date.now() - 5_000,
        lastError: null,
      };

      const result = simulateOnClose(host, 1006, "connection reset");

      expect(result.action).toBe("suppress");
    });
  });

  // =========================================================================
  // TC-04: 已连接后断开显示红色错误
  // =========================================================================
  describe("TC-04: 已连接后断开", () => {
    it("hasEverConnected=true 时直接显示错误", () => {
      const host: MockHost = {
        connected: true,
        hasEverConnected: true,
        startupWaiting: false,
        pageLoadedAt: Date.now() - 5_000,
        lastError: null,
      };

      const result = simulateOnClose(host, 1006, "gateway crashed");

      expect(result.action).toBe("show_error");
      expect(host.lastError).toContain("gateway crashed");
      expect(host.connected).toBe(false);
    });

    it("hasEverConnected=true 即使在 120s 内也显示错误", () => {
      const host: MockHost = {
        connected: true,
        hasEverConnected: true,
        startupWaiting: false,
        pageLoadedAt: Date.now() - 10_000, // 10s (within grace period time)
        lastError: null,
      };

      const result = simulateOnClose(host, 1006, "server shutdown");

      // Grace period only applies when hasEverConnected is false
      expect(result.action).toBe("show_error");
      expect(host.lastError).toContain("server shutdown");
    });
  });

  // =========================================================================
  // TC-12: Code 1012 服务重启
  // =========================================================================
  describe("TC-12: Code 1012 服务重启", () => {
    it("code 1012 不设置 lastError", () => {
      const host: MockHost = {
        connected: true,
        hasEverConnected: true,
        startupWaiting: false,
        pageLoadedAt: Date.now() - 60_000,
        lastError: null,
      };

      const result = simulateOnClose(host, 1012, "Service Restart");

      expect(result.action).toBe("ignore_1012");
      expect(host.lastError).toBeNull();
    });
  });

  // =========================================================================
  // 边界条件
  // =========================================================================
  describe("边界条件", () => {
    it("pageLoadedAt 为 0 (falsy) 时回退到 Date.now()，grace period 仍然激活", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: false,
        pageLoadedAt: 0, // falsy → fallback to Date.now()
        lastError: null,
      };

      // pageLoadedAt=0 is falsy, so code falls back to Date.now(),
      // making elapsed=0, which means grace period is active.
      // This is safe because pageLoadedAt is always initialized in connectGateway.
      const result = simulateOnClose(host, 1006, "connection refused");

      expect(result.action).toBe("suppress");
    });

    it("pageLoadedAt 未设置时默认不崩溃", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: false,
        pageLoadedAt: 0,
        lastError: null,
      };

      // The code uses: Date.now() - (host.pageLoadedAt || Date.now())
      // When pageLoadedAt is 0 (falsy), it falls back to Date.now(), making elapsed = 0
      // This means the grace period would still be active!
      // Let's test the actual fallback behavior:
      const elapsed = Date.now() - (host.pageLoadedAt || Date.now());
      expect(elapsed).toBe(0); // 0 < 120000, so grace period is active

      // This is the actual behavior in app-gateway.ts line 334
      // pageLoadedAt=0 is falsy, fallback to Date.now() makes elapsed=0
      // => grace period active. This is safe because pageLoadedAt is always
      // initialized in connectGateway (line 254-256).
    });

    it("多次连接/断开循环正确切换状态", () => {
      const host: MockHost = {
        connected: false,
        hasEverConnected: false,
        startupWaiting: false,
        pageLoadedAt: Date.now() - 5_000,
        lastError: null,
      };

      // First close: grace period active
      let result = simulateOnClose(host, 1006, "");
      expect(result.action).toBe("suppress");
      expect(host.startupWaiting).toBe(true);

      // Simulate successful connection
      host.connected = true;
      host.hasEverConnected = true;
      host.startupWaiting = false;

      // Second close: after connection, show error
      result = simulateOnClose(host, 1006, "gateway restarted");
      expect(result.action).toBe("show_error");
      expect(host.lastError).toContain("gateway restarted");
    });
  });
});
