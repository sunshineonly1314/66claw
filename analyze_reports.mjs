#!/usr/bin/env node
import { readFileSync } from 'fs';

const reports = {
  'ac2ce88': '核心模块 (src/)',
  'ac04a22': 'Extensions插件',
  'aeac412': 'macOS应用',
  'a7e49c1': 'iOS应用',
  'aaf06e1': '构建和测试'
};

const results = {};

for (const [id, name] of Object.entries(reports)) {
  const file = `report_${id}.md`;
  try {
    const content = readFileSync(file, 'utf-8');

    // 提取问题统计
    const criticalMatch = content.match(/\*\*Critical[^:]*\*\*[:\s]*(\d+)/i);
    const highMatch = content.match(/\*\*High[^:]*\*\*[:\s]*(\d+)/i);
    const mediumMatch = content.match(/\*\*Medium[^:]*\*\*[:\s]*(\d+)/i);
    const lowMatch = content.match(/\*\*Low[^:]*\*\*[:\s]*(\d+)/i);

    // 提取总问题数
    const totalMatch = content.match(/共发现[^0-9]*(\d+)\s*个/i) ||
                       content.match(/discovered\s+(\d+)\s+issues/i) ||
                       content.match(/总计[^0-9]*(\d+)/i);

    results[id] = {
      name,
      critical: criticalMatch ? parseInt(criticalMatch[1]) : 0,
      high: highMatch ? parseInt(highMatch[1]) : 0,
      medium: mediumMatch ? parseInt(mediumMatch[1]) : 0,
      low: lowMatch ? parseInt(lowMatch[1]) : 0,
      total: totalMatch ? parseInt(totalMatch[1]) : 0,
      lines: content.split('\n').length
    };
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
}

console.log(JSON.stringify(results, null, 2));
