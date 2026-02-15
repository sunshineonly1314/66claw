# OpenClawCN Skills 生态三平台深度对比报告

> 调研日期: 2026-02-09 | 基于 master 分支代码分析

---

## 一、总览：三平台支持现状

| 维度 | macOS (darwin) | Windows (win32) | Linux |
|------|:---:|:---:|:---:|
| **核心 Gateway 运行** | 完全支持 | 完全支持 | 部分支持（无安装器） |
| **Skills 加载引擎** | 完全支持 | 完全支持 | 完全支持 |
| **Skills 安装机制** | brew / pip / go / node / uv | pip / go / node / uv / download | pip / go / node / uv / download |
| **桌面控制 (desktop-control)** | 未实现 | PowerShell 实现 | 未实现 |
| **应用启动 (open-app)** | 未实现 | PowerShell+Registry 实现 | 未实现 |
| **系统托盘服务** | launchd (daemon) | C# WinForms 托盘服务 | 无 |
| **安装器/打包** | .pkg/.dmg (计划中) | Inno Setup .exe | 无 |
| **bundled-bins (预打包二进制)** | 无 | 7 个 CLI 工具预打包 | 无 |
| **CN 镜像下载引擎** | 完全支持 | 完全支持 | 完全支持 |
| **WSL 集成** | N/A | 有 WSL 脚本支持 | N/A |
| **Windows ACL 安全** | N/A | 已实现 | N/A |

---

## 二、Skills 分类与平台兼容性完整矩阵

### 2.1 核心 Skills（`skills/` 目录）

| Skill | 用途 | macOS | Windows | Linux | 依赖 | 安装方式 |
|-------|------|:---:|:---:|:---:|------|---------|
| **1password** | 密码管理 | ✅ | ⚠️ | ⚠️ | `op` CLI | brew / download |
| **camsnap** | 摄像头截图 | ✅ | ✅ | ❌ | `camsnap` | brew / bundled-bin |
| **canvas** | 画布工具 | ✅ | ✅ | ✅ | 无外部依赖 | 内置 |
| **desktop-control** | 桌面控制 | ❌ | ✅ | ❌ | PowerShell | 内置（仅 Win） |
| **gemini** | Gemini AI | ✅ | ✅ | ✅ | `uv` | brew / pip |
| **github** | GitHub 操作 | ✅ | ✅ | ✅ | `gh` CLI | brew / download |
| **gog** | Google Workspace | ✅ | ✅ | ⚠️ | `gog` | brew / bundled-bin |
| **goplaces** | Google Places | ✅ | ✅ | ⚠️ | `goplaces` + API KEY | brew / download |
| **himalaya** | 邮件客户端 | ✅ | ✅ | ✅ | `himalaya` | brew / download |
| **local-places** | 本地地点搜索 | ✅ | ✅ | ✅ | `uv` + API KEY | brew / pip |
| **nano-banana-pro** | 图片生成 | ✅ | ✅ | ✅ | `uv` + GEMINI_API_KEY | brew / pip |
| **obsidian** | 笔记管理 | ✅ | ⚠️ | ⚠️ | `obsidian-cli` | brew / go install |
| **open-app** | 启动应用 | ❌ | ✅ | ❌ | PowerShell | 内置（仅 Win） |
| **openai-whisper** | 语音转文字 | ✅ | ✅ | ✅ | `whisper` | brew / pip |
| **openhue** | 智能灯控制 | ✅ | ✅ | ⚠️ | `openhue` | brew / bundled-bin |
| **packaging** | 打包工具 | ✅ | ✅ | ✅ | 无外部依赖 | 内置 |
| **sag** | TTS 语音 | ✅ | ✅ | ⚠️ | `sag` + API KEY | brew / bundled-bin |
| **songsee** | 音乐识别 | ✅ | ⚠️ | ⚠️ | `songsee` | brew / download |
| **spotify-player** | Spotify | ✅ | ⚠️ | ⚠️ | `spogo` | brew / bundled-bin |
| **summarize** | 内容总结 | ✅ | ✅ | ✅ | `uv` | brew / pip |
| **video-frames** | 视频帧提取 | ✅ | ✅ | ✅ | `uv` | brew / pip |

