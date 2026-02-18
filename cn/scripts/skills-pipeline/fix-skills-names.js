/**
 * 修复中文 Skills 的 name 字段
 * 确保 name 与目录名匹配，符合 [a-z0-9-]+ 格式
 */

import fs from 'node:fs';
import path from 'node:path';

const dryRun = process.argv.includes('--dry-run');
const args = process.argv.filter(a => !a.startsWith('--'));
const skillsDir = args[2] || 'd:/codeknowledge/clawdbot-main/clawdbot-main/cn/skills-mirror/cn/skills';

console.log('Skills 目录:', skillsDir);
console.log('模式:', dryRun ? '预览 (--dry-run)' : '实际修改');
console.log('');

const entries = fs.readdirSync(skillsDir, { withFileTypes: true }).filter(e => e.isDirectory());

let fixed = 0;
let skipped = 0;
let errors = 0;

for (const entry of entries) {
  const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    skipped++;
    continue;
  }

  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const nameMatch = content.match(/^(---\s*\n[\s\S]*?)name:\s*(\S+)([\s\S]*?\n---)/);
    
    if (!nameMatch) {
      skipped++;
      continue;
    }

    const currentName = nameMatch[2].trim();
    const expectedName = entry.name;

    // 检查是否需要修复
    if (currentName === expectedName) {
      skipped++;
      continue;
    }

    // 构建新内容
    const newContent = content.replace(
      /^(---\s*\n[\s\S]*?)name:\s*\S+([\s\S]*?\n---)/,
      `$1name: ${expectedName}$2`
    );

    if (dryRun) {
      console.log(`[预览] ${entry.name}: "${currentName}" → "${expectedName}"`);
    } else {
      fs.writeFileSync(skillMdPath, newContent, 'utf-8');
      console.log(`[修复] ${entry.name}: "${currentName}" → "${expectedName}"`);
    }
    fixed++;
  } catch (err) {
    console.error(`[错误] ${entry.name}: ${err.message}`);
    errors++;
  }
}

console.log('');
console.log('===== 统计 =====');
console.log(`已修复: ${fixed}`);
console.log(`跳过: ${skipped}`);
console.log(`错误: ${errors}`);

if (dryRun && fixed > 0) {
  console.log('');
  console.log('运行以下命令实际执行修复:');
  console.log('  node scripts/fix-skills-names.js');
}
