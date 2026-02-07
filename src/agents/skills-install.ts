import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";

import type { ClawdbotConfig } from "../config/config.js";
import { resolveBrewExecutable } from "../infra/brew.js";
import { runCommandWithTimeout } from "../process/exec.js";
import { CONFIG_DIR, ensureDir, resolveUserPath } from "../utils.js";
import {
  hasBinary,
  loadWorkspaceSkillEntries,
  resolveSkillsInstallPreferences,
  type SkillEntry,
  type SkillInstallSpec,
  type SkillsInstallPreferences,
} from "./skills.js";
import { resolveSkillKey } from "./skills/frontmatter.js";

/**
 * 安装阶段进度回调
 * ClawdbotCN 专属：支持实时进度显示
 */
export type SkillInstallProgressCallback = (progress: {
  stage: "downloading" | "installing" | "verifying";
  message: string;
  percent?: number;
  currentDependency?: string;
  downloadInfo?: {
    speed?: string;
    eta?: string;
    downloaded?: string;
    total?: string;
  };
  usingCNMirror?: boolean;
}) => void;

export type SkillInstallRequest = {
  workspaceDir: string;
  skillName: string;
  installId: string;
  timeoutMs?: number;
  config?: ClawdbotConfig;
  /** ClawdbotCN 专属：进度回调 */
  onProgress?: SkillInstallProgressCallback;
};

export type SkillInstallResult = {
  ok: boolean;
  message: string;
  stdout: string;
  stderr: string;
  code: number | null;
};

function isNodeReadableStream(value: unknown): value is NodeJS.ReadableStream {
  return Boolean(value && typeof (value as NodeJS.ReadableStream).pipe === "function");
}

/**
 * Windows 上常见的 Go 安装路径
 */
const WINDOWS_GO_PATHS = [
  "C:\\Program Files\\Go\\bin\\go.exe",
  "C:\\Go\\bin\\go.exe",
  `${process.env.LOCALAPPDATA}\\Programs\\Go\\bin\\go.exe`,
  `${process.env.USERPROFILE}\\go\\bin\\go.exe`,
  `${process.env.USERPROFILE}\\scoop\\apps\\go\\current\\bin\\go.exe`,
];

/**
 * Resolve the Python Scripts directory on Windows (where pip installs executables).
 * Checks common locations: Python's own Scripts dir, user-local Scripts, AppData.
 */
function resolvePythonScriptsDir(): string | undefined {
  if (process.platform !== "win32") return undefined;
  const candidates: string[] = [];
  // Try to get the Scripts dir from the Python executable location
  const pythonExe = ["python", "python3"].find((cmd) => hasBinary(cmd));
  if (pythonExe) {
    try {
      const pythonPath = execFileSync(
        pythonExe,
        ["-c", "import sys; print(sys.executable)"],
        { timeout: 5000, encoding: "utf-8" },
      ).trim();
      if (pythonPath) {
        candidates.push(path.join(path.dirname(pythonPath), "Scripts"));
      }
    } catch {
      // ignore — python may not work or may not be a real install
    }
  }
  const userProfile = process.env.USERPROFILE || process.env.HOME || "";
  if (userProfile) {
    candidates.push(path.join(userProfile, "AppData", "Local", "Programs", "Python", "Scripts"));
    candidates.push(path.join(userProfile, "AppData", "Roaming", "Python", "Scripts"));
  }
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir)) return dir;
    } catch {
      // ignore
    }
  }
  return undefined;
}

/**
 * 查找 Go 可执行文件
 * ClawdbotCN 专属：在 Windows 上检查常见安装路径
 * @returns Go 可执行文件路径，如果找到的话
 */
function findGoExecutable(): string | undefined {
  // 先检查 PATH
  if (hasBinary("go")) {
    return "go";
  }
  
  // Windows 上检查常见安装路径
  if (process.platform === "win32") {
    for (const goPath of WINDOWS_GO_PATHS) {
      try {
        if (fs.existsSync(goPath)) {
          // 将 Go bin 目录添加到 PATH
          const goBinDir = path.dirname(goPath);
          if (!process.env.PATH?.includes(goBinDir)) {
            process.env.PATH = `${goBinDir};${process.env.PATH}`;
          }
          return goPath;
        }
      } catch {
        // 继续检查下一个路径
      }
    }
  }
  
  return undefined;
}

/**
 * 检查 Go 是否可用（包括常见安装路径）
 */
function hasGoAvailable(): boolean {
  return findGoExecutable() !== undefined;
}

/**
 * Windows 上常见的 Node.js/npm 安装路径
 */
const WINDOWS_NODE_PATHS = [
  // 常见安装位置
  "D:\\Program Files\\node",
  "C:\\Program Files\\nodejs",
  "C:\\Program Files\\node",
  `${process.env.LOCALAPPDATA}\\Programs\\nodejs`,
  `${process.env.USERPROFILE}\\scoop\\apps\\nodejs\\current`,
  `${process.env.USERPROFILE}\\scoop\\apps\\nodejs-lts\\current`,
  // nvm-windows
  `${process.env.NVM_HOME}\\${process.env.NVM_SYMLINK || ""}`,
  `${process.env.APPDATA}\\nvm\\${process.env.NVM_SYMLINK || ""}`,
  // fnm
  `${process.env.LOCALAPPDATA}\\fnm_multishells`,
  // 用户全局安装目录
  `${process.env.APPDATA}\\npm`,
];

/**
 * 查找 Node.js 包管理器可执行文件
 * ClawdbotCN 专属：在 Windows 上检查常见安装路径
 * @param manager 包管理器名称 (npm, pnpm, yarn, bun)
 * @returns 可执行文件路径，如果找到的话
 */
function findNodePackageManager(manager: string): string | undefined {
  const isWindows = process.platform === "win32";
  const extensions = isWindows ? [".cmd", ".exe", ""] : [""];
  
  // Windows 上需要返回完整路径，因为 spawn 不能直接执行 .cmd 文件
  if (isWindows) {
    // 先检查常见安装路径
    for (const basePath of WINDOWS_NODE_PATHS) {
      if (!basePath) continue;
      
      for (const ext of extensions) {
        const fullPath = path.join(basePath, `${manager}${ext}`);
        try {
          if (fs.existsSync(fullPath)) {
            // 将目录添加到 PATH
            if (!process.env.PATH?.includes(basePath)) {
              process.env.PATH = `${basePath};${process.env.PATH}`;
            }
            return fullPath;
          }
        } catch {
          // 继续检查下一个路径
        }
      }
    }
    
    // 检查 PATH 中的目录
    const pathEnv = process.env.PATH ?? "";
    const pathDirs = pathEnv.split(path.delimiter).filter(Boolean);
    for (const dir of pathDirs) {
      for (const ext of extensions) {
        const fullPath = path.join(dir, `${manager}${ext}`);
        try {
          if (fs.existsSync(fullPath)) {
            return fullPath;
          }
        } catch {
          // 继续检查
        }
      }
    }
  } else {
    // 非 Windows 系统，检查 PATH 即可
    if (hasBinary(manager)) {
      return manager;
    }
  }
  
  return undefined;
}

/**
 * 清理终端控制字符和 spinner 符号
 * ClawdbotCN 专属：处理 Windows 上 npm 输出的乱码字符
 */
