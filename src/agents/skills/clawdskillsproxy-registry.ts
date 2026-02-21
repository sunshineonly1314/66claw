/**
 * ClawdSkillsProxy Registry
 *
 * 从阿里云 ClawdSkillsProxy 服务获取和下载 skills
 * Fetch and download skills from Aliyun ClawdSkillsProxy service
 */

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { Agent as UndiciAgent, fetch as undiciFetch } from "undici";

import { CONFIG_DIR, ensureDir } from "../../utils.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { validateUrlForSsrf } from "../../infra/net/ssrf.js";
import { CLAWDSKILLSPROXY_CONFIG } from "../../config/cn-mirrors.js";
import type {
  RemoteSkillMeta,
  RemoteSkillsIndex,
  FetchIndexResult,
  InstallSkillResult,
} from "./gitee-registry.js";

const logger = createSubsystemLogger("clawdskillsproxy-registry");

// ============================================================================
// Types
// ============================================================================

/** ClawdSkillsProxy 索引响应中的单个 skill 元数据 */
export interface ProxySkillMeta {
  /** Skill 唯一标识 (目录名) */
  skillId: string;
  /** 版本号 (服务端生成) */
  version: number;
  /** 文件内容 SHA256 hash */
  sha256: string;
  /** 文件大小 (字节) */
  size: number;
  /** 更新时间 (毫秒时间戳) */
  updatedAt: number;
  /** 服务端相对路径 */
  path: string;
  /** 状态 */
  status: "active" | string;
  /** 技能名称 (从 SKILL.md frontmatter 解析) */
  name?: string;
  /** 技能中文名称 */
  nameZh?: string;
  /** 技能描述 (从 SKILL.md frontmatter 解析) */
  description?: string;
  /** 技能中文描述 */
  descriptionZh?: string;
  /** Emoji 图标 */
  emoji?: string;
  /** 标签列表 */
  tags?: string[];
  /** 作者 */
  author?: string;
}

/** ClawdSkillsProxy 索引响应结构 */
export interface ProxyIndexResponse {
  code: number;
  message: string;
  data: {
    globalVersion: number;
    totalCount: number;
    skills: ProxySkillMeta[];
  };
}

