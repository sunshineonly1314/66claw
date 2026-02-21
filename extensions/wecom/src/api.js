const tokenCache = /* @__PURE__ */ new Map();
async function getWecomAccessToken(corpId, agentSecret) {
  const cacheKey = `${corpId}:${agentSecret.slice(0, 8)}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 6e4) {
    return cached.token;
  }
  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
  url.searchParams.set("corpid", corpId);
  url.searchParams.set("corpsecret", agentSecret);
  const response = await fetch(url.toString(), {
    method: "GET"
  });
  const data = await response.json();
  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(`\u83B7\u53D6\u4F01\u4E1A\u5FAE\u4FE1 Token \u5931\u8D25: ${data.errmsg || `errcode=${data.errcode}`}`);
  }
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1e3 - 3e5
  });
  return data.access_token;
}
async function sendWecomMessage(config, toUser, text, options) {
  const corpId = config.app?.corpId;
  const agentSecret = config.app?.agentSecret;
  const agentId = config.app?.agentId;
  if (!corpId || !agentSecret) {
    throw new Error("\u4F01\u4E1A\u5FAE\u4FE1 CorpID \u6216 AgentSecret \u672A\u914D\u7F6E");
  }
  if (!agentId) {
    throw new Error("\u4F01\u4E1A\u5FAE\u4FE1 AgentId \u672A\u914D\u7F6E");
  }
  const token = await getWecomAccessToken(corpId, agentSecret);
  const msgType = options?.msgType ?? "text";
  let message;
  if (msgType === "markdown") {
    message = {
      msgtype: "markdown",
      agentid: agentId,
      touser: toUser,
      toparty: options?.toParty,
      totag: options?.toTag,
      markdown: { content: text },
      enable_duplicate_check: 0
    };
  } else {
    message = {
      msgtype: "text",
      agentid: agentId,
      touser: toUser,
      toparty: options?.toParty,
      totag: options?.toTag,
      text: { content: text },
      enable_duplicate_check: 0
    };
  }
  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/message/send");
  url.searchParams.set("access_token", token);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    const details = [];
    if (data.invaliduser) details.push(`invaliduser=${data.invaliduser}`);
    if (data.invalidparty) details.push(`invalidparty=${data.invalidparty}`);
    if (data.invalidtag) details.push(`invalidtag=${data.invalidtag}`);
    if (data.unlicenseduser) details.push(`unlicenseduser=${data.unlicenseduser}`);
    const detailStr = details.length > 0 ? ` (${details.join(", ")})` : "";
    throw new Error(`\u53D1\u9001\u4F01\u4E1A\u5FAE\u4FE1\u6D88\u606F\u5931\u8D25: ${data.errmsg || `errcode=${data.errcode}`}${detailStr}`);
  }
  return { msgid: data.msgid };
}
async function sendWecomTemplateCard(config, toUser, card) {
  const corpId = config.app?.corpId;
  const agentSecret = config.app?.agentSecret;
  const agentId = config.app?.agentId;
  if (!corpId || !agentSecret || !agentId) {
    throw new Error("\u4F01\u4E1A\u5FAE\u4FE1\u5E94\u7528\u914D\u7F6E\u4E0D\u5B8C\u6574");
  }
  const token = await getWecomAccessToken(corpId, agentSecret);
  const message = {
    msgtype: "textcard",
    agentid: agentId,
    touser: toUser,
    textcard: {
      title: card.title,
      description: card.description,
      url: card.url ?? "URL",
      btntxt: card.btnText ?? "\u8BE6\u60C5"
    },
    enable_duplicate_check: 0
  };
  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/message/send");
  url.searchParams.set("access_token", token);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  });
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`\u53D1\u9001\u4F01\u4E1A\u5FAE\u4FE1\u5361\u7247\u6D88\u606F\u5931\u8D25: ${data.errmsg || `errcode=${data.errcode}`}`);
  }
  return { msgid: data.msgid };
}
async function probeWecomConnection(config) {
  const corpId = config.app?.corpId;
  const agentSecret = config.app?.agentSecret;
  const agentId = config.app?.agentId;
  if (!corpId || !agentSecret) {
    return { ok: false, error: "CorpID \u6216 AgentSecret \u672A\u914D\u7F6E" };
  }
  if (!agentId) {
    return { ok: false, error: "AgentId \u672A\u914D\u7F6E" };
  }
  try {
    await getWecomAccessToken(corpId, agentSecret);
    return { ok: true, corpId, agentId };
  } catch (err) {
    return { ok: false, error: String(err), corpId, agentId };
  }
}
function clearWecomTokenCache() {
  tokenCache.clear();
}
function clearWecomTokenCacheFor(corpId, agentSecret) {
  const cacheKey = `${corpId}:${agentSecret.slice(0, 8)}`;
  tokenCache.delete(cacheKey);
}
export {
  clearWecomTokenCache,
  clearWecomTokenCacheFor,
  getWecomAccessToken,
  probeWecomConnection,
  sendWecomMessage,
  sendWecomTemplateCard
};
