import {
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveSessionAgentId,
} from "../../agents/agent-scope.js";
import { resolveModelRefFromString } from "../../agents/model-selection.js";
import { resolveAgentTimeoutMs } from "../../agents/timeout.js";
import { DEFAULT_AGENT_WORKSPACE_DIR, ensureAgentWorkspace } from "../../agents/workspace.js";
import { type ClawdbotConfig, loadConfig } from "../../config/config.js";
import { defaultRuntime } from "../../runtime.js";
import { resolveCommandAuthorization } from "../command-auth.js";
import type { MsgContext } from "../templating.js";
import { SILENT_REPLY_TOKEN } from "../tokens.js";
import { applyMediaUnderstanding } from "../../media-understanding/apply.js";
import { applyLinkUnderstanding } from "../../link-understanding/apply.js";
import type { GetReplyOptions, ReplyPayload } from "../types.js";
import { resolveDefaultModel } from "./directive-handling.js";
import { resolveReplyDirectives } from "./get-reply-directives.js";
import { handleInlineActions } from "./get-reply-inline-actions.js";
import { runPreparedReply } from "./get-reply-run.js";
import { finalizeInboundContext } from "./inbound-context.js";
import { initSessionState } from "./session.js";
import { applyResetModelOverride } from "./session-reset-model.js";
import { stageSandboxMedia } from "./stage-sandbox-media.js";
import { createTypingController } from "./typing.js";
import {
  checkFreeModelPriority,
  injectFreeModelConfig,
  formatFreeModelNotification,
  detectQuotaExhaustedError,
  handleFreeModelQuotaExhausted,
  type FreeModelNotification,
  type FreeModelCheckResult,
} from "./free-model-priority.js";

