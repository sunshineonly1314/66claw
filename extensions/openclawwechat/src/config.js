import { PLUGIN_ID, DEFAULT_CONFIG, BRIDGE_URL } from "./constants.js";
function getPluginConfig(cfg) {
  const pluginConfig = cfg?.plugins?.entries?.[PLUGIN_ID]?.config || {};
  const rawSessionKey = pluginConfig.sessionKey ?? pluginConfig.sessionKeyPrefix;
  return {
    bridgeUrl: BRIDGE_URL,
    apiKey: pluginConfig.apiKey,
    pollIntervalMs: pluginConfig.pollIntervalMs ?? DEFAULT_CONFIG.pollIntervalMs,
    sessionKey: rawSessionKey ?? DEFAULT_CONFIG.sessionKey,
    debug: pluginConfig.debug ?? DEFAULT_CONFIG.debug
  };
}
function isConfigValid(config) {
  return Boolean(config.apiKey?.trim());
}
export {
  getPluginConfig,
  isConfigValid
};
