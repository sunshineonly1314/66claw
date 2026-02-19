/**
 * Installer Updater
 *
 * 桌面安装包用户的增量热更新模块。
 * 仅处理 delta 增量包，校验完整性后替换本地文件。
 * 版本跨度大无增量包时，引导用户下载安装包重装。
 *
 * 与 update-runner.ts 的 git/npm 模式并列，作为第三种更新模式（installer 模式）。
 */

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createWriteStream, createReadStream } from "node:fs";
import { fetchWithTimeout } from "../utils/fetch-timeout.js";

const execFileAsync = promisify(execFile);

// ─── Types ─────────────────────────────────────────────

/** 单个平台的更新数据 */
export interface PlatformUpdateData {
  url: {
    full: string;
    manifest: string;
    checksums: string;
  };
  deltas: Array<{
    from: string;
    url: string;
    size: number;
    sha256?: string;
  }>;
  fullSize: number;
  fullSha256: string;
}

export interface UpdateServerLatest {
  version: string;
  buildTime: string;
  gitCommit: string;
  nodeVersion: string;
  /** 旧格式（无平台区分）: 直接包含 url/deltas */
  url?: {
    /** @deprecated 全量包已移除，保留仅为兼容 OSS latest.json 格式 */
    full: string;
    manifest: string;
    checksums: string;
  };
  /** 旧格式 deltas（无平台区分） */
  deltas?: Array<{
    from: string;
    url: string;
    size: number;
    sha256?: string;
  }>;
  /** @deprecated */
  fullSize?: number;
  /** @deprecated */
  fullSha256?: string;
  /** 新格式（多平台）: 按平台 key 存储各自的 url/deltas */
  platforms?: Record<string, PlatformUpdateData>;
  changelog: {
    "zh-CN": string;
    "en-US": string;
  };
}

export interface DeltaManifest {
  fromVersion: string;
  toVersion: string;
  generatedAt: string;
  added: Array<{ path: string; sha256: string; size: number }>;
  modified: Array<{ path: string; sha256: string; size: number }>;
  removed: string[];
  totalSize: number;
  totalFiles: number;
}

/** 服务端 /update/check 响应 data 字段 */
export interface UpdateCheckResponseData {
  hasUpdate: boolean;
  /** delta = 增量热更新, installer = 引导重装 */
  updateType?: "delta" | "installer";
  mandatory?: boolean;
  version?: string;
  buildTime?: string;
  releaseNotes?: { "zh-CN"?: string; "en-US"?: string };
  message?: string;
  /** 下次检查间隔（秒） */
  nextCheckAfterSeconds?: number;
  /** 增量包下载信息 (updateType=delta 时) */
  download?: {
    url: string;
    size: number;
    sha256: string;
    checksums: string;
    manifest: string;
  };
  /** 安装器下载链接 (updateType=installer 时) */
  installer?: {
    win64?: string;
    macArm64?: string;
    macX64?: string;
  };
  /** 授权错误 */
  error?: boolean;
  errorCode?: number;
  errorMessage?: string;
  renewUrl?: string;
}

export type UpdateReportStatus = "ok" | "error" | "broken" | "redirect_to_installer";

export type InstallerUpdateResult = {
  status: "ok" | "error" | "broken" | "up-to-date" | "skipped";
  mode: "delta" | "none";
  reason?: string;
  fromVersion: string;
  toVersion?: string;
  downloadedBytes?: number;
  filesChanged?: number;
  durationMs: number;
  /** 更新成功时携带的 changelog，用于 UI 展示 */
  changelog?: { "zh-CN": string; "en-US": string };
};

export type InstallerUpdateProgress = {
  onCheckStart?: () => void;
  onCheckComplete?: (result: { hasUpdate: boolean; version?: string }) => void;
  onDownloadStart?: (mode: string, sizeBytes: number) => void;
  onDownloadProgress?: (downloadedBytes: number, totalBytes: number) => void;
  onDownloadComplete?: () => void;
  onApplyStart?: (filesCount: number) => void;
  onApplyComplete?: () => void;
  onError?: (error: string) => void;
};

/** checkInstallerUpdate 返回结构 */
export type InstallerUpdateCheckResult = {
  hasUpdate: boolean;
  /** delta = 有增量包可热更新, installer = 版本跨度大需重装 */
  updateType?: "delta" | "installer";
  /** 目标版本号（无论 delta 还是 installer 场景都会填充） */
  version?: string;
  latest: UpdateServerLatest | null;
  mandatory?: boolean;
  /** installer 重装场景的下载链接 */
  installerUrl?: string;
  /** 服务端下发的下次检查间隔(秒) */
  nextCheckAfterSeconds?: number;
  error?: string;
  errorCode?: number;
};

