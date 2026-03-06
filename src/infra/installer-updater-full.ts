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
      // Full 模式替换了 node_modules（FULL_PACKAGE_DIRS 包含 node_modules），
      // 但 BACKUP_DIRS 不含 node_modules（备份 1GB+ 太慢且 symlink 会丢失），
      // 回滚后 node_modules 仍是新版本，可能与已恢复的旧版 package.json 不一致。
      // 强制重新安装依赖使 node_modules 与旧版 package.json 对齐。
      await reinstallDepsAfterRollback(root, path.join(extractDir, "package.json"));
      // rollback 完成后立即清理，否则下次启动 recoverFromInterruptedUpdate
      // 看到残留的 backupDir 会误以为更新被中断而再次回滚。
      await rmrf(backupDir);
      await rmrf(tempDir);
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
      // 同上：回滚后 node_modules 不一致，强制重装
      await reinstallDepsAfterRollback(root, path.join(extractDir, "package.json"));
      // rollback 完成后立即清理，防止 recoverFromInterruptedUpdate 误重复回滚
      await rmrf(backupDir);
      await rmrf(tempDir);
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

    // 10. 清理：先删 backup（标记更新已提交），再删 temp（下载缓存）。
    // 顺序很重要：若先删 temp 后删 backup 之间被强杀，
    // 下次启动 recoverFromInterruptedUpdate 会看到 backup 而误回滚成功的更新。
    await rmrf(backupDir);
    await rmrf(tempDir);

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
        // 回滚后 node_modules 可能不一致（BACKUP_DIRS 不含 node_modules），强制重装
        // catch 块中 extractDir 可能未初始化，直接构造路径（existsSync 会检查）
        await reinstallDepsAfterRollback(root, path.join(tempDir, "extracted", "package.json"));
        rollbackOk = true;
      }
    } catch (rollbackErr) {
      // rollback failed — 记录日志以便排查
      void import("../logging/subsystem.js").then((m) =>
        m.createSubsystemLogger("infra:update-full").error(`Rollback failed: ${rollbackErr}`),
      );
    }

    // 清理：先删 backup（标记更新已终结），再删 temp（下载缓存）。
    // 顺序很重要：若先删 temp 后删 backup 之间被强杀，
    // 下次启动 recoverFromInterruptedUpdate 会看到 backup 而误回滚。
    try {
      await rmrf(backupDir);
    } catch {
      /* ignore */
    }
    try {
      await rmrf(tempDir);
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

/**
 * Full 模式回滚后修复 node_modules。
 *
 * BACKUP_DIRS 不含 node_modules（备份 1GB+ 太慢且 pnpm symlink 会丢失），
 * 所以 rollback() 不会恢复 node_modules。回滚后 node_modules 仍是新版本，
 * 可能与已恢复的旧版 package.json 不一致。
 *
 * 此函数基于已恢复的 package.json 重新安装依赖，使 node_modules 对齐。
 * 失败不抛异常——回滚本身已经完成，依赖修复是尽力而为。
 *
 * @param newPkgPath 新版 package.json 路径（解压目录中），用于判断依赖是否有变化。
 *                   如果为 null（catch 场景中状态未知），保守地执行重装。
 */
async function reinstallDepsAfterRollback(root: string, newPkgPath: string | null): Promise<void> {
  try {
    // 快速判断：如果新旧 package.json 的 dependencies 完全一致，
    // 说明本次更新没有改过依赖，node_modules 天然兼容旧版代码，无需重装。
    if (newPkgPath && fsSync.existsSync(newPkgPath)) {
      const oldPkgPath = path.join(root, "package.json");
      if (fsSync.existsSync(oldPkgPath)) {
        try {
          const newPkg = JSON.parse(fsSync.readFileSync(newPkgPath, "utf-8"));
          const oldPkg = JSON.parse(fsSync.readFileSync(oldPkgPath, "utf-8"));
          if (
            JSON.stringify(newPkg.dependencies ?? {}) === JSON.stringify(oldPkg.dependencies ?? {})
          ) {
            return;
          }
        } catch {
          // 读取/解析失败，保守地继续重装
        }
      }
    }

    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const hasPnpmLock = fsSync.existsSync(path.join(root, "pnpm-lock.yaml"));
    let cmd = hasPnpmLock ? "pnpm" : "npm";

    // 验证所选包管理器是否可用（installer 部署只有 bundled npm，没有 pnpm）
    if (cmd === "pnpm") {
      try {
        await execFileAsync(cmd, ["--version"], { timeout: 5_000 });
      } catch {
        cmd = "npm";
      }
    }

    const npmrcExists = fsSync.existsSync(path.join(root, ".npmrc"));
    const registryArg = npmrcExists ? "" : " --registry=https://registry.npmmirror.com";
    // 回滚场景下旧版依赖大概率已在本地 npm cache 中，2 分钟足够。
    // 不用 5 分钟——避免网络不可达时长时间卡 UI。
    await execFileAsync(cmd, ["install", "--omit=dev", ...registryArg.split(" ").filter(Boolean)], {
      cwd: root,
      timeout: 2 * 60_000,
    });
  } catch (err) {
    // 依赖修复失败不阻塞回滚流程——下次启动时 gateway 可能会因 MODULE_NOT_FOUND 崩溃，
    // 但 Tauri watchdog 会自动重启，用户可通过"一键检修"修复。
    console.warn(
      `[installer-updater-full] reinstallDepsAfterRollback failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// assertExtractedPathsWithinRoot imported from installer-updater.ts (shared, includes symlink rejection)
