#!/usr/bin/env node
/**
 * OpenClawCN Release Deploy Script
 *
 * 一键发布脚本：生成增量包 + 完整包 + manifest → 上传到更新服务器
 *
 * 在 Windows 或 macOS 构建机上，pnpm build:secure 之后运行。
 *
 * Usage:
 *   node --import tsx scripts/release-deploy.ts --version 2026.2.20 --server root@1.2.3.4
 *   node --import tsx scripts/release-deploy.ts --version 2026.2.20 --server root@1.2.3.4 --port 22
 *   node --import tsx scripts/release-deploy.ts --version 2026.2.20 --output-only   # 只生成不上传
 *
 * 前置条件:
 *   - pnpm build:secure 已执行 (dist/ 目录存在)
 *   - pnpm ui:build 已执行 (dist/control-ui/ 存在)
 *
 * 脚本做的事:
 *   1. 验证 dist/ 目录存在且包含加密文件
 *   2. 调用 generate-manifest.ts 生成 manifest.json + checksums.json
 *   3. 从 .release-cache/ 读取上一版本的 dist/，生成增量包
 *   4. 打包 full.tar.gz（dist/ + package.json + skills/ + extensions/）
 *   5. 打包 delta-from-{旧版本}.tar.gz
 *   6. 生成 latest.json
 *   7. scp 上传到更新服务器 /var/www/updates/releases/
 *   8. 缓存当前 dist/ 到 .release-cache/{版本号}/
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { execSync, spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

// ─── 配置 ─────────────────────────────────────────────

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
// CACHE_DIR: 允许通过 --cache-dir 覆盖，CI 场景下指向持久化目录
const CACHE_DIR_DEFAULT = path.join(ROOT_DIR, ".release-cache");
const DEPLOY_DIR = path.join(ROOT_DIR, ".release-deploy"); // 临时部署目录
/** 服务器上文件系统路径（用于 scp 上传） */
const SERVER_RELEASES_FS_PATH = "/var/www/updates/releases";
/** URL 路径（Nginx root = /var/www/updates，对外暴露 /releases/） */
const SERVER_RELEASES_URL_PATH = "/releases";

/** 保留最近几个版本的缓存用于增量包生成 */
const MAX_CACHED_VERSIONS = 5;

/** OSS 配置 (从环境变量读取) */
const OSS_CONFIG = {
  region: process.env.OSS_REGION ?? "oss-cn-hangzhou",
  accessKeyId: process.env.OSS_ACCESS_KEY_ID ?? "",
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET ?? "",
  bucket: process.env.OSS_BUCKET ?? "chuhai-tecbin",
  /** OSS 中的 key 前缀 */
  keyPrefix: process.env.OSS_KEY_PREFIX ?? "releases",
};

/** 完整包包含的目录/文件 */
const FULL_PACKAGE_INCLUDES = [
  "dist",
  "package.json",
  "skills",
  "extensions",
];

/** 完整包排除的模式 */
const FULL_PACKAGE_EXCLUDES = [
  "node_modules",
  ".git",
  ".update-temp",
  ".backups",
  "*.log",
  ".DS_Store",
  "Thumbs.db",
];

// ─── CLI 参数解析 ─────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    version: { type: "string", short: "v" },
    server: { type: "string", short: "s" },
    port: { type: "string", short: "p", default: "22" },
    protocol: { type: "string", default: "http" },
    "output-only": { type: "boolean", default: false },
    "skip-delta": { type: "boolean", default: false },
    "skip-upload": { type: "boolean", default: false },
    "delta-from": { type: "string" }, // 手动指定要对比的旧版本（逗号分隔）
    domain: { type: "string", short: "d" }, // 更新 URL 中使用的域名（默认取 server IP）
    oss: { type: "boolean", default: false }, // 使用阿里云 OSS 上传（替代 SCP）
    "oss-domain": { type: "string" }, // OSS 自定义域名 (如: dl.openclawcn.com)
    installers: { type: "string" }, // 包含 .exe/.dmg 安装包的目录路径
    "cache-dir": { type: "string" }, // 外部缓存目录（CI 持久化用）
    platform: { type: "string" }, // 构建平台: windows | macos（平台分目录上传）
    "notify-url": { type: "string" }, // 上传完成后通知服务端合并 latest.json 的 API 地址
    "notify-secret": { type: "string" }, // 通知 API 的鉴权密钥
    help: { type: "boolean", short: "h" },
  },
});

