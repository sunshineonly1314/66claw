/**
 * OpenClawCN Security Module - File Integrity Verification
 * 文件完整性校验
 *
 * 检测关键文件是否被篡改，防止本地代码修改攻击
 */

import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("security:integrity");

// ============================================================================
// Native Addon Integration (Layer 3 — hardened integrity verification)
// Hash computation and comparison happens in compiled C++, not patchable JS.
// ============================================================================

interface NativeIntegrityAddon {
  computeFileHash(filePath: string): string | null;
  verifyFileIntegrity(filePath: string, expectedHash: string): boolean;
  verifyAllIntegrity(baseDir: string, hashes?: Array<{ path: string; hash: string }>): string[];
}

let nativeIntegrity: NativeIntegrityAddon | null = null;
try {
  const esmRequire = createRequire(import.meta.url);
  const addon = esmRequire(
    "../../native/build/Release/openclawcn_native.node",
  ) as NativeIntegrityAddon;
  if (typeof addon?.computeFileHash === "function") {
    nativeIntegrity = addon;
    log.debug("Native integrity addon loaded — using hardened hash verification");
  }
} catch {
  log.debug("Native integrity addon not available, using JS fallback");
}

/**
 * 文件哈希记录
 */
interface FileHash {
  /** 相对路径 */
  path: string;
  /** SHA-256 哈希值 */
  hash: string;
}

/**
 * 完整性校验结果
 */
export interface IntegrityCheckResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 被篡改的文件列表 */
  tamperedFiles: string[];
  /** 丢失的文件列表 */
  missingFiles: string[];
  /** 校验的文件总数 */
  totalChecked: number;
}

/**
 * 关键文件的哈希值
 *
 * 这个数组在生产构建时由 scripts/generate-integrity-hashes.ts 自动生成
 * 包含 license 和 security 目录下所有关键文件的哈希
 *
 * 注意：
 * - 每次构建后需要重新生成
 * - 从服务端获取哈希更安全（攻击者无法同时篡改代码和哈希）
 */
let INTEGRITY_HASHES: FileHash[] = [];

/**
 * 是否已初始化
 */
let initialized = false;

/**
 * [LOW-01] 验证 integrity-hashes.json 与 integrity-hashes-root.json 的一致性。
 *
 * integrity-hashes-root.json 存储了 integrity-hashes.json 内容的 SHA-256 哈希值，
 * 由构建脚本 generate-integrity-hashes.ts 自动生成并写入。
 * integrity-hashes-root.json 本身被纳入 integrity-hashes.json 的巡逻监控列表。
 *
 * 攻击者若篡改 integrity-hashes.json（替换某文件的期望哈希），
 * 此函数会检测到 hashes.json 的内容与 root.json 中记录的哈希不匹配，
 * 从而拒绝加载被篡改的哈希列表。
 *
 * @returns true 表示哈希文件完整，false 表示检测到篡改
 */
function verifyHashesFileIntegrity(hashesContent: string, currentDir: string): boolean {
  try {
    const rootFilePath = path.join(currentDir, "integrity-hashes-root.json");
    if (!fs.existsSync(rootFilePath)) {
      // root 文件不存在：可能是旧版安装或 dev 构建，不强制失败
      log.debug(
        "[LOW-01] integrity-hashes-root.json not found — skipping root hash verification (may be dev build or legacy install)",
      );
      return true;
    }

    const rootContent = fs.readFileSync(rootFilePath, "utf8");
    const root = JSON.parse(rootContent) as { hash?: string; generated?: string };
    if (typeof root.hash !== "string" || root.hash.length !== 64) {
      log.warn("[LOW-01] integrity-hashes-root.json has invalid format — treating as tampered");
      return false;
    }

    // 验证 hashes.json 内容的 SHA-256 与 root.json 中记录的值一致
    const actualHash = createHash("sha256").update(hashesContent, "utf8").digest("hex");
    if (actualHash !== root.hash) {
      log.error(
        `[LOW-01] SECURITY: integrity-hashes.json content hash mismatch! ` +
          `Expected: ${root.hash.slice(0, 16)}... Got: ${actualHash.slice(0, 16)}... — ` +
          `hashes file may have been tampered`,
      );
      return false;
    }

    log.debug(`[LOW-01] integrity-hashes.json root hash verified OK`);
    return true;
  } catch (error) {
    log.warn(`[LOW-01] Failed to verify root hash: ${error}`);
    // On error, be permissive (root file may not exist in dev/legacy installs)
    return true;
  }
}

