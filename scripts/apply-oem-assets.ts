/**
 * OEM 品牌资源覆盖脚本
 *
 * 外销构建时，将 oem/ 目录下的品牌资源覆盖到对应的项目目录中。
 * 仅在 VITE_EDITION=overseas 时执行，否则跳过。
 *
 * 覆盖规则：
 *   oem/ui/*                      → ui/public/
 *   oem/desktop/icons/*           → apps/desktop/src-tauri/icons/
 *   oem/desktop/assets/setup-logo.png → apps/desktop/src-tauri/resources/assets/60ad649637d6797ad09120d309408d4c.png
 *   oem/desktop/assets/dmg-background.png → apps/desktop/src-tauri/resources/assets/dmg-background-small.png
 *   oem/desktop/assets/*（其他）   → apps/desktop/src-tauri/resources/assets/
 *
 * 用法: node --import tsx scripts/apply-oem-assets.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const edition = process.env.VITE_EDITION ?? "cn";
if (edition !== "overseas") {
  console.log("[oem-assets] edition=%s, skipping.", edition);
  process.exit(0);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const oemDir = path.join(rootDir, "oem");

if (!fs.existsSync(oemDir)) {
  console.log("[oem-assets] oem/ directory not found, skipping.");
  process.exit(0);
}

console.log("\n🎨  OEM Brand Assets (VITE_EDITION=overseas)\n");

/** 特殊文件名映射（oem 文件名 → 目标文件名） */
const ASSET_RENAMES: Record<string, string> = {
  "setup-logo.png": "60ad649637d6797ad09120d309408d4c.png",
  "dmg-background.png": "dmg-background-small.png",
};

/** 目录映射规则 */
const DIR_MAPPINGS: { oemSub: string; target: string }[] = [
  { oemSub: "ui", target: path.join(rootDir, "ui", "public") },
  { oemSub: path.join("desktop", "icons"), target: path.join(rootDir, "apps", "desktop", "src-tauri", "icons") },
  { oemSub: path.join("desktop", "assets"), target: path.join(rootDir, "apps", "desktop", "src-tauri", "resources", "assets") },
];

let count = 0;

for (const { oemSub, target } of DIR_MAPPINGS) {
  const srcDir = path.join(oemDir, oemSub);
  if (!fs.existsSync(srcDir)) continue;

  const files = fs.readdirSync(srcDir).filter((f) => {
    const fullPath = path.join(srcDir, f);
    return fs.statSync(fullPath).isFile();
  });

  if (files.length === 0) continue;

  fs.mkdirSync(target, { recursive: true });

  for (const file of files) {
    const destName = ASSET_RENAMES[file] ?? file;
    const src = path.join(srcDir, file);
    const dest = path.join(target, destName);
    fs.copyFileSync(src, dest);
    const relSrc = path.relative(rootDir, src);
    const relDest = path.relative(rootDir, dest);
    console.log("   %s → %s", relSrc, relDest);
    count++;
  }
}

if (count === 0) {
  console.log("   No OEM assets found. Place brand images in oem/ directory.");
  console.log("   See oem/README.md for details.");
} else {
  console.log("\n   %d brand asset(s) applied.", count);
}

console.log("[oem-assets] done.\n");
