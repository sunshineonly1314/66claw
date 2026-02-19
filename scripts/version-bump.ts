#!/usr/bin/env node
/**
 * Version Bump Script
 *
 * 自动递增版本号并同步到所有版本源文件。
 *
 * Usage:
 *   npx tsx scripts/version-bump.ts patch          # 1.1.6 → 1.1.7
 *   npx tsx scripts/version-bump.ts minor          # 1.1.7 → 1.2.0
 *   npx tsx scripts/version-bump.ts major          # 1.2.0 → 2.0.0
 *   npx tsx scripts/version-bump.ts set 1.2.3      # 直接设置为指定版本
 *
 * 同步的文件：
 *   - package.json                                  (source of truth)
 *   - apps/desktop/package.json                     (桌面端子包)
 *   - apps/desktop/src-tauri/tauri.conf.json        (Tauri 桌面端)
 *   - apps/macos/Sources/OpenClaw/Resources/Info.plist  (macOS 模板)
 */

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

// ─── 版本文件路径 ────────────────────────────────────

const VERSION_FILES = {
  packageJson: path.join(ROOT_DIR, "package.json"),
  desktopPackageJson: path.join(ROOT_DIR, "apps/desktop/package.json"),
  tauriConf: path.join(ROOT_DIR, "apps/desktop/src-tauri/tauri.conf.json"),
  infoPlist: path.join(ROOT_DIR, "apps/macos/Sources/OpenClaw/Resources/Info.plist"),
};

// ─── 解析 semver ────────────────────────────────────

function parseSemver(version: string): [number, number, number] {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid semver: "${version}"`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function bumpVersion(
  current: string,
  type: "patch" | "minor" | "major",
): string {
  const [major, minor, patch] = parseSemver(current);
  switch (type) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
  }
}

/** CFBundleVersion: 用纯数字表示，如 1.1.6 → 10106, 1.12.3 → 11203 */
function toCFBundleVersion(version: string): string {
  const [major, minor, patch] = parseSemver(version);
  return `${major}${String(minor).padStart(2, "0")}${String(patch).padStart(2, "0")}`;
}

// ─── 文件更新 ────────────────────────────────────────

function updatePackageJson(newVersion: string): void {
  const filePath = VERSION_FILES.packageJson;
  const pkg = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  pkg.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  console.log(`  ✓ package.json → ${newVersion}`);
}

function updateDesktopPackageJson(newVersion: string): void {
  const filePath = VERSION_FILES.desktopPackageJson;
  if (!fs.existsSync(filePath)) {
    console.log(`  ⊘ apps/desktop/package.json not found (skipped)`);
    return;
  }
  const pkg = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  pkg.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  console.log(`  ✓ apps/desktop/package.json → ${newVersion}`);
}

function updateTauriConf(newVersion: string): void {
  const filePath = VERSION_FILES.tauriConf;
  if (!fs.existsSync(filePath)) {
    console.log(`  ⊘ tauri.conf.json not found (skipped)`);
    return;
  }
  const conf = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  conf.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(conf, null, 2) + "\n", "utf-8");
  console.log(`  ✓ tauri.conf.json → ${newVersion}`);
}

function updateInfoPlist(newVersion: string): void {
  const filePath = VERSION_FILES.infoPlist;
  if (!fs.existsSync(filePath)) {
    console.log(`  ⊘ Info.plist not found (skipped)`);
    return;
  }
  let content = fs.readFileSync(filePath, "utf-8");
  const bundleVersion = toCFBundleVersion(newVersion);

  // CFBundleShortVersionString
  content = content.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${newVersion}$2`,
  );
  // CFBundleVersion
  content = content.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${bundleVersion}$2`,
  );

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`  ✓ Info.plist → ${newVersion} (bundle: ${bundleVersion})`);
}

// ─── Main ────────────────────────────────────────────

function main(): void {
  const [action, ...rest] = process.argv.slice(2);

  if (!action || action === "--help" || action === "-h") {
    console.log(`Usage:
  npx tsx scripts/version-bump.ts patch       # patch +1
  npx tsx scripts/version-bump.ts minor       # minor +1, patch → 0
  npx tsx scripts/version-bump.ts major       # major +1, minor/patch → 0
  npx tsx scripts/version-bump.ts set X.Y.Z   # set exact version`);
    process.exit(0);
  }

  // 读取当前版本
  const pkg = JSON.parse(fs.readFileSync(VERSION_FILES.packageJson, "utf-8"));
  const currentVersion = pkg.version;
  console.log(`Current version: ${currentVersion}`);

  let newVersion: string;

  if (action === "set") {
    const target = rest[0];
    if (!target) {
      console.error("Error: 'set' requires a version argument (e.g., set 1.2.3)");
      process.exit(1);
    }
    // 验证格式
    parseSemver(target);
    newVersion = target;
  } else if (action === "patch" || action === "minor" || action === "major") {
    newVersion = bumpVersion(currentVersion, action);
  } else {
    console.error(`Unknown action: "${action}". Use patch, minor, major, or set.`);
    process.exit(1);
  }

  console.log(`Bumping: ${currentVersion} → ${newVersion}`);
  console.log("");

  updatePackageJson(newVersion);
  updateDesktopPackageJson(newVersion);
  updateTauriConf(newVersion);
  updateInfoPlist(newVersion);

  console.log("");
  console.log(`Done! Version bumped to ${newVersion}`);

  // 输出纯版本号到 stdout 最后一行（供 CI 脚本捕获）
  // 格式: VERSION=X.Y.Z
  console.log(`VERSION=${newVersion}`);
}

main();