/**
 * 从内嵌的哈希文件加载（备用方案）
 */
function loadEmbeddedHashes(): FileHash[] {
  try {
    // 尝试从构建时生成的文件加载
    // 使用 fileURLToPath 正确处理 Windows 路径
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const hashFilePath = path.join(currentDir, "integrity-hashes.json");

    if (fs.existsSync(hashFilePath)) {
      const content = fs.readFileSync(hashFilePath, "utf8");

      // [LOW-01] 验证 integrity-hashes.json 本身未被篡改
      if (!verifyHashesFileIntegrity(content, currentDir)) {
        // 哈希文件被篡改：在生产构建中拒绝加载，返回空数组
        // 空数组 → verifyIntegrity() 返回 {valid: false, missingFiles: ["integrity-hashes.json"]}
        const isDevBuild = typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__;
        if (!isDevBuild) {
          log.error("[LOW-01] Refusing to load tampered integrity-hashes.json");
          return [];
        }
        log.warn("[LOW-01] integrity-hashes.json root hash mismatch (dev build, continuing)");
      }

      return JSON.parse(content) as FileHash[];
    }
  } catch (error) {
    log.debug(`Failed to load embedded hashes: ${error}`);
  }

  return [];
}

/**
 * 从服务端获取哈希（更安全）
 */