if (args.help) {
  console.log(`
OpenClawCN Release Deploy Script

Usage:
  node --import tsx scripts/release-deploy.ts [options]

Options:
  -v, --version <ver>     版本号 (如: 2026.2.20)，默认读取 package.json
  -s, --server <user@ip>  服务器地址 (如: root@47.98.123.45)
  -p, --port <port>       SSH 端口 (默认: 22)
  --protocol <proto>      更新 URL 协议 (默认: http)
  --output-only           只生成文件到 .release-deploy/，不上传
  --skip-delta            跳过增量包生成
  --skip-upload           跳过上传步骤
  --delta-from <vers>     手动指定增量包基准版本，逗号分隔
  -d, --domain <domain>   更新 URL 使用的域名 (默认: server IP)
  --oss                   使用阿里云 OSS 上传 (替代 SCP)
  --oss-domain <domain>   OSS 自定义域名 (如: dl.openclawcn.com)
  --installers <dir>      包含 Tauri 安装包(.exe/.dmg)的目录，上传到 installers/ 子目录
  --cache-dir <dir>       版本缓存目录 (默认: .release-cache/)，CI 可指向持久化路径
  --platform <plat>       构建平台 (windows|macos)，启用平台分目录上传
  --notify-url <url>      上传完成后通知服务端合并 latest.json 的 API URL
  --notify-secret <key>   通知 API 鉴权密钥 (或通过 RELEASE_NOTIFY_SECRET 环境变量)
  -h, --help              显示帮助

Environment (OSS mode):
  OSS_REGION              OSS 地域 (默认: oss-cn-hangzhou)
  OSS_ACCESS_KEY_ID       阿里云 AccessKey ID
  OSS_ACCESS_KEY_SECRET   阿里云 AccessKey Secret
  OSS_BUCKET              Bucket 名称 (默认: openclawcn-releases)
  OSS_KEY_PREFIX          Key 前缀 (默认: releases)

Examples:
  # SCP 上传到自有服务器
  node --import tsx scripts/release-deploy.ts -v 2026.2.20 -s root@47.98.123.45

  # 上传到阿里云 OSS
  node --import tsx scripts/release-deploy.ts -v 2026.2.20 --oss --oss-domain dl.openclawcn.com

  # 只生成，不上传（用于调试）
  node --import tsx scripts/release-deploy.ts -v 2026.2.20 --output-only

  # 指定从哪些旧版本生成增量包
  node --import tsx scripts/release-deploy.ts -v 2026.2.20 -s root@1.2.3.4 --delta-from 2026.2.18,2026.2.19

  # 同时上传 Tauri 桌面安装包
  node --import tsx scripts/release-deploy.ts -v 2026.2.20 -s root@1.2.3.4 --installers ./build-artifacts/
`);
  process.exit(0);
}

// ─── 工具函数 ─────────────────────────────────────────

function info(msg: string) {
  console.log(`\x1b[32m[INFO]\x1b[0m ${msg}`);
}

function warn(msg: string) {
  console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`);
}

function error(msg: string) {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`);
}

function step(n: number, total: number, msg: string) {
  console.log(`\n\x1b[36m[${n}/${total}]\x1b[0m ${msg}`);
}

function exec(cmd: string, opts?: { cwd?: string; silent?: boolean }) {
  const cwd = opts?.cwd ?? ROOT_DIR;
  if (!opts?.silent) {
    info(`执行: ${cmd}`);
  }
  try {
    const result = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: opts?.silent ? "pipe" : "inherit",
      shell: true,
    });
    return result;
  } catch (e) {
    error(`命令执行失败: ${cmd}`);
    throw e;
  }
}

function fileExists(p: string): boolean {
  return fs.existsSync(p);
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

function writeJson(p: string, data: unknown) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function fileSizeHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getGitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8", cwd: ROOT_DIR }).trim();
  } catch {
    return "unknown";
  }
}

