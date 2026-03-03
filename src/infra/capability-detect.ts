/**
 * 跨平台能力检测模块
 * Cross-platform Capability Detection Module
 *
 * 检测用户设备上 OpenClawCN 可以使用的能力，包括：
 * - CLI 工具（如 gh, spogo, op 等）
 * - 已配置的渠道（飞书、钉钉等）
 * - 浏览器自动化能力
 * - 工作空间内容
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { OpenClawCNConfig } from "../config/config.js";

// ============================================================================
// 类型定义 (Type Definitions)
// ============================================================================

export type CapabilityStatus = "ready" | "needs_config" | "not_available" | "can_install";

export type DetectedCapability = {
  /** 能力唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 显示图标 (emoji) */
  icon: string;
  /** 能力类别 */
  category: "tool" | "channel" | "browser" | "workspace" | "system";
  /** 状态 */
  status: CapabilityStatus;
  /** 对应的 skill 名称 */
  skill?: string;
  /** 是否已配置完成 */
  configured: boolean;
  /** 配置提示 */
  configHint?: string;
  /** 配置页面路径 */
  configPath?: string;
  /** 简短描述 */
  description?: string;
  /** 示例用法 */
  examples?: string[];
};

export type WorkspaceInfo = {
  /** 工作空间路径 */
  path: string;
  /** 项目类型 */
  projectType: string | null;
  /** 检测到的语言/框架 */
  languages: string[];
  /** 主要文件 */
  mainFiles: string[];
  /** 项目名称 */
  name: string | null;
  /** 项目描述 */
  description: string | null;
};

export type CapabilityDetectResult = {
  /** 平台信息 */
  platform: {
    os: string;
    arch: string;
    hostname: string;
  };
  /** 检测到的能力列表 */
  capabilities: DetectedCapability[];
  /** 工作空间信息（如果有） */
  workspace: WorkspaceInfo | null;
  /** 个性化建议 */
  suggestions: Array<{
    icon: string;
    text: string;
    prompt: string;
    capability?: string;
  }>;
  /** 检测耗时 (ms) */
  detectTimeMs: number;
};

// ============================================================================
// CLI 工具定义 (CLI Tool Definitions)
// ============================================================================

type ToolDefinition = {
  id: string;
  name: string;
  icon: string;
  bins: string[];
  skill?: string;
  description: string;
  examples: string[];
  os?: NodeJS.Platform[];
};

const CLI_TOOLS: ToolDefinition[] = [
  {
    id: "github",
    name: "GitHub",
    icon: "🐙",
    bins: ["gh"],
    skill: "github",
    description: "管理 GitHub 仓库、PR、Issues",
    examples: ["帮我看看 PR 状态", "创建一个 Issue"],
  },
  {
    id: "spotify",
    name: "Spotify",
    icon: "🎵",
    bins: ["spogo", "spotify_player"],
    skill: "spotify-player",
    description: "控制 Spotify 播放音乐",
    examples: ["放一首轻松的歌", "暂停音乐"],
  },
  {
    id: "1password",
    name: "1Password",
    icon: "🔐",
    bins: ["op"],
    skill: "1password",
    description: "安全访问密码和凭证",
    examples: ["查找我的 GitHub token"],
  },
  {
    id: "apple-notes",
    name: "Apple Notes",
    icon: "📝",
    bins: ["memo"],
    skill: "apple-notes",
    description: "管理 Apple 备忘录",
    examples: ["帮我记个笔记", "搜索我的备忘录"],
    os: ["darwin"],
  },
  {
    id: "notion",
    name: "Notion",
    icon: "📓",
    bins: ["notion"],
    skill: "notion",
    description: "管理 Notion 文档",
    examples: ["创建一个 Notion 页面"],
  },
  {
    id: "obsidian",
    name: "Obsidian",
    icon: "💎",
    bins: ["obsidian"],
    skill: "obsidian",
    description: "管理 Obsidian 笔记",
    examples: ["打开我的笔记库"],
  },
  {
    id: "vscode",
    name: "VS Code",
    icon: "💻",
    bins: ["code"],
    description: "打开文件和项目",
    examples: ["用 VS Code 打开这个文件"],
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: "💻",
    bins: ["cursor"],
    description: "打开文件和项目",
    examples: ["用 Cursor 打开项目"],
  },
  {
    id: "tmux",
    name: "tmux",
    icon: "🖥️",
    bins: ["tmux"],
    skill: "tmux",
    description: "管理终端会话",
    examples: ["创建一个新的 tmux 会话"],
  },
  {
    id: "docker",
    name: "Docker",
    icon: "🐳",
    bins: ["docker"],
    description: "管理容器",
    examples: ["列出运行中的容器"],
  },
  {
    id: "git",
    name: "Git",
    icon: "📦",
    bins: ["git"],
    description: "版本控制",
    examples: ["提交代码", "查看 git 状态"],
  },
  {
    id: "node",
    name: "Node.js",
    icon: "🟢",
    bins: ["node", "npm", "pnpm", "bun"],
    description: "JavaScript 运行时",
    examples: ["运行 npm install"],
  },
  {
    id: "python",
    name: "Python",
    icon: "🐍",
    bins: ["python", "python3", "pip", "uv"],
    description: "Python 运行时",
    examples: ["运行 Python 脚本"],
  },
];

