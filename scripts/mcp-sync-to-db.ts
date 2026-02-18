#!/usr/bin/env node
/**
 * MCP Marketplace JSON → SQLite 同步脚本
 * CN-ONLY FILE - 完全独立实现
 *
 * 用途：将 data/mcp-index-enhanced.json 同步到 data/mcp-index.db
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getDatabase,
  closeDatabase,
  insertItems,
  clearAllItems,
  getStats,
} from "../src/mcp/marketplace/db.js";
import type { McpMarketplaceItem } from "../src/mcp/marketplace/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== 配置 ==========

const INPUT_FILE = path.join(__dirname, "../data/mcp-index-enhanced.json");
const FALLBACK_FILE = path.join(__dirname, "../data/mcp-index.json");

// ========== 主流程 ==========

async function main() {
  console.log("🚀 MCP Marketplace JSON → SQLite 同步脚本");
  console.log("=" .repeat(60));

  // 1. 读取 JSON 文件
  let inputFile = INPUT_FILE;
  if (!fs.existsSync(inputFile)) {
    console.warn(`⚠️  ${inputFile} 不存在，尝试使用 ${FALLBACK_FILE}`);
    inputFile = FALLBACK_FILE;

    if (!fs.existsSync(inputFile)) {
      console.error(`❌ 未找到 MCP 数据文件！`);
      process.exit(1);
    }
  }

  console.log(`📂 读取文件: ${inputFile}`);
  const fileContent = fs.readFileSync(inputFile, "utf-8");
  const data = JSON.parse(fileContent);

  // 支持两种格式：
  // 1. envelope 格式: { version, items: [...] }
  // 2. 纯数组格式: [...]
  const items: McpMarketplaceItem[] = Array.isArray(data) ? data : data.items;

  if (!Array.isArray(items) || items.length === 0) {
    console.error(`❌ 无效的 MCP 数据格式！`);
    process.exit(1);
  }

  console.log(`✅ 读取到 ${items.length} 个 MCP 项目`);

  // 2. 初始化数据库
  console.log(`\n🗄️  初始化数据库...`);
  const db = getDatabase();
  console.log(`✅ 数据库连接成功`);

  // 3. 清空旧数据
  console.log(`\n🗑️  清空旧数据...`);
  clearAllItems();
  console.log(`✅ 清空完成`);

  // 4. 批量插入
  console.log(`\n📥 批量插入数据...`);
  const startTime = Date.now();

  try {
    insertItems(items);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ 插入完成，耗时 ${elapsed}s`);
  } catch (error) {
    console.error(`❌ 插入失败:`, error);
    closeDatabase();
    process.exit(1);
  }

  // 5. 统计验证
  console.log(`\n📊 数据库统计:`);
  const stats = getStats();
  console.log(`   总数: ${stats.total}`);
  console.log(`   AI 增强: ${stats.enhanced} (${((stats.enhanced / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   需要 VPN: ${stats.requiresVPN}`);
  console.log(`   官方认证: ${stats.official}`);

  console.log(`\n📂 分类分布 (Top 10):`);
  const categories = Object.entries(stats.categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [cat, count] of categories) {
    const percent = ((count / stats.total) * 100).toFixed(1);
    console.log(`   ${cat.padEnd(20)} ${count.toString().padStart(5)} (${percent}%)`);
  }

  // 6. 关闭数据库
  closeDatabase();

  console.log(`\n✅ 同步完成！`);
  console.log("=".repeat(60));
}

// ========== 执行 ==========

main().catch((error) => {
  console.error(`\n❌ 同步失败:`, error);
  closeDatabase();
  process.exit(1);
});