### 2.2 仅 macOS 的 Skills（Windows/Linux 完全不可用）

| Skill | 原因 | Windows 替代方案建议 | Linux 替代方案建议 |
|-------|------|-------------------|------------------|
| **apple-notes** | 依赖 AppleScript/macOS Notes.app | ❌ 无直接替代，可用 Obsidian | ❌ 无替代 |
| **apple-reminders** | 依赖 macOS Reminders.app | Microsoft To-Do CLI | Todoist CLI |
| **bear-notes** | 依赖 Bear.app (macOS-only) | Obsidian / Notion | Obsidian |
| **imsg** | 依赖 iMessage (macOS-only) | ❌ 无替代 | ❌ 无替代 |
| **bird** | 依赖 macOS 特定 API | 需调研 | 需调研 |

### 2.3 仅 Windows 的 Skills/Tools

| Skill/Tool | 功能 | macOS 替代方案 | Linux 替代方案 |
|------------|------|-------------|-------------|
| **desktop-control** | 截屏/点击/键入/窗口管理 | AppleScript + screencapture | xdotool + scrot/maim |
| **open-app** | 搜索并启动应用（含中文别名） | `open -a` | xdg-open / .desktop 文件 |

### 2.4 跨平台 Skills（全平台理论可用）

以下 skills 不依赖特定 OS，主要通过 API 或 curl 工作：

| Skill | 依赖 | 说明 |
|-------|------|------|
| **weather** | `curl` | 全平台完美支持 |
| **trello** | `jq` + API KEY | 全平台（jq 全平台可用） |
| **discord** | OpenClawCN 内置 channel | 全平台（无 CLI 依赖） |
| **slack** | OpenClawCN 内置 channel | 全平台 |
| **voice-call** | Twilio/Telnyx 插件 | 全平台 |
| **coding-agent** | 无外部依赖 | 全平台 |
| **model-usage** | 无外部依赖 | 全平台 |

---

## 三、安装机制跨平台对比

### 3.1 包管理器支持矩阵

| 安装方式 (SkillInstallSpec.kind) | macOS | Windows | Linux | 说明 |
|---|:---:|:---:|:---:|---|
| **brew** | ✅ 原生 | ❌ 自动过滤 | ❌ 可选(linuxbrew) | `skills-status.ts` L112: `if (spec.kind === "brew" && platform !== "darwin") return false` |
| **pip** | ✅ | ✅ | ✅ | Python pip，全平台 |
| **node** (npm/pnpm/yarn/bun) | ✅ | ✅ | ✅ | 全平台，可配置 nodeManager |
| **go** | ✅ | ✅ | ✅ | `skills-install.ts` 有 `WINDOWS_GO_PATHS` 兜底 |
| **uv** | ✅ | ✅ | ✅ | Python uv 全平台 |
| **download** | ✅ | ✅ | ✅ | 直接下载二进制，可指定 `os` 字段 |

### 3.2 Windows 特殊处理

`skills-install.ts` 已有以下 Windows 适配：

1. **Go 路径发现** (`WINDOWS_GO_PATHS`):
   - `C:\Program Files\Go\bin\go.exe`
   - `C:\Go\bin\go.exe`
   - `%LOCALAPPDATA%\Programs\Go\bin\go.exe`
   - `%USERPROFILE%\scoop\apps\go\current\bin\go.exe`

2. **Python Scripts 目录发现** (`resolvePythonScriptsDir()`):
   - 通过 `python -c "import sys; print(sys.executable)"` 定位
   - 兜底搜索 `%APPDATA%\Local\Programs\Python\Scripts`

3. **bundled-bins 预打包**: Windows 安装器捆绑 7 个小工具
   - camsnap.exe, sag.exe, gog.exe, goplaces.exe, openhue.exe, spogo.exe, jira.exe

### 3.3 ClawdSkillsProxy 跨平台二进制分发

`download-proxy-binaries.ps1` 定义了通过代理服务器分发大型工具：

| 工具 | Windows | macOS x64 | macOS arm64 | Linux x64 |
|------|:---:|:---:|:---:|:---:|
| **gh** (GitHub CLI) | ✅ | ✅ | ✅ | ✅ |
| **himalaya** (邮件) | ✅ | ✅ | ✅ | ✅ |
| **yt-dlp** (视频下载) | ✅ | ✅ | N/A | ✅ |
| **uv** (Python) | ✅ | ✅ | ✅ | ✅ |

