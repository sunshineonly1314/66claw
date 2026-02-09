#!/usr/bin/env node
/**
 * 批量下载 awesome-openclaw-skills 中的所有技能
 *
 * 策略：
 * 1. 读取 awesome-openclaw-skills README.md
 * 2. 提取所有技能的 GitHub 链接（格式：https://github.com/{owner}/{repo}/tree/{branch}/{path}）
 * 3. 批量下载 SKILL.md 文件到本地 skills-awesome/ 目录
 * 4. 保存元数据索引
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execAsync = promisify(exec);

const CONFIG = {
  awesomeReadme: "https://raw.githubusercontent.com/VoltAgent/awesome-openclaw-skills/main/README.md",
  outputDir: "./skills-awesome",
  metadataFile: "./skills-awesome/index.json",
  concurrency: 5, // 并发下载数
  timeout: 10000, // 单个下载超时 10s
};

// ============================================================================
// 解析 awesome README
// ============================================================================

/**
 * 从 README 提取所有技能链接
 *
 * 格式示例：
 * - [skill-name](https://github.com/owner/repo/tree/branch/path/to/skill) - description
 */
async function fetchAwesomeSkills() {
  console.log("📥 获取 awesome-openclaw-skills README...");

  const { stdout } = await execAsync(`curl -sL "${CONFIG.awesomeReadme}"`);

  // 匹配 markdown 链接格式：[text](url)
  // URL 格式：https://github.com/openclaw/skills/tree/main/skills/{user}/{skill}/SKILL.md
  const linkPattern = /\[([^\]]+)\]\((https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+?\/SKILL\.md))\)/g;

  const skills = [];
  let match;

  while ((match = linkPattern.exec(stdout)) !== null) {
    const [, name, fullUrl, owner, repo, branch, skillPath] = match;

    // 提取描述（在链接后的 " - " 之后）
    const descMatch = stdout.slice(match.index).match(/\) - (.+?)(?:\n|$)/);
    const description = descMatch?.[1]?.trim() || "";

    // skillPath 格式：skills/{user}/{skill}/SKILL.md
    // 提取 user 和 skill 名称
    const pathParts = skillPath.split("/");
    const skillName = pathParts[pathParts.length - 2]; // 倒数第二个是技能名

    skills.push({
      name: name.trim(),
      skillName, // 实际的技能目录名
      owner,
      repo,
      branch,
      path: skillPath.trim(),
      fullUrl,
      description,
    });
  }

  console.log(`✅ 提取到 ${skills.length} 个技能链接`);
  return skills;
}

// ============================================================================
// 下载单个技能
// ============================================================================

/**
 * 下载单个技能的 SKILL.md 文件
 */
async function downloadSkill(skill) {
  const { name, skillName, owner, repo, branch, path: skillPath } = skill;

  // 构建 raw URL（去掉 /tree/branch/ 部分）
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillPath}`;

  // 输出路径（使用原始名称）
  const outputPath = path.join(CONFIG.outputDir, skillName || name, "SKILL.md");

  try {
    // 下载文件
    const { stdout } = await execAsync(`curl -sL "${rawUrl}"`, {
      timeout: CONFIG.timeout,
    });

    // 检查是否是 404 或无效内容
    if (stdout.includes("404: Not Found") || stdout.length < 10) {
      return { name, status: "not_found", error: "SKILL.md not found" };
    }

    // 保存文件
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, stdout, "utf-8");

    return { name, status: "success", path: outputPath, size: stdout.length };
  } catch (err) {
    return { name, status: "error", error: err.message };
  }
}

// ============================================================================
// 批量下载（带并发控制）
// ============================================================================

async function downloadAllSkills(skills) {
  console.log(`\n🚀 开始批量下载 ${skills.length} 个技能（并发: ${CONFIG.concurrency}）\n`);

  const results = [];
  const chunks = [];

  // 分块
  for (let i = 0; i < skills.length; i += CONFIG.concurrency) {
    chunks.push(skills.slice(i, i + CONFIG.concurrency));
  }

  let downloaded = 0;
  let failed = 0;
  let notFound = 0;

  for (const chunk of chunks) {
    const batchResults = await Promise.all(chunk.map(downloadSkill));

    for (const result of batchResults) {
      results.push(result);

      if (result.status === "success") {
        downloaded++;
        console.log(`  ✅ [${downloaded}/${skills.length}] ${result.name} (${(result.size / 1024).toFixed(1)}KB)`);
      } else if (result.status === "not_found") {
        notFound++;
        console.log(`  ⚠️  [${downloaded}/${skills.length}] ${result.name} - SKILL.md 不存在`);
      } else {
        failed++;
        console.log(`  ❌ [${downloaded}/${skills.length}] ${result.name} - ${result.error}`);
      }
    }
  }

  console.log(`\n📊 下载完成:`);
  console.log(`   成功: ${downloaded}`);
  console.log(`   未找到: ${notFound}`);
  console.log(`   失败: ${failed}`);

  return results;
}

// ============================================================================
// 保存元数据索引
// ============================================================================

async function saveMetadata(skills, results) {
  const metadata = {
    generatedAt: new Date().toISOString(),
    source: CONFIG.awesomeReadme,
    totalSkills: skills.length,
    downloaded: results.filter(r => r.status === "success").length,
    notFound: results.filter(r => r.status === "not_found").length,
    failed: results.filter(r => r.status === "error").length,
    skills: skills.map((skill, idx) => ({
      ...skill,
      downloadStatus: results[idx].status,
      downloadError: results[idx].error,
      localPath: results[idx].path,
    })),
  };

  await fs.writeFile(CONFIG.metadataFile, JSON.stringify(metadata, null, 2), "utf-8");
  console.log(`\n💾 元数据已保存: ${CONFIG.metadataFile}`);
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log("═".repeat(60));
  console.log("🌟 awesome-openclaw-skills 批量下载器");
  console.log("═".repeat(60));

  try {
    // 1. 提取技能列表
    const skills = await fetchAwesomeSkills();

    // 2. 批量下载
    const results = await downloadAllSkills(skills);

    // 3. 保存元数据
    await saveMetadata(skills, results);

    console.log("\n✅ 全部完成！");
  } catch (err) {
    console.error("💥 错误:", err);
    process.exit(1);
  }
}

main();
