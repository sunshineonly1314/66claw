/**
 * WeCom Customer Service Configuration
 *
 * 企业微信智能客服配置:
 * - AI 人设 (persona)
 * - 知识库 (knowledge base)
 * - 防检测 (anti-detection)
 * - Kimi Code API 连接配置
 */

import fs from "node:fs";

// ─── Kimi Code API ──────────────────────────────────────────────────

export const KIMI_API_BASE = process.env.KIMI_API_BASE || "https://api.kimi.com/coding/v1";
export const KIMI_API_KEY = process.env.KIMI_API_KEY || "";
export const KIMI_MODEL = process.env.KIMI_MODEL || "kimi-for-coding";
export const KIMI_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "KimiCLI/0.77",
} as const;

// ─── Ollama Vision ──────────────────────────────────────────────────

export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
export const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "qwen2.5vl:7b";

// ─── AI Persona (人设) ──────────────────────────────────────────────

/**
 * 默认客服人设。可通过 WECOM_CS_PERSONA 环境变量覆盖。
 *
 * 人设要点:
 * - 名字、身份、性格
 * - 回复风格 (口语化、简短)
 * - 不能做的事 (不承诺、不给敏感信息)
 * - 转人工条件
 */
export const DEFAULT_PERSONA = `你是"小克"，一个友好、专业的企业微信客服助手。

## 基本信息
- 名字: 小克
- 角色: 技术支持客服
- 性格: 热情、耐心、专业，偶尔带点幽默

## 回复风格
- 像同事微信聊天一样自然，不要太正式
- 回复简短 (1-3句话)，不写长篇大论
- 不使用 markdown 格式
- 适当使用语气词 (嗯、哈、呢)
- 可以用少量表情但不要太多

## 禁止事项
- 不承诺具体时间节点 (如"明天修好")
- 不透露内部系统信息
- 不讨论薪资、人事、机密信息
- 遇到投诉、纠纷、法律问题，回复 "[转人工]" 并安抚用户

## 转人工条件
当用户提到以下内容时，回复中必须包含 "[转人工]":
- 投诉、举报、退款
- 法律、合同纠纷
- 连续3次表示不满
- 你无法回答的专业问题`;

export function getPersona(): string {
  return process.env.WECOM_CS_PERSONA || DEFAULT_PERSONA;
}

// ─── Knowledge Base (知识库) ────────────────────────────────────────

/**
 * 知识库条目。
 * 每个条目包含关键词列表和对应的参考内容。
 * 当用户消息匹配关键词时，对应内容会被注入到 system prompt 中。
 */
export interface KnowledgeEntry {
  /** 匹配关键词 (任一匹配即命中) */
  keywords: string[];
  /** 分类标签 */
  category: string;
  /** 参考内容 (注入到 system prompt) */
  content: string;
}

/**
 * 默认知识库。可通过 WECOM_CS_KB_PATH 环境变量指向 JSON 文件覆盖。
 *
 * JSON 文件格式:
 * ```json
 * [
 *   {
 *     "keywords": ["价格", "多少钱", "收费"],
 *     "category": "pricing",
 *     "content": "我们的产品定价如下: ..."
 *   }
 * ]
 * ```
 */
const DEFAULT_KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    keywords: ["bug", "报错", "错误", "崩溃", "闪退", "异常", "出错"],
    category: "bug_report",
    content: `用户反馈了Bug。请按以下步骤处理:
1. 先确认具体的错误信息或截图
2. 询问复现步骤: 什么操作导致的？
3. 询问环境: 什么系统/浏览器/版本？
4. 告知用户已记录，会尽快排查
5. 如果是已知问题，给出临时解决方案`,
  },
  {
    keywords: ["怎么用", "怎么操作", "教程", "使用方法", "指南", "帮助"],
    category: "usage_guide",
    content: `用户需要使用帮助。请:
1. 先确认用户想了解哪个功能
2. 用简单口语化的步骤引导
3. 如果有文档链接可以分享
4. 确认用户是否理解`,
  },
  {
    keywords: ["价格", "多少钱", "收费", "费用", "套餐", "订阅", "会员"],
    category: "pricing",
    content: `关于价格问题:
- 建议引导用户查看官方定价页面
- 不要承诺折扣或特殊价格
- 企业定制需求请转给商务团队`,
  },
  {
    keywords: ["功能", "需求", "建议", "希望", "能不能", "支持"],
    category: "feature_request",
    content: `用户提出了功能需求/建议。请:
1. 感谢用户的反馈
2. 确认具体的使用场景
3. 告知已记录需求，会反馈给产品团队
4. 如果有替代方案，可以推荐`,
  },
  {
    keywords: ["账号", "登录", "密码", "注册", "绑定", "验证码"],
    category: "account",
    content: `账号相关问题:
- 登录问题先确认账号和密码是否正确
- 忘记密码引导用户使用找回功能
- 账号被锁定需要联系管理员
- 涉及安全问题请转人工`,
  },
  {
    keywords: ["投诉", "不满", "差评", "退款", "赔偿"],
    category: "complaint",
    content: `用户投诉。必须回复 "[转人工]"。
同时安抚用户: 表示理解、道歉、承诺会认真处理。`,
  },
];

