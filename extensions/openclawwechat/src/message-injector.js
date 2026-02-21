import { getWechatMiniprogramRuntime } from "./runtime.js";
import { sendReply } from "./reply-sender.js";
import { CHANNEL_ID } from "./constants.js";
import { notifyTyping } from "./typing.js";
import { resolveSession } from "./session.js";
async function injectMessage(message, config, log) {
  const runtime = getWechatMiniprogramRuntime();
  if (message.uploadAPIURL) {
    log?.info?.(
      `[${config.accountId}] Injecting message with upload API URL: ${message.uploadAPIURL}`
    );
  } else {
    log?.warn?.(
      `[${config.accountId}] Injecting message without upload API URL (update_id=${message.updateId})`
    );
  }
  const cfg = runtime.config?.loadConfig ? runtime.config.loadConfig() : void 0;
  if (!runtime?.channel?.reply?.dispatchReplyWithBufferedBlockDispatcher) {
    log?.error?.(
      `[${config.accountId}] dispatchReplyWithBufferedBlockDispatcher not available`
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
    runtime
  });
  const sessionKey = sessionResult.sessionKey;
  const mainSessionKey = sessionResult.mainSessionKey;
  const agentId = sessionResult.agentId;
  const storePath = runtime.channel.session.resolveStorePath(
    cfg?.session?.store,
    { agentId }
  );
  const hasVideo = message.mediaTypes.some((type) => type.startsWith("video/"));
  const hasImage = message.mediaTypes.some((type) => type.startsWith("image/"));
  const hasDocument = message.mediaTypes.some(
    (type) => !type.startsWith("video/") && !type.startsWith("image/")
  ) && message.mediaTypes.length > 0;
  let mediaPlaceholder = "";
  if (hasVideo) {
    mediaPlaceholder = `<media:video>${message.mediaUrls.length > 1 ? ` (${message.mediaUrls.length} videos)` : ""}`;
  } else if (hasImage) {
    mediaPlaceholder = `<media:image>${message.mediaUrls.length > 1 ? ` (${message.mediaUrls.length} images)` : ""}`;
  } else if (hasDocument) {
    mediaPlaceholder = `<media:document>${message.mediaUrls.length > 1 ? ` (${message.mediaUrls.length} documents)` : ""}`;
  }
  const finalBody = message.text || (message.mediaUrls.length > 0 ? mediaPlaceholder : "");
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
    CommandSource: "text",
    CommandAuthorized: true,
    MediaPaths: message.mediaPaths.length > 0 ? message.mediaPaths : void 0,
    MediaUrls: message.mediaUrls.length > 0 ? message.mediaUrls : void 0,
    MediaTypes: message.mediaTypes.length > 0 ? message.mediaTypes : void 0,
    MediaPath: message.mediaPaths.length > 0 ? message.mediaPaths[0] : message.mediaUrls.length > 0 ? message.mediaUrls[0] : void 0,
    MediaUrl: message.mediaUrls.length > 0 ? message.mediaUrls[0] : void 0,
    MediaType: message.mediaTypes.length > 0 ? message.mediaTypes[0] : void 0
  });
  if (msgContext.SessionKey !== sessionKey) {
    log?.warn?.(
      `[${config.accountId}] SessionKey mismatch: expected=${sessionKey}, actual=${msgContext.SessionKey}`
    );
  }
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
          accountId: config.accountId
        },
        onRecordError: (err) => {
          log?.warn?.(
            `[${config.accountId}] Failed to record inbound session: ${err}`
          );
        }
      });
    } catch (recordError) {
      log?.error?.(
        `[${config.accountId}] Failed to record inbound session: ${recordError}`
      );
    }
  }
  let uploadVideoAPIURL;
  let uploadDocumentAPIURL;
  if (message.uploadAPIURL) {
    if (message.uploadAPIURL.includes("/sendPhoto")) {
      uploadVideoAPIURL = message.uploadAPIURL.replace(
        "/sendPhoto",
        "/sendVideo"
      );
      uploadDocumentAPIURL = message.uploadAPIURL.replace(
        "/sendPhoto",
        "/sendDocument"
      );
    } else if (message.uploadAPIURL.includes("/sendVideo")) {
      uploadVideoAPIURL = message.uploadAPIURL;
      uploadDocumentAPIURL = message.uploadAPIURL.replace(
        "/sendVideo",
        "/sendDocument"
      );
    } else if (message.uploadAPIURL.includes("/sendDocument")) {
      uploadVideoAPIURL = message.uploadAPIURL.replace(
        "/sendDocument",
        "/sendVideo"
      );
      uploadDocumentAPIURL = message.uploadAPIURL;
    } else {
      uploadVideoAPIURL = message.uploadAPIURL.replace(
        /\/send\w+$/,
        "/sendVideo"
      );
      uploadDocumentAPIURL = message.uploadAPIURL.replace(
        /\/send\w+$/,
        "/sendDocument"
      );
    }
  }
  const replyConfig = {
    apiKey: config.apiKey,
    uploadAPIURL: message.uploadAPIURL,
    uploadVideoAPIURL,
    uploadDocumentAPIURL
  };
  await notifyTyping(config.apiKey, "start", log);
  let replyCount = 0;
  await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: msgContext,
    cfg,
    dispatcherOptions: {
      onReplyStart: async () => {
        await notifyTyping(config.apiKey, "start", log);
      },
      deliver: async (payload, info) => {
        if (info.kind === "final") {
          replyCount++;
          const replyToUpdateId = replyCount === 1 ? message.updateId : void 0;
          await sendReply(
            {
              ...payload,
              mediaTypes: message.mediaTypes
            },
            message.openid,
            replyToUpdateId,
            replyConfig,
            config.accountId,
            log
          );
        }
      },
      onError: (err, info) => {
        log?.error?.(
          `[${config.accountId}] Reply dispatch error: ${err}, kind=${info.kind}`
        );
      }
    }
  });
}
export {
  injectMessage
};
