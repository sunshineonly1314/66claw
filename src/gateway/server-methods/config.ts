import { execFile } from "node:child_process";
import path from "node:path";
import type { GatewayRequestHandlers } from "./types.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { listChannelPlugins } from "../../channels/plugins/index.js";
import {
  CONFIG_PATH,
  loadConfig,
  parseConfigJson5,
  readConfigFileSnapshot,
  readConfigFileSnapshotForWrite,
  resolveConfigSnapshotHash,
  validateConfigObjectWithPlugins,
  withConfigWriteLock,
  writeConfigFile,
} from "../../config/config.js";
import { applyLegacyMigrations } from "../../config/legacy.js";
import { applyMergePatch } from "../../config/merge-patch.js";
import { listConfigBackups, rollbackConfig } from "../../config/config-rollback.js";
import {
  redactConfigObject,
  redactConfigSnapshot,
  restoreRedactedValues,
} from "../../config/redact-snapshot.js";
import { buildConfigSchema, type ConfigSchemaResponse } from "../../config/schema.js";
import { extractDeliveryInfo } from "../../config/sessions.js";
import {
  formatDoctorNonInteractiveHint,
  type RestartSentinelPayload,
  writeRestartSentinel,
} from "../../infra/restart-sentinel.js";
import { scheduleGatewaySigusr1Restart } from "../../infra/restart.js";
import { diffConfigPaths, buildGatewayReloadPlan } from "../config-reload.js";
import { runConfigSafetyCheck } from "./config-safety-check.js";
import { loadOpenClawCNPlugins } from "../../plugins/loader.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateConfigApplyParams,
  validateConfigGetParams,
  validateConfigPatchParams,
  validateConfigRollbackApplyParams,
  validateConfigRollbackListParams,
  validateConfigSchemaParams,
  validateConfigSetParams,
} from "../protocol/index.js";

function resolveBaseHash(params: unknown): string | null {
  const raw = (params as { baseHash?: unknown })?.baseHash;
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

// requireConfigBaseHash was removed — baseHash checking is now inlined inside
// the write lock in config.set / config.patch / config.apply to eliminate the
// TOCTOU window between hash check and write.

function resolveConfigRestartRequest(params: unknown): {
  sessionKey: string | undefined;
  note: string | undefined;
  restartDelayMs: number | undefined;
  noRestart: boolean;
  deliveryContext: ReturnType<typeof extractDeliveryInfo>["deliveryContext"];
  threadId: ReturnType<typeof extractDeliveryInfo>["threadId"];
} {
  const sessionKey =
    typeof (params as { sessionKey?: unknown }).sessionKey === "string"
      ? (params as { sessionKey?: string }).sessionKey?.trim() || undefined
      : undefined;
  const note =
    typeof (params as { note?: unknown }).note === "string"
      ? (params as { note?: string }).note?.trim() || undefined
      : undefined;
  const restartDelayMsRaw = (params as { restartDelayMs?: unknown }).restartDelayMs;
  const restartDelayMs =
    typeof restartDelayMsRaw === "number" && Number.isFinite(restartDelayMsRaw)
      ? Math.max(0, Math.floor(restartDelayMsRaw))
      : undefined;

  // [CN-PATCH] noRestart: 允许调用方声明"此次配置变更不需要重启"
  // 适用于 dispatch.enabled 等写入后即刻通过 loadConfig() 热生效的字段
  const noRestart = (params as { noRestart?: unknown }).noRestart === true;

  // Extract deliveryContext + threadId for routing after restart
  // Supports both :thread: (most channels) and :topic: (Telegram)
  const { deliveryContext, threadId } = extractDeliveryInfo(sessionKey);

  return {
    sessionKey,
    note,
    restartDelayMs,
    noRestart,
    deliveryContext,
    threadId,
  };
}

function buildConfigRestartSentinelPayload(params: {
  kind: RestartSentinelPayload["kind"];
  mode: string;
  sessionKey: string | undefined;
  deliveryContext: ReturnType<typeof extractDeliveryInfo>["deliveryContext"];
  threadId: ReturnType<typeof extractDeliveryInfo>["threadId"];
  note: string | undefined;
}): RestartSentinelPayload {
  return {
    kind: params.kind,
    status: "ok",
    ts: Date.now(),
    sessionKey: params.sessionKey,
    deliveryContext: params.deliveryContext,
    threadId: params.threadId,
    message: params.note ?? null,
    doctorHint: formatDoctorNonInteractiveHint(),
    stats: {
      mode: params.mode,
      root: CONFIG_PATH,
    },
  };
}

async function tryWriteRestartSentinelPayload(
  payload: RestartSentinelPayload,
): Promise<string | null> {
  try {
    return await writeRestartSentinel(payload);
  } catch {
    return null;
  }
}

function loadSchemaWithPlugins(): ConfigSchemaResponse {
  const cfg = loadConfig();
  const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
  const pluginRegistry = loadOpenClawCNPlugins({
    config: cfg,
    cache: true,
    workspaceDir,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  });
  // Note: We can't easily cache this, as there are no callback that can invalidate
  // our cache. However, both loadConfig() and loadOpenClawCNPlugins() already cache
  // their results, and buildConfigSchema() is just a cheap transformation.
  return buildConfigSchema({
    plugins: pluginRegistry.plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      configUiHints: plugin.configUiHints,
      configSchema: plugin.configJsonSchema,
    })),
    channels: listChannelPlugins().map((entry) => ({
      id: entry.id,
      label: entry.meta.label,
      description: entry.meta.blurb,
      configSchema: entry.configSchema?.schema,
      configUiHints: entry.configSchema?.uiHints,
    })),
  });
}

