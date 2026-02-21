import type { EventLogEntry } from "./app-events.ts";
import type { OpenClawCNApp } from "./app.ts";
import type { ExecApprovalRequest } from "./controllers/exec-approval.ts";
import type { InstallProgress } from "./controllers/skills.ts";
import type { GatewayEventFrame, GatewayHelloOk } from "./gateway.ts";
import type { Tab } from "./navigation.ts";
import type { UiSettings } from "./storage.ts";
import type { AgentsListResult, PresenceEntry, HealthSnapshot, StatusSummary } from "./types.ts";
import type { LicenseDialogType, LicenseUiState } from "./license/types.ts";
import { CHAT_SESSIONS_ACTIVE_MINUTES, flushChatQueueForEvent } from "./app-chat.ts";
import {
  dismissRenewalReminderTemporarily,
  isTokenAuthError,
  refreshGatewayTokenFromServer,
  saveSettings,
} from "./storage.ts";
import {
  applySettings,
  loadCron,
  refreshActiveTab,
  setLastActiveSessionKey,
} from "./app-settings.ts";
import { handleAgentEvent, resetToolStream, type AgentEventPayload } from "./app-tool-stream.ts";
import { loadAgents } from "./controllers/agents.ts";
import { loadAssistantIdentity } from "./controllers/assistant-identity.ts";
import { loadChatHistory } from "./controllers/chat.ts";
import { handleChatEvent, type ChatEventPayload } from "./controllers/chat.ts";
import { loadDevices } from "./controllers/devices.ts";
import {
  addExecApproval,
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  removeExecApproval,
} from "./controllers/exec-approval.ts";
import { loadNodes } from "./controllers/nodes.ts";
import { loadSessions } from "./controllers/sessions.ts";
import { GatewayBrowserClient } from "./gateway.ts";

type GatewayHost = {
  settings: UiSettings;
  password: string;
  client: GatewayBrowserClient | null;
  connected: boolean;
  hello: GatewayHelloOk | null;
  lastError: string | null;
  onboarding?: boolean;
  eventLogBuffer: EventLogEntry[];
  eventLog: EventLogEntry[];
  tab: Tab;
  presenceEntries: PresenceEntry[];
  presenceError: string | null;
  presenceStatus: StatusSummary | null;
  agentsLoading: boolean;
  agentsList: AgentsListResult | null;
  agentsError: string | null;
  debugHealth: HealthSnapshot | null;
  assistantName: string;
  assistantAvatar: string | null;
  assistantAgentId: string | null;
  sessionKey: string;
  chatRunId: string | null;
  refreshSessionsAfterChat: Set<string>;
  execApprovalQueue: ExecApprovalRequest[];
  execApprovalError: string | null;
  skillsInstallProgress: Record<string, InstallProgress>;
};

type SessionDefaultsSnapshot = {
  defaultAgentId?: string;
  mainKey?: string;
  mainSessionKey?: string;
  scope?: string;
};

function normalizeSessionKeyForDefaults(
  value: string | undefined,
  defaults: SessionDefaultsSnapshot,
): string {
  const raw = (value ?? "").trim();
  const mainSessionKey = defaults.mainSessionKey?.trim();
  if (!mainSessionKey) {
    return raw;
  }
  if (!raw) {
    return mainSessionKey;
  }
  const mainKey = defaults.mainKey?.trim() || "main";
  const defaultAgentId = defaults.defaultAgentId?.trim();
  const isAlias =
    raw === "main" ||
    raw === mainKey ||
    (defaultAgentId &&
      (raw === `agent:${defaultAgentId}:main` || raw === `agent:${defaultAgentId}:${mainKey}`));
  return isAlias ? mainSessionKey : raw;
}

