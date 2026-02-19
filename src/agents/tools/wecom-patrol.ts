/**
 * WeCom (企业微信) tool: `wecom_patrol`
 *
 * 场景 1.1 定时巡检未读消息
 * 场景 1.3 @我 消息检测
 * 场景 1.4 关键词告警
 *
 * 扫描侧边栏 → Vision 分析识别未读气泡 → 可选进入每个未读联系人读取消息
 * → 检测 @我 和关键词告警 → 返回结构化报告
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

import type { AnyAgentTool } from "./common.js";
import { readNumberParam, readStringArrayParam } from "./common.js";
import {
  sleep,
  getWeComWindow,
  getLayout,
  focus,
  sendKey,
  clickAt,
  scrollAt,
  screenshotToFile,
  analyzeScreenshotWithOllama,
  clearActiveContact,
  fail,
} from "./wecom-helpers.js";

// ─── Schema ─────────────────────────────────────────────────────────

const Schema = Type.Object({
  scroll_pages: Type.Optional(
    Type.Number({
      description: "向下滚动页数 (每页约5个联系人，默认: 2，最大: 10)",
      minimum: 0,
      maximum: 10,
    }),
  ),
  alert_keywords: Type.Optional(
    Type.Array(Type.String(), {
      description:
        '关键词告警列表，有未读消息包含这些词时标记为紧急 (默认: ["紧急","bug","投诉","退款","故障"])',
    }),
  ),
  check_mentions: Type.Optional(
    Type.Boolean({
      description: "是否检测 @我 的消息 (默认: true)",
    }),
  ),
});

// ─── Execute ────────────────────────────────────────────────────────

const DEFAULT_ALERT_KEYWORDS = ["紧急", "bug", "投诉", "退款", "故障", "崩溃", "报错"];

async function executeWeComPatrol(
  _toolCallId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const scrollPages = readNumberParam(args, "scroll_pages") ?? 2;
  const alertKeywords = readStringArrayParam(args, "alert_keywords") ?? DEFAULT_ALERT_KEYWORDS;
  const checkMentions = args.check_mentions !== false;
  const log: string[] = [];

  try {
    // 1. Focus WeCom
    let win = getWeComWindow();
    if (!win) return fail("企业微信窗口未找到", log);
    if (!focus(win.title)) return fail(`无法聚焦窗口: ${win.title}`, log);
    log.push(`✓ 聚焦企业微信 (${win.title})`);
    await sleep(1200);

    win = getWeComWindow() ?? win;
    const layout = getLayout(win);

    // 2. Click chat tab (clears active contact — we're now on sidebar)
    clearActiveContact();
    clickAt(layout.chatTabX, layout.chatTabY);
    log.push("✓ 点击消息标签");
    await sleep(500);

    // 3. Screenshot sidebar (current + scroll pages)
    const sidebarScreenshots: string[] = []; // base64 array
    const sidebarPaths: string[] = [];

    const ss0 = screenshotToFile(win.title);
    if (ss0.ok) {
      sidebarScreenshots.push(ss0.base64);
      sidebarPaths.push(ss0.path);
      log.push(`✓ 截图 #1 (当前视图)`);
    }

    const pages = Math.min(Math.max(scrollPages, 0), 10);
    for (let i = 0; i < pages; i++) {
      scrollAt(layout.contactListCenterX, layout.contactListCenterY, -3);
      await sleep(600);
      const ss = screenshotToFile(win.title);
      if (ss.ok) {
        sidebarScreenshots.push(ss.base64);
        sidebarPaths.push(ss.path);
        log.push(`✓ 截图 #${i + 2} (滚动第 ${i + 1} 页)`);
      }
    }

    // 4. Vision analysis: detect unread badges
    log.push("✓ Vision 分析侧边栏...");
    const analysisResults: string[] = [];

    for (let i = 0; i < sidebarScreenshots.length; i++) {
      const prompt = `请分析这张企业微信截图的左侧聊天列表。

请列出每个可见的联系人/群，标注:
1. 名称
2. 是否有未读标记 (红色数字气泡、红点、或加粗名称)
3. 未读数量 (如果是数字气泡)
4. 最近消息预览 (如果可见)
5. 是否有 @我 的标记

用 JSON 格式返回:
{"contacts": [
  {"name": "张三", "unread": true, "unread_count": 3, "preview": "你好", "mentioned": false},
  {"name": "项目群", "unread": true, "unread_count": 0, "preview": "@我 请查收", "mentioned": true}
]}`;

      try {
        const result = await analyzeScreenshotWithOllama(sidebarScreenshots[i], prompt);
        analysisResults.push(result);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.push(`⚠️ 第 ${i + 1} 张截图分析失败: ${errMsg}`);
      }
    }

    // 5. Aggregate results
    interface ContactInfo {
      name: string;
      unread: boolean;
      unread_count: number;
      preview: string;
      mentioned: boolean;
      alerts: string[];
    }

    const allContacts: ContactInfo[] = [];
    const seenNames = new Set<string>();

    for (const result of analysisResults) {
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          for (const c of parsed.contacts || []) {
            if (seenNames.has(c.name)) continue;
            seenNames.add(c.name);

            // Check for alert keywords in preview
            const alerts: string[] = [];
            const previewLower = (c.preview || "").toLowerCase();
            for (const kw of alertKeywords) {
              if (previewLower.includes(kw.toLowerCase())) {
                alerts.push(kw);
              }
            }

            allContacts.push({
              name: c.name,
              unread: !!c.unread,
              unread_count: c.unread_count || 0,
              preview: c.preview || "",
              mentioned: checkMentions ? !!c.mentioned : false,
              alerts,
            });
          }
        }
      } catch {
        // skip malformed JSON
      }
    }

    // 6. Build report
    const unreadContacts = allContacts.filter((c) => c.unread);
    const mentionedContacts = allContacts.filter((c) => c.mentioned);
    const alertContacts = allContacts.filter((c) => c.alerts.length > 0);

    const reportLines: string[] = [
      `📋 企业微信巡检报告`,
      ``,
      `扫描范围: ${sidebarScreenshots.length} 页，共 ${allContacts.length} 个联系人/群`,
      ``,
    ];

    if (unreadContacts.length > 0) {
      reportLines.push(`📬 未读消息 (${unreadContacts.length} 个):`);
      for (const c of unreadContacts) {
        const tags: string[] = [];
        if (c.unread_count > 0) tags.push(`${c.unread_count}条`);
        if (c.mentioned) tags.push("@我");
        if (c.alerts.length > 0) tags.push(`⚠️${c.alerts.join(",")}`);
        reportLines.push(
          `  - ${c.name} [${tags.join(" | ")}] ${c.preview ? `"${c.preview}"` : ""}`,
        );
      }
    } else {
      reportLines.push("✅ 无未读消息");
    }

    if (mentionedContacts.length > 0) {
      reportLines.push(``);
      reportLines.push(`🔔 @我 (${mentionedContacts.length} 个) — 需优先处理:`);
      for (const c of mentionedContacts) {
        reportLines.push(`  - ${c.name}: "${c.preview}"`);
      }
    }

    if (alertContacts.length > 0) {
      reportLines.push(``);
      reportLines.push(`⚠️ 关键词告警 (${alertContacts.length} 个):`);
      for (const c of alertContacts) {
        reportLines.push(`  - ${c.name}: [${c.alerts.join(", ")}] "${c.preview}"`);
      }
    }

    reportLines.push(``);
    reportLines.push(log.join("\n"));

    return {
      content: [{ type: "text", text: reportLines.join("\n") }],
      details: {
        status: "ok",
        totalContacts: allContacts.length,
        unreadCount: unreadContacts.length,
        mentionedCount: mentionedContacts.length,
        alertCount: alertContacts.length,
        contacts: allContacts,
        unreadContacts: unreadContacts.map((c) => c.name),
        mentionedContacts: mentionedContacts.map((c) => c.name),
        alertContacts: alertContacts.map((c) => ({ name: c.name, alerts: c.alerts })),
        screenshotPaths: sidebarPaths,
        log,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`巡检异常: ${msg}`, log);
  }
}

// ─── Tool Factory ───────────────────────────────────────────────────

export function createWeComPatrolTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "wecom_patrol",
    label: "WeCom Patrol",
    description: [
      "企业微信巡检: 扫描侧边栏未读消息 + @我检测 + 关键词告警。",
      "",
      "功能:",
      "  - 截图侧边栏 + Vision分析识别未读气泡/红点",
      "  - @我消息检测 (优先处理)",
      "  - 关键词告警 (紧急/bug/投诉/退款等)",
      "  - 返回结构化巡检报告",
      "",
      "示例:",
      "  wecom_patrol({})                              -- 默认巡检2页",
      "  wecom_patrol({scroll_pages: 5})               -- 扫描5页",
      '  wecom_patrol({alert_keywords: ["紧急","P0"]}) -- 自定义告警关键词',
    ].join("\n"),
    parameters: Schema,
    execute: (id, args) => executeWeComPatrol(id, args as Record<string, unknown>),
  };
}
