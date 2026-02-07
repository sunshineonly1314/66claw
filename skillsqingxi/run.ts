/**
 * SkillWash 清洗工程 — 入口
 *
 * 用法:
 *   bun skillsqingxi/run.ts <SKILL.md 路径>
 *   bun skillsqingxi/run.ts skills/weather/SKILL.md
 *   bun skillsqingxi/run.ts --dir skills/     (批量清洗)
 */

import fs from "node:fs";
import path from "node:path";
import { washSingleSkill } from "./pipeline.js";
import { QWEN_CONFIG } from "./config.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔══════════════════════════════════════════════╗
║   🧹 SkillWash — Skills 清洗工程 v1.0        ║
╠══════════════════════════════════════════════╣
║                                              ║
║  用法:                                        ║
║    bun skillsqingxi/run.ts <SKILL.md>        ║
║    bun skillsqingxi/run.ts --dir <skills/>   ║
║                                              ║
║  配置:                                        ║
║    模型: ${QWEN_CONFIG.model.padEnd(30)}║
║    API: Aliyun Coding Plan                   ║
║                                              ║
╚══════════════════════════════════════════════╝
`);
    process.exit(0);
  }

  // 检查 API Key
  if (!QWEN_CONFIG.apiKey) {
    console.error("❌ 未配置 API Key，请设置 SKILLWASH_API_KEY 环境变量");
    process.exit(1);
  }

  if (args[0] === "--dir") {
    // 批量模式
    const dirPath = args[1];
    if (!dirPath || !fs.existsSync(dirPath)) {
      console.error(`❌ 目录不存在: ${dirPath}`);
      process.exit(1);
    }

    const skillDirs = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(dirPath, d.name, "SKILL.md"))
      .filter(f => fs.existsSync(f));

    console.log(`\n🔍 发现 ${skillDirs.length} 个技能待清洗\n`);

    const results = [];
    for (const skillPath of skillDirs) {
      try {
        const result = await washSingleSkill(skillPath);
        results.push(result);
      } catch (err) {
        console.error(`❌ 清洗失败: ${skillPath}`, err);
        results.push({ skillId: path.basename(path.dirname(skillPath)), finalDecision: "error" });
      }
      console.log("\n");
    }

    // 汇总
    const accepted = results.filter(r => r.finalDecision === "accepted");
    const rejected = results.filter(r => r.finalDecision === "rejected");
    const review = results.filter(r => r.finalDecision === "review");
    const errors = results.filter(r => r.finalDecision === "error");

    console.log("\n" + "═".repeat(60));
    console.log("📊 批量清洗汇总");
    console.log("═".repeat(60));
    console.log(`  总数: ${results.length}`);
    console.log(`  ✅ 收录: ${accepted.length}`);
    console.log(`  ❌ 淘汰: ${rejected.length}`);
    console.log(`  ⚠️ 复审: ${review.length}`);
    if (errors.length > 0) console.log(`  💥 错误: ${errors.length}`);
    console.log("═".repeat(60));

  } else {
    // 单个模式
    const filePath = args[0];
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      process.exit(1);
    }

    await washSingleSkill(filePath);
  }
}

main().catch((err) => {
  console.error("💥 Pipeline 异常:", err);
  process.exit(1);
});
