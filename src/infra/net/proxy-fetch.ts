/**
 * Shared proxy-aware fetch factory.
 *
 * Reads HTTP_PROXY / HTTPS_PROXY / http_proxy / https_proxy from env
 * and returns a fetch function that routes through the proxy.
 *
 * If no proxy env var is set, returns the global fetch unchanged.
 *
 * Usage:
 *   const fetcher = getProxyAwareFetch();
 *   const res = await fetcher("https://example.com", { signal });
 */

import { ProxyAgent, fetch as undiciFetch } from "undici";
import { wrapFetchWithAbortSignal } from "../fetch.js";

let _cachedProxyFetch: typeof fetch | null = null;
let _cachedProxyUrl: string | null = null;

/**
 * Detect proxy URL from environment variables.
 * Priority: HTTPS_PROXY > HTTP_PROXY > https_proxy > http_proxy
 */
export function detectProxyUrl(): string | undefined {
  const url =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy;
  return url?.trim() || undefined;
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
 * Get a proxy-aware fetch function.
 *
 * - If HTTP_PROXY / HTTPS_PROXY is set → routes through proxy
 * - Otherwise → returns global fetch unchanged
 *
 * Caches the proxy agent so repeated calls don't create new connections.
 */
export function getProxyAwareFetch(): typeof fetch {
  const proxyUrl = detectProxyUrl();

  if (!proxyUrl) {
    return globalThis.fetch;
  }

  // Reuse cached proxy fetch if same URL
  if (_cachedProxyFetch && _cachedProxyUrl === proxyUrl) {
    return _cachedProxyFetch;
  }

  _cachedProxyFetch = makeProxyFetch(proxyUrl);
  _cachedProxyUrl = proxyUrl;
  return _cachedProxyFetch;
}
