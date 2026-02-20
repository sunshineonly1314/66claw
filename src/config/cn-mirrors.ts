/**
 * OpenClawCN 国内镜像配置 — 逻辑层
 *
 * 静态数据已外部化到 cn-mirrors-data.json（由 cn-mirrors-data.ts 类型化加载）。
 * 本文件保留所有辅助函数和业务逻辑。
 *
 * @version 2026-02-08
 * @verified 2026-02-08 - GitHub 代理实测更新
 */

// ============================================================================
// 数据导入 — 从 cn-mirrors-data.ts 加载外部化的静态数据
// ============================================================================

export {
  PACKAGE_MANAGER_MIRRORS,
  BINARY_DOWNLOAD_MIRRORS,
  CLAWDSKILLSPROXY_CONFIG,
  LARGE_PACKAGE_PROXY_MAP,
  CLI_TOOL_MIRRORS,
} from "./cn-mirrors-data.js";

import {
  PACKAGE_MANAGER_MIRRORS,
  BINARY_DOWNLOAD_MIRRORS,
  CLAWDSKILLSPROXY_CONFIG,
  CLI_TOOL_MIRRORS,
} from "./cn-mirrors-data.js";

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检测是否应该使用国内镜像
 */
export function shouldUseCNMirror(): boolean {
  // 优先检查环境变量
  if (process.env.OPENCLAWCN_USE_CN_MIRROR === "1") return true;
  if (process.env.OPENCLAWCN_USE_CN_MIRROR === "0") return false;

  // 检查区域配置
  if (process.env.OPENCLAWCN_REGION === "cn") return true;

  // 检查时区（粗略判断）
  const tz = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "";

  // IANA 时区格式（Linux/macOS）
  if (tz.includes("Shanghai") || tz.includes("Beijing") || tz.includes("Asia/Chongqing") || tz.includes("Asia/Urumqi")) {
    return true;
  }

  // Windows Node.js 可能返回 Etc/GMT-8 或 GMT+8
  // 注意：Etc/GMT-8 实际表示 UTC+8（POSIX 标准的符号相反）
  if (tz === "Etc/GMT-8" || tz === "GMT+8" || tz === "UTC+8") {
    return true;
  }

  // Windows 系统时区格式
  if (tz.includes("China Standard Time") || tz.includes("China Time")) {
    return true;
  }

  return false;
}

/**
 * 获取 npm 镜像 URL（仅国内源）
 */
export function getNpmMirrorUrl(): string {
  return PACKAGE_MANAGER_MIRRORS.npm.primary; // 淘宝镜像
}

/**
 * 获取 pip 镜像 URL（仅国内源）
 */
export function getPipMirrorUrl(): string {
  return PACKAGE_MANAGER_MIRRORS.pip.primary; // 清华镜像
}

/**
 * 获取 Go 代理配置（仅国内源）
 */
export function getGoProxy(): string {
  return PACKAGE_MANAGER_MIRRORS.go.primary; // 七牛云
}

/**
 * 获取 Node.js 二进制下载 URL（仅国内源）
 */
export function getNodeBinaryMirror(): string {
  return BINARY_DOWNLOAD_MIRRORS.node.primary; // 淘宝镜像
}

/**
 * 获取 Go 二进制下载 URL（仅国内源）
 */
export function getGoBinaryMirror(): string {
  return BINARY_DOWNLOAD_MIRRORS.goBinary.primary; // Go语言中文网
}

/**
 * 获取 Go 二进制下载 URL 列表（仅国内源）
 * Go语言中文网 → Google中国 → 阿里云
 */
export function getGoBinaryMirrors(): string[] {
  return [
    BINARY_DOWNLOAD_MIRRORS.goBinary.primary,
    BINARY_DOWNLOAD_MIRRORS.goBinary.fallback,
    BINARY_DOWNLOAD_MIRRORS.goBinary.tertiary,
  ].filter(Boolean) as string[];
}

/**
 * 获取 Node.js 二进制下载 URL 列表（仅国内源）
 * 淘宝 → 华为云
 */
export function getNodeBinaryMirrors(): string[] {
  return [
    BINARY_DOWNLOAD_MIRRORS.node.primary,
    BINARY_DOWNLOAD_MIRRORS.node.fallback,
    BINARY_DOWNLOAD_MIRRORS.node.tertiary,
  ].filter(Boolean) as string[];
}

/**
 * 获取 GitHub 代理 URL 列表（仅国内源）
 * gh-proxy.com → ghfast.top → ghproxy.cn
 */
export function getGitHubProxies(): string[] {
  return [
    BINARY_DOWNLOAD_MIRRORS.github.primary,
    BINARY_DOWNLOAD_MIRRORS.github.fallback,
    BINARY_DOWNLOAD_MIRRORS.github.tertiary,
  ].filter(Boolean) as string[];
}

