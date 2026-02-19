/**
 * WeCom (企业微信) composite tool: `wecom_read`
 *
 * One-call automation for reading messages from WeCom (企业微信):
 *   focus → search contact → click result → screenshot chat area → vision analysis
 *
 * This is a standalone tool for WeCom only. For personal WeChat (微信),
 * use `wechat_read` instead.
 *
 * Uses vision model to extract messages from screenshot.
 * Returns structured message data (sender, content, timestamp).
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

import type { AnyAgentTool } from "./common.js";
import { readStringParam, readNumberParam } from "./common.js";
import type { OpenClawCNConfig } from "../../config/config.js";
import {
  sleep,
  focus,
  focusWeComWindow,
  searchAndOpenContact,
  screenshotToFile,
  analyzeScreenshot,
  fail,
} from "./wecom-helpers.js";

// ─── Main tool implementation ───────────────────────────────────────

const WeComReadSchema = Type.Object({
  contact: Type.String({
    description: "联系人或群名称 (支持模糊匹配，会点击搜索结果第一个)",
  }),
  count: Type.Optional(
    Type.Number({
      description: "读取最近几条消息 (默认: 5，范围: 1-20)",
      minimum: 1,
      maximum: 20,
    }),
  ),
});

async function executeWeComRead(
  _toolCallId: string,
  args: Record<string, unknown>,
  options?: { config?: OpenClawCNConfig; agentDir?: string },
): Promise<AgentToolResult<unknown>> {
  const contact = readStringParam(args, "contact", { required: true });
  const count = readNumberParam(args, "count") ?? 5;
  const log: string[] = [];

  try {
    // 1. Detect and focus WeCom
    const wc = await focusWeComWindow(log);
    if (!wc) return fail("企业微信窗口未找到，请确认已启动。", log);

    // 2. Search and open contact
    if (!(await searchAndOpenContact(contact, wc.layout, log))) {
      return fail(`搜索联系人 "${contact}" 失败`, log);
    }

    // 3. Ensure WeCom is still focused before screenshot
    focus(wc.win.title);
    await sleep(300);

    // 4. Take screenshot of WeCom window
    const ss = screenshotToFile(wc.win.title);
    if (!ss.ok) return fail("截图失败", log);
    log.push(`✓ 截图: ${ss.path}`);

    // 5. Use vision to analyze screenshot (with cache + fallback)
    log.push(`✓ Vision 分析中 (请求最近 ${count} 条消息)...`);

    const visionPrompt = `请分析这张企业微信聊天窗口截图，提取最近的 ${count} 条消息。

要求:
1. 从最新的消息开始往前数 ${count} 条
2. 对于每条消息，提取以下信息:
   - sender: 发送者昵称 (如果是自己发的，标记为 "我")
   - content: 消息内容 (纯文本，如果是图片/语音/文件，标记为 [图片]/[语音]/[文件])
   - time: 时间戳 (如果可见)
3. 按时间顺序返回 (最早的在前，最新的在后)

请以 JSON 格式返回:
\`\`\`json
{
  "contact": "聊天对象名称",
  "messages": [
    {"sender": "张三", "content": "你好", "time": "14:30"},
    {"sender": "我", "content": "你好！", "time": "14:31"}
  ]
}
\`\`\`

如果截图中没有消息或无法识别，返回空的 messages 数组。`;

    let visionResult: string;
    try {
      visionResult = await analyzeScreenshot(ss.base64, visionPrompt, {
        contactName: contact,
        cfg: options?.config,
        agentDir: options?.agentDir,
      });
      log.push(`✓ Vision 分析完成 (${visionResult.length} chars)`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return fail(`Vision 分析失败: ${errMsg}`, log);
    }

    return {
      content: [
        {
          type: "text",
          text: `✅ 企业微信聊天记录读取完成 (联系人: ${contact})

调试日志:
${log.join("\n")}

Vision 分析结果:
${visionResult}`,
        },
      ],
      details: {
        status: "success",
        action: "wecom_read",
        contact,
        count,
        screenshot_path: ss.path,
        vision_result: visionResult,
        log,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`企业微信读取失败: ${msg}`, log);
  }
}

// ─── Tool factory ───────────────────────────────────────────────────

export function createWeComReadTool(options?: {
  config?: OpenClawCNConfig;
  agentDir?: string;
}): AnyAgentTool {
  return {
    name: "wecom_read",
    label: "WeCom Read",
    description: [
      "读取企业微信聊天消息。",
      "通过截图+Vision分析提取指定联系人的最近N条消息。",
      "",
      "NOTE: This is for 企业微信 (WeCom) only. For personal 微信 (WeChat), use wechat_read.",
      "",
      "工作流程:",
      "  1. 聚焦企业微信窗口",
      "  2. 搜索并打开指定联系人聊天",
      "  3. 截取聊天区域",
      "  4. 使用vision模型提取消息内容",
      "",
      "参数:",
      "  - contact: 联系人或群名称 (必填)",
      "  - count: 读取最近几条消息 (可选，默认5)",
      "",
      "示例:",
      '  wecom_read({contact: "张三", count: 10})',
      '  wecom_read({contact: "项目讨论群"})',
    ].join("\n"),
    parameters: WeComReadSchema,
    execute: (toolCallId, args) => executeWeComRead(toolCallId, args, options),
  };
}
