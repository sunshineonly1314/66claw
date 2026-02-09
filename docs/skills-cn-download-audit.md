# Skills 中国区下载覆盖度全量审计

> 审计日期: 2026-02-08
> 审计范围: 全部 54 个 skill，Windows CN 用户视角
> 审计维度: 安装包预置 / 国内镜像 (npm/pip/go/brew) / ClawdSkillsProxy / HK二进制服务器 / GitHub代理

---

## 下载通道总览

| 通道 | 说明 | 覆盖工具 |
|------|------|---------|
| **安装包预置** | `{app}\tools\` 内置 .exe | camsnap, sag, gog, goplaces (4个，~20MB) |
| **npm 镜像** | npmmirror.com | bird, mcporter, oracle, coding-agent |
| **pip/uv 镜像** | 清华/阿里云 pypi | nano-pdf, openai-whisper (可加) |
| **go 镜像** | goproxy.cn | blogwatcher, blucli, eightctl, food-order, gifgrep, ordercli, sonoscli, wacli |
| **brew 镜像** | USTC bottles (仅 macOS) | 1password, himalaya, github, gemini, openai-whisper, openhue 等 |
| **ClawdSkillsProxy** | 121.43.61.90 大包代理 | sherpa-onnx-tts, ffmpeg (video-frames) |
| **HK 二进制服务器** | 43.129.194.117:8888 运行时下载 | ordercli, peekaboo, remindctl, imsg, camsnap, wacli, sag, gog, spogo, summarize, songsee, goplaces |
| **GitHub 代理** | gh-proxy.com → ghfast.top → ghproxy.cn | 所有 GitHub Release download spec |

---

## 一、完全覆盖 (18 个技能) ✅

| 技能 | 二进制 | Windows 获取方式 | 国内源 |
|------|--------|-----------------|--------|
| **camsnap** | camsnap | 安装包预置 (.exe) | 本地 |
| **sag** | sag | 安装包预置 (.exe) | 本地 |
| **gog** | gog | 安装包预置 (.exe) | 本地 |
| **goplaces** | goplaces | 安装包预置 (.exe) | 本地 |
| **video-frames** | ffmpeg | download spec → ClawdSkillsProxy | `LARGE_PACKAGE_PROXY_MAP` |
| **sherpa-onnx-tts** | runtime+model | download spec → ClawdSkillsProxy | `LARGE_PACKAGE_PROXY_MAP` |
| **bird** | bird | npm `@steipete/bird` | npmmirror |
| **mcporter** | mcporter | npm `mcporter` | npmmirror |
| **oracle** | oracle | npm `@steipete/oracle` | npmmirror |
| **nano-pdf** | nano-pdf | uv/pip `nano-pdf` | 清华 pypi |
| **blogwatcher** | blogwatcher | go install | goproxy.cn |
| **blucli** | blu | go install | goproxy.cn |
| **eightctl** | eightctl | go install | goproxy.cn |
| **food-order** | ordercli | go install | goproxy.cn |
| **gifgrep** | gifgrep | go install (brew 在 Windows 被过滤) | goproxy.cn |
| **ordercli** | ordercli | go install (brew 在 Windows 被过滤) | goproxy.cn |
| **sonoscli** | sonos | go install | goproxy.cn |
| **wacli** | wacli | go install (brew 在 Windows 被过滤) | goproxy.cn |

---

## 二、无需二进制 (16 个技能) ✅ 无需处理

| 技能 | 类型 | 说明 |
|------|------|------|
| canvas | 纯渲染 | HTML canvas 显示 |
| discord | 配置 | channels.discord |
| slack | 配置 | channels.slack |
| notion | API | 纯 curl 调用 |
| weather | 系统 | 系统 curl |
| bluebubbles | 配置 | 插件管理 |
| skill-creator | 框架 | 无依赖 |
| skills-troubleshoot | 文档 | 排障指南 |
| software-protection | 文档 | 安全文档 |
| packaging | 文档 | 打包指南 |
| voice-call | 插件 | 插件管理 |
| openai-whisper-api | API | 系统 curl + OPENAI_API_KEY |
| nano-banana-pro | API | 需 uv (见缺口 D) + GEMINI_API_KEY |
| local-places | API | 需 uv (见缺口 D) + GOOGLE_PLACES_API_KEY |
| session-logs | 系统工具 | 需 jq, rg (见缺口 C) |
| trello | 系统工具 | 需 jq (见缺口 C) |

---

## 三、仅 macOS 可用 (8 个技能) — Windows 不适用

| 技能 | 二进制 | brew tap | 说明 |
|------|--------|---------|------|
| apple-notes | memo | antoniorodr/memo/memo | macOS only |
| apple-reminders | remindctl | steipete/tap/remindctl | macOS only |
| bear-notes | grizzly | — (go install) | macOS only |
| imsg | imsg | steipete/tap/imsg | macOS only |
| peekaboo | peekaboo | steipete/tap/peekaboo | macOS only |
| things-mac | things | — (go install) | macOS only |
| model-usage | codexbar | steipete/tap/codexbar | macOS only (darwin) |
| tmux | tmux | — (系统包) | macOS/Linux only |

---

## 四、有缺口 — Windows 上无安装路径 (12 个技能) ⚠️

### A. 有 Windows 二进制但 SKILL.md 未配置 download spec (5 个) — 可立即修复

| 技能 | 二进制 | 上游 Windows 二进制 | 当前 SKILL.md 安装方式 | 修复方案 |
|------|--------|-------------------|---------------------|---------|
| **1password** | op | 1Password CLI 官方 .exe/.msi ([下载页](https://developer.1password.com/docs/cli/get-started/)) | brew only (`1password-cli`) | 加 download spec，URL 指向官方 Windows 安装包 |
| **github** | gh | gh CLI 官方 .zip/.msi ([releases](https://github.com/cli/cli/releases)) | brew + apt | 加 download spec，URL 指向 GitHub Release |
| **himalaya** | himalaya | GitHub releases 有 Windows .exe ([releases](https://github.com/pimalaya/himalaya/releases)) | brew only (`himalaya`) | 加 download spec，URL 指向 GitHub Release |
| **spotify-player** | spogo / spotify_player | GitHub releases 有 Windows .exe | brew only (steipete/tap) | 加 download spec for spogo |
| **openai-whisper** | whisper | Python 包，pip install 可装 | brew only (`openai-whisper`) | 加 pip/uv install spec |

### B. 需确认上游是否有 Windows 二进制 (3 个) — 需调研

| 技能 | 二进制 | 当前安装方式 | 待确认事项 |
|------|--------|------------|-----------|
| **gemini** | gemini | brew `gemini-cli` | 需查 gemini-cli 是否有 npm 包或 GitHub Release Windows 版 |
| **obsidian** | obsidian-cli | brew `yakitrak/yakitrak/obsidian-cli` | 需查是否有 GitHub Release 或 go install 路径 |
| **openhue** | openhue | brew `openhue/cli/openhue-cli` | 需查是否有 GitHub Release Windows 版 |

### C. 系统工具无 install spec (3 个) — 低优先级

| 技能 | 依赖二进制 | 说明 | 修复方案 |
|------|-----------|------|---------|
| **session-logs** | jq, rg | 无 install 数组 | Windows 用户可通过 winget/scoop 安装；或加 download spec |
| **trello** | jq | 无 install 数组 | 同上 |
| **openai-image-gen** | python3 | brew only (`python`) | Windows 用户需从 python.org 安装；或加 download spec |

### D. uv 本身在 Windows 无 install spec (2 个) — 中优先级

| 技能 | 依赖 | 说明 | 修复方案 |
|------|------|------|---------|
| **nano-banana-pro** | uv | 仅有 brew spec | 加 download spec: `astral.sh/uv/install.ps1`，cn-mirrors.ts 已有 uv 镜像配置 |
| **local-places** | uv | 连 install 数组都没有 | 同上，且需补全 install 数组 |

> 注: `cn-mirrors.ts` 的 `BINARY_DOWNLOAD_MIRRORS.uv` 已有 `gh-proxy.com` 代理的安装脚本 URL，但 SKILL.md 中未引用。

### E. 上游无 Windows 二进制，不可修复 (2 个)

| 技能 | 二进制 | 说明 |
|------|--------|------|
| **summarize** | summarize | v0.10.0 仅发布 macOS arm64 + 浏览器扩展，无 Windows 版 |
| **songsee** | songsee | v0.1.0 release 零 asset，无任何平台二进制 |

---

## 五、特殊情况

### coding-agent
- 使用 `anyBins: ["claude", "codex", "opencode", "pi"]`
- 无 install 数组，用户需自行安装任一 coding agent
- 非常规技能，不影响批量安装流程

---

## 六、统计总结

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 完全覆盖 | 18 | 33% |
| ✅ 无需二进制 | 16 | 30% |
| ➖ macOS only (不适用) | 8 | 15% |
| ⚠️ 可修复缺口 (A+D) | 7 | 13% |
| ❓ 需调研 (B) | 3 | 6% |
| ⚪ 系统工具 (C) | 3 | 5% |
| ❌ 不可修复 (E) | 2 | 4% |

**Windows CN 用户有效技能覆盖率**: 18 / (18+7+3+3+2) = **18/33 = 55%**
加上无需二进制的 16 个: (18+16) / (54-8) = **34/46 = 74%**

### 修复后预期覆盖率
- 修复 A 类 (5个) + D 类 (2个): (18+7+16) / 46 = **41/46 = 89%**
- 加上 B 类确认后 (最多3个): 最高 **44/46 = 96%**
- 剩余 2 个 (summarize, songsee) 需等上游发布 Windows 版

---

## 七、修复优先级建议

### P0 — 立即修复 (影响常用技能)
1. **github** (gh) — 高频使用，GitHub CLI 有官方 Windows 二进制
2. **1password** (op) — 密码管理，1Password 有官方 Windows CLI

### P1 — 尽快修复
3. **himalaya** — email CLI，有 GitHub Release
4. **openai-whisper** — 语音转文字，可加 pip spec
5. **nano-banana-pro / local-places** — uv 依赖，补 download spec

### P2 — 调研后修复
6. **gemini** — 需查安装方式
7. **obsidian** — 需查 Release
8. **openhue** — 需查 Release
9. **spotify-player** — spogo/spotify_player Release

### P3 — 低优先级
10. **session-logs / trello** — jq 系统工具，winget 可装
11. **openai-image-gen** — python3 通常已装

### 不可修复
- summarize — 等上游发布 Windows 版
- songsee — 等上游发布任何二进制

---

## 八、服务端待部署

以下内容需在服务器端操作：

| 服务器 | 操作 | 状态 |
|--------|------|------|
| ClawdSkillsProxy (121.43.61.90) | 上传 sherpa-onnx 各平台 runtime + 模型 | ❌ 待部署 |
| ClawdSkillsProxy (121.43.61.90) | 上传 ffmpeg 各平台二进制 | ❌ 待部署 |
| HK (43.129.194.117) | 确认 songsee/goplaces/gifgrep 是否已同步 | ❓ 待确认 |

---

## 九、安装包预置二进制清单

文件位置: `scripts/windows/bundled-bins/`

| 文件名 | 来源 | 版本 | 大小 |
|--------|------|------|------|
| camsnap.exe | steipete/camsnap releases | latest | ~4 MB |
| sag.exe | steipete/sag releases | latest | ~6 MB |
| gog.exe | steipete/gogcli releases | latest | ~8 MB |
| goplaces.exe | steipete/goplaces releases | latest | ~3 MB |
| **合计** | | | **~20 MB** |

> 注: summarize.exe 和 songsee.exe 已从列表移除（上游无 Windows 二进制）。
