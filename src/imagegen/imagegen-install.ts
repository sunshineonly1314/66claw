/**
 * Image Generation Install Pipeline -- one-click sd.cpp + model setup.
 *
 * Handles:
 *   1. Download sd.cpp pre-built binary (or build from source)
 *   2. Download selected model weights from CN mirrors
 *   3. Verify integrity
 *   4. Run quick test generation
 *
 * Pattern follows voice/voice-install.ts.
 */

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createWriteStream } from "node:fs";

import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveConfigDir } from "../utils.js";
import { getHardwareSnapshot } from "../voice/hardware-detect.js";
import { classifyImageGenTier } from "./imagegen-tier.js";
import { ALL_MODELS } from "./imagegen-models.js";
import type {
  ImageGenInstallCallback,
  ImageGenInstallProgress,
  ImageGenModelFile,
  ImageGenModelSpec,
  ImageGenTierDecision,
} from "./types.js";

const log = createSubsystemLogger("imagegen/install");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CONFIG_DIR = resolveConfigDir();

/** Model weights storage: ~/.openclawcn/imagegen-models/ */
export const IMAGEGEN_MODELS_DIR = path.join(CONFIG_DIR, "imagegen-models");

/** sd.cpp binary: ~/.openclawcn/imagegen-bin/ */
export const IMAGEGEN_BIN_DIR = path.join(CONFIG_DIR, "imagegen-bin");

/** sd.cpp executable name. */
function getSdCppBinaryName(): string {
  return process.platform === "win32" ? "sd.exe" : "sd";
}

/** Full path to sd.cpp binary. */
export function getSdCppBinaryPath(): string {
  return path.join(IMAGEGEN_BIN_DIR, getSdCppBinaryName());
}

// ---------------------------------------------------------------------------
// sd.cpp Binary Download Sources
// ---------------------------------------------------------------------------

