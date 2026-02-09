import fs from "node:fs";
import path from "node:path";
import type { ClawdbotConfig, SkillConfig } from "../../config/config.js";
import { detectChinaRegion, isSkillHiddenInCn } from "../../config/region-cn.js";
import { CONFIG_DIR } from "../../utils.js";
import { resolveSkillKey } from "./frontmatter.js";
import type { SkillEligibilityContext, SkillEntry } from "./types.js";

const DEFAULT_CONFIG_VALUES: Record<string, boolean> = {
  "browser.enabled": true,
};

function isTruthy(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function resolveConfigPath(config: ClawdbotConfig | undefined, pathStr: string) {
  const parts = pathStr.split(".").filter(Boolean);
  let current: unknown = config;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function isConfigPathTruthy(config: ClawdbotConfig | undefined, pathStr: string): boolean {
  const value = resolveConfigPath(config, pathStr);
  if (value === undefined && pathStr in DEFAULT_CONFIG_VALUES) {
    return DEFAULT_CONFIG_VALUES[pathStr] === true;
  }
  return isTruthy(value);
}

export function resolveSkillConfig(
  config: ClawdbotConfig | undefined,
  skillKey: string,
): SkillConfig | undefined {
  const skills = config?.skills?.entries;
  if (!skills || typeof skills !== "object") return undefined;
  const entry = (skills as Record<string, SkillConfig | undefined>)[skillKey];
  if (!entry || typeof entry !== "object") return undefined;
  return entry;
}

export function resolveRuntimePlatform(): string {
  return process.platform;
}

function normalizeAllowlist(input: unknown): string[] | undefined {
  if (!input) return undefined;
  if (!Array.isArray(input)) return undefined;
  const normalized = input.map((entry) => String(entry).trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function isBundledSkill(entry: SkillEntry): boolean {
  return entry.skill.source === "clawdbot-bundled";
}

export function resolveBundledAllowlist(config?: ClawdbotConfig): string[] | undefined {
  return normalizeAllowlist(config?.skills?.allowBundled);
}

export function isBundledSkillAllowed(entry: SkillEntry, allowlist?: string[]): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  if (!isBundledSkill(entry)) return true;
  const key = resolveSkillKey(entry.skill, entry);
  return allowlist.includes(key) || allowlist.includes(entry.skill.name);
}

// ============================================================================
// Binary lookup cache — 避免对同一个二进制文件重复扫描数万次文件系统
// 缓存有 TTL，安装新技能后可手动清除
// ============================================================================

/** binary name → full path (found) 或 null (not found) */
const _binaryCache = new Map<string, string | null>();
let _binaryCacheCreatedAt = Date.now();
/** 缓存有效期：30 秒（覆盖单次页面加载 + 余量） */
const BINARY_CACHE_TTL_MS = 30_000;

/**
 * 清除二进制查找缓存
 * 在安装/卸载技能后调用，确保下一次查找获取最新结果
 */
export function clearBinaryCache(): void {
  _binaryCache.clear();
  _binaryCacheCreatedAt = Date.now();
  // 同时清除 PATH 搜索路径缓存，确保 PATH 变更后能重新扫描
  _searchPathsMemo = null;
  _searchPathsEnv = null;
}

function isBinaryCacheExpired(): boolean {
  return Date.now() - _binaryCacheCreatedAt > BINARY_CACHE_TTL_MS;
}

// ============================================================================
// Windows 搜索路径 — 只构建一次，避免每次调用都 path.join 几十个路径
// ============================================================================

let _windowsCommonPaths: string[] | null = null;

/**
 * 获取 Windows 常见安装路径（带 memoize）
 * ClawdbotCN 专属：小白用户常用的安装位置
 */
function getWindowsCommonPaths(): string[] {
  if (_windowsCommonPaths) return _windowsCommonPaths;

  const home = process.env.USERPROFILE || process.env.HOME || "";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");

  const candidates = [
    // Node.js / npm / pnpm / yarn / bun 常见位置
    path.join(appData, "npm"),
    path.join(localAppData, "pnpm"),
    path.join(home, ".pnpm"),
    path.join(localAppData, "Yarn", "bin"),
    path.join(home, ".bun", "bin"),
    path.join(localAppData, "bun", "bin"),

    // Go 常见位置
    path.join(home, "go", "bin"),
    path.join(programFiles, "Go", "bin"),
    "C:\\Go\\bin",

    // Python / uv / pip 常见位置
    path.join(localAppData, "Programs", "Python", "Python312", "Scripts"),
    path.join(localAppData, "Programs", "Python", "Python311", "Scripts"),
    path.join(localAppData, "Programs", "Python", "Python310", "Scripts"),
    path.join(home, ".local", "bin"),
    path.join(localAppData, "uv", "bin"),
    path.join(appData, "Python", "Scripts"),

    // Rust / Cargo
    path.join(home, ".cargo", "bin"),

    // Scoop
    path.join(home, "scoop", "shims"),

    // Chocolatey
    path.join(programFiles, "Chocolatey", "bin"),
    "C:\\ProgramData\\chocolatey\\bin",

    // winget 应用
    path.join(localAppData, "Microsoft", "WinGet", "Links"),

    // 通用
    path.join(programFiles, "nodejs"),
    path.join(programFilesX86, "nodejs"),
  ].filter(Boolean);

  // 只保留实际存在的目录，避免对不存在的路径做无用 accessSync
  _windowsCommonPaths = candidates.filter((dir) => {
    try {
      fs.accessSync(dir, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  });

  return _windowsCommonPaths;
}

/**
 * 获取 Clawdbot 工具目录的搜索路径
 * ClawdbotCN 专属：检查 ~/.clawdbot/tools/{toolName}/ 目录
 */
function getClawdbotToolPaths(bin: string): string[] {
  const toolsDir = path.join(CONFIG_DIR, "tools");
  const toolDir = path.join(toolsDir, bin);
  
  // 搜索 ~/.clawdbot/tools 和 ~/.clawdbot/tools/{toolName}
  return [toolsDir, toolDir];
}

/** 预构建的搜索路径列表（memoized，避免每次调用都重建数组 + Set） */
let _searchPathsMemo: string[] | null = null;
let _searchPathsPlatform: string | null = null;
let _searchPathsEnv: string | null = null;

function getSearchPaths(): string[] {
  const isWindows = process.platform === "win32";
  const pathEnv = process.env.PATH ?? "";
  // 如果平台没变、PATH 环境变量也没变，且已缓存，直接返回
  if (_searchPathsMemo && _searchPathsPlatform === process.platform && _searchPathsEnv === pathEnv) {
    return _searchPathsMemo;
  }
  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  _searchPathsMemo = isWindows
    ? [...new Set([...parts, ...getWindowsCommonPaths()])]
    : [...new Set(parts)];
  _searchPathsPlatform = process.platform;
  _searchPathsEnv = pathEnv;
  return _searchPathsMemo;
}

/**
 * 获取二进制文件的完整路径（带缓存）
 * ClawdbotCN 专属：用于运行时执行从香港服务器下载的工具
 * @returns 二进制文件的完整路径，找不到则返回 undefined
 */
export function getBinaryPath(bin: string): string | undefined {
  // 缓存过期时自动清除
  if (isBinaryCacheExpired()) {
    clearBinaryCache();
  }

  // 缓存命中：直接返回（null 表示"已确认不存在"）
  if (_binaryCache.has(bin)) {
    return _binaryCache.get(bin) ?? undefined;
  }

  const isWindows = process.platform === "win32";

  // ClawdbotCN 专属：优先检查 Clawdbot 工具目录
  const clawdbotToolPaths = getClawdbotToolPaths(bin);
  const basePaths = getSearchPaths();
  const searchPaths = [...new Set([...clawdbotToolPaths, ...basePaths])];

  const candidates = isWindows && !bin.toLowerCase().endsWith(".exe")
    ? [bin, `${bin}.exe`, `${bin}.cmd`, `${bin}.bat`]
    : [bin];

  const accessFlag = isWindows ? fs.constants.R_OK : fs.constants.X_OK;

  for (const part of searchPaths) {
    for (const candidate of candidates) {
      const fullPath = path.join(part, candidate);
      try {
        fs.accessSync(fullPath, accessFlag);
        // 找到了 → 缓存并返回
        _binaryCache.set(bin, fullPath);
        return fullPath;
      } catch {
        // keep scanning
      }
    }
  }

  // 确认不存在 → 缓存 null，避免下次重复扫描
  _binaryCache.set(bin, null);
  return undefined;
}

/**
 * 检查二进制文件是否存在（带缓存）
 * ClawdbotCN 专属：增强 Windows 兼容性，自动检查常见安装路径
 */
export function hasBinary(bin: string): boolean {
  return getBinaryPath(bin) !== undefined;
}

export function shouldIncludeSkill(params: {
  entry: SkillEntry;
  config?: ClawdbotConfig;
  eligibility?: SkillEligibilityContext;
}): boolean {
  const { entry, config, eligibility } = params;
  const skillKey = resolveSkillKey(entry.skill, entry);
  const skillConfig = resolveSkillConfig(config, skillKey);
  const allowBundled = normalizeAllowlist(config?.skills?.allowBundled);
  const osList = entry.clawdbot?.os ?? [];
  const remotePlatforms = eligibility?.remote?.platforms ?? [];

  // 中国区域隐藏特定技能（如 clawdhub，国际版技能市场工具）
  if (detectChinaRegion() && isSkillHiddenInCn(skillKey)) {
    return false;
  }

  if (skillConfig?.enabled === false) return false;
  if (!isBundledSkillAllowed(entry, allowBundled)) return false;
  if (
    osList.length > 0 &&
    !osList.includes(resolveRuntimePlatform()) &&
    !remotePlatforms.some((platform) => osList.includes(platform))
  ) {
    return false;
  }
  if (entry.clawdbot?.always === true) {
    return true;
  }

  const requiredBins = entry.clawdbot?.requires?.bins ?? [];
  if (requiredBins.length > 0) {
    for (const bin of requiredBins) {
      if (hasBinary(bin)) continue;
      if (eligibility?.remote?.hasBin?.(bin)) continue;
      return false;
    }
  }
  const requiredAnyBins = entry.clawdbot?.requires?.anyBins ?? [];
  if (requiredAnyBins.length > 0) {
    const anyFound =
      requiredAnyBins.some((bin) => hasBinary(bin)) ||
      eligibility?.remote?.hasAnyBin?.(requiredAnyBins);
    if (!anyFound) return false;
  }

  const requiredEnv = entry.clawdbot?.requires?.env ?? [];
  if (requiredEnv.length > 0) {
    for (const envName of requiredEnv) {
      if (process.env[envName]) continue;
      if (skillConfig?.env?.[envName]) continue;
      if (skillConfig?.apiKey && entry.clawdbot?.primaryEnv === envName) {
        continue;
      }
      return false;
    }
  }

  const requiredConfig = entry.clawdbot?.requires?.config ?? [];
  if (requiredConfig.length > 0) {
    for (const configPath of requiredConfig) {
      if (!isConfigPathTruthy(config, configPath)) return false;
    }
  }

  return true;
}