export const configHandlers: GatewayRequestHandlers = {
  "config.get": async ({ params, respond }) => {
    if (!validateConfigGetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid config.get params: ${formatValidationErrors(validateConfigGetParams.errors)}`,
        ),
      );
      return;
    }
    const snapshot = await readConfigFileSnapshot();
    const schema = loadSchemaWithPlugins();
    respond(true, redactConfigSnapshot(snapshot, schema.uiHints), undefined);
  },
  "config.schema": ({ params, respond }) => {
    if (!validateConfigSchemaParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid config.schema params: ${formatValidationErrors(validateConfigSchemaParams.errors)}`,
        ),
      );
      return;
    }
    respond(true, loadSchemaWithPlugins(), undefined);
  },
  "config.set": async ({ params, respond }) => {
    if (!validateConfigSetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid config.set params: ${formatValidationErrors(validateConfigSetParams.errors)}`,
        ),
      );
      return;
    }
    // Pre-parse raw payload outside the lock (pure memory, no disk state dependency).
    const rawValue = (params as { raw?: unknown }).raw;
    if (typeof rawValue !== "string") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "invalid config.set params: raw (string) required"),
      );
      return;
    }
    const parsedRes = parseConfigJson5(rawValue);
    if (!parsedRes.ok) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, parsedRes.error));
      return;
    }

    // [CN-FIX] Atomic read-check-validate-write: hold the write lock from snapshot
    // through write to eliminate the TOCTOU window between baseHash check and write.
    const result = await withConfigWriteLock(async () => {
      const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
      if (!snapshot.exists) {
        // No existing config — skip baseHash check (first-time write)
      } else {
        const snapshotHash = resolveConfigSnapshotHash(snapshot);
        const baseHash = resolveBaseHash(params);
        if (!snapshotHash) {
          return { err: "config base hash unavailable; re-run config.get and retry" } as const;
        }
        if (!baseHash) {
          return { err: "config base hash required; re-run config.get and retry" } as const;
        }
        if (baseHash !== snapshotHash) {
          return { err: "config changed since last load; re-run config.get and retry" } as const;
        }
      }
      // Note: config.set does NOT require snapshot.valid — it is a full replacement
      // and can be used to fix a broken config. config.patch requires valid because
      // it merges against the current config.
      const schemaSet = loadSchemaWithPlugins();
      const restored = restoreRedactedValues(parsedRes.parsed, snapshot.config, schemaSet.uiHints);
      if (!restored.ok) {
        return { err: restored.humanReadableMessage ?? "invalid config" } as const;
      }
      const validated = validateConfigObjectWithPlugins(restored.result);
      if (!validated.ok) {
        return {
          err: "invalid config",
          details: { issues: validated.issues },
        } as const;
      }
      // [CN-PATCH:safety-check] 与 config.apply 相同的安全检查，防止 AI 通过 config.set 删除关键字段。
      // config.set 是全量替换，使用 "apply" 模式（有硬阻断 + advisory warnings）。
      let safetyCheckSet: ReturnType<typeof runConfigSafetyCheck> = { ok: true, warnings: [] };
      try {
        safetyCheckSet = runConfigSafetyCheck(validated.config, snapshot.config, "apply");
      } catch {
        /* if the safety check itself throws, degrade gracefully and allow write */
      }
      if (!safetyCheckSet.ok) {
        return {
          err:
            safetyCheckSet.blockReason ??
            "config.set blocked by safety check; use config.patch instead",
        } as const;
      }
      await writeConfigFile(validated.config, writeOptions);
      return {
        ok: true as const,
        config: redactConfigObject(validated.config, schemaSet.uiHints),
        safetyWarnings: safetyCheckSet.warnings,
      };
    });

    if ("err" in result) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          result.err,
          "details" in result ? result : undefined,
        ),
      );
      return;
    }
    respond(
      true,
      {
        ok: true,
        path: CONFIG_PATH,
        config: result.config,
        ...(result.safetyWarnings.length > 0 ? { safetyWarnings: result.safetyWarnings } : {}),
      },
      undefined,
    );
  },
  "config.patch": async ({ params, respond }) => {
    if (!validateConfigPatchParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid config.patch params: ${formatValidationErrors(validateConfigPatchParams.errors)}`,
        ),
      );
      return;
    }
    // Pre-parse raw payload outside the lock (pure memory, no disk state dependency).
    const rawValue = (params as { raw?: unknown }).raw;
    if (typeof rawValue !== "string") {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "invalid config.patch params: raw (string) required",
        ),
      );
      return;
    }
    const parsedRes = parseConfigJson5(rawValue);
    if (!parsedRes.ok) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, parsedRes.error));
      return;
    }
    if (
      !parsedRes.parsed ||
      typeof parsedRes.parsed !== "object" ||
      Array.isArray(parsedRes.parsed)
    ) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "config.patch raw must be an object"),
      );
      return;
    }

    // [CN-FIX] Atomic read-check-merge-validate-write: hold the write lock from snapshot
    // through write to eliminate the TOCTOU window between baseHash check and write.
    const result = await withConfigWriteLock(async () => {
      const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
      if (!snapshot.exists) {
        // No existing config — skip baseHash check (first-time write)
      } else {
        const snapshotHash = resolveConfigSnapshotHash(snapshot);
        const baseHash = resolveBaseHash(params);
        if (!snapshotHash) {
          return { err: "config base hash unavailable; re-run config.get and retry" } as const;
        }
        if (!baseHash) {
          return { err: "config base hash required; re-run config.get and retry" } as const;
        }
        if (baseHash !== snapshotHash) {
          return { err: "config changed since last load; re-run config.get and retry" } as const;
        }
      }
      if (!snapshot.valid) {
        return { err: "invalid config; fix before patching" } as const;
      }
      const merged = applyMergePatch(snapshot.config, parsedRes.parsed, {
        mergeObjectArraysById: true,
      });
      const schemaPatch = loadSchemaWithPlugins();
      const restoredMerge = restoreRedactedValues(merged, snapshot.config, schemaPatch.uiHints);
      if (!restoredMerge.ok) {
        return { err: restoredMerge.humanReadableMessage ?? "invalid config" } as const;
      }
      const migrated = applyLegacyMigrations(restoredMerge.result);
      const resolved = migrated.next ?? restoredMerge.result;
      const validated = validateConfigObjectWithPlugins(resolved);
      if (!validated.ok) {
        return {
          err: "invalid config",
          details: { issues: validated.issues },
        } as const;
      }
      // [CN-PATCH:safety-check] Advisory pre-write safety check.
      // Wrapped in try-catch so it never blocks config writes.
      let safetyCheck: ReturnType<typeof runConfigSafetyCheck> = { ok: true, warnings: [] };
      try {
        safetyCheck = runConfigSafetyCheck(validated.config, snapshot.config, "patch");
      } catch {
        /* advisory only — never block writes */
      }
      await writeConfigFile(validated.config, writeOptions);
      return {
        ok: true as const,
        config: validated.config,
        snapshotConfig: snapshot.config,
        schema: schemaPatch,
        safetyWarnings: safetyCheck.warnings,
      };
    });

    if ("err" in result) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          result.err,
          "details" in result ? result : undefined,
        ),
      );
      return;
    }

    const { sessionKey, note, restartDelayMs, noRestart, deliveryContext, threadId } =
      resolveConfigRestartRequest(params);

    // [CN-PATCH] 智能判断是否需要 SIGUSR1 重启：
    // 对比新旧配置 diff，仅当 reload plan 判定需要 restart 时才发 SIGUSR1。
    // hot reload 和 noop 变更交由 chokidar watcher 的热重载机制处理，避免不必要的完整重启。
    let restart: ReturnType<typeof scheduleGatewaySigusr1Restart> | undefined;
    let sentinelPath: string | null = null;
    const needsRestart = (() => {
      if (noRestart) return false;
      const changedPaths = diffConfigPaths(result.snapshotConfig, result.config);
      if (changedPaths.length === 0) return false;
      const plan = buildGatewayReloadPlan(changedPaths);
      return plan.restartGateway;
    })();
    if (needsRestart) {
      const payload = buildConfigRestartSentinelPayload({
        kind: "config-patch",
        mode: "config.patch",
        sessionKey,
        deliveryContext,
        threadId,
        note,
      });
      sentinelPath = await tryWriteRestartSentinelPayload(payload);
      restart = scheduleGatewaySigusr1Restart({
        delayMs: restartDelayMs,
        reason: "config.patch",
      });
    }
    respond(
      true,
      {
        ok: true,
        path: CONFIG_PATH,
        config: redactConfigObject(result.config, result.schema.uiHints),
        restart,
        sentinel: sentinelPath ? { path: sentinelPath } : undefined,
        ...(result.safetyWarnings.length > 0 ? { safetyWarnings: result.safetyWarnings } : {}),
      },
      undefined,
    );
  },
  "config.apply": async ({ params, respond }) => {
    if (!validateConfigApplyParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid config.apply params: ${formatValidationErrors(validateConfigApplyParams.errors)}`,
        ),
      );
      return;
    }
    // Pre-parse raw payload outside the lock (pure memory, no disk state dependency).
    const rawValue = (params as { raw?: unknown }).raw;
    if (typeof rawValue !== "string") {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "invalid config.apply params: raw (string) required",
        ),
      );
      return;
    }
    const parsedRes = parseConfigJson5(rawValue);
    if (!parsedRes.ok) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, parsedRes.error));
      return;
    }

    // [CN-FIX] Atomic read-check-validate-write: hold the write lock from snapshot
    // through write to eliminate the TOCTOU window between baseHash check and write.
    const result = await withConfigWriteLock(async () => {
      const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
      if (!snapshot.exists) {
        // No existing config — skip baseHash check (first-time write)
      } else {
        const snapshotHash = resolveConfigSnapshotHash(snapshot);
        const baseHash = resolveBaseHash(params);
        if (!snapshotHash) {
          return { err: "config base hash unavailable; re-run config.get and retry" } as const;
        }
        if (!baseHash) {
          return { err: "config base hash required; re-run config.get and retry" } as const;
        }
        if (baseHash !== snapshotHash) {
          return { err: "config changed since last load; re-run config.get and retry" } as const;
        }
      }
      const schemaApply = loadSchemaWithPlugins();
      const restored = restoreRedactedValues(
        parsedRes.parsed,
        snapshot.config,
        schemaApply.uiHints,
      );
      if (!restored.ok) {
        return { err: restored.humanReadableMessage ?? "invalid config" } as const;
      }
      const validated = validateConfigObjectWithPlugins(restored.result);
      if (!validated.ok) {
        return {
          err: "invalid config",
          details: { issues: validated.issues },
        } as const;
      }
      // [CN-PATCH:safety-check] Pre-write safety check.
      // For critical-field drops or >70% size reduction, this BLOCKS the write.
      // For lesser issues it attaches advisory warnings to the success response.
      let safetyCheck: ReturnType<typeof runConfigSafetyCheck> = { ok: true, warnings: [] };
      try {
        safetyCheck = runConfigSafetyCheck(validated.config, snapshot.config, "apply");
      } catch {
        /* if the safety check itself throws, degrade gracefully and allow write */
      }
      if (!safetyCheck.ok) {
        return {
          err:
            safetyCheck.blockReason ??
            "config.apply blocked by safety check; use config.patch instead",
        } as const;
      }
      await writeConfigFile(validated.config, writeOptions);
      return {
        ok: true as const,
        config: validated.config,
        snapshotConfig: snapshot.config,
        schema: schemaApply,
        safetyWarnings: safetyCheck.warnings,
      };
    });

    if ("err" in result) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          result.err,
          "details" in result ? result : undefined,
        ),
      );
      return;
    }

    const { sessionKey, note, restartDelayMs, noRestart, deliveryContext, threadId } =
      resolveConfigRestartRequest(params);

    // [CN-PATCH] 智能判断是否需要 SIGUSR1 重启：
    // 对比新旧配置 diff，仅当 reload plan 判定需要 restart 时才发 SIGUSR1。
    // hot reload 和 noop 变更交由 chokidar watcher 的热重载机制处理，避免不必要的完整重启。
    let restart: ReturnType<typeof scheduleGatewaySigusr1Restart> | undefined;
    let sentinelPath: string | null = null;
    const needsRestart = (() => {
      if (noRestart) return false;
      const changedPaths = diffConfigPaths(result.snapshotConfig, result.config);
      if (changedPaths.length === 0) return false;
      const plan = buildGatewayReloadPlan(changedPaths);
      return plan.restartGateway;
    })();
    if (needsRestart) {
      const payload = buildConfigRestartSentinelPayload({
        kind: "config-apply",
        mode: "config.apply",
        sessionKey,
        deliveryContext,
        threadId,
        note,
      });
      sentinelPath = await tryWriteRestartSentinelPayload(payload);
      restart = scheduleGatewaySigusr1Restart({
        delayMs: restartDelayMs,
        reason: "config.apply",
      });
    }
    respond(
      true,
      {
        ok: true,
        path: CONFIG_PATH,
        config: redactConfigObject(result.config, result.schema.uiHints),
        restart,
        sentinel: sentinelPath ? { path: sentinelPath } : undefined,
        ...(result.safetyWarnings.length > 0 ? { safetyWarnings: result.safetyWarnings } : {}),
      },
      undefined,
    );
  },
  /**
   * config.rollback.list — 列出可用的配置备份槽位。
   *
   * 返回最多 3 个备份（.bak / .bak.1 / .bak.2），每个包含：
   * - index, filePath, exists, sizeBytes, modifiedAt
   * - version（meta.lastTouchedVersion）, touchedAt（meta.lastTouchedAt）
   * - valid（是否通过 schema 验证）, issues（验证问题列表）
   *
   * 供 AI 在配置损坏时调用，确认可用备份后再执行 config.rollback.apply。
   */
  "config.rollback.list": async ({ params, respond }) => {
    if (!validateConfigRollbackListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid config.rollback.list params: ${formatValidationErrors(validateConfigRollbackListParams.errors)}`,
        ),
      );
      return;
    }
    const backups = listConfigBackups();
    respond(true, { backups }, undefined);
  },
  /**
   * config.rollback.apply — 将配置回滚到指定备份槽位。
   *
   * 参数：
   * - index: 备份槽位（0=最新 .bak, 1=.bak.1, 2=.bak.2）
   * - dryRun?: 仅验证备份合法性，不实际写入（默认 false）
   * - sessionKey?: 重启后发送通知的会话 key
   * - note?: 附加说明（写入重启 sentinel）
   * - restartDelayMs?: 重启延迟（毫秒）
   * - noRestart?: true 则不触发 SIGUSR1 重启（默认 false，回滚后自动重启）
   *
   * 流程：先 dry-run 验证备份可用 → 执行原子性回滚 → 可选 SIGUSR1 重启。
   * 回滚前会将当前配置保存到 .pre-rollback.bak，以便紧急恢复。
   */
  "config.rollback.apply": async ({ params, respond }) => {
    if (!validateConfigRollbackApplyParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid config.rollback.apply params: ${formatValidationErrors(validateConfigRollbackApplyParams.errors)}`,
        ),
      );
      return;
    }
    const index = (params as { index: number }).index;
    const dryRun = (params as { dryRun?: boolean }).dryRun === true;

    // 先 dry-run 验证备份可用且合法，避免回滚到坏备份
    const dryResult = await rollbackConfig(index, { validate: true, dryRun: true });
    if (!dryResult.ok) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          dryResult.error ?? `config backup slot ${index} is invalid or missing`,
        ),
      );
      return;
    }

    if (dryRun) {
      respond(
        true,
        {
          ok: true,
          dryRun: true,
          index,
          version: dryResult.version,
          restoredFrom: dryResult.restoredFrom,
        },
        undefined,
      );
      return;
    }

    // 实际回滚：通过 write lock 串行化，防止与并发 config 写入冲突
    let rollbackErr: string | undefined;
    await withConfigWriteLock(async () => {
      const result = await rollbackConfig(index, { validate: true, dryRun: false });
      if (!result.ok) {
        rollbackErr = result.error ?? "rollback failed";
      }
    });
    if (rollbackErr) {
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, rollbackErr));
      return;
    }

    // 可选重启（同 config.apply / config.patch 逻辑）
    const { sessionKey, note, restartDelayMs, noRestart, deliveryContext, threadId } =
      resolveConfigRestartRequest(params);
    let restart: ReturnType<typeof scheduleGatewaySigusr1Restart> | undefined;
    let sentinelPath: string | null = null;
    if (!noRestart) {
      const payload = buildConfigRestartSentinelPayload({
        kind: "config-apply",
        mode: "config.rollback.apply",
        sessionKey,
        deliveryContext,
        threadId,
        note,
      });
      sentinelPath = await tryWriteRestartSentinelPayload(payload);
      restart = scheduleGatewaySigusr1Restart({
        delayMs: restartDelayMs,
        reason: "config.rollback.apply",
      });
    }

    respond(
      true,
      {
        ok: true,
        index,
        version: dryResult.version,
        restoredFrom: dryResult.restoredFrom,
        restart,
        sentinel: sentinelPath ? { path: sentinelPath } : undefined,
      },
      undefined,
    );
  },
  "config.reveal": ({ respond }) => {
    const dir = path.dirname(CONFIG_PATH);
    const platform = process.platform;
    // Use execFile with array args to prevent command injection via directory paths
    // containing shell metacharacters (spaces, quotes, semicolons, etc.).
    let bin: string;
    if (platform === "win32") {
      bin = "explorer";
    } else if (platform === "darwin") {
      bin = "open";
    } else {
      bin = "xdg-open";
    }
    execFile(bin, [dir], (err) => {
      if (err) {
        // Windows explorer returns exit code 1 even on success when opening a folder.
        if (platform === "win32" && (err as any).code === 1) {
          respond(true, { ok: true, path: dir }, undefined);
          return;
        }
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INTERNAL_ERROR, `Failed to open folder: ${err.message}`),
        );
        return;
      }
      respond(true, { ok: true, path: dir }, undefined);
    });
  },
};
