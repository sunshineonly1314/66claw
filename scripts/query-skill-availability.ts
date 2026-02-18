#!/usr/bin/env node
/**
 * Skills Availability Query Tool
 *
 * 查询工具 - 快速查找中国可用的 Skills
 *
 * Usage:
 *   pnpm tsx scripts/query-skill-availability.ts --available     # 列出所有中国可用的
 *   pnpm tsx scripts/query-skill-availability.ts --vpn           # 列出需要外网的
 *   pnpm tsx scripts/query-skill-availability.ts --macos         # 列出 macOS 专属的
 *   pnpm tsx scripts/query-skill-availability.ts --search "地图" # 搜索关键词
 *   pnpm tsx scripts/query-skill-availability.ts --category ai   # 按分类查询
 *   pnpm tsx scripts/query-skill-availability.ts --id "feishu"   # 查询特定 skill
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

interface SkillAvailability {
  id: string;
  type: "mcp" | "extension";
  name: string;
  nameEn: string;
  description: string;
  category: string;
  availability: {
    china: {
      status: "available" | "vpn-required" | "blocked" | "unknown";
      confidence: number;
      reasons: string[];
      alternatives: string[];
    };
    platforms: {
      supported: string[];
      restrictions: string[];
    };
    requirements: {
      apiKeys: string[];
      services: string[];
      domains: string[];
      adaptationsNeeded: string[];
    };
  };
  metadata: {
    source: string;
    sourceUrl: string;
    version: string;
    toolCount: number;
    lastUpdated: string;
  };
  classification: {
    autoDetected: boolean;
    manualVerified: boolean;
    detectionMethod: string;
    verifiedBy: string | null;
    verifiedAt: string | null;
  };
}

interface Dictionary {
  version: string;
  generatedAt: string;
  summary: {
    totalSkills: number;
    chinaAvailable: number;
    requiresVPN: number;
    blocked: number;
    platformRestricted: number;
    categories: Record<string, number>;
  };
  skills: SkillAvailability[];
}

class SkillQueryTool {
  private dictionary: Dictionary | null = null;

  async load() {
    const dictPath = path.join(
      ROOT_DIR,
      "data",
      "skill-availability-dictionary.json"
    );
    const content = await fs.readFile(dictPath, "utf-8");
    this.dictionary = JSON.parse(content);
    console.log(
      `✅ Loaded ${this.dictionary!.skills.length} skills from dictionary\n`
    );
  }

  /**
   * 查询所有中国可用的 skills
   */
  queryAvailable() {
    const results = this.dictionary!.skills.filter(
      (s) => s.availability.china.status === "available"
    );
    console.log(`✅ 中国可用的 Skills (${results.length}):\n`);
    this.printResults(results, 20);
  }

  /**
   * 查询需要外网的 skills
   */
  queryVPNRequired() {
    const results = this.dictionary!.skills.filter(
      (s) => s.availability.china.status === "vpn-required"
    );
    console.log(`🌐 需要外网的 Skills (${results.length}):\n`);
    this.printResults(results, 20);
  }

  /**
   * 查询 macOS 专属的 skills
   */
  queryMacOSOnly() {
    const results = this.dictionary!.skills.filter(
      (s) =>
        s.availability.platforms.supported.includes("darwin") &&
        s.availability.platforms.supported.length === 1
    );
    console.log(`🍎 macOS 专属 Skills (${results.length}):\n`);
    this.printResults(results, 50);
  }

  /**
   * 按分类查询
   */
  queryByCategory(category: string) {
    const results = this.dictionary!.skills.filter(
      (s) => s.category.toLowerCase() === category.toLowerCase()
    );
    console.log(`📁 分类 "${category}" 的 Skills (${results.length}):\n`);
    this.printResults(results, 50);
  }

  /**
   * 搜索关键词
   */
  search(keyword: string) {
    const lowerKeyword = keyword.toLowerCase();
    const results = this.dictionary!.skills.filter(
      (s) =>
        s.id.toLowerCase().includes(lowerKeyword) ||
        s.name.toLowerCase().includes(lowerKeyword) ||
        s.nameEn.toLowerCase().includes(lowerKeyword) ||
        s.description.toLowerCase().includes(lowerKeyword)
    );
    console.log(`🔍 搜索 "${keyword}" 的结果 (${results.length}):\n`);
    this.printResults(results, 50);
  }

  /**
   * 查询特定 skill 详情
   */
  queryById(id: string) {
    const skill = this.dictionary!.skills.find((s) => s.id === id);
    if (!skill) {
      console.log(`❌ 未找到 skill: ${id}`);
      return;
    }

    console.log(`📦 Skill 详情:\n`);
    console.log(`ID: ${skill.id}`);
    console.log(`名称: ${skill.name} (${skill.nameEn})`);
    console.log(`类型: ${skill.type}`);
    console.log(`分类: ${skill.category}`);
    console.log(`描述: ${skill.description}\n`);

    console.log(`🌏 中国可用性:`);
    console.log(`  状态: ${this.getStatusEmoji(skill)} ${skill.availability.china.status}`);
    console.log(`  置信度: ${(skill.availability.china.confidence * 100).toFixed(1)}%`);
    if (skill.availability.china.reasons.length > 0) {
      console.log(`  原因:`);
      skill.availability.china.reasons.forEach((r) =>
        console.log(`    - ${r}`)
      );
    }
    if (skill.availability.china.alternatives.length > 0) {
      console.log(`  替代方案:`);
      skill.availability.china.alternatives.forEach((a) =>
        console.log(`    - ${a}`)
      );
    }

    console.log(`\n🖥️  平台支持:`);
    console.log(`  支持: ${skill.availability.platforms.supported.join(", ")}`);
    if (skill.availability.platforms.restrictions.length > 0) {
      console.log(`  限制:`);
      skill.availability.platforms.restrictions.forEach((r) =>
        console.log(`    - ${r}`)
      );
    }

    console.log(`\n📊 元数据:`);
    console.log(`  来源: ${skill.metadata.source}`);
    console.log(`  URL: ${skill.metadata.sourceUrl}`);
    console.log(`  版本: ${skill.metadata.version}`);
    console.log(`  工具数: ${skill.metadata.toolCount}`);
  }

  /**
   * 显示统计摘要
   */
  showSummary() {
    const summary = this.dictionary!.summary;
    console.log(`📊 Skills 可用性统计摘要\n`);
    console.log(`总计: ${summary.totalSkills} 个 skills`);
    console.log(
      `✅ 中国可用: ${summary.chinaAvailable} (${((summary.chinaAvailable / summary.totalSkills) * 100).toFixed(1)}%)`
    );
    console.log(
      `🌐 需要外网: ${summary.requiresVPN} (${((summary.requiresVPN / summary.totalSkills) * 100).toFixed(1)}%)`
    );
    console.log(
      `🚫 被屏蔽: ${summary.blocked} (${((summary.blocked / summary.totalSkills) * 100).toFixed(1)}%)`
    );
    console.log(
      `🖥️  平台限制: ${summary.platformRestricted} (${((summary.platformRestricted / summary.totalSkills) * 100).toFixed(1)}%)`
    );

    console.log(`\n📁 分类统计:`);
    const categories = Object.entries(summary.categories).sort(
      (a, b) => b[1] - a[1]
    );
    for (const [cat, count] of categories.slice(0, 10)) {
      console.log(`  ${cat}: ${count}`);
    }
  }

  /**
   * 打印结果列表
   */
  private printResults(results: SkillAvailability[], limit: number = 20) {
    const displayed = results.slice(0, limit);
    for (const skill of displayed) {
      const status = this.getStatusEmoji(skill);
      const platform = this.getPlatformEmoji(skill);
      console.log(
        `${status} ${platform} ${skill.name} (${skill.id}) - ${skill.category}`
      );
      if (skill.availability.china.reasons.length > 0) {
        console.log(`     ${skill.availability.china.reasons[0]}`);
      }
    }

    if (results.length > limit) {
      console.log(
        `\n... 还有 ${results.length - limit} 个结果 (共 ${results.length} 个)`
      );
    }
  }

  private getStatusEmoji(skill: SkillAvailability): string {
    switch (skill.availability.china.status) {
      case "available":
        return "✅";
      case "vpn-required":
        return "🌐";
      case "blocked":
        return "🚫";
      default:
        return "❓";
    }
  }

  private getPlatformEmoji(skill: SkillAvailability): string {
    const platforms = skill.availability.platforms.supported;
    if (platforms.length === 1) {
      if (platforms[0] === "darwin") return "🍎";
      if (platforms[0] === "win32") return "🪟";
      if (platforms[0] === "linux") return "🐧";
    }
    return "🖥️";
  }
}

