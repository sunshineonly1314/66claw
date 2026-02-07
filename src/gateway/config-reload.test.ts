import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listChannelPlugins } from "../channels/plugins/index.js";
import type { ChannelPlugin } from "../channels/plugins/types.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import {
  buildGatewayReloadPlan,
  diffConfigPaths,
  resolveGatewayReloadSettings,
} from "./config-reload.js";

describe("diffConfigPaths", () => {
  it("captures nested config changes", () => {
    const prev = { hooks: { gmail: { account: "a" } } };
    const next = { hooks: { gmail: { account: "b" } } };
    const paths = diffConfigPaths(prev, next);
    expect(paths).toContain("hooks.gmail.account");
  });

  it("captures array changes", () => {
    const prev = { messages: { groupChat: { mentionPatterns: ["a"] } } };
    const next = { messages: { groupChat: { mentionPatterns: ["b"] } } };
    const paths = diffConfigPaths(prev, next);
    expect(paths).toContain("messages.groupChat.mentionPatterns");
  });
});

describe("buildGatewayReloadPlan", () => {
  const emptyRegistry = createTestRegistry([]);
  const telegramPlugin: ChannelPlugin = {
    id: "telegram",
    meta: {
      id: "telegram",
      label: "Telegram",
      selectionLabel: "Telegram",
      docsPath: "/channels/telegram",
      blurb: "test",
    },
    capabilities: { chatTypes: ["direct"] },
    config: {
      listAccountIds: () => [],
      resolveAccount: () => ({}),
    },
    reload: { configPrefixes: ["channels.telegram"] },
  };
  const whatsappPlugin: ChannelPlugin = {
    id: "whatsapp",
    meta: {
      id: "whatsapp",
      label: "WhatsApp",
      selectionLabel: "WhatsApp",
      docsPath: "/channels/whatsapp",
      blurb: "test",
    },
    capabilities: { chatTypes: ["direct"] },
    config: {
      listAccountIds: () => [],
      resolveAccount: () => ({}),
    },
    reload: { configPrefixes: ["web"], noopPrefixes: ["channels.whatsapp"] },
  };
  const registry = createTestRegistry([
    { pluginId: "telegram", plugin: telegramPlugin, source: "test" },
    { pluginId: "whatsapp", plugin: whatsappPlugin, source: "test" },
  ]);

  beforeEach(() => {
    setActivePluginRegistry(registry);
  });

  afterEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });

  it("marks gateway changes as restart required", () => {
    const plan = buildGatewayReloadPlan(["gateway.port"]);
    expect(plan.restartGateway).toBe(true);
    expect(plan.restartReasons).toContain("gateway.port");
  });

  it("restarts the Gmail watcher for hooks.gmail changes", () => {
    const plan = buildGatewayReloadPlan(["hooks.gmail.account"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.restartGmailWatcher).toBe(true);
    expect(plan.reloadHooks).toBe(true);
  });

  it("restarts providers when provider config prefixes change", () => {
    const changedPaths = ["web.enabled", "channels.telegram.botToken"];
    const plan = buildGatewayReloadPlan(changedPaths);
    expect(plan.restartGateway).toBe(false);
    const expected = new Set(
      listChannelPlugins()
        .filter((plugin) =>
          (plugin.reload?.configPrefixes ?? []).some((prefix) =>
            changedPaths.some((path) => path === prefix || path.startsWith(`${prefix}.`)),
          ),
        )
        .map((plugin) => plugin.id),
    );
    expect(expected.size).toBeGreaterThan(0);
    expect(plan.restartChannels).toEqual(expected);
  });

  it("treats gateway.remote as no-op", () => {
    const plan = buildGatewayReloadPlan(["gateway.remote.url"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("gateway.remote.url");
  });

  it("defaults unknown paths to restart", () => {
    const plan = buildGatewayReloadPlan(["unknownField"]);
    expect(plan.restartGateway).toBe(true);
  });

  it("treats tools.exec.approvalTimeoutMs as hot reload (no restart)", () => {
    const plan = buildGatewayReloadPlan(["tools.exec.approvalTimeoutMs"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.hotReasons).toContain("tools.exec.approvalTimeoutMs");
  });
});

describe("resolveGatewayReloadSettings", () => {
  it("uses defaults when unset", () => {
    const settings = resolveGatewayReloadSettings({});
    expect(settings.mode).toBe("hybrid");
    expect(settings.debounceMs).toBe(300);
  });
});

describe("config reload coverage", () => {
  // 所有 ClawdbotConfig 顶级配置键（来自 src/config/types.clawdbot.ts）
  // 当添加新的顶级配置时，需要同步更新此列表和 config-reload.ts 中的规则
  const CLAWDBOT_CONFIG_TOP_LEVEL_KEYS = [
    "meta",
    "auth",
    "env",
    "wizard",
    "diagnostics",
    "logging",
    "update",
    "browser",
    "ui",
    "skills",
    "plugins",
    "models",
    "nodeHost",
    "agents",
    "tools",
    "bindings",
    "broadcast",
    "audio",
    "messages",
    "commands",
    "approvals",
    "session",
    "web",
    "channels",
    "cron",
    "hooks",
    "discovery",
    "canvasHost",
    "talk",
    "gateway",
    "license",
    "credentials",
    "freeModels",
  ] as const;

  // 预期需要重启 Gateway 的配置
  const EXPECTED_RESTART_KEYS = new Set(["plugins", "gateway", "discovery", "canvasHost"]);

  // 预期支持热更新的配置
  const EXPECTED_HOT_KEYS = new Set(["browser", "cron", "hooks"]);

  it("所有 ClawdbotConfig 顶级键都有对应的 reload 规则（不会导致意外重启）", () => {
    const uncoveredKeys: string[] = [];

    for (const key of CLAWDBOT_CONFIG_TOP_LEVEL_KEYS) {
      const plan = buildGatewayReloadPlan([key]);

      // 如果触发了重启但不在预期重启列表中，说明规则缺失
      if (plan.restartGateway && !EXPECTED_RESTART_KEYS.has(key)) {
        uncoveredKeys.push(key);
      }
    }

    expect(uncoveredKeys).toEqual([]);
  });

  it("预期需要重启的配置确实会触发重启", () => {
    for (const key of EXPECTED_RESTART_KEYS) {
      const plan = buildGatewayReloadPlan([key]);
      expect(plan.restartGateway).toBe(true);
    }
  });

  it("预期热更新的配置不会触发完全重启", () => {
    for (const key of EXPECTED_HOT_KEYS) {
      const plan = buildGatewayReloadPlan([key]);
      expect(plan.restartGateway).toBe(false);
    }
  });

  it("无需操作的配置会被正确标记为 noop", () => {
    const noopKeys = CLAWDBOT_CONFIG_TOP_LEVEL_KEYS.filter(
      (key) => !EXPECTED_RESTART_KEYS.has(key) && !EXPECTED_HOT_KEYS.has(key),
    );

    for (const key of noopKeys) {
      const plan = buildGatewayReloadPlan([key]);
      expect(plan.noopPaths).toContain(key);
    }
  });
});
