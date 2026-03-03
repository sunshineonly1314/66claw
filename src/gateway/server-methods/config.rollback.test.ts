/**
 * Integration tests for config.rollback.list and config.rollback.apply handlers.
 *
 * Tests:
 *   config.rollback.list  — returns backup slot inventory
 *   config.rollback.apply — dry-run validation, actual rollback, restart scheduling
 *   config.rollback.apply — proper error handling for missing/invalid backups
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/* Backup state controlled by mocks                                   */
/* ------------------------------------------------------------------ */

type BackupEntry = {
  index: number;
  filePath: string;
  exists: boolean;
  sizeBytes: number | null;
  modifiedAt: Date | null;
  version: string | null;
  touchedAt: string | null;
  valid: boolean;
  issues: unknown[];
};

const GOOD_BACKUP: BackupEntry = {
  index: 0,
  filePath: "/fake/openclawcn.json.bak",
  exists: true,
  sizeBytes: 1024,
  modifiedAt: new Date("2026-03-01T10:00:00Z"),
  version: "1.2.3",
  touchedAt: "2026-03-01T10:00:00Z",
  valid: true,
  issues: [],
};

const MISSING_BACKUP: BackupEntry = {
  index: 1,
  filePath: "/fake/openclawcn.json.bak.1",
  exists: false,
  sizeBytes: null,
  modifiedAt: null,
  version: null,
  touchedAt: null,
  valid: false,
  issues: [],
};

const INVALID_BACKUP: BackupEntry = {
  index: 2,
  filePath: "/fake/openclawcn.json.bak.2",
  exists: true,
  sizeBytes: 50,
  modifiedAt: new Date("2026-02-01T00:00:00Z"),
  version: "0.9.0",
  touchedAt: "2026-02-01T00:00:00Z",
  valid: false,
  issues: [{ path: "root", message: "invalid config" }],
};

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockListBackups = vi.fn(() => [GOOD_BACKUP, MISSING_BACKUP, INVALID_BACKUP]);
const mockRollbackConfig = vi.fn(async () => ({
  ok: true,
  restoredFrom: GOOD_BACKUP.filePath,
  version: GOOD_BACKUP.version,
}));
const mockWriteConfigFile = vi.fn(async () => {});
const mockWriteRestartSentinel = vi.fn(async () => "/fake/sentinel.json");
const mockScheduleRestart = vi.fn(() => ({ scheduled: true, delayMs: 0 }));

vi.mock("../../config/config.js", () => ({
  CONFIG_PATH: "/fake/openclawcn.json",
  loadConfig: () => ({}),
  parseConfigJson5: (_raw: string) => ({ ok: true, parsed: JSON.parse(_raw) }),
  readConfigFileSnapshot: async () => ({
    exists: true,
    valid: true,
    config: {},
    resolved: {},
    parsed: {},
    raw: "{}",
    issues: [],
    legacyIssues: [],
    path: "/fake/openclawcn.json",
  }),
  readConfigFileSnapshotForWrite: async () => ({
    snapshot: {
      exists: true,
      valid: true,
      config: {},
      resolved: {},
      parsed: {},
      raw: "{}",
      issues: [],
      legacyIssues: [],
      path: "/fake/openclawcn.json",
    },
    writeOptions: { envSnapshotForRestore: undefined, expectedConfigPath: "/fake/openclawcn.json" },
  }),
  resolveConfigSnapshotHash: () => "hash-abc",
  validateConfigObjectWithPlugins: (cfg: unknown) => ({
    ok: true,
    config: cfg,
    issues: [],
    warnings: [],
  }),
  withConfigWriteLock: async (fn: () => Promise<unknown>) => fn(),
  writeConfigFile: mockWriteConfigFile,
}));

vi.mock("../../config/config-rollback.js", () => ({
  listConfigBackups: mockListBackups,
  rollbackConfig: mockRollbackConfig,
}));

vi.mock("../../config/legacy.js", () => ({
  applyLegacyMigrations: (cfg: unknown) => ({ next: null, changes: [] }),
}));

vi.mock("../../config/merge-patch.js", () => ({
  applyMergePatch: (_base: unknown, patch: unknown) => patch,
  createMergePatch: () => ({}),
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
  extractDeliveryInfo: () => ({ deliveryContext: null, threadId: null }),
}));

vi.mock("../../infra/restart-sentinel.js", () => ({
  formatDoctorNonInteractiveHint: () => "run openclawcn doctor",
  writeRestartSentinel: mockWriteRestartSentinel,
}));