async function main() {
  const args = process.argv.slice(2);
  const tool = new SkillQueryTool();

  try {
    await tool.load();

    if (args.length === 0) {
      tool.showSummary();
      console.log(`\n💡 使用示例:`);
      console.log(
        `   pnpm tsx scripts/query-skill-availability.ts --available`
      );
      console.log(`   pnpm tsx scripts/query-skill-availability.ts --vpn`);
      console.log(`   pnpm tsx scripts/query-skill-availability.ts --macos`);
      console.log(
        `   pnpm tsx scripts/query-skill-availability.ts --search "地图"`
      );
      console.log(
        `   pnpm tsx scripts/query-skill-availability.ts --category ai`
      );
      console.log(
        `   pnpm tsx scripts/query-skill-availability.ts --id "feishu"`
      );
      return;
    }

    const command = args[0];
    const param = args[1];

    switch (command) {
      case "--available":
        tool.queryAvailable();
        break;
      case "--vpn":
        tool.queryVPNRequired();
        break;
      case "--macos":
        tool.queryMacOSOnly();
        break;
      case "--category":
        if (!param) {
          console.error("❌ 请指定分类名称");
          process.exit(1);
        }
        tool.queryByCategory(param);
        break;
      case "--search":
        if (!param) {
          console.error("❌ 请指定搜索关键词");
          process.exit(1);
        }
        tool.search(param);
        break;
      case "--id":
        if (!param) {
          console.error("❌ 请指定 skill ID");
          process.exit(1);
        }
        tool.queryById(param);
        break;
      case "--summary":
        tool.showSummary();
        break;
      default:
        console.error(`❌ 未知命令: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main();
