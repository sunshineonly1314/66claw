import type { CliDeps } from "../cli/deps.js";
import { resolveAnnounceTargetFromKey } from "../agents/tools/sessions-send-helpers.js";
import { normalizeChannelId } from "../channels/plugins/index.js";
import { resolveMainSessionKeyFromConfig } from "../config/sessions.js";
import { deliverOutboundPayloads } from "../infra/outbound/deliver.js";
import { resolveOutboundTarget } from "../infra/outbound/targets.js";
import {
  consumeRestartSentinel,
  formatRestartSentinelMessage,
  summarizeRestartSentinel,
} from "../infra/restart-sentinel.js";
import { enqueueSystemEvent } from "../infra/system-events.js";
import { VERSION } from "../version.js";
import { deliveryContextFromSession, mergeDeliveryContext } from "../utils/delivery-context.js";
import { loadSessionEntry } from "./session-utils.js";

export async function scheduleRestartSentinelWake(_params: { deps: CliDeps }) {
  const sentinel = await consumeRestartSentinel();
  if (!sentinel) {
    return;
  }
  const payload = sentinel.payload;

  // S5-1: 更新重启后验证版本号是否真的变了
  if (payload.kind === "update" && payload.stats?.after?.version) {
    const expectedVersion = payload.stats.after.version as string;
    if (VERSION !== expectedVersion) {
      console.warn(
        `[restart-sentinel] update version mismatch: expected v${expectedVersion}, running v${VERSION}. ` +
          `Update may not have applied correctly.`,
      );
    }
  }

  // Config-apply / config-patch restarts are routine operations triggered by
  // the user changing settings in the UI.  Injecting a "Gateway restart …"
  // system message into the chat is confusing — silently consume the sentinel.
  if (payload.kind === "config-apply" || payload.kind === "config-patch") {
    return;
  }

  const sessionKey = payload.sessionKey?.trim();
  const message = formatRestartSentinelMessage(payload);
  const summary = summarizeRestartSentinel(payload);

  if (!sessionKey) {
    const mainSessionKey = resolveMainSessionKeyFromConfig();
    enqueueSystemEvent(message, { sessionKey: mainSessionKey });
    return;
  }

  // Extract topic/thread ID from sessionKey (supports both :topic: and :thread:)
  // Telegram uses :topic:, other platforms use :thread:
  const topicIndex = sessionKey.lastIndexOf(":topic:");
  const threadIndex = sessionKey.lastIndexOf(":thread:");
  const markerIndex = Math.max(topicIndex, threadIndex);
  const marker = topicIndex > threadIndex ? ":topic:" : ":thread:";

  const baseSessionKey = markerIndex === -1 ? sessionKey : sessionKey.slice(0, markerIndex);
  const threadIdRaw =
    markerIndex === -1 ? undefined : sessionKey.slice(markerIndex + marker.length);
  const sessionThreadId = threadIdRaw?.trim() || undefined;

  const { cfg, entry } = loadSessionEntry(sessionKey);
  const parsedTarget = resolveAnnounceTargetFromKey(baseSessionKey);

  // Prefer delivery context from sentinel (captured at restart) over session store
  // Handles race condition where store wasn't flushed before restart
  const sentinelContext = payload.deliveryContext;
  let sessionDeliveryContext = deliveryContextFromSession(entry);
  if (!sessionDeliveryContext && markerIndex !== -1 && baseSessionKey) {
    const { entry: baseEntry } = loadSessionEntry(baseSessionKey);
    sessionDeliveryContext = deliveryContextFromSession(baseEntry);
  }

  const origin = mergeDeliveryContext(
    sentinelContext,
    mergeDeliveryContext(sessionDeliveryContext, parsedTarget ?? undefined),
  );

  const channelRaw = origin?.channel;
  const channel = channelRaw ? normalizeChannelId(channelRaw) : null;
  const to = origin?.to;
  if (!channel || !to) {
    enqueueSystemEvent(message, { sessionKey });
    return;
  }

  const resolved = resolveOutboundTarget({
    channel,
    to,
    cfg,
    accountId: origin?.accountId,
    mode: "implicit",
  });
  if (!resolved.ok) {
    enqueueSystemEvent(message, { sessionKey });
    return;
  }

  const threadId =
    payload.threadId ??
    parsedTarget?.threadId ?? // From resolveAnnounceTargetFromKey (extracts :topic:N)
    sessionThreadId ??
    (origin?.threadId != null ? String(origin.threadId) : undefined);

  try {
    await deliverOutboundPayloads({
      cfg,
      channel,
      to: resolved.to,
      accountId: origin?.accountId,
      threadId,
      payloads: [{ text: message }],
      bestEffort: true,
    });
  } catch (err) {
    enqueueSystemEvent(`${summary}\n${String(err)}`, { sessionKey });
  }
}

export function shouldWakeFromRestartSentinel() {
  return !process.env.VITEST && process.env.NODE_ENV !== "test";
}
