/**
 * Tests for local-engine.ts RPC handlers.
 *
 * Validates all 13 bug fixes:
 *   BUG 1/5  - ESM import (no require) + SenseVoice disk detection
 *   BUG 3    - KWS model visible in buildStatus
 *   BUG 7    - isCpu via CPU_MODELS set, not string match
 *   BUG 8    - Edge TTS excluded from local model list
 *   BUG 10   - Voice sidecar auto-start only loads installed models
 *   BUG 10b  - Same guard in local_engine.start
 *   BUG 11   - refreshImageGenTierStatus instead of stale cache
 *   BUG 12   - install_recommended continues on voice failure
 *   BUG 13   - Uninstall stops sidecar before deleting files
 *   BUG 14   - install_recommended auto-starts sidecars
 *   BUG 15   - Duplicate install rejected before respond(true)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestContext, GatewayClient, RespondFn } from "./types.js";
import type { RequestFrame } from "../protocol/index.js";

// ── Mock data ──────────────────────────────────────────────────────────

const MOCK_HW = {
  gpu: { vendor: "nvidia", name: "RTX 4090", vramTotalMB: 24000, vramFreeMB: 20000 },
  totalRamMB: 32000,
  freeRamMB: 16000,
  cpuModel: "Intel i9-14900K",
  cpuCores: 24,
  platform: "win32",
  arch: "x64",
};

const MOCK_HW_NO_GPU = {
  ...MOCK_HW,
  gpu: null,
};

const MOCK_HW_LOW_VRAM = {
  ...MOCK_HW,
  gpu: { vendor: "nvidia", name: "GTX 1650", vramTotalMB: 4000, vramFreeMB: 3000 },
};

function makeVoiceModel(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    displayName: `Voice ${id}`,
    modelDirName: id,
    downloadSizeMB: 500,
    estimatedMemoryMB: 1000,
    backend: "python-sidecar",
    files: [{ relativePath: "model.safetensors", downloadUrl: "https://example.com" }],
    ...overrides,
  };
}

function makeImageGenModel(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    displayName: `ImageGen ${id}`,
    modelDirName: id,
    downloadSizeMB: 2000,
    estimatedMemoryMB: 4000,
    defaultSize: "512x512",
    ...overrides,
  };
}

const VOICE_MODELS: Record<string, ReturnType<typeof makeVoiceModel>> = {
  "qwen3-asr-0.6b": makeVoiceModel("qwen3-asr-0.6b"),
  "sensevoice-small": makeVoiceModel("sensevoice-small", {
    backend: "onnx",
    estimatedMemoryMB: 400,
    downloadSizeMB: 200,
    files: [
      { relativePath: "model.int8.onnx", downloadUrl: "" },
      { relativePath: "tokens.txt", downloadUrl: "" },
    ],
  }),
  "qwen3-tts-0.6b": makeVoiceModel("qwen3-tts-0.6b"),
  "kokoro-82m": makeVoiceModel("kokoro-82m", {
    backend: "kokoro",
    estimatedMemoryMB: 1400,
    downloadSizeMB: 300,
  }),
  "kws-zipformer-zh-en-3m": makeVoiceModel("kws-zipformer-zh-en-3m", {
    backend: "sherpa-onnx",
    estimatedMemoryMB: 30,
    downloadSizeMB: 6,
    files: [{ relativePath: "encoder-epoch-13-avg-2-chunk-16-left-64.int8.onnx", downloadUrl: "" }],
  }),
};

const GPU_IMAGEGEN = makeImageGenModel("sd-turbo-gpu", { estimatedMemoryMB: 4000 });
const CPU_IMAGEGEN = makeImageGenModel("sd-turbo-cpu", { estimatedMemoryMB: 2000 });
const IMAGEGEN_MODELS: Record<string, ReturnType<typeof makeImageGenModel>> = {
  "sd-turbo-gpu": GPU_IMAGEGEN,
  "sd-turbo-cpu": CPU_IMAGEGEN,
};
const IMAGEGEN_CPU_MODELS = { sdTurboCpu: CPU_IMAGEGEN };

// ── Filesystem mock ──────────────────────────────────────────────────────
// Track which paths "exist" on the virtual filesystem
let existingPaths: Set<string>;

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn((p: string) => {
      // Normalize path separators for cross-platform
      const normalized = String(p).replace(/\\/g, "/");
      return existingPaths.has(normalized);
    }),
  };
});

const getHardwareSnapshotMock = vi.fn(() => MOCK_HW);
const refreshHardwareSnapshotMock = vi.fn(() => MOCK_HW);
vi.mock("../../voice/hardware-detect.js", () => ({
  getHardwareSnapshot: (...args: unknown[]) => getHardwareSnapshotMock(...args),
  refreshHardwareSnapshot: (...args: unknown[]) => refreshHardwareSnapshotMock(...args),
}));

const voiceSystemStatus = {
  tier: {
    tier: "gpu-full",
    asrModel: VOICE_MODELS["qwen3-asr-0.6b"],
    ttsModel: VOICE_MODELS["qwen3-tts-0.6b"],
  },
  gpuSidecar: null as { status: string; asrReady: boolean; ttsReady: boolean } | null,
};
vi.mock("../../voice/voice-router.js", () => ({
  getVoiceSystemStatus: vi.fn(async () => voiceSystemStatus),
}));

const imagegenSystemStatus = {
  tier: { tier: "gpu-hq", model: GPU_IMAGEGEN },
  sidecar: null as { status: string; modelId?: string } | null,
};
vi.mock("../../imagegen/imagegen-router.js", () => ({
  getImageGenSystemStatus: vi.fn(() => imagegenSystemStatus),
  refreshImageGenTierStatus: vi.fn(() => imagegenSystemStatus.tier),
}));

vi.mock("../../voice/voice-models.js", () => ({
  ALL_MODELS: VOICE_MODELS,
}));

vi.mock("../../imagegen/imagegen-models.js", () => ({
  ALL_MODELS: IMAGEGEN_MODELS,
  CPU_MODELS: IMAGEGEN_CPU_MODELS,
}));

vi.mock("../../voice/voice-install.js", () => ({
  VOICE_MODELS_DIR: "/models/voice",
  installSingleVoiceModel: vi.fn(async () => ({ ok: true })),
  installVoiceTier: vi.fn(async () => ({ ok: true })),
  uninstallVoiceModel: vi.fn(() => ({ ok: true })),
}));

vi.mock("../../imagegen/imagegen-install.js", () => ({
  getInstalledModelIds: vi.fn(() => []),
  installSingleImageGenModel: vi.fn(async () => ({ ok: true })),
  installImageGenTier: vi.fn(async () => ({ ok: true })),
  uninstallImageGenModel: vi.fn(() => ({ ok: true })),
}));

vi.mock("../../tts/tts-kokoro.js", () => ({
  isKokoroInstalled: vi.fn(() => false),
}));

const classifyVoiceTierMock = vi.fn(() => ({
  tier: "gpu-asr",
  asrModel: VOICE_MODELS["qwen3-asr-0.6b"],
  ttsModel: null,
}));
vi.mock("../../voice/voice-tier.js", () => ({
  classifyVoiceTier: (...args: unknown[]) => classifyVoiceTierMock(...args),
}));

const startGpuSidecarMock = vi.fn(async () => ({ ok: true }));
const stopGpuSidecarMock = vi.fn(async () => {});
const getGpuSidecarStateMock = vi.fn(() => ({
  status: "stopped",
  port: 50100,
  asrReady: false,
  ttsReady: false,
}));
vi.mock("../../voice/gpu-sidecar.js", () => ({
  startGpuSidecar: (...args: unknown[]) => startGpuSidecarMock(...args),
  stopGpuSidecar: (...args: unknown[]) => stopGpuSidecarMock(...args),
  getGpuSidecarState: (...args: unknown[]) => getGpuSidecarStateMock(...args),
}));

const startSdCppSidecarMock = vi.fn(async () => ({ ok: true, state: {} }));
const stopSdCppSidecarMock = vi.fn(async () => {});
const getSdCppSidecarStateMock = vi.fn(() => ({ status: "stopped", port: 50200, ready: false }));
vi.mock("../../imagegen/sd-cpp-sidecar.js", () => ({
  startSdCppSidecar: (...args: unknown[]) => startSdCppSidecarMock(...args),
  stopSdCppSidecar: (...args: unknown[]) => stopSdCppSidecarMock(...args),
  getSdCppSidecarState: (...args: unknown[]) => getSdCppSidecarStateMock(...args),
}));

// Import after all mocks
import { localEngineHandlers } from "./local-engine.js";
import {
  installSingleVoiceModel,
  installVoiceTier,
  uninstallVoiceModel,
} from "../../voice/voice-install.js";
import {
  installSingleImageGenModel,
  installImageGenTier,
  getInstalledModelIds,
  uninstallImageGenModel,
} from "../../imagegen/imagegen-install.js";
import { refreshImageGenTierStatus } from "../../imagegen/imagegen-router.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeContext(): GatewayRequestContext {
  return {
    broadcast: vi.fn(),
    broadcastToConnIds: vi.fn(),
    logGateway: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  } as unknown as GatewayRequestContext;
}

async function callHandler(
  method: string,
  params: Record<string, unknown> = {},
  context?: GatewayRequestContext,
  client?: GatewayClient | null,
) {
  const respond = vi.fn<RespondFn>();
  const ctx = context ?? makeContext();
  const handler = localEngineHandlers[method];
  if (!handler) throw new Error(`handler not found: ${method}`);
  await handler({
    req: { method } as unknown as RequestFrame,
    params,
    respond,
    context: ctx,
    client: client ?? null,
    isWebchatConnect: () => false,
  });
  return { respond, context: ctx };
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  existingPaths = new Set();
  getHardwareSnapshotMock.mockReturnValue(MOCK_HW);
  voiceSystemStatus.tier = {
    tier: "gpu-full",
    asrModel: VOICE_MODELS["qwen3-asr-0.6b"],
    ttsModel: VOICE_MODELS["qwen3-tts-0.6b"],
  };
  voiceSystemStatus.gpuSidecar = null;
  imagegenSystemStatus.tier = { tier: "gpu-hq", model: GPU_IMAGEGEN };
  imagegenSystemStatus.sidecar = null;
  vi.mocked(getInstalledModelIds).mockReturnValue([]);
});

// ── BUG 1/5: ESM import + disk detection ─────────────────────────────────

describe("buildStatus - disk detection (BUG 1/5)", () => {
  it("detects qwen3-asr as installed when model.safetensors exists on disk", async () => {
    existingPaths.add("/models/voice/qwen3-asr-0.6b");
    existingPaths.add("/models/voice/qwen3-asr-0.6b/model.safetensors");

    const { respond } = await callHandler("local_engine.status");

    expect(respond).toHaveBeenCalledWith(true, expect.anything());
    const [, status] = respond.mock.calls[0];
    const asr = status.models.voice.find((m: { id: string }) => m.id === "qwen3-asr-0.6b");
    expect(asr).toBeDefined();
    expect(asr.status).toBe("installed");
  });

  it("marks qwen3-asr as installable when model.safetensors is missing", async () => {
    // dir exists but no model file
    existingPaths.add("/models/voice/qwen3-asr-0.6b");

    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];
    const asr = status.models.voice.find((m: { id: string }) => m.id === "qwen3-asr-0.6b");
    expect(asr.status).toBe("installable");
  });

  it("detects sensevoice-small via model.int8.onnx + tokens.txt", async () => {
    existingPaths.add("/models/voice/sensevoice-small");
    existingPaths.add("/models/voice/sensevoice-small/model.int8.onnx");
    existingPaths.add("/models/voice/sensevoice-small/tokens.txt");

    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];
    const sv = status.models.voice.find((m: { id: string }) => m.id === "sensevoice-small");
    expect(sv.status).toBe("installed");
  });

  it("marks sensevoice as installable when tokens.txt is missing", async () => {
    existingPaths.add("/models/voice/sensevoice-small");
    existingPaths.add("/models/voice/sensevoice-small/model.int8.onnx");
    // tokens.txt missing

    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];
    const sv = status.models.voice.find((m: { id: string }) => m.id === "sensevoice-small");
    expect(sv.status).toBe("installable");
  });
});

// ── BUG 3: KWS model in buildStatus ─────────────────────────────────────

describe("buildStatus - KWS model (BUG 3)", () => {
  it("includes KWS model in voice group", async () => {
    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];
    const kws = status.models.voice.find((m: { id: string }) => m.id === "kws-zipformer-zh-en-3m");
    expect(kws).toBeDefined();
    expect(kws.capability).toBe("audio");
    expect(kws.runMode).toBe("cpu");
    expect(kws.recommended).toBe(false);
  });

  it("detects KWS as installed via first file", async () => {
    existingPaths.add("/models/voice/kws-zipformer-zh-en-3m");
    existingPaths.add(
      "/models/voice/kws-zipformer-zh-en-3m/encoder-epoch-13-avg-2-chunk-16-left-64.int8.onnx",
    );

    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];
    const kws = status.models.voice.find((m: { id: string }) => m.id === "kws-zipformer-zh-en-3m");
    expect(kws.status).toBe("installed");
  });
});

// ── BUG 7: isCpu via CPU_MODELS set ─────────────────────────────────────

describe("buildStatus - isCpu detection (BUG 7)", () => {
  it("classifies CPU imagegen model via CPU_MODELS set, not string match", async () => {
    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];
    const cpuModel = status.models.image.find((m: { id: string }) => m.id === "sd-turbo-cpu");
    expect(cpuModel).toBeDefined();
    expect(cpuModel.runMode).toBe("cpu");

    const gpuModel = status.models.image.find((m: { id: string }) => m.id === "sd-turbo-gpu");
    expect(gpuModel).toBeDefined();
    expect(gpuModel.runMode).toBe("gpu");
  });
});

// ── BUG 8: Edge TTS excluded ────────────────────────────────────────────

describe("buildStatus - Edge TTS (BUG 8)", () => {
  it("does NOT include edge-tts in the voice model list", async () => {
    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];
    const edgeTts = status.models.voice.find((m: { id: string }) => m.id === "edge-tts");
    expect(edgeTts).toBeUndefined();
  });
});

// ── BUG 8 + hardware checks ────────────────────────────────────────────

describe("buildStatus - hardware availability", () => {
  it("marks GPU ASR as not_available without NVIDIA GPU", async () => {
    getHardwareSnapshotMock.mockReturnValue(MOCK_HW_NO_GPU);

    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];
    const asr = status.models.voice.find((m: { id: string }) => m.id === "qwen3-asr-0.6b");
    expect(asr.status).toBe("not_available");
    expect(asr.unavailableReason).toContain("NVIDIA GPU");
  });

  it("marks GPU TTS as not_available with low VRAM (<6.3GB effective)", async () => {
    getHardwareSnapshotMock.mockReturnValue(MOCK_HW_LOW_VRAM);

    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];
    const tts = status.models.voice.find((m: { id: string }) => m.id === "qwen3-tts-0.6b");
    expect(tts.status).toBe("not_available");
  });

  it("shows ASR as running when sidecar is up and asrReady", async () => {
    voiceSystemStatus.gpuSidecar = { status: "running", asrReady: true, ttsReady: false };
    existingPaths.add("/models/voice/qwen3-asr-0.6b");
    existingPaths.add("/models/voice/qwen3-asr-0.6b/model.safetensors");

    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];
    const asr = status.models.voice.find((m: { id: string }) => m.id === "qwen3-asr-0.6b");
    expect(asr.status).toBe("running");
  });
});

// ── BUG 10: Voice sidecar auto-start after install ──────────────────────

describe("install - voice sidecar auto-start (BUG 10)", () => {
  it("starts sidecar with safeDecision after installing ASR (strips missing TTS)", async () => {
    // ASR exists on disk after install, TTS does not
    existingPaths.add("/models/voice/qwen3-asr-0.6b/model.safetensors");

    classifyVoiceTierMock.mockReturnValue({
      tier: "gpu-full",
      asrModel: VOICE_MODELS["qwen3-asr-0.6b"],
      ttsModel: VOICE_MODELS["qwen3-tts-0.6b"], // not installed
    });

    await callHandler("local_engine.install", { modelId: "qwen3-asr-0.6b" });

    expect(startGpuSidecarMock).toHaveBeenCalledTimes(1);
    const decision = startGpuSidecarMock.mock.calls[0][0];
    expect(decision.asrModel).toBeTruthy();
    expect(decision.ttsModel).toBeNull(); // stripped because TTS not on disk
  });

  it("does NOT start sidecar when neither ASR nor TTS are on disk", async () => {
    // No model files on disk
    classifyVoiceTierMock.mockReturnValue({
      tier: "gpu-full",
      asrModel: VOICE_MODELS["qwen3-asr-0.6b"],
      ttsModel: VOICE_MODELS["qwen3-tts-0.6b"],
    });

    await callHandler("local_engine.install", { modelId: "qwen3-asr-0.6b" });

    expect(startGpuSidecarMock).not.toHaveBeenCalled();
  });

  it("does NOT auto-start for non-python-sidecar models (sensevoice)", async () => {
    vi.mocked(installSingleVoiceModel).mockResolvedValueOnce({ ok: true });
    await callHandler("local_engine.install", { modelId: "sensevoice-small" });
    expect(startGpuSidecarMock).not.toHaveBeenCalled();
  });
});

// ── BUG 10b: local_engine.start disk guard ──────────────────────────────

describe("start - voice disk guard (BUG 10b)", () => {
  it("rejects start when no GPU models are installed on disk", async () => {
    classifyVoiceTierMock.mockReturnValue({
      tier: "gpu-asr",
      asrModel: VOICE_MODELS["qwen3-asr-0.6b"],
      ttsModel: null,
    });
    // No files on disk

    const { respond } = await callHandler("local_engine.start", { domain: "voice" });

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("No GPU voice models installed"),
      }),
    );
    expect(startGpuSidecarMock).not.toHaveBeenCalled();
  });

  it("starts with safeDecision when only ASR is on disk", async () => {
    existingPaths.add("/models/voice/qwen3-asr-0.6b/model.safetensors");
    classifyVoiceTierMock.mockReturnValue({
      tier: "gpu-full",
      asrModel: VOICE_MODELS["qwen3-asr-0.6b"],
      ttsModel: VOICE_MODELS["qwen3-tts-0.6b"],
    });

    await callHandler("local_engine.start", { domain: "voice" });

    expect(startGpuSidecarMock).toHaveBeenCalledTimes(1);
    const decision = startGpuSidecarMock.mock.calls[0][0];
    expect(decision.asrModel).not.toBeNull();
    expect(decision.ttsModel).toBeNull();
  });
});

// ── BUG 11: refreshImageGenTierStatus ──────────────────────────────────

describe("start - imagegen refreshes tier (BUG 11)", () => {
  it("calls refreshImageGenTierStatus (not cached getter) on imagegen start", async () => {
    await callHandler("local_engine.start", { domain: "imagegen" });
    expect(refreshImageGenTierStatus).toHaveBeenCalled();
  });
});

// ── BUG 12: install_recommended continues on voice failure ──────────────

describe("install_recommended - partial failure (BUG 12)", () => {
  it("continues to install imagegen even when voice fails", async () => {
    vi.mocked(installVoiceTier).mockResolvedValueOnce({
      ok: false,
      error: "voice download failed",
    });
    vi.mocked(installImageGenTier).mockResolvedValueOnce({ ok: true });

    const ctx = makeContext();
    await callHandler("local_engine.install_recommended", {}, ctx);

    // Both install functions should have been called
    expect(installVoiceTier).toHaveBeenCalled();
    expect(installImageGenTier).toHaveBeenCalled();

    // Final broadcast should show partial failure
    const broadcasts = vi.mocked(ctx.broadcast).mock.calls;
    const finalBroadcast = broadcasts[broadcasts.length - 1];
    const payload = finalBroadcast[1] as { stage: string; message: string };
    expect(payload.stage).toBe("failed");
    expect(payload.message).toContain("语音");
  });

  it("reports all-ok when both succeed", async () => {
    vi.mocked(installVoiceTier).mockResolvedValueOnce({ ok: true });
    vi.mocked(installImageGenTier).mockResolvedValueOnce({ ok: true });

    const ctx = makeContext();
    await callHandler("local_engine.install_recommended", {}, ctx);

    const broadcasts = vi.mocked(ctx.broadcast).mock.calls;
    const finalBroadcast = broadcasts[broadcasts.length - 1];
    const payload = finalBroadcast[1] as { stage: string };
    expect(payload.stage).toBe("complete");
  });
});

// ── BUG 13: Uninstall stops sidecar first ───────────────────────────────

describe("uninstall - stops sidecar first (BUG 13)", () => {
  it("stops GPU sidecar before uninstalling a python-sidecar voice model", async () => {
    getGpuSidecarStateMock.mockReturnValue({
      status: "running",
      port: 50100,
      asrReady: true,
      ttsReady: false,
    });

    const { respond } = await callHandler("local_engine.uninstall", { modelId: "qwen3-asr-0.6b" });

    expect(stopGpuSidecarMock).toHaveBeenCalledTimes(1);
    expect(uninstallVoiceModel).toHaveBeenCalledWith("qwen3-asr-0.6b");
    expect(respond).toHaveBeenCalledWith(true, { modelId: "qwen3-asr-0.6b" }, undefined);
  });

  it("does NOT stop sidecar when uninstalling a non-python-sidecar model (sensevoice)", async () => {
    await callHandler("local_engine.uninstall", { modelId: "sensevoice-small" });

    expect(stopGpuSidecarMock).not.toHaveBeenCalled();
    expect(uninstallVoiceModel).toHaveBeenCalledWith("sensevoice-small");
  });

  it("does NOT stop sidecar when it is already stopped", async () => {
    getGpuSidecarStateMock.mockReturnValue({
      status: "stopped",
      port: 50100,
      asrReady: false,
      ttsReady: false,
    });

    await callHandler("local_engine.uninstall", { modelId: "qwen3-asr-0.6b" });

    expect(stopGpuSidecarMock).not.toHaveBeenCalled();
    expect(uninstallVoiceModel).toHaveBeenCalled();
  });

  it("stops sd.cpp sidecar before uninstalling imagegen model", async () => {
    getSdCppSidecarStateMock.mockReturnValue({ status: "running", port: 50200, ready: true });

    const { respond } = await callHandler("local_engine.uninstall", { modelId: "sd-turbo-gpu" });

    expect(stopSdCppSidecarMock).toHaveBeenCalledTimes(1);
    expect(uninstallImageGenModel).toHaveBeenCalledWith("sd-turbo-gpu");
    expect(respond).toHaveBeenCalledWith(true, { modelId: "sd-turbo-gpu" }, undefined);
  });

  it("rejects unknown model ID", async () => {
    const { respond } = await callHandler("local_engine.uninstall", { modelId: "unknown-model" });
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("Unknown model"),
      }),
    );
  });
});

// ── BUG 14: install_recommended auto-starts sidecars ─────────────────────

describe("install_recommended - auto-start sidecars (BUG 14)", () => {
  it("starts voice sidecar after successful voice tier install", async () => {
    vi.mocked(installVoiceTier).mockResolvedValueOnce({ ok: true });
    vi.mocked(installImageGenTier).mockResolvedValueOnce({ ok: true });

    // Tier says gpu-asr with python-sidecar ASR model
    classifyVoiceTierMock.mockReturnValue({
      tier: "gpu-asr",
      asrModel: VOICE_MODELS["qwen3-asr-0.6b"],
      ttsModel: null,
    });
    existingPaths.add("/models/voice/qwen3-asr-0.6b/model.safetensors");

    await callHandler("local_engine.install_recommended");

    expect(startGpuSidecarMock).toHaveBeenCalledTimes(1);
  });

  it("starts imagegen sidecar after successful imagegen tier install", async () => {
    vi.mocked(installVoiceTier).mockResolvedValueOnce({ ok: true });
    vi.mocked(installImageGenTier).mockResolvedValueOnce({ ok: true });

    // No python-sidecar voice models to trigger voice sidecar
    classifyVoiceTierMock.mockReturnValue({
      tier: "cpu-asr",
      asrModel: null,
      ttsModel: null,
    });

    await callHandler("local_engine.install_recommended");

    expect(startSdCppSidecarMock).toHaveBeenCalledTimes(1);
    expect(refreshImageGenTierStatus).toHaveBeenCalled();
  });

  it("does NOT start voice sidecar if voice install failed", async () => {
    vi.mocked(installVoiceTier).mockResolvedValueOnce({ ok: false, error: "fail" });
    vi.mocked(installImageGenTier).mockResolvedValueOnce({ ok: true });

    await callHandler("local_engine.install_recommended");

    expect(startGpuSidecarMock).not.toHaveBeenCalled();
    // But imagegen sidecar should still start
    expect(startSdCppSidecarMock).toHaveBeenCalledTimes(1);
  });
});

// ── BUG 15: Duplicate install rejection ─────────────────────────────────

describe("install - duplicate rejection (BUG 15)", () => {
  it("rejects duplicate install with respond(false) BEFORE respond(true)", async () => {
    // First install: make it hang so it doesn't finish
    let resolveInstall: (() => void) | undefined;
    vi.mocked(installSingleVoiceModel).mockImplementationOnce(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          resolveInstall = () => resolve({ ok: true });
        }),
    );

    const ctx = makeContext();
    // Start first install (doesn't await — it will block on installSingleVoiceModel)
    const firstInstall = callHandler("local_engine.install", { modelId: "qwen3-asr-0.6b" }, ctx);

    // Yield to let the first handler run up to the _installingModels.add() call
    await new Promise((r) => setTimeout(r, 10));

    // Second install should be rejected immediately
    const { respond: respond2 } = await callHandler(
      "local_engine.install",
      { modelId: "qwen3-asr-0.6b" },
      ctx,
    );

    expect(respond2).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("正在安装中"),
      }),
    );

    // Clean up first install
    resolveInstall?.();
    await firstInstall;
  });

  it("allows same model install after previous completes (lock cleared)", async () => {
    vi.mocked(installSingleVoiceModel).mockResolvedValue({ ok: true });

    // First install
    await callHandler("local_engine.install", { modelId: "qwen3-asr-0.6b" });

    // Second install should succeed (lock cleared by finally)
    const { respond } = await callHandler("local_engine.install", { modelId: "qwen3-asr-0.6b" });
    expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ started: true }));
  });

  it("clears lock even on error (finally block)", async () => {
    vi.mocked(installSingleVoiceModel).mockRejectedValueOnce(new Error("boom"));

    const ctx = makeContext();
    await callHandler("local_engine.install", { modelId: "qwen3-asr-0.6b" }, ctx);

    // Lock should be cleared, next install should succeed
    const { respond } = await callHandler(
      "local_engine.install",
      { modelId: "qwen3-asr-0.6b" },
      ctx,
    );
    expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ started: true }));
  });
});

// ── Basic handler tests ──────────────────────────────────────────────────

describe("basic handler tests", () => {
  it("local_engine.status returns complete structure", async () => {
    const { respond } = await callHandler("local_engine.status");
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        hardware: expect.objectContaining({ gpu: expect.any(Object) }),
        models: expect.objectContaining({ voice: expect.any(Array), image: expect.any(Array) }),
        summary: expect.objectContaining({ runningCount: 0, installedCount: 0 }),
        voiceTier: "gpu-full",
        imagegenTier: "gpu-hq",
      }),
    );
  });

  it("local_engine.hardware returns hw snapshot", async () => {
    const { respond } = await callHandler("local_engine.hardware");
    expect(respond).toHaveBeenCalledWith(true, MOCK_HW);
  });

  it("local_engine.redetect calls refreshHardwareSnapshot", async () => {
    const { respond } = await callHandler("local_engine.redetect");
    expect(refreshHardwareSnapshotMock).toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(true, MOCK_HW);
  });

  it("local_engine.install rejects missing modelId", async () => {
    const { respond } = await callHandler("local_engine.install", {});
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("Missing modelId"),
      }),
    );
  });

  it("local_engine.stop voice calls stopGpuSidecar", async () => {
    const { respond } = await callHandler("local_engine.stop", { domain: "voice" });
    expect(stopGpuSidecarMock).toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(true, { status: "stopped" });
  });

  it("local_engine.stop imagegen calls stopSdCppSidecar", async () => {
    const { respond } = await callHandler("local_engine.stop", { domain: "imagegen" });
    expect(stopSdCppSidecarMock).toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(true, { status: "stopped" });
  });

  it("local_engine.stop rejects unknown domain", async () => {
    const { respond } = await callHandler("local_engine.stop", { domain: "unknown" });
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("Unknown domain"),
      }),
    );
  });

  it("local_engine.start rejects unknown domain", async () => {
    const { respond } = await callHandler("local_engine.start", { domain: "unknown" });
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("Unknown domain"),
      }),
    );
  });
});

// ── Summary calculation ──────────────────────────────────────────────────

describe("buildStatus - summary", () => {
  it("counts installed and running models correctly", async () => {
    // Mark ASR as installed + running
    voiceSystemStatus.gpuSidecar = { status: "running", asrReady: true, ttsReady: false };
    existingPaths.add("/models/voice/qwen3-asr-0.6b");
    existingPaths.add("/models/voice/qwen3-asr-0.6b/model.safetensors");
    // Mark one imagegen as installed
    vi.mocked(getInstalledModelIds).mockReturnValue(["sd-turbo-gpu"]);
    imagegenSystemStatus.sidecar = { status: "running", modelId: "sd-turbo-gpu" };

    const { respond } = await callHandler("local_engine.status");
    const [, status] = respond.mock.calls[0];

    // ASR running + imagegen running = 2 running
    expect(status.summary.runningCount).toBe(2);
    // running counts as installed too
    expect(status.summary.installedCount).toBeGreaterThanOrEqual(2);
  });
});
