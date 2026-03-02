import {
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveSessionAgentId,
} from "../../agents/agent-scope.js";
import { resolveModelRefFromString } from "../../agents/model-selection.js";
import { resolveAgentTimeoutMs } from "../../agents/timeout.js";
import { DEFAULT_AGENT_WORKSPACE_DIR, ensureAgentWorkspace } from "../../agents/workspace.js";
import { type OpenClawCNConfig, loadConfig } from "../../config/config.js";
import { defaultRuntime } from "../../runtime.js";
import { resolveCommandAuthorization } from "../command-auth.js";
import type { MsgContext } from "../templating.js";
import { SILENT_REPLY_TOKEN } from "../tokens.js";
import { applyMediaUnderstanding } from "../../media-understanding/apply.js";
import { applyLinkUnderstanding } from "../../link-understanding/apply.js";
// ===== OpenClawCN: 模态感知智能路由 =====
import { normalizeAttachments } from "../../media-understanding/attachments.js";
import { routeByModality } from "../../dispatch/modality-router.js";
// ===== END =====
// ===== OpenClawCN: 智能调度引擎 =====
import { dispatchRequest } from "../../dispatch/index.js";
import type { RoutingDecision } from "../../dispatch/types.js";
// ===== END =====
import type { GetReplyOptions, ReplyPayload } from "../types.js";
import { getGlobalHookRunner } from "../../plugins/hook-runner-global.js";
import { resolveDefaultModel } from "./directive-handling.js";
import { resolveReplyDirectives } from "./get-reply-directives.js";
import { handleInlineActions } from "./get-reply-inline-actions.js";
import { runPreparedReply } from "./get-reply-run.js";
import { finalizeInboundContext } from "./inbound-context.js";
import { initSessionState } from "./session.js";
import { applyResetModelOverride } from "./session-reset-model.js";
import { stageSandboxMedia } from "./stage-sandbox-media.js";
import { createTypingController } from "./typing.js";