async function fetchHashesFromServer(apiBaseUrl: string): Promise<FileHash[] | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/integrity`, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = (await response.json()) as { hashes: FileHash[] };
      return data.hashes;
    }
  } catch (error) {
    log.debug(`Failed to fetch hashes from server: ${error}`);
  }

  return null;
}

/**
 * 初始化完整性校验模块
 *
 * @param options - 初始化选项
 */
export async function initIntegrityCheck(
  options: {
    apiBaseUrl?: string;
    useServerHashes?: boolean;
  } = {},
): Promise<void> {
  if (initialized) {
    return;
  }

  // 优先从服务端获取（更安全）
  if (options.useServerHashes && options.apiBaseUrl) {
    const serverHashes = await fetchHashesFromServer(options.apiBaseUrl);
    if (serverHashes && serverHashes.length > 0) {
      INTEGRITY_HASHES = serverHashes;
      log.debug(`Loaded ${INTEGRITY_HASHES.length} hashes from server`);
      initialized = true;
      return;
    }
  }

  // 回退到内嵌哈希
  INTEGRITY_HASHES = loadEmbeddedHashes();
  if (INTEGRITY_HASHES.length > 0) {
    log.debug(`Loaded ${INTEGRITY_HASHES.length} embedded hashes`);
  } else {
    log.debug("No integrity hashes available");
  }

  initialized = true;
}

/**
 * [MED-13] 大文件阈值：超过此大小时使用流式哈希，避免一次性分配大内存
 * ESM bundle 文件（daemon-cli.js ~2.5MB, gateway-cli ~1.2MB）仍在同步阈值内，
 * 但未来如果文件更大或平台内存紧张，流式处理更稳健。
 */
const STREAMING_HASH_THRESHOLD = 5 * 1024 * 1024; // 5MB

/**
 * 计算文件的 SHA-256 哈希
 * 优先使用 native addon（C++ 实现，无法被 JS patch 绕过）
 *
 * [MED-13] 支持大型 ESM bundle 文件：超过阈值时使用 fs.createReadStream
 * 做增量哈希，避免同步读取大文件导致内存峰值。
 */
function computeFileHash(filePath: string): string {
  // Prefer native computation (hardened, not patchable from JS)
  if (nativeIntegrity) {
    try {
      const hash = nativeIntegrity.computeFileHash(filePath);
      if (hash) return hash;
    } catch {
      // Fall through to JS implementation
    }
  }

  // Check file size to decide sync vs streaming
  const stat = fs.statSync(filePath);
  if (stat.size > STREAMING_HASH_THRESHOLD) {
    // Streaming hash for large files (synchronous via manual chunk reading)
    const fd = fs.openSync(filePath, "r");
    try {
      const hash = createHash("sha256");
      const buf = Buffer.allocUnsafe(64 * 1024); // 64KB chunks
      let bytesRead: number;
      while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
        hash.update(bytesRead === buf.length ? buf : buf.subarray(0, bytesRead));
      }
      return hash.digest("hex");
    } finally {
      fs.closeSync(fd);
    }
  }

  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/**
 * 验证文件完整性
 *
 * @param baseDir - 基础目录（通常是 dist 目录）
 * @returns 校验结果
 */
export function verifyIntegrity(baseDir: string): IntegrityCheckResult {
  const tamperedFiles: string[] = [];
  const missingFiles: string[] = [];

  if (INTEGRITY_HASHES.length === 0) {
    // 安全策略：生产构建中，空哈希列表视为异常（integrity-hashes.json 被删除或篡改）。
    // 开发环境中不存在哈希文件是正常的，跳过检查。
    const isDevBuild = typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__;
    if (isDevBuild) {
      log.debug("No hashes to verify (dev build), skipping integrity check");
      return {
        valid: true,
        tamperedFiles: [],
        missingFiles: [],
        totalChecked: 0,
      };
    }
    log.error("SECURITY: No integrity hashes loaded — hash file may have been deleted or tampered");
    return {
      valid: false,
      tamperedFiles: [],
      missingFiles: ["integrity-hashes.json"],
      totalChecked: 0,
    };
  }

  for (const { path: relativePath, hash: expectedHash } of INTEGRITY_HASHES) {
    const fullPath = path.join(baseDir, relativePath);

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(relativePath);
      continue;
    }

    // 计算实际哈希
    try {
      const actualHash = computeFileHash(fullPath);

      if (actualHash !== expectedHash) {
        tamperedFiles.push(relativePath);
        log.warn(`File tampered: ${relativePath}`);
      }
    } catch (error) {
      log.warn(`Failed to compute hash for ${relativePath}: ${error}`);
      tamperedFiles.push(relativePath);
    }
  }

  const valid = tamperedFiles.length === 0 && missingFiles.length === 0;

  return {
    valid,
    tamperedFiles,
    missingFiles,
    totalChecked: INTEGRITY_HASHES.length,
  };
}

/**
 * 启动时检查文件完整性
 *
 * @param options - 检查选项
 * @returns 是否通过校验
 */
export async function checkIntegrityOnStartup(
  options: {
    baseDir?: string;
    apiBaseUrl?: string;
    useServerHashes?: boolean;
    exitOnFailure?: boolean;
  } = {},
): Promise<boolean> {
  // 初始化
  await initIntegrityCheck({
    apiBaseUrl: options.apiBaseUrl,
    useServerHashes: options.useServerHashes,
  });

  // 确定基础目录（默认为 dist 目录，即 security 目录的父目录）
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const baseDir = options.baseDir || path.dirname(currentDir);

  // 执行校验
  const result = verifyIntegrity(baseDir);

  if (!result.valid) {
    // Distinguish "tampered" from "likely upgrade/incomplete install" for better UX.
    // Missing-only (no tampered) is commonly caused by version upgrades where old
    // integrity hashes reference files that no longer exist in the new version.
    const isMissingOnly = result.missingFiles.length > 0 && result.tamperedFiles.length === 0;

    if (isMissingOnly) {
      log.warn(
        "Integrity check: missing files detected — possible version upgrade or incomplete installation",
      );
      log.warn(`Missing files: ${result.missingFiles.join(", ")}`);
    } else {
      log.error("Integrity check failed!");
      if (result.tamperedFiles.length > 0) {
        log.error(`Tampered files: ${result.tamperedFiles.join(", ")}`);
      }
      if (result.missingFiles.length > 0) {
        log.error(`Missing files: ${result.missingFiles.join(", ")}`);
      }
    }

    if (options.exitOnFailure) {
      console.error("[安全警告] 检测到文件完整性异常，程序退出");
      console.error("  可能原因：版本升级后残留旧文件、安装不完整、或文件被篡改");
      console.error("  建议：重新安装或运行 pnpm build:secure 重新构建");
      process.exit(1);
    }

    return false;
  }

  if (result.totalChecked > 0) {
    log.debug(`Integrity check passed (${result.totalChecked} files verified)`);
  }

  return true;
}

// ============================================================================
// Runtime Integrity Patrol (Knife 5)
// ============================================================================

let patrolInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic integrity patrol.
 *
 * Unlike the startup check that verifies ALL files once, the patrol randomly
 * samples a small subset of files each cycle. This catches runtime file
 * replacement attacks (e.g. hot-patching .jsc files after process start)
 * without causing performance issues.
 *
 * @param intervalMs  - Patrol interval (default: 5 minutes)
 * @param sampleSize  - Number of files to check per cycle (default: 3)
 * @param onTamper    - Callback when tampering detected
 */
export function startIntegrityPatrol(
  options: {
    intervalMs?: number;
    sampleSize?: number;
    baseDir?: string;
    onTamper?: (tamperedFiles: string[]) => void;
  } = {},
): void {
  const { intervalMs = 5 * 60 * 1000, sampleSize = 3, onTamper } = options;

  if (patrolInterval) {
    return; // Already running
  }

  if (INTEGRITY_HASHES.length === 0) {
    // 生产环境中无哈希 = 异常，记录违规
    const isDevBuild = typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__;
    if (!isDevBuild && onTamper) {
      log.error("Integrity patrol: no hashes loaded — possible hash file deletion");
      onTamper(["integrity-hashes.json:deleted"]);
    } else {
      log.debug("Integrity patrol skipped: no hashes loaded (dev build)");
    }
    return;
  }

  // Determine base directory
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const baseDir = options.baseDir || path.dirname(currentDir);

  patrolInterval = setInterval(() => {
    // Random sample without replacement
    const indices = new Set<number>();
    const maxSample = Math.min(sampleSize, INTEGRITY_HASHES.length);
    while (indices.size < maxSample) {
      indices.add(Math.floor(Math.random() * INTEGRITY_HASHES.length));
    }

    const tampered: string[] = [];
    for (const idx of indices) {
      const entry = INTEGRITY_HASHES[idx]!;
      const fullPath = path.join(baseDir, entry.path);

      try {
        if (!fs.existsSync(fullPath)) continue; // Missing files handled at startup
        const actualHash = computeFileHash(fullPath);
        if (actualHash !== entry.hash) {
          tampered.push(entry.path);
          log.warn(`Integrity patrol: tampered file detected — ${entry.path}`);
        }
      } catch {
        // Read errors on patrol are non-fatal (file may be locked during update)
      }
    }

    if (tampered.length > 0) {
      log.error(`Integrity patrol: ${tampered.length} file(s) tampered!`);
      if (onTamper) {
        onTamper(tampered);
      }
    }
  }, intervalMs);

  patrolInterval.unref();
  log.debug(`Integrity patrol started (interval: ${intervalMs}ms, sample: ${sampleSize})`);
}

/**
 * Stop the integrity patrol timer.
 */
export function stopIntegrityPatrol(): void {
  if (patrolInterval) {
    clearInterval(patrolInterval);
    patrolInterval = null;
    log.debug("Integrity patrol stopped");
  }
}

// ============================================================================
// Native Addon Health Check
// ============================================================================

/**
 * 检查 native addon 是否可用。
 *
 * 在生产构建中，native addon 缺失意味着：
 * - 完整性校验降级为可篡改的 JS 实现
 * - 反调试检测降级为 JS 层面检测
 * - RSA 签名验证降级为 JS 实现
 *
 * 调用方（license-check.ts）应将缺失事件喂入延迟惩罚系统。
 */
export function isNativeAddonAvailable(): boolean {
  return nativeIntegrity !== null;
}
