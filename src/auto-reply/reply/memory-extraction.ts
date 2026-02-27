/**
 * [CN-PATCH:memory-extraction] Deterministic post-reply memory extraction.
 *
 * After each agent turn, use a free CN LLM (default: Ant Ling ling-1t) to
 * extract user facts/preferences/corrections from the conversation and write
 * them into profile.json. This is a lightweight single fetch() call —
 * NOT a full embedded PI agent turn.
 *
 * Solves the "silent memory loss" problem where the Agent forgets to call
 * memory_upsert during normal conversation, especially in short sessions.
 */

import { createRequire } from "node:module";
import type { OpenClawCNConfig } from "../../config/config.js";
import {
  resolveMemoryProviderApiKey,
  resolveMemoryProviderBaseUrl,
  resolveMemoryProviderHeaders,
  isOpenAICompatibleProvider,
} from "./memory-key-resolver.js";

const _require = createRequire(import.meta.url);
import {
  withProfileLock,
  readProfile,
  upsertProfileEntryFull,
  formatProfileForExtraction,
  PROFILE_MAX_KEY_LENGTH,
  PROFILE_MAX_VALUE_LENGTH,
  type ProfileCategory,
  type ProfileEntry,
} from "../../memory/profile-store.js";
import { logVerbose } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import type { FollowupRun } from "./queue.js";
import { runMemoryConsolidation } from "./memory-consolidation.js";

// ── Constants ──

const VALID_CATEGORIES = new Set<ProfileCategory>([
  "preference",
  "correction",
  "fact",
  "identity",
  "todo",
  "procedure",
]);

const MAX_EXTRACTIONS_PER_TURN = 5;

const DEFAULT_EXTRACTION_SETTINGS: Required<MemoryExtractionSettings> = {
  enabled: true,
  provider: "meituan-longcat",
  model: "longcat-flash-chat",
  temperature: 0.1,
  maxTokens: 1024,
  timeoutMs: 15_000,
  periodicTurnInterval: 5,
  minMessageLength: 5,
  longMessageThreshold: 300,
  keywords: [
    "记住",
    "以后都",
    "我喜欢",
    "我不喜欢",
    "不要再",
    "我是",
    "我叫",
    "我的名字",
    "请叫我",
    "每次都",
    "总是要",
    "别忘了",
    "我偏好",
    "我习惯",
    "请记得",
    "我一般",
    "不要给我",
    "都用",
    "一律",
    "remember",
    "always",
    "never",
    "prefer",
    "my name",
    "call me",
    "I like",
    "I don't like",
    "I am a",
  ],
};

const EXTRACTION_SYSTEM_PROMPT = [
  "你是用户记忆提取器。分析对话，提取值得长期记住的用户信息。",
  "",
  "输出格式：JSON数组，每项包含 op、category、key、value 四个字段。",
  '示例：[{"op":"set","category":"preference","key":"编程语言","value":"喜欢 TypeScript，不要 Python"}]',
  "",
  "op 取值：",
  '- "set": 覆盖已有同 key 条目，或新建条目（默认）',
  '- "add": 强制新建条目，不覆盖已有 key（用于一对多关系，如多个家人、多个项目）',
  "",
  "category 取值：preference | correction | fact | identity | todo | procedure",
  "- preference: 用户偏好（语言、工具、风格等）",
  "- correction: 用户纠正你的错误（必须记住）",
  "- fact: 项目事实、技术决策、工作信息",
  "- identity: 用户身份信息（名字、角色、团队、家人）",
  "- todo: 待办事项",
  "- procedure: 用户建立的规则/流程",
  "",
  "key: 简短标识（2-20字），用于去重（相同 category+key 会覆盖旧值）",
  "value: 具体内容（10-100字），必须包含有意义的个人信息",
  "",
  "规则：",
  "1. 只提取用户明确表达的信息，禁止推测",
  "2. 纠正类（correction）优先级最高，必须提取",
  "3. 已有记忆中已存在的信息不要重复提取",
  "4. 闲聊、问候、临时指令、纯技术问答不提取",
  "5. 最多提取5条，宁缺毋滥",
  "6. 一对多关系（如多个家人、多个项目）使用 op=add 并给每个 key 加区分后缀",
  "7. value 必须包含具体有意义的信息，禁止空泛描述",
  "",
  "已有记忆：",
  "{existingProfile}",
  "",
  "无内容可提取时返回空数组：[]",
  "禁止返回 markdown 代码块，只返回纯 JSON。",
].join("\n");

