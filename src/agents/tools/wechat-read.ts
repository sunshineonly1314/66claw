/**
 * WeChat composite tool: `wechat_read`
 *
 * One-call automation for reading messages from WeChat or WeCom (企业微信):
 *   focus → search contact → click result → screenshot chat area → vision analysis
 *
 * Uses vision model to extract messages from screenshot.
 * Returns structured message data (sender, content, timestamp).
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

import type { AnyAgentTool } from "./common.js";
import { readStringParam, readNumberParam } from "./common.js";
import { runHelper } from "./desktop-control.js";
import type { OpenClawCNConfig } from "../../config/config.js";
import { getApiKeyForModel, requireApiKey } from "../model-auth.js";
import { ensureOpenClawCNModelsJson } from "../models-config.js";
import { discoverAuthStorage, discoverModels } from "../pi-model-discovery.js";

// ─── Helpers (reused from wechat-send.ts) ──────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type WeChatVariant = "wechat" | "wecom";
interface WeChatWindow {
  variant: WeChatVariant;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function getWeChatWindow(): WeChatWindow | null {
  const out = runHelper(["-Action", "list_windows"], 8000);
  if (!out) return null;
  let wecom: WeChatWindow | null = null;
  for (const line of out.split(/\r?\n/).filter(Boolean)) {
    const p = line.split("|||");
    const title = p[0] ?? "";
    const rect = { x: +p[2] || 0, y: +p[3] || 0, w: +p[4] || 0, h: +p[5] || 0 };
    if (title === "微信" || title === "WeChat") {
      return { variant: "wechat", title, ...rect };
    }
    if (title === "企业微信" || title === "WeCom" || title.includes("企业微信")) {
      wecom = { variant: "wecom", title, ...rect };
    }
  }
  return wecom;
}

function getLayout(win: WeChatWindow) {
  if (win.variant === "wecom") {
    const navBarWidth = 80;
    const contactListWidth = 290;
    const contactListCenterX = win.x + navBarWidth + Math.floor(contactListWidth / 2);
    const chatLeft = win.x + navBarWidth + contactListWidth;
    const chatCenterX = chatLeft + Math.floor((win.w - navBarWidth - contactListWidth) / 2);
    const chatAreaLeft = chatLeft;
    const chatAreaTop = win.y + 100; // Below contact name header
    const chatAreaWidth = win.w - navBarWidth - contactListWidth;
    const chatAreaHeight = win.h - 100 - 150; // Above input box
    const firstResultY = win.y + 130;
    return {
      contactListCenterX,
      chatCenterX,
      chatAreaLeft,
      chatAreaTop,
      chatAreaWidth,
      chatAreaHeight,
      firstResultY,
    };
  }
  // Personal WeChat
  const iconBarWidth = 70;
  const contactListWidth = 250;
  const contactListCenterX = win.x + iconBarWidth + Math.floor(contactListWidth / 2);
  const chatLeft = win.x + iconBarWidth + contactListWidth;
  const chatCenterX = chatLeft + Math.floor((win.w - iconBarWidth - contactListWidth) / 2);
  const chatAreaLeft = chatLeft;
  const chatAreaTop = win.y + 90;
  const chatAreaWidth = win.w - iconBarWidth - contactListWidth;
  const chatAreaHeight = win.h - 90 - 120;
  const firstResultY = win.y + 145;
  return {
    contactListCenterX,
    chatCenterX,
    chatAreaLeft,
    chatAreaTop,
    chatAreaWidth,
    chatAreaHeight,
    firstResultY,
  };
}

function focus(windowTitle: string): boolean {
  return runHelper(["-Action", "focus", "-Window", windowTitle], 5000).startsWith("ok");
}

function sendKey(keys: string): void {
  runHelper(["-Action", "key", "-Keys", keys], 5000);
}

function typeText(text: string, method: "sendinput" | "clipboard" = "clipboard"): boolean {
  return runHelper(["-Action", "type", "-Text", text, "-Method", method], 8000).startsWith("ok");
}

function clickAt(x: number, y: number): void {
  runHelper(["-Action", "click", "-X", String(x), "-Y", String(y)], 5000);
}

/**
 * Take a screenshot of a specific screen region (not using window-based screenshot).
 * We'll use PowerShell to capture a specific rect.
 */