/**
 * 获取 uv 安装脚本 URL 列表（仅国内源）
 * 始终使用国内 GitHub 代理，不 fallback 到国外
 */
export function getUvInstallScripts(platform: "sh" | "ps1"): string[] {
  // 始终使用国内代理，不使用国外源
  if (platform === "ps1") {
    return [
      BINARY_DOWNLOAD_MIRRORS.uv.installPs1,
      BINARY_DOWNLOAD_MIRRORS.uv.installPs1Fallback,
      BINARY_DOWNLOAD_MIRRORS.uv.installPs1Tertiary,
    ].filter(Boolean) as string[];
  }
  return [
    BINARY_DOWNLOAD_MIRRORS.uv.installScript,
    BINARY_DOWNLOAD_MIRRORS.uv.installScriptFallback,
    BINARY_DOWNLOAD_MIRRORS.uv.installScriptTertiary,
  ].filter(Boolean) as string[];
}

/**
 * 获取 Go 代理 URL 列表（仅国内源）
 * 七牛云 → 阿里云 → goproxy.io
 */
export function getGoProxies(): string[] {
  return [
    PACKAGE_MANAGER_MIRRORS.go.primary,
    PACKAGE_MANAGER_MIRRORS.go.fallback,
    PACKAGE_MANAGER_MIRRORS.go.tertiary,
  ].filter(Boolean);
}

/**
 * 获取 pip 镜像 URL 列表（仅国内源）
 * 清华 → 阿里云 → 中科大
 */
export function getPipMirrors(): string[] {
  return [
    PACKAGE_MANAGER_MIRRORS.pip.primary, // 清华
    PACKAGE_MANAGER_MIRRORS.pip.fallback, // 阿里云
    PACKAGE_MANAGER_MIRRORS.pip.tertiary, // 中科大
  ].filter(Boolean);
}

/**
 * 获取 npm 镜像 URL 列表（仅国内源）
 * 淘宝 → 腾讯云 → 华为云
 */
export function getNpmMirrors(): string[] {
  return [
    PACKAGE_MANAGER_MIRRORS.npm.primary, // 淘宝
    PACKAGE_MANAGER_MIRRORS.npm.fallback, // 腾讯云
    PACKAGE_MANAGER_MIRRORS.npm.tertiary, // 华为云
  ].filter(Boolean);
}

/**
 * 获取 GitHub 代理 URL（始终使用国内代理）
 */
export function getGitHubProxy(originalUrl: string): string {
  // 处理 GitHub/raw.githubusercontent 链接，始终走国内代理
  if (originalUrl.includes("github.com") || originalUrl.includes("raw.githubusercontent.com")) {
    return `${BINARY_DOWNLOAD_MIRRORS.github.primary}/${originalUrl}`;
  }

  return originalUrl;
}

/**
 * 获取 GitHub 代理 URL 列表（含所有备用源）
 */
export function getGitHubProxyUrls(originalUrl: string): string[] {
  if (!originalUrl.includes("github.com") && !originalUrl.includes("raw.githubusercontent.com")) {
    return [originalUrl];
  }

  return [
    `${BINARY_DOWNLOAD_MIRRORS.github.primary}/${originalUrl}`,
    `${BINARY_DOWNLOAD_MIRRORS.github.fallback}/${originalUrl}`,
    `${BINARY_DOWNLOAD_MIRRORS.github.tertiary}/${originalUrl}`,
  ];
}

/**
 * 获取工具的安装命令
 */
