# Skills 全量依赖审计报告 (987 个技能)

> 审计日期: 2026-02-08
> 数据来源: `clawdhub-skills-mirror/cn/skills/` (987 个 SKILL.md)
> 审计目标: 确保中国区 Windows 用户能通过 **安装包预置 + 国内镜像 + ClawdSkillsProxy** 获取所有技能依赖

---

## 一、总体统计

| 指标 | 数量 |
|------|------|
| 技能总数 (含 SKILL.md) | 987 |
| 有 openclawcn metadata | 374 (38%) |
| 无 metadata (纯 Markdown 技能) | 613 (62%) |
| 有 requires.bins/env | 306 (31%) |
| 有 install spec | 102 (10%) |
| 有 package.json (npm 项目) | 64 (6%) |
| 无任何二进制依赖 | 712 (72%) |

**核心发现**: 72% 的技能无需安装任何二进制依赖（纯 Markdown 指令/脚本），只需通过 ClawdSkillsProxy ZIP 下载技能文件本身即可工作。

---

## 二、131 种唯一二进制依赖分类

### 分类方法
每个二进制按国内可获取性分为 5 类：

| 类别 | 说明 | 国内获取方式 |
|------|------|-------------|
| **S — 系统内置** | OS 自带或开发环境标配 | 无需下载 |
| **A — 镜像覆盖** | npm/pip/go/brew 有国内镜像 | npmmirror / 清华pypi / goproxy.cn / USTC bottles |
| **B — 已打包** | 安装包预置 .exe 或 ClawdSkillsProxy 托管 | 本地 bundled / ClawdSkillsProxy |
| **C — 需补充** | 有 Windows 版但当前无 CN 安装路径 | 需加 download spec 或补充到 proxy |
| **D — 不可用** | 上游无 Windows 版或仅限特定平台 | 无法覆盖 |

---

## 三、S 类 — 系统内置/标配 (20 种二进制, 影响 ~160 个技能)

这些工具要么系统自带，要么开发环境标配，无需特殊下载通道。

| 二进制 | 使用技能数 | 说明 | Windows 状态 |
|--------|-----------|------|-------------|
| **curl** | 74 | HTTP 客户端 | Windows 10+ 内置 ✅ |
| **jq** | 58 | JSON 处理 | 需 winget/scoop 安装 ⚠️ |
| **node** | 30 | Node.js 运行时 | 安装包预置 ✅ |
| **npm** | 2 | Node 包管理器 | 随 node 一起 ✅ |
| **npx** | 2 | Node 包执行器 | 随 npm 一起 ✅ |
| **bash** | 4 | Shell | Git Bash / WSL ⚠️ |
| **git** | 3 | 版本管理 | Git for Windows ⚠️ |
| **date** | 3 | 日期工具 | Windows 有 date 命令 ✅ |
| **tar** | 2 | 归档工具 | Windows 10+ 内置 ✅ |
| **sqlite3** | 3 | SQLite CLI | 需单独安装 ⚠️ |
| **base64** | 1 | 编码工具 | certutil 替代 ⚠️ |
| **bc** | 1 | 计算器 | 无 Windows 原生版 ❌ |
| **gpg** | 1 | 加密 | Gpg4win ⚠️ |
| **rsync** | 1 | 文件同步 | WSL only ❌ |
| **lp/lpstat/lpadmin** | 1 | 打印系统 | macOS/Linux only ❌ |
| **xcrun** | 1 | Xcode 工具 | macOS only ❌ |
| **xvfb-run** | 1 | 虚拟 X 服务 | Linux only ❌ |
| **nix** | 1 | Nix 包管理 | Linux/macOS ❌ |
| **units** | 1 | 单位转换 | 非标准 ⚠️ |
| **brew** | 1 | Homebrew | macOS only ❌ |

**小结**: curl/node/npm/npx/date/tar 在 Windows 上无需处理。jq/git/bash 用户通常已安装。其余为平台特定或极小众。

---

## 四、A 类 — 国内镜像覆盖 (42 种二进制, 影响 ~120 个技能)

### A1: npm 生态 (npmmirror.com 覆盖)

