/**
 * Web Setup Wizard HTTP Handler - Main Entry Point
 * Web 配置向导 HTTP 处理器 - 主入口（路由分发）
 *
 * 本文件仅保留路由分发逻辑和对外导出。
 * 具体实现拆分至：
 *   - setup-wizard-types.ts   类型定义
 *   - setup-wizard-state.ts   状态管理
 *   - setup-wizard-utils.ts   工具函数
 *   - setup-wizard-handlers.ts API 处理器
 *
 * 安全模型（[HIGH-02] 修复）：
 * 1. Setup 完成后整个 /api/setup/* 路由返回 410 Gone（防止 setup 完成后继续利用）
 * 2. 所有写操作端点强制 loopback-only（不依赖 Origin 头，防 LAN 攻击）
 * 3. /browse-directory 限制只能浏览用户主目录及指定安全路径前缀
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../config/config.js";
import { serveSetupPage } from "./setup-page.js";
import { isLocalDirectRequest } from "./auth.js";

// Re-export types and public API for external consumers
export type { SetupWizardState, ChannelStartCallback } from "./setup-wizard-types.js";
export { setChannelStartCallback } from "./setup-wizard-state.js";

// Internal imports for routing
import { SETUP_API_PREFIX, SETUP_UI_PATH, sendJson } from "./setup-wizard-utils.js";
import {
  handleGetState,
  handleGetProviders,
  handleGetAffiliateLinks,
  handleBrowseDirectory,
  handleGetFreeModelProviders,
  handleGetFreeModelsConfig,
  handleGetQrcode,
  handleValidateApiKey,
  handleVerifyApiKey,
  handleValidatePath,
  handleConfigureProvider,
  handleConfigureWorkspace,
  handleConfigureSecurity,
  handleConfigureChannels,
  handleVerifyChannel,
  handleComplete,
  handleRestart,
  handleValidateLicense,
  handleSwitchDevice,
  handleFetchModels,
  handleTestFreeModelApiKey,
  handleConfigureFreeModels,
} from "./setup-wizard-handlers.js";

// ============================================================================
// Security helpers
// ============================================================================

/**
 * 写操作端点列表 — 这些端点要求 loopback-only，防止 LAN 攻击。
 * 读操作（GET state/providers 等）在 setup 未完成期间对 loopback 开放，
 * 因为 setup 页面本身只有 loopback 才能打开。
 */
const SETUP_WRITE_API_PATHS = new Set([
  "/configure-provider",
  "/configure-workspace",
  "/configure-security",
  "/configure-channels",
  "/complete",
  "/restart",
  "/validate-license",
  "/switch-device",
  "/fetch-models",
  "/free-models/configure",
  "/browse-directory", // 文件系统浏览，有信息泄露风险
]);

/**
 * 验证请求来自 loopback，否则返回 403 并返回 false。
 */
function requireLoopback(req: IncomingMessage, res: ServerResponse): boolean {
  if (isLocalDirectRequest(req)) {
    return true;
  }
  sendJson(res, 403, {
    ok: false,
    error: "此接口仅允许本机访问",
  });
  return false;
}

// ============================================================================
// Main HTTP Handler
// ============================================================================

/**
 * 处理 Setup Wizard 相关的 HTTP 请求
 */
