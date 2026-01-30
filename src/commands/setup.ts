import fs from "node:fs/promises";
import os from "node:os";

import JSON5 from "json5";

import { DEFAULT_AGENT_WORKSPACE_DIR, ensureAgentWorkspace } from "../agents/workspace.js";
import {
  type ClawdbotConfig,
  CONFIG_PATH_CLAWDBOT,
  resolveGatewayPort,
  writeConfigFile,
} from "../config/config.js";
import { formatConfigPath, logConfigUpdated } from "../config/logging.js";
import { resolveSessionTranscriptsDir } from "../config/sessions.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { shortenHomePath } from "../utils.js";
import { theme } from "../terminal/theme.js";

/**
 * Get the primary LAN IP address of this machine
 * 获取本机的主要局域网 IP 地址
 */
function getLanIpAddress(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (addr.internal || addr.family !== "IPv4") continue;
      // Prefer common LAN ranges
      if (
        addr.address.startsWith("192.168.") ||
        addr.address.startsWith("10.") ||
        addr.address.startsWith("172.")
      ) {
        return addr.address;
      }
    }
  }
  // Fallback: return any non-internal IPv4
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (!addr.internal && addr.family === "IPv4") {
        return addr.address;
      }
    }
  }
  return null;
}

async function readConfigFileRaw(): Promise<{
  exists: boolean;
  parsed: ClawdbotConfig;
}> {
  try {
    const raw = await fs.readFile(CONFIG_PATH_CLAWDBOT, "utf-8");
    const parsed = JSON5.parse(raw);
    if (parsed && typeof parsed === "object") {
      return { exists: true, parsed: parsed as ClawdbotConfig };
    }
    return { exists: true, parsed: {} };
  } catch {
    return { exists: false, parsed: {} };
  }
}

export interface SetupCommandOptions {
  workspace?: string;
  /** Start the gateway after setup and show web wizard URL (binds to LAN by default) */
  start?: boolean;
}

export async function setupCommand(
  opts?: SetupCommandOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const desiredWorkspace =
    typeof opts?.workspace === "string" && opts.workspace.trim()
      ? opts.workspace.trim()
      : undefined;

  const existingRaw = await readConfigFileRaw();
  const cfg = existingRaw.parsed;
  const defaults = cfg.agents?.defaults ?? {};

  const workspace = desiredWorkspace ?? defaults.workspace ?? DEFAULT_AGENT_WORKSPACE_DIR;

  // Always set gateway.mode=local to allow gateway to start
  const next: ClawdbotConfig = {
    ...cfg,
    gateway: {
      ...cfg.gateway,
      mode: cfg.gateway?.mode ?? "local",
    },
    agents: {
      ...cfg.agents,
      defaults: {
        ...defaults,
        workspace,
      },
    },
  };

  const configChanged =
    !existingRaw.exists ||
    defaults.workspace !== workspace ||
    cfg.gateway?.mode !== next.gateway?.mode;

  if (configChanged) {
    await writeConfigFile(next);
    if (!existingRaw.exists) {
      runtime.log(`Wrote ${formatConfigPath()}`);
    } else {
      logConfigUpdated(runtime, { suffix: "(set agents.defaults.workspace, gateway.mode)" });
    }
  } else {
    runtime.log(`Config OK: ${formatConfigPath()}`);
  }

  const ws = await ensureAgentWorkspace({
    dir: workspace,
    ensureBootstrapFiles: !next.agents?.defaults?.skipBootstrap,
  });
  runtime.log(`Workspace OK: ${shortenHomePath(ws.dir)}`);

  const sessionsDir = resolveSessionTranscriptsDir();
  await fs.mkdir(sessionsDir, { recursive: true });
  runtime.log(`Sessions OK: ${shortenHomePath(sessionsDir)}`);

  // If --start is specified, start the gateway and show the web wizard URL
  if (opts?.start) {
    const port = resolveGatewayPort(next);
    const lanIp = getLanIpAddress();
    const host = lanIp ?? "localhost";
    const setupUrl = `http://${host}:${port}/setup`;

    runtime.log("");
    runtime.log(theme.muted("━".repeat(60)));
    runtime.log("");
    runtime.log(theme.success("  ✓ 基础配置已完成 / Basic setup complete"));
    runtime.log("");
    runtime.log(theme.info("  正在启动 Gateway... / Starting Gateway..."));
    runtime.log("");
    runtime.log(theme.accent("  请在浏览器中打开以下地址完成安装向导："));
    runtime.log(theme.accent("  Please open the following URL to complete setup:"));
    runtime.log("");
    runtime.log(`  ${theme.accentBright(setupUrl)}`);
    runtime.log("");
    runtime.log(theme.muted("━".repeat(60)));
    runtime.log("");

    // Dynamically import and start the gateway (bind to LAN for easy remote access)
    const { startGatewayServer } = await import("../gateway/server.js");
    await startGatewayServer(port, { bind: "lan" });
  }
}
