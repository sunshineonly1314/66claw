# Skills 全量审计 Part 2 — 缺口分析 (C/D 类工具)

---

## 七、C 类 — 有 Windows 版但当前无 CN 安装路径 (需补充)

### C1: brew-only 但上游有 Windows 二进制 — 按大小决定放哪

#### 小包 (<10 MB) → 打进安装包 bundled-bins

| 二进制 | 使用技能数 | Windows 大小 | 来源 | 操作 |
|--------|-----------|-------------|------|------|
| **openhue** | 1 | 3.7 MB | openhue/openhue-cli releases | setup.iss 新增 + SKILL.md 加 download spec |
| **spogo** | 2 | 5.3 MB | steipete/spogo releases | setup.iss 新增 + SKILL.md 加 download spec |
| **jira** | 1 | 6.9 MB | ankitpokhrel/jira-cli releases | setup.iss 新增 + SKILL.md 加 download spec |

> 与已有 4 个工具合并后，bundled-bins 总计 7 个 .exe，~36 MB。

#### 大包 (>10 MB) → ClawdSkillsProxy 代理

| 二进制 | 使用技能数 | Windows 大小 | 来源 | 操作 |
|--------|-----------|-------------|------|------|
| **gh** (GitHub CLI) | 1 | 13.2 MB | cli/cli releases | cn-mirrors.ts 加端点 + SKILL.md 加 download spec |
| **himalaya** | 1 | 12.8 MB | pimalaya/himalaya releases | 同上 |
| **yt-dlp** | 2 | 17.5 MB | yt-dlp/yt-dlp releases | 同上 |
| **uv** | 16 | 20.8 MB | astral-sh/uv releases | 同上 (cn-mirrors.ts 已有 uv 镜像，需打通) |
| **rclone** | 1 | 26.8 MB | rclone/rclone releases | 同上 |

> ClawdSkillsProxy 新增 5 个端点，合计 ~91 MB。

#### 特殊处理

| 二进制 | 使用技能数 | 说明 | 操作 |
|--------|-----------|------|------|
| **op** (1Password CLI) | 1 | 官方 .msi 安装器，非单文件二进制 | 不打包，用户手动安装 (developer.1password.com) |
| **spotify** | 1 | brew cask (桌面 App，非 CLI 工具) | 不打包，用户手动安装 |
| **whisper** (openai-whisper) | 2 | Python 包，pip install | SKILL.md 加 pip/uv spec → 清华 pypi |
| **gemini** | 3 | brew gemini-cli，未确认 npm/pip 方案 | 待查 |
| **obsidian-cli** | 2 | brew yakitrak/yakitrak，未确认 Release | 待查 |
| **codexmonitor** | 1 | brew only，未确认 Windows 版 | 待查 |
| **mcd-cn** | 1 | brew only，未确认 Windows 版 | 待查 |

### C2: 需要 uv/python3 但 SKILL.md 缺 Windows install spec

| 依赖 | 使用技能数 | Windows 大小 | 说明 | 修复建议 |
|------|-----------|-------------|------|---------|
| **uv** | 16 | 20.8 MB | `requires.bins: ["uv"]` 但 install 只有 brew | ClawdSkillsProxy 代理 (cn-mirrors.ts 已有 uv 镜像 URL，需在 LARGE_PACKAGE_PROXY_MAP 中添加) |
| **python3** | 23 | ~30 MB (installer) | `requires.bins: ["python3"]` 但通常无 install spec | 不打包；在 skills-install.ts 中 `python3` 缺失时提示安装 python.org |

> **这是影响面最大的缺口**: uv (16 技能) + python3 (23 技能) 合计影响 39 个技能。
> uv 走 ClawdSkillsProxy 自动下载；python3 是运行时环境，提示用户安装。

### C3: 无 install spec 的专有工具 (用户需手动安装)

以下工具有 `requires.bins` 但完全没有 install spec（也不属于系统工具）：

