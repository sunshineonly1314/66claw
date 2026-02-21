function resolveFeishuAllowlistMatch(params) {
  const allowFrom = params.allowFrom.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean);
  if (allowFrom.length === 0) {
    return { allowed: false };
  }
  if (allowFrom.includes("*")) {
    return { allowed: true, matchKey: "*", matchSource: "wildcard" };
  }
  const senderId = params.senderId.toLowerCase();
  if (allowFrom.includes(senderId)) {
    return { allowed: true, matchKey: senderId, matchSource: "id" };
  }
  const senderName = params.senderName?.toLowerCase();
  if (senderName && allowFrom.includes(senderName)) {
    return { allowed: true, matchKey: senderName, matchSource: "name" };
  }
  return { allowed: false };
}
function resolveFeishuGroupConfig(params) {
  const groups = params.cfg?.groups ?? {};
  const groupId = params.groupId?.trim();
  if (!groupId) {
    return void 0;
  }
  const direct = groups[groupId];
  if (direct) {
    return direct;
  }
  const lowered = groupId.toLowerCase();
  const matchKey = Object.keys(groups).find((key) => key.toLowerCase() === lowered);
  return matchKey ? groups[matchKey] : void 0;
}
function resolveFeishuGroupToolPolicy(params) {
  const cfg = params.cfg.channels?.feishu;
  if (!cfg) {
    return void 0;
  }
  const groupConfig = resolveFeishuGroupConfig({
    cfg,
    groupId: params.groupId
  });
  return groupConfig?.tools;
}
function isFeishuGroupAllowed(params) {
  const { groupPolicy } = params;
  if (groupPolicy === "disabled") {
    return false;
  }
  if (groupPolicy === "open") {
    return true;
  }
  return resolveFeishuAllowlistMatch(params).allowed;
}
function resolveFeishuReplyPolicy(params) {
  if (params.isDirectMessage) {
    return { requireMention: false };
  }
  const requireMention = params.groupConfig?.requireMention ?? params.globalConfig?.requireMention ?? true;
  return { requireMention };
}
export {
  isFeishuGroupAllowed,
  resolveFeishuAllowlistMatch,
  resolveFeishuGroupConfig,
  resolveFeishuGroupToolPolicy,
  resolveFeishuReplyPolicy
};