// ============================================================================
// 渠道定义 (Channel Definitions)
// ============================================================================

type ChannelDefinition = {
  id: string;
  name: string;
  icon: string;
  configPath: string;
  configFields: string[];
  description: string;
  examples: string[];
};

const CHANNELS: ChannelDefinition[] = [
  {
    id: "feishu",
    name: "飞书",
    icon: "💬",
    configPath: "channels.feishu",
    configFields: ["channels.feishu.app.appId", "channels.feishu.app.appSecret"],
    description: "发送飞书消息",
    examples: ["帮我发条飞书消息", "创建飞书日程"],
  },
  {
    id: "dingtalk",
    name: "钉钉",
    icon: "💬",
    configPath: "channels.dingtalk",
    configFields: ["channels.dingtalk.app.appKey", "channels.dingtalk.app.appSecret"],
    description: "发送钉钉消息",
    examples: ["帮我发条钉钉消息"],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "💬",
    configPath: "channels.slack",
    configFields: ["channels.slack.botToken"],
    description: "发送 Slack 消息",
    examples: ["帮我发条 Slack 消息"],
  },
  {
    id: "discord",
    name: "Discord",
    icon: "🎮",
    configPath: "channels.discord",
    configFields: ["channels.discord.botToken"],
    description: "发送 Discord 消息",
    examples: ["帮我发条 Discord 消息"],
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "✈️",
    configPath: "channels.telegram",
    configFields: ["channels.telegram.botToken"],
    description: "发送 Telegram 消息",
    examples: ["帮我发条 Telegram 消息"],
  },
];

// ============================================================================
// 浏览器定义 (Browser Definitions)
// ============================================================================

type BrowserDefinition = {
  id: string;
  name: string;
  icon: string;
  bins: string[];
  macAppName?: string;
};

const BROWSERS: BrowserDefinition[] = [
  {
    id: "chrome",
    name: "Chrome",
    icon: "🌐",
    bins: ["google-chrome", "google-chrome-stable", "chromium"],
    macAppName: "Google Chrome",
  },
  {
    id: "edge",
    name: "Edge",
    icon: "🌐",
    bins: ["microsoft-edge"],
    macAppName: "Microsoft Edge",
  },
  {
    id: "firefox",
    name: "Firefox",
    icon: "🦊",
    bins: ["firefox"],
    macAppName: "Firefox",
  },
  {
    id: "safari",
    name: "Safari",
    icon: "🧭",
    bins: [],
    macAppName: "Safari",
  },
];

// ============================================================================
// 检测函数 (Detection Functions)
// ============================================================================

