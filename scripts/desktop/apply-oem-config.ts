#!/usr/bin/env node
/**
 * OEM 品牌配置注入脚本
 *
 * 在 Tauri 构建前运行，将 config/oem/<OEM_ID>.json 中的品牌信息
 * 注入到 apps/desktop/src-tauri/tauri.conf.json。
 *
 * 用法：
 *   OEM_ID=your-oem-id node --import tsx scripts/desktop/apply-oem-config.ts
 *   或在 build.sh 中调用（OEM_ID 为空时跳过，使用默认配置）
 *
 * 注入字段：
 *   - productName  → tauri.conf.json .productName
 *   - identifier   → tauri.conf.json .identifier
 *   - windowTitle  → tauri.conf.json .app.windows[0].title（如存在）
 *
 * 安全说明：
 *   - 此脚本不修改任何 JS/TS 源码，只改 Tauri 打包配置
 *   - 授权逻辑、网关 URL 等敏感配置不在此注入（由服务端下发）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "../..");
const TAURI_CONF = path.join(ROOT_DIR, "apps", "desktop", "src-tauri", "tauri.conf.json");
const OEM_CONFIG_DIR = path.join(ROOT_DIR, "config", "oem");

const oemId = process.env.OEM_ID?.trim() || "default";

// 安全校验：OEM_ID 只允许字母、数字、连字符、下划线，防止路径遍历
if (!/^[a-zA-Z0-9_-]+$/.test(oemId)) {
  console.error(`[OEM] ERROR: invalid OEM_ID "${oemId}" — only alphanumeric, hyphens, and underscores allowed`);
  process.exit(1);
}

// ── Load OEM config ──

const oemConfigPath = path.join(OEM_CONFIG_DIR, `${oemId}.json`);

if (!fs.existsSync(oemConfigPath)) {
  if (oemId === "default") {
    // No default config = no-op, use whatever is in tauri.conf.json
    console.log("[OEM] OEM_ID not set and no default.json — using existing tauri.conf.json");
    process.exit(0);
  }
  console.error(`[OEM] ERROR: OEM config not found: ${oemConfigPath}`);
  console.error(`[OEM] Available configs:`);
  for (const f of fs.readdirSync(OEM_CONFIG_DIR)) {
    if (f.endsWith(".json") && !f.startsWith("oem-template")) {
      console.error(`  - ${f.replace(".json", "")}`);
    }
  }
  process.exit(1);
}

type OemConfig = {
  oemId: string;
  productName?: string;
  identifier?: string;
  windowTitle?: string;
  installerLanguages?: string[];
  tauri?: {
    bundle?: {
      icon?: string[];
    };
  };
};

const oem = JSON.parse(fs.readFileSync(oemConfigPath, "utf8")) as OemConfig;
console.log(`[OEM] Applying OEM config: ${oemId}`);
console.log(`  productName : ${oem.productName ?? "(unchanged)"}`);
console.log(`  identifier  : ${oem.identifier ?? "(unchanged)"}`);

// ── Load and patch tauri.conf.json ──

if (!fs.existsSync(TAURI_CONF)) {
  console.error(`[OEM] ERROR: tauri.conf.json not found at ${TAURI_CONF}`);
  process.exit(1);
}

type TauriConf = {
  productName?: string;
  identifier?: string;
  app?: {
    windows?: Array<{ title?: string }>;
    security?: { csp?: string | null };
  };
  bundle?: {
    icon?: string[];
    windows?: {
      nsis?: { installerIcon?: string; languages?: string[] };
    };
  };
};

const conf = JSON.parse(fs.readFileSync(TAURI_CONF, "utf8")) as TauriConf;

// Backup original (idempotent — only if not already backed up this build)
const backupPath = TAURI_CONF + ".oem-orig";
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, JSON.stringify(conf, null, 2), "utf8");
  console.log(`[OEM] Backup saved: tauri.conf.json.oem-orig`);
}

// Apply patches
if (oem.productName) conf.productName = oem.productName;
if (oem.identifier) conf.identifier = oem.identifier;

if (oem.windowTitle && conf.app?.windows?.[0]) {
  conf.app.windows[0].title = oem.windowTitle;
}

if (oem.tauri?.bundle?.icon && conf.bundle) {
  conf.bundle.icon = oem.tauri.bundle.icon;
}

if (oem.installerLanguages && conf.bundle?.windows?.nsis) {
  conf.bundle.windows.nsis.languages = oem.installerLanguages;
}

fs.writeFileSync(TAURI_CONF, JSON.stringify(conf, null, 2) + "\n", "utf8");
console.log(`[OEM] tauri.conf.json patched successfully`);
console.log(`[OEM] Run 'node --import tsx scripts/desktop/restore-tauri-conf.ts' to revert after build`);