// ─── Constants ─────────────────────────────────────────

const UPDATE_TEMP_DIR = ".update-temp";
const BACKUP_DIR = ".update-backup";
const DEFAULT_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000; // 10 minutes for large downloads
const UPDATE_API_PATH = "/api/api/v1/update";
/** 需要备份和回滚的目录列表 */
const BACKUP_DIRS = ["dist", "skills", "extensions"] as const;

// ─── Core ──────────────────────────────────────────────

/**
 * 检查更新服务器上是否有新版本
 *
 * 优先走服务端 API（带 License Key 鉴权 + 灰度管控），
 * 服务端不可达时 fallback 到 OSS 静态文件 latest.json。
 */
export async function checkInstallerUpdate(params: {
  updateServerUrl: string;
  currentVersion: string;
  licenseKey?: string;
  deviceId?: string;
  channel?: string;
  timeoutMs?: number;
}): Promise<InstallerUpdateCheckResult> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // ── 优先：走服务端 API ──────────────────────────────
  if (params.licenseKey && params.deviceId) {
    try {
      const apiResult = await checkViaServerApi(params, timeoutMs);
      if (apiResult) return apiResult;
      // apiResult === null 表示 API 不可达，继续 fallback
    } catch {
      // 服务端异常，继续 fallback
    }
  }

  // ── Fallback：直接读 OSS 静态文件 ──────────────────
  return checkViaStaticFile(params.updateServerUrl, params.currentVersion, timeoutMs);
}

/**
 * 通过服务端 API 检查更新（带授权校验 + 灰度）
 * 返回 null 表示 API 不可达，调用方应 fallback
 */
async function checkViaServerApi(
  params: {
    updateServerUrl: string;
    currentVersion: string;
    licenseKey?: string;
    deviceId?: string;
    channel?: string;
  },
  timeoutMs: number,
): Promise<InstallerUpdateCheckResult | null> {
  const apiUrl = `${params.updateServerUrl}${UPDATE_API_PATH}/check`;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      apiUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: params.licenseKey,
          deviceId: params.deviceId,
          appVersion: params.currentVersion,
          platform: process.platform,
          arch: process.arch,
          channel: params.channel ?? "stable",
        }),
      },
      timeoutMs,
    );
  } catch {
    // 网络层失败（DNS/连接超时等），返回 null 让调用方 fallback
    return null;
  }

  if (!res.ok) {
    // HTTP 4xx/5xx 但服务端可达，不做 fallback
    return { hasUpdate: false, latest: null, error: `API HTTP ${res.status}` };
  }

  const json = (await res.json()) as { code: number; data: UpdateCheckResponseData };
  const d = json.data;
  if (!d) {
    return { hasUpdate: false, latest: null, error: "invalid API response" };
  }

  const nextCheck = d.nextCheckAfterSeconds;

  // 授权错误
  if (d.error) {
    return {
      hasUpdate: false,
      latest: null,
      error: d.errorMessage ?? "授权验证失败",
      errorCode: d.errorCode,
      nextCheckAfterSeconds: nextCheck,
    };
  }

  // 无更新
  if (!d.hasUpdate) {
    return { hasUpdate: false, latest: null, nextCheckAfterSeconds: nextCheck };
  }

  // 有更新 — installer 重装场景
  if (d.updateType === "installer") {
    // 根据平台选择安装器链接
    const installerUrl = resolveInstallerUrl(d.installer);
    return {
      hasUpdate: true,
      updateType: "installer",
      version: d.version,
      latest: null,
      mandatory: d.mandatory,
      installerUrl: installerUrl ?? undefined,
      nextCheckAfterSeconds: nextCheck,
    };
  }

  // 有更新 — delta 增量热更新
  if (d.updateType === "delta" && d.download && d.version) {
    const latest: UpdateServerLatest = {
      version: d.version,
      buildTime: d.buildTime ?? "",
      gitCommit: "",
      nodeVersion: "",
      url: {
        full: "", // 不再使用全量包
        manifest: d.download.manifest,
        checksums: d.download.checksums,
      },
      deltas: [
        {
          from: params.currentVersion,
          url: d.download.url,
          size: d.download.size,
          sha256: d.download.sha256,
        },
      ],
      fullSize: 0,
      fullSha256: "",
      changelog: {
        "zh-CN": d.releaseNotes?.["zh-CN"] ?? "",
        "en-US": d.releaseNotes?.["en-US"] ?? "",
      },
    };
    return {
      hasUpdate: true,
      updateType: "delta",
      version: d.version,
      latest,
      mandatory: d.mandatory,
      nextCheckAfterSeconds: nextCheck,
    };
  }

  return { hasUpdate: false, latest: null, nextCheckAfterSeconds: nextCheck };
}

