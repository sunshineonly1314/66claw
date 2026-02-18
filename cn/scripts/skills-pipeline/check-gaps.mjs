import fs from "node:fs";

const awesome = JSON.parse(fs.readFileSync("skills-awesome/index.json","utf-8"));
const zhContent = fs.readFileSync("ui/src/ui/i18n/locales/zh-CN.ts","utf-8");

const translated = new Set();
for (const m of zhContent.matchAll(/"skillName\.([^"]+)"/g)) translated.add(m[1]);

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");
}

let missing = [];
for (const s of awesome.skills) {
  const key = normalize(s.name);
  if (!translated.has(key)) {
    missing.push({ key, original: s.name, desc: (s.description || "").substring(0, 60) });
  }
}

console.log(`Awesome 总数: ${awesome.skills.length}`);
console.log(`已翻译: ${translated.size}`);
console.log(`Awesome 中未翻译: ${missing.length}`);
console.log(`\n前 20 个未翻译:`);
for (const m of missing.slice(0, 20)) {
  console.log(`  ${m.key}: ${m.desc}`);
}
