/**
 * 消息注入模块
 *
 * 负责构建消息上下文并注入到 OpenClawCN AI 管线
 */

import { getWechatMiniprogramRuntime } from "./runtime.js";
import { sendReply, type ReplyConfig } from "./reply-sender.js";
import { CHANNEL_ID, BRIDGE_URL } from "./constants.js";
import { notifyTyping } from "./typing.js";
import { resolveSession } from "./session.js";

export interface MessageToInject {
  openid: string;
  updateId: number;
  text: string;
  mediaUrls: string[];
  mediaTypes: string[];
  mediaPaths: string[];
  uploadAPIURL?: string;
}

export interface InjectConfig {
  accountId: string;
  bridgeUrl?: string;
  apiKey: string;
}

/**
 * 注入消息到 OpenClawCN
 */
export async function injectMessage(
  message: MessageToInject,
  config: InjectConfig,
  log?: {
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
    info?: (msg: string) => void;
  },
): Promise<void> {
  const runtime = getWechatMiniprogramRuntime();

  if (message.uploadAPIURL) {
    log?.info?.(
      `[${config.accountId}] Injecting message with upload API URL: ${message.uploadAPIURL}`,
    );
  } else {
    log?.warn?.(
      `[${config.accountId}] Injecting message without upload API URL (update_id=${message.updateId})`,
    );
  }

  const cfg = runtime.config?.loadConfig ? runtime.config.loadConfig() : undefined;

  if (!runtime?.channel?.reply?.dispatchReplyWithBufferedBlockDispatcher) {
    log?.error?.(
      `[${config.accountId}] dispatchReplyWithBufferedBlockDispatcher not available`,
    );
    throw new Error("dispatchReplyWithBufferedBlockDispatcher not available");
  }

  if (!cfg) {
    log?.warn?.(`[${config.accountId}] Config is undefined, cannot resolve session`);
    throw new Error("Config is undefined");
  }

  const sessionResult = resolveSession({
    cfg,
    apiKey: config.apiKey,
    accountId: config.accountId,
    openid: message.openid,
    runtime,
  });

  const sessionKey = sessionResult.sessionKey;
  const mainSessionKey = sessionResult.mainSessionKey;
  const agentId = sessionResult.agentId;

  const storePath = runtime.channel.session.resolveStorePath(
    cfg?.session?.store,
    { agentId },
  );

  // 构建消息体：如果没有文本但有媒体，设置占位符文本
  const hasVideo = message.mediaTypes.some((type) => type.startsWith("video/"));
  const hasImage = message.mediaTypes.some((type) => type.startsWith("image/"));
  const hasDocument =
    message.mediaTypes.some(
      (type) => !type.startsWith("video/") && !type.startsWith("image/"),
    ) && message.mediaTypes.length > 0;

  let mediaPlaceholder = "";
  if (hasVideo) {
    mediaPlaceholder = `<media:video>${message.mediaUrls.length > 1 ? ` (${message.mediaUrls.length} videos)` : ""}`;
  } else if (hasImage) {
    mediaPlaceholder = `<media:image>${message.mediaUrls.length > 1 ? ` (${message.mediaUrls.length} images)` : ""}`;
  } else if (hasDocument) {
    mediaPlaceholder = `<media:document>${message.mediaUrls.length > 1 ? ` (${message.mediaUrls.length} documents)` : ""}`;
  }

  const finalBody =
    message.text ||
    (message.mediaUrls.length > 0 ? mediaPlaceholder : "");

  const msgContext = runtime.channel.reply.finalizeInboundContext({
    Body: finalBody,
    BodyForAgent: finalBody,
    RawBody: message.text || finalBody,
    CommandBody: message.text || finalBody,
    BodyForCommands: message.text || finalBody,
    From: `${CHANNEL_ID}:${message.openid}`,
    To: `${CHANNEL_ID}:${message.openid}`,
    SessionKey: sessionKey,
    AccountId: config.accountId,
    MessageSid: String(message.updateId),
    Surface: CHANNEL_ID,
    Provider: CHANNEL_ID,
    ChatType: "direct",
    Timestamp: Date.now(),
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `${CHANNEL_ID}:${message.openid}`,
    CommandSource: "text" as const,
    CommandAuthorized: true,
    MediaPaths:
      message.mediaPaths.length > 0 ? message.mediaPaths : undefined,
    MediaUrls:
      message.mediaUrls.length > 0 ? message.mediaUrls : undefined,
    MediaTypes:
      message.mediaTypes.length > 0 ? message.mediaTypes : undefined,
    MediaPath:
      message.mediaPaths.length > 0
        ? message.mediaPaths[0]
        : message.mediaUrls.length > 0
          ? message.mediaUrls[0]
          : undefined,
    MediaUrl:
      message.mediaUrls.length > 0 ? message.mediaUrls[0] : undefined,
    MediaType:
      message.mediaTypes.length > 0 ? message.mediaTypes[0] : undefined,
  });

  if (msgContext.SessionKey !== sessionKey) {
    log?.warn?.(
      `[${config.accountId}] SessionKey mismatch: expected=${sessionKey}, actual=${msgContext.SessionKey}`,
    );
  }

  // 记录消息到会话存储
  if (runtime.channel.session.recordInboundSession && storePath) {
    try {
      await runtime.channel.session.recordInboundSession({
        storePath,
        sessionKey: msgContext.SessionKey ?? sessionKey,
        ctx: msgContext,
        updateLastRoute: {
          sessionKey: mainSessionKey || sessionKey,
          channel: CHANNEL_ID,
          to: message.openid,
          accountId: config.accountId,
        },
        onRecordError: (err: unknown) => {
          log?.warn?.(
            `[${config.accountId}] Failed to record inbound session: ${err}`,
          );
        },
      });
    } catch (recordError) {
      log?.error?.(
        `[${config.accountId}] Failed to record inbound session: ${recordError}`,
      );
    }
  }

  // 构建回复发送配置
  let uploadVideoAPIURL: string | undefined;
  let uploadDocumentAPIURL: string | undefined;

  if (message.uploadAPIURL) {
    if (message.uploadAPIURL.includes("/sendPhoto")) {
      uploadVideoAPIURL = message.uploadAPIURL.replace(
        "/sendPhoto",
        "/sendVideo",
      );
      uploadDocumentAPIURL = message.uploadAPIURL.replace(
        "/sendPhoto",
        "/sendDocument",
      );
    } else if (message.uploadAPIURL.includes("/sendVideo")) {
      uploadVideoAPIURL = message.uploadAPIURL;
      uploadDocumentAPIURL = message.uploadAPIURL.replace(
        "/sendVideo",
        "/sendDocument",
      );
    } else if (message.uploadAPIURL.includes("/sendDocument")) {
      uploadVideoAPIURL = message.uploadAPIURL.replace(
        "/sendDocument",
        "/sendVideo",
      );
      uploadDocumentAPIURL = message.uploadAPIURL;
    } else {
      uploadVideoAPIURL = message.uploadAPIURL.replace(
        /\/send\w+$/,
        "/sendVideo",
      );
      uploadDocumentAPIURL = message.uploadAPIURL.replace(
        /\/send\w+$/,
        "/sendDocument",
      );
    }
  }

  const replyConfig: ReplyConfig = {
    apiKey: config.apiKey,
    uploadAPIURL: message.uploadAPIURL,
    uploadVideoAPIURL,
    uploadDocumentAPIURL,
  };

  // 开始处理前通知「正在输入」
  await notifyTyping(config.apiKey, "start", log);

  let replyCount = 0;
  await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: msgContext,
    cfg,
    dispatcherOptions: {
      onReplyStart: async () => {
        await notifyTyping(config.apiKey, "start", log);
      },
      deliver: async (payload: any, info: any) => {
        if (info.kind === "final") {
          replyCount++;
          const replyToUpdateId =
            replyCount === 1 ? message.updateId : undefined;

          await sendReply(
            {
              ...payload,
              mediaTypes: message.mediaTypes,
            },
            message.openid,
            replyToUpdateId,
            replyConfig,
            config.accountId,
            log,
          );
        }
      },
      onError: (err: unknown, info: any) => {
        log?.error?.(
          `[${config.accountId}] Reply dispatch error: ${err}, kind=${info.kind}`,
        );
      },
    },
  });
}
