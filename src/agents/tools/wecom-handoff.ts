/**
 * WeCom (企业微信) tool: `wecom_handoff`
 *
 * 场景 5.1 转人工触发 (AI 回复含 [转人工])
 * 场景 5.2 人工接管标记 (手动加入/移除)
 * 场景 5.3 接管状态查询
 *
 * 本地 JSON 文件存储接管列表。wecom_auto_reply 调用 isHandoff 检查后决定是否跳过。
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";

// ─── Handoff Storage ────────────────────────────────────────────────

const HANDOFF_FILE =
  process.env.WECOM_HANDOFF_FILE || path.join(os.homedir(), ".wecom-handoff.json");

interface HandoffEntry {
  contact: string;
  reason: string;
  handoff_at: string;
  /** true = auto-added (AI detected [转人工]); false = manually added */
  auto: boolean;
}

interface HandoffStore {
  entries: HandoffEntry[];
}

function loadHandoff(): HandoffStore {
  try {
    if (fs.existsSync(HANDOFF_FILE)) {
      const raw = fs.readFileSync(HANDOFF_FILE, "utf-8");
      return JSON.parse(raw) as HandoffStore;
    }
  } catch {
    // corrupted, start fresh
  }
  return { entries: [] };
}

function saveHandoff(store: HandoffStore): void {
  fs.writeFileSync(HANDOFF_FILE, JSON.stringify(store, null, 2), "utf-8");
}

// ─── Public API (for wecom_auto_reply to import) ────────────────────

/**
 * Check if a contact is in the handoff list (human-managed).
 */
export function isHandoff(contact: string): boolean {
  const store = loadHandoff();
  return store.entries.some((e) => e.contact === contact);
}

/**
 * Add a contact to the handoff list (auto-triggered by [转人工]).
 */
export function addHandoff(contact: string, reason: string, auto: boolean): void {
  const store = loadHandoff();
  // Avoid duplicates
  if (store.entries.some((e) => e.contact === contact)) return;
  store.entries.push({
    contact,
    reason,
    handoff_at: new Date().toISOString(),
    auto,
  });
  saveHandoff(store);
}

// ─── Schema ─────────────────────────────────────────────────────────

const Schema = Type.Object({
  action: Type.Union(
    [Type.Literal("add"), Type.Literal("remove"), Type.Literal("list"), Type.Literal("check")],
    { description: "操作类型" },
  ),
  contact: Type.Optional(Type.String({ description: "联系人名称 (add/remove/check 时使用)" })),
  reason: Type.Optional(Type.String({ description: "接管原因 (add 时使用，默认: '手动接管')" })),
});

// ─── Execute ────────────────────────────────────────────────────────

async function executeWeComHandoff(
  _toolCallId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const action = readStringParam(args, "action", { required: true });
  const store = loadHandoff();

  switch (action) {
    case "add": {
      const contact = readStringParam(args, "contact", { required: true });
      const reason = readStringParam(args, "reason") || "手动接管";

      if (store.entries.some((e) => e.contact === contact)) {
        return {
          content: [{ type: "text", text: `ℹ️ "${contact}" 已在人工接管列表中` }],
          details: { status: "ok", action: "add", alreadyExists: true },
        };
      }

      store.entries.push({
        contact,
        reason,
        handoff_at: new Date().toISOString(),
        auto: false,
      });
      saveHandoff(store);

      return {
        content: [
          {
            type: "text",
            text: `✅ 已将 "${contact}" 加入人工接管列表\n原因: ${reason}\n\nAI 将不再自动回复此联系人。`,
          },
        ],
        details: { status: "ok", action: "add", contact, reason },
      };
    }

    case "remove": {
      const contact = readStringParam(args, "contact", { required: true });
      const idx = store.entries.findIndex((e) => e.contact === contact);
      if (idx === -1) {
        return {
          content: [{ type: "text", text: `ℹ️ "${contact}" 不在人工接管列表中` }],
          details: { status: "ok", action: "remove", notFound: true },
        };
      }

      store.entries.splice(idx, 1);
      saveHandoff(store);

      return {
        content: [
          {
            type: "text",
            text: `✅ 已将 "${contact}" 从人工接管列表移除\n\nAI 将恢复对此联系人的自动回复。`,
          },
        ],
        details: { status: "ok", action: "remove", contact },
      };
    }

    case "list": {
      if (store.entries.length === 0) {
        return {
          content: [{ type: "text", text: "✅ 当前无人工接管联系人" }],
          details: { status: "ok", action: "list", entries: [] },
        };
      }

      const lines = store.entries.map(
        (e) => `  - ${e.contact} | ${e.auto ? "自动" : "手动"} | ${e.reason} | ${e.handoff_at}`,
      );

      return {
        content: [
          {
            type: "text",
            text: `👤 人工接管列表 (${store.entries.length} 人):\n\n${lines.join("\n")}`,
          },
        ],
        details: { status: "ok", action: "list", entries: store.entries },
      };
    }

    case "check": {
      const contact = readStringParam(args, "contact", { required: true });
      const entry = store.entries.find((e) => e.contact === contact);

      if (entry) {
        return {
          content: [
            {
              type: "text",
              text: `⚠️ "${contact}" 当前由人工接管\n原因: ${entry.reason}\n接管时间: ${entry.handoff_at}\n来源: ${entry.auto ? "AI自动转人工" : "手动添加"}`,
            },
          ],
          details: { status: "ok", action: "check", isHandoff: true, entry },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ "${contact}" 未被人工接管，AI 可正常自动回复。`,
          },
        ],
        details: { status: "ok", action: "check", isHandoff: false },
      };
    }

    default:
      return {
        content: [{ type: "text", text: `未知操作: ${action}` }],
        details: { status: "error" },
      };
  }
}

// ─── Tool Factory ───────────────────────────────────────────────────

export function createWeComHandoffTool(): AnyAgentTool {
  return {
    name: "wecom_handoff",
    label: "WeCom Handoff",
    description: [
      "企业微信人机协作: 管理人工接管列表。",
      "",
      "当联系人在接管列表中时，wecom_auto_reply 将自动跳过。",
      "",
      "操作:",
      '  add    — 加入接管: wecom_handoff({action:"add", contact:"张三", reason:"投诉"})',
      '  remove — 移除接管: wecom_handoff({action:"remove", contact:"张三"})',
      '  list   — 查看列表: wecom_handoff({action:"list"})',
      '  check  — 检查状态: wecom_handoff({action:"check", contact:"张三"})',
    ].join("\n"),
    parameters: Schema,
    execute: (id, args) => executeWeComHandoff(id, args as Record<string, unknown>),
  };
}
