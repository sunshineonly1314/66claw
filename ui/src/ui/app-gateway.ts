import { loadChatHistory } from "./controllers/chat";
import { loadDevices } from "./controllers/devices";
import { loadNodes } from "./controllers/nodes";
import { loadAgents } from "./controllers/agents";
import type { GatewayEventFrame, GatewayHelloOk } from "./gateway";
import { GatewayBrowserClient } from "./gateway";
import type { EventLogEntry } from "./app-events";
import type { AgentsListResult, PresenceEntry, HealthSnapshot, StatusSummary } from "./types";
import type { Tab } from "./navigation";
import {
  type UiSettings,
  isTokenAuthError,
  refreshGatewayTokenFromServer,
  loadSettings,
  saveSettings,
  shouldShowRenewalReminder,
  markRenewalReminderShown,
  dismissRenewalReminderTemporarily,
} from "./storage";
import { t } from "./i18n/index.js";
import { handleAgentEvent, resetToolStream, type AgentEventPayload } from "./app-tool-stream";
import { flushChatQueueForEvent, handleSendChat } from "./app-chat";
import type { LicenseUiState, LicenseDialogType } from "./license/types";
import {
  applySettings,
  loadCron,
  refreshActiveTab,
  setLastActiveSessionKey,
} from "./app-settings";
import { handleChatEvent, type ChatEventPayload } from "./controllers/chat";
import {
  addExecApproval,
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  removeExecApproval,
} from "./controllers/exec-approval";
import type { ClawdbotApp } from "./app";
import type { ExecApprovalRequest } from "./controllers/exec-approval";
import { loadAssistantIdentity } from "./controllers/assistant-identity";
import { runCapabilityDetection, type DiscoveryControllerState } from "./controllers/capability-detect";
import { initMcpCapabilities, type McpLifecycleState } from "./controllers/mcp-lifecycle";
import {
  addSkillInstallRequest,
  parseSkillInstallRequested,
  parseSkillInstallResolved,
  parseSkillInstallProgress,
  removeSkillInstallRequest,
} from "./controllers/skill-install";
import type { SkillInstallRequest } from "./views/skill-install-approval";
import type { SkillInstallProgress } from "./views/skill-install-progress";

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
  execApprovalQueue: ExecApprovalRequest[];
  execApprovalError: string | null;
  // Discovery state
  discoveryState: DiscoveryControllerState;
  // ClawdbotCN 专属：技能安装进度状态
  skillInstallQueue?: SkillInstallRequest[];
  skillInstallProgress?: SkillInstallProgress | null;
  // Skills batch install event handler (wired up by ClawdbotApp)
  handleBatchEvent?: (event: Record<string, unknown>) => void;
  checkBatchSkills?: () => Promise<void>;
  // MCP lifecycle state
  mcpCapabilities: import("./app-view-state").McpCapability[];
  mcpProcesses: import("./app-view-state").McpProcessInfo[];
  mcpUpdateNotice: { count: number; names: string[] } | null;
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
  if (!mainSessionKey) return raw;
  if (!raw) return mainSessionKey;
  const mainKey = defaults.mainKey?.trim() || "main";
  const defaultAgentId = defaults.defaultAgentId?.trim();
  const isAlias =
    raw === "main" ||
    raw === mainKey ||
    (defaultAgentId &&
      (raw === `agent:${defaultAgentId}:main` ||
        raw === `agent:${defaultAgentId}:${mainKey}`));
  return isAlias ? mainSessionKey : raw;
}

