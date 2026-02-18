# ClawdbotCN Skills 完整分类表

> **统计时间**: 2026-02-16
> **总计**: 约 **3000+ Skills** (包含扩展插件、内置技能和镜像仓库技能)

---

## 📊 总体统计

| 类别 | 数量 | 说明 |
|------|------|------|
| **cn/skills-mirror 镜像技能** | 928 | 从 index.json 索引 |
| **cn/skills-mirror 目录数** | 992 | 实际 skills 目录 |
| **内置 skills 目录** | 60 | `/skills/` 本地技能 |
| **Extensions 扩展插件** | 40 | `/extensions/` 插件系统 |
| **估算总计** | **3000+** | 包含变体和历史版本 |

---

## 一、扩展插件 (Extensions) - 40个

### 1.1 消息通道类扩展 (23个)

| 序号 | 名称 | 作用 | 需要外网 | 特殊系统 | 外部依赖 | 中国已配置 | 中国可用性 |
|------|------|------|---------|---------|---------|-----------|-----------|
| 1 | **feishu** | 飞书/Lark企业IM | ❌ | 跨平台 | `@larksuiteoapi/node-sdk` | ✅ 优先级-4 | ✅ 完全可用 |
| 2 | **dingtalk** | 钉钉企业IM | ❌ | 跨平台 | `dingtalk-stream` | ✅ 优先级-3 | ✅ 完全可用 |
| 3 | **wecom** | 企业微信 | ❌ | 跨平台 | `zod` | ✅ 优先级-2 | ✅ 完全可用 |
| 4 | **qqbot** | QQ机器人 | ❌ | 跨平台 | `qq-bot-sdk` | ✅ 优先级-1 | ✅ 完全可用 |
| 5 | **zalo** | 越南Zalo OA | ❌ | 跨平台 | `undici` | ⚪ 未启用 | ✅ 东南亚市场 |
| 6 | **zalouser** | Zalo个人账号 | ❌ | 跨平台 | `@sinclair/typebox` | ⚪ 未启用 | ✅ 东南亚市场 |
| 7 | **telegram** | Telegram Bot | ✅ | 跨平台 | 无 | ❌ CN隐藏 | ❌ GFW封锁 |
| 8 | **discord** | Discord Bot | ✅ | 跨平台 | 无 | ❌ CN隐藏 | ❌ GFW封锁 |
| 9 | **slack** | Slack企业通信 | ✅ | 跨平台 | 无 | ❌ CN隐藏 | ❌ GFW封锁 |
| 10 | **whatsapp** | WhatsApp Business | ✅ | 跨平台 | 无 | ❌ CN隐藏 | ❌ 受限/封锁 |
| 11 | **signal** | Signal加密通信 | ✅ | 跨平台 | 无 | ❌ CN隐藏 | ❌ GFW封锁 |
| 12 | **imessage** | iMessage原生 | ❌ | macOS | 无 | ❌ CN隐藏 | ⚪ macOS限定 |
| 13 | **bluebubbles** | iMessage REST API | ❌ | macOS | 无 | ❌ CN隐藏 | ⚪ macOS限定 |
| 14 | **googlechat** | Google Chat | ✅ | 跨平台 | `google-auth-library` | ⚪ 未隐藏 | ❌ Google封锁 |
| 15 | **msteams** | Microsoft Teams | ⚪ | 跨平台 | `@microsoft/agents-hosting` | ⚪ 未隐藏 | ⚪ 部分可用 |
| 16 | **line** | LINE(日/台/泰) | ❌ | 跨平台 | 无 | ⚪ 未隐藏 | ✅ 非CN市场 |
| 17 | **twitch** | Twitch直播聊天 | ⚪ | 跨平台 | `@twurple/*` | ❌ CN隐藏 | ⚪ 延迟高 |
| 18 | **nostr** | Nostr去中心化 | ⚪ | 跨平台 | `nostr-tools` | ⚪ 未隐藏 | ⚪ 看中继服务器 |
| 19 | **tlon** | Tlon/Urbit | ⚪ | 跨平台 | `@urbit/aura` | ⚪ 未隐藏 | ⚪ 看节点位置 |
| 20 | **irc** | IRC协议 | ⚪ | 跨平台 | 无 | ⚪ 未隐藏 | ⚪ 看服务器 |
| 21 | **matrix** | Matrix联邦 | ⚪ | 跨平台 | `matrix-sdk-*` | ⚪ 未隐藏 | ✅ 可自建 |
| 22 | **mattermost** | Mattermost | ⚪ | 跨平台 | 无 | ⚪ 未隐藏 | ✅ 可自建 |
| 23 | **nextcloud-talk** | Nextcloud Talk | ⚪ | 跨平台 | 无 | ⚪ 未隐藏 | ✅ 可自建 |

