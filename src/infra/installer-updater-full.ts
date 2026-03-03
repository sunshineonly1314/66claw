/**
 * Installer Updater — Full Package Mode
 *
 * 当无增量包（delta）可用时，下载 full.tar.gz 全量包进行热替换。
 * 复用 installer-updater.ts 的备份/回滚/校验基础设施。
 *
 * 更新流程：
 *   下载 full.tar.gz → SHA256 校验 → Ed25519 签名校验（跳过 placeholder）
 *   → 备份 dist/skills/extensions/ → 解压替换 → checksums 校验
 *   → 依赖安装 → 完成（失败自动回滚）
 */

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import {
  type UpdateServerLatest,
  type InstallerUpdateResult,
  type InstallerUpdateProgress,
  BACKUP_DIRS,
  downloadFile,
  extractTarGz,
  sha256File,
  copyDir,
  rmrf,
  rollback,
  verifyChecksums,
  checkAndInstallDeps,
  reportUpdateResult,
  assertExtractedPathsWithinRoot,
  checkDiskSpace,
  resolveChecksumsUrl,
} from "./installer-updater.js";
import { fetchWithTimeout } from "../utils/fetch-timeout.js";
import { downloadAndVerifySignature, isUpdateSigningKeyConfigured } from "./update-signature.js";

// ─── Constants ─────────────────────────────────────────

const UPDATE_TEMP_DIR = ".update-temp";
const BACKUP_DIR = ".update-backup";
const DEFAULT_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

/**
 * full.tar.gz 解压后的顶层目录名（与 release-deploy.ts 的 FULL_PACKAGE_INCLUDES 对应）
 */
const FULL_PACKAGE_DIRS = ["dist", "skills", "extensions", "data", "docs", "node_modules"] as const;

// ─── Core ──────────────────────────────────────────────

/**
 * 执行全量包热替换更新
 *
 * 当版本跨度过大没有 delta 增量包，但 full.tar.gz 可用时使用。
 * 比重装安装包更轻量，比 delta 更重（下载量更大）。
 */
