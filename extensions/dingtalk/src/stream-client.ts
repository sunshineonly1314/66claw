/**
 * 钉钉 Stream 客户端模块
 * DingTalk Stream Client Module
 *
 * 使用钉钉 Stream 协议 (WebSocket) 接收消息，无需公网 IP
 *
 * 参考文档:
 * - https://open.dingtalk.com/document/orgapp/stream
 */

import { DWClient, TOPIC_ROBOT } from "dingtalk-stream";

import { createAICard, finishAICard, streamAICard } from "./ai-card.js";
import { sendDingtalkMessageViaWebhook } from "./api.js";
import { buildMediaSystemPrompt, getOapiAccessToken, processLocalImages } from "./media-upload.js";
import { DEFAULT_SESSION_TIMEOUT, getSessionKey, isNewSessionCommand } from "./session-manager.js";
import type {
  AICardContext,
  DingtalkChannelConfig,
  DingtalkRobotMessageEvent,
  StreamMessageParams,
} from "./types.js";

// ============================================================================
// Gateway SSE Streaming
// ============================================================================

interface GatewayOptions {
  userContent: string;
  systemPrompts: string[];
  sessionKey: string;
  gatewayAuth?: string;
  gatewayPort: number;
  /** SSE 连接超时时间 (ms)，默认 30 秒 */
  timeoutMs?: number;
  log?: { info?: (msg: string) => void; error?: (msg: string) => void };
}

/** 默认 SSE 连接超时: 30 秒 */
const DEFAULT_SSE_TIMEOUT_MS = 30_000;

/** 单次 chunk 读取超时: 60 秒 (防止连接挂起) */
const DEFAULT_CHUNK_TIMEOUT_MS = 60_000;

/**
 * 带超时的读取单个 chunk
 * 防止连接挂起导致无限等待
 */
