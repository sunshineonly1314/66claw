#!/usr/bin/env node
/**
 * 恢复 tauri.conf.json 到 OEM 注入前的原始状态
 *
 * 用法（构建完成后调用）：
 *   node --import tsx scripts/desktop/restore-tauri-conf.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "../..");
const TAURI_CONF = path.join(ROOT_DIR, "apps", "desktop", "src-tauri", "tauri.conf.json");
const BACKUP = TAURI_CONF + ".oem-orig";

if (!fs.existsSync(BACKUP)) {
  console.log("[OEM] No backup found (tauri.conf.json.oem-orig) — nothing to restore");
  process.exit(0);
}

fs.copyFileSync(BACKUP, TAURI_CONF);
fs.rmSync(BACKUP);
console.log("[OEM] tauri.conf.json restored to original state");