/** ClawdSkillsProxy 配置 */
export interface ProxyRegistryConfig {
  /** API 基础地址 */
  baseUrl: string;
  /** 鉴权 Token */
  token: string;
  /** 请求超时 (毫秒) */
  timeoutMs: number;
  /** 批量下载分批大小 */
  batchSize: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Cached config instance (lazy singleton). `undefined` = not yet resolved. */
let _cachedProxyConfig: ProxyRegistryConfig | null | undefined;

/**
 * 延迟获取默认代理配置。
 * 环境变量未设置时返回 null（而非立即抛出异常），
 * 使模块可以被安全 import，即使代理服务未配置。
 *
 * 结果会被缓存（包括 null），避免重复的安全检查日志。
 */
export function getDefaultProxyConfig(): ProxyRegistryConfig | null {
  if (_cachedProxyConfig !== undefined) return _cachedProxyConfig;

  // 优先使用环境变量覆盖，否则回退到 cn-mirrors-data.json 中的内置配置
  const baseUrl =
    process.env.OPENCLAWCN_SKILLS_PROXY_URL?.trim() || CLAWDSKILLSPROXY_CONFIG.baseUrl;
  const token = process.env.OPENCLAWCN_SKILLS_PROXY_TOKEN?.trim() || CLAWDSKILLSPROXY_CONFIG.token;

  if (!baseUrl || !token) {
    logger.debug("ClawdSkillsProxy config not available (no env vars and no built-in config)");
    _cachedProxyConfig = null;
    return null;
  }

  // 安全检查: 生产环境强制 HTTPS
  const isDev = process.env.CLAWDBOT_PROFILE === "dev" || process.env.NODE_ENV === "development";
  if (!isDev && !baseUrl.startsWith("https://")) {
    logger.warn(
      `SECURITY: Proxy URL must use HTTPS in production (got ${baseUrl}). ` +
        "ClawdSkillsProxy disabled.",
    );
    _cachedProxyConfig = null;
    return null;
  }

  _cachedProxyConfig = {
    baseUrl,
    token,
    timeoutMs: 30_000,
    batchSize: 200,
  };

  return _cachedProxyConfig;
}

/**
 * @deprecated Use getDefaultProxyConfig() instead. Retained for backward compatibility.
 */
export const DEFAULT_PROXY_CONFIG: ProxyRegistryConfig = new Proxy({} as ProxyRegistryConfig, {
  get(_target, prop) {
    const config = getDefaultProxyConfig();
    if (!config) {
      throw new Error(
        `ClawdSkillsProxy is not configured. ` +
          `Set OPENCLAWCN_SKILLS_PROXY_URL and OPENCLAWCN_SKILLS_PROXY_TOKEN environment variables.`,
      );
    }
    return config[prop as keyof ProxyRegistryConfig];
  },
});

/** Managed skills directory */
const MANAGED_SKILLS_DIR = path.join(CONFIG_DIR, "skills");

// ============================================================================
// Fetch Utilities
// ============================================================================

// 直连 Agent（绕过系统 HTTP_PROXY / HTTPS_PROXY）
// Node 22+ 的 fetch 会自动走系统代理，但 skillsproxy 是阿里云国内服务，
// 走本地 VPN/proxy 反而会超时或被拦截
const directAgent = new UndiciAgent();

async function fetchWithAuth(
  url: string,
  config: ProxyRegistryConfig,
  options: RequestInit = {},
): Promise<Response> {
  // OpenClawCN 专属：SSRF 防护 - 阻止访问内网地址
  // See: SECURITY_AUDIT_BATCH_1_PHASE_2.md - Vulnerability #7
  validateUrlForSsrf(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    // 使用 undici.fetch + directAgent 绕过系统代理，直连阿里云 skillsproxy
    const response = await undiciFetch(url, {
      ...(options as any),
      signal: controller.signal,
      dispatcher: directAgent,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "User-Agent": "OpenClawCN-Skills-Registry/1.0",
        Accept: "application/json, application/zip, */*",
        ...(options.headers as Record<string, string>),
      },
    });
    // undici 的 Response 与 global Response 类型运行时兼容
    return response as unknown as Response;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// Index Functions
// ============================================================================

/**
 * 将 ProxySkillMeta 转换为 RemoteSkillMeta (兼容现有结构)
 */
function convertToRemoteSkillMeta(proxyMeta: ProxySkillMeta): RemoteSkillMeta {
  // 优先使用 name 字段，其次使用 skillId
  const name = proxyMeta.name?.trim() || proxyMeta.skillId;

  // 优先使用中文描述，其次使用英文描述
  const description = proxyMeta.descriptionZh?.trim() || proxyMeta.description?.trim() || "";

  // 优先使用中文名称
  const nameZh = proxyMeta.nameZh?.trim() || undefined;

  return {
    name,
    nameZh,
    description,
    descriptionZh: proxyMeta.descriptionZh?.trim() || undefined,
    emoji: proxyMeta.emoji?.trim() || undefined,
    path: proxyMeta.skillId, // 使用 skillId 作为 path
    version: String(proxyMeta.version),
    tags: proxyMeta.tags && proxyMeta.tags.length > 0 ? proxyMeta.tags : undefined,
    author: proxyMeta.author?.trim() || undefined,
  };
}

/**
 * 从 ClawdSkillsProxy 获取技能索引
 * @param sinceVersion 可选，增量拉取的起始版本号
 */
export async function fetchProxySkillsIndex(
  config?: ProxyRegistryConfig,
  sinceVersion?: number,
): Promise<FetchIndexResult> {
  const resolvedConfig = config ?? getDefaultProxyConfig();
  if (!resolvedConfig) {
    return { ok: false, error: "ClawdSkillsProxy not configured (missing env vars)" };
  }

  let url = `${resolvedConfig.baseUrl}/api/skills/index`;
  if (sinceVersion !== undefined) {
    url += `?sinceVersion=${sinceVersion}`;
  }

  logger.debug("Fetching skills index from proxy", { url, sinceVersion });

  try {
    const response = await fetchWithAuth(url, resolvedConfig);

    if (!response.ok) {
      const errorText = `HTTP ${response.status}: ${response.statusText}`;
      logger.error("Failed to fetch proxy index", { error: errorText, status: response.status });

      // 处理特定错误码
      if (response.status === 401) {
        return { ok: false, error: "认证失败：Token 无效或缺失" };
      }
      if (response.status === 403) {
        return { ok: false, error: "访问被禁止：IP 可能被封禁 (限流触发)" };
      }
      if (response.status === 429) {
        return { ok: false, error: "请求过于频繁：已触发限流，请稍后重试" };
      }

      return { ok: false, error: errorText };
    }

    const json = (await response.json()) as ProxyIndexResponse;

    if (json.code !== 200) {
      return { ok: false, error: `API error: ${json.message}` };
    }

    // 转换为兼容格式
    const skills = json.data.skills.map(convertToRemoteSkillMeta);

    const index: RemoteSkillsIndex = {
      version: json.data.globalVersion,
      updated: new Date().toISOString(),
      skills,
    };

    logger.info("Fetched skills index from proxy", {
      skillCount: skills.length,
      globalVersion: json.data.globalVersion,
    });

    return { ok: true, index };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause ? String(err.cause) : undefined;
    logger.error("Failed to fetch proxy skills index", { error: message, cause, url });
    return { ok: false, error: message };
  }
}

// ============================================================================
// Download Functions
// ============================================================================

/**
 * 批量下载 skills (返回 zip)
 */
async function downloadSkillsZip(
  skillIds: string[],
  config: ProxyRegistryConfig,
): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }> {
  const url = `${config.baseUrl}/api/skills/download`;

  logger.debug("Downloading skills zip", { url, count: skillIds.length });

  try {
    const response = await fetchWithAuth(url, config, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: skillIds }),
    });

    if (!response.ok) {
      const errorText = `HTTP ${response.status}: ${response.statusText}`;
      logger.error("Failed to download skills zip", { error: errorText });

      if (response.status === 401) {
        return { ok: false, error: "认证失败：Token 无效或缺失" };
      }
      if (response.status === 403) {
        return { ok: false, error: "访问被禁止：IP 可能被封禁" };
      }
      if (response.status === 400) {
        return { ok: false, error: "请求参数错误：ids 列表可能超过 500 个" };
      }

      return { ok: false, error: errorText };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.debug("Downloaded skills zip", { size: buffer.length });

    return { ok: true, buffer };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause ? String(err.cause) : undefined;
    logger.error("Failed to download skills zip", { error: message, cause });
    return { ok: false, error: message };
  }
}