// 缓存检测结果，避免重复检测
const binaryCache = new Map<string, boolean>();

/**
 * 检测 CLI 工具是否存在
 * 使用缓存避免重复检测，设置较短超时防止阻塞
 */
function detectBinary(bin: string): boolean {
  // 检查缓存
  const cached = binaryCache.get(bin);
  if (cached !== undefined) {
    return cached;
  }

  try {
    // [SECURITY FIX] Use execFileSync with array args to prevent cmd injection via `bin`
    const cmd = process.platform === "win32" ? "where" : "which";
    execFileSync(cmd, [bin], { stdio: "pipe", timeout: 500 });
    binaryCache.set(bin, true);
    return true;
  } catch {
    binaryCache.set(bin, false);
    return false;
  }
}

/**
 * 检测 macOS 应用是否存在
 */
function detectMacApp(appName: string): boolean {
  if (process.platform !== "darwin") return false;
  const appPath = `/Applications/${appName}.app`;
  return fs.existsSync(appPath);
}

/**
 * 检测 CLI 工具能力
 * 使用提前终止策略：一旦找到任一 bin 就停止检测该工具
 */
function detectCliTools(): DetectedCapability[] {
  const results: DetectedCapability[] = [];
  const platform = process.platform;

  for (const tool of CLI_TOOLS) {
    // 检查平台限制
    if (tool.os && !tool.os.includes(platform)) {
      continue;
    }

    // 检测任一二进制文件是否存在（提前终止）
    let hasAnyBin = false;
    for (const bin of tool.bins) {
      if (detectBinary(bin)) {
        hasAnyBin = true;
        break; // 找到一个就够了，不继续检测其他 bin
      }
    }

    if (hasAnyBin) {
      results.push({
        id: tool.id,
        name: tool.name,
        icon: tool.icon,
        category: "tool",
        status: "ready",
        skill: tool.skill,
        configured: true,
        description: tool.description,
        examples: tool.examples,
      });
    }
  }

  return results;
}

/**
 * 从配置路径获取值
 */
