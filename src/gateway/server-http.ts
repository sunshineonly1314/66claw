import type { TlsOptions } from "node:tls";
import type { WebSocketServer } from "ws";
import {
  createServer as createHttpServer,
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { CanvasHostHandler } from "../canvas-host/server.js";
import type { createSubsystemLogger } from "../logging/subsystem.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { GatewayWsClient } from "./server/ws-types.js";
import { resolveAgentAvatar } from "../agents/identity-avatar.js";
import {
  A2UI_PATH,
  CANVAS_HOST_PATH,
  CANVAS_WS_PATH,
  handleA2uiHttpRequest,
} from "../canvas-host/a2ui.js";
import { loadConfig } from "../config/config.js";
import { safeEqualSecret } from "../security/secret-equal.js";
import { handleSlackHttpRequest } from "../slack/http/index.js";
import {
  authorizeGatewayConnect,
  isLocalDirectRequest,
  type GatewayAuthResult,
  type ResolvedGatewayAuth,
} from "./auth.js";
import {
  handleControlUiAvatarRequest,
  handleControlUiHttpRequest,
  type ControlUiRootState,
} from "./control-ui.js";
import { generateLoadingPageHtml } from "./server-loading-page.js";
import { getGatewayPhase, isGatewayReady, requestGatewayShutdown } from "./server-ready.js";
import { handleSetupWizardHttpRequest, shouldShowSetupWizard } from "./setup-wizard.js";
import { applyHookMappings } from "./hooks-mapping.js";
import {
  extractHookToken,
  getHookAgentPolicyError,
  getHookChannelError,
  type HookMessageChannel,
  type HooksConfigResolved,
  isHookAgentAllowed,
  normalizeAgentPayload,
  normalizeHookHeaders,
  normalizeWakePayload,
  readJsonBody,
  resolveHookSessionKey,
  resolveHookTargetAgentId,
  resolveHookChannel,
  resolveHookDeliver,
} from "./hooks.js";
import { translateError } from "./error-translate.js";
import { sendGatewayAuthFailure } from "./http-common.js";
import { getBearerToken, getHeader } from "./http-utils.js";
import { isPrivateOrLoopbackAddress, resolveGatewayClientIp } from "./net.js";
import { handleOpenAiHttpRequest } from "./openai-http.js";
import { handleOpenResponsesHttpRequest } from "./openresponses-http.js";
import { handleToolsInvokeHttpRequest } from "./tools-invoke-http.js";
import { handleChatMediaHttpRequest } from "./chat-media-http.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;
type HookAuthFailure = { count: number; windowStartedAtMs: number };

const HOOK_AUTH_FAILURE_LIMIT = 20;
const HOOK_AUTH_FAILURE_WINDOW_MS = 60_000;
const HOOK_AUTH_FAILURE_TRACK_MAX = 2048;

type HookDispatchers = {
  dispatchWakeHook: (value: { text: string; mode: "now" | "next-heartbeat" }) => void;
  dispatchAgentHook: (value: {
    message: string;
    name: string;
    agentId?: string;
    wakeMode: "now" | "next-heartbeat";
    sessionKey: string;
    deliver: boolean;
    channel: HookMessageChannel;
    to?: string;
    model?: string;
    thinking?: string;
    timeoutSeconds?: number;
    allowUnsafeExternalContent?: boolean;
  }) => string;
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function isCanvasPath(pathname: string): boolean {
  return (
    pathname === A2UI_PATH ||
    pathname.startsWith(`${A2UI_PATH}/`) ||
    pathname === CANVAS_HOST_PATH ||
    pathname.startsWith(`${CANVAS_HOST_PATH}/`) ||
    pathname === CANVAS_WS_PATH
  );
}

function hasAuthorizedWsClientForIp(clients: Set<GatewayWsClient>, clientIp: string): boolean {
  for (const client of clients) {
    if (client.clientIp && client.clientIp === clientIp) {
      return true;
    }
  }
  return false;
}

async function authorizeCanvasRequest(params: {
  req: IncomingMessage;
  auth: ResolvedGatewayAuth;
  trustedProxies: string[];
  clients: Set<GatewayWsClient>;
  rateLimiter?: AuthRateLimiter;
}): Promise<GatewayAuthResult> {
  const { req, auth, trustedProxies, clients, rateLimiter } = params;
  if (isLocalDirectRequest(req, trustedProxies)) {
    return { ok: true };
  }

  let lastAuthFailure: GatewayAuthResult | null = null;
  const token = getBearerToken(req);
  if (token) {
    const authResult = await authorizeGatewayConnect({
      auth: { ...auth, allowTailscale: false },
      connectAuth: { token, password: token },
      req,
      trustedProxies,
      rateLimiter,
    });
    if (authResult.ok) {
      return authResult;
    }
    lastAuthFailure = authResult;
  }

  const clientIp = resolveGatewayClientIp({
    remoteAddr: req.socket?.remoteAddress ?? "",
    forwardedFor: getHeader(req, "x-forwarded-for"),
    realIp: getHeader(req, "x-real-ip"),
    trustedProxies,
  });
  if (!clientIp) {
    return lastAuthFailure ?? { ok: false, reason: "unauthorized" };
  }

  // IP-based fallback is only safe for machine-scoped addresses.
  if (!isPrivateOrLoopbackAddress(clientIp)) {
    return lastAuthFailure ?? { ok: false, reason: "unauthorized" };
  }
  if (hasAuthorizedWsClientForIp(clients, clientIp)) {
    return { ok: true };
  }
  return lastAuthFailure ?? { ok: false, reason: "unauthorized" };
}

function writeUpgradeAuthFailure(
  socket: { write: (chunk: string) => void },
  auth: GatewayAuthResult,
) {
  if (auth.rateLimited) {
    const retryAfterSeconds =
      auth.retryAfterMs && auth.retryAfterMs > 0 ? Math.ceil(auth.retryAfterMs / 1000) : undefined;
    socket.write(
      [
        "HTTP/1.1 429 Too Many Requests",
        retryAfterSeconds ? `Retry-After: ${retryAfterSeconds}` : undefined,
        "Content-Type: application/json; charset=utf-8",
        "Connection: close",
        "",
        JSON.stringify({
          error: {
            message: "Too many failed authentication attempts. Please try again later.",
            type: "rate_limited",
          },
        }),
      ]
        .filter(Boolean)
        .join("\r\n"),
    );
    return;
  }
  socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
}

export type HooksRequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

export function createHooksRequestHandler(
  opts: {
    getHooksConfig: () => HooksConfigResolved | null;
    bindHost: string;
    port: number;
    logHooks: SubsystemLogger;
  } & HookDispatchers,
): HooksRequestHandler {
  const { getHooksConfig, bindHost, port, logHooks, dispatchAgentHook, dispatchWakeHook } = opts;
  const hookAuthFailures = new Map<string, HookAuthFailure>();

  const resolveHookClientKey = (req: IncomingMessage): string => {
    return req.socket?.remoteAddress?.trim() || "unknown";
  };

  const recordHookAuthFailure = (
    clientKey: string,
    nowMs: number,
  ): { throttled: boolean; retryAfterSeconds?: number } => {
    if (!hookAuthFailures.has(clientKey) && hookAuthFailures.size >= HOOK_AUTH_FAILURE_TRACK_MAX) {
      // Prune expired entries instead of clearing all state.
      for (const [key, entry] of hookAuthFailures) {
        if (nowMs - entry.windowStartedAtMs >= HOOK_AUTH_FAILURE_WINDOW_MS) {
          hookAuthFailures.delete(key);
        }
      }
      // If still at capacity after pruning, drop the oldest half.
      if (hookAuthFailures.size >= HOOK_AUTH_FAILURE_TRACK_MAX) {
        let toRemove = Math.floor(hookAuthFailures.size / 2);
        for (const key of hookAuthFailures.keys()) {
          if (toRemove <= 0) {
            break;
          }
          hookAuthFailures.delete(key);
          toRemove--;
        }
      }
    }
    const current = hookAuthFailures.get(clientKey);
    const expired = !current || nowMs - current.windowStartedAtMs >= HOOK_AUTH_FAILURE_WINDOW_MS;
    const next: HookAuthFailure = expired
      ? { count: 1, windowStartedAtMs: nowMs }
      : { count: current.count + 1, windowStartedAtMs: current.windowStartedAtMs };
    // Delete-before-set refreshes Map insertion order so recently-active
    // clients are not evicted before dormant ones during oldest-half eviction.
    if (hookAuthFailures.has(clientKey)) {
      hookAuthFailures.delete(clientKey);
    }
    hookAuthFailures.set(clientKey, next);
    if (next.count <= HOOK_AUTH_FAILURE_LIMIT) {
      return { throttled: false };
    }
    const retryAfterMs = Math.max(1, next.windowStartedAtMs + HOOK_AUTH_FAILURE_WINDOW_MS - nowMs);
    return {
      throttled: true,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  };

  const clearHookAuthFailure = (clientKey: string) => {
    hookAuthFailures.delete(clientKey);
  };

  return async (req, res) => {
    const hooksConfig = getHooksConfig();
    if (!hooksConfig) {
      return false;
    }
    const url = new URL(req.url ?? "/", `http://${bindHost}:${port}`);
    const basePath = hooksConfig.basePath;
    if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
      return false;
    }

    if (url.searchParams.has("token")) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(
        "Hook token must be provided via Authorization: Bearer <token> or X-OpenClawCN-Token header (query parameters are not allowed).",
      );
      return true;
    }

    const token = extractHookToken(req);
    const clientKey = resolveHookClientKey(req);
    if (!safeEqualSecret(token, hooksConfig.token)) {
      const throttle = recordHookAuthFailure(clientKey, Date.now());
      if (throttle.throttled) {
        const retryAfter = throttle.retryAfterSeconds ?? 1;
        res.statusCode = 429;
        res.setHeader("Retry-After", String(retryAfter));
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Too Many Requests");
        logHooks.warn(`hook auth throttled for ${clientKey}; retry-after=${retryAfter}s`);
        return true;
      }
      res.statusCode = 401;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Unauthorized");
      return true;
    }
    clearHookAuthFailure(clientKey);

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Method Not Allowed");
      return true;
    }

    const subPath = url.pathname.slice(basePath.length).replace(/^\/+/, "");
    if (!subPath) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return true;
    }

    const body = await readJsonBody(req, hooksConfig.maxBodyBytes);
    if (!body.ok) {
      const status =
        body.error === "payload too large"
          ? 413
          : body.error === "request body timeout"
            ? 408
            : 400;
      sendJson(res, status, { ok: false, error: body.error });
      return true;
    }

    const payload = typeof body.value === "object" && body.value !== null ? body.value : {};
    const headers = normalizeHookHeaders(req);

    if (subPath === "wake") {
      const normalized = normalizeWakePayload(payload as Record<string, unknown>);
      if (!normalized.ok) {
        sendJson(res, 400, { ok: false, error: normalized.error });
        return true;
      }
      dispatchWakeHook(normalized.value);
      sendJson(res, 200, { ok: true, mode: normalized.value.mode });
      return true;
    }

    if (subPath === "agent") {
      const normalized = normalizeAgentPayload(payload as Record<string, unknown>);
      if (!normalized.ok) {
        sendJson(res, 400, { ok: false, error: normalized.error });
        return true;
      }
      if (!isHookAgentAllowed(hooksConfig, normalized.value.agentId)) {
        sendJson(res, 400, { ok: false, error: getHookAgentPolicyError() });
        return true;
      }
      const sessionKey = resolveHookSessionKey({
        hooksConfig,
        source: "request",
        sessionKey: normalized.value.sessionKey,
      });
      if (!sessionKey.ok) {
        sendJson(res, 400, { ok: false, error: sessionKey.error });
        return true;
      }
      const runId = dispatchAgentHook({
        ...normalized.value,
        sessionKey: sessionKey.value,
        agentId: resolveHookTargetAgentId(hooksConfig, normalized.value.agentId),
      });
      sendJson(res, 202, { ok: true, runId });
      return true;
    }

    if (hooksConfig.mappings.length > 0) {
      try {
        const mapped = await applyHookMappings(hooksConfig.mappings, {
          payload: payload as Record<string, unknown>,
          headers,
          url,
          path: subPath,
        });
        if (mapped) {
          if (!mapped.ok) {
            sendJson(res, 400, { ok: false, error: mapped.error });
            return true;
          }
          if (mapped.action === null) {
            res.statusCode = 204;
            res.end();
            return true;
          }
          if (mapped.action.kind === "wake") {
            dispatchWakeHook({
              text: mapped.action.text,
              mode: mapped.action.mode,
            });
            sendJson(res, 200, { ok: true, mode: mapped.action.mode });
            return true;
          }
          const channel = resolveHookChannel(mapped.action.channel);
          if (!channel) {
            sendJson(res, 400, { ok: false, error: getHookChannelError() });
            return true;
          }
          if (!isHookAgentAllowed(hooksConfig, mapped.action.agentId)) {
            sendJson(res, 400, { ok: false, error: getHookAgentPolicyError() });
            return true;
          }
          const sessionKey = resolveHookSessionKey({
            hooksConfig,
            source: "mapping",
            sessionKey: mapped.action.sessionKey,
          });
          if (!sessionKey.ok) {
            sendJson(res, 400, { ok: false, error: sessionKey.error });
            return true;
          }
          const runId = dispatchAgentHook({
            message: mapped.action.message,
            name: mapped.action.name ?? "Hook",
            agentId: resolveHookTargetAgentId(hooksConfig, mapped.action.agentId),
            wakeMode: mapped.action.wakeMode,
            sessionKey: sessionKey.value,
            deliver: resolveHookDeliver(mapped.action.deliver),
            channel,
            to: mapped.action.to,
            model: mapped.action.model,
            thinking: mapped.action.thinking,
            timeoutSeconds: mapped.action.timeoutSeconds,
            allowUnsafeExternalContent: mapped.action.allowUnsafeExternalContent,
          });
          sendJson(res, 202, { ok: true, runId });
          return true;
        }
      } catch (err) {
        logHooks.warn(`hook mapping failed: ${String(err)}`);
        sendJson(res, 500, { ok: false, error: "hook mapping failed" });
        return true;
      }
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  };
}

