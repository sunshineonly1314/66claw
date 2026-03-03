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
import { archiveInboundMedia, startArchivalCleanup } from "./media-archival.js";
import {
  downloadDingTalkFile,
  downloadRichTextImages,
  extractMediaFromMessage,
  extractRichTextImageCodes,
} from "./media-download.js";
import { buildMediaSystemPrompt, getOapiAccessToken, processLocalImages } from "./media-upload.js";
import { getDingtalkRuntime } from "./runtime.js";
import { startScheduler } from "./scheduler.js";
import { DEFAULT_SESSION_TIMEOUT, getSessionKey, isNewSessionCommand } from "./session-manager.js";
import type {
  AICardContext,
  DingtalkChannelConfig,
  DingtalkRobotMessageEvent,
  MediaDownloadResult,
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

/** 单次 chunk 读取超时: 180 秒 (Opus 等大模型 thinking 阶段可能长时间无 chunk) */
const DEFAULT_CHUNK_TIMEOUT_MS = 180_000;

/**
 * 带超时的读取单个 chunk
 * 防止连接挂起导致无限等待
 */
async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
) {
  let timer: ReturnType<typeof setTimeout>;
  try {
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`SSE chunk read timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timer!);
  }
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

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
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
    // 确保释放 reader 资源并关闭流
    try {
      reader.releaseLock();
    } catch {
      // reader 已释放
    }
    try {
      await (response.body as ReadableStream<Uint8Array>).cancel();
    } catch {
      // 流已关闭
    }
  }
}

// ============================================================================
// Markdown 表格转换
// ============================================================================

/**
 * 将 Markdown 表格转换为钉钉兼容格式
 * 钉钉 Markdown 不支持标准表格语法，默认转为列表格式
 */
function applyMarkdownTableConversion(text: string, config: DingtalkChannelConfig): string {
  const tableMode = config.markdown?.tables ?? "bullets";
  if (tableMode === "off") return text;

  try {
    const runtime = getDingtalkRuntime();
    return runtime.channel.text.convertMarkdownTables(text, tableMode);
  } catch {
    // runtime 未就绪时跳过转换
    return text;
  }
}

// ============================================================================
// 消息内容提取
// ============================================================================

interface ExtractedContent {
  text: string;
  messageType: string;
  mediaFiles?: MediaDownloadResult[];
}

async function extractMessageContent(
  data: DingtalkRobotMessageEvent,
  config: DingtalkChannelConfig,
  log?: { info?: (msg: string) => void; warn?: (msg: string) => void; error?: (msg: string) => void },
): Promise<ExtractedContent> {
  const msgtype = data.msgtype || "text";
  const enableDownload = config.media?.enableDownload !== false;

  switch (msgtype) {
    case "text":
      return { text: data.text?.content?.trim() || "", messageType: "text" };

    case "richText": {
      const parts = data.richText?.richTextList || [];
      let text = parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");

      // 下载富文本中的图片
      if (enableDownload) {
        const imageCodes = extractRichTextImageCodes(data);
        if (imageCodes.length > 0) {
          log?.info?.(`[DingTalk] 富文本包含 ${imageCodes.length} 张图片，开始下载...`);
          const downloaded = await downloadRichTextImages(config, imageCodes, log);
          if (downloaded.length > 0) {
            const imageRefs = downloaded.map((d) => `![图片](file://${d.filePath})`).join("\n");
            text = text ? `${text}\n${imageRefs}` : imageRefs;
            return { text: text || "[富文本消息]", messageType: "richText", mediaFiles: downloaded };
          }
        }
      }

      return { text: text || "[富文本消息]", messageType: "richText" };
    }

    case "picture": {
      if (enableDownload) {
        const media = extractMediaFromMessage(data);
        if (media.length > 0) {
          const result = await downloadDingTalkFile(config, media[0].downloadCode, "picture", { log });
          if (result) {
            return {
              text: `![图片](file://${result.filePath})`,
              messageType: "picture",
              mediaFiles: [result],
            };
          }
        }
      }
      return { text: "[图片]", messageType: "picture" };
    }

    case "audio": {
      const recognition = data.audio?.recognition;
      let text = recognition ? `[语音消息] 识别内容: ${recognition}` : "[语音消息]";

      if (enableDownload) {
        const media = extractMediaFromMessage(data);
        if (media.length > 0) {
          const result = await downloadDingTalkFile(config, media[0].downloadCode, "audio", { log });
          if (result) {
            text += ` (文件: ${result.filePath})`;
            return { text, messageType: "audio", mediaFiles: [result] };
          }
        }
      }
      return { text, messageType: "audio" };
    }

    case "video": {
      if (enableDownload) {
        const media = extractMediaFromMessage(data);
        if (media.length > 0) {
          const result = await downloadDingTalkFile(config, media[0].downloadCode, "video", { log });
          if (result) {
            return {
              text: `[视频] (文件: ${result.filePath})`,
              messageType: "video",
              mediaFiles: [result],
            };
          }
        }
      }
      return { text: "[视频]", messageType: "video" };
    }

    case "file": {
      const fileName = data.file?.fileName || "文件";
      if (enableDownload) {
        const media = extractMediaFromMessage(data);
        if (media.length > 0) {
          const result = await downloadDingTalkFile(config, media[0].downloadCode, "file", {
            fileName,
            log,
          });
          if (result) {
            return {
              text: `[文件: ${fileName}] (已下载: ${result.filePath})`,
              messageType: "file",
              mediaFiles: [result],
            };
          }
        }
      }
      return { text: `[文件: ${fileName}]`, messageType: "file" };
    }

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

  if (!sessionWebhook) {
    log?.warn?.(`[DingTalk] 消息缺少 sessionWebhook，无法回复 (sender=${data.senderNick})`);
  }

  const content = await extractMessageContent(data, dingtalkConfig, log);
  if (!content.text) return;

  const isDirect = data.conversationType === "1";
  const isGroupChat = data.conversationType === "2";
  const senderId = data.senderStaffId || data.senderId;
  const senderName = data.senderNick || "Unknown";

  log?.info?.(`[DingTalk] 收到消息: from=${senderName} len=${content.text.length} type=${content.messageType ?? "text"}`);

  // ========================================
  // 群聊 requireMention 检查 (P1-5 修复)
  // ========================================
  if (isGroupChat) {
    const conversationId = data.conversationId;
    const groupConfig = dingtalkConfig.groups?.[conversationId];
    // 优先使用群维度配置，其次默认 true (群聊必须 @机器人)
    const requireMention = groupConfig?.requireMention ?? true;

    if (requireMention && !data.isAtMe) {
      log?.info?.(`[DingTalk] 群聊消息未 @机器人 (requireMention=true, isAtMe=${data.isAtMe})，跳过`);
      return;
    }
  }

  // ===== 媒体归档 =====
  if (content.mediaFiles?.length && dingtalkConfig.media?.archival?.enabled) {
    for (const file of content.mediaFiles) {
      archiveInboundMedia(dingtalkConfig, file, {
        senderId,
        senderNick: senderName,
        conversationId: data.conversationId,
        msgId: data.msgId,
      }, log).catch((err) => {
        log?.warn?.(`[DingTalk] 媒体归档失败 (非阻塞): ${err}`);
      });
    }
  }

  // ===== Session 管理 =====
  const streamConfig = dingtalkConfig.stream || {};
  const sessionTimeout = streamConfig.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT;
  const forceNewSession = isNewSessionCommand(content.text);

  // 如果是新会话命令，直接回复确认消息
  if (forceNewSession) {
    const { sessionKey } = getSessionKey(senderId, true, sessionTimeout, log);
    if (sessionWebhook) {
      await sendDingtalkMessageViaWebhook(sessionWebhook, {
        msgtype: "text",
        text: { content: "✨ 已开启新会话，之前的对话已清空。" },
      });
    }
    log?.info?.(`[DingTalk] 用户请求新会话: ${senderId}, newKey=${sessionKey}`);
    return;
  }

  // 获取或创建 session
  const { sessionKey, isNew } = getSessionKey(senderId, false, sessionTimeout, log);
  log?.info?.(`[DingTalk][Session] key=${sessionKey}, isNew=${isNew}`);

  // Gateway 认证
  const gatewayAuth = streamConfig.gatewayToken || streamConfig.gatewayPassword || process.env.OPENCLAWCN_GATEWAY_TOKEN || process.env.OPENCLAWCN_GATEWAY_PASSWORD || "";

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

        // 后处理：上传本地图片 + Markdown 表格转换
        accumulated = await processLocalImages(accumulated, oapiToken, log);
        accumulated = applyMarkdownTableConversion(accumulated, dingtalkConfig);

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

    if (sessionWebhook) {
      // 后处理：上传本地图片 + Markdown 表格转换（仅在能发送时才处理，避免浪费 GPU）
      fullResponse = await processLocalImages(fullResponse, oapiToken, log);
      fullResponse = applyMarkdownTableConversion(fullResponse, dingtalkConfig);

      await sendDingtalkMessageViaWebhook(sessionWebhook, {
        msgtype: "text",
        text: { content: fullResponse || "（无响应）" },
      });
      log?.info?.(`[DingTalk] 普通消息回复完成，共 ${fullResponse.length} 字符`);
    } else {
      log?.warn?.(`[DingTalk] 无 sessionWebhook，跳过图片处理和消息回复 (${fullResponse.length} 字符)`);
    }
  } catch (err) {
    log?.error?.(`[DingTalk] Gateway 调用失败: ${err}`);
    if (sessionWebhook) {
      await sendDingtalkMessageViaWebhook(sessionWebhook, {
        msgtype: "text",
        text: { content: `抱歉，处理请求时出错: ${err}` },
      });
    }
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

  // dingtalk-stream SDK 已内置自动重连机制
  // 文档: https://github.com/open-dingtalk/dingtalk-stream-sdk-nodejs
  const client = new DWClient({
    clientId: appKey,
    clientSecret: appSecret,
    debug: config.app?.debug || false,
    // 注意: SDK 默认启用 autoReconnect，这里显式声明以提高可读性
    // 内置重连策略: 指数退避 (1s, 2s, 4s, ... 最大 60s)
  });

  client.registerCallbackListener(TOPIC_ROBOT, async (res: { headers?: { messageId?: string }; data: string }) => {
    try {
      const messageId = res.headers?.messageId;
      log?.info?.(`[DingTalk] 收到 Stream 回调, messageId=${messageId}`);

      let data: DingtalkRobotMessageEvent & { sessionWebhook?: string };
      try {
        data = JSON.parse(res.data);
      } catch (parseErr) {
        log?.error?.(`[DingTalk] Stream 回调数据解析失败: ${parseErr}, data=${res.data?.slice(0, 200)}`);
        throw parseErr;
      }

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

  // ===== 连接熔断器 =====
  // 防止 SDK 无限重连（如 system busy 1000040345 错误导致 260+ 次重试）
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 20;
  let circuitBreakerOpen = false;
  let circuitBreakerResetTimer: ReturnType<typeof setTimeout> | undefined;
  let circuitBreakerAttempt = 0;

  /**
   * 计算指数退避时间 (带 ±20% 随机抖动)
   * base × 2^attempt, 限制在 [1s, 60s] 范围
   */
  function calculateBackoff(attempt: number, baseMs: number = 1000): number {
    const exponential = baseMs * Math.pow(2, attempt);
    const clamped = Math.min(Math.max(exponential, 1000), 60_000);
    const jitter = clamped * (0.8 + Math.random() * 0.4); // ±20%
    return Math.round(jitter);
  }

  // 监听连接事件（用于观察重连行为）
  client.on('connect', () => {
    // 连接成功，重置熔断状态
    consecutiveErrors = 0;
    circuitBreakerOpen = false;
    circuitBreakerAttempt = 0;
    log?.info?.(`[${accountId}] 钉钉 Stream 连接已建立`);
  });

  client.on('disconnect', () => {
    log?.warn?.(`[${accountId}] 钉钉 Stream 连接已断开，SDK 将自动重连...`);
  });

  client.on('error', (error: Error) => {
    consecutiveErrors++;
    const errorMsg = error?.message ?? String(error);
    log?.error?.(`[${accountId}] 钉钉 Stream 错误 (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${errorMsg}`);

    // 识别服务端拒绝类错误
    if (errorMsg.includes('1000040345') || errorMsg.includes('system busy')) {
      log?.warn?.(`[${accountId}] 钉钉服务端繁忙，建议稍后重试`);
    }

    // PingInterval 未定义防护
    if (errorMsg.includes('PingInterval') || errorMsg.includes("Cannot read properties of undefined")) {
      log?.warn?.(`[${accountId}] SDK 内部状态异常，可能需要重启`);
    }

    // 熔断：连续错误过多时停止重连，避免无限刷日志
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && !circuitBreakerOpen) {
      circuitBreakerOpen = true;
      const backoffMs = calculateBackoff(circuitBreakerAttempt);
      circuitBreakerAttempt++;
      log?.error?.(
        `[${accountId}] 钉钉连接熔断：连续 ${consecutiveErrors} 次失败，暂停 ${(backoffMs / 1000).toFixed(1)}s 后自动恢复 (第 ${circuitBreakerAttempt} 次熔断)`,
      );
      try {
        client.disconnect();
      } catch {
        /* ignore disconnect errors during circuit break */
      }

      circuitBreakerResetTimer = setTimeout(() => {
        circuitBreakerOpen = false;
        consecutiveErrors = 0;
        log?.info?.(`[${accountId}] 钉钉连接熔断恢复，尝试重新连接... (退避 ${(backoffMs / 1000).toFixed(1)}s)`);
        client.connect().catch((err: unknown) => {
          log?.error?.(`[${accountId}] 熔断恢复后重连失败: ${err instanceof Error ? err.message : String(err)}`);
        });
      }, backoffMs);
    }
  });

  // 启动归档清理定时器和调度器放在 connect 之后，避免 connect 失败时泄漏定时器
  await client.connect();

  const archivalCleanup = config.media?.archival?.enabled
    ? startArchivalCleanup(config, log)
    : null;

  const scheduler = config.scheduledTasks?.length
    ? startScheduler(config, log)
    : null;
  log?.info?.(`[${accountId}] 钉钉 Stream 客户端已连接`);
  ctx.onStart?.();

  let stopped = false;

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      log?.info?.(`[${accountId}] 钉钉 Stream 客户端正在停止...`);

      // 停止归档清理定时器和定时消息调度器
      archivalCleanup?.stop();
      scheduler?.stop();

      // 清理熔断定时器
      if (circuitBreakerResetTimer) {
        clearTimeout(circuitBreakerResetTimer);
        circuitBreakerResetTimer = undefined;
      }

      try {
        // 显式断开连接，防止 SDK 继续尝试重连
        client.disconnect();
        log?.info?.(`[${accountId}] 钉钉 Stream 客户端已停止`);
      } catch (error) {
        log?.error?.(`[${accountId}] 停止 Stream 客户端时出错: ${error}`);
      }

      ctx.onStop?.();
    },
  };
}