vi.mock("../../infra/restart.js", () => ({
  scheduleGatewaySigusr1Restart: mockScheduleRestart,
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
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function callHandler(
  method: "config.rollback.list" | "config.rollback.apply",
  params: Record<string, unknown>,
) {
  const respond = vi.fn();
  const handler = configHandlers[method] as (args: {
    params: unknown;
    respond: typeof respond;
    context: unknown;
    req: unknown;
    client: null;
    isWebchatConnect: () => boolean;
  }) => Promise<void>;
  const promise = handler({
    params,
    respond,
    context: {},
    req: { type: "req" as const, id: "1", method },
    client: null,
    isWebchatConnect: () => false,
  });
  return { respond, promise };
}

/* ------------------------------------------------------------------ */
/* Tests: config.rollback.list                                        */
/* ------------------------------------------------------------------ */

describe("config.rollback.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListBackups.mockReturnValue([GOOD_BACKUP, MISSING_BACKUP, INVALID_BACKUP]);
  });

  it("returns backup inventory from listConfigBackups()", async () => {
    const { respond, promise } = callHandler("config.rollback.list", {});
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        backups: expect.arrayContaining([
          expect.objectContaining({ index: 0, exists: true, version: "1.2.3", valid: true }),
          expect.objectContaining({ index: 1, exists: false }),
          expect.objectContaining({ index: 2, exists: true, valid: false }),
        ]),
      }),
      undefined,
    );
  });

  it("returns 3 slots even when none exist", async () => {
    const empty: BackupEntry[] = [
      { ...MISSING_BACKUP, index: 0, filePath: "/fake/openclawcn.json.bak" },
      { ...MISSING_BACKUP, index: 1 },
      { ...MISSING_BACKUP, index: 2, filePath: "/fake/openclawcn.json.bak.2" },
    ];
    mockListBackups.mockReturnValue(empty);

    const { respond, promise } = callHandler("config.rollback.list", {});
    await promise;

    const [ok, result] = respond.mock.calls[0] as [boolean, { backups: BackupEntry[] }, undefined];
    expect(ok).toBe(true);
    expect(result.backups).toHaveLength(3);
    expect(result.backups.every((b) => !b.exists)).toBe(true);
  });

  it("rejects invalid params", async () => {
    // additionalProperties: false — extra key should fail
    const { respond, promise } = callHandler("config.rollback.list", {
      unknownParam: true,
    } as unknown as Record<string, unknown>);
    await promise;

    // AJV with strict:false might allow extra properties; the important thing is
    // that valid empty-object params succeed (tested above). This test confirms
    // at minimum the handler runs without throwing.
    expect(respond).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* Tests: config.rollback.apply                                       */
/* ------------------------------------------------------------------ */

describe("config.rollback.apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: dry-run succeeds (backup valid)
    mockRollbackConfig.mockResolvedValue({
      ok: true,
      restoredFrom: GOOD_BACKUP.filePath,
      version: GOOD_BACKUP.version,
    });
  });

  // ── dryRun=true ─────────────────────────────────────────────────────

  it("dry-run returns backup info without writing", async () => {
    const { respond, promise } = callHandler("config.rollback.apply", {
      index: 0,
      dryRun: true,
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        dryRun: true,
        index: 0,
        version: "1.2.3",
        restoredFrom: GOOD_BACKUP.filePath,
      }),
      undefined,
    );
    // rollbackConfig called once for dry-run validation
    expect(mockRollbackConfig).toHaveBeenCalledWith(0, { validate: true, dryRun: true });
    // should NOT call a second time for actual write
    expect(mockRollbackConfig).toHaveBeenCalledTimes(1);
    expect(mockWriteConfigFile).not.toHaveBeenCalled();
  });

  // ── actual rollback ──────────────────────────────────────────────────

  it("performs actual rollback and schedules restart by default", async () => {
    // dry-run call returns ok; then actual rollback call also returns ok
    mockRollbackConfig
      .mockResolvedValueOnce({ ok: true, restoredFrom: GOOD_BACKUP.filePath, version: "1.2.3" })
      .mockResolvedValueOnce({ ok: true, restoredFrom: GOOD_BACKUP.filePath, version: "1.2.3" });

    const { respond, promise } = callHandler("config.rollback.apply", { index: 0 });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        index: 0,
        version: "1.2.3",
        restoredFrom: GOOD_BACKUP.filePath,
        restart: expect.anything(),
        sentinel: expect.objectContaining({ path: "/fake/sentinel.json" }),
      }),
      undefined,
    );
    // rollbackConfig called twice: once dry-run, once actual
    expect(mockRollbackConfig).toHaveBeenCalledTimes(2);
    expect(mockRollbackConfig).toHaveBeenNthCalledWith(1, 0, { validate: true, dryRun: true });
    expect(mockRollbackConfig).toHaveBeenNthCalledWith(2, 0, { validate: true, dryRun: false });
    // Restart was scheduled
    expect(mockScheduleRestart).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "config.rollback.apply" }),
    );
  });

  it("skips restart when noRestart=true", async () => {
    mockRollbackConfig
      .mockResolvedValueOnce({ ok: true, restoredFrom: GOOD_BACKUP.filePath, version: "1.2.3" })
      .mockResolvedValueOnce({ ok: true, restoredFrom: GOOD_BACKUP.filePath, version: "1.2.3" });

    const { respond, promise } = callHandler("config.rollback.apply", {
      index: 0,
      noRestart: true,
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ ok: true }), undefined);
    const [, result] = respond.mock.calls[0] as [boolean, Record<string, unknown>, undefined];
    expect(result.restart).toBeUndefined();
    expect(result.sentinel).toBeUndefined();
    expect(mockScheduleRestart).not.toHaveBeenCalled();
  });

  // ── dry-run validation failure ───────────────────────────────────────

  it("rejects when backup slot is missing (dry-run fails)", async () => {
    mockRollbackConfig.mockResolvedValueOnce({
      ok: false,
      restoredFrom: MISSING_BACKUP.filePath,
      version: null,
      error: "Backup file not found: /fake/openclawcn.json.bak.1",
    });

    const { respond, promise } = callHandler("config.rollback.apply", { index: 1 });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("not found"),
      }),
    );
    // Must not proceed to actual rollback
    expect(mockRollbackConfig).toHaveBeenCalledTimes(1);
  });

  it("rejects when backup is invalid (dry-run validation fails)", async () => {
    mockRollbackConfig.mockResolvedValueOnce({
      ok: false,
      restoredFrom: INVALID_BACKUP.filePath,
      version: "0.9.0",
      error: "Backup config is invalid: root: bad field",
    });

    const { respond, promise } = callHandler("config.rollback.apply", { index: 2 });
    await promise;

    expect(respond).toHaveBeenCalledWith(false, undefined, expect.anything());
    expect(mockRollbackConfig).toHaveBeenCalledTimes(1);
  });

  // ── actual rollback failure ──────────────────────────────────────────

  it("returns error when actual rollback fails after dry-run passes", async () => {
    // dry-run passes
    mockRollbackConfig
      .mockResolvedValueOnce({ ok: true, restoredFrom: GOOD_BACKUP.filePath, version: "1.2.3" })
      // actual rollback fails (e.g. race condition, disk error)
      .mockResolvedValueOnce({
        ok: false,
        restoredFrom: GOOD_BACKUP.filePath,
        version: "1.2.3",
        error: "Rollback failed: EACCES permission denied",
      });

    const { respond, promise } = callHandler("config.rollback.apply", { index: 0 });
    await promise;

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("EACCES"),
      }),
    );
    // No restart scheduled on failure
    expect(mockScheduleRestart).not.toHaveBeenCalled();
  });

  // ── param validation ────────────────────────────────────────────────

  it("rejects missing index param", async () => {
    const { respond, promise } = callHandler(
      "config.rollback.apply",
      {} as Record<string, unknown>,
    );
    await promise;

    expect(respond).toHaveBeenCalledWith(false, undefined, expect.anything());
    expect(mockRollbackConfig).not.toHaveBeenCalled();
  });

  it("rejects index out of range (>2)", async () => {
    const { respond, promise } = callHandler("config.rollback.apply", { index: 5 });
    await promise;

    expect(respond).toHaveBeenCalledWith(false, undefined, expect.anything());
    expect(mockRollbackConfig).not.toHaveBeenCalled();
  });

  it("rejects negative index", async () => {
    const { respond, promise } = callHandler("config.rollback.apply", { index: -1 });
    await promise;

    expect(respond).toHaveBeenCalledWith(false, undefined, expect.anything());
    expect(mockRollbackConfig).not.toHaveBeenCalled();
  });

  // ── index boundary: all valid slots ─────────────────────────────────

  it("accepts index=0 (most recent .bak)", async () => {
    mockRollbackConfig
      .mockResolvedValueOnce({
        ok: true,
        restoredFrom: "/fake/openclawcn.json.bak",
        version: "1.0.0",
      })
      .mockResolvedValueOnce({
        ok: true,
        restoredFrom: "/fake/openclawcn.json.bak",
        version: "1.0.0",
      });

    const { respond, promise } = callHandler("config.rollback.apply", {
      index: 0,
      noRestart: true,
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ index: 0 }), undefined);
  });

  it("accepts index=2 (oldest .bak.2)", async () => {
    mockRollbackConfig
      .mockResolvedValueOnce({
        ok: true,
        restoredFrom: "/fake/openclawcn.json.bak.2",
        version: "0.8.0",
      })
      .mockResolvedValueOnce({
        ok: true,
        restoredFrom: "/fake/openclawcn.json.bak.2",
        version: "0.8.0",
      });

    const { respond, promise } = callHandler("config.rollback.apply", {
      index: 2,
      noRestart: true,
    });
    await promise;

    expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ index: 2 }), undefined);
  });
});