| 二进制 | 使用技能数 | 说明 | 可行安装方式 | 是否值得加 spec |
|--------|-----------|------|-------------|----------------|
| **bw** (Bitwarden CLI) | 2 | 密码管理 | npm @bitwarden/cli | ✅ (已有 npm spec) |
| **tldr** | 1 | 命令帮助 | npm install -g tldr | 低 (小众) |
| **vercel** | 1 | Vercel 部署 | npm install -g vercel | 低 (小众) |
| **elevenlabs** | 1 | TTS API CLI | pip install elevenlabs | 低 (需 API key) |
| **gkeep** | 1 | Google Keep | pip install gkeep | 低 (小众) |
| **dcli** (Dashlane) | 1 | 密码管理 | Dashlane 官方 CLI | 低 |
| **lms** (LM Studio) | 1 | LLM 本地 | 官方 CLI | 低 |
| **nomad** | 1 | HashiCorp Nomad | HashiCorp 官方 | 低 |
| **pet** | 1 | 代码片段管理 | go install / GitHub Release | 低 |
| **rbw** | 1 | Bitwarden Rust | cargo install | 低 |
| **rclone** | 1 | 云存储同步 | 已归入 C1 (ClawdSkillsProxy) | 已处理 ✅ |
| **solana** | 2 | 区块链 CLI | Solana 官方 | 低 (Web3) |
| **spl-token** | 1 | Solana Token | 随 solana | 低 |
| **starlink** | 1 | 卫星网络 | cargo install | 低 |
| **clippy** | 1 | 剪贴板 | 不明 | 低 |
| **fitbit** | 1 | 健康数据 | 不明 | 低 |
| **telegram** | 1 | Telegram CLI | 不明 | 低 |
| **timesheet** | 1 | 时间表 | 不明 | 低 |
| **workout** | 1 | 运动追踪 | 不明 | 低 |

> 以上工具均为 **1-2 个技能使用的小众工具**，暂不处理。用户使用这些技能时会在 UI 上看到安装提示。

### C4: 有 package.json 的技能 (需 npm install)

64 个技能包含 `package.json`，安装后需要 `npm install` 运行 `node_modules` 依赖。
这些在 CN 通过 npmmirror 镜像可覆盖 ✅。

关键技能: agent-registry, brave-search, context7, discord-voice, imap-email, reddit-search, relay-to-agent, verify-on-browser, x-trends 等。

---

## 八、D 类 — 工具本身不支持 Windows (非下载通道问题)

> **重要**: D 类工具的「平台限制」**不是下载通道的问题，而是工具本身只能在 macOS/Linux 上运行**。
> 这些工具调用了特定平台的私有 API、数据库或系统功能，在 Windows 上即使安装了也无法工作。
> 这是工具自身的设计决定，不是我们能修复的。

### D1: macOS 私有 API 依赖 — 工具依赖 Apple 系统框架，Windows 上无法运行

| 二进制 | 技能 | 为什么只能在 macOS |
|--------|------|------------------|
| **memo** | apple-notes | 通过 AppleScript 读写 Apple Notes 数据库，Windows 无 Apple Notes |
| **remindctl** | apple-reminders | 调用 macOS EventKit API 操作 Reminders.app |
| **imsg** | imsg | 读取 macOS iMessage 数据库 (`~/Library/Messages/chat.db`) |
| **peekaboo** | peekaboo | 调用 macOS ScreenCaptureKit 屏幕捕获框架 |
| **grizzly** | bear-notes | 读取 macOS Bear 笔记 SQLite 数据库 |
| **things** | things-mac | 调用 macOS Things3.app URL scheme |
| **atvremote** | apple-media | 控制 Apple TV，使用 macOS pyatv 框架 |
| **icloud** | icloud-findmy | 访问 macOS iCloud Keychain 和 FindMy 数据 |
| **drafts** | drafts | macOS/iOS Drafts app 专用 CLI |
| **xcrun** | ios-simulator | Xcode 命令行工具，macOS 开发环境专用 |
| **codexbar** | model-usage | SKILL.md 声明 `"os":["darwin"]`，macOS 专用 |

### D2: Linux/Unix 专属系统工具 — 依赖 Unix 内核或子系统

