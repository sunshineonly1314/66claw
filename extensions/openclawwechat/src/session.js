import { getPluginConfig } from "./config.js";
import { DEFAULT_CONFIG } from "./constants.js";
function isValidSessionKeyFormat(key) {
  if (!key || typeof key !== "string") return false;
  const raw = key.trim();
  if (!raw) return false;
  const parts = raw.split(":").filter(Boolean);
  if (parts.length < 3) return false;
  if (parts[0]?.toLowerCase() !== "agent") return false;
  if (!parts[1]?.trim()) return false;
  const rest = parts.slice(2).join(":");
  if (!rest.trim()) return false;
  return true;
}
function parseAgentIdFromSessionKey(sessionKey) {
  const parts = (sessionKey || "").trim().split(":");
  if (parts.length >= 2 && parts[0]?.toLowerCase() === "agent") {
    return parts[1]?.trim() || "main";
  }
  return "main";
}
function resolveSession(params) {
  const pluginConfig = getPluginConfig(params.cfg);
  const raw = (pluginConfig.sessionKey ?? "").trim();
  const sessionKey = raw && isValidSessionKeyFormat(raw) ? raw : DEFAULT_CONFIG.sessionKey;
  const agentId = parseAgentIdFromSessionKey(sessionKey);
  return {
    sessionKey,
    mainSessionKey: sessionKey,
    agentId,
    fromRoute: false
  };
}
export {
  resolveSession
};
