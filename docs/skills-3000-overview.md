# Clawdbot Skills 3000+ 全景总览

> 生成时间: 2026-02-09 | 数据来源: skills-merged (3,061 skills) + skills-awesome (2,901 skills)
> 质量评估管线版本: 1.1.0 | Schema v2

---

## 目录

1. [总体概况](#1-总体概况)
2. [数据来源与合并策略](#2-数据来源与合并策略)
3. [质量评估体系](#3-质量评估体系)
4. [中国大陆可用性分析](#4-中国大陆可用性分析)
5. [平台生态命名空间](#5-平台生态命名空间)
6. [按操作系统分类](#6-按操作系统分类)
7. [按功能大类详细分类](#7-按功能大类详细分类)
   - 7.1 [AI / LLM 工具](#71-ai--llm-工具)
   - 7.2 [开发者工具](#72-开发者工具)
   - 7.3 [浏览器自动化](#73-浏览器自动化)
   - 7.4 [搜索与研究](#74-搜索与研究)
   - 7.5 [Agent 智能体生态](#75-agent-智能体生态)
   - 7.6 [记忆与知识管理](#76-记忆与知识管理)
   - 7.7 [社交与通讯](#77-社交与通讯)
   - 7.8 [生产力与办公](#78-生产力与办公)
   - 7.9 [多媒体处理](#79-多媒体处理)
   - 7.10 [智能家居与IoT](#710-智能家居与iot)
   - 7.11 [金融与加密货币](#711-金融与加密货币)
   - 7.12 [安全与合规](#712-安全与合规)
   - 7.13 [数据库与存储](#713-数据库与存储)
   - 7.14 [DevOps 与基础设施](#714-devops-与基础设施)
   - 7.15 [健康与生活方式](#715-健康与生活方式)
   - 7.16 [内容创作与营销](#716-内容创作与营销)
   - 7.17 [教育与学术](#717-教育与学术)
   - 7.18 [游戏与娱乐](#718-游戏与娱乐)
8. [重复/变体群组分析](#8-重复变体群组分析)
9. [评估排行榜 (已评审 27 个)](#9-评估排行榜)

---

## 1. 总体概况

| 指标 | 数值 |
|------|------|
| skills-merged 目录总数 | 3,061 |
| skills-awesome 目录总数 | 2,901 |
| 去重后实际独立技能 | ~2,525 |
| 带 SKILL.md 的技能 | 3,051 |
| 已通过质量评估管线 | 27 (完整 3 层评审) |
| 评估等级分布 | S: 0 / A: 22 / B: 5 |
| 中国大陆被屏蔽 (已评估) | ~48% (13/27) |
| 测试/占位技能 | ~30 个 |

### SKILL.md 标准格式

每个技能由一个 `SKILL.md` 文件定义，格式为 **YAML frontmatter + Markdown 正文**：

```yaml
---
name: skill-name
description: 技能的一句话描述
homepage: https://github.com/xxx/xxx
metadata:
  clawdbot:
    emoji: "🔧"
    requires:
      bins: ["curl", "jq"]       # 必须安装的命令行工具
      env: ["API_KEY"]            # 必须设置的环境变量
    os: ["darwin", "linux"]       # 支持的操作系统
    install:                      # 安装方式
      - kind: brew
        formula: "tap/tool"
      - kind: download
        url: "https://..."
---

# Skill Name
正文：使用说明、命令列表、示例等
```

---

## 2. 数据来源与合并策略

| 来源 | 数量 | 说明 |
|------|------|------|
| **Local** (本地开发) | 54 | 核心手工开发、经过完整评审的技能 |
| **Mirror** (镜像同步) | 940 | 从上游社区镜像同步的技能 |
| **Awesome** (GitHub 索引) | 2,067 | 从 awesome-mcp-servers 等开源索引批量下载 |
| **合计** | **3,061** | 合并后的总量 |

- 下载索引 (`skills-awesome/index.json`): 2,999 个索引条目, 2,903 成功下载, 96 个 404
- 合并策略: Local > Mirror > Awesome (同名技能优先使用本地版本)
- 合并元数据记录在 `skills-merged/merge-metadata.json`

---

## 3. 质量评估体系

采用 **3 层评估管线**：

### Layer 1: 结构验证
- 检查 SKILL.md 是否存在、frontmatter 格式是否正确
- 验证 metadata.requires 字段完整性
- 输出: pass / fail

### Layer 2: AI 安全扫描 (Qwen3-max)
- 检测 prompt injection、恶意命令、凭据泄露风险
- 安全置信度评分 (0-1)
- 输出: safe / review / reject

### Layer 3: 5 维质量评分 + 中文翻译
- **实用性** (utility): 1-10
- **完整性** (completeness): 1-10
- **技术质量** (technicalQuality): 1-10
- **可维护性** (maintenance): 1-10
- **中国兼容性** (cnCompatibility): 1-10
- 综合评分 → 分级: **S** (精英) / **A** (推荐) / **B** (可选)
- 同时输出中文翻译版 SKILL.md

---

## 4. 中国大陆可用性分析

### 已评估技能的 CN 状态

| 状态 | 数量 | 技能列表 |
|------|------|----------|
| **可用** | 14 | apple-notes, apple-reminders, blogwatcher, blucli, himalaya, model-usage, nano-pdf, openhue, sherpa-onnx-tts, skill-creator, songsee, things-mac, video-frames, weather |
| **被屏蔽/受限** | 13 | 1password, bluebubbles, gemini, gifgrep, gog, openai-image-gen, openai-whisper, oracle, slack, spotify-player, trello, voice-call, github(不稳定) |

### CN 替代方案建议

| 被屏蔽技能 | 国内替代方案 |
|------------|-------------|
| Gemini | 通义千问、文心一言、Kimi |
| OpenAI 系列 | 通义万相 (图像)、funasr/SenseVoice (语音) |
| Slack | 飞书、钉钉 |
| Spotify | 网易云音乐 CLI |
| Trello | 飞书多维表格、腾讯云开发 |
| Google Workspace (gog) | 阿里钉钉 CLI、腾讯企业邮 |
| 1Password | HashiCorp Vault、阿里云 KMS、腾讯云 HSM |
| Voice Call (Twilio) | 阿里云语音服务、腾讯云语音通知 |

### CN 特色技能

| 技能名 | 功能 | 平台 |
|--------|------|------|
| wechat | 微信本地 SQLite 数据读取 (联系人/聊天/收藏) | macOS, Windows |
| zhihu | 知乎圈子 Bot (发布/点赞/评论), 10 QPS | 全平台 |
| zhipu-web-search | 智谱 AI 搜索 (标准/Pro/搜狗/夸克 4引擎) | 全平台 |
| baidu-search | 百度搜索接口 | 全平台 |
| baidu-scholar-search | 百度学术搜索 | 全平台 |
| aliyun-search | 阿里云搜索服务 | 全平台 |
| xiaohongshu | 小红书接口 | 全平台 |
| weread | 微信读书数据 | 全平台 |
| wecom | 企业微信集成 | 全平台 |
| mijia | 米家智能家居控制 | 全平台 |
| feishu-memory-recall | 飞书记忆与回忆 | 全平台 |
| mcd-cn | 中国区特定配置 | 全平台 |
| tiangong-* | 天工系列 (NotebookLM CLI / WPS PPT / Word) | 全平台 |

---

## 5. 平台生态命名空间

Clawdbot 生态包含多个品牌/平台命名空间：

| 命名空间 | 数量 | 定位 |
|----------|------|------|
| **claw-*** | 117 | Claw 核心生态工具 (安全、同步、邮件、浏览器等) |
| **clawd-*** | 43 | Clawdbot 本体功能 (文件系统、安全检查、日志、构建等) |
| **molt-*** | 67 | Molt 社区生态 (社交、游戏、媒体、安全审计等) |
| **openclaw-*** | 20 | OpenClaw 开放平台 (Nextcloud、安全、迁移等) |
| **agent-*** | 136 | Agent 智能体框架 (浏览器、邮件、编排、身份等) |

### claw-* 代表性技能

| 技能 | 功能 |
|------|------|
| clawbrowser | Playwright CLI 浏览器控制 |
| clawsec-suite | 安全套件管理器 |
| clawmail / clawemail | 邮件客户端 |
| claw-swarm | 多 Agent 编排 |
| clawguard | 安全防护 |
| clawscan | 安全扫描 |
| clawdbot-filesystem | 高级文件系统操作 |
| clawdbot-security-suite | 安全套件 |

---

## 6. 按操作系统分类

### 全平台通用 (Windows + macOS + Linux) — 约 85%

大部分技能基于 CLI 工具 (curl, python3, node) 或 REST API，天然跨平台。

### macOS 专属

| 技能 | 功能 | 依赖 |
|------|------|------|
| apple-notes | Apple Notes 增删改查 | AppleScript |
| apple-reminders | Apple 提醒事项管理 | AppleScript |
| things-mac | Things 3 任务管理 | Things 3 app |
| apple-mail / apple-mail-search | Apple Mail 搜索 | AppleScript |
| spotify (applescript) | Spotify macOS 控制 | AppleScript |
| bear-notes | Bear 笔记管理 | Bear app |
| model-usage | CodexBar 成本分析 | codexbar (Homebrew) |
| mac-tts / callmac | macOS 原生 TTS | say 命令 |
| omnifocus | OmniFocus 任务管理 | OmniFocus app |
| shortcuts-skill | macOS 快捷指令 | Shortcuts app |
| mactop | macOS 系统监控 | macOS |
| camsnap | 摄像头拍照 | imagesnap |

### Windows 专属

| 技能 | 功能 | 依赖 |
|------|------|------|
| windows-control | 完整 Windows 桌面控制 (鼠标/键盘/截图/窗口) | Python 3.11+, pyautogui |
| windows-cli | Windows 命令行工具集 | PowerShell |
| everything-search | Everything 文件搜索集成 | Everything app |
| sapi-tts | Windows SAPI 语音合成 | Windows |
| win-mouse-native | Windows 鼠标原生控制 | Windows |

### Linux 专属

| 技能 | 功能 | 依赖 |
|------|------|------|
| camoufox-stealth-browser | C++ 级反检测浏览器 | distrobox (Linux) |
| pihole | Pi-hole DNS 广告过滤管理 | Pi-hole |
| proxmox / proxmox-full | Proxmox 虚拟化管理 | Proxmox VE |
| niri-ipc | Niri (Wayland) 窗口管理器 IPC | Linux + Wayland |

---

## 7. 按功能大类详细分类

---

### 7.1 AI / LLM 工具

与 AI 模型交互、调用 LLM API 的技能。**约 50+ 个技能**。

#### 大模型对话与推理

| 技能 | 功能详述 | 依赖 | 平台 | CN |
|------|----------|------|------|----|
| **gemini** | Google Gemini CLI，支持一键问答、摘要和生成 | gemini CLI | 全平台 | 屏蔽 (替代: 通义千问/文心一言/Kimi) |
| **openai-chat** | OpenAI Chat API 对话接口 | curl, OPENAI_API_KEY | 全平台 | 屏蔽 |
| **claude** | Claude API / Claude Code 接口 | claude CLI | 全平台 | 受限 |
| **gpt** | GPT 系列模型调用 | OPENAI_API_KEY | 全平台 | 屏蔽 |
| **xai** | X.AI (Grok) 模型接口 | XAI_API_KEY | 全平台 | 受限 |
| **ollama-local** | 本地 Ollama LLM 推理 | ollama | 全平台 | 可用 |
| **llm** | 通用 LLM 调用封装 | 多种 | 全平台 | 依赖后端 |
| **llm-council** | 多模型投票/共识 | 多个 API Key | 全平台 | 依赖后端 |
| **llmrouter** | LLM 路由器 (多模型切换) | 多种 | 全平台 | 依赖后端 |
| **model-router** | 模型路由选择 | 配置 | 全平台 | 可用 |
| **smart-model-switching** | 智能模型切换 | 配置 | 全平台 | 可用 |

#### AI 图像生成

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **openai-image-gen** | OpenAI GPT Image / DALL-E 2/3 批量生成，自动 HTML 画廊预览 | curl, OPENAI_API_KEY | 屏蔽 (替代: 通义万相/文心一格) |
| **nvidia-image-gen** | NVIDIA 图像生成 | NVIDIA API | 受限 |
| **seedream-image-gen** | Seedream 图像生成 | API | 可用 |
| **qwen-image** | 通义千问图像生成 | QWEN_API_KEY | 可用 |
| **fal-ai / falai** | Fal.ai 图像生成平台 | FAL_API_KEY | 受限 |
| **pollinations** | Pollinations 开源图像生成 | API | 可用 |
| **sora-video-gen** | OpenAI Sora 视频生成 | OPENAI_API_KEY | 屏蔽 |
| **ai-video-gen** | AI 视频生成通用接口 | 多种 | 依赖后端 |

#### AI 语音处理

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **openai-tts** | OpenAI TTS (tts-1/tts-1-hd), 6种声音, mp3/opus/aac/flac/wav | curl, OPENAI_API_KEY | 屏蔽 |
| **sherpa-onnx-tts** | 完全离线本地 TTS, ONNX 模型, 多声音, 隐私友好 | 预下载的运行时和模型 | 全平台可用 (评分 8.2) |
| **openai-whisper** | 本地 Whisper 语音识别, 无需API Key, 多格式输出 | whisper CLI | 可用 (本地运行) |
| **piper-tts** | Piper 本地 TTS | piper CLI | 可用 |
| **mac-tts** | macOS 原生 say 命令 TTS | macOS | macOS |
| **sapi-tts** | Windows SAPI TTS | Windows | Windows |
| **minimax-tts** | MiniMax TTS | MINIMAX_API_KEY | 可用 |
| **qwen-tts** | 通义千问 TTS | QWEN_API_KEY | 可用 |
| **mlx-stt** | MLX 本地语音识别 | mlx (Apple Silicon) | macOS |
| **mlx-whisper** | MLX Whisper 本地推理 | mlx (Apple Silicon) | macOS |
| **parakeet-stt / parakeet-mlx** | Parakeet 语音识别 | mlx | macOS |
| **voice-transcribe** | 语音转文字 | 多种后端 | 全平台 |
| **transcribe / transcribee** | 通用转录工具 | 多种 | 全平台 |

#### AI 辅助编程

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **coding-agent** | 后台运行编程 Agent (Codex/Claude Code/OpenCode/Pi), PTY模式, git worktree, PR审查 | claude/codex/opencode/pi | 依赖后端 |
| **multi-coding-agent** | 多编程Agent并行执行 | 多种 | 依赖后端 |
| **oracle** | 代码上下文 + LLM 一键分析, 文件打包, dry-run预览 | oracle CLI 或 npx | 受限 |
| **model-usage** | CodexBar 本地 AI 模型成本分析, 按模型汇总 | codexbar | macOS (评分 7.6) |
| **claude-code-skill** | Claude Code 技能封装 | claude | 受限 |
| **claude-code-supervisor** | Claude Code 监控 | claude | 受限 |

#### 深度研究 Agent

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **deep-research** | 深度研究 Agent, 多步规划 + 长上下文推理 | CRAFTED_API_KEY | 依赖后端 |
| **academic-deep-research** | 学术深研, APA 7th 引用, 2轮研究/主题, 证据层级 | web_search/web_fetch | 依赖后端 |
| **research** | Gemini CLI 后台研究 Agent, 不消耗 Claude tokens | gemini CLI | 屏蔽 (Google) |
| **perplexity** | Perplexity AI 搜索, 带引用出处, 实时联网 | PERPLEXITY_API_KEY | 受限 |
| **perplexity-deep-search** | Perplexity 深度搜索 | PERPLEXITY_API_KEY | 受限 |

---

### 7.2 开发者工具

面向软件开发的工具链。**约 80+ 个技能**。

#### Git & GitHub

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **github** | GitHub CLI (gh) 封装: PR/Issue/CI 管理, 结构化输出, API 查询 | gh CLI | 可用但不稳定 (评分 7.8) |
| **github-pr** | GitHub PR 专用操作 | gh | 可用 |
| **github-kb** | GitHub 知识库 | gh | 可用 |
| **gitlab-api / gitlab-manager** | GitLab API 操作 | curl | 可用 |
| **git-essentials** | Git 核心操作最佳实践 | git | 全平台 |
| **gitflow** | Git Flow 工作流 | git | 全平台 |
| **git-workflows** | Git 工作流模式集合 | git | 全平台 |
| **git-summary** | Git 仓库统计摘要 | git | 全平台 |
| **git-sync** | Git 仓库同步 | git | 全平台 |
| **gitea** | Gitea 自托管 Git 管理 | gitea API | 可用 |
| **unfuck-my-git-state** | Git 状态修复救援工具 | git | 全平台 |

#### API 开发与测试

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **api-dev** | 完整 API 开发工具包: REST/GraphQL 脚手架, curl 测试, OpenAPI 生成, Mock API, Express 调试 | curl + node 或 python3 | 全平台可用 |
| **test-patterns** | 跨语言测试模式: Jest/Vitest (JS), pytest (Python), Go, Rust, Bash 单元/集成/E2E | node/python3/go/cargo/bash | 全平台可用 |
| **test-runner** | 通用测试运行器 | 多种 | 全平台 |
| **test-driven-development** | TDD 指导 | 无 | 全平台 |
| **openapi2cli** | OpenAPI → CLI 自动生成 | node | 全平台 |
| **openspec** | OpenAPI 规范生成 | node | 全平台 |

#### 代码质量与调试

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **pr-reviewer** | PR 代码审查 | gh | 可用 |
| **pr-commit-workflow** | PR + Commit 工作流 | git | 全平台 |
| **perf-profiler** | 性能分析工具 | 多种 | 全平台 |
| **log-analyzer / log-tail** | 日志分析与监控 | 多种 | 全平台 |
| **sentry-cli** | Sentry 错误监控 CLI | sentry-cli | 可用 |
| **ripgrep** | 代码搜索 | rg | 全平台 |

#### 编程语言专用

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **python** | Python 开发最佳实践 | python3 | 全平台 |
| **nextjs-expert** | Next.js 开发专家 | node | 全平台 |
| **trpc-best-practices** | tRPC 最佳实践 | node | 全平台 |
| **swift-concurrency-expert** | Swift 并发专家 | Xcode | macOS |
| **swiftui-*** | SwiftUI 系列 (性能/模式/重构) | Xcode | macOS |
| **noir-developer** | Noir (ZK) 开发 | noir | 全平台 |
| **php-full-stack-developer** | PHP 全栈开发 | php | 全平台 |

#### 技能开发

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **skill-creator** | AI Agent 技能设计原则 + 创建流程 (渐进披露/自由度分级/目录规范) | 无 | 全平台 (评分 8.0) |
| **skill-evaluator** | 技能质量评估 | python3 | 全平台 |
| **skill-scaffold** | 技能脚手架生成 | 无 | 全平台 |
| **mcp-builder** | MCP Server 构建工具 | node | 全平台 |

---

### 7.3 浏览器自动化

控制和自动化浏览器的技能。**约 25+ 个技能**。

| 技能 | 功能详述 | 依赖 | 平台 | CN |
|------|----------|------|------|----|
| **clawbrowser** | Playwright CLI 浏览器控制: 导航/表单/截图/录制/数据提取/会话管理 | playwright-cli | 全平台 | 可用 |
| **fast-browser-use** | Rust 驱动, 10x 快于 Puppeteer, CDP 协议, token 高效 DOM 提取, 无限滚动 | chrome | macOS/Linux | 可用 |
| **camoufox-stealth-browser** | C++ 级反检测: 绕过 Cloudflare Turnstile/Datadome/Airbnb, 基于补丁版 Firefox | distrobox | Linux | 可用 |
| **lightpanda-browser** | 轻量级无头浏览器, 更快更省资源, CDP 兼容 Playwright/Puppeteer | 独立二进制 | macOS/Linux | 可用 (但 Google 拒绝, 用 DDG) |
| **agent-browser** | Rust + Node.js 浏览器自动化 CLI: 导航/截图/PDF/录制/并行会话/设备仿真 | node, npm | 全平台 | 可用 |
| **puppeteer** | Puppeteer 浏览器控制 | node, puppeteer | 全平台 | 可用 |
| **playwright-cli** | Playwright 原生 CLI | playwright | 全平台 | 可用 |
| **stagehand-browser-cli** | Stagehand 浏览器控制 | node | 全平台 | 可用 |
| **smoothbrowser / smooth-browser** | 平滑浏览器自动化 | 多种 | 全平台 | 可用 |
| **stealth-browser / stealthy-auto-browse** | 隐身浏览模式 | 多种 | 全平台 | 可用 |
| **podman-browser** | Podman 容器化浏览器 | podman | Linux | 可用 |
| **next-browser** | 下一代浏览器自动化 | 多种 | 全平台 | 可用 |
| **verify-on-browser** | 浏览器上验证结果 | 多种 | 全平台 | 可用 |
| **webapp-testing** | Web 应用测试 (Playwright) | playwright | 全平台 | 可用 |

---

### 7.4 搜索与研究

网络搜索和信息检索类技能。**约 93 个技能** (含变体)。

#### 搜索引擎接口

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **brave-search** | Brave Search API: 无头搜索 + 页面内容 Markdown 提取 | node, BRAVE_API_KEY | 受限 |
| **google-search** | Google Custom Search Engine (PSE) API | GOOGLE_API_KEY, GOOGLE_CSE_ID | 屏蔽 |
| **tavily-search** | Tavily AI 优化搜索: 深度模式/新闻/日期过滤 | node, TAVILY_API_KEY | 可用 |
| **exa-search / exa-web-search-free** | Exa 神经网络搜索 | EXA_API_KEY | 受限 |
| **serpapi-search / serper-search** | SerpAPI/Serper Google 搜索代理 | API_KEY | 受限 |
| **searxng / searxng-local** | SearxNG 自托管元搜索引擎 | searxng 实例 | 可用 (自建) |
| **duckduckgo-search / ddg-search** | DuckDuckGo 搜索 | 无 | 可用 |
| **kagi-search** | Kagi 付费搜索 | KAGI_API_KEY | 受限 |
| **zhipu-web-search** | 智谱搜索: 标准/Pro/搜狗/夸克 4 引擎, 意图识别 | python3, ZHIPU_API_KEY | 可用 |
| **baidu-search** | 百度搜索 | API | 可用 |
| **baidu-scholar-search** | 百度学术搜索 | API | 可用 |
| **aliyun-search** | 阿里云搜索 | API | 可用 |
| **web-search-plus** | 多引擎智能路由 (Serper/Tavily/Exa), 意图分析 | 多 API Key | 部分可用 |

#### 专题搜索

| 技能 | 功能详述 | CN |
|------|----------|----|
| **npm-search** | NPM 包搜索 | 可用 |
| **reddit-search / search-reddit** | Reddit 内容搜索 | 受限 |
| **youtube-search** | YouTube 视频搜索 | 屏蔽 |
| **file-search** | 本地文件搜索 | 可用 |
| **newsapi-search** | 新闻聚合搜索 | 可用 |
| **flight-search** | 机票搜索 | 可用 |
| **job-search-mcp** | 求职搜索 | 可用 |
| **omnisearch** | 全能搜索 | 依赖配置 |

---

### 7.5 Agent 智能体生态

Agent 框架和编排类技能。**约 136 个技能**。

#### Agent 核心框架

| 技能 | 功能详述 | 依赖 |
|------|----------|------|
| **agent-builder** | Agent 构建工具 | 多种 |
| **agent-orchestrator / agent-orchestration** | Agent 编排和任务分发 | 多种 |
| **claw-swarm** | 多 Agent 集群编排 | 配置 |
| **agent-council** | Agent 委员会 (多 Agent 讨论决策) | 多种 |
| **coding-agent** | 编程 Agent 运行器 | claude/codex/opencode |
| **proactive-agent** | 主动式 Agent | 配置 |
| **self-improving-agent** | 自改进 Agent (多版本: 1.0.0-1.0.2) | 配置 |
| **tmux-agents** | Tmux 多 Agent 并行 | tmux |

#### Agent 身份与安全

| 技能 | 功能详述 | 依赖 |
|------|----------|------|
| **praesidia** | Agent 身份验证 + 信任评分 (0-100) + 安全护栏 (PII/毒性/合规) | PRAESIDIA_API_KEY |
| **agent-identity-kit** | Agent 身份工具包 | 配置 |
| **agent-shield / agentguard** | Agent 安全防护 | 配置 |
| **agent-sentinel** | Agent 哨兵监控 | 配置 |
| **agent-constitution** | Agent 行为宪法约束 | 配置 |

#### Agent 通信

| 技能 | 功能详述 | 依赖 |
|------|----------|------|
| **agent-protocol** | Agent 间通信协议 | 配置 |
| **agentmail / agent-mail** | Agent 邮件通信 | 配置 |
| **agentchat** | Agent 聊天接口 | 配置 |
| **agentbus-relay-chat** | Agent 消息总线 | 配置 |
| **relay-to-agent** | 消息中继到 Agent | 配置 |

#### Agent 工具

| 技能 | 功能详述 | 依赖 |
|------|----------|------|
| **agentarxiv** | AI Agent 科学发布平台: 论文/假设/实验, 里程碑, 复制赏金, 同行评审 | curl, AGENTARXIV_API_KEY |
| **agentlens** | Agent 监控视图 | 配置 |
| **agent-observability-dashboard** | Agent 可观测性仪表板 | 配置 |
| **agent-task-manager** | Agent 任务管理 | 配置 |
| **agent-chronicle** | Agent 活动日志 | 配置 |

---

### 7.6 记忆与知识管理

持久化记忆和知识存储系统。**约 37 个技能**。

| 技能 | 功能详述 | 依赖 |
|------|----------|------|
| **agent-memory / agentmemory** | 持久记忆: 事实存储/经验学习/实体追踪/跨会话 | python |
| **memory** | 核心记忆模块 | 配置 |
| **memory-complete** | 完整记忆系统 | 配置 |
| **memory-curator** | 记忆策展和整理 | 配置 |
| **memory-pipeline** | 记忆处理管线 | 配置 |
| **memory-system-v2** | 记忆系统 V2 | 配置 |
| **memory-lite / memory-manager** | 轻量/管理型记忆 | 配置 |
| **memory-hygiene** | 记忆清理和维护 | 配置 |
| **vector-memory / vector-memory-hack** | 向量记忆 (嵌入检索) | 向量数据库 |
| **chromadb-memory** | ChromaDB 向量记忆 | chromadb |
| **lancedb-memory** | LanceDB 向量记忆 | lancedb |
| **memory-baidu-embedding-db** | 百度嵌入 + 数据库记忆 | 百度 API |
| **triple-memory / triple-memory-skill** | 三重记忆系统 | 配置 |
| **smart-memory** | 智能记忆 | 配置 |
| **cognitive-memory** | 认知记忆 | 配置 |
| **hippocampus-memory** | 海马体记忆 (仿生) | 配置 |
| **symbolic-memory** | 符号记忆 | 配置 |
| **social-memory** | 社交记忆 | 配置 |
| **shared-memory** | 共享记忆 (多 Agent) | 配置 |
| **cloud-memory** | 云端记忆 | 云服务 |
| **elite-longterm-memory** | 精英级长期记忆 | 配置 |
| **bulletproof-memory** | 防弹记忆 | 配置 |
| **claw-progressive-memory** | 渐进式记忆 | 配置 |
| **feishu-memory-recall** | 飞书记忆回忆 | 飞书 API |
| **context7** | 智能文档搜索 + LLM 重排序上下文 | node, CONTEXT7_API_KEY |
| **sequential-thinking** | 顺序思维链 | 配置 |

---

### 7.7 社交与通讯

社交媒体和通讯平台集成。**约 50+ 个技能**。

#### 即时通讯

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **slack** | Slack 消息/反应/置顶/成员管理, JSON 集成 | Slack Bot Token | 屏蔽 (替代: 飞书/钉钉) |
| **discord** | Discord 频道消息/服务器管理 | Discord Bot Token | 可用 |
| **telegram-bot** | Telegram Bot 创建和消息 | TELEGRAM_BOT_TOKEN | 受限 |
| **telegram-compose** | Telegram 消息编写 | 同上 | 受限 |
| **wechat** | 微信本地 SQLite 只读: 联系人/聊天/收藏/统计, macOS + Windows | python3 | 可用 |
| **wecom** | 企业微信集成 | 企业微信 API | 可用 |
| **beeper** | 统一聊天搜索 (WhatsApp/Telegram/Signal/iMessage/Discord) 本地 FTS5 | beeper-cli (Go) | macOS/Linux 可用 |
| **signal-cli** | Signal 加密通讯 | signal-cli | 受限 |
| **messenger** | Facebook Messenger | API | 屏蔽 |

#### 社交网络

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **bluesky** | Bluesky (AT Protocol): 时间线/发帖/搜索/通知/个人资料 | python3 (atproto) | 受限 |
| **reddit** | Reddit 浏览/搜索/发帖, OAuth | python3 | 受限 |
| **hackernews** | Hacker News API + Algolia 搜索 | curl | 可用 |
| **twitter / x** | Twitter/X 操作 | API Key | 受限 |
| **mastodon-scout** | Mastodon 搜索 | API | 可用 |
| **zhihu** | 知乎圈子 Bot: 发布想法/点赞/评论, HMAC-SHA256 鉴权, 10 QPS | python3, ZHIHU_APP_KEY | 可用 |
| **xiaohongshu** | 小红书接口 | API | 可用 |
| **pinterest** | Pinterest 操作 | API | 屏蔽 |
| **tiktok / tiktok-android** | TikTok 操作 | API | 受限 |
| **linkedin / pinchedin** | LinkedIn 操作 | API | 受限 |

#### 邮件

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **himalaya** | 功能全面的终端邮件客户端: 多账户/MML 富文本/结构化输出/安全凭证 | himalaya CLI | 可用 (评分 7.8) |
| **gmail-client / gmail-manager** | Gmail 管理 | Google API | 屏蔽 |
| **apple-mail** | Apple Mail 搜索 | AppleScript | macOS |
| **fastmail** | Fastmail 邮件 | API | 可用 |
| **protonmail** | ProtonMail 加密邮件 | API | 受限 |
| **imap-email / imap-smtp-email** | 通用 IMAP/SMTP 邮件 | 标准协议 | 可用 |
| **send-email / email-send** | 发送邮件 | SMTP | 可用 |
| **mailgun / mailchannels** | 邮件发送服务 | API | 可用 |

---

### 7.8 生产力与办公

任务管理、笔记、日历等办公工具。**约 60+ 个技能**。

#### 任务管理

| 技能 | 功能详述 | 依赖 | 平台 | CN |
|------|----------|------|------|----|
| **things-mac** | Things 3 深度集成: 读写任务/预览/自动化 | Things 3 | macOS | 可用 (评分 8.2) |
| **todoist** | Todoist 任务管理 CLI | todoist-cli | 全平台 | 可用 |
| **linear** | Linear 问题/项目/团队工作流, GitHub 分支集成 | curl, LINEAR_API_KEY | 全平台 | 可用 |
| **trello** | Trello 看板: REST API + jq, 300 req/10s 限流 | curl, jq, TRELLO_KEY | 全平台 | 屏蔽 (评分 7.8) |
| **omnifocus** | OmniFocus 任务管理 | OmniFocus | macOS | 可用 |
| **ticktick / ticktick-tasks** | TickTick 任务管理 | API | 全平台 | 可用 |
| **microsoft-todo** | Microsoft To-Do | API | 全平台 | 可用 |
| **taskmaster** | 通用任务管理 | 配置 | 全平台 | 可用 |
| **no-nonsense-tasks** | 极简任务管理 | 配置 | 全平台 | 可用 |

#### 笔记与知识库

| 技能 | 功能详述 | 依赖 | 平台 | CN |
|------|----------|------|------|----|
| **apple-notes** | Apple Notes 增删改查/搜索/移动/导出 | AppleScript | macOS | 可用 (评分 8.2) |
| **apple-reminders** | Apple 提醒事项: 多日期格式/输出格式/权限管理 | AppleScript | macOS | 可用 (评分 8.2) |
| **bear-notes** | Bear 笔记管理 | Bear app | macOS | 可用 |
| **obsidian / obsidian-daily** | Obsidian 笔记/日记 | obsidian | 全平台 | 可用 |
| **notion / notion-api** | Notion 工作空间管理 | NOTION_API_KEY | 全平台 | 受限 |
| **logseq** | Logseq 知识图谱 | logseq | 全平台 | 可用 |
| **workflowy** | WorkFlowy 大纲 | API | 全平台 | 受限 |

#### 日历与日程

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **gog** | Google Workspace (Gmail/Calendar/Drive/Docs) CLI, JSON 输出 | gog CLI | 屏蔽 (评分 7.4) |
| **ms365 / mcp-microsoft365** | Microsoft 365 集成 | API | 可用 |
| **brainz-calendar** | 日历管理 | 多种 | 可用 |
| **email-to-calendar** | 邮件转日历事件 | 多种 | 可用 |

#### 文档处理

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **nano-pdf** | 自然语言 PDF 编辑: 对特定页面应用文字指令 | nano-pdf CLI | 可用 (评分 7.6) |
| **pdf / pdf-2** | PDF 通用处理 | 多种 | 可用 |
| **md-2-pdf** | Markdown 转 PDF | 多种 | 可用 |
| **pptx-creator** | PowerPoint 创建 | python | 全平台 |
| **xlsx** | Excel 文件处理 | python | 全平台 |
| **markdown-converter / markdown-formatter** | Markdown 转换/格式化 | 多种 | 可用 |

---

### 7.9 多媒体处理

音视频、图像处理工具。**约 30+ 个技能**。

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **video-frames** | ffmpeg 视频帧提取: 时间戳定位/多格式 | ffmpeg | 可用 (评分 8.0) |
| **songsee** | 音频频谱/特征可视化: 9种面板 (谱图/Mel/Chroma/HPSS/MFCC等) | songsee CLI | 可用 (评分 7.8) |
| **gifgrep** | GIF 搜索/TUI 预览/下载/帧提取/拼贴, Tenor/Giphy | gifgrep CLI | 屏蔽 (评分 7.4) |
| **media-converter** | 通用媒体格式转换 | ffmpeg | 可用 |
| **media-player** | 媒体播放器控制 | 多种 | 可用 |
| **sound-fx** | 音效处理 | 多种 | 可用 |
| **subtitles / video-subtitles** | 字幕处理 | 多种 | 可用 |
| **svg-draw** | SVG 绘制 | 无 | 可用 |
| **table-image** | 表格转图像 | 多种 | 可用 |
| **vhs-recorder** | VHS 终端录制 | vhs | 可用 |
| **remotion / remotion-server** | Remotion 视频编程 | node | 可用 |
| **sora-video-gen / veo3-video-gen** | AI 视频生成 | API | 受限 |

#### 音乐控制

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **spotify-player** | Spotify 终端控制: 搜索/播放/设备切换, spogo 工具 | spogo CLI | 屏蔽 (替代: 网易云CLI) |
| **spotify-applescript** | macOS Spotify AppleScript 控制 | macOS + Spotify | macOS, 屏蔽 |
| **blucli** | Bluesound/NAD 设备控制: 发现/播放/分组/TuneIn 电台 | Go | 可用 (评分 7.0) |
| **roon-controller** | Roon 音频控制 | Roon API | 可用 |
| **sonoscli** | Sonos 音箱控制 | CLI | 可用 |

---

### 7.10 智能家居与 IoT

智能设备控制类技能。**约 20+ 个技能**。

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **homeassistant** | Home Assistant REST API: 开关/调光/状态查询/自动化 | curl, HA_TOKEN | 可用 |
| **openhue** | Philips Hue 灯光/房间/场景控制 CLI, Homebrew/二进制安装 | openhue CLI | 可用 (评分 7.6) |
| **switchbot** | SwitchBot 设备控制 | API | 可用 |
| **nanoleaf** | Nanoleaf 灯光控制 | API | 可用 |
| **wled** | WLED LED 灯带控制 | API | 可用 |
| **nest-devices** | Google Nest 设备控制 | API | 受限 |
| **samsung-smartthings** | Samsung SmartThings 控制 | API | 可用 |
| **tado** | Tado 恒温器控制 | API | 可用 |
| **sensibo** | Sensibo 空调控制 | API | 可用 |
| **midea-ac** | 美的空调控制 | API | 可用 |
| **mijia** | 米家智能家居控制 | API | 可用 |
| **mqtt-client** | MQTT 协议客户端 | MQTT broker | 可用 |
| **sphero-mini** | Sphero Mini 机器人控制 | BLE | 可用 |
| **vector-robot** | Vector 机器人控制 | API | 可用 |
| **starlink** | Starlink 卫星网络管理 | API | 受限 |
| **unifi** | UniFi 网络设备管理 | API | 可用 |
| **pihole** | Pi-hole DNS 过滤管理 | Pi-hole | Linux |

---

### 7.11 金融与加密货币

金融市场和加密货币交易。**约 25+ 个技能**。

#### 预测市场

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **polymarket** | Polymarket 预测市场: 查赔率/搜索事件/趋势/分类 (政治/加密/体育) | python3, 公开 API | 可用 |
| **polymarket-agent / polymarketagent** | Polymarket Agent 交易 | API | 可用 |
| **pm-odds** | 预测市场赔率 | API | 可用 |

#### 加密货币

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **solana-skills / solana-trader** | Solana 链上交易 | API | 可用 |
| **onchain / onchain-test** | 链上数据查询 | API | 可用 |
| **okx** | OKX 交易所 | API | 可用 |
| **moonpay** | 法币-加密货币转换 | API | 受限 |
| **transak** | 加密货币购买 | API | 受限 |

#### 传统金融

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **stock-analysis** | 股票分析 | API | 可用 |
| **monarch-money** | 个人财务管理 | API | 受限 |
| **plaid** | Plaid 银行数据连接 | API | 受限 |
| **stripe** | Stripe 支付集成 | API | 受限 |
| **paypal** | PayPal 支付 | API | 受限 |

---

### 7.12 安全与合规

安全审计、防护、合规类技能。**约 30+ 个技能**。

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **clawsec-suite** | 安全套件管理器: 安装/验证/更新安全技能集 | curl, shasum | 可用 |
| **praesidia** | Agent 身份验证 + 信任评分 + 护栏 (PII/毒性/合规) | PRAESIDIA_API_KEY | 可用 |
| **1password** | 1Password CLI: tmux 隔离, 安全凭证操作, Windows 下载支持 | op CLI | 屏蔽 (评分 6.6) |
| **clawguard** | 安全防护 | 配置 | 可用 |
| **clawscan** | 安全扫描 | 配置 | 可用 |
| **openclaw-security-auditor** | OpenClaw 安全审计 | 配置 | 可用 |
| **security-audit / security-check-skill** | 安全审计检查 | 多种 | 可用 |
| **security-sentinel / security-monitor** | 安全哨兵/监控 | 配置 | 可用 |
| **virustotal / virustotal-security** | VirusTotal 文件/URL 扫描 | VT_API_KEY | 可用 |
| **nmap-recon** | Nmap 网络侦察 | nmap | 可用 |
| **nordvpn** | NordVPN 管理 | nordvpn | 可用 |
| **tailscale** | Tailscale VPN 管理 | tailscale | 可用 |
| **openssl** | OpenSSL 操作工具 | openssl | 可用 |
| **proton-pass** | Proton Pass 密码管理 | API | 受限 |

---

### 7.13 数据库与存储

数据库操作和数据管理。**约 20+ 个实际技能** (去除名称匹配误判)。

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **postgres** | PostgreSQL 管理: SQL/Schema/索引/备份/监控/扩展 | curl, jq, DATABASE_URL | 可用 |
| **database** | 通用数据库: PostgreSQL/MySQL/SQLite/MongoDB/Redis | curl, jq | 可用 |
| **database-operations** | 数据库运维: 模式设计/查询优化/EF Core/Redis 缓存/分区 | PostgreSQL CLI | 可用 |
| **sqlite / sql-toolkit** | SQLite/SQL 工具 | sqlite3 | 可用 |
| **redis** | Redis 缓存操作 | redis-cli | 可用 |
| **mongodb-atlas-admin** | MongoDB Atlas 管理 | API | 可用 |
| **nocodb** | NocoDB 数据库 UI | API | 可用 |
| **duckdb-cli-ai-skills** | DuckDB 分析数据库 | duckdb | 可用 |
| **instantdb** | InstantDB 实时数据库 | API | 可用 |
| **snowflake-mcp** | Snowflake 数据仓库 | API | 受限 |
| **supabase** | Supabase (Postgres + Auth + Storage) | API | 可用 |
| **chromadb-memory** | ChromaDB 向量数据库 | chromadb | 可用 |
| **lancedb-memory** | LanceDB 向量数据库 | lancedb | 可用 |

---

### 7.14 DevOps 与基础设施

容器、CI/CD、服务器管理。**约 25+ 个技能**。

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **docker-essentials / docker-ctl** | Docker 容器管理 | docker | 可用 |
| **docker-sandbox** | Docker 沙箱环境 | docker | 可用 |
| **docker-diag** | Docker 诊断 | docker | 可用 |
| **kubernetes** | Kubernetes 集群管理 | kubectl | 可用 |
| **n8n** | n8n 工作流自动化: 列表/激活/触发/调试 | python3, N8N_API_KEY | 可用 |
| **portainer** | Portainer 容器 Web 管理 | API | 可用 |
| **proxmox / proxmox-full** | Proxmox 虚拟化 | API | 可用 |
| **pm2** | PM2 进程管理 | pm2 | 可用 |
| **vercel** | Vercel 部署 | vercel CLI | 可用 |
| **netlify** | Netlify 部署 | netlify CLI | 可用 |
| **railway-skill** | Railway 部署 | railway CLI | 可用 |
| **nginx-config-creator** | Nginx 配置生成 | nginx | 可用 |
| **uptime-kuma / uptime-monitor** | 正常运行时间监控 | API | 可用 |
| **unraid** | Unraid NAS 管理 | API | 可用 |
| **digital-ocean** | DigitalOcean 云管理 | API | 可用 |
| **desktop-commander / desktop-control** | 桌面自动化 (鼠标/键盘/截图/窗口) | pyautogui | 全平台 |
| **windows-control** | Windows 桌面控制: 截图/点击/输入/窗口/OCR | pyautogui, Python 3.11+ | Windows |

---

### 7.15 健康与生活方式

健康追踪、运动、生活习惯。**约 30+ 个技能**。

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **whoop** | WHOOP 健康数据: Recovery/Sleep/Strain 日报 + 建议 | node, WHOOP_CLIENT_ID | 可用 |
| **oura / oura-analytics** | Oura Ring 睡眠/活动数据 | OURA_API_KEY | 可用 |
| **strava** | Strava 运动数据 | STRAVA_API_KEY | 可用 |
| **withings-health** | Withings 健康设备数据 | API | 可用 |
| **workout / workout-logger** | 健身记录 | 配置 | 可用 |
| **weight-loss / muscle-gain** | 减重/增肌指导 | 无 | 可用 |
| **morning-routine / night-routine** | 晨间/夜间习惯 | 无 | 可用 |
| **mindfulness-meditation** | 正念冥想指导 | 无 | 可用 |
| **quit-smoking / quit-vaping / quit-alcohol** | 戒瘾系列 | 无 | 可用 |
| **sleep habits / stress-relief** | 睡眠/减压 | 无 | 可用 |
| **food-order** | 外卖/点餐 | 平台 API | 依赖地区 |
| **recipes / recipe-to-list** | 菜谱/食材清单 | 无 | 可用 |
| **plan2meal** | 膳食计划 | 配置 | 可用 |

#### 天气与出行

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **weather** | 天气查询: 无需 API Key, 多格式, 备用服务 | curl | 可用 (评分 8.4, 最高分) |
| **travel-concierge / travel-manager** | 旅行规划 | 多种 | 可用 |
| **swiss-transport / uk-trains / ns-trains** | 各国公交查询 | API | 地区性 |
| **surfline** | 冲浪条件查询 | API | 可用 |

---

### 7.16 内容创作与营销

内容生成、社交媒体管理、SEO。**约 30+ 个技能**。

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **blogwatcher** | 博客/RSS/Atom 监控: 添加源/扫描/标记已读 | blogwatcher (Go) | 可用 (评分 8.0) |
| **newsletter-generator / newsletter-digest** | 新闻信生成/摘要 | 多种 | 可用 |
| **social-content / social-post** | 社交内容创作/发布 | 多种 | 可用 |
| **social-scheduler** | 社交媒体排期 | 多种 | 可用 |
| **seo-audit / seo-optimizer-pro** | SEO 审计/优化 | 多种 | 可用 |
| **marketing-ideas / marketing-mode** | 营销创意/模式 | 无 | 可用 |
| **substack-formatter** | Substack 格式化 | 无 | 受限 |
| **typefully** | Typefully 发帖 | API | 受限 |
| **tweet-writer / tweeter** | 推文编写 | API | 受限 |
| **podcast-generation** | 播客生成 | 多种 | 可用 |
| **remotion-video-toolkit** | Remotion 视频工具包 | node | 可用 |
| **ai-picture-book** | AI 绘本生成 | API | 依赖后端 |

---

### 7.17 教育与学术

学术研究、学习、论文管理。**约 15+ 个技能**。

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **agentarxiv** | AI Agent 科学发布: 论文/假设/实验/里程碑/复制赏金/同行评审 | curl, AGENTARXIV_API_KEY | 可用 |
| **academic-deep-research** | 学术深研: APA 7th 引用/证据层级/交叉分析 | web_search | 依赖后端 |
| **overleaf** | Overleaf LaTeX 编辑 | API | 可用 |
| **study-habits** | 学习习惯指导 | 无 | 可用 |
| **readwise** | Readwise 阅读高亮 | API | 受限 |
| **weread** | 微信读书数据 | API | 可用 |
| **summarize / tldr / tldw** | 内容摘要 (文字/视频) | 多种 | 可用 |

---

### 7.18 游戏与娱乐

游戏、娱乐相关技能。**约 15+ 个技能**。

| 技能 | 功能详述 | 依赖 | CN |
|------|----------|------|----|
| **steam** | Steam 游戏平台 | API | 可用 |
| **pokemon-red** | Pokemon Red 游戏 | 模拟器 | 可用 |
| **sudoku** | 数独游戏 | 无 | 可用 |
| **riddle** | 谜语游戏 | 无 | 可用 |
| **magic-8-ball** | 魔力 8 球 | 无 | 可用 |
| **xkcd** | xkcd 漫画 | API | 可用 |
| **strands** | 文字游戏 | 无 | 可用 |
| **mtg-edh-deckbuilder** | MTG 卡牌组构筑 | API | 可用 |
| **spacemolt-ai-mmo** | Molt 宇宙 AI MMO | 配置 | 可用 |
| **moltbot-arena** | Molt Bot 竞技场 | 配置 | 可用 |

---

## 8. 重复/变体群组分析

由于开源社区的特性，许多功能领域存在大量重复/变体技能：

| 功能领域 | 变体数量 | 代表性技能 | 建议保留 |
|----------|----------|------------|----------|
| **Agent 系列** | 136 | agent-browser, coding-agent, agent-memory | 10-15 核心 |
| **搜索 + 研究** | 93 | brave-search, tavily-search, zhipu-web-search | 8-10 核心 |
| **记忆系统** | 37 | agent-memory, vector-memory, chromadb-memory | 5-6 核心 |
| **Git 工具** | 30 | github, git-essentials, gitflow | 5-6 核心 |
| **社交通讯** | 25 | slack, discord, telegram-bot, wechat | 按平台保留 |
| **浏览器自动化** | 22+ | clawbrowser, fast-browser-use, agent-browser | 3-4 核心 |
| **Claw-* 生态** | 117 | clawbrowser, clawmail, clawsec-suite | 20-30 核心 |
| **Molt-* 生态** | 67 | moltbot-arena, moltbook, moltguard | 10-15 有效 |
| **测试/占位** | ~30 | test, test1, testskill, minimal-test-skill | 全部可清理 |

---

## 9. 评估排行榜

### 已完成 3 层评审的 27 个技能排名

| 排名 | 技能 | 分数 | 等级 | 类别 | CN |
|------|------|------|------|------|----|
| 1 | **weather** | 8.4 | A | 工具 | 可用 |
| 2 | **apple-notes** | 8.2 | A | 生产力 | 可用 |
| 2 | **apple-reminders** | 8.2 | A | 生产力 | 可用 |
| 2 | **sherpa-onnx-tts** | 8.2 | A | 语音合成 | 可用 |
| 2 | **things-mac** | 8.2 | A | 生产力 | 可用 |
| 6 | **blogwatcher** | 8.0 | A | 内容监控 | 可用 |
| 6 | **skill-creator** | 8.0 | A | 开发工具 | 可用 |
| 6 | **video-frames** | 8.0 | A | 多媒体 | 可用 |
| 9 | **github** | 7.8 | A | 开发者 | 不稳定 |
| 9 | **himalaya** | 7.8 | A | 生产力 | 可用 |
| 9 | **songsee** | 7.8 | A | 音频 | 可用 |
| 9 | **trello** | 7.8 | A | 生产力 | 屏蔽 |
| 13 | **model-usage** | 7.6 | A | 开发工具 | 可用 |
| 13 | **nano-pdf** | 7.6 | A | 文档 | 可用 |
| 13 | **openhue** | 7.6 | A | 智能家居 | 可用 |
| 16 | **gifgrep** | 7.4 | A | 多媒体 | 屏蔽 |
| 16 | **gog** | 7.4 | A | 生产力 | 屏蔽 |
| 16 | **oracle** | 7.4 | A | 开发工具 | 屏蔽 |
| 19 | **blucli** | 7.0 | A | 多媒体 | 可用 |
| 19 | **openai-image-gen** | 7.0 | A | AI 图像 | 屏蔽 |
| 19 | **openai-whisper** | 7.0 | A | 语音 | 屏蔽 |
| 19 | **slack** | 7.0 | A | 协作 | 屏蔽 |
| 23 | **voice-call** | 6.8 | B | 通信 | 屏蔽 |
| 24 | **1password** | 6.6 | B | 安全 | 屏蔽 |
| 24 | **gemini** | 6.6 | B | AI | 屏蔽 |
| 24 | **spotify-player** | 6.6 | B | 媒体 | 屏蔽 |
| 27 | **bluebubbles** | 6.2 | B | 通讯 | 屏蔽 |

### 评分维度参考

- **实用性 (utility)**: 日常使用频率和场景覆盖
- **完整性 (completeness)**: 功能覆盖、文档、示例
- **技术质量 (technicalQuality)**: 代码实现、错误处理
- **可维护性 (maintenance)**: 更新频率、社区活跃度
- **中国兼容性 (cnCompatibility)**: 网络可达性、替代方案

---

## 附录: 关键统计

```
总目录数:          3,061
有效 SKILL.md:     3,051
数据来源:          Local(54) + Mirror(940) + Awesome(2,067)
去重独立技能:      ~2,525
已评审:            27 (A:22 / B:5)
CN 可用率 (已评审): 52% (14/27)
可清理测试技能:     ~30
平台覆盖:          Windows / macOS / Linux
```

---

*本文档由 Clawdbot Skills 质量评估管线 v1.1.0 + 人工分析生成*
