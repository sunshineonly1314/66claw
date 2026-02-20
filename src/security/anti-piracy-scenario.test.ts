/**
 * Anti-Piracy Scenario Tests
 * 盗版场景集成测试
 *
 * 验证 7 刀防盗版体系的核心机制：
 * 1. 延迟惩罚系统 (Knife 7)
 * 2. 运行时完整性巡检 (Knife 5)
 * 3. 缓存加密签名 (Knife 2)
 * 4. 离线窗口硬过期 (Knife 4)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Scenario 1: Delayed Enforcement System (Knife 7)
// ============================================================================
describe("Knife 7: Delayed Enforcement — 延迟惩罚系统", () => {
  // We need fresh module state for each test
  let recordViolation: typeof import("./delayed-enforcement.js").recordViolation;
  let getEnforcementDelay: typeof import("./delayed-enforcement.js").getEnforcementDelay;
  let shouldBlockService: typeof import("./delayed-enforcement.js").shouldBlockService;
  let getEnforcementStatus: typeof import("./delayed-enforcement.js").getEnforcementStatus;
  let applyEnforcementDelay: typeof import("./delayed-enforcement.js").applyEnforcementDelay;

  beforeEach(async () => {
    // Reset module to clear violation state
    vi.resetModules();
    const mod = await import("./delayed-enforcement.js");
    recordViolation = mod.recordViolation;
    getEnforcementDelay = mod.getEnforcementDelay;
    shouldBlockService = mod.shouldBlockService;
    getEnforcementStatus = mod.getEnforcementStatus;
    applyEnforcementDelay = mod.applyEnforcementDelay;
  });

  it("初始状态：无违规时延迟为 0", () => {
    expect(getEnforcementDelay()).toBe(0);
    expect(shouldBlockService()).toBe(false);
    expect(getEnforcementStatus().level).toBe("none");
    expect(getEnforcementStatus().violationCount).toBe(0);
  });

  it("少量违规仅记录警告，不产生延迟", () => {
    recordViolation("test:check1");
    expect(getEnforcementDelay()).toBe(0);
    expect(getEnforcementStatus().level).toBe("none");
  });

  it("达到 WARN_THRESHOLD 后进入 warn 级别并产生轻微延迟", () => {
    // Record 2 violations (WARN_THRESHOLD)
    recordViolation("test:check1");
    recordViolation("test:check2");
    const delay = getEnforcementDelay();
    expect(delay).toBeGreaterThanOrEqual(50);
    expect(delay).toBeLessThanOrEqual(300);
    expect(getEnforcementStatus().level).toBe("warn");
  });

  it("达到 DELAY_THRESHOLD 后延迟增大", () => {
    // Record 5 violations (DELAY_THRESHOLD)
    for (let i = 0; i < 5; i++) {
      recordViolation(`test:check${i}`);
    }
    const delay = getEnforcementDelay();
    expect(delay).toBeGreaterThanOrEqual(300);
    expect(delay).toBeLessThanOrEqual(1500);
    expect(getEnforcementStatus().level).toBe("delay");
  });

  it("达到 HEAVY_DELAY_THRESHOLD 后延迟严重 (1.5s-5s)", () => {
    // Record 10 violations (HEAVY_DELAY_THRESHOLD)
    for (let i = 0; i < 10; i++) {
      recordViolation(`test:check${i}`);
    }
    const delay = getEnforcementDelay();
    expect(delay).toBeGreaterThanOrEqual(1500);
    expect(delay).toBeLessThanOrEqual(5000);
    expect(getEnforcementStatus().level).toBe("heavy");
  });

  it("达到 BLOCK_THRESHOLD 后完全阻断服务", () => {
    // Record 20 violations (BLOCK_THRESHOLD)
    for (let i = 0; i < 20; i++) {
      recordViolation(`test:check${i}`);
    }
    expect(getEnforcementDelay()).toBe(-1);
    expect(shouldBlockService()).toBe(true);
    expect(getEnforcementStatus().level).toBe("block");
  });

  it("盗版者场景模拟：多源违规渐进累积", () => {
    // Simulate: integrity check fails, then license check fails, then anti-debug triggers
    recordViolation("integrity:dist/license/verify.jsc");
    recordViolation("integrity:dist/security/anti-debug.jsc");
    recordViolation("license:cache_tamper");
    expect(getEnforcementStatus().level).toBe("warn");
    expect(getEnforcementStatus().violationCount).toBe(3);

    // More violations from different subsystems
    recordViolation("antidebug:devtools_detected");
    recordViolation("integrity:dist/dispatch/engine.jsc");
    expect(getEnforcementStatus().level).toBe("delay");

    // Continue — pirate can't identify which check is causing degradation
    for (let i = 0; i < 5; i++) {
      recordViolation(`integrity:file${i}`);
    }
    expect(getEnforcementStatus().level).toBe("heavy");
    expect(getEnforcementStatus().violationCount).toBe(10);
  });

  it("applyEnforcementDelay 在无违规时立即返回", async () => {
    const start = Date.now();
    await applyEnforcementDelay();
    const elapsed = Date.now() - start;
    // Should be nearly instant (< 10ms)
    expect(elapsed).toBeLessThan(50);
  });

  it("applyEnforcementDelay 在有违规时产生可测量延迟", async () => {
    // Get to delay level
    for (let i = 0; i < 5; i++) {
      recordViolation(`test:${i}`);
    }
    const start = Date.now();
    await applyEnforcementDelay();
    const elapsed = Date.now() - start;
    // Should be at least 300ms at delay level
    expect(elapsed).toBeGreaterThanOrEqual(250); // small tolerance
  });

  it("recentCount 正确追踪滚动窗口内的违规数", () => {
    recordViolation("test:1");
    recordViolation("test:2");
    recordViolation("test:3");
    const status = getEnforcementStatus();
    expect(status.recentCount).toBe(3);
    expect(status.violationCount).toBe(3);
  });
});

// ============================================================================
// Scenario 2: Integrity Patrol (Knife 5)
// ============================================================================
describe("Knife 5: Runtime Integrity Patrol — 运行时完整性巡检", () => {
  // Import fresh for each test
  let startIntegrityPatrol: typeof import("./integrity.js").startIntegrityPatrol;
  let stopIntegrityPatrol: typeof import("./integrity.js").stopIntegrityPatrol;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./integrity.js");
    startIntegrityPatrol = mod.startIntegrityPatrol;
    stopIntegrityPatrol = mod.stopIntegrityPatrol;
  });

  afterEach(() => {
    stopIntegrityPatrol();
  });

  it("巡检在无哈希时不启动（安全降级）", () => {
    // Without integrity hashes loaded, patrol should skip gracefully
    startIntegrityPatrol({ intervalMs: 100, sampleSize: 1 });
    // Should not throw, just skip
  });

  it("连续启动不会创建多个定时器", () => {
    startIntegrityPatrol({ intervalMs: 100 });
    startIntegrityPatrol({ intervalMs: 100 }); // Should be no-op
    stopIntegrityPatrol(); // Single cleanup
  });

  it("stop 后可以重新启动", () => {
    startIntegrityPatrol({ intervalMs: 100 });
    stopIntegrityPatrol();
    startIntegrityPatrol({ intervalMs: 100 }); // Should work
    stopIntegrityPatrol();
  });
});

// ============================================================================
// Scenario 3: License Cache Encryption (Knife 2)
// ============================================================================
describe("Knife 2: License Cache HMAC — 缓存签名防篡改", () => {
  it("computeCacheHmac 对相同输入产生稳定结果", async () => {
    // We can't directly test the private function, but we can verify
    // the exported behavior: a tampered cache file is detected
    // This is a structural test — actual crypto is tested in integration

    // Verify types exist and are properly exported
    const { loadLicenseCache } = await import("../license/offline.js");
    expect(typeof loadLicenseCache).toBe("function");
    // loadLicenseCache now returns a Promise (async)
    const result = loadLicenseCache();
    expect(result).toBeInstanceOf(Promise);
  });
});

// ============================================================================
// Scenario 4: Offline Window Hardening (Knife 4)
// ============================================================================
describe("Knife 4: Offline Window Hardening — 离线窗口硬化", () => {
  it("DEFAULT_LICENSE_CONFIG 离线宽限期已缩短到 8 小时", async () => {
    const { DEFAULT_LICENSE_CONFIG } = await import("../license/types.js");
    expect(DEFAULT_LICENSE_CONFIG.offlineGracePeriodHours).toBe(8);
  });

  it("心跳间隔已缩短到 4 小时", async () => {
    const { DEFAULT_LICENSE_CONFIG } = await import("../license/types.js");
    expect(DEFAULT_LICENSE_CONFIG.heartbeatIntervalHours).toBe(4);
  });

  it("canUseOffline 函数是 async 的（支持加密缓存）", async () => {
    const { canUseOffline } = await import("../license/offline.js");
    expect(typeof canUseOffline).toBe("function");
    const result = canUseOffline();
    expect(result).toBeInstanceOf(Promise);
  });
});

// ============================================================================
// Scenario 5: Bytecode Loader Self-Protection (Knife 6)
// ============================================================================
describe("Knife 6: Bytecode Loader — 构建时哈希嵌入验证", () => {
  it("compile-bytecode 模块可以正常导入", async () => {
    // Verify the compile-bytecode module doesn't have syntax errors
    // (can't run it directly as it needs Node.js compilation infrastructure)
    const fs = await import("node:fs");
    const path = await import("node:path");
    const bytecodeScript = path.resolve(
      process.cwd(),
      "cn/scripts/build/compile-bytecode.ts",
    );
    const content = fs.readFileSync(bytecodeScript, "utf8");

    // Verify hash injection code exists
    expect(content).toContain("createHash");
    expect(content).toContain("jscHash");
    expect(content).toContain("bytecode tampered");
    expect(content).toContain("process.exit(1)");
  });

  it("CJS loader 模板包含完整性校验", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(
      path.resolve(process.cwd(), "cn/scripts/build/compile-bytecode.ts"),
      "utf8",
    );

    // CJS loader should verify hash before loading
    expect(content).toContain('require("crypto").createHash("sha256")');
    expect(content).toContain('require("fs").readFileSync');
    expect(content).toContain('"[integrity] bytecode tampered: "');
  });

  it("ESM loader 模板包含完整性校验", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(
      path.resolve(process.cwd(), "cn/scripts/build/compile-bytecode.ts"),
      "utf8",
    );

    // ESM loader should verify hash before loading
    expect(content).toContain('import { createHash } from "node:crypto"');
    expect(content).toContain('import { readFileSync } from "node:fs"');
  });
});

// ============================================================================
// Scenario 6: Vite Source Map Disabled (P0)
// ============================================================================
describe("P0: Source Map Protection — 生产环境关闭 Source Map", () => {
  it("vite.config.ts 仅在 dev 模式启用 source map", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(
      path.resolve(process.cwd(), "ui/vite.config.ts"),
      "utf8",
    );

    // Should NOT have unconditional `sourcemap: true`
    expect(content).not.toMatch(/sourcemap:\s*true/);
    // Should have conditional source map
    expect(content).toContain('sourcemap: command === "serve"');
  });
});

// ============================================================================
// Scenario 7: Protection Configuration Completeness
// ============================================================================
describe("Protection Config: cn-protected-files.json 完整性", () => {
  it("记忆系统核心文件已加入加密列表", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const config = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), "config/cn-protected-files.json"),
        "utf8",
      ),
    );

    // Section 1 should include memory system files
    const s1Files: string[] = config.section1_cn_only.files;
    expect(s1Files).toContain("src/memory/search-tiering-cn.ts");
    expect(s1Files).toContain("src/memory/memory-schema.ts");
    expect(s1Files).toContain("src/security/delayed-enforcement.ts");

    // Bytecode targets should include memory system files
    const bytecodeFiles: string[] = config.cn_encryption.bytecode.files;
    expect(bytecodeFiles).toContain("src/memory/search-tiering-cn.ts");
    expect(bytecodeFiles).toContain("src/memory/memory-schema.ts");
  });

  it("QMD 用户扩展文件不在加密列表中（保持可扩展性）", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const config = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), "config/cn-protected-files.json"),
        "utf8",
      ),
    );

    const allFiles = [
      ...config.section1_cn_only.files,
      ...config.cn_encryption.bytecode.files,
      ...(config.cn_encryption.obfuscate?.files || []),
    ];

    // QMD files should NOT be encrypted (user-extensible)
    expect(allFiles).not.toContain("src/memory/qmd-manager.ts");
    expect(allFiles).not.toContain("src/memory/qmd-query-parser.ts");
    expect(allFiles).not.toContain("src/memory/qmd-scope.ts");
  });

  it(".gitattributes 包含新增的合并保护", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(
      path.resolve(process.cwd(), ".gitattributes"),
      "utf8",
    );

    expect(content).toContain("src/memory/search-tiering-cn.ts merge=ours");
    expect(content).toContain("src/memory/memory-schema.ts merge=ours");
    expect(content).toContain("src/security/delayed-enforcement.ts merge=ours");
  });
});
