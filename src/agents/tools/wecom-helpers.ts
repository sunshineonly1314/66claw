/**
 * WeCom (企业微信) shared helper functions.
 *
 * Centralised window detection, layout calculation, desktop automation,
 * and vision analysis helpers used by all wecom_* tools.
 */

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

import { runHelper, handleScreenshot } from "./desktop-control.js";
import {
  OLLAMA_BASE_URL,
  OLLAMA_VISION_MODEL,
  KIMI_API_BASE,
  KIMI_API_KEY,
  KIMI_MODEL,
  KIMI_HEADERS,
  buildSystemPrompt,
} from "./wecom-cs-config.js";
import type { OpenClawCNConfig } from "../../config/config.js";
import { getApiKeyForModel, requireApiKey } from "../model-auth.js";
import { ensureOpenClawCNModelsJson } from "../models-config.js";
import { discoverAuthStorage, discoverModels } from "../pi-model-discovery.js";

// ─── Types ──────────────────────────────────────────────────────────

export interface WeComWindow {
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WeComLayout {
  contactListCenterX: number;
  contactListCenterY: number;
  chatCenterX: number;
  chatAreaLeft: number;
  chatAreaTop: number;
  chatAreaWidth: number;
  chatAreaHeight: number;
  inputBoxY: number;
  searchBarY: number;
  firstResultY: number;
  chatTabX: number;
  chatTabY: number;
}

// ─── Constants ──────────────────────────────────────────────────────

const NAV_BAR_WIDTH = 80;
const CONTACT_LIST_WIDTH = 290;

// ─── Core Helpers ───────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getWeComWindow(): WeComWindow | null {
  const out = runHelper(["-Action", "list_windows"], 15000);
  if (!out) return null;
  for (const line of out.split(/\r?\n/).filter(Boolean)) {
    const p = line.split("|||");
    const title = p[0] ?? "";
    const rect = { x: +p[2] || 0, y: +p[3] || 0, w: +p[4] || 0, h: +p[5] || 0 };
    if (title === "企业微信" || title === "WeCom" || title.includes("企业微信")) {
      return { title, ...rect };
    }
  }
  return null;
}

export function getLayout(win: WeComWindow): WeComLayout {
  const contactListCenterX = win.x + NAV_BAR_WIDTH + Math.floor(CONTACT_LIST_WIDTH / 2);
  const contactListCenterY = win.y + Math.floor(win.h / 2);
  const chatLeft = win.x + NAV_BAR_WIDTH + CONTACT_LIST_WIDTH;
  const chatCenterX = chatLeft + Math.floor((win.w - NAV_BAR_WIDTH - CONTACT_LIST_WIDTH) / 2);
  const chatAreaLeft = chatLeft;
  const chatAreaTop = win.y + 100;
  const chatAreaWidth = win.w - NAV_BAR_WIDTH - CONTACT_LIST_WIDTH;
  const chatAreaHeight = win.h - 100 - 150;
  const inputBoxY = win.y + win.h - 100;
  const searchBarY = win.y + 68;
  const firstResultY = win.y + 190;
  const chatTabX = win.x + 25;
  const chatTabY = win.y + 120;
  return {
    contactListCenterX,
    contactListCenterY,
    chatCenterX,
    chatAreaLeft,
    chatAreaTop,
    chatAreaWidth,
    chatAreaHeight,
    inputBoxY,
    searchBarY,
    firstResultY,
    chatTabX,
    chatTabY,
  };
}

export function focus(windowTitle: string): boolean {
  return runHelper(["-Action", "focus", "-Window", windowTitle], 5000).startsWith("ok");
}

export function sendKey(keys: string): void {
  runHelper(["-Action", "key", "-Keys", keys], 5000);
}

export function typeText(text: string, method: "sendinput" | "clipboard" = "clipboard"): boolean {
  return runHelper(["-Action", "type", "-Text", text, "-Method", method], 8000).startsWith("ok");
}

