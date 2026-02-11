import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

import type { ClawdbotConfig } from "../config/config.js";
import { DEFAULT_ASSISTANT_IDENTITY, resolveAssistantIdentity } from "./assistant-identity.js";
import {
  buildControlUiAvatarUrl,
  CONTROL_UI_AVATAR_PREFIX,
  normalizeControlUiBasePath,
  resolveAssistantAvatarUrl,
} from "./control-ui-shared.js";

// ── In-memory cache for compressed static assets ──
// Avoids repeated fs.readFileSync + zlib.gzipSync on every request.
// Cache is keyed by absolute file path; entries are evicted only on process restart.
const _compressedCache = new Map<string, { raw: Buffer; gzip: Buffer; mtime: number }>();
const COMPRESSIBLE_EXTS = new Set([".js", ".css", ".html", ".json", ".svg", ".map", ".txt"]);
const CACHE_MAX_ENTRIES = 64; // prevent unbounded growth

const ROOT_PREFIX = "/";

export type ControlUiRequestOptions = {
  basePath?: string;
  config?: ClawdbotConfig;
  agentId?: string;
  /** Gateway auth token to inject into the UI for automatic authentication */
  gatewayToken?: string;
};

function resolveControlUiRoot(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const execDir = (() => {
    try {
      return path.dirname(fs.realpathSync(process.execPath));
    } catch {
      return null;
    }
  })();
  const candidates = [
    // Packaged app: control-ui lives alongside the executable.
    execDir ? path.resolve(execDir, "control-ui") : null,
    // Running from dist: dist/gateway/control-ui.js -> dist/control-ui
    path.resolve(here, "../control-ui"),
    // Running from source: src/gateway/control-ui.ts -> dist/control-ui
    path.resolve(here, "../../dist/control-ui"),
    // Fallback to cwd (dev)
    path.resolve(process.cwd(), "dist", "control-ui"),
  ].filter((dir): dir is string => Boolean(dir));
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
    case ".map":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export type ControlUiAvatarResolution =
  | { kind: "none"; reason: string }
  | { kind: "local"; filePath: string }
  | { kind: "remote"; url: string }
  | { kind: "data"; url: string };

type ControlUiAvatarMeta = {
  avatarUrl: string | null;
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.end(JSON.stringify(body));
}

function isValidAgentId(agentId: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(agentId);
}

export function handleControlUiAvatarRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { basePath?: string; resolveAvatar: (agentId: string) => ControlUiAvatarResolution },
): boolean {
  const urlRaw = req.url;
  if (!urlRaw) return false;
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const url = new URL(urlRaw, "http://localhost");
  const basePath = normalizeControlUiBasePath(opts.basePath);
  const pathname = url.pathname;
  const pathWithBase = basePath
    ? `${basePath}${CONTROL_UI_AVATAR_PREFIX}/`
    : `${CONTROL_UI_AVATAR_PREFIX}/`;
  if (!pathname.startsWith(pathWithBase)) return false;

  const agentIdParts = pathname.slice(pathWithBase.length).split("/").filter(Boolean);
  const agentId = agentIdParts[0] ?? "";
  if (agentIdParts.length !== 1 || !agentId || !isValidAgentId(agentId)) {
    respondNotFound(res);
    return true;
  }

  if (url.searchParams.get("meta") === "1") {
    const resolved = opts.resolveAvatar(agentId);
    const avatarUrl =
      resolved.kind === "local"
        ? buildControlUiAvatarUrl(basePath, agentId)
        : resolved.kind === "remote" || resolved.kind === "data"
          ? resolved.url
          : null;
    sendJson(res, 200, { avatarUrl } satisfies ControlUiAvatarMeta);
    return true;
  }

  const resolved = opts.resolveAvatar(agentId);
  if (resolved.kind !== "local") {
    respondNotFound(res);
    return true;
  }

  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypeForExt(path.extname(resolved.filePath).toLowerCase()));
    res.setHeader("Cache-Control", "no-cache");
    res.end();
    return true;
  }

  serveFile(res, resolved.filePath, req);
  return true;
}

function respondNotFound(res: ServerResponse) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Not Found");
}

/** Check if the client accepts gzip encoding */
function acceptsGzip(req: IncomingMessage): boolean {
  const ae = req.headers["accept-encoding"];
  return typeof ae === "string" && ae.includes("gzip");
}

