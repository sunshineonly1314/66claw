/**
 * 分类映射 + CN 状态计算
 *
 * 10 大类定义，Qwen 中文分类名到 CategoryId 的映射（含别名模糊匹配），
 * 以及 CN 三级可用性计算。
 */

import type { CategoryId, CategoryDef, CnStatus } from "./types.js";

// ============================================================================
// 10 大类定义
// ============================================================================

export const CATEGORY_DEFS: CategoryDef[] = [
  { id: "dev", nameZh: "开发工具", nameEn: "Development", emoji: "🛠️" },
  { id: "productivity", nameZh: "生产力工具", nameEn: "Productivity", emoji: "📋" },
  { id: "media", nameZh: "多媒体", nameEn: "Media", emoji: "🎬" },
  { id: "comm", nameZh: "通信协作", nameEn: "Communication", emoji: "💬" },
  { id: "ai", nameZh: "AI 工具", nameEn: "AI Tools", emoji: "🤖" },
  { id: "smarthome", nameZh: "智能家居", nameEn: "Smart Home", emoji: "🏠" },
  { id: "security", nameZh: "安全工具", nameEn: "Security", emoji: "🔒" },
  { id: "data", nameZh: "数据工具", nameEn: "Data Tools", emoji: "📊" },
  { id: "content", nameZh: "内容管理", nameEn: "Content", emoji: "📝" },
  { id: "system", nameZh: "系统工具", nameEn: "System", emoji: "⚙️" },
];

// ============================================================================
// Qwen 中文分类 → CategoryId 映射（含别名）
// ============================================================================

/**
 * 精确匹配表：Qwen 输出的各种中文分类名 → CategoryId
 *
 * 来源：27 个 accepted skills 的实际 Qwen 输出 + Layer3 prompt 中的 10 个标准分类名
 */
const EXACT_MAP: Record<string, CategoryId> = {
  // === dev ===
  "开发工具": "dev",
  "开发者工具": "dev",
  "编程工具": "dev",
  "编程辅助": "dev",
  "代码工具": "dev",

  // === productivity ===
  "生产力工具": "productivity",
  "效率工具": "productivity",
  "办公工具": "productivity",

  // === media ===
  "多媒体": "media",
  "多媒体工具": "media",
  "多媒体处理": "media",
  "多媒体控制": "media",
  "媒体控制": "media",
  "音频处理": "media",
  "语音处理": "media",
  "语音合成": "media",
  "视频处理": "media",
  "图像处理": "media",

  // === comm ===
  "通信协作": "comm",
  "通信与协作": "comm",
  "协作工具集成": "comm",
  "消息通道插件": "comm",
  "通信": "comm",
  "即时通讯": "comm",

  // === ai ===
  "AI 工具": "ai",
  "AI工具": "ai",
  "AI图像生成": "ai",
  "AI模型": "ai",

  // === smarthome ===
  "智能家居": "smarthome",
  "IoT": "smarthome",

  // === security ===
  "安全工具": "security",
  "安全与密钥管理": "security",
  "密钥管理": "security",

  // === data ===
  "数据工具": "data",
  "数据服务": "data",
  "数据查询": "data",
  "信息服务": "data",

  // === content ===
  "内容管理": "content",
  "内容监控": "content",
  "文档处理": "content",
  "博客管理": "content",

  // === system ===
  "系统工具": "system",
  "工具": "system",
  "运维工具": "system",
  "部署工具": "system",
};

/**
 * 关键词回退表：当精确匹配失败时，用关键词匹配
 */
const KEYWORD_FALLBACK: Array<{ keywords: string[]; category: CategoryId }> = [
  { keywords: ["开发", "编程", "代码", "IDE", "CI", "构建"], category: "dev" },
  { keywords: ["生产力", "笔记", "待办", "日历", "邮件", "办公"], category: "productivity" },
  { keywords: ["多媒体", "音频", "视频", "图像", "语音", "媒体", "播放"], category: "media" },
  { keywords: ["通信", "协作", "消息", "聊天", "通讯"], category: "comm" },
  { keywords: ["AI", "模型", "生成", "翻译"], category: "ai" },
  { keywords: ["智能家居", "IoT", "设备"], category: "smarthome" },
  { keywords: ["安全", "密钥", "密码", "加密"], category: "security" },
  { keywords: ["数据", "天气", "财经", "查询", "API"], category: "data" },
  { keywords: ["内容", "博客", "文档", "CMS", "RSS", "监控"], category: "content" },
  { keywords: ["系统", "运维", "部署", "打包"], category: "system" },
];

// ============================================================================
// 公开函数
// ============================================================================

/**
 * 将 Qwen 输出的中文分类名标准化为 CategoryId
 *
 * 匹配优先级：
 * 1. 精确匹配 EXACT_MAP
 * 2. 关键词匹配 KEYWORD_FALLBACK
 * 3. 兜底返回 "system"
 */
export function normalizeCategoryZh(raw: string): CategoryId {
  const trimmed = raw.trim();

  // 1. 精确匹配
  if (trimmed in EXACT_MAP) {
    return EXACT_MAP[trimmed];
  }

  // 2. 关键词匹配
  for (const { keywords, category } of KEYWORD_FALLBACK) {
    if (keywords.some((kw) => trimmed.includes(kw))) {
      return category;
    }
  }

  // 3. 兜底
  console.warn(`  ⚠ 未知分类 "${trimmed}"，归入 system`);
  return "system";
}

/**
 * 根据 CategoryId 获取中文分类名
 */
export function getCategoryZh(id: CategoryId): string {
  const def = CATEGORY_DEFS.find((d) => d.id === id);
  return def?.nameZh ?? "系统工具";
}

/**
 * 计算 CN 三级可用性
 *
 * @param cnBlocked - Layer3 输出的 cn_blocked 布尔值
 * @param cnCompatibility - Layer3 输出的 cn_compatibility 评分 (1-10)
 */
export function computeCnStatus(
  cnBlocked: boolean,
  cnCompatibility: number,
): CnStatus {
  if (cnBlocked) return "cn-blocked";
  if (cnCompatibility >= 8) return "cn-native";
  return "cn-proxy";
}