---

## 四、关键缺口分析

### 4.1 Windows 缺口 (需要补齐)

| 缺口 | 优先级 | 说明 | 建议方案 |
|------|:---:|------|---------|
| **brew 替代安装路径** | P0 | 大量 skill 仅提供 brew 安装选项 | 为每个 skill 补充 `download` 或 `choco`/`scoop`/`winget` 安装方式 |
| **obsidian-cli 安装** | P1 | 仅有 brew 和 go install | 添加 `download` 方式，预编译 Windows 二进制 |
| **Obsidian vault 路径** | P1 | SKILL.md 硬编码 `~/Library/Application Support/obsidian/` | 需适配 `%APPDATA%/obsidian/obsidian.json` |
| **macOS 特有命令** | P1 | 部分 SKILL.md 中有 `pbcopy`、`open` 等 macOS 命令 | 需审计并替换为跨平台命令 |
| **1password CLI 安装** | P2 | brew 安装路径，无 Windows 替代 | 添加 winget/msi 安装方式 |
| **songsee 二进制** | P2 | 仅 brew + download，download 未指定 Windows | 补充 Windows 下载 URL |

### 4.2 Linux 缺口 (需要补齐)

| 缺口 | 优先级 | 说明 | 建议方案 |
|------|:---:|------|---------|
| **无安装器** | P0 | 没有 Linux 打包/安装方案 | 提供 .deb/.rpm + AppImage + Docker |
| **无系统服务** | P0 | 无 systemd unit 或 init script | 提供 systemd service 文件 |
| **无桌面控制** | P1 | desktop-control 仅 Windows | 用 xdotool + scrot/maim 实现 |
| **无应用启动** | P1 | open-app 仅 Windows | 用 xdg-open + .desktop 文件解析 |
| **camsnap 不可用** | P2 | 无 Linux 二进制 | 用 ffmpeg + v4l2 实现摄像头截图 |
| **apt 安装支持** | P1 | skill install spec 无 `apt` kind | 扩展 SkillInstallSpec 支持 apt |
| **无 bundled-bins** | P1 | 无 Linux 预编译二进制捆绑 | 构建 Linux 版 bundled-bins |

### 4.3 macOS 缺口 (现有但需完善)

| 缺口 | 优先级 | 说明 | 建议方案 |
|------|:---:|------|---------|
| **无桌面控制** | P1 | desktop-control 仅 Windows 实现 | 用 AppleScript + screencapture 实现 |
| **无应用启动工具** | P2 | open-app 仅 Windows 实现 | 用 `open -a` + `mdfind` 实现 |
| **CN 打包** | P1 | macOS CN 打包方案仍在规划中 | 完成 .pkg 打包脚本 |

---

## 五、平台适配工具实现现状

### 5.1 desktop-control 实现分析

**当前状态**: 仅 Windows (PowerShell)

| 功能 | Windows 实现 | macOS 方案 | Linux 方案 |
|------|:---:|:---:|:---:|
| screenshot (截屏) | PowerShell `System.Drawing` | `screencapture -x` | `scrot` / `maim` / `import` |
| click (点击) | PowerShell `SendInput` | `cliclick` / AppleScript | `xdotool` |
| type (输入文字) | PowerShell `SendKeys` + clipboard | `cliclick` / `osascript` | `xdotool type` |
| key (快捷键) | PowerShell `SendKeys` | `osascript -e 'keystroke'` | `xdotool key` |
| list_windows (窗口列表) | PowerShell `Get-Process` | `osascript` | `wmctrl -l` |
| focus (窗口焦点) | PowerShell `SetForegroundWindow` | `osascript 'activate'` | `wmctrl -a` |

### 5.2 open-app 实现分析

**当前状态**: 仅 Windows (PowerShell + Registry)

搜索策略（按优先级）：
1. **App Paths registry** — 最快最直接
2. **Start Menu shortcuts (.lnk)** — 覆盖大多数已安装应用
3. **File system scan** — `Program Files` / `Program Files (x86)` 目录
4. **UWP apps** — Microsoft Store 应用

