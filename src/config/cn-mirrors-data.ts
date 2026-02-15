/**
 * cn-mirrors 数据类型定义与加载
 *
 * 静态镜像数据从 cn-mirrors-data.json 加载，
 * 此文件定义 TypeScript 类型并导出类型化的数据常量。
 *
 * 关键注释（JSON 不支持注释，保留在此）：
 *
 * 国内镜像提供商（按响应速度排序）：
 *   - 中科大 (mirrors.ustc.edu.cn) - ~66ms
 *   - 阿里云 (mirrors.aliyun.com) - ~80ms
 *   - 淘宝 (npmmirror.com) - ~82ms
 *   - 字节跳动 (rsproxy.cn) - ~137ms
 *   - 清华大学 (tuna.tsinghua.edu.cn) - ~155ms
 *   - 七牛云 (goproxy.cn) - ~195ms
 *   - 腾讯云 (mirrors.cloud.tencent.com) - ~307ms
 *   - 华为云 (repo.huaweicloud.com) - 部分服务 500 错误
 *
 * GitHub 代理（国内 2026-02-08 实测）:
 *   - gh-proxy.com (最快) - ~690ms
 *   - ghfast.top (稳定) - ~1050ms
 *   - ghproxy.cn (不稳定，首页 302，文件可能 404)
 *   - gh.ddlc.top (404)
 *   - gh.con.sh (暂停服务)
 *
 * @version 2026-02-08
 * @verified 2026-02-08 - GitHub 代理实测更新
 */

import rawData from "./cn-mirrors-data.json" with { type: "json" };

// ============================================================================
// 类型定义
// ============================================================================

/** 包管理器镜像条目（标准三源） */
export interface PackageManagerMirrorEntry {
  primary: string;
  fallback: string;
  tertiary: string;
  description: string;
  /** brew 特有字段 */
  coreGit?: string;
}

/** 包管理器镜像配置（键为包管理器名称） */
export interface PackageManagerMirrors {
  npm: PackageManagerMirrorEntry;
  yarn: PackageManagerMirrorEntry;
  pnpm: PackageManagerMirrorEntry;
  pip: PackageManagerMirrorEntry;
  conda: PackageManagerMirrorEntry;
  go: PackageManagerMirrorEntry;
  cargo: PackageManagerMirrorEntry;
  gem: PackageManagerMirrorEntry;
  brew: PackageManagerMirrorEntry & { coreGit: string };
}

/** 标准三源二进制镜像 */
export interface StandardBinaryMirror {
  primary: string;
  fallback: string;
  tertiary: string;
  description: string;
}

/** uv 安装脚本镜像 */
export interface UvBinaryMirror {
  installScript: string;
  installScriptFallback: string;
  installScriptTertiary: string;
  installPs1: string;
  installPs1Fallback: string;
  installPs1Tertiary: string;
  description: string;
}

/** fnm 安装脚本镜像 */
export interface FnmBinaryMirror {
  installScript: string;
  installScriptFallback: string;
  installScriptTertiary: string;
  description: string;
}

/** Signal CLI 二进制镜像 */
export interface SignalCliBinaryMirror {
  baseUrl: string;
  token: string;
  description: string;
}

/** 香港二进制托管 */
export interface HkBinariesMirror {
  baseUrl: string;
  description: string;
  tools: string[];
}

/** 二进制下载镜像配置 */
export interface BinaryDownloadMirrors {
  github: StandardBinaryMirror;
  node: StandardBinaryMirror;
  goBinary: StandardBinaryMirror;
  python: StandardBinaryMirror;
  rust: StandardBinaryMirror;
  jdk: StandardBinaryMirror;
  uv: UvBinaryMirror;
  fnm: FnmBinaryMirror;
  signalCli: SignalCliBinaryMirror;
  hkBinaries: HkBinariesMirror;
}