/**
 * 加载知识库。
 * 优先从 WECOM_CS_KB_PATH 环境变量指定的 JSON 文件加载,
 * 否则使用默认知识库。
 */
export function loadKnowledgeBase(): KnowledgeEntry[] {
  const kbPath = process.env.WECOM_CS_KB_PATH;
  if (kbPath) {
    try {
      const raw = fs.readFileSync(kbPath, "utf-8");
      const entries = JSON.parse(raw) as KnowledgeEntry[];
      if (Array.isArray(entries) && entries.length > 0) {
        return entries;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[wecom-cs] Failed to load KB from ${kbPath}: ${msg}, using default`);
    }
  }
  return DEFAULT_KNOWLEDGE_BASE;
}

/**
 * 根据用户消息匹配知识库条目，返回相关内容。
 */
export function matchKnowledge(userMessage: string, kb?: KnowledgeEntry[]): string {
  const entries = kb ?? loadKnowledgeBase();
  const lowerMsg = userMessage.toLowerCase();
  const matched: KnowledgeEntry[] = [];

  for (const entry of entries) {
    if (entry.keywords.some((kw) => lowerMsg.includes(kw.toLowerCase()))) {
      matched.push(entry);
    }
  }

  if (matched.length === 0) return "";

  return matched.map((e) => `【${e.category}】${e.content}`).join("\n\n");
}

/**
 * 构建完整的 system prompt:  人设 + 匹配到的知识库内容
 */
export function buildSystemPrompt(userMessage: string): string {
  const persona = getPersona();
  const knowledge = matchKnowledge(userMessage);

  let prompt = persona;

  if (knowledge) {
    prompt += `\n\n## 参考知识库 (根据用户问题匹配)\n\n${knowledge}`;
  }

  prompt +=
    '\n\n## 重要提醒\n- 只根据知识库内容回答，不要编造信息\n- 不确定的问题说"我帮你确认一下"而不是乱答\n- 回复不要使用 markdown 格式';

  return prompt;
}

// ─── Anti-Detection Config ──────────────────────────────────────────

export interface WeComCSAntiDetectionConfig {
  replyDelayMin: number;
  replyDelayMax: number;
  maxRepliesPerHour: number;
  maxRepliesPerDay: number;
  typingDelayPer100Chars: number;
  quietHours: { start: string; end: string };
  blacklistKeywords: string[];
}

export const DEFAULT_ANTI_DETECTION: WeComCSAntiDetectionConfig = {
  replyDelayMin: 2,
  replyDelayMax: 8,
  maxRepliesPerHour: 30,
  maxRepliesPerDay: 100,
  typingDelayPer100Chars: 2,
  quietHours: { start: "00:00", end: "07:00" },
  blacklistKeywords: ["测试", "test", "机器人", "bot", "自动回复"],
};

/**
 * 检查消息是否包含黑名单关键词
 */
export function containsBlacklistKeyword(
  text: string,
  config?: WeComCSAntiDetectionConfig,
): boolean {
  const cfg = config ?? DEFAULT_ANTI_DETECTION;
  const lower = text.toLowerCase();
  return cfg.blacklistKeywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * 检查当前是否在静默时段
 */
export function isQuietHours(config?: WeComCSAntiDetectionConfig): boolean {
  const cfg = config ?? DEFAULT_ANTI_DETECTION;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = cfg.quietHours.start.split(":").map(Number);
  const [endH, endM] = cfg.quietHours.end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * 计算模拟打字延迟 (毫秒)
 */
export function calculateTypingDelay(
  replyText: string,
  config?: WeComCSAntiDetectionConfig,
): number {
  const cfg = config ?? DEFAULT_ANTI_DETECTION;
  const baseDelay = cfg.replyDelayMin + Math.random() * (cfg.replyDelayMax - cfg.replyDelayMin);
  const typingDelay = (replyText.length / 100) * cfg.typingDelayPer100Chars;
  const totalMs = (baseDelay + typingDelay) * 1000;
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.floor(totalMs * jitter);
}
