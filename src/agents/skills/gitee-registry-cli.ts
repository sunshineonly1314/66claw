/**
 * Gitee Skills Registry CLI Formatters
 *
 * CLI output formatting for remote skills operations
 */

import type { RemoteSkillMeta, RemoteSkillsIndex } from "./gitee-registry.js";
import { getInstalledSkills, isSkillInstalled } from "./gitee-registry.js";

// ============================================================================
// Types
// ============================================================================

export interface RemoteListOptions {
  json?: boolean;
  installed?: boolean;
  available?: boolean;
}

export interface RemoteInfoOptions {
  json?: boolean;
}

export interface RemoteInstallOptions {
  force?: boolean;
}

// ============================================================================
// Theme (inline to avoid circular deps)
// ============================================================================

const theme = {
  success: (s: string) => `\x1b[32m${s}\x1b[0m`,
  error: (s: string) => `\x1b[31m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  muted: (s: string) => `\x1b[90m${s}\x1b[0m`,
  heading: (s: string) => `\x1b[1m${s}\x1b[0m`,
  command: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

// ============================================================================
// Formatters
// ============================================================================

function formatSkillStatus(skill: RemoteSkillMeta): string {
  const installed = isSkillInstalled(skill.name);
  return installed ? theme.success("✓ 已安装") : theme.muted("○ 未安装");
}

function formatSkillName(skill: RemoteSkillMeta): string {
  const emoji = skill.emoji ?? "📦";
  return `${emoji} ${theme.command(skill.name)}`;
}

/**
 * Format remote skills list output
 */
export function formatRemoteSkillsList(
  index: RemoteSkillsIndex,
  opts: RemoteListOptions,
): string {
  let skills = index.skills;

  if (opts.installed) {
    skills = skills.filter((s) => isSkillInstalled(s.name));
  } else if (opts.available) {
    skills = skills.filter((s) => !isSkillInstalled(s.name));
  }

  if (opts.json) {
    const installed = getInstalledSkills();
    const jsonData = {
      version: index.version,
      updated: index.updated,
      skills: skills.map((s) => ({
        ...s,
        installed: installed.includes(s.name),
      })),
    };
    return JSON.stringify(jsonData, null, 2);
  }

  if (skills.length === 0) {
    if (opts.installed) {
      return "没有已安装的远程 skills。\n使用 `clawdbot skills remote install <name>` 安装 skills。";
    }
    if (opts.available) {
      return "所有远程 skills 都已安装！";
    }
    return "远程仓库中没有可用的 skills。";
  }

  const installedCount = skills.filter((s) => isSkillInstalled(s.name)).length;
  const lines: string[] = [];

  lines.push(
    `${theme.heading("远程 Skills")} ${theme.muted(`(${installedCount}/${skills.length} 已安装)`)}`,
  );
  lines.push(theme.muted(`更新时间: ${index.updated}`));
  lines.push("");

  // Table header
  lines.push(
    `${padRight("状态", 12)}${padRight("名称", 24)}${padRight("描述", 40)}${padRight("版本", 10)}`,
  );
  lines.push(theme.muted("─".repeat(86)));

  // Table rows
  for (const skill of skills) {
    const status = formatSkillStatus(skill);
    const name = formatSkillName(skill);
    const desc = skill.description.length > 38
      ? skill.description.slice(0, 35) + "..."
      : skill.description;
    const version = skill.version ?? "-";

    lines.push(
      `${padRight(status, 12)}${padRight(name, 24)}${padRight(desc, 40)}${padRight(version, 10)}`,
    );
  }

  lines.push("");
  lines.push(theme.muted("提示: 使用 `clawdbot skills remote install <name>` 安装 skill"));

  return lines.join("\n");
}

/**
 * Format single skill info
 */
export function formatRemoteSkillInfo(
  skill: RemoteSkillMeta,
  opts: RemoteInfoOptions,
): string {
  if (opts.json) {
    return JSON.stringify(
      {
        ...skill,
        installed: isSkillInstalled(skill.name),
      },
      null,
      2,
    );
  }

  const installed = isSkillInstalled(skill.name);
  const status = installed
    ? theme.success("✓ 已安装")
    : theme.muted("○ 未安装");
  const emoji = skill.emoji ?? "📦";

  const lines: string[] = [];
  lines.push(`${emoji} ${theme.heading(skill.name)} ${status}`);
  lines.push("");
  lines.push(skill.description);
  lines.push("");

  lines.push(theme.heading("详情:"));
  lines.push(`  ${theme.muted("路径:")} ${skill.path}`);
  if (skill.version) {
    lines.push(`  ${theme.muted("版本:")} ${skill.version}`);
  }
  if (skill.author) {
    lines.push(`  ${theme.muted("作者:")} ${skill.author}`);
  }
  if (skill.tags && skill.tags.length > 0) {
    lines.push(`  ${theme.muted("标签:")} ${skill.tags.join(", ")}`);
  }

  if (!installed) {
    lines.push("");
    lines.push(`${theme.warn("→")} 使用 \`clawdbot skills remote install ${skill.name}\` 安装此 skill`);
  }

  return lines.join("\n");
}

/**
 * Format install result
 */
export function formatInstallResult(
  skillName: string,
  result: { ok: true; skillDir: string; files: string[] } | { ok: false; error: string },
): string {
  if (result.ok) {
    return [
      theme.success(`✓ 成功安装 skill: ${skillName}`),
      theme.muted(`  位置: ${result.skillDir}`),
      theme.muted(`  文件数: ${result.files.length}`),
    ].join("\n");
  }
  return theme.error(`✗ 安装失败: ${result.error}`);
}

/**
 * Format remove result
 */
export function formatRemoveResult(
  skillName: string,
  result: { ok: true } | { ok: false; error: string },
): string {
  if (result.ok) {
    return theme.success(`✓ 成功移除 skill: ${skillName}`);
  }
  return theme.error(`✗ 移除失败: ${result.error}`);
}

/**
 * Format fetch error
 */
export function formatFetchError(error: string): string {
  return [
    theme.error("✗ 无法获取远程 skills 列表"),
    theme.muted(`  错误: ${error}`),
    "",
    "可能的原因:",
    "  • 网络连接问题",
    "  • Gitee 仓库不可访问",
    "  • index.json 文件不存在或格式错误",
  ].join("\n");
}

// ============================================================================
// Utilities
// ============================================================================

function padRight(str: string, len: number): string {
  // Handle ANSI escape codes by counting visible characters
  const visibleLength = str.replace(/\x1b\[[0-9;]*m/g, "").length;
  const padding = Math.max(0, len - visibleLength);
  return str + " ".repeat(padding);
}