/** Determine cache-control header based on path.
 *  Vite hashed assets (e.g. /assets/index-CSIfFBC3.js) are immutable — cache for 1 year.
 *  Everything else uses no-cache for revalidation. */
function cacheControlFor(urlPath: string): string {
  if (urlPath.includes("/assets/")) {
    return "public, max-age=31536000, immutable";
  }
  return "no-cache";
}

function getCompressed(filePath: string, ext: string): { raw: Buffer; gzip: Buffer | null } {
  const isCompressible = COMPRESSIBLE_EXTS.has(ext);
  // Read the file first — if it doesn't exist, let the caller handle the throw.
  // Previously, a failed statSync would fall through to readFileSync which could
  // throw again (race condition if file is deleted between stat and read).
  let raw: Buffer;
  let mtime: number;
  try {
    const stat = fs.statSync(filePath);
    mtime = stat.mtimeMs;
    // Check cache before reading file content
    const cached = _compressedCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return { raw: cached.raw, gzip: isCompressible ? cached.gzip : null };
    }
    raw = fs.readFileSync(filePath);
  } catch (err) {
    // File may have been deleted or become inaccessible — throw a clean error
    // instead of crashing with an unhandled exception deeper in the stack.
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw err; // Caller (serveFile) should catch and return 404
    }
    // For permission errors or other I/O issues, still throw so the request
    // handler can respond with an appropriate HTTP status.
    throw err;
  }
  const gzip = isCompressible ? zlib.gzipSync(raw, { level: 6 }) : raw;
  // Evict oldest entries if cache is full
  if (_compressedCache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = _compressedCache.keys().next().value;
    if (firstKey) _compressedCache.delete(firstKey);
  }
  _compressedCache.set(filePath, { raw, gzip, mtime });
  return { raw, gzip: isCompressible ? gzip : null };
}

function serveFile(res: ServerResponse, filePath: string, req?: IncomingMessage, urlPath?: string) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    const { raw, gzip } = getCompressed(filePath, ext);
    res.setHeader("Content-Type", contentTypeForExt(ext));
    res.setHeader("Cache-Control", cacheControlFor(urlPath ?? ""));
    if (gzip && req && acceptsGzip(req)) {
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Content-Length", gzip.length);
      res.end(gzip);
    } else {
      res.setHeader("Content-Length", raw.length);
      res.end(raw);
    }
  } catch (err) {
    // File read failed (deleted, permission denied, etc.) — respond with
    // appropriate HTTP status instead of crashing the request handler.
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      respondNotFound(res);
    } else {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Internal Server Error");
    }
  }
}

interface ControlUiInjectionOpts {
  basePath: string;
  assistantName?: string;
  assistantAvatar?: string;
  /** Gateway auth token for automatic authentication (injected as window.__CLAWDBOT_GATEWAY_TOKEN__) */
  gatewayToken?: string;
}

function injectControlUiConfig(html: string, opts: ControlUiInjectionOpts): string {
  const { basePath, assistantName, assistantAvatar, gatewayToken } = opts;
  const script =
    `<script>` +
    `window.__CLAWDBOT_CONTROL_UI_BASE_PATH__=${JSON.stringify(basePath)};` +
    `window.__CLAWDBOT_ASSISTANT_NAME__=${JSON.stringify(
      assistantName ?? DEFAULT_ASSISTANT_IDENTITY.name,
    )};` +
    `window.__CLAWDBOT_ASSISTANT_AVATAR__=${JSON.stringify(
      assistantAvatar ?? DEFAULT_ASSISTANT_IDENTITY.avatar,
    )};` +
    // Inject gateway token for automatic authentication (allows users to access UI without token in URL)
    (gatewayToken ? `window.__CLAWDBOT_GATEWAY_TOKEN__=${JSON.stringify(gatewayToken)};` : "") +
    `</script>`;
  // Check if already injected
  if (html.includes("__CLAWDBOT_ASSISTANT_NAME__")) return html;
  const headClose = html.indexOf("</head>");
  if (headClose !== -1) {
    return `${html.slice(0, headClose)}${script}${html.slice(headClose)}`;
  }
  return `${script}${html}`;
}

interface ServeIndexHtmlOpts {
  basePath: string;
  config?: ClawdbotConfig;
  agentId?: string;
  /** Gateway auth token for automatic authentication */
  gatewayToken?: string;
}

