/**
 * Skills Batch RPC Handlers
 * Gateway RPC handlers for batch skill installation.
 * ClawdbotCN: batch install RPC endpoints
 */

import fs from "node:fs";
import { buildWorkspaceSkillStatus } from "../../agents/skills-status.js";
import { loadConfig } from "../../config/config.js";
import { getManagedSkillsDir } from "../../agents/skills/gitee-registry.js";
import { getRemoteSkillEligibility } from "../../infra/skills-remote.js";
import {
  batchInstall,
} from "../../agents/skills/mirror-download-engine.js";
import {
  getInstallStateSummary,
  dismissBanner,
} from "../../agents/skills/install-state.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// Module-level state for tracking running batches
const runningBatches = new Map<string, AbortController>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rough per-method install size estimates (bytes) */
const SIZE_ESTIMATE_BY_KIND: Record<string, number> = {
  brew: 50_000_000,
  node: 20_000_000,
  go: 30_000_000,
  uv: 15_000_000,
  download: 25_000_000,
};
const DEFAULT_SIZE_ESTIMATE = 20_000_000;

/** Skill tier classification: core → recommended → optional
 *
 * CN-optimized: core/recommended ONLY include skills verified to work in
 * China without VPN. All other skills (including those depending on
 * Google/OpenAI/Spotify/ElevenLabs APIs) are still in the package but
 * classified as "optional".
 *
 * Common mistakes to avoid:
 *   - gog = Google Workspace CLI (Gmail/Drive), NOT local → blocked
 *   - sag = ElevenLabs TTS API, NOT local → blocked
 *   - gemini/oracle = Google/OpenAI API → blocked
 *   - openai-whisper = LOCAL CLI inference, no API call → works!
 *   - nano-banana-pro = Google Gemini API → blocked
 *   - goplaces/local-places = Google Places API → blocked
 *
 * macOS-only skills (apple-notes, etc.) are platform-restricted,
 * NOT geo-restricted — Chinese Mac users CAN use them.
 */
const CORE_SKILLS = new Set([
  // All verified: 国内服务 or 本地运行, no VPN needed
  "weather",            // wttr.in + Open-Meteo, free, no API key
  "baidu-search",       // 百度AI搜索, 国内原生 (替代gog)
  "doubao-open-tts",    // 字节跳动/火山引擎TTS, 200+音色含灿灿 (替代sag)
  "github",             // gh CLI, GitHub accessible in China
  "himalaya",           // local IMAP/SMTP email client
  "1password",          // local password manager
  "camsnap",            // local camera capture
  "nano-pdf",           // local PDF tool
  "obsidian",           // local Obsidian notes
  "openai-whisper",     // LOCAL speech-to-text (not an API call!)
]);
const RECOMMENDED_SKILLS = new Set([
  // ── 本地/离线工具 ──
  "video-frames",      // local ffmpeg
  "songsee",           // local audio visualization
  "sherpa-onnx-tts",   // offline text-to-speech (Piper/VITS离线)
  "faster-whisper",    // 4-6x faster local STT (升级版openai-whisper)
  "openhue",           // local Philips Hue control
  "canvas",            // local network canvas
  "apple-notes",       // macOS: local Notes.app (CN Mac users OK)
  "apple-reminders",   // macOS: local Reminders.app (CN Mac users OK)
  // ── CN大厂服务替代（需国内API Key，一次性配置）──
  "seedream-image-gen",    // 字节豆包Seedream图像生成 (替代openai-image-gen)
  "kimi-integration",      // 月之暗面Kimi K2.5 AI助手 (替代gemini/oracle)
  "conversation-summary-api", // 腾讯对话摘要 (替代summarize)
  "amap-traffic",          // 高德地图路况+路线+POI (替代goplaces/local-places)
]);
function getSkillTier(name: string): "core" | "recommended" | "optional" {
  if (CORE_SKILLS.has(name)) return "core";
  if (RECOMMENDED_SKILLS.has(name)) return "recommended";
  return "optional";
}