// ── Types ──

export type MemoryExtractionSettings = {
  enabled: boolean;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  periodicTurnInterval: number;
  minMessageLength: number;
  longMessageThreshold: number;
  keywords: string[];
};

type ExtractionEntry = {
  op: "set" | "add";
  category: ProfileCategory;
  key: string;
  value: string;
};

// ── Per-session turn counter (in-memory, resets on process restart) ──

const _turnCounters = new Map<string, number>();
// Prevent unbounded growth: clean entries older than 1h periodically
let _lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60 * 60_000;
const MAX_COUNTER_ENTRIES = 1000;

function cleanupTurnCounters(): void {
  const now = Date.now();
  if (now - _lastCleanup < CLEANUP_INTERVAL_MS) return;
  _lastCleanup = now;
  // Simple strategy: if too many entries, clear all (process-level heuristic)
  if (_turnCounters.size > MAX_COUNTER_ENTRIES) {
    _turnCounters.clear();
  }
}

// ── Settings Resolution ──

export function resolveMemoryExtractionSettings(
  cfg?: OpenClawCNConfig,
): MemoryExtractionSettings | null {
  const raw = cfg?.agents?.defaults?.memoryExtraction;
  const enabled = raw?.enabled ?? DEFAULT_EXTRACTION_SETTINGS.enabled;
  if (!enabled) return null;
  return {
    enabled,
    provider: raw?.provider?.trim() || DEFAULT_EXTRACTION_SETTINGS.provider,
    model: raw?.model?.trim() || DEFAULT_EXTRACTION_SETTINGS.model,
    temperature:
      typeof raw?.temperature === "number"
        ? raw.temperature
        : DEFAULT_EXTRACTION_SETTINGS.temperature,
    maxTokens:
      typeof raw?.maxTokens === "number" && raw.maxTokens > 0
        ? raw.maxTokens
        : DEFAULT_EXTRACTION_SETTINGS.maxTokens,
    timeoutMs:
      typeof raw?.timeoutMs === "number" && raw.timeoutMs > 0
        ? raw.timeoutMs
        : DEFAULT_EXTRACTION_SETTINGS.timeoutMs,
    periodicTurnInterval:
      typeof raw?.periodicTurnInterval === "number" && raw.periodicTurnInterval > 0
        ? raw.periodicTurnInterval
        : DEFAULT_EXTRACTION_SETTINGS.periodicTurnInterval,
    minMessageLength:
      typeof raw?.minMessageLength === "number"
        ? raw.minMessageLength
        : DEFAULT_EXTRACTION_SETTINGS.minMessageLength,
    longMessageThreshold:
      typeof raw?.longMessageThreshold === "number" && raw.longMessageThreshold > 0
        ? raw.longMessageThreshold
        : DEFAULT_EXTRACTION_SETTINGS.longMessageThreshold,
    keywords:
      Array.isArray(raw?.keywords) && raw.keywords.length > 0
        ? raw.keywords
        : DEFAULT_EXTRACTION_SETTINGS.keywords,
  };
}

// ── Trigger Logic ──

export function shouldRunMemoryExtraction(params: {
  commandBody: string;
  sessionKey?: string;
  isHeartbeat: boolean;
  settings: MemoryExtractionSettings;
}): boolean {
  if (params.isHeartbeat) return false;

  const msg = params.commandBody.trim();
  if (msg.length < params.settings.minMessageLength) return false;

  // Keyword trigger — user explicitly expressed something worth remembering
  const lowerMsg = msg.toLowerCase();
  if (params.settings.keywords.some((kw) => lowerMsg.includes(kw.toLowerCase()))) {
    return true;
  }

  // Long message trigger — substantive messages often contain preferences
  if (msg.length >= params.settings.longMessageThreshold) {
    return true;
  }

  // Periodic trigger — every N-th turn, catch implicit preferences
  if (params.sessionKey) {
    cleanupTurnCounters();
    const count = (_turnCounters.get(params.sessionKey) ?? 0) + 1;
    _turnCounters.set(params.sessionKey, count);
    if (count % params.settings.periodicTurnInterval === 0) {
      return true;
    }
  }

  return false;
}

