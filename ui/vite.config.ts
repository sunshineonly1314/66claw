import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

function normalizeBase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "/";
  if (trimmed === "./") return "./";
  if (trimmed.endsWith("/")) return trimmed;
  return `${trimmed}/`;
}

/**
 * 读取 OEM 配置文件中的 ui 字段，构建时注入为编译时常量。
 * 优先级：OEM_ID 指定的文件 > 默认值（空字符串/false）。
 * 只在 VITE_EDITION=overseas 时有效，cn 版直接用 brand.ts 的 cnBrand。
 */
function loadOemUiBrand(): Record<string, string | boolean> {
  const oemId = process.env.OEM_ID ?? "default";
  const oemFile = path.resolve(here, `../config/oem/${oemId}.json`);
  const fallbackFile = path.resolve(here, "../config/oem/oem-template.json");
  const filePath = fs.existsSync(oemFile) ? oemFile : fallbackFile;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    const ui = (raw["ui"] ?? {}) as Record<string, unknown>;
    return {
      productName:           String(ui["productName"]           ?? "ClawbotCN"),
      productShortName:      String(ui["productShortName"]      ?? "ClawbotCN"),
      welcomeTitle:          String(ui["welcomeTitle"]          ?? "Welcome to ClawbotCN"),
      windowTitle:           String(ui["windowTitle"]           ?? "ClawbotCN"),
      metaDescription:       String(ui["metaDescription"]       ?? "ClawbotCN - AI Assistant"),
      tagline:               String(ui["tagline"]               ?? ""),
      activationPrefix:      String(ui["activationPrefix"]      ?? ""),
      activationPlaceholder: String(ui["activationPlaceholder"] ?? "请输入授权码"),
      activationPrefixError: String(ui["activationPrefixError"] ?? ""),
      activationDialogText:  String(ui["activationDialogText"]  ?? "请输入您的授权码以激活"),
      activationExample:     String(ui["activationExample"]     ?? "XXXX-XXXX-XXXX"),
      promoUrl:              String(ui["promoUrl"]              ?? ""),
      promoName:             String(ui["promoName"]             ?? ""),
      promoDesc:             String(ui["promoDesc"]             ?? ""),
      showPurchaseEntry:     Boolean(ui["showPurchaseEntry"]    ?? false),
      showSupportQrcode:     Boolean(ui["showSupportQrcode"]    ?? false),
      showAdaptationNotice:  Boolean(ui["showAdaptationNotice"] ?? false),
      logoPath:              String(ui["logoPath"]              ?? "/logo.png"),
      bannerPath:            String(ui["bannerPath"]            ?? "/oem-banner.png"),
      activationMascotPath:  String(ui["activationMascotPath"]  ?? "/oem-mascot.png"),
      skillMirrorHint:       String(ui["skillMirrorHint"]       ?? ""),
      skillExclusiveTitle:   String(ui["skillExclusiveTitle"]   ?? ""),
      freeModelsEyebrow:     String(ui["freeModelsEyebrow"]     ?? ""),
      batchMirrorBadge:      String(ui["batchMirrorBadge"]      ?? ""),
    };
  } catch {
    return {};
  }
}

export default defineConfig(({ command }) => {
  const envBase = process.env.CLAWDBOT_CONTROL_UI_BASE_PATH?.trim();
  const base = envBase ? normalizeBase(envBase) : "./";
  const isOverseas = process.env.VITE_EDITION === "overseas";
  const oemBrand = loadOemUiBrand(); // always load for defaults; only non-empty when OEM_ID set
  // 把每个字段注入为 __OEM_BRAND_xxx__ 编译时常量（cn 版也注入默认值，避免 ReferenceError）
  const oemDefines: Record<string, string> = {};
  for (const [k, v] of Object.entries(oemBrand)) {
    oemDefines[`__OEM_BRAND_${k.toUpperCase()}__`] = JSON.stringify(v);
  }
  // Ensure VITE_EDITION is also injectable
  oemDefines["__VITE_EDITION__"] = JSON.stringify(isOverseas ? "overseas" : "cn");
  return {
    base,
    define: oemDefines,
    publicDir: path.resolve(here, "public"),
    optimizeDeps: {
      include: ["lit/directives/repeat.js"],
    },
    build: {
      outDir: path.resolve(here, "../dist/control-ui"),
      emptyOutDir: true,
      // Source maps disabled in production builds to prevent reverse engineering.
      // Only enable in dev mode for debugging.
      sourcemap: command === "serve",
      commonjsOptions: {
        // All orchestrator/src/ui/ and guided/ files are now imported directly as .ts source,
        // bypassing their bytenode .js loaders (which have Node-only require("path"/"fs"/"crypto")).
        // Only highlight.js (a pure CJS lib) needs CJS→ESM transformation.
        include: [/highlight\.js/],
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        // Dev mode: proxy API + WebSocket to Gateway
        // Use GATEWAY_PORT env var (set by dev-tauri.ps1) or default to dev port 19002
        "/api": {
          target: `http://127.0.0.1:${process.env.GATEWAY_PORT || "19002"}`,
          changeOrigin: true,
        },
        "/ws": {
          target: `ws://127.0.0.1:${process.env.GATEWAY_PORT || "19002"}`,
          ws: true,
        },
      },
    },
  };
});
