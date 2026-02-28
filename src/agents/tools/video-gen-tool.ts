/**
 * Video Generation Tool — generates short video clips from text or image prompts.
 *
 * Supports:
 *   - Zhipu CogVideoX (via zhipuai async API)
 *   - SiliconFlow video models (via OpenAI-compatible async API)
 *
 * All video generation APIs are asynchronous (submit → poll → download).
 * The tool handles the full lifecycle internally and returns the video URL.
 *
 * CN-only module: registered in openclaw-tools.ts (runtime) and clawdbot-tools.ts.
 */

import { Type } from "@sinclair/typebox";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AnyAgentTool } from "./common.js";
import type { OpenClawCNConfig } from "../../config/config.js";
import { getApiKeyForModel } from "../model-auth.js";
import { requireApiKey } from "../model-auth.js";
import { ensureOpenClawCNModelsJson } from "../models-config.js";
import { discoverAuthStorage, discoverModels } from "../pi-model-discovery.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { resolveConfigDir } from "../../utils.js";
import { saveGeneratedVideo } from "../../media/chat-video-store.js";

const log = createSubsystemLogger("tools/video-gen");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VideoGenResult = {
  videoUrl: string;
  coverImageUrl?: string;
  model: string;
  provider: string;
  durationSeconds?: number;
};

type VideoGenProviderHandler = (params: {
  apiKey: string;
  prompt: string;
  imageUrl?: string;
  duration?: number;
  size?: string;
  baseUrl?: string;
  modelId: string;
  /** Session key for pending-task persistence (recovery needs it). */
  sessionKey?: string;
  /** Tool call ID so recovery can write back a matching toolResult to the session JSONL. */
  toolCallId?: string;
}) => Promise<VideoGenResult>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max polling time for video generation (5 minutes — Wan2.x typically needs 2-4 min). */
const MAX_POLL_TIME = 300_000;
/** Polling interval (5 seconds). */
const POLL_INTERVAL = 5_000;

// ---------------------------------------------------------------------------
// Local Video Storage
// ---------------------------------------------------------------------------

const VIDEOS_SUBDIR = "videos";

function resolveVideosDir(): string {
  return path.join(resolveConfigDir(), "media", VIDEOS_SUBDIR);
}

/**
 * Download a remote video URL to local disk under ~/.openclawcn/media/videos/.
 * Returns the filename on success, or null on failure (best-effort).
 */