// ── Extraction Provider Fallback Chain ──
// When the primary provider has no API key, try these alternatives.
// Last resort: use the user's main model (more expensive but guarantees memory works).

type ExtractionProviderOption = { provider: string; model: string };

export const EXTRACTION_FALLBACK_CHAIN: ExtractionProviderOption[] = [
  { provider: "meituan-longcat", model: "longcat-flash-chat" },
  { provider: "ant-ling", model: "ling-1t" },
  { provider: "siliconflow", model: "deepseek-ai/DeepSeek-V3" },
  { provider: "modelscope", model: "Qwen/Qwen3.5-397B-A17B" },
];

type ResolvedExtractionProvider = {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  headers: Record<string, string>;
};

/**
 * Resolve the best available extraction provider+key, trying the fallback chain.
 * Returns null only if absolutely no provider is available (including main model).
 *
 * Main model fallback is restricted to OpenAI-compatible providers — the memory
 * pipeline sends raw fetch() to /chat/completions, which doesn't work for
 * Anthropic (Messages API), Ollama, Bedrock, etc.
 */
function resolveExtractionProvider(
  cfg: OpenClawCNConfig | undefined,
  settings: MemoryExtractionSettings,
  mainProvider?: string,
  mainModel?: string,
): ResolvedExtractionProvider | null {
  // 1. Try the configured provider first
  const primaryKey = resolveMemoryProviderApiKey(cfg, settings.provider);
  if (primaryKey) {
    const baseUrl = resolveMemoryProviderBaseUrl(cfg, settings.provider);
    if (baseUrl) {
      return {
        provider: settings.provider,
        model: settings.model,
        apiKey: primaryKey,
        baseUrl,
        headers: resolveMemoryProviderHeaders(settings.provider),
      };
    }
  }

  // 2. Try fallback chain (skip the primary, already tried)
  for (const fb of EXTRACTION_FALLBACK_CHAIN) {
    if (fb.provider === settings.provider) continue;
    const key = resolveMemoryProviderApiKey(cfg, fb.provider);
    if (key) {
      const baseUrl = resolveMemoryProviderBaseUrl(cfg, fb.provider);
      if (!baseUrl) continue; // Skip providers with no known base URL
      return {
        provider: fb.provider,
        model: fb.model,
        apiKey: key,
        baseUrl,
        headers: resolveMemoryProviderHeaders(fb.provider),
      };
    }
  }

  // 3. Last resort: use the user's main model (costs tokens on their paid plan).
  // Only works for OpenAI-compatible providers — Anthropic/Ollama/Bedrock use
  // different wire formats that our raw fetch() can't handle.
  if (mainProvider && mainModel && isOpenAICompatibleProvider(mainProvider)) {
    const mainKey = resolveMemoryProviderApiKey(cfg, mainProvider);
    const mainBaseUrl = resolveMemoryProviderBaseUrl(cfg, mainProvider);
    if (mainKey && mainBaseUrl) {
      return {
        provider: mainProvider,
        model: mainModel,
        apiKey: mainKey,
        baseUrl: mainBaseUrl,
        headers: resolveMemoryProviderHeaders(mainProvider),
      };
    }
  }

  return null;
}

/**
 * 查询当前可用的记忆提取 provider（只检查 API key 是否存在，不发起 LLM 调用）。
 * 用于 UI 展示记忆提取模型状态。
 */
export function getExtractionProviderStatus(cfg?: OpenClawCNConfig): {
  provider: string | null;
  model: string | null;
  status: "active" | "inactive";
} {
  const settings = resolveMemoryExtractionSettings(cfg);
  if (!settings) return { provider: null, model: null, status: "inactive" };

  // 1. 尝试配置的 primary provider
  const primaryKey = resolveMemoryProviderApiKey(cfg, settings.provider);
  if (primaryKey) {
    const baseUrl = resolveMemoryProviderBaseUrl(cfg, settings.provider);
    if (baseUrl) return { provider: settings.provider, model: settings.model, status: "active" };
  }

  // 2. 遍历 fallback chain
  for (const fb of EXTRACTION_FALLBACK_CHAIN) {
    if (fb.provider === settings.provider) continue;
    const key = resolveMemoryProviderApiKey(cfg, fb.provider);
    if (key) {
      const baseUrl = resolveMemoryProviderBaseUrl(cfg, fb.provider);
      if (baseUrl) return { provider: fb.provider, model: fb.model, status: "active" };
    }
  }

  return { provider: null, model: null, status: "inactive" };
}

