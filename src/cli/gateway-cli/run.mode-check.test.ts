import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Hoisted mocks ───────────────────────────────────────────────────────

const configMocks = vi.hoisted(() => ({
  loadConfig: vi.fn(() => ({})),
  CONFIG_PATH_CLAWDBOT: "/tmp/fake-clawdbot.json",
  readConfigFileSnapshot: vi.fn(async () => ({ parsed: {} })),
  resolveGatewayPort: vi.fn(() => 18789),
}));

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
}));

const runtimeErrors: string[] = [];
const runtimeLogs: string[] = [];
const runtimeMock = vi.hoisted(() => ({
  defaultRuntime: {
    log: (msg: string) => runtimeLogs.push(msg),
    error: (msg: string) => runtimeErrors.push(msg),
    exit: (code: number) => {
      throw new Error(`__exit__:${code}`);
    },
  },
}));

const subsystemLogs: string[] = [];
const subsystemMock = vi.hoisted(() => ({
  createSubsystemLogger: vi.fn(() => ({
    info: (msg: string) => subsystemLogs.push(msg),
    warn: (msg: string) => subsystemLogs.push(msg),
    error: (msg: string) => subsystemLogs.push(msg),
  })),
}));

// ── vi.mock declarations ────────────────────────────────────────────────

vi.mock("node:fs", () => ({
  default: { existsSync: fsMocks.existsSync },
  existsSync: fsMocks.existsSync,
}));

vi.mock("../../config/config.js", () => configMocks);

vi.mock("../../runtime.js", () => runtimeMock);

vi.mock("../../logging/subsystem.js", () => subsystemMock);

vi.mock("../../gateway/server.js", () => ({
  startGatewayServer: vi.fn(async () => ({ close: vi.fn() })),
}));

vi.mock("../../gateway/auth.js", () => ({
  resolveGatewayAuth: vi.fn(() => ({
    mode: "token" as const,
    token: "test-token",
    password: undefined,
    allowTailscale: false,
  })),
}));

vi.mock("../../gateway/ws-logging.js", () => ({
  setGatewayWsLogStyle: vi.fn(),
}));

vi.mock("../../globals.js", () => ({
  isVerbose: () => false,
  setVerbose: vi.fn(),
}));

vi.mock("../../logging/console.js", () => ({
  setConsoleSubsystemFilter: vi.fn(),
  setConsoleTimestampPrefix: vi.fn(),
}));

vi.mock("../../infra/gateway-lock.js", () => ({
  acquireGatewayLock: vi.fn(async () => ({ release: vi.fn() })),
  GatewayLockError: class extends Error {
    name = "GatewayLockError";
  },
}));

vi.mock("../../infra/ports.js", () => ({
  formatPortDiagnostics: vi.fn(() => []),
  inspectPortUsage: vi.fn(async () => ({ status: "free" })),
}));

vi.mock("../command-format.js", () => ({
  formatCliCommand: (cmd: string) => cmd,
}));

vi.mock("../ports.js", () => ({
  forceFreePortAndWait: vi.fn(async () => ({
    killed: [],
    waitedMs: 0,
    escalatedToSigkill: false,
  })),
}));

vi.mock("./dev.js", () => ({
  ensureDevGatewayConfig: vi.fn(async () => {}),
}));

// Mock runGatewayLoop to prevent the test from hanging on the infinite loop.
// It immediately resolves so `runGatewayCommand` finishes normally.
vi.mock("./run-loop.js", () => ({
  runGatewayLoop: vi.fn(async () => {}),
}));

vi.mock("./shared.js", () => ({
  describeUnknownError: (err: unknown) => String(err),
  extractGatewayMiskeys: vi.fn(() => ({
    hasGatewayToken: false,
    hasRemoteToken: false,
  })),
  maybeExplainGatewayServiceStop: vi.fn(async () => {}),
  parsePort: (raw: unknown) => {
    if (raw === undefined || raw === null) return null;
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  },
  toOptionString: (value: unknown) =>
    typeof value === "string" ? value : undefined,
}));

// ── Helpers ─────────────────────────────────────────────────────────────

import { Command } from "commander";
import { addGatewayRunCommand } from "./run.js";