特色功能：
- 中文别名映射（"微信" → "WeChat", "钉钉" → "DingTalk" 等）
- 非应用 exe 黑名单（uninstall, updater, crashpad_handler 等）
- UWP shell 启动 URI 支持

| 功能 | Windows 实现 | macOS 方案 | Linux 方案 |
|------|:---:|:---:|:---:|
| 按名搜索应用 | Registry + lnk + fs | `mdfind "kMDItemKind == Application"` | `/usr/share/applications/*.desktop` |
| 启动应用 | `Start-Process` / `shell:AppsFolder` | `open -a "AppName"` | `xdg-open` / `gtk-launch` |
| 中文别名 | 内置 APP_ALIASES | 同样内置 | 同样内置 |

---

## 六、推荐实施路线图

### 第一阶段：P0 基础设施（1-2 周）

1. **为所有 brew-only skills 补充 download 安装方式**
   - 审计所有 SKILL.md，给 Windows/Linux 添加 `download` 或 `scoop`/`winget` 路径
   - 重点：1password, obsidian-cli, songsee

2. **Linux 安装方案**
   - 提供 Docker Compose 部署方案（小白最友好）
   - 提供 systemd service 文件
   - 考虑 AppImage 单文件分发

3. **扩展 SkillInstallSpec**
   - 新增 `apt` / `scoop` / `winget` kind 支持
   - 在 `skills-install.ts` 中实现对应安装逻辑

### 第二阶段：P1 功能补齐（2-4 周）

4. **desktop-control 跨平台实现**
   - macOS: AppleScript + screencapture
   - Linux: xdotool + scrot（需检测 X11/Wayland）

5. **open-app 跨平台实现**
   - macOS: `open -a` + `mdfind`
   - Linux: 解析 `.desktop` 文件 + `xdg-open`

6. **SKILL.md 路径跨平台审计**
   - 替换所有 `~/Library/...` 为平台感知路径
   - 替换 `pbcopy`/`pbpaste` 为平台感知剪贴板命令
   - 使用 `{configDir}` 等占位符

### 第三阶段：P2 体验优化（4-6 周）

7. **Linux bundled-bins 构建流水线**
   - 为 camsnap, sag, gog, goplaces 等编译 Linux 二进制
   - 集成到 ClawdSkillsProxy 分发

8. **Scoop/Winget 生态对接**
   - 为核心 CLI 工具创建 Scoop bucket
   - 提交 Winget manifest

9. **平台特有 skill 替代品**
   - apple-notes → Obsidian skill (已有，推荐)
   - apple-reminders → Todoist CLI skill (新建)
   - imsg → BlueBubbles skill (已有)

---

## 七、小白用户友好度评估

### 7.1 安装体验

| 步骤 | macOS | Windows | Linux |
|------|:---:|:---:|:---:|
| 安装 OpenClawCN 本体 | ⭐⭐⭐ (npm/brew) | ⭐⭐⭐⭐⭐ (一键 exe 安装器) | ⭐⭐ (需 npm 或 Docker) |
| 安装 Skill 依赖 | ⭐⭐⭐⭐ (brew 一条命令) | ⭐⭐⭐ (bundled-bins 帮忙，但部分需手动) | ⭐⭐ (全部需手动) |
| 首次配置 | ⭐⭐⭐ | ⭐⭐⭐⭐ (Setup Wizard) | ⭐⭐ |
| 日常使用 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (托盘图标) | ⭐⭐⭐ (需终端) |

### 7.2 最佳实践建议

**面向小白用户的优先改进**:

1. **Windows**: 扩大 bundled-bins 范围，让更多 skill 开箱即用
2. **Linux**: 提供 Docker 一键部署脚本 + docker-compose.yml
3. **全平台**: 在 UI Skills 页面显示"一键安装"按钮（已有批量安装基础设施）
4. **全平台**: Skill 依赖检测失败时，显示清晰的安装指引（已有 `skills-status.ts` 基础）

---

## 八、数据补充：Windows 部署技能包清单

`build/windows/deploy/skills/` 已包含 **40+** 个预部署 skill：