export function createGatewayHttpServer(opts: {
  canvasHost: CanvasHostHandler | null;
  clients: Set<GatewayWsClient>;
  controlUiEnabled: boolean;
  controlUiBasePath: string;
  controlUiRoot?: ControlUiRootState;
  openAiChatCompletionsEnabled: boolean;
  openResponsesEnabled: boolean;
  openResponsesConfig?: import("../config/types.gateway.js").GatewayHttpResponsesConfig;
  handleHooksRequest: HooksRequestHandler;
  handlePluginRequest?: HooksRequestHandler;
  resolvedAuth: ResolvedGatewayAuth;
  /** Optional rate limiter for auth brute-force protection. */
  rateLimiter?: AuthRateLimiter;
  tlsOptions?: TlsOptions;
}): HttpServer {
  const {
    canvasHost,
    clients,
    controlUiEnabled,
    controlUiBasePath,
    controlUiRoot,
    openAiChatCompletionsEnabled,
    openResponsesEnabled,
    openResponsesConfig,
    handleHooksRequest,
    handlePluginRequest,
    resolvedAuth,
    rateLimiter,
  } = opts;
  const httpServer: HttpServer = opts.tlsOptions
    ? createHttpsServer(opts.tlsOptions, (req, res) => {
        void handleRequest(req, res);
      })
    : createHttpServer((req, res) => {
        void handleRequest(req, res);
      });

  async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    // Don't interfere with WebSocket upgrades; ws handles the 'upgrade' event.
    if (String(req.headers.upgrade ?? "").toLowerCase() === "websocket") {
      return;
    }

    try {
      // OpenClawCN: Lightweight health check endpoint -- no auth, no UI assets required.
      // Used by the Windows service watchdog and post-install scripts to verify
      // the gateway is alive.
      const healthPath = req.url?.split("?")[0];
      if (healthPath === "/api/health") {
        const ready = isGatewayReady();
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        // Allow Tauri WebView (tauri://localhost) and local origins to fetch health
        const origin = req.headers.origin ?? "";
        if (
          origin === "tauri://localhost" ||
          origin.startsWith("http://localhost") ||
          origin.startsWith("http://127.0.0.1")
        ) {
          res.setHeader("Access-Control-Allow-Origin", origin);
        }
        // [MED-12] Only expose minimal info — no provider IDs, no pid/uptime.
        // Desktop client uses `needsSetup` (primary) and `hasConfiguredProvider` (fallback).
        const healthConfig = loadConfig();
        let hasConfiguredProvider = false;
        if (healthConfig.models?.providers) {
          for (const prov of Object.values(healthConfig.models.providers)) {
            if (prov.apiKey || (prov.auth && prov.auth !== "api-key")) {
              hasConfiguredProvider = true;
              break;
            }
          }
        }
        if (!hasConfiguredProvider) {
          const freeModels = (
            healthConfig as { freeModels?: { accounts?: Array<{ enabled: boolean }> } }
          ).freeModels;
          if (freeModels?.accounts?.some((a) => a.enabled)) {
            hasConfiguredProvider = true;
          }
        }
        res.end(
          JSON.stringify({
            ok: true,
            ready,
            needsSetup: shouldShowSetupWizard(),
            phase: getGatewayPhase(),
            hasConfiguredProvider,
          }),
        );
        return;
      }

      // Local-only endpoint for Tauri desktop to fetch the gateway auth token.
      // Only responds to loopback requests. Returns the decrypted token so the
      // WebView can authenticate via #token= hash parameter.
      if (healthPath === "/api/local-token") {
        const remoteIp = req.socket.remoteAddress ?? "";
        const isLocal =
          remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1";
        if (!isLocal) {
          res.writeHead(403);
          res.end(JSON.stringify({ error: "forbidden" }));
          return;
        }
        const tokenConfig = loadConfig();
        const token = tokenConfig.gateway?.auth?.token ?? "";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token }));
        return;
      }

      // OpenClawCN: Support QR code endpoint -- no auth, returns QR code base64 for topbar.
      // Used as HTTP fallback when WebSocket is disconnected so the support button always shows.
      if (healthPath === "/api/support/qrcode") {
        try {
          const qrcodeConfig = loadConfig();
          const keyType = (qrcodeConfig.license?.keyType ?? "test") as
            | "test"
            | "trial"
            | "standard";
          const qrMap: Record<string, { file: string; groupName: string }> = {
            test: { file: "test.jpg", groupName: "测试体验群" },
            trial: { file: "test.jpg", groupName: "测试体验群" },
            standard: { file: "zhengshi.jpg", groupName: "正式用户群" },
          };
          const entry = qrMap[keyType] ?? qrMap.test;
          const { default: _fs } = await import("node:fs");
          const { default: _path } = await import("node:path");
          // Try multiple paths: import.meta.dirname relative, then one level up from dist/, then cwd
          const candidates = [
            _path.resolve(import.meta.dirname, "../../data/qrcodes"),
            _path.resolve(import.meta.dirname, "../data/qrcodes"),
            _path.resolve(process.cwd(), "data/qrcodes"),
          ];
          const qrDir = candidates.find((d) => _fs.existsSync(d)) ?? candidates[2];
          const filePath = _path.join(qrDir, entry.file);
          let qrcode: { base64: string; groupName: string } | null = null;
          if (_fs.existsSync(filePath)) {
            const buf = _fs.readFileSync(filePath);
            qrcode = {
              base64: `data:image/jpeg;base64,${buf.toString("base64")}`,
              groupName: entry.groupName,
            };
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.end(JSON.stringify({ ok: true, qrcode, keyType }));
        } catch {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false }));
        }
        return;
      }

      // OpenClawCN: Token discovery endpoint for Control UI auth recovery after gateway restart.
      // Localhost-only.
      if (healthPath === "/api/auth/discover") {
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.statusCode = 405;
          res.setHeader("Allow", "GET, HEAD");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false }));
          return;
        }
        const remoteIp = req.socket.remoteAddress;
        const isLocal =
          remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1";
        if (!isLocal) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false }));
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify({ ok: true, token: resolvedAuth.token ?? null }));
        return;
      }

      // OpenClawCN: Graceful shutdown endpoint -- used by Windows service (OpenClawCNService.cs).
      // Localhost-only + token-authenticated.
      if (healthPath === "/api/shutdown") {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Allow", "POST");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
          return;
        }
        const remoteIp = req.socket.remoteAddress;
        const isLocal =
          remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1";
        if (!isLocal) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: "Forbidden" }));
          return;
        }
        const tokenHeader =
          typeof req.headers["x-openclawcn-token"] === "string"
            ? req.headers["x-openclawcn-token"].trim()
            : undefined;
        const authHeader = req.headers.authorization;
        const bearerToken =
          typeof authHeader === "string" && authHeader.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : undefined;
        const providedToken = tokenHeader ?? bearerToken;
        if (!providedToken || !safeEqualSecret(providedToken, resolvedAuth.token ?? "")) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: true, message: "shutdown initiated" }));
        setImmediate(() => {
          requestGatewayShutdown();
        });
        return;
      }

      // OpenClawCN: Purchase URL endpoint -- public, no auth required.
      if (
        healthPath === "/config/purchase-url" &&
        (req.method === "GET" || req.method === "HEAD")
      ) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.end(
          JSON.stringify({
            code: 200,
            message: "success",
            data: { xianyu: "https://m.tb.cn/h.7vUkYDe?tk=hLT6UlwfWs0" },
          }),
        );
        return;
      }

      // OpenClawCN: 服务端打开外部 URL（Tauri WebView2 在非 tauri.localhost origin 上
      // 无法通过 on_navigation/on_new_window 回调拦截外部链接）。
      // 放在 server-http 顶层，不受 setup 410 guard 限制，setup 和 chat 页面都能用。
      // 安全: 仅允许 loopback 访问 + 使用 execFile 避免 shell 注入
      if (healthPath === "/api/open-url" && req.method === "POST") {
        const remoteIp = req.socket.remoteAddress;
        const isLocal =
          remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1";
        if (!isLocal) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "Loopback only" }));
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const url = body?.url;
          // 严格验证: 必须是合法 http(s) URL，拒绝含 shell 元字符的 URL
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
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "Invalid URL" }));
            return;
          }
          const { execFile } = await import("node:child_process");
          if (process.platform === "win32") {
            execFile("cmd", ["/c", "start", "", url]);
          } else if (process.platform === "darwin") {
            execFile("open", [url]);
          } else {
            execFile("xdg-open", [url]);
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
        return;
      }

      // OpenClawCN: While subsystems are still initialising, serve a loading page for
      // browser requests so users see progress instead of "connection refused".
      if (!isGatewayReady()) {
        const reqPath = req.url?.split("?")[0] ?? "/";
        if (
          !reqPath.startsWith("/api/") &&
          !reqPath.startsWith("/assets/") &&
          !/\.\w{1,5}$/.test(reqPath)
        ) {
          res.statusCode = 503;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Retry-After", "3");
          res.end(generateLoadingPageHtml());
          return;
        }
      }

      const configSnapshot = loadConfig();
      const trustedProxies = configSnapshot.gateway?.trustedProxies ?? [];
      const requestPath = new URL(req.url ?? "/", "http://localhost").pathname;
      if (await handleHooksRequest(req, res)) {
        return;
      }
      // OpenClawCN: Setup Wizard API
      if (await handleSetupWizardHttpRequest(req, res)) {
        return;
      }
      if (
        await handleToolsInvokeHttpRequest(req, res, {
          auth: resolvedAuth,
          trustedProxies,
          rateLimiter,
        })
      ) {
        return;
      }
      if (await handleSlackHttpRequest(req, res)) {
        return;
      }
      if (handlePluginRequest) {
        // Channel HTTP endpoints are gateway-auth protected by default.
        if (requestPath.startsWith("/api/channels/")) {
          const token = getBearerToken(req);
          const authResult = await authorizeGatewayConnect({
            auth: resolvedAuth,
            connectAuth: token ? { token, password: token } : null,
            req,
            trustedProxies,
            rateLimiter,
          });
          if (!authResult.ok) {
            sendGatewayAuthFailure(res, authResult);
            return;
          }
        }
        if (await handlePluginRequest(req, res)) {
          return;
        }
      }
      if (openResponsesEnabled) {
        if (
          await handleOpenResponsesHttpRequest(req, res, {
            auth: resolvedAuth,
            config: openResponsesConfig,
            trustedProxies,
            rateLimiter,
          })
        ) {
          return;
        }
      }
      if (openAiChatCompletionsEnabled) {
        if (
          await handleOpenAiHttpRequest(req, res, {
            auth: resolvedAuth,
            trustedProxies,
            rateLimiter,
          })
        ) {
          return;
        }
      }
      if (canvasHost) {
        if (isCanvasPath(requestPath)) {
          const ok = await authorizeCanvasRequest({
            req,
            auth: resolvedAuth,
            trustedProxies,
            clients,
            rateLimiter,
          });
          if (!ok.ok) {
            sendGatewayAuthFailure(res, ok);
            return;
          }
        }
        if (await handleA2uiHttpRequest(req, res)) {
          return;
        }
        if (await canvasHost.handleHttpRequest(req, res)) {
          return;
        }
      }
      // OpenClawCN: Serve chat-images and chat-videos from the config media directory
      // so they don't fall through to the SPA catch-all and return index.html.
      if (await handleChatMediaHttpRequest(req, res)) {
        return;
      }

      if (controlUiEnabled) {
        // OpenClawCN: Redirect first-time users to the setup wizard when required config is missing.
        const reqPath = req.url?.split("?")[0] ?? "/";
        if (
          shouldShowSetupWizard() &&
          reqPath !== "/setup" &&
          reqPath !== "/setup/" &&
          !reqPath.startsWith("/api/") &&
          !reqPath.startsWith("/assets/") &&
          !/\.\w{1,5}$/.test(reqPath)
        ) {
          res.statusCode = 302;
          res.setHeader("Location", "/setup");
          res.end();
          return;
        }

        if (
          handleControlUiAvatarRequest(req, res, {
            basePath: controlUiBasePath,
            resolveAvatar: (agentId) => resolveAgentAvatar(configSnapshot, agentId),
          })
        ) {
          return;
        }
        if (
          handleControlUiHttpRequest(req, res, {
            basePath: controlUiBasePath,
            config: configSnapshot,
            root: controlUiRoot,
          })
        ) {
          return;
        }
      }

      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
    } catch (err) {
      console.error(
        "[openclawcn] HTTP handler error:",
        err instanceof Error ? (err.stack ?? err.message) : err,
      );
      const translated = translateError(err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: {
            message: "Internal Server Error",
            userMessage: translated.userMessage,
            category: translated.category,
            type: "internal_error",
          },
        }),
      );
    }
  }

  return httpServer;
}

export function attachGatewayUpgradeHandler(opts: {
  httpServer: HttpServer;
  wss: WebSocketServer;
  canvasHost: CanvasHostHandler | null;
  clients: Set<GatewayWsClient>;
  resolvedAuth: ResolvedGatewayAuth;
  /** Optional rate limiter for auth brute-force protection. */
  rateLimiter?: AuthRateLimiter;
}) {
  const { httpServer, wss, canvasHost, clients, resolvedAuth, rateLimiter } = opts;
  httpServer.on("upgrade", (req, socket, head) => {
    void (async () => {
      if (canvasHost) {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === CANVAS_WS_PATH) {
          const configSnapshot = loadConfig();
          const trustedProxies = configSnapshot.gateway?.trustedProxies ?? [];
          const ok = await authorizeCanvasRequest({
            req,
            auth: resolvedAuth,
            trustedProxies,
            clients,
            rateLimiter,
          });
          if (!ok.ok) {
            writeUpgradeAuthFailure(socket, ok);
            socket.destroy();
            return;
          }
        }
        if (canvasHost.handleUpgrade(req, socket, head)) {
          return;
        }
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    })().catch(() => {
      socket.destroy();
    });
  });
}