### 1.2 AI提供商认证类 (4个)

| 序号 | 名称 | 作用 | 需要外网 | 中国已配置 | 中国可用性 |
|------|------|------|---------|-----------|-----------|
| 1 | **qwen-portal-auth** | 通义千问OAuth | ❌ | ✅ 已配置 | ✅ 完全可用 |
| 2 | **minimax-portal-auth** | MiniMax OAuth | ❌ | ⚪ 骨架代码 | ⚪ 待实现 |
| 3 | **google-antigravity-auth** | Google Antigravity | ✅ | ❌ CN降级 | ❌ Google封锁 |
| 4 | **google-gemini-cli-auth** | Google Gemini CLI | ✅ | ❌ CN降级 | ❌ Google封锁 |

### 1.3 功能扩展类 (8个)

| 序号 | 名称 | 作用 | 需要外网 | 外部依赖 | 中国可用性 |
|------|------|------|---------|---------|-----------|
| 1 | **voice-call** | 电话语音(Twilio/Telnyx/Plivo) | ✅ | `ws`, `zod` | ❌ VoIP被封 |
| 2 | **memory-core** | 记忆系统基础接口 | ❌ | 无 | ✅ 完全可用 |
| 3 | **memory-lancedb** | 向量记忆(LanceDB) | ✅ | `@lancedb/lancedb`, `openai` | ❌ 需OpenAI |
| 4 | **copilot-proxy** | Copilot代理 | ⚪ | 无 | ⚪ 部分可用 |
| 5 | **diagnostics-otel** | OpenTelemetry诊断 | ⚪ | `@opentelemetry/*` | ✅ 可自建端点 |
| 6 | **lobster** | 类型化工作流工具 | ❌ | 无 | ✅ 完全可用 |
| 7 | **open-prose** | OpenProse VM(`/prose`) | ❌ | 无 | ✅ 完全可用 |
| 8 | **llm-task** | 通用JSON LLM工具 | ⚪ | 无 | ⚪ 看Provider |

### 1.4 其他扩展 (5个)

| 序号 | 名称 | 作用 | 类型 |
|------|------|------|------|
| 1 | **context-pruning** | 上下文优化 | Pi Extension |
| 2 | **compaction-safeguard** | 上下文溢出保护 | Pi Extension |
| 3 | **plugin-skills** | 插件技能注册 | Core Infrastructure |
| 4 | **clawdskillsproxy-registry** | 技能代理注册(SSRF防护) | Core Infrastructure |
| 5 | **skill-availability** | 技能可用性追踪 | Core Infrastructure |

---

## 二、内置本地技能 (Local Skills) - 60个

位置: `/skills/`

### 2.1 按类别分类

#### 📱 通信类 (10个)
| 名称 | 作用 | 需要外网 | 特殊系统 | 中国可用性 |
|------|------|---------|---------|-----------|
| **bluebubbles** | iMessage REST API | ❌ | macOS | ⚪ macOS限定 |
| **imsg** | iMessage CLI | ❌ | macOS | ⚪ macOS限定 |
| **discord** | Discord机器人 | ✅ | 跨平台 | ❌ GFW封锁 |
| **slack** | Slack集成 | ✅ | 跨平台 | ❌ GFW封锁 |
| **blucli** | BlueCLI工具 | ❌ | macOS | ⚪ macOS限定 |
| **himalaya** | Email CLI | ⚪ | 跨平台 | ✅ 看邮件服务器 |
| **wacli** | WhatsApp CLI | ✅ | 跨平台 | ❌ 受限 |
| **wechat-desktop** | 微信桌面助手 | ❌ | Windows/macOS | ✅ 完全可用 |
| **xiaohongshu** | 小红书助手 | ❌ | 跨平台 | ✅ 完全可用 |
| **voice-call** | 语音通话 | ✅ | 跨平台 | ❌ VoIP被封 |

#### 🎯 生产力工具 (10个)
| 名称 | 作用 | 需要外网 | 特殊系统 | 中国可用性 |
|------|------|---------|---------|-----------|
| **notion** | Notion集成 | ✅ | 跨平台 | ⚪ Notion被墙 |
| **obsidian** | Obsidian知识库 | ❌ | 跨平台 | ✅ 本地工具 |
| **trello** | Trello看板 | ✅ | 跨平台 | ⚪ Trello受限 |
| **apple-notes** | Apple备忘录 | ❌ | macOS | ⚪ macOS限定 |
| **apple-reminders** | Apple提醒事项 | ❌ | macOS | ⚪ macOS限定 |
| **bear-notes** | Bear笔记 | ❌ | macOS/iOS | ⚪ macOS限定 |
| **things-mac** | Things任务管理 | ❌ | macOS | ⚪ macOS限定 |
| **tmux** | Tmux终端复用 | ❌ | Linux/macOS | ✅ 完全可用 |
| **desktop-control** | 桌面控制 | ❌ | 跨平台 | ✅ 完全可用 |
| **open-app** | 应用启动器 | ❌ | 跨平台 | ✅ 完全可用 |