export function clickAt(x: number, y: number): void {
  runHelper(["-Action", "click", "-X", String(x), "-Y", String(y)], 5000);
}

export function scrollAt(x: number, y: number, amount: number): void {
  runHelper(
    ["-Action", "scroll", "-X", String(x), "-Y", String(y), "-Amount", String(amount)],
    5000,
  );
}

export async function screenshot(): Promise<AgentToolResult<unknown>> {
  return await handleScreenshot({});
}

export function screenshotToFile(windowTitle: string): {
  ok: boolean;
  path: string;
  base64: string;
} {
  const tmpPath = path.join(os.tmpdir(), `wecom-${Date.now()}.png`);
  const result = runHelper(
    ["-Action", "screenshot", "-Window", windowTitle, "-OutputPath", tmpPath],
    15000,
  );
  if (!result.startsWith("ok")) {
    return { ok: false, path: tmpPath, base64: "" };
  }
  const buf = fs.readFileSync(tmpPath);
  return { ok: true, path: tmpPath, base64: buf.toString("base64") };
}

export function fail(msg: string, log: string[]): AgentToolResult<unknown> {
  return {
    content: [{ type: "text", text: `❌ ${msg}\n\n调试日志:\n${log.join("\n")}` }],
    details: { status: "error", error: msg, log },
  };
}

// ─── Composite: Focus + Find Window ─────────────────────────────────

/**
 * Find WeCom window, focus it, and return updated window info.
 * Returns null + fail result if window not found.
 */
export async function focusWeComWindow(log: string[]): Promise<{
  win: WeComWindow;
  layout: WeComLayout;
} | null> {
  let win = getWeComWindow();
  if (!win) {
    return null;
  }
  if (!focus(win.title)) {
    return null;
  }
  log.push(`✓ 聚焦企业微信 (${win.title})`);
  await sleep(1200);

  const updatedWin = getWeComWindow() ?? win;
  const rectChanged =
    updatedWin.x !== win.x ||
    updatedWin.y !== win.y ||
    updatedWin.w !== win.w ||
    updatedWin.h !== win.h;
  win = updatedWin;
  log.push(`✓ 窗口: (${win.x},${win.y}) ${win.w}×${win.h}`);

  if (rectChanged) {
    focus(win.title);
    await sleep(500);
  }

  return { win, layout: getLayout(win) };
}

// ─── Active Contact Tracker ──────────────────────────────────────────

let _activeContact: string | null = null;
let _activeContactAt = 0;
const ACTIVE_CONTACT_TTL_MS = 60_000; // 60s — assume still on same chat

/**
 * Get the currently active (open) contact name, or null if stale/unknown.
 */
export function getActiveContact(): string | null {
  if (!_activeContact) return null;
  if (Date.now() - _activeContactAt > ACTIVE_CONTACT_TTL_MS) {
    _activeContact = null;
    return null;
  }
  return _activeContact;
}

/**
 * Record which contact chat is currently open.
 */
export function setActiveContact(contact: string): void {
  _activeContact = contact;
  _activeContactAt = Date.now();
}

/**
 * Clear active contact (e.g. when navigating away).
 */
export function clearActiveContact(): void {
  _activeContact = null;
}

// ─── Composite: Search and Open Contact ─────────────────────────────

/**
 * Search for a contact and click the first result.
 * If the contact is already the active chat, skip the search entirely.
 */
export async function searchAndOpenContact(
  contact: string,
  layout: WeComLayout,
  log: string[],
): Promise<boolean> {
  // Skip search if already on this contact's chat
  if (getActiveContact() === contact) {
    log.push(`✓ 已在 "${contact}" 聊天窗口，跳过搜索`);
    return true;
  }

  sendKey("^{f}");
  await sleep(1000);
  sendKey("^{a}");
  await sleep(200);

  if (!typeText(contact)) {
    log.push(`✗ 输入联系人名称失败: ${contact}`);
    return false;
  }
  log.push(`✓ 搜索: "${contact}"`);
  await sleep(2500);

  clickAt(layout.contactListCenterX, layout.firstResultY);
  log.push("✓ 点击第一个搜索结果");
  await sleep(2000);

  setActiveContact(contact);
  return true;
}