function getConfigValue(config: OpenClawCNConfig | undefined, path: string): unknown {
  if (!config) return undefined;
  const parts = path.split(".");
  let current: unknown = config;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * 检测渠道配置状态
 */
function detectChannels(config?: OpenClawCNConfig): DetectedCapability[] {
  const results: DetectedCapability[] = [];

  for (const channel of CHANNELS) {
    // 检查是否所有必需字段都已配置
    const allConfigured = channel.configFields.every((field) => {
      const value = getConfigValue(config, field);
      return value !== undefined && value !== null && value !== "";
    });

    // 检查渠道是否启用
    const channelConfig = getConfigValue(config, channel.configPath) as
      | Record<string, unknown>
      | undefined;
    const isEnabled = channelConfig?.enabled !== false;

    if (allConfigured && isEnabled) {
      results.push({
        id: channel.id,
        name: channel.name,
        icon: channel.icon,
        category: "channel",
        status: "ready",
        configured: true,
        description: channel.description,
        examples: channel.examples,
      });
    } else if (channelConfig) {
      // 有配置但不完整
      results.push({
        id: channel.id,
        name: channel.name,
        icon: channel.icon,
        category: "channel",
        status: "needs_config",
        configured: false,
        configHint: `需要配置 ${channel.name} 开放平台凭证`,
        configPath: `/settings/channels/${channel.id}`,
        description: channel.description,
        examples: channel.examples,
      });
    }
  }

  return results;
}

/**
 * 检测浏览器
 */
function detectBrowsers(): DetectedCapability[] {
  const results: DetectedCapability[] = [];
  const platform = process.platform;

  for (const browser of BROWSERS) {
    let detected = false;

    if (platform === "darwin" && browser.macAppName) {
      detected = detectMacApp(browser.macAppName);
    } else if (browser.bins.length > 0) {
      detected = browser.bins.some((bin) => detectBinary(bin));
    }

    if (detected) {
      results.push({
        id: browser.id,
        name: browser.name,
        icon: browser.icon,
        category: "browser",
        status: "ready",
        configured: true,
        description: "浏览器自动化",
        examples: ["打开网页", "搜索信息"],
      });
      // 只返回第一个检测到的浏览器
      break;
    }
  }

  // 如果检测到浏览器，添加通用浏览器自动化能力
  if (results.length > 0) {
    results.push({
      id: "browser-automation",
      name: "网页自动化",
      icon: "🤖",
      category: "browser",
      status: "ready",
      configured: true,
      description: "自动化操作网页",
      examples: ["帮我打开淘宝", "搜索今天的新闻", "填写表单"],
    });
  }

  return results;
}

// ============================================================================
// 工作空间扫描 (Workspace Scanning)
// ============================================================================

type ProjectTypePattern = {
  type: string;
  files: string[];
  language: string;
};

const PROJECT_PATTERNS: ProjectTypePattern[] = [
  { type: "Node.js", files: ["package.json"], language: "JavaScript/TypeScript" },
  {
    type: "Python",
    files: ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"],
    language: "Python",
  },
  { type: "Go", files: ["go.mod", "go.sum"], language: "Go" },
  { type: "Rust", files: ["Cargo.toml"], language: "Rust" },
  { type: "Java/Maven", files: ["pom.xml"], language: "Java" },
  { type: "Java/Gradle", files: ["build.gradle", "build.gradle.kts"], language: "Java/Kotlin" },
  { type: "Ruby", files: ["Gemfile", "*.gemspec"], language: "Ruby" },
  { type: "PHP/Composer", files: ["composer.json"], language: "PHP" },
  { type: "C#/.NET", files: ["*.csproj", "*.sln"], language: "C#" },
  { type: "Swift", files: ["Package.swift", "*.xcodeproj"], language: "Swift" },
];

// 危险目录列表（不应该扫描的目录）
const DANGEROUS_DIRS = new Set([
  "/",
  "/home",
  "/Users",
  "/root",
  "C:\\",
  "D:\\",
  "E:\\",
  "/var",
  "/etc",
  "/usr",
]);

/**
 * 扫描工作空间
 * 添加边界保护，防止在根目录或超大目录运行
 */
export function scanWorkspace(workspaceDir: string): WorkspaceInfo | null {
  if (!workspaceDir || !fs.existsSync(workspaceDir)) {
    return null;
  }

  // 规范化路径
  const normalizedPath = path.resolve(workspaceDir);

  // 检查是否是危险目录
  if (DANGEROUS_DIRS.has(normalizedPath) || DANGEROUS_DIRS.has(normalizedPath + path.sep)) {
    console.warn(`[capability-detect] Skipping dangerous directory: ${normalizedPath}`);
    return null;
  }

  // 检查路径深度，太浅的路径可能是系统目录
  const pathDepth = normalizedPath.split(path.sep).filter(Boolean).length;
  if (pathDepth < 2) {
    console.warn(`[capability-detect] Skipping shallow directory: ${normalizedPath}`);
    return null;
  }

  const info: WorkspaceInfo = {
    path: workspaceDir,
    projectType: null,
    languages: [],
    mainFiles: [],
    name: null,
    description: null,
  };

  try {
    const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });

    // 限制扫描的文件数量，防止超大目录
    const MAX_FILES_TO_SCAN = 200;
    const files = entries
      .filter((e) => e.isFile())
      .slice(0, MAX_FILES_TO_SCAN)
      .map((e) => e.name);

    // 检测项目类型
    for (const pattern of PROJECT_PATTERNS) {
      for (const patternFile of pattern.files) {
        if (patternFile.includes("*")) {
          // 通配符匹配
          const regex = new RegExp(patternFile.replace("*", ".*"));
          if (files.some((f) => regex.test(f))) {
            info.projectType = pattern.type;
            if (!info.languages.includes(pattern.language)) {
              info.languages.push(pattern.language);
            }
          }
        } else if (files.includes(patternFile)) {
          info.projectType = pattern.type;
          if (!info.languages.includes(pattern.language)) {
            info.languages.push(pattern.language);
          }
          info.mainFiles.push(patternFile);
        }
      }
    }

    // 读取 package.json 获取项目名称和描述
    const packageJsonPath = path.join(workspaceDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        info.name = pkg.name ?? null;
        info.description = pkg.description ?? null;
      } catch {
        // ignore parse errors
      }
    }

    // 如果没有从 package.json 获取名称，使用目录名
    if (!info.name) {
      info.name = path.basename(workspaceDir);
    }

    // 检测 README
    const readmeFiles = ["README.md", "README.txt", "README"];
    for (const readme of readmeFiles) {
      if (files.includes(readme)) {
        info.mainFiles.push(readme);
        break;
      }
    }

    // 检测常见配置文件
    const configFiles = [".env", ".env.local", "config.json", "config.yaml", "config.yml"];
    for (const config of configFiles) {
      if (files.includes(config)) {
        info.mainFiles.push(config);
      }
    }
  } catch {
    // ignore errors
  }

  return info;
}