/** Simple keyword-based categorization (mirrors curate-skills.mjs logic) */
function categorizeSkill(name: string): string {
  const n = name.toLowerCase();
  const map: Record<string, string[]> = {
    lifestyle: ["weather", "food", "goplaces", "local-places", "amap", "songsee", "music"],
    finance: ["stock", "finance", "budget", "investment", "crypto"],
    computer: ["peekaboo", "camsnap", "screenshot", "system", "terminal"],
    productivity: ["1password", "obsidian", "himalaya", "calendar", "nano-pdf", "apple-notes", "apple-reminders", "conversation-summary"],
    ai_tools: ["sherpa-onnx", "model-usage", "whisper", "skill-creator", "kimi", "faster-whisper", "edge-tts", "doubao", "seedream"],
    creative: ["canvas", "openai-image", "gifgrep", "nano-banana", "video-frames", "blucli"],
    communication: ["discord", "slack", "imsg", "wacli", "telegram", "voice-call"],
    smart_home: ["openhue", "hue", "sonoscli"],
    security: ["1password", "software-protection", "mcporter"],
    development: ["github", "coding", "tmux", "packaging"],
    data: ["duckduckgo", "baidu-search", "bocha", "blogwatcher", "search"],
  };
  for (const [cat, kws] of Object.entries(map)) {
    if (kws.some((k) => n.includes(k))) return cat;
  }
  return "other";
}

/** Get available disk space (bytes) for a path, returns -1 on failure */
function getDiskAvailableBytes(dirPath: string): number {
  try {
    const stats = fs.statfsSync(dirPath);
    return stats.bavail * stats.bsize;
  } catch {
    return -1;
  }
}

// ---------------------------------------------------------------------------
// RPC Handlers
// ---------------------------------------------------------------------------

