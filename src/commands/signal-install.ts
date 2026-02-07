import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import { request } from "node:https";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { 
  shouldUseCNMirror, 
  getSignalCliDownloadUrls, 
  getSignalCliApiUrls,
  getClawdSkillsProxyHeaders,
  CLAWDSKILLSPROXY_CONFIG,
} from "../config/cn-mirrors.js";
import { runCommandWithTimeout } from "../process/exec.js";
import type { RuntimeEnv } from "../runtime.js";
import { CONFIG_DIR } from "../utils.js";

type ReleaseAsset = {
  name?: string;
  browser_download_url?: string;
  // ClawdSkillsProxy 使用驼峰命名
  downloadUrl?: string;
  size?: number;
};

type NamedAsset = {
  name: string;
  browser_download_url?: string;
  downloadUrl?: string;
};

// GitHub API 响应格式
type ReleaseResponse = {
  tag_name?: string;
  assets?: ReleaseAsset[];
};

// ClawdSkillsProxy 响应格式 (Java 驼峰命名)
type ProxyReleaseResponse = {
  code?: number;
  message?: string;
  data?: {
    tagName?: string;
    version?: string;
    publishedAt?: string;
    assets?: Array<{
      name: string;
      size: number;
      downloadUrl: string;
    }>;
  };
};

export type SignalInstallResult = {
  ok: boolean;
  cliPath?: string;
  version?: string;
  error?: string;
};

function looksLikeArchive(name: string): boolean {
  return name.endsWith(".tar.gz") || name.endsWith(".tgz") || name.endsWith(".zip");
}

function pickAsset(assets: ReleaseAsset[], platform: NodeJS.Platform) {
  // 支持两种字段命名: browser_download_url (GitHub) 和 downloadUrl (ClawdSkillsProxy)
  const withName = assets.filter((asset): asset is NamedAsset =>
    Boolean(asset.name && (asset.browser_download_url || asset.downloadUrl)),
  );
  const byName = (pattern: RegExp) =>
    withName.find((asset) => pattern.test(asset.name.toLowerCase()));

  if (platform === "linux") {
    return (
      byName(/linux-native/) ||
      byName(/linux/) ||
      withName.find((asset) => looksLikeArchive(asset.name.toLowerCase()))
    );
  }

  if (platform === "darwin") {
    return (
      byName(/macos|osx|darwin/) ||
      withName.find((asset) => looksLikeArchive(asset.name.toLowerCase()))
    );
  }

  if (platform === "win32") {
    return (
      byName(/windows|win/) || withName.find((asset) => looksLikeArchive(asset.name.toLowerCase()))
    );
  }

  return withName.find((asset) => looksLikeArchive(asset.name.toLowerCase()));
}

/**
 * 获取 asset 的下载 URL (兼容两种命名)
 */
function getAssetUrl(asset: NamedAsset | null | undefined): string {
  if (!asset) return "";
  return asset.downloadUrl || asset.browser_download_url || "";
}

