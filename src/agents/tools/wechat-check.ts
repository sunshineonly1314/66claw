/**
 * WeChat composite tool: `wechat_check`
 *
 * One-call automation for checking personal WeChat (微信) unread messages:
 *   focus → screenshot sidebar → (optionally scroll + screenshot) × N
 *   → optionally open a contact's chat → return all screenshots
 *
 * This tool is for personal WeChat (微信) ONLY.
 * For WeCom (企业微信), use `wecom_check` instead.
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

import type { AnyAgentTool } from "./common.js";
import { readNumberParam, readStringParam } from "./common.js";
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

/** Personal WeChat layout: 70px icon bar + 250px contact list */
function getLayout(win: WeChatWindow) {
  const iconBarWidth = 70;
  const contactListWidth = 250;
  const contactListCenterX = win.x + iconBarWidth + Math.floor(contactListWidth / 2);
  const contactListCenterY = win.y + Math.floor(win.h / 2);
  const chatTabX = win.x + 35;
  const chatTabY = win.y + 60;
  const firstResultY = win.y + 145;
  return { contactListCenterX, contactListCenterY, chatTabX, chatTabY, firstResultY };
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

function scrollAt(x: number, y: number, amount: number): void {
  runHelper(
    ["-Action", "scroll", "-X", String(x), "-Y", String(y), "-Amount", String(amount)],
    5000,
  );
}

async function screenshot(): Promise<AgentToolResult<unknown>> {
  return await handleScreenshot({});
}

// ─── Schema ─────────────────────────────────────────────────────────

const Schema = Type.Object({
  scroll_pages: Type.Optional(
    Type.Number({
      description:
        "Number of times to scroll the contact list down (each scroll reveals ~5 more contacts). 0 = just screenshot current view. Default: 0. Max recommended: 5.",
    }),
  ),
  contact: Type.Optional(
    Type.String({
      description:
        "If provided, search and open this contact's chat to read their messages. Leave empty to just check the sidebar for unread badges.",
    }),
  ),
});

// ─── Tool factory ───────────────────────────────────────────────────

export function createWeChatCheckTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "wechat_check",
    label: "WeChat Check",
    description: [
      "Check personal WeChat for unread messages (微信查看未读消息).",
      "Screenshots the contact sidebar to show who has unread badges.",
      "Optionally scrolls down to reveal more contacts.",
      "Optionally opens a contact's chat to read their messages.",
      "",
      "NOTE: This is for personal 微信 (WeChat) only. For 企业微信 (WeCom), use wecom_check.",
      "",
      "Examples:",
      "  wechat_check({})                        -- screenshot sidebar",
      "  wechat_check({scroll_pages: 3})          -- scroll down 3 pages",
      "  wechat_check({contact: '小李'})          -- open 小李's chat",
    ].join("\n"),
    parameters: Schema,

    execute: async (_id, args): Promise<AgentToolResult<unknown>> => {
      const params = args as Record<string, unknown>;
      const scrollPages = readNumberParam(params, "scroll_pages", { integer: true }) ?? 0;
      const contact = readStringParam(params, "contact");
      const log: string[] = [];
      const allScreenshots: Array<
        { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
      > = [];

      try {
        // 1. Detect and focus WeChat
        const win = getWeChatWindow();
        if (!win) {
          return fail("微信窗口未找到，请确认已启动。如需操作企业微信，请使用 wecom_check。", log);
        }
        if (!focus(win.title)) {
          return fail(`无法聚焦窗口: ${win.title}`, log);
        }
        log.push(`✓ Focus WeChat (${win.title})`);
        log.push(`✓ Window: (${win.x},${win.y}) ${win.w}×${win.h}`);
        await sleep(400);

        const layout = getLayout(win);

        // 2. Click the "Chat" tab
        clickAt(layout.chatTabX, layout.chatTabY);
        log.push("✓ Clicked chat tab");
        await sleep(300);

        // 3. Screenshot current sidebar view
        const ss0 = await screenshot();
        log.push("✓ Screenshot #1 (current view)");
        allScreenshots.push(...((ss0.content ?? []) as typeof allScreenshots));

        // 4. Scroll and screenshot additional pages
        const pages = Math.min(Math.max(scrollPages, 0), 10);
        for (let i = 0; i < pages; i++) {
          scrollAt(layout.contactListCenterX, layout.contactListCenterY, -3);
          log.push(`✓ Scrolled down page ${i + 1}`);
          await sleep(500);

          const ss = await screenshot();
          log.push(`✓ Screenshot #${i + 2} (after scroll ${i + 1})`);
          allScreenshots.push(...((ss.content ?? []) as typeof allScreenshots));
        }

        // 5. If a contact name is given, open that chat
        if (contact) {
          sendKey("^{f}");
          log.push("✓ Ctrl+F (open search)");
          await sleep(600);

          if (!typeText(contact)) {
            return fail(`输入联系人 "${contact}" 失败。`, log);
          }
          log.push(`✓ Typed "${contact}"`);
          await sleep(1500);

          clickAt(layout.contactListCenterX, layout.firstResultY);
          log.push("✓ Clicked search result");
          await sleep(600);

          // NOTE: Do NOT send Escape — WeChat auto-closes the search panel
          // after clicking a result. Sending ESC would minimize the window!

          const chatSs = await screenshot();
          log.push(`✓ Screenshot of ${contact}'s chat`);
          allScreenshots.push(...((chatSs.content ?? []) as typeof allScreenshots));
        }

        // 6. Return all screenshots + log
        const imageCount = allScreenshots.filter((c) => c.type === "image").length;
        return {
          content: [
            {
              type: "text" as const,
              text: [
                contact
                  ? `微信消息检查完成 — 已打开 ${contact} 的对话`
                  : `微信消息检查完成 — 共截图 ${imageCount} 张`,
                "请分析截图中联系人列表左侧的红色未读气泡/红点来识别新消息。",
                "",
                log.join("\n"),
              ].join("\n"),
            },
            ...allScreenshots,
          ],
          details: {
            status: "ok",
            variant: "wechat",
            scrollPages: pages,
            contact: contact ?? null,
            screenshotCount: imageCount,
          },
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
            { type: "text" as const, text: `微信检查异常: ${msg}\n\n${log.join("\n")}` },
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
