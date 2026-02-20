/**
 * Channel Plugin 实现
 *
 * 个人微信 (WeChat Personal) 渠道核心实现
 * 通过 ClawChat 桥接服务与个人微信号通信
 */

import { buildChannelConfigSchema, type ChannelPlugin } from "openclawcn/plugin-sdk";
import { resolveMediaPath } from "./media-handler.js";
import { WechatMiniprogramConfigSchema } from "./config-schema.js";
import { getWechatMiniprogramRuntime } from "./runtime.js";
import { startPollingService } from "./polling.js";
import { CHANNEL_ID, BRIDGE_URL } from "./constants.js";
import {
  getPluginConfig,
  isConfigValid,
  type PluginConfig,
} from "./config.js";
import { wechatMiniprogramOnboardingAdapter } from "./onboarding.js";

// ==================== 类型定义 ====================

interface WeChatMiniprogramAccount {
  accountId: string;
  enabled: boolean;
  config: {
    apiKey?: string;
    pollIntervalMs?: number;
    sessionKey?: string;
    debug?: boolean;
  };
}

// ==================== Meta 配置 ====================

const meta = {
  id: CHANNEL_ID,
  label: "微信 (WeChat)",
  selectionLabel: "个人微信 (WeChat Personal)",
  docsPath: "/channels/openclawwechat",
  docsLabel: "openclawwechat",
  blurb:
    "个人微信渠道 - 通过 ClawChat 桥接服务接入，无需 VPN，支持文本、图片、视频、文档",
  aliases: ["wechat", "wx", "personal-wechat"],
  order: -1,
} as const;

// ==================== Capabilities ====================

const capabilities = {
  chatTypes: ["direct"] as Array<"direct" | "group">,
  media: true,
  blockStreaming: true,
};

// ==================== Messaging ====================

function normalizeWeChatMiniprogramTarget(
  raw: string,
): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  // 处理 channel:openid 格式
  if (trimmed.startsWith(`${CHANNEL_ID}:`)) {
    const openid = trimmed.slice(CHANNEL_ID.length + 1);
    if (openid) return openid;
  }

  return trimmed;
}

function looksLikeWeChatMiniprogramTargetId(
  raw: string,
  _normalized?: string,
): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith(`${CHANNEL_ID}:`)) {
    const openid = trimmed.slice(CHANNEL_ID.length + 1);
    if (openid && openid.length > 0) return true;
  }

  // 微信 openid 格式：20+ 字符的字母数字串
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return true;

  return false;
}

// ==================== Config ====================

const config = {
  listAccountIds: (_cfg: any) => ["default"],

  resolveAccount: (cfg: any, accountId?: string | null) => {
    const pluginConfig = getPluginConfig(cfg);

    return {
      accountId: accountId || "default",
      enabled: true,
      config: {
        apiKey: pluginConfig.apiKey,
        pollIntervalMs: pluginConfig.pollIntervalMs,
        sessionKey: pluginConfig.sessionKey,
        debug: pluginConfig.debug,
      },
    };
  },

  isConfigured: (account: WeChatMiniprogramAccount) => {
    return isConfigValid(account.config as PluginConfig);
  },

  describeAccount: (account: WeChatMiniprogramAccount) => ({
    accountId: account.accountId,
    enabled: account.enabled,
    configured: Boolean(account.config.apiKey?.trim()),
  }),
};

// ==================== Outbound ====================