| 二进制 | 技能 | 为什么不支持 Windows |
|--------|------|-------------------|
| **tmux** | tmux, idea | Unix 终端多路复用器，依赖 Unix PTY 和信号机制 |
| **calcurse** | calcurse | 基于 ncurses 的 TUI 日历，无 Windows 原生构建 |
| **vdirsyncer/khal** | caldav-calendar | Python + Linux vdirsyncer 依赖 |
| **xvfb-run** | smalltalk | Linux 虚拟 X11 framebuffer，Windows/macOS 无此概念 |
| **nix** | nix-mode | Nix 包管理器，依赖 Unix 文件系统和守护进程 |
| **lp/lpstat/lpadmin** | printer | CUPS 打印系统 CLI，macOS/Linux 专用 |
| **rsync** | clawdbot-update-plus | Unix 文件同步工具，Windows 需 WSL |
| **bc** | raindrop | Unix 任意精度计算器，Windows 无原生版 |

### D3: 上游开发者未发布 Windows 版 — 不是平台限制，是发布策略问题

| 二进制 | 技能 | 说明 |
|--------|------|------|
| **summarize** | summarize | steipete/summarize v0.10.0 只编译了 macOS arm64，理论上可以出 Windows 版但作者没出 |
| **songsee** | songsee | steipete/songsee v0.1.0 Release 零 asset，任何平台都没有二进制 |
| **td** (todoist-rs) | todoist-rs | brew only，上游无 Windows 构建 |
| **mlx_whisper** | mlx-whisper, gettr-transcribe-summarize | Apple MLX 框架专用，仅 Apple Silicon (M1+) |
| **parakeet-mlx** | parakeet-mlx | 同上，依赖 Apple MLX |

### D3 总结

D 类共 **21 种二进制**，影响 **~35 个技能**。这些技能在 Windows 上无法使用，应该在 UI 中标记 `"os":["darwin"]` 或 `"os":["linux"]` 让 Windows 用户不会困惑。

---

## 九、按技能维度 — 306 个有依赖的技能覆盖状态

### 统计

| 状态 | 技能数 | 占比 (306个有依赖的) |
|------|--------|-------------------|
| ✅ 全覆盖 (所有 bins 在 Windows CN 可获取) | ~140 | 46% |
| ⚠️ 部分覆盖 (主要 bins 可获取，次要缺) | ~60 | 20% |
| ❌ macOS/Linux only (工具不支持 Windows) | ~35 | 11% |
| ⚠️ 依赖系统工具 (curl/jq, 用户通常有) | ~50 | 16% |
| ❌ 完全无 Windows 路径 (小众工具) | ~21 | 7% |

### 按依赖链分析 — 最常见的依赖组合

| 依赖组合 | 技能数 | CN Windows 状态 |
|----------|--------|----------------|
| curl + jq | ~45 | ✅ 系统工具 |
| node (alone) | ~20 | ✅ 安装包预置 |
| python3 (alone) | ~15 | ⚠️ 需用户安装 Python |
| uv (alone) | ~10 | ⚠️ 修复后 → ClawdSkillsProxy ✅ |
| curl only | ~10 | ✅ 系统内置 |
| mcporter | 8 | ✅ npm (npmmirror) |
| ffmpeg (+ others) | 6 | ✅ ClawdSkillsProxy |
| 单个 brew-only 工具 | ~20 | 修复后: bundled / ClawdSkillsProxy ✅ |
| go install 工具 | ~15 | ✅ goproxy.cn |
| npm 生态工具 | ~15 | ✅ npmmirror |

---

## 十、64 个 package.json 技能详情

这些技能包含 Node.js 项目依赖，安装后需 `npm install` 下载 node_modules。

| 类别 | 技能 | npm install 状态 |
|------|------|-----------------|
| 浏览器自动化 | verify-on-browser, verify-on-browser-1-0-0, ui-audit | npmmirror ✅ |
| 搜索工具 | brave-search, search-x, context7, web-search-plus | npmmirror ✅ |
| 社交媒体 | x-trends, x-trends-dev, reddit-search, search-reddit | npmmirror ✅ |
| 通讯 | discord-voice, imap-email, feishu-bridge | npmmirror ✅ |
| API 客户端 | clawddocs, relay-to-agent, playground | npmmirror ✅ |
| 工具 | simple-backup, personas, sports-ticker | npmmirror ✅ |
| 其他 | 30+ 更多... | npmmirror ✅ |

**状态**: 全部通过 npmmirror 可下载 ✅
