function resolveReceiveIdType(id) {
  if (id.startsWith("oc_")) return "chat_id";
  if (id.startsWith("on_")) return "union_id";
  if (id.startsWith("ou_")) return "open_id";
  return "open_id";
}
function looksLikeFeishuId(raw) {
  const trimmed = raw.trim();
  return /^(ou_|on_|oc_)[a-zA-Z0-9_-]+$/.test(trimmed);
}
function normalizeFeishuTarget(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const prefixPatterns = [
    /^(feishu|user|open_id|chat):/i
  ];
  let normalized = trimmed;
  for (const pattern of prefixPatterns) {
    normalized = normalized.replace(pattern, "");
  }
  normalized = normalized.trim();
  if (!normalized) return null;
  if (normalized.startsWith("ou_") || normalized.startsWith("on_") || normalized.startsWith("oc_")) {
    return normalized;
  }
  return normalized;
}
function formatFeishuTarget(id) {
  const idType = resolveReceiveIdType(id);
  switch (idType) {
    case "chat_id":
      return `chat:${id}`;
    case "union_id":
      return `union:${id}`;
    default:
      return `user:${id}`;
  }
}
export {
  formatFeishuTarget,
  looksLikeFeishuId,
  normalizeFeishuTarget,
  resolveReceiveIdType
};