```
1password, apple-notes*, apple-reminders*, bear-notes*, bird*, blogwatcher,
blucli, bluebubbles, camsnap, canvas, coding-agent, desktop-control,
discord, eightctl, food-order, gemini, gifgrep, github, gog, goplaces,
himalaya, imsg*, local-places, mcporter, model-usage, nano-banana-pro,
nano-pdf, notion, obsidian, open-app, openai-whisper, openhue, oracle,
sag, sherpa-onnx-tts, skill-creator, slack, songsee, spotify-player,
summarize, things-mac*, trello, video-frames, voice-call, weather
```

> 标 * 的是 macOS-only skills，在 Windows 上会因 OS 检查被自动标记为 ineligible

---

## 九、结论

**macOS** 是当前功能最完整的平台（得益于 brew 生态），但缺少 desktop-control 和 open-app 两个交互工具。

**Windows** 在安装器和系统服务方面最成熟，且有独占的 desktop-control 和 open-app 工具，主要缺口是 brew-only skills 需要替代安装路径。

**Linux** 是适配最薄弱的平台，缺少安装器、系统服务、桌面控制、应用启动等关键基础设施，需要优先补齐。

**建议优先级**:
1. 补全 Windows/Linux 的 skill 安装路径（影响面最广）
2. Linux 部署方案（Docker + systemd）
3. desktop-control / open-app 跨平台实现
4. 扩展 SkillInstallSpec 支持 apt/scoop/winget

---

## 十、逐个 Skill 精确适配方案（SKILL.md 审计）

### 10.1 已有跨平台 download 的 Skills（无需改动）

以下 skills 的 SKILL.md 已经正确包含 `os: ["win32", "linux"]` 的 download 选项：

| Skill | install 规格 | 状态 |
|-------|-------------|------|
| **camsnap** | brew + download(win32,linux) | OK |
| **gog** | brew + download(win32,linux) | OK |
| **goplaces** | brew + download(win32,linux) | OK |
| **himalaya** | brew + download(win32,linux) | OK |
| **openhue** | brew + download(win32,linux) | OK |
| **sag** | brew + download(win32,linux) | OK |
| **video-frames** | brew + download(win32, ffmpeg) | OK |
| **github** | brew + download(win32) + apt | OK（Linux 有 apt） |

### 10.2 需要修复的 Skills（download.os 限制错误）

#### songsee — download 仅 darwin，需加 win32+linux

```
当前: "os": ["darwin"]  ← 错误！Windows 部署文件夹里也是 darwin
修复: 添加 win32 和 linux 下载选项
```

**修改**: `skills/songsee/SKILL.md` metadata:
```json
"install": [
  {"id":"brew","kind":"brew","formula":"steipete/tap/songsee","bins":["songsee"]},
  {"id":"download-mac","kind":"download","url":"https://github.com/steipete/songsee/releases/latest","bins":["songsee"],"os":["darwin"]},
  {"id":"download-win","kind":"download","url":"https://github.com/steipete/songsee/releases/latest","bins":["songsee"],"os":["win32"]},
  {"id":"download-linux","kind":"download","url":"https://github.com/steipete/songsee/releases/latest","bins":["songsee"],"os":["linux"]}
]
```

#### summarize — download 仅 darwin，需加 win32+linux

```
当前: "os": ["darwin"]  ← 同样错误
修复: 同上模式
```

### 10.3 仅 brew/pip 安装的 Skills（需补充替代方案）

#### 1password — 仅 brew

```
当前: install: [{"kind":"brew","formula":"1password-cli"}]
缺失: Windows (winget), Linux (apt repo)
```

**推荐修改**:
```json
"install": [
  {"id":"brew","kind":"brew","formula":"1password-cli","bins":["op"]},
  {"id":"download","kind":"download","url":"https://developer.1password.com/docs/cli/get-started/#install","bins":["op"],"label":"Download 1Password CLI","os":["win32","linux"]}
]
```

#### obsidian — 仅 brew + go

```
当前: install: [{"kind":"brew","formula":"obsidian-cli"}, {"kind":"go","module":"..."}]
缺失: Windows/Linux 预编译二进制
```

**推荐修改**: 追加 download 选项指向 GitHub releases

#### openai-whisper — 仅 brew + pip