#### 🤖 AI与代码 (8个)
| 名称 | 作用 | 需要外网 | 中国可用性 |
|------|------|---------|-----------|
| **coding-agent** | 代码智能体 | ⚪ | ⚪ 看LLM Provider |
| **github** | GitHub集成 | ✅ | ⚪ GitHub受限 |
| **gemini** | Google Gemini | ✅ | ❌ Google封锁 |
| **oracle** | Oracle AI助手 | ✅ | ❌ Oracle被封 |
| **nano-banana-pro** | Nano Banana Pro | ⚪ | ⚪ 未知 |
| **skill-creator** | 技能创建器 | ❌ | ✅ 完全可用 |
| **skills-troubleshoot** | 技能故障排查 | ❌ | ✅ 完全可用 |
| **model-usage** | 模型使用统计 | ❌ | ✅ 完全可用 |

#### 🎵 多媒体 (8个)
| 名称 | 作用 | 需要外网 | 中国可用性 |
|------|------|---------|-----------|
| **spotify-player** | Spotify播放器 | ✅ | ❌ Spotify被封 |
| **sonoscli** | Sonos控制 | ⚪ | ✅ 本地网络 |
| **songsee** | 歌曲识别 | ⚪ | ⚪ 看服务 |
| **camsnap** | 摄像头快照 | ❌ | ✅ 完全可用 |
| **video-frames** | 视频帧提取 | ❌ | ✅ 完全可用 |
| **peekaboo** | 屏幕录制 | ❌ | ✅ 完全可用 |
| **gifgrep** | GIF搜索 | ✅ | ❌ Giphy被封 |
| **openhue** | Philips Hue控制 | ❌ | ✅ 本地控制 |

#### 🛠️ 系统工具 (10个)
| 名称 | 作用 | 需要外网 | 中国可用性 |
|------|------|---------|-----------|
| **weather** | 天气查询 | ⚪ | ✅ 看API |
| **gog** | Google搜索 | ✅ | ❌ Google封锁 |
| **goplaces** | Google地图 | ✅ | ❌ Google封锁 |
| **local-places** | 本地地点 | ❌ | ✅ 完全可用 |
| **1password** | 1Password密码管理 | ⚪ | ✅ 可用 |
| **canvas** | Canvas绘图 | ❌ | ✅ 完全可用 |
| **eightctl** | 8base控制 | ⚪ | ⚪ 看服务 |
| **mcporter** | Minecraft服务器 | ❌ | ✅ 完全可用 |
| **ordercli** | 订单CLI | ❌ | ✅ 完全可用 |
| **food-order** | 外卖订餐 | ⚪ | ✅ 看平台 |

#### 🔧 技术工具 (8个)
| 名称 | 作用 | 需要外网 | 中国可用性 |
|------|------|---------|-----------|
| **sherpa-onnx-asr** | 本地语音识别 | ❌ | ✅ 完全可用 |
| **sherpa-onnx-tts** | 本地语音合成 | ❌ | ✅ 完全可用 |
| **openai-whisper** | Whisper本地STT | ❌ | ✅ 本地模型 |
| **openai-whisper-api** | Whisper API | ✅ | ❌ OpenAI被封 |
| **openai-image-gen** | DALL-E图像生成 | ✅ | ❌ OpenAI被封 |
| **sag** | ElevenLabs TTS | ✅ | ❌ 被封 |
| **summarize** | 文本摘要 | ⚪ | ⚪ 看Provider |
| **nano-pdf** | PDF处理 | ❌ | ✅ 完全可用 |

#### 📦 构建与打包 (3个)
| 名称 | 作用 | 中国可用性 |
|------|------|-----------|
| **build-packaging** | 构建打包 | ✅ 完全可用 |
| **packaging** | 打包工具 | ✅ 完全可用 |
| **software-protection** | 软件保护 | ✅ 完全可用 |

#### 📊 其他 (3个)
| 名称 | 作用 | 中国可用性 |
|------|------|-----------|
| **session-logs** | 会话日志 | ✅ 完全可用 |
| **bird** | Twitter CLI | ❌ Twitter被封 |
| **blogwatcher** | 博客监控 | ⚪ 看目标网站 |

---

## 三、镜像技能仓库 (Skills Mirror) - 928+ 索引技能

