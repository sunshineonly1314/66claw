/**
 * TC-05/06/07/10/13: Gateway 启动优化 — License 验证逻辑单元测试
 *
 * 测试范围:
 * - TC-05: License 并行启动时序
 * - TC-06: License 验证失败时 fail-close 安全
 * - TC-07: _licensePending 期间 isLicenseValid() 返回 false
 * - TC-10: 非 CN 版本不受影响
 * - TC-13: getGatewayLicenseState() 在 pending 期间返回合成状态
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to mock dependencies BEFORE importing the module under test
vi.mock("../license/index.js", () => ({
  verifyLicenseOnStartup: vi.fn(),
  startTokenAutoRefresh: vi.fn(),
  stopTokenAutoRefresh: vi.fn(),
  hasValidToken: vi.fn().mockReturnValue(true),
  getTokenStatusSummary: vi
    .fn()
    .mockReturnValue({ hasToken: true, isValid: true, failureCount: 0 }),
  refreshToken: vi.fn(),
  loadLicenseCache: vi.fn().mockResolvedValue(null),
  DEFAULT_LICENSE_CONFIG: {
    apiBaseUrl: "https://www.obplugins.cn/api/api/v1/license",
  },
  LicenseErrorCode: {
    ERROR_KEY_NOT_FOUND: 1001,
    ERROR_KEY_EXPIRED: 1002,
    ERROR_KEY_REVOKED: 1003,
    ERROR_KEY_EXHAUSTED: 1008,
    ERROR_KEY_BINDBY_OTHER: 1005,
  },
}));

vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({ license: { key: "test-key-123" } }),
}));

vi.mock("../security/index.js", () => ({
  startAntiDebug: vi.fn(),
  stopAntiDebug: vi.fn(),
  checkIntegrityOnStartup: vi.fn().mockResolvedValue(true),
  startIntegrityPatrol: vi.fn(),
  stopIntegrityPatrol: vi.fn(),
  initAiTamperProtection: vi.fn(),
  verifyCheckpoint: vi.fn().mockImplementation((_name: string, fn: () => boolean) => fn()),
  registerProtectedFunction: vi.fn(),
  reportSecurityViolation: vi.fn(),
  recordViolation: vi.fn(),
}));

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}));

import {
  isLicenseCheckEnabled,
  checkLicenseOnGatewayStart,
  isLicenseValid,
  getGatewayLicenseState,
  updateGatewayLicenseState,
} from "./license-check.js";
import { verifyLicenseOnStartup } from "../license/index.js";
import type { OpenClawCNConfig } from "../config/config.js";

// Helper: create a minimal CN config
function cnConfig(overrides?: Partial<OpenClawCNConfig>): OpenClawCNConfig {
  return { license: { key: "test-key-123" }, ...overrides } as OpenClawCNConfig;
}

// Helper: create a non-CN config
function nonCnConfig(): OpenClawCNConfig {
  return {} as OpenClawCNConfig;
}

// Helper: reset global state between tests by setting a known valid state
function resetToValidState() {
  updateGatewayLicenseState({
    checking: false,
    valid: true,
    offlineMode: false,
    error: null,
    errorCode: null,
    license: {
      tier: "pro",
      daysRemaining: 30,
      expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      features: [],
    } as any,
    device: null,
    renewalReminder: null,
    forceUpdate: null,
    pendingNotifications: [],
    lastVerifiedAt: Date.now(),
    deviceSwitchInfo: null,
    deviceSwitchCooldown: null,
  });
}

function resetToNullState() {
  // Unfortunately we can't directly set globalLicenseState to null from outside,
  // but we can observe behavior. For non-CN tests, the state starts as null.
}

describe("Gateway 启动优化 — License 验证测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars
    delete process.env.OPENCLAWCN_CN;
    delete process.env.OPENCLAWCN_REGION;
  });

  // =========================================================================
  // TC-10: 非 CN 版本不受影响
  // =========================================================================
  describe("TC-10: isLicenseCheckEnabled — 非 CN 版本", () => {
    it("无 license key、无环境变量时返回 false", () => {
      expect(isLicenseCheckEnabled(nonCnConfig())).toBe(false);
    });

    it("有 license.key 时返回 true", () => {
      expect(isLicenseCheckEnabled(cnConfig())).toBe(true);
    });

    it("OPENCLAWCN_CN=1 时返回 true", () => {
      process.env.OPENCLAWCN_CN = "1";
      expect(isLicenseCheckEnabled(nonCnConfig())).toBe(true);
    });

    it("OPENCLAWCN_REGION=cn 时返回 true", () => {
      process.env.OPENCLAWCN_REGION = "cn";
      expect(isLicenseCheckEnabled(nonCnConfig())).toBe(true);
    });

    it("非 CN 版本 checkLicenseOnGatewayStart 直接返回 null", async () => {
      const result = await checkLicenseOnGatewayStart(nonCnConfig());
      expect(result).toBeNull();
      expect(verifyLicenseOnStartup).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TC-07: _licensePending 期间 isLicenseValid() 返回 false
  // =========================================================================
  describe("TC-07: _licensePending 期间 isLicenseValid", () => {
    it("验证进行中时 isLicenseValid 返回 false", async () => {
      // Setup: make verifyLicenseOnStartup hang to simulate slow network
      let resolveVerify!: (value: any) => void;
      const verifyPromise = new Promise((resolve) => {
        resolveVerify = resolve;
      });
      vi.mocked(verifyLicenseOnStartup).mockReturnValue(verifyPromise as any);

      // Start license check (don't await)
      const licensePromise = checkLicenseOnGatewayStart(cnConfig(), { skipIntegrity: true });

      // While pending: isLicenseValid should return false
      expect(isLicenseValid()).toBe(false);

      // Resolve the verify
      resolveVerify({
        canProceed: true,
        valid: true,
        offlineMode: false,
        deviceId: "test-device",
        nextCheckAfterHours: 24,
        error: null,
        errorCode: null,
        response: null,
        clientState: {
          checking: false,
          valid: true,
          offlineMode: false,
          error: null,
          errorCode: null,
          license: {
            tier: "pro",
            daysRemaining: 30,
            expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
            features: [],
          },
          device: null,
          renewalReminder: null,
          forceUpdate: null,
          pendingNotifications: [],
          lastVerifiedAt: Date.now(),
          deviceSwitchInfo: null,
          deviceSwitchCooldown: null,
        },
      });

      await licensePromise;

      // After completion: isLicenseValid should return true
      expect(isLicenseValid()).toBe(true);
    });
  });

  // =========================================================================
  // TC-13: getGatewayLicenseState() pending 期间返回合成状态
  // =========================================================================
  describe("TC-13: getGatewayLicenseState pending 状态", () => {
    it("验证进行中返回 checking: true 的合成状态", async () => {
      let resolveVerify!: (value: any) => void;
      const verifyPromise = new Promise((resolve) => {
        resolveVerify = resolve;
      });
      vi.mocked(verifyLicenseOnStartup).mockReturnValue(verifyPromise as any);

      const licensePromise = checkLicenseOnGatewayStart(cnConfig(), { skipIntegrity: true });

      // During pending
      const pendingState = getGatewayLicenseState();
      expect(pendingState).not.toBeNull();
      expect(pendingState!.checking).toBe(true);
      expect(pendingState!.valid).toBe(false);
      expect(pendingState!.error).toBe("授权验证中，请稍候...");

      // Resolve
      resolveVerify({
        canProceed: true,
        valid: true,
        offlineMode: false,
        deviceId: "test-device",
        nextCheckAfterHours: 24,
        error: null,
        errorCode: null,
        response: null,
        clientState: {
          checking: false,
          valid: true,
          offlineMode: false,
          error: null,
          errorCode: null,
          license: null,
          device: null,
          renewalReminder: null,
          forceUpdate: null,
          pendingNotifications: [],
          lastVerifiedAt: Date.now(),
          deviceSwitchInfo: null,
          deviceSwitchCooldown: null,
        },
      });

      await licensePromise;

      // After completion
      const completedState = getGatewayLicenseState();
      expect(completedState!.checking).toBe(false);
      expect(completedState!.valid).toBe(true);
    });

    it("合成状态包含所有必要字段（不会导致 UI 崩溃）", async () => {
      let resolveVerify!: (value: any) => void;
      vi.mocked(verifyLicenseOnStartup).mockReturnValue(
        new Promise((resolve) => {
          resolveVerify = resolve;
        }) as any,
      );

      const licensePromise = checkLicenseOnGatewayStart(cnConfig(), { skipIntegrity: true });

      const state = getGatewayLicenseState()!;
      // Verify all required fields exist
      expect(state).toHaveProperty("checking");
      expect(state).toHaveProperty("valid");
      expect(state).toHaveProperty("offlineMode");
      expect(state).toHaveProperty("error");
      expect(state).toHaveProperty("errorCode");
      expect(state).toHaveProperty("license");
      expect(state).toHaveProperty("device");
      expect(state).toHaveProperty("renewalReminder");
      expect(state).toHaveProperty("forceUpdate");
      expect(state).toHaveProperty("pendingNotifications");
      expect(state).toHaveProperty("lastVerifiedAt");
      expect(state).toHaveProperty("deviceSwitchInfo");
      expect(state).toHaveProperty("deviceSwitchCooldown");

      // Cleanup
      resolveVerify({
        canProceed: true,
        valid: true,
        offlineMode: false,
        deviceId: "d",
        nextCheckAfterHours: 24,
        error: null,
        errorCode: null,
        response: null,
        clientState: {
          checking: false,
          valid: true,
          offlineMode: false,
          error: null,
          errorCode: null,
          license: null,
          device: null,
          renewalReminder: null,
          forceUpdate: null,
          pendingNotifications: [],
          lastVerifiedAt: null,
          deviceSwitchInfo: null,
          deviceSwitchCooldown: null,
        },
      });
      await licensePromise;
    });
  });

  // =========================================================================
  // TC-06: License 验证失败 — fail-close
  // =========================================================================
  describe("TC-06: 验证异常时 fail-close", () => {
    it("verifyLicenseOnStartup 抛异常时 isLicenseValid 返回 false", async () => {
      vi.mocked(verifyLicenseOnStartup).mockRejectedValue(
        new Error("Network timeout: license server unreachable"),
      );

      const result = await checkLicenseOnGatewayStart(cnConfig(), { skipIntegrity: true });

      // Should return a failure result
      expect(result).not.toBeNull();
      expect(result!.canProceed).toBe(false);
      expect(result!.valid).toBe(false);
      expect(result!.error).toContain("Network timeout");

      // Critical: isLicenseValid must return false (not true!)
      expect(isLicenseValid()).toBe(false);

      // State should reflect the error
      const state = getGatewayLicenseState();
      expect(state).not.toBeNull();
      expect(state!.valid).toBe(false);
      expect(state!.checking).toBe(false);
      expect(state!.error).toContain("Network timeout");
    });

    it("异常后 _licensePending 被清除（finally 块）", async () => {
      vi.mocked(verifyLicenseOnStartup).mockRejectedValue(new Error("boom"));

      await checkLicenseOnGatewayStart(cnConfig(), { skipIntegrity: true });

      // getGatewayLicenseState should NOT return the synthetic pending state
      const state = getGatewayLicenseState();
      expect(state!.checking).toBe(false); // not true (pending cleared)
    });

    it("异常返回的 clientState 包含完整字段", async () => {
      vi.mocked(verifyLicenseOnStartup).mockRejectedValue(new Error("test error"));

      const result = await checkLicenseOnGatewayStart(cnConfig(), { skipIntegrity: true });

      const cs = result!.clientState;
      expect(cs.checking).toBe(false);
      expect(cs.valid).toBe(false);
      expect(cs.offlineMode).toBe(false);
      expect(cs.error).toContain("test error");
      expect(cs.errorCode).toBeNull();
      expect(cs.license).toBeNull();
      expect(cs.device).toBeNull();
      expect(cs.renewalReminder).toBeNull();
      expect(cs.forceUpdate).toBeNull();
      expect(cs.pendingNotifications).toEqual([]);
      expect(cs.lastVerifiedAt).toBeNull();
      expect(cs.deviceSwitchInfo).toBeNull();
      expect(cs.deviceSwitchCooldown).toBeNull();
    });
  });

  // =========================================================================
  // TC-05: skipIntegrity 参数正确传递
  // =========================================================================
  describe("TC-05: skipIntegrity 选项", () => {
    it("skipIntegrity=true 时不调用 checkIntegrityOnStartup", async () => {
      const { checkIntegrityOnStartup } = await import("../security/index.js");
      vi.mocked(verifyLicenseOnStartup).mockResolvedValue({
        canProceed: true,
        valid: true,
        offlineMode: false,
        deviceId: "d",
        nextCheckAfterHours: 24,
        error: null,
        errorCode: null,
        response: null,
        clientState: {
          checking: false,
          valid: true,
          offlineMode: false,
          error: null,
          errorCode: null,
          license: null,
          device: null,
          renewalReminder: null,
          forceUpdate: null,
          pendingNotifications: [],
          lastVerifiedAt: null,
          deviceSwitchInfo: null,
          deviceSwitchCooldown: null,
        },
      } as any);

      vi.mocked(checkIntegrityOnStartup).mockClear();
      await checkLicenseOnGatewayStart(cnConfig(), { skipIntegrity: true });

      expect(checkIntegrityOnStartup).not.toHaveBeenCalled();
    });

    it("skipIntegrity 未设置时调用 checkIntegrityOnStartup", async () => {
      const { checkIntegrityOnStartup } = await import("../security/index.js");
      vi.mocked(verifyLicenseOnStartup).mockResolvedValue({
        canProceed: true,
        valid: true,
        offlineMode: false,
        deviceId: "d",
        nextCheckAfterHours: 24,
        error: null,
        errorCode: null,
        response: null,
        clientState: {
          checking: false,
          valid: true,
          offlineMode: false,
          error: null,
          errorCode: null,
          license: null,
          device: null,
          renewalReminder: null,
          forceUpdate: null,
          pendingNotifications: [],
          lastVerifiedAt: null,
          deviceSwitchInfo: null,
          deviceSwitchCooldown: null,
        },
      } as any);

      vi.mocked(checkIntegrityOnStartup).mockClear();
      await checkLicenseOnGatewayStart(cnConfig());

      expect(checkIntegrityOnStartup).toHaveBeenCalledWith(
        expect.objectContaining({ exitOnFailure: true }),
      );
    });
  });

  // =========================================================================
  // TC-07 附加: chat.send 集成场景 — pending 期间错误信息
  // =========================================================================
  describe("TC-07 附加: pending 期间 chat.send 错误信息语义", () => {
    it("pending 期间 getGatewayLicenseState().error 应显示验证中提示（非无效提示）", async () => {
      let resolveVerify!: (value: any) => void;
      vi.mocked(verifyLicenseOnStartup).mockReturnValue(
        new Promise((resolve) => {
          resolveVerify = resolve;
        }) as any,
      );

      const licensePromise = checkLicenseOnGatewayStart(cnConfig(), { skipIntegrity: true });

      // Simulate what chat.send does:
      const valid = isLicenseValid();
      expect(valid).toBe(false);

      const licenseState = getGatewayLicenseState();
      const errorMsg = licenseState?.error || "授权无效，请先激活或续费";

      // The error message should say "验证中" not "无效"
      expect(errorMsg).toContain("验证中");
      expect(errorMsg).not.toContain("无效");

      // Cleanup
      resolveVerify({
        canProceed: true,
        valid: true,
        offlineMode: false,
        deviceId: "d",
        nextCheckAfterHours: 24,
        error: null,
        errorCode: null,
        response: null,
        clientState: {
          checking: false,
          valid: true,
          offlineMode: false,
          error: null,
          errorCode: null,
          license: null,
          device: null,
          renewalReminder: null,
          forceUpdate: null,
          pendingNotifications: [],
          lastVerifiedAt: null,
          deviceSwitchInfo: null,
          deviceSwitchCooldown: null,
        },
      });
      await licensePromise;
    });
  });
});
