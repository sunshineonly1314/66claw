import fs from "node:fs";
const content = fs.readFileSync("ui/src/ui/i18n/locales/zh-CN.ts", "utf-8");

const nameCount = (content.match(/"skillName\./g) || []).length;
const descCount = (content.match(/"skillDesc\./g) || []).length;
const hasExport = content.includes("export default");
const fileKB = (content.length / 1024).toFixed(0);

console.log("zh-CN.ts 验证:");
console.log(`  文件: ${fileKB} KB | export: ${hasExport}`);
console.log(`  名称: ${nameCount} 条 (${(nameCount/2999*100).toFixed(1)}%)`);
console.log(`  描述: ${descCount} 条 (${(descCount/2999*100).toFixed(1)}%)`);
console.log();

const keys = ["0x-swap","1inch","1password","github","weather","spotify-player","achurch","agent-config","2captcha","4chan-reader","a-stock-analysis"];
console.log("抽样检查:");
for (const k of keys) {
  const n = content.match(new RegExp(`"skillName\\.${k}":\\s*"([^"]+)"`));
  const d = content.match(new RegExp(`"skillDesc\\.${k}":\\s*"([^"]+)"`));
  console.log(`  ${k}: ${n?.[1]||"--"} | ${(d?.[1]||"--").substring(0,35)}`);
}
