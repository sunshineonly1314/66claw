# Skills 全量审计 Part 3 — 修复行动计划

---

## 十一、修复行动计划

### 第一波 (P0): 覆盖面最大的系统级修复

解决 python3 (23 技能) + uv (16 技能) + node (30 技能) 的 Windows 自动安装问题。

#### 1.1 node — 已覆盖 ✅
- 安装包预置 node-portable
- post-install.bat 设置 PATH
- 无需额外操作

#### 1.2 python3 — 23 个技能受影响
**问题**: `requires.bins: ["python3"]` 但无 install spec，Windows 上无自动安装路径。

**方案 A (推荐)**: 在 `skills-install.ts` 的 `installSkill()` 中，当检测到 `python3` 缺失时，自动引导安装：
```
检测 python3 → 尝试 python → 提示用户安装 Python (python.org/downloads)
```

**方案 B**: 在常用 python3 技能的 SKILL.md 中统一加 install spec：
```json
{"id":"python-download","kind":"download","url":"https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe","bins":["python3"],"label":"Download Python (Windows)","os":["win32"]}
```

**涉及技能**: bambu-local, crypto-price, elevenlabs-skill, excel, fitbit-analytics, ga4, gemini-yt-video-transcript, george, granola, harvey, idealista, linkedin-cli, mbta, oura-analytics, protonmail, samsung-smartthings, searxng, serpapi-search, smalltalk, tesla-fleet-api, who-growth-charts, who-growth-charts-skill, withings-family

#### 1.3 uv — 16 个技能受影响
**问题**: `requires.bins: ["uv"]` 但 install spec 只有 brew。

**方案**: cn-mirrors.ts 已有 `BINARY_DOWNLOAD_MIRRORS.uv` 配置，只需在 `skills-install.ts` 中加自动安装 uv 逻辑（实际上代码中已有 `installUvDependency()` 函数，需确认是否正确触发）。

**涉及技能**: audio-reply-skill, chromecast-control (catt), comfy-cli, content-advisory, dexcom, elevenlabs-music, event-planner, grocery-list, harvey, karakeep, local-places, miniflux, nano-banana-pro, pptx-creator, slopesniper, stock-analysis, vikunja, xkcd

---

### 第二波 (P1): 小包打进安装包 + 大包加 ClawdSkillsProxy

#### P1-A: 新增 bundled-bins (小包 <10 MB，打进 Windows 安装包)

| 工具 | Windows 大小 | 来源 | 操作 |
|------|-------------|------|------|
| **openhue** | 3.7 MB | openhue/openhue-cli releases | setup.iss 新增 + SKILL.md 加 download spec |
| **spogo** | 5.3 MB | steipete/spogo releases | setup.iss 新增 + SKILL.md 加 download spec |
| **jira** | 6.9 MB | ankitpokhrel/jira-cli releases | setup.iss 新增 + SKILL.md 加 download spec |
| | **+15.9 MB** | | 安装包增至 ~37 MB |

#### P1-B: 新增 ClawdSkillsProxy 端点 (大包 >10 MB)

| 工具 | Windows 大小 | 来源 | cn-mirrors.ts 端点 |
|------|-------------|------|-------------------|
| **gh** (GitHub CLI) | 13.2 MB | cli/cli releases | `/api/binaries/gh` |
| **himalaya** | 12.8 MB | pimalaya/himalaya releases | `/api/binaries/himalaya` |
| **yt-dlp** | 17.5 MB | yt-dlp/yt-dlp releases | `/api/binaries/yt-dlp` |
| **uv** | 20.8 MB | astral-sh/uv releases | `/api/binaries/uv` |
| **rclone** | 26.8 MB | rclone/rclone releases | `/api/binaries/rclone` |
| | **合计 ~91 MB** | | LARGE_PACKAGE_PROXY_MAP 新增 5 条 |

#### P1-C: 其他方式

| 工具 | 方案 | 说明 |
|------|------|------|
| **whisper** (openai-whisper) | SKILL.md 加 pip/uv spec | 走清华 pypi，无需 proxy |
| **op** (1Password CLI) | 不处理 | 官方 .msi 安装器，用户手动装 |

---

### 第三波 (P2): 低优先级补充

小众工具，每个只有 1-2 个技能使用，优先级低。