function applySessionDefaults(host: GatewayHost, defaults?: SessionDefaultsSnapshot) {
  if (!defaults?.mainSessionKey) return;
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

// ---------------------------------------------------------------------------
// Token auth failure recovery (three-layer strategy)
//
// When the gateway restarts, it may generate a new token. Any open browser tab
// still holds the old token (both in window.__CLAWDBOT_GATEWAY_TOKEN__ and
// localStorage). The WebSocket reconnects fail with "token_missing/mismatch"
// and, without intervention, loop forever.
//
// Recovery layers (tried in order):
//   L1 — Sync fix: use server-injected token from current page (instant, rare win)
//   L2 — HTTP refresh: fetch /api/auth/discover for the current token (~100ms, no UX disruption)
//   L3 — Page reload: full reload to get fresh HTML with new token (fallback)
//   Circuit breaker: stop after MAX_AUTH_FAILURES to avoid flooding the gateway
// ---------------------------------------------------------------------------
const AUTH_RELOAD_KEY = "clawdbot.auth.recovery.v1";
const MAX_PAGE_RELOADS = 2; // max reloads within the sliding window
const RELOAD_WINDOW_MS = 5 * 60 * 1000; // 5-minute sliding window
const MAX_AUTH_FAILURES = 6; // circuit breaker threshold

let consecutiveAuthFailures = 0;

function getPageReloadCount(): number {
  try {
    const raw = sessionStorage.getItem(AUTH_RELOAD_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { count: number; since: number };
    if (Date.now() - data.since > RELOAD_WINDOW_MS) return 0;
    return data.count;
  } catch {
    return 0;
  }
}

function recordPageReload(): void {
  try {
    const count = getPageReloadCount();
    const raw = sessionStorage.getItem(AUTH_RELOAD_KEY);
    const prev = raw ? (JSON.parse(raw) as { count: number; since: number }) : null;
    const now = Date.now();
    const since = prev && now - prev.since < RELOAD_WINDOW_MS ? prev.since : now;
    sessionStorage.setItem(AUTH_RELOAD_KEY, JSON.stringify({ count: count + 1, since }));
  } catch {
    // ignore
  }
}

/**
 * Async token recovery after a WebSocket auth failure.
 *
 * Strategy (two layers + delayed retry + circuit breaker):
 *   L1 — HTTP refresh: fetch /api/auth/discover for the current token (~100ms)
 *   L2 — Page reload: full reload to get fresh HTML with new token (fallback)
 *   Delayed retry: if L1 fails and L2 isn't due yet, retry after a pause
 *   Circuit breaker: stop after MAX_AUTH_FAILURES to avoid flooding
 */
async function recoverFromAuthFailure(host: GatewayHost, errorMsg: string): Promise<void> {
  // L1: HTTP refresh — fetch the current token from the gateway via HTTP
  const freshToken = await refreshGatewayTokenFromServer();
  if (freshToken && freshToken !== host.settings.token) {
    console.log("[clawdbot] L1 recovery: fetched fresh token via HTTP, reconnecting");
    consecutiveAuthFailures = 0;
    const updated = { ...host.settings, token: freshToken };
    saveSettings(updated);
    host.settings = updated;
    host.lastError = null;
    connectGateway(host);
    return;
  }

  // L2: Page reload — fetch fresh HTML with server-injected token.
  // Only after 2+ failures (avoids reloading to a dead gateway on first transient error)
  // and within the reload budget (prevents infinite reload loops).
  if (consecutiveAuthFailures >= 2 && getPageReloadCount() < MAX_PAGE_RELOADS) {
    console.warn(
      `[clawdbot] L2 recovery: ${consecutiveAuthFailures} auth failures, reloading page (${getPageReloadCount() + 1}/${MAX_PAGE_RELOADS})`,
    );
    recordPageReload();
    window.location.reload();
    return;
  }

  // Delayed retry: L1 failed and L2 isn't due yet (or budget exhausted).
  // Schedule another attempt so the next failure can try L1 again or escalate to L2.
  // Without this, the client would be permanently disconnected after a single failure.
  if (consecutiveAuthFailures < MAX_AUTH_FAILURES) {
    const retryDelay = Math.min(2000 * consecutiveAuthFailures, 10_000);
    console.warn(
      `[clawdbot] Auth recovery: L1 failed, retrying in ${retryDelay}ms (attempt ${consecutiveAuthFailures}/${MAX_AUTH_FAILURES})`,
    );
    host.lastError = errorMsg;
    window.setTimeout(() => connectGateway(host), retryDelay);
    return;
  }

  // Circuit breaker: all strategies exhausted
  console.error(
    `[clawdbot] Auth recovery exhausted after ${consecutiveAuthFailures} failures. ` +
      "User must reload the page or re-open the tokenized URL.",
  );
  host.lastError = errorMsg;
}

export function connectGateway(host: GatewayHost) {
  host.lastError = null;
  host.hello = null;
  host.connected = false;
  host.execApprovalQueue = [];
  host.execApprovalError = null;
  // Reset auth failure counter so manual reconnects (e.g. user changed token in settings)
  // aren't blocked by a stale circuit-breaker count from a previous recovery attempt.
  consecutiveAuthFailures = 0;

  host.client?.stop();
  host.client = new GatewayBrowserClient({
    url: host.settings.gatewayUrl,
    token: host.settings.token.trim() ? host.settings.token : undefined,
    password: host.password.trim() ? host.password : undefined,
    clientName: "clawdbot-control-ui",
    mode: "webchat",
    onHello: (hello) => {
      host.connected = true;
      host.lastError = null;
      host.hello = hello;
      consecutiveAuthFailures = 0;
      applySnapshot(host, hello);
      void loadAssistantIdentity(host as unknown as ClawdbotApp);
      void loadAgents(host as unknown as ClawdbotApp);
      void loadNodes(host as unknown as ClawdbotApp, { quiet: true });
      void loadDevices(host as unknown as ClawdbotApp, { quiet: true });
      void refreshActiveTab(host as unknown as Parameters<typeof refreshActiveTab>[0]);
      
      // 加载 License 状态并检查是否需要弹框 (ClawdbotCN)
      void loadLicenseStatus(host as unknown as ClawdbotApp);
      
      // ClawdbotCN: 检查是否有未安装的批量技能
      void host.checkBatchSkills?.();

      // 初始化 MCP 能力列表
      void initMcpCapabilities(host.client, {
        onStateChange: (patch: Partial<McpLifecycleState>) => {
          if (patch.capabilities !== undefined) host.mcpCapabilities = patch.capabilities;
          if (patch.processes !== undefined) host.mcpProcesses = patch.processes;
          if (patch.updateNotice !== undefined) host.mcpUpdateNotice = patch.updateNotice;
        },
      });

      // 首次使用时触发能力检测
      if (host.discoveryState.isFirstVisit && !host.discoveryState.hasCompletedFirstVisit) {
        void runCapabilityDetection(host.client, {
          onStateChange: (patch) => {
            host.discoveryState = { ...host.discoveryState, ...patch };
          },
        });
      }
    },
    onClose: ({ code, reason }) => {
      host.connected = false;
      const reasonText = reason || t("connection.ws.noReason");
      const errorMsg = t("connection.ws.disconnected", { code: String(code), reason: reasonText });
      
      // Code 1012 = Service Restart (expected during config saves, don't show as error)
      if (code === 1012) {
        consecutiveAuthFailures = 0;
        return;
      }
      
      // Detect token auth errors (check both formatted message and raw reason,
      // since the raw reason now carries the preserved connect RPC error).
      if (isTokenAuthError(errorMsg) || isTokenAuthError(reason)) {
        consecutiveAuthFailures++;

        // Stop the current client's auto-reconnect while async recovery runs.
        // The recovery function will call connectGateway() again on success,
        // or schedule a delayed retry, or give up (circuit breaker).
        host.client?.stop();
        void recoverFromAuthFailure(host, errorMsg);
        return;
      }
      
      host.lastError = errorMsg;
    },
    onEvent: (evt) => handleGatewayEvent(host, evt),
    onGap: ({ expected, received }) => {
      host.lastError = t("connection.ws.eventGap", { expected: String(expected), received: String(received) });
    },
  });
  host.client.start();
}

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
    if (host.onboarding) return;
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
    const state = handleChatEvent(host as unknown as ClawdbotApp, payload);
    const isFinal = state === "final" || state === "final_model_switch";
    if (isFinal || state === "error" || state === "aborted") {
      resetToolStream(host as unknown as Parameters<typeof resetToolStream>[0]);
      void flushChatQueueForEvent(
        host as unknown as Parameters<typeof flushChatQueueForEvent>[0],
      );
    }
    if (isFinal) {
      // Load history first, then clear stream for seamless transition.
      // This keeps the typewriter animation alive while history loads,
      // preventing the "sudden text flash" when stream is cleared too early.
      const app = host as unknown as ClawdbotApp;
      loadChatHistory(app).then(() => {
        app.chatStream = null;
        clearTimeout(app._justCompletedTimer);
        app.chatStreamJustCompleted = true;
        app._justCompletedTimer = window.setTimeout(() => { app.chatStreamJustCompleted = false; }, 5000);
      });
    } else if (state === "error" || state === "aborted") {
      const app = host as unknown as ClawdbotApp;
      clearTimeout(app._justCompletedTimer);
      app.chatStreamJustCompleted = false;
    }
    // ClawdbotCN: auto-create new session when free model switch is detected.
    // Delay slightly so the user can see the switch notification card before the session resets.
    if (state === "final_model_switch") {
      setTimeout(() => {
        void handleSendChat(
          host as unknown as Parameters<typeof handleSendChat>[0],
          "/new",
          { restoreDraft: true },
        );
      }, 1500);
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
    void loadDevices(host as unknown as ClawdbotApp, { quiet: true });
  }

  if (evt.event === "exec.approval.requested") {
    const entry = parseExecApprovalRequested(evt.payload);
    if (entry) {
      host.execApprovalQueue = addExecApproval(host.execApprovalQueue, entry);
      host.execApprovalError = null;
      const delay = Math.max(0, entry.expiresAtMs - Date.now() + 500);
      window.setTimeout(() => {
        host.execApprovalQueue = removeExecApproval(host.execApprovalQueue, entry.id);
      }, delay);
    }
    return;
  }

  if (evt.event === "exec.approval.resolved") {
    const resolved = parseExecApprovalResolved(evt.payload);
    if (resolved) {
      host.execApprovalQueue = removeExecApproval(host.execApprovalQueue, resolved.id);
    }
    return;
  }

  // =========================================================================
  // ClawdbotCN 专属：技能批量安装事件处理 (Skills Batch Install)
  // =========================================================================
  if (
    evt.event === "skills.batch.progress" ||
    evt.event === "skills.batch.complete" ||
    evt.event === "skills.batch.error"
  ) {
    const payload = (evt.payload ?? {}) as Record<string, unknown>;
    // Strip "skills.batch." prefix → "progress" | "complete" | "error"
    const wsEvent = evt.event.replace("skills.batch.", "");
    host.handleBatchEvent?.({ _wsEvent: wsEvent, ...payload });
    return;
  }

  // =========================================================================
  // ClawdbotCN 专属：技能安装进度事件处理
  // =========================================================================
  if (evt.event === "skill.install.requested") {
    const entry = parseSkillInstallRequested(evt.payload);
    if (entry) {
      host.skillInstallQueue = addSkillInstallRequest(host.skillInstallQueue ?? [], entry);
      // 设置请求过期自动清理
      const delay = Math.max(0, entry.expiresAtMs - Date.now() + 500);
      window.setTimeout(() => {
        host.skillInstallQueue = removeSkillInstallRequest(host.skillInstallQueue ?? [], entry.id);
      }, delay);
    }
    return;
  }

  if (evt.event === "skill.install.resolved") {
    const resolved = parseSkillInstallResolved(evt.payload);
    if (resolved) {
      host.skillInstallQueue = removeSkillInstallRequest(host.skillInstallQueue ?? [], resolved.id);
    }
    return;
  }

  if (evt.event === "skill.install.progress") {
    const progress = parseSkillInstallProgress(
      evt.payload,
      host.skillInstallProgress,
    );
    if (progress) {
      host.skillInstallProgress = progress;
      // 完成或失败时，5秒后自动清除进度（让用户有时间看到结果）
      if (progress.stage === "complete" || progress.stage === "failed") {
        window.setTimeout(() => {
          // 只有当进度 ID 匹配时才清除（避免清除新的进度）
          if (host.skillInstallProgress?.id === progress.id) {
            // 完成时自动关闭，失败时保留让用户手动关闭
            if (progress.stage === "complete") {
              host.skillInstallProgress = null;
            }
          }
        }, 3000);
      }
    }
    return;
  }

  if (evt.event === "skill.install.cancelled") {
    const payload = evt.payload as { id?: string } | undefined;
    if (payload?.id) {
      host.skillInstallQueue = removeSkillInstallRequest(host.skillInstallQueue ?? [], payload.id);
      // 如果取消的是正在显示进度的安装，清除进度
      if (host.skillInstallProgress?.id === payload.id) {
        host.skillInstallProgress = null;
      }
    }
    return;
  }
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
// License 状态加载与续费提醒弹框
// ============================================================================

type LicenseHost = {
  client: GatewayBrowserClient | null;
  licenseState: LicenseUiState;
  showLicenseDialog: LicenseDialogType | null;
  // QR 码预加载状态
  qrcodePreloading?: boolean;
  qrcodePreloaded?: boolean;
  qrcodeExpiresAt?: number | null;
};

/**
 * 从 URL 参数获取激活码
 * 支持 ?key=xxx 或 ?activate=xxx 格式
 */
function getActivationKeyFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key") || params.get("activate") || params.get("license");
    if (key && key.trim().length > 8) {
      return key.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * 清除 URL 中的激活码参数（激活后清理）
 */
function clearActivationKeyFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("key");
    url.searchParams.delete("activate");
    url.searchParams.delete("license");
    window.history.replaceState({}, "", url.toString());
  } catch {
    // ignore
  }
}

/**
 * 加载 License 状态并检查是否需要弹框
 */
export async function loadLicenseStatus(host: LicenseHost): Promise<void> {
  if (!host.client) return;

  try {
    const result = await host.client.request("license.status", {});
    if (result && typeof result === "object") {
      const data = result as Record<string, unknown>;
      const device = data.device as Record<string, unknown> | null;
      const errorCode = (data.errorCode as number | null) ?? null;

      // 从 device 对象提取设备切换信息（服务端把这些信息放在 device 内）
      let deviceSwitchInfo: LicenseUiState["deviceSwitchInfo"] = null;
      let deviceSwitchCooldown: LicenseUiState["deviceSwitchCooldown"] = null;

      if (device) {
        // errorCode=1010 时，提取设备切换信息
        if (errorCode === 1010 && device.existingDeviceName) {
          deviceSwitchInfo = {
            existingDeviceId: device.existingDeviceId as string,
            existingDeviceName: device.existingDeviceName as string,
            existingOsInfo: (device.existingOsInfo as string) ?? undefined,
          };
        }
        // errorCode=1011 时，提取冷却期信息
        if (errorCode === 1011 && device.cooldownRemainingHours !== undefined) {
          deviceSwitchCooldown = {
            cooldownRemainingHours: device.cooldownRemainingHours as number,
            cooldownEndsAt: device.cooldownEndsAt as string,
          };
        }
      }

      // 也检查顶层字段（兼容可能的后端改动）
      if (!deviceSwitchInfo && data.deviceSwitchInfo) {
        deviceSwitchInfo = data.deviceSwitchInfo as LicenseUiState["deviceSwitchInfo"];
      }
      if (!deviceSwitchCooldown && data.deviceSwitchCooldown) {
        deviceSwitchCooldown = data.deviceSwitchCooldown as LicenseUiState["deviceSwitchCooldown"];
      }

      host.licenseState = {
        checking: false,
        valid: (data.valid as boolean) ?? true,
        offlineMode: (data.offlineMode as boolean) ?? false,
        error: (data.error as string | null) ?? null,
        errorCode,
        license: (data.license as LicenseUiState["license"]) ?? null,
        device: (data.device as LicenseUiState["device"]) ?? null,
        renewalReminder: (data.renewalReminder as LicenseUiState["renewalReminder"]) ?? null,
        forceUpdate: (data.forceUpdate as LicenseUiState["forceUpdate"]) ?? null,
        pendingNotifications: (data.pendingNotifications as LicenseUiState["pendingNotifications"]) ?? [],
        lastVerifiedAt: Date.now(),
        deviceSwitchInfo,
        deviceSwitchCooldown,
      };

      // 平滑激活：检查 URL 参数中是否有激活码
      if (!host.licenseState.valid && !host.licenseState.license) {
        const urlKey = getActivationKeyFromUrl();
        if (urlKey) {
          console.log("[license] Found activation key in URL, auto-activating...");
          await autoActivateLicense(host, urlKey);
          return;
        }
      }

      // 检查是否需要显示弹框
      checkAndShowLicenseDialog(host);

      // 预加载技术支持二维码（在 license 状态加载完成后立即触发）
      void preloadQrcodeForChat(host);
    }
  } catch (error) {
    console.error("[license] Failed to load license status:", error);
  }
}

/**
 * 预加载技术支持二维码
 *
 * 在 license 状态加载完成后调用。
 * 二维码已由 gateway 端的 enrichLicenseWithSupport 注入到 license 对象中，
 * 如果已有数据则直接标记完成，否则通过 gateway 方法获取。
 */
async function preloadQrcodeForChat(host: LicenseHost): Promise<void> {
  if (!host.client) return;

  // 如果 license 已经带有二维码数据，直接标记完成
  if (host.licenseState?.license?.supportQrcode?.base64) {
    host.qrcodePreloaded = true;
    host.qrcodePreloading = false;
    return;
  }

  // 通过 gateway 方法获取本地静态二维码
  host.qrcodePreloading = true;
  host.qrcodePreloaded = false;

  try {
    const result = await host.client.request("support.qrcode.preload", {});
    if (result && typeof result === "object") {
      const data = result as Record<string, unknown>;
      const qrcode = data.qrcode as { base64: string; groupName: string } | null;

      if (qrcode?.base64) {
        host.licenseState = {
          ...host.licenseState,
          license: {
            ...host.licenseState.license!,
            supportQrcode: qrcode,
          },
        };
        host.qrcodePreloaded = true;
      } else {
        host.qrcodePreloaded = false;
      }
    }
  } catch {
    host.qrcodePreloaded = false;
  } finally {
    host.qrcodePreloading = false;
  }
}

/**
 * 自动激活授权码（从 URL 参数）
 */
async function autoActivateLicense(host: LicenseHost, key: string): Promise<void> {
  if (!host.client) return;

  try {
    const result = await host.client.request("license.activate", { key });
    if (result && typeof result === "object") {
      const data = result as Record<string, unknown>;
      if (data.valid) {
        // 激活成功
        host.licenseState = {
          ...host.licenseState,
          valid: true,
          error: null,
          errorCode: null,
          license: data.license as LicenseUiState["license"],
          device: data.device as LicenseUiState["device"],
          lastVerifiedAt: Date.now(),
        };
        // 清除 URL 中的激活码参数
        clearActivationKeyFromUrl();
        console.log("[license] Auto-activation successful");
        return;
      } else {
        // 激活失败，显示错误
        console.error("[license] Auto-activation failed:", data.errorMessage);
        host.licenseState = {
          ...host.licenseState,
          error: (data.errorMessage as string) || "激活失败",
        };
      }
    }
  } catch (error) {
    console.error("[license] Auto-activation error:", error);
  }

  // 激活失败，清除 URL 参数并显示激活弹框
  clearActivationKeyFromUrl();
  checkAndShowLicenseDialog(host);
}

/**
 * 检查并显示 License 相关弹框
 */
function checkAndShowLicenseDialog(host: LicenseHost): void {
  const state = host.licenseState;

  // 1. 强制更新优先级最高
  if (state.forceUpdate?.required && state.forceUpdate.blocking) {
    host.showLicenseDialog = "force-update";
    return;
  }

  // 2. 授权无效
  if (!state.valid && state.error) {
    // 2.1 设备切换确认（单设备模式：1010）
    if (state.errorCode === 1010) {
      host.showLicenseDialog = "device-switch";
      return;
    }
    // 2.2 设备切换冷却中（单设备模式：1011）
    if (state.errorCode === 1011) {
      host.showLicenseDialog = "device-switch-cooldown";
      return;
    }
    // 2.3 设备数超限
    if (state.errorCode === 1004) {
      host.showLicenseDialog = "device-limit";
      return;
    }
    // 2.4 授权过期
    if (state.errorCode === 1002) {
      host.showLicenseDialog = "expired";
      return;
    }
    // 2.5 未激活
    if (!state.license) {
      host.showLicenseDialog = "activation";
      return;
    }
  }

  // 3. 续费提醒（根据频率策略）
  const reminder = state.renewalReminder;
  if (reminder?.show && reminder.urgency) {
    if (shouldShowRenewalReminder(reminder.urgency)) {
      host.showLicenseDialog = "renewal";
      markRenewalReminderShown(reminder.urgency);
      return;
    }
  }

  // 4. 待展示的通知
  if (state.pendingNotifications && state.pendingNotifications.length > 0) {
    host.showLicenseDialog = "notification";
    return;
  }
}

/**
 * 处理续费提醒弹框的"稍后提醒"操作
 */
export function handleRenewalReminderDismiss(host: LicenseHost): void {
  const urgency = host.licenseState.renewalReminder?.urgency;
  if (urgency) {
    dismissRenewalReminderTemporarily(urgency);
  }
  host.showLicenseDialog = null;
}
