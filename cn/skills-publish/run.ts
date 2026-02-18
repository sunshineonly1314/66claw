/**
 * SkillsUpdate — CLI 入口
 *
 * 用法:
 *   bun cn/skills-publish/run.ts              丰富 v2 → v3 索引
 *   bun cn/skills-publish/run.ts --publish    丰富 + 本地发布
 *   bun cn/skills-publish/run.ts --remote     丰富 + 推送到 Proxy
 *   bun cn/skills-publish/run.ts --stats      仅显示统计
 */

import { enrichAll, saveIndexV3 } from "./enricher.js";
import { publishLocal, publishRemote } from "./publisher.js";
import { SKILLSUPDATE_CONFIG } from "./config.js";
import type { SkillsIndexV3, CategoryId, CnStatus } from "./types.js";

// ============================================================================
// 统计展示
// ============================================================================

function printStats(index: SkillsIndexV3): void {
  const { stats } = index;

  console.log("\n" + "═".repeat(60));
  console.log("📊 Skills Index v3 统计");
  console.log("═".repeat(60));

  // 基础统计
  console.log(`\n  总扫描: ${stats.totalScanned}`);
  console.log(`  收录数: ${stats.finalAccepted}`);
  console.log(`  版本: ${index.pipelineVersion}`);

  // 评级分布
  console.log(`\n  📈 评级分布:`);
  console.log(`     S (精选推荐): ${stats.tierDistribution.S}`);
  console.log(`     A (推荐):     ${stats.tierDistribution.A}`);
  console.log(`     B (可选):     ${stats.tierDistribution.B}`);

  // 分类分布
  console.log(`\n  📁 分类分布:`);
  const catEntries = Object.entries(stats.categoryDistribution)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
  for (const [catId, count] of catEntries) {
    const def = index.categories.find((c) => c.id === catId);
    const label = def ? `${def.emoji} ${def.nameZh}` : catId;
    console.log(`     ${label.padEnd(16)} ${count}`);
  }

  // CN 状态分布
  console.log(`\n  🇨🇳 CN 可用性:`);
  console.log(`     🟢 cn-native (完全可用): ${stats.cnStatusDistribution["cn-native"]}`);
  console.log(`     🟡 cn-proxy  (需代理):   ${stats.cnStatusDistribution["cn-proxy"]}`);
  console.log(`     🔴 cn-blocked (不可用):  ${stats.cnStatusDistribution["cn-blocked"]}`);

  // 平台覆盖
  const platformMap: Record<string, number> = {};
  const noPlatform = index.skills.filter((s) => s.platforms.length === 0).length;
  for (const s of index.skills) {
    for (const p of s.platforms) {
      platformMap[p] = (platformMap[p] ?? 0) + 1;
    }
  }
  console.log(`\n  💻 平台限制:`);
  console.log(`     全平台:  ${noPlatform}`);
  for (const [p, c] of Object.entries(platformMap).sort(([, a], [, b]) => b - a)) {
    console.log(`     ${p.padEnd(10)} ${c}`);
  }

  // 安装方式
  const methodMap: Record<string, number> = {};
  const noInstall = index.skills.filter((s) => s.installMethods.length === 0).length;
  for (const s of index.skills) {
    for (const m of s.installMethods) {
      methodMap[m] = (methodMap[m] ?? 0) + 1;
    }
  }
  console.log(`\n  📦 安装方式:`);
  console.log(`     无需安装: ${noInstall}`);
  for (const [m, c] of Object.entries(methodMap).sort(([, a], [, b]) => b - a)) {
    console.log(`     ${m.padEnd(12)} ${c}`);
  }

  // 翻译覆盖
  const translated = index.skills.filter((s) => s.hasTranslation).length;
  console.log(`\n  🌐 翻译覆盖: ${translated}/${stats.finalAccepted} (${Math.round(translated / stats.finalAccepted * 100)}%)`);

  console.log("\n" + "═".repeat(60));
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
╔══════════════════════════════════════════════════╗
║  SkillsUpdate — v2 → v3 索引丰富 & 发布          ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  用法:                                           ║
║    bun cn/skills-publish/run.ts              丰富     ║
║    bun cn/skills-publish/run.ts --publish    本地发布  ║
║    bun cn/skills-publish/run.ts --remote     远程推送  ║
║    bun cn/skills-publish/run.ts --stats      仅统计   ║
║                                                  ║
║  输入: ${SKILLSUPDATE_CONFIG.washIndexFile.padEnd(35)}║
║  输出: ${SKILLSUPDATE_CONFIG.outputDir.padEnd(35)}║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);
    return;
  }

  const startTime = Date.now();

  console.log("═".repeat(60));
  console.log("🔄 SkillsUpdate — v2 → v3 索引丰富");
  console.log("═".repeat(60));

  // 1. 丰富
  const index = enrichAll();

  // 2. 保存 v3 索引
  const outputPath = saveIndexV3(index);
  console.log(`\n💾 v3 索引已保存: ${outputPath}`);

  // 3. 统计
  printStats(index);

  // 4. 发布
  if (args.includes("--publish")) {
    console.log("\n📦 开始本地发布...");
    publishLocal(index);
  } else if (args.includes("--remote")) {
    console.log("\n🚀 开始远程推送...");
    await publishRemote(index);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ 完成 (${elapsed}s)`);
}

main().catch((err) => {
  console.error("💥 SkillsUpdate 异常:", err);
  process.exit(1);
});