// ── LLM Call ──

async function callExtractionLLM(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  /** Provider-specific headers (e.g. kimi-coding's User-Agent). */
  extraHeaders?: Record<string, string>;
}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const url = `${params.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
        ...params.extraHeaders,
      },
      body: JSON.stringify({
        model: params.model,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// ── Response Parsing ──

export function parseExtractionResult(raw: string): ExtractionEntry[] {
  if (!raw || raw === "[]") return [];

  // Strip markdown code fences if present (small models sometimes add them)
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to find a JSON array within the response
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(
      (item): item is Record<string, unknown> =>
        item != null &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).category === "string" &&
        typeof (item as Record<string, unknown>).key === "string" &&
        typeof (item as Record<string, unknown>).value === "string" &&
        VALID_CATEGORIES.has((item as Record<string, unknown>).category as ProfileCategory),
    )
    .map((item) => ({
      op: (item.op === "add" ? "add" : "set") as "set" | "add",
      category: item.category as ProfileCategory,
      key: String(item.key).trim().slice(0, PROFILE_MAX_KEY_LENGTH),
      value: String(item.value).trim().slice(0, PROFILE_MAX_VALUE_LENGTH),
    }))
    .filter((e) => e.key.length > 0 && e.value.length > 0)
    .filter((e) => !isLowQualityExtraction(e))
    .slice(0, MAX_EXTRACTIONS_PER_TURN);
}

// ── Low-Quality Extraction Filter ──

const LOW_VALUE_PATTERNS = [
  /^(好的|明白|知道了|OK|可以|嗯|对|是的|没错|correct|yes|sure|ok)/i,
  /^(请|帮我|麻烦|能不能|可不可以)/,
  /^(谢谢|感谢|thanks|thank you)/i,
];

/**
 * Reject low-information-density extractions that waste profile slots.
 * These are typically artifacts of small-model hallucinations.
 *
 * NOTE: CJK characters carry much more info per char than Latin, so length
 * thresholds must be conservative.  "张三" (2 chars) is a valid name;
 * "macOS" (5 chars) is a valid fact.
 */
function isLowQualityExtraction(item: ExtractionEntry): boolean {
  // Truly empty — always reject
  if (item.value.length === 0) return true;

  // Identity & correction entries can be very short (names, pronouns) — skip length check
  const shortExempt = item.category === "identity" || item.category === "correction";

  // For non-exempt categories, reject single-char values (almost always noise).
  if (!shortExempt && item.value.length < 2) return true;

  // Key and value are near-identical (LLM echoed key as value)
  if (
    item.value.toLowerCase().includes(item.key.toLowerCase()) &&
    item.value.length < item.key.length * 2
  ) {
    return true;
  }

  // Generic acknowledgement / request patterns — not personal facts
  if (LOW_VALUE_PATTERNS.some((p) => p.test(item.value))) return true;

  return false;
}

// ── User Prompt Construction ──

function buildUserPrompt(commandBody: string, agentReplyText: string): string {
  const userPart = commandBody.trim().slice(0, 1000);
  const agentPart = agentReplyText.trim().slice(0, 1000);

  const parts: string[] = [];
  if (userPart) {
    parts.push(`用户消息：\n${userPart}`);
  }
  if (agentPart) {
    parts.push(`助手回复：\n${agentPart}`);
  }
  return parts.join("\n\n");
}

// ── Value Similarity Check for Code-Level Dedup ──

/**
 * Check if two profile entry values are substantially the same.
 * Used to skip unnecessary upserts when the extraction LLM re-extracts
 * an existing fact with near-identical wording.
 */
function isSimilarValue(a: string, b: string): boolean {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (normA === normB) return true;
  // For very short values, require exact match
  if (normA.length < 5 || normB.length < 5) return normA === normB;
  // Quick length-based reject: if lengths differ by >30%, likely different
  const shorter = Math.min(normA.length, normB.length);
  const longer = Math.max(normA.length, normB.length);
  if (shorter / longer < 0.7) return false;
  // Containment check: only "similar" if the shorter covers >80% of the longer.
  // Without this threshold, "typescript" would match "typescript, not javascript"
  // and suppress a legitimate value update (adding info).
  if (shorter / longer > 0.8 && (normA.includes(normB) || normB.includes(normA))) {
    return true;
  }
  return false;
}

// ── Extraction Queue (SQLite) ──
// When extraction fails (all LLM providers down), cache the message pair
// in extraction_queue for retry on next successful extraction.

const MAX_BACKFILL_PER_RUN = 20;
const MAX_QUEUE_ATTEMPTS = 3;

/** Get a lightweight SQLite connection for the extraction queue. */
function getExtractionQueueDb(workspaceDir: string): import("node:sqlite").DatabaseSync | null {
  try {
    const { requireNodeSqlite } = _require("../../memory/sqlite.js") as {
      requireNodeSqlite: () => typeof import("node:sqlite");
    };
    const { DatabaseSync } = requireNodeSqlite();
    const nodefs = _require("node:fs") as typeof import("node:fs");
    const nodepath = _require("node:path") as typeof import("node:path");
    const memoryDir = nodepath.join(workspaceDir, "memory");
    if (!nodefs.existsSync(memoryDir)) {
      nodefs.mkdirSync(memoryDir, { recursive: true });
    }
    const dbPath = nodepath.join(memoryDir, "memory.sqlite");
    const db = new DatabaseSync(dbPath);
    try {
      db.exec("PRAGMA journal_mode=WAL");
      db.exec("PRAGMA synchronous=NORMAL");
      db.exec("PRAGMA busy_timeout=5000");
    } catch {
      /* ignore */
    }
    // Ensure the extraction_queue table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS extraction_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_msg TEXT NOT NULL,
        agent_reply TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
      );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_eq_status ON extraction_queue(status, created_at);`);
    return db;
  } catch {
    return null;
  }
}