function rmrf(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** 比较两个版本号字符串，返回 -1/0/1 */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

// ─── 核心逻辑 ─────────────────────────────────────────

async function main() {
  const totalSteps = 9;
  const startedAt = Date.now();

  console.log("");
  console.log("=========================================");
  console.log("  OpenClawCN Release Deploy");
  console.log("=========================================");
  console.log("");

  // ─── Step 1: 确定版本号 + 验证前置条件 ───

  step(1, totalSteps, "验证前置条件");

  const pkg = readJson<{ version: string }>(path.join(ROOT_DIR, "package.json"));
  const version = args.version ?? pkg.version;
  const server = args.server;
  const port = args.port ?? "22";
  const protocol = args.protocol ?? "http";
  const outputOnly = args["output-only"] ?? false;
  const skipDelta = args["skip-delta"] ?? false;
  const skipUpload = args["skip-upload"] ?? false;
  const useOss = args.oss ?? false;
  const ossDomain = args["oss-domain"];
  const installersDir = args.installers;
  const CACHE_DIR = args["cache-dir"] ? path.resolve(args["cache-dir"]) : CACHE_DIR_DEFAULT;
  const buildPlatform = args.platform as "windows" | "macos" | undefined;
  const notifyUrl = args["notify-url"];
  const notifySecret = args["notify-secret"] ?? process.env.RELEASE_NOTIFY_SECRET ?? "";

  if (buildPlatform && buildPlatform !== "windows" && buildPlatform !== "macos") {
    error(`--platform 值无效: ${buildPlatform}，仅支持 windows 或 macos`);
    process.exit(1);
  }

  info(`版本号: ${version}`);
  info(`Git commit: ${getGitCommit()}`);
  info(`上传方式: ${useOss ? "阿里云 OSS" : "SCP"}`);
  if (buildPlatform) info(`构建平台: ${buildPlatform}`);
  if (args["cache-dir"]) info(`缓存目录: ${CACHE_DIR} (自定义)`);

  if (!outputOnly && !skipUpload) {
    if (useOss) {
      if (!OSS_CONFIG.accessKeyId || !OSS_CONFIG.accessKeySecret) {
        error("OSS 模式需要设置环境变量: OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET");
        process.exit(1);
      }
      info(`OSS Bucket: ${OSS_CONFIG.bucket} (${OSS_CONFIG.region})`);
    } else if (!server) {
      error("必须指定 --server 参数 (如: --server root@47.98.123.45) 或使用 --oss / --output-only");
      process.exit(1);
    }
  }

  // 清理上次遗留的部署目录
  rmrf(DEPLOY_DIR);

  // 验证 dist/ 目录
  if (!fileExists(DIST_DIR)) {
    error("dist/ 目录不存在。请先运行 pnpm build:secure");
    process.exit(1);
  }

  // 验证加密文件存在
  const jscFiles = findFiles(DIST_DIR, (f) => f.endsWith(".jsc"));
  if (jscFiles.length === 0) {
    warn("未找到 .jsc 字节码文件，可能 build:secure 未正确执行");
  } else {
    info(`找到 ${jscFiles.length} 个 .jsc 字节码文件`);
  }

  // 验证 integrity hashes
  const integrityPath = path.join(DIST_DIR, "security", "integrity-hashes.json");
  if (!fileExists(integrityPath)) {
    warn("未找到 integrity-hashes.json，可能 integrity:gen 未执行");
  } else {
    info("integrity-hashes.json 存在");
  }

  // 验证 UI 构建
  const uiIndexPath = path.join(DIST_DIR, "control-ui", "index.html");
  if (!fileExists(uiIndexPath)) {
    warn("未找到 dist/control-ui/index.html，可能 ui:build 未执行");
  }

  // ─── Step 1.5: 生成 CHANGELOG ───

  step(2, totalSteps, "生成 CHANGELOG");

  const changelogPath = path.join(ROOT_DIR, "CHANGELOG.md");
  const versionRecordPath = path.join(ROOT_DIR, "versionrecord.md");

  if (fileExists(versionRecordPath)) {
    info("从 versionrecord.md 生成 CHANGELOG.md（带版本标记注入）...");
    try {
      exec(
        `node --import tsx scripts/generate-changelog.ts --version ${version} --inject-marker`,
      );
      info("CHANGELOG.md 生成完成");
    } catch (e) {
      warn(`CHANGELOG 生成失败: ${e instanceof Error ? e.message : String(e)}`);
      warn("继续发布流程（使用现有 CHANGELOG 或无 changelog）");
    }
  } else {
    warn("versionrecord.md 不存在，跳过 CHANGELOG 生成");
  }

  // ─── Step 3: 生成 manifest.json + checksums.json ───

  step(3, totalSteps, "生成 manifest.json 和 checksums.json");

  // 直接调用已有的 generate-manifest.ts
  exec("node --import tsx scripts/generate-manifest.ts");

  const manifestPath = path.join(ROOT_DIR, "manifest.json");
  const checksumsPath = path.join(ROOT_DIR, "checksums.json");

  if (!fileExists(manifestPath)) {
    error("manifest.json 生成失败");
    process.exit(1);
  }
  info("manifest.json 生成完成");

  // ─── Step 3: 生成增量包 ───

  step(4, totalSteps, "生成增量包");

  // 平台模式下文件放入 {version}/{platform}/ 子目录（Step 4 delta 和 Step 5 full 都需要）
  const platformSubDir = buildPlatform ? path.join(version, buildPlatform) : version;

  interface DeltaInfo {
    fromVersion: string;
    tarName: string;
    tarPath: string;
    size: number;
    sha256: string;
  }

  const deltas: DeltaInfo[] = [];

  if (skipDelta) {
    info("跳过增量包生成 (--skip-delta)");
  } else {
    // 确定要对比的旧版本
    let oldVersions: string[] = [];

    if (args["delta-from"]) {
      // 手动指定
      oldVersions = (args["delta-from"] as string).split(",").map((v) => v.trim());
      info(`手动指定增量基准版本: ${oldVersions.join(", ")}`);
    } else {
      // 自动从 .release-cache/ 获取
      oldVersions = getCachedVersions(CACHE_DIR);
      if (oldVersions.length > 0) {
        info(`从缓存中找到的历史版本: ${oldVersions.join(", ")}`);
      } else {
        info("没有找到历史版本缓存，跳过增量包生成（这是首次发布）");
      }
    }

    // 对每个旧版本生成增量包
    for (const oldVersion of oldVersions) {
      const oldDistDir = path.join(CACHE_DIR, oldVersion, "dist");
      if (!fileExists(oldDistDir)) {
        warn(`旧版本 ${oldVersion} 的 dist/ 缓存不存在: ${oldDistDir}`);
        continue;
      }

      info(`生成增量包: ${oldVersion} → ${version}`);

      const deltaOutputDir = path.join(DEPLOY_DIR, `delta-from-${oldVersion}`);
      rmrf(deltaOutputDir);

      // 调用已有的 generate-delta-package.ts
      exec(
        `node --import tsx scripts/generate-delta-package.ts --from "${oldDistDir}" --to "${DIST_DIR}" --output "${deltaOutputDir}"`,
      );

      // 检查增量包是否有内容
      const deltaJsonPath = path.join(deltaOutputDir, "delta.json");
      if (!fileExists(deltaJsonPath)) {
        warn(`增量包 delta.json 生成失败，跳过 ${oldVersion}`);
        continue;
      }

      const deltaManifest = readJson<{
        added: unknown[];
        modified: unknown[];
        removed: string[];
        totalFiles: number;
      }>(deltaJsonPath);

      const hasChanges = deltaManifest.totalFiles > 0 || deltaManifest.removed.length > 0;
      if (!hasChanges) {
        info(`${oldVersion} → ${version} 没有文件变更，跳过`);
        rmrf(deltaOutputDir);
        continue;
      }

      // 打包 delta
      const tarName = `delta-from-${oldVersion}.tar.gz`;
      const tarPath = path.join(DEPLOY_DIR, platformSubDir, tarName);
      fs.mkdirSync(path.join(DEPLOY_DIR, platformSubDir), { recursive: true });

      tarDirectory(deltaOutputDir, tarPath);

      const tarSize = fs.statSync(tarPath).size;
      info(`增量包 ${tarName}: ${fileSizeHuman(tarSize)} (${deltaManifest.totalFiles} 文件变更, ${deltaManifest.removed.length} 文件删除)`);

      const tarSha256 = sha256File(tarPath);
      deltas.push({
        fromVersion: oldVersion,
        tarName,
        tarPath,
        size: tarSize,
        sha256: tarSha256,
      });

      // 清理临时增量目录
      rmrf(deltaOutputDir);
    }

    if (deltas.length > 0) {
      info(`共生成 ${deltas.length} 个增量包`);
    }
  }

  // ─── Step 4: 打包 full.tar.gz ───

  step(5, totalSteps, "打包 full.tar.gz");

  const fullTarPath = path.join(DEPLOY_DIR, platformSubDir, "full.tar.gz");
  fs.mkdirSync(path.join(DEPLOY_DIR, platformSubDir), { recursive: true });

  tarFullPackage(fullTarPath);

  const fullTarSize = fs.statSync(fullTarPath).size;
  info(`full.tar.gz: ${fileSizeHuman(fullTarSize)}`);

  // ─── Step 5: 复制 manifest + checksums ───

  step(6, totalSteps, "准备部署文件");

  const versionDir = path.join(DEPLOY_DIR, platformSubDir);

  // 复制 manifest.json
  fs.copyFileSync(manifestPath, path.join(versionDir, "manifest.json"));
  // 复制 checksums.json
  if (fileExists(checksumsPath)) {
    fs.copyFileSync(checksumsPath, path.join(versionDir, "checksums.json"));
  }

  // 生成 full.tar.gz 的 sha256
  const fullSha256 = sha256File(fullTarPath);
  fs.writeFileSync(path.join(versionDir, "full.tar.gz.sha256"), fullSha256, "utf-8");

  info("部署文件准备完成:");
  const deployFiles = fs.readdirSync(versionDir);
  for (const f of deployFiles) {
    const size = fs.statSync(path.join(versionDir, f)).size;
    info(`  ${f} (${fileSizeHuman(size)})`);
  }

  // ─── Step 6: 生成 platform-manifest.json / latest.json ───

  step(7, totalSteps, buildPlatform ? "生成 platform-manifest.json" : "生成 latest.json");

  // 根据上传方式确定下载 URL 前缀
  let urlBase: string;
  if (useOss) {
    if (ossDomain) {
      urlBase = `https://${ossDomain}/${OSS_CONFIG.keyPrefix}`;
    } else {
      urlBase = `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.region}.aliyuncs.com/${OSS_CONFIG.keyPrefix}`;
    }
  } else {
    const serverHost = args.domain ?? (server ? server.split("@")[1] ?? server : null);
    if (!serverHost) {
      warn("未指定 --domain 且无 --server，URL 将使用 PLACEHOLDER_HOST");
      warn("发布前请用 --domain 参数指定实际域名或 IP");
    }
    const urlHost = serverHost ?? "PLACEHOLDER_HOST";
    urlBase = `${protocol}://${urlHost}${SERVER_RELEASES_URL_PATH}`;
  }

  // URL 子路径：平台模式下包含平台子目录
  const urlSubDir = buildPlatform ? `${version}/${buildPlatform}` : version;

  // ─── Stage desktop installers (if --installers provided) ───
  // installers 始终在 {version}/installers/（平台无关，通过文件名区分）

  interface InstallerInfo {
    url: string;
    size: number;
    sha256: string;
    filename: string;
  }
  const installers: Record<string, InstallerInfo> = {};

  if (installersDir && fileExists(installersDir)) {
    info("处理桌面安装包...");
    // installers 目录始终在 version 层（非平台子目录），便于服务端合并
    const installersDeployDir = path.join(DEPLOY_DIR, version, "installers");
    fs.mkdirSync(installersDeployDir, { recursive: true });

    const entries = fs.readdirSync(installersDir);
    for (const entry of entries) {
      const fullPath = path.join(installersDir, entry);
      if (!fs.statSync(fullPath).isFile()) continue;

      const ext = path.extname(entry).toLowerCase();
      let installerPlatform: string | null = null;
      if (ext === ".exe") installerPlatform = "windows-nsis";
      else if (ext === ".dmg") installerPlatform = "macos";
      else if (ext === ".msi") installerPlatform = "windows-msi";
      else if (ext === ".deb") installerPlatform = "linux-deb";
      else if (ext === ".appimage") installerPlatform = "linux-appimage";

      if (!installerPlatform) continue;

      info(`  ${entry} → ${installerPlatform}`);
      fs.copyFileSync(fullPath, path.join(installersDeployDir, entry));

      const size = fs.statSync(fullPath).size;
      const hash = sha256File(fullPath);

      installers[installerPlatform] = {
        url: `${urlBase}/${version}/installers/${entry}`,
        size,
        sha256: hash,
        filename: entry,
      };

      info(`    SHA256: ${hash}`);
      info(`    Size: ${fileSizeHuman(size)}`);
    }

    if (Object.keys(installers).length > 0) {
      info(`共 ${Object.keys(installers).length} 个平台安装包已暂存`);
    } else {
      warn(`--installers 目录 ${installersDir} 中未找到 .exe/.dmg 安装包`);
    }
  }

  // ─── 生成 manifest JSON ───

  if (buildPlatform) {
    // 平台模式：生成 platform-manifest.json（由服务端合并为 latest.json）
    interface PlatformManifest {
      platform: string;
      version: string;
      buildTime: string;
      gitCommit: string;
      nodeVersion: string;
      url: { full: string; manifest: string; checksums: string };
      deltas: { from: string; url: string; size: number; sha256: string }[];
      fullSize: number;
      fullSha256: string;
      installers: Record<string, InstallerInfo>;
      changelog: { "zh-CN": string; "en-US": string };
    }

    const platformManifest: PlatformManifest = {
      platform: buildPlatform,
      version,
      buildTime: new Date().toISOString(),
      gitCommit: getGitCommit(),
      nodeVersion: process.version,
      url: {
        full: `${urlBase}/${urlSubDir}/full.tar.gz`,
        manifest: `${urlBase}/${urlSubDir}/manifest.json`,
        checksums: `${urlBase}/${urlSubDir}/checksums.json`,
      },
      deltas: deltas.map((d) => ({
        from: d.fromVersion,
        url: `${urlBase}/${urlSubDir}/${d.tarName}`,
        size: d.size,
        sha256: d.sha256,
      })),
      fullSize: fullTarSize,
      fullSha256,
      installers,
      changelog: readChangelogLatest(),
    };

    const pmPath = path.join(DEPLOY_DIR, platformSubDir, "platform-manifest.json");
    writeJson(pmPath, platformManifest);
    info(`platform-manifest.json (${buildPlatform}) 生成完成`);
  } else {
    // 旧模式（无 --platform）：直接生成 latest.json
    interface LatestJson {
      version: string;
      buildTime: string;
      gitCommit: string;
      nodeVersion: string;
      url: { full: string; manifest: string; checksums: string };
      deltas: { from: string; url: string; size: number; sha256: string }[];
      fullSize: number;
      fullSha256: string;
      changelog: { "zh-CN": string; "en-US": string };
      installers?: Record<string, InstallerInfo>;
    }

    const latestJson: LatestJson = {
      version,
      buildTime: new Date().toISOString(),
      gitCommit: getGitCommit(),
      nodeVersion: process.version,
      url: {
        full: `${urlBase}/${version}/full.tar.gz`,
        manifest: `${urlBase}/${version}/manifest.json`,
        checksums: `${urlBase}/${version}/checksums.json`,
      },
      deltas: deltas.map((d) => ({
        from: d.fromVersion,
        url: `${urlBase}/${version}/${d.tarName}`,
        size: d.size,
        sha256: d.sha256,
      })),
      fullSize: fullTarSize,
      fullSha256,
      changelog: readChangelogLatest(),
    };

    if (Object.keys(installers).length > 0) {
      latestJson.installers = installers;
    }

    const latestJsonPath = path.join(DEPLOY_DIR, "latest.json");
    writeJson(latestJsonPath, latestJson);
    info("latest.json 生成完成");
  }

  // ─── Step 7: 上传到服务器 ───

  step(8, totalSteps, "上传到服务器");

  if (outputOnly || skipUpload) {
    info("跳过上传 (--output-only / --skip-upload)");
    info(`部署文件在: ${DEPLOY_DIR}`);
  } else if (useOss) {
    await uploadToOss(version, ossDomain, buildPlatform);
  } else {
    uploadToServer(server!, port, version, buildPlatform);
  }

  // ─── Step 8.5: 通知服务端合并 latest.json（平台模式） ───

  if (buildPlatform && !outputOnly && !skipUpload && notifyUrl) {
    info(`通知服务端合并 latest.json: ${notifyUrl}`);
    try {
      const notifyRes = await fetch(notifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version,
          platform: buildPlatform,
          ossDomain: ossDomain ?? `${OSS_CONFIG.bucket}.${OSS_CONFIG.region}.aliyuncs.com`,
          ossPrefix: OSS_CONFIG.keyPrefix,
          secret: notifySecret,
        }),
      });
      if (notifyRes.ok) {
        const notifyData = await notifyRes.json() as { ok: boolean; mergedPlatforms?: string[] };
        info(`服务端合并完成: ${JSON.stringify(notifyData.mergedPlatforms ?? [])}`);
      } else {
        warn(`服务端通知失败: HTTP ${notifyRes.status}`);
      }
    } catch (e) {
      warn(`服务端通知异常: ${e instanceof Error ? e.message : String(e)}`);
      warn("平台文件已上传，服务端可稍后手动合并 latest.json");
    }
  }

  // ─── Step 9: 缓存当前 dist/ ───

  step(9, totalSteps, "缓存当前版本 dist/");

  cacheCurrentDist(version, CACHE_DIR);

  // ─── 完成 ───

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log("");
  console.log("=========================================");
  console.log(`  发布完成! v${version}`);
  console.log(`  耗时: ${durationSec}s`);
  console.log("=========================================");
  console.log("");

  if (!outputOnly && !skipUpload) {
    if (buildPlatform) {
      info(`平台文件已上传: ${urlBase}/${urlSubDir}/`);
      info(`服务端将合并生成: ${urlBase}/latest.json`);
    } else {
      info("验证部署:");
      info(`  curl ${urlBase}/latest.json`);
      info(`  curl ${urlBase}/${version}/manifest.json`);
    }
  }

  info(`部署文件: ${DEPLOY_DIR}`);
  info(`版本缓存: ${path.join(CACHE_DIR, version)}`);

  // 清理临时 manifest/checksums
  safeUnlink(manifestPath);
  safeUnlink(checksumsPath);

  console.log("");
}