export function getToolInstallCommand(
  toolName: string,
  platform: NodeJS.Platform,
): { command: string[]; env?: Record<string, string> } | null {
  const tool = CLI_TOOL_MIRRORS[toolName];
  if (!tool || tool.installMethods.length === 0) {
    return null;
  }

  const useCN = shouldUseCNMirror() && tool.useCNMirror;

  // 根据平台选择最佳安装方法
  for (const method of tool.installMethods) {
    // Windows
    if (platform === "win32") {
      if (method.method === "winget" && method.wingetId) {
        return {
          command: [
            "winget",
            "install",
            "--id",
            method.wingetId,
            "-e",
            "--silent",
            "--accept-package-agreements",
          ],
        };
      }
      if (method.method === "scoop" && method.scoopName) {
        return {
          command: ["scoop", "install", method.scoopName],
        };
      }
      if (method.method === "npm" && method.package) {
        return {
          command: useCN
            ? [
                "npm",
                "install",
                "-g",
                method.package,
                "--registry",
                PACKAGE_MANAGER_MIRRORS.npm.primary,
              ]
            : ["npm", "install", "-g", method.package],
        };
      }
      if (method.method === "pip" && method.package) {
        return {
          command: useCN
            ? ["pip", "install", method.package, "-i", PACKAGE_MANAGER_MIRRORS.pip.primary]
            : ["pip", "install", method.package],
        };
      }
    }

    // macOS
    if (platform === "darwin") {
      if (method.method === "brew" && method.formula) {
        return {
          command: ["brew", "install", method.formula],
        };
      }
    }

    // Linux/通用
    if (method.method === "npm" && method.package) {
      return {
        command: useCN
          ? [
              "npm",
              "install",
              "-g",
              method.package,
              "--registry",
              PACKAGE_MANAGER_MIRRORS.npm.primary,
            ]
          : ["npm", "install", "-g", method.package],
      };
    }
    if (method.method === "go" && method.module) {
      return {
        command: ["go", "install", method.module],
        env: useCN ? { GOPROXY: PACKAGE_MANAGER_MIRRORS.go.primary } : undefined,
      };
    }
    if (method.method === "pip" && method.package) {
      return {
        command: useCN
          ? ["pip", "install", method.package, "-i", PACKAGE_MANAGER_MIRRORS.pip.primary]
          : ["pip", "install", method.package],
      };
    }
    if (method.method === "uv" && method.package) {
      return {
        command: useCN
          ? [
              "uv",
              "tool",
              "install",
              method.package,
              "--index-url",
              PACKAGE_MANAGER_MIRRORS.pip.primary,
            ]
          : ["uv", "tool", "install", method.package],
      };
    }
    if (method.method === "cargo" && method.package) {
      return {
        command: ["cargo", "install", method.package],
      };
    }
  }

  return null;
}

/**
 * 列出所有支持的工具
 */
export function listSupportedTools(): string[] {
  return Object.keys(CLI_TOOL_MIRRORS);
}

/**
 * 获取工具信息
 */
export function getToolInfo(toolName: string): (typeof CLI_TOOL_MIRRORS)[string] | undefined {
  return CLI_TOOL_MIRRORS[toolName];
}

// ============================================================================
// 导出统计信息
// ============================================================================

/**
 * 获取镜像配置统计
 */
export function getMirrorStats(): {
  packageManagers: number;
  binaryMirrors: number;
  cliTools: number;
  toolsWithCNMirror: number;
} {
  const toolsWithCNMirror = Object.values(CLI_TOOL_MIRRORS).filter((t) => t.useCNMirror).length;

  return {
    packageManagers: Object.keys(PACKAGE_MANAGER_MIRRORS).length,
    binaryMirrors: Object.keys(BINARY_DOWNLOAD_MIRRORS).length,
    cliTools: Object.keys(CLI_TOOL_MIRRORS).length,
    toolsWithCNMirror,
  };
}

// ============================================================================
// Signal CLI 国内镜像
// ============================================================================

/**
 * 获取 Signal CLI 下载 URL（国内镜像优先）
 * @param version Signal CLI 版本号 (如 "0.13.4")
 * @param platform 平台 ("linux" | "darwin")
 * @returns 下载 URL 列表（按优先级排序）
 */
export function getSignalCliDownloadUrls(version: string, _platform: "linux" | "darwin"): string[] {
  const useCN = shouldUseCNMirror();
  // Signal CLI 是 Java 程序，使用通用版本（跨平台）
  // ClawdSkillsProxy 只托管通用版本 signal-cli-{version}.tar.gz
  const fileName = `signal-cli-${version}.tar.gz`;

  const urls: string[] = [];

  if (useCN) {
    // 1. GitHub 代理（国内公共镜像优先，不消耗服务器带宽）
    const githubUrl = `https://github.com/AsamK/signal-cli/releases/download/v${version}/${fileName}`;
    urls.push(...getGitHubProxyUrls(githubUrl));

    // 2. ClawdSkillsProxy 托管（服务器兜底）
    urls.push(
      `${CLAWDSKILLSPROXY_CONFIG.baseUrl}${CLAWDSKILLSPROXY_CONFIG.endpoints.signalCliDownload}/${version}/${fileName}`,
    );
  }

  // 3. GitHub 原始地址 (国外)
  urls.push(`https://github.com/AsamK/signal-cli/releases/download/v${version}/${fileName}`);

  return urls;
}

/**
 * 获取 Signal CLI API URL（获取最新版本信息）
 * @returns API URL 列表（按优先级排序）
 */
export function getSignalCliApiUrls(): string[] {
  const useCN = shouldUseCNMirror();
  const urls: string[] = [];

  if (useCN) {
    // 1. ClawdSkillsProxy API (最可靠)
    // 格式: /api/binaries/signal-cli/latest
    urls.push(
      `${CLAWDSKILLSPROXY_CONFIG.baseUrl}${CLAWDSKILLSPROXY_CONFIG.endpoints.signalCliLatest}`,
    );
  }

  // 2. GitHub API (可能被墙)
  urls.push("https://api.github.com/repos/AsamK/signal-cli/releases/latest");

  return urls;
}