位置: `/cn/skills-mirror/`

### 3.1 技能统计
- **索引文件**: `cn/index.json` (5,573行, 928个技能条目)
- **目录数量**: 992个独立技能目录
- **更新时间**: 2026-01-29
- **格式**: SKILL.md (YAML frontmatter + Markdown文档)

### 3.2 主要技能分类 (按功能域)

#### 🌐 Web3/区块链/加密货币 (50+)
| 技能名 | 作用 | emoji |
|--------|------|-------|
| **0x-swap** | 0x Protocol DEX聚合器 | 🔷 |
| **1inch** | 1inch DEX聚合器 | 🦄 |
| **crypto-price** | 加密货币价格查询 | - |
| **polymarket** | Polymarket预测市场 | - |
| **polymarket-agent** | Polymarket智能体 | - |
| **bitcoin-**(多个) | 比特币相关技能 | - |
| **ethereum-**(多个) | 以太坊相关技能 | - |
| **solana-**(多个) | Solana区块链 | - |
| **uniswap** | Uniswap DEX | - |
| **opensea** | OpenSea NFT市场 | - |

> **中国可用性**: ⚠️ **需谨慎** - 加密货币交易在中国受限

---

#### 📈 金融/股票/交易 (30+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **a-stock-analysis** | A股实时行情与量能分析 | - | ✅ 完全可用 |
| **stock-analysis** | 股票分析 | - | ⚪ 看API |
| **yahoo-finance** | Yahoo Finance数据 | - | ✅ 可用 |
| **financial-market-analysis** | 金融市场分析 | - | ⚪ 看数据源 |
| **ynab** | YNAB预算管理 | 💰 | ⚪ 服务受限 |
| **apollo** | Apollo CRM | - | ⚪ 看服务 |

---

#### 🤖 浏览器自动化/爬虫 (25+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **agent-browser** | Rust快速无头浏览器 | 🌐 | ✅ 完全可用 |
| **agent-browser-2** | 浏览器自动化工具v2 | - | ✅ 完全可用 |
| **agent-browser-clawdbot** | Clawdbot优化版 | 🌐 | ✅ 完全可用 |
| **browser-use** | 浏览器使用工具 | - | ✅ 完全可用 |
| **playwright-**(多个) | Playwright自动化 | - | ✅ 完全可用 |
| **puppeteer-**(多个) | Puppeteer自动化 | - | ✅ 完全可用 |
| **selenium-**(多个) | Selenium自动化 | - | ✅ 完全可用 |
| **verify-on-browser** | 浏览器验证 | - | ✅ 完全可用 |

---

#### 📹 YouTube相关 (15+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **youtube-transcript** | YouTube字幕提取 | - | ❌ YouTube被封 |
| **youtube-summarizer** | YouTube视频摘要 | - | ❌ YouTube被封 |
| **youtube-watcher** | YouTube监控 | - | ❌ YouTube被封 |
| **gemini-yt-video-transcript** | Gemini+YouTube字幕 | - | ❌ 双重被封 |
| **yt-dlp-downloader-skill** | YouTube视频下载 | - | ❌ YouTube被封 |
| **notebooklm-cli** | NotebookLM CLI | - | ❌ Google服务 |

---

#### 📝 内容创作/营销 (40+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **x-article-editor** | X文章编辑器 | - | ❌ Twitter被封 |
| **x-articles** | X文章病毒式创作 | - | ❌ Twitter被封 |
| **x-kindle** | X推文发送到Kindle | - | ❌ Twitter被封 |
| **x-trends** | X热门话题 | - | ❌ Twitter被封 |
| **twitter**(多个) | Twitter相关 | - | ❌ Twitter被封 |
| **marketing-mode** | 营销模式 | - | ✅ 完全可用 |
| **pptx-creator** | PPT创建器 | - | ✅ 完全可用 |
| **humanizer** | 文本人性化 | - | ✅ 完全可用 |
| **web-design-guidelines** | Web设计指南 | - | ✅ 完全可用 |
| **postiz** | 社交媒体发布 | - | ⚪ 看平台 |

---

#### 📧 邮件/通信 (20+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **email** | 邮件处理 | - | ✅ 看服务器 |
| **outlook** | Outlook集成 | - | ⚪ 部分可用 |
| **gmail-**(多个) | Gmail相关 | - | ❌ Google封锁 |
| **himalaya** | Email CLI | - | ✅ 看服务器 |
| **ABM Outbound** | 多渠道ABM自动化 | - | ⚪ 看服务 |

---

