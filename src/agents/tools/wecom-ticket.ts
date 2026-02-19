/**
 * WeCom (企业微信) tool: `wecom_ticket`
 *
 * 场景 4.1 自动建工单
 * 场景 4.2 工单状态查询
 * 场景 4.3 工单关闭通知
 *
 * 本地 JSON 文件存储工单。支持 create / query / update / close / notify 操作。
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";

// ─── Ticket Storage ─────────────────────────────────────────────────

const TICKET_FILE = process.env.WECOM_TICKET_FILE || path.join(os.homedir(), ".wecom-tickets.json");

interface Ticket {
  id: string;
  contact: string;
  type: "bug" | "feature" | "question" | "complaint" | "other";
  content: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
  resolution?: string;
  notified: boolean;
}

interface TicketStore {
  tickets: Ticket[];
  counter: number;
}

function loadTickets(): TicketStore {
  try {
    if (fs.existsSync(TICKET_FILE)) {
      const raw = fs.readFileSync(TICKET_FILE, "utf-8");
      return JSON.parse(raw) as TicketStore;
    }
  } catch {
    // corrupted file, start fresh
  }
  return { tickets: [], counter: 0 };
}

function saveTickets(store: TicketStore): void {
  fs.writeFileSync(TICKET_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function generateTicketId(store: TicketStore): string {
  store.counter++;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `T-${date}-${String(store.counter).padStart(3, "0")}`;
}

// ─── Schema ─────────────────────────────────────────────────────────

const Schema = Type.Object({
  action: Type.Union(
    [
      Type.Literal("create"),
      Type.Literal("query"),
      Type.Literal("update"),
      Type.Literal("close"),
      Type.Literal("list"),
      Type.Literal("notify_pending"),
    ],
    { description: "操作类型" },
  ),
  contact: Type.Optional(Type.String({ description: "联系人名称 (create/query 时使用)" })),
  ticket_id: Type.Optional(Type.String({ description: "工单ID (update/close 时使用)" })),
  type: Type.Optional(
    Type.Union(
      [
        Type.Literal("bug"),
        Type.Literal("feature"),
        Type.Literal("question"),
        Type.Literal("complaint"),
        Type.Literal("other"),
      ],
      { description: "工单类型 (create 时使用)" },
    ),
  ),
  content: Type.Optional(Type.String({ description: "工单内容/问题描述 (create 时使用)" })),
  resolution: Type.Optional(Type.String({ description: "解决说明 (close 时使用)" })),
  status: Type.Optional(
    Type.Union(
      [
        Type.Literal("open"),
        Type.Literal("in_progress"),
        Type.Literal("resolved"),
        Type.Literal("closed"),
      ],
      { description: "工单状态 (update 时使用)" },
    ),
  ),
});

// ─── Execute ────────────────────────────────────────────────────────

async function executeWeComTicket(
  _toolCallId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const action = readStringParam(args, "action", { required: true });
  const store = loadTickets();

  switch (action) {
    case "create": {
      const contact = readStringParam(args, "contact", { required: true });
      const content = readStringParam(args, "content", { required: true });
      const type = (readStringParam(args, "type") || "other") as Ticket["type"];

      const id = generateTicketId(store);
      const now = new Date().toISOString();
      const ticket: Ticket = {
        id,
        contact,
        type,
        content,
        status: "open",
        created_at: now,
        updated_at: now,
        notified: false,
      };
      store.tickets.push(ticket);
      saveTickets(store);

      return {
        content: [
          {
            type: "text",
            text: `✅ 工单已创建\n\nID: ${id}\n联系人: ${contact}\n类型: ${type}\n内容: ${content}\n\n可回复用户: "已记录工单 ${id}，我们会尽快处理哈"`,
          },
        ],
        details: { status: "ok", action: "create", ticket },
      };
    }

    case "query": {
      const contact = readStringParam(args, "contact");
      const ticketId = readStringParam(args, "ticket_id");

      let matched: Ticket[];
      if (ticketId) {
        matched = store.tickets.filter((t) => t.id === ticketId);
      } else if (contact) {
        matched = store.tickets.filter((t) => t.contact === contact);
      } else {
        return {
          content: [{ type: "text", text: "请提供 contact 或 ticket_id 进行查询" }],
          details: { status: "error" },
        };
      }

      if (matched.length === 0) {
        return {
          content: [{ type: "text", text: `未找到相关工单` }],
          details: { status: "ok", action: "query", tickets: [] },
        };
      }

      const lines = matched.map(
        (t) =>
          `[${t.id}] ${t.contact} | ${t.type} | ${t.status}\n  内容: ${t.content}\n  创建: ${t.created_at}${t.resolution ? `\n  解决: ${t.resolution}` : ""}`,
      );

      return {
        content: [
          { type: "text", text: `📋 查询到 ${matched.length} 个工单:\n\n${lines.join("\n\n")}` },
        ],
        details: { status: "ok", action: "query", tickets: matched },
      };
    }

    case "update": {
      const ticketId = readStringParam(args, "ticket_id", { required: true });
      const newStatus = readStringParam(args, "status") as Ticket["status"] | undefined;
      const ticket = store.tickets.find((t) => t.id === ticketId);
      if (!ticket) {
        return {
          content: [{ type: "text", text: `工单 ${ticketId} 不存在` }],
          details: { status: "error" },
        };
      }
      if (newStatus) ticket.status = newStatus;
      ticket.updated_at = new Date().toISOString();
      saveTickets(store);

      return {
        content: [{ type: "text", text: `✅ 工单 ${ticketId} 已更新为 ${ticket.status}` }],
        details: { status: "ok", action: "update", ticket },
      };
    }

    case "close": {
      const ticketId = readStringParam(args, "ticket_id", { required: true });
      const resolution = readStringParam(args, "resolution") || "已解决";
      const ticket = store.tickets.find((t) => t.id === ticketId);
      if (!ticket) {
        return {
          content: [{ type: "text", text: `工单 ${ticketId} 不存在` }],
          details: { status: "error" },
        };
      }
      ticket.status = "closed";
      ticket.resolution = resolution;
      ticket.updated_at = new Date().toISOString();
      ticket.notified = false; // mark as needing notification
      saveTickets(store);

      return {
        content: [
          {
            type: "text",
            text: `✅ 工单 ${ticketId} 已关闭\n解决说明: ${resolution}\n\n建议通知用户: wecom_send({contact:"${ticket.contact}", message:"您反馈的问题 (${ticketId}) 已解决: ${resolution}"})`,
          },
        ],
        details: { status: "ok", action: "close", ticket },
      };
    }

    case "list": {
      const openTickets = store.tickets.filter((t) => t.status !== "closed");
      if (openTickets.length === 0) {
        return {
          content: [{ type: "text", text: "✅ 当前无未关闭工单" }],
          details: { status: "ok", action: "list", tickets: [] },
        };
      }

      const lines = openTickets.map(
        (t) => `  [${t.id}] ${t.contact} | ${t.type} | ${t.status} | ${t.content.substring(0, 40)}`,
      );

      return {
        content: [
          {
            type: "text",
            text: `📋 未关闭工单 (${openTickets.length} 个):\n\n${lines.join("\n")}`,
          },
        ],
        details: { status: "ok", action: "list", tickets: openTickets },
      };
    }

    case "notify_pending": {
      const pending = store.tickets.filter(
        (t) => (t.status === "resolved" || t.status === "closed") && !t.notified,
      );

      if (pending.length === 0) {
        return {
          content: [{ type: "text", text: "✅ 无待通知的已解决工单" }],
          details: { status: "ok", action: "notify_pending", pendingNotifications: [] },
        };
      }

      const notifications = pending.map((t) => ({
        ticket_id: t.id,
        contact: t.contact,
        message: `您好，您之前反馈的问题 (${t.id}) 已处理完毕: ${t.resolution || "已解决"}。如有其他问题随时联系我哈~`,
      }));

      // Mark as notified
      for (const t of pending) {
        t.notified = true;
        t.updated_at = new Date().toISOString();
      }
      saveTickets(store);

      const lines = notifications.map(
        (n) => `  [${n.ticket_id}] → ${n.contact}: "${n.message.substring(0, 50)}..."`,
      );

      return {
        content: [
          {
            type: "text",
            text: `📢 待通知工单 (${notifications.length} 个):\n\n${lines.join("\n")}\n\n请使用 wecom_broadcast 或 wecom_send 逐个发送通知。`,
          },
        ],
        details: { status: "ok", action: "notify_pending", pendingNotifications: notifications },
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

export function createWeComTicketTool(): AnyAgentTool {
  return {
    name: "wecom_ticket",
    label: "WeCom Ticket",
    description: [
      "企业微信工单管理: 创建/查询/更新/关闭工单。",
      "",
      "操作:",
      '  create  — 创建工单: wecom_ticket({action:"create", contact:"张三", type:"bug", content:"登录崩溃"})',
      '  query   — 查询工单: wecom_ticket({action:"query", contact:"张三"}) 或 ticket_id',
      '  update  — 更新状态: wecom_ticket({action:"update", ticket_id:"T-xxx", status:"in_progress"})',
      '  close   — 关闭工单: wecom_ticket({action:"close", ticket_id:"T-xxx", resolution:"已修复"})',
      '  list    — 列出未关闭: wecom_ticket({action:"list"})',
      '  notify_pending — 获取待通知列表: wecom_ticket({action:"notify_pending"})',
    ].join("\n"),
    parameters: Schema,
    execute: (id, args) => executeWeComTicket(id, args as Record<string, unknown>),
  };
}