function screenshotRegion(
  x: number,
  y: number,
  width: number,
  height: number,
): { base64: string; path: string } | null {
  const tmpPath = path.join(os.tmpdir(), `wechat-chat-${Date.now()}.png`);

  // We need to add a new action to desktop-control helper for region screenshot
  // For now, use full screenshot and crop in memory (or use ImageMagick)
  // TODO: Implement region screenshot in desktop-control.ts

  // Fallback: use full screenshot for now
  const out = runHelper(["-Action", "screenshot", "-OutputPath", tmpPath], 15000);
  if (!out.startsWith("ok")) return null;

  // Read the PNG and return base64
  try {
    const buf = fs.readFileSync(tmpPath);
    const base64 = buf.toString("base64");
    return { base64, path: tmpPath };
  } catch {
    return null;
  }
}

/** Failure helper */
function fail(msg: string, log: string[]): AgentToolResult<unknown> {
  return {
    content: [{ type: "text", text: `❌ ${msg}\n\n调试日志:\n${log.join("\n")}` }],
    details: { status: "error", error: msg, log },
  };
}

/**
 * Call qwen-vl-max vision API to analyze screenshot
 * Uses proper auth system (auth-profiles.json + models.json)
 */
async function analyzeScreenshotWithQwen(
  screenshotBase64: string,
  prompt: string,
  options: { cfg?: OpenClawCNConfig; agentDir?: string },
): Promise<string> {
  const agentDir = options.agentDir?.trim() || "";
  const cfg = options.cfg;

  // 1) Discover models from agent's models.json
  if (agentDir) await ensureOpenClawCNModelsJson(cfg, agentDir);
  const authStorage = agentDir ? discoverAuthStorage(agentDir) : null;
  const registry = authStorage && agentDir ? discoverModels(authStorage, agentDir) : null;
  const models = registry ? registry.getAll() : [];

  // 2) Find qwen-vl-max (vision model)
  const visionModel = models.find((m) => m.id === "qwen-vl-max" || m.id === "qwen-vl-plus");
  if (!visionModel) {
    throw new Error(
      "No vision model configured. Please configure qwen-vl-max in agent models.json",
    );
  }

  // 3) Get API key using auth system (checks auth-profiles.json, then models.json)
  const authInfo = await getApiKeyForModel({
    model: visionModel,
    cfg,
    agentDir,
  });
  const apiKey = requireApiKey(authInfo, visionModel.provider);

  // 4) Call vision API
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
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${screenshotBase64}` },
            },
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

  if (!content) {
    throw new Error("Qwen vision API returned no content");
  }

  return content;
}

// ─── Main tool implementation ───────────────────────────────────────

/**
 * Schema for wechat_read tool
 */
const WeChatReadSchema = Type.Object({
  contact: Type.String({
    description: "联系人或群名称 (支持模糊匹配，会点击搜索结果第一个)",
  }),
  count: Type.Optional(
    Type.Number({
      description: "读取最近几条消息 (默认: 5，范围: 1-20)",
      minimum: 1,
      maximum: 20,
    }),
  ),
});

/**
 * Main execution function
 */
async function executeWeChatRead(
  _toolCallId: string,
  args: Record<string, unknown>,
  options?: { config?: OpenClawCNConfig; agentDir?: string },
): Promise<AgentToolResult<unknown>> {
  const contact = readStringParam(args, "contact", { required: true });
  const count = readNumberParam(args, "count") ?? 5;
  const log: string[] = [];

  try {
    // 1. Detect and focus WeChat/WeCom
    let win = getWeChatWindow();
    if (!win) {
      return fail("微信/企业微信窗口未找到，请确认已启动。", log);
    }
    if (!focus(win.title)) {
      return fail(`无法聚焦窗口: ${win.title}`, log);
    }
    log.push(`✓ Focus ${win.variant === "wecom" ? "WeCom" : "WeChat"} (${win.title})`);
    await sleep(1200); // Longer wait for window to come to foreground

    // Re-query window rect after focus/restore
    win = getWeChatWindow() ?? win;
    log.push(`✓ Window: (${win.x},${win.y}) ${win.w}×${win.h}`);

    // Force focus again to ensure window is on top
    focus(win.title);
    await sleep(500);

    const layout = getLayout(win);

    // 2. Open search (Ctrl+F)
    sendKey("^{f}");
    log.push("✓ Ctrl+F (search)");
    await sleep(1000);

    // 3. Type contact name
    if (!typeText(contact)) {
      return fail(`输入联系人名称失败: ${contact}`, log);
    }
    log.push(`✓ Type contact: "${contact}"`);
    await sleep(2500); // Wait for search results

    // 4. Click first result
    clickAt(layout.contactListCenterX, layout.firstResultY);
    log.push(`✓ Click first result (${layout.contactListCenterX}, ${layout.firstResultY})`);
    await sleep(2000); // Longer wait for chat to load

    // 5. Ensure WeChat is still focused before screenshot
    focus(win.title);
    await sleep(800);

    // 6. Take screenshot of WeChat window (NOT full screen)
    log.push(`✓ Capturing WeChat window: ${win.title}`);

    const tmpPath = path.join(os.tmpdir(), `wechat-read-${Date.now()}.png`);
    // IMPORTANT: Pass -Window parameter to capture only WeChat window, not full screen
    const screenshotOut = runHelper(
      ["-Action", "screenshot", "-Window", win.title, "-OutputPath", tmpPath],
      15000,
    );

    if (!screenshotOut.startsWith("ok")) {
      return fail("截图失败", log);
    }

    // Read screenshot as base64
    const screenshotBuf = fs.readFileSync(tmpPath);
    const screenshotBase64 = screenshotBuf.toString("base64");
    log.push(`✓ Screenshot saved: ${tmpPath} (${screenshotBuf.length} bytes)`);

    // 6. Use qwen-max vision to analyze screenshot directly
    log.push(`✓ Analyzing with qwen-max vision (requesting last ${count} messages)...`);

    // Construct vision prompt
    const visionPrompt = `请分析这张微信聊天窗口截图，提取最近的 ${count} 条消息。

要求:
1. 从最新的消息开始往前数 ${count} 条
2. 对于每条消息，提取以下信息:
   - sender: 发送者昵称 (如果是自己发的，标记为 "我")
   - content: 消息内容 (纯文本，如果是图片/语音/文件，标记为 [图片]/[语音]/[文件])
   - time: 时间戳 (如果可见)
3. 按时间顺序返回 (最早的在前，最新的在后)

请以 JSON 格式返回:
\`\`\`json
{
  "contact": "聊天对象名称",
  "messages": [
    {"sender": "张三", "content": "你好", "time": "14:30"},
    {"sender": "我", "content": "你好！", "time": "14:31"}
  ]
}
\`\`\`

如果截图中没有消息或无法识别，返回空的 messages 数组。`;

    // Call qwen-vl-max vision API (using proper auth system)
    let visionResult: string;
    try {
      visionResult = await analyzeScreenshotWithQwen(screenshotBase64, visionPrompt, {
        cfg: options?.config,
        agentDir: options?.agentDir,
      });
      log.push(`✓ Vision analysis completed (${visionResult.length} chars)`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return fail(`Vision 分析失败: ${errMsg}`, log);
    }

    // Return the vision analysis result
    return {
      content: [
        {
          type: "text",
          text: `✅ 微信聊天记录读取完成 (联系人: ${contact})

调试日志:
${log.join("\n")}

Vision 分析结果:
${visionResult}`,
        },
      ],
      details: {
        status: "success",
        action: "wechat_read",
        contact,
        count,
        screenshot_path: tmpPath,
        vision_result: visionResult,
        log,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`微信读取失败: ${msg}`, log);
  }
}

// ─── Tool factory ───────────────────────────────────────────────────

export function createWeChatReadTool(options?: {
  config?: OpenClawCNConfig;
  agentDir?: string;
}): AnyAgentTool {
  return {
    name: "wechat_read",
    label: "WeChat Read",
    description: [
      "读取微信/企业微信聊天消息。",
      "通过截图+Vision分析提取指定联系人的最近N条消息。",
      "",
      "工作流程:",
      "  1. 聚焦微信窗口",
      "  2. 搜索并打开指定联系人聊天",
      "  3. 截取聊天区域",
      "  4. 使用vision模型提取消息内容",
      "",
      "参数:",
      "  - contact: 联系人或群名称 (必填)",
      "  - count: 读取最近几条消息 (可选，默认5)",
      "",
      "示例:",
      '  wechat_read({contact: "张三", count: 10})',
      '  wechat_read({contact: "项目讨论群"})',
    ].join("\n"),
    parameters: WeChatReadSchema,
    execute: (toolCallId, args) => executeWeChatRead(toolCallId, args, options),
  };
}