function cleanTerminalOutput(text: string): string {
  return text
    // 移除 ANSI 转义序列
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    // 移除 npm spinner 字符（◆、●、○ 等）
    .replace(/[◆●○◇◈◉◐◑◒◓◔◕⬤⬡⬢⬣⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, "")
    // 移除其他 Unicode spinner 字符
    .replace(/[\u2800-\u28FF]/g, "") // Braille patterns
    // 移除回车符（npm 在更新 spinner 时用来覆盖行）
    .replace(/\r/g, "\n")
    // 合并多个连续空白行
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarizeInstallOutput(text: string): string | undefined {
  // ClawdbotCN 专属：先清理终端控制字符
  const raw = cleanTerminalOutput(text);
  if (!raw) return undefined;
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return undefined;

  const preferred =
    lines.find((line) => /^error\b/i.test(line)) ??
    lines.find((line) => /\b(err!|error:|failed)\b/i.test(line)) ??
    lines.at(-1);

  if (!preferred) return undefined;
  const normalized = preferred.replace(/\s+/g, " ").trim();
  const maxLen = 200;
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen - 1)}…` : normalized;
}

/**
 * 清理命令输出中的乱码和特殊字符
 * ClawdbotCN 专属：Windows 下命令输出可能包含非 UTF-8 编码的字符
 */
function sanitizeCommandOutput(text: string): string {
  // 移除 ANSI 转义序列（彩色输出、光标控制等）
  let cleaned = text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
  // 移除 Windows 控制台的其他转义序列
  cleaned = cleaned.replace(/\x1B\][^\x07]*\x07/g, "");
  // 移除不可打印的 ASCII 控制字符（保留换行、回车、制表符）
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // 移除 Unicode 替换字符（编码错误的标志）
  cleaned = cleaned.replace(/\uFFFD/g, "?");
  // 移除连续的替换问号（乱码残留）
  cleaned = cleaned.replace(/\?{3,}/g, "...");
  // 规范化空白
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

/**
 * ClawdbotCN 专属：常见错误的友好中文解释
 * 让小白用户也能看懂错误原因和解决方法
 */
function getFriendlyErrorMessage(stderr: string, stdout: string): { reason: string; solution: string } | undefined {
  const combined = (stderr + " " + stdout).toLowerCase();
  
  // 网络相关错误
  if (combined.includes("enotfound") || combined.includes("dns")) {
    return {
      reason: "网络连接失败，无法解析域名",
      solution: "请检查网络连接，或尝试切换网络后重试",
    };
  }
  if (combined.includes("etimedout") || combined.includes("timeout")) {
    return {
      reason: "网络连接超时",
      solution: "网络较慢，请稍后重试。如果持续超时，可能需要检查防火墙设置",
    };
  }
  if (combined.includes("econnrefused") || combined.includes("econnreset")) {
    return {
      reason: "网络连接被拒绝或中断",
      solution: "可能是镜像源临时不可用，请稍后重试",
    };
  }
  if (combined.includes("certificate") || combined.includes("ssl") || combined.includes("unable to get local issuer")) {
    return {
      reason: "SSL/HTTPS 证书验证失败",
      solution: "可能是网络环境的证书问题，尝试在不同网络环境下重试",
    };
  }
  if (combined.includes("403") || combined.includes("forbidden")) {
    return {
      reason: "访问被拒绝（403）",
      solution: "镜像源可能限制了访问，系统会自动尝试其他镜像",
    };
  }
  if (combined.includes("404") || combined.includes("not found")) {
    return {
      reason: "资源不存在（404）",
      solution: "该包可能不存在或版本号错误，请检查技能配置",
    };
  }
  
  // 权限相关错误
  if (combined.includes("eacces") || combined.includes("permission denied") || combined.includes("access denied")) {
    return {
      reason: "权限不足",
      solution: "请尝试以管理员身份运行，或检查安装目录的写入权限",
    };
  }
  if (combined.includes("requires administrator") || combined.includes("run as administrator")) {
    return {
      reason: "需要管理员权限",
      solution: "请右键点击应用，选择「以管理员身份运行」",
    };
  }
  
  // 磁盘空间
  if (combined.includes("enospc") || combined.includes("no space") || combined.includes("disk full")) {
    return {
      reason: "磁盘空间不足",
      solution: "请清理磁盘空间后重试",
    };
  }
  
  // 依赖相关
  if (combined.includes("peer dep") || combined.includes("peerdependencies")) {
    return {
      reason: "包的依赖版本冲突",
      solution: "这通常不影响使用，可以忽略。如果功能异常，请尝试更新 Node.js",
    };
  }
  if (combined.includes("engine") && combined.includes("node")) {
    return {
      reason: "Node.js 版本不兼容",
      solution: "请更新 Node.js 到最新 LTS 版本（推荐 v20+）",
    };
  }
  
  // 包管理器相关
  if (combined.includes("npm err!") && combined.includes("code e")) {
    return {
      reason: "npm 安装出错",
      solution: "请尝试运行 `npm cache clean --force` 清理缓存后重试",
    };
  }
  
  return undefined;
}

function formatInstallFailureMessage(result: {
  code: number | null;
  stdout: string;
  stderr: string;
}): string {
  const useCN = shouldUseCNMirror();
  const code = typeof result.code === "number" ? `exit ${result.code}` : "unknown exit";
  
  // ClawdbotCN 专属：清理输出中的乱码
  const cleanStderr = sanitizeCommandOutput(result.stderr);
  const cleanStdout = sanitizeCommandOutput(result.stdout);
  const summary = summarizeInstallOutput(cleanStderr) ?? summarizeInstallOutput(cleanStdout);
  
  // ClawdbotCN 专属：为中国用户提供友好的错误解释
  if (useCN) {
    const friendly = getFriendlyErrorMessage(result.stderr, result.stdout);
    if (friendly) {
      return `安装失败：${friendly.reason}\n💡 解决方法：${friendly.solution}`;
    }
    if (!summary) return `安装失败（${code}）\n💡 请检查网络连接后重试，或在 Web UI 查看详细日志`;
    return `安装失败：${summary}\n💡 如需帮助，请访问 Web UI 查看完整错误信息`;
  }
  
  if (!summary) return `Install failed (${code})`;
  return `Install failed (${code}): ${summary}`;
}

function resolveInstallId(spec: SkillInstallSpec, index: number): string {
  return (spec.id ?? `${spec.kind}-${index}`).trim();
}

function findInstallSpec(entry: SkillEntry, installId: string): SkillInstallSpec | undefined {
  const specs = entry.clawdbot?.install ?? [];
  for (const [index, spec] of specs.entries()) {
    if (resolveInstallId(spec, index) === installId) return spec;
  }
  return undefined;
}

import {
  PACKAGE_MANAGER_MIRRORS,
  BINARY_DOWNLOAD_MIRRORS,
  shouldUseCNMirror,
  getGoBinaryMirrors,
  getNodeBinaryMirrors,
  getUvInstallScripts,
  getPipMirrors,
  getNpmMirrors,
  // 香港服务器二进制托管
  isToolHostedOnHK,
  getHKBinaryVersionUrl,
  getHKBinaryDownloadUrl,
  getCurrentPlatformForHKBinary,
  CLI_TOOL_MIRRORS,
} from "../config/cn-mirrors.js";
import { validateUrlForSsrf } from "../infra/net/ssrf.js";

/**
 * 国内镜像配置（向后兼容）
 * ClawdbotCN 专属：为中国用户提供高速下载
 */
const CN_MIRRORS = {
  npm: PACKAGE_MANAGER_MIRRORS.npm.primary,
  pip: PACKAGE_MANAGER_MIRRORS.pip.primary,
  go: PACKAGE_MANAGER_MIRRORS.go.primary,
  // 二进制下载镜像（GitHub 代理）
  github: BINARY_DOWNLOAD_MIRRORS.github.primary,
  // uv 安装脚本镜像
  uvInstall: BINARY_DOWNLOAD_MIRRORS.uv.installScript,
  // Node.js 镜像
  node: BINARY_DOWNLOAD_MIRRORS.node.primary,
  // Go 二进制镜像
  goBinary: BINARY_DOWNLOAD_MIRRORS.goBinary.primary,
} as const;

/**
 * ClawdbotCN 专属：带 fallback 的命令执行
 * 如果第一个镜像失败，自动尝试备用镜像
 */
async function runCommandWithMirrorFallback(params: {
  buildCommand: (mirror: string) => string[];
  mirrors: string[];
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  onMirrorSwitch?: (from: string, to: string, error: string) => void;
}): Promise<{ code: number | null; stdout: string; stderr: string; usedMirror?: string }> {
  const { buildCommand, mirrors, timeoutMs, env, onMirrorSwitch } = params;
  
  let lastError = "";
  for (let i = 0; i < mirrors.length; i++) {
    const mirror = mirrors[i]!;
    const argv = buildCommand(mirror);
    
    try {
      const result = await runCommandWithTimeout(argv, { timeoutMs, env });
      
      // 成功或非网络相关错误，直接返回
      if (result.code === 0) {
        return { ...result, usedMirror: mirror };
      }
      
      // 检查是否是网络/镜像相关错误（需要尝试下一个镜像）
      const stderr = result.stderr.toLowerCase();
      const isNetworkError = 
        stderr.includes("enotfound") ||
        stderr.includes("etimedout") ||
        stderr.includes("econnrefused") ||
        stderr.includes("econnreset") ||
        stderr.includes("socket hang up") ||
        stderr.includes("network") ||
        stderr.includes("fetch failed") ||
        stderr.includes("unable to get local issuer certificate") ||
        stderr.includes("certificate") ||
        stderr.includes("ssl") ||
        stderr.includes("403") ||
        stderr.includes("404") ||
        stderr.includes("502") ||
        stderr.includes("503") ||
        stderr.includes("timeout");
      
      if (!isNetworkError || i === mirrors.length - 1) {
        // 非网络错误或已经是最后一个镜像，返回结果
        return { ...result, usedMirror: mirror };
      }
      
      // 网络错误，尝试下一个镜像
      lastError = result.stderr;
      if (i + 1 < mirrors.length) {
        onMirrorSwitch?.(mirror, mirrors[i + 1]!, result.stderr.slice(0, 100));
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (i === mirrors.length - 1) {
        return { code: null, stdout: "", stderr: lastError, usedMirror: mirror };
      }
      if (i + 1 < mirrors.length) {
        onMirrorSwitch?.(mirror, mirrors[i + 1]!, lastError.slice(0, 100));
      }
    }
  }
  
  return { code: null, stdout: "", stderr: lastError || "所有镜像源均不可用" };
}

/**
 * 构建 Node.js 包安装命令
 * ClawdbotCN 专属：所有包管理器都支持国内镜像，支持 fallback
 * @param mirror 可选的镜像地址，用于 fallback 机制
 */
function buildNodeInstallCommand(
  packageName: string,
  prefs: SkillsInstallPreferences,
  mirror?: string,
): {
  argv: string[];
  env?: Record<string, string>;
} {
  const useCNMirror = shouldUseCNMirror();
  const registry = mirror ?? (useCNMirror ? CN_MIRRORS.npm : undefined);
  
  // ClawdbotCN 专属：使用完整路径确保 Windows 上能找到包管理器
  const getManagerPath = (manager: string): string => {
    return findNodePackageManager(manager) ?? manager;
  };
  
  switch (prefs.nodeManager) {
    case "pnpm": {
      const pnpmPath = getManagerPath("pnpm");
      return {
        argv: registry
          ? [pnpmPath, "add", "-g", packageName, "--registry", registry]
          : [pnpmPath, "add", "-g", packageName],
      };
    }
    case "yarn": {
      const yarnPath = getManagerPath("yarn");
      return {
        argv: registry
          ? [yarnPath, "global", "add", packageName, "--registry", registry]
          : [yarnPath, "global", "add", packageName],
      };
    }
    case "bun": {
      const bunPath = getManagerPath("bun");
      // ClawdbotCN 专属：bun 使用环境变量配置镜像（不支持 --registry 参数）
      return {
        argv: [bunPath, "add", "-g", packageName],
        env: registry ? { BUN_CONFIG_REGISTRY: registry } : undefined,
      };
    }
    default: {
      const npmPath = getManagerPath("npm");
      return {
        argv: registry
          ? [npmPath, "install", "-g", packageName, "--registry", registry]
          : [npmPath, "install", "-g", packageName],
      };
    }
  }
}

/**
 * ClawdbotCN 专属：带 fallback 的 Node.js 包安装
 * 自动尝试多个国内镜像源
 */
async function installNodePackageWithFallback(params: {
  packageName: string;
  prefs: SkillsInstallPreferences;
  timeoutMs: number;
  onProgress?: SkillInstallProgressCallback;
}): Promise<{ code: number | null; stdout: string; stderr: string; usedMirror?: string }> {
  const { packageName, prefs, timeoutMs, onProgress } = params;
  const useCN = shouldUseCNMirror();
  
  if (!useCN) {
    // 非国内用户，直接安装
    const cmd = buildNodeInstallCommand(packageName, prefs);
    try {
      return await runCommandWithTimeout(cmd.argv, { timeoutMs, env: cmd.env });
    } catch (err) {
      return { code: null, stdout: "", stderr: err instanceof Error ? err.message : String(err) };
    }
  }
  
  // 国内用户，使用多镜像 fallback
  const mirrors = getNpmMirrors();
  
  return runCommandWithMirrorFallback({
    buildCommand: (mirror) => buildNodeInstallCommand(packageName, prefs, mirror).argv,
    mirrors,
    timeoutMs,
    env: prefs.nodeManager === "bun" ? { BUN_CONFIG_REGISTRY: mirrors[0] ?? CN_MIRRORS.npm } : undefined,
    onMirrorSwitch: (from, to, error) => {
      onProgress?.({
        stage: "installing",
        message: `⚠️ 镜像 ${new URL(from).hostname} 不可用，切换到 ${new URL(to).hostname}...`,
        usingCNMirror: true,
        percent: 55,
      });
    },
  });
}

/**
 * 获取 Go 代理环境变量（用于国内加速）
 */
function getGoProxyEnv(): Record<string, string> | undefined {
  if (shouldUseCNMirror()) {
    return { GOPROXY: CN_MIRRORS.go };
  }
  return undefined;
}

function buildInstallCommand(
  spec: SkillInstallSpec,
  prefs: SkillsInstallPreferences,
): {
  argv: string[] | null;
  env?: Record<string, string>;
  error?: string;
} {
  switch (spec.kind) {
    case "brew": {
      if (!spec.formula) return { argv: null, error: "missing brew formula" };
      return { argv: ["brew", "install", spec.formula] };
    }
    case "node": {
      if (!spec.package) return { argv: null, error: "missing node package" };
      const nodeCmd = buildNodeInstallCommand(spec.package, prefs);
      return {
        argv: nodeCmd.argv,
        env: nodeCmd.env,
      };
    }
    case "go": {
      if (!spec.module) return { argv: null, error: "missing go module" };
      return { argv: ["go", "install", spec.module] };
    }
    case "uv": {
      if (!spec.package) return { argv: null, error: "missing uv package" };
      // uv 使用 PyPI 镜像
      const useCNMirror = shouldUseCNMirror();
      return {
        argv: useCNMirror
          ? ["uv", "tool", "install", spec.package, "--index-url", CN_MIRRORS.pip]
          : ["uv", "tool", "install", spec.package],
      };
    }
    case "download": {
      return { argv: null, error: "download install handled separately" };
    }
    default:
      return { argv: null, error: "unsupported installer" };
  }
}

function resolveDownloadTargetDir(entry: SkillEntry, spec: SkillInstallSpec): string {
  if (spec.targetDir?.trim()) return resolveUserPath(spec.targetDir);
  const key = resolveSkillKey(entry.skill, entry);
  return path.join(CONFIG_DIR, "tools", key);
}

function resolveArchiveType(spec: SkillInstallSpec, filename: string): string | undefined {
  const explicit = spec.archive?.trim().toLowerCase();
  if (explicit) return explicit;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar.gz";
  if (lower.endsWith(".tar.bz2") || lower.endsWith(".tbz2")) return "tar.bz2";
  if (lower.endsWith(".zip")) return "zip";
  return undefined;
}

/**
 * 下载进度回调类型
 * ClawdbotCN 专属：实时显示下载进度
 */
export type DownloadProgressCallback = (progress: {
  downloaded: number;
  total: number;
  percent: number;
  speed: string;
  eta: string;
}) => void;

/**
 * 格式化字节数为可读字符串
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 带进度回调的文件下载
 * ClawdbotCN 专属：支持实时进度显示
 */
async function downloadFile(
  url: string,
  destPath: string,
  timeoutMs: number,
  onProgress?: DownloadProgressCallback,
  skipSsrfCheck?: boolean,
): Promise<{ bytes: number }> {
  // ClawdbotCN 专属：SSRF 防护 - 阻止访问内网地址
  if (!skipSsrfCheck) {
    validateUrlForSsrf(url);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs));
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed (${response.status} ${response.statusText})`);
    }
    await ensureDir(path.dirname(destPath));
    
    // 获取文件总大小
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    let downloaded = 0;
    const startTime = Date.now();
    let lastProgressTime = startTime;

    const file = fs.createWriteStream(destPath);
    const body = response.body as unknown;
    
    // 创建进度追踪的 Transform 流
    const { Transform } = await import("node:stream");
    const progressTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        downloaded += chunk.length;
        
        // 限制进度回调频率（每 100ms 最多一次）
        const now = Date.now();
        if (onProgress && contentLength > 0 && now - lastProgressTime >= 100) {
          lastProgressTime = now;
          const elapsed = (now - startTime) / 1000;
          const speed = elapsed > 0 ? downloaded / elapsed : 0;
          const remaining = contentLength - downloaded;
          const eta = speed > 0 ? remaining / speed : 0;
          
          onProgress({
            downloaded,
            total: contentLength,
            percent: Math.min(99, Math.round((downloaded / contentLength) * 100)),
            speed: `${formatBytes(speed)}/s`,
            eta: eta > 0 ? `${Math.round(eta)}s` : "",
          });
        }
        
        callback(null, chunk);
      },
    });

    const readable = isNodeReadableStream(body)
      ? body
      : Readable.fromWeb(body as NodeReadableStream);
    
    await pipeline(readable, progressTransform, file);
    
    // 完成时发送 100% 进度
    if (onProgress && contentLength > 0) {
      onProgress({
        downloaded,
        total: contentLength,
        percent: 100,
        speed: "0 B/s",
        eta: "",
      });
    }
    
    const stat = await fs.promises.stat(destPath);
    return { bytes: stat.size };
  } finally {
    clearTimeout(timeout);
  }
}

