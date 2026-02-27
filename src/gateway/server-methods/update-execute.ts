/**
 * Update Execute — 增量更新 RPC 处理器
 *
 * 提供 4 个 RPC 方法供 UI 调用：
 *   update.check    — 立即检查更新（用户主动触发）
 *   update.status   — 获取缓存的可用更新状态（UI 重连恢复用）
 *   update.execute  — 执行更新（delta → full → installer 三级级联）
 *   update.dismiss  — 忽略当前版本的更新通知
 */

import type { GatewayRequestHandlers } from "./types.js";
import { loadConfig } from "../../config/config.js";
import { resolveOpenClawCNPackageRoot } from "../../infra/openclaw-root.js";
import { VERSION } from "../../version.js";
import {
  checkInstallerUpdate,
  resolveUpdateServerUrl,
  runInstallerUpdate,
  type InstallerUpdateProgress,
} from "../../infra/installer-updater.js";
import { runFullTarUpdate } from "../../infra/installer-updater-full.js";
import {
  getAvailableUpdate,
  setAvailableUpdate,
  clearAvailableUpdate,
  dismissAvailableUpdate,
} from "../../infra/update-state.js";
import { extractUpdateContent } from "../../infra/update-content.js";
import {
  type RestartSentinelPayload,
  writeRestartSentinel,
  formatDoctorNonInteractiveHint,
} from "../../infra/restart-sentinel.js";
import { scheduleGatewaySigusr1Restart } from "../../infra/restart.js";
import { getDeviceId } from "../../license/device-id.js";

/** 防止并发执行更新（双击/重试竞态会损坏安装） */
let updateExecuteInProgress = false;

/** S5-3: 更新成功后等待用户点击重启（30s 后自动重启） */
let pendingUpdateRestart: {
  sentinelPath: string | null;
  sentinelPayload: RestartSentinelPayload;
  fallbackTimer: ReturnType<typeof setTimeout>;
} | null = null;

