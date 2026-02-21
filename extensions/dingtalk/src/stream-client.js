import { DWClient, TOPIC_ROBOT } from "dingtalk-stream";
import { createAICard, finishAICard, streamAICard } from "./ai-card.js";
import { sendDingtalkMessageViaWebhook } from "./api.js";
import { buildMediaSystemPrompt, getOapiAccessToken, processLocalImages } from "./media-upload.js";
import { DEFAULT_SESSION_TIMEOUT, getSessionKey, isNewSessionCommand } from "./session-manager.js";
const DEFAULT_SSE_TIMEOUT_MS = 3e4;
const DEFAULT_CHUNK_TIMEOUT_MS = 6e4;
async function readWithTimeout(reader, timeoutMs) {
  let timer;
  const result = await Promise.race([
    reader.read(),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`SSE chunk read timeout after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
  clearTimeout(timer);
  return result;
}
async function* streamFromGateway(options) {
  const {
    userContent,
    systemPrompts,
    sessionKey,
    gatewayAuth,
    gatewayPort,
    timeoutMs = DEFAULT_SSE_TIMEOUT_MS,
    log
  } = options;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}/v1/chat/completions`;
  const messages = [];
  for (const prompt of systemPrompts) {
    messages.push({ role: "system", content: prompt });
  }
  messages.push({ role: "user", content: userContent });
  const headers = { "Content-Type": "application/json" };
  if (gatewayAuth) {
    headers["Authorization"] = `Bearer ${gatewayAuth}`;
  }
  log?.info?.(`[DingTalk][Gateway] POST ${gatewayUrl}, session=${sessionKey}, messages=${messages.length}`);
  const controller = new AbortController();
  const connectionTimeout = setTimeout(() => {
    controller.abort();
    log?.error?.(`[DingTalk][Gateway] \u8FDE\u63A5\u8D85\u65F6 (${timeoutMs}ms)`);
  }, timeoutMs);
  let response;
  try {
    response = await fetch(gatewayUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "default",
        messages,
        stream: true,
        user: sessionKey
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(connectionTimeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Gateway connection timeout after ${timeoutMs}ms`);
    }
    throw err;
  }
  clearTimeout(connectionTimeout);
  log?.info?.(`[DingTalk][Gateway] \u54CD\u5E94 status=${response.status}, ok=${response.ok}`);
  if (!response.ok || !response.body) {
    const errText = response.body ? await response.text() : "(no body)";
    log?.error?.(`[DingTalk][Gateway] \u9519\u8BEF\u54CD\u5E94: ${errText}`);
    throw new Error(`Gateway error: ${response.status} - ${errText}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
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
          const chunk = JSON.parse(data);
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
    }
    try {
      await response.body.cancel();
    } catch {
    }
  }
}
function extractMessageContent(data) {
  const msgtype = data.msgtype || "text";
  switch (msgtype) {
    case "text":
      return { text: data.text?.content?.trim() || "", messageType: "text" };
    case "richText": {
      const parts = data.richText?.richTextList || [];
      const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("");
      return { text: text || "[\u5BCC\u6587\u672C\u6D88\u606F]", messageType: "richText" };
    }
    case "picture":
      return { text: "[\u56FE\u7247]", messageType: "picture" };
    case "audio":
      return { text: "[\u8BED\u97F3\u6D88\u606F]", messageType: "audio" };
    case "video":
      return { text: "[\u89C6\u9891]", messageType: "video" };
    case "file":
      return { text: `[\u6587\u4EF6: ${data.file?.fileName || "\u6587\u4EF6"}]`, messageType: "file" };
    default:
      return { text: data.text?.content?.trim() || `[${msgtype}\u6D88\u606F]`, messageType: msgtype };
  }
}
async function handleStreamMessage(params) {
  const { data, sessionWebhook, log, dingtalkConfig, gatewayPort = Number(process.env.OPENCLAWCN_GATEWAY_PORT) || 18789 } = params;
  if (!sessionWebhook) {
    log?.warn?.(`[DingTalk] \u6D88\u606F\u7F3A\u5C11 sessionWebhook\uFF0C\u65E0\u6CD5\u56DE\u590D (sender=${data.senderNick})`);
  }
  const content = extractMessageContent(data);
  if (!content.text) return;
  const isDirect = data.conversationType === "1";
  const senderId = data.senderStaffId || data.senderId;
  const senderName = data.senderNick || "Unknown";
  log?.info?.(`[DingTalk] \u6536\u5230\u6D88\u606F: from=${senderName} text="${content.text.slice(0, 50)}..."`);
  const streamConfig = dingtalkConfig.stream || {};
  const sessionTimeout = streamConfig.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT;
  const forceNewSession = isNewSessionCommand(content.text);
  if (forceNewSession) {
    const { sessionKey: sessionKey2 } = getSessionKey(senderId, true, sessionTimeout, log);
    if (sessionWebhook) {
      await sendDingtalkMessageViaWebhook(sessionWebhook, {
        msgtype: "text",
        text: { content: "\u2728 \u5DF2\u5F00\u542F\u65B0\u4F1A\u8BDD\uFF0C\u4E4B\u524D\u7684\u5BF9\u8BDD\u5DF2\u6E05\u7A7A\u3002" }
      });
    }
    log?.info?.(`[DingTalk] \u7528\u6237\u8BF7\u6C42\u65B0\u4F1A\u8BDD: ${senderId}, newKey=${sessionKey2}`);
    return;
  }
  const { sessionKey, isNew } = getSessionKey(senderId, false, sessionTimeout, log);
  log?.info?.(`[DingTalk][Session] key=${sessionKey}, isNew=${isNew}`);
  const gatewayAuth = streamConfig.gatewayToken || streamConfig.gatewayPassword || process.env.OPENCLAWCN_GATEWAY_TOKEN || process.env.OPENCLAWCN_GATEWAY_PASSWORD || "";
  const systemPrompts = [];
  let oapiToken = null;
  if (streamConfig.enableMediaUpload !== false) {
    systemPrompts.push(buildMediaSystemPrompt());
    oapiToken = await getOapiAccessToken(dingtalkConfig);
    log?.info?.(`[DingTalk][Media] oapiToken \u83B7\u53D6${oapiToken ? "\u6210\u529F" : "\u5931\u8D25"}`);
  }
  if (streamConfig.systemPrompt) {
    systemPrompts.push(streamConfig.systemPrompt);
  }
  const enableAICard = streamConfig.enableAICard !== false;
  if (enableAICard) {
    const cardCtx = {
      conversationType: data.conversationType,
      conversationId: data.conversationId,
      senderStaffId: data.senderStaffId,
      senderId: data.senderId
    };
    const card = await createAICard(dingtalkConfig, cardCtx, log);
    if (card) {
      log?.info?.(`[DingTalk] AI Card \u521B\u5EFA\u6210\u529F: ${card.cardInstanceId}`);
      let accumulated = "";
      let lastUpdateTime = 0;
      const updateInterval = 300;
      try {
        for await (const chunk of streamFromGateway({
          userContent: content.text,
          systemPrompts,
          sessionKey,
          gatewayAuth,
          gatewayPort,
          log
        })) {
          accumulated += chunk;
          const now = Date.now();
          if (now - lastUpdateTime >= updateInterval) {
            await streamAICard(card, accumulated, false, log);
            lastUpdateTime = now;
          }
        }
        accumulated = await processLocalImages(accumulated, oapiToken, log);
        await finishAICard(card, accumulated, log);
        log?.info?.(`[DingTalk] \u6D41\u5F0F\u54CD\u5E94\u5B8C\u6210\uFF0C\u5171 ${accumulated.length} \u5B57\u7B26`);
      } catch (err) {
        log?.error?.(`[DingTalk] Gateway \u8C03\u7528\u5931\u8D25: ${err}`);
        accumulated += `

\u26A0\uFE0F \u54CD\u5E94\u4E2D\u65AD: ${err}`;
        try {
          await finishAICard(card, accumulated, log);
        } catch (finishErr) {
          log?.error?.(`[DingTalk] \u9519\u8BEF\u6062\u590D finish \u4E5F\u5931\u8D25: ${finishErr}`);
        }
      }
      return;
    }
    log?.warn?.(`[DingTalk] AI Card \u521B\u5EFA\u5931\u8D25\uFF0C\u964D\u7EA7\u4E3A\u666E\u901A\u6D88\u606F`);
  }
  let fullResponse = "";
  try {
    for await (const chunk of streamFromGateway({
      userContent: content.text,
      systemPrompts,
      sessionKey,
      gatewayAuth,
      gatewayPort,
      log
    })) {
      fullResponse += chunk;
    }
    fullResponse = await processLocalImages(fullResponse, oapiToken, log);
    if (sessionWebhook) {
      await sendDingtalkMessageViaWebhook(sessionWebhook, {
        msgtype: "text",
        text: { content: fullResponse || "\uFF08\u65E0\u54CD\u5E94\uFF09" }
      });
      log?.info?.(`[DingTalk] \u666E\u901A\u6D88\u606F\u56DE\u590D\u5B8C\u6210\uFF0C\u5171 ${fullResponse.length} \u5B57\u7B26`);
    } else {
      log?.warn?.(`[DingTalk] \u65E0 sessionWebhook\uFF0C\u65E0\u6CD5\u53D1\u9001\u666E\u901A\u6D88\u606F\u56DE\u590D (${fullResponse.length} \u5B57\u7B26)`);
    }
  } catch (err) {
    log?.error?.(`[DingTalk] Gateway \u8C03\u7528\u5931\u8D25: ${err}`);
    if (sessionWebhook) {
      await sendDingtalkMessageViaWebhook(sessionWebhook, {
        msgtype: "text",
        text: { content: `\u62B1\u6B49\uFF0C\u5904\u7406\u8BF7\u6C42\u65F6\u51FA\u9519: ${err}` }
      });
    }
  }
}
async function createStreamClient(ctx) {
  const { config, accountId, gatewayPort, cfg, log } = ctx;
  const appKey = config.app?.appKey;
  const appSecret = config.app?.appSecret;
  if (!appKey || !appSecret) {
    throw new Error("\u9489\u9489 appKey \u548C appSecret \u5FC5\u987B\u914D\u7F6E");
  }
  log?.info?.(`[${accountId}] \u542F\u52A8\u9489\u9489 Stream \u5BA2\u6237\u7AEF...`);
  const client = new DWClient({
    clientId: appKey,
    clientSecret: appSecret,
    debug: config.app?.debug || false
    // 注意: SDK 默认启用 autoReconnect，这里显式声明以提高可读性
    // 内置重连策略: 指数退避 (1s, 2s, 4s, ... 最大 60s)
  });
  client.registerCallbackListener(TOPIC_ROBOT, async (res) => {
    try {
      const messageId = res.headers?.messageId;
      log?.info?.(`[DingTalk] \u6536\u5230 Stream \u56DE\u8C03, messageId=${messageId}`);
      let data;
      try {
        data = JSON.parse(res.data);
      } catch (parseErr) {
        log?.error?.(`[DingTalk] Stream \u56DE\u8C03\u6570\u636E\u89E3\u6790\u5931\u8D25: ${parseErr}, data=${res.data?.slice(0, 200)}`);
        throw parseErr;
      }
      await handleStreamMessage({
        cfg,
        accountId,
        data,
        sessionWebhook: data.sessionWebhook || "",
        log,
        dingtalkConfig: config,
        gatewayPort
      });
      if (messageId) {
        client.socketCallBackResponse(messageId, { success: true });
      }
    } catch (error) {
      log?.error?.(`[DingTalk] \u5904\u7406\u6D88\u606F\u5F02\u5E38: ${error}`);
      const messageId = res.headers?.messageId;
      if (messageId) {
        client.socketCallBackResponse(messageId, { success: false });
      }
    }
  });
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 20;
  let circuitBreakerOpen = false;
  let circuitBreakerResetTimer;
  const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1e3;
  client.on("connect", () => {
    consecutiveErrors = 0;
    circuitBreakerOpen = false;
    log?.info?.(`[${accountId}] \u9489\u9489 Stream \u8FDE\u63A5\u5DF2\u5EFA\u7ACB`);
  });
  client.on("disconnect", () => {
    log?.warn?.(`[${accountId}] \u9489\u9489 Stream \u8FDE\u63A5\u5DF2\u65AD\u5F00\uFF0CSDK \u5C06\u81EA\u52A8\u91CD\u8FDE...`);
  });
  client.on("error", (error) => {
    consecutiveErrors++;
    const errorMsg = error?.message ?? String(error);
    log?.error?.(`[${accountId}] \u9489\u9489 Stream \u9519\u8BEF (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${errorMsg}`);
    if (errorMsg.includes("1000040345") || errorMsg.includes("system busy")) {
      log?.warn?.(`[${accountId}] \u9489\u9489\u670D\u52A1\u7AEF\u7E41\u5FD9\uFF0C\u5EFA\u8BAE\u7A0D\u540E\u91CD\u8BD5`);
    }
    if (errorMsg.includes("PingInterval") || errorMsg.includes("Cannot read properties of undefined")) {
      log?.warn?.(`[${accountId}] SDK \u5185\u90E8\u72B6\u6001\u5F02\u5E38\uFF0C\u53EF\u80FD\u9700\u8981\u91CD\u542F`);
    }
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && !circuitBreakerOpen) {
      circuitBreakerOpen = true;
      log?.error?.(
        `[${accountId}] \u9489\u9489\u8FDE\u63A5\u7194\u65AD\uFF1A\u8FDE\u7EED ${consecutiveErrors} \u6B21\u5931\u8D25\uFF0C\u6682\u505C ${CIRCUIT_BREAKER_COOLDOWN_MS / 1e3}s \u540E\u81EA\u52A8\u6062\u590D`
      );
      try {
        client.disconnect();
      } catch {
      }
      circuitBreakerResetTimer = setTimeout(() => {
        circuitBreakerOpen = false;
        consecutiveErrors = 0;
        log?.info?.(`[${accountId}] \u9489\u9489\u8FDE\u63A5\u7194\u65AD\u6062\u590D\uFF0C\u5C1D\u8BD5\u91CD\u65B0\u8FDE\u63A5...`);
        client.connect().catch((err) => {
          log?.error?.(`[${accountId}] \u7194\u65AD\u6062\u590D\u540E\u91CD\u8FDE\u5931\u8D25: ${err instanceof Error ? err.message : String(err)}`);
        });
      }, CIRCUIT_BREAKER_COOLDOWN_MS);
    }
  });
  await client.connect();
  log?.info?.(`[${accountId}] \u9489\u9489 Stream \u5BA2\u6237\u7AEF\u5DF2\u8FDE\u63A5`);
  ctx.onStart?.();
  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      log?.info?.(`[${accountId}] \u9489\u9489 Stream \u5BA2\u6237\u7AEF\u6B63\u5728\u505C\u6B62...`);
      if (circuitBreakerResetTimer) {
        clearTimeout(circuitBreakerResetTimer);
        circuitBreakerResetTimer = void 0;
      }
      try {
        client.disconnect();
        log?.info?.(`[${accountId}] \u9489\u9489 Stream \u5BA2\u6237\u7AEF\u5DF2\u505C\u6B62`);
      } catch (error) {
        log?.error?.(`[${accountId}] \u505C\u6B62 Stream \u5BA2\u6237\u7AEF\u65F6\u51FA\u9519: ${error}`);
      }
      ctx.onStop?.();
    }
  };
}
export {
  createStreamClient,
  handleStreamMessage
};