| 二进制 | 使用技能数 | npm 包名 | install spec 状态 |
|--------|-----------|---------|------------------|
| **mcporter** | 8 | mcporter | 有 node spec ✅ |
| **bird** | 2 | @steipete/bird | 有 brew spec (需补 node) ⚠️ |
| **oracle** | — | @steipete/oracle | 有 node spec ✅ (本地技能) |
| **beepctl** | 1 | beepctl | 有 npm spec ✅ |
| **clawdhub** | 1 | clawdhub | 有 node spec ✅ |
| **confluence** | 1 | confluence | 有 node spec ✅ |
| **gotrain** | 1 | gotrain | 有 node spec ✅ |
| **gram** | 1 | gram | 有 node spec ✅ |
| **homeycli** | 1 | homeycli | 有 node spec ✅ |
| **linearis** | 1 | linearis | 有 node spec ✅ |
| **office-quotes** | 1 | office-quotes | 有 node spec ✅ |
| **paperless/ppls** | 1 | ppls | 有 node spec ✅ |
| **playwright-cli** | 1 | playwright-cli | 有 node spec ✅ |
| **qmd** | 2 | qmd | 有 node spec ✅ |
| **railil** | 2 | railil | 有 node spec ✅ |
| **roku** | 1 | roku | 有 node spec ✅ |
| **salesforce/sf** | 1 | sf (sfdx-cli) | 有 node spec ✅ |
| **vibetunnel** | 1 | vibetunnel | 有 node spec ✅ |
| **ynab** | 1 | ynab | 有 node spec ✅ |
| **fruitmail** | 1 | fruitmail | 有 node spec ✅ |
| **bw** (Bitwarden) | 2 | @bitwarden/cli | 有 npm spec ✅ |
| **vercel** | 1 | vercel | 无 install spec ⚠️ |
| **todoist** | 2 | — | 有 brew+go spec ✅ |

**状态**: npm 生态 → npmmirror.com 镜像 → CN 可下载 ✅

### A2: Python/uv 生态 (清华 pypi 覆盖)

| 二进制 | 使用技能数 | pip/uv 包名 | install spec 状态 |
|--------|-----------|------------|------------------|
| **python3** | 23 | — (运行时) | 需手动安装 Python ⚠️ |
| **uv** | 16 | uv (pip install uv) | 有 brew spec (需补 download) ⚠️ |
| **nano-pdf** | 1 | nano-pdf | 有 uv spec ✅ |
| **whisper** | 2 | openai-whisper | 有 brew spec (需补 pip) ⚠️ |
| **mlx_whisper** | 2 | mlx-whisper | 有 pip spec ✅ (macOS only) |
| **chromecast-control/catt** | 1 | catt | 有 uv spec ✅ |
| **comfy** (ComfyUI) | 1 | comfy-cli | 有 uv spec ✅ |
| **parakeet-mlx** | 1 | parakeet-mlx | 有 uv spec ✅ |
| **kallyai** | 1 | kallyai | 有 pip spec ✅ |
| **topydo** | 1 | topydo | 有 pip spec ✅ |
| **roborock** | 1 | roborock | 有 pipx spec ✅ |
| **slopesniper** | 1 | slopesniper | 有 uv spec ✅ |
| **playwright** | 1 | playwright | pip install ⚠️ |

**状态**: pip/uv 包 → 清华 pypi 镜像 → CN 可下载 ✅
**注意**: python3 本身和 uv 本身在 Windows 上需要额外的 download spec。

### A3: Go 生态 (goproxy.cn 覆盖)

| 二进制 | 使用技能数 | go module | install spec 状态 |
|--------|-----------|----------|------------------|
| **blogwatcher** | 1 | github.com/Hyaxia/blogwatcher/... | 有 go spec ✅ |
| **blucli/blu** | 1 | github.com/steipete/blucli/... | 有 go spec ✅ |
| **eightctl** | 1 | github.com/steipete/eightctl/... | 有 go spec ✅ |
| **food-order/ordercli** | 2 | github.com/steipete/ordercli/... | 有 go spec ✅ |
| **gifgrep** | 1 | github.com/steipete/gifgrep/... | 有 go spec ✅ |
| **sonoscli/sonos** | 1 | github.com/steipete/sonoscli/... | 有 go spec ✅ |
| **wacli** | 3 | github.com/steipete/wacli/... | 有 go spec ✅ |
| **bear-notes/grizzly** | 1 | github.com/tylerwince/grizzly/... | 有 go spec ✅ |
| **things-mac/things** | 1 | github.com/ossianhempel/... | 有 go spec ✅ (macOS only) |
| **beeper/beeper-cli** | 1 | — | 有 go spec ✅ |
| **todoist-cli/todoist** | 2 | — | 有 go spec ✅ |
| **roadrunner/rr** | 1 | — | 有 go spec ✅ |
| **sogcli/sog** | 1 | — | 有 go spec ✅ |
| **alexa-cli/alexacli** | 1 | — | 有 go spec ✅ |

**状态**: go install → GOPROXY=goproxy.cn → CN 可下载 ✅

### A4: brew 官方 formula (USTC bottles 覆盖, 仅 macOS)

以下工具使用 brew 官方 formula（非自定义 tap），macOS 上可通过 USTC bottles 镜像安装。

