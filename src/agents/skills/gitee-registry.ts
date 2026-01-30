/**
 * Gitee Skills Registry
 *
 * 从 Gitee 仓库获取和下载汉化版 skills
 * Fetch and download localized skills from Gitee repository
 *
 * 注意：此模块现在支持切换到 ClawdSkillsProxy 服务
 * 通过环境变量 CLAWDBOT_SKILLS_PROVIDER 控制：
 * - "clawdskillsproxy" (默认): 使用阿里云 ClawdSkillsProxy 服务
 * - "gitee": 使用原 Gitee 仓库
 */

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";

import { CONFIG_DIR, ensureDir } from "../../utils.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  fetchProxySkillsIndex,
  installProxySkill,
  DEFAULT_PROXY_CONFIG,
} from "./clawdskillsproxy-registry.js";

const logger = createSubsystemLogger("gitee-registry");

// ============================================================================
// Provider Selection
// ============================================================================

/**
 * 获取当前使用的 skills provider
 * @returns "clawdskillsproxy" | "gitee"
 */
export function getSkillsProvider(): "clawdskillsproxy" | "gitee" {
  const provider = process.env.CLAWDBOT_SKILLS_PROVIDER?.trim().toLowerCase();
  if (provider === "gitee") return "gitee";
  return "clawdskillsproxy"; // 默认使用新服务
}

/**
 * 检查是否使用 ClawdSkillsProxy
 */
function useProxy(): boolean {
  return getSkillsProvider() === "clawdskillsproxy";
}

// ============================================================================
// Types
// ============================================================================

/** Remote skill metadata from index.json */
export interface RemoteSkillMeta {
  /** Skill name (folder name) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Emoji icon */
  emoji?: string;
  /** Path in repository (usually same as name) */
  path: string;
  /** Semantic version */
  version?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Author information */
  author?: string;
}

/** Remote skills index structure */
export interface RemoteSkillsIndex {
  /** Index schema version */
  version: number;
  /** Last update timestamp */
  updated: string;
  /** Available skills */
  skills: RemoteSkillMeta[];
}

/** Gitee registry configuration */
export interface GiteeRegistryConfig {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Branch name (default: main) */
  branch?: string;
  /** Request timeout in ms */
  timeoutMs?: number;
}

/** Result of fetching remote skills index */
export type FetchIndexResult =
  | { ok: true; index: RemoteSkillsIndex }
  | { ok: false; error: string };

/** Result of installing a remote skill */
export type InstallSkillResult =
  | { ok: true; skillDir: string; files: string[] }
  | { ok: false; error: string };

// ============================================================================
// Constants
// ============================================================================

/** Default Gitee repository for CN skills */
export const DEFAULT_GITEE_REGISTRY: GiteeRegistryConfig = {
  owner: "tecbinai",
  repo: "skills",
  branch: "master",
  timeoutMs: 30_000,
};

/** Default timeout for requests */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Managed skills directory */
const MANAGED_SKILLS_DIR = path.join(CONFIG_DIR, "skills");

// ============================================================================
// Bundled Skills Support (本地预打包 Skills 支持)
// ============================================================================

/**
 * 获取 bundled skills 目录中的技能路径
 */
function getBundledSkillPath(skillName: string): string | null {
  const bundledDir = process.env.CLAWDBOT_BUNDLED_SKILLS_DIR?.trim();
  if (!bundledDir) return null;

  const skillPath = path.join(bundledDir, skillName);
  const skillMdPath = path.join(skillPath, "SKILL.md");

  if (fs.existsSync(skillMdPath)) {
    return skillPath;
  }

  return null;
}

/**
 * 递归复制目录
 */
async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

/**
 * 递归列出目录中的所有文件
 */
