/**
 * Hardware Detection — GPU VRAM, system RAM, CPU info.
 *
 * Detects NVIDIA GPU via `nvidia-smi`, system RAM via `os` module.
 * Results are cached for 60 seconds since hardware doesn't change mid-session.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { GpuInfo, HardwareSnapshot } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;

/**
 * Common nvidia-smi locations on Windows.
 * On Linux/macOS it's typically on PATH.
 */
const NVIDIA_SMI_PATHS_WIN = [
  "nvidia-smi", // PATH
  "C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe",
  "C:\\Windows\\System32\\nvidia-smi.exe",
];

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let _cached: HardwareSnapshot | null = null;
let _cachedAt = 0;

// ---------------------------------------------------------------------------
// NVIDIA GPU Detection
// ---------------------------------------------------------------------------

/**
 * Resolve the nvidia-smi executable path.
 * On Windows, checks multiple known locations.
 * Returns null if not found.
 */
function resolveNvidiaSmi(): string | null {
  if (process.platform !== "win32") {
    // On Linux/macOS, rely on PATH
    try {
      execFileSync("nvidia-smi", ["--version"], {
        timeout: 5000,
        stdio: "pipe",
        windowsHide: true,
      });
      return "nvidia-smi";
    } catch {
      return null;
    }
  }

  // Windows: try known paths
  for (const candidate of NVIDIA_SMI_PATHS_WIN) {
    try {
      if (candidate !== "nvidia-smi" && !fs.existsSync(candidate)) continue;
      execFileSync(candidate, ["--version"], {
        timeout: 5000,
        stdio: "pipe",
        windowsHide: true,
      });
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Parse CUDA version from nvidia-smi header output.
 * nvidia-smi prints something like: "CUDA Version: 12.1"
 */
function parseCudaVersion(output: string): string | undefined {
  const match = output.match(/CUDA Version:\s*(\d+\.\d+)/);
  return match?.[1];
}

/**
 * Detect NVIDIA GPU by running nvidia-smi.
 * Returns null for AMD, Intel, or missing GPU.
 */
export function detectNvidiaGpu(): GpuInfo | null {
  const smiPath = resolveNvidiaSmi();
  if (!smiPath) return null;

  try {
    // Query GPU properties in CSV format
    const csvOutput = execFileSync(
      smiPath,
      ["--query-gpu=name,memory.total,memory.free,driver_version", "--format=csv,noheader,nounits"],
      { timeout: 10_000, encoding: "utf-8", stdio: "pipe", windowsHide: true },
    ).trim();

    if (!csvOutput) return null;

    // Parse CSV: "NVIDIA GeForce RTX 4060, 8188, 6542, 572.16"
    // Take only the first GPU if multiple are present
    const firstLine = csvOutput.split("\n")[0]?.trim();
    if (!firstLine) return null;

    const parts = firstLine.split(",").map((s) => s.trim());
    if (parts.length < 4) return null;

    const name = parts[0]!;
    const vramTotalMB = Number.parseInt(parts[1]!, 10);
    const vramFreeMB = Number.parseInt(parts[2]!, 10);
    const driverVersion = parts[3]!;

    if (!Number.isFinite(vramTotalMB) || !Number.isFinite(vramFreeMB)) return null;

    // Get CUDA version from a separate call (nvidia-smi header)
    let cudaVersion: string | undefined;
    try {
      const headerOutput = execFileSync(smiPath, [], {
        timeout: 5000,
        encoding: "utf-8",
        stdio: "pipe",
        windowsHide: true,
      });
      cudaVersion = parseCudaVersion(headerOutput);
    } catch {
      // CUDA version is optional
    }

    return {
      vendor: "nvidia",
      name,
      vramTotalMB,
      vramFreeMB,
      driverVersion,
      cudaVersion,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// System RAM
// ---------------------------------------------------------------------------

function getSystemRam(): { totalMB: number; freeMB: number } {
  return {
    totalMB: Math.round(os.totalmem() / (1024 * 1024)),
    freeMB: Math.round(os.freemem() / (1024 * 1024)),
  };
}

// ---------------------------------------------------------------------------
// CPU Info
// ---------------------------------------------------------------------------

function getCpuInfo(): { model: string; cores: number } {
  const cpus = os.cpus();
  return {
    model: cpus[0]?.model ?? "unknown",
    cores: cpus.length,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get complete hardware snapshot.
 * Cached for 60s since hardware doesn't change during a session.
 */
export function getHardwareSnapshot(): HardwareSnapshot {
  const now = Date.now();
  if (_cached && now - _cachedAt < CACHE_TTL_MS) {
    return _cached;
  }
  return refreshHardwareSnapshot();
}

/**
 * Force refresh hardware detection (bypass cache).
 */
export function refreshHardwareSnapshot(): HardwareSnapshot {
  const gpu = detectNvidiaGpu();
  const ram = getSystemRam();
  const cpu = getCpuInfo();

  const snapshot: HardwareSnapshot = {
    gpu,
    totalRamMB: ram.totalMB,
    freeRamMB: ram.freeMB,
    cpuModel: cpu.model,
    cpuCores: cpu.cores,
    platform: process.platform,
    arch: process.arch,
    timestamp: Date.now(),
  };

  _cached = snapshot;
  _cachedAt = snapshot.timestamp;
  return snapshot;
}
