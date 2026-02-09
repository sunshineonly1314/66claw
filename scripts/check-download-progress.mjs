#!/usr/bin/env node
/**
 * 监控下载进度
 */

import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = "./skills-awesome";

async function checkProgress() {
  try {
    const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
    const skillDirs = entries.filter(e => e.isDirectory());

    console.log(`\n📊 当前进度: ${skillDirs.length} 个技能已下载`);

    // 计算总大小
    let totalSize = 0;
    for (const dir of skillDirs) {
      try {
        const skillPath = path.join(OUTPUT_DIR, dir.name, "SKILL.md");
        const stats = await fs.stat(skillPath);
        totalSize += stats.size;
      } catch {}
    }

    console.log(`📦 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`⏱️  ${new Date().toLocaleTimeString()}`);

  } catch (err) {
    console.log("⚠️  还未开始下载或目录不存在");
  }
}

checkProgress();
