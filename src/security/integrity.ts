/**
 * Clawdbot Security Module - File Integrity Verification
 * 文件完整性校验
 *
 * 检测关键文件是否被篡改，防止本地代码修改攻击
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("security:integrity");

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
export async function initIntegrityCheck(options: {
  apiBaseUrl?: string;
  useServerHashes?: boolean;
} = {}): Promise<void> {
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
 * 计算文件的 SHA-256 哈希
 */
function computeFileHash(filePath: string): string {
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
    log.debug("No hashes to verify, skipping integrity check");
    return {
      valid: true,
      tamperedFiles: [],
      missingFiles: [],
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
export async function checkIntegrityOnStartup(options: {
  baseDir?: string;
  apiBaseUrl?: string;
  useServerHashes?: boolean;
  exitOnFailure?: boolean;
} = {}): Promise<boolean> {
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
    log.error("Integrity check failed!");

    if (result.tamperedFiles.length > 0) {
      log.error(`Tampered files: ${result.tamperedFiles.join(", ")}`);
    }

    if (result.missingFiles.length > 0) {
      log.error(`Missing files: ${result.missingFiles.join(", ")}`);
    }

    if (options.exitOnFailure) {
      console.error("[安全警告] 检测到文件被篡改，程序退出");
      process.exit(1);
    }

    return false;
  }

  if (result.totalChecked > 0) {
    log.debug(`Integrity check passed (${result.totalChecked} files verified)`);
  }

  return true;
}
