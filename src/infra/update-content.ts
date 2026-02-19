/**
 * Update Content — 获取和格式化更新内容
 *
 * 从 latest.json 的 changelog 字段中提取更新内容，
 * 用于在 CLI 或 UI 中展示"更新了什么"。
 *
 * 与 installer-updater.ts 的 UpdateServerLatest 类型配合使用。
 */

import type { UpdateServerLatest } from "./installer-updater.js";

// ─── Types ─────────────────────────────────────────────

export interface UpdateContent {
  version: string;
  releaseDate?: string;
  changelog: string; // markdown format
  categories: UpdateCategory[];
  summary: string; // one-line summary
}

export interface UpdateCategory {
  name: string;
  items: string[];
}

// ─── Core ──────────────────────────────────────────────

/**
 * 从 UpdateServerLatest 中提取结构化的更新内容
 */
export function extractUpdateContent(
  latest: UpdateServerLatest,
  locale: "zh-CN" | "en-US" = "zh-CN",
): UpdateContent {
  const rawChangelog = latest.changelog?.[locale] || latest.changelog?.["zh-CN"] || "";

  const categories = parseChangelogCategories(rawChangelog);
  const summary = generateSummary(categories);

  return {
    version: latest.version,
    releaseDate: latest.buildTime,
    changelog: rawChangelog,
    categories,
    summary,
  };
}

/**
 * 解析 markdown changelog 为结构化类别
 */
function parseChangelogCategories(changelog: string): UpdateCategory[] {
  const categories: UpdateCategory[] = [];
  let currentCategory: UpdateCategory | null = null;

  for (const line of changelog.split("\n")) {
    // Category header: ### 新功能
    const categoryMatch = line.match(/^###\s+(.+)/);
    if (categoryMatch) {
      if (currentCategory && currentCategory.items.length > 0) {
        categories.push(currentCategory);
      }
      currentCategory = { name: categoryMatch[1].trim(), items: [] };
      continue;
    }

    // Item: - title — description  or  - description
    const itemMatch = line.match(/^-\s+(.+)/);
    if (itemMatch && currentCategory) {
      currentCategory.items.push(itemMatch[1].trim());
    }
  }

  if (currentCategory && currentCategory.items.length > 0) {
    categories.push(currentCategory);
  }

  return categories;
}

/**
 * 生成一行摘要（用于通知标题等场景）
 */
function generateSummary(categories: UpdateCategory[]): string {
  const counts: string[] = [];
  for (const cat of categories) {
    if (cat.items.length > 0) {
      counts.push(`${cat.items.length} 项${cat.name}`);
    }
  }
  return counts.length > 0 ? counts.join("、") : "版本更新";
}

/**
 * 格式化为终端输出（带 ANSI 颜色）
 */
export function formatUpdateContentForTerminal(content: UpdateContent): string {
  const lines: string[] = [];

  lines.push(`\x1b[1m\x1b[36mv${content.version} 更新内容\x1b[0m`);
  lines.push("");

  for (const category of content.categories) {
    lines.push(`\x1b[1m${category.name}\x1b[0m`);
    for (const item of category.items) {
      lines.push(`  - ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * 格式化为纯文本（无颜色，适合日志或消息发送）
 */
export function formatUpdateContentPlainText(content: UpdateContent): string {
  const lines: string[] = [];

  lines.push(`v${content.version} 更新内容`);
  lines.push("");

  for (const category of content.categories) {
    lines.push(`[${category.name}]`);
    for (const item of category.items) {
      lines.push(`  - ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