/**
 * 根据工作空间生成能力
 */
function detectWorkspaceCapabilities(workspace: WorkspaceInfo | null): DetectedCapability[] {
  if (!workspace) return [];

  const results: DetectedCapability[] = [];

  // 添加工作空间通用能力
  results.push({
    id: "workspace",
    name: `项目: ${workspace.name ?? "当前目录"}`,
    icon: "📁",
    category: "workspace",
    status: "ready",
    configured: true,
    description: workspace.projectType ? `${workspace.projectType} 项目` : "工作空间",
    examples: ["分析这个项目", "帮我写代码", "解释这段代码"],
  });

  // 根据项目类型添加特定能力
  if (workspace.languages.includes("JavaScript/TypeScript")) {
    results.push({
      id: "workspace-js",
      name: "前端/Node.js 开发",
      icon: "🟨",
      category: "workspace",
      status: "ready",
      configured: true,
      description: "JavaScript/TypeScript 开发支持",
      examples: ["运行 npm install", "帮我调试这个组件"],
    });
  }

  if (workspace.languages.includes("Python")) {
    results.push({
      id: "workspace-python",
      name: "Python 开发",
      icon: "🐍",
      category: "workspace",
      status: "ready",
      configured: true,
      description: "Python 开发支持",
      examples: ["运行 Python 脚本", "安装依赖"],
    });
  }

  return results;
}

// ============================================================================
// 建议生成 (Suggestion Generation)
// ============================================================================

type SuggestionTemplate = {
  capability: string;
  suggestions: Array<{ icon: string; text: string; prompt: string }>;
};

const SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
  {
    capability: "spotify",
    suggestions: [
      { icon: "🎵", text: "累了？放首歌吧", prompt: "放一首轻松的音乐" },
      { icon: "🎧", text: "来点背景音乐", prompt: "播放一些适合工作的背景音乐" },
    ],
  },
  {
    capability: "github",
    suggestions: [
      { icon: "🐙", text: "看看我的 PR", prompt: "帮我看看最近的 Pull Request 状态" },
      { icon: "📋", text: "处理 Issues", prompt: "列出我负责的 Issues" },
    ],
  },
  {
    capability: "feishu",
    suggestions: [{ icon: "💬", text: "发条飞书消息", prompt: "帮我发一条飞书消息给同事" }],
  },
  {
    capability: "dingtalk",
    suggestions: [{ icon: "💬", text: "发条钉钉消息", prompt: "帮我发一条钉钉消息" }],
  },
  {
    capability: "browser-automation",
    suggestions: [
      { icon: "🌐", text: "打开网页", prompt: "帮我打开淘宝" },
      { icon: "🔍", text: "搜索信息", prompt: "帮我搜索今天的科技新闻" },
    ],
  },
  {
    capability: "workspace",
    suggestions: [
      { icon: "💻", text: "帮我写代码", prompt: "帮我写一个函数" },
      { icon: "🔧", text: "调试问题", prompt: "帮我看看这个报错怎么解决" },
    ],
  },
  {
    capability: "1password",
    suggestions: [{ icon: "🔐", text: "查找密码", prompt: "帮我查找 GitHub 的 token" }],
  },
];

