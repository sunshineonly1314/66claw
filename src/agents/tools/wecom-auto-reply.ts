/**
 * WeCom (企业微信) composite tool: `wecom_auto_reply`
 *
 * 一键智能客服: 读取消息 → 知识库匹配 → AI 生成回复 → 防检测延迟 → 发送
 *
 * 完整流程:
 *   1. 预检: KIMI_API_KEY + 静默时段 + 人工接管 + 去重
 *   2. 聚焦企业微信 → 搜索联系人 → 打开聊天窗口
 *   3. 截图 → Ollama qwen2.5vl:7b 视觉模型提取消息
 *   4. 提取对方最后一条消息
 *   5. 知识库关键词匹配 → 注入 system prompt
 *   6. Kimi Code API 生成自然回复 (含人设)
 *   7. 防检测: 黑名单/静默时段/打字延迟
 *   8. [转人工] 检测 → 自动加入接管列表
 *   9. 发送回复 + 记录去重
 *
 * 环境变量:
 *   KIMI_API_KEY         - Kimi Code API Key (必填)
 *   KIMI_API_BASE        - API 基础 URL (默认: https://api.kimi.com/coding/v1)
 *   KIMI_MODEL           - 模型名 (默认: kimi-for-coding)
 *   OLLAMA_BASE_URL      - Ollama 地址 (默认: http://localhost:11434)
 *   OLLAMA_VISION_MODEL  - 视觉模型 (默认: qwen2.5vl:7b)
 *   WECOM_CS_PERSONA     - 自定义人设 (覆盖默认)
 *   WECOM_CS_KB_PATH     - 自定义知识库 JSON 文件路径
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
  clickAt,
  typeText,
  sendKey,
  screenshotToFile,
  analyzeScreenshot,
  generateReplyWithKimi,
  extractLastOtherMessage,
  isDuplicate,
  recordReply,
  invalidateVisionCache,
  fail,
} from "./wecom-helpers.js";
import {
  KIMI_API_KEY,
  containsBlacklistKeyword,
  isQuietHours,
  calculateTypingDelay,
} from "./wecom-cs-config.js";
import { isHandoff, addHandoff } from "./wecom-handoff.js";

// ─── Schema ─────────────────────────────────────────────────────────

const WeComAutoReplySchema = Type.Object({
  contact: Type.String({
    description: "联系人或群名称 (企业微信中的显示名)",
  }),
  count: Type.Optional(
    Type.Number({
      description: "读取最近几条消息用于上下文理解 (默认: 5)",
      minimum: 1,
      maximum: 20,
    }),
  ),
  dry_run: Type.Optional(
    Type.Boolean({
      description: "试运行模式: 只生成回复但不实际发送 (默认: false)",
    }),
  ),
});

// ─── Main Execute ───────────────────────────────────────────────────

async function executeWeComAutoReply(
  _toolCallId: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const contact = readStringParam(args, "contact", { required: true });
  const count = readNumberParam(args, "count") ?? 5;
  const dryRun = args.dry_run === true;
  const log: string[] = [];

  try {
    // ── Step 0: Pre-flight checks ──
    if (!KIMI_API_KEY) {
      return fail("KIMI_API_KEY 未设置。请设置环境变量后重试。", log);
    }

    if (isQuietHours()) {
      return fail("当前处于静默时段 (00:00-07:00)，不自动回复。", log);
    }
    log.push("✓ 防检测: 非静默时段");

    // ── Step 0.1: Handoff check ──
    if (isHandoff(contact)) {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ "${contact}" 已由人工接管，跳过自动回复。\n\n如需恢复 AI 回复，请使用: wecom_handoff({action:"remove", contact:"${contact}"})`,
          },
        ],
        details: { status: "handoff", contact, log },
      };
    }
    log.push("✓ 人工接管检查: 未接管");

    // ── Step 0.2: Dedup check ──
    if (!dryRun && isDuplicate(contact, 60000)) {
      return {
        content: [
          {
            type: "text",
            text: `ℹ️ 已在 60 秒内回复过 "${contact}"，跳过防止重复回复。`,
          },
        ],
        details: { status: "dedup", contact, log },
      };
    }
    log.push("✓ 去重检查: 无重复");

    // ── Step 1: Find and focus WeCom window ──
    const wc = await focusWeComWindow(log);
    if (!wc) return fail("企业微信窗口未找到，请确认已启动。", log);

    // ── Step 2: Search and open contact ──
    if (!(await searchAndOpenContact(contact, wc.layout, log))) {
      return fail(`搜索联系人 "${contact}" 失败`, log);
    }

    // Re-focus before screenshot
    focus(wc.win.title);
    await sleep(300);

    // ── Step 3: Screenshot and vision analysis (with cache) ──
    const ss = screenshotToFile(wc.win.title);
    if (!ss.ok) return fail("截图失败", log);
    log.push(`✓ 截图: ${ss.path} (${ss.base64.length} chars b64)`);

    const visionPrompt = `请分析这张企业微信聊天窗口截图，提取最近的 ${count} 条消息。
对每条消息提取: sender(发送者，自己发的标记为"我"), content(内容), time(时间)。
按时间顺序返回 JSON:
{"contact":"聊天对象","messages":[{"sender":"张三","content":"你好","time":"14:30"}]}`;

    let visionResult: string;
    try {
      visionResult = await analyzeScreenshot(ss.base64, visionPrompt, {
        contactName: contact,
      });
      log.push(`✓ Vision 分析完成 (${visionResult.length} chars)`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return fail(`Vision 分析失败: ${errMsg}`, log);
    }

    // ── Step 4: Extract last message from other party ──
    const lastMessage = extractLastOtherMessage(visionResult);
    if (!lastMessage) {
      return {
        content: [
          {
            type: "text",
            text: `ℹ️ 未检测到对方新消息，无需回复。\n\nVision 结果:\n${visionResult}\n\n${log.join("\n")}`,
          },
        ],
        details: { status: "no_new_message", contact, visionResult, log },
      };
    }
    log.push(
      `✓ 对方最新消息: "${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? "..." : ""}"`,
    );

    // ── Step 5: Anti-detection: blacklist check ──
    if (containsBlacklistKeyword(lastMessage)) {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ 消息包含黑名单关键词，跳过自动回复。\n\n消息: "${lastMessage}"\n\n${log.join("\n")}`,
          },
        ],
        details: { status: "blacklisted", contact, lastMessage, log },
      };
    }
    log.push("✓ 防检测: 无黑名单关键词");

    // ── Step 6: Generate AI reply with knowledge base + persona ──
    let aiReply: string;
    try {
      aiReply = await generateReplyWithKimi(lastMessage);
      log.push(`✓ AI 回复: "${aiReply.substring(0, 50)}${aiReply.length > 50 ? "..." : ""}"`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return fail(`AI 回复生成失败: ${errMsg}`, log);
    }

    // ── Step 7: Check for [转人工] tag → auto handoff ──
    const needHumanHandoff = aiReply.includes("[转人工]");
    if (needHumanHandoff) {
      addHandoff(contact, `AI 检测到需转人工 — 消息: "${lastMessage.substring(0, 50)}"`, true);
      log.push("⚠️ AI 建议转人工 → 已自动加入接管列表");
    }

    // ── Dry run: stop here ──
    if (dryRun) {
      return {
        content: [
          {
            type: "text",
            text: [
              `🧪 试运行完成 (未实际发送)`,
              ``,
              `联系人: ${contact}`,
              `对方消息: "${lastMessage}"`,
              `AI 回复: "${aiReply}"`,
              needHumanHandoff ? `⚠️ 建议转人工 (已加入接管列表)` : "",
              ``,
              `Vision 结果:`,
              visionResult,
              ``,
              log.join("\n"),
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        details: {
          status: "dry_run",
          contact,
          lastMessage,
          aiReply,
          needHumanHandoff,
          visionResult,
          log,
        },
      };
    }

    // ── Step 8: Typing delay simulation ──
    const delayMs = calculateTypingDelay(aiReply);
    log.push(`✓ 模拟打字延迟: ${Math.round(delayMs / 1000)}s`);
    await sleep(delayMs);

    // ── Step 9: Send reply ──
    // Re-focus WeCom window (may have lost focus during delay)
    focus(wc.win.title);
    await sleep(500);

    // Click input box
    clickAt(wc.layout.chatCenterX, wc.layout.inputBoxY);
    log.push(`✓ 点击输入框`);
    await sleep(500);

    // Type message
    if (!typeText(aiReply)) {
      return fail("输入回复消息失败", log);
    }
    log.push("✓ 输入回复消息");
    await sleep(400);

    // Send with Enter
    sendKey("{ENTER}");
    log.push("✓ 按 Enter 发送");
    await sleep(600);

    // ── Step 10: Record reply for dedup + invalidate cache ──
    recordReply(contact);
    invalidateVisionCache(contact);
    log.push("✓ 记录回复 (去重追踪)");

    // ── Step 11: Verification screenshot ──
    const verifySs = screenshotToFile(wc.win.title);
    if (verifySs.ok) {
      log.push(`✓ 验证截图: ${verifySs.path}`);
    }

    return {
      content: [
        {
          type: "text",
          text: [
            `✅ 智能回复完成`,
            ``,
            `联系人: ${contact}`,
            `对方消息: "${lastMessage}"`,
            `AI 回复: "${aiReply}"`,
            needHumanHandoff ? `⚠️ AI 建议转人工，已发送安抚消息并加入接管列表` : "",
            `打字延迟: ${Math.round(delayMs / 1000)}s`,
            ``,
            log.join("\n"),
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      details: {
        status: "ok",
        contact,
        lastMessage,
        aiReply,
        needHumanHandoff,
        delayMs,
        screenshotPath: ss.path,
        verifyPath: verifySs.ok ? verifySs.path : undefined,
        log,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`智能回复异常: ${msg}`, log);
  }
}

// ─── Tool factory ───────────────────────────────────────────────────

export function createWeComAutoReplyTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;

  return {
    name: "wecom_auto_reply",
    label: "WeCom Auto Reply",
    description: [
      "企业微信智能客服一键回复。",
      "自动完成: 读取消息 → 知识库匹配 → AI生成回复 → 防检测延迟 → 发送。",
      "",
      "功能特性:",
      "  - Ollama qwen2.5vl:7b 视觉识别聊天截图",
      "  - 知识库关键词匹配 (bug/产品/价格/账号等)",
      "  - Kimi Code API 生成自然口语化回复",
      '  - AI 人设: 友好专业的客服助手"小克"',
      "  - 防检测: 黑名单过滤 + 静默时段 + 打字延迟模拟",
      "  - 人工接管: 检测 [转人工] 自动加入接管列表",
      "  - 去重: 60秒内不重复回复同一联系人",
      "  - 支持 dry_run 试运行模式",
      "",
      "环境变量 (必填):",
      "  KIMI_API_KEY - Kimi Code API Key",
      "",
      "示例:",
      '  wecom_auto_reply({contact: "张三"})                -- 读取并自动回复',
      '  wecom_auto_reply({contact: "项目群", count: 10})   -- 读取10条上下文',
      '  wecom_auto_reply({contact: "客户A", dry_run: true}) -- 试运行不发送',
    ].join("\n"),
    parameters: WeComAutoReplySchema,
    execute: (toolCallId, args) =>
      executeWeComAutoReply(toolCallId, args as Record<string, unknown>),
  };
}
