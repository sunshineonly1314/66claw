import {
  createReplyPrefixContext,
  createTypingCallbacks,
  logTypingFailure,
  type ClawdbotConfig,
  type ReplyPayload,
  type RuntimeEnv,
} from "openclawcn/plugin-sdk";
import type { MentionTarget } from "./types.js";
import { resolveFeishuAccount } from "./accounts.js";
import { createFeishuClient } from "./client.js";
import { buildMentionedCardContent } from "./mention.js";
import { getFeishuRuntime } from "./runtime.js";
import { sendMarkdownCardFeishu, sendFeishuMessage } from "./api.js";
import { resolveReceiveIdType } from "./targets.js";
import { addTypingIndicator, removeTypingIndicator } from "./typing.js";
import type { FeishuChannelConfig } from "./types.js";

/** Detect if text contains markdown elements that benefit from card rendering */
function shouldUseCard(text: string): boolean {
  return /```[\s\S]*?```/.test(text) || /\|.+\|[\r\n]+\|[-:| ]+\|/.test(text);
}

export type CreateFeishuReplyDispatcherParams = {
  cfg: ClawdbotConfig;
  agentId: string;
  runtime: RuntimeEnv;
  chatId: string;
  replyToMessageId?: string;
  mentionTargets?: MentionTarget[];
  accountId?: string;
};

export function createFeishuReplyDispatcher(params: CreateFeishuReplyDispatcherParams) {
  const core = getFeishuRuntime();
  const { cfg, agentId, chatId, replyToMessageId, mentionTargets, accountId } = params;
  const account = resolveFeishuAccount({ cfg, accountId });
  const prefixContext = createReplyPrefixContext({ cfg, agentId });

  const feishuCfg = account.config as FeishuChannelConfig;

  let typingActive = false;
  const typingCallbacks = createTypingCallbacks({
    start: async () => {
      if (!replyToMessageId) {
        return;
      }
      typingActive = await addTypingIndicator(feishuCfg, replyToMessageId);
    },
    stop: async () => {
      if (!typingActive) {
        return;
      }
      await removeTypingIndicator(feishuCfg, replyToMessageId!);
      typingActive = false;
    },
    onStartError: (err: unknown) =>
      logTypingFailure({
        log: (message: string) => params.runtime.log?.(message),
        channel: "feishu",
        action: "start",
        error: err,
      }),
    onStopError: (err: unknown) =>
      logTypingFailure({
        log: (message: string) => params.runtime.log?.(message),
        channel: "feishu",
        action: "stop",
        error: err,
      }),
  });

  const textChunkLimit = core.channel.text.resolveTextChunkLimit(cfg, "feishu", accountId, {
    fallbackLimit: 4000,
  });
  const chunkMode = core.channel.text.resolveChunkMode(cfg, "feishu");
  const tableMode = core.channel.text.resolveMarkdownTableMode({ cfg, channel: "feishu" });
  const renderMode = feishuCfg?.renderMode ?? "auto";

  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: prefixContext.responsePrefix,
      responsePrefixContextProvider: prefixContext.responsePrefixContextProvider,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, agentId),
      onReplyStart: () => {
        void typingCallbacks.onReplyStart?.();
      },
      deliver: async (payload: ReplyPayload, info) => {
        const text = payload.text ?? "";
        if (!text.trim()) {
          return;
        }

        const useCard = renderMode === "card" || (renderMode === "auto" && shouldUseCard(text));

        let first = true;
        if (useCard) {
          for (const chunk of core.channel.text.chunkTextWithMode(
            text,
            textChunkLimit,
            chunkMode,
          )) {
            await sendMarkdownCardFeishu({
              config: feishuCfg,
              to: chatId,
              text: chunk,
              replyToMessageId,
              mentions: first ? mentionTargets : undefined,
            });
            first = false;
          }
        } else {
          const converted = core.channel.text.convertMarkdownTables(text, tableMode);
          for (const chunk of core.channel.text.chunkTextWithMode(
            converted,
            textChunkLimit,
            chunkMode,
          )) {
            await sendFeishuMessage(feishuCfg, chatId, chunk, {
              replyToId: replyToMessageId,
              mentions: first ? mentionTargets : undefined,
            });
            first = false;
          }
        }
      },
      onError: async (error, info) => {
        params.runtime.error?.(
          `feishu[${account.accountId}] ${info.kind} reply failed: ${String(error)}`,
        );
        typingCallbacks.onIdle?.();
      },
      onIdle: async () => {
        typingCallbacks.onIdle?.();
      },
      onCleanup: () => {
        typingCallbacks.onCleanup?.();
      },
    });

  return {
    dispatcher,
    replyOptions: {
      ...replyOptions,
      onModelSelected: prefixContext.onModelSelected,
    },
    markDispatchIdle,
  };
}