async function runGateway(
  extraArgs: string[],
): Promise<{ errors: string[]; logs: string[]; subsystem: string[] }> {
  runtimeErrors.length = 0;
  runtimeLogs.length = 0;
  subsystemLogs.length = 0;

  // Build a parent program with a "gateway" subcommand, matching real CLI structure.
  const program = new Command();
  program.exitOverride();
  const gw = program.command("gateway");
  addGatewayRunCommand(gw);

  try {
    await program.parseAsync(["node", "cli", "gateway", ...extraArgs], {
      from: "node",
    });
  } catch (err) {
    // Commander throws on exitOverride; we also throw __exit__
    if (
      err instanceof Error &&
      !err.message.startsWith("__exit__") &&
      !(err as { code?: string }).code?.startsWith("commander.")
    ) {
      throw err;
    }
  }

  return {
    errors: [...runtimeErrors],
    logs: [...runtimeLogs],
    subsystem: [...subsystemLogs],
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("gateway run — gateway.mode check", () => {
  beforeEach(() => {
    runtimeErrors.length = 0;
    runtimeLogs.length = 0;
    subsystemLogs.length = 0;
    fsMocks.existsSync.mockReturnValue(true);
    configMocks.readConfigFileSnapshot.mockResolvedValue({ parsed: {} });
  });

  it('mode="remote" → blocks with error', async () => {
    configMocks.loadConfig.mockReturnValue({
      gateway: { mode: "remote" },
    });

    const result = await runGateway([
      "--port",
      "18789",
      "--token",
      "test-token",
    ]);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join("\n")).toContain("gateway.mode is \"remote\"");
  });

  it("mode=unset (no config file) → does NOT block, logs info", async () => {
    configMocks.loadConfig.mockReturnValue({});
    fsMocks.existsSync.mockReturnValue(false);

    const result = await runGateway([
      "--port",
      "18789",
      "--token",
      "test-token",
    ]);

    // Should NOT have exit errors about mode blocking
    const modeBlockErrors = result.errors.filter(
      (e) => e.includes("Gateway start blocked") || e.includes("Missing config"),
    );
    expect(modeBlockErrors).toHaveLength(0);

    // Should have logged a subsystem info about defaulting to local
    const defaultingLog = result.subsystem.find((s) =>
      s.includes("defaulting to local"),
    );
    expect(defaultingLog).toBeDefined();
    expect(defaultingLog).toContain("no config file");
  });

  it("mode=unset (config file exists) → does NOT block, logs info", async () => {
    configMocks.loadConfig.mockReturnValue({
      gateway: { port: 18789 },
    });
    fsMocks.existsSync.mockReturnValue(true);

    const result = await runGateway([
      "--port",
      "18789",
      "--token",
      "test-token",
    ]);

    const modeBlockErrors = result.errors.filter(
      (e) => e.includes("Gateway start blocked") || e.includes("Missing config"),
    );
    expect(modeBlockErrors).toHaveLength(0);

    const defaultingLog = result.subsystem.find((s) =>
      s.includes("defaulting to local"),
    );
    expect(defaultingLog).toBeDefined();
    // When config file exists, should NOT mention "no config file"
    expect(defaultingLog).not.toContain("no config file");
  });

  it('mode="local" → passes through without warning', async () => {
    configMocks.loadConfig.mockReturnValue({
      gateway: { mode: "local" },
    });

    const result = await runGateway([
      "--port",
      "18789",
      "--token",
      "test-token",
    ]);

    const modeBlockErrors = result.errors.filter(
      (e) => e.includes("Gateway start blocked") || e.includes("mode"),
    );
    expect(modeBlockErrors).toHaveLength(0);

    // No "defaulting to local" warning either
    const defaultingLog = result.subsystem.find((s) =>
      s.includes("defaulting to local"),
    );
    expect(defaultingLog).toBeUndefined();
  });

  it('mode="remote" + --allow-unconfigured → bypasses block', async () => {
    configMocks.loadConfig.mockReturnValue({
      gateway: { mode: "remote" },
    });

    const result = await runGateway([
      "--port",
      "18789",
      "--token",
      "test-token",
      "--allow-unconfigured",
    ]);

    const modeBlockErrors = result.errors.filter((e) =>
      e.includes("gateway.mode"),
    );
    expect(modeBlockErrors).toHaveLength(0);
  });
});