```
当前: install: [{"kind":"brew","formula":"openai-whisper"}, {"kind":"pip","package":"openai-whisper"}]
状态: pip 全平台可用 ✅ — 无需修改（pip 在 Windows/Linux 均可用）
```

#### gemini — 仅 brew + npm

```
当前: install 含 npm，全平台可用 ✅ — 无需修改
```

### 10.4 SKILL.md 中 macOS 特定路径/命令审计

| Skill | 问题 | 具体内容 | 修复方案 |
|-------|------|---------|---------|
| **obsidian** | macOS 路径 | `~/Library/Application Support/obsidian/obsidian.json` | 添加平台判断说明: Win=`%APPDATA%/obsidian/`, Linux=`~/.config/obsidian/` |
| **sag** | 临时文件路径 | `/tmp/voice-reply.mp3` | Linux 兼容，Windows 需用 `%TEMP%` |
| **whisper** | 缓存路径 | `~/.cache/whisper` | Linux 兼容，Windows 需 `%LOCALAPPDATA%/whisper` |
| **summarize** | 配置路径 | `~/.summarize/config.json` | Linux 兼容，Windows 需 `%USERPROFILE%/.summarize/` |

---

## 十一、desktop-control 跨平台实现技术方案

### 11.1 架构设计

```
desktop-control.ts (统一入口)
  ├── platform === "win32"  → PowerShell + Win32 API (已有)
  ├── platform === "darwin" → AppleScript + screencapture (新建)
  └── platform === "linux"  → 多后端自适应 (新建)
                               ├── Wayland? → grim/slurp + ydotool + wtype
                               └── X11?     → scrot/maim + xdotool + xdotool type
```

### 11.2 Linux 实现方案（X11 + Wayland 双后端）

**关键发现**：2025-2026 年 Wayland 已成为主流（Ubuntu 24.04/Fedora 40+ 默认 Wayland），必须同时支持。

#### 显示服务器检测

```typescript
function detectDisplayServer(): "x11" | "wayland" | "unknown" {
  if (process.env.WAYLAND_DISPLAY) return "wayland";
  if (process.env.DISPLAY) return "x11";
  // 兜底检测
  try {
    const session = execSync("loginctl show-session $(loginctl | grep $(whoami) | awk '{print $1}') -p Type --value", { encoding: "utf-8" }).trim();
    if (session === "wayland") return "wayland";
    if (session === "x11") return "x11";
  } catch {}
  return "unknown";
}
```

#### 各功能的 Linux 实现

| 功能 | X11 方案 | Wayland 方案 | 依赖 |
|------|---------|-------------|------|
| **screenshot** | `scrot /tmp/screenshot.png` 或 `maim /tmp/screenshot.png` | `grim /tmp/screenshot.png` | scrot/maim, grim |
| **screenshot (窗口)** | `maim -i $(xdotool search --name "title")` | `grim -g "$(swaymsg -t get_tree \| ...)"` | maim+xdotool, grim+swaymsg |
| **click** | `xdotool mousemove X Y && xdotool click 1` | `ydotool mousemove --absolute X Y && ydotool click 1` | xdotool, ydotool |
| **type** | `xdotool type --clearmodifiers "text"` | `wtype "text"` 或 `ydotool type "text"` | xdotool, wtype/ydotool |
| **key** | `xdotool key ctrl+c` | `wtype -M ctrl -P c -m ctrl` 或 `ydotool key ctrl+c` | xdotool, wtype/ydotool |
| **list_windows** | `wmctrl -l` | `swaymsg -t get_tree` 或 `hyprctl clients` | wmctrl, swaymsg/hyprctl |
| **focus** | `wmctrl -a "title"` | `swaymsg '[title="..."] focus'` | wmctrl, swaymsg |

#### 依赖安装（小白友好脚本）

```bash
# Ubuntu/Debian (X11)
sudo apt install xdotool scrot wmctrl

# Ubuntu/Debian (Wayland)
sudo apt install grim slurp ydotool wtype

# Fedora (X11)
sudo dnf install xdotool scrot wmctrl

# Fedora (Wayland)
sudo dnf install grim slurp ydotool wtype

# Arch
sudo pacman -S xdotool scrot wmctrl grim slurp ydotool wtype
```

