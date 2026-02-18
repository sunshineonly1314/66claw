#!/usr/bin/env node
import { readFileSync } from 'fs';

function extractReport(jsonlFile) {
  try {
    const content = readFileSync(jsonlFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    // 从后往前查找包含审查报告的消息
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const data = JSON.parse(lines[i]);
        if (data.message?.content) {
          for (const item of data.message.content) {
            if (item.type === 'text') {
              const text = item.text || '';
              if (text.includes('审查报告') || text.includes('Review Report') ||
                  text.includes('深度审查') || text.includes('Comprehensive')) {
                return text;
              }
            }
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch (err) {
    console.error(`Error reading ${jsonlFile}:`, err.message);
    return null;
  }
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node extract_reports.mjs <jsonl_file>');
  process.exit(1);
}

const report = extractReport(file);
if (report) {
  console.log(report);
} else {
  console.error('No report found');
  process.exit(1);
}
