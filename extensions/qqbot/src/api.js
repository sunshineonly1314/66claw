const API_BASE_URL = "https://api.sgroup.qq.com";
const SANDBOX_API_BASE_URL = "https://sandbox.api.sgroup.qq.com";
let tokenCache = null;
function getApiBaseUrl(sandbox) {
  return sandbox ? SANDBOX_API_BASE_URL : API_BASE_URL;
}
async function getAccessToken(config) {
  const appId = config.app?.appId;
  const appSecret = config.app?.appSecret;
  if (!appId || !appSecret) {
    throw new Error("QQ Bot appId and appSecret are required");
  }
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }
  const response = await fetch("https://bots.qq.com/app/getAppAccessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      appId,
      clientSecret: appSecret
    })
  });
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1e3
  };
  return data.access_token;
}
async function sendC2CMessage(config, openId, content, msgId) {
  const token = await getAccessToken(config);
  const baseUrl = getApiBaseUrl(config.sandbox);
  const response = await fetch(`${baseUrl}/v2/users/${openId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `QQBot ${token}`
    },
    body: JSON.stringify({
      content,
      msg_type: 0,
      // 文本消息
      msg_id: msgId
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send C2C message: ${response.status} ${error}`);
  }
  return await response.json();
}
async function sendGroupMessage(config, groupOpenId, content, msgId) {
  const token = await getAccessToken(config);
  const baseUrl = getApiBaseUrl(config.sandbox);
  const response = await fetch(`${baseUrl}/v2/groups/${groupOpenId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `QQBot ${token}`
    },
    body: JSON.stringify({
      content,
      msg_type: 0,
      // 文本消息
      msg_id: msgId
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send group message: ${response.status} ${error}`);
  }
  return await response.json();
}
async function sendChannelMessage(config, channelId, content, msgId) {
  const token = await getAccessToken(config);
  const baseUrl = getApiBaseUrl(config.sandbox);
  const response = await fetch(`${baseUrl}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `QQBot ${token}`
    },
    body: JSON.stringify({
      content,
      msg_id: msgId
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send channel message: ${response.status} ${error}`);
  }
  return await response.json();
}
async function sendQqbotMessage(config, target, content, msgId) {
  const [type, id] = target.split(":");
  switch (type) {
    case "c2c":
    case "user":
      await sendC2CMessage(config, id, content, msgId);
      break;
    case "group":
      await sendGroupMessage(config, id, content, msgId);
      break;
    case "channel":
      await sendChannelMessage(config, id, content, msgId);
      break;
    default:
      await sendC2CMessage(config, target, content, msgId);
  }
}
async function probeQqbotConnection(config) {
  const startTime = Date.now();
  try {
    const appId = config.app?.appId;
    const appSecret = config.app?.appSecret;
    if (!appId || !appSecret) {
      return {
        ok: false,
        error: "Missing appId or appSecret",
        elapsedMs: Date.now() - startTime
      };
    }
    const token = await getAccessToken(config);
    const baseUrl = getApiBaseUrl(config.sandbox);
    const response = await fetch(`${baseUrl}/users/@me`, {
      headers: {
        Authorization: `QQBot ${token}`
      }
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `API request failed: ${response.status}`,
        appId,
        elapsedMs: Date.now() - startTime
      };
    }
    const botInfo = await response.json();
    return {
      ok: true,
      appId,
      botInfo: {
        id: botInfo.id,
        username: botInfo.username
      },
      elapsedMs: Date.now() - startTime
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startTime
    };
  }
}
function clearTokenCache() {
  tokenCache = null;
}
export {
  clearTokenCache,
  getAccessToken,
  probeQqbotConnection,
  sendC2CMessage,
  sendChannelMessage,
  sendGroupMessage,
  sendQqbotMessage
};