#### 推荐方案：ydotool 优先策略

**ydotool** 是最推荐的方案，因为：
- 同时支持 X11 和 Wayland（通过 /dev/uinput）
- API 与 xdotool 相似，迁移成本低
- 在主流发行版仓库中均有打包
- 唯一缺点：需要 root 或 uinput 组权限

```bash
# 一次性权限配置
sudo usermod -aG input $USER
# 或创建 udev 规则
echo 'KERNEL=="uinput", GROUP="input", MODE="0660"' | sudo tee /etc/udev/rules.d/80-uinput.rules
```

### 11.3 macOS 实现方案

| 功能 | macOS 方案 | 命令示例 |
|------|-----------|---------|
| **screenshot** | `screencapture` (系统内置) | `screencapture -x /tmp/screenshot.png` |
| **screenshot (窗口)** | `screencapture -l <windowID>` | 通过 `osascript` 获取窗口 ID |
| **click** | `cliclick` (brew) 或 CGEvent API | `cliclick c:X,Y` |
| **type** | `osascript` | `osascript -e 'tell app "System Events" to keystroke "text"'` |
| **key** | `osascript` | `osascript -e 'tell app "System Events" to key code 36'` |
| **list_windows** | `osascript` | JXA 脚本遍历 Application.windows() |
| **focus** | `osascript` | `tell application "AppName" to activate` |

**依赖**: macOS 内置 `screencapture` + `osascript`，仅 click 需要可选的 `cliclick` (`brew install cliclick`)。

### 11.4 xdg-desktop-portal 作为兜底方案

xdg-desktop-portal 提供了 D-Bus 接口用于截屏，同时兼容 X11 和 Wayland：
- 接口: `org.freedesktop.portal.Screenshot`
- 方法: `Screenshot()` — 返回截图 URI
- 优势: 不需要额外安装工具，现代桌面环境默认包含
- 缺点: 会弹出用户授权对话框（非静默截屏）

---

## 十二、open-app 跨平台实现技术方案

### 12.1 架构设计

```
open-app.ts (统一入口)
  ├── platform === "win32"  → Registry + lnk + UWP (已有)
  ├── platform === "darwin" → mdfind + open -a (新建)
  └── platform === "linux"  → .desktop 文件扫描 + xdg-open (新建)
```

### 12.2 Linux 实现方案

#### .desktop 文件搜索

标准目录（按 XDG Base Directory Spec）：
```
/usr/share/applications/          # 系统全局
/usr/local/share/applications/    # 本地安装
~/.local/share/applications/      # 用户级
/var/lib/flatpak/exports/share/applications/  # Flatpak
~/.local/share/flatpak/exports/share/applications/  # 用户 Flatpak
/snap/*/current/meta/gui/         # Snap
```

#### 搜索策略

```typescript
function searchLinuxApps(keyword: string): AppMatch[] {
  const dirs = [
    "/usr/share/applications",
    "/usr/local/share/applications",
    path.join(os.homedir(), ".local/share/applications"),
  ];

  const results: AppMatch[] = [];
  for (const dir of dirs) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".desktop")) continue;
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const name = extractDesktopField(content, "Name");
      const nameZh = extractDesktopField(content, "Name[zh_CN]");
      const exec = extractDesktopField(content, "Exec");

      if (fuzzyMatch(name, keyword) || fuzzyMatch(nameZh, keyword)) {
        results.push({ appName: name, exePath: exec, source: "desktop" });
      }
    }
  }
  return results;
}
```

#### 启动方式

```bash
# 方式 1: xdg-open (最通用)
xdg-open /usr/share/applications/google-chrome.desktop

# 方式 2: gtk-launch (GNOME/GTK 环境)
gtk-launch google-chrome

# 方式 3: 直接执行 Exec 字段
/usr/bin/google-chrome-stable %U
```

### 12.3 macOS 实现方案