/**
 * 根据检测到的能力生成个性化建议
 */
function generateSuggestions(
  capabilities: DetectedCapability[],
  workspace: WorkspaceInfo | null,
): Array<{ icon: string; text: string; prompt: string; capability?: string }> {
  const suggestions: Array<{ icon: string; text: string; prompt: string; capability?: string }> =
    [];
  const readyCapabilities = new Set(
    capabilities.filter((c) => c.status === "ready").map((c) => c.id),
  );

  // 根据能力添加建议
  for (const template of SUGGESTION_TEMPLATES) {
    if (readyCapabilities.has(template.capability)) {
      for (const suggestion of template.suggestions) {
        suggestions.push({
          ...suggestion,
          capability: template.capability,
        });
      }
    }
  }

  // 根据工作空间添加特定建议
  if (workspace?.projectType) {
    suggestions.push({
      icon: "📁",
      text: `分析 ${workspace.name ?? "项目"}`,
      prompt: `帮我分析一下这个 ${workspace.projectType} 项目的结构`,
      capability: "workspace",
    });
  }

  // 通用建议（始终添加）
  suggestions.push({
    icon: "❓",
    text: "有什么问题问我",
    prompt: "你好，你能帮我做什么？",
  });

  // 限制建议数量
  return suggestions.slice(0, 6);
}

// ============================================================================
// 主检测函数 (Main Detection Function)
// ============================================================================

export type CapabilityDetectOptions = {
  config?: OpenClawCNConfig;
  workspaceDir?: string;
};

/**
 * 检测所有能力
 */
export async function detectCapabilities(
  opts?: CapabilityDetectOptions,
): Promise<CapabilityDetectResult> {
  const startTime = Date.now();

  // 并行检测所有能力
  const [cliTools, channels, browsers] = await Promise.all([
    Promise.resolve(detectCliTools()),
    Promise.resolve(detectChannels(opts?.config)),
    Promise.resolve(detectBrowsers()),
  ]);

  // 扫描工作空间
  const workspace = opts?.workspaceDir ? scanWorkspace(opts.workspaceDir) : null;
  const workspaceCapabilities = detectWorkspaceCapabilities(workspace);

  // 合并所有能力
  const capabilities: DetectedCapability[] = [
    ...cliTools,
    ...channels,
    ...browsers,
    ...workspaceCapabilities,
  ];

  // 生成建议
  const suggestions = generateSuggestions(capabilities, workspace);

  const detectTimeMs = Date.now() - startTime;

  return {
    platform: {
      os: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
    capabilities,
    workspace,
    suggestions,
    detectTimeMs,
  };
}

/**
 * 快速检测（只检测最常用的能力）
 */
export function detectCapabilitiesQuick(opts?: CapabilityDetectOptions): CapabilityDetectResult {
  const startTime = Date.now();

  // 同步检测（更快）
  const cliTools = detectCliTools();
  const channels = detectChannels(opts?.config);
  const browsers = detectBrowsers();

  const workspace = opts?.workspaceDir ? scanWorkspace(opts.workspaceDir) : null;
  const workspaceCapabilities = detectWorkspaceCapabilities(workspace);

  const capabilities: DetectedCapability[] = [
    ...cliTools,
    ...channels,
    ...browsers,
    ...workspaceCapabilities,
  ];

  const suggestions = generateSuggestions(capabilities, workspace);

  return {
    platform: {
      os: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
    capabilities,
    workspace,
    suggestions,
    detectTimeMs: Date.now() - startTime,
  };
}