// ─── 辅助函数 ─────────────────────────────────────────

/** 递归列出目录下所有文件的相对路径 */
function findFilesRecursive(dir: string, base = ""): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = base ? path.join(base, entry.name) : entry.name;
    if (entry.isDirectory()) {
      results.push(...findFilesRecursive(path.join(dir, entry.name), relPath));
    } else {
      results.push(relPath);
    }
  }
  return results;
}

/** 递归查找文件 */
function findFiles(dir: string, predicate: (name: string) => boolean): string[] {
  const results: string[] = [];
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".git") {
          walk(full);
        }
      } else if (predicate(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

/** 获取缓存中的历史版本列表（按版本号倒序） */
function getCachedVersions(cacheDir: string = CACHE_DIR_DEFAULT): string[] {
  if (!fileExists(cacheDir)) return [];

  const versions = fs
    .readdirSync(cacheDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d+\.\d+\.\d+/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => compareVersions(b, a)); // 倒序：最新的在前

  // 只返回最近几个版本
  return versions.slice(0, MAX_CACHED_VERSIONS);
}

/** 使用 tar 打包目录 */
function tarDirectory(sourceDir: string, outputPath: string) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const dirName = path.basename(sourceDir);
  const parentDir = path.dirname(sourceDir);

  // Prefer Windows built-in tar (handles native paths), fall back to Git tar with POSIX paths
  const tarCmd = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";
  const tarArgs = ["-czf", outputPath, "-C", parentDir, dirName];

  info(`执行: ${tarCmd} ${tarArgs.join(" ")}`);
  const result = spawnSync(tarCmd, tarArgs, {
    cwd: ROOT_DIR,
    stdio: "pipe",
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`tar failed (exit ${result.status}): ${result.stderr ?? ""}`);
  }
}

/** 打包完整更新包 */
function tarFullPackage(outputPath: string) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const includes = FULL_PACKAGE_INCLUDES.filter((p) => fileExists(path.join(ROOT_DIR, p)));
  const excludeArgs = FULL_PACKAGE_EXCLUDES.flatMap((e) => [`--exclude`, e]);

  // Prefer Windows built-in tar (handles native paths), fall back to Git tar with POSIX paths
  const tarCmd = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";
  const tarArgs = ["-czf", outputPath, ...excludeArgs, ...includes];

  info(`执行: ${tarCmd} ${tarArgs.join(" ")}`);
  const result = spawnSync(tarCmd, tarArgs, {
    cwd: ROOT_DIR,
    stdio: "pipe",
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`tar failed (exit ${result.status}): ${result.stderr ?? ""}`);
  }
}