function applySessionDefaults(host: GatewayHost, defaults?: SessionDefaultsSnapshot) {
  if (!defaults?.mainSessionKey) {
    return;
  }
  const resolvedSessionKey = normalizeSessionKeyForDefaults(host.sessionKey, defaults);
  const resolvedSettingsSessionKey = normalizeSessionKeyForDefaults(
    host.settings.sessionKey,
    defaults,
  );
  const resolvedLastActiveSessionKey = normalizeSessionKeyForDefaults(
    host.settings.lastActiveSessionKey,
    defaults,
  );
  const nextSessionKey = resolvedSessionKey || resolvedSettingsSessionKey || host.sessionKey;
  const nextSettings = {
    ...host.settings,
    sessionKey: resolvedSettingsSessionKey || nextSessionKey,
    lastActiveSessionKey: resolvedLastActiveSessionKey || nextSessionKey,
  };
  const shouldUpdateSettings =
    nextSettings.sessionKey !== host.settings.sessionKey ||
    nextSettings.lastActiveSessionKey !== host.settings.lastActiveSessionKey;
  if (nextSessionKey !== host.sessionKey) {
    host.sessionKey = nextSessionKey;
  }
  if (shouldUpdateSettings) {
    applySettings(host as unknown as Parameters<typeof applySettings>[0], nextSettings);
  }
}

export function connectGateway(host: GatewayHost) {
  host.lastError = null;
  host.hello = null;
  host.connected = false;
  host.execApprovalQueue = [];
  host.execApprovalError = null;
  // FIX R3-9: 重连时清理上一轮连接遗留的 approval 过期定时器，
  // 防止旧定时器触发时错误操作新连接的 execApprovalQueue
  for (const tid of _approvalTimers.values()) {
    clearTimeout(tid);
  }
  _approvalTimers.clear();

  const previousClient = host.client;
  const client = new GatewayBrowserClient({
    url: host.settings.gatewayUrl,
    token: host.settings.token.trim() ? host.settings.token : undefined,
    password: host.password.trim() ? host.password : undefined,
    clientName: "openclawcn-control-ui",
    mode: "webchat",
    onHello: (hello) => {
      if (host.client !== client) {
        return;
      }
      host.connected = true;
      host.lastError = null;
      host.hello = hello;
      applySnapshot(host, hello);
      // Reset orphaned chat run state from before disconnect.
      // Any in-flight run's final event was lost during the disconnect window.
      host.chatRunId = null;
      (host as unknown as { chatStream: string | null }).chatStream = null;
      (host as unknown as { chatStreamStartedAt: number | null }).chatStreamStartedAt = null;
      resetToolStream(host as unknown as Parameters<typeof resetToolStream>[0]);
      void loadAssistantIdentity(host as unknown as OpenClawCNApp);
      void loadAgents(host as unknown as OpenClawCNApp);
      void loadNodes(host as unknown as OpenClawCNApp, { quiet: true });
      void loadDevices(host as unknown as OpenClawCNApp, { quiet: true });
      void loadLicenseStatus(host as unknown as LicenseLoadHost);
      void refreshActiveTab(host as unknown as Parameters<typeof refreshActiveTab>[0]);
      // Desktop first-run: auto-navigate to model-config if no providers configured
      void detectFirstRunSetup(host);
    },
    onClose: ({ code, reason }) => {
      if (host.client !== client) {
        return;
      }
      host.connected = false;
      // Code 1012 = Service Restart (expected during config saves, don't show as error)
      if (code !== 1012) {
        host.lastError = `disconnected (${code}): ${reason || "no reason"}`;
      }
      // Auto-refresh token on auth failure and reconnect
      if (isTokenAuthError(reason)) {
        void refreshGatewayTokenFromServer().then((newToken) => {
          if (newToken && newToken !== host.settings.token) {
            host.settings = { ...host.settings, token: newToken };
            saveSettings(host.settings);
            connectGateway(host);
          }
        });
      }
    },
    onEvent: (evt) => {
      if (host.client !== client) {
        return;
      }
      handleGatewayEvent(host, evt);
    },
    onGap: ({ expected, received }) => {
      if (host.client !== client) {
        return;
      }
      host.lastError = `event gap detected (expected seq ${expected}, got ${received}); refresh recommended`;
    },
  });
  host.client = client;
  previousClient?.stop();
  client.start();
}

