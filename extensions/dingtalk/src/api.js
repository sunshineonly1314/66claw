const TOKEN_TIMEOUT_MS = 1e4;
const SEND_TIMEOUT_MS = 15e3;
const WEBHOOK_RETRY_COUNT = 1;
const WEBHOOK_RETRY_DELAY_MS = 1e3;
let cachedToken = null;
let pendingTokenRequest = null;
async function getDingtalkAccessToken(appKey, appSecret) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 6e4) {
    return cachedToken.token;
  }
  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }
  pendingTokenRequest = fetchAccessToken(appKey, appSecret);
  try {
    return await pendingTokenRequest;
  } finally {
    pendingTokenRequest = null;
  }
}
async function fetchAccessToken(appKey, appSecret) {
  const response = await fetch("https://api.dingtalk.com/v1.0/oauth2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, appSecret }),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS)
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`\u83B7\u53D6\u9489\u9489 Token HTTP \u9519\u8BEF: ${response.status} ${errText}`);
  }
  const data = await response.json();
  if (!data.accessToken) {
    throw new Error(`\u83B7\u53D6\u9489\u9489 Token \u5931\u8D25: ${data.message || data.code || "unknown error"}`);
  }
  cachedToken = {
    token: data.accessToken,
    expiresAt: Date.now() + (data.expireIn ?? 7200) * 1e3 - 3e5
  };
  return data.accessToken;
}
async function sendDingtalkMessageViaWebhook(sessionWebhook, message) {
  let lastError;
  for (let attempt = 0; attempt <= WEBHOOK_RETRY_COUNT; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, WEBHOOK_RETRY_DELAY_MS));
      }
      const response = await fetch(sessionWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`\u53D1\u9001\u9489\u9489\u6D88\u606F\u5931\u8D25: ${response.status} ${text}`);
      }
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < WEBHOOK_RETRY_COUNT) {
        if (lastError.message.includes("\u53D1\u9001\u9489\u9489\u6D88\u606F\u5931\u8D25: 4")) {
          throw lastError;
        }
      }
    }
  }
  throw lastError ?? new Error("\u53D1\u9001\u9489\u9489\u6D88\u606F\u5931\u8D25: \u672A\u77E5\u9519\u8BEF");
}
async function sendDingtalkMessage(config, userIds, text, options) {
  const appKey = config.app?.appKey;
  const appSecret = config.app?.appSecret;
  const robotCode = config.app?.robotCode;
  if (!appKey || !appSecret) {
    throw new Error("\u9489\u9489 AppKey \u6216 AppSecret \u672A\u914D\u7F6E");
  }
  if (!robotCode) {
    throw new Error("\u9489\u9489 RobotCode \u672A\u914D\u7F6E (\u6279\u91CF\u53D1\u9001\u9700\u8981)");
  }
  const token = await getDingtalkAccessToken(appKey, appSecret);
  const msgType = options?.msgType ?? "text";
  let msgKey;
  let msgParam;
  if (msgType === "markdown") {
    msgKey = "sampleMarkdown";
    msgParam = JSON.stringify({
      title: options?.title ?? "\u6D88\u606F",
      text
    });
  } else {
    msgKey = "sampleText";
    msgParam = JSON.stringify({ content: text });
  }
  const response = await fetch("https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-acs-dingtalk-access-token": token
    },
    body: JSON.stringify({
      robotCode,
      userIds,
      msgKey,
      msgParam
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`\u53D1\u9001\u9489\u9489\u6D88\u606F HTTP \u9519\u8BEF: ${response.status} ${errText}`);
  }
  const data = await response.json();
  if (data.code) {
    throw new Error(`\u53D1\u9001\u9489\u9489\u6D88\u606F\u5931\u8D25: ${data.message || data.code}`);
  }
  return { processQueryKey: data.processQueryKey };
}
async function probeDingtalkConnection(config) {
  const appKey = config.app?.appKey;
  const appSecret = config.app?.appSecret;
  const robotCode = config.app?.robotCode;
  if (!appKey || !appSecret) {
    return { ok: false, error: "AppKey \u6216 AppSecret \u672A\u914D\u7F6E" };
  }
  try {
    await getDingtalkAccessToken(appKey, appSecret);
    return { ok: true, appKey, robotCode: robotCode ?? void 0 };
  } catch (err) {
    return { ok: false, error: String(err), appKey };
  }
}
function clearDingtalkTokenCache() {
  cachedToken = null;
}
export {
  clearDingtalkTokenCache,
  getDingtalkAccessToken,
  probeDingtalkConnection,
  sendDingtalkMessage,
  sendDingtalkMessageViaWebhook
};