export const updateExecuteHandlers: GatewayRequestHandlers = {
  /**
   * 立即检查更新（用户主动触发）
   */
  "update.check": async ({ respond, context }) => {
    try {
      const config = loadConfig();
      const root =
        (await resolveOpenClawCNPackageRoot({
          moduleUrl: import.meta.url,
          argv1: process.argv[1],
          cwd: process.cwd(),
        })) ?? process.cwd();

      const updateServerUrl = resolveUpdateServerUrl(root);
      if (!updateServerUrl) {
        respond(true, { hasUpdate: false, error: "no update server configured" });
        return;
      }

      const licenseKey = config.license?.key;
      const deviceId = licenseKey ? getDeviceId() : undefined;

      const check = await checkInstallerUpdate({
        updateServerUrl,
        currentVersion: VERSION,
        licenseKey,
        deviceId,
        timeoutMs: 10_000,
      });

      if (check.hasUpdate && check.version) {
        const changelog = check.latest?.changelog ?? { "zh-CN": "", "en-US": "" };
        const content = check.latest ? extractUpdateContent(check.latest) : null;
        const updateState = {
          version: check.version,
          updateType: check.updateType ?? ("installer" as const),
          changelog,
          checkedAt: new Date().toISOString(),
          dismissed: false,
          mandatory: check.mandatory,
          installerUrl: check.installerUrl,
          checkResult: check,
        };
        await setAvailableUpdate(updateState);

        // 广播更新可用事件
        context.broadcast(
          "update.available",
          {
            version: check.version,
            updateType: check.updateType,
            changelog,
            summary: content?.summary ?? "",
            mandatory: check.mandatory ?? false,
            installerUrl: check.installerUrl,
          },
          { dropIfSlow: true },
        );
      }

      respond(true, {
        hasUpdate: check.hasUpdate,
        version: check.version,
        updateType: check.updateType,
        error: check.error,
      });
    } catch (err) {
      respond(true, {
        hasUpdate: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  /**
   * 获取缓存的可用更新状态（UI 重连恢复用）
   */
  "update.status": async ({ respond }) => {
    try {
      const state = await getAvailableUpdate();
      if (!state) {
        respond(true, { hasUpdate: false });
        return;
      }
      const content = state.checkResult.latest
        ? extractUpdateContent(state.checkResult.latest)
        : null;
      respond(true, {
        hasUpdate: true,
        version: state.version,
        updateType: state.updateType,
        changelog: state.changelog,
        summary: content?.summary ?? "",
        mandatory: state.mandatory ?? false,
        dismissed: state.dismissed,
        installerUrl: state.installerUrl,
      });
    } catch (err) {
      respond(true, {
        hasUpdate: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  /**
   * 执行更新（delta → full → installer 三级级联）
   *
   * 通过 context.broadcast("update.progress", ...) 实时推送进度到 UI。
   * 成功后自动调度 Gateway 重启。
   */
  "update.execute": async ({ respond, context }) => {
    if (updateExecuteInProgress) {
      respond(true, { ok: false, error: "update already in progress" });
      return;
    }
    updateExecuteInProgress = true;
    try {
      const state = await getAvailableUpdate();
      if (!state || !state.checkResult?.hasUpdate) {
        respond(true, { ok: false, error: "no update available" });
        return;
      }

      const config = loadConfig();
      const root =
        (await resolveOpenClawCNPackageRoot({
          moduleUrl: import.meta.url,
          argv1: process.argv[1],
          cwd: process.cwd(),
        })) ?? process.cwd();

      const updateServerUrl = resolveUpdateServerUrl(root) ?? "https://www.obplugins.cn";
      const licenseKey = config.license?.key;
      const deviceId = licenseKey ? getDeviceId() : undefined;

      // installer 模式：返回安装包下载链接
      if (state.updateType === "installer") {
        respond(true, {
          ok: true,
          status: "installer-redirect",
          installerUrl: state.installerUrl,
          version: state.version,
        });
        return;
      }

      // 构建进度广播回调
      const progress: InstallerUpdateProgress = {
        onCheckStart: () => {
          context.broadcast(
            "update.progress",
            {
              stage: "checking",
              percent: 0,
              message: "正在检查更新...",
            },
            { dropIfSlow: true },
          );
        },
        onCheckComplete: () => {
          context.broadcast(
            "update.progress",
            {
              stage: "checking",
              percent: 5,
              message: "检查完成",
            },
            { dropIfSlow: true },
          );
        },
        onDownloadStart: (_mode: string, sizeBytes: number) => {
          context.broadcast(
            "update.progress",
            {
              stage: "downloading",
              percent: 5,
              message: `正在下载更新包 (${formatBytes(sizeBytes)})...`,
              totalBytes: sizeBytes,
            },
            { dropIfSlow: true },
          );
        },
        onDownloadProgress: (downloadedBytes: number, totalBytes: number) => {
          const percent =
            totalBytes > 0 ? Math.min(5 + Math.round((downloadedBytes / totalBytes) * 70), 75) : 50;
          context.broadcast(
            "update.progress",
            {
              stage: "downloading",
              percent,
              message: `正在下载... ${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`,
              downloadedBytes,
              totalBytes,
            },
            { dropIfSlow: true },
          );
        },
        onDownloadComplete: () => {
          context.broadcast(
            "update.progress",
            {
              stage: "applying",
              percent: 75,
              message: "下载完成，正在应用更新...",
            },
            { dropIfSlow: true },
          );
        },
        onApplyStart: (filesCount: number) => {
          context.broadcast(
            "update.progress",
            {
              stage: "applying",
              percent: 80,
              message: `正在应用更新 (${filesCount} 个文件)...`,
            },
            { dropIfSlow: true },
          );
        },
        onApplyComplete: () => {
          context.broadcast(
            "update.progress",
            {
              stage: "verifying",
              percent: 90,
              message: "正在校验完整性...",
            },
            { dropIfSlow: true },
          );
        },
        onError: (error: string) => {
          context.broadcast(
            "update.progress",
            {
              stage: "error",
              percent: 0,
              message: error,
            },
            { dropIfSlow: true },
          );
        },
      };

      // 根据 updateType 执行对应的更新逻辑
      // S4-1: delta 失败时自动级联到 full（如有 full 包可用）
      let result: Awaited<ReturnType<typeof runInstallerUpdate>>;

      if (state.updateType === "delta" && state.checkResult.latest) {
        result = await runInstallerUpdate({
          root,
          updateServerUrl,
          currentVersion: VERSION,
          licenseKey,
          deviceId,
          progress,
          preCheckResult: state.checkResult,
        });

        // delta 失败/跳过，且有 full 包 → 自动级联到 full 热更新
        if (result.status !== "ok" && state.checkResult.latest?.url?.full) {
          context.broadcast(
            "update.progress",
            {
              stage: "downloading",
              percent: 5,
              message: "增量更新失败，切换到全量更新...",
            },
            { dropIfSlow: true },
          );

          result = await runFullTarUpdate({
            root,
            latest: state.checkResult.latest,
            currentVersion: VERSION,
            updateServerUrl,
            licenseKey,
            deviceId,
            progress,
          });
        }
      } else if (state.updateType === "full" && state.checkResult.latest) {
        result = await runFullTarUpdate({
          root,
          latest: state.checkResult.latest,
          currentVersion: VERSION,
          updateServerUrl,
          licenseKey,
          deviceId,
          progress,
        });
      } else {
        respond(true, { ok: false, error: "invalid update state" });
        return;
      }

      if (result.status === "ok") {
        // 更新成功
        await clearAvailableUpdate(result.toVersion);

        context.broadcast(
          "update.progress",
          {
            stage: "complete",
            percent: 100,
            message: "更新完成，即将重启...",
          },
          { dropIfSlow: true },
        );

        // 写入重启哨兵
        const payload: RestartSentinelPayload = {
          kind: "update",
          status: "ok",
          ts: Date.now(),
          message: `更新到 v${result.toVersion}`,
          doctorHint: formatDoctorNonInteractiveHint(),
          stats: {
            mode: result.mode,
            before: result.fromVersion ? { version: result.fromVersion } : null,
            after: result.toVersion ? { version: result.toVersion } : null,
            steps: [],
            reason: null,
            durationMs: result.durationMs,
          },
        };

        let sentinelPath: string | null = null;
        try {
          sentinelPath = await writeRestartSentinel(payload);
        } catch {
          sentinelPath = null;
        }

        // S5-3: 不再立即自动重启，等待用户点击"立即重启"（update.restart RPC）。
        // 30s 后若无用户操作则自动重启（兼容无 UI 的 daemon 场景）。
        pendingUpdateRestart = {
          sentinelPath,
          sentinelPayload: payload,
          fallbackTimer: setTimeout(() => {
            scheduleGatewaySigusr1Restart({
              delayMs: 500,
              reason: "update.execute (auto-restart fallback after 30s)",
            });
            pendingUpdateRestart = null;
          }, 30_000),
        };

        respond(true, {
          ok: true,
          status: "ok",
          version: result.toVersion,
          changelog: result.changelog,
          sentinel: sentinelPath ? { path: sentinelPath, payload } : null,
        });
      } else {
        // 更新失败
        respond(true, {
          ok: false,
          status: result.status,
          error: result.reason,
          version: result.toVersion,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      context.broadcast(
        "update.progress",
        {
          stage: "error",
          percent: 0,
          message: errorMsg,
        },
        { dropIfSlow: true },
      );
      respond(true, { ok: false, error: errorMsg });
    } finally {
      updateExecuteInProgress = false;
    }
  },

  /**
   * S5-3: 用户点击"立即重启"时触发，取消 30s 自动重启定时器并立即重启
   */
  "update.restart": async ({ respond }) => {
    if (!pendingUpdateRestart) {
      // 没有待重启的更新，可能已经自动重启或未执行过更新
      // 仍然允许触发重启（兼容 Tauri 侧直接调用的场景）
      const restart = scheduleGatewaySigusr1Restart({
        delayMs: 500,
        reason: "update.restart (user-triggered, no pending)",
      });
      respond(true, { ok: true, restart });
      return;
    }

    // 取消自动重启定时器
    clearTimeout(pendingUpdateRestart.fallbackTimer);
    pendingUpdateRestart = null;

    // 立即调度重启
    const restart = scheduleGatewaySigusr1Restart({
      delayMs: 500,
      reason: "update.restart (user-triggered)",
    });

    respond(true, { ok: true, restart });
  },

  /**
   * 忽略当前版本的更新通知
   */
  "update.dismiss": async ({ params, respond }) => {
    try {
      const version =
        typeof (params as { version?: unknown }).version === "string"
          ? (params as { version: string }).version
          : null;
      if (!version) {
        respond(true, { ok: false, error: "version is required" });
        return;
      }
      await dismissAvailableUpdate(version);
      respond(true, { ok: true });
    } catch (err) {
      respond(true, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