| 类别 | 工具 | 方案 | 值得做? |
|------|------|------|--------|
| 搜索 | tldr | npm spec | 低 |
| 部署 | vercel | npm spec | 低 |
| 音频 | elevenlabs | pip spec | 低 |
| 密码 | dcli (Dashlane) | download spec | 低 |
| 区块链 | solana, spl-token | download spec | 低 |
| API | gkeep | pip spec | 低 |
| 智能家居 | starlink | cargo spec | 低 |
| 编辑器 | obsidian-cli | 待查 Release | 低 |
| LLM | gemini | 待查 npm/pip | 中 (3 技能) |

---

### 第四波 (P3): ClawdSkillsProxy 服务端部署汇总

| 端点 | 工具 | 大小 | 状态 |
|------|------|------|------|
| `/api/binaries/ffmpeg` | ffmpeg | ~80 MB | 代码已加，服务器 ❌ 待部署 |
| `/api/binaries/sherpa-onnx` | sherpa-onnx runtime + 模型 | ~130 MB | 代码已加，服务器 ❌ 待部署 |
| `/api/binaries/signal-cli` | signal-cli | ~40 MB | ✅ 已部署 |
| `/api/binaries/gh` | GitHub CLI | 13.2 MB | ❌ 待新增 |
| `/api/binaries/himalaya` | himalaya | 12.8 MB | ❌ 待新增 |
| `/api/binaries/yt-dlp` | yt-dlp | 17.5 MB | ❌ 待新增 |
| `/api/binaries/uv` | uv | 20.8 MB | ❌ 待新增 |
| `/api/binaries/rclone` | rclone | 26.8 MB | ❌ 待新增 |
| | | **总计 ~341 MB** | |

---

## 十二、131 种二进制完整分类汇总表