/** 找 Git 自带的 tar */
function findGitTar(): string | null {
  const candidates = [
    "C:\\Program Files\\Git\\usr\\bin\\tar.exe",
    "C:\\Program Files (x86)\\Git\\usr\\bin\\tar.exe",
  ];
  for (const c of candidates) {
    if (fileExists(c)) return c;
  }
  return null;
}

/** Convert Windows path to POSIX for Git tar (D:\foo → /d/foo) */
function toPosixPath(p: string): string {
  if (process.platform !== "win32") return p;
  // D:\foo\bar → /d/foo/bar  (Git tar interprets D: as remote host)
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
}

/** 上传到阿里云 OSS */
async function uploadToOss(version: string, ossDomain?: string, buildPlatform?: string) {
  const require = createRequire(import.meta.url);
  // Node 24+ 移除了全局 Buffer，ali-oss 的依赖 formstream 需要它
  globalThis.Buffer = globalThis.Buffer || require("buffer").Buffer;
  // ali-oss 是 CJS 模块（export = OSS），需要 createRequire 加载
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const OSS = require("ali-oss") as new (options: Record<string, unknown>) => {
    put(key: string, localPath: string): Promise<{ url: string }>;
    multipartUpload(
      key: string,
      localPath: string,
      options?: { progress?: (p: number) => void },
    ): Promise<{ url: string }>;
  };

  const client = new OSS({
    region: OSS_CONFIG.region,
    accessKeyId: OSS_CONFIG.accessKeyId,
    accessKeySecret: OSS_CONFIG.accessKeySecret,
    bucket: OSS_CONFIG.bucket,
  });

  const prefix = OSS_CONFIG.keyPrefix;

  // 平台模式: 上传 {version}/{platform}/ 下的平台文件 + {version}/installers/
  // 旧模式: 上传 {version}/ 下的所有文件 + latest.json
  const deployBaseDir = path.join(DEPLOY_DIR, version);

  // 上传版本目录中的所有文件（递归，包含平台子目录和 installers/）
  const allFiles = findFilesRecursive(deployBaseDir);
  info(`上传 ${allFiles.length} 个文件到 OSS: ${OSS_CONFIG.bucket}/${prefix}/${version}/`);

  for (const relPath of allFiles) {
    const localPath = path.join(deployBaseDir, relPath);
    const ossKey = `${prefix}/${version}/${relPath.replace(/\\/g, "/")}`;
    const size = fs.statSync(localPath).size;

    info(`  上传 ${relPath} (${fileSizeHuman(size)})...`);

    if (size > 100 * 1024 * 1024) {
      await client.multipartUpload(ossKey, localPath, {
        progress: (p: number) => {
          if (Math.round(p * 100) % 25 === 0) {
            info(`    进度: ${Math.round(p * 100)}%`);
          }
        },
      });
    } else {
      await client.put(ossKey, localPath);
    }
  }

  // 旧模式（无 --platform）：上传 latest.json 到 releases/ 根目录
  // 平台模式：不上传 latest.json，由服务端合并生成
  if (!buildPlatform) {
    const latestJsonPath = path.join(DEPLOY_DIR, "latest.json");
    info("  上传 latest.json...");
    await client.put(`${prefix}/latest.json`, latestJsonPath);
  }

  const urlHost = ossDomain
    ? `https://${ossDomain}`
    : `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.region}.aliyuncs.com`;

  info("上传完成!");
  if (buildPlatform) {
    info(`  平台文件: ${urlHost}/${prefix}/${version}/${buildPlatform}/`);
  } else {
    info(`  latest.json: ${urlHost}/${prefix}/latest.json`);
  }
  info(`  full.tar.gz: ${urlHost}/${prefix}/${version}/${buildPlatform ? buildPlatform + "/" : ""}full.tar.gz`);
}

