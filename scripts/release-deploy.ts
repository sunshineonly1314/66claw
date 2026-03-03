#!/usr/bin/env node
/**
 * OpenClawCN Release Deploy Script
 *
 * 一键发布脚本：生成增量包 + 完整包 + manifest → 上传到更新服务器
 *
 * 在 Windows 或 macOS 构建机上，pnpm build:secure 之后运行。
 *
 * Usage:
 *   node --import tsx scripts/release-deploy.ts --version 1.2.0 --server root@1.2.3.4
 *   node --import tsx scripts/release-deploy.ts --version 1.2.0 --server root@1.2.3.4 --port 22
 *   node --import tsx scripts/release-deploy.ts --version 1.2.0 --output-only   # 只生成不上传
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
const SERVER_RELEASES_FS_PATH = "/data/dl/releases";
/** URL 路径（Nginx root = /data/dl，对外暴露 /releases/） */
const SERVER_RELEASES_URL_PATH = "/releases";

/** 保留最近几个版本的缓存用于增量包生成（缓存含 skills/extensions/data，适当减少） */
const MAX_CACHED_VERSIONS = 3;

/** OSS 配置 (从环境变量读取) */
const OSS_CONFIG = {
  region: process.env.OSS_REGION ?? "oss-cn-hangzhou",
  accessKeyId: process.env.OSS_ACCESS_KEY_ID ?? "",
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET ?? "",
  bucket: process.env.OSS_BUCKET ?? "chuhai-tecbin",
  /** OSS 中的 key 前缀 */
  keyPrefix: process.env.OSS_KEY_PREFIX ?? "releases",
};

/** 完整包包含的目录/文件（通过 staging 方式打包，不再直接 tar 根目录） */
const FULL_PACKAGE_INCLUDES = [
  "dist",
  "package.json",
  "skills",
  "extensions",
  "data",
  "docs",
  "node_modules",
  "install.json",
  "version.json",
];

/** 完整包排除的模式（仅用于 tar 的 --exclude，staging 模式下不再使用） */
const FULL_PACKAGE_EXCLUDES = [
  ".git",
  ".update-temp",
  ".backups",
  "*.log",
  ".DS_Store",
  "Thumbs.db",
];

/** data/ 种子文件白名单（与 prepare-resources.sh/ps1 保持一致） */
const DATA_SEED_FILES = [
  "mcp-index.db",
  "mcp-index.json",
  "tool-index.sqlite",
  "skill-availability-dictionary.json",
  "skill-availability-schema.json",
  "skill-verification-needed.json",
  "skills-availability-dictionary.json",
  "skills-availability-dictionary-enriched.json",
  "README-skill-availability.md",
];
const DATA_SEED_DIRS = ["subagents", "qrcodes"];

/** 增量对比需要覆盖的额外目录（dist/ 之外） */
const DELTA_EXTRA_DIRS = ["skills", "extensions", "data", "docs/reference/templates"];

/** node_modules 增量包大小上限（超过则跳过，让客户端 npm install） */
const NM_DELTA_SIZE_LIMIT = 200 * 1024 * 1024; // 200MB

// ─── CLI 参数解析 ─────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    version: { type: "string", short: "v" },
    server: { type: "string", short: "s" },
    port: { type: "string", short: "p", default: "22" },
    protocol: { type: "string", default: "https" },
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
  -v, --version <ver>     版本号 (如: 1.2.0)，默认读取 package.json
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

// ─── 输入校验（防止 shell 注入） ─────────────────────