/**
 * 获取 ClawdSkillsProxy 认证头
 */
export function getClawdSkillsProxyHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${CLAWDSKILLSPROXY_CONFIG.token}`,
    "User-Agent": "OpenClawCN/1.0",
  };
}

// ============================================================================
// SkillsProxy 二进制托管（原 HK 服务器，已迁移到 obplugins.cn）
// ============================================================================

/**
 * 检查工具是否在 SkillsProxy 托管
 */
export function isToolHostedOnHK(toolName: string): boolean {
  return BINARY_DOWNLOAD_MIRRORS.hkBinaries.tools.includes(toolName);
}

/**
 * 获取 SkillsProxy 上工具的最新版本信息 URL
 * GET /api/binaries/{toolName}/latest → JSON { data: { version, assets[] } }
 */
export function getHKBinaryVersionUrl(toolName: string): string {
  return `${BINARY_DOWNLOAD_MIRRORS.hkBinaries.baseUrl}/${toolName}/latest`;
}

/**
 * 获取 SkillsProxy 认证头（所有二进制接口通用）
 */
export function getHKBinaryAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${CLAWDSKILLSPROXY_CONFIG.token}`,
    "User-Agent": "OpenClawCN/1.0",
  };
}

/**
 * 构建 SkillsProxy 二进制下载 URL
 * @param downloadPath 从 /latest 返回的 asset.downloadUrl (如 "/api/binaries/ordercli/1.2.3/ordercli-darwin-arm64.tar.gz")
 * @returns 完整下载 URL
 */
export function buildHKBinaryDownloadUrl(downloadPath: string): string {
  return `${CLAWDSKILLSPROXY_CONFIG.baseUrl}${downloadPath}`;
}

/**
 * 获取 SkillsProxy 上工具的下载 URL（旧格式兼容，用于 getHKBinaryDownloadUrls）
 */
export function getHKBinaryDownloadUrl(
  toolName: string,
  version: string,
  platform: string,
): string {
  return `${BINARY_DOWNLOAD_MIRRORS.hkBinaries.baseUrl}/${toolName}/${version}/${platform}`;
}

/**
 * 获取当前平台标识（用于香港服务器下载）
 * @returns 平台标识 (如 "darwin-arm64")
 */
export function getCurrentPlatformForHKBinary(): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin") {
    return arch === "arm64" ? "darwin-arm64" : "darwin-amd64";
  } else if (platform === "linux") {
    return arch === "arm64" ? "linux-arm64" : "linux-amd64";
  } else if (platform === "win32") {
    return arch === "arm64" ? "windows-arm64" : "windows-amd64";
  }

  return `${platform}-${arch}`;
}

/**
 * 获取香港服务器工具下载 URL 列表（含备用源）
 * @param toolName 工具名
 * @param version 版本号（如果不传，会先获取最新版本）
 * @returns 下载 URL 列表（按优先级：香港服务器 → GitHub 代理 → GitHub 原始）
 */
export function getHKBinaryDownloadUrls(
  toolName: string,
  version: string,
  githubRepo?: string,
): string[] {
  const platform = getCurrentPlatformForHKBinary();
  const urls: string[] = [];
  const useCN = shouldUseCNMirror();

  // 1. GitHub 代理（国内公共镜像优先，不消耗服务器带宽）
  if (githubRepo && useCN) {
    const patterns = [
      `${toolName}_${version}_${platform.replace("-", "_")}.tar.gz`,
      `${toolName}-${version}-${platform}.tar.gz`,
      `${toolName}_${platform}.tar.gz`,
    ];
    for (const pattern of patterns) {
      const githubUrl = `https://github.com/${githubRepo}/releases/download/v${version}/${pattern}`;
      urls.push(...getGitHubProxyUrls(githubUrl));
    }
  }

  // 2. SkillsProxy（服务器兜底）
  if (useCN && isToolHostedOnHK(toolName)) {
    urls.push(getHKBinaryDownloadUrl(toolName, version, platform));
  }

  // 3. GitHub 原始地址 (国外最后)
  if (githubRepo) {
    const patterns = [
      `${toolName}_${version}_${platform.replace("-", "_")}.tar.gz`,
      `${toolName}-${version}-${platform}.tar.gz`,
    ];
    for (const pattern of patterns) {
      urls.push(`https://github.com/${githubRepo}/releases/download/v${version}/${pattern}`);
    }
  }

  return urls;
}

/**
 * 获取香港服务器支持的所有工具列表
 */
export function getHKBinaryTools(): string[] {
  return [...BINARY_DOWNLOAD_MIRRORS.hkBinaries.tools];
}
