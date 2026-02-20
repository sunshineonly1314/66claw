import type { Tab } from "./navigation";
import { connectGateway } from "./app-gateway";
import {
  applySettingsFromUrl,
  attachThemeListener,
  detachThemeListener,
  inferBasePath,
  syncTabWithLocation,
  syncThemeWithSettings,
} from "./app-settings";
import { observeTopbar, scheduleChatScroll, scheduleLogsScroll } from "./app-scroll";
import {
  startLogsPolling,
  startNodesPolling,
  stopLogsPolling,
  stopNodesPolling,
  startDebugPolling,
  stopDebugPolling,
  startMcpPolling,
  stopMcpPolling,
} from "./app-polling";

type LifecycleHost = {
  basePath: string;
  tab: Tab;
  chatHasAutoScrolled: boolean;
  chatLoading: boolean;
  chatMessages: unknown[];
  chatToolMessages: unknown[];
  chatStream: string | null;
  chatStreamStartedAt: number | null;
  logsAutoFollow: boolean;
  logsAtBottom: boolean;
  logsEntries: unknown[];
  popStateHandler: () => void;
  topbarObserver: ResizeObserver | null;
  readingIndicatorTimer: number | null;
  apiMonitorTimer: number | null;
  apiMonitorElapsedMs: number;
  apiMonitorDismissed: boolean;
  requestUpdate: () => void;
};

export function handleConnected(host: LifecycleHost) {
  host.basePath = inferBasePath();
  syncTabWithLocation(
    host as unknown as Parameters<typeof syncTabWithLocation>[0],
    true,
  );
  syncThemeWithSettings(
    host as unknown as Parameters<typeof syncThemeWithSettings>[0],
  );
  attachThemeListener(
    host as unknown as Parameters<typeof attachThemeListener>[0],
  );
  window.addEventListener("popstate", host.popStateHandler);
  applySettingsFromUrl(
    host as unknown as Parameters<typeof applySettingsFromUrl>[0],
  );

  const settingsHost = host as unknown as Parameters<typeof connectGateway>[0];
  // Detect desktop mode: Tauri on Windows uses http://tauri.localhost
  const isDesktop =
    window.location.hostname === "tauri.localhost" ||
    Boolean(
      (window as Record<string, unknown>).__TAURI__ ||
      (window as Record<string, unknown>).__TAURI_INTERNALS__,
    );

  if (isDesktop) {
    // Desktop mode (Tauri): Rust injects a fresh token via hash on every launch.
    // Old cached tokens are invalid after gateway restart, so always wait for
    // the new one. Clear any stale token to avoid a failed connection attempt.
    settingsHost.settings = { ...settingsHost.settings, token: "", gatewayUrl: "" };
    const onHash = () => {
      applySettingsFromUrl(
        host as unknown as Parameters<typeof applySettingsFromUrl>[0],
      );
      if (settingsHost.settings.token && settingsHost.settings.token.trim()) {
        window.removeEventListener("hashchange", onHash);
        connectGateway(settingsHost);
      }
    };
    window.addEventListener("hashchange", onHash);
    // If hash already has token (e.g. Rust already injected), fire immediately
    if (window.location.hash.includes("token=")) {
      onHash();
    }
  } else {
    // Browser mode: connect immediately with whatever token is available
    connectGateway(settingsHost);
  }

  startNodesPolling(host as unknown as Parameters<typeof startNodesPolling>[0]);
  startMcpPolling(host as unknown as Parameters<typeof startMcpPolling>[0]);
  if (host.tab === "logs") {
    startLogsPolling(host as unknown as Parameters<typeof startLogsPolling>[0]);
  }
  if (host.tab === "debug") {
    startDebugPolling(host as unknown as Parameters<typeof startDebugPolling>[0]);
  }
}

export function handleFirstUpdated(host: LifecycleHost) {
  observeTopbar(host as unknown as Parameters<typeof observeTopbar>[0]);
}

