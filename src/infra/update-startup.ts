import fs from "node:fs/promises";
import path from "node:path";
import type { loadConfig } from "../config/config.js";
import { formatCliCommand } from "../cli/command-format.js";
import { resolveStateDir } from "../config/paths.js";
import { VERSION } from "../version.js";
import { resolveOpenClawCNPackageRoot } from "./openclaw-root.js";
import { normalizeUpdateChannel, DEFAULT_PACKAGE_CHANNEL } from "./update-channels.js";
import { compareSemverStrings, resolveNpmChannelTag, checkUpdateStatus } from "./update-check.js";
import {
  checkInstallerUpdate,
  resolveUpdateServerUrl,
  reportInstallerRedirect,
} from "./installer-updater.js";
import { extractUpdateContent } from "./update-content.js";
import { getDeviceId } from "../license/device-id.js";

type UpdateCheckState = {
  lastCheckedAt?: string;
  lastNotifiedVersion?: string;
  lastNotifiedTag?: string;
  /** 服务端下发的检查间隔(毫秒)，覆盖默认 24h */
  nextCheckIntervalMs?: number;
};

const UPDATE_CHECK_FILENAME = "update-check.json";
const DEFAULT_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

function shouldSkipCheck(allowInTests: boolean): boolean {
  if (allowInTests) {
    return false;
  }
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return true;
  }
  return false;
}

async function readState(statePath: string): Promise<UpdateCheckState> {
  try {
    const raw = await fs.readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw) as UpdateCheckState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeState(statePath: string, state: UpdateCheckState): Promise<void> {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
}

export async function runGatewayUpdateCheck(params: {
  cfg: ReturnType<typeof loadConfig>;
  log: { info: (msg: string, meta?: Record<string, unknown>) => void };
  isNixMode: boolean;
  allowInTests?: boolean;
}): Promise<void> {
  if (shouldSkipCheck(Boolean(params.allowInTests))) {
    return;
  }
  if (params.isNixMode) {
    return;
  }
  if (params.cfg.update?.checkOnStart === false) {
    return;
  }

  const statePath = path.join(resolveStateDir(), UPDATE_CHECK_FILENAME);
  const state = await readState(statePath);
  const now = Date.now();
  const lastCheckedAt = state.lastCheckedAt ? Date.parse(state.lastCheckedAt) : null;
  // 使用服务端下发的间隔，或默认 24h
  const checkIntervalMs = state.nextCheckIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
  if (lastCheckedAt && Number.isFinite(lastCheckedAt)) {
    if (now - lastCheckedAt < checkIntervalMs) {
      return;
    }
  }

  const root = await resolveOpenClawCNPackageRoot({
    moduleUrl: import.meta.url,
    argv1: process.argv[1],
    cwd: process.cwd(),
  });
  const status = await checkUpdateStatus({
    root,
    timeoutMs: 2500,
    fetchGit: false,
    includeRegistry: false,
  });

  const nextState: UpdateCheckState = {
    ...state,
    lastCheckedAt: new Date(now).toISOString(),
  };

  // installer 模式：从更新服务器检查
  if (status.installKind === "installer") {
    const updateServerUrl = root ? resolveUpdateServerUrl(root) : null;
    if (updateServerUrl) {
      // 读取 license key 和 deviceId
      const licenseKey = params.cfg.license?.key;
      const deviceId = licenseKey ? getDeviceId() : undefined;

      const check = await checkInstallerUpdate({
        updateServerUrl,
        currentVersion: VERSION,
        licenseKey,
        deviceId,
        timeoutMs: 5000,
      });

      // 保存服务端下发的检查间隔
      if (check.nextCheckAfterSeconds && check.nextCheckAfterSeconds > 0) {
        nextState.nextCheckIntervalMs = check.nextCheckAfterSeconds * 1000;
      }

      if (check.hasUpdate) {
        if (check.updateType === "installer") {
          // 版本跨度大，没有增量包 → 引导重装
          const ver = check.version ?? "latest";
          const shouldNotify = ver !== "latest" && state.lastNotifiedVersion !== ver;
          if (shouldNotify) {
            params.log.info(
              `更新可用: v${ver} (当前 v${VERSION})，当前版本过旧，请下载最新安装包重新安装`,
            );
            if (check.installerUrl) {
              params.log.info(`  下载地址: ${check.installerUrl}`);
            }
            nextState.lastNotifiedVersion = ver;
            // 上报引导重装事件
            void reportInstallerRedirect({
              updateServerUrl,
              licenseKey,
              deviceId,
              fromVersion: VERSION,
              toVersion: ver,
            });
          }
        } else if (check.latest) {
          // 有增量包 → 提示热更新
          const ver = check.version ?? check.latest.version;
          const shouldNotify = state.lastNotifiedVersion !== ver;
          if (shouldNotify) {
            const mandatory = check.mandatory ? " [强制更新]" : "";
            params.log.info(
              `update available: v${ver} (current v${VERSION}).${mandatory} Run: ${formatCliCommand("openclawcn update")}`,
            );
            const content = extractUpdateContent(check.latest);
            if (content.summary) {
              params.log.info(`  更新内容: ${content.summary}`);
            }
            nextState.lastNotifiedVersion = ver;
          }
        }
      }
    }
    await writeState(statePath, nextState);
    return;
  }

  if (status.installKind !== "package") {
    await writeState(statePath, nextState);
    return;
  }

  const channel = normalizeUpdateChannel(params.cfg.update?.channel) ?? DEFAULT_PACKAGE_CHANNEL;
  const resolved = await resolveNpmChannelTag({ channel, timeoutMs: 2500 });
  const tag = resolved.tag;
  if (!resolved.version) {
    await writeState(statePath, nextState);
    return;
  }

  const cmp = compareSemverStrings(VERSION, resolved.version);
  if (cmp != null && cmp < 0) {
    const shouldNotify =
      state.lastNotifiedVersion !== resolved.version || state.lastNotifiedTag !== tag;
    if (shouldNotify) {
      params.log.info(
        `update available (${tag}): v${resolved.version} (current v${VERSION}). Run: ${formatCliCommand("openclawcn update")}`,
      );
      nextState.lastNotifiedVersion = resolved.version;
      nextState.lastNotifiedTag = tag;
    }
  }

  await writeState(statePath, nextState);
}

export function scheduleGatewayUpdateCheck(params: {
  cfg: ReturnType<typeof loadConfig>;
  log: { info: (msg: string, meta?: Record<string, unknown>) => void };
  isNixMode: boolean;
}): void {
  void runGatewayUpdateCheck(params).catch(() => {});
}
