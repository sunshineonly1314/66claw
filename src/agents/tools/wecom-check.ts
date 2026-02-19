/**
 * WeCom (企业微信) composite tool: `wecom_check`
 *
 * One-call automation for checking WeCom unread messages:
 *   focus → screenshot sidebar → (optionally scroll + screenshot) × N
 *   → optionally open a contact's chat → return all screenshots
 *
 * This is a standalone tool for WeCom only. For personal WeChat (微信),
 * use `wechat_check` instead.
 *
 * Key WeCom-specific behaviors:
 *   - Do NOT send Escape — it minimizes WeCom to system tray
 *   - Must Ctrl+A before typing search to clear residual text
 *   - Search results load slower (need 2.5s wait)
 *   - First clickable result is at y ≈ win.y + 190
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

import type { AnyAgentTool } from "./common.js";
import { readNumberParam, readStringParam } from "./common.js";
import {
  sleep,
  getWeComWindow,
  getLayout,
  focus,
  sendKey,
  typeText,
  clickAt,
  scrollAt,
  screenshot,
  clearActiveContact,
  fail,
} from "./wecom-helpers.js";

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

export function createWeComCheckTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "wecom_check",
    label: "WeCom Check",
    description: [
      "Check WeCom for unread messages (企业微信查看未读消息).",
      "Screenshots the contact sidebar to show who has unread badges.",
      "Optionally scrolls down to reveal more contacts.",
      "Optionally opens a contact's chat to read their messages.",
      "",
      "NOTE: This is for 企业微信 (WeCom) only. For personal 微信 (WeChat), use wechat_check.",
      "",
      "Examples:",
      "  wecom_check({})                        -- screenshot sidebar",
      "  wecom_check({scroll_pages: 3})          -- scroll down 3 pages",
      "  wecom_check({contact: '小李'})          -- open 小李's chat",
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
        // 1. Detect and focus WeCom
        const win = getWeComWindow();
        if (!win) {
          return fail("企业微信窗口未找到，请确认已启动。", log);
        }
        if (!focus(win.title)) {
          return fail(`无法聚焦窗口: ${win.title}`, log);
        }
        log.push(`✓ Focus WeCom (${win.title})`);
        log.push(`✓ Window: (${win.x},${win.y}) ${win.w}×${win.h}`);
        await sleep(800);

        const layout = getLayout(win);

        // 2. Click the "Chat" tab (clears active contact)
        clearActiveContact();
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
          await sleep(1000);

          sendKey("^{a}");
          log.push("✓ Ctrl+A (clear residual text)");
          await sleep(200);

          if (!typeText(contact)) {
            return fail(`输入联系人 "${contact}" 失败。`, log);
          }
          log.push(`✓ Typed "${contact}"`);
          await sleep(2500);

          clickAt(layout.contactListCenterX, layout.firstResultY);
          log.push("✓ Clicked search result");
          await sleep(1500);

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
                  ? `企业微信消息检查完成 — 已打开 ${contact} 的对话`
                  : `企业微信消息检查完成 — 共截图 ${imageCount} 张`,
                "请分析截图中联系人列表左侧的红色未读气泡/红点来识别新消息。",
                "",
                log.join("\n"),
              ].join("\n"),
            },
            ...allScreenshots,
          ],
          details: {
            status: "ok",
            variant: "wecom",
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
            { type: "text" as const, text: `企业微信检查异常: ${msg}\n\n${log.join("\n")}` },
            ...(ss?.content ?? []),
          ],
          details: { status: "error", error: msg },
        };
      }
    },
  };
}