async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return Promise.race([
    reader.read(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`SSE chunk read timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

/**
 * 从 Gateway 流式获取 AI 响应
 */
async function* streamFromGateway(options: GatewayOptions): AsyncGenerator<string, void, unknown> {
  const {
    userContent,
    systemPrompts,
    sessionKey,
    gatewayAuth,
    gatewayPort,
    timeoutMs = DEFAULT_SSE_TIMEOUT_MS,
    log,
  } = options;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}/v1/chat/completions`;

  const messages: Array<{ role: string; content: string }> = [];
  for (const prompt of systemPrompts) {
    messages.push({ role: "system", content: prompt });
  }
  messages.push({ role: "user", content: userContent });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (gatewayAuth) {
    headers["Authorization"] = `Bearer ${gatewayAuth}`;
  }

  log?.info?.(`[DingTalk][Gateway] POST ${gatewayUrl}, session=${sessionKey}, messages=${messages.length}`);

  // 添加连接超时保护
  const controller = new AbortController();
  const connectionTimeout = setTimeout(() => {
    controller.abort();
    log?.error?.(`[DingTalk][Gateway] 连接超时 (${timeoutMs}ms)`);
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(gatewayUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "default",
        messages,
        stream: true,
        user: sessionKey,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(connectionTimeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Gateway connection timeout after ${timeoutMs}ms`);
    }
    throw err;
  }

  // 连接成功，清除连接超时（后续使用 chunk 读取超时）
  clearTimeout(connectionTimeout);

  log?.info?.(`[DingTalk][Gateway] 响应 status=${response.status}, ok=${response.ok}`);

  if (!response.ok || !response.body) {
    const errText = response.body ? await response.text() : "(no body)";
    log?.error?.(`[DingTalk][Gateway] 错误响应: ${errText}`);
    throw new Error(`Gateway error: ${response.status} - ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      // 使用带超时的 chunk 读取，防止连接挂起
      const { done, value } = await readWithTimeout(reader, DEFAULT_CHUNK_TIMEOUT_MS);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;

        try {
          const chunk = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // 忽略解析错误
        }
      }
    }
  } finally {
    // 确保释放 reader 资源
    reader.releaseLock();
  }
}

// ============================================================================
// 消息内容提取
// ============================================================================

function extractMessageContent(data: DingtalkRobotMessageEvent): { text: string; messageType: string } {
  const msgtype = data.msgtype || "text";
  switch (msgtype) {
    case "text":
      return { text: data.text?.content?.trim() || "", messageType: "text" };
    case "richText": {
      const parts = data.richText?.richTextList || [];
      const text = parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      return { text: text || "[富文本消息]", messageType: "richText" };
    }
    case "picture":
      return { text: "[图片]", messageType: "picture" };
    case "audio":
      return { text: "[语音消息]", messageType: "audio" };
    case "video":
      return { text: "[视频]", messageType: "video" };
    case "file":
      return { text: `[文件: ${data.file?.fileName || "文件"}]`, messageType: "file" };
    default:
      return { text: data.text?.content?.trim() || `[${msgtype}消息]`, messageType: msgtype };
  }
}

// ============================================================================
// Stream 消息处理
// ============================================================================

/**
 * 处理 Stream 模式的钉钉消息
 */
export async function handleStreamMessage(params: StreamMessageParams): Promise<void> {
  const { data, sessionWebhook, log, dingtalkConfig, gatewayPort = 18789 } = params;

  const content = extractMessageContent(data);
  if (!content.text) return;

  const isDirect = data.conversationType === "1";
  const senderId = data.senderStaffId || data.senderId;
  const senderName = data.senderNick || "Unknown";

  log?.info?.(`[DingTalk] 收到消息: from=${senderName} text="${content.text.slice(0, 50)}..."`);

  // ===== Session 管理 =====
  const streamConfig = dingtalkConfig.stream || {};
  const sessionTimeout = streamConfig.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT;
  const forceNewSession = isNewSessionCommand(content.text);

  // 如果是新会话命令，直接回复确认消息
  if (forceNewSession) {
    const { sessionKey } = getSessionKey(senderId, true, sessionTimeout, log);
    await sendDingtalkMessageViaWebhook(sessionWebhook, {
      msgtype: "text",
      text: { content: "✨ 已开启新会话，之前的对话已清空。" },
    });
    log?.info?.(`[DingTalk] 用户请求新会话: ${senderId}, newKey=${sessionKey}`);
    return;
  }

  // 获取或创建 session
  const { sessionKey, isNew } = getSessionKey(senderId, false, sessionTimeout, log);
  log?.info?.(`[DingTalk][Session] key=${sessionKey}, isNew=${isNew}`);

  // Gateway 认证
  const gatewayAuth = streamConfig.gatewayToken || streamConfig.gatewayPassword || "";

  // 构建 system prompts & 获取 oapi token
  const systemPrompts: string[] = [];
  let oapiToken: string | null = null;

  if (streamConfig.enableMediaUpload !== false) {
    systemPrompts.push(buildMediaSystemPrompt());
    oapiToken = await getOapiAccessToken(dingtalkConfig);
    log?.info?.(`[DingTalk][Media] oapiToken 获取${oapiToken ? "成功" : "失败"}`);
  }

  if (streamConfig.systemPrompt) {
    systemPrompts.push(streamConfig.systemPrompt);
  }

  // 是否启用 AI Card
  const enableAICard = streamConfig.enableAICard !== false;

  if (enableAICard) {
    // ===== AI Card 流式模式 =====
    const cardCtx: AICardContext = {
      conversationType: data.conversationType,
      conversationId: data.conversationId,
      senderStaffId: data.senderStaffId,
      senderId: data.senderId,
    };

    const card = await createAICard(dingtalkConfig, cardCtx, log);

    if (card) {
      log?.info?.(`[DingTalk] AI Card 创建成功: ${card.cardInstanceId}`);

      let accumulated = "";
      let lastUpdateTime = 0;
      const updateInterval = 300; // 最小更新间隔 ms

      try {
        for await (const chunk of streamFromGateway({
          userContent: content.text,
          systemPrompts,
          sessionKey,
          gatewayAuth,
          gatewayPort,
          log,
        })) {
          accumulated += chunk;

          // 节流更新
          const now = Date.now();
          if (now - lastUpdateTime >= updateInterval) {
            await streamAICard(card, accumulated, false, log);
            lastUpdateTime = now;
          }
        }

        // 后处理：上传本地图片
        accumulated = await processLocalImages(accumulated, oapiToken, log);

        // 完成
        await finishAICard(card, accumulated, log);
        log?.info?.(`[DingTalk] 流式响应完成，共 ${accumulated.length} 字符`);
      } catch (err) {
        log?.error?.(`[DingTalk] Gateway 调用失败: ${err}`);
        accumulated += `\n\n⚠️ 响应中断: ${err}`;
        try {
          await finishAICard(card, accumulated, log);
        } catch (finishErr) {
          log?.error?.(`[DingTalk] 错误恢复 finish 也失败: ${finishErr}`);
        }
      }
      return;
    }

    log?.warn?.(`[DingTalk] AI Card 创建失败，降级为普通消息`);
  }

  // ===== 降级：普通消息模式 =====
  let fullResponse = "";
  try {
    for await (const chunk of streamFromGateway({
      userContent: content.text,
      systemPrompts,
      sessionKey,
      gatewayAuth,
      gatewayPort,
      log,
    })) {
      fullResponse += chunk;
    }

    // 后处理：上传本地图片
    fullResponse = await processLocalImages(fullResponse, oapiToken, log);

    await sendDingtalkMessageViaWebhook(sessionWebhook, {
      msgtype: "text",
      text: { content: fullResponse || "（无响应）" },
    });
    log?.info?.(`[DingTalk] 普通消息回复完成，共 ${fullResponse.length} 字符`);
  } catch (err) {
    log?.error?.(`[DingTalk] Gateway 调用失败: ${err}`);
    await sendDingtalkMessageViaWebhook(sessionWebhook, {
      msgtype: "text",
      text: { content: `抱歉，处理请求时出错: ${err}` },
    });
  }
}

// ============================================================================
// Stream 客户端创建
// ============================================================================

export interface StreamClientContext {
  config: DingtalkChannelConfig;
  accountId: string;
  gatewayPort: number;
  cfg: unknown;
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  onStart?: () => void;
  onStop?: () => void;
}

/**
 * 创建 Stream 客户端
 */
export async function createStreamClient(ctx: StreamClientContext): Promise<{
  stop: () => void;
}> {
  const { config, accountId, gatewayPort, cfg, log } = ctx;

  const appKey = config.app?.appKey;
  const appSecret = config.app?.appSecret;

  if (!appKey || !appSecret) {
    throw new Error("钉钉 appKey 和 appSecret 必须配置");
  }

  log?.info?.(`[${accountId}] 启动钉钉 Stream 客户端...`);

  const client = new DWClient({
    clientId: appKey,
    clientSecret: appSecret,
    debug: config.app?.debug || false,
  });

  client.registerCallbackListener(TOPIC_ROBOT, async (res: { headers?: { messageId?: string }; data: string }) => {
    try {
      const messageId = res.headers?.messageId;
      log?.info?.(`[DingTalk] 收到 Stream 回调, messageId=${messageId}`);

      const data = JSON.parse(res.data) as DingtalkRobotMessageEvent & { sessionWebhook?: string };

      await handleStreamMessage({
        cfg,
        accountId,
        data,
        sessionWebhook: data.sessionWebhook || "",
        log,
        dingtalkConfig: config,
        gatewayPort,
      });

      if (messageId) {
        client.socketCallBackResponse(messageId, { success: true });
      }
    } catch (error) {
      log?.error?.(`[DingTalk] 处理消息异常: ${error}`);
      const messageId = res.headers?.messageId;
      if (messageId) {
        client.socketCallBackResponse(messageId, { success: false });
      }
    }
  });

  await client.connect();
  log?.info?.(`[${accountId}] 钉钉 Stream 客户端已连接`);
  ctx.onStart?.();

  let stopped = false;

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      log?.info?.(`[${accountId}] 钉钉 Stream 客户端已停止`);
      ctx.onStop?.();
    },
  };
}
