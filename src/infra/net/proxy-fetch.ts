/**
 * Shared proxy-aware fetch factory.
 *
 * Reads HTTP_PROXY / HTTPS_PROXY / http_proxy / https_proxy from env
 * and returns a fetch function that routes through the proxy.
 *
 * If no proxy env var is set, attempts auto-discovery of common local proxy
 * ports (Clash, V2Ray, Shadowsocks, etc.) on Windows/macOS.
 *
 * After discovery, patches globalThis.fetch so that PI SDK (streamSimple)
 * and any other code using native fetch will route international API calls
 * through the proxy while keeping domestic/local requests direct.
 *
 * If no proxy is found, returns the global fetch unchanged.
 *
 * Usage:
 *   // At startup (once):
 *   await initProxyDiscovery({ hasInternationalProvider: true });
 *
 *   // Then anywhere:
 *   const fetcher = getProxyAwareFetch();
 *   const res = await fetcher("https://example.com", { signal });
 */

import net from "node:net";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { wrapFetchWithAbortSignal } from "../fetch.js";

let _cachedProxyFetch: typeof fetch | null = null;
let _cachedProxyUrl: string | null = null;

/** Result of auto-discovery, cached for process lifetime. */
let _discoveredProxyUrl: string | undefined;
let _discoveryDone = false;

/** Original globalThis.fetch before patching */
let _originalFetch: typeof fetch | null = null;

// ---------------------------------------------------------------------------
// Common proxy ports to probe
// ---------------------------------------------------------------------------

const PROXY_PROBE_PORTS = [
  { port: 7890, name: "Clash" },
  { port: 7897, name: "Clash Verge" },
  { port: 7898, name: "Clash Meta" },
  { port: 10808, name: "V2RayN" },
  { port: 1080, name: "Shadowsocks" },
  { port: 1081, name: "Shadowsocks Alt" },
  { port: 8080, name: "HTTP Proxy" },
] as const;

const PROBE_TIMEOUT_MS = 500;

// ---------------------------------------------------------------------------
// International domains that need proxy (GFW-blocked)
// ---------------------------------------------------------------------------

/**
 * Domains of international API providers that require proxy in China.
 * Domestic providers (百炼, 火山方舟, 智谱, DeepSeek, etc.) go direct.
 */
const PROXY_REQUIRED_DOMAINS = new Set([
  // OpenAI
  "api.openai.com",
  "chatgpt.com",
  // Anthropic
  "api.anthropic.com",
  // Google
  "generativelanguage.googleapis.com",
  "googleapis.com",
  // NVIDIA
  "integrate.api.nvidia.com",
  "api.nvidia.com",
  // OpenRouter
  "openrouter.ai",
  // GitHub (for voice-install etc.)
  "github.com",
  "api.github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  // Hugging Face
  "huggingface.co",
  "api-inference.huggingface.co",
  // npm registry (for install tasks)
  "registry.npmjs.org",
]);

/**
 * Check if a URL targets an international domain that needs proxy.
 */
