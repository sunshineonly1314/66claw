/**
 * WeCom (企业微信) composite tool: `wecom_send`
 *
 * One-call automation for sending a message via WeCom (企业微信):
 *   focus → search contact → click result → click input → type message → Enter
 *
 * This is a standalone tool for WeCom only. For personal WeChat (微信),
 * use `wechat_send` instead.
 *
 * Key lessons from real-world testing on WeCom:
 *   - Must use TOPMOST + AttachThreadInput for reliable window focus
 *   - Must Ctrl+A before typing search to clear residual text
 *   - Do NOT send Escape — it minimizes WeCom to system tray
 *   - Search results load slower than personal WeChat (need 2.5s wait)
 *   - First clickable contact result is at y ≈ win.y + 190 (below section headers)
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";
import {
  sleep,
  focus,
  focusWeComWindow,
  searchAndOpenContact,
  typeText,
  sendKey,
  clickAt,
  screenshot,
  invalidateVisionCache,
  fail,
} from "./wecom-helpers.js";

// ─── Schema ─────────────────────────────────────────────────────────

const Schema = Type.Object({
  contact: Type.String({ description: "联系人名称 (企业微信联系人或群名)" }),
  message: Type.String({ description: "要发送的消息" }),
});

// ─── Tool factory ───────────────────────────────────────────────────

export function createWeComSendTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "wecom_send",
    label: "WeCom Send",
    description: [
      "Send a message to a WeCom contact (企业微信发消息).",
      "Handles full flow: search → click result → type → send.",
      "Returns screenshot for verification.",
      "",
      "NOTE: This is for 企业微信 (WeCom) only. For personal 微信 (WeChat), use wechat_send.",
      "",
      "Example: wecom_send({contact:'小李', message:'你好'})",
    ].join("\n"),
    parameters: Schema,

    execute: async (_id, args): Promise<AgentToolResult<unknown>> => {
      const params = args as Record<string, unknown>;
      const contact = readStringParam(params, "contact", { required: true });
      const message = readStringParam(params, "message", { required: true });
      const log: string[] = [];

      try {
        // 1. Detect and focus WeCom
        const wc = await focusWeComWindow(log);
        if (!wc) return fail("企业微信窗口未找到，请确认已启动。", log);

        // 2. Search and open contact
        if (!(await searchAndOpenContact(contact, wc.layout, log))) {
          return fail(`搜索联系人 "${contact}" 失败`, log);
        }

        // 3. Click message input box
        clickAt(wc.layout.chatCenterX, wc.layout.inputBoxY);
        log.push(`✓ 点击输入框 (${wc.layout.chatCenterX}, ${wc.layout.inputBoxY})`);
        await sleep(500);

        // 4. Type message
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
        log.push(`✓ 输入消息 (${message.length} 字)`);
        await sleep(400);

        // 5. Send with Enter
        sendKey("{ENTER}");
        log.push("✓ 按 Enter 发送");
        await sleep(600);

        // 6. Invalidate vision cache (chat content changed)
        invalidateVisionCache(contact);

        // 7. Final verification screenshot (reduced from 3 to 1)
        const ss = await screenshot();
        return {
          content: [
            {
              type: "text" as const,
              text: `企业微信消息已发送 → ${contact}: "${message}"\n\n${log.join("\n")}`,
            },
            ...(ss.content ?? []),
          ],
          details: { status: "ok", contact, message, variant: "wecom" },
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
            { type: "text" as const, text: `企业微信发送异常: ${msg}\n\n${log.join("\n")}` },
            ...(ss?.content ?? []),
          ],
          details: { status: "error", error: msg },
        };
      }
    },
  };
}