| 二进制 | 使用技能数 | brew formula | Windows 替代 |
|--------|-----------|-------------|-------------|
| **ffmpeg** | 6 | ffmpeg | ClawdSkillsProxy ✅ |
| **gemini** | 3 | gemini-cli | 无 Windows 版 ❌ |
| **himalaya** | 1 | himalaya | 有 GitHub Release ⚠️ |
| **op** (1Password) | 1 | 1password-cli | 有官方 .exe ⚠️ |
| **gh** (GitHub CLI) | 1 | gh | 有官方 .msi ⚠️ |
| **jira** | 1 | jira-cli | 有 GitHub Release ⚠️ |
| **obsidian-cli** | 2 | yakitrak/yakitrak/obsidian-cli | 需查 ⚠️ |
| **openhue** | 1 | openhue/cli/openhue-cli | 需查 ⚠️ |
| **spotify** | 1 | spotify (brew cask) | 官方 .exe ⚠️ |
| **yt-dlp** | 2 | yt-dlp | 有 GitHub Release / pip ⚠️ |
| **todoist** | 2 | todoist | 有 go install 兜底 ✅ |
| **td** (todoist-rs) | 1 | todoist-rs | brew only ❌ |
| **openai-whisper** | 2 | openai-whisper | pip install ⚠️ |

**状态**: macOS → USTC bottles ✅ / Windows → 需逐个检查替代方案

---

## 五、B 类 — 已打包/已代理 (17 种二进制)

### B1: Windows 安装包预置 (bundled-bins) — 已配置 + 待新增

**阈值**: <10 MB 的小包打进安装包，>10 MB 走 ClawdSkillsProxy。

| 二进制 | 来源 | Windows 大小 | setup.iss 状态 |
|--------|------|-------------|---------------|
| **camsnap** | steipete/camsnap | 4.0 MB | ✅ 已配置 |
| **sag** | steipete/sag | 5.5 MB | ✅ 已配置 |
| **gog** | steipete/gogcli | 7.7 MB | ✅ 已配置 |
| **goplaces** | steipete/goplaces | 3.2 MB | ✅ 已配置 |
| **openhue** | openhue/openhue-cli | 3.7 MB | ❌ 待新增 |
| **spogo** | steipete/spogo | 5.3 MB | ❌ 待新增 |
| **jira** | ankitpokhrel/jira-cli | 6.9 MB | ❌ 待新增 |
| | | **合计 ~36 MB** | |

### B2: ClawdSkillsProxy 大包代理 (>10 MB)

| 二进制 | Windows 大小 | 端点 | 状态 |
|--------|-------------|------|------|
| **ffmpeg** | ~80 MB | `/api/binaries/ffmpeg` | 代码已加 ✅，服务器待部署 ⚠️ |
| **sherpa-onnx** (runtime) | ~35 MB (win) | `/api/binaries/sherpa-onnx` | 代码已加 ✅，服务器待部署 ⚠️ |
| **sherpa-onnx** (模型) | ~30 MB | `/api/binaries/sherpa-onnx` | 同上 |
| **signal-cli** | ~40 MB | `/api/binaries/signal-cli` | ✅ 已部署 |
| **gh** (GitHub CLI) | 13.2 MB | 待加端点 | ❌ 待新增 |
| **himalaya** | 12.8 MB | 待加端点 | ❌ 待新增 |
| **yt-dlp** | 17.5 MB | 待加端点 | ❌ 待新增 |
| **uv** | 20.8 MB | 待加端点 | ❌ 待新增 |
| **rclone** | 26.8 MB | 待加端点 | ❌ 待新增 |
| | **新增合计 ~91 MB** | | |

### B3: HK 二进制服务器 (运行时下载)

| 二进制 | 状态 |
|--------|------|
| ordercli, peekaboo, remindctl, imsg | ✅ 已同步 |
| camsnap, wacli, sag, gog, spogo | ✅ 已同步 |
| summarize, songsee, goplaces | ✅ 已同步 |

---

## 六、安装方式 (install spec kind) 分布

ClawdHub 987 个技能中，102 个有 install spec，分布如下：

| kind | 数量 | 国内镜像 | Windows 支持 |
|------|------|---------|-------------|
| brew | 54 | USTC bottles | ❌ (macOS only) |
| node | 21 | npmmirror | ✅ |
| go | 17 | goproxy.cn | ✅ |
| shell | 8 | — | ⚠️ 需 bash |
| download | 6 | GitHub proxy | ✅ |
| uv | 5 | 清华 pypi | ✅ |
| pip | 5 | 清华 pypi | ✅ |
| npm | 3 | npmmirror | ✅ |
| python | 3 | 清华 pypi | ✅ |
| choco | 2 | chocolatey.org | ✅ (Windows) |
| cargo | 1 | bytedance 镜像 | ✅ |
| apt | 1 | 清华/阿里 | ❌ (Linux) |
| pipx | 1 | 清华 pypi | ✅ |
| docker-compose | 1 | 阿里云 Docker | ✅ |
| git | 1 | — | ✅ |

**核心问题**: 54 个 brew spec 在 Windows 上全部被 `normalizeInstallOptions()` 过滤掉。如果技能 ONLY 有 brew spec，则 Windows 上无安装路径。