async function extractArchive(params: {
  archivePath: string;
  archiveType: string;
  targetDir: string;
  stripComponents?: number;
  timeoutMs: number;
}): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const { archivePath, archiveType, targetDir, stripComponents, timeoutMs } = params;
  if (archiveType === "zip") {
    if (!hasBinary("unzip")) {
      return { stdout: "", stderr: "unzip not found on PATH", code: null };
    }
    const argv = ["unzip", "-q", archivePath, "-d", targetDir];
    return await runCommandWithTimeout(argv, { timeoutMs });
  }

  if (!hasBinary("tar")) {
    return { stdout: "", stderr: "tar not found on PATH", code: null };
  }
  const argv = ["tar", "xf", archivePath, "-C", targetDir];
  if (typeof stripComponents === "number" && Number.isFinite(stripComponents)) {
    argv.push("--strip-components", String(Math.max(0, Math.floor(stripComponents))));
  }
  return await runCommandWithTimeout(argv, { timeoutMs });
}

async function installDownloadSpec(params: {
  entry: SkillEntry;
  spec: SkillInstallSpec;
  timeoutMs: number;
  onProgress?: SkillInstallProgressCallback;
}): Promise<SkillInstallResult> {
  const { entry, spec, timeoutMs, onProgress } = params;
  const url = spec.url?.trim();
  if (!url) {
    return {
      ok: false,
      message: "missing download url",
      stdout: "",
      stderr: "",
      code: null,
    };
  }

  let filename = "";
  try {
    const parsed = new URL(url);
    filename = path.basename(parsed.pathname);
  } catch {
    filename = path.basename(url);
  }
  if (!filename) filename = "download";

  const targetDir = resolveDownloadTargetDir(entry, spec);
  await ensureDir(targetDir);

  const archivePath = path.join(targetDir, filename);
  let downloaded = 0;
  const useCN = shouldUseCNMirror();
  
  try {
    // ClawdbotCN 专属：带进度回调的下载
    const result = await downloadFile(url, archivePath, timeoutMs, (progress) => {
      onProgress?.({
        stage: "downloading",
        message: `正在下载 ${filename}...`,
        percent: progress.percent,
        usingCNMirror: useCN,
        downloadInfo: {
          speed: progress.speed,
          eta: progress.eta,
          downloaded: formatBytes(progress.downloaded),
          total: formatBytes(progress.total),
        },
      });
    });
    downloaded = result.bytes;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message, stdout: "", stderr: message, code: null };
  }

  const archiveType = resolveArchiveType(spec, filename);
  const shouldExtract = spec.extract ?? Boolean(archiveType);
  if (!shouldExtract) {
    return {
      ok: true,
      message: `Downloaded to ${archivePath}`,
      stdout: `downloaded=${downloaded}`,
      stderr: "",
      code: 0,
    };
  }

  if (!archiveType) {
    return {
      ok: false,
      message: "extract requested but archive type could not be detected",
      stdout: "",
      stderr: "",
      code: null,
    };
  }

  const extractResult = await extractArchive({
    archivePath,
    archiveType,
    targetDir,
    stripComponents: spec.stripComponents,
    timeoutMs,
  });
  const success = extractResult.code === 0;
  return {
    ok: success,
    message: success
      ? `Downloaded and extracted to ${targetDir}`
      : formatInstallFailureMessage(extractResult),
    stdout: extractResult.stdout.trim(),
    stderr: extractResult.stderr.trim(),
    code: extractResult.code,
  };
}

