#!/usr/bin/env node
/**
 * 生成 Bundled Skills 索引文件
 * 
 * 用于安装包打包时生成 skills-index.json，
 * 使 WebUI 技能市场页面无需网络请求即可显示技能列表。
 * 
 * 用法：
 *   node scripts/generate-bundled-skills-index.mjs [options]
 * 
 * 选项：
 *   --source <dir>   Skills 源目录 (默认: clawdhub-skills-mirror/cn/skills)
 *   --output <file>  输出文件路径 (默认: build/bundled-skills/skills-index.json)
 *   --verbose        显示详细日志
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

// 默认配置
const DEFAULT_SOURCE = path.join(ROOT_DIR, "clawdhub-skills-mirror", "cn", "skills");
const DEFAULT_OUTPUT = path.join(ROOT_DIR, "build", "bundled-skills", "skills-index.json");

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    source: DEFAULT_SOURCE,
    output: DEFAULT_OUTPUT,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      options.source = path.resolve(args[++i]);
    } else if (args[i] === "--output" && args[i + 1]) {
      options.output = path.resolve(args[++i]);
    } else if (args[i] === "--verbose" || args[i] === "-v") {
      options.verbose = true;
    }
  }

  return options;
}

/**
 * 解析 SKILL.md 的 YAML frontmatter
 */
function parseSkillMd(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const meta = {};

  // 简单的 YAML 解析
  const lines = yaml.split("\n");
  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // 去除引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // 处理数组（简单的 YAML 数组）
    if (value.startsWith("[") && value.endsWith("]")) {
      try {
        meta[key] = JSON.parse(value);
      } catch {
        meta[key] = value.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, ""));
      }
    } else {
      meta[key] = value;
    }
  }

  return meta;
}

/**
 * 从 SKILL.md 提取描述（frontmatter 之后的第一段）
 */
function extractDescription(content, meta) {
  // 如果 frontmatter 中有 description，直接使用
  if (meta.description) {
    return meta.description;
  }

  // 否则提取 frontmatter 之后的第一段
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n*/, "");
  const lines = withoutFrontmatter.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过空行和标题
    if (!trimmed || trimmed.startsWith("#")) continue;
    // 返回第一段非空内容
    return trimmed.slice(0, 200); // 限制长度
  }

  return "";
}

/**
 * 扫描并生成索引
 */
async function generateIndex(options) {
  const { source, output, verbose } = options;

  if (!fs.existsSync(source)) {
    console.error(`❌ 源目录不存在: ${source}`);
    process.exit(1);
  }

  console.log(`📂 扫描 Skills 目录: ${source}`);

  const skills = [];
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(source, entry.name);
    const skillMdPath = path.join(skillDir, "SKILL.md");

    // 也支持小写的 skill.md
    const skillMdPathLower = path.join(skillDir, "skill.md");
    const actualPath = fs.existsSync(skillMdPath) ? skillMdPath : 
                       fs.existsSync(skillMdPathLower) ? skillMdPathLower : null;

    if (!actualPath) {
      if (verbose) console.log(`  ⚠️ 跳过 ${entry.name} (无 SKILL.md)`);
      continue;
    }

    try {
      const content = fs.readFileSync(actualPath, "utf-8");
      const meta = parseSkillMd(content);
      const description = extractDescription(content, meta);

      const skill = {
        name: entry.name,
        description: description || meta.name || entry.name,
        emoji: meta.emoji || "📦",
        path: entry.name,
        version: meta.version || "1.0.0",
        tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : []),
        author: meta.author || "Community",
      };

      skills.push(skill);

      if (verbose) {
        console.log(`  ✅ ${skill.emoji} ${skill.name}`);
      }
    } catch (err) {
      console.warn(`  ⚠️ 解析失败 ${entry.name}: ${err.message}`);
    }
  }

  // 按名称排序
  skills.sort((a, b) => a.name.localeCompare(b.name));

  // 生成索引对象 (LocalSkillsIndex 格式)
  const index = {
    schemaVersion: 1,
    lastSyncedAt: new Date().toISOString(),
    sourceUrl: "bundled",
    remote: skills,
    installed: [], // 安装时会动态更新
  };

  // 确保输出目录存在
  const outputDir = path.dirname(output);
  fs.mkdirSync(outputDir, { recursive: true });

  // 写入文件
  fs.writeFileSync(output, JSON.stringify(index, null, 2), "utf-8");

  console.log(`\n✅ 索引生成完成!`);
  console.log(`   Skills 数量: ${skills.length}`);
  console.log(`   输出文件: ${output}`);
  console.log(`   文件大小: ${(fs.statSync(output).size / 1024).toFixed(1)} KB`);

  return { skills, index };
}

/**
 * 同时生成 index.json (RemoteSkillsIndex 格式，兼容旧逻辑)
 */
function generateLegacyIndex(skills, outputDir) {
  const legacyIndex = {
    version: 1,
    updated: new Date().toISOString(),
    skills: skills,
  };

  const legacyPath = path.join(outputDir, "index.json");
  fs.writeFileSync(legacyPath, JSON.stringify(legacyIndex, null, 2), "utf-8");
  console.log(`   兼容索引: ${legacyPath}`);
}

// 主函数
async function main() {
  console.log("🔧 Bundled Skills 索引生成器\n");

  const options = parseArgs();
  const { skills } = await generateIndex(options);

  // 生成兼容的 index.json
  generateLegacyIndex(skills, path.dirname(options.output));

  console.log("\n💡 使用方法:");
  console.log("   1. 将 build/bundled-skills/ 目录打包进安装程序");
  console.log("   2. 设置环境变量 CLAWDBOT_BUNDLED_SKILLS_DIR 指向 skills 子目录");
  console.log("   3. skills-index.json 放在 CLAWDBOT_BUNDLED_SKILLS_DIR 同级或父级目录");
}

main().catch((err) => {
  console.error("❌ 生成失败:", err.message);
  process.exit(1);
});
