/**
 * ClawdbotCN 国内镜像配置
 * 
 * 🇨🇳 仅使用中国国内镜像源，不依赖任何国外服务
 * 为中国用户提供高速下载，支持 900+ 技能的依赖安装
 * 
 * 每个镜像源都配置了主备多个地址，自动故障转移
 * 
 * @version 2026-02-02
 * @verified 2026-02-02 10:23 - 网络测试结果
 * 
 * 国内镜像提供商（按响应速度排序）：
 *   - 中科大 (mirrors.ustc.edu.cn) - ~66ms 🚀
 *   - 阿里云 (mirrors.aliyun.com) - ~80ms 🚀
 *   - 淘宝 (npmmirror.com) - ~82ms 🚀
 *   - 字节跳动 (rsproxy.cn) - ~137ms
 *   - 清华大学 (tuna.tsinghua.edu.cn) - ~155ms
 *   - 七牛云 (goproxy.cn) - ~195ms
 *   - 腾讯云 (mirrors.cloud.tencent.com) - ~307ms
 *   - 华为云 (repo.huaweicloud.com) - ⚠️ 部分服务 500 错误
 * 
 * GitHub 代理（国内）:
 *   - ghproxy.cn ✅ (最稳定，唯一可靠) - ~640ms
 *   - gh.ddlc.top ⚠️ (部分站点 404)
 *   - gh.con.sh ❌ (暂停服务)
 */

// ============================================================================
// 包管理器镜像
// ============================================================================

/**
 * 包管理器镜像配置（仅国内源）
 * 每个源配置 3 个国内地址，自动故障转移
 */
export const PACKAGE_MANAGER_MIRRORS = {
  // Node.js / npm 生态
  npm: {
    primary: "https://registry.npmmirror.com",       // 淘宝
    fallback: "https://mirrors.cloud.tencent.com/npm", // 腾讯云
    tertiary: "https://repo.huaweicloud.com/repository/npm", // 华为云
    description: "npm 包镜像（淘宝 → 腾讯云 → 华为云）",
  },
  yarn: {
    primary: "https://registry.npmmirror.com",
    fallback: "https://mirrors.cloud.tencent.com/npm",
    tertiary: "https://repo.huaweicloud.com/repository/npm",
    description: "Yarn 包镜像（淘宝 → 腾讯云 → 华为云）",
  },
  pnpm: {
    primary: "https://registry.npmmirror.com",
    fallback: "https://mirrors.cloud.tencent.com/npm",
    tertiary: "https://repo.huaweicloud.com/repository/npm",
    description: "pnpm 包镜像（淘宝 → 腾讯云 → 华为云）",
  },

  // Python 生态
  pip: {
    primary: "https://pypi.tuna.tsinghua.edu.cn/simple",    // 清华
    fallback: "https://mirrors.aliyun.com/pypi/simple",     // 阿里云
    tertiary: "https://pypi.mirrors.ustc.edu.cn/simple",    // 中科大
    description: "PyPI 镜像（清华 → 阿里云 → 中科大）",
  },
  conda: {
    primary: "https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main",
    fallback: "https://mirrors.aliyun.com/anaconda/pkgs/main",
    tertiary: "https://mirrors.ustc.edu.cn/anaconda/pkgs/main",
    description: "Conda 镜像（清华 → 阿里云 → 中科大）",
  },

  // Go 生态
  go: {
    primary: "https://goproxy.cn",                // 七牛云
    fallback: "https://mirrors.aliyun.com/goproxy", // 阿里云
    tertiary: "https://goproxy.io",               // goproxy.io
    description: "Go 模块代理（七牛云 → 阿里云 → goproxy.io）",
  },

  // Rust 生态
  cargo: {
    primary: "https://rsproxy.cn/crates.io-index",         // 字节跳动
    fallback: "https://mirrors.ustc.edu.cn/crates.io-index", // 中科大
    tertiary: "https://mirrors.tuna.tsinghua.edu.cn/crates.io-index", // 清华
    description: "Cargo 镜像（字节跳动 → 中科大 → 清华）",
  },

  // Ruby 生态
  gem: {
    primary: "https://gems.ruby-china.com",              // Ruby China
    fallback: "https://mirrors.tuna.tsinghua.edu.cn/rubygems", // 清华
    tertiary: "https://mirrors.ustc.edu.cn/rubygems",    // 中科大
    description: "RubyGems 镜像（Ruby China → 清华 → 中科大）",
  },

  // Homebrew (macOS)
  brew: {
    primary: "https://mirrors.ustc.edu.cn/homebrew-bottles",
    fallback: "https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles",
    tertiary: "https://mirrors.aliyun.com/homebrew/homebrew-bottles",
    coreGit: "https://mirrors.ustc.edu.cn/homebrew-core.git",
    description: "Homebrew 镜像（中科大 → 清华 → 阿里云）",
  },
} as const;

// ============================================================================
// 二进制下载镜像
// ============================================================================