// ============================================================================
// ClawdbotCN 专属：香港服务器二进制下载
// 为国内用户提供 GitHub 个人仓库工具的快速下载
// ============================================================================

/**
 * 从香港服务器获取工具的最新版本
 * @param toolName 工具名
 * @param timeoutMs 超时时间
 * @returns 版本号，失败返回 null
 */
async function getHKBinaryLatestVersion(
  toolName: string,
  timeoutMs: number,
): Promise<string | null> {
  const versionUrl = getHKBinaryVersionUrl(toolName);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(versionUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Clawdbot/1.0" },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return null;
    }
    
    const version = (await response.text()).trim();
    // 版本号格式校验：应该是 x.y.z 格式
    if (!/^\d+\.\d+(\.\d+)?(-\w+)?$/.test(version)) {
      return null;
    }
    
    return version;
  } catch {
    return null;
  }
}

/**
 * 从香港服务器下载并安装二进制工具
 * @param toolName 工具名 (如 "ordercli", "peekaboo")
 * @param timeoutMs 超时时间
 * @param onProgress 进度回调
 * @returns 安装结果
 */
async function installFromHKBinaryServer(params: {
  toolName: string;
  timeoutMs: number;
  onProgress?: SkillInstallProgressCallback;
}): Promise<SkillInstallResult> {
  const { toolName, timeoutMs, onProgress } = params;
  const useCN = shouldUseCNMirror();
  
  // 边界检查 1: 检查工具是否在香港服务器托管
  if (!isToolHostedOnHK(toolName)) {
    return {
      ok: false,
      message: `Tool ${toolName} is not hosted on HK binary server`,
      stdout: "",
      stderr: "",
      code: null,
    };
  }
  
  // 边界检查 2: 获取工具配置
  const toolConfig = CLI_TOOL_MIRRORS[toolName];
  if (!toolConfig?.hkBinary) {
    return {
      ok: false,
      message: `Tool ${toolName} missing hkBinary config`,
      stdout: "",
      stderr: "",
      code: null,
    };
  }
  
  // 边界检查 3: 检查平台支持
  const platform = getCurrentPlatformForHKBinary();
  if (!toolConfig.hkBinary.platforms.includes(platform)) {
    return {
      ok: false,
      message: `Tool ${toolName} does not support platform ${platform}. Supported: ${toolConfig.hkBinary.platforms.join(", ")}`,
      stdout: "",
      stderr: "",
      code: null,
    };
  }
  
  onProgress?.({
    stage: "downloading",
    message: `🇭🇰 连接香港镜像服务器...`,
    usingCNMirror: useCN,
    percent: 2,
  });
  
  // 步骤 1: 获取最新版本
  const version = await getHKBinaryLatestVersion(toolName, Math.min(timeoutMs, 10000));
  if (!version) {
    return {
      ok: false,
      message: `Failed to get latest version for ${toolName} from HK server`,
      stdout: "",
      stderr: "版本信息获取失败，服务器可能暂时不可用",
      code: null,
    };
  }
  
  onProgress?.({
    stage: "downloading",
    message: `🇭🇰 发现 ${toolName} v${version}，准备下载...`,
    usingCNMirror: useCN,
    percent: 5,
  });
  
  // 步骤 2: 构建下载 URL
  const downloadUrl = getHKBinaryDownloadUrl(toolName, version, platform);
  
  // 边界检查 4: URL 安全校验
  try {
    validateUrlForSsrf(downloadUrl);
  } catch (ssrfError) {
    const reason = ssrfError instanceof Error ? ssrfError.message : "URL validation failed";
    return {
      ok: false,
      message: `Invalid download URL: ${reason}`,
      stdout: "",
      stderr: reason,
      code: null,
    };
  }
  
  // 步骤 3: 确定安装目录
  const installDir = path.join(CONFIG_DIR, "tools", toolName);
  await ensureDir(installDir);
  
  const binaryName = platform.startsWith("windows") ? `${toolName}.exe` : toolName;
  const binaryPath = path.join(installDir, binaryName);
  
  // 步骤 4: 下载二进制文件（带重试）
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        onProgress?.({
          stage: "downloading",
          message: `🇭🇰 下载重试 (${attempt}/${MAX_RETRIES})...`,
          usingCNMirror: useCN,
          percent: 10,
        });
        // 指数退避：2s, 4s
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt - 1)));
      }
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(downloadUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Clawdbot/1.0" },
      });
      
      clearTimeout(timeout);
    
    if (!response.ok) {
      return {
        ok: false,
        message: `Download failed: HTTP ${response.status} ${response.statusText}`,
        stdout: "",
        stderr: `URL: ${downloadUrl}`,
        code: null,
      };
    }
    
    // 边界检查 5: 检查响应大小
    const contentLength = response.headers.get("content-length");
    const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
    
    // 最大允许 100MB
    const MAX_SIZE = 100 * 1024 * 1024;
    if (totalSize > MAX_SIZE) {
      return {
        ok: false,
        message: `Binary too large: ${totalSize} bytes (max: ${MAX_SIZE})`,
        stdout: "",
        stderr: "",
        code: null,
      };
    }
    
    // 下载并写入文件
    const body = response.body;
    if (!body) {
      return {
        ok: false,
        message: "Empty response body",
        stdout: "",
        stderr: "",
        code: null,
      };
    }
    
    const writeStream = fs.createWriteStream(binaryPath);
    let downloaded = 0;
    const startTime = Date.now();
    
    const reader = body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      writeStream.write(Buffer.from(value));
      downloaded += value.length;
      
      // 计算下载进度 (5% ~ 90%)
      const percent = totalSize > 0 ? Math.round((downloaded / totalSize) * 85) + 5 : 50;
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? formatBytes(downloaded / elapsed) + "/s" : "计算中...";
      const eta = totalSize > 0 && elapsed > 0
        ? Math.round((totalSize - downloaded) / (downloaded / elapsed)) + "s"
        : "计算中...";
      
      onProgress?.({
        stage: "downloading",
        message: `🇭🇰 下载 ${toolName} v${version}...`,
        percent,
        usingCNMirror: useCN,
        downloadInfo: {
          speed,
          eta,
          downloaded: formatBytes(downloaded),
          total: formatBytes(totalSize),
        },
      });
    }
    
    writeStream.end();
    
    // 等待写入完成
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    
    // 边界检查 6: 验证下载大小
    const stats = fs.statSync(binaryPath);
    if (stats.size === 0) {
      fs.unlinkSync(binaryPath);
      return {
        ok: false,
        message: "Downloaded file is empty",
        stdout: "",
        stderr: "",
        code: null,
      };
    }
    
    // 边界检查 7: 最小大小校验（至少 1KB）
    if (stats.size < 1024) {
      fs.unlinkSync(binaryPath);
      return {
        ok: false,
        message: `Downloaded file too small: ${stats.size} bytes`,
        stdout: "",
        stderr: "",
        code: null,
      };
    }
    
    // 步骤 5: SHA256 校验（可选，失败不阻断）
    onProgress?.({
      stage: "verifying",
      message: `🔍 校验文件完整性...`,
      percent: 92,
      usingCNMirror: useCN,
    });
    
    let sha256Verified = false;
    try {
      const sha256Url = `${downloadUrl}.sha256`;
      const sha256Response = await fetch(sha256Url, {
        headers: { "User-Agent": "Clawdbot/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      
      if (sha256Response.ok) {
        const expectedHash = (await sha256Response.text()).trim().split(/\s+/)[0]?.toLowerCase();
        if (expectedHash && expectedHash.length === 64) {
          const { createHash } = await import("node:crypto");
          const fileBuffer = fs.readFileSync(binaryPath);
          const actualHash = createHash("sha256").update(fileBuffer).digest("hex");
          
          if (actualHash === expectedHash) {
            sha256Verified = true;
          } else {
            // 哈希不匹配，删除文件
            fs.unlinkSync(binaryPath);
            return {
              ok: false,
              message: `SHA256 mismatch for ${toolName}`,
              stdout: "",
              stderr: `Expected: ${expectedHash}\nActual: ${actualHash}`,
              code: null,
            };
          }
        }
      }
    } catch {
      // SHA256 校验失败不阻断安装，但记录日志
    }
    
    // 步骤 6: 设置可执行权限 (Unix)
    if (process.platform !== "win32") {
      fs.chmodSync(binaryPath, 0o755);
    }
    
    const verifyNote = sha256Verified ? " (SHA256 ✓)" : "";
    onProgress?.({
      stage: "verifying",
      message: `✅ ${toolName} v${version} 安装成功！${verifyNote}`,
      percent: 100,
      usingCNMirror: useCN,
    });
    
    return {
      ok: true,
      message: `Installed ${toolName} v${version} to ${binaryPath}${verifyNote}`,
      stdout: `Downloaded ${formatBytes(stats.size)} from HK server`,
      stderr: "",
      code: 0,
    };
    
    } catch (err) {
      // 清理失败的下载
      if (fs.existsSync(binaryPath)) {
        try {
          fs.unlinkSync(binaryPath);
        } catch {
          // ignore cleanup error
        }
      }
      
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // 可重试的错误：网络超时、连接失败
      const message = lastError.message;
      const isRetryable = message.includes("abort") || 
                          message.includes("timeout") ||
                          message.includes("ENOTFOUND") ||
                          message.includes("ECONNREFUSED") ||
                          message.includes("ETIMEDOUT");
      
      if (!isRetryable || attempt === MAX_RETRIES) {
        // 边界检查 8: 网络错误友好提示
        if (message.includes("abort") || message.includes("timeout")) {
          return {
            ok: false,
            message: `Download timeout for ${toolName}`,
            stdout: "",
            stderr: `网络连接超时，已重试 ${attempt} 次`,
            code: null,
          };
        }
        
        if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED")) {
          return {
            ok: false,
            message: `Cannot connect to HK binary server`,
            stdout: "",
            stderr: "无法连接香港服务器，请检查网络连接",
            code: null,
          };
        }
        
        return {
          ok: false,
          message: `Download error: ${message}`,
          stdout: "",
          stderr: message,
          code: null,
        };
      }
      // 继续下一次重试
    }
  }
  
  // 所有重试都失败
  return {
    ok: false,
    message: `Download failed after ${MAX_RETRIES} attempts`,
    stdout: "",
    stderr: lastError?.message ?? "Unknown error",
    code: null,
  };
}