async function downloadVideoToLocal(remoteUrl: string, prompt: string): Promise<string | null> {
  try {
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      log.error(`Video download failed (${response.status}): ${remoteUrl}`);
      return null;
    }

    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length < 1024) {
      log.error(`Video download too small (${buf.length} bytes), likely an error page`);
      return null;
    }

    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
    const timestamp = Date.now();
    const filename = `${timestamp}-${hash}.mp4`;

    const dir = resolveVideosDir();
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(dir, filename), buf, { mode: 0o600 });

    log.info(`Video saved locally: ${filename} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
    return filename;
  } catch (err) {
    log.error(`Video download failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pending Task Persistence — survive gateway restarts
// ---------------------------------------------------------------------------

interface PendingVideoTask {
  requestId: string;
  provider: "siliconflow" | "zhipu";
  modelId: string;
  prompt: string;
  baseUrl: string;
  apiKey: string;
  submittedAt: number;
  /** Session key so recovery can save to the correct per-session directory. */
  sessionKey?: string;
  /** Tool call ID from the PI SDK so recovery can write back a matching toolResult to the JSONL. */
  toolCallId?: string;
}

const PENDING_TASKS_FILE = "_pending.json";

function resolvePendingTasksPath(): string {
  return path.join(resolveVideosDir(), PENDING_TASKS_FILE);
}

async function loadPendingTasks(): Promise<PendingVideoTask[]> {
  try {
    const raw = await fs.readFile(resolvePendingTasksPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as PendingVideoTask[];
  } catch {
    // File missing or corrupt
  }
  return [];
}

async function savePendingTasks(tasks: PendingVideoTask[]): Promise<void> {
  const dir = resolveVideosDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.writeFile(resolvePendingTasksPath(), JSON.stringify(tasks, null, 2), { mode: 0o600 });
}

async function addPendingTask(task: PendingVideoTask): Promise<void> {
  const tasks = await loadPendingTasks();
  // Avoid duplicates
  if (!tasks.some((t) => t.requestId === task.requestId)) {
    tasks.push(task);
    await savePendingTasks(tasks);
  }
}

async function removePendingTask(requestId: string): Promise<void> {
  const tasks = await loadPendingTasks();
  const filtered = tasks.filter((t) => t.requestId !== requestId);
  await savePendingTasks(filtered);
}

/** Result from a single recovered task. */
export interface RecoveredVideoResult {
  sessionKey: string;
  videoUrl: string;
  prompt: string;
  model: string;
  provider: string;
}

/**
 * Write a synthetic tool_result message back to the session JSONL so
 * chat.history includes the recovered video result on next load.
 * Best-effort: failure here does not affect the video file on disk.
 */
async function writeToolResultToTranscript(
  task: PendingVideoTask,
  videoUrl: string,
  localFilename: string | null,
): Promise<void> {
  if (!task.toolCallId || !task.sessionKey) return;

  try {
    const { parseAgentSessionKey } = await import("../../sessions/session-key-utils.js");
    const parsed = parseAgentSessionKey(task.sessionKey);
    if (!parsed) return;

    const { resolveSessionTranscriptPath } = await import("../../config/sessions/paths.js");
    const transcriptPath = resolveSessionTranscriptPath(parsed.rest, parsed.agentId);

    const fsSync = await import("node:fs");
    if (!fsSync.default.existsSync(transcriptPath)) return;

    const { SessionManager } = await import("@mariozechner/pi-coding-agent");
    const sm = SessionManager.open(transcriptPath);

    const resultText = localFilename
      ? `视频已生成并保存到本地，可直接在上方播放或点击「保存到本地」下载。`
      : `视频已生成，可在上方播放。`;

    sm.appendMessage({
      role: "toolResult",
      toolCallId: task.toolCallId,
      toolName: "video_gen",
      content: [{ type: "text", text: resultText }],
      details: {
        model: `${task.provider}/${task.modelId}`,
        videoUrl,
        prompt: task.prompt,
        size: "1280x720",
        mediaType: "video",
        localFilename,
        recovered: true,
      },
      isError: false,
      timestamp: Date.now(),
    } as never);

    log.info(`Wrote recovered tool_result to transcript for toolCallId=${task.toolCallId}`);
  } catch (err) {
    log.warn(
      `Failed to write tool_result to transcript: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * On startup: check for any pending video tasks from previous sessions,
 * poll them to completion, download, and save to the correct per-session store.
 * Also writes a synthetic tool_result to the session JSONL so the chat history
 * shows the recovered video on next load (no stale shimmer / interrupted state).
 * Returns an array of successfully recovered results.
 * Called once when the gateway boots.
 */
export async function recoverPendingVideoTasks(): Promise<RecoveredVideoResult[]> {
  const tasks = await loadPendingTasks();
  if (tasks.length === 0) return [];

  log.info(`Recovering ${tasks.length} pending video task(s) from previous session`);
  const recovered: RecoveredVideoResult[] = [];

  for (const task of tasks) {
    // Skip tasks older than 10 minutes — they've likely expired or failed
    if (Date.now() - task.submittedAt > 600_000) {
      log.info(
        `Skipping expired task ${task.requestId} (submitted ${Math.round((Date.now() - task.submittedAt) / 1000)}s ago)`,
      );
      // Write an error tool_result so the frontend doesn't show a permanent shimmer
      if (task.toolCallId && task.sessionKey) {
        await writeExpiredToolResultToTranscript(task);
      }
      await removePendingTask(task.requestId);
      continue;
    }

    try {
      if (task.provider === "siliconflow") {
        const rawBase = task.baseUrl.replace(/\/v1\/?$/, "");
        const statusUrl = `${rawBase}/v1/video/status`;
        const startTime = Date.now();

        while (Date.now() - startTime < MAX_POLL_TIME) {
          const pollResponse = await fetch(statusUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${task.apiKey}`,
            },
            body: JSON.stringify({ requestId: task.requestId }),
          });

          if (!pollResponse.ok) {
            if (pollResponse.status === 401 || pollResponse.status === 403) break;
            await new Promise((r) => setTimeout(r, POLL_INTERVAL));
            continue;
          }

          const pollData = (await pollResponse.json()) as {
            status?: string;
            results?: { videos?: Array<{ url?: string }> };
          };

          if (pollData.status === "Succeed") {
            const videoUrl = pollData.results?.videos?.[0]?.url;
            if (videoUrl) {
              // Download video bytes
              const dlResp = await fetch(videoUrl);
              if (dlResp.ok) {
                const videoBuf = Buffer.from(await dlResp.arrayBuffer());
                if (videoBuf.length >= 1024) {
                  const sessionKey = task.sessionKey || `default-${task.submittedAt}`;
                  const entry = await saveGeneratedVideo({
                    sessionKey,
                    data: videoBuf,
                    mimeType: "video/mp4",
                    meta: {
                      prompt: task.prompt,
                      model: `${task.provider}/${task.modelId}`,
                      provider: task.provider,
                      size: "1280x720",
                    },
                  });
                  if (entry) {
                    const savedUrl = `/api/media/videos/${sessionKey}/${entry.file}`;
                    log.info(
                      `Recovered video task ${task.requestId} → ${entry.file} (${(videoBuf.length / 1024 / 1024).toFixed(1)} MB)`,
                    );
                    recovered.push({
                      sessionKey,
                      videoUrl: savedUrl,
                      prompt: task.prompt,
                      model: task.modelId,
                      provider: task.provider,
                    });
                    // Write tool_result to JSONL so chat.history includes the video
                    await writeToolResultToTranscript(task, savedUrl, entry.file);
                  } else {
                    // Fallback to legacy flat storage
                    const filename = await downloadVideoToLocal(videoUrl, task.prompt);
                    log.info(
                      `Recovered video task ${task.requestId} → legacy ${filename ?? "download failed"}`,
                    );
                    if (filename) {
                      await writeToolResultToTranscript(
                        task,
                        `/api/media/videos/${filename}`,
                        filename,
                      );
                    }
                  }
                }
              }
            }
            break;
          }
          if (pollData.status === "Failed") {
            log.info(`Recovered task ${task.requestId} had failed`);
            // Write an error tool_result so frontend shows failure not shimmer
            if (task.toolCallId && task.sessionKey) {
              await writeExpiredToolResultToTranscript(task);
            }
            break;
          }

          await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        }
      }
      // Zhipu recovery would be similar but with GET /async-result/{id}
    } catch (err) {
      log.error(
        `Failed to recover task ${task.requestId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    await removePendingTask(task.requestId);
  }

  return recovered;
}

/**
 * Write an error tool_result for an expired/failed task so the frontend
 * doesn't show a permanent shimmer animation.
 */
async function writeExpiredToolResultToTranscript(task: PendingVideoTask): Promise<void> {
  if (!task.toolCallId || !task.sessionKey) return;

  try {
    const { parseAgentSessionKey } = await import("../../sessions/session-key-utils.js");
    const parsed = parseAgentSessionKey(task.sessionKey);
    if (!parsed) return;

    const { resolveSessionTranscriptPath } = await import("../../config/sessions/paths.js");
    const transcriptPath = resolveSessionTranscriptPath(parsed.rest, parsed.agentId);

    const fsSync = await import("node:fs");
    if (!fsSync.default.existsSync(transcriptPath)) return;

    const { SessionManager } = await import("@mariozechner/pi-coding-agent");
    const sm = SessionManager.open(transcriptPath);

    sm.appendMessage({
      role: "toolResult",
      toolCallId: task.toolCallId,
      toolName: "video_gen",
      content: [{ type: "text", text: "视频生成任务已超时或失败，请重新尝试。" }],
      isError: true,
      timestamp: Date.now(),
    } as never);

    log.info(`Wrote expired/failed tool_result for toolCallId=${task.toolCallId}`);
  } catch (err) {
    log.warn(
      `Failed to write expired tool_result: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Provider Handlers
// ---------------------------------------------------------------------------

/**
 * Zhipu CogVideoX video generation.
 *
 * API pattern: async task submission → poll with GET /async-result/{id}
 * Docs: https://open.bigmodel.cn/dev/api/videomodel/cogvideox
 *
 * Supports text-to-video and image-to-video.
 */
const generateWithZhipu: VideoGenProviderHandler = async ({
  apiKey,
  prompt,
  imageUrl,
  size,
  modelId,
  baseUrl,
}) => {
  const submitUrl = `${baseUrl || "https://open.bigmodel.cn"}/api/paas/v4/videos/generations`;

  // Build request body
  const body: Record<string, unknown> = {
    model: modelId || "cogvideox-flash",
    prompt,
  };
  if (imageUrl) {
    body.image_url = imageUrl;
  }
  if (size) {
    body.size = size; // e.g., "1280x720", "720x1280", "960x960"
  }

  const submitResponse = await fetch(submitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text().catch(() => "unknown error");
    throw new Error(
      `Zhipu video generation submit failed (${submitResponse.status}): ${errorText}`,
    );
  }

  const submitData = (await submitResponse.json()) as {
    id?: string;
    task_status?: string;
    request_id?: string;
  };
  const taskId = submitData.id;
  if (!taskId) {
    throw new Error("Zhipu returned no task ID for video generation");
  }

  log.info(`Zhipu video task submitted: ${taskId}`);

  // Poll for result
  const resultUrl = `${baseUrl || "https://open.bigmodel.cn"}/api/paas/v4/async-result/${taskId}`;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

    const pollResponse = await fetch(resultUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollResponse.ok) {
      // Fail fast on permanent errors (auth, not found); retry only on transient errors
      if (pollResponse.status === 401 || pollResponse.status === 403) {
        throw new Error(`Zhipu video poll auth failed (${pollResponse.status})`);
      }
      if (pollResponse.status === 404) {
        throw new Error(`Zhipu video task not found: ${taskId}`);
      }
      log.debug(`Zhipu video poll returned ${pollResponse.status}, retrying...`);
      continue;
    }

    const pollData = (await pollResponse.json()) as {
      task_status?: string;
      video_result?: Array<{
        url?: string;
        cover_image_url?: string;
      }>;
    };
    const status = pollData.task_status;

    if (status === "SUCCESS") {
      const result = pollData.video_result?.[0];
      if (!result?.url) {
        throw new Error("Zhipu video generation returned no video URL");
      }

      return {
        videoUrl: result.url,
        coverImageUrl: result.cover_image_url,
        model: modelId || "cogvideox-flash",
        provider: "zhipu",
      };
    }

    if (status === "FAIL") {
      throw new Error("Zhipu video generation task failed");
    }

    // status === "PROCESSING" — continue polling
    log.debug(`Zhipu video task ${taskId}: ${status}, elapsed=${Date.now() - startTime}ms`);
  }

  throw new Error(`Zhipu video generation timed out (${MAX_POLL_TIME / 1000}s)`);
};

/**
 * SiliconFlow video generation (async API).
 *
 * API pattern: POST /v1/video/submit → poll POST /v1/video/status
 */
const generateWithSiliconFlow: VideoGenProviderHandler = async ({
  apiKey,
  prompt,
  imageUrl,
  modelId,
  baseUrl,
  sessionKey,
  toolCallId,
}) => {
  // Strip trailing /v1 or /v1/ from baseUrl — video endpoints need the raw API root
  const rawBase = (baseUrl || "https://api.siliconflow.cn").replace(/\/v1\/?$/, "");
  const submitUrl = `${rawBase}/v1/video/submit`;

  const body: Record<string, unknown> = {
    model: modelId,
    prompt,
  };
  if (imageUrl) {
    body.image_url = imageUrl;
  }

  const submitResponse = await fetch(submitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text().catch(() => "unknown error");
    throw new Error(`SiliconFlow video submit failed (${submitResponse.status}): ${errorText}`);
  }

  const submitData = (await submitResponse.json()) as {
    requestId?: string;
  };
  const requestId = submitData.requestId;
  if (!requestId) {
    throw new Error("SiliconFlow returned no requestId for video generation");
  }

  log.info(`SiliconFlow video task submitted: ${requestId}`);

  // Persist task so it can be recovered after restart
  await addPendingTask({
    requestId,
    provider: "siliconflow",
    modelId,
    prompt,
    baseUrl: rawBase,
    apiKey,
    submittedAt: Date.now(),
    sessionKey,
    toolCallId,
  });

  // Poll for result
  const statusUrl = `${rawBase}/v1/video/status`;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

    const pollResponse = await fetch(statusUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ requestId }),
    });
    if (!pollResponse.ok) {
      // Fail fast on permanent errors
      if (pollResponse.status === 401 || pollResponse.status === 403) {
        throw new Error(`SiliconFlow video poll auth failed (${pollResponse.status})`);
      }
      log.debug(`SiliconFlow video poll returned ${pollResponse.status}, retrying...`);
      continue;
    }

    const pollData = (await pollResponse.json()) as {
      status?: string;
      results?: {
        videos?: Array<{ url?: string }>;
      };
    };
    const status = pollData.status;

    if (status === "Succeed") {
      await removePendingTask(requestId);
      const videoData = pollData.results?.videos?.[0];
      if (!videoData?.url) {
        throw new Error("SiliconFlow video generation returned no video URL");
      }

      return {
        videoUrl: videoData.url,
        model: modelId,
        provider: "siliconflow",
      };
    }

    if (status === "Failed") {
      await removePendingTask(requestId);
      throw new Error("SiliconFlow video generation task failed");
    }

    // InProgress / Queued — continue polling
    log.debug(
      `SiliconFlow video task ${requestId}: ${status}, elapsed=${Date.now() - startTime}ms`,
    );
  }

  // Don't remove pending task on timeout — recovery can still pick it up
  throw new Error(`SiliconFlow video generation timed out (${MAX_POLL_TIME / 1000}s)`);
};

