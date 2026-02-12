/**
 * WeChat composite tool: `wechat_send`
 *
 * One-call automation for sending a message via WeChat or WeCom (企业微信):
 *   focus → search contact → click result → Escape → click input → type message → Enter
 *
 * Supports both personal WeChat (微信) and WeCom (企业微信) with different layouts.
 * Returns screenshots at each critical step so the agent can verify the result.
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

/** Detect which WeChat variant is running and get its window rect. */
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
    // Personal WeChat: title is exactly "微信" or "WeChat"
    if (title === "微信" || title === "WeChat") {
      return { variant: "wechat", title, ...rect };
    }
    // WeCom: title contains "企业微信"
    if (title === "企业微信" || title === "WeCom" || title.includes("企业微信")) {
      wecom = { variant: "wecom", title, ...rect };
    }
  }
  return wecom;
}

/** Layout metrics differ between WeChat and WeCom. */
function getLayout(win: WeChatWindow) {
  if (win.variant === "wecom") {
    // WeCom (企业微信) layout:
    //   Left nav sidebar:  ~80px  (消息、邮件、文档、日程、会议 etc.)
    //   Contact list:      ~290px
    //   Chat area:         rest
    const navBarWidth = 80;
    const contactListWidth = 290;
    const contactListCenterX = win.x + navBarWidth + Math.floor(contactListWidth / 2);
    const chatLeft = win.x + navBarWidth + contactListWidth;
    const chatCenterX = chatLeft + Math.floor((win.w - navBarWidth - contactListWidth) / 2);
    const inputBoxY = win.y + win.h - 100;
    const searchBarY = win.y + 40;
    const firstResultY = win.y + 130;
    return { contactListCenterX, chatCenterX, inputBoxY, searchBarY, firstResultY };
  }
  // Personal WeChat (微信): 70px icon bar + 250px contact list
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

function typeText(text: string): boolean {
  return runHelper(["-Action", "type", "-Text", text], 8000).startsWith("ok");
}

function clickAt(x: number, y: number): void {
  runHelper(["-Action", "click", "-X", String(x), "-Y", String(y)], 5000);
}

async function screenshot(): Promise<AgentToolResult<unknown>> {
  return await handleScreenshot({});
}

// ─── Schema ─────────────────────────────────────────────────────────

const Schema = Type.Object({
  contact: Type.String({ description: "联系人名称 (WeChat/WeCom contact name)" }),
  message: Type.String({ description: "要发送的消息" }),
});

// ─── Tool factory ───────────────────────────────────────────────────

export function createWeChatSendTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "wechat_send",
    label: "WeChat Send",
    description: [
      "Send a message to a WeChat or WeCom contact (微信/企业微信发消息).",
      "Automatically detects personal WeChat or WeCom and adapts the flow.",
      "Handles full flow: search → click result → type → send.",
      "Returns screenshots for verification.",
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
        // 1. Detect and focus WeChat/WeCom
        const win = getWeChatWindow();
        if (!win) {
          return fail("微信/企业微信窗口未找到，请确认已启动。", log);
        }
        if (!focus(win.title)) {
          return fail(`无法聚焦窗口: ${win.title}`, log);
        }
        log.push(`✓ Focus ${win.variant === "wecom" ? "WeCom" : "WeChat"} (${win.title})`);
        log.push(`✓ Window: (${win.x},${win.y}) ${win.w}×${win.h}`);
        await sleep(400);

        const layout = getLayout(win);

        // 2. Open search (Ctrl+F works for both WeChat and WeCom)
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
        await sleep(600);

        // 6. Close search overlay with Escape — CRITICAL
        sendKey("{ESC}");
        log.push("✓ Escape (close search)");
        await sleep(400);

        // 7. Verify contact was selected
        const verifySs = await screenshot();
        log.push("✓ Screenshot after contact selection");

        // 8. Click message input box
        clickAt(layout.chatCenterX, layout.inputBoxY);
        log.push(`✓ Clicked input box (${layout.chatCenterX}, ${layout.inputBoxY})`);
        await sleep(300);

        // 9. Type message
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
        await sleep(200);

        // 10. Send with Enter
        sendKey("{ENTER}");
        log.push("✓ Enter (send)");
        await sleep(600);

        // 11. Final screenshot
        const ss = await screenshot();
        return {
          content: [
            {
              type: "text" as const,
              text: `${win.variant === "wecom" ? "企业微信" : "微信"}消息已发送 → ${contact}: "${message}"\n\n${log.join("\n")}`,
            },
            ...(searchSs.content ?? []),
            ...(verifySs.content ?? []),
            ...(ss.content ?? []),
          ],
          details: { status: "ok", contact, message, variant: win.variant },
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