/**
 * 检查工具是否可以从香港服务器安装
 */
function canInstallFromHKServer(toolName: string): boolean {
  if (!shouldUseCNMirror()) return false;
  if (!isToolHostedOnHK(toolName)) return false;
  
  const toolConfig = CLI_TOOL_MIRRORS[toolName];
  if (!toolConfig?.hkBinary) return false;
  
  const platform = getCurrentPlatformForHKBinary();
  return toolConfig.hkBinary.platforms.includes(platform);
}

// ============================================================================
// ClawdbotCN 专属：依赖自动安装
// 为中国用户提供一键安装体验，支持 Linux/WSL2
// ============================================================================

/**
 * 安装 uv (Python 包管理器)
 * ClawdbotCN 专属：支持 macOS (brew)、Linux/WSL2 (curl)、Windows (powershell/winget)
 */
async function installUvDependency(
  timeoutMs: number,
  brewExe?: string,
): Promise<SkillInstallResult> {
  const useCN = shouldUseCNMirror();
  const platform = process.platform;

  // macOS: 优先使用 brew
  if (platform === "darwin" && brewExe) {
    const brewResult = await runCommandWithTimeout([brewExe, "install", "uv"], {
      timeoutMs,
    });
    if (brewResult.code === 0) {
      return { ok: true, message: "uv installed via brew", stdout: brewResult.stdout, stderr: "", code: 0 };
    }
    return {
      ok: false,
      message: "Failed to install uv (brew)",
      stdout: brewResult.stdout.trim(),
      stderr: brewResult.stderr.trim(),
      code: brewResult.code,
    };
  }

  // Windows: 优先使用 pip 安装（国内镜像稳定），然后 winget，最后 PowerShell 脚本
  if (platform === "win32") {
    // 🇨🇳 方案1: 优先使用 pip 安装（国内 PyPI 镜像最稳定）
    if (hasBinary("pip") || hasBinary("pip3")) {
      const pipCmd = hasBinary("pip3") ? "pip3" : "pip";
      const pipArgs = useCN
        ? ["install", "uv", "-i", getPipMirrors()[0], "--trusted-host", new URL(getPipMirrors()[0]).hostname]
        : ["install", "uv"];
      const pipResult = await runCommandWithTimeout(
        [pipCmd, ...pipArgs],
        { timeoutMs: Math.max(timeoutMs, 120_000) },
      );
      if (pipResult.code === 0) {
        // pip installs scripts to Python's Scripts dir; ensure it's on PATH
        const pythonScriptsDir = resolvePythonScriptsDir();
        if (pythonScriptsDir && !process.env.PATH?.includes(pythonScriptsDir)) {
          process.env.PATH = `${pythonScriptsDir};${process.env.PATH}`;
        }
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：uv 已通过国内 PyPI 镜像安装"
            : "uv installed via pip",
          stdout: pipResult.stdout,
          stderr: "",
          code: 0,
        };
      }
    }

    // 方案2: 尝试 winget
    if (hasBinary("winget")) {
      const wingetResult = await runCommandWithTimeout(
        ["winget", "install", "--id", "astral-sh.uv", "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements"],
        { timeoutMs: Math.max(timeoutMs, 180_000) },
      );
      if (wingetResult.code === 0) {
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：uv 已通过 winget 安装"
            : "uv installed via winget",
          stdout: wingetResult.stdout,
          stderr: "",
          code: 0,
        };
      }
    }

    // 方案3: 使用 PowerShell 脚本安装 - 支持多镜像源（国内代理不太稳定）
    const installScripts = getUvInstallScripts("ps1");
    
    let lastError: string = "";
    
    for (const scriptUrl of installScripts) {
      const installScript = `irm '${scriptUrl}' | iex`;
      
      const result = await runCommandWithTimeout(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", installScript],
        { timeoutMs: Math.max(timeoutMs, 120_000) },
      );

      if (result.code === 0) {
        // 添加 uv 到 PATH
        const userProfile = process.env.USERPROFILE || "";
        const uvPath = path.join(userProfile, ".local", "bin");
        if (!process.env.PATH?.includes(uvPath)) {
          process.env.PATH = `${uvPath};${process.env.PATH}`;
        }
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：uv 已安装"
            : "uv installed",
          stdout: result.stdout,
          stderr: "",
          code: 0,
        };
      }
      lastError = result.stderr || result.stdout;
    }
    
    return {
      ok: false,
      message: `Failed to install uv: pip/winget/powershell all failed. Last error: ${lastError}`,
      stdout: "",
      stderr: lastError,
      code: null,
    };
  }

  // Linux/WSL2: 优先使用 pip 安装，然后 curl 脚本
  if (platform === "linux") {
    // 🇨🇳 方案1: 优先使用 pip 安装（国内 PyPI 镜像最稳定）
    if (hasBinary("pip") || hasBinary("pip3")) {
      const pipCmd = hasBinary("pip3") ? "pip3" : "pip";
      const pipMirror = getPipMirrors()[0]; // 清华镜像
      const pipResult = await runCommandWithTimeout(
        [pipCmd, "install", "uv", "-i", pipMirror, "--trusted-host", new URL(pipMirror).hostname],
        { timeoutMs: Math.max(timeoutMs, 120_000) },
      );
      if (pipResult.code === 0) {
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：uv 已通过国内 PyPI 镜像安装"
            : "uv installed via pip",
          stdout: pipResult.stdout,
          stderr: "",
          code: 0,
        };
      }
    }

    // 方案2: 使用 curl 安装脚本 - 支持多镜像源
    const installUrls = getUvInstallScripts("sh");
    
    let lastError: string = "";
    
    for (const installUrl of installUrls) {
      const installScript = `curl -LsSf "${installUrl}" | sh`;
      const result = await runCommandWithTimeout(["sh", "-c", installScript], {
        timeoutMs: Math.max(timeoutMs, 120_000), // 至少 2 分钟
        cwd: process.env.HOME,
      });

      if (result.code === 0) {
        // 添加 uv 到 PATH（通常安装在 ~/.local/bin）
        const uvPath = path.join(process.env.HOME || "", ".local", "bin");
        if (!process.env.PATH?.includes(uvPath)) {
          process.env.PATH = `${uvPath}:${process.env.PATH}`;
        }
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：uv 已通过国内镜像安装"
            : "uv installed via curl",
          stdout: result.stdout,
          stderr: "",
          code: 0,
        };
      }
      lastError = result.stderr || result.stdout;
    }
    
    return {
      ok: false,
      message: `Failed to install uv: pip/curl all failed. Last error: ${lastError}`,
      stdout: "",
      stderr: lastError,
      code: null,
    };
  }

  // 其他平台：不支持自动安装
  return {
    ok: false,
    message: "uv not installed (please install manually: https://docs.astral.sh/uv/)",
    stdout: "",
    stderr: "",
    code: null,
  };
}