export async function handleSetupWizardHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const urlRaw = req.url;
  if (!urlRaw) return false;

  const url = new URL(urlRaw, "http://localhost");
  const pathname = url.pathname;

  // 处理 API 请求
  if (pathname.startsWith(SETUP_API_PREFIX)) {
    const apiPath = pathname.slice(SETUP_API_PREFIX.length);

    // [LOW-05] CORS 仅允许 Tauri WebView 和同端口 localhost 来源。
    // 之前允许任意 localhost 端口，可能被本机其他 Web 服务的 XSS 利用。
    const origin = req.headers.origin;
    if (origin) {
      try {
        const isTauri = origin === "tauri://localhost";
        if (isTauri) {
          res.setHeader("Access-Control-Allow-Origin", origin);
        } else {
          const parsed = new URL(origin);
          const reqHost = req.headers.host ?? "";
          // Only allow same-port localhost (i.e., the gateway's own origin)
          const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
          // Extract port from Host header safely (handles IPv6 like [::1]:19002)
          const bracketEnd = reqHost.lastIndexOf("]");
          const lastColon = reqHost.lastIndexOf(":");
          const hostPort = lastColon > bracketEnd ? reqHost.slice(lastColon + 1) : "";
          const isSamePort = parsed.port === hostPort;
          if (isLocal && isSamePort) {
            res.setHeader("Access-Control-Allow-Origin", origin);
          }
        }
      } catch {
        // invalid origin, skip CORS header
      }
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return true;
    }

    // [HIGH-02] Setup 完成后整个 /api/setup/* 路由关闭，防止被持续滥用。
    // 仅依据 setup.completedAt 标记（由 /complete 写入）判断是否关闭。
    // 不能用 shouldShowSetupWizard()：它还检查 license.key 等字段，但 setup 流程中
    // 前面的步骤（configure-provider）写入 config 时 writeConfigFile 的 merge 逻辑
    // 可能恢复了旧的 license.key，导致 shouldShowSetupWizard()=false，
    // 使得后续步骤（verify-apikey 等）被 410 挡住。
    // /state 和 /complete 始终放行：/state 供 UI 查询；/complete 需要幂等。
    const setupExplicitlyCompleted = Boolean(loadConfig().setup?.completedAt);
    if (setupExplicitlyCompleted && apiPath !== "/state" && apiPath !== "/complete") {
      sendJson(res, 410, {
        ok: false,
        error: "Setup 向导已完成，接口已关闭",
      });
      return true;
    }

    // [HIGH-02] 写操作端点强制 loopback-only IP 检查（不依赖 Origin 头）。
    // 对非浏览器客户端 Origin 头无效，只有 IP 检查是可靠的。
    if (SETUP_WRITE_API_PATHS.has(apiPath) && !requireLoopback(req, res)) {
      return true;
    }

    // 路由 API 请求
    if (req.method === "GET") {
      switch (apiPath) {
        case "/state":
          await handleGetState(req, res);
          return true;
        case "/providers":
          await handleGetProviders(req, res);
          return true;
        case "/affiliate-links":
          await handleGetAffiliateLinks(req, res);
          return true;
        case "/browse-directory":
          await handleBrowseDirectory(req, res);
          return true;
        case "/free-models/providers":
          await handleGetFreeModelProviders(req, res);
          return true;
        case "/free-models/config":
          await handleGetFreeModelsConfig(req, res);
          return true;
        case "/qrcode":
          await handleGetQrcode(req, res);
          return true;
      }
    }

    if (req.method === "POST") {
      switch (apiPath) {
        case "/validate-api-key":
          await handleValidateApiKey(req, res);
          return true;
        case "/verify-apikey":
          await handleVerifyApiKey(req, res);
          return true;
        case "/validate-path":
          await handleValidatePath(req, res);
          return true;
        case "/configure-provider":
          await handleConfigureProvider(req, res);
          return true;
        case "/configure-workspace":
          await handleConfigureWorkspace(req, res);
          return true;
        case "/configure-security":
          await handleConfigureSecurity(req, res);
          return true;
        case "/configure-channels":
          await handleConfigureChannels(req, res);
          return true;
        case "/verify-channel":
          await handleVerifyChannel(req, res);
          return true;
        case "/complete":
          await handleComplete(req, res);
          return true;
        case "/restart":
          await handleRestart(req, res);
          return true;
        case "/validate-license":
          await handleValidateLicense(req, res);
          return true;
        case "/switch-device":
          await handleSwitchDevice(req, res);
          return true;
        case "/fetch-models":
          await handleFetchModels(req, res);
          return true;
        case "/free-models/test":
          await handleTestFreeModelApiKey(req, res);
          return true;
        case "/free-models/configure":
          await handleConfigureFreeModels(req, res);
          return true;
        case "/open-url": {
          // 服务端打开外部 URL（Tauri WebView2 无法直接打开外部链接）
          // 安全: 使用 execFile 避免 shell 注入 + URL 严格校验
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const url = body?.url;
            let parsedUrl: URL | undefined;
            try {
              parsedUrl = new URL(url);
            } catch {
              /* invalid */
            }
            if (
              !url ||
              typeof url !== "string" ||
              !parsedUrl ||
              (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:")
            ) {
              sendJson(res, 400, { ok: false, error: "Invalid URL" });
              return true;
            }
            const { execFile } = await import("node:child_process");
            if (process.platform === "win32") {
              execFile("cmd", ["/c", "start", "", url]);
            } else if (process.platform === "darwin") {
              execFile("open", [url]);
            } else {
              execFile("xdg-open", [url]);
            }
            sendJson(res, 200, { ok: true });
          } catch (e) {
            sendJson(res, 500, { ok: false, error: String(e) });
          }
          return true;
        }
      }
    }

    // 未知的 API 端点
    sendJson(res, 404, { ok: false, error: "未知的 API 端点" });
    return true;
  }

  // 处理 Setup UI 页面请求
  if (pathname === SETUP_UI_PATH || pathname === `${SETUP_UI_PATH}/`) {
    // 获取当前的 gateway token（优先从环境变量，然后从配置）
    const config = loadConfig();
    const gatewayToken = process.env.OPENCLAWCN_GATEWAY_TOKEN ?? config.gateway?.auth?.token;
    serveSetupPage(res, gatewayToken);
    return true;
  }

  return false;
}