/** ClawdSkillsProxy 端点 */
export interface ClawdSkillsProxyEndpoints {
  skills: string;
  signalCliLatest: string;
  signalCliDownload: string;
  signalCliVersions: string;
  capabilities: string;
  capabilitiesWsl: string;
  sherpaOnnxBinaries: string;
  ffmpegBinaries: string;
  ghBinaries: string;
  himalayaBinaries: string;
  ytDlpBinaries: string;
  uvBinaries: string;
  rcloneBinaries: string;
}

/** ClawdSkillsProxy 配置 */
export interface ClawdSkillsProxyConfig {
  baseUrl: string;
  /** 2026-02-02 更新：新 Token */
  token: string;
  endpoints: ClawdSkillsProxyEndpoints;
}

/** 大体积包代理映射条目（JSON 原始格式） */
export interface LargePackageProxyMapRawEntry {
  endpointKey: keyof ClawdSkillsProxyEndpoints;
  description: string;
}

/** 大体积包代理映射条目（运行时格式，endpoint 已解析为实际路径） */
export interface LargePackageProxyMapEntry {
  endpoint: string;
  description: string;
}

/** CLI 工具安装方法 */
export interface CliToolInstallMethod {
  method: "npm" | "go" | "pip" | "uv" | "brew" | "cargo" | "download" | "winget" | "scoop";
  package?: string;
  module?: string;
  formula?: string;
  url?: string;
  wingetId?: string;
  scoopName?: string;
}

/** CLI 工具镜像条目 */
export interface CliToolMirrorEntry {
  name: string;
  description: string;
  installMethods: CliToolInstallMethod[];
  useCNMirror?: boolean;
  /** 香港服务器二进制托管支持 */
  hkBinary?: {
    repo: string;
    platforms: string[];
  };
}

/** JSON 数据文件根结构 */
export interface CnMirrorsRawData {
  packageManagerMirrors: PackageManagerMirrors;
  binaryDownloadMirrors: BinaryDownloadMirrors;
  clawdSkillsProxyConfig: ClawdSkillsProxyConfig;
  largePackageProxyMap: Record<string, LargePackageProxyMapRawEntry>;
  cliToolMirrors: Record<string, CliToolMirrorEntry>;
}

// ============================================================================
// 数据加载与类型化导出
// ============================================================================

const data = rawData as unknown as CnMirrorsRawData;

/** 包管理器镜像配置（仅国内源），每个源配置 3 个国内地址，自动故障转移 */
export const PACKAGE_MANAGER_MIRRORS: PackageManagerMirrors = data.packageManagerMirrors;

/** 二进制文件下载镜像（仅国内源），每个源配置多个国内地址，自动故障转移 */
export const BINARY_DOWNLOAD_MIRRORS: BinaryDownloadMirrors = data.binaryDownloadMirrors;

/**
 * ClawdSkillsProxy 配置
 * 用于托管 Skills 索引、二进制文件和能力包
 */
export const CLAWDSKILLSPROXY_CONFIG: ClawdSkillsProxyConfig = data.clawdSkillsProxyConfig;

/**
 * 大体积包 GitHub URL -> ClawdSkillsProxy 映射
 * installDownloadSpec() 检测到匹配的 GitHub URL 时自动重定向
 *
 * 注意：JSON 中存储 endpointKey，这里解析为实际 endpoint 路径
 */
export const LARGE_PACKAGE_PROXY_MAP: Record<string, LargePackageProxyMapEntry> = Object.fromEntries(
  Object.entries(data.largePackageProxyMap).map(([key, raw]) => [
    key,
    {
      endpoint: CLAWDSKILLSPROXY_CONFIG.endpoints[raw.endpointKey],
      description: raw.description,
    },
  ]),
);

/**
 * 常见命令行工具的安装配置
 * 包含所有 900+ 技能可能需要的依赖
 */
export const CLI_TOOL_MIRRORS: Record<string, CliToolMirrorEntry> = data.cliToolMirrors;