/** 校验 CLI 参数中不含 shell 元字符，防止 exec() 命令注入 */
function assertSafeShellArg(name: string, value: string): void {
  // 允许: 字母、数字、.、-、_、:、@、/、\（路径）
  // 拒绝: ;、|、&、`、$、(、)、{、}、<、>、换行等
  if (/[;|&`$(){}<>\n\r]/.test(value)) {
    throw new Error(`参数 --${name} 含有不安全字符: ${JSON.stringify(value)}`);
  }
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
  const totalSteps = 10;
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
      const cacheVersionDir = path.join(CACHE_DIR, oldVersion);
      const oldDistDir = path.join(cacheVersionDir, "dist");
      if (!fileExists(oldDistDir)) {
        warn(`旧版本 ${oldVersion} 的 dist/ 缓存不存在: ${oldDistDir}`);
        continue;
      }

      info(`生成增量包: ${oldVersion} → ${version}`);

      const deltaOutputDir = path.join(DEPLOY_DIR, `delta-from-${oldVersion}`);
      rmrf(deltaOutputDir);

      // 1. dist/ 增量（原有逻辑）
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
        added: Array<{ path: string; sha256: string; size: number }>;
        modified: Array<{ path: string; sha256: string; size: number }>;
        removed: string[];
        totalFiles: number;
        totalSize: number;
      }>(deltaJsonPath);

      // 2. 额外目录增量（skills/, extensions/, data/, docs/reference/templates/）
      for (const dirName of DELTA_EXTRA_DIRS) {
        const oldDir = path.join(cacheVersionDir, dirName);
        // data/ 需要特殊处理：只对比种子文件
        let newDir: string;
        if (dirName === "data") {
          // Stage 当前种子数据到临时目录用于对比
          const seedStageDir = path.join(DEPLOY_DIR, `.seed-data-stage-${oldVersion}`);
          rmrf(seedStageDir);
          fs.mkdirSync(seedStageDir, { recursive: true });
          stageSeedData(seedStageDir);
          newDir = path.join(seedStageDir, "data");
        } else {
          newDir = path.join(ROOT_DIR, dirName);
        }

        if (!fileExists(oldDir) && !fileExists(newDir)) continue;

        if (fileExists(oldDir) && fileExists(newDir)) {
          // 正常对比：调用 generate-delta-package.ts
          const subKey = dirName.replace(/\//g, "-");
          const subDeltaDir = path.join(DEPLOY_DIR, `delta-sub-${oldVersion}-${subKey}`);
          rmrf(subDeltaDir);
          exec(
            `node --import tsx scripts/generate-delta-package.ts --from "${oldDir}" --to "${newDir}" --output "${subDeltaDir}"`,
          );
          mergeSubDelta(subDeltaDir, dirName, deltaOutputDir, deltaManifest);
          rmrf(subDeltaDir);
        } else if (!fileExists(oldDir) && fileExists(newDir)) {
          // 新目录：所有文件标记为 added
          info(`  ${dirName}/ 是新增目录，全部标记为 added`);
          const allFiles = findFilesRecursive(newDir);
          for (const relFile of allFiles) {
            const prefixed = `${dirName}/${relFile}`.replace(/\\/g, "/");
            const src = path.join(newDir, relFile);
            const dest = path.join(deltaOutputDir, "added", prefixed);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
            const stats = fs.statSync(src);
            deltaManifest.added.push({ path: prefixed, sha256: sha256File(src), size: stats.size });
            deltaManifest.totalFiles++;
            deltaManifest.totalSize += stats.size;
          }
        } else if (fileExists(oldDir) && !fileExists(newDir)) {
          // 目录被删除：标记为目录删除
          info(`  ${dirName}/ 已删除，标记为 removed`);
          deltaManifest.removed.push(`${dirName}/`);
        }

        // 清理 seed stage 临时目录
        if (dirName === "data") {
          rmrf(path.join(DEPLOY_DIR, `.seed-data-stage-${oldVersion}`));
        }
      }

      // 3. node_modules 包级别增量
      generateNodeModulesDelta(cacheVersionDir, deltaOutputDir, deltaManifest);

      // 4. package.json 变更检测（CR-3: 防止依赖变更后 MODULE_NOT_FOUND）
      {
        const newPkgPath = path.join(ROOT_DIR, "package.json");
        const oldPkgPath = path.join(cacheVersionDir, "package.json");
        if (fileExists(newPkgPath)) {
          const newPkgHash = sha256File(newPkgPath);
          const oldPkgHash = fileExists(oldPkgPath) ? sha256File(oldPkgPath) : null;
          if (oldPkgHash !== newPkgHash) {
            const pkgSize = fs.statSync(newPkgPath).size;
            const destDir = oldPkgHash ? "modified" : "added";
            fs.mkdirSync(path.join(deltaOutputDir, destDir), { recursive: true });
            fs.copyFileSync(newPkgPath, path.join(deltaOutputDir, destDir, "package.json"));
            const entry = { path: "package.json", sha256: newPkgHash, size: pkgSize };
            if (oldPkgHash) {
              deltaManifest.modified.push(entry);
            } else {
              deltaManifest.added.push(entry);
            }
            deltaManifest.totalFiles++;
            deltaManifest.totalSize += pkgSize;
            info(`  package.json 已纳入增量包 (${destDir})`);
          }
        }
      }

      // 5. 元数据文件（install.json, version.json）
      for (const metaFile of ["install.json", "version.json"]) {
        const newPath = path.join(ROOT_DIR, metaFile);
        const oldPath = path.join(cacheVersionDir, metaFile);
        if (fileExists(newPath)) {
          const newHash = sha256File(newPath);
          const oldHash = fileExists(oldPath) ? sha256File(oldPath) : null;
          if (oldHash !== newHash) {
            const size = fs.statSync(newPath).size;
            const destDir = oldHash ? "modified" : "added";
            fs.mkdirSync(path.join(deltaOutputDir, destDir), { recursive: true });
            fs.copyFileSync(newPath, path.join(deltaOutputDir, destDir, metaFile));
            const entry = { path: metaFile, sha256: newHash, size };
            if (oldHash) {
              deltaManifest.modified.push(entry);
            } else {
              deltaManifest.added.push(entry);
            }
            deltaManifest.totalFiles++;
            deltaManifest.totalSize += size;
            info(`  ${metaFile} 已纳入增量包 (${destDir})`);
          }
        }
      }

      // 回写完整的 delta.json
      fs.writeFileSync(deltaJsonPath, JSON.stringify(deltaManifest, null, 2), "utf-8");

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

  // ─── Step 6.5: Ed25519 签名 ───

  step(7, totalSteps, "Ed25519 签名");

  const signingPrivateKeyRaw = process.env.UPDATE_SIGNING_PRIVATE_KEY?.trim();
  // CR-12: CI 环境变量中换行符可能被转义为 \n 字面量，需要还原为真实换行符
  const signingPrivateKey = signingPrivateKeyRaw?.replace(/\\n/g, "\n");
  if (signingPrivateKey) {
    // 验证 PEM 格式
    if (!signingPrivateKey.includes("-----BEGIN")) {
      error("UPDATE_SIGNING_PRIVATE_KEY 格式错误：需要 PEM 格式（以 -----BEGIN 开头）");
      error("提示：如果密钥是 base64 编码的 DER，请用 openssl 转换为 PEM 格式");
      process.exit(1);
    }

    // 预先测试密钥可用性
    try {
      crypto.createPrivateKey(signingPrivateKey);
    } catch (e) {
      error(`UPDATE_SIGNING_PRIVATE_KEY 解析失败: ${e instanceof Error ? e.message : String(e)}`);
      error("请检查密钥格式是否完整（包含 BEGIN/END 行和正确的换行）");
      process.exit(1);
    }

    info("检测到 UPDATE_SIGNING_PRIVATE_KEY，为发布文件生成 Ed25519 签名...");

    const privateKeyObj = crypto.createPrivateKey(signingPrivateKey);

    function signFile(filePath: string): void {
      const content = fs.readFileSync(filePath);
      const signature = crypto.sign(null, content, privateKeyObj);
      const sigBase64 = signature.toString("base64");
      const sigPath = `${filePath}.sig`;
      fs.writeFileSync(sigPath, sigBase64, "utf-8");
      info(`  签名: ${path.basename(filePath)} -> ${path.basename(sigPath)}`);
    }

    // 签名 full.tar.gz
    if (fileExists(fullTarPath)) {
      signFile(fullTarPath);
    }

    // 签名 checksums.json
    const checksumsInDeploy = path.join(versionDir, "checksums.json");
    if (fileExists(checksumsInDeploy)) {
      signFile(checksumsInDeploy);
    }

    // 签名所有 delta 包
    for (const d of deltas) {
      const deltaTarInDeploy = path.join(versionDir, d.tarName);
      if (fileExists(deltaTarInDeploy)) {
        signFile(deltaTarInDeploy);
      }
    }

    info("Ed25519 签名完成");
  } else {
    warn("未设置 UPDATE_SIGNING_PRIVATE_KEY 环境变量，跳过 Ed25519 签名");
    warn("生产发布前请配置签名密钥（openssl genpkey -algorithm Ed25519）");
  }

  // ─── Step 7: 生成 platform-manifest.json / latest.json ───

  step(8, totalSteps, buildPlatform ? "生成 platform-manifest.json" : "生成 latest.json");

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

  // ─── 生成更新日志文件 ───

  const changelog = readChangelogLatest();
  const changelogData = {
    version,
    platform: buildPlatform ?? "all",
    buildTime: new Date().toISOString(),
    gitCommit: getGitCommit(),
    changelog,
  };
  const changelogJsonPath = path.join(DEPLOY_DIR, platformSubDir, "changelog.json");
  writeJson(changelogJsonPath, changelogData);
  info(`changelog.json 已生成 (${changelog["zh-CN"].length} 字符)`);

  // ─── 生成 manifest JSON ───

  if (buildPlatform) {
    // 平台模式：生成 platform-manifest.json（由服务端合并为 latest.json）
    interface PlatformManifest {
      platform: string;
      version: string;
      buildTime: string;
      gitCommit: string;
      nodeVersion: string;
      url: { full: string; manifest: string; checksums: string; changelog: string };
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
        changelog: `${urlBase}/${urlSubDir}/changelog.json`,
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
      url: { full: string; manifest: string; checksums: string; changelog: string };
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
        changelog: `${urlBase}/${version}/changelog.json`,
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

  // ─── Step 8: 上传到服务器 ───

  step(9, totalSteps, "上传到服务器");

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
    // [CN-PATCH] 强制 HTTPS — 防止 secret 明文传输
    if (!notifyUrl.startsWith("https://")) {
      warn(`--notify-url 不是 HTTPS (${notifyUrl})，secret 将明文传输!`);
      if (!notifyUrl.startsWith("http://127.0.0.1") && !notifyUrl.startsWith("http://localhost")) {
        error("非本地 notify-url 必须使用 HTTPS，跳过通知");
        return;
      }
    }
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

  step(10, totalSteps, "缓存当前版本 dist/");

  cacheCurrentRelease(version, CACHE_DIR);

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
  // 排除平台垃圾文件（.DS_Store, Thumbs.db 等）
  const tarArgs = [
    "-czf", outputPath,
    "--exclude=.DS_Store",
    "--exclude=Thumbs.db",
    "--exclude=.git",
    "-C", parentDir, dirName,
  ];

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

/** 将 data/ 种子文件复制到 stageDir/data/（白名单模式，不含运行时用户数据） */
function stageSeedData(stageDir: string) {
  const dataDir = path.join(ROOT_DIR, "data");
  if (!fileExists(dataDir)) return;

  const destData = path.join(stageDir, "data");
  fs.mkdirSync(destData, { recursive: true });

  for (const f of DATA_SEED_FILES) {
    const src = path.join(dataDir, f);
    if (fileExists(src)) fs.copyFileSync(src, path.join(destData, f));
  }
  // mcp-index-enhanced*.json（多版本文件，glob 匹配）
  for (const entry of fs.readdirSync(dataDir)) {
    if (entry.startsWith("mcp-index-enhanced") && entry.endsWith(".json")) {
      fs.copyFileSync(path.join(dataDir, entry), path.join(destData, entry));
    }
  }
  for (const d of DATA_SEED_DIRS) {
    const src = path.join(dataDir, d);
    if (fileExists(src)) copyDirRecursive(src, path.join(destData, d));
  }
}

/** 复制 node_modules 到 stageDir（只含生产依赖，跳过 devDependencies） */
function stageNodeModules(stageDir: string) {
  const nmDir = path.join(ROOT_DIR, "node_modules");
  if (!fileExists(nmDir)) {
    warn("node_modules/ 不存在，跳过（客户端将通过 npm install 安装）");
    return;
  }

  // 读取 package.json 的 devDependencies 列表用于过滤
  const devDeps = new Set<string>();
  try {
    const pkg = readJson<{ devDependencies?: Record<string, string> }>(
      path.join(ROOT_DIR, "package.json"),
    );
    if (pkg.devDependencies) {
      for (const name of Object.keys(pkg.devDependencies)) {
        devDeps.add(name);
      }
    }
  } catch { /* 读取失败则不过滤 */ }

  info(`staging node_modules/（跳过 .cache + ${devDeps.size} 个 devDependencies）...`);
  const destNm = path.join(stageDir, "node_modules");
  fs.mkdirSync(destNm, { recursive: true });

  const nmSkipDirs = [".cache", ".git", ".package-lock.json"];

  for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      // 顶层文件（如 .package-lock.json）
      if (!nmSkipDirs.includes(entry.name)) {
        fs.copyFileSync(path.join(nmDir, entry.name), path.join(destNm, entry.name));
      }
      continue;
    }
    if (nmSkipDirs.includes(entry.name)) continue;

    if (entry.name.startsWith("@")) {
      // Scoped package: @scope/name — 检查每个子包
      const scopeDir = path.join(nmDir, entry.name);
      const destScope = path.join(destNm, entry.name);
      let hasProdPkg = false;
      for (const sub of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        const scopedName = `${entry.name}/${sub.name}`;
        if (devDeps.has(scopedName)) continue;
        if (!hasProdPkg) {
          fs.mkdirSync(destScope, { recursive: true });
          hasProdPkg = true;
        }
        const subSrc = path.join(scopeDir, sub.name);
        const subDest = path.join(destScope, sub.name);
        if (sub.isDirectory() || sub.isSymbolicLink()) {
          copyDirRecursive(subSrc, subDest, nmSkipDirs);
        } else {
          fs.copyFileSync(subSrc, subDest);
        }
      }
    } else {
      // 非 scoped 包：直接检查是否是 devDependency
      if (devDeps.has(entry.name)) continue;
      copyDirRecursive(
        path.join(nmDir, entry.name),
        path.join(destNm, entry.name),
        nmSkipDirs,
      );
    }
  }
}

/** 打包完整更新包（staging 模式：先复制到临时目录，再 tar） */
function tarFullPackage(outputPath: string) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Stage 到临时目录，确保只打入安全内容
  const stageDir = path.join(DEPLOY_DIR, ".full-stage");
  rmrf(stageDir);
  fs.mkdirSync(stageDir, { recursive: true });

  // 1. dist/, skills/, extensions/ — 整体复制
  for (const item of ["dist", "skills", "extensions"]) {
    const src = path.join(ROOT_DIR, item);
    if (fileExists(src)) copyDirRecursive(src, path.join(stageDir, item));
  }

  // 2. package.json
  const pkgSrc = path.join(ROOT_DIR, "package.json");
  if (fileExists(pkgSrc)) fs.copyFileSync(pkgSrc, path.join(stageDir, "package.json"));

  // 3. data/（种子文件白名单）
  stageSeedData(stageDir);

  // 4. docs/reference/templates/
  const templatesDir = path.join(ROOT_DIR, "docs", "reference", "templates");
  if (fileExists(templatesDir)) {
    const destTemplates = path.join(stageDir, "docs", "reference", "templates");
    copyDirRecursive(templatesDir, destTemplates);
  }

  // 5. node_modules/（生产依赖）
  stageNodeModules(stageDir);

  // 6. 元数据文件
  for (const meta of ["install.json", "version.json"]) {
    const src = path.join(ROOT_DIR, meta);
    if (fileExists(src)) fs.copyFileSync(src, path.join(stageDir, meta));
  }

  // Tar staging 目录
  tarDirectory(stageDir, outputPath);

  // 清理
  rmrf(stageDir);
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
  // [CN-PATCH] 校验所有会拼入 shell 命令的参数
  assertSafeShellArg("server", server);
  assertSafeShellArg("port", port);
  assertSafeShellArg("version", version);
  if (buildPlatform) assertSafeShellArg("platform", buildPlatform);

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

  // 上传版本目录中的所有文件，收集本地哈希用于校验
  const allFiles = findFilesRecursive(deployBaseDir);
  const uploadedFiles: { relPath: string; remotePath: string; localHash: string }[] = [];

  for (const relPath of allFiles) {
    const localPath = path.join(deployBaseDir, relPath);
    const remotePath = `${SERVER_RELEASES_FS_PATH}/${version}/${relPath.replace(/\\/g, "/")}`;
    info(`  上传 ${relPath}...`);
    exec(
      `scp -P ${port} "${localPath}" ${server}:${remotePath}`,
      { silent: true },
    );
    uploadedFiles.push({ relPath, remotePath, localHash: sha256File(localPath) });
  }

  // 旧模式：上传 latest.json；平台模式：不上传（由服务端合并）
  if (!buildPlatform) {
    const latestJsonPath = path.join(DEPLOY_DIR, "latest.json");
    info("  上传 latest.json...");
    exec(`scp -P ${port} "${latestJsonPath}" ${server}:${SERVER_RELEASES_FS_PATH}/`, { silent: true });
    uploadedFiles.push({
      relPath: "latest.json",
      remotePath: `${SERVER_RELEASES_FS_PATH}/latest.json`,
      localHash: sha256File(latestJsonPath),
    });
  }

  // Post-upload integrity verification: compare remote SHA256 with local hashes
  info("验证远程文件完整性...");
  const remotePaths = uploadedFiles.map((f) => f.remotePath).join(" ");
  try {
    const remoteOutput = exec(
      `ssh -p ${port} ${server} "sha256sum ${remotePaths}"`,
      { silent: true },
    );
    if (remoteOutput) {
      const remoteHashes = new Map<string, string>();
      for (const line of remoteOutput.trim().split("\n")) {
        const [hash, filePath] = line.trim().split(/\s+/, 2);
        if (hash && filePath) remoteHashes.set(filePath, hash.toLowerCase());
      }
      let mismatches = 0;
      for (const f of uploadedFiles) {
        const remoteHash = remoteHashes.get(f.remotePath);
        if (!remoteHash) {
          warn(`  未获取到远程哈希: ${f.relPath}`);
        } else if (remoteHash !== f.localHash.toLowerCase()) {
          error(`  完整性不匹配: ${f.relPath} (local=${f.localHash} remote=${remoteHash})`);
          mismatches++;
        }
      }
      if (mismatches > 0) {
        error(`${mismatches} 个文件完整性校验失败!`);
        process.exit(1);
      }
      info(`完整性校验通过 (${uploadedFiles.length} 个文件)`);
    }
  } catch {
    warn("远程 SHA256 校验失败（sha256sum 可能不可用），跳过完整性验证");
  }

  info("上传完成!");
}

/** 缓存当前版本的所有可增量对比资源 */
function cacheCurrentRelease(version: string, cacheDir: string = CACHE_DIR_DEFAULT) {
  const cacheVersionDir = path.join(cacheDir, version);

  // 如果已存在，先删除
  rmrf(cacheVersionDir);
  fs.mkdirSync(cacheVersionDir, { recursive: true });

  // 1. dist/
  info(`缓存 dist/`);
  copyDirRecursive(DIST_DIR, path.join(cacheVersionDir, "dist"));

  // 2. package.json
  fs.copyFileSync(
    path.join(ROOT_DIR, "package.json"),
    path.join(cacheVersionDir, "package.json"),
  );

  // 3. skills/
  const skillsDir = path.join(ROOT_DIR, "skills");
  if (fileExists(skillsDir)) {
    info(`缓存 skills/`);
    copyDirRecursive(skillsDir, path.join(cacheVersionDir, "skills"));
  }

  // 4. extensions/
  const extensionsDir = path.join(ROOT_DIR, "extensions");
  if (fileExists(extensionsDir)) {
    info(`缓存 extensions/`);
    copyDirRecursive(extensionsDir, path.join(cacheVersionDir, "extensions"));
  }

  // 5. data/（只缓存种子文件，复用 stageSeedData）
  info(`缓存 data/ (种子文件)`);
  stageSeedData(cacheVersionDir);

  // 6. docs/reference/templates/
  const templatesDir = path.join(ROOT_DIR, "docs", "reference", "templates");
  if (fileExists(templatesDir)) {
    info(`缓存 docs/reference/templates/`);
    const cachedTemplates = path.join(cacheVersionDir, "docs", "reference", "templates");
    copyDirRecursive(templatesDir, cachedTemplates);
  }

  // 7. node_modules 元数据（包名→版本映射，不缓存完整目录）
  const nmDir = path.join(ROOT_DIR, "node_modules");
  if (fileExists(nmDir)) {
    info(`缓存 node_modules 包元数据`);
    const pkgVersions = scanPackageVersions(nmDir);
    const metaObj: Record<string, { name: string; version: string }> = {};
    pkgVersions.forEach((v, k) => { metaObj[k] = v; });
    fs.writeFileSync(
      path.join(cacheVersionDir, "node_modules_meta.json"),
      JSON.stringify(metaObj, null, 2),
      "utf-8",
    );
    info(`  ${pkgVersions.size} 个包已记录`);
  }

  // 8. 元数据文件
  for (const meta of ["install.json", "version.json"]) {
    const src = path.join(ROOT_DIR, meta);
    if (fileExists(src)) fs.copyFileSync(src, path.join(cacheVersionDir, meta));
  }

  // 清理过旧的缓存
  cleanupOldCaches(cacheDir);

  info(`缓存完成 (${version})`);
}

/** 递归复制目录，skipDirs 控制要跳过的子目录名 */
function copyDirRecursive(src: string, dest: string, skipDirs: string[] = ["node_modules", ".git"]) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // 处理符号链接：保留链接结构（pnpm 依赖此特性）
    if (entry.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(srcPath);
      try {
        fs.symlinkSync(linkTarget, destPath);
      } catch {
        // Windows 非管理员可能无法创建符号链接，回退为复制目标内容
        const realPath = fs.realpathSync(srcPath);
        const stat = fs.statSync(realPath);
        if (stat.isDirectory()) {
          if (!skipDirs.includes(entry.name)) {
            copyDirRecursive(realPath, destPath, skipDirs);
          }
        } else {
          fs.copyFileSync(realPath, destPath);
        }
      }
    } else if (entry.isDirectory()) {
      if (!skipDirs.includes(entry.name)) {
        copyDirRecursive(srcPath, destPath, skipDirs);
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

// ─── 多目录增量辅助函数 ─────────────────────────────────

interface DeltaManifestShape {
  added: Array<{ path: string; sha256: string; size: number }>;
  modified: Array<{ path: string; sha256: string; size: number }>;
  removed: string[];
  totalFiles: number;
  totalSize: number;
}

/**
 * 将子增量（generate-delta-package.ts 输出）合并到主增量，路径加前缀。
 * 例如 skills/ 子增量中的 "weather/SKILL.md" → 主增量中的 "skills/weather/SKILL.md"
 */
function mergeSubDelta(
  subDeltaDir: string,
  prefix: string,
  mainDeltaDir: string,
  mainManifest: DeltaManifestShape,
) {
  const subJsonPath = path.join(subDeltaDir, "delta.json");
  if (!fileExists(subJsonPath)) return;

  const sub = readJson<DeltaManifestShape>(subJsonPath);

  for (const entry of sub.added) {
    const prefixed = `${prefix}/${entry.path}`;
    const src = path.join(subDeltaDir, "added", entry.path);
    const dest = path.join(mainDeltaDir, "added", prefixed);
    if (fileExists(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    mainManifest.added.push({ ...entry, path: prefixed });
    mainManifest.totalSize += entry.size;
    mainManifest.totalFiles++;
  }

  for (const entry of sub.modified) {
    const prefixed = `${prefix}/${entry.path}`;
    const src = path.join(subDeltaDir, "modified", entry.path);
    const dest = path.join(mainDeltaDir, "modified", prefixed);
    if (fileExists(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    mainManifest.modified.push({ ...entry, path: prefixed });
    mainManifest.totalSize += entry.size;
    mainManifest.totalFiles++;
  }

  for (const relPath of sub.removed) {
    mainManifest.removed.push(`${prefix}/${relPath}`);
  }
}

/** 扫描 node_modules 中每个包的 name+version（只读顶层 package.json） */
function scanPackageVersions(nmDir: string): Map<string, { name: string; version: string }> {
  const result = new Map<string, { name: string; version: string }>();
  if (!fileExists(nmDir)) return result;

  for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === ".cache" || entry.name === ".package-lock.json" || entry.name === ".git") continue;

    if (entry.name.startsWith("@")) {
      // scoped package: @scope/name
      const scopeDir = path.join(nmDir, entry.name);
      for (const sub of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        const pkgJsonPath = path.join(scopeDir, sub.name, "package.json");
        if (fileExists(pkgJsonPath)) {
          try {
            const pkg = readJson<{ name: string; version: string }>(pkgJsonPath);
            result.set(`${entry.name}/${sub.name}`, { name: pkg.name ?? `${entry.name}/${sub.name}`, version: pkg.version ?? "0.0.0" });
          } catch { /* skip malformed */ }
        }
      }
    } else {
      const pkgJsonPath = path.join(nmDir, entry.name, "package.json");
      if (fileExists(pkgJsonPath)) {
        try {
          const pkg = readJson<{ name: string; version: string }>(pkgJsonPath);
          result.set(entry.name, { name: pkg.name ?? entry.name, version: pkg.version ?? "0.0.0" });
        } catch { /* skip malformed */ }
      }
    }
  }
  return result;
}

/** 将单个 npm 包的所有文件复制到增量包的 added/ 或 modified/ 中 */
function copyPackageToDelta(
  nmDir: string,
  pkgName: string,
  category: "added" | "modified",
  deltaOutputDir: string,
  manifest: DeltaManifestShape,
): number {
  const pkgDir = path.join(nmDir, pkgName);
  if (!fileExists(pkgDir)) return 0;

  const files = findFilesRecursive(pkgDir);
  let totalSize = 0;

  for (const relFile of files) {
    const fullRelPath = `node_modules/${pkgName}/${relFile}`.replace(/\\/g, "/");
    const src = path.join(pkgDir, relFile);
    const dest = path.join(deltaOutputDir, category, fullRelPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);

    const stats = fs.statSync(src);
    const hash = sha256File(src);
    const entry = { path: fullRelPath, sha256: hash, size: stats.size };

    if (category === "added") {
      manifest.added.push(entry);
    } else {
      manifest.modified.push(entry);
    }
    manifest.totalSize += stats.size;
    manifest.totalFiles++;
    totalSize += stats.size;
  }
  return totalSize;
}

/**
 * 生成 node_modules 包级别增量。
 * 对比缓存的 node_modules_meta.json 与当前 node_modules，
 * 只打入版本变更/新增的整个 npm 包。
 */
function generateNodeModulesDelta(
  cacheVersionDir: string,
  deltaOutputDir: string,
  manifest: DeltaManifestShape,
) {
  const metaPath = path.join(cacheVersionDir, "node_modules_meta.json");
  const currentNmDir = path.join(ROOT_DIR, "node_modules");

  let oldPkgs = new Map<string, { name: string; version: string }>();
  if (fileExists(metaPath)) {
    const cached = readJson<Record<string, { name: string; version: string }>>(metaPath);
    oldPkgs = new Map(Object.entries(cached));
  } else {
    info("  上一版本无 node_modules_meta.json 缓存，跳过 node_modules 增量");
    return;
  }

  const newPkgs = scanPackageVersions(currentNmDir);

  // 快照 manifest 计数，用于超限回滚
  const snapshotAddedLen = manifest.added.length;
  const snapshotModifiedLen = manifest.modified.length;
  const snapshotTotalSize = manifest.totalSize;
  const snapshotTotalFiles = manifest.totalFiles;

  let addedCount = 0, modifiedCount = 0, removedCount = 0;
  let nmDeltaSize = 0;

  // 新增和变更的包
  let overLimit = false;
  newPkgs.forEach((newMeta, pkgName) => {
    if (overLimit) return;
    const oldMeta = oldPkgs.get(pkgName);
    if (!oldMeta) {
      const size = copyPackageToDelta(currentNmDir, pkgName, "added", deltaOutputDir, manifest);
      nmDeltaSize += size;
      addedCount++;
    } else if (oldMeta.version !== newMeta.version) {
      const size = copyPackageToDelta(currentNmDir, pkgName, "modified", deltaOutputDir, manifest);
      nmDeltaSize += size;
      modifiedCount++;
    }

    if (nmDeltaSize > NM_DELTA_SIZE_LIMIT) {
      overLimit = true;
    }
  });

  if (overLimit) {
    // 超限：回滚所有已复制的 node_modules 文件和 manifest 条目，
    // 让客户端通过 checkAndInstallDeps() 完全接管
    warn(`  node_modules 增量超过 ${fileSizeHuman(NM_DELTA_SIZE_LIMIT)} 限制，回滚 node_modules 增量（客户端将通过 npm install 处理）`);

    // 回滚 manifest 到快照状态
    manifest.added.length = snapshotAddedLen;
    manifest.modified.length = snapshotModifiedLen;
    manifest.totalSize = snapshotTotalSize;
    manifest.totalFiles = snapshotTotalFiles;

    // 删除已复制的 node_modules 文件（delta 目录中）
    const nmAddedDir = path.join(deltaOutputDir, "added", "node_modules");
    const nmModifiedDir = path.join(deltaOutputDir, "modified", "node_modules");
    if (fileExists(nmAddedDir)) rmrf(nmAddedDir);
    if (fileExists(nmModifiedDir)) rmrf(nmModifiedDir);
    return;
  }

  // 删除的包（标记为目录，路径以 / 结尾）
  oldPkgs.forEach((_meta, pkgName) => {
    if (!newPkgs.has(pkgName)) {
      manifest.removed.push(`node_modules/${pkgName}/`);
      removedCount++;
    }
  });

  if (addedCount + modifiedCount + removedCount > 0) {
    info(`  node_modules 增量: ${addedCount} 新增, ${modifiedCount} 变更, ${removedCount} 删除 (${fileSizeHuman(nmDeltaSize)})`);
  }
}

// ─── 入口 ─────────────────────────────────────────────

main().catch((err) => {
  error(`发布失败: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
