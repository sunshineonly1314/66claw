/**
 * Integration tests for config.set safety check.
 *
 * Verifies that config.set (full-replace) is now subject to the same
 * "apply" mode safety checks as config.apply:
 *   - Hard-blocks when a CRITICAL_TOP_LEVEL_FIELD is dropped
 *   - Hard-blocks when config size shrinks >50%
 *   - Returns advisory safetyWarnings for lesser issues (non-critical drops)
 *   - Still allows legitimate full-replace writes
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/* Snapshot / config state shared by mocks                            */
/* ------------------------------------------------------------------ */

interface MockSnapshot {
  exists: boolean;
  valid: boolean;
  config: Record<string, unknown>;
  resolved: Record<string, unknown>;
  parsed: Record<string, unknown>;
  raw: string;
  issues: unknown[];
  legacyIssues: unknown[];
  path: string;
}

// Each test can override these to control what "current config" looks like.
let currentSnapshot: MockSnapshot = {
  exists: true,
  valid: true,
  config: {},
  resolved: {},
  parsed: {},
  raw: "{}",
  issues: [],
  legacyIssues: [],
  path: "/fake/openclawcn.json",
};

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({
  writeConfigFile: vi.fn(async () => {}),
  withConfigWriteLock: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  loadConfig: vi.fn(() => ({})),
  validateOk: true,
  redactReturn: (cfg: unknown) => cfg,
}));

vi.mock("../../config/config.js", () => ({
  CONFIG_PATH: "/fake/openclawcn.json",
  loadConfig: mocks.loadConfig,
  parseConfigJson5: (_raw: string) => ({ ok: true, parsed: JSON.parse(_raw) }),
  readConfigFileSnapshot: async () => currentSnapshot,
  readConfigFileSnapshotForWrite: async () => ({
    snapshot: currentSnapshot,
    writeOptions: { envSnapshotForRestore: undefined, expectedConfigPath: "/fake/openclawcn.json" },
  }),
  resolveConfigSnapshotHash: (_snap: unknown) => "hash-abc",
  validateConfigObjectWithPlugins: (cfg: unknown) => ({
    ok: mocks.validateOk,
    config: cfg,
    issues: mocks.validateOk ? [] : [{ path: "root", message: "invalid" }],
    warnings: [],
  }),
  withConfigWriteLock: mocks.withConfigWriteLock,
  writeConfigFile: mocks.writeConfigFile,
}));

vi.mock("../../config/legacy.js", () => ({
  applyLegacyMigrations: (cfg: unknown) => ({ next: null, changes: [], config: cfg }),
}));

vi.mock("../../config/merge-patch.js", () => ({
  applyMergePatch: (_base: unknown, patch: unknown) => patch,
  createMergePatch: (_a: unknown, _b: unknown) => ({}),
}));

vi.mock("../../config/config-rollback.js", () => ({
  listConfigBackups: vi.fn(() => []),
  rollbackConfig: vi.fn(async () => ({ ok: true, restoredFrom: "/fake/.bak", version: "1.0.0" })),
}));

vi.mock("../../config/redact-snapshot.js", () => ({
  redactConfigSnapshot: (_snap: unknown) => _snap,
  redactConfigObject: (_cfg: unknown) => _cfg,
  restoreRedactedValues: (_incoming: unknown) => ({ ok: true, result: _incoming }),
}));

vi.mock("../../config/schema.js", () => ({
  buildConfigSchema: () => ({ uiHints: {}, schema: {}, version: "1", generatedAt: "now" }),
}));

vi.mock("../../config/sessions.js", () => ({
  extractDeliveryInfo: (_key: unknown) => ({ deliveryContext: null, threadId: null }),
}));

vi.mock("../../infra/restart-sentinel.js", () => ({
  formatDoctorNonInteractiveHint: () => "run openclawcn doctor",
  writeRestartSentinel: async () => "/fake/sentinel.json",
}));

vi.mock("../../infra/restart.js", () => ({
  scheduleGatewaySigusr1Restart: () => ({ scheduled: true }),
}));