// ─── Vision: Ollama Screenshot Analysis ─────────────────────────────

export async function analyzeScreenshotWithOllama(
  screenshotBase64: string,
  prompt: string,
): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_VISION_MODEL,
      messages: [{ role: "user", content: prompt, images: [screenshotBase64] }],
      stream: false,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Ollama vision failed (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content || "";
}

// ─── Vision Result Cache ─────────────────────────────────────────────

interface VisionCacheEntry {
  result: string;
  timestamp: number;
}

const visionCache = new Map<string, VisionCacheEntry>();
const VISION_CACHE_TTL_MS = 30_000; // 30 seconds

export function getCachedVisionResult(contactName: string): string | null {
  const entry = visionCache.get(contactName);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > VISION_CACHE_TTL_MS) {
    visionCache.delete(contactName);
    return null;
  }
  return entry.result;
}

export function setCachedVisionResult(contactName: string, result: string): void {
  visionCache.set(contactName, { result, timestamp: Date.now() });
}

export function invalidateVisionCache(contactName?: string): void {
  if (contactName) {
    visionCache.delete(contactName);
  } else {
    visionCache.clear();
  }
}

// ─── Ollama Availability Check (cached) ─────────────────────────────

let _ollamaAvailable: boolean | null = null;
let _ollamaCheckedAt = 0;
const OLLAMA_CHECK_TTL_MS = 60_000; // re-check every 60s

export async function isOllamaAvailable(): Promise<boolean> {
  if (_ollamaAvailable !== null && Date.now() - _ollamaCheckedAt < OLLAMA_CHECK_TTL_MS) {
    return _ollamaAvailable;
  }
  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) {
      _ollamaAvailable = false;
      _ollamaCheckedAt = Date.now();
      return false;
    }
    const data = (await resp.json()) as { models?: Array<{ name: string }> };
    _ollamaAvailable =
      data.models?.some((m) => m.name.startsWith(OLLAMA_VISION_MODEL.split(":")[0])) ?? false;
  } catch {
    _ollamaAvailable = false;
  }
  _ollamaCheckedAt = Date.now();
  return _ollamaAvailable;
}

// ─── Cloud Vision Fallback (Qwen-VL) ────────────────────────────────

export async function analyzeScreenshotWithQwen(
  screenshotBase64: string,
  prompt: string,
  options: { cfg?: OpenClawCNConfig; agentDir?: string },
): Promise<string> {
  const agentDir = options.agentDir?.trim() || "";
  const cfg = options.cfg;

  if (agentDir) await ensureOpenClawCNModelsJson(cfg, agentDir);
  const authStorage = agentDir ? discoverAuthStorage(agentDir) : null;
  const registry = authStorage && agentDir ? discoverModels(authStorage, agentDir) : null;
  const models = registry ? registry.getAll() : [];

  const visionModel = models.find((m) => m.id === "qwen-vl-max" || m.id === "qwen-vl-plus");
  if (!visionModel) {
    throw new Error(
      "No vision model configured. Please configure qwen-vl-max in agent models.json",
    );
  }

  const authInfo = await getApiKeyForModel({ model: visionModel, cfg, agentDir });
  const apiKey = requireApiKey(authInfo, visionModel.provider);

  const baseUrl = visionModel.baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: visionModel.id,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/png;base64,${screenshotBase64}` } },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen vision API failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Qwen vision API returned no content");
  return content;
}

// ─── Unified Vision Analysis (with cache + fallback) ─────────────────

export async function analyzeScreenshot(
  screenshotBase64: string,
  prompt: string,
  options?: {
    contactName?: string;
    cfg?: OpenClawCNConfig;
    agentDir?: string;
    skipCache?: boolean;
  },
): Promise<string> {
  // Check cache first
  if (options?.contactName && !options?.skipCache) {
    const cached = getCachedVisionResult(options.contactName);
    if (cached) return cached;
  }

  let result: string;
  if (await isOllamaAvailable()) {
    try {
      result = await analyzeScreenshotWithOllama(screenshotBase64, prompt);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[wecom] Ollama vision failed, falling back to cloud: ${errMsg}`);
      result = await analyzeScreenshotWithQwen(screenshotBase64, prompt, {
        cfg: options?.cfg,
        agentDir: options?.agentDir,
      });
    }
  } else {
    result = await analyzeScreenshotWithQwen(screenshotBase64, prompt, {
      cfg: options?.cfg,
      agentDir: options?.agentDir,
    });
  }

  // Store in cache
  if (options?.contactName) {
    setCachedVisionResult(options.contactName, result);
  }

  return result;
}