async function listFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await listFilesRecursive(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 从 bundled skills 目录安装（本地复制，秒级完成）
 */
async function installFromBundled(
  skillName: string,
  targetDir: string,
): Promise<InstallSkillResult | null> {
  const bundledPath = getBundledSkillPath(skillName);
  if (!bundledPath) {
    return null; // bundled 中没有这个 skill
  }

  const destPath = path.join(targetDir, skillName);

  logger.info("Installing skill from bundled (local copy)", {
    name: skillName,
    source: bundledPath,
    target: destPath,
  });

  try {
    // 如果目标已存在，先删除
    if (fs.existsSync(destPath)) {
      await fs.promises.rm(destPath, { recursive: true, force: true });
    }

    // 复制整个目录
    await copyDirRecursive(bundledPath, destPath);

    // 验证 SKILL.md 存在
    const skillMdPath = path.join(destPath, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      await fs.promises.rm(destPath, { recursive: true, force: true });
      return { ok: false, error: "SKILL.md not found after copy" };
    }

    // 列出安装的文件
    const files = await listFilesRecursive(destPath);

    logger.info("Skill installed from bundled successfully", {
      name: skillName,
      fileCount: files.length,
    });

    return {
      ok: true,
      skillDir: destPath,
      files,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("Failed to install from bundled, will try remote", {
      name: skillName,
      error: message,
    });
    return null;
  }
}

/**
 * 检查技能是否在 bundled 目录中可用
 */
export function isSkillInBundled(skillName: string): boolean {
  return getBundledSkillPath(skillName) !== null;
}

/**
 * 获取 bundled 目录中的所有技能名
 */
export function getBundledSkillNames(): string[] {
  const bundledDir = process.env.CLAWDBOT_BUNDLED_SKILLS_DIR?.trim();
  if (!bundledDir || !fs.existsSync(bundledDir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(bundledDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => {
        const skillMd = path.join(bundledDir, entry.name, "SKILL.md");
        return fs.existsSync(skillMd);
      })
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

// ============================================================================
// URL Builders
// ============================================================================

function buildRawUrl(config: GiteeRegistryConfig, filePath: string): string {
  const branch = config.branch ?? "main";
  return `https://gitee.com/${config.owner}/${config.repo}/raw/${branch}/${filePath}`;
}

function buildApiContentsUrl(config: GiteeRegistryConfig, dirPath: string): string {
  return `https://gitee.com/api/v5/repos/${config.owner}/${config.repo}/contents/${dirPath}`;
}

// ============================================================================
// Fetch Utilities
// ============================================================================

function isNodeReadableStream(value: unknown): value is NodeJS.ReadableStream {
  return Boolean(value && typeof (value as NodeJS.ReadableStream).pipe === "function");
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Clawdbot-Skills-Registry/1.0",
        Accept: "application/json, text/plain, */*",
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadFileToPath(
  url: string,
  destPath: string,
  timeoutMs: number,
): Promise<void> {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  await ensureDir(path.dirname(destPath));
  const file = fs.createWriteStream(destPath);
  const body = response.body as unknown;
  const readable = isNodeReadableStream(body)
    ? body
    : Readable.fromWeb(body as NodeReadableStream);
  await pipeline(readable, file);
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Try to load index.json from local bundled skills directory
 */
function tryLoadLocalIndex(): FetchIndexResult {
  const bundledDir = process.env.CLAWDBOT_BUNDLED_SKILLS_DIR?.trim();
  if (!bundledDir) return { ok: false, error: "No local skills directory" };

  // Look for index.json in parent directory of skills
  const parentDir = path.dirname(bundledDir);
  const localIndexPath = path.join(parentDir, "index.json");

  if (!fs.existsSync(localIndexPath)) {
    // Also try skills directory itself
    const altPath = path.join(bundledDir, "..", "index.json");
    if (!fs.existsSync(altPath)) {
      return { ok: false, error: "Local index.json not found" };
    }
  }

  try {
    const content = fs.readFileSync(localIndexPath, "utf-8");
    const index = JSON.parse(content) as RemoteSkillsIndex;

    if (!index.skills || !Array.isArray(index.skills)) {
      return { ok: false, error: "Invalid local index format" };
    }

    logger.info("Loaded local skills index", {
      skillCount: index.skills.length,
      updated: index.updated,
      source: localIndexPath,
    });

    return { ok: true, index };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Failed to load local index: ${message}` };
  }
}

/**
 * Fetch the remote skills index
 * 根据 CLAWDBOT_SKILLS_PROVIDER 环境变量选择数据源：
 * - "clawdskillsproxy" (默认): 使用阿里云 ClawdSkillsProxy 服务
 * - "gitee": 使用原 Gitee 仓库
 */
export async function fetchRemoteSkillsIndex(
  config: GiteeRegistryConfig = DEFAULT_GITEE_REGISTRY,
): Promise<FetchIndexResult> {
  // 检查是否使用 ClawdSkillsProxy
  if (useProxy()) {
    logger.debug("Using ClawdSkillsProxy for skills index");
    return fetchProxySkillsIndex(DEFAULT_PROXY_CONFIG);
  }

  // 原 Gitee 逻辑
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const indexUrl = buildRawUrl(config, "index.json");

  logger.debug("Fetching remote skills index from Gitee", { url: indexUrl });

  try {
    const response = await fetchWithTimeout(indexUrl, timeoutMs);

    if (!response.ok) {
      const errorText = `HTTP ${response.status}: ${response.statusText}`;
      logger.warn("Remote index unavailable, trying local fallback", { error: errorText });
      
      // Try local fallback
      const localResult = tryLoadLocalIndex();
      if (localResult.ok) return localResult;
      
      logger.error("Failed to fetch index (no local fallback)", { error: errorText });
      return { ok: false, error: errorText };
    }

    const text = await response.text();
    let index: RemoteSkillsIndex;

    try {
      index = JSON.parse(text) as RemoteSkillsIndex;
    } catch {
      // Try local fallback
      const localResult = tryLoadLocalIndex();
      if (localResult.ok) return localResult;
      return { ok: false, error: "Invalid JSON in index.json" };
    }

    // Validate index structure
    if (!index.skills || !Array.isArray(index.skills)) {
      // Try local fallback
      const localResult = tryLoadLocalIndex();
      if (localResult.ok) return localResult;
      return { ok: false, error: "Invalid index format: missing skills array" };
    }

    logger.info("Fetched remote skills index", {
      skillCount: index.skills.length,
      updated: index.updated,
    });

    return { ok: true, index };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("Remote fetch failed, trying local fallback", { error: message });
    
    // Try local fallback
    const localResult = tryLoadLocalIndex();
    if (localResult.ok) return localResult;
    
    logger.error("Failed to fetch remote skills index", { error: message });
    return { ok: false, error: message };
  }
}

/**
 * List files in a skill directory using Gitee API
 */
async function listSkillFiles(
  config: GiteeRegistryConfig,
  skillPath: string,
): Promise<{ ok: true; files: Array<{ path: string; type: string }> } | { ok: false; error: string }> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiUrl = buildApiContentsUrl(config, skillPath);

  try {
    const response = await fetchWithTimeout(apiUrl, timeoutMs);

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json() as Array<{ path: string; type: string; name: string }>;

    if (!Array.isArray(data)) {
      return { ok: false, error: "Invalid API response" };
    }

    return {
      ok: true,
      files: data.map((item) => ({
        path: item.path,
        type: item.type,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Download a single skill file
 */
async function downloadSkillFile(
  config: GiteeRegistryConfig,
  remotePath: string,
  localPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fileUrl = buildRawUrl(config, remotePath);

  try {
    await downloadFileToPath(fileUrl, localPath, timeoutMs);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Recursively download all files in a skill directory
 */
async function downloadSkillDirectory(
  config: GiteeRegistryConfig,
  remotePath: string,
  localDir: string,
  downloadedFiles: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const listResult = await listSkillFiles(config, remotePath);

  if (!listResult.ok) {
    return listResult;
  }

  for (const file of listResult.files) {
    const relativePath = file.path.replace(`${remotePath}/`, "").replace(remotePath, "");
    const localPath = path.join(localDir, relativePath || path.basename(file.path));

    if (file.type === "dir") {
      // Recursively download subdirectory
      await ensureDir(localPath);
      const subResult = await downloadSkillDirectory(config, file.path, localPath, downloadedFiles);
      if (!subResult.ok) {
        return subResult;
      }
    } else {
      // Download file
      const downloadResult = await downloadSkillFile(config, file.path, localPath);
      if (!downloadResult.ok) {
        return downloadResult;
      }
      downloadedFiles.push(localPath);
    }
  }

  return { ok: true };
}

/**
 * Install a skill from remote repository to local managed skills directory
 * 
 * 安装优先级：
 * 1. bundled skills (本地预打包，秒级完成)
 * 2. ClawdSkillsProxy (阿里云代理服务)
 * 3. Gitee 仓库 (直接下载)
 */
export async function installRemoteSkill(
  skillMeta: RemoteSkillMeta,
  config: GiteeRegistryConfig = DEFAULT_GITEE_REGISTRY,
  targetDir?: string,
): Promise<InstallSkillResult> {
  const skillsDir = targetDir ?? MANAGED_SKILLS_DIR;

  // ★ 优先从 bundled 安装（本地复制，秒级完成）
  const bundledResult = await installFromBundled(skillMeta.name, skillsDir);
  if (bundledResult) {
    return bundledResult;
  }

  // 检查是否使用 ClawdSkillsProxy
  if (useProxy()) {
    logger.debug("Skill not in bundled, downloading from ClawdSkillsProxy", { name: skillMeta.name });
    return installProxySkill(skillMeta, DEFAULT_PROXY_CONFIG, targetDir);
  }

  // 原 Gitee 逻辑
  const skillDir = path.join(skillsDir, skillMeta.name);

  logger.info("Skill not in bundled, downloading from Gitee", {
    name: skillMeta.name,
    targetDir: skillDir,
  });

  try {
    // Remove existing skill directory if exists
    if (fs.existsSync(skillDir)) {
      await fs.promises.rm(skillDir, { recursive: true, force: true });
    }

    // Create skill directory
    await ensureDir(skillDir);

    // Download all files
    const downloadedFiles: string[] = [];
    const result = await downloadSkillDirectory(
      config,
      skillMeta.path,
      skillDir,
      downloadedFiles,
    );

    if (!result.ok) {
      // Cleanup on failure
      try {
        await fs.promises.rm(skillDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
      return result;
    }

    // Verify SKILL.md exists
    const skillMdPath = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      await fs.promises.rm(skillDir, { recursive: true, force: true });
      return { ok: false, error: "SKILL.md not found in remote skill" };
    }

    logger.info("Skill installed successfully from Gitee", {
      name: skillMeta.name,
      fileCount: downloadedFiles.length,
    });

    return {
      ok: true,
      skillDir,
      files: downloadedFiles,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Failed to install skill", { name: skillMeta.name, error: message });
    return { ok: false, error: message };
  }
}

/**
 * Get the list of locally installed managed skills
 */
export function getInstalledSkills(targetDir?: string): string[] {
  const skillsDir = targetDir ?? MANAGED_SKILLS_DIR;

  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => {
        const skillMd = path.join(skillsDir, entry.name, "SKILL.md");
        return fs.existsSync(skillMd);
      })
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Check if a skill is installed locally
 */
export function isSkillInstalled(skillName: string, targetDir?: string): boolean {
  const skillsDir = targetDir ?? MANAGED_SKILLS_DIR;
  const skillDir = path.join(skillsDir, skillName);
  const skillMd = path.join(skillDir, "SKILL.md");
  return fs.existsSync(skillMd);
}

/**
 * Remove an installed skill
 */
export async function removeInstalledSkill(
  skillName: string,
  targetDir?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const skillsDir = targetDir ?? MANAGED_SKILLS_DIR;
  const skillDir = path.join(skillsDir, skillName);

  if (!fs.existsSync(skillDir)) {
    return { ok: false, error: `Skill not installed: ${skillName}` };
  }

  try {
    await fs.promises.rm(skillDir, { recursive: true, force: true });
    logger.info("Skill removed", { name: skillName });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Get managed skills directory path
 */
export function getManagedSkillsDir(): string {
  return MANAGED_SKILLS_DIR;
}