function serveIndexHtml(
  res: ServerResponse,
  indexPath: string,
  opts: ServeIndexHtmlOpts,
  req?: IncomingMessage,
) {
  try {
    const { basePath, config, agentId, gatewayToken } = opts;
    const identity = config
      ? resolveAssistantIdentity({ cfg: config, agentId })
      : DEFAULT_ASSISTANT_IDENTITY;
    const resolvedAgentId =
      typeof (identity as { agentId?: string }).agentId === "string"
        ? (identity as { agentId?: string }).agentId
        : agentId;
    const avatarValue =
      resolveAssistantAvatarUrl({
        avatar: identity.avatar,
        agentId: resolvedAgentId,
        basePath,
      }) ?? identity.avatar;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    const raw = fs.readFileSync(indexPath, "utf8");
    const body = injectControlUiConfig(raw, {
      basePath,
      assistantName: identity.name,
      assistantAvatar: avatarValue,
      gatewayToken,
    });
    // Compress index.html (typically ~15KB raw, ~4KB gzipped)
    if (req && acceptsGzip(req)) {
      const compressed = zlib.gzipSync(Buffer.from(body, "utf8"), { level: 6 });
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Content-Length", compressed.length);
      res.end(compressed);
    } else {
      const buf = Buffer.from(body, "utf8");
      res.setHeader("Content-Length", buf.length);
      res.end(buf);
    }
  } catch (err) {
    // Prevent unhandled exceptions from crashing the gateway when index.html
    // becomes inaccessible (file deleted, disk error, race condition).
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      respondNotFound(res);
    } else if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Internal Server Error");
    }
  }
}

function isSafeRelativePath(relPath: string) {
  if (!relPath) return false;
  const normalized = path.posix.normalize(relPath);
  if (normalized.startsWith("../") || normalized === "..") return false;
  if (normalized.includes("\0")) return false;
  return true;
}

export function handleControlUiHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts?: ControlUiRequestOptions,
): boolean {
  const urlRaw = req.url;
  if (!urlRaw) return false;
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return true;
  }

  const url = new URL(urlRaw, "http://localhost");
  const basePath = normalizeControlUiBasePath(opts?.basePath);
  const pathname = url.pathname;

  if (!basePath) {
    if (pathname === "/ui" || pathname.startsWith("/ui/")) {
      respondNotFound(res);
      return true;
    }
  }

  if (basePath) {
    if (pathname === basePath) {
      res.statusCode = 302;
      res.setHeader("Location", `${basePath}/${url.search}`);
      res.end();
      return true;
    }
    if (!pathname.startsWith(`${basePath}/`)) return false;
  }

  const root = resolveControlUiRoot();
  if (!root) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(
      "Control UI assets not found. Build them with `pnpm ui:build` (auto-installs UI deps), or run `pnpm ui:dev` during development.",
    );
    return true;
  }

  const uiPath =
    basePath && pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : pathname;
  const rel = (() => {
    if (uiPath === ROOT_PREFIX) return "";
    const assetsIndex = uiPath.indexOf("/assets/");
    if (assetsIndex >= 0) return uiPath.slice(assetsIndex + 1);
    return uiPath.slice(1);
  })();
  const requested = rel && !rel.endsWith("/") ? rel : `${rel}index.html`;
  const fileRel = requested || "index.html";
  if (!isSafeRelativePath(fileRel)) {
    respondNotFound(res);
    return true;
  }

  const filePath = path.join(root, fileRel);
  if (!filePath.startsWith(root)) {
    respondNotFound(res);
    return true;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    if (path.basename(filePath) === "index.html") {
      serveIndexHtml(
        res,
        filePath,
        {
          basePath,
          config: opts?.config,
          agentId: opts?.agentId,
          gatewayToken: opts?.gatewayToken,
        },
        req,
      );
      return true;
    }
    serveFile(res, filePath, req, uiPath);
    return true;
  }

  // SPA fallback (client-side router): serve index.html for unknown paths.
  const indexPath = path.join(root, "index.html");
  if (fs.existsSync(indexPath)) {
    serveIndexHtml(
      res,
      indexPath,
      {
        basePath,
        config: opts?.config,
        agentId: opts?.agentId,
        gatewayToken: opts?.gatewayToken,
      },
      req,
    );
    return true;
  }

  respondNotFound(res);
  return true;
}
