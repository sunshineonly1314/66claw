/**
 * OpenClawCN Security Module - Process Integrity Verification
 * 进程完整性自检
 *
 * 检测运行时环境是否被篡改：
 * 1. 检测 DLL/SO 注入（LD_PRELOAD, DYLD_INSERT_LIBRARIES）
 * 2. 检测 Frida、Xposed 等注入框架
 * 3. 检测虚拟机/沙箱环境
 * 4. 定期自检
 */

import { readFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { execFileSync } from "node:child_process";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("security:process-integrity");

// ============================================================================
// Types
// ============================================================================

export interface ProcessIntegrityResult {
  /** 是否通过所有检查 */
  valid: boolean;
  /** 检测到的问题列表 */
  issues: string[];
  /** 是否在虚拟机中运行 */
  isVM: boolean;
  /** 是否检测到注入 */
  hasInjection: boolean;
}

// ============================================================================
// Injection Detection
// ============================================================================

/**
 * 检测 library 注入（LD_PRELOAD / DYLD_INSERT_LIBRARIES）
 * 这是最常见的运行时 hooking 手段
 */
function detectLibraryInjection(): string[] {
  const issues: string[] = [];

  // Linux: LD_PRELOAD
  if (process.env.LD_PRELOAD) {
    issues.push(`LD_PRELOAD detected: ${process.env.LD_PRELOAD}`);
  }

  // macOS: DYLD_INSERT_LIBRARIES
  if (process.env.DYLD_INSERT_LIBRARIES) {
    issues.push(`DYLD_INSERT_LIBRARIES detected: ${process.env.DYLD_INSERT_LIBRARIES}`);
  }

  // macOS: DYLD_FORCE_FLAT_NAMESPACE (used for hooking)
  if (process.env.DYLD_FORCE_FLAT_NAMESPACE) {
    issues.push("DYLD_FORCE_FLAT_NAMESPACE detected");
  }

  // Node.js: --require / --import / --loader injection
  if (process.env.NODE_OPTIONS) {
    const opts = process.env.NODE_OPTIONS;
    if (opts.includes("--require") || opts.includes("-r ")) {
      issues.push(`NODE_OPTIONS contains --require: ${opts}`);
    }
    if (opts.includes("--import")) {
      issues.push(`NODE_OPTIONS contains --import: ${opts}`);
    }
    if (opts.includes("--loader") || opts.includes("--experimental-loader")) {
      issues.push(`NODE_OPTIONS contains --loader: ${opts}`);
    }
    if (opts.includes("--experimental-policy")) {
      issues.push(`NODE_OPTIONS contains --experimental-policy: ${opts}`);
    }
  }

  // Electron: ELECTRON_RUN_AS_NODE bypasses sandbox
  if (process.env.ELECTRON_RUN_AS_NODE) {
    issues.push("ELECTRON_RUN_AS_NODE detected — Electron sandbox bypassed");
  }

  return issues;
}

/**
 * 检测已知的注入框架
 */
function detectInjectionFrameworks(): string[] {
  const issues: string[] = [];

  if (process.platform === "win32") {
    // Windows: check for known DLLs in current process
    try {
      // [SECURITY FIX] Use execFileSync with array args — no shell interpolation
      const output = execFileSync("tasklist", ["/M", "/FI", `PID eq ${process.pid}`], {
        encoding: "utf8",
        timeout: 5000,
      }).toLowerCase();

      const suspiciousDlls = ["frida", "xposed", "substrate", "apimonitor", "easyhook", "deviare"];

      for (const dll of suspiciousDlls) {
        if (output.includes(dll)) {
          issues.push(`Suspicious DLL detected: ${dll}`);
        }
      }
    } catch {
      // tasklist might fail in restricted environments
    }
  }

  if (process.platform === "linux") {
    // Linux: check /proc/self/maps for injected libraries
    try {
      const maps = readFileSync("/proc/self/maps", "utf8");

      const suspiciousLibs = ["frida", "xposed", "substrate", "cydia"];

      for (const lib of suspiciousLibs) {
        if (maps.toLowerCase().includes(lib)) {
          issues.push(`Suspicious library mapped: ${lib}`);
        }
      }
    } catch {
      // /proc may not be available
    }
  }

  return issues;
}

// ============================================================================
// VM / Sandbox Detection
// ============================================================================

/**
 * 检测虚拟机环境
 * 注意：虚拟机不一定意味着恶意使用，仅作为风险指标
 */
function detectVirtualMachine(): { isVM: boolean; indicators: string[] } {
  const indicators: string[] = [];

  // Check CPU model for VM keywords
  const cpu = cpus()[0];
  if (cpu) {
    const model = cpu.model.toLowerCase();
    const vmKeywords = ["virtual", "vmware", "vbox", "qemu", "xen", "hyperv", "kvm", "parallels"];
    for (const kw of vmKeywords) {
      if (model.includes(kw)) {
        indicators.push(`CPU model contains "${kw}": ${cpu.model}`);
      }
    }
  }

  // Check for very low memory (< 2GB suggests sandbox)
  const totalMemGB = totalmem() / (1024 * 1024 * 1024);
  if (totalMemGB < 2) {
    indicators.push(`Very low memory: ${totalMemGB.toFixed(1)} GB`);
  }

  // Windows-specific VM detection (using PowerShell CIM; wmic is deprecated since Win10 21H1)
  if (process.platform === "win32") {
    try {
      // [SECURITY FIX] Use execFileSync with array args — fully hardcoded, no injection risk,
      // but using array form is consistent with the secure pattern used elsewhere.
      const psScript =
        "Get-CimInstance Win32_BIOS | Select-Object -ExpandProperty Manufacturer; " +
        "Get-CimInstance Win32_BIOS | Select-Object -ExpandProperty SerialNumber";
      const encoded = Buffer.from(psScript, "utf16le").toString("base64");
      const bios = execFileSync(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
        { encoding: "utf8", timeout: 5000 },
      ).toLowerCase();

      const vmBiosKeywords = ["vmware", "virtualbox", "vbox", "qemu", "xen", "parallels"];
      for (const kw of vmBiosKeywords) {
        if (bios.includes(kw)) {
          indicators.push(`BIOS contains "${kw}"`);
        }
      }
    } catch {
      // PowerShell/CIM might fail in restricted environments
    }
  }

  return {
    isVM: indicators.length > 0,
    indicators,
  };
}

// ============================================================================
// Main Check
// ============================================================================

/**
 * 执行完整的进程完整性检查
 */
export function checkProcessIntegrity(): ProcessIntegrityResult {
  const issues: string[] = [];

  // 1. Library injection detection
  const injectionIssues = detectLibraryInjection();
  issues.push(...injectionIssues);

  // 2. Injection framework detection
  const frameworkIssues = detectInjectionFrameworks();
  issues.push(...frameworkIssues);

  // 3. VM detection (informational, not blocking)
  const vmResult = detectVirtualMachine();

  const hasInjection = injectionIssues.length > 0 || frameworkIssues.length > 0;

  if (issues.length > 0) {
    log.warn("Process integrity issues detected", { issues });
  } else {
    log.debug("Process integrity check passed");
  }

  if (vmResult.isVM) {
    log.debug("VM environment detected", { indicators: vmResult.indicators });
  }

  return {
    valid: issues.length === 0,
    issues,
    isVM: vmResult.isVM,
    hasInjection,
  };
}

// ============================================================================
// Periodic Monitoring
// ============================================================================

let monitorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 启动进程完整性监控
 *
 * @param intervalMs - 检查间隔（毫秒），默认 60 秒
 * @param onViolation - 检测到问题时的回调
 */
export function startProcessIntegrityMonitor(
  intervalMs = 60000,
  onViolation?: (result: ProcessIntegrityResult) => void,
): void {
  // 立即检查一次
  const initialResult = checkProcessIntegrity();
  if (!initialResult.valid && onViolation) {
    onViolation(initialResult);
  }

  // 定期检查
  monitorInterval = setInterval(() => {
    const result = checkProcessIntegrity();
    if (!result.valid && onViolation) {
      onViolation(result);
    }
  }, intervalMs);

  monitorInterval.unref();
  log.debug(`Process integrity monitor started (interval: ${intervalMs}ms)`);
}

/**
 * 停止进程完整性监控
 */
export function stopProcessIntegrityMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    log.debug("Process integrity monitor stopped");
  }
}