/**
 * 将 process.platform 映射为 latest.json 中的 platforms key
 */
function getPlatformKey(): string {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return process.platform; // linux 等
}

/**
 * 从 latest.json 中提取当前平台的更新数据。
 * 支持新格式（platforms 分平台）和旧格式（直接 url/deltas）。
 * 返回归一化后的 UpdateServerLatest（url/deltas 填充为当前平台的数据）。
 */
function resolvePlatformData(latest: UpdateServerLatest): UpdateServerLatest {
  const platformKey = getPlatformKey();

  // 新格式：从 platforms[key] 取平台专属数据
  if (latest.platforms && latest.platforms[platformKey]) {
    const pd = latest.platforms[platformKey];
    return {
      ...latest,
      url: pd.url,
      deltas: pd.deltas,
      fullSize: pd.fullSize,
      fullSha256: pd.fullSha256,
    };
  }

  // 旧格式或当前平台不在 platforms 中：保持原样
  return latest;
}

/**
 * Fallback: 直接从 OSS 静态文件 latest.json 检查更新（原有逻辑）
 */
async function checkViaStaticFile(
  updateServerUrl: string,
  currentVersion: string,
  timeoutMs: number,
): Promise<InstallerUpdateCheckResult> {
  try {
    const url = `${updateServerUrl}/releases/latest.json`;
    const res = await fetchWithTimeout(url, {}, timeoutMs);
    if (!res.ok) {
      return { hasUpdate: false, latest: null, error: `HTTP ${res.status}` };
    }

    const rawLatest = (await res.json()) as UpdateServerLatest;
    if (!rawLatest.version) {
      return { hasUpdate: false, latest: null, error: "invalid latest.json" };
    }

    // 解析平台数据（新格式自动映射，旧格式透传）
    const latest = resolvePlatformData(rawLatest);

    // 防御性：确保 deltas 为数组
    if (!Array.isArray(latest.deltas)) {
      latest.deltas = [];
    }

    const cmp = compareVersions(latest.version, currentVersion);
    if (cmp <= 0) {
      return { hasUpdate: false, latest: null };
    }

    // 检查是否有当前版本的增量包
    const hasDelta = latest.deltas.some((d) => d.from === currentVersion);
    return {
      hasUpdate: true,
      updateType: hasDelta ? "delta" : "installer",
      version: latest.version,
      latest: hasDelta ? latest : null,
    };
  } catch (err) {
    return { hasUpdate: false, latest: null, error: String(err) };
  }
}

/**
 * 根据当前平台选择安装器下载链接
 */
function resolveInstallerUrl(installer?: {
  win64?: string;
  macArm64?: string;
  macX64?: string;
}): string | null {
  if (!installer) return null;
  if (process.platform === "win32") return installer.win64 ?? null;
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? (installer.macArm64 ?? null) : (installer.macX64 ?? null);
  }
  return null;
}

/**
 * 执行安装包用户的增量热更新
 *
 * 只处理 delta 增量包。如果没有增量包（版本跨度大），
 * 应在调用方通过 checkInstallerUpdate 的 updateType 判断，
 * 引导用户下载安装包重装，不走此函数。
 */