const outbound = {
  deliveryMode: "direct" as const,

  resolveTarget: ({
    to,
    allowFrom,
  }: {
    to?: string;
    allowFrom?: string[];
    mode?: string;
  }) => {
    const trimmed = to?.trim() ?? "";
    if (!trimmed) {
      if (allowFrom && allowFrom.length > 0) {
        const firstAllowed = String(allowFrom[0]).trim();
        if (firstAllowed) {
          if (firstAllowed.startsWith(`${CHANNEL_ID}:`)) {
            const openid = firstAllowed.slice(CHANNEL_ID.length + 1);
            if (openid) return { ok: true as const, to: openid };
          }
          return { ok: true as const, to: firstAllowed };
        }
      }
      return {
        ok: false as const,
        error: new Error(
          `Target is required for WeChat MiniProgram. Use format: "${CHANNEL_ID}:<openid>" or just "<openid>"`,
        ),
      };
    }

    if (trimmed.startsWith(`${CHANNEL_ID}:`)) {
      const openid = trimmed.slice(CHANNEL_ID.length + 1);
      if (openid) return { ok: true as const, to: openid };
    }

    return { ok: true as const, to: trimmed };
  },

  sendText: async (ctx: any) => {
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
            reply_to_message_id: replyToId
              ? parseInt(replyToId)
              : undefined,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send message: ${response.statusText}`,
        );
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(
          `API error: ${data.description || "Unknown error"}`,
        );
      }

      return {
        channel: CHANNEL_ID,
        messageId: data.result?.message_id || String(Date.now()),
      };
    } catch (error) {
      ctx.log?.error?.(`Failed to send text message: ${error}`);
      throw error;
    }
  },

  sendMedia: async (ctx: any) => {
    const { to, text, mediaUrl, accountId, cfg, replyToId } = ctx;
    const pluginConfig = getPluginConfig(cfg);
    const apiKey = pluginConfig.apiKey;

    if (!apiKey) throw new Error("API Key not configured");
    if (!mediaUrl) throw new Error("Media URL is required");

    const isLocalPath =
      !mediaUrl.startsWith("http://") &&
      !mediaUrl.startsWith("https://");

    const encodedAPIKey = apiKey.replace(/:/g, "%3A");

    try {
      const runtime = getWechatMiniprogramRuntime();
      let response: Response;
      let media;
      let kind: string;
      let contentType: string;

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

      let sendMediaURL: string;
      let fieldName: string;
      let defaultFileName: string;
      let jsonFieldName: string;

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
        const fileName =
          mediaUrl.split("/").pop() || defaultFileName;
        const boundary = `----formdata-openclawcn-${Date.now()}`;
        const parts: Uint8Array[] = [];
        const encoder = new TextEncoder();

        const finalContentType =
          contentType ||
          (kind === "video"
            ? "video/mp4"
            : kind === "audio"
              ? "audio/mpeg"
              : kind === "image"
                ? "image/jpeg"
                : "application/octet-stream");
        parts.push(encoder.encode(`--${boundary}\r\n`));
        parts.push(
          encoder.encode(
            `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n`,
          ),
        );
        parts.push(
          encoder.encode(
            `Content-Type: ${finalContentType}\r\n\r\n`,
          ),
        );
        parts.push(media.buffer);
        parts.push(encoder.encode(`\r\n`));

        parts.push(encoder.encode(`--${boundary}\r\n`));
        parts.push(
          encoder.encode(
            `Content-Disposition: form-data; name="chat_id"\r\n\r\n`,
          ),
        );
        parts.push(encoder.encode(to));
        parts.push(encoder.encode(`\r\n`));

        if (text) {
          parts.push(encoder.encode(`--${boundary}\r\n`));
          parts.push(
            encoder.encode(
              `Content-Disposition: form-data; name="caption"\r\n\r\n`,
            ),
          );
          parts.push(encoder.encode(text));
          parts.push(encoder.encode(`\r\n`));
        }

        if (replyToId) {
          parts.push(encoder.encode(`--${boundary}\r\n`));
          parts.push(
            encoder.encode(
              `Content-Disposition: form-data; name="reply_to_message_id"\r\n\r\n`,
            ),
          );
          parts.push(
            encoder.encode(
              String(parseInt(String(replyToId))),
            ),
          );
          parts.push(encoder.encode(`\r\n`));
        }

        parts.push(encoder.encode(`--${boundary}--\r\n`));

        const totalLength = parts.reduce(
          (acc, part) => acc + part.length,
          0,
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
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body,
        });
      } else {
        const jsonBody: Record<string, unknown> = {
          chat_id: to,
          [jsonFieldName]: mediaUrl,
          caption: text || undefined,
          reply_to_message_id: replyToId
            ? parseInt(String(replyToId))
            : undefined,
        };

        response = await fetch(sendMediaURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jsonBody),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        ctx.log?.error?.(
          `[${accountId || "unknown"}] Failed to send ${kind}: ${response.status} ${response.statusText}, body=${errorText}`,
        );
        throw new Error(
          `Failed to send media: ${response.statusText}`,
        );
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(
          `API error: ${data.description || "Unknown error"}`,
        );
      }

      return {
        channel: CHANNEL_ID,
        messageId: data.result?.message_id || String(Date.now()),
      };
    } catch (error) {
      ctx.log?.error?.(
        `[${accountId || "unknown"}] Failed to send media message: ${error}`,
      );
      throw error;
    }
  },
};

// ==================== Status ====================

const status = {
  defaultRuntime: {
    accountId: "default",
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null,
  },

  buildChannelSummary: ({ snapshot }: any) => ({
    configured: snapshot.configured ?? false,
    running: snapshot.running ?? false,
    lastStartAt: snapshot.lastStartAt ?? null,
    lastStopAt: snapshot.lastStopAt ?? null,
    lastError: snapshot.lastError ?? null,
  }),

  buildAccountSnapshot: ({ account, cfg, runtime: rt }: any) => ({
    accountId: account.accountId,
    enabled: account.enabled,
    configured: isConfigValid(account.config as PluginConfig),
    running: rt?.running ?? false,
    lastStartAt: rt?.lastStartAt ?? null,
    lastStopAt: rt?.lastStopAt ?? null,
    lastError: rt?.lastError ?? null,
  }),
};

// ==================== Gateway ====================

const gateway = {
  startAccount: async (ctx: any) => {
    const { account } = ctx;

    ctx.log?.info?.(
      `[${account.accountId}] Starting WeChat MiniProgram account`,
    );

    if (!account.config.apiKey?.trim()) {
      throw new Error("API Key not configured");
    }

    return await startPollingService(ctx);
  },

  stopAccount: async (ctx: any) => {
    const { account } = ctx;

    ctx.log?.info?.(
      `[${account.accountId}] Stopping WeChat MiniProgram account`,
    );

    ctx.setStatus?.({
      accountId: account.accountId,
      running: false,
      lastStopAt: Date.now(),
    });
  },
};

// ==================== Channel Plugin 导出 ====================

export const wechatMiniprogramPlugin: ChannelPlugin<WeChatMiniprogramAccount> = {
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
      hint: `<openid> or "${CHANNEL_ID}:<openid>"`,
    },
  },
};