function needsProxy(input: string | URL | Request): boolean {
  try {
    let urlStr: string;
    if (typeof input === "string") {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.href;
    } else if (input && typeof (input as Request).url === "string") {
      urlStr = (input as Request).url;
    } else {
      return false;
    }

    const hostname = new URL(urlStr).hostname.toLowerCase();

    // Exact match
    if (PROXY_REQUIRED_DOMAINS.has(hostname)) return true;

    // Suffix match for subdomains (e.g. *.googleapis.com)
    for (const domain of PROXY_REQUIRED_DOMAINS) {
      if (hostname.endsWith(`.${domain}`)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// TCP port probe
// ---------------------------------------------------------------------------

function probePort(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, PROBE_TIMEOUT_MS);

    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

// ---------------------------------------------------------------------------
// Auto-discovery
// ---------------------------------------------------------------------------

/**
 * Probe common local proxy ports in parallel.
 * Returns the first reachable proxy URL, or undefined if none found.
 *
 * Only runs on Windows and macOS — Linux servers typically don't need this.
 */
async function autoDiscoverProxy(): Promise<string | undefined> {
  const platform = process.platform;
  if (platform !== "win32" && platform !== "darwin") {
    return undefined;
  }

  const results = await Promise.all(
    PROXY_PROBE_PORTS.map(async ({ port, name }) => {
      const ok = await probePort(port);
      return { port, name, ok };
    }),
  );

  const found = results.find((r) => r.ok);
  if (found) {
    const url = `http://127.0.0.1:${found.port}`;
    console.info(
      `[proxy-fetch] auto-discovered local proxy: ${url} (${found.name}, port ${found.port})`,
    );
    return url;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// globalThis.fetch patching — smart routing by domain
// ---------------------------------------------------------------------------

/**
 * Patch globalThis.fetch with a smart wrapper that routes:
 * - International API domains → through proxy (undici ProxyAgent)
 * - Everything else (domestic APIs, localhost) → direct (original fetch)
 *
 * This ensures PI SDK's streamSimple() (which uses globalThis.fetch)
 * automatically goes through the proxy for OpenAI/Anthropic/Google etc.
 * without affecting domestic providers like 百炼/火山方舟/智谱/DeepSeek.
 */
function patchGlobalFetch(proxyUrl: string): void {
  if (_originalFetch) return; // already patched

  _originalFetch = globalThis.fetch;
  const proxyFetcher = makeProxyFetch(proxyUrl);

  globalThis.fetch = function smartProxyFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (needsProxy(input)) {
      return proxyFetcher(input, init);
    }
    return _originalFetch!(input, init);
  } as typeof fetch;

  console.info(
    "[proxy-fetch] patched globalThis.fetch — international APIs → proxy, domestic APIs → direct",
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect proxy URL from environment variables.
 * Priority: HTTPS_PROXY > HTTP_PROXY > https_proxy > http_proxy
 *
 * Falls back to auto-discovered proxy if env vars are not set and
 * `initProxyDiscovery()` has been called.
 */
export function detectProxyUrl(): string | undefined {
  const url =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy;

  if (url?.trim()) {
    return url.trim();
  }

  // Fallback: use auto-discovered proxy (if any)
  if (_discoveryDone && _discoveredProxyUrl) {
    return _discoveredProxyUrl;
  }

  return undefined;
}

/**
 * Create a fetch function that routes through the given proxy URL.
 */
export function makeProxyFetch(proxyUrl: string): typeof fetch {
  const agent = new ProxyAgent(proxyUrl);
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) =>
    undiciFetch(input as string | URL, {
      ...(init as Record<string, unknown>),
      dispatcher: agent,
    }) as unknown as Promise<Response>) as typeof fetch;
  return wrapFetchWithAbortSignal(fetcher);
}

/**
 * Run proxy auto-discovery once at startup.
 *
 * Only probes local proxy ports when:
 *   1. No HTTPS_PROXY / HTTP_PROXY env var is already set, AND
 *   2. The user has configured at least one international provider
 *      (OpenAI, Anthropic, Google, NVIDIA, OpenRouter).
 *
 * If the user only uses domestic providers, no discovery is performed
 * and all requests go direct (no proxy overhead).
 *
 * When a proxy is discovered, globalThis.fetch is patched with a smart
 * router that only sends international API calls through the proxy.
 * Domestic API calls (百炼, 火山方舟, 智谱, DeepSeek, etc.) always go direct.
 *
 * Call this early in the server boot sequence so that subsequent calls to
 * `getProxyAwareFetch()` and globalThis.fetch can use the discovered proxy.
 *
 * Safe to call multiple times — only the first invocation actually probes.
 */
export async function initProxyDiscovery(opts?: {
  hasInternationalProvider?: boolean;
}): Promise<void> {
  if (_discoveryDone) return;

  // Skip discovery if env vars already provide a proxy
  const envProxy =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy;

  if (envProxy?.trim()) {
    // User set proxy manually — patch globalThis.fetch for smart routing
    // so domestic APIs don't go through proxy unnecessarily
    patchGlobalFetch(envProxy.trim());
    _discoveryDone = true;
    return;
  }

  // Skip discovery if no international provider is configured
  if (!opts?.hasInternationalProvider) {
    _discoveryDone = true;
    return;
  }

  _discoveredProxyUrl = await autoDiscoverProxy();
  _discoveryDone = true;

  // Patch globalThis.fetch if we found a proxy
  if (_discoveredProxyUrl) {
    patchGlobalFetch(_discoveredProxyUrl);
  }
}

/**
 * Get a proxy-aware fetch function.
 *
 * - If HTTP_PROXY / HTTPS_PROXY is set → routes through proxy
 * - If auto-discovery found a local proxy → routes through it
 * - Otherwise → returns global fetch unchanged
 *
 * Note: after initProxyDiscovery(), globalThis.fetch is already patched
 * with smart domain-based routing. This function is still useful for
 * callers that explicitly want proxy fetch (e.g., voice-install downloading
 * from GitHub).
 *
 * Caches the proxy agent so repeated calls don't create new connections.
 */
export function getProxyAwareFetch(): typeof fetch {
  const proxyUrl = detectProxyUrl();

  if (!proxyUrl) {
    return _originalFetch ?? globalThis.fetch;
  }

  // Reuse cached proxy fetch if same URL
  if (_cachedProxyFetch && _cachedProxyUrl === proxyUrl) {
    return _cachedProxyFetch;
  }

  _cachedProxyFetch = makeProxyFetch(proxyUrl);
  _cachedProxyUrl = proxyUrl;
  return _cachedProxyFetch;
}