export async function runInstallerUpdate(params: {
  root: string;
  updateServerUrl: string;
  currentVersion: string;
  licenseKey?: string;
  deviceId?: string;
  timeoutMs?: number;
  progress?: InstallerUpdateProgress;
  /** 外部已有的检查结果，传入后跳过内部检查（避免双重网络请求） */
  preCheckResult?: InstallerUpdateCheckResult;
}): Promise<InstallerUpdateResult> {
  const startedAt = Date.now();
  const { root, updateServerUrl, currentVersion, progress } = params;
  const timeoutMs = params.timeoutMs ?? DOWNLOAD_TIMEOUT_MS;

  // 1. 检查更新（优先使用外部传入的结果）
  let check: InstallerUpdateCheckResult;
  if (params.preCheckResult) {
    check = params.preCheckResult;
  } else {
    progress?.onCheckStart?.();
    check = await checkInstallerUpdate({
      updateServerUrl,
      currentVersion,
      licenseKey: params.licenseKey,
      deviceId: params.deviceId,
    });
  }
  progress?.onCheckComplete?.({
    hasUpdate: check.hasUpdate,
    version: check.version ?? check.latest?.version,
  });

  if (!check.hasUpdate || !check.latest) {
    const result: InstallerUpdateResult = {
      status: check.error ? "error" : "up-to-date",
      mode: "none",
      reason: check.error ?? "already up to date",
      fromVersion: currentVersion,
      durationMs: Date.now() - startedAt,
    };
    return result;
  }

  const latest = check.latest;
  const toVersion = latest.version;
  const tempDir = path.join(root, UPDATE_TEMP_DIR);
  const backupDir = path.join(root, BACKUP_DIR);

  try {
    // 清理临时目录
    await rmrf(tempDir);
    await fs.mkdir(tempDir, { recursive: true });

    // 2. 查找增量包（防御性：确保 deltas 为数组）
    const delta = (latest.deltas ?? []).find((d) => d.from === currentVersion);
    if (!delta) {
      // 没有增量包，不应走到这里（调用方应先判断 updateType）
      const result: InstallerUpdateResult = {
        status: "skipped",
        mode: "none",
        reason: "no delta package available for current version",
        fromVersion: currentVersion,
        toVersion,
        durationMs: Date.now() - startedAt,
      };
      return result;
    }

    progress?.onDownloadStart?.("delta", delta.size);

    // 3. 下载增量包
    const downloadPath = path.join(tempDir, "delta.tar.gz");
    const downloadedBytes = await downloadFile(delta.url, downloadPath, timeoutMs, (dl, total) => {
      progress?.onDownloadProgress?.(dl, total);
    });

    progress?.onDownloadComplete?.();

    // 3.5 校验增量包 SHA256（如果服务端提供了 sha256 字段）
    if (delta.sha256) {
      const actualHash = await sha256File(downloadPath);
      if (actualHash !== delta.sha256) {
        await rmrf(tempDir);
        const result: InstallerUpdateResult = {
          status: "error",
          mode: "delta",
          reason: `delta tarball SHA256 mismatch: expected ${delta.sha256}, got ${actualHash}`,
          fromVersion: currentVersion,
          toVersion,
          durationMs: Date.now() - startedAt,
        };
        return result;
      }
    }

    // 4. 解压
    const extractDir = path.join(tempDir, "extracted");
    await fs.mkdir(extractDir, { recursive: true });
    await extractTarGz(downloadPath, extractDir);

    // 5. 备份当前 dist/, skills/, extensions/, package.json
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

    // 5.5 V8 atomicity check moved into applyDelta() where DeltaManifest is available.

    // 6. 应用增量更新（内含 V8 atomicity check）
    const deltaApplyResult = await applyDeltaWithV8Check(root, extractDir, progress);
    if (deltaApplyResult.v8Mismatch) {
      await rmrf(tempDir);
      await rmrf(backupDir);
      const result: InstallerUpdateResult = {
        status: "skipped",
        mode: "delta",
        reason: "node-jsc-mismatch: node.exe updated without .jsc files, requires full installer",
        fromVersion: currentVersion,
        toVersion,
        durationMs: Date.now() - startedAt,
      };
      return result;
    }
    const filesChanged = deltaApplyResult.filesChanged;

    // 7. 下载并校验 checksums
    const checksumsOk = latest.url?.checksums
      ? await verifyChecksums(root, latest.url.checksums)
      : true; // 无 checksums URL 时跳过校验（不应发生）
    if (!checksumsOk) {
      // 回滚
      progress?.onError?.("校验失败，正在回滚...");
      await rollback(root, backupDir);
      const result: InstallerUpdateResult = {
        status: "error",
        mode: "delta",
        reason: "checksum verification failed, rolled back",
        fromVersion: currentVersion,
        toVersion,
        filesChanged,
        durationMs: Date.now() - startedAt,
      };
      // 上报：回滚成功 = error
      void reportUpdateResult({
        updateServerUrl,
        licenseKey: params.licenseKey,
        deviceId: params.deviceId,
        result,
        reportStatus: "error",
      });
      return result;
    }

    // 8. 检查 package.json 依赖是否变化
    const depsOk = await checkAndInstallDeps(root, backupDir);

    // 9. 清理临时目录和备份目录
    await rmrf(tempDir);
    await rmrf(backupDir);

    const result: InstallerUpdateResult = {
      status: "ok",
      mode: "delta",
      reason: depsOk ? undefined : "update-ok-but-deps-install-failed",
      fromVersion: currentVersion,
      toVersion,
      downloadedBytes,
      filesChanged,
      durationMs: Date.now() - startedAt,
      changelog: latest.changelog,
    };
    // 上报成功
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
    } catch {
      // rollback failed
    }

    const result: InstallerUpdateResult = {
      status: rollbackOk ? "error" : "broken",
      mode: "delta",
      reason: rollbackOk ? errorMsg : `${errorMsg} (rollback also failed)`,
      fromVersion: currentVersion,
      toVersion,
      durationMs: Date.now() - startedAt,
    };
    // 上报：回滚成功 = error，回滚失败 = broken
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

// ─── Path Safety ──────────────────────────────────────

/**
 * FIX BUG#11: 校验目标路径在 root 目录内，防止路径穿越攻击。
 * delta.json 的 entry.path 来自更新服务器，如果被篡改为 "../../etc/cron.d/malicious"
 * 则 path.join(root, entry.path) 会穿越到 root 之外。
 */
function assertWithinRoot(root: string, filePath: string, label: string): void {
  const resolved = path.resolve(filePath);
  const resolvedRoot = path.resolve(root);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    throw new Error(`Path traversal detected in ${label}: ${filePath} escapes root ${root}`);
  }
}

