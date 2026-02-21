import { buildChannelConfigSchema } from "openclawcn/plugin-sdk";
import { resolveMediaPath } from "./media-handler.js";
import { WechatMiniprogramConfigSchema } from "./config-schema.js";
import { getWechatMiniprogramRuntime } from "./runtime.js";
import { startPollingService } from "./polling.js";
import { CHANNEL_ID, BRIDGE_URL } from "./constants.js";
import {
  getPluginConfig,
  isConfigValid
} from "./config.js";
import { wechatMiniprogramOnboardingAdapter } from "./onboarding.js";
const meta = {
  id: CHANNEL_ID,
  label: "\u5FAE\u4FE1 (WeChat)",
  selectionLabel: "\u4E2A\u4EBA\u5FAE\u4FE1 (WeChat Personal)",
  docsPath: "/channels/openclawwechat",
  docsLabel: "openclawwechat",
  blurb: "\u4E2A\u4EBA\u5FAE\u4FE1\u6E20\u9053 - \u901A\u8FC7 ClawChat \u6865\u63A5\u670D\u52A1\u63A5\u5165\uFF0C\u65E0\u9700 VPN\uFF0C\u652F\u6301\u6587\u672C\u3001\u56FE\u7247\u3001\u89C6\u9891\u3001\u6587\u6863",
  aliases: ["wechat", "wx", "personal-wechat"],
  order: -1
};
const capabilities = {
  chatTypes: ["direct"],
  media: true,
  blockStreaming: true
};
function normalizeWeChatMiniprogramTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return void 0;
  if (trimmed.startsWith(`${CHANNEL_ID}:`)) {
    const openid = trimmed.slice(CHANNEL_ID.length + 1);
    if (openid) return openid;
  }
  return trimmed;
}
function looksLikeWeChatMiniprogramTargetId(raw, _normalized) {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(`${CHANNEL_ID}:`)) {
    const openid = trimmed.slice(CHANNEL_ID.length + 1);
    if (openid && openid.length > 0) return true;
  }
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return true;
  return false;
}
const config = {
  listAccountIds: (_cfg) => ["default"],
  resolveAccount: (cfg, accountId) => {
    const pluginConfig = getPluginConfig(cfg);
    return {
      accountId: accountId || "default",
      enabled: true,
      config: {
        apiKey: pluginConfig.apiKey,
        pollIntervalMs: pluginConfig.pollIntervalMs,
        sessionKey: pluginConfig.sessionKey,
        debug: pluginConfig.debug
      }
    };
  },
  isConfigured: (account) => {
    return isConfigValid(account.config);
  },
  describeAccount: (account) => ({
    accountId: account.accountId,
    enabled: account.enabled,
    configured: Boolean(account.config.apiKey?.trim())
  })
};
const outbound = {
  deliveryMode: "direct",
  resolveTarget: ({
    to,
    allowFrom
  }) => {
    const trimmed = to?.trim() ?? "";
    if (!trimmed) {
      if (allowFrom && allowFrom.length > 0) {
        const firstAllowed = String(allowFrom[0]).trim();
        if (firstAllowed) {
          if (firstAllowed.startsWith(`${CHANNEL_ID}:`)) {
            const openid = firstAllowed.slice(CHANNEL_ID.length + 1);
            if (openid) return { ok: true, to: openid };
          }
          return { ok: true, to: firstAllowed };
        }
      }
      return {
        ok: false,
        error: new Error(
          `Target is required for WeChat MiniProgram. Use format: "${CHANNEL_ID}:<openid>" or just "<openid>"`
        )
      };
    }
    if (trimmed.startsWith(`${CHANNEL_ID}:`)) {
      const openid = trimmed.slice(CHANNEL_ID.length + 1);
      if (openid) return { ok: true, to: openid };
    }
    return { ok: true, to: trimmed };
  },
  sendText: async (ctx) => {
    const { to, text, accountId, cfg, replyToId } = ctx;
    const pluginConfig = getPluginConfig(cfg);
    const apiKey = pluginConfig.apiKey;
    if (!apiKey) throw new Error("API Key not configured");
    const encodedAPIKey = apiKey.replace(/:/g, "%3A");
    try {
      const response = await fetch(
        `${BRIDGE_URL}/bot${encodedAPIKey}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: to,
            text,
            reply_to_message_id: replyToId ? parseInt(replyToId) : void 0
          })
        }
      );
      if (!response.ok) {
        throw new Error(
          `Failed to send message: ${response.statusText}`
        );
      }
      const data = await response.json();
      if (!data.ok) {
        throw new Error(
          `API error: ${data.description || "Unknown error"}`
        );
      }
      return {
        channel: CHANNEL_ID,
        messageId: data.result?.message_id || String(Date.now())
      };
    } catch (error) {
      ctx.log?.error?.(`Failed to send text message: ${error}`);
      throw error;
    }
  },
  sendMedia: async (ctx) => {
    const { to, text, mediaUrl, accountId, cfg, replyToId } = ctx;
    const pluginConfig = getPluginConfig(cfg);
    const apiKey = pluginConfig.apiKey;
    if (!apiKey) throw new Error("API Key not configured");
    if (!mediaUrl) throw new Error("Media URL is required");
    const isLocalPath = !mediaUrl.startsWith("http://") && !mediaUrl.startsWith("https://");
    const encodedAPIKey = apiKey.replace(/:/g, "%3A");
    try {
      const runtime = getWechatMiniprogramRuntime();
      let response;
      let media;
      let kind;
      let contentType;
      if (isLocalPath) {
        const resolvedMediaPath = resolveMediaPath(mediaUrl);
        media = await runtime.media.loadWebMedia(resolvedMediaPath);
        kind = runtime.media.mediaKindFromMime(media.contentType);
        contentType = media.contentType || "";
      } else {
        media = await runtime.media.loadWebMedia(mediaUrl);
        kind = runtime.media.mediaKindFromMime(media.contentType);
        contentType = media.contentType || "";
      }
      let sendMediaURL;
      let fieldName;
      let defaultFileName;
      let jsonFieldName;
      if (kind === "image") {
        sendMediaURL = `${BRIDGE_URL}/bot${encodedAPIKey}/sendPhoto`;
        fieldName = "photo";
        jsonFieldName = "photo";
        defaultFileName = "image.jpg";
      } else if (kind === "video") {
        sendMediaURL = `${BRIDGE_URL}/bot${encodedAPIKey}/sendVideo`;
        fieldName = "video";
        jsonFieldName = "video";
        defaultFileName = "video.mp4";
      } else if (kind === "audio") {
        sendMediaURL = `${BRIDGE_URL}/bot${encodedAPIKey}/sendDocument`;
        fieldName = "document";
        jsonFieldName = "document";
        defaultFileName = "audio.mp3";
      } else {
        sendMediaURL = `${BRIDGE_URL}/bot${encodedAPIKey}/sendDocument`;
        fieldName = "document";
        jsonFieldName = "document";
        defaultFileName = "document";
      }
      if (isLocalPath) {
        const fileName = mediaUrl.split("/").pop() || defaultFileName;
        const boundary = `----formdata-openclawcn-${Date.now()}`;
        const parts = [];
        const encoder = new TextEncoder();
        const finalContentType = contentType || (kind === "video" ? "video/mp4" : kind === "audio" ? "audio/mpeg" : kind === "image" ? "image/jpeg" : "application/octet-stream");
        parts.push(encoder.encode(`--${boundary}\r
`));
        parts.push(
          encoder.encode(
            `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r
`
          )
        );
        parts.push(
          encoder.encode(
            `Content-Type: ${finalContentType}\r
\r
`
          )
        );
        parts.push(media.buffer);
        parts.push(encoder.encode(`\r
`));
        parts.push(encoder.encode(`--${boundary}\r
`));
        parts.push(
          encoder.encode(
            `Content-Disposition: form-data; name="chat_id"\r
\r
`
          )
        );
        parts.push(encoder.encode(to));
        parts.push(encoder.encode(`\r
`));
        if (text) {
          parts.push(encoder.encode(`--${boundary}\r
`));
          parts.push(
            encoder.encode(
              `Content-Disposition: form-data; name="caption"\r
\r
`
            )
          );
          parts.push(encoder.encode(text));
          parts.push(encoder.encode(`\r
`));
        }
        if (replyToId) {
          parts.push(encoder.encode(`--${boundary}\r
`));
          parts.push(
            encoder.encode(
              `Content-Disposition: form-data; name="reply_to_message_id"\r
\r
`
            )
          );
          parts.push(
            encoder.encode(
              String(parseInt(String(replyToId)))
            )
          );
          parts.push(encoder.encode(`\r
`));
        }
        parts.push(encoder.encode(`--${boundary}--\r
`));
        const totalLength = parts.reduce(
          (acc, part) => acc + part.length,
          0
        );
        const body = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) {
          body.set(part, offset);
          offset += part.length;
        }
        response = await fetch(sendMediaURL, {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`
          },
          body
        });
      } else {
        const jsonBody = {
          chat_id: to,
          [jsonFieldName]: mediaUrl,
          caption: text || void 0,
          reply_to_message_id: replyToId ? parseInt(String(replyToId)) : void 0
        };
        response = await fetch(sendMediaURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jsonBody)
        });
      }
      if (!response.ok) {
        const errorText = await response.text();
        ctx.log?.error?.(
          `[${accountId || "unknown"}] Failed to send ${kind}: ${response.status} ${response.statusText}, body=${errorText}`
        );
        throw new Error(
          `Failed to send media: ${response.statusText}`
        );
      }
      const data = await response.json();
      if (!data.ok) {
        throw new Error(
          `API error: ${data.description || "Unknown error"}`
        );
      }
      return {
        channel: CHANNEL_ID,
        messageId: data.result?.message_id || String(Date.now())
      };
    } catch (error) {
      ctx.log?.error?.(
        `[${accountId || "unknown"}] Failed to send media message: ${error}`
      );
      throw error;
    }
  }
};
const status = {
  defaultRuntime: {
    accountId: "default",
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null
  },
  buildChannelSummary: ({ snapshot }) => ({
    configured: snapshot.configured ?? false,
    running: snapshot.running ?? false,
    lastStartAt: snapshot.lastStartAt ?? null,
    lastStopAt: snapshot.lastStopAt ?? null,
    lastError: snapshot.lastError ?? null
  }),
  buildAccountSnapshot: ({ account, cfg, runtime: rt }) => ({
    accountId: account.accountId,
    enabled: account.enabled,
    configured: isConfigValid(account.config),
    running: rt?.running ?? false,
    lastStartAt: rt?.lastStartAt ?? null,
    lastStopAt: rt?.lastStopAt ?? null,
    lastError: rt?.lastError ?? null
  })
};
const gateway = {
  startAccount: async (ctx) => {
    const { account } = ctx;
    ctx.log?.info?.(
      `[${account.accountId}] Starting WeChat MiniProgram account`
    );
    if (!account.config.apiKey?.trim()) {
      throw new Error("API Key not configured");
    }
    return await startPollingService(ctx);
  },
  stopAccount: async (ctx) => {
    const { account } = ctx;
    ctx.log?.info?.(
      `[${account.accountId}] Stopping WeChat MiniProgram account`
    );
    ctx.setStatus?.({
      accountId: account.accountId,
      running: false,
      lastStopAt: Date.now()
    });
  }
};
const wechatMiniprogramPlugin = {
  id: CHANNEL_ID,
  meta: { ...meta, aliases: [...meta.aliases] },
  capabilities,
  onboarding: wechatMiniprogramOnboardingAdapter,
  reload: { configPrefixes: ["channels.openclawwechat"] },
  configSchema: buildChannelConfigSchema(WechatMiniprogramConfigSchema),
  config,
  outbound,
  status,
  gateway,
  messaging: {
    normalizeTarget: normalizeWeChatMiniprogramTarget,
    targetResolver: {
      looksLikeId: looksLikeWeChatMiniprogramTargetId,
      hint: `<openid> or "${CHANNEL_ID}:<openid>"`
    }
  }
};
export {
  wechatMiniprogramPlugin
};