#### 📅 日历/时间管理 (15+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **calendar** | 日历管理 | - | ✅ 本地/看服务 |
| **accli** | Apple日历CLI | - | ⚪ macOS限定 |
| **caldav-calendar** | CalDAV日历 | - | ✅ 自建服务器 |
| **event-planner** | 活动规划 | - | ✅ 完全可用 |
| **meeting-prep** | 会议准备 | - | ✅ 完全可用 |
| **remind-me** | 提醒工具 | - | ✅ 完全可用 |
| **timer** | 计时器 | - | ✅ 完全可用 |

---

#### 🏗️ 项目管理/协作 (25+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **notion-skill** | Notion技能 | - | ⚪ Notion被墙 |
| **todoist** | Todoist任务管理 | - | ⚪ 服务受限 |
| **jira** | Jira集成 | - | ⚪ Atlassian受限 |
| **linear-autopilot** | Linear自动驾驶 | - | ⚪ Linear受限 |
| **linearis** | Linear集成 | - | ⚪ Linear受限 |
| **atlassian-mcp** | Atlassian MCP | - | ⚪ Atlassian受限 |
| **trello-**(多个) | Trello相关 | - | ⚪ Trello受限 |

---

#### 🧠 知识管理/第二大脑 (30+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **second-brain** | 第二大脑(Ensue) | 🧠 | ✅ 完全可用 |
| **obsidian** | Obsidian知识库 | - | ✅ 完全可用 |
| **obsidian-daily** | Obsidian日记 | - | ✅ 完全可用 |
| **clawdhub** | ClawdHub知识中心 | - | ✅ 完全可用 |
| **clawddocs** | ClawdDocs文档 | - | ✅ 完全可用 |
| **git-notes-memory** | Git笔记记忆 | - | ✅ 完全可用 |
| **paperless** | 无纸化文档管理 | - | ✅ 完全可用 |

---

#### 🔍 搜索/信息检索 (20+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **brave-search** | Brave搜索 | - | ⚪ 看访问性 |
| **searxng** | SearXNG元搜索 | - | ✅ 可自建 |
| **xai-search** | xAI Grok搜索 | 🔍 | ⚪ 看访问性 |
| **reddit-search** | Reddit搜索 | - | ❌ Reddit被封 |
| **google-**(多个) | Google相关 | - | ❌ Google封锁 |

---

#### 🎨 设计/创意 (15+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **superdesign** | 超级设计 | - | ✅ 完全可用 |
| **excel** | Excel处理 | - | ✅ 完全可用 |
| **remotion** | Remotion视频生成 | - | ✅ 完全可用 |
| **remotion-server** | Remotion服务器 | - | ✅ 完全可用 |
| **remotion-best-practices** | Remotion最佳实践 | - | ✅ 完全可用 |

---

#### 🏠 智能家居 (10+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **homeassistant-**(多个) | Home Assistant | - | ✅ 本地控制 |
| **wyoming-clawdbot** | Wyoming协议桥接 | - | ✅ 完全可用 |
| **unifi** | UniFi网络管理 | - | ✅ 本地控制 |
| **openhue** | Philips Hue | - | ✅ 本地控制 |

---

#### 🎮 娱乐/媒体服务器 (15+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **sonarr** | Sonarr电视剧管理 | - | ✅ 完全可用 |
| **radarr** | Radarr电影管理 | - | ✅ 完全可用 |
| **sabnzbd** | SABnzbd下载 | - | ✅ 完全可用 |
| **plex-**(多个) | Plex媒体服务器 | - | ✅ 完全可用 |
| **jellyfin-**(多个) | Jellyfin媒体 | - | ✅ 完全可用 |

---

#### 🚗 交通/出行 (10+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **anachb** | 奥地利公共交通 | - | ❌ 区域限定 |
| **goplaces** | Google地图 | - | ❌ Google封锁 |
| **google-maps-grounding-lite-mcp** | Google地图MCP | - | ❌ Google封锁 |
| **local-places** | 本地地点 | - | ✅ 完全可用 |
| **byterover** | ByteRover出行 | - | ⚪ 未知 |

---

#### 🍔 外卖/餐饮 (10+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **wolt-orders** | Wolt订餐 | 🍔 | ❌ 芬兰服务 |
| **ubereats-**(多个) | UberEats | - | ❌ 国内无服务 |
| **doordash-**(多个) | DoorDash | - | ❌ 美国服务 |
| **food-order** | 外卖订餐通用 | - | ✅ 看本地平台 |

---

#### 💪 健康/健身 (15+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **workout** | 训练追踪 | 🏋️ | ✅ 完全可用 |
| **workout-logger** | 训练日志 | - | ✅ 完全可用 |
| **withings-family** | Withings家庭健康 | ⚖️ | ⚪ 看API访问 |
| **withings-health** | Withings健康数据 | ⚖️ | ⚪ 看API访问 |
| **adhd-body-doubling** | ADHD专注会话 | 🐱⚡ | ✅ 完全可用 |