/**
 * 安装 Go 语言运行时
 * ClawdbotCN 专属：支持 macOS (brew)、Linux/WSL2 (下载二进制)、Windows (winget/下载)
 */
async function installGoDependency(
  timeoutMs: number,
  brewExe?: string,
): Promise<SkillInstallResult> {
  const useCN = shouldUseCNMirror();
  const platform = process.platform;

  // macOS: 优先使用 brew
  if (platform === "darwin" && brewExe) {
    const brewResult = await runCommandWithTimeout([brewExe, "install", "go"], {
      timeoutMs,
    });
    if (brewResult.code === 0) {
      return { ok: true, message: "go installed via brew", stdout: brewResult.stdout, stderr: "", code: 0 };
    }
    return {
      ok: false,
      message: "Failed to install go (brew)",
      stdout: brewResult.stdout.trim(),
      stderr: brewResult.stderr.trim(),
      code: brewResult.code,
    };
  }

  // Windows: 使用 winget 或直接下载
  if (platform === "win32") {
    // 尝试 winget（Windows 10 1709+ 内置）
    if (hasBinary("winget")) {
      const wingetResult = await runCommandWithTimeout(
        ["winget", "install", "--id", "GoLang.Go", "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements"],
        { timeoutMs: Math.max(timeoutMs, 300_000) },
      );
      if (wingetResult.code === 0) {
        // 刷新 PATH
        const goPath = "C:\\Program Files\\Go\\bin";
        if (!process.env.PATH?.includes(goPath)) {
          process.env.PATH = `${goPath};${process.env.PATH}`;
        }
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：Go 已通过 winget 安装"
            : "go installed via winget",
          stdout: wingetResult.stdout,
          stderr: "",
          code: 0,
        };
      }
    }

    // 尝试 scoop
    if (hasBinary("scoop")) {
      const scoopResult = await runCommandWithTimeout(
        ["scoop", "install", "go"],
        { timeoutMs: Math.max(timeoutMs, 300_000) },
      );
      if (scoopResult.code === 0) {
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：Go 已通过 scoop 安装"
            : "go installed via scoop",
          stdout: scoopResult.stdout,
          stderr: "",
          code: 0,
        };
      }
    }

    // 直接下载安装（使用 msi 安装包）
    // ClawdbotCN 专属：支持多镜像源自动切换
    const goVersion = "1.22.0";
    const arch = process.arch === "arm64" ? "arm64" : "amd64";
    const msiName = `go${goVersion}.windows-${arch}.msi`;
    
    const tempDir = process.env.TEMP || process.env.TMP || "C:\\Windows\\Temp";
    const msiPath = path.join(tempDir, msiName);
    
    // 获取所有可用的镜像源
    const mirrors = useCN
      ? getGoBinaryMirrors()
      : ["https://go.dev/dl"];
    
    let lastError: string = "";
    
    // 依次尝试每个镜像源
    for (const mirror of mirrors) {
      const downloadUrl = `${mirror}/${msiName}`;
      
      try {
        // 下载 MSI
        await downloadFile(downloadUrl, msiPath, Math.max(timeoutMs, 300_000));
        
        // 静默安装
        const msiexecResult = await runCommandWithTimeout(
          ["msiexec", "/i", msiPath, "/quiet", "/norestart"],
          { timeoutMs: Math.max(timeoutMs, 300_000) },
        );
        
        // 清理安装包
        try {
          await fs.promises.unlink(msiPath);
        } catch {
          // 忽略
        }
        
        if (msiexecResult.code === 0) {
          // 刷新 PATH
          const goPath = "C:\\Program Files\\Go\\bin";
          if (!process.env.PATH?.includes(goPath)) {
            process.env.PATH = `${goPath};${process.env.PATH}`;
          }
          return {
            ok: true,
            message: useCN
              ? `🇨🇳 ClawdbotCN 专属：Go 已通过国内镜像安装 (${mirror})`
              : "go installed",
            stdout: `Go installed to C:\\Program Files\\Go`,
            stderr: "",
            code: 0,
          };
        }
        lastError = `msiexec failed: ${msiexecResult.stderr}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // 继续尝试下一个镜像源
        continue;
      }
    }
    
    return {
      ok: false,
      message: `Failed to install Go: ${lastError}`,
      stdout: "",
      stderr: lastError,
      code: null,
    };
  }

  // Linux/WSL2: 下载二进制
  // ClawdbotCN 专属：支持多镜像源自动切换
  if (platform === "linux") {
    const goVersion = "1.22.0";
    const arch = process.arch === "arm64" ? "arm64" : "amd64";
    const tarName = `go${goVersion}.linux-${arch}.tar.gz`;
    
    const goRoot = path.join(process.env.HOME || "", ".clawdbot", "tools", "go");
    const tarPath = path.join(goRoot, tarName);
    
    // 获取所有可用的镜像源
    const mirrors = useCN
      ? getGoBinaryMirrors()
      : ["https://go.dev/dl"];
    
    let lastError: string = "";
    
    // 依次尝试每个镜像源
    for (const mirror of mirrors) {
      const downloadUrl = `${mirror}/${tarName}`;
      
      try {
        await ensureDir(goRoot);
        
        // 下载
        await downloadFile(downloadUrl, tarPath, Math.max(timeoutMs, 180_000));
        
        // 解压
        const extractResult = await runCommandWithTimeout(
          ["tar", "-xzf", tarPath, "-C", goRoot, "--strip-components=1"],
          { timeoutMs: 60_000 },
        );
        
        if (extractResult.code !== 0) {
          lastError = `tar extract failed: ${extractResult.stderr}`;
          continue;
        }
        
        // 清理 tar 文件
        try {
          await fs.promises.unlink(tarPath);
        } catch {
          // 忽略清理失败
        }
        
        // 添加到 PATH
        const goBin = path.join(goRoot, "bin");
        if (!process.env.PATH?.includes(goBin)) {
          process.env.PATH = `${goBin}:${process.env.PATH}`;
        }
        process.env.GOROOT = goRoot;
        
        return {
          ok: true,
          message: useCN
            ? `🇨🇳 ClawdbotCN 专属：Go 已通过国内镜像安装 (${mirror})`
            : "go installed",
          stdout: `Go installed to ${goRoot}`,
          stderr: "",
          code: 0,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // 继续尝试下一个镜像源
        continue;
      }
    }
    
    return {
      ok: false,
      message: `Failed to install Go: ${lastError}`,
      stdout: "",
      stderr: lastError,
      code: null,
    };
  }

  // 其他平台：不支持自动安装
  return {
    ok: false,
    message: "go not installed (please install manually: https://go.dev/dl/)",
    stdout: "",
    stderr: "",
    code: null,
  };
}

/**
 * 安装 Node.js 运行时
 * ClawdbotCN 专属：支持 macOS (brew)、Linux/WSL2 (fnm)、Windows (winget/下载)
 */
async function installNodeDependency(
  timeoutMs: number,
  brewExe?: string,
): Promise<SkillInstallResult> {
  const useCN = shouldUseCNMirror();
  const platform = process.platform;

  // macOS: 优先使用 brew
  if (platform === "darwin" && brewExe) {
    const brewResult = await runCommandWithTimeout([brewExe, "install", "node"], {
      timeoutMs,
    });
    if (brewResult.code === 0) {
      return { ok: true, message: "node installed via brew", stdout: brewResult.stdout, stderr: "", code: 0 };
    }
    return {
      ok: false,
      message: "Failed to install node (brew)",
      stdout: brewResult.stdout.trim(),
      stderr: brewResult.stderr.trim(),
      code: brewResult.code,
    };
  }

  // Windows: 使用 winget 或直接下载
  if (platform === "win32") {
    // 尝试 winget
    if (hasBinary("winget")) {
      const wingetResult = await runCommandWithTimeout(
        ["winget", "install", "--id", "OpenJS.NodeJS.LTS", "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements"],
        { timeoutMs: Math.max(timeoutMs, 300_000) },
      );
      if (wingetResult.code === 0) {
        // 刷新 PATH
        const nodePath = "C:\\Program Files\\nodejs";
        if (!process.env.PATH?.includes(nodePath)) {
          process.env.PATH = `${nodePath};${process.env.PATH}`;
        }
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：Node.js 已通过 winget 安装"
            : "node installed via winget",
          stdout: wingetResult.stdout,
          stderr: "",
          code: 0,
        };
      }
    }

    // 尝试 scoop
    if (hasBinary("scoop")) {
      const scoopResult = await runCommandWithTimeout(
        ["scoop", "install", "nodejs-lts"],
        { timeoutMs: Math.max(timeoutMs, 300_000) },
      );
      if (scoopResult.code === 0) {
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：Node.js 已通过 scoop 安装"
            : "node installed via scoop",
          stdout: scoopResult.stdout,
          stderr: "",
          code: 0,
        };
      }
    }

    // 直接下载安装（使用 msi 安装包）
    // ClawdbotCN 专属：支持多镜像源自动切换
    const nodeVersion = "20.11.0";
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    const msiName = `node-v${nodeVersion}-${arch}.msi`;
    
    const tempDir = process.env.TEMP || process.env.TMP || "C:\\Windows\\Temp";
    const msiPath = path.join(tempDir, msiName);
    
    // 获取所有可用的镜像源
    const mirrors = useCN
      ? getNodeBinaryMirrors()
      : ["https://nodejs.org/dist"];
    
    let lastError: string = "";
    
    // 依次尝试每个镜像源
    for (const mirror of mirrors) {
      const downloadUrl = `${mirror}/v${nodeVersion}/${msiName}`;
      
      try {
        // 下载 MSI
        await downloadFile(downloadUrl, msiPath, Math.max(timeoutMs, 300_000));
        
        // 静默安装
        const msiexecResult = await runCommandWithTimeout(
          ["msiexec", "/i", msiPath, "/quiet", "/norestart"],
          { timeoutMs: Math.max(timeoutMs, 300_000) },
        );
        
        // 清理安装包
        try {
          await fs.promises.unlink(msiPath);
        } catch {
          // 忽略
        }
        
        if (msiexecResult.code === 0) {
          // 刷新 PATH
          const nodePath = "C:\\Program Files\\nodejs";
          if (!process.env.PATH?.includes(nodePath)) {
            process.env.PATH = `${nodePath};${process.env.PATH}`;
          }
          return {
            ok: true,
            message: useCN
              ? `🇨🇳 ClawdbotCN 专属：Node.js 已通过国内镜像安装 (${mirror})`
              : "node installed",
            stdout: `Node.js installed to ${nodePath}`,
            stderr: "",
            code: 0,
          };
        }
        lastError = `msiexec failed: ${msiexecResult.stderr}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // 继续尝试下一个镜像源
        continue;
      }
    }
    
    return {
      ok: false,
      message: `Failed to install Node.js: ${lastError}`,
      stdout: "",
      stderr: lastError,
      code: null,
    };
  }

  // Linux/WSL2: 优先使用系统包管理器，避免依赖 GitHub
  if (platform === "linux") {
    let lastError = "";

    // 方案 1: 使用 apt (Debian/Ubuntu)
    if (hasBinary("apt-get")) {
      // Trying to install Node.js via apt-get
      // 先更新包列表
      await runCommandWithTimeout(["sudo", "apt-get", "update", "-qq"], {
        timeoutMs: 60_000,
      });
      const aptResult = await runCommandWithTimeout(
        ["sudo", "apt-get", "install", "-y", "nodejs", "npm"],
        { timeoutMs: Math.max(timeoutMs, 120_000) },
      );
      if (aptResult.code === 0) {
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：Node.js 已通过 apt 安装"
            : "node installed via apt",
          stdout: aptResult.stdout,
          stderr: "",
          code: 0,
        };
      }
      lastError = aptResult.stderr;
    }

    // 方案 2: 使用 yum/dnf (RHEL/CentOS/Fedora)
    const yumCmd = hasBinary("dnf") ? "dnf" : hasBinary("yum") ? "yum" : null;
    if (yumCmd) {
      // Trying to install Node.js via yum/dnf
      const yumResult = await runCommandWithTimeout(
        ["sudo", yumCmd, "install", "-y", "nodejs", "npm"],
        { timeoutMs: Math.max(timeoutMs, 120_000) },
      );
      if (yumResult.code === 0) {
        return {
          ok: true,
          message: useCN
            ? `🇨🇳 ClawdbotCN 专属：Node.js 已通过 ${yumCmd} 安装`
            : `node installed via ${yumCmd}`,
          stdout: yumResult.stdout,
          stderr: "",
          code: 0,
        };
      }
      lastError = yumResult.stderr;
    }

    // 方案 3: 使用 pacman (Arch Linux)
    if (hasBinary("pacman")) {
      // Trying to install Node.js via pacman
      const pacmanResult = await runCommandWithTimeout(
        ["sudo", "pacman", "-S", "--noconfirm", "nodejs", "npm"],
        { timeoutMs: Math.max(timeoutMs, 120_000) },
      );
      if (pacmanResult.code === 0) {
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：Node.js 已通过 pacman 安装"
            : "node installed via pacman",
          stdout: pacmanResult.stdout,
          stderr: "",
          code: 0,
        };
      }
      lastError = pacmanResult.stderr;
    }

    // 方案 4: 使用 fnm (需要 GitHub，作为最后备选)
    // 方案 4: 使用 fnm (需要 GitHub，作为最后备选)
    // 注意：国内用户可能无法访问 GitHub，此方案可能失败
    const fnmInstallUrl = useCN
      ? `${CN_MIRRORS.github}/https://fnm.vercel.app/install`
      : "https://fnm.vercel.app/install";
    
    const fnmInstallScript = `curl -fsSL "${fnmInstallUrl}" | bash -s -- --skip-shell`;
    const fnmResult = await runCommandWithTimeout(["sh", "-c", fnmInstallScript], {
      timeoutMs: Math.max(timeoutMs, 60_000),
      cwd: process.env.HOME,
    });
    
    if (fnmResult.code === 0) {
      // 配置 fnm 使用国内镜像
      const fnmPath = path.join(process.env.HOME || "", ".local", "share", "fnm");
      if (!process.env.PATH?.includes(fnmPath)) {
        process.env.PATH = `${fnmPath}:${process.env.PATH}`;
      }
      
      // 设置 Node.js 镜像
      if (useCN) {
        process.env.FNM_NODE_DIST_MIRROR = CN_MIRRORS.node;
      }
      
      // 安装 Node.js LTS
      const nodeInstallScript = `${fnmPath}/fnm install --lts && ${fnmPath}/fnm default lts-latest`;
      const nodeResult = await runCommandWithTimeout(["sh", "-c", nodeInstallScript], {
        timeoutMs: Math.max(timeoutMs, 180_000),
        cwd: process.env.HOME,
        env: useCN ? { FNM_NODE_DIST_MIRROR: CN_MIRRORS.node } : undefined,
      });
      
      if (nodeResult.code === 0) {
        return {
          ok: true,
          message: useCN
            ? "🇨🇳 ClawdbotCN 专属：Node.js 已通过 fnm + 国内镜像安装"
            : "node installed via fnm",
          stdout: nodeResult.stdout,
          stderr: "",
          code: 0,
        };
      }
      lastError = nodeResult.stderr;
    } else {
      lastError = fnmResult.stderr || "fnm installation failed (GitHub may be inaccessible)";
    }

    return {
      ok: false,
      message: useCN
        ? "Node.js 安装失败。请手动安装：sudo apt install nodejs npm 或 sudo yum install nodejs npm"
        : `Failed to install Node.js: ${lastError}`,
      stdout: "",
      stderr: lastError,
      code: null,
    };
  }

  // 其他平台
  return {
    ok: false,
    message: "node not installed (please install manually: https://nodejs.org/)",
    stdout: "",
    stderr: "",
    code: null,
  };
}