export async function getReplyFromConfig(
  ctx: MsgContext,
  opts?: GetReplyOptions,
  configOverride?: OpenClawCNConfig,
): Promise<ReplyPayload | ReplyPayload[] | undefined> {
  let _typingCleanup: (() => void) | undefined;
  try {
    const isFastTestEnv = process.env.OPENCLAWCN_TEST_FAST === "1";
    let cfg = configOverride ?? loadConfig();
    const targetSessionKey =
      ctx.CommandSource === "native" ? ctx.CommandTargetSessionKey?.trim() : undefined;
    let agentSessionKey = targetSessionKey || ctx.SessionKey;

    // ===== OpenClawCN: resolve_agent hook — Fast Path Router =====
    // Allows agent-team plugin to override the target agent before selection.
    // The hook can replace the session key (which embeds the agentId),
    // and all downstream derivations (agentDir, workspaceDir, session state)
    // will naturally follow.
    const hookRunner = getGlobalHookRunner();
    if (hookRunner?.hasHooks("resolve_agent")) {
      try {
        const resolveResult = await hookRunner.runResolveAgent(
          {
            message: ctx.Body ?? ctx.CommandBody ?? "",
            sessionKey: agentSessionKey ?? "",
          },
          {
            channelId: (ctx.Surface ?? ctx.Provider ?? "").toLowerCase(),
            accountId: ctx.AccountId,
            peerId: ctx.From,
          },
        );
        if (resolveResult?.sessionKey) {
          agentSessionKey = resolveResult.sessionKey;
          if (resolveResult.reason) {
            defaultRuntime.log(`[ResolveAgent] ${resolveResult.reason}`);
          }
        }
      } catch (err) {
        // Hook failure must not block normal flow
        defaultRuntime.log(`[ResolveAgent] hook failed: ${err}`);
      }
    }
    // ===== END OpenClawCN: resolve_agent hook =====

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
    _typingCleanup = () => typing.cleanup();
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
      hasResolvedHeartbeatModelOverride: false,
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

    // ===== OpenClawCN: 智能调度总开关 =====
    // cfg.dispatch.enabled 必须显式设为 true 才启用，默认关闭（功能尚在迭代中）
    // 注意：modalityRouter 独立于 dispatch 开关，因为它是基本的模态能力匹配（发图→选视觉模型），
    //       不属于"智能决策"范畴，关闭 dispatch 不应影响多模态基本功能。
    const dispatchCfg = cfg.dispatch;
    const dispatchEnabled = dispatchCfg?.enabled === true; // 默认 false（不配置 = 关闭）
    const modalityRouterEnabled = dispatchCfg?.modalityRouter !== false; // 独立开关，默认开启
    const multiAgentEnabled = dispatchEnabled && dispatchCfg?.multiAgent !== false;

    // ===== OpenClawCN: 模态感知智能路由 — 根据附件/文本自动选最优模型 =====
    // 位置在 directives 之后：尊重 /model 显式指定，只在自动模式下切换
    const userSpecifiedModelDirective = directives.hasModelDirective === true;
    if (!isFastTestEnv && !userSpecifiedModelDirective && modalityRouterEnabled) {
      try {
        const attachments = normalizeAttachments(finalized);
        const modalityRouting = await routeByModality({
          body: finalized.Body ?? finalized.CommandBody ?? "",
          attachments,
          cfg,
          agentDir,
          currentModel: { provider, model },
        });
        if (modalityRouting && modalityRouting.switched) {
          provider = modalityRouting.provider;
          model = modalityRouting.model;
          defaultRuntime.log(
            `[ModalityRouter] 自动切换模型: ${modalityRouting.provider}/${modalityRouting.model} ` +
              `(${modalityRouting.reason})`,
          );
        }
      } catch (routeErr) {
        // 模态路由失败不应阻止正常流程，继续使用原有模型
        defaultRuntime.log(`[ModalityRouter] 路由失败，使用默认模型: ${routeErr}`);
      }
    }
    // ===== END OpenClawCN: 模态感知智能路由 =====

    // ===== OpenClawCN: 智能调度引擎 — 策略决策 =====
    let dispatchDecision: RoutingDecision | undefined;
    if (!isFastTestEnv && !userSpecifiedModelDirective && dispatchEnabled) {
      try {
        dispatchDecision = await dispatchRequest({
          prompt: finalized.Body ?? finalized.CommandBody ?? "",
          openclawcnConfig: cfg,
          agentDir,
          workspaceDir,
          mediaTypes: normalizeAttachments(finalized).map((a) => a.mime ?? "unknown"),
          sessionId: agentSessionKey,
        });

        // Apply model override from dispatch (higher priority than modality router)
        if (dispatchDecision.modelOverride) {
          provider = dispatchDecision.modelOverride.provider;
          model = dispatchDecision.modelOverride.model;
        }

        if (dispatchDecision.strategy !== "single") {
          defaultRuntime.log(
            `[Dispatch] strategy=${dispatchDecision.strategy} intent=${dispatchDecision.intent} ` +
              `complexity=${dispatchDecision.complexity} confidence=${dispatchDecision.confidence}`,
          );
        }
      } catch (dispatchErr) {
        // Dispatch failure must not block normal flow
        defaultRuntime.log(`[Dispatch] 路由失败，使用默认策略: ${dispatchErr}`);
      }
    }
    // ===== END OpenClawCN: 智能调度引擎 =====

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

    const reply = await runPreparedReply({
      ctx,
      sessionCtx,
      cfg,
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
      provider,
      model,
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
      dispatchDecision,
    });

    if (reply === undefined) {
      defaultRuntime.log(
        `[getReplyFromConfig] runPreparedReply returned undefined (silent drop). sessionKey=${sessionKey} provider=${provider} model=${model} body="${(ctx.Body ?? "").slice(0, 60)}"`,
      );
    }

    // [CN-PATCH] 空响应只记录日志，不向用户显示错误提示。
    // 原因：模型可能已通过 tool call / block streaming 与用户交互过了，
    // 最终 payload 为空不代表"没有回复"。强制显示错误提示会导致误报。
    // 真正的空响应根因（session 污染）已在 session-tool-result-guard.ts 中修复。
    if (reply === undefined && !opts?.isHeartbeat) {
      defaultRuntime.log(
        `[getReplyFromConfig] 模型响应为空 (silent): provider=${provider} model=${model} sessionKey=${sessionKey}`,
      );
    }

    return reply;
  } catch (err) {
    // Top-level safety net: catch any unhandled error in the entire reply pipeline
    // to prevent process crash and return a user-friendly error message instead.
    _typingCleanup?.();
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
