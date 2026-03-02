/**
 * Mirror Download Engine
 * Orchestrates batch installation of skills using Chinese mirror sources.
 * OpenClawCN: mirror-based batch skill installation
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { installSkill } from "../../agents/skills-install.js";
import {
  PACKAGE_MANAGER_MIRRORS,
  BINARY_DOWNLOAD_MIRRORS,
  shouldUseCNMirror,
  getNpmMirrors,
  getPipMirrors,
  getGitHubProxies,
} from "../../config/cn-mirrors.js";
import { loadConfig } from "../../config/config.js";
import { CONFIG_DIR } from "../../utils.js";
import { markSkillInstalled, recordBatchInstallTimestamp } from "./install-state.js";
import { getManagedSkillsDir, installRemoteSkill } from "./gitee-registry.js";
import { loadWorkspaceSkillEntries, invalidateSkillEntriesCache } from "../../agents/skills.js";
import { refreshInstalledList } from "./sync.js";
import { bumpSkillsSnapshotVersion } from "./refresh.js";

// ---------------------------------------------------------------------------
// Event types — all snake_case, frontend translates to camelCase
// ---------------------------------------------------------------------------

export type SkillProgressEvent = {
  type: "skill.progress";
  skill: string;
  stage: "queued" | "downloading" | "retrying" | "verifying" | "installing" | "done" | "failed";
  percent?: number;
  bytes_downloaded?: number;
  bytes_total?: number;
  speed_bps?: number;
  mirror?: string;
  error?: string;
  retry_mirror?: string;
};

export type BatchProgressEvent = {
  type: "batch.progress";
  completed: number;
  total: number;
  bytes_downloaded: number;
  bytes_total: number;
  speed_bps: number;
  active_mirror?: string;
  active_mirror_latency_ms?: number;
};

export type BatchCompleteEvent = {
  type: "batch.complete";
  succeeded: string[];
  failed: { skill: string; error: string; mirrors_tried: string[] }[];
  duration_ms: number;
};

export type ProgressCallback = (
  event: SkillProgressEvent | BatchProgressEvent | BatchCompleteEvent,
) => void;

// ---------------------------------------------------------------------------
// MirrorSelector — probes mirror URLs and provides ordered access
// ---------------------------------------------------------------------------

export type MirrorEntry = {
  url: string;
  latency_ms: number;
  available: boolean;
};

export class MirrorSelector {
  private mirrors: MirrorEntry[] = [];
  private currentIndex = 0;

  constructor(private mirrorUrls: string[]) {}

  async probe(): Promise<MirrorEntry[]> {
    const settled = await Promise.allSettled(
      this.mirrorUrls.map(async (url): Promise<MirrorEntry> => {
        const start = Date.now();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(url, {
            method: "HEAD",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return {
            url,
            latency_ms: Date.now() - start,
            // 405 (Method Not Allowed) means the server exists but rejects HEAD — still usable.
            // 403 (Forbidden) on HEAD probe often means CDN/WAF protection — the server
            // is alive and actual GET downloads typically succeed, so treat as available.
            available: response.ok || response.status === 405 || response.status === 403,
          };
        } catch {
          return { url, latency_ms: Date.now() - start, available: false };
        }
      }),
    );
    const results = settled.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { url: this.mirrorUrls[i], latency_ms: 5000, available: false },
    );
    results.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.latency_ms - b.latency_ms;
    });
    this.mirrors = results;
    this.currentIndex = 0;
    return results;
  }

  getBest(): string | undefined {
    return this.mirrors.filter((m) => m.available)[0]?.url;
  }

  getNext(): string | undefined {
    const available = this.mirrors.filter((m) => m.available);
    if (this.currentIndex >= available.length) return undefined;
    const mirror = available[this.currentIndex];
    this.currentIndex++;
    return mirror?.url;
  }

  reset(): void {
    this.currentIndex = 0;
  }

  getCurrentLatency(): number | undefined {
    const available = this.mirrors.filter((m) => m.available);
    const idx = Math.max(0, this.currentIndex - 1);
    return available[idx]?.latency_ms;
  }
}

class Semaphore {
  private current = 0;
  private queue: (() => void)[] = [];
  constructor(private maxConcurrent: number) {}
  async acquire(): Promise<void> {
    if (this.current < this.maxConcurrent) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }
  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }
}

export class IntegrityVerifier {
  static async sha256File(filePath: string): Promise<string> {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    return new Promise<string>((resolve, reject) => {
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }
  static async verify(filePath: string, expectedHash: string): Promise<boolean> {
    const actual = await IntegrityVerifier.sha256File(filePath);
    return actual.toLowerCase() === expectedHash.toLowerCase();
  }
  static hashBuffer(data: Buffer): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }
}

// ---------------------------------------------------------------------------
// Mirror environment helpers
// ---------------------------------------------------------------------------

/**
 * Build a complete mirror environment for all package managers.
 * Sets npm, pip, go, cargo, GitHub proxy, node binary mirrors etc.
 */