export async function runFullTarUpdate(params: {
  root: string;
  latest: UpdateServerLatest;
  currentVersion: string;
  updateServerUrl: string;
  licenseKey?: string;
  deviceId?: string;
  timeoutMs?: number;
  progress?: InstallerUpdateProgress;
}): Promise<InstallerUpdateResult> {
  const startedAt = Date.now();
  const { root, latest, currentVersion, updateServerUrl, progress } = params;
  const timeoutMs = params.timeoutMs ?? DOWNLOAD_TIMEOUT_MS;
  const toVersion = latest.version;

  // 1. 验证 full 包信息
  if (!latest.url?.full) {
    return {
      status: "error",
      mode: "full",
      reason: "full.tar.gz URL not available in latest.json",
      fromVersion: currentVersion,
      toVersion,
      durationMs: Date.now() - startedAt,
    };
  }
  // [MED-09] 无 checksums URL 时必须拒绝更新，防止降级攻击（与 delta 路径一致）
  if (!resolveChecksumsUrl(latest)) {
    return {
      status: "error",
      mode: "full",
      reason: "checksums URL not available, cannot verify update integrity",
      fromVersion: currentVersion,
      toVersion,
      durationMs: Date.now() - startedAt,
    };
  }

  const tempDir = path.join(root, UPDATE_TEMP_DIR);
  const backupDir = path.join(root, BACKUP_DIR);

  try {
    // 清理临时目录
    await rmrf(tempDir);
    await fs.mkdir(tempDir, { recursive: true });

    // S7-1: 磁盘空间预检（下载 + 解压 + 备份，估算需要 2 倍包大小 + 500MB 裕量）
    const fullSize = latest.fullSize ?? 0;
    if (fullSize > 0) {
      const spaceNeeded = fullSize * 2 + 500 * 1024 * 1024;
      const spaceError = await checkDiskSpace(root, spaceNeeded);
      if (spaceError) {
        await rmrf(tempDir);
        return {
          status: "error",
          mode: "full",
          reason: spaceError,
          fromVersion: currentVersion,
          toVersion,
          durationMs: Date.now() - startedAt,
        };
      }
    }

    // 2. 下载 full.tar.gz
    const downloadPath = path.join(tempDir, "full.tar.gz");
    progress?.onDownloadStart?.("full", fullSize);

    const downloadedBytes = await downloadFile(
      latest.url.full,
      downloadPath,
      timeoutMs,
      (dl, total) => {
        progress?.onDownloadProgress?.(dl, total);
      },
    );

    progress?.onDownloadComplete?.();

    // 3. SHA256 校验
    if (latest.fullSha256) {
      const actualHash = await sha256File(downloadPath);
      if (actualHash !== latest.fullSha256) {
        await rmrf(tempDir);
        const result: InstallerUpdateResult = {
          status: "error",
          mode: "full",
          reason: `full.tar.gz SHA256 mismatch: expected ${latest.fullSha256}, got ${actualHash}`,
          fromVersion: currentVersion,
          toVersion,
          durationMs: Date.now() - startedAt,
        };
        void reportUpdateResult({
          updateServerUrl,
          licenseKey: params.licenseKey,
          deviceId: params.deviceId,
          result,
          reportStatus: "error",
        });
        return result;
      }
    }

    // 4. Ed25519 签名校验
    {
      const sigUrl = `${latest.url.full}.sig`;
      const sigOk = await downloadAndVerifySignature(
        downloadPath,
        sigUrl,
        ((url: string | URL | Request, init?: RequestInit) =>
          fetchWithTimeout(String(url), init ?? {}, DEFAULT_TIMEOUT_MS)) as typeof fetch,
        DEFAULT_TIMEOUT_MS,
      );
      // 与 delta 路径保持一致：downloadAndVerifySignature 内部已处理 placeholder key
      if (!sigOk) {
        await rmrf(tempDir);
        const result: InstallerUpdateResult = {
          status: "error",
          mode: "full",
          reason: "full.tar.gz Ed25519 signature verification failed",
          fromVersion: currentVersion,
          toVersion,
          durationMs: Date.now() - startedAt,
        };
        void reportUpdateResult({
          updateServerUrl,
          licenseKey: params.licenseKey,
          deviceId: params.deviceId,
          result,
          reportStatus: "error",
        });
        return result;
      }
    }

    // 5. 备份当前目录
    await rmrf(backupDir);
    await fs.mkdir(backupDir, { recursive: true });
    for (const dir of BACKUP_DIRS) {
      const srcDir = path.join(root, dir);
      if (fsSync.existsSync(srcDir)) {
        await copyDir(srcDir, path.join(backupDir, dir));
      }
    }
    const pkgPath = path.join(root, "package.json");
    if (fsSync.existsSync(pkgPath)) {
      await fs.copyFile(pkgPath, path.join(backupDir, "package.json"));
    }

    // 6. 解压 full.tar.gz
    const extractDir = path.join(tempDir, "extracted");
    await fs.mkdir(extractDir, { recursive: true });
    await extractTarGz(downloadPath, extractDir);

    // 6.5 路径穿越检测：确保解压内容全部在 extractDir 内
    await assertExtractedPathsWithinRoot(extractDir);

    // 7. 替换目录
    progress?.onApplyStart?.(0);

    let filesChanged = 0;
    for (const dir of FULL_PACKAGE_DIRS) {
      const srcDir = path.join(extractDir, dir);
      const destDir = path.join(root, dir);
      if (fsSync.existsSync(srcDir)) {
        // 先删除旧目录再复制新目录
        await rmrf(destDir);
        await copyDir(srcDir, destDir);
        filesChanged++;
      }
    }

    // 替换 package.json（如果全量包包含）
    const newPkgPath = path.join(extractDir, "package.json");
    if (fsSync.existsSync(newPkgPath)) {
      await fs.copyFile(newPkgPath, path.join(root, "package.json"));
      filesChanged++;
    }

    // 替换元数据文件（install.json, version.json）
    for (const metaFile of ["install.json", "version.json"]) {
      const newMetaPath = path.join(extractDir, metaFile);
      if (fsSync.existsSync(newMetaPath)) {
        await fs.copyFile(newMetaPath, path.join(root, metaFile));
        filesChanged++;
      }
    }

    progress?.onApplyComplete?.();

    // 8. 校验 checksums
    const checksumsUrlResolved = resolveChecksumsUrl(latest);
    const checksumsOk = checksumsUrlResolved
      ? await verifyChecksums(root, checksumsUrlResolved)
      : false;
    if (!checksumsOk) {
      progress?.onError?.("校验失败，正在回滚...");
      await rollback(root, backupDir);
      const result: InstallerUpdateResult = {
        status: "error",
        mode: "full",
        reason: "checksum verification failed after full.tar.gz apply, rolled back",
        fromVersion: currentVersion,
        toVersion,
        filesChanged,
        durationMs: Date.now() - startedAt,
      };
      void reportUpdateResult({
        updateServerUrl,
        licenseKey: params.licenseKey,
        deviceId: params.deviceId,
        result,
        reportStatus: "error",
      });
      return result;
    }

    // 9. 检查依赖变化
    const depsOk = await checkAndInstallDeps(root, backupDir);
    if (!depsOk) {
      progress?.onError?.("依赖安装失败，正在回滚...");
      await rollback(root, backupDir);
      const result: InstallerUpdateResult = {
        status: "error",
        mode: "full",
        reason:
          "dependency install failed after full update, rolled back to prevent MODULE_NOT_FOUND crash",
        fromVersion: currentVersion,
        toVersion,
        filesChanged,
        durationMs: Date.now() - startedAt,
      };
      void reportUpdateResult({
        updateServerUrl,
        licenseKey: params.licenseKey,
        deviceId: params.deviceId,
        result,
        reportStatus: "error",
      });
      return result;
    }

    // 10. 清理
    await rmrf(tempDir);
    await rmrf(backupDir);

    const result: InstallerUpdateResult = {
      status: "ok",
      mode: "full",
      reason: undefined,
      fromVersion: currentVersion,
      toVersion,
      downloadedBytes,
      filesChanged,
      durationMs: Date.now() - startedAt,
      changelog: {
        "zh-CN": latest.changelog?.["zh-CN"] ?? "",
        "en-US": latest.changelog?.["en-US"] ?? "",
      },
    };
    void reportUpdateResult({
      updateServerUrl,
      licenseKey: params.licenseKey,
      deviceId: params.deviceId,
      result,
      reportStatus: "ok",
    });
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    progress?.onError?.(errorMsg);

    // 尝试回滚
    let rollbackOk = false;
    try {
      if (fsSync.existsSync(backupDir)) {
        await rollback(root, backupDir);
        rollbackOk = true;
      }
    } catch (rollbackErr) {
      // rollback failed — 记录日志以便排查
      void import("../logging/subsystem.js").then((m) =>
        m.createSubsystemLogger("infra:update-full").error(`Rollback failed: ${rollbackErr}`),
      );
    }

    // 清理临时目录和备份目录（避免留下数百 MB 的下载文件）
    try {
      await rmrf(tempDir);
    } catch {
      /* ignore */
    }
    try {
      await rmrf(backupDir);
    } catch {
      /* ignore */
    }

    const result: InstallerUpdateResult = {
      status: rollbackOk ? "error" : "broken",
      mode: "full",
      reason: rollbackOk ? errorMsg : `${errorMsg} (rollback also failed)`,
      fromVersion: currentVersion,
      toVersion,
      durationMs: Date.now() - startedAt,
    };
    void reportUpdateResult({
      updateServerUrl,
      licenseKey: params.licenseKey,
      deviceId: params.deviceId,
      result,
      reportStatus: rollbackOk ? "error" : "broken",
    });
    return result;
  }
}

// assertExtractedPathsWithinRoot imported from installer-updater.ts (shared, includes symlink rejection)