```typescript
// 搜索应用
function searchMacApps(keyword: string): AppMatch[] {
  // 方式 1: mdfind (Spotlight)
  const result = execSync(
    `mdfind "kMDItemKind == 'Application'" | grep -i "${keyword}"`,
    { encoding: "utf-8" }
  );

  // 方式 2: /Applications 目录扫描
  const apps = fs.readdirSync("/Applications")
    .filter(f => f.endsWith(".app") && fuzzyMatch(f, keyword));

  return [...];
}

// 启动应用
function launchMacApp(appPath: string) {
  execSync(`open -a "${appPath}"`);
}
```

### 12.4 中文别名映射（全平台复用）

现有 Windows `APP_ALIASES` 可直接复用到 macOS/Linux，只需扩展：

```typescript
// Linux 特有别名
const LINUX_ALIASES: Record<string, string[]> = {
  "文件管理器": ["nautilus", "thunar", "dolphin", "nemo", "pcmanfm"],
  "终端": ["gnome-terminal", "konsole", "xfce4-terminal", "alacritty", "kitty"],
  "文本编辑器": ["gedit", "kate", "mousepad", "xed"],
};

// macOS 特有别名
const MACOS_ALIASES: Record<string, string[]> = {
  "访达": ["Finder"],
  "终端": ["Terminal", "iTerm"],
  "文本编辑": ["TextEdit"],
};
```

---

## 十三、执行优先级排序表

| # | 任务 | 影响面 | 工作量 | 文件变更 | 优先级 |
|---|------|--------|--------|---------|:---:|
| 1 | 修复 songsee/summarize download.os 限制 | 2 skills | 0.5h | 2 个 SKILL.md | P0 |
| 2 | 1password 添加 download 安装选项 | 1 skill | 0.5h | 1 个 SKILL.md | P0 |
| 3 | obsidian 添加 download + 路径适配 | 1 skill | 1h | 1 个 SKILL.md | P1 |
| 4 | skills-install.ts 添加 apt kind | 全 Linux | 4h | skills-install.ts + skills-status.ts | P1 |
| 5 | desktop-control macOS 后端 | macOS 用户 | 8h | desktop-control.ts | P1 |
| 6 | desktop-control Linux 后端 | Linux 用户 | 12h | desktop-control.ts | P1 |
| 7 | open-app macOS 后端 | macOS 用户 | 4h | open-app.ts | P1 |
| 8 | open-app Linux 后端 | Linux 用户 | 6h | open-app.ts | P1 |
| 9 | Linux systemd service 文件 | Linux 部署 | 2h | 新建 scripts/linux/ | P1 |
| 10 | Linux Docker Compose 方案 | Linux 小白 | 3h | 新建 docker-compose.yml | P1 |
| 11 | Windows bundled-bins 扩大范围 | Win 体验 | 2h | download-proxy-binaries.ps1 | P2 |
| 12 | Linux bundled-bins 编译流水线 | Linux 体验 | 8h | 新建 build 脚本 | P2 |
| 13 | Scoop bucket / Winget manifest | Win 生态 | 4h | 新建外部仓库 | P2 |

---

## 十四、附录：技术选型决策矩阵

### Linux 桌面自动化工具对比

| 工具 | 截屏 | 点击 | 输入 | 窗口 | X11 | Wayland | 安装 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|------|
| **xdotool** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | apt/dnf/pacman |
| **ydotool** | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | apt/dnf/pacman |
| **wtype** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | apt/pacman |
| **scrot** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | apt/dnf/pacman |
| **maim** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | apt/dnf/pacman |
| **grim** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | apt/dnf/pacman |
| **wmctrl** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | apt/dnf/pacman |
| **flameshot** | ✅ | ❌ | ❌ | ❌ | ✅ | ⚠️实验 | apt/dnf/pacman |
| **xdg-portal** | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | 内置 |

### 推荐组合

**X11 环境**: xdotool + scrot + wmctrl
**Wayland 环境**: ydotool + grim + swaymsg/hyprctl
**兜底**: xdg-desktop-portal (截屏) + ydotool (输入)

### Wayland vs X11 市场份额 (2025-2026)

- **Ubuntu 24.04+**: 默认 Wayland（GNOME 46）
- **Fedora 40+**: 默认 Wayland（GNOME/KDE）
- **Arch**: 用户选择，Wayland 占比持续上升
- **估算**: 新装机 ~60-70% Wayland，存量机器仍有大量 X11
- **结论**: **必须同时支持 X11 和 Wayland**