// ─── Kimi Code API ──────────────────────────────────────────────────

/**
 * Generate a reply using Kimi Code API with persona + knowledge base.
 * @param userMessage - the user's message to reply to
 * @param customSystemPrompt - override the auto-built system prompt
 */
export async function generateReplyWithKimi(
  userMessage: string,
  customSystemPrompt?: string,
): Promise<string> {
  if (!KIMI_API_KEY) {
    throw new Error("KIMI_API_KEY 未设置。请设置环境变量 KIMI_API_KEY=sk-kimi-xxx");
  }

  const systemPrompt = customSystemPrompt ?? buildSystemPrompt(userMessage);

  const resp = await fetch(`${KIMI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      ...KIMI_HEADERS,
      Authorization: `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1000,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Kimi API ${resp.status}: ${errText.substring(0, 200)}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  const msg = data.choices?.[0]?.message;
  const reply = msg?.content?.trim();

  if (!reply) {
    const reasoning = msg?.reasoning_content || "";
    throw new Error(`Kimi returned empty content (reasoning: ${reasoning.substring(0, 100)}...).`);
  }

  return reply;
}

// ─── Message Extraction ─────────────────────────────────────────────

export interface ChatMessage {
  sender: string;
  content: string;
  time: string;
}

/**
 * Extract messages from vision analysis result JSON.
 */
export function extractMessages(visionResult: string): {
  contact: string;
  messages: ChatMessage[];
} {
  try {
    const jsonMatch = visionResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        contact: parsed.contact || "",
        messages: (parsed.messages || []) as ChatMessage[],
      };
    }
  } catch {
    // JSON parsing failed
  }
  return { contact: "", messages: [] };
}

/**
 * Extract last message not from "我" (me).
 */
export function extractLastOtherMessage(visionResult: string): string {
  const { messages } = extractMessages(visionResult);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender !== "我" && messages[i].content) {
      return messages[i].content;
    }
  }
  if (visionResult.length > 0) {
    return visionResult.substring(0, 200);
  }
  return "";
}

// ─── Reply Dedup Tracker ────────────────────────────────────────────

const replyTracker = new Map<string, number>(); // contact → last reply timestamp

/**
 * Check if we already replied to this contact recently (within cooldownMs).
 */
export function isDuplicate(contact: string, cooldownMs: number = 60000): boolean {
  const lastReply = replyTracker.get(contact);
  if (lastReply && Date.now() - lastReply < cooldownMs) {
    return true;
  }
  return false;
}

/**
 * Record that we replied to this contact.
 */
export function recordReply(contact: string): void {
  replyTracker.set(contact, Date.now());
}

/**
 * Get dedup stats.
 */
export function getReplyTrackerStats(): { contact: string; lastReply: number }[] {
  return Array.from(replyTracker.entries()).map(([contact, lastReply]) => ({
    contact,
    lastReply,
  }));
}