async function resolveBrewBinDir(timeoutMs: number, brewExe?: string): Promise<string | undefined> {
  const exe = brewExe ?? (hasBinary("brew") ? "brew" : resolveBrewExecutable());
  if (!exe) return undefined;

  const prefixResult = await runCommandWithTimeout([exe, "--prefix"], {
    timeoutMs: Math.min(timeoutMs, 30_000),
  });
  if (prefixResult.code === 0) {
    const prefix = prefixResult.stdout.trim();
    if (prefix) return path.join(prefix, "bin");
  }

  const envPrefix = process.env.HOMEBREW_PREFIX?.trim();
  if (envPrefix) return path.join(envPrefix, "bin");

  for (const candidate of ["/opt/homebrew/bin", "/usr/local/bin"]) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return undefined;
}

export async function installSkill(params: SkillInstallRequest): Promise<SkillInstallResult> {
  const timeoutMs = Math.min(Math.max(params.timeoutMs ?? 300_000, 1_000), 900_000);
  const workspaceDir = resolveUserPath(params.workspaceDir);
  const entries = loadWorkspaceSkillEntries(workspaceDir);
  const entry = entries.find((item) => item.skill.name === params.skillName);
  if (!entry) {
    return {
      ok: false,
      message: `Skill not found: ${params.skillName}`,
      stdout: "",
      stderr: "",
      code: null,
    };
  }

  const spec = findInstallSpec(entry, params.installId);
  if (!spec) {
    return {
      ok: false,
      message: `Installer not found: ${params.installId}`,
      stdout: "",
      stderr: "",
      code: null,
    };
  }
  // OS compatibility filter: skip install specs that target a different platform.
  // spec.os is an optional list of supported platforms (e.g., ["darwin", "linux"]).
  // If present and the current platform is not listed, skip the spec.
  if (spec.os && spec.os.length > 0) {
    const currentPlatform = process.platform;
    const normalizedTargets = spec.os.map((o) => o.trim().toLowerCase());
    if (!normalizedTargets.includes(currentPlatform)) {
      return {
        ok: false,
        message: `Skipped: installer only targets ${spec.os.join(", ")} (current: ${currentPlatform})`,
        stdout: "",
        stderr: "",
        code: null,
      };
    }
  }

  // brew is macOS/Linux-only; skip on Windows instead of failing with confusing errors
  if (spec.kind === "brew" && process.platform === "win32") {
    return {
      ok: false,
      message: "brew is not available on Windows; this skill requires macOS or Linux",
      stdout: "",
      stderr: "",
      code: null,
    };
  }

  if (spec.kind === "download") {
    return await installDownloadSpec({ entry, spec, timeoutMs, onProgress: params.onProgress });
  }
  
  const useCN = shouldUseCNMirror();

  const prefs = resolveSkillsInstallPreferences(params.config);
  const command = buildInstallCommand(spec, prefs);
  if (command.error) {
    return {
      ok: false,
      message: command.error,
      stdout: "",
      stderr: "",
      code: null,
    };
  }

  const brewExe = hasBinary("brew") ? "brew" : resolveBrewExecutable();
  if (spec.kind === "brew" && !brewExe) {
    // ClawdbotCN 专属：brew 未安装时，尝试从香港服务器下载二进制
    // 边界检查：只有在国内用户 + 工具支持香港托管时才尝试
    if (spec.formula && canInstallFromHKServer(spec.formula.split("/").pop() || "")) {
      const toolName = spec.formula.split("/").pop() || "";
      params.onProgress?.({
        stage: "installing",
        message: useCN
          ? `🇭🇰 brew 未安装，尝试从香港服务器下载 ${toolName}...`
          : `brew not installed, trying HK binary server for ${toolName}...`,
        usingCNMirror: useCN,
        percent: 10,
      });
      
      const hkResult = await installFromHKBinaryServer({
        toolName,
        timeoutMs,
        onProgress: params.onProgress,
      });
      
      if (hkResult.ok) {
        return hkResult;
      }
      // HK 服务器也失败了，返回原始错误
      return {
        ok: false,
        message: useCN
          ? `brew 未安装，且香港服务器下载失败: ${hkResult.message}`
          : `brew not installed, HK fallback failed: ${hkResult.message}`,
        stdout: hkResult.stdout,
        stderr: hkResult.stderr,
        code: null,
      };
    }
    
    return {
      ok: false,
      message: "brew not installed",
      stdout: "",
      stderr: "",
      code: null,
    };
  }
  if (spec.kind === "uv" && !hasBinary("uv")) {
    // ClawdbotCN 专属：自动安装 uv 依赖
    params.onProgress?.({
      stage: "installing",
      message: useCN ? "🚀 正在为您安装 Python 包管理器 (uv)..." : "Installing uv...",
      currentDependency: "uv",
      usingCNMirror: useCN,
      percent: 10,
    });
    const uvInstallResult = await installUvDependency(timeoutMs, brewExe);
    if (!uvInstallResult.ok) {
      return uvInstallResult;
    }
    params.onProgress?.({
      stage: "installing",
      message: useCN ? "✅ uv 安装成功" : "uv installed",
      currentDependency: "uv",
      usingCNMirror: useCN,
      percent: 30,
    });
  }
  
  // ClawdbotCN 专属：自动安装 Node.js 依赖
  if (spec.kind === "node" && !hasBinary("node") && !hasBinary("npm")) {
    params.onProgress?.({
      stage: "installing",
      message: useCN ? "🚀 正在为您安装 Node.js 运行时..." : "Installing Node.js...",
      currentDependency: "node",
      usingCNMirror: useCN,
      percent: 10,
    });
    const nodeInstallResult = await installNodeDependency(timeoutMs, brewExe);
    if (!nodeInstallResult.ok) {
      return nodeInstallResult;
    }
    params.onProgress?.({
      stage: "installing",
      message: useCN ? "✅ Node.js 安装成功" : "Node.js installed",
      currentDependency: "node",
      usingCNMirror: useCN,
      percent: 30,
    });
  }
  
  if (!command.argv || command.argv.length === 0) {
    return {
      ok: false,
      message: "invalid install command",
      stdout: "",
      stderr: "",
      code: null,
    };
  }

  if (spec.kind === "brew" && brewExe && command.argv[0] === "brew") {
    command.argv[0] = brewExe;
  }

  // ClawdbotCN 专属：检查 Go 是否可用（包括 Windows 常见安装路径）
  const goExe = spec.kind === "go" ? findGoExecutable() : undefined;
  
  if (spec.kind === "go" && !goExe) {
    // ClawdbotCN 专属：自动安装 Go 依赖
    params.onProgress?.({
      stage: "installing",
      message: useCN ? "🚀 正在为您安装 Go 语言运行时..." : "Installing Go...",
      currentDependency: "go",
      usingCNMirror: useCN,
      percent: 10,
    });
    const goInstallResult = await installGoDependency(timeoutMs, brewExe);
    if (!goInstallResult.ok) {
      return goInstallResult;
    }
    params.onProgress?.({
      stage: "installing",
      message: useCN ? "✅ Go 安装成功" : "Go installed",
      currentDependency: "go",
      usingCNMirror: useCN,
      percent: 30,
    });
  }

  // ClawdbotCN 专属：合并命令自带的环境变量（如 bun 的 BUN_CONFIG_REGISTRY）
  let env: NodeJS.ProcessEnv | undefined = command.env ? { ...command.env } : undefined;
  
  if (spec.kind === "go") {
    // Go 使用国内镜像加速
    const goProxyEnv = getGoProxyEnv();
    if (brewExe) {
      const brewBin = await resolveBrewBinDir(timeoutMs, brewExe);
      if (brewBin) {
        env = { ...env, GOBIN: brewBin, ...goProxyEnv };
      } else {
        env = { ...env, ...goProxyEnv };
      }
    } else {
      env = { ...env, ...goProxyEnv };
    }
    
    // ClawdbotCN 专属：如果找到 Go 的完整路径，替换命令中的 "go"
    const foundGoExe = findGoExecutable();
    if (foundGoExe && foundGoExe !== "go" && command.argv && command.argv[0] === "go") {
      command.argv[0] = foundGoExe;
    }
  }

  // ClawdbotCN 专属：通知开始安装技能包
  params.onProgress?.({
    stage: "installing",
    message: useCN
      ? `🚀 正在安装 ${params.skillName}...`
      : `Installing ${params.skillName}...`,
    usingCNMirror: useCN,
    percent: 50,
  });

  const result = await (async () => {
    const argv = command.argv;
    if (!argv || argv.length === 0) {
      return { code: null, stdout: "", stderr: "invalid install command" };
    }
    
    // ClawdbotCN 专属：Node.js 包使用多镜像 fallback 机制
    if (spec.kind === "node" && spec.package && useCN) {
      const prefs = resolveSkillsInstallPreferences(params.config);
      return await installNodePackageWithFallback({
        packageName: spec.package,
        prefs,
        timeoutMs,
        onProgress: params.onProgress,
      });
    }
    
    try {
      return await runCommandWithTimeout(argv, {
        timeoutMs,
        env,
      });
    } catch (err) {
      const stderr = err instanceof Error ? err.message : String(err);
      return { code: null, stdout: "", stderr };
    }
  })();

  const success = result.code === 0;
  
  // ClawdbotCN 专属：通知安装验证
  if (success) {
    params.onProgress?.({
      stage: "verifying",
      message: useCN ? "🔍 正在验证安装..." : "Verifying installation...",
      usingCNMirror: useCN,
      percent: 90,
    });
  }
  
  // ClawdbotCN 专属：安装失败时尝试从香港服务器下载
  if (!success && spec.kind === "brew" && spec.formula && useCN) {
    const toolName = spec.formula.split("/").pop() || "";
    
    // 检查是否支持香港服务器下载
    if (canInstallFromHKServer(toolName)) {
      params.onProgress?.({
        stage: "installing",
        message: `🇭🇰 brew 安装失败，尝试从香港服务器下载 ${toolName}...`,
        usingCNMirror: useCN,
        percent: 60,
      });
      
      const hkResult = await installFromHKBinaryServer({
        toolName,
        timeoutMs,
        onProgress: params.onProgress,
      });
      
      if (hkResult.ok) {
        return hkResult;
      }
      
      // 香港服务器也失败了，返回综合错误信息
      return {
        ok: false,
        message: useCN
          ? `安装失败：brew 和香港服务器都无法安装 ${toolName}`
          : `Installation failed: both brew and HK server failed for ${toolName}`,
        stdout: `brew error: ${result.stdout}\nHK error: ${hkResult.stdout}`,
        stderr: `brew: ${result.stderr}\nHK: ${hkResult.stderr}`,
        code: result.code,
      };
    }
  }
  
  return {
    ok: success,
    message: success ? "Installed" : formatInstallFailureMessage(result),
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    code: result.code,
  };
}