/** scp 上传到服务器 */
function uploadToServer(server: string, port: string, version: string, buildPlatform?: string) {
  const deployBaseDir = path.join(DEPLOY_DIR, version);

  info(`上传到 ${server}:${SERVER_RELEASES_FS_PATH}/${version}/`);

  // 递归创建远程目录
  // 平台目录和 installers 目录是并列的，不能串联拼接
  const mkdirPaths: string[] = [];
  if (buildPlatform) {
    mkdirPaths.push(`${SERVER_RELEASES_FS_PATH}/${version}/${buildPlatform}`);
  } else {
    mkdirPaths.push(`${SERVER_RELEASES_FS_PATH}/${version}`);
  }
  const hasInstallerFiles = fs.existsSync(path.join(deployBaseDir, "installers"));
  if (hasInstallerFiles) {
    mkdirPaths.push(`${SERVER_RELEASES_FS_PATH}/${version}/installers`);
  }
  exec(`ssh -p ${port} ${server} "mkdir -p ${mkdirPaths.join(" ")}"`, { silent: true });

  // 上传版本目录中的所有文件
  const allFiles = findFilesRecursive(deployBaseDir);
  for (const relPath of allFiles) {
    const localPath = path.join(deployBaseDir, relPath);
    const remotePath = `${SERVER_RELEASES_FS_PATH}/${version}/${relPath.replace(/\\/g, "/")}`;
    info(`  上传 ${relPath}...`);
    exec(
      `scp -P ${port} "${localPath}" ${server}:${remotePath}`,
      { silent: true },
    );
  }

  // 旧模式：上传 latest.json；平台模式：不上传（由服务端合并）
  if (!buildPlatform) {
    const latestJsonPath = path.join(DEPLOY_DIR, "latest.json");
    info("  上传 latest.json...");
    exec(`scp -P ${port} "${latestJsonPath}" ${server}:${SERVER_RELEASES_FS_PATH}/`, { silent: true });
  }

  info("上传完成!");
}