| 二进制 | 技能数 | 类别 | 安装方式 | Windows 大小 | Windows CN |
|--------|--------|------|---------|-------------|-----------|
| curl | 74 | S | 系统内置 | — | ✅ |
| jq | 58 | S | 系统/winget | — | ⚠️ |
| node | 30 | S | 安装包预置 | — | ✅ |
| python3 | 23 | C | 需手动安装 | ~30 MB (installer) | ⚠️ 需P0修复 |
| uv | 16 | C→B | ClawdSkillsProxy | 20.8 MB | ⚠️ 需P0修复 |
| mcporter | 8 | A | npm | ✅ |
| ffmpeg | 6 | B | ClawdSkillsProxy | ✅ |
| bash | 4 | S | Git Bash | ⚠️ |
| sqlite3 | 3 | S | 需安装 | ⚠️ |
| date | 3 | S | 系统 | ✅ |
| git | 3 | S | Git for Win | ⚠️ |
| gemini | 3 | C | brew only | ❌ 需P2查 |
| wacli | 3 | A | go install | ✅ |
| npm | 2 | S | 随 node | ✅ |
| npx | 2 | S | 随 npm | ✅ |
| remindctl | 2 | D | macOS only | ❌ |
| bird | 2 | A | npm | ✅ |
| bw | 2 | A | npm | ✅ |
| yt-dlp | 2 | C | brew+pip | ⚠️ 需P1修复 |
| whisper | 2 | C | brew only | ⚠️ 需P1修复 |
| tar | 2 | S | 系统 | ✅ |
| ordercli | 2 | A | go install | ✅ |
| mlx_whisper | 2 | D | macOS only (MLX) | ❌ |
| gog | 2 | B | 安装包预置 | ✅ |
| goplaces | 2 | B | 安装包预置 | ✅ |
| tmux | 2 | D | macOS/Linux | ❌ |
| obsidian-cli | 2 | C | brew only | ⚠️ 需P2查 |
| planka-cli | 2 | C | 无 spec | ⚠️ |
| qmd | 2 | A | npm | ✅ |
| railil | 2 | A | npm | ✅ |
| solana | 2 | C | 无 spec | ⚠️ |
| todoist | 2 | A | go install | ✅ |
| op | 1 | C | brew only | ⚠️ 需P1修复 |
| alexacli | 1 | A | go install | ✅ |
| fruitmail | 1 | A | npm | ✅ |
| atvremote | 1 | D | macOS only | ❌ |
| memo | 1 | D | macOS only | ❌ |
| grizzly | 1 | A | go install | ✅ |
| beepctl | 1 | A | npm | ✅ |
| beeper-cli | 1 | A | go install | ✅ |
| beeper | 1 | C | 无 spec | ⚠️ |
| rbw | 1 | C | 无 spec | ⚠️ |
| blogwatcher | 1 | A | go install | ✅ |
| blu | 1 | A | go install | ✅ |
| browsh | 1 | C | 无 spec | ⚠️ |
| firefox | 1 | S | 用户安装 | ⚠️ |
| calcurse | 1 | D | Linux only | ❌ |
| vdirsyncer | 1 | D | Linux (apt) | ❌ |
| khal | 1 | D | Linux (apt) | ❌ |
| camsnap | 1 | B | 安装包预置 | ✅ |
| catt | 1 | A | uv/pip | ✅ |
| rsync | 1 | D | macOS/Linux | ❌ |
| clawdhub | 1 | A | npm | ✅ |
| clippy | 1 | C | 不明 | ❓ |
| codexmonitor | 1 | C | brew only | ⚠️ |
| comfy | 1 | A | uv/pip | ✅ |
| confluence | 1 | A | npm | ✅ |
| dcli | 1 | C | 无 spec | ⚠️ |
| bun | 1 | A | npm | ✅ |
| drafts | 1 | D | macOS only | ❌ |
| eightctl | 1 | A | go install | ✅ |
| elevenlabs | 1 | C | pip possible | ⚠️ |
| firmenbuchat | 1 | C | brew+shell | ⚠️ |
| fitbit | 1 | C | 不明 | ❓ |
| playwright | 1 | A | pip/npm | ✅ |
| gifgrep | 1 | A | go install | ✅ |
| gifhorse | 1 | C | shell only | ⚠️ |
| gkeep | 1 | C | pip possible | ⚠️ |
| gotrain | 1 | A | npm | ✅ |
| gram | 1 | A | npm | ✅ |
| himalaya | 1 | C | brew only | ⚠️ 需P1修复 |
| brew | 1 | D | macOS only | ❌ |
| homeycli | 1 | A | npm | ✅ |
| icloud | 1 | D | macOS only | ❌ |
| claude | 1 | A | npm | ✅ |
| telegram | 1 | C | 不明 | ❓ |
| imsg | 1 | D | macOS only | ❌ |
| weasyprint | 1 | C | pip possible | ⚠️ |
| xcrun | 1 | D | macOS only | ❌ |
| jira | 1 | C | brew only | ⚠️ 需P2修复 |
| kallyai | 1 | A | pip | ✅ |
| linearis | 1 | A | npm | ✅ |
| lms | 1 | C | 官方 CLI | ⚠️ |
| mcd-cn | 1 | C | brew only | ⚠️ |
| codexbar | 1 | D | macOS only | ❌ |
| nano-pdf | 1 | A | uv/pip | ✅ |
| picoleaf | 1 | C | brew+shell | ⚠️ |
| nix | 1 | D | Linux/macOS | ❌ |
| nomad | 1 | C | HashiCorp | ⚠️ |
| npm-search-mcp-server | 1 | C | npm possible | ⚠️ |
| office-quotes | 1 | A | npm | ✅ |
| openhue | 1 | C | brew only | ⚠️ |
| base64 | 1 | S | certutil | ⚠️ |
| ppls | 1 | A | npm | ✅ |
| parakeet-mlx | 1 | D | macOS only (MLX) | ❌ |
| peekaboo | 1 | D | macOS only | ❌ |
| pet | 1 | C | go/download | ⚠️ |
| playwright-cli | 1 | A | npm | ✅ |
| lp/lpstat/lpadmin | 1 | D | macOS/Linux | ❌ |
| bc | 1 | D | 无 Windows | ❌ |
| rr | 1 | A | go install | ✅ |
| roborock | 1 | A | pipx | ✅ |
| roku | 1 | A | npm | ✅ |
| sag | 1 | B | 安装包预置 | ✅ |
| sf | 1 | A | npm | ✅ |
| rclone | 1 | C | 官方 .exe | ⚠️ |
| gpg | 1 | S | Gpg4win | ⚠️ |
| xvfb-run | 1 | D | Linux only | ❌ |
| sog | 1 | A | go install | ✅ |
| qrencode | 1 | C | 无 spec | ⚠️ |
| spl-token | 1 | C | 随 solana | ⚠️ |
| gh | 1 | C | 官方 .msi | ⚠️ 需P1修复 |
| songsee | 1 | D | 无 Windows 版 | ❌ |
| sonos | 1 | A | go install | ✅ |
| spotify | 1 | C | brew cask | ⚠️ |
| spogo | 2 | C | brew only | ⚠️ |
| spotify_player | 2 | C | brew only | ⚠️ |
| starlink | 1 | C | cargo | ⚠️ |
| summarize | 1 | D | 无 Windows 版 | ❌ |
| todo | 1 | A | download | ✅ |
| things | 1 | D | macOS only | ❌ |
| timesheet | 1 | C | 不明 | ❓ |
| tldr | 1 | C | npm possible | ⚠️ |
| td | 1 | D | brew only | ❌ |
| topydo | 1 | A | pip | ✅ |
| trein | 1 | A | npm+download | ✅ |
| units | 1 | C | 无 Windows | ⚠️ |
| vercel | 1 | C | npm possible | ⚠️ |
| vibetunnel | 1 | A | npm | ✅ |
| workout | 1 | C | 不明 | ❓ |
| ynab | 1 | A | npm | ✅ |