function enqueueFailedExtraction(workspaceDir: string, userMsg: string, agentReply: string): void {
  try {
    const db = getExtractionQueueDb(workspaceDir);
    if (db) {
      try {
        db.prepare(
          `INSERT INTO extraction_queue (user_msg, agent_reply, created_at) VALUES (?, ?, ?)`,
        ).run(userMsg.slice(0, 2000), agentReply.slice(0, 2000), Date.now());
        logVerbose(`[MemoryExtraction] Enqueued failed extraction for retry`);
        return;
      } finally {
        try {
          db.close();
        } catch {
          /* ignore */
        }
      }
    }
    // SQLite unavailable (old Node.js) — fall back to JSONL file
    _enqueueToFile(workspaceDir, userMsg, agentReply);
  } catch {
    // Last resort: try file fallback
    try {
      _enqueueToFile(workspaceDir, userMsg, agentReply);
    } catch {
      /* truly lost */
    }
  }
}

/** File-based fallback queue when node:sqlite is unavailable. */
function _enqueueToFile(workspaceDir: string, userMsg: string, agentReply: string): void {
  const nodefs = _require("node:fs") as typeof import("node:fs");
  const nodepath = _require("node:path") as typeof import("node:path");
  const memDir = nodepath.join(workspaceDir, "memory");
  if (!nodefs.existsSync(memDir)) nodefs.mkdirSync(memDir, { recursive: true });
  const queuePath = nodepath.join(memDir, ".extraction-queue.jsonl");
  // Cap file size to prevent unbounded growth
  try {
    const stat = nodefs.statSync(queuePath);
    if (stat.size > 1_000_000) return; // 1MB cap
  } catch {
    /* file doesn't exist yet — fine */
  }
  const line = JSON.stringify({
    user_msg: userMsg.slice(0, 2000),
    agent_reply: agentReply.slice(0, 2000),
    created_at: Date.now(),
  });
  nodefs.appendFileSync(queuePath, line + "\n", "utf-8");
  logVerbose(`[MemoryExtraction] Enqueued to file fallback`);
}