/**
 * 二进制文件下载镜像（仅国内源）
 * 每个源配置多个国内地址，自动故障转移
 */
export const BINARY_DOWNLOAD_MIRRORS = {
  // GitHub Release 代理 - 国内加速下载 GitHub 文件
  // 2026-02-02 测试: ghproxy.cn ✅ gh.con.sh ⚠️(暂停) gh.ddlc.top ❌(404)
  // 目前仅 ghproxy.cn 稳定可用
  github: {
    primary: "https://ghproxy.cn",       // ghproxy.cn 最稳定 ✅
    fallback: "https://gh.ddlc.top",     // gh.ddlc.top 部分可用
    tertiary: "https://gh.con.sh",       // gh.con.sh 可能暂停服务
    description: "GitHub 代理（ghproxy.cn 为主）",
  },

  // Node.js 二进制 - 淘宝镜像
  // 2026-02-02 测试: 华为云 500 错误，已移除
  node: {
    primary: "https://npmmirror.com/mirrors/node",
    fallback: "https://cdn.npmmirror.com/binaries/node",
    tertiary: "https://registry.npmmirror.com/-/binary/node",  // 淘宝备用
    description: "Node.js 二进制（淘宝镜像）",
  },

  // Go 二进制 - 国内下载
  goBinary: {
    primary: "https://studygolang.com/dl/golang",     // Go语言中文网
    fallback: "https://golang.google.cn/dl",          // Google 中国
    tertiary: "https://mirrors.aliyun.com/golang",    // 阿里云
    description: "Go 语言二进制（Go中文网 → Google中国 → 阿里云）",
  },

  // Python 二进制 - 淘宝镜像
  // 2026-02-02 测试: 华为云 500 错误，已移除
  python: {
    primary: "https://npmmirror.com/mirrors/python",
    fallback: "https://cdn.npmmirror.com/binaries/python",
    tertiary: "https://registry.npmmirror.com/-/binary/python",  // 淘宝备用
    description: "Python 二进制（淘宝镜像）",
  },

  // Rust 二进制 - 字节/中科大/清华
  rust: {
    primary: "https://rsproxy.cn",                         // 字节跳动
    fallback: "https://mirrors.ustc.edu.cn/rust-static",   // 中科大
    tertiary: "https://mirrors.tuna.tsinghua.edu.cn/rustup", // 清华
    description: "Rust 工具链（字节跳动 → 中科大 → 清华）",
  },

  // Java/JDK - 清华/中科大
  // 2026-02-02 测试: 清华 ✅ 中科大 ✅
  jdk: {
    primary: "https://mirrors.tuna.tsinghua.edu.cn/Adoptium",  // 清华
    fallback: "https://mirrors.ustc.edu.cn/adoptium",          // 中科大
    tertiary: "https://mirrors.aliyun.com/adoptium",           // 阿里云
    description: "JDK 下载（清华 → 中科大 → 阿里云）",
  },

  // uv (Python 包管理器) - 通过国内 GitHub 代理
  // 2026-02-02 测试: 仅 ghproxy.cn 稳定可用
  uv: {
    installScript: "https://ghproxy.cn/https://astral.sh/uv/install.sh",
    installScriptFallback: "https://ghproxy.cn/https://raw.githubusercontent.com/astral-sh/uv/main/scripts/install.sh",
    installScriptTertiary: "https://gh.ddlc.top/https://astral.sh/uv/install.sh",
    installPs1: "https://ghproxy.cn/https://astral.sh/uv/install.ps1",
    installPs1Fallback: "https://ghproxy.cn/https://raw.githubusercontent.com/astral-sh/uv/main/scripts/install.ps1",
    installPs1Tertiary: "https://gh.ddlc.top/https://astral.sh/uv/install.ps1",
    description: "uv 安装脚本（通过 ghproxy.cn 代理）",
  },

  // fnm (Node.js 版本管理器) - 通过国内 GitHub 代理
  fnm: {
    installScript: "https://ghproxy.cn/https://fnm.vercel.app/install",
    installScriptFallback: "https://ghproxy.cn/https://raw.githubusercontent.com/Schniz/fnm/master/.ci/install.sh",
    installScriptTertiary: "https://gh.ddlc.top/https://fnm.vercel.app/install",
    description: "fnm 安装脚本（通过 ghproxy.cn 代理）",
  },

  // Signal CLI - ClawdSkillsProxy 托管
  // GitHub 代理无法访问 Signal CLI releases，需要自建镜像
  signalCli: {
    baseUrl: "http://121.43.61.90/api/binaries/signal-cli",
    token: "clawdskills_secret_token_2024",
    description: "Signal CLI 二进制（ClawdSkillsProxy 托管）",
  },

  // 香港二进制托管服务器
  // 托管 GitHub 个人仓库的工具二进制，国内直连香港速度快
  // 每小时自动同步 GitHub 最新版本
  hkBinaries: {
    baseUrl: "http://43.129.194.117:8888",
    description: "香港二进制托管服务器（直连 GitHub 同步）",
    // 支持的工具列表（10 个已验证可用）
    // 暂不支持：gifgrep（无 Release）、memo（需调整配置）、songsee（无 Release）
    tools: [
      "ordercli", "peekaboo", "remindctl", "imsg",
      "camsnap", "wacli", "sag", "gog", "spogo", "summarize",
    ],
  },
} as const;