export async function getReplyFromConfig(
  ctx: MsgContext,
  opts?: GetReplyOptions,
  configOverride?: ClawdbotConfig,
): Promise<ReplyPayload | ReplyPayload[] | undefined> {
  try {
  const isFastTestEnv = process.env.CLAWDBOT_TEST_FAST === "1";
  let cfg = configOverride ?? loadConfig();
  const targetSessionKey =
    ctx.CommandSource === "native" ? ctx.CommandTargetSessionKey?.trim() : undefined;
  const agentSessionKey = targetSessionKey || ctx.SessionKey;
  const agentId = resolveSessionAgentId({
    sessionKey: agentSessionKey,
    config: cfg,
  });
  const agentCfg = cfg.agents?.defaults;
  const sessionCfg = cfg.session;
  const { defaultProvider, defaultModel, aliasIndex } = resolveDefaultModel({
    cfg,
    agentId,
  });
  let provider = defaultProvider;
  let model = defaultModel;

  // ========================================
  // ClawdbotCN 专属功能：免费模型优先级检查
  // ========================================
  let freeModelNotification: FreeModelNotification | undefined;
  let freeModelProvider: string | undefined;
  let freeModelName: string | undefined;
  let freeModelCfg: ClawdbotConfig | undefined;
  
  if (!opts?.isHeartbeat) {
    try {
      // 使用 session key 来追踪切换状态，避免并发竞态
      const freeModelResult = await checkFreeModelPriority(agentSessionKey);
      if (freeModelResult.useFreeModel && freeModelResult.providerId && freeModelResult.model) {
        // 保存免费模型信息，稍后应用（在指令处理之后）
        freeModelProvider = freeModelResult.providerId;
        freeModelName = freeModelResult.model;
        freeModelCfg = injectFreeModelConfig(cfg, freeModelResult);
        freeModelNotification = freeModelResult.notification;
        defaultRuntime.log(
          `[FreeModel] 免费模型可用: ${freeModelResult.providerConfig?.name ?? freeModelProvider}/${freeModelName}`
        );
      } else if (freeModelResult.notification) {
        // 免费模型用完了，显示通知
        freeModelNotification = freeModelResult.notification;
        defaultRuntime.log(`[FreeModel] ${freeModelResult.notification.message}`);
      } else if (freeModelResult._debug) {
        // 输出详细的调试信息，帮助排查问题
        const debug = freeModelResult._debug;
        defaultRuntime.log(`[FreeModel] 未使用免费模型: ${debug.reason}`);
        if (debug.diagnosis?.issues.length) {
          for (const issue of debug.diagnosis.issues) {
            defaultRuntime.log(`[FreeModel]   - ${issue}`);
          }
        }
      }
    } catch (err) {
      // 免费模型检查失败，继续使用默认模型
      defaultRuntime.log(`[FreeModel] 检查失败: ${err}`);
    }
  }

  if (opts?.isHeartbeat) {
    const heartbeatRaw = agentCfg?.heartbeat?.model?.trim() ?? "";
    const heartbeatRef = heartbeatRaw
      ? resolveModelRefFromString({
          raw: heartbeatRaw,
          defaultProvider,
          aliasIndex,
        })
      : null;
    if (heartbeatRef) {
      provider = heartbeatRef.ref.provider;
      model = heartbeatRef.ref.model;
    }
  }

  const workspaceDirRaw = resolveAgentWorkspaceDir(cfg, agentId) ?? DEFAULT_AGENT_WORKSPACE_DIR;
  const workspace = await ensureAgentWorkspace({
    dir: workspaceDirRaw,
    ensureBootstrapFiles: !agentCfg?.skipBootstrap && !isFastTestEnv,
  });
  const workspaceDir = workspace.dir;
  const agentDir = resolveAgentDir(cfg, agentId);
  const timeoutMs = resolveAgentTimeoutMs({ cfg });
  const configuredTypingSeconds =
    agentCfg?.typingIntervalSeconds ?? sessionCfg?.typingIntervalSeconds;
  const typingIntervalSeconds =
    typeof configuredTypingSeconds === "number" ? configuredTypingSeconds : 6;
  const typing = createTypingController({
    onReplyStart: opts?.onReplyStart,
    typingIntervalSeconds,
    silentToken: SILENT_REPLY_TOKEN,
    log: defaultRuntime.log,
  });
  opts?.onTypingController?.(typing);

  const finalized = finalizeInboundContext(ctx);

  if (!isFastTestEnv) {
    await applyMediaUnderstanding({
      ctx: finalized,
      cfg,
      agentDir,
      activeModel: { provider, model },
    });
    await applyLinkUnderstanding({
      ctx: finalized,
      cfg,
    });
  }

  const commandAuthorized = finalized.CommandAuthorized;
  resolveCommandAuthorization({
    ctx: finalized,
    cfg,
    commandAuthorized,
  });
  const sessionState = await initSessionState({
    ctx: finalized,
    cfg,
    commandAuthorized,
  });
  let {
    sessionCtx,
    sessionEntry,
    previousSessionEntry,
    sessionStore,
    sessionKey,
    sessionId,
    isNewSession,
    resetTriggered,
    systemSent,
    abortedLastRun,
    storePath,
    sessionScope,
    groupResolution,
    isGroup,
    triggerBodyNormalized,
    bodyStripped,
  } = sessionState;

  await applyResetModelOverride({
    cfg,
    resetTriggered,
    bodyStripped,
    sessionCtx,
    ctx: finalized,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    defaultProvider,
    defaultModel,
    aliasIndex,
  });

  const directiveResult = await resolveReplyDirectives({
    ctx: finalized,
    cfg,
    agentId,
    agentDir,
    workspaceDir,
    agentCfg,
    sessionCtx,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    sessionScope,
    groupResolution,
    isGroup,
    triggerBodyNormalized,
    commandAuthorized,
    defaultProvider,
    defaultModel,
    aliasIndex,
    provider,
    model,
    typing,
    opts,
    skillFilter: opts?.skillFilter,
  });
  if (directiveResult.kind === "reply") {
    return directiveResult.reply;
  }

  let {
    commandSource,
    command,
    allowTextCommands,
    skillCommands,
    directives,
    cleanedBody,
    elevatedEnabled,
    elevatedAllowed,
    elevatedFailures,
    defaultActivation,
    resolvedThinkLevel,
    resolvedVerboseLevel,
    resolvedReasoningLevel,
    resolvedElevatedLevel,
    execOverrides,
    blockStreamingEnabled,
    blockReplyChunking,
    resolvedBlockStreamingBreak,
    provider: resolvedProvider,
    model: resolvedModel,
    modelState,
    contextTokens,
    inlineStatusRequested,
    directiveAck,
    perMessageQueueMode,
    perMessageQueueOptions,
  } = directiveResult.result;
  provider = resolvedProvider;
  model = resolvedModel;

  // ========================================
  // ClawdbotCN 专属功能：应用免费模型（如果可用且用户未在当前消息中指定模型）
  // ========================================
  // Bug #4修复：保存原始cfg的引用，避免在免费模型失败后回退时配置被污染
  const originalCfg = cfg;
  const originalProvider = provider;
  const originalModel = model;

  // 检查用户是否在当前消息中通过 /model 指令指定了特定模型
  // 注意：不能用 resolvedProvider !== defaultProvider 判断，因为 session 中保存的模型覆盖
  // 也会导致 resolved 不等于 default，但这不应该阻止免费模型的使用
  const userSpecifiedModelInThisMessage = directives.hasModelDirective === true;
  if (!userSpecifiedModelInThisMessage && freeModelProvider && freeModelName && freeModelCfg) {
    // 用户没有在当前消息中指定模型，使用免费模型
    provider = freeModelProvider;
    model = freeModelName;
    cfg = freeModelCfg;
    defaultRuntime.log(
      `[FreeModel] 应用免费模型: ${provider}/${model}`
    );
  } else if (userSpecifiedModelInThisMessage && freeModelProvider) {
    // 用户在当前消息中指定了特定模型，跳过免费模型
    defaultRuntime.log(
      `[FreeModel] 用户在当前消息中指定了模型 ${resolvedProvider}/${resolvedModel}，跳过免费模型`
    );
    freeModelNotification = undefined; // 清除通知，因为没有使用免费模型
    freeModelProvider = undefined;     // 清除 provider，防止后续 undefined check 误判
  }

  const inlineActionResult = await handleInlineActions({
    ctx,
    sessionCtx,
    cfg,
    agentId,
    agentDir,
    sessionEntry,
    previousSessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    sessionScope,
    workspaceDir,
    isGroup,
    opts,
    typing,
    allowTextCommands,
    inlineStatusRequested,
    command,
    skillCommands,
    directives,
    cleanedBody,
    elevatedEnabled,
    elevatedAllowed,
    elevatedFailures,
    defaultActivation: () => defaultActivation,
    resolvedThinkLevel,
    resolvedVerboseLevel,
    resolvedReasoningLevel,
    resolvedElevatedLevel,
    resolveDefaultThinkingLevel: modelState.resolveDefaultThinkingLevel,
    provider,
    model,
    contextTokens,
    directiveAck,
    abortedLastRun,
    skillFilter: opts?.skillFilter,
  });
  if (inlineActionResult.kind === "reply") {
    return inlineActionResult.reply;
  }
  directives = inlineActionResult.directives;
  abortedLastRun = inlineActionResult.abortedLastRun ?? abortedLastRun;

  await stageSandboxMedia({
    ctx,
    sessionCtx,
    cfg,
    sessionKey,
    workspaceDir,
  });

  // ========================================
  // ClawdbotCN 专属功能：免费模型调用与自动切换
  // 当免费模型额度用尽时，自动切换到下一个免费模型
  // ========================================
  const MAX_FREE_MODEL_RETRIES = 3;
  let currentProvider = provider;
  let currentModel = model;
  let currentCfg = cfg;
  let retryCount = 0;
  let reply: ReplyPayload | ReplyPayload[] | undefined;
  let usingFreeModel = currentProvider.startsWith("free-model-");

  while (retryCount <= MAX_FREE_MODEL_RETRIES) {
    try {
      reply = await runPreparedReply({
        ctx,
        sessionCtx,
        cfg: currentCfg,
        agentId,
        agentDir,
        agentCfg,
        sessionCfg,
        commandAuthorized,
        command,
        commandSource,
        allowTextCommands,
        directives,
        defaultActivation,
        resolvedThinkLevel,
        resolvedVerboseLevel,
        resolvedReasoningLevel,
        resolvedElevatedLevel,
        execOverrides,
        elevatedEnabled,
        elevatedAllowed,
        blockStreamingEnabled,
        blockReplyChunking,
        resolvedBlockStreamingBreak,
        modelState,
        provider: currentProvider,
        model: currentModel,
        perMessageQueueMode,
        perMessageQueueOptions,
        typing,
        opts,
        defaultProvider,
        defaultModel,
        timeoutMs,
        isNewSession,
        resetTriggered,
        systemSent,
        sessionEntry,
        sessionStore,
        sessionKey,
        sessionId,
        storePath,
        workspaceDir,
        abortedLastRun,
      });

      // 调用成功，退出循环
      break;
    } catch (err) {
      // 只有在使用免费模型时才尝试切换
      if (!usingFreeModel) {
        throw err;
      }

      // Bug #5修复：提取HTTP状态码并传递给detectQuotaExhaustedError
      const extractHttpStatus = (error: unknown): number | undefined => {
        if (typeof error === "object" && error !== null) {
          const obj = error as Record<string, unknown>;
          if (typeof obj.httpStatus === "number") return obj.httpStatus;
          if (typeof obj.status === "number") return obj.status;
          if (typeof obj.statusCode === "number") return obj.statusCode;
          // Also check nested error objects (common in provider SDKs)
          if (obj.error && typeof obj.error === "object") {
            const nested = obj.error as Record<string, unknown>;
            if (typeof nested.status === "number") return nested.status;
          }
        }
        // Parse status from error message (e.g. "401 status code (no body)").
        // Only match quota-relevant status codes (401/402/403/429), not 400/404/405 etc.
        if (error instanceof Error) {
          const match = error.message.match(/\b(40[1-3]|429)\b/);
          if (match) return Number.parseInt(match[1], 10);
        }
        return undefined;
      };
      const httpStatus = extractHttpStatus(err);

      // 检测是否是额度用尽错误
      const isQuotaError = detectQuotaExhaustedError(err, httpStatus);
      if (!isQuotaError) {
        throw err;
      }

      retryCount++;
      defaultRuntime.log(
        `[FreeModel] 检测到额度用尽错误 (${currentProvider}, httpStatus=${httpStatus})，尝试切换到下一个免费模型 (重试 ${retryCount}/${MAX_FREE_MODEL_RETRIES})`
      );

      // 检查是否达到最大重试次数
      if (retryCount > MAX_FREE_MODEL_RETRIES) {
        defaultRuntime.log(`[FreeModel] 达到最大重试次数 (${MAX_FREE_MODEL_RETRIES})，放弃切换`);
        throw err;
      }

      // 尝试切换到下一个免费模型（传递 sessionKey 和 httpStatus 以支持 429 冷却机制）
      const switchResult = await handleFreeModelQuotaExhausted(currentProvider, agentSessionKey, httpStatus);

      if (!switchResult.useFreeModel) {
        // 所有免费模型都用完了，记录通知并回退到付费模型
        freeModelNotification = switchResult.notification;
        defaultRuntime.log(`[FreeModel] 所有免费模型额度已用尽，回退到付费模型`);

        // Bug #4修复：使用原始的付费模型配置（originalCfg），避免配置污染
        currentProvider = originalProvider;
        currentModel = originalModel;
        currentCfg = originalCfg;
        usingFreeModel = false;

        // 重试一次使用付费模型
        try {
          reply = await runPreparedReply({
            ctx,
            sessionCtx,
            cfg: currentCfg,
            agentId,
            agentDir,
            agentCfg,
            sessionCfg,
            commandAuthorized,
            command,
            commandSource,
            allowTextCommands,
            directives,
            defaultActivation,
            resolvedThinkLevel,
            resolvedVerboseLevel,
            resolvedReasoningLevel,
            resolvedElevatedLevel,
            execOverrides,
            elevatedEnabled,
            elevatedAllowed,
            blockStreamingEnabled,
            blockReplyChunking,
            resolvedBlockStreamingBreak,
            modelState,
            provider: currentProvider,
            model: currentModel,
            perMessageQueueMode,
            perMessageQueueOptions,
            typing,
            opts,
            defaultProvider,
            defaultModel,
            timeoutMs,
            isNewSession,
            resetTriggered,
            systemSent,
            sessionEntry,
            sessionStore,
            sessionKey,
            sessionId,
            storePath,
            workspaceDir,
            abortedLastRun,
          });
          break;
        } catch (fallbackErr) {
          defaultRuntime.log(`[FreeModel] 付费模型回退也失败: ${String(fallbackErr)}`);
          throw fallbackErr;
        }
      }

      // 切换到下一个免费模型
      if (!switchResult.providerId || !switchResult.model) {
        defaultRuntime.log(`[FreeModel] switchResult 缺少 providerId/model，终止切换`);
        throw err;
      }
      currentProvider = switchResult.providerId;
      currentModel = switchResult.model;
      currentCfg = injectFreeModelConfig(originalCfg, switchResult);
      freeModelNotification = switchResult.notification;

      // Bug #2修复：更新usingFreeModel状态，确保下次循环时正确判断
      usingFreeModel = currentProvider.startsWith("free-model-");

      defaultRuntime.log(
        `[FreeModel] 已切换到免费模型: ${switchResult.providerConfig?.name ?? currentProvider}/${currentModel}`
      );
    }
  }

  // 检查是否有有效的响应（防止循环结束后 reply 为 undefined）
  // 仅在使用免费模型系统时才视为错误；非免费模型的 undefined 是合法返回（静默回复/未激活）
  // Bug #2修复：这里的usingFreeModel已经在循环中正确更新，反映最终状态
  if (reply === undefined && (usingFreeModel || freeModelProvider)) {
    defaultRuntime.log(`[FreeModel] 警告：所有模型调用均失败，未能生成响应 provider=${defaultProvider} model=${defaultModel}`);
    // 返回明确的错误消息，告知用户是模型接口的问题
    return {
      text: `模型响应失败，请检查模型接口是否正常（${defaultProvider}/${defaultModel}）。`,
    };
  }

  // ========================================
  // ClawdbotCN 专属功能：添加免费模型通知到响应
  // ========================================
  if (freeModelNotification?.showInChat && reply) {
    const notificationTag = formatFreeModelNotification(freeModelNotification);
    const prependNotification = (payload: ReplyPayload): ReplyPayload => {
      if (payload.text) {
        return { ...payload, text: `${notificationTag}\n\n${payload.text}` };
      }
      return payload;
    };

    if (Array.isArray(reply)) {
      // 只在第一条消息前添加通知
      if (reply.length > 0 && reply[0]) {
        reply[0] = prependNotification(reply[0]);
      }
      return reply;
    } else {
      return prependNotification(reply);
    }
  }

  return reply;
  } catch (err) {
    // Top-level safety net: catch any unhandled error in the entire reply pipeline
    // to prevent process crash and return a user-friendly error message instead.
    const message = err instanceof Error ? err.message : String(err);
    defaultRuntime.error(`[getReplyFromConfig] Unhandled error in reply pipeline: ${message}`);
    if (err instanceof Error && err.stack) {
      defaultRuntime.error(`[getReplyFromConfig] Stack: ${err.stack}`);
    }
    return {
      text: `⚠️ 处理消息时发生错误，请重试。错误详情: ${message}`,
    };
  }
}