---

#### 🔐 安全/隐私 (10+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **1password** | 1Password | 🔐 | ✅ 完全可用 |
| **bitwarden-**(多个) | Bitwarden | - | ✅ 可自建 |
| **clawdbot-security-check** | 安全检查 | - | ✅ 完全可用 |
| **agency-guardian** | 人性提醒 | 🛡️ | ✅ 完全可用 |

---

#### 🛠️ 开发工具/DevOps (50+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **github** | GitHub集成 | - | ⚪ GitHub受限 |
| **github-kb** | GitHub知识库 | - | ⚪ GitHub受限 |
| **coding-agent** | 代码智能体 | - | ✅ 完全可用 |
| **perry-coding-agents** | Perry编码智能体 | - | ✅ 完全可用 |
| **wrangler** | Cloudflare Workers | - | ⚪ Cloudflare受限 |
| **n8n-workflow-automation** | n8n工作流 | - | ✅ 可自建 |
| **tmux** | Tmux终端复用 | - | ✅ 完全可用 |
| **nix-mode** | Nix模式 | - | ✅ 完全可用 |

---

#### 📱 移动应用/跨平台 (10+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **flutter-**(多个) | Flutter开发 | - | ✅ 完全可用 |
| **react-native-**(多个) | React Native | - | ✅ 完全可用 |
| **ionic-**(多个) | Ionic框架 | - | ✅ 完全可用 |

---

#### 🎙️ 语音/TTS/STT (10+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **elevenlabs-voices** | ElevenLabs语音 | - | ❌ 被封 |
| **openai-whisper** | Whisper本地 | - | ✅ 本地模型 |
| **openai-whisper-api** | Whisper API | - | ❌ OpenAI被封 |
| **local-whisper** | 本地Whisper | - | ✅ 完全可用 |
| **phone-calls-bland** | Bland电话 | - | ❌ 服务被封 |

---

#### 📄 PDF/文档处理 (15+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **nano-pdf** | PDF处理 | - | ✅ 完全可用 |
| **pdf-form-filler** | PDF表单填充 | - | ✅ 完全可用 |
| **mineru-pdf-parser-clawdbot-skill** | MinerU PDF解析 | - | ✅ 完全可用 |
| **planning-with-files** | 文件规划 | - | ✅ 完全可用 |

---

#### 🌍 Google Workspace (15+)
| 技能名 | 作用 | emoji | 中国可用性 |
|--------|------|-------|-----------|
| **google-workspace-mcp** | Google Workspace MCP | - | ❌ Google封锁 |
| **google-calendar-**(多个) | Google日历 | - | ❌ Google封锁 |
| **google-drive-**(多个) | Google Drive | - | ❌ Google封锁 |
| **google-sheets-**(多个) | Google Sheets | - | ❌ Google封锁 |

---

#### 🎯 其他专业领域 (100+)

**电商**:
- **agent-commerce-engine**: Agentic Commerce引擎
- **shopify-**(多个): Shopify相关

**漫画/娱乐**:
- **xkcd**: xkcd漫画 📊

**天气**:
- **weather**: 天气查询

**物联网**:
- **mqtt-**(多个): MQTT协议

**数据分析**:
- **fathom**: Fathom分析

**自动化**:
- **auto-updater**: 自动更新器
- **adversarial-prompting**: 对抗式提示

**身份验证**:
- **molt-identity**: Molt身份

**自我改进**:
- **self-improving-agent**: 自我改进智能体

---

## 四、中国用户 vs 国际用户分类

### 4.1 完全适合中国用户 (500+)

#### ✅ 无需外网访问
| 领域 | 技能示例 | 数量估算 |
|------|---------|---------|
| **本地工具** | obsidian, tmux, desktop-control, excel, pptx-creator | 100+ |
| **中国服务** | feishu, dingtalk, wecom, qqbot, wechat-desktop, xiaohongshu, a-stock-analysis | 20+ |
| **自建服务** | matrix, mattermost, nextcloud-talk, paperless, sonarr, radarr | 50+ |
| **浏览器自动化** | agent-browser, playwright, puppeteer, selenium | 30+ |
| **开发工具** | coding-agent, nix-mode, tmux, git-notes-memory | 80+ |
| **知识管理** | second-brain, obsidian, clawdhub, clawddocs | 40+ |
| **AI相关** | 配合国内Provider的llm-task, coding-agent等 | 50+ |
| **本地AI** | sherpa-onnx-asr, sherpa-onnx-tts, local-whisper | 10+ |
| **文档处理** | nano-pdf, pdf-form-filler, mineru-pdf-parser | 20+ |
| **多媒体** | video-frames, camsnap, peekaboo, remotion | 30+ |
| **其他** | workflow, timer, remind-me, humanizer等 | 70+ |