async function downloadToFile(url: string, dest: string, maxRedirects = 5): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = request(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
        const location = res.headers.location;
        if (!location || maxRedirects <= 0) {
          reject(new Error("Redirect loop or missing Location header"));
          return;
        }
        const redirectUrl = new URL(location, url).href;
        resolve(downloadToFile(redirectUrl, dest, maxRedirects - 1));
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode ?? "?"} downloading file`));
        return;
      }
      const out = createWriteStream(dest);
      pipeline(res, out).then(resolve).catch(reject);
    });
    req.on("error", reject);
    req.end();
  });
}

async function findSignalCliBinary(root: string): Promise<string | null> {
  const candidates: string[] = [];
  const enqueue = async (dir: string, depth: number) => {
    if (depth > 3) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await enqueue(full, depth + 1);
      } else if (entry.isFile() && entry.name === "signal-cli") {
        candidates.push(full);
      }
    }
  };
  await enqueue(root, 0);
  return candidates[0] ?? null;
}

/**
 * 从多个 URL 尝试下载文件
 */
async function downloadWithFallback(
  urls: string[],
  dest: string,
  headers?: Record<string, string>,
): Promise<{ ok: boolean; usedUrl?: string; error?: string }> {
  const errors: string[] = [];
  
  for (const url of urls) {
    try {
      // 对 ClawdSkillsProxy 使用特殊处理
      if (url.includes(CLAWDSKILLSPROXY_CONFIG.baseUrl)) {
        const resp = await fetch(url, { headers: getClawdSkillsProxyHeaders() });
        if (!resp.ok) {
          errors.push(`${url}: HTTP ${resp.status}`);
          continue;
        }
        const buffer = Buffer.from(await resp.arrayBuffer());
        await fs.writeFile(dest, buffer);
        return { ok: true, usedUrl: url };
      }
      
      // 标准下载
      await downloadToFile(url, dest);
      return { ok: true, usedUrl: url };
    } catch (err) {
      errors.push(`${url}: ${String(err)}`);
    }
  }
  
  return { ok: false, error: errors.join("; ") };
}

/**
 * 尝试从多个 API 获取版本信息
 * 支持两种响应格式: GitHub API 和 ClawdSkillsProxy
 */
async function fetchVersionWithFallback(
  apiUrls: string[],
): Promise<{ ok: boolean; version?: string; assets?: ReleaseAsset[]; error?: string }> {
  const errors: string[] = [];
  
  for (const url of apiUrls) {
    try {
      const isProxy = url.includes(CLAWDSKILLSPROXY_CONFIG.baseUrl);
      const headers: Record<string, string> = isProxy
        ? getClawdSkillsProxyHeaders()
        : { "User-Agent": "clawdbot", "Accept": "application/vnd.github+json" };
      
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        errors.push(`${url}: HTTP ${resp.status}`);
        continue;
      }
      
      const json = await resp.json();
      
      // ClawdSkillsProxy 响应格式: { code, message, data: { tagName, version, assets } }
      if (isProxy) {
        const proxyPayload = json as ProxyReleaseResponse;
        if (proxyPayload.code !== 200 || !proxyPayload.data) {
          errors.push(`${url}: ${proxyPayload.message || "Invalid response"}`);
          continue;
        }
        const version = proxyPayload.data.version || proxyPayload.data.tagName?.replace(/^v/, "") || "unknown";
        // 转换 assets 格式
        const assets: ReleaseAsset[] = (proxyPayload.data.assets || []).map(a => ({
          name: a.name,
          size: a.size,
          downloadUrl: a.downloadUrl,
        }));
        return { ok: true, version, assets };
      }
      
      // GitHub API 响应格式: { tag_name, assets: [{ name, browser_download_url }] }
      const payload = json as ReleaseResponse;
      const version = payload.tag_name?.replace(/^v/, "") ?? "unknown";
      return { ok: true, version, assets: payload.assets };
    } catch (err) {
      errors.push(`${url}: ${String(err)}`);
    }
  }
  
  return { ok: false, error: errors.join("; ") };
}

export async function installSignalCli(runtime: RuntimeEnv): Promise<SignalInstallResult> {
  if (process.platform === "win32") {
    return {
      ok: false,
      error: "Signal CLI auto-install is not supported on Windows yet.",
    };
  }

  const useCN = shouldUseCNMirror();
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  
  // 获取版本信息（支持多源）
  runtime.log(useCN ? "正在获取 signal-cli 版本信息..." : "Fetching signal-cli version info...");
  const apiUrls = getSignalCliApiUrls();
  const versionResult = await fetchVersionWithFallback(apiUrls);
  
  if (!versionResult.ok || !versionResult.version) {
    return {
      ok: false,
      error: useCN
        ? `无法获取 signal-cli 版本信息: ${versionResult.error}`
        : `Failed to fetch version info: ${versionResult.error}`,
    };
  }
  
  const version = versionResult.version;
  const assets = versionResult.assets ?? [];
  const asset = pickAsset(assets, process.platform);
  // Signal CLI 是 Java 程序，使用通用版本（跨平台）
  const assetName = asset?.name ?? `signal-cli-${version}.tar.gz`;

  // 获取下载 URL 列表
  const downloadUrls = getSignalCliDownloadUrls(version, platform);
  
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdbot-signal-"));
  const archivePath = path.join(tmpDir, assetName);

  runtime.log(useCN 
    ? `正在下载 signal-cli ${version} (尝试 ${downloadUrls.length} 个镜像源)...`
    : `Downloading signal-cli ${version} (${assetName})…`);
  
  const downloadResult = await downloadWithFallback(downloadUrls, archivePath);
  
  if (!downloadResult.ok) {
    return {
      ok: false,
      error: useCN
        ? `下载失败，所有镜像源都不可用: ${downloadResult.error}`
        : `Download failed: ${downloadResult.error}`,
    };
  }
  
  if (useCN && downloadResult.usedUrl) {
    runtime.log(`✅ 使用镜像源: ${downloadResult.usedUrl}`);
  }

  const installRoot = path.join(CONFIG_DIR, "tools", "signal-cli", version);
  await fs.mkdir(installRoot, { recursive: true });

  if (assetName.endsWith(".zip")) {
    await runCommandWithTimeout(["unzip", "-q", archivePath, "-d", installRoot], {
      timeoutMs: 60_000,
    });
  } else if (assetName.endsWith(".tar.gz") || assetName.endsWith(".tgz")) {
    await runCommandWithTimeout(["tar", "-xzf", archivePath, "-C", installRoot], {
      timeoutMs: 60_000,
    });
  } else {
    return { ok: false, error: `Unsupported archive type: ${assetName}` };
  }

  const cliPath = await findSignalCliBinary(installRoot);
  if (!cliPath) {
    return {
      ok: false,
      error: `signal-cli binary not found after extracting ${assetName}`,
    };
  }

  await fs.chmod(cliPath, 0o755).catch(() => {});

  return { ok: true, cliPath, version };
}