/**
 * 检查是否需要显示 Setup Wizard
 */
export function shouldShowSetupWizard(): boolean {
  const config = loadConfig();

  // 老用户保护：如果已激活过授权码，说明已完成初始配置，不再弹出 Setup Wizard。
  // 这避免了老用户因缺少 workspace 或使用环境变量配置 API Key 而被误重定向的问题。
  const hasLicense = Boolean(config.license?.key);
  if (hasLicense) return false;

  // 如果 setup wizard 已显式完成（handleComplete 写入的标记），不再弹出。
  // 这是防止老用户误弹的第二道保护（向后兼容：老配置无此字段不受影响）。
  const setupCompleted = Boolean(config.setup?.completedAt);
  if (setupCompleted) return false;

  // 检查是否已配置 API Key
  const hasApiKey = Boolean(config.auth?.profiles && Object.keys(config.auth.profiles).length > 0);

  // 检查是否已配置工作目录
  const hasWorkspace = Boolean(config.agents?.defaults?.workspace);

  // 如果缺少必要配置，显示 Setup Wizard
  if (!hasApiKey || !hasWorkspace) return true;

  // 【关键修复】API Key + workspace 都已配置，但没有 license 且没有 setup.completedAt
  // 说明 setup wizard 进行到了中途（Steps 1-2 已保存配置）但未完成 license 验证。
  // 必须继续显示 setup wizard，让用户完成激活流程。
  return true;
}

/**
 * 获取 Setup Wizard 的 URL
 */
export function getSetupWizardUrl(port: number): string {
  return `http://localhost:${port}/setup`;
}

// ============================================================================
// /browse-directory 路径安全边界（供 handlers 使用）
// ============================================================================

/**
 * 检查给定路径是否在允许浏览的安全范围内。
 *
 * 允许的范围：
 * - 用户主目录及其子目录
 * - Windows 驱动器根目录（仅一级，如 C:\，不允许 C:\Windows\System32）
 *
 * 禁止的范围：
 * - 系统目录（Windows: C:\Windows, C:\Program Files; Linux: /etc, /sys 等）
 * - 配置文件目录之外的任何路径（当 path 参数不在主目录下时拒绝）
 */
export function isPathAllowedForBrowse(targetPath: string): boolean {
  const normalized = path.resolve(targetPath);
  const homedir = os.homedir();

  // 允许：主目录及其子目录
  if (normalized === homedir || normalized.startsWith(homedir + path.sep)) {
    return true;
  }

  // 允许：Windows 驱动器根目录（仅列出驱动器，不深入系统路径）
  if (os.platform() === "win32") {
    // 形如 C:\ 的驱动器根：长度为 3，且第二个字符是 :，第三个是 \
    if (/^[A-Za-z]:\\$/.test(normalized)) {
      return true;
    }
  }

  // 禁止：Linux 根目录的系统关键路径
  if (os.platform() !== "win32") {
    const blockedPrefixes = ["/etc", "/sys", "/proc", "/dev", "/boot", "/root"];
    for (const blocked of blockedPrefixes) {
      if (normalized === blocked || normalized.startsWith(blocked + "/")) {
        return false;
      }
    }
    // 允许：Linux 常见用户数据目录（/home, /tmp）
    if (normalized === "/" || normalized.startsWith("/home/") || normalized.startsWith("/tmp/")) {
      return true;
    }
    // 其他路径拒绝
    return false;
  }

  return false;
}