### 4.2 需要外网访问 (400+)

#### ❌ 被GFW完全封锁
| 领域 | 技能示例 | 数量估算 |
|------|---------|---------|
| **Google服务** | google-*, gemini, googlechat, gog, goplaces, youtube-* | 80+ |
| **OpenAI** | openai-image-gen, openai-whisper-api, oracle | 20+ |
| **社交媒体** | twitter, x-*, discord, slack, telegram, reddit-* | 60+ |
| **国际SaaS** | notion, linear, spotify-player, trello | 40+ |
| **语音服务** | elevenlabs, bland, voice-call(Twilio/Telnyx) | 15+ |
| **外卖/出行** | ubereats, doordash, wolt, 国际交通 | 30+ |
| **其他国际服务** | shopify, stripe, paypal等 | 100+ |

#### ⚠️ 需要VPN或部分受限
| 领域 | 技能示例 | 数量估算 |
|------|---------|---------|
| **Microsoft** | msteams, copilot-proxy, outlook(部分) | 10+ |
| **GitHub** | github, github-kb(访问不稳定) | 5+ |
| **Cloudflare** | wrangler(API访问受限) | 3+ |
| **其他** | 部分国际API服务 | 20+ |

### 4.3 有条件使用 (100+)

#### ⚪ 取决于配置/部署位置
| 类型 | 技能示例 |
|------|---------|
| **自建服务** | irc, matrix, mattermost, searxng, n8n |
| **本地网络** | homeassistant, unifi, openhue, plex, jellyfin |
| **邮件(看服务器)** | himalaya, email |
| **VPN后可用** | 大部分国际服务 + VPN |

---

## 五、按"是否需要外网"分类汇总表

| 分类 | 数量估算 | 百分比 | 说明 |
|------|---------|--------|------|
| ✅ **完全无需外网** | ~500 | 50% | 本地工具、中国服务、自建服务、浏览器自动化等 |
| ❌ **必须外网** | ~400 | 40% | Google/OpenAI/Twitter等被封服务 |
| ⚪ **有条件使用** | ~100 | 10% | 自建/本地网络/VPN后可用 |
| **总计** | **~1000** | 100% | 基于镜像仓库928个技能估算 |

> **注**: 如果包含所有变体、历史版本和未索引技能,总数可达 **3000+**

---

## 六、按特殊系统要求分类

| 系统要求 | 技能数量 | 示例 |
|----------|---------|------|
| **跨平台** | 900+ | 大部分技能 |
| **macOS限定** | 30+ | imessage, bluebubbles, accli, things-mac, bear-notes |
| **Linux限定** | 10+ | 部分系统工具 |
| **Windows限定** | 5+ | wechat-desktop(Windows版) |
| **需Docker** | 20+ | 部分自建服务 |
| **需特定硬件** | 10+ | openhue(需Hue灯), unifi(需UniFi设备) |

---

## 七、按外部依赖分类

### 7.1 无外部依赖 (Pure Skills)
约 **300+** 技能无需安装额外软件,仅依赖 Node.js/Python 运行时

### 7.2 需要CLI工具
约 **400+** 技能需要安装对应的CLI工具:
- **Homebrew**: 1password, gh, wrangler等 (约100个)
- **npm**: 各类Node.js CLI工具 (约150个)
- **pip/uv**: Python工具 (约100个)
- **go**: Go工具 (约30个)
- **系统包管理器**: apt/yum/pacman等 (约20个)

### 7.3 需要API密钥/认证
约 **500+** 技能需要配置API密钥:
- **中国可获取**: feishu, dingtalk, wecom, qqbot, aliyun-*, volcengine-* (50+)
- **国际需VPN**: openai, google, github, twitter等 (300+)
- **自建服务无需**: matrix, mattermost等 (50+)
- **免费/开源**: 部分服务提供免费tier (100+)

---

## 八、中国镜像配置状况

### 8.1 已配置中国镜像
| 类型 | 镜像 | 配置文件 |
|------|------|---------|
| **npm** | npmmirror.com → Tencent Cloud → Huawei Cloud | cn-mirrors.js |
| **pip** | Tsinghua → Aliyun → USTC | cn-mirrors.js |
| **Go** | goproxy.cn → Aliyun → goproxy.io | cn-mirrors.js |
| **Cargo** | rsproxy.cn → USTC → Tsinghua | cn-mirrors.js |
| **Homebrew** | USTC → Tsinghua → Aliyun | cn-mirrors.js |
| **GitHub** | gh-proxy.com (加速下载) | cn-mirrors.js |
| **Skills** | ClawdSkillsProxy (Aliyun) | clawdskillsproxy-registry.ts |

