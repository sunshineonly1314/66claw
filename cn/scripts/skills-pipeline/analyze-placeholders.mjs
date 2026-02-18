#!/usr/bin/env node
import fs from "node:fs";

const file = process.argv[2] || "cn/skills-mirror/skills/appletv/SKILL.md";
const content = fs.readFileSync(file, "utf8");

const placeholders = new Map();
let n = 0;

function put(value) {
  const key = `«CODE_${n++}»`;
  placeholders.set(key, value);
  return key;
}

let text = content;

// 1) Protect fenced code blocks
text = text.replace(/```[\s\S]*?```/g, (m) => put(m));

// 2) Protect inline code
text = text.replace(/`[^`\n]+`/g, (m) => put(m));

// Show all placeholders
console.log(`Total placeholders: ${placeholders.size}\n`);

for (const [k, v] of placeholders.entries()) {
  const num = parseInt(k.match(/\d+/)[0]);
  const preview = v.replace(/\n/g, "\\n").slice(0, 100);
  console.log(`${k}: ${preview}${v.length > 100 ? "..." : ""}`);
}

// Show the protected text around placeholders 10-11
console.log("\n\n=== Context around CODE_10 and CODE_11 ===\n");
const lines = text.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("«CODE_10»") || lines[i].includes("«CODE_11»")) {
    console.log(`Line ${i}: ${lines[i]}`);
  }
}