// FIX BUG-R2-9: 跟踪 exec approval 过期定时器，支持提前清理
const _approvalTimers = new Map<string, number>();

export function handleGatewayEvent(host: GatewayHost, evt: GatewayEventFrame) {
  try {
    handleGatewayEventUnsafe(host, evt);
  } catch (err) {
    console.error("[gateway] handleGatewayEvent error:", evt.event, err);
  }
}

function handleGatewayEventUnsafe(host: GatewayHost, evt: GatewayEventFrame) {
  host.eventLogBuffer = [
    { ts: Date.now(), event: evt.event, payload: evt.payload },
    ...host.eventLogBuffer,
  ].slice(0, 250);
  if (host.tab === "debug") {
    host.eventLog = host.eventLogBuffer;
  }

  if (evt.event === "agent") {
    if (host.onboarding) {
      return;
    }
    handleAgentEvent(
      host as unknown as Parameters<typeof handleAgentEvent>[0],
      evt.payload as AgentEventPayload | undefined,
    );
    return;
  }

  if (evt.event === "chat") {
    const payload = evt.payload as ChatEventPayload | undefined;
    if (payload?.sessionKey) {
      setLastActiveSessionKey(
        host as unknown as Parameters<typeof setLastActiveSessionKey>[0],
        payload.sessionKey,
      );
    }
    const state = handleChatEvent(host as unknown as OpenClawCNApp, payload);
    if (state === "final" || state === "final_failover" || state === "error" || state === "aborted") {
      resetToolStream(host as unknown as Parameters<typeof resetToolStream>[0]);
      void flushChatQueueForEvent(host as unknown as Parameters<typeof flushChatQueueForEvent>[0]);
      const runId = payload?.runId;
      if (runId && host.refreshSessionsAfterChat.has(runId)) {
        host.refreshSessionsAfterChat.delete(runId);
        if (state === "final") {
          void loadSessions(host as unknown as OpenClawCNApp, {
            activeMinutes: CHAT_SESSIONS_ACTIVE_MINUTES,
          });
        }
      }
    }
    if (state === "final" || state === "final_failover") {
      void loadChatHistory(host as unknown as OpenClawCNApp);
    }
    return;
  }

  if (evt.event === "presence") {
    const payload = evt.payload as { presence?: PresenceEntry[] } | undefined;
    if (payload?.presence && Array.isArray(payload.presence)) {
      host.presenceEntries = payload.presence;
      host.presenceError = null;
      host.presenceStatus = null;
    }
    return;
  }

  if (evt.event === "cron" && host.tab === "cron") {
    void loadCron(host as unknown as Parameters<typeof loadCron>[0]);
  }

  if (evt.event === "device.pair.requested" || evt.event === "device.pair.resolved") {
    void loadDevices(host as unknown as OpenClawCNApp, { quiet: true });
  }

  if (evt.event === "exec.approval.requested") {
    const entry = parseExecApprovalRequested(evt.payload);
    if (entry) {
      host.execApprovalQueue = addExecApproval(host.execApprovalQueue, entry);
      host.execApprovalError = null;
      // FIX BUG-R2-9: 存储定时器引用，在 resolved 或重连时可以清理
      const delay = Math.max(0, entry.expiresAtMs - Date.now() + 500);
      const timerId = window.setTimeout(() => {
        host.execApprovalQueue = removeExecApproval(host.execApprovalQueue, entry.id);
        _approvalTimers.delete(entry.id);
      }, delay);
      _approvalTimers.set(entry.id, timerId);
    }
    return;
  }

  if (evt.event === "exec.approval.resolved") {
    const resolved = parseExecApprovalResolved(evt.payload);
    if (resolved) {
      host.execApprovalQueue = removeExecApproval(host.execApprovalQueue, resolved.id);
      // FIX BUG-R2-9: 清理已解决审批的定时器
      const tid = _approvalTimers.get(resolved.id);
      if (tid != null) {
        clearTimeout(tid);
        _approvalTimers.delete(resolved.id);
      }
    }
  }

  // Skill install progress broadcast from backend
  if (evt.event === "skill.install.progress") {
    const payload = evt.payload as {
      skillName?: string;
      stage?: string;
      message?: string;
      percent?: number;
      downloadInfo?: { speed?: string; eta?: string; downloaded?: string; total?: string };
    } | undefined;
    if (payload?.skillName) {
      const key = payload.skillName;
      const existing = host.skillsInstallProgress[key];
      // Don't overwrite "done" or cleared progress — prevents WS race after RPC completes
      if (existing?.stage === "done") return;
      if (_finishedInstalls.has(key)) return;
      const stage = (payload.stage ?? "downloading") as "downloading" | "installing" | "verifying" | "done";
      const msg = payload.message ?? "";
      const pct = payload.percent;
      const dl = payload.downloadInfo;
      const progressMsg = dl?.speed
        ? `${msg} (${dl.downloaded ?? ""}/${dl.total ?? ""} · ${dl.speed})`
        : msg;
      host.skillsInstallProgress = {
        ...host.skillsInstallProgress,
        [key]: { stage, message: progressMsg, percent: pct },
      };
    }
  }
}