export function handleDisconnected(host: LifecycleHost) {
  window.removeEventListener("popstate", host.popStateHandler);
  stopNodesPolling(host as unknown as Parameters<typeof stopNodesPolling>[0]);
  stopLogsPolling(host as unknown as Parameters<typeof stopLogsPolling>[0]);
  stopDebugPolling(host as unknown as Parameters<typeof stopDebugPolling>[0]);
  stopMcpPolling(host as unknown as Parameters<typeof stopMcpPolling>[0]);
  detachThemeListener(
    host as unknown as Parameters<typeof detachThemeListener>[0],
  );
  host.topbarObserver?.disconnect();
  host.topbarObserver = null;
  // Clean up reading indicator timer
  if (host.readingIndicatorTimer !== null) {
    window.clearInterval(host.readingIndicatorTimer);
    host.readingIndicatorTimer = null;
  }
  // Clean up API monitor timer
  if (host.apiMonitorTimer !== null) {
    window.clearInterval(host.apiMonitorTimer);
    host.apiMonitorTimer = null;
  }
}

export function handleUpdated(
  host: LifecycleHost,
  changed: Map<PropertyKey, unknown>,
) {
  if (
    host.tab === "chat" &&
    (changed.has("chatMessages") ||
      changed.has("chatToolMessages") ||
      changed.has("chatStream") ||
      changed.has("chatLoading") ||
      changed.has("tab"))
  ) {
    const forcedByTab = changed.has("tab");
    const forcedByLoad =
      changed.has("chatLoading") &&
      changed.get("chatLoading") === true &&
      host.chatLoading === false;
    scheduleChatScroll(
      host as unknown as Parameters<typeof scheduleChatScroll>[0],
      forcedByTab || forcedByLoad || !host.chatHasAutoScrolled,
    );
  }
  if (
    host.tab === "logs" &&
    (changed.has("logsEntries") || changed.has("logsAutoFollow") || changed.has("tab"))
  ) {
    if (host.logsAutoFollow && host.logsAtBottom) {
      scheduleLogsScroll(
        host as unknown as Parameters<typeof scheduleLogsScroll>[0],
        changed.has("tab") || changed.has("logsAutoFollow"),
      );
    }
  }

  // Reading indicator timer - refresh every second when waiting for first response
  if (changed.has("chatStream") || changed.has("chatStreamStartedAt")) {
    const isWaitingForResponse =
      host.chatStream !== null &&
      host.chatStream.trim().length === 0 &&
      host.chatStreamStartedAt !== null;

    if (isWaitingForResponse && host.readingIndicatorTimer === null) {
      // Start timer to refresh reading indicator.
      // Use 3s interval instead of 1s to reduce full-tree re-renders which
      // cause visible flickering on macOS packaged builds (WebView compositing).
      // The reading indicator shows "Ns" elapsed — 3s granularity is acceptable.
      host.readingIndicatorTimer = window.setInterval(() => {
        host.requestUpdate();
      }, 3000);
    } else if (!isWaitingForResponse && host.readingIndicatorTimer !== null) {
      // Stop timer when no longer waiting
      window.clearInterval(host.readingIndicatorTimer);
      host.readingIndicatorTimer = null;
    }

    // API Response Monitor timer
    if (isWaitingForResponse && host.apiMonitorTimer === null) {
      host.apiMonitorDismissed = false;
      host.apiMonitorTimer = window.setInterval(() => {
        if (host.chatStreamStartedAt !== null) {
          const next = Date.now() - host.chatStreamStartedAt;
          // Only update the reactive property when the displayed second actually
          // changes.  This avoids triggering a Lit re-render every interval tick
          // when the rounded second value hasn't changed.
          if (Math.floor(next / 1000) !== Math.floor(host.apiMonitorElapsedMs / 1000)) {
            host.apiMonitorElapsedMs = next;
          }
        }
      }, 1000);
    } else if (!isWaitingForResponse && host.apiMonitorTimer !== null) {
      window.clearInterval(host.apiMonitorTimer);
      host.apiMonitorTimer = null;
      // Keep elapsed visible briefly for "completed" transition, then clear
      if (host.apiMonitorElapsedMs > 0) {
        const elapsed = host.apiMonitorElapsedMs;
        setTimeout(() => {
          if (host.apiMonitorElapsedMs === elapsed) {
            host.apiMonitorElapsedMs = 0;
          }
        }, 3000);
      }
    }
  }
}