export function buildMirrorEnv(): Record<string, string> {
  if (!shouldUseCNMirror()) return {};
  const env: Record<string, string> = {};
  const npmMirrors = getNpmMirrors();
  if (npmMirrors.length > 0) {
    env["npm_config_registry"] = npmMirrors[0];
    env["YARN_REGISTRY"] = npmMirrors[0];
    env["PNPM_REGISTRY"] = npmMirrors[0];
  }
  const pipMirrors = getPipMirrors();
  if (pipMirrors.length > 0) {
    env["PIP_INDEX_URL"] = pipMirrors[0];
    env["PIP_TRUSTED_HOST"] = new URL(pipMirrors[0]).hostname;
  }
  if (PACKAGE_MANAGER_MIRRORS.go) {
    env["GOPROXY"] = [
      PACKAGE_MANAGER_MIRRORS.go.primary,
      PACKAGE_MANAGER_MIRRORS.go.fallback,
      "direct",
    ].join(",");
    env["GONOSUMCHECK"] = "*";
  }
  if (PACKAGE_MANAGER_MIRRORS.cargo) {
    env["CARGO_HTTP_MULTIPLEXING"] = "false";
  }
  const ghProxies = getGitHubProxies();
  if (ghProxies.length > 0) {
    env["GITHUB_PROXY"] = ghProxies[0];
  }
  if (BINARY_DOWNLOAD_MIRRORS.node) {
    env["NODE_MIRROR"] = BINARY_DOWNLOAD_MIRRORS.node.primary;
    env["NVM_NODEJS_ORG_MIRROR"] = BINARY_DOWNLOAD_MIRRORS.node.primary;
    env["FNM_NODE_DIST_MIRROR"] = BINARY_DOWNLOAD_MIRRORS.node.primary;
  }
  return env;
}

/**
 * Build mirror env for a specific install method and mirror index.
 * On retry, rotates to the next mirror source for that method.
 */
function buildMirrorEnvForMethod(method: string, mirrorIndex: number): Record<string, string> {
  if (!shouldUseCNMirror()) return {};
  const base = buildMirrorEnv();

  // Override the method-specific mirror based on retry index
  if (method === "node" || method === "npm") {
    const mirrors = getNpmMirrors();
    const idx = mirrorIndex % mirrors.length;
    if (mirrors[idx]) {
      base["npm_config_registry"] = mirrors[idx];
      base["YARN_REGISTRY"] = mirrors[idx];
      base["PNPM_REGISTRY"] = mirrors[idx];
    }
  } else if (method === "uv" || method === "pip") {
    const mirrors = getPipMirrors();
    const idx = mirrorIndex % mirrors.length;
    if (mirrors[idx]) {
      base["PIP_INDEX_URL"] = mirrors[idx];
      base["PIP_TRUSTED_HOST"] = new URL(mirrors[idx]).hostname;
    }
  } else if (method === "go") {
    // Go proxy rotation — swap primary/fallback order
    if (PACKAGE_MANAGER_MIRRORS.go && mirrorIndex > 0) {
      const proxies = [
        PACKAGE_MANAGER_MIRRORS.go.fallback,
        PACKAGE_MANAGER_MIRRORS.go.primary,
        "direct",
      ];
      base["GOPROXY"] = proxies.join(",");
    }
  } else {
    // For download, brew, cargo, winget, scoop, and any other method:
    // Always rotate GitHub proxy — many methods eventually need GitHub downloads
    const ghProxies = getGitHubProxies();
    if (ghProxies.length > 0) {
      const idx = mirrorIndex % ghProxies.length;
      base["GITHUB_PROXY"] = ghProxies[idx];
    }
  }

  return base;
}