// Per-workspace guard: prevents two concurrent sessions from processing the same backlog.
const _backlogInProgress = new Set<string>();

async function processExtractionBacklog(params: {
  workspaceDir: string;
  resolved: ResolvedExtractionProvider;
  settings: MemoryExtractionSettings;
}): Promise<void> {
  // Skip if another call is already processing this workspace's backlog
  if (_backlogInProgress.has(params.workspaceDir)) return;
  _backlogInProgress.add(params.workspaceDir);
  let db: import("node:sqlite").DatabaseSync | null = null;
  try {
    db = getExtractionQueueDb(params.workspaceDir);
    if (!db) {
      // SQLite unavailable — try the JSONL file fallback queue
      await _processFileBacklog(params);
      return;
    }

    const pending = db
      .prepare(
        `SELECT id, user_msg, agent_reply, attempts FROM extraction_queue
       WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
      )
      .all(MAX_BACKFILL_PER_RUN) as Array<{
      id: number;
      user_msg: string;
      agent_reply: string;
      attempts: number;
    }>;

    if (pending.length === 0) return;
    logVerbose(`[MemoryExtraction] Processing ${pending.length} backlogged extractions`);

    for (const row of pending) {
      try {
        const profileText = formatProfileForExtraction(params.workspaceDir);
        const systemPrompt = EXTRACTION_SYSTEM_PROMPT.replace("{existingProfile}", profileText);
        const userPrompt = buildUserPrompt(row.user_msg, row.agent_reply);
        if (!userPrompt.trim()) {
          db.prepare(`UPDATE extraction_queue SET status = 'done' WHERE id = ?`).run(row.id);
          continue;
        }

        const raw = await callExtractionLLM({
          baseUrl: params.resolved.baseUrl,
          apiKey: params.resolved.apiKey,
          model: params.resolved.model,
          systemPrompt,
          userPrompt,
          temperature: params.settings.temperature,
          maxTokens: params.settings.maxTokens,
          timeoutMs: params.settings.timeoutMs,
          extraHeaders: params.resolved.headers,
        });

        const entries = parseExtractionResult(raw);
        if (entries.length > 0) {
          await applyExtractedEntries(params.workspaceDir, entries);
        }
        db.prepare(`UPDATE extraction_queue SET status = 'done' WHERE id = ?`).run(row.id);
      } catch (err) {
        const newAttempts = row.attempts + 1;
        const newStatus = newAttempts >= MAX_QUEUE_ATTEMPTS ? "failed" : "pending";
        db.prepare(
          `UPDATE extraction_queue SET attempts = ?, last_error = ?, status = ? WHERE id = ?`,
        ).run(newAttempts, String(err).slice(0, 200), newStatus, row.id);
        // Stop processing backlog if LLM is still failing
        break;
      }
    }
  } catch {
    // Non-fatal
  } finally {
    _backlogInProgress.delete(params.workspaceDir);
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Process the JSONL file-based fallback queue (used when node:sqlite is unavailable).
 * Reads entries from `.extraction-queue.jsonl`, runs extraction, and truncates the file.
 */
async function _processFileBacklog(params: {
  workspaceDir: string;
  resolved: ResolvedExtractionProvider;
  settings: MemoryExtractionSettings;
}): Promise<void> {
  const nodefs = _require("node:fs") as typeof import("node:fs");
  const nodepath = _require("node:path") as typeof import("node:path");
  const queuePath = nodepath.join(params.workspaceDir, "memory", ".extraction-queue.jsonl");
  let lines: string[];
  try {
    const raw = nodefs.readFileSync(queuePath, "utf-8");
    lines = raw.split("\n").filter((l) => l.trim());
  } catch {
    return; // File doesn't exist or unreadable — nothing to process
  }
  if (lines.length === 0) return;

  // Process at most MAX_BACKFILL_PER_RUN entries
  const toProcess = lines.slice(0, MAX_BACKFILL_PER_RUN);
  const remaining = lines.slice(MAX_BACKFILL_PER_RUN);
  let processed = 0;

  for (const line of toProcess) {
    // Parse the JSONL line first — if malformed, skip it (don't get stuck retrying forever).
    let row: { user_msg: string; agent_reply: string; created_at: number };
    try {
      row = JSON.parse(line) as typeof row;
    } catch {
      // Corrupt JSONL line — skip to prevent infinite retry loop.
      processed++;
      continue;
    }
    try {
      if (!row.user_msg) {
        processed++;
        continue;
      }
      // Skip entries older than 7 days (stale)
      if (Date.now() - (row.created_at || 0) > 7 * 24 * 60 * 60 * 1000) {
        processed++;
        continue;
      }
      const profileText = formatProfileForExtraction(params.workspaceDir);
      const systemPrompt = EXTRACTION_SYSTEM_PROMPT.replace("{existingProfile}", profileText);
      const userPrompt = buildUserPrompt(row.user_msg, row.agent_reply);
      if (!userPrompt.trim()) {
        processed++;
        continue;
      }

      const raw = await callExtractionLLM({
        baseUrl: params.resolved.baseUrl,
        apiKey: params.resolved.apiKey,
        model: params.resolved.model,
        systemPrompt,
        userPrompt,
        temperature: params.settings.temperature,
        maxTokens: params.settings.maxTokens,
        timeoutMs: params.settings.timeoutMs,
        extraHeaders: params.resolved.headers,
      });
      const entries = parseExtractionResult(raw);
      if (entries.length > 0) {
        await applyExtractedEntries(params.workspaceDir, entries);
      }
      processed++;
    } catch {
      break; // Stop on first LLM failure — provider may be down
    }
  }

  // Rewrite file with unprocessed + remaining entries
  try {
    const unprocessed = toProcess.slice(processed);
    const newContent =
      [...unprocessed, ...remaining].join("\n") +
      (remaining.length > 0 || unprocessed.length > 0 ? "\n" : "");
    if (newContent.trim()) {
      nodefs.writeFileSync(queuePath, newContent, "utf-8");
    } else {
      try {
        nodefs.unlinkSync(queuePath);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* non-fatal */
  }
}

// ── Apply Extracted Entries to Profile ──

async function applyExtractedEntries(
  workspaceDir: string,
  entries: ExtractionEntry[],
): Promise<void> {
  // Pre-filter with outside-lock snapshot (TOCTOU is benign for set ops — worst case is a redundant update).
  // op=add dedup is done INSIDE the lock below to use the fresh profile and avoid TOCTOU duplicates.
  const currentProfile = readProfile(workspaceDir);
  const preFiltered = entries.filter((extracted) => {
    if (extracted.op === "add") return true; // dedup inside lock
    const existing = currentProfile.entries.find(
      (e) =>
        e.category === extracted.category &&
        e.key.toLowerCase() === extracted.key.trim().toLowerCase(),
    );
    if (!existing) return true;
    return !isSimilarValue(existing.value, extracted.value);
  });

  if (preFiltered.length === 0) return;

  await withProfileLock(workspaceDir, (profile) => {
    let updated = profile;
    const allEvicted: ProfileEntry[] = [];
    const now = Date.now();
    const ADD_DEDUP_WINDOW_MS = 60_000;
    for (const entry of preFiltered) {
      if (entry.op === "add") {
        // Dedup inside lock with fresh profile to prevent TOCTOU duplicate entries
        const normalizedValue = entry.value.trim().toLowerCase();
        const recentDuplicate = updated.entries.find(
          (e) =>
            e.category === entry.category &&
            e.value.trim().toLowerCase() === normalizedValue &&
            now - e.updatedAt < ADD_DEDUP_WINDOW_MS,
        );
        if (recentDuplicate) continue;
        // For op=add: find a unique key to avoid overwriting
        const baseKey = entry.key.trim();
        let finalKey = baseKey;
        const normalizedBase = baseKey.toLowerCase();
        const existingKeys = updated.entries
          .filter((e) => e.category === entry.category)
          .map((e) => e.key.toLowerCase());
        if (existingKeys.includes(normalizedBase)) {
          // Append a numeric suffix to make it unique
          let suffix = 2;
          while (existingKeys.includes(`${normalizedBase}-${suffix}`)) {
            suffix++;
          }
          finalKey = `${baseKey}-${suffix}`;
        }
        const result = upsertProfileEntryFull(updated, entry.category, finalKey, entry.value, {
          source: "extraction",
        });
        updated = result.profile;
        if (result.evicted.length > 0) allEvicted.push(...result.evicted);
      } else {
        const result = upsertProfileEntryFull(updated, entry.category, entry.key, entry.value, {
          source: "extraction",
        });
        updated = result.profile;
        if (result.evicted.length > 0) allEvicted.push(...result.evicted);
      }
    }
    // evicted entries are archived inside the lock (before profile write) by withProfileLock
    return { profile: updated, result: preFiltered.length, evicted: allEvicted };
  });
}

// ── Main Orchestrator ──

export async function runPostReplyMemoryExtraction(params: {
  commandBody: string;
  agentReplyText: string;
  followupRun: FollowupRun;
  cfg: OpenClawCNConfig;
  sessionKey?: string;
  isHeartbeat: boolean;
}): Promise<void> {
  const settings = resolveMemoryExtractionSettings(params.cfg);
  if (!settings) return;

  if (
    !shouldRunMemoryExtraction({
      commandBody: params.commandBody,
      sessionKey: params.sessionKey,
      isHeartbeat: params.isHeartbeat,
      settings,
    })
  ) {
    return;
  }

  const workspaceDir = params.followupRun.run.workspaceDir;
  if (!workspaceDir) return;

  // Resolve the best available provider: configured → fallback chain → main model
  const resolved = resolveExtractionProvider(
    params.cfg,
    settings,
    params.followupRun.run.provider,
    params.followupRun.run.model,
  );
  if (!resolved) {
    // No API key — enqueue for retry when a provider becomes available
    enqueueFailedExtraction(workspaceDir, params.commandBody, params.agentReplyText);
    return;
  }

  const profileText = formatProfileForExtraction(workspaceDir);
  const systemPrompt = EXTRACTION_SYSTEM_PROMPT.replace("{existingProfile}", profileText);
  const userPrompt = buildUserPrompt(params.commandBody, params.agentReplyText);

  if (!userPrompt.trim()) return;

  logVerbose(`[MemoryExtraction] Using provider: ${resolved.provider}/${resolved.model}`);

  let raw: string;
  try {
    raw = await callExtractionLLM({
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
      model: resolved.model,
      systemPrompt,
      userPrompt,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      timeoutMs: settings.timeoutMs,
      extraHeaders: resolved.headers,
    });
  } catch (err) {
    // LLM call failed — enqueue for retry
    logVerbose(
      `[MemoryExtraction] LLM call failed, enqueuing for retry: ${String(err).slice(0, 100)}`,
    );
    enqueueFailedExtraction(workspaceDir, params.commandBody, params.agentReplyText);
    return;
  }

  const entries = parseExtractionResult(raw);
  if (entries.length === 0) return;

  try {
    await applyExtractedEntries(workspaceDir, entries);
  } catch (applyErr) {
    // LLM succeeded but profile write failed (corrupted profile, disk full, EBUSY).
    // Enqueue the original message pair for retry — extracted entries are not lost.
    logVerbose(
      `[MemoryExtraction] Apply failed, enqueuing for retry: ${String(applyErr).slice(0, 100)}`,
    );
    enqueueFailedExtraction(workspaceDir, params.commandBody, params.agentReplyText);
    return;
  }

  logVerbose(
    `[MemoryExtraction] Extracted ${entries.length} entries for ${params.sessionKey ?? "?"}`,
  );

  // Process any backlogged extractions now that we have a working provider
  void processExtractionBacklog({
    workspaceDir,
    resolved,
    settings,
  }).catch((err) =>
    logVerbose(`[MemoryExtraction] Backlog processing failed: ${String(err).slice(0, 100)}`),
  );

  // [CN-PATCH:memory-consolidation] Fire-and-forget background consolidation
  // when profile is near capacity. Runs after extraction to optimize profile.
  void runMemoryConsolidation({
    workspaceDir,
    cfg: params.cfg,
    sessionKey: params.sessionKey,
    mainProvider: params.followupRun.run.provider,
    mainModel: params.followupRun.run.model,
  }).catch((err) => defaultRuntime.error(`[MemoryConsolidation] ${String(err).slice(0, 200)}`));
}
