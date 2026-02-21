import * as Lark from "@larksuiteoapi/node-sdk";
import axios from "axios";
const noProxyHttpInstance = axios.create({ proxy: false });
noProxyHttpInstance.interceptors.request.use((req) => {
  if (req.headers) {
    req.headers["User-Agent"] = "oapi-node-sdk/1.0.0";
  }
  return req;
}, void 0, { synchronous: true });
noProxyHttpInstance.interceptors.response.use((resp) => {
  if (resp.config["$return_headers"]) {
    return { data: resp.data, headers: resp.headers };
  }
  return resp.data;
});
let cachedClient = null;
let cachedConfig = null;
function resolveFeishuCredentials(cfg) {
  if (!cfg) return null;
  const appId = cfg.appId?.trim() || cfg.app?.appId?.trim();
  const appSecret = cfg.appSecret?.trim() || cfg.app?.appSecret?.trim();
  if (!appId || !appSecret) return null;
  return {
    appId,
    appSecret,
    encryptKey: cfg.encryptKey?.trim() || cfg.app?.encryptKey?.trim() || void 0,
    verificationToken: cfg.verificationToken?.trim() || cfg.app?.verificationToken?.trim() || void 0,
    domain: cfg.domain ?? "feishu"
  };
}
function resolveDomain(domain) {
  return domain === "lark" ? Lark.Domain.Lark : Lark.Domain.Feishu;
}
function createFeishuClient(cfg) {
  const creds = resolveFeishuCredentials(cfg);
  if (!creds) {
    throw new Error("\u98DE\u4E66\u51ED\u8BC1\u672A\u914D\u7F6E (\u9700\u8981 appId, appSecret)");
  }
  if (cachedClient && cachedConfig && cachedConfig.appId === creds.appId && cachedConfig.appSecret === creds.appSecret && cachedConfig.domain === creds.domain) {
    return cachedClient;
  }
  const client = new Lark.Client({
    appId: creds.appId,
    appSecret: creds.appSecret,
    appType: Lark.AppType.SelfBuild,
    domain: resolveDomain(creds.domain),
    httpInstance: noProxyHttpInstance
  });
  cachedClient = client;
  cachedConfig = { appId: creds.appId, appSecret: creds.appSecret, domain: creds.domain };
  return client;
}
function createFeishuWSClient(cfg) {
  const creds = resolveFeishuCredentials(cfg);
  if (!creds) {
    throw new Error("\u98DE\u4E66\u51ED\u8BC1\u672A\u914D\u7F6E (\u9700\u8981 appId, appSecret)");
  }
  return new Lark.WSClient({
    appId: creds.appId,
    appSecret: creds.appSecret,
    domain: resolveDomain(creds.domain),
    loggerLevel: Lark.LoggerLevel.info,
    httpInstance: noProxyHttpInstance
  });
}
function createEventDispatcher(cfg) {
  const creds = resolveFeishuCredentials(cfg);
  return new Lark.EventDispatcher({
    encryptKey: creds?.encryptKey,
    verificationToken: creds?.verificationToken
  });
}
function clearClientCache() {
  cachedClient = null;
  cachedConfig = null;
}
export {
  Lark,
  clearClientCache,
  createEventDispatcher,
  createFeishuClient,
  createFeishuWSClient,
  resolveFeishuCredentials
};
