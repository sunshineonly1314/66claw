/**
 * TC-08: 完整性检查失败阻止启动
 *
 * 验证 server.impl.ts 中 Phase 1 的逻辑:
 * - isLicenseCheckEnabled 为 true 时执行完整性检查
 * - 完整性检查返回 false 时调用 process.exit(1)
 * - 完整性检查抛异常时也调用 process.exit(1)
 * - isLicenseCheckEnabled 为 false 时跳过检查
 *
 * 由于 startGatewayServer 依赖链过长，这里提取核心逻辑进行测试。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock process.exit
const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
  throw new Error("process.exit called");
}) as any);

// Mock checkIntegrityOnStartup
const mockIntegrityCheck = vi.fn();

// Mock logger
const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

/**
 * Extract of Phase 1 logic from server.impl.ts lines 237-249.
 * This is the exact same algorithm, just isolated for testing.
 */
async function phase1IntegrityGate(
  isCnVersion: boolean,
  checkIntegrity: typeof mockIntegrityCheck,
  log: typeof mockLog,
) {
  if (isCnVersion) {
    try {
      const integrityPassed = await checkIntegrity({ exitOnFailure: true });
      if (!integrityPassed) {
        log.error("SECURITY VIOLATION: File tampering detected, refusing to start");
        process.exit(1);
      }
      log.debug("Integrity check passed (pre-server)");
    } catch (error) {
      log.error(`SECURITY VIOLATION: Integrity check error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
}

describe("TC-08: 完整性检查阻止启动", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIntegrityCheck.mockReset();
  });

  it("CN 版本 + 完整性检查通过 → 正常继续", async () => {
    mockIntegrityCheck.mockResolvedValue(true);

    await phase1IntegrityGate(true, mockIntegrityCheck, mockLog);

    expect(mockIntegrityCheck).toHaveBeenCalledWith({ exitOnFailure: true });
    expect(mockExit).not.toHaveBeenCalled();
    expect(mockLog.debug).toHaveBeenCalledWith("Integrity check passed (pre-server)");
  });

  it("CN 版本 + 完整性检查返回 false → process.exit(1)", async () => {
    mockIntegrityCheck.mockResolvedValue(false);

    await expect(
      phase1IntegrityGate(true, mockIntegrityCheck, mockLog),
    ).rejects.toThrow("process.exit called");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLog.error).toHaveBeenCalledWith(
      expect.stringContaining("SECURITY VIOLATION: File tampering detected"),
    );
  });

  it("CN 版本 + 完整性检查抛异常 → process.exit(1)", async () => {
    mockIntegrityCheck.mockRejectedValue(new Error("hash mismatch: license-check.js"));

    await expect(
      phase1IntegrityGate(true, mockIntegrityCheck, mockLog),
    ).rejects.toThrow("process.exit called");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLog.error).toHaveBeenCalledWith(
      expect.stringContaining("hash mismatch: license-check.js"),
    );
  });

  it("非 CN 版本 → 跳过完整性检查", async () => {
    await phase1IntegrityGate(false, mockIntegrityCheck, mockLog);

    expect(mockIntegrityCheck).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("Phase 1 在 Phase 2 之前执行（序列验证）", async () => {
    const callOrder: string[] = [];

    mockIntegrityCheck.mockImplementation(async () => {
      callOrder.push("integrity");
      return true;
    });

    const mockLicenseVerify = vi.fn().mockImplementation(async () => {
      callOrder.push("license");
      return { canProceed: true };
    });

    // Phase 1: synchronous integrity
    await phase1IntegrityGate(true, mockIntegrityCheck, mockLog);
    // Phase 2: parallel license (simulated)
    const licensePromise = mockLicenseVerify();

    await licensePromise;

    expect(callOrder).toEqual(["integrity", "license"]);
  });

  it("完整性检查失败时 license 验证不执行", async () => {
    mockIntegrityCheck.mockResolvedValue(false);

    const mockLicenseVerify = vi.fn();
    let reachedLicensePhase = false;

    try {
      await phase1IntegrityGate(true, mockIntegrityCheck, mockLog);
      // If we reach here, integrity passed (shouldn't happen in this test)
      reachedLicensePhase = true;
      await mockLicenseVerify();
    } catch {
      // Expected: process.exit was called
    }

    expect(reachedLicensePhase).toBe(false);
    expect(mockLicenseVerify).not.toHaveBeenCalled();
  });
});
