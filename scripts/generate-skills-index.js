/**
 * 生成 skills index.json 文件
 * 用于 Gitee 技能市场
 */

import fs from 'node:fs';
import path from 'node:path';

const skillsDir = process.argv[2] || 'd:/codeknowledge/clawdbot-main/clawdbot-main/clawdhub-skills-mirror/cn/skills';
const outputPath = process.argv[3] || path.join(path.dirname(skillsDir), 'index.json');

const skills = [];

const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  
  const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) continue;
  
  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    
    const fm = fmMatch[1];
    const nameMatch = fm.match(/name:\s*(.+)/);
    const descMatch = fm.match(/description:\s*["']?(.+?)["']?\s*$/m);
    
    // 尝试从 metadata 中解析 emoji
    let emoji = '';
    const metaMatch = fm.match(/metadata:\s*(.+)/);
    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]);
        emoji = meta?.clawdbot?.emoji || '';
      } catch {}
    }
    
    skills.push({
      name: nameMatch ? nameMatch[1].trim() : entry.name,
      description: descMatch ? descMatch[1].trim().slice(0, 200) : '',
      path: entry.name,
      emoji: emoji
    });
  } catch (err) {
    console.error(`Error processing ${entry.name}:`, err.message);
  }
}

const index = {
  version: 1,
  updated: new Date().toISOString().split('T')[0],
  skills: skills
};

fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8');

console.log(`Generated index.json with ${skills.length} skills`);
console.log(`Output: ${outputPath}`);
console.log('First 5 skills:');
skills.slice(0, 5).forEach(s => console.log(` - ${s.emoji || '📦'} ${s.name}: ${s.description.slice(0, 60)}...`));
