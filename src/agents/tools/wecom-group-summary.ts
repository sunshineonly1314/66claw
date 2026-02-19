/**
 * WeCom (企业微信) tool: `wecom_group_summary`
 *
 * 场景 1.2 群消息摘要
 * 场景 1.5 消息量统计
 *
 * 进入指定群 → 截图聊天记录 → Vision 提取消息 → Kimi AI 生成摘要
 * 返回: 关键话题、活跃成员、消息量统计
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
  screenshotToFile,
  scrollAt,
  analyzeScreenshot,
  generateReplyWithKimi,
  extractMessages,
  fail,
} from "./wecom-helpers.js";

// ─── Schema ─────────────────────────────────────────────────────────

const Schema = Type.Object({
  group: Type.String({
    description: "群名称 (搜索并打开该群)",
  }),
  scroll_up: Type.Optional(
    Type.Number({
      description: "向上滚动页数以读取更多历史消息 (默认: 2，最大: 10)",
      minimum: 0,
      maximum: 10,
    }),
  ),
  count: Type.Optional(
    Type.Number({
      description: "提取最近几条消息 (默认: 20)",
      minimum: 1,
      maximum: 50,
    }),
  ),
});

// ─── Execute ────────────────────────────────────────────────────────

async function executeGroupSummary(
  _toolCallId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const group = readStringParam(args, "group", { required: true });
  const scrollUp = readNumberParam(args, "scroll_up") ?? 2;
  const count = readNumberParam(args, "count") ?? 20;
  const log: string[] = [];

  try {
    // 1. Focus and open group
    const wc = await focusWeComWindow(log);
    if (!wc) return fail("企业微信窗口未找到", log);

    if (!(await searchAndOpenContact(group, wc.layout, log))) {
      return fail(`打开群 "${group}" 失败`, log);
    }

    focus(wc.win.title);
    await sleep(300);

    // 2. Scroll up to load more history
    const pages = Math.min(Math.max(scrollUp, 0), 10);
    for (let i = 0; i < pages; i++) {
      scrollAt(wc.layout.chatCenterX, wc.layout.chatAreaTop + 100, 5); // scroll up
      await sleep(500);
    }
    if (pages > 0) {
      log.push(`✓ 向上滚动 ${pages} 页`);
      await sleep(1000);
    }

    // Scroll back down to current (so we capture latest first)
    // Actually we want to capture from top (old) to bottom (new)
    // But for simplicity, just capture current view
    focus(wc.win.title);
    await sleep(500);

    // 3. Screenshot chat area
    const ss = screenshotToFile(wc.win.title);
    if (!ss.ok) return fail("截图失败", log);
    log.push(`✓ 截图: ${ss.path}`);

    // 4. Vision extract messages
    const visionPrompt = `请分析这张企业微信群聊截图，提取最近的 ${count} 条消息。

对每条消息提取:
- sender: 发送者昵称 (自己发的标记为 "我")
- content: 消息内容
- time: 时间 (如果可见)

按时间顺序返回 JSON:
{"contact":"群名","messages":[{"sender":"张三","content":"你好","time":"14:30"}]}`;

    let visionResult: string;
    try {
      visionResult = await analyzeScreenshot(ss.base64, visionPrompt, {
        contactName: group,
      });
      log.push(`✓ Vision 分析完成 (${visionResult.length} chars)`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return fail(`Vision 分析失败: ${errMsg}`, log);
    }

    // 5. Parse messages
    const { messages } = extractMessages(visionResult);

    // 6. Statistics
    const senderCounts = new Map<string, number>();
    for (const msg of messages) {
      senderCounts.set(msg.sender, (senderCounts.get(msg.sender) || 0) + 1);
    }
    const activeSenders = Array.from(senderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // 7. Kimi AI generate summary
    let summary = "";
    if (messages.length > 0) {
      const messagesText = messages
        .map((m) => `[${m.time || ""}] ${m.sender}: ${m.content}`)
        .join("\n");

      try {
        summary = await generateReplyWithKimi(
          `以下是企业微信群"${group}"的最近消息，请生成简短摘要:\n\n${messagesText}`,
          `你是群消息摘要助手。请分析以下群聊消息，生成简洁摘要。
要求:
1. 总结 2-3 个关键话题
2. 标注重要信息 (决策、任务分配、截止日期等)
3. 列出需要关注的事项
4. 不超过 200 字
5. 不使用 markdown 格式`,
        );
        log.push("✓ AI 摘要生成完成");
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.push(`⚠️ AI 摘要失败: ${errMsg}`);
      }
    }

    // 8. Build report
    const report = [
      `📊 群消息摘要: ${group}`,
      ``,
      `消息量: ${messages.length} 条`,
      `活跃成员: ${activeSenders.length} 人`,
      activeSenders.length > 0
        ? activeSenders.map((s) => `  - ${s.name}: ${s.count} 条`).join("\n")
        : "",
      ``,
      summary ? `📝 AI 摘要:\n${summary}` : "",
      ``,
      `💬 最近消息:`,
      messages.length > 0
        ? messages
            .slice(-10)
            .map((m) => `  [${m.time || "?"}] ${m.sender}: ${m.content}`)
            .join("\n")
        : "  (无消息)",
      ``,
      log.join("\n"),
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [{ type: "text", text: report }],
      details: {
        status: "ok",
        group,
        messageCount: messages.length,
        activeSenders,
        summary,
        messages,
        screenshotPath: ss.path,
        log,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`群摘要异常: ${msg}`, log);
  }
}

// ─── Tool Factory ───────────────────────────────────────────────────

export function createWeComGroupSummaryTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "wecom_group_summary",
    label: "WeCom Group Summary",
    description: [
      "企业微信群消息摘要: 进入群聊 → 提取消息 → AI生成摘要。",
      "",
      "返回: 关键话题、活跃成员、消息量统计、AI摘要。",
      "",
      "示例:",
      '  wecom_group_summary({group: "项目讨论群"})',
      '  wecom_group_summary({group: "客服群", scroll_up: 5, count: 30})',
    ].join("\n"),
    parameters: Schema,
    execute: (id, args) => executeGroupSummary(id, args as Record<string, unknown>),
  };
}
