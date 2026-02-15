import type { OpenClawCNConfig, PluginRuntime } from "openclawcn/plugin-sdk";
import type { BlueBubblesAccountConfig } from "./types.js";
import type { ResolvedBlueBubblesAccount } from "./accounts.js";

/** Default webhook path for BlueBubbles webhook handling. */
export const DEFAULT_WEBHOOK_PATH = "/bluebubbles-webhook";

/** Runtime logging environment passed to webhook targets. */
export type BlueBubblesRuntimeEnv = {
  log?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

/** Core runtime (the full plugin runtime). */
export type BlueBubblesCoreRuntime = PluginRuntime;

/** A registered webhook target that receives incoming webhook events. */
export type WebhookTarget = {
  account: ResolvedBlueBubblesAccount;
  config: OpenClawCNConfig;
  runtime: BlueBubblesRuntimeEnv;
  core: BlueBubblesCoreRuntime;
  path: string;
  statusSink?: (status: { lastInboundAt?: number }) => void;
};

/** Options for starting the BlueBubbles monitor/provider. */
export type BlueBubblesMonitorOptions = {
  account: ResolvedBlueBubblesAccount;
  config: OpenClawCNConfig;
  runtime: BlueBubblesRuntimeEnv;
  abortSignal?: AbortSignal;
  statusSink?: (status: { lastInboundAt?: number }) => void;
  webhookPath?: string;
};

/**
 * Normalize a webhook path for consistent key lookup.
 * Ensures leading slash, trims whitespace, lowercases, and removes trailing slashes.
 */
export function normalizeWebhookPath(rawPath: string): string {
  let p = rawPath.trim().toLowerCase();
  if (!p.startsWith("/")) {
    p = "/" + p;
  }
  // Remove trailing slashes (except for root "/")
  while (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  return p;
}

/**
 * Resolve the webhook path from the account config (for display/registration).
 * Returns the configured webhookPath or the default.
 */
export function resolveWebhookPathFromConfig(
  config: BlueBubblesAccountConfig,
): string {
  const raw = config.webhookPath?.trim();
  return raw || DEFAULT_WEBHOOK_PATH;
}