/**
 * ClawdSkillsProxy 配置
 * 用于托管 Skills 索引、二进制文件和能力包
 */
export const CLAWDSKILLSPROXY_CONFIG = {
  baseUrl: "http://121.43.61.90",
  token: "clawdbotCN778",  // 2026-02-02 更新：新 Token
  endpoints: {
    skills: "/api/skills/index",
    signalCliLatest: "/api/binaries/signal-cli/latest",
    signalCliDownload: "/api/binaries/signal-cli",  // + /{version}/{filename}
    signalCliVersions: "/api/binaries/signal-cli/versions",
    capabilities: "/api/capabilities",              // + /{filename}
    capabilitiesWsl: "/api/capabilities/wsl",       // + /{filename}
  },
} as const;

// ============================================================================
// 常见 CLI 工具镜像配置
// ============================================================================

/**
 * 常见命令行工具的安装配置
 * 包含所有 900+ 技能可能需要的依赖
 */
export const CLI_TOOL_MIRRORS: Record<string, {
  name: string;
  description: string;
  installMethods: {
    method: "npm" | "go" | "pip" | "uv" | "brew" | "cargo" | "download" | "winget" | "scoop";
    package?: string;
    module?: string;
    formula?: string;
    url?: string;
    wingetId?: string;
    scoopName?: string;
  }[];
  useCNMirror?: boolean;
  // 香港服务器二进制托管支持
  hkBinary?: {
    repo: string;  // GitHub 仓库 (如 "steipete/peekaboo")
    platforms: string[];  // 支持的平台
  };
}> = {
  // ============================================
  // 效率工具类
  // ============================================
  "op": {
    name: "1Password CLI",
    description: "密码管理器命令行",
    installMethods: [
      { method: "brew", formula: "1password-cli" },
      { method: "winget", wingetId: "AgileBits.1Password.CLI" },
      { method: "scoop", scoopName: "1password-cli" },
    ],
  },
  "memo": {
    name: "memo",
    description: "Apple Notes CLI",
    installMethods: [
      { method: "brew", formula: "peterrk/tap/memo" },
    ],
    // hkBinary 暂不可用：需调整配置
  },
  "remindctl": {
    name: "remindctl",
    description: "Apple Reminders CLI",
    installMethods: [
      { method: "brew", formula: "keith/formulae/remindctl" },
    ],
    hkBinary: { repo: "steipete/remindctl", platforms: ["darwin-arm64", "darwin-amd64"] },
  },
  "grizzly": {
    name: "grizzly",
    description: "Bear Notes CLI",
    installMethods: [
      { method: "go", module: "github.com/alantech/grizzly@latest" },
    ],
    useCNMirror: true,
  },
  "notion": {
    name: "notion-cli",
    description: "Notion CLI",
    installMethods: [
      { method: "npm", package: "notion-cli" },
    ],
    useCNMirror: true,
  },
  "obsidian-cli": {
    name: "obsidian-cli",
    description: "Obsidian CLI",
    installMethods: [
      { method: "npm", package: "@obsidianmd/obsidian-cli" },
    ],
    useCNMirror: true,
  },
  "trello": {
    name: "trello-cli",
    description: "Trello CLI",
    installMethods: [
      { method: "npm", package: "trello-cli" },
    ],
    useCNMirror: true,
  },
  "himalaya": {
    name: "himalaya",
    description: "邮件客户端 CLI",
    installMethods: [
      { method: "brew", formula: "himalaya" },
      { method: "cargo", package: "himalaya" },
    ],
    useCNMirror: true,
  },
  "things": {
    name: "things-cli",
    description: "Things 3 CLI",
    installMethods: [
      { method: "npm", package: "things-cli" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 开发工具类
  // ============================================
  "gh": {
    name: "GitHub CLI",
    description: "GitHub 命令行工具",
    installMethods: [
      { method: "brew", formula: "gh" },
      { method: "winget", wingetId: "GitHub.cli" },
      { method: "scoop", scoopName: "gh" },
    ],
  },
  "git": {
    name: "Git",
    description: "版本控制系统",
    installMethods: [
      { method: "brew", formula: "git" },
      { method: "winget", wingetId: "Git.Git" },
      { method: "scoop", scoopName: "git" },
    ],
  },
  "tmux": {
    name: "tmux",
    description: "终端复用器",
    installMethods: [
      { method: "brew", formula: "tmux" },
    ],
  },
  "jq": {
    name: "jq",
    description: "JSON 处理工具",
    installMethods: [
      { method: "brew", formula: "jq" },
      { method: "winget", wingetId: "jqlang.jq" },
      { method: "scoop", scoopName: "jq" },
    ],
  },
  "yq": {
    name: "yq",
    description: "YAML 处理工具",
    installMethods: [
      { method: "brew", formula: "yq" },
      { method: "go", module: "github.com/mikefarah/yq/v4@latest" },
    ],
    useCNMirror: true,
  },
  "fzf": {
    name: "fzf",
    description: "模糊搜索工具",
    installMethods: [
      { method: "brew", formula: "fzf" },
      { method: "winget", wingetId: "junegunn.fzf" },
      { method: "scoop", scoopName: "fzf" },
    ],
  },
  "ripgrep": {
    name: "ripgrep",
    description: "快速搜索工具",
    installMethods: [
      { method: "brew", formula: "ripgrep" },
      { method: "winget", wingetId: "BurntSushi.ripgrep.MSVC" },
      { method: "scoop", scoopName: "ripgrep" },
      { method: "cargo", package: "ripgrep" },
    ],
    useCNMirror: true,
  },
  "fd": {
    name: "fd",
    description: "快速文件查找",
    installMethods: [
      { method: "brew", formula: "fd" },
      { method: "winget", wingetId: "sharkdp.fd" },
      { method: "scoop", scoopName: "fd" },
      { method: "cargo", package: "fd-find" },
    ],
    useCNMirror: true,
  },
  "bat": {
    name: "bat",
    description: "cat 替代工具",
    installMethods: [
      { method: "brew", formula: "bat" },
      { method: "winget", wingetId: "sharkdp.bat" },
      { method: "scoop", scoopName: "bat" },
      { method: "cargo", package: "bat" },
    ],
    useCNMirror: true,
  },
  "exa": {
    name: "exa",
    description: "ls 替代工具",
    installMethods: [
      { method: "brew", formula: "exa" },
      { method: "cargo", package: "exa" },
    ],
    useCNMirror: true,
  },
  "eza": {
    name: "eza",
    description: "现代 ls 替代",
    installMethods: [
      { method: "brew", formula: "eza" },
      { method: "cargo", package: "eza" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 媒体工具类
  // ============================================
  "ffmpeg": {
    name: "FFmpeg",
    description: "音视频处理工具",
    installMethods: [
      { method: "brew", formula: "ffmpeg" },
      { method: "winget", wingetId: "Gyan.FFmpeg" },
      { method: "scoop", scoopName: "ffmpeg" },
    ],
  },
  "imagemagick": {
    name: "ImageMagick",
    description: "图片处理工具",
    installMethods: [
      { method: "brew", formula: "imagemagick" },
      { method: "winget", wingetId: "ImageMagick.ImageMagick" },
      { method: "scoop", scoopName: "imagemagick" },
    ],
  },
  "yt-dlp": {
    name: "yt-dlp",
    description: "视频下载工具",
    installMethods: [
      { method: "brew", formula: "yt-dlp" },
      { method: "pip", package: "yt-dlp" },
      { method: "winget", wingetId: "yt-dlp.yt-dlp" },
      { method: "scoop", scoopName: "yt-dlp" },
    ],
    useCNMirror: true,
  },
  "whisper": {
    name: "whisper",
    description: "OpenAI 语音转文字",
    installMethods: [
      { method: "pip", package: "openai-whisper" },
      { method: "uv", package: "openai-whisper" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 社交通讯类
  // ============================================
  "bird": {
    name: "bird",
    description: "Twitter/X CLI",
    installMethods: [
      { method: "npm", package: "@stei/bird" },
    ],
    useCNMirror: true,
  },
  "slack-cli": {
    name: "slack-cli",
    description: "Slack CLI",
    installMethods: [
      { method: "brew", formula: "slack-cli" },
    ],
  },
  "telegram-cli": {
    name: "telegram-cli",
    description: "Telegram CLI",
    installMethods: [
      { method: "brew", formula: "telegram-cli" },
    ],
  },

  // ============================================
  // 智能家居类
  // ============================================
  "openhue": {
    name: "openhue",
    description: "Philips Hue CLI",
    installMethods: [
      { method: "go", module: "github.com/openhue/openhue-cli@latest" },
    ],
    useCNMirror: true,
  },
  "sonos": {
    name: "sonos",
    description: "Sonos CLI",
    installMethods: [
      { method: "npm", package: "sonos-cli" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 生活助手类
  // ============================================
  "wttr": {
    name: "wttr.in",
    description: "天气查询 (curl)",
    installMethods: [],
  },
  "goplaces": {
    name: "goplaces",
    description: "地点搜索 CLI",
    installMethods: [
      { method: "go", module: "github.com/go-places/goplaces@latest" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 数据分析类
  // ============================================
  "blogwatcher": {
    name: "blogwatcher",
    description: "博客/RSS 监控",
    installMethods: [
      { method: "go", module: "github.com/blogwatcher/blogwatcher@latest" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 系统工具类
  // ============================================
  "eightctl": {
    name: "eightctl",
    description: "Eight Sleep 控制",
    installMethods: [
      { method: "go", module: "github.com/eightctl/eightctl@latest" },
    ],
    useCNMirror: true,
  },
  "blu": {
    name: "blu",
    description: "BluOS CLI",
    installMethods: [
      { method: "npm", package: "@blucli/blu" },
    ],
    useCNMirror: true,
  },
  // clawdhub 已移除 - 技能市场统一使用 ClawdSkillsProxy 国内服务
  // 用户应使用 Web UI 的「技能市场」页面来浏览和安装技能

  // ============================================
  // 音乐类
  // ============================================
  "spotify_player": {
    name: "spotify_player",
    description: "Spotify 终端播放器",
    installMethods: [
      { method: "brew", formula: "spotify_player" },
      { method: "cargo", package: "spotify_player" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // AI/代码助手类
  // ============================================
  "codex": {
    name: "codex",
    description: "Codex CLI",
    installMethods: [
      { method: "npm", package: "@openai/codex" },
    ],
    useCNMirror: true,
  },
  "claude": {
    name: "claude",
    description: "Claude CLI",
    installMethods: [
      { method: "npm", package: "@anthropic-ai/claude-cli" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 截图/屏幕类
  // ============================================
  "peekaboo": {
    name: "peekaboo",
    description: "macOS 屏幕截图 CLI",
    installMethods: [
      { method: "brew", formula: "peekaboo" },
    ],
    // 香港服务器托管支持
    hkBinary: { repo: "steipete/peekaboo", platforms: ["darwin-arm64", "darwin-amd64"] },
  },
  "screencapture": {
    name: "screencapture",
    description: "macOS 内置截图 (无需安装)",
    installMethods: [],
  },

  // ============================================
  // Python 开发工具
  // ============================================
  "python": {
    name: "Python",
    description: "Python 解释器",
    installMethods: [
      { method: "brew", formula: "python@3.12" },
      { method: "winget", wingetId: "Python.Python.3.12" },
      { method: "scoop", scoopName: "python" },
    ],
  },
  "pip": {
    name: "pip",
    description: "Python 包管理器",
    installMethods: [],
  },
  "uv": {
    name: "uv",
    description: "快速 Python 包管理器",
    installMethods: [
      { method: "brew", formula: "uv" },
      { method: "pip", package: "uv" },
      { method: "winget", wingetId: "astral-sh.uv" },
    ],
    useCNMirror: true,
  },
  "pipx": {
    name: "pipx",
    description: "Python 应用隔离安装",
    installMethods: [
      { method: "brew", formula: "pipx" },
      { method: "pip", package: "pipx" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // Node.js 开发工具
  // ============================================
  "node": {
    name: "Node.js",
    description: "JavaScript 运行时",
    installMethods: [
      { method: "brew", formula: "node" },
      { method: "winget", wingetId: "OpenJS.NodeJS.LTS" },
      { method: "scoop", scoopName: "nodejs-lts" },
    ],
  },
  "npm": {
    name: "npm",
    description: "Node.js 包管理器",
    installMethods: [],
  },
  "pnpm": {
    name: "pnpm",
    description: "高效 Node.js 包管理器",
    installMethods: [
      { method: "npm", package: "pnpm" },
      { method: "brew", formula: "pnpm" },
      { method: "winget", wingetId: "pnpm.pnpm" },
    ],
    useCNMirror: true,
  },
  "yarn": {
    name: "yarn",
    description: "Yarn 包管理器",
    installMethods: [
      { method: "npm", package: "yarn" },
      { method: "brew", formula: "yarn" },
    ],
    useCNMirror: true,
  },
  "bun": {
    name: "bun",
    description: "快速 JavaScript 运行时",
    installMethods: [
      { method: "brew", formula: "bun" },
      { method: "npm", package: "bun" },
      { method: "winget", wingetId: "Oven-sh.Bun" },
    ],
  },

  // ============================================
  // Go 开发工具
  // ============================================
  "go": {
    name: "Go",
    description: "Go 语言编译器",
    installMethods: [
      { method: "brew", formula: "go" },
      { method: "winget", wingetId: "GoLang.Go" },
      { method: "scoop", scoopName: "go" },
    ],
  },

  // ============================================
  // Rust 开发工具
  // ============================================
  "rustup": {
    name: "rustup",
    description: "Rust 工具链管理器",
    installMethods: [
      { method: "brew", formula: "rustup-init" },
    ],
    useCNMirror: true,
  },
  "cargo": {
    name: "cargo",
    description: "Rust 包管理器",
    installMethods: [],
  },

  // ============================================
  // 网络工具类
  // ============================================
  "curl": {
    name: "curl",
    description: "HTTP 客户端 (通常已预装)",
    installMethods: [
      { method: "brew", formula: "curl" },
      { method: "winget", wingetId: "cURL.cURL" },
    ],
  },
  "wget": {
    name: "wget",
    description: "文件下载工具",
    installMethods: [
      { method: "brew", formula: "wget" },
      { method: "winget", wingetId: "GNU.Wget2" },
      { method: "scoop", scoopName: "wget" },
    ],
  },
  "httpie": {
    name: "httpie",
    description: "友好的 HTTP 客户端",
    installMethods: [
      { method: "brew", formula: "httpie" },
      { method: "pip", package: "httpie" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 压缩工具类
  // ============================================
  "unzip": {
    name: "unzip",
    description: "ZIP 解压工具",
    installMethods: [
      { method: "brew", formula: "unzip" },
    ],
  },
  "tar": {
    name: "tar",
    description: "归档工具 (通常已预装)",
    installMethods: [],
  },
  "7z": {
    name: "7-Zip",
    description: "压缩工具",
    installMethods: [
      { method: "brew", formula: "p7zip" },
      { method: "winget", wingetId: "7zip.7zip" },
      { method: "scoop", scoopName: "7zip" },
    ],
  },

  // ============================================
  // 数据库工具类
  // ============================================
  "sqlite3": {
    name: "SQLite",
    description: "SQLite 数据库",
    installMethods: [
      { method: "brew", formula: "sqlite" },
      { method: "winget", wingetId: "SQLite.SQLite" },
    ],
  },
  "mysql": {
    name: "MySQL",
    description: "MySQL 客户端",
    installMethods: [
      { method: "brew", formula: "mysql-client" },
    ],
  },
  "psql": {
    name: "PostgreSQL",
    description: "PostgreSQL 客户端",
    installMethods: [
      { method: "brew", formula: "libpq" },
    ],
  },
  "redis-cli": {
    name: "Redis CLI",
    description: "Redis 客户端",
    installMethods: [
      { method: "brew", formula: "redis" },
    ],
  },

  // ============================================
  // 容器工具类
  // ============================================
  "docker": {
    name: "Docker",
    description: "容器运行时",
    installMethods: [
      { method: "brew", formula: "docker" },
      { method: "winget", wingetId: "Docker.DockerDesktop" },
    ],
  },
  "kubectl": {
    name: "kubectl",
    description: "Kubernetes CLI",
    installMethods: [
      { method: "brew", formula: "kubernetes-cli" },
      { method: "winget", wingetId: "Kubernetes.kubectl" },
      { method: "scoop", scoopName: "kubectl" },
    ],
  },
  "helm": {
    name: "Helm",
    description: "Kubernetes 包管理器",
    installMethods: [
      { method: "brew", formula: "helm" },
      { method: "winget", wingetId: "Helm.Helm" },
      { method: "scoop", scoopName: "helm" },
    ],
  },

  // ============================================
  // 云服务 CLI
  // ============================================
  "aws": {
    name: "AWS CLI",
    description: "Amazon Web Services CLI",
    installMethods: [
      { method: "brew", formula: "awscli" },
      { method: "pip", package: "awscli" },
      { method: "winget", wingetId: "Amazon.AWSCLI" },
    ],
    useCNMirror: true,
  },
  "gcloud": {
    name: "Google Cloud SDK",
    description: "Google Cloud CLI",
    installMethods: [
      { method: "brew", formula: "google-cloud-sdk" },
    ],
  },
  "az": {
    name: "Azure CLI",
    description: "Microsoft Azure CLI",
    installMethods: [
      { method: "brew", formula: "azure-cli" },
      { method: "pip", package: "azure-cli" },
      { method: "winget", wingetId: "Microsoft.AzureCLI" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // PDF/文档处理类
  // ============================================
  "pandoc": {
    name: "Pandoc",
    description: "文档格式转换",
    installMethods: [
      { method: "brew", formula: "pandoc" },
      { method: "winget", wingetId: "JohnMacFarlane.Pandoc" },
      { method: "scoop", scoopName: "pandoc" },
    ],
  },
  "pdftotext": {
    name: "poppler",
    description: "PDF 文本提取",
    installMethods: [
      { method: "brew", formula: "poppler" },
    ],
  },
  "wkhtmltopdf": {
    name: "wkhtmltopdf",
    description: "HTML 转 PDF",
    installMethods: [
      { method: "brew", formula: "wkhtmltopdf" },
    ],
  },

  // ============================================
  // 编辑器/IDE
  // ============================================
  "code": {
    name: "VS Code",
    description: "Visual Studio Code CLI",
    installMethods: [
      { method: "brew", formula: "visual-studio-code" },
      { method: "winget", wingetId: "Microsoft.VisualStudioCode" },
      { method: "scoop", scoopName: "vscode" },
    ],
  },
  "vim": {
    name: "Vim",
    description: "文本编辑器",
    installMethods: [
      { method: "brew", formula: "vim" },
    ],
  },
  "nvim": {
    name: "Neovim",
    description: "现代 Vim",
    installMethods: [
      { method: "brew", formula: "neovim" },
      { method: "winget", wingetId: "Neovim.Neovim" },
      { method: "scoop", scoopName: "neovim" },
    ],
  },

  // ============================================
  // 浏览器自动化
  // ============================================
  "playwright": {
    name: "Playwright",
    description: "浏览器自动化",
    installMethods: [
      { method: "npm", package: "playwright" },
      { method: "pip", package: "playwright" },
    ],
    useCNMirror: true,
  },
  "puppeteer": {
    name: "Puppeteer",
    description: "Chrome 自动化",
    installMethods: [
      { method: "npm", package: "puppeteer" },
    ],
    useCNMirror: true,
  },
  "selenium": {
    name: "Selenium",
    description: "浏览器自动化",
    installMethods: [
      { method: "pip", package: "selenium" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 测试工具
  // ============================================
  "jest": {
    name: "Jest",
    description: "JavaScript 测试框架",
    installMethods: [
      { method: "npm", package: "jest" },
    ],
    useCNMirror: true,
  },
  "pytest": {
    name: "pytest",
    description: "Python 测试框架",
    installMethods: [
      { method: "pip", package: "pytest" },
      { method: "uv", package: "pytest" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 代码质量工具
  // ============================================
  "eslint": {
    name: "ESLint",
    description: "JavaScript Linter",
    installMethods: [
      { method: "npm", package: "eslint" },
    ],
    useCNMirror: true,
  },
  "prettier": {
    name: "Prettier",
    description: "代码格式化",
    installMethods: [
      { method: "npm", package: "prettier" },
    ],
    useCNMirror: true,
  },
  "black": {
    name: "Black",
    description: "Python 代码格式化",
    installMethods: [
      { method: "pip", package: "black" },
      { method: "uv", package: "black" },
    ],
    useCNMirror: true,
  },
  "ruff": {
    name: "Ruff",
    description: "快速 Python Linter",
    installMethods: [
      { method: "pip", package: "ruff" },
      { method: "uv", package: "ruff" },
      { method: "brew", formula: "ruff" },
    ],
    useCNMirror: true,
  },

  // ============================================
  // 其他实用工具
  // ============================================
  "tree": {
    name: "tree",
    description: "目录树显示",
    installMethods: [
      { method: "brew", formula: "tree" },
      { method: "winget", wingetId: "GNU.Tree" },
    ],
  },
  "htop": {
    name: "htop",
    description: "进程监控",
    installMethods: [
      { method: "brew", formula: "htop" },
    ],
  },
  "ncdu": {
    name: "ncdu",
    description: "磁盘使用分析",
    installMethods: [
      { method: "brew", formula: "ncdu" },
    ],
  },
  "tldr": {
    name: "tldr",
    description: "简化的 man 手册",
    installMethods: [
      { method: "npm", package: "tldr" },
      { method: "pip", package: "tldr" },
      { method: "brew", formula: "tldr" },
    ],
    useCNMirror: true,
  },
  "tokei": {
    name: "tokei",
    description: "代码统计工具",
    installMethods: [
      { method: "brew", formula: "tokei" },
      { method: "cargo", package: "tokei" },
    ],
    useCNMirror: true,
  },
  "hyperfine": {
    name: "hyperfine",
    description: "命令行基准测试",
    installMethods: [
      { method: "brew", formula: "hyperfine" },
      { method: "cargo", package: "hyperfine" },
    ],
    useCNMirror: true,
  },
  "asciinema": {
    name: "asciinema",
    description: "终端录制",
    installMethods: [
      { method: "brew", formula: "asciinema" },
      { method: "pip", package: "asciinema" },
    ],
    useCNMirror: true,
  },
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检测是否应该使用国内镜像
 */
export function shouldUseCNMirror(): boolean {
  // 优先检查环境变量
  if (process.env.CLAWDBOT_USE_CN_MIRROR === "1") return true;
  if (process.env.CLAWDBOT_USE_CN_MIRROR === "0") return false;
  
  // 检查区域配置
  if (process.env.CLAWDBOT_REGION === "cn") return true;
  
  // 检查时区（粗略判断）
  const tz = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  
  // IANA 时区格式（Linux/macOS）
  if (tz.includes("Shanghai") || tz.includes("Beijing") || tz.includes("Asia/Chongqing")) {
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
  return PACKAGE_MANAGER_MIRRORS.npm.primary;  // 淘宝镜像
}

/**
 * 获取 pip 镜像 URL（仅国内源）
 */
export function getPipMirrorUrl(): string {
  return PACKAGE_MANAGER_MIRRORS.pip.primary;  // 清华镜像
}

/**
 * 获取 Go 代理配置（仅国内源）
 */
export function getGoProxy(): string {
  return PACKAGE_MANAGER_MIRRORS.go.primary;  // 七牛云
}

/**
 * 获取 Node.js 二进制下载 URL（仅国内源）
 */
export function getNodeBinaryMirror(): string {
  return BINARY_DOWNLOAD_MIRRORS.node.primary;  // 淘宝镜像
}

/**
 * 获取 Go 二进制下载 URL（仅国内源）
 */
export function getGoBinaryMirror(): string {
  return BINARY_DOWNLOAD_MIRRORS.goBinary.primary;  // Go语言中文网
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
 * ghproxy.cn → gh.con.sh → gh.ddlc.top
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
 * 获取 pip 镜像 URL 列表（仅国内源）
 * 清华 → 阿里云 → 中科大
 */
export function getPipMirrors(): string[] {
  return [
    PACKAGE_MANAGER_MIRRORS.pip.primary,   // 清华
    PACKAGE_MANAGER_MIRRORS.pip.fallback,  // 阿里云
    PACKAGE_MANAGER_MIRRORS.pip.tertiary,  // 中科大
  ].filter(Boolean);
}

/**
 * 获取 npm 镜像 URL 列表（仅国内源）
 * 淘宝 → 腾讯云 → 华为云
 */
export function getNpmMirrors(): string[] {
  return [
    PACKAGE_MANAGER_MIRRORS.npm.primary,   // 淘宝
    PACKAGE_MANAGER_MIRRORS.npm.fallback,  // 腾讯云
    PACKAGE_MANAGER_MIRRORS.npm.tertiary,  // 华为云
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
          command: ["winget", "install", "--id", method.wingetId, "-e", "--silent", "--accept-package-agreements"],
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
            ? ["npm", "install", "-g", method.package, "--registry", PACKAGE_MANAGER_MIRRORS.npm.primary]
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
          ? ["npm", "install", "-g", method.package, "--registry", PACKAGE_MANAGER_MIRRORS.npm.primary]
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
          ? ["uv", "tool", "install", method.package, "--index-url", PACKAGE_MANAGER_MIRRORS.pip.primary]
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
export function getToolInfo(toolName: string): typeof CLI_TOOL_MIRRORS[string] | undefined {
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
  const toolsWithCNMirror = Object.values(CLI_TOOL_MIRRORS).filter(t => t.useCNMirror).length;
  
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
    // 1. ClawdSkillsProxy 托管 (最可靠)
    // 格式: /api/binaries/signal-cli/{version}/{filename}
    urls.push(`${CLAWDSKILLSPROXY_CONFIG.baseUrl}${CLAWDSKILLSPROXY_CONFIG.endpoints.signalCliDownload}/${version}/${fileName}`);
    
    // 2. GitHub 代理 (备用，可能 404)
    const githubUrl = `https://github.com/AsamK/signal-cli/releases/download/v${version}/${fileName}`;
    urls.push(...getGitHubProxyUrls(githubUrl));
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
    urls.push(`${CLAWDSKILLSPROXY_CONFIG.baseUrl}${CLAWDSKILLSPROXY_CONFIG.endpoints.signalCliLatest}`);
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
    "Authorization": `Bearer ${CLAWDSKILLSPROXY_CONFIG.token}`,
    "User-Agent": "clawdbot",
  };
}

// ============================================================================
// 香港二进制托管服务器
// ============================================================================

/**
 * 检查工具是否在香港服务器托管
 */
export function isToolHostedOnHK(toolName: string): boolean {
  // 使用类型断言避免 as const 导致的类型约束
  const tools: readonly string[] = BINARY_DOWNLOAD_MIRRORS.hkBinaries.tools;
  return tools.includes(toolName);
}

/**
 * 获取香港服务器上工具的版本信息 URL
 * @param toolName 工具名 (如 "ordercli")
 * @returns 版本信息 URL
 */
export function getHKBinaryVersionUrl(toolName: string): string {
  return `${BINARY_DOWNLOAD_MIRRORS.hkBinaries.baseUrl}/${toolName}/version.txt`;
}

/**
 * 获取香港服务器上工具的元信息 URL
 * @param toolName 工具名 (如 "ordercli")
 * @returns 元信息 URL
 */
export function getHKBinaryMetadataUrl(toolName: string): string {
  return `${BINARY_DOWNLOAD_MIRRORS.hkBinaries.baseUrl}/${toolName}/metadata.json`;
}

/**
 * 获取香港服务器上工具的下载 URL
 * @param toolName 工具名 (如 "ordercli")
 * @param version 版本号 (如 "0.1.0")
 * @param platform 平台标识 (如 "darwin-arm64", "darwin-amd64", "linux-amd64", "windows-amd64")
 * @returns 下载 URL
 */
export function getHKBinaryDownloadUrl(toolName: string, version: string, platform: string): string {
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
  
  if (useCN && isToolHostedOnHK(toolName)) {
    // 1. 香港服务器 (国内最快)
    urls.push(getHKBinaryDownloadUrl(toolName, version, platform));
  }
  
  // 2. GitHub 代理 (备用)
  if (githubRepo && useCN) {
    // 尝试常见的 Release 文件名格式
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
  
  // 3. GitHub 原始地址 (国外)
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
