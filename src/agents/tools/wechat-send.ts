/**
 * WeChat composite tool: `wechat_send`
 *
 * One-call automation for sending a message via personal WeChat (微信):
 *   focus → search contact → click result → click input → type message → Enter
 *
 * This tool is for personal WeChat (微信) ONLY.
 * For WeCom (企业微信), use `wecom_send` instead.
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";
import { runHelper, handleScreenshot } from "./desktop-control.js";

// ─── Helpers ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WeChatWindow {
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function getWeChatWindow(): WeChatWindow | null {
  const out = runHelper(["-Action", "list_windows"], 8000);
  if (!out) return null;
  for (const line of out.split(/\r?\n/).filter(Boolean)) {
    const p = line.split("|||");
    const title = p[0] ?? "";
    const rect = { x: +p[2] || 0, y: +p[3] || 0, w: +p[4] || 0, h: +p[5] || 0 };
    if (title === "微信" || title === "WeChat") {
      return { title, ...rect };
    }
  }
  return null;
}

/** Personal WeChat (微信) layout: 70px icon bar + 250px contact list */
function getLayout(win: WeChatWindow) {
  const iconBarWidth = 70;
  const contactListWidth = 250;
  const contactListCenterX = win.x + iconBarWidth + Math.floor(contactListWidth / 2);
  const chatCenterX =
    win.x +
    iconBarWidth +
    contactListWidth +
    Math.floor((win.w - iconBarWidth - contactListWidth) / 2);
  const inputBoxY = win.y + win.h - 80;
  const searchBarY = win.y + 40;
  const firstResultY = win.y + 145;
  return { contactListCenterX, chatCenterX, inputBoxY, searchBarY, firstResultY };
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

async function screenshot(): Promise<AgentToolResult<unknown>> {
  return await handleScreenshot({});
}

// ─── Schema ─────────────────────────────────────────────────────────

const Schema = Type.Object({
  contact: Type.String({ description: "联系人名称 (WeChat contact name)" }),
  message: Type.String({ description: "要发送的消息" }),
});

// ─── Tool factory ───────────────────────────────────────────────────

export function createWeChatSendTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "wechat_send",
    label: "WeChat Send",
    description: [
      "Send a message to a personal WeChat contact (微信发消息).",
      "Handles full flow: search → click result → type → send.",
      "Returns screenshots for verification.",
      "",
      "NOTE: This is for personal 微信 (WeChat) only. For 企业微信 (WeCom), use wecom_send.",
      "",
      "Example: wechat_send({contact:'小李', message:'你好'})",
    ].join("\n"),
    parameters: Schema,

    execute: async (_id, args): Promise<AgentToolResult<unknown>> => {
      const params = args as Record<string, unknown>;
      const contact = readStringParam(params, "contact", { required: true });
      const message = readStringParam(params, "message", { required: true });
      const log: string[] = [];

      try {
        // 1. Detect and focus WeChat
        let win = getWeChatWindow();
        if (!win) {
          return fail("微信窗口未找到，请确认已启动。如需操作企业微信，请使用 wecom_send。", log);
        }
        if (!focus(win.title)) {
          return fail(`无法聚焦窗口: ${win.title}`, log);
        }
        log.push(`✓ Focus WeChat (${win.title})`);
        await sleep(600);

        // Re-query window rect after focus/restore
        win = getWeChatWindow() ?? win;
        log.push(`✓ Window: (${win.x},${win.y}) ${win.w}×${win.h}`);

        const layout = getLayout(win);

        // 2. Open search (Ctrl+F)
        sendKey("^{f}");
        log.push("✓ Ctrl+F (open search)");
        await sleep(600);

        // 3. Type contact name
        if (!typeText(contact)) {
          return fail(`输入联系人 "${contact}" 失败。`, log);
        }
        log.push(`✓ Typed "${contact}"`);
        await sleep(1500);

        // 4. Screenshot to verify search results
        const searchSs = await screenshot();
        log.push("✓ Screenshot after search");

        // 5. Click first search result
        clickAt(layout.contactListCenterX, layout.firstResultY);
        log.push(`✓ Clicked search result (${layout.contactListCenterX}, ${layout.firstResultY})`);
        await sleep(800);

        // 6. Verify contact was selected (search closes automatically after click)
        // NOTE: Do NOT send Escape here — WeChat auto-closes the search panel
        // after clicking a result. Sending ESC would minimize the entire window!
        const verifySs = await screenshot();
        log.push("✓ Screenshot after contact selection");

        // 7. Click message input box
        clickAt(layout.chatCenterX, layout.inputBoxY);
        log.push(`✓ Clicked input box (${layout.chatCenterX}, ${layout.inputBoxY})`);
        await sleep(500);

        // 8. Type message
        if (!typeText(message)) {
          const ss = await screenshot();
          return {
            content: [
              { type: "text" as const, text: `输入消息失败。\n\n${log.join("\n")}` },
              ...(ss.content ?? []),
            ],
            details: { status: "error", step: "type_message" },
          };
        }
        log.push(`✓ Typed message (${message.length} chars)`);
        await sleep(400);

        // 9. Send with Enter
        sendKey("{ENTER}");
        log.push("✓ Enter (send)");
        await sleep(600);

        // 10. Final screenshot
        const ss = await screenshot();
        return {
          content: [
            {
              type: "text" as const,
              text: `微信消息已发送 → ${contact}: "${message}"\n\n${log.join("\n")}`,
            },
            ...(searchSs.content ?? []),
            ...(verifySs.content ?? []),
            ...(ss.content ?? []),
          ],
          details: { status: "ok", contact, message, variant: "wechat" },
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        let ss: AgentToolResult<unknown> | null = null;
        try {
          ss = await screenshot();
        } catch {
          /* */
        }
        return {
          content: [
            { type: "text" as const, text: `微信发送异常: ${msg}\n\n${log.join("\n")}` },
            ...(ss?.content ?? []),
          ],
          details: { status: "error", error: msg },
        };
      }
    },
  };
}

function fail(reason: string, log: string[]): AgentToolResult<unknown> {
  return {
    content: [{ type: "text" as const, text: `${reason}\n\n${log.join("\n")}` }],
    details: { status: "error" },
  };
}