vi.mock("../config-reload.js", () => ({
  diffConfigPaths: () => [],
  buildGatewayReloadPlan: () => ({ restartGateway: false }),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  resolveAgentWorkspaceDir: () => "/workspace",
  resolveDefaultAgentId: () => "main",
}));

vi.mock("../../channels/plugins/index.js", () => ({
  listChannelPlugins: () => [],
}));

vi.mock("../../plugins/loader.js", () => ({
  loadOpenClawCNPlugins: () => ({ plugins: [] }),
}));

/* ------------------------------------------------------------------ */
/* Import after mocks                                                 */
/* ------------------------------------------------------------------ */

const { configHandlers } = await import("./config.js");

/* ------------------------------------------------------------------ */
/* Helper                                                             */
/* ------------------------------------------------------------------ */

function callSet(raw: string, extraParams: Record<string, unknown> = {}) {
  const respond = vi.fn();
  const promise = (
    configHandlers["config.set"] as (args: {
      params: unknown;
      respond: typeof respond;
      context: unknown;
      req: unknown;
      client: null;
      isWebchatConnect: () => boolean;
    }) => Promise<void>
  )({
    params: { raw, baseHash: "hash-abc", ...extraParams },
    respond,
    context: {},
    req: { type: "req" as const, id: "1", method: "config.set" },
    client: null,
    isWebchatConnect: () => false,
  });
  return { respond, promise };
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe("config.set — safety check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateOk = true;
    // Default: current config has critical fields present
    currentSnapshot = {
      exists: true,
      valid: true,
      config: {
        agents: { list: [{ id: "main" }] },
        models: { openai: { apiKey: "sk-test" } },
        license: { key: "lic-abc" },
        channels: { telegram: { token: "tg-123" } },
        tools: { exec: { allow: [] } },
        mcp: { servers: {} },
      },
      resolved: {},
      parsed: {},
      raw: JSON.stringify({
        agents: { list: [{ id: "main" }] },
        models: { openai: { apiKey: "sk-test" } },
        license: { key: "lic-abc" },
        channels: { telegram: { token: "tg-123" } },
        tools: { exec: { allow: [] } },
        mcp: { servers: {} },
      }),
      issues: [],
      legacyIssues: [],
      path: "/fake/openclawcn.json",
    };
  });

  // ── Hard-block: critical field dropped ──────────────────────────────

  it("hard-blocks when 'agents' is dropped", async () => {
    const incoming = {
      models: { openai: { apiKey: "sk-test" } },
      license: { key: "lic-abc" },
      channels: { telegram: { token: "tg-123" } },
      tools: { exec: { allow: [] } },
      mcp: { servers: {} },
      // agents intentionally omitted
    };
    const { respond, promise } = callSet(JSON.stringify(incoming));
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("agents"),
      }),
    );
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  it("hard-blocks when 'models' is dropped", async () => {
    const incoming = {
      agents: { list: [{ id: "main" }] },
      license: { key: "lic-abc" },
      channels: { telegram: { token: "tg-123" } },
      tools: { exec: { allow: [] } },
      mcp: { servers: {} },
      // models intentionally omitted
    };
    const { respond, promise } = callSet(JSON.stringify(incoming));
    await promise;

    expect(respond).toHaveBeenCalledWith(false, undefined, expect.anything());
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  it("hard-blocks when 'license' is dropped", async () => {
    const incoming = {
      agents: { list: [{ id: "main" }] },
      models: { openai: { apiKey: "sk-test" } },
      channels: { telegram: { token: "tg-123" } },
      tools: { exec: { allow: [] } },
      mcp: { servers: {} },
      // license intentionally omitted
    };
    const { respond, promise } = callSet(JSON.stringify(incoming));
    await promise;

    expect(respond).toHaveBeenCalledWith(false, undefined, expect.anything());
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  it("hard-blocks when 'channels' is dropped", async () => {
    const incoming = {
      agents: { list: [{ id: "main" }] },
      models: { openai: { apiKey: "sk-test" } },
      license: { key: "lic-abc" },
      tools: { exec: { allow: [] } },
      mcp: { servers: {} },
      // channels intentionally omitted
    };
    const { respond, promise } = callSet(JSON.stringify(incoming));
    await promise;

    expect(respond).toHaveBeenCalledWith(false, undefined, expect.anything());
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  it("hard-blocks when 'mcp' is dropped", async () => {
    const incoming = {
      agents: { list: [{ id: "main" }] },
      models: { openai: { apiKey: "sk-test" } },
      license: { key: "lic-abc" },
      channels: { telegram: { token: "tg-123" } },
      tools: { exec: { allow: [] } },
      // mcp intentionally omitted
    };
    const { respond, promise } = callSet(JSON.stringify(incoming));
    await promise;

    expect(respond).toHaveBeenCalledWith(false, undefined, expect.anything());
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  // ── Hard-block: >50% size reduction ─────────────────────────────────

  it("hard-blocks when config size shrinks >50%", async () => {
    // Set current to a large config
    const large = "x".repeat(300);
    currentSnapshot = {
      ...currentSnapshot,
      config: {
        gateway: { description: large, extra: large },
        serverInfo: { data: large },
      },
      raw: JSON.stringify({
        gateway: { description: large, extra: large },
        serverInfo: { data: large },
      }),
    };

    // Incoming is tiny (no critical fields in current to trigger field-drop check first)
    const incoming = { gateway: { port: 3000 } };
    const { respond, promise } = callSet(JSON.stringify(incoming));
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("50%"),
      }),
    );
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });

  // ── Legitimate full-replace passes ──────────────────────────────────

  it("allows a full config.set when all critical fields are present", async () => {
    const incoming = {
      agents: { list: [{ id: "main" }] },
      models: { openai: { apiKey: "sk-new" } },
      license: { key: "lic-abc" },
      channels: { telegram: { token: "tg-123" } },
      tools: { exec: { allow: [] } },
      mcp: { servers: {} },
    };
    const { respond, promise } = callSet(JSON.stringify(incoming));
    await promise;

    expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ ok: true }), undefined);
    expect(mocks.writeConfigFile).toHaveBeenCalled();
  });

  // ── Advisory safetyWarnings pass-through ────────────────────────────

  it("returns safetyWarnings when non-critical top-level key is dropped (still writes)", async () => {
    // Current has a non-critical extra field
    currentSnapshot = {
      ...currentSnapshot,
      config: {
        ...currentSnapshot.config,
        myCustomSection: { value: 42 },
      },
      raw: JSON.stringify({
        ...currentSnapshot.config,
        myCustomSection: { value: 42 },
      }),
    };

    // Incoming omits myCustomSection (non-critical — advisory only, write proceeds)
    const incoming = {
      agents: { list: [{ id: "main" }] },
      models: { openai: { apiKey: "sk-test" } },
      license: { key: "lic-abc" },
      channels: { telegram: { token: "tg-123" } },
      tools: { exec: { allow: [] } },
      mcp: { servers: {} },
    };
    const { respond, promise } = callSet(JSON.stringify(incoming));
    await promise;

    // Write should succeed (ok=true)
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        safetyWarnings: expect.arrayContaining([
          expect.objectContaining({ path: "myCustomSection" }),
        ]),
      }),
      undefined,
    );
    expect(mocks.writeConfigFile).toHaveBeenCalled();
  });

  // ── First-time write (no current config) ────────────────────────────

  it("allows write when no current config exists (first-time write)", async () => {
    currentSnapshot = {
      exists: false,
      valid: false,
      config: {},
      resolved: {},
      parsed: {},
      raw: "",
      issues: [],
      legacyIssues: [],
      path: "/fake/openclawcn.json",
    };

    const incoming = { gateway: { port: 3000 } };
    const { respond, promise } = callSet(JSON.stringify(incoming));
    await promise;

    expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ ok: true }), undefined);
    expect(mocks.writeConfigFile).toHaveBeenCalled();
  });

  // ── baseHash mismatch still blocks ──────────────────────────────────

  it("rejects when baseHash does not match current snapshot hash", async () => {
    const incoming = { agents: { list: [] } };
    const { respond, promise } = callSet(JSON.stringify(incoming), { baseHash: "wrong-hash" });
    await promise;

    expect(respond).toHaveBeenCalledWith(false, undefined, expect.anything());
    expect(mocks.writeConfigFile).not.toHaveBeenCalled();
  });
});