/**
 * 解压 zip 到目标目录
 */
async function extractZipToDir(
  zipBuffer: Buffer,
  destDir: string,
): Promise<{ ok: true; extractedDirs: string[] } | { ok: false; error: string }> {
  try {
    const zip = await JSZip.loadAsync(zipBuffer);
    const extractedDirs = new Set<string>();

    for (const [entryPath, zipEntry] of Object.entries(zip.files)) {
      if (!entryPath || entryPath.startsWith("__MACOSX")) continue;

      // 安全检查：防止 zip slip
      const normalizedPath = entryPath.replace(/\\/g, "/");
      const outPath = path.resolve(destDir, normalizedPath);
      if (!outPath.startsWith(destDir)) {
        logger.warn("Zip entry escapes destination, skipping", { entry: entryPath });
        continue;
      }

      if (zipEntry.dir) {
        await ensureDir(outPath);
        // 记录顶层目录 (skill 目录)
        const topDir = normalizedPath.split("/")[0];
        if (topDir) extractedDirs.add(topDir);
      } else {
        await ensureDir(path.dirname(outPath));
        const content = await zipEntry.async("nodebuffer");

        await fs.promises.writeFile(outPath, content);

        // 记录顶层目录
        const topDir = normalizedPath.split("/")[0];
        if (topDir) extractedDirs.add(topDir);
      }
    }

    return { ok: true, extractedDirs: [...extractedDirs] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `解压失败: ${message}` };
  }
}

/**
 * 从 ClawdSkillsProxy 安装单个 skill
 */
export async function installProxySkill(
  skillMeta: RemoteSkillMeta,
  config?: ProxyRegistryConfig,
  targetDir?: string,
): Promise<InstallSkillResult> {
  const resolvedConfig = config ?? getDefaultProxyConfig();
  if (!resolvedConfig) {
    return { ok: false, error: "ClawdSkillsProxy not configured (missing env vars)" };
  }
  const skillName = skillMeta.name;
  const skillsDir = targetDir ?? MANAGED_SKILLS_DIR;
  const skillDir = path.join(skillsDir, skillName);

  logger.info("Installing skill from proxy", { name: skillName, targetDir: skillDir });

  try {
    // 下载 zip
    const downloadResult = await downloadSkillsZip([skillName], resolvedConfig);
    if (!downloadResult.ok) {
      return { ok: false, error: downloadResult.error };
    }

    // 如果目标目录已存在，先删除
    if (fs.existsSync(skillDir)) {
      await fs.promises.rm(skillDir, { recursive: true, force: true });
    }

    // 解压到 skills 目录
    await ensureDir(skillsDir);
    const extractResult = await extractZipToDir(downloadResult.buffer, skillsDir);
    if (!extractResult.ok) {
      return { ok: false, error: extractResult.error };
    }

    // 验证 SKILL.md 存在
    const skillMdPath = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      // 清理
      if (fs.existsSync(skillDir)) {
        await fs.promises.rm(skillDir, { recursive: true, force: true });
      }
      return { ok: false, error: "SKILL.md not found in downloaded skill" };
    }

    // 列出安装的文件
    const files: string[] = [];
    async function listFiles(dir: string) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await listFiles(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    }
    await listFiles(skillDir);

    logger.info("Skill installed successfully from proxy", {
      name: skillName,
      fileCount: files.length,
    });

    return {
      ok: true,
      skillDir,
      files,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Failed to install skill from proxy", { name: skillName, error: message });
    return { ok: false, error: message };
  }
}