// ---------------------------------------------------------------------------
// Provider resolver
// ---------------------------------------------------------------------------

function resolveVideoGenProvider(provider: string, modelId: string): VideoGenProviderHandler {
  // glm is the provider ID used by model discovery; zhipu is the display/registry ID
  if (provider === "zhipu" || provider === "glm" || modelId.includes("cogvideo")) {
    return generateWithZhipu;
  }
  if (provider === "siliconflow") {
    return generateWithSiliconFlow;
  }
  // Default to Zhipu (most widely accessible in CN)
  return generateWithZhipu;
}

/** Check if a model ID looks like a video generation model. */
export function isVideoGenModelId(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.includes("cogvideo") ||
    lower.includes("seedance") ||
    lower.includes("wan-ai") ||
    lower.includes("wan2") ||
    lower.includes("wan-2") ||
    lower.includes("t2v") ||
    lower.includes("kling") ||
    lower.includes("video-gen")
  );
}

// ---------------------------------------------------------------------------
// Tool Factory
// ---------------------------------------------------------------------------

export function createVideoGenTool(options?: {
  config?: OpenClawCNConfig;
  agentDir?: string;
  sessionKey?: string;
}): AnyAgentTool {
  return {
    label: "Video Generation",
    name: "video_gen",
    description:
      "Generate short video clips from text descriptions (takes 30s-3min). " +
      "If the user's request is vague (e.g. '帮我生成个视频'), briefly ask what they want before calling. " +
      "If the user already described specific content, call directly.",
    parameters: Type.Object({
      prompt: Type.String({
        description: "Detailed text description of the video to generate",
      }),
      image_url: Type.Optional(
        Type.String({
          description:
            "Optional reference image URL for image-to-video generation. " +
            "Supports http(s):// URLs and data: URIs.",
        }),
      ),
      size: Type.Optional(
        Type.String({
          description:
            "Video size/aspect ratio. Options: 1280x720 (landscape, default), 720x1280 (portrait), 960x960 (square)",
        }),
      ),
    }),
    execute: async (toolCallId, args) => {
      const record = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
      const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
      if (!prompt) {
        return {
          content: [{ type: "text", text: "Error: prompt is required for video generation." }],
          details: { error: "missing_prompt" },
        };
      }

      const imageUrl = typeof record.image_url === "string" ? record.image_url.trim() : undefined;
      const size = typeof record.size === "string" ? record.size.trim() : "1280x720";

      const agentDir = options?.agentDir?.trim() || "";
      const cfg = options?.config;

      try {
        // Discover available models and find one that supports video generation
        if (agentDir) await ensureOpenClawCNModelsJson(cfg, agentDir);
        const authStorage = agentDir ? discoverAuthStorage(agentDir) : null;
        const registry = authStorage && agentDir ? discoverModels(authStorage, agentDir) : null;
        const models = registry ? registry.getAll() : [];

        // Find a video generation model
        let videoGenModel = models.find((m) => isVideoGenModelId(m.id));

        // Fallback: if no video model in models.json, check if a provider with
        // known video capabilities (SiliconFlow, Zhipu) is already configured.
        // The setup wizard doesn't write video models into models.json, but the
        // user may have a valid API key for a provider that supports them.
        if (!videoGenModel) {
          // Read from models.json raw providers section to find configured providers
          let rawProviders: Record<
            string,
            { baseUrl?: string; apiKey?: string; models?: unknown[] }
          > = {};
          try {
            const modelsJsonPath = path.join(agentDir, "models.json");
            const raw = JSON.parse(await fs.readFile(modelsJsonPath, "utf8"));
            rawProviders = raw?.providers ?? {};
          } catch {
            /* ignore */
          }

          // Try SiliconFlow first (best value for CN video gen)
          const sfProvider = rawProviders["siliconflow"];
          if (sfProvider?.apiKey) {
            videoGenModel = {
              id: "Wan-AI/Wan2.2-T2V-A14B",
              provider: "siliconflow",
              baseUrl: sfProvider.baseUrl || "https://api.siliconflow.cn/v1",
            } as unknown as typeof videoGenModel;
            log.info("Video model not in models.json; using SiliconFlow Wan2.2 (fallback)");
          }

          // Try Zhipu
          if (!videoGenModel) {
            const zhipuProvider = rawProviders["zhipu"] || rawProviders["glm"];
            if (zhipuProvider?.apiKey) {
              videoGenModel = {
                id: "cogvideox-flash",
                provider: "zhipu",
                baseUrl: zhipuProvider.baseUrl || "https://open.bigmodel.cn",
              } as unknown as typeof videoGenModel;
              log.info("Video model not in models.json; using Zhipu CogVideoX-Flash (fallback)");
            }
          }
        }

        if (!videoGenModel) {
          return {
            content: [
              {
                type: "text",
                text:
                  "No video generation model configured. " +
                  "Please configure a video generation model (e.g., cogvideox-flash, cogvideox) " +
                  "in your agent settings or add a Zhipu API key.",
              },
            ],
            details: { error: "no_video_gen_model" },
          };
        }

        log.info(`Using video gen model: ${videoGenModel.provider}/${videoGenModel.id}`);

        // Get API key — try model-auth first, fall back to raw provider key
        let apiKey: string;
        try {
          const authInfo = await getApiKeyForModel({
            model: videoGenModel,
            cfg,
            agentDir,
          });
          apiKey = requireApiKey(authInfo, videoGenModel.provider);
        } catch {
          // Fallback: read API key directly from models.json providers
          let rawProviders: Record<string, { apiKey?: string }> = {};
          try {
            const modelsJsonPath = path.join(agentDir, "models.json");
            const raw = JSON.parse(await fs.readFile(modelsJsonPath, "utf8"));
            rawProviders = raw?.providers ?? {};
          } catch {
            /* ignore */
          }
          const providerEntry = rawProviders[videoGenModel.provider];
          if (!providerEntry?.apiKey) {
            throw new Error(`No API key found for provider ${videoGenModel.provider}`);
          }
          apiKey = providerEntry.apiKey;
        }

        // Select provider handler
        const handler = resolveVideoGenProvider(videoGenModel.provider, videoGenModel.id);

        // Generate video
        const sessionKey = options?.sessionKey || `default-${Date.now()}`;
        const result = await handler({
          apiKey,
          prompt,
          imageUrl: imageUrl || undefined,
          size,
          baseUrl: videoGenModel.baseUrl,
          modelId: videoGenModel.id,
          sessionKey,
          toolCallId,
        });

        log.info(`Video generated successfully: ${result.provider}/${result.model}`);

        // Download video from remote URL
        const response = await fetch(result.videoUrl);
        if (!response.ok) {
          throw new Error(`Video download failed (${response.status})`);
        }
        const videoBuf = Buffer.from(await response.arrayBuffer());
        if (videoBuf.length < 1024) {
          throw new Error(`Video download too small (${videoBuf.length} bytes)`);
        }

        // Save to per-session storage via chat-video-store
        const entry = await saveGeneratedVideo({
          sessionKey,
          data: videoBuf,
          mimeType: "video/mp4",
          meta: {
            prompt,
            model: `${result.provider}/${result.model}`,
            provider: result.provider,
            size,
            durationSeconds: result.durationSeconds,
            coverImageUrl: result.coverImageUrl,
          },
        });

        let videoUrl: string;
        let localFilename: string | null = null;
        if (entry) {
          videoUrl = `/api/media/videos/${sessionKey}/${entry.file}`;
          localFilename = entry.file;
          log.info(`Video saved: ${entry.file} (${(videoBuf.length / 1024 / 1024).toFixed(1)} MB)`);
        } else {
          // Fallback: save via legacy flat storage
          localFilename = await downloadVideoToLocal(result.videoUrl, prompt);
          videoUrl = localFilename ? `/api/media/videos/${localFilename}` : result.videoUrl;
        }

        // Build response text — shown to both user and AI, so keep it concise and CN-friendly.
        // IMPORTANT: never include raw URLs here; the AI tends to repeat them verbatim.
        const resultText = localFilename
          ? `视频已生成并保存到本地，可直接在上方播放或点击「保存到本地」下载。`
          : `视频已生成，可在上方播放。`;

        return {
          content: [{ type: "text", text: resultText }],
          details: {
            model: `${result.provider}/${result.model}`,
            videoUrl,
            coverImageUrl: result.coverImageUrl,
            prompt,
            size,
            mediaType: "video",
            localFilename,
          },
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(`Video generation failed: ${errorMsg}`);

        return {
          content: [
            {
              type: "text",
              text: `Video generation failed: ${errorMsg}`,
            },
          ],
          details: { error: errorMsg, prompt, size, mediaType: "video" },
        };
      }
    },
  };
}