// ─── Apply Strategies ──────────────────────────────────

/**
 * V8 原子性检查 + 应用增量更新
 * 解析 DeltaManifest 后检查 node.exe 与 .jsc 文件是否原子更新，
 * 避免 V8 字节码版本不匹配导致静默崩溃。
 */
async function applyDeltaWithV8Check(
  root: string,
  extractDir: string,
  progress?: InstallerUpdateProgress,
): Promise<{ filesChanged: number; v8Mismatch: boolean }> {
  // 解析 delta.json（只解析一次，后续传递给 applyDelta）
  const deltaJsonPath = await findFile(extractDir, "delta.json");
  if (!deltaJsonPath) {
    throw new Error("delta.json not found in extracted archive");
  }
  const deltaDir = path.dirname(deltaJsonPath);
  const deltaManifest: DeltaManifest = JSON.parse(await fs.readFile(deltaJsonPath, "utf-8"));

  // V8 atomicity check: node.exe 和 .jsc 必须同时更新
  const deltaFiles = [
    ...deltaManifest.added.map((e) => e.path),
    ...deltaManifest.modified.map((e) => e.path),
  ];
  const hasNodeExe = deltaFiles.some((f) => f.endsWith("node.exe") || f.endsWith("node"));
  const hasJsc = deltaFiles.some((f) => f.endsWith(".jsc"));
  if (hasNodeExe && !hasJsc) {
    return { filesChanged: 0, v8Mismatch: true };
  }

  const filesChanged = await applyDelta(root, deltaDir, deltaManifest, progress);
  return { filesChanged, v8Mismatch: false };
}

/**
 * 应用增量更新（接收已解析的 DeltaManifest，避免重复解析）
 */
async function applyDelta(
  root: string,
  deltaDir: string,
  delta: DeltaManifest,
  progress?: InstallerUpdateProgress,
): Promise<number> {
  const totalFiles = delta.added.length + delta.modified.length + delta.removed.length;
  progress?.onApplyStart?.(totalFiles);

  let count = 0;

  // 应用新增文件
  for (const entry of delta.added) {
    const src = path.join(deltaDir, "added", entry.path);
    const dest = path.join(root, entry.path);
    assertWithinRoot(root, dest, `delta.added[${entry.path}]`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);

    // 校验
    const hash = await sha256File(dest);
    if (hash !== entry.sha256) {
      throw new Error(`SHA256 mismatch for added file ${entry.path}`);
    }
    count++;
  }

  // 应用修改文件
  for (const entry of delta.modified) {
    const src = path.join(deltaDir, "modified", entry.path);
    const dest = path.join(root, entry.path);
    assertWithinRoot(root, dest, `delta.modified[${entry.path}]`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);

    // 校验
    const hash = await sha256File(dest);
    if (hash !== entry.sha256) {
      throw new Error(`SHA256 mismatch for modified file ${entry.path}`);
    }
    count++;
  }

  // 删除文件
  for (const relPath of delta.removed) {
    const dest = path.join(root, relPath);
    assertWithinRoot(root, dest, `delta.removed[${relPath}]`);
    try {
      await fs.unlink(dest);
      count++;
    } catch {
      // 文件可能已不存在，忽略
    }
  }

  progress?.onApplyComplete?.();
  return count;
}

// ─── Rollback ──────────────────────────────────────────