/**
 * Track finished installs to prevent late WS events from re-injecting stale progress
 * after the controller has cleared progress to null.
 */
const _finishedInstalls = new Set<string>();
export function markInstallFinished(skillName: string): void {
  _finishedInstalls.add(skillName);
  setTimeout(() => _finishedInstalls.delete(skillName), 10_000);
}

export function applySnapshot(host: GatewayHost, hello: GatewayHelloOk) {
  const snapshot = hello.snapshot as
    | {
        presence?: PresenceEntry[];
        health?: HealthSnapshot;
        sessionDefaults?: SessionDefaultsSnapshot;
      }
    | undefined;
  if (snapshot?.presence && Array.isArray(snapshot.presence)) {
    host.presenceEntries = snapshot.presence;
  }
  if (snapshot?.health) {
    host.debugHealth = snapshot.health;
  }
  if (snapshot?.sessionDefaults) {
    applySessionDefaults(host, snapshot.sessionDefaults);
  }
}

// ============================================================================
// Desktop first-run setup detection
// ============================================================================

const FIRST_RUN_CHECKED_KEY = "clawdbot-first-run-checked";

/**
 * After gateway connects, check if any model provider is configured.
 * If not:
 *   - Desktop mode: redirect WebView to gateway's /setup wizard page
 *   - Browser mode: navigate to model-config tab
 * If providers are already configured (reinstall / normal startup), skip.
 * Only triggers once per installation (persisted via localStorage flag).
 */