/** Pre-built sd.cpp release URLs for different platforms. */
function getSdCppDownloadUrl(): { url: string; label: string } | null {
  const platform = process.platform;
  const arch = process.arch;

  // Use GitHub Releases from the sd.cpp project
  const baseUrl = "https://github.com/leejet/stable-diffusion.cpp/releases/latest/download";

  if (platform === "win32" && arch === "x64") {
    return {
      url: `${baseUrl}/sd-master-bin-x64-cuda12.zip`,
      label: "GitHub Releases (Windows x64 CUDA)",
    };
  }
  if (platform === "linux" && arch === "x64") {
    return {
      url: `${baseUrl}/sd-master-bin-x64-cuda12.tar.gz`,
      label: "GitHub Releases (Linux x64 CUDA)",
    };
  }
  if (platform === "darwin") {
    return {
      url: `${baseUrl}/sd-master-bin-macos-arm64.tar.gz`,
      label: "GitHub Releases (macOS ARM64)",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _installing = false;

// ---------------------------------------------------------------------------
// Download Helpers
// ---------------------------------------------------------------------------

/**
 * Download a single file with progress tracking.
 * Falls back to alternative sources if primary fails.
 */
async function downloadFile(
  file: ImageGenModelFile,
  destDir: string,
  onProgress?: (downloaded: number, total: number, mirror: string) => void,
): Promise<boolean> {
  const destPath = path.join(destDir, file.relativePath);
  const destDirFull = path.dirname(destPath);
  fs.mkdirSync(destDirFull, { recursive: true });

  // Skip if already exists and size is within 95% of expected
  if (fs.existsSync(destPath)) {
    const stat = fs.statSync(destPath);
    if (stat.size >= file.sizeBytes * 0.95) {
      log.info(`Skipping ${file.relativePath} (already downloaded, ${stat.size} bytes)`);
      return true;
    }
  }

  for (const source of file.sources) {
    try {
      log.info(`Downloading ${file.relativePath} from ${source.label}...`);
      const resp = await fetch(source.url, {
        headers: { "User-Agent": "OpenClawCN/ImageGen" },
        redirect: "follow",
      });

      if (!resp.ok) {
        log.warn(`Mirror ${source.label} returned ${resp.status} for ${file.relativePath}`);
        continue;
      }

      if (!resp.body) {
        log.warn(`Mirror ${source.label} returned no body for ${file.relativePath}`);
        continue;
      }

      const totalBytes = Number(resp.headers.get("content-length") ?? file.sizeBytes);
      let downloadedBytes = 0;

      // Stream to .partial file first (atomic download -- M15 fix)
      const partialPath = destPath + ".partial";
      const nodeStream = Readable.fromWeb(resp.body as import("node:stream/web").ReadableStream);
      const writeStream = createWriteStream(partialPath);

      // Track progress
      nodeStream.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        onProgress?.(downloadedBytes, totalBytes, source.label);
      });

      await pipeline(nodeStream, writeStream);

      // Verify size
      const finalStat = fs.statSync(partialPath);
      if (finalStat.size < file.sizeBytes * 0.9) {
        log.warn(
          `Downloaded ${file.relativePath} is too small (${finalStat.size} < expected ${file.sizeBytes})`,
        );
        fs.unlinkSync(partialPath);
        continue;
      }

      // SHA-256 verification (if source provides a hash)
      const expectedHash = source.sha256;
      if (expectedHash) {
        const hash = crypto.createHash("sha256");
        const readStream = fs.createReadStream(partialPath);
        for await (const chunk of readStream) {
          hash.update(chunk);
        }
        const actualHash = hash.digest("hex");
        if (actualHash !== expectedHash.toLowerCase()) {
          log.error(
            `SHA-256 mismatch for ${file.relativePath} from ${source.label}: ` +
              `expected ${expectedHash}, got ${actualHash}`,
          );
          fs.unlinkSync(partialPath);
          continue;
        }
        log.info(`SHA-256 verified for ${file.relativePath}`);
      }

      // Atomic rename: .partial -> final path
      fs.renameSync(partialPath, destPath);

      log.info(`Downloaded ${file.relativePath}: ${finalStat.size} bytes from ${source.label}`);
      return true;
    } catch (err) {
      log.warn(`Download from ${source.label} failed: ${(err as Error).message}`);
      // Clean up partial file on error
      const partialPath = destPath + ".partial";
      try {
        fs.unlinkSync(partialPath);
      } catch {
        /* ignore */
      }
      // Try next mirror
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main Install Pipeline
// ---------------------------------------------------------------------------

/**
 * One-click install for the detected image generation tier.
 *
 * Steps:
 *   1. Detect hardware -> classify tier
 *   2. Download sd.cpp binary (if local tier)
 *   3. Download model weights
 *   4. Verify files
 *   5. Quick test generation
 */
export async function installImageGenTier(
  onProgress?: ImageGenInstallCallback,
): Promise<{ ok: boolean; decision: ImageGenTierDecision; error?: string }> {
  if (_installing) {
    return {
      ok: false,
      decision: {
        tier: "disabled",
        model: null,
        reason: "安装正在进行中",
        hardware: getHardwareSnapshot(),
      },
      error: "Installation already in progress",
    };
  }

  _installing = true;
  const emit = (p: ImageGenInstallProgress) => {
    onProgress?.(p);
  };

  try {
    // 1. Detect hardware
    emit({ stage: "detecting-hardware", percent: 5, message: "正在检测硬件..." });
    const hw = getHardwareSnapshot();
    const decision = classifyImageGenTier(hw);

    if (decision.tier === "api-only" || decision.tier === "disabled") {
      emit({
        stage: "complete",
        percent: 100,
        message: "硬件不支持本地生图，已切换到云端 API 模式",
      });
      return { ok: true, decision };
    }

    const model = decision.model;
    if (!model) {
      emit({
        stage: "failed",
        percent: 0,
        message: "无法确定要安装的模型",
        error: "No model for tier",
      });
      return { ok: false, decision, error: "No model for tier" };
    }

    // 2. Download sd.cpp binary
    emit({ stage: "downloading-sdcpp", percent: 10, message: "正在下载 sd.cpp 推理引擎..." });

    const sdCppPath = getSdCppBinaryPath();
    if (!fs.existsSync(sdCppPath)) {
      const sdCppUrl = getSdCppDownloadUrl();
      if (!sdCppUrl) {
        emit({
          stage: "failed",
          percent: 0,
          message: "不支持当前平台",
          error: "Unsupported platform",
        });
        return { ok: false, decision, error: "Unsupported platform for sd.cpp" };
      }

      fs.mkdirSync(IMAGEGEN_BIN_DIR, { recursive: true });

      // Download archive
      const archiveExt = sdCppUrl.url.endsWith(".zip") ? ".zip" : ".tar.gz";
      const archivePath = path.join(IMAGEGEN_BIN_DIR, `sd-cpp${archiveExt}`);

      try {
        const resp = await fetch(sdCppUrl.url, {
          headers: { "User-Agent": "OpenClawCN/ImageGen" },
          redirect: "follow",
        });
        if (!resp.ok || !resp.body) {
          throw new Error(`Download failed: ${resp.status}`);
        }
        const nodeStream = Readable.fromWeb(resp.body as import("node:stream/web").ReadableStream);
        await pipeline(nodeStream, createWriteStream(archivePath));

        emit({
          stage: "downloading-sdcpp",
          percent: 20,
          message: "正在解压 sd.cpp...",
          mirrorUsed: sdCppUrl.label,
        });

        // Extract -- platform-specific (use execFileSync to avoid shell injection)
        const { execFileSync } = await import("node:child_process");
        if (archiveExt === ".zip") {
          execFileSync(
            "powershell",
            [
              "-NoProfile",
              "-Command",
              `Expand-Archive -Force '${archivePath.replace(/'/g, "''")}' '${IMAGEGEN_BIN_DIR.replace(/'/g, "''")}'`,
            ],
            { timeout: 60_000, windowsHide: true },
          );
        } else {
          execFileSync("tar", ["-xzf", archivePath, "-C", IMAGEGEN_BIN_DIR], {
            timeout: 60_000,
          });
        }

        // Zip-slip defense: verify no extracted file escapes the target directory
        const realBinDir = fs.realpathSync(IMAGEGEN_BIN_DIR);
        const extracted = fs.readdirSync(IMAGEGEN_BIN_DIR, { recursive: true }) as string[];
        for (const entry of extracted) {
          const fullPath = path.join(IMAGEGEN_BIN_DIR, entry);
          try {
            const realPath = fs.realpathSync(fullPath);
            if (!realPath.startsWith(realBinDir)) {
              log.error(`Zip-slip attack detected: ${entry} resolves outside target dir`);
              fs.rmSync(IMAGEGEN_BIN_DIR, { recursive: true, force: true });
              throw new Error("Archive contains path traversal -- aborting for safety");
            }
          } catch (e) {
            if ((e as Error).message.includes("path traversal")) throw e;
            // Entry may not exist (broken symlink) -- remove it
            try {
              fs.unlinkSync(fullPath);
            } catch {
              /* ignore */
            }
          }
        }

        // Clean up archive
        try {
          fs.unlinkSync(archivePath);
        } catch {
          /* ignore */
        }

        // Make binary executable on Unix
        if (process.platform !== "win32" && fs.existsSync(sdCppPath)) {
          fs.chmodSync(sdCppPath, 0o755);
        }
      } catch (err) {
        emit({
          stage: "failed",
          percent: 0,
          message: `下载 sd.cpp 失败: ${(err as Error).message}`,
          error: (err as Error).message,
        });
        return { ok: false, decision, error: `sd.cpp download failed: ${(err as Error).message}` };
      }
    } else {
      emit({ stage: "downloading-sdcpp", percent: 20, message: "sd.cpp 引擎已存在，跳过下载" });
    }

    // 3. Download model weights
    emit({
      stage: "downloading-models",
      percent: 25,
      message: `正在下载模型 ${model.displayName}...`,
    });

    const modelDir = path.join(IMAGEGEN_MODELS_DIR, model.modelDirName);
    fs.mkdirSync(modelDir, { recursive: true });

    const totalFiles = model.files.length;
    let downloadedCount = 0;

    for (const file of model.files) {
      const success = await downloadFile(file, modelDir, (downloaded, total, mirror) => {
        const fileProgress = downloaded / total;
        const overallPercent = 25 + ((downloadedCount + fileProgress) / totalFiles) * 55;
        emit({
          stage: "downloading-models",
          percent: Math.round(overallPercent),
          message: `正在下载 ${file.relativePath}...`,
          detail: `${Math.round(downloaded / 1024 / 1024)} / ${Math.round(total / 1024 / 1024)} MB`,
          mirrorUsed: mirror,
        });
      });

      if (!success) {
        emit({
          stage: "failed",
          percent: 0,
          message: `模型文件下载失败: ${file.relativePath}`,
          error: `Failed to download ${file.relativePath}`,
        });
        return { ok: false, decision, error: `Failed to download ${file.relativePath}` };
      }

      downloadedCount++;
    }

    // 4. Verify
    emit({ stage: "verifying", percent: 85, message: "正在验证文件完整性..." });

    for (const file of model.files) {
      const filePath = path.join(modelDir, file.relativePath);
      if (!fs.existsSync(filePath)) {
        emit({
          stage: "failed",
          percent: 0,
          message: `验证失败: 文件缺失 ${file.relativePath}`,
          error: `Missing file: ${file.relativePath}`,
        });
        return { ok: false, decision, error: `Missing file: ${file.relativePath}` };
      }
    }

    // 5. Test (optional -- just verify binary runs)
    emit({ stage: "testing", percent: 90, message: "正在测试推理引擎..." });

    if (fs.existsSync(sdCppPath)) {
      try {
        const { execFileSync } = await import("node:child_process");
        execFileSync(sdCppPath, ["--version"], {
          timeout: 10_000,
          stdio: "pipe",
          windowsHide: true,
        });
        log.info("sd.cpp binary test passed");
      } catch (err) {
        log.warn(`sd.cpp binary test failed: ${(err as Error).message}`);
        // Non-fatal -- binary might not support --version
      }
    }

    emit({ stage: "complete", percent: 100, message: "安装完成！本地生图就绪" });
    return { ok: true, decision };
  } catch (err) {
    const errorMsg = (err as Error).message || String(err);
    log.error(`ImageGen install failed: ${errorMsg}`);
    emit({ stage: "failed", percent: 0, message: `安装失败: ${errorMsg}`, error: errorMsg });
    return {
      ok: false,
      decision: classifyImageGenTier(getHardwareSnapshot()),
      error: errorMsg,
    };
  } finally {
    _installing = false;
  }
}

// ---------------------------------------------------------------------------
// Utility: Check if model is installed
// ---------------------------------------------------------------------------

/**
 * Check if a specific model's files are present on disk.
 */
export function isModelInstalled(modelId: string): boolean {
  const model = ALL_MODELS[modelId];
  if (!model) return false;

  const modelDir = path.join(IMAGEGEN_MODELS_DIR, model.modelDirName);
  if (!fs.existsSync(modelDir)) return false;

  return model.files.every((file) => {
    const filePath = path.join(modelDir, file.relativePath);
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    return stat.size >= file.sizeBytes * 0.9;
  });
}

/**
 * Get list of installed model IDs.
 */
export function getInstalledModelIds(): string[] {
  return Object.keys(ALL_MODELS).filter((id) => isModelInstalled(id));
}

/**
 * Whether sd.cpp binary is available.
 */
export function isSdCppAvailable(): boolean {
  return fs.existsSync(getSdCppBinaryPath());
}

// ---------------------------------------------------------------------------
// Single Model Install (for local-engine UI)
// ---------------------------------------------------------------------------

/**
 * Install a single imagegen model by ID.
 *
 * Ensures sd.cpp binary is present, then downloads only the specified model.
 * Used by the local-engine UI when the user clicks [安装] on an individual model.
 */
export async function installSingleImageGenModel(
  modelId: string,
  onProgress?: ImageGenInstallCallback,
): Promise<{ ok: boolean; error?: string }> {
  const model = ALL_MODELS[modelId];
  if (!model) {
    return { ok: false, error: `未知的图像生成模型: ${modelId}` };
  }

  if (isModelInstalled(modelId)) {
    onProgress?.({ stage: "complete", percent: 100, message: `${model.displayName} 已安装` });
    return { ok: true };
  }

  if (_installing) {
    return { ok: false, error: "有其他模型正在安装中，请稍后重试" };
  }
  _installing = true;

  try {
    // 1. Ensure sd.cpp binary
    const sdCppPath = getSdCppBinaryPath();
    if (!fs.existsSync(sdCppPath)) {
      onProgress?.({
        stage: "downloading-sdcpp",
        percent: 5,
        message: "正在下载 sd.cpp 推理引擎...",
      });
      const sdCppUrl = getSdCppDownloadUrl();
      if (!sdCppUrl) {
        return { ok: false, error: "不支持当前平台" };
      }

      fs.mkdirSync(IMAGEGEN_BIN_DIR, { recursive: true });
      const archiveExt = sdCppUrl.url.endsWith(".zip") ? ".zip" : ".tar.gz";
      const archivePath = path.join(IMAGEGEN_BIN_DIR, `sd-cpp${archiveExt}`);

      const resp = await fetch(sdCppUrl.url, {
        headers: { "User-Agent": "OpenClawCN/ImageGen" },
        redirect: "follow",
      });
      if (!resp.ok || !resp.body) {
        return { ok: false, error: `下载 sd.cpp 失败: HTTP ${resp.status}` };
      }

      const nodeStream = Readable.fromWeb(resp.body as import("node:stream/web").ReadableStream);
      await pipeline(nodeStream, createWriteStream(archivePath));

      const { execFileSync } = await import("node:child_process");
      if (archiveExt === ".zip") {
        execFileSync(
          "powershell",
          [
            "-NoProfile",
            "-Command",
            `Expand-Archive -Force '${archivePath.replace(/'/g, "''")}' '${IMAGEGEN_BIN_DIR.replace(/'/g, "''")}'`,
          ],
          { timeout: 60_000, windowsHide: true },
        );
      } else {
        execFileSync("tar", ["-xzf", archivePath, "-C", IMAGEGEN_BIN_DIR], { timeout: 60_000 });
      }

      // Zip-slip defense
      const realBinDir = fs.realpathSync(IMAGEGEN_BIN_DIR);
      const extracted = fs.readdirSync(IMAGEGEN_BIN_DIR, { recursive: true }) as string[];
      for (const entry of extracted) {
        const fullPath = path.join(IMAGEGEN_BIN_DIR, entry);
        try {
          const realPath = fs.realpathSync(fullPath);
          if (!realPath.startsWith(realBinDir)) {
            fs.rmSync(IMAGEGEN_BIN_DIR, { recursive: true, force: true });
            return { ok: false, error: "压缩包包含路径遍历，已中止安装" };
          }
        } catch (e) {
          if ((e as Error).message.includes("path traversal")) throw e;
          try {
            fs.unlinkSync(fullPath);
          } catch {
            /* ignore */
          }
        }
      }

      try {
        fs.unlinkSync(archivePath);
      } catch {
        /* ignore */
      }
      if (process.platform !== "win32" && fs.existsSync(sdCppPath)) {
        fs.chmodSync(sdCppPath, 0o755);
      }
    }

    // 2. Download model files
    const modelDir = path.join(IMAGEGEN_MODELS_DIR, model.modelDirName);
    fs.mkdirSync(modelDir, { recursive: true });

    onProgress?.({
      stage: "downloading-models",
      percent: 25,
      message: `正在下载模型 ${model.displayName}...`,
    });

    for (let i = 0; i < model.files.length; i++) {
      const file = model.files[i]!;
      const success = await downloadFile(file, modelDir, (downloaded, total, mirror) => {
        const fileProgress = downloaded / total;
        const overallPercent = 25 + ((i + fileProgress) / model.files.length) * 65;
        onProgress?.({
          stage: "downloading-models",
          percent: Math.round(overallPercent),
          message: `正在下载 ${file.relativePath}...`,
          detail: `${Math.round(downloaded / 1024 / 1024)} / ${Math.round(total / 1024 / 1024)} MB`,
          mirrorUsed: mirror,
        });
      });

      if (!success) {
        return { ok: false, error: `下载失败: ${file.relativePath}` };
      }
    }

    // 3. Verify
    onProgress?.({ stage: "verifying", percent: 92, message: "正在验证文件完整性..." });
    for (const file of model.files) {
      const filePath = path.join(modelDir, file.relativePath);
      if (!fs.existsSync(filePath)) {
        return { ok: false, error: `验证失败: 文件缺失 ${file.relativePath}` };
      }
    }

    onProgress?.({ stage: "complete", percent: 100, message: `${model.displayName} 安装完成` });
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    onProgress?.({ stage: "failed", percent: 0, message: `安装失败: ${msg}`, error: msg });
    return { ok: false, error: msg };
  } finally {
    _installing = false;
  }
}

/**
 * Uninstall a single imagegen model by removing its files from disk.
 */
export function uninstallImageGenModel(modelId: string): { ok: boolean; error?: string } {
  const model = ALL_MODELS[modelId];
  if (!model) return { ok: false, error: `未知的图像生成模型: ${modelId}` };

  const modelDir = path.join(IMAGEGEN_MODELS_DIR, model.modelDirName);
  if (fs.existsSync(modelDir)) {
    fs.rmSync(modelDir, { recursive: true, force: true });
  }
  return { ok: true };
}