async function rollback(root: string, backupDir: string) {
  // Atomic rollback: snapshot current state to a temp dir first so that if
  // copyDir() fails mid-way we can attempt to restore from the snapshot,
  // avoiding a partially-overwritten state.
  const rollbackTempDir = path.join(root, ".rollback-temp-" + Date.now());
  let snapshotCreated = false;
  try {
    // Phase 1: snapshot current (possibly partially-new) files to temp dir
    await fs.mkdir(rollbackTempDir, { recursive: true });
    for (const dir of BACKUP_DIRS) {
      const currentDir = path.join(root, dir);
      if (fsSync.existsSync(currentDir)) {
        await copyDir(currentDir, path.join(rollbackTempDir, dir));
      }
    }
    const currentPkg = path.join(root, "package.json");
    if (fsSync.existsSync(currentPkg)) {
      await fs.copyFile(currentPkg, path.join(rollbackTempDir, "package.json"));
    }
    snapshotCreated = true;

    // Phase 2: restore from backup
    for (const dir of BACKUP_DIRS) {
      const backupSrc = path.join(backupDir, dir);
      if (fsSync.existsSync(backupSrc)) {
        await rmrf(path.join(root, dir));
        await copyDir(backupSrc, path.join(root, dir));
      }
    }
    const backupPkg = path.join(backupDir, "package.json");
    if (fsSync.existsSync(backupPkg)) {
      await fs.copyFile(backupPkg, path.join(root, "package.json"));
    }
  } catch (rollbackErr) {
    // Phase 3: if restore from backup failed and we have a snapshot, try to
    // recover to the pre-rollback state so we are not left completely broken.
    if (snapshotCreated) {
      try {
        for (const dir of BACKUP_DIRS) {
          const snapSrc = path.join(rollbackTempDir, dir);
          if (fsSync.existsSync(snapSrc)) {
            await rmrf(path.join(root, dir));
            await copyDir(snapSrc, path.join(root, dir));
          }
        }
        const snapPkg = path.join(rollbackTempDir, "package.json");
        if (fsSync.existsSync(snapPkg)) {
          await fs.copyFile(snapPkg, path.join(root, "package.json"));
        }
      } catch {
        // Recovery also failed - nothing more we can do.
      }
    }
    throw rollbackErr;
  } finally {
    // Clean up temp snapshot regardless of outcome
    await rmrf(rollbackTempDir).catch(() => {});
  }
}
// ─── Checksums ─────────────────────────────────────────

async function verifyChecksums(root: string, checksumsUrl: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(checksumsUrl, {}, DEFAULT_TIMEOUT_MS);
    if (!res.ok) {
      // checksums 获取失败意味着无法验证完整性，视为校验失败
      return false;
    }

    const checksums = (await res.json()) as Record<string, string>;
    const total = Object.keys(checksums).length;
    if (total === 0) return true;

    let failed = 0;

    // checksums key 格式:
    //   - "skills/..." / "extensions/..." → 直接相对于 root
    //   - 其余 → 相对于 root/dist/（兼容旧格式）
    const ROOTED_PREFIXES = ["skills/", "extensions/"];

    for (const [rawRelPath, expectedHash] of Object.entries(checksums)) {
      // 归一化路径分隔符（防止 Windows 生成的 checksums 含反斜杠）
      const relPath = rawRelPath.replace(/\\/g, "/");
      const isRooted = ROOTED_PREFIXES.some((p) => relPath.startsWith(p));
      const filePath = isRooted ? path.join(root, relPath) : path.join(root, "dist", relPath);
      // FIX BUG-R2-2: checksums 的 key 来自远程服务器，需要路径穿越检查
      assertWithinRoot(root, filePath, `checksums[${relPath}]`);
      try {
        const actualHash = await sha256File(filePath);
        if (actualHash !== expectedHash) {
          failed++;
        }
      } catch {
        // 文件不存在也算校验失败
        failed++;
      }
    }

    // 严格校验：不允许任何文件不匹配
    return failed === 0;
  } catch {
    // 网络错误：无法校验完整性，视为失败以防止降级攻击
    return false;
  }
}

// ─── Dependency Check ──────────────────────────────────