/**
 * 批量安装 skills (分批下载)
 */
export async function installProxySkillsBatch(
  skillNames: string[],
  config?: ProxyRegistryConfig,
  targetDir?: string,
): Promise<{
  ok: boolean;
  installed: string[];
  failed: Array<{ name: string; error: string }>;
}> {
  const resolvedConfig = config ?? getDefaultProxyConfig();
  if (!resolvedConfig) {
    return {
      ok: false,
      installed: [],
      failed: skillNames.map((name) => ({
        name,
        error: "ClawdSkillsProxy not configured (missing env vars)",
      })),
    };
  }

  const skillsDir = targetDir ?? MANAGED_SKILLS_DIR;
  const installed: string[] = [];
  const failed: Array<{ name: string; error: string }> = [];

  // 分批处理
  const batchSize = resolvedConfig.batchSize;
  for (let i = 0; i < skillNames.length; i += batchSize) {
    const batch = skillNames.slice(i, i + batchSize);
    logger.info("Installing skills batch", {
      batchIndex: Math.floor(i / batchSize) + 1,
      totalBatches: Math.ceil(skillNames.length / batchSize),
      count: batch.length,
    });

    try {
      // 下载批次 zip
      const downloadResult = await downloadSkillsZip(batch, resolvedConfig);
      if (!downloadResult.ok) {
        // 整批失败
        for (const name of batch) {
          failed.push({ name, error: downloadResult.error });
        }
        continue;
      }

      // 解压
      await ensureDir(skillsDir);
      const extractResult = await extractZipToDir(downloadResult.buffer, skillsDir);
      if (!extractResult.ok) {
        for (const name of batch) {
          failed.push({ name, error: extractResult.error });
        }
        continue;
      }

      // 验证每个 skill
      for (const name of batch) {
        const skillDir = path.join(skillsDir, name);
        const skillMdPath = path.join(skillDir, "SKILL.md");
        if (fs.existsSync(skillMdPath)) {
          installed.push(name);
        } else {
          failed.push({ name, error: "SKILL.md not found after extraction" });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const name of batch) {
        failed.push({ name, error: message });
      }
    }
  }

  return {
    ok: failed.length === 0,
    installed,
    failed,
  };
}

/**
 * 下载单个 skill 文件 (调试/兼容用)
 */
export async function downloadSingleSkillFile(
  skillId: string,
  config?: ProxyRegistryConfig,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const resolvedConfig = config ?? getDefaultProxyConfig();
  if (!resolvedConfig) {
    return { ok: false, error: "ClawdSkillsProxy not configured (missing env vars)" };
  }

  const url = `${resolvedConfig.baseUrl}/api/skills/file/${encodeURIComponent(skillId)}`;

  try {
    const response = await fetchWithAuth(url, resolvedConfig);

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const content = await response.text();
    return { ok: true, content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * 健康检查
 */
export async function checkProxyHealth(
  config?: ProxyRegistryConfig,
): Promise<{ ok: true; globalVersion: number } | { ok: false; error: string }> {
  const resolvedConfig = config ?? getDefaultProxyConfig();
  if (!resolvedConfig) {
    return { ok: false, error: "ClawdSkillsProxy not configured (missing env vars)" };
  }

  // 直连 Java 健康检查端点
  const healthUrl = resolvedConfig.baseUrl.replace("/api", ":8080/health");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(healthUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "OpenClawCN-Skills-Registry/1.0",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const json = (await response.json()) as { status?: string; globalVersion?: number };
    if (json.status === "UP" && typeof json.globalVersion === "number") {
      return { ok: true, globalVersion: json.globalVersion };
    }

    return { ok: false, error: "Unexpected health response" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