// ---------------------------------------------------------------------------
// Env mutex — serializes withMirrorEnv calls so that concurrent
// installSingleSkill tasks don't corrupt each other's process.env.
// The download phase (installRemoteSkill) is still fully concurrent;
// only the env-sensitive installSkill phase is serialized.
// ---------------------------------------------------------------------------

let _envMutexQueue: Promise<void> = Promise.resolve();

function withEnvLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _envMutexQueue;
  let resolve: () => void;
  _envMutexQueue = new Promise<void>((r) => {
    resolve = r;
  });
  return prev.then(async () => {
    try {
      return await fn();
    } finally {
      resolve!();
    }
  });
}

export async function withMirrorEnv<T>(
  fn: () => Promise<T>,
  mirrorEnv?: Record<string, string>,
): Promise<T> {
  return withEnvLock(async () => {
    const env = mirrorEnv ?? buildMirrorEnv();
    const keys = Object.keys(env);
    const saved: Record<string, string | undefined> = {};
    for (const key of keys) {
      saved[key] = process.env[key];
      process.env[key] = env[key];
    }
    try {
      return await fn();
    } finally {
      for (const key of keys) {
        if (saved[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = saved[key];
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// installSingleSkill
// ---------------------------------------------------------------------------

type SingleSkillResult = {
  ok: boolean;
  skill: string;
  message: string;
  mirrors_tried: string[];
  duration_ms: number;
};

async function installSingleSkill(
  skillName: string,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<SingleSkillResult> {
  const startTime = Date.now();
  const mirrorsTried: string[] = [];
  const cfg = loadConfig();
  const managedSkillsDir = getManagedSkillsDir();

  if (signal?.aborted) {
    return {
      ok: false,
      skill: skillName,
      message: "cancelled",
      mirrors_tried: mirrorsTried,
      duration_ms: Date.now() - startTime,
    };
  }

  onProgress({ type: "skill.progress", skill: skillName, stage: "downloading" });

  // Step 1: Download skill definition from remote registry (with retry)
  // 注册表下载失败是国内最常见的问题，增加重试提高成功率
  let remoteResult: Awaited<ReturnType<typeof installRemoteSkill>> | null = null;
  for (let remoteAttempt = 0; remoteAttempt < 3; remoteAttempt++) {
    if (signal?.aborted) {
      return {
        ok: false,
        skill: skillName,
        message: "cancelled",
        mirrors_tried: mirrorsTried,
        duration_ms: Date.now() - startTime,
      };
    }
    if (remoteAttempt > 0) {
      // 退避 1s → 3s
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(3, remoteAttempt - 1)));
    }
    remoteResult = await installRemoteSkill(
      { name: skillName, description: "", path: skillName },
      undefined,
      managedSkillsDir,
    );
    if (remoteResult.ok) break;
  }

  if (!remoteResult || !remoteResult.ok) {
    const error = remoteResult?.error ?? "registry download failed";
    onProgress({ type: "skill.progress", skill: skillName, stage: "failed", error });
    return {
      ok: false,
      skill: skillName,
      message: error,
      mirrors_tried: mirrorsTried,
      duration_ms: Date.now() - startTime,
    };
  }

  // Load skill entries once — used by both bundled-binary detection and install-spec resolution.
  // This call is now TTL-cached so repeated calls within a batch install are nearly free.
  const skillEntries = loadWorkspaceSkillEntries(managedSkillsDir, { config: cfg });
  const targetEntry = skillEntries.find((e) => e.skill.name === skillName);

  // Step 1.5: 本地预置二进制检测 — 安装包已内置的工具跳过网络下载
  const bundledToolsDir = process.env.OPENCLAWCN_BUNDLED_TOOLS_DIR;
  if (bundledToolsDir) {
    const requiredBins = targetEntry?.metadata?.requires?.bins ?? [];

    if (requiredBins.length > 0) {
      const ext = process.platform === "win32" ? ".exe" : "";
      const allBundled = requiredBins.every((bin) =>
        fs.existsSync(path.join(bundledToolsDir, bin + ext)),
      );

      if (allBundled) {
        // 将预置二进制复制到 ~/.openclawcn/tools/{toolName}/
        let copyOk = true;
        for (const bin of requiredBins) {
          const src = path.join(bundledToolsDir, bin + ext);
          const destDir = path.join(CONFIG_DIR, "tools", bin);
          const dest = path.join(destDir, bin + ext);
          try {
            fs.mkdirSync(destDir, { recursive: true });
            fs.copyFileSync(src, dest);
            // 非 Windows 需设置可执行权限
            if (process.platform !== "win32") {
              fs.chmodSync(dest, 0o755);
            }
          } catch {
            copyOk = false;
            break;
          }
        }

        if (copyOk) {
          onProgress({ type: "skill.progress", skill: skillName, stage: "done" });
          const durationMs = Date.now() - startTime;
          await markSkillInstalled(skillName, {
            version: "1.0.0",
            installed_at: new Date().toISOString(),
            method: "bundled",
            mirror_used: "local",
            size_bytes: 0,
          });
          return {
            ok: true,
            skill: skillName,
            message: "installed (bundled)",
            mirrors_tried: ["local"],
            duration_ms: durationMs,
          };
        }
        // 复制失败则 fallthrough 到网络下载
      }
    }
  }

  // Step 2: Detect install specs and filter for current platform

  if (targetEntry && targetEntry.metadata?.install && targetEntry.metadata.install.length > 0) {
    const platform = process.platform;
    const filteredInstall = targetEntry.metadata.install.filter((spec) => {
      const osList = spec.os ?? [];
      if (osList.length > 0 && !osList.includes(platform)) return false;
      if (spec.kind === "brew" && platform !== "darwin") return false;
      return true;
    });

    if (filteredInstall.length === 0) {
      // No install specs match the current platform — skip without marking as installed
      onProgress({ type: "skill.progress", skill: skillName, stage: "done" });
      return {
        ok: true,
        skill: skillName,
        message: "skipped (no install specs for current platform)",
        mirrors_tried: mirrorsTried,
        duration_ms: Date.now() - startTime,
      };
    }

    if (filteredInstall.length > 0) {
      const firstSpec = filteredInstall[0];
      const installId = firstSpec.id ?? `${firstSpec.kind}-0`;
      const installMethod: string = firstSpec.kind ?? "download";

      onProgress({ type: "skill.progress", skill: skillName, stage: "installing" });

      // Retry loop: try with different mirror indices for the specific method
      const maxRetries = 3;
      let lastError = "";
      let installOk = false;

      for (let attempt = 0; attempt < maxRetries && !installOk; attempt++) {
        if (signal?.aborted) {
          return {
            ok: false,
            skill: skillName,
            message: "cancelled",
            mirrors_tried: mirrorsTried,
            duration_ms: Date.now() - startTime,
          };
        }

        // 指数退避: 0s → 1s → 3s（降低服务器压力，避免重试风暴）
        if (attempt > 0) {
          const backoffMs = Math.min(1000 * Math.pow(3, attempt - 1), 30_000);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }

        const mirrorEnv = buildMirrorEnvForMethod(installMethod, attempt);
        // Resolve mirror label based on actual install method
        let mirrorLabel: string;
        if (
          (installMethod === "node" || installMethod === "npm") &&
          mirrorEnv["npm_config_registry"]
        ) {
          mirrorLabel = mirrorEnv["npm_config_registry"];
        } else if (
          (installMethod === "uv" || installMethod === "pip") &&
          mirrorEnv["PIP_INDEX_URL"]
        ) {
          mirrorLabel = mirrorEnv["PIP_INDEX_URL"];
        } else if (installMethod === "go" && mirrorEnv["GOPROXY"]) {
          mirrorLabel = mirrorEnv["GOPROXY"].split(",")[0];
        } else if (mirrorEnv["GITHUB_PROXY"]) {
          mirrorLabel = mirrorEnv["GITHUB_PROXY"];
        } else {
          mirrorLabel = mirrorEnv["npm_config_registry"] ?? "direct";
        }
        mirrorsTried.push(mirrorLabel);

        if (attempt > 0) {
          onProgress({
            type: "skill.progress",
            skill: skillName,
            stage: "retrying",
            error: lastError,
            retry_mirror: mirrorLabel,
          });
        }

        try {
          const result = await withMirrorEnv(async () => {
            return installSkill({
              workspaceDir: managedSkillsDir,
              skillName,
              installId,
              timeoutMs: 180_000,
              config: cfg,
            });
          }, mirrorEnv);

          if (result.ok) {
            installOk = true;
          } else {
            lastError = result.message;
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
        }
      }

      if (!installOk) {
        onProgress({ type: "skill.progress", skill: skillName, stage: "failed", error: lastError });
        return {
          ok: false,
          skill: skillName,
          message: lastError,
          mirrors_tried: mirrorsTried,
          duration_ms: Date.now() - startTime,
        };
      }
    }
  }

  // Record success
  const durationMs = Date.now() - startTime;
  await markSkillInstalled(skillName, {
    version: "1.0.0",
    installed_at: new Date().toISOString(),
    method: "batch",
    mirror_used: mirrorsTried[mirrorsTried.length - 1] ?? "direct",
    size_bytes: 0,
  });

  onProgress({ type: "skill.progress", skill: skillName, stage: "done" });

  return {
    ok: true,
    skill: skillName,
    message: "installed",
    mirrors_tried: mirrorsTried,
    duration_ms: durationMs,
  };
}

// ---------------------------------------------------------------------------
// Batch install orchestrator
// ---------------------------------------------------------------------------

export type BatchInstallOptions = {
  skills: string[];
  concurrency?: number;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
};

export type BatchInstallResult = {
  succeeded: string[];
  failed: { skill: string; error: string; mirrors_tried: string[] }[];
  duration_ms: number;
};

export async function batchInstall(options: BatchInstallOptions): Promise<BatchInstallResult> {
  const { skills: rawSkills, concurrency = 3, onProgress, signal } = options;

  // 小包优先排序: 大体积技能放到队列末尾，用户看到进度条快速推进
  const LARGE_SKILL_NAMES = new Set(["openai-whisper", "sherpa-onnx-tts", "video-frames"]);
  const skills = [...rawSkills].sort((a, b) => {
    const aLarge = LARGE_SKILL_NAMES.has(a) ? 1 : 0;
    const bLarge = LARGE_SKILL_NAMES.has(b) ? 1 : 0;
    return aLarge - bLarge;
  });

  const startTime = Date.now();
  const succeeded: string[] = [];
  const failed: { skill: string; error: string; mirrors_tried: string[] }[] = [];
  const semaphore = new Semaphore(concurrency);

  const emitProgress: ProgressCallback = onProgress ?? (() => {});

  // Emit initial queued state for all skills
  for (const skill of skills) {
    emitProgress({ type: "skill.progress", skill, stage: "queued" });
  }

  // Probe npm mirrors for display purposes (best mirror shown in UI)
  const npmMirrors = getNpmMirrors();
  const displayMirrorSelector = new MirrorSelector(npmMirrors);
  await displayMirrorSelector.probe();

  let completedCount = 0;

  const tasks = skills.map(async (skillName) => {
    await semaphore.acquire();
    try {
      if (signal?.aborted) {
        failed.push({ skill: skillName, error: "cancelled", mirrors_tried: [] });
        return;
      }

      const result = await installSingleSkill(skillName, emitProgress, signal);

      if (result.ok) {
        succeeded.push(skillName);
      } else {
        failed.push({
          skill: skillName,
          error: result.message,
          mirrors_tried: result.mirrors_tried,
        });
      }

      completedCount++;
      emitProgress({
        type: "batch.progress",
        completed: completedCount,
        total: skills.length,
        bytes_downloaded: 0,
        bytes_total: 0,
        speed_bps: 0,
        active_mirror: displayMirrorSelector.getBest(),
        active_mirror_latency_ms: displayMirrorSelector.getCurrentLatency(),
      });
    } finally {
      semaphore.release();
    }
  });

  await Promise.allSettled(tasks);

  // Post-install housekeeping
  await recordBatchInstallTimestamp();
  invalidateSkillEntriesCache(); // flush stale skill-entries cache
  refreshInstalledList().catch(() => {});
  bumpSkillsSnapshotVersion({ reason: "manual" });

  const durationMs = Date.now() - startTime;

  emitProgress({ type: "batch.complete", succeeded, failed, duration_ms: durationMs });

  return { succeeded, failed, duration_ms: durationMs };
}
