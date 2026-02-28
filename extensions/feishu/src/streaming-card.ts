/**
 * 飞书流式卡片
 * Feishu Streaming Card (CardKit API)
 *
 * 使用飞书 CardKit 流式 API 实现实时 AI 输出渲染
 * 参考 m1heng/clawdbot-feishu (MIT License)
 *
 * 流程:
 * 1. 获取 tenant_access_token
 * 2. 创建流式卡片 (POST /cardkit/v1/cards)
 * 3. 发送初始卡片消息 (im.message.create with card_id)
 * 4. 更新卡片内容 (PATCH /cardkit/v1/cards/:card_id/elements/:element_id)
 * 5. 关闭流式卡片 (POST /cardkit/v1/cards/:card_id/streaming/complete)
 */

import type { FeishuChannelConfig } from "./types.js";
import { createFeishuClient, resolveFeishuCredentials } from "./client.js";
import { resolveReceiveIdType, normalizeFeishuTarget } from "./targets.js";

// ============================================================================
// Token 管理
// ============================================================================

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const TOKEN_BUFFER_MS = 60 * 1000; // 提前 60 秒刷新

async function getTenantAccessToken(cfg: FeishuChannelConfig): Promise<string> {
  const creds = resolveFeishuCredentials(cfg);
  if (!creds) throw new Error("飞书凭证未配置");

  const cacheKey = `${creds.domain}:${creds.appId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const domain = creds.domain === "lark"
    ? "https://open.larksuite.com"
    : "https://open.feishu.cn";

  const res = await fetch(`${domain}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: creds.appId,
      app_secret: creds.appSecret,
    }),
  });

  const data = await res.json() as {
    code: number;
    msg: string;
    tenant_access_token?: string;
    expire?: number;
  };

  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
  }

  const token = data.tenant_access_token;
  const expiresAt = Date.now() + (data.expire ?? 7200) * 1000 - TOKEN_BUFFER_MS;
  tokenCache.set(cacheKey, { token, expiresAt });
  return token;
}

function getApiDomain(cfg: FeishuChannelConfig): string {
  const creds = resolveFeishuCredentials(cfg);
  return creds?.domain === "lark"
    ? "https://open.larksuite.com"
    : "https://open.feishu.cn";
}

// ============================================================================
// 流式卡片类
// ============================================================================

const CONTENT_ELEMENT_ID = "streaming_content";
const THROTTLE_MS = 100;

export class FeishuStreamingCard {
  private cardId: string | null = null;
  private messageId: string | null = null;
  private fullText = "";
  private pendingFlush = false;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private token: string | null = null;

  constructor(
    private cfg: FeishuChannelConfig,
    private chatId: string,
    private replyToMessageId?: string,
  ) {}

  /**
   * 开始流式卡片会话
   * 1. 创建卡片
   * 2. 发送卡片消息
   */
  async start(): Promise<void> {
    const domain = getApiDomain(this.cfg);
    this.token = await getTenantAccessToken(this.cfg);

    // 1. 创建流式卡片
    const createRes = await fetch(`${domain}/open-apis/cardkit/v1/cards`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        type: "card_kit",
        data: {
          config: { streaming_mode: true, wide_screen_mode: true },
          card_link: {},
          elements: [
            {
              tag: "markdown",
              element_id: CONTENT_ELEMENT_ID,
              content: "...",
              text_size: "normal",
            },
          ],
        },
      }),
    });

    const createData = await createRes.json() as {
      code: number;
      msg: string;
      data?: { card_id?: string };
    };

    if (createData.code !== 0 || !createData.data?.card_id) {
      throw new Error(`创建流式卡片失败: ${createData.msg}`);
    }

    this.cardId = createData.data.card_id;

    // 2. 发送卡片消息到会话
    const client = createFeishuClient(this.cfg);
    const receiveId = normalizeFeishuTarget(this.chatId);
    if (!receiveId) throw new Error(`无效的飞书目标: ${this.chatId}`);

    const receiveIdType = resolveReceiveIdType(receiveId);
    const content = JSON.stringify({ type: "card_kit", data: { card_id: this.cardId } });

    let msgRes;
    if (this.replyToMessageId) {
      msgRes = await client.im.message.reply({
        path: { message_id: this.replyToMessageId },
        data: { content, msg_type: "interactive" },
      });
    } else {
      msgRes = await client.im.message.create({
        params: { receive_id_type: receiveIdType },
        data: { receive_id: receiveId, content, msg_type: "interactive" },
      });
    }

    if (msgRes.code !== 0) {
      throw new Error(`发送流式卡片消息失败: ${msgRes.msg}`);
    }

    this.messageId = msgRes.data?.message_id ?? null;
  }

  /**
   * 追加文本内容（节流 100ms）
   */
  append(text: string): void {
    if (this.closed) return;
    this.fullText += text;
    this.pendingFlush = true;

    if (!this.throttleTimer) {
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null;
        this.flush().catch(() => {});
      }, THROTTLE_MS);
    }
  }

  /**
   * 发送累积的文本更新到卡片
   */
  private async flush(): Promise<void> {
    if (!this.cardId || !this.pendingFlush || !this.token) return;
    this.pendingFlush = false;

    const domain = getApiDomain(this.cfg);

    try {
      await fetch(
        `${domain}/open-apis/cardkit/v1/cards/${this.cardId}/elements/${CONTENT_ELEMENT_ID}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            element: {
              tag: "markdown",
              element_id: CONTENT_ELEMENT_ID,
              content: this.fullText || "...",
              text_size: "normal",
            },
          }),
        },
      );
    } catch {
      // 静默失败 — 下次 flush 会重试
    }
  }

  /**
   * 关闭流式卡片（完成流式输出）
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    // 清理节流定时器
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }

    // 最终 flush
    this.pendingFlush = true;
    await this.flush();

    // 关闭流式
    if (this.cardId && this.token) {
      const domain = getApiDomain(this.cfg);
      try {
        await fetch(
          `${domain}/open-apis/cardkit/v1/cards/${this.cardId}/streaming/complete`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({}),
          },
        );
      } catch {
        // 最佳努力
      }
    }
  }

  /** 当前累积的完整文本 */
  get text(): string {
    return this.fullText;
  }

  /** 是否已关闭 */
  get isClosed(): boolean {
    return this.closed;
  }

  /** 卡片消息 ID */
  get cardMessageId(): string | null {
    return this.messageId;
  }
}