/** 缓存当前版本的 dist/ */
function cacheCurrentDist(version: string, cacheDir: string = CACHE_DIR_DEFAULT) {
  const cacheVersionDir = path.join(cacheDir, version);
  const cacheDist = path.join(cacheVersionDir, "dist");

  // 如果已存在，先删除
  rmrf(cacheVersionDir);
  fs.mkdirSync(cacheVersionDir, { recursive: true });

  info(`缓存 dist/ → ${cacheDist}`);

  // 复制 dist/ 目录
  copyDirRecursive(DIST_DIR, cacheDist);

  // 同时缓存 package.json（用于依赖变更检测）
  fs.copyFileSync(
    path.join(ROOT_DIR, "package.json"),
    path.join(cacheVersionDir, "package.json"),
  );

  // 清理过旧的缓存
  cleanupOldCaches(cacheDir);

  info(`缓存完成 (${version})`);
}

/** 递归复制目录 */
function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        copyDirRecursive(srcPath, destPath);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** 清理旧版本缓存，只保留最近 MAX_CACHED_VERSIONS 个 */
function cleanupOldCaches(cacheDir: string = CACHE_DIR_DEFAULT) {
  if (!fileExists(cacheDir)) return;

  const versions = fs
    .readdirSync(cacheDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d+\.\d+\.\d+/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => compareVersions(b, a));

  const toDelete = versions.slice(MAX_CACHED_VERSIONS);
  for (const v of toDelete) {
    info(`清理旧缓存: ${v}`);
    rmrf(path.join(cacheDir, v));
  }
}

/** 读取 CHANGELOG.md 最新条目 */
function readChangelogLatest(): { "zh-CN": string; "en-US": string } {
  try {
    const changelogPath = path.join(ROOT_DIR, "CHANGELOG.md");
    if (!fileExists(changelogPath)) {
      return { "zh-CN": "", "en-US": "" };
    }
    const content = fs.readFileSync(changelogPath, "utf-8");
    const lines = content.split("\n");
    const latest: string[] = [];
    let inLatest = false;

    for (const line of lines) {
      if (line.startsWith("## ") && !inLatest) {
        inLatest = true;
        latest.push(line);
        continue;
      }
      if ((line.startsWith("## ") || line === "---") && inLatest) {
        break;
      }
      if (inLatest) {
        latest.push(line);
      }
    }

    const text = latest.join("\n").trim();
    return { "zh-CN": text, "en-US": text };
  } catch {
    return { "zh-CN": "", "en-US": "" };
  }
}

function safeUnlink(p: string) {
  try {
    if (fileExists(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

// ─── 入口 ─────────────────────────────────────────────

main().catch((err) => {
  error(`发布失败: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