---

## 十三、覆盖率总结

### 按二进制工具

| 类别 | 工具数 | 占比 | 说明 |
|------|--------|------|------|
| ✅ S (系统) | 20 | 15% | 系统内置/标配 |
| ✅ A (镜像覆盖) | 42 | 32% | npm/pip/go/brew 镜像 |
| ✅ B (已打包/代理) | 10 | 8% | bundled + ClawdSkillsProxy + HK |
| ⚠️ C (需补充) | 38 | 29% | 有方案但未配置 |
| ❌ D (不可用) | 21 | 16% | 平台限制/无 Windows 版 |

### 按技能影响面

| 状态 | 技能数 | 占总 987 |
|------|--------|---------|
| 无依赖 (直接可用) | 712 | 72% |
| 依赖已覆盖 (S+A+B) | ~170 | 17% |
| 依赖需补充 (C) | ~70 | 7% |
| 平台不支持 (D) | ~35 | 4% |

### 修复后预期覆盖率

| 修复阶段 | 新增覆盖 | 累计覆盖 (有依赖的 275 个) |
|----------|---------|--------------------------|
| 当前 | — | 170/275 = **62%** |
| P0 (python3+uv) | +39 | 209/275 = **76%** |
| P1 (brew→download) | +6 | 215/275 = **78%** |
| P2 (次要工具) | +10 | 225/275 = **82%** |
| 理论最大值 | — | 240/275 = **87%** |

> 剩余 35 个技能 (13%) 因平台限制 (macOS only / Linux only / 上游无 Windows 版) 永远无法在 Windows 上使用。

---

## 十四、给用户的建议

### Windows CN 用户可直接使用的技能类型

1. **纯 Markdown 指令技能** (712 个) — 直接可用
2. **仅需 curl/jq** (~100 个) — 系统工具，通常已有
3. **仅需 node** (~30 个) — 安装包预置
4. **npm 生态工具** (~20 个) — npmmirror 自动安装
5. **go 工具** (~15 个) — goproxy.cn 自动安装
6. **pip/uv 工具** (~15 个) — 清华 pypi，需 python3 和 uv 预装
7. **预置工具** (camsnap/sag/gog/goplaces) — 开箱即用

### 需要额外手动安装的

1. **Python** — 从 python.org 下载安装
2. **Git** — 从 git-scm.com 下载安装 (通常已有)
3. **jq** — `winget install stedolan.jq` 或 scoop

---

## 十五、文件清单

| 文件 | 内容 |
|------|------|
| `docs/skills-full-audit-part1-overview.md` | 总览 + S/A/B 类工具详情 |
| `docs/skills-full-audit-part2-gaps.md` | C/D 类缺口分析 |
| `docs/skills-full-audit-part3-action-plan.md` | 修复计划 + 131 工具汇总表 |
| `docs/skills-cn-download-audit.md` | 本地 54 技能审计 (之前版本) |
| `dev/audit-skills-deps.cjs` | 审计脚本 (可重跑) |