export const skillsBatchHandlers: GatewayRequestHandlers = {
  /**
   * skills.batch.check
   * Returns missing skills with metadata matching the frontend BatchCheckResult shape:
   *   { missing, total_size_bytes, estimated_seconds, disk_available_bytes, disk_ok }
   */
  "skills.batch.check": ({ params, respond }) => {
    const cfg = loadConfig();
    const managedSkillsDir = getManagedSkillsDir();
    const report = buildWorkspaceSkillStatus(managedSkillsDir, {
      config: cfg,
      eligibility: { remote: getRemoteSkillEligibility() },
    });

    const installState = getInstallStateSummary();

    // If banner was dismissed, return empty
    if (installState.banner_dismissed) {
      respond(true, {
        missing: [],
        total_size_bytes: 0,
        estimated_seconds: 0,
        disk_available_bytes: 0,
        disk_ok: true,
      }, undefined);
      return;
    }

    const skillsWithInstall = report.skills.filter(
      (s) => s.install && s.install.length > 0,
    );

    const notInstalled = skillsWithInstall.filter(
      (s) => !s.eligible || (s.missing && (s.missing.bins.length > 0 || s.missing.anyBins.length > 0)),
    );

    // Build missing array with metadata for each skill
    const missing = notInstalled.map((s) => {
      const firstInstall = s.install[0];
      const method = firstInstall?.kind ?? "download";
      const sizeBytes = SIZE_ESTIMATE_BY_KIND[method] ?? DEFAULT_SIZE_ESTIMATE;
      return {
        name: s.name,
        icon: s.emoji ?? "",
        category: categorizeSkill(s.name),
        size_bytes: sizeBytes,
        method,
        tier: getSkillTier(s.name),
        description: s.description ?? "",
      };
    });

    // Build installed skills list (skills that have install instructions and are eligible)
    const notInstalledNames = new Set(notInstalled.map((s) => s.name));
    const installed = skillsWithInstall
      .filter((s) => !notInstalledNames.has(s.name))
      .map((s) => ({
        name: s.name,
        icon: s.emoji ?? "",
        tier: getSkillTier(s.name),
      }));

    const totalSizeBytes = missing.reduce((sum, s) => sum + s.size_bytes, 0);

    // Rough time estimate: assume ~2MB/s average download + 5s install per skill
    const estimatedSeconds = Math.max(
      10,
      Math.round(totalSizeBytes / (2 * 1024 * 1024) + missing.length * 5),
    );

    const diskAvailableBytes = getDiskAvailableBytes(managedSkillsDir);
    const diskOk = diskAvailableBytes < 0
      ? true // Can't determine → optimistic
      : diskAvailableBytes > totalSizeBytes * 1.5; // Need 1.5x headroom

    respond(true, {
      missing,
      installed,
      total_size_bytes: totalSizeBytes,
      estimated_seconds: estimatedSeconds,
      disk_available_bytes: diskAvailableBytes < 0 ? 0 : diskAvailableBytes,
      disk_ok: diskOk,
    }, undefined);
  },

  /**
   * skills.batch.install
   * Starts a batch installation of the requested skills.
   * Broadcasts progress events via context.broadcast().
   */
  "skills.batch.install": async ({ params, respond, context }) => {
    const p = params as {
      skills?: string[];
      concurrency?: number;
    };

    if (!p || !Array.isArray(p.skills) || p.skills.length === 0) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "skills array is required and must not be empty"),
      );
      return;
    }

    const batchId = `batch-${Date.now()}`;
    const abortController = new AbortController();
    runningBatches.set(batchId, abortController);

    // Respond immediately with batch_id so client can track/cancel
    respond(true, { batch_id: batchId, skills: p.skills, status: "started" }, undefined);

    // Run batch in background (do not await in handler response path)
    batchInstall({
      skills: p.skills,
      concurrency: p.concurrency ?? 2,
      signal: abortController.signal,
      onProgress: (event) => {
        try {
          context.broadcast("skills.batch.progress", { batch_id: batchId, ...event }, { dropIfSlow: true });
        } catch {
          // Ignore broadcast errors
        }
      },
    }).then((result) => {
      runningBatches.delete(batchId);
      try {
        context.broadcast("skills.batch.complete", { batch_id: batchId, ...result });
      } catch {
        // Ignore
      }
    }).catch((err) => {
      runningBatches.delete(batchId);
      try {
        context.broadcast("skills.batch.error", {
          batch_id: batchId,
          error: err instanceof Error ? err.message : String(err),
        });
      } catch {
        // Ignore
      }
    });
  },

  /**
   * skills.batch.cancel
   * Cancels a running batch installation.
   */
  "skills.batch.cancel": ({ params, respond }) => {
    const p = params as { batch_id?: string };

    if (!p || !p.batch_id || typeof p.batch_id !== "string") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "batch_id is required"),
      );
      return;
    }

    const controller = runningBatches.get(p.batch_id);
    if (!controller) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `no running batch with id: ${p.batch_id}`),
      );
      return;
    }

    controller.abort();
    runningBatches.delete(p.batch_id);

    respond(true, { batch_id: p.batch_id, status: "cancelled" }, undefined);
  },

  /**
   * skills.batch.report-failures
   * Client reports failed skills for diagnostics.
   * Also allows dismissing the banner.
   */
  "skills.batch.report-failures": async ({ params, respond, context }) => {
    const p = params as {
      failed?: { skill: string; error: string; mirrors_tried: string[] }[];
      dismiss_banner?: boolean;
    };

    if (p?.dismiss_banner) {
      await dismissBanner();
    }

    // Log failures for diagnostics (if provided)
    if (p?.failed && Array.isArray(p.failed)) {
      for (const entry of p.failed) {
        context?.logGateway?.warn(
          `[skills.batch] failed: ${entry.skill} - ${entry.error} (mirrors: ${entry.mirrors_tried.join(", ")})`,
        );
      }
    }

    const summary = getInstallStateSummary();

    respond(true, {
      acknowledged: true,
      failed_count: p?.failed?.length ?? 0,
      install_state: summary,
    }, undefined);
  },
};