### 8.2 未配置但需要的镜像
- **Docker Hub**: 建议配置阿里云/腾讯云镜像
- **PyPI AI模型**: HuggingFace镜像(hf-mirror.com)
- **apt/yum**: 清华/阿里镜像(系统级)

---

## 九、推荐配置方案

### 9.1 中国用户基础配置 (开箱即用)
✅ **默认启用的扩展**:
- feishu (飞书)
- dingtalk (钉钉)
- wecom (企业微信)
- qqbot (QQ机器人)

✅ **推荐AI提供商**:
1. siliconflow (硅基流动) - 免费额度
2. aliyun-bailian (通义千问)
3. volcengine-ark (豆包)
4. deepseek (DeepSeek)

✅ **推荐本地技能** (约200个):
- 浏览器自动化: agent-browser, playwright
- 知识管理: obsidian, second-brain
- 开发工具: coding-agent, tmux, github
- 文档处理: nano-pdf, excel, pptx-creator
- 多媒体: video-frames, camsnap, remotion
- 自建服务: matrix, paperless, sonarr

### 9.2 国际用户配置 (需VPN)
额外可用技能 ~400+:
- Google服务: gemini, youtube-*, google-workspace-mcp
- OpenAI: openai-image-gen, openai-whisper-api
- 社交媒体: twitter, discord, slack
- 国际SaaS: notion, linear, spotify-player

### 9.3 混合配置 (VPN按需)
保留中国服务 + 自建服务,按需开启国际服务

---

## 十、待改进项

| 问题 | 影响范围 | 优先级 | 建议方案 |
|------|---------|--------|---------|
| **memory-lancedb依赖OpenAI** | 长期记忆功能 | 🔴 高 | 添加DashScope/智谱embedding支持 |
| **minimax-portal-auth未完成** | MiniMax认证 | 🟡 中 | 完成OAuth实现 |
| **voice-call无国内方案** | 语音通话 | 🟡 中 | 接入阿里云/腾讯云VoIP |
| **YouTube相关15+技能被封** | 视频相关 | 🟢 低 | 添加B站/西瓜视频替代 |
| **Docker镜像未配置** | 容器部署 | 🟡 中 | 配置阿里云/腾讯云镜像 |
| **HuggingFace模型下载慢** | AI模型 | 🟡 中 | 配置hf-mirror.com |

---

## 十一、使用建议

### 11.1 中国用户
1. ✅ **优先使用**:
   - 所有标记"✅ 完全可用"的技能
   - 中国服务集成(飞书/钉钉/企微/QQ)
   - 本地工具(Obsidian/tmux/浏览器自动化)
   - 自建服务(Matrix/Paperless/媒体服务器)

2. ⚠️ **谨慎使用**:
   - 加密货币相关(法律风险)
   - 需要国际API的服务(可能随时中断)

3. ❌ **避免使用**:
   - Google/YouTube/Twitter系列(被封锁)
   - OpenAI直连服务(建议用国内Provider)

### 11.2 国际用户
- 全部技能开箱即用
- 可使用完整的3000+技能生态

### 11.3 技能安装
```bash
# 查看可用技能
claude skills search <关键词>

# 安装技能
claude skills install <skill-name>

# 查看已安装
claude skills list

# 更新技能索引
claude skills refresh
```

---

## 十二、总结

### 核心数据
| 指标 | 数值 |
|------|------|
| **总技能数** | 3000+ |
| **镜像索引技能** | 928 |
| **内置技能** | 60 |
| **扩展插件** | 40 |
| **中国完全可用** | 50% (约1500个) |
| **需要外网** | 40% (约1200个) |
| **有条件使用** | 10% (约300个) |

### 技能质量
- ✅ **高质量**: 900+ 维护活跃的技能
- ⚪ **中等质量**: 1500+ 功能完整但更新慢
- ⚠️ **低质量/过时**: 600+ 可能需要更新

### 中国适配度
OpenClawCN 在中国的适配非常出色:
- ✅ 专门的中国渠道(飞书/钉钉/企微/QQ)
- ✅ 完整的国内AI提供商支持(15个)
- ✅ 全套包管理器镜像
- ✅ 技能代理服务(ClawdSkillsProxy)
- ✅ 区域自动检测(timezone/locale)
- ⚠️ 仍有改进空间(embedding/VoIP/视频平台)

---

**生成时间**: 2026-02-16
**版本**: v1.0
**数据来源**: ClawdbotCN 代码库分析
