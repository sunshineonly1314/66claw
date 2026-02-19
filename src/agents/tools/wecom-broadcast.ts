/**
 * WeCom (企业微信) tool: `wecom_broadcast`
 *
 * 场景 3.1 定向个人消息
 * 场景 3.4 批量通知
 *
 * 给多个联系人/群批量发送消息，支持统一消息或个性化消息。
 * 每次发送间加随机延迟（防检测）。
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

import type { AnyAgentTool } from "./common.js";
import { readStringParam, readNumberParam } from "./common.js";
import {
  sleep,
  focusWeComWindow,
  searchAndOpenContact,
  focus,
  typeText,
  sendKey,
  clickAt,
  fail,
} from "./wecom-helpers.js";
import { isQuietHours } from "./wecom-cs-config.js";

// ─── Schema ─────────────────────────────────────────────────────────

const Schema = Type.Object({
  targets: Type.Array(
    Type.Object({
      contact: Type.String({ description: "联系人或群名称" }),
      message: Type.Optional(Type.String({ description: "个性化消息 (覆盖全局 message)" })),
    }),
    { description: "发送目标列表 (最多 20 个)", maxItems: 20 },
  ),
  message: Type.Optional(Type.String({ description: "全局消息 (当 target 没有个性化消息时使用)" })),
  delay_between: Type.Optional(
    Type.Number({
      description: "每次发送间隔秒数 (默认: 3，范围: 1-30)",
      minimum: 1,
      maximum: 30,
    }),
  ),
});

// ─── Execute ────────────────────────────────────────────────────────

interface SendResult {
  contact: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

async function executeWeComBroadcast(
  _toolCallId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const targets = args.targets as Array<{ contact: string; message?: string }>;
  const globalMessage = readStringParam(args, "message");
  const delayBetween = readNumberParam(args, "delay_between") ?? 3;
  const log: string[] = [];

  if (!targets || targets.length === 0) {
    return fail("targets 为空，请指定发送目标", log);
  }

  if (targets.length > 20) {
    return fail("单次批量发送不超过 20 个目标", log);
  }

  // Validate every target has a message
  for (const t of targets) {
    if (!t.message && !globalMessage) {
      return fail(`目标 "${t.contact}" 没有消息，且未设置全局 message`, log);
    }
  }

  try {
    // Pre-flight: quiet hours check
    if (isQuietHours()) {
      return fail("当前处于静默时段 (00:00-07:00)，不发送", log);
    }

    const results: SendResult[] = [];
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const msg = target.message || globalMessage!;

      log.push(`\n── 发送 ${i + 1}/${targets.length}: ${target.contact} ──`);

      try {
        // Focus WeCom
        const wc = await focusWeComWindow(log);
        if (!wc) {
          results.push({ contact: target.contact, status: "failed", error: "窗口未找到" });
          failedCount++;
          continue;
        }

        // Search and open contact
        if (!(await searchAndOpenContact(target.contact, wc.layout, log))) {
          results.push({ contact: target.contact, status: "failed", error: "搜索联系人失败" });
          failedCount++;
          continue;
        }

        // Click input box
        clickAt(wc.layout.chatCenterX, wc.layout.inputBoxY);
        await sleep(500);

        // Type message
        if (!typeText(msg)) {
          results.push({ contact: target.contact, status: "failed", error: "输入消息失败" });
          failedCount++;
          continue;
        }
        await sleep(400);

        // Send with Enter
        sendKey("{ENTER}");
        await sleep(600);

        results.push({ contact: target.contact, status: "sent" });
        sentCount++;
        log.push(`✓ 已发送: "${msg.substring(0, 30)}${msg.length > 30 ? "..." : ""}"`);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        results.push({ contact: target.contact, status: "failed", error: errMsg });
        failedCount++;
        log.push(`✗ 发送失败: ${errMsg}`);
      }

      // Random delay between sends (anti-detection)
      if (i < targets.length - 1) {
        const jitter = 0.7 + Math.random() * 0.6; // ±30%
        const delay = Math.floor(delayBetween * 1000 * jitter);
        log.push(`⏱️ 等待 ${(delay / 1000).toFixed(1)}s`);
        await sleep(delay);
      }
    }

    // Build report
    const report = [
      `📤 批量发送完成`,
      ``,
      `成功: ${sentCount}  失败: ${failedCount}  总计: ${targets.length}`,
      ``,
      ...results.map((r) => {
        if (r.status === "sent") return `  ✓ ${r.contact}`;
        return `  ✗ ${r.contact}: ${r.error}`;
      }),
      ``,
      log.join("\n"),
    ].join("\n");

    return {
      content: [{ type: "text", text: report }],
      details: {
        status: failedCount === 0 ? "ok" : "partial",
        sentCount,
        failedCount,
        results,
        log,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`批量发送异常: ${msg}`, log);
  }
}

// ─── Tool Factory ───────────────────────────────────────────────────

export function createWeComBroadcastTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "wecom_broadcast",
    label: "WeCom Broadcast",
    description: [
      "企业微信批量发送消息: 给多个联系人/群发送通知。",
      "",
      "功能:",
      "  - 支持统一消息或每人个性化消息",
      "  - 每次发送间随机延迟 (防检测)",
      "  - 静默时段自动跳过",
      "  - 单次最多 20 个目标",
      "",
      "示例:",
      '  wecom_broadcast({targets: [{contact:"张三"},{contact:"李四"}], message: "会议通知"})',
      '  wecom_broadcast({targets: [{contact:"A", message:"Hi A"},{contact:"B", message:"Hi B"}]})',
    ].join("\n"),
    parameters: Schema,
    execute: (id, args) => executeWeComBroadcast(id, args as Record<string, unknown>),
  };
}