async function detectFirstRunSetup(host: GatewayHost) {
  try {
    // Skip if already checked before
    if (localStorage.getItem(FIRST_RUN_CHECKED_KEY)) return;
    // Skip if user is already on model-config or config page
    if (host.tab === "model-config" || host.tab === "config") return;

    // FIX MC-3: 记录发起检测时的初始 tab，用于检测用户是否已手动导航
    const initialTab = host.tab;

    const gwUrl = host.settings.gatewayUrl;
    if (!gwUrl) return;

    // Derive HTTP URL from WebSocket URL
    const httpBase = gwUrl.replace(/^ws/, "http").replace(/\/$/, "");

    // Use a simple GET without custom headers to avoid CORS preflight
    const resp = await fetch(`${httpBase}/api/health`);
    if (!resp.ok) return;

    const health = await resp.json();

    // Use the gateway's authoritative needsSetup flag (single source of truth).
    // Fallback to provider check for older gateways that don't have needsSetup.
    let needsSetup: boolean;
    if (typeof health?.needsSetup === "boolean") {
      needsSetup = health.needsSetup;
    } else {
      const providers = health?.providers;
      needsSetup = !(
        providers &&
        typeof providers === "object" &&
        Object.values(providers).some(
          (p: unknown) => p && typeof p === "object" && (p as Record<string, unknown>).status === "ok",
        )
      );
    }

    if (needsSetup) {
      // Desktop mode (Tauri): redirect to gateway's built-in setup wizard
      // The setup wizard is a server-rendered page at /setup that guides through
      // API key, model, workspace, and license configuration.
      const isDesktop = Boolean(
        (window as Record<string, unknown>).__TAURI__ ||
        (window as Record<string, unknown>).__TAURI_INTERNALS__,
      );
      if (isDesktop) {
        console.log("[FirstRun] Desktop mode: redirecting to gateway setup wizard");
        window.location.href = `${httpBase}/setup`;
        return; // Don't set checked flag — setup wizard will handle completion
      }
      // Browser mode: just switch to model-config tab
      // FIX MC-3: 只在用户未手动导航时才自动切换 tab，防止异步竞态覆盖用户操作
      if (host.tab === initialTab) {
        console.log("[FirstRun] No model providers configured, navigating to model-config");
        host.tab = "model-config" as Tab;
      }
    }

    // Mark as checked so we don't redirect on every reconnect
    localStorage.setItem(FIRST_RUN_CHECKED_KEY, Date.now().toString());
  } catch {
    // Non-critical — don't block app startup
  }
}

// ============================================================================
// License status loading (on WS connect)
// ============================================================================

type LicenseLoadHost = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  licenseState: LicenseUiState;
  showLicenseDialog: LicenseDialogType | null;
};

/**
 * 连接建立后加载 License 状态（包含 keyType 和 supportQrcode）。
 * 解决 setup 向导激活后跳转到 chat 页面时 licenseState.license 为 null 的问题。
 */
async function loadLicenseStatus(host: LicenseLoadHost) {
  if (!host.client || !host.connected) return;
  try {
    const result = await host.client.request("license.status", {});
    if (result && typeof result === "object") {
      const data = result as Record<string, unknown>;
      host.licenseState = {
        ...host.licenseState,
        checking: false,
        valid: (data.valid as boolean) ?? true,
        offlineMode: (data.offlineMode as boolean) ?? false,
        error: (data.error as string | null) ?? null,
        errorCode: (data.errorCode as number | null) ?? null,
        license: (data.license as LicenseUiState["license"]) ?? null,
        device: (data.device as LicenseUiState["device"]) ?? null,
        renewalReminder: (data.renewalReminder as LicenseUiState["renewalReminder"]) ?? null,
        forceUpdate: (data.forceUpdate as LicenseUiState["forceUpdate"]) ?? null,
        pendingNotifications: (data.pendingNotifications as LicenseUiState["pendingNotifications"]) ?? [],
        lastVerifiedAt: Date.now(),
        deviceSwitchInfo: (data.deviceSwitchInfo as LicenseUiState["deviceSwitchInfo"]) ?? null,
        deviceSwitchCooldown: (data.deviceSwitchCooldown as LicenseUiState["deviceSwitchCooldown"]) ?? null,
      };
    }
  } catch {
    // Non-critical — fallback QR code via HTTP will still work
  }
}

// ============================================================================
// License renewal reminder handling
// ============================================================================

type LicenseHost = {
  licenseState: LicenseUiState;
  showLicenseDialog: LicenseDialogType | null;
};

/**
 * Handle the "Remind me later" action for renewal reminder dialog
 */
export function handleRenewalReminderDismiss(host: LicenseHost): void {
  const urgency = host.licenseState.renewalReminder?.urgency;
  if (urgency) {
    dismissRenewalReminderTemporarily(urgency);
  }
  host.showLicenseDialog = null;
}