async function checkAndInstallDeps(root: string, backupDir: string): Promise<boolean> {
  try {
    const newPkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf-8"));
    const oldPkgPath = path.join(backupDir, "package.json");

    if (!fsSync.existsSync(oldPkgPath)) return true;
    const oldPkg = JSON.parse(await fs.readFile(oldPkgPath, "utf-8"));

    const newDeps = JSON.stringify(newPkg.dependencies ?? {});
    const oldDeps = JSON.stringify(oldPkg.dependencies ?? {});

    if (newDeps !== oldDeps) {
      // 依赖变化了，执行 pnpm install
      const npmrcExists = fsSync.existsSync(path.join(root, ".npmrc"));
      const registryArg = npmrcExists ? "" : " --registry=https://registry.npmmirror.com";

      // 检测包管理器
      const hasPnpmLock = fsSync.existsSync(path.join(root, "pnpm-lock.yaml"));
      const cmd = hasPnpmLock ? "pnpm" : "npm";

      await execFileAsync(
        cmd,
        ["install", "--omit=dev", ...registryArg.split(" ").filter(Boolean)],
        {
          cwd: root,
          timeout: 5 * 60_000,
        },
      );
    }
    return true;
  } catch (err) {
    // FIX DEPS-1: 不再静默吞掉错误，至少打印日志告知用户
    // 依赖安装失败意味着新代码可能在重启后因 MODULE_NOT_FOUND 崩溃
    console.warn(
      `[installer-updater] dependency install failed (runtime may crash on restart):`,
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

// ─── Install Kind Detection ────────────────────────────

/**
 * 检测安装方式
 * - install.json 存在 → installer 模式（Windows NSIS / macOS DMG 安装的）
 * - .git/ 存在 → git 模式
 * - 其他 → package 模式
 */
export function detectInstallKind(root: string): "installer" | "git" | "package" {
  // Windows NSIS 安装器会在安装目录写 install.json
  if (fsSync.existsSync(path.join(root, "install.json"))) {
    return "installer";
  }

  // macOS .app 包的特征: 向上几层有 Contents/Info.plist
  // app 目录通常是 ClawdbotCN.app/Contents/Resources/app/
  let current = root;
  for (let i = 0; i < 5; i++) {
    const infoPlist = path.join(current, "Contents", "Info.plist");
    if (fsSync.existsSync(infoPlist)) {
      return "installer";
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Git 安装
  if (fsSync.existsSync(path.join(root, ".git"))) {
    return "git";
  }

  return "package";
}

/**
 * 读取更新服务器 URL
 * 优先级: 环境变量 > install.json > 默认值
 */
export function resolveUpdateServerUrl(root: string): string | null {
  // 1. 环境变量
  const envUrl = process.env.OPENCLAWCN_UPDATE_SERVER?.trim();
  if (envUrl) return envUrl;

  // 2. install.json 中可能包含更新服务器配置
  try {
    const installJsonPath = path.join(root, "install.json");
    if (fsSync.existsSync(installJsonPath)) {
      const installJson = JSON.parse(fsSync.readFileSync(installJsonPath, "utf-8"));
      if (installJson.updateServer) return installJson.updateServer;
    }
  } catch {
    // ignore
  }

  // 3. 默认值
  return "https://dl.obplugins.cn";
}

// ─── Update Report ────────────────────────────────────

const REPORT_TIMEOUT_MS = 5000;

/**
 * 通用上报函数（fire-and-forget）
 * 所有上报接口共享 URL、鉴权、超时和错误吞咽逻辑
 */
async function sendUpdateReport(params: {
  updateServerUrl: string;
  licenseKey?: string;
  deviceId?: string;
  body: Record<string, unknown>;
}): Promise<void> {
  if (!params.licenseKey || !params.deviceId) return;
  try {
    await fetchWithTimeout(
      `${params.updateServerUrl}${UPDATE_API_PATH}/report`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: params.licenseKey,
          deviceId: params.deviceId,
          platform: process.platform,
          arch: process.arch,
          ...params.body,
        }),
      },
      REPORT_TIMEOUT_MS,
    );
  } catch {
    // 上报失败不阻塞
  }
}

/**
 * 上报更新结果到服务端
 */
export async function reportUpdateResult(params: {
  updateServerUrl: string;
  licenseKey?: string;
  deviceId?: string;
  result: InstallerUpdateResult;
  reportStatus?: UpdateReportStatus;
}): Promise<void> {
  // mode === "none" 表示未实际执行更新（up-to-date/检查失败），无需上报
  if (params.result.mode === "none") return;
  await sendUpdateReport({
    updateServerUrl: params.updateServerUrl,
    licenseKey: params.licenseKey,
    deviceId: params.deviceId,
    body: {
      fromVersion: params.result.fromVersion,
      toVersion: params.result.toVersion ?? null,
      status: params.reportStatus ?? params.result.status,
      mode: params.result.mode,
      durationMs: params.result.durationMs,
      downloadedBytes: params.result.downloadedBytes ?? 0,
      filesChanged: params.result.filesChanged ?? 0,
      error: params.result.reason ?? null,
    },
  });
}

/**
 * 上报"引导用户去下载安装包"事件
 */
export async function reportInstallerRedirect(params: {
  updateServerUrl: string;
  licenseKey?: string;
  deviceId?: string;
  fromVersion: string;
  toVersion: string;
}): Promise<void> {
  await sendUpdateReport({
    updateServerUrl: params.updateServerUrl,
    licenseKey: params.licenseKey,
    deviceId: params.deviceId,
    body: {
      fromVersion: params.fromVersion,
      toVersion: params.toVersion,
      status: "redirect_to_installer",
      mode: "installer",
      durationMs: 0,
      downloadedBytes: 0,
      filesChanged: 0,
      error: null,
    },
  });
}

// ─── File Utilities ────────────────────────────────────

async function downloadFile(
  url: string,
  destPath: string,
  timeoutMs: number,
  onProgress?: (downloaded: number, total: number) => void,
): Promise<number> {
  const res = await fetchWithTimeout(url, {}, timeoutMs);
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status} from ${url}`);
  }
  if (!res.body) {
    throw new Error("Response body is null");
  }

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  const fileStream = createWriteStream(destPath);
  let downloaded = 0;

  // Register finish/error listeners BEFORE writing to avoid race conditions
  const streamDone = new Promise<void>((resolve, reject) => {
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
  });

  // Use web stream → node stream with backpressure handling
  // FIX R3-6: 添加读取活动超时，防止远程服务器停滞导致下载永久挂起
  const STALL_TIMEOUT_MS = 30_000; // 30 秒无数据视为停滞
  const reader = res.body.getReader();
  try {
    while (true) {
      let stallTimer: ReturnType<typeof setTimeout> | null = null;
      const readPromise = reader.read();
      const stallPromise = new Promise<never>((_, reject) => {
        stallTimer = setTimeout(
          () => reject(new Error(`Download stalled: no data received for ${STALL_TIMEOUT_MS}ms`)),
          STALL_TIMEOUT_MS,
        );
      });
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await Promise.race([readPromise, stallPromise]);
      } finally {
        if (stallTimer != null) clearTimeout(stallTimer);
      }
      const { done, value } = result;
      if (done) break;
      const canContinue = fileStream.write(value);
      downloaded += value.byteLength;
      onProgress?.(downloaded, contentLength);
      // Wait for drain if the internal buffer is full (backpressure)
      if (!canContinue) {
        await new Promise<void>((resolve) => fileStream.once("drain", resolve));
      }
    }
  } finally {
    fileStream.end();
    reader.releaseLock();
  }

  // Wait for file stream to flush to disk
  await streamDone;

  return downloaded;
}

async function extractTarGz(tarPath: string, destDir: string) {
  if (process.platform === "win32") {
    // Windows: 尝试 Git 自带的 tar
    const gitTarPaths = [
      "C:\\Program Files\\Git\\usr\\bin\\tar.exe",
      "C:\\Program Files (x86)\\Git\\usr\\bin\\tar.exe",
    ];
    let tarCmd = "tar";
    for (const p of gitTarPaths) {
      if (fsSync.existsSync(p)) {
        tarCmd = p;
        break;
      }
    }
    await execFileAsync(tarCmd, ["-xzf", tarPath, "-C", destDir], {
      timeout: 60_000,
    });
  } else {
    await execFileAsync("tar", ["-xzf", tarPath, "-C", destDir], {
      timeout: 60_000,
    });
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function rmrf(dir: string) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function findFile(dir: string, name: string): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const found = await findFile(full, name);
      if (found) return found;
    }
  }
  return null;
}

/**
 * FIX BUG-R2-3: 安全的版本比较，处理预发布标签（如 "1.2.3-beta.1"）
 * 剥离预发布后缀后比较数字部分；纯数字版本号优先于带预发布标签的同版本号。
 */
function compareVersions(a: string, b: string): number {
  // 剥离预发布标签（取 '-' 之前的部分）
  const stripPre = (v: string) => v.replace(/^v/i, "").split("-")[0];
  const preTag = (v: string) => {
    const idx = v.replace(/^v/i, "").indexOf("-");
    return idx >= 0 ? v.replace(/^v/i, "").slice(idx + 1) : "";
  };

  const pa = stripPre(a)
    .split(".")
    .map((s) => {
      const n = Number(s);
      return Number.isNaN(n) ? 0 : n;
    });
  const pb = stripPre(b)
    .split(".")
    .map((s) => {
      const n = Number(s);
      return Number.isNaN(n) ? 0 : n;
    });

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }

  // 数字部分相同时：无预发布标签 > 有预发布标签（1.2.3 > 1.2.3-beta）
  const preA = preTag(a);
  const preB = preTag(b);
  if (!preA && preB) return 1; // a 是正式版，b 是预发布
  if (preA && !preB) return -1; // a 是预发布，b 是正式版

  return 0;
}
