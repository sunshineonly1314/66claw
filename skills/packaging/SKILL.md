---
name: packaging
description: ClawdbotCN 跨平台构建与打包指南 (Windows + macOS)。
nameZh: "打包工具"
descriptionZh: "ClawdbotCN 跨平台构建与打包完整指南 (Windows + macOS)"
---

# Packaging Skill

ClawdbotCN 跨平台构建与打包指南 (Windows + macOS)。

## 概述

ClawdbotCN 使用统一构建脚本 `build/scripts/windows/build-windows.ps1` 完成 Windows 平台的全量编译、依赖安装和 Inno Setup 打包。

| 构建模式 | 说明 | 预估大小 |
|----------|------|----------|
| standard | 53 核心 skills + 7 bundled-bins | ~150 MB |
| full | 3061 skills (skills-merged/) + 7 proxy tools + 7 bundled-bins | ~210 MB |

## 前置条件

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | v22+ | 推荐 v24.x |
| pnpm | v10+ | 包管理器 |
| Inno Setup 6 | 最新版 | [下载地址](https://jrsoftware.org/isinfo.php) |
| 磁盘空间 | 至少 5GB | 构建输出目录 E:\clawdbuild |

## 完整构建流程

### 第一步：前后端编译

```bash
# 后端 TypeScript 编译
pnpm build

# 完整性哈希生成（安全校验用，必须在 pnpm build 之后执行）
pnpm integrity:gen

# 前端 UI 构建（Vite）
pnpm ui:build
```

### 第二步：打包

```powershell
# 自动检测模式（如有 skills-merged/ 目录则 full 模式）
powershell -ExecutionPolicy Bypass -File build\scripts\windows\build-windows.ps1

# 指定 full 模式 + 跳过编译（已手动编译时）
.\build\scripts\windows\build-windows.ps1 -SkipBuild -MaxThreads 12

# 快速开发构建（zip 压缩，5-10x 更快）
.\build\scripts\windows\build-windows.ps1 -FastCompress

# 构建后自动测试安装
.\build\scripts\windows\build-windows.ps1 -TestInstall
```

---

## 构建脚本参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-Mode` | 自动检测 | `standard` 或 `full` |
| `-MaxThreads` | CPU 核心 x2 | 并发线程数（最大 22） |
| `-OutputDir` | `E:\clawdbuild` | 输出目录 |
| `-Version` | 自动从 package.json | 版本号 |
| `-BinariesDir` | `build\download-output` | 预下载二进制文件目录 |
| `-SkipBuild` | false | 跳过 TypeScript + UI 编译 |
| `-SkipNodeModules` | false | 跳过生产 node_modules 安装 |
| `-SkipExtensions` | false | 跳过扩展依赖检测 |
| `-SkipProxyTools` | false | 跳过代理工具解压（仅 full 模式） |
| `-FastCompress` | false | 使用 zip 压缩（开发用） |
| `-TestInstall` | false | 构建后自动静默安装验证 |

---

## 构建流程详解

### 5 步流水线

```
[1/5] 检查先决条件
  → Inno Setup 6、Node.js、pnpm、node-portable、skills 目录

[2/5] 并行构建阶段
  → Job A: TypeScript + UI 编译（build:secure → ui:build）
  → Job B: 生产 node_modules 安装（npm install --omit=dev）
           + 自动合并 29 个扩展专属依赖到 package.json
  → Job D: 代理工具解压（full 模式，7 个工具并行）
  → Job E: Skills 目录拷贝（full 模式）

[3/5] 检查工具二进制
  → bundled-bins（camsnap, sag, gog, goplaces, openhue, spogo, jira）
  → proxy tools（gh, himalaya, yt-dlp, uv, rclone, ffmpeg, sherpa-onnx）

[4/5] 验证必需文件
  → dist/entry.js, package.json, dist/control-ui/, node-portable/ 等

[5/5] Inno Setup 编译
  → LZMA2/max 压缩（release）或 zip 压缩（dev）
  → 输出 EXE 安装程序
```

### 扩展依赖合并机制

构建脚本自动扫描 `extensions/*/package.json`，将 15 个带有专属依赖的扩展（共 29 个包）合并到生产 `package.json` 中统一安装。这样所有扩展运行时可通过 Node.js 向上查找机制从 `{app}\node_modules` 解析依赖。

**带专属依赖的扩展：**

| 扩展 | 关键依赖 |
|------|----------|
| feishu | @larksuiteoapi/node-sdk |
| dingtalk | dingtalk-stream |
| matrix | @vector-im/matrix-bot-sdk |
| nostr | nostr-tools |
| tlon | @urbit/http-api |
| googlechat | google-auth-library |
| qqbot | qq-bot-sdk |
| twitch | @twurple/api, @twurple/chat |
| msteams | @microsoft/agents-hosting |
| memory-lancedb | @lancedb/lancedb, openai |
| diagnostics-otel | @opentelemetry/sdk-node (11 个包) |

> **注意：** 扩展的 `node_modules` 被排除在安装包之外（Inno Setup 32 位进程在 LZMA2 压缩下会因 feishu 的 817 文件依赖树导致 OOM）。

### 完整性哈希系统

`pnpm integrity:gen` 生成 `dist/security/integrity-hashes.json`，包含 22 个 license/security JS 文件的 SHA-256 哈希。启动时 `checkIntegrityOnStartup()` 校验这些文件，不匹配则 `process.exit(1)`。

**关键：** 任何修改 `dist/license/` 或 `dist/security/` 下的文件后，必须重新运行 `pnpm integrity:gen`，否则生产环境会崩溃循环。

---

## 输出产物

| 模式 | 文件名 | 位置 |
|------|--------|------|
| standard | `ClawdbotCN-Setup-{version}-x64.exe` | `E:\clawdbuild\` |
| full | `ClawdbotCN-Full-Setup-{version}-x64.exe` | `E:\clawdbuild\` |
| dev (fast) | `ClawdbotCN-*-{version}-x64-dev.exe` | `E:\clawdbuild\` |

### 安装包内容

```
{app}\
├── node\                    # Node.js 便携版运行时
├── dist\                    # 编译后的 TypeScript + control-ui
│   ├── entry.js             # 主入口
│   ├── control-ui\          # 前端 Vite 构建产物
│   └── security\            # 完整性哈希
├── node_modules\            # 生产依赖 + 扩展合并依赖
├── extensions\              # 33 个插件（含 src/，不含 node_modules）
├── skills\                  # Skills 目录
├── assets\                  # 图标、加载页面
├── tools\                   # 预置二进制工具（12 个）
├── docs\reference\templates\# Bot 角色模板
├── patches\                 # pnpm patches
├── scripts\                 # postinstall 脚本
├── ClawdbotService.exe      # C# 系统托盘服务
├── start-gateway.bat        # 网关启动脚本
├── package.json             # 项目描述
└── install.json             # 安装标记（安装时自动生成）
```

---

## 变更检测与增量构建

构建脚本支持智能增量检测：

| 检测项 | 触发条件 |
|--------|----------|
| TypeScript 编译 | `src/*.ts` 比 `dist/entry.js` 新 |
| UI 构建 | `ui/src/*` 比 `dist/control-ui/index.html` 新 |
| node_modules | `package.json` hash 变化 |
| 扩展依赖 | 任意 `extensions/*/package.json` hash 变化 |
| Skills 拷贝 | skills-merged/ 数量不匹配 |

使用 `-SkipBuild` 可跳过编译阶段（适用于已手动 `pnpm build && pnpm ui:build` 的场景）。

---

## 故障排除

### Inno Setup OOM（内存不足）

Inno Setup 是 32 位进程，LZMA2/max 压缩大量小文件时会耗尽地址空间。

**解决：** 扩展 `node_modules` 已通过依赖合并机制排除在安装包之外。如果仍然 OOM，使用 `-FastCompress` 改为 zip 压缩。

### 完整性校验崩溃循环

启动后反复崩溃 5 次退出，日志显示 integrity check failed。

**原因：** 修改了 security/license JS 文件后没有重新运行 `pnpm integrity:gen`。

**修复：**
```bash
pnpm integrity:gen
# 然后重新打包
```

### PowerShell UTF-8 解析错误

扩展 package.json 含中文描述导致 `ConvertFrom-Json` 失败。

**已修复：** 构建脚本使用 `-Encoding UTF8` 读取所有 extension package.json。

### npm install 网络问题

构建脚本使用淘宝镜像 `registry.npmmirror.com`，自动重试 3 次，每次间隔递增。

---

## 相关文件 (Windows)

| 路径 | 说明 |
|------|------|
| `build/scripts/windows/build-windows.ps1` | 统一构建脚本（核心） |
| `scripts/windows/setup.iss` | Inno Setup 安装程序配置 |
| `scripts/generate-integrity-hashes.ts` | 完整性哈希生成器 |
| `scripts/windows/node-portable/` | Node.js 便携版运行时 |
| `scripts/windows/bundled-bins/` | 预置工具二进制 |
| `scripts/windows/native/ClawdbotService.exe` | C# 系统托盘服务 |
| `scripts/windows/assets/` | 安装程序图标和 banner |

---

# macOS 构建与打包

## 概述

macOS 有两个构建脚本:

| 脚本 | 用途 | 输出 |
|------|------|------|
| `build/scripts/build-macos-cn.sh` | CN 版 (28 线程并行) | DMG (.app bundle) |
| `build/scripts/build-macos-parallel.sh` | 国际版 (22 线程并行) | DMG + tar.gz |

两者都不依赖 Electron — 项目是 Node.js CLI + Hono Web 服务器, 通过 shell 脚本打包为 `.app` bundle。

## 前置条件

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| macOS | 12+ Monterey | 构建环境 |
| Node.js | v22+ | 推荐 v24.x |
| pnpm | v10+ | 包管理器 |
| Xcode CLT | 最新 | `xcode-select --install` |
| 磁盘空间 | 至少 2GB | 构建中间文件 |

## CN 版构建 (build-macos-cn.sh)

### 用法

```bash
# 自动检测 (ad-hoc 签名, 自动选择国内/国际镜像)
./build/scripts/build-macos-cn.sh

# 强制国内镜像
./build/scripts/build-macos-cn.sh --cn

# 仅 arm64 (M 系列芯片)
./build/scripts/build-macos-cn.sh --arch arm64

# 跳过编译 (已手动 pnpm build)
./build/scripts/build-macos-cn.sh --skip-build

# 快速模式 (跳过清理优化)
./build/scripts/build-macos-cn.sh --fast
```

### Developer ID 签名 + 公证

```bash
# 自动检测钥匙串中的证书
./build/scripts/build-macos-cn.sh

# 指定证书
SIGN_IDENTITY="Developer ID Application: YourCo (TEAMID)" ./build/scripts/build-macos-cn.sh

# 公证 (需提前配置)
xcrun notarytool store-credentials "clawdbotcn"
NOTARYTOOL_PROFILE="clawdbotcn" ./build/scripts/build-macos-cn.sh
```

### 8 步构建流水线

```
[1/8] 前置检查 — macOS 版本、工具、磁盘空间、网络检测
[2/8] 并行编译 (28 线程)
  → Job A (8线程): TypeScript 编译 (build:secure)
  → Job B (4线程): UI 编译 (ui:build)
  → Job C (8线程): 生产依赖安装 (pnpm install --prod, hoisted 模式)
  → Job D (4线程): Node.js 下载 + SHA256 校验 + Universal Binary 合并
  → Job E (4线程): 所有扩展依赖安装 (15 个有 dependencies 的扩展)
[3/8] 组装 .app 结构 — Info.plist, launcher, node, 卸载脚本
[4/8] 并行复制内容 — dist/, node_modules, skills/, assets/, data/, extensions/ (33个), docs/
[5/8] 验证完整性 — 20+ 项检查, 包括关键依赖、native 二进制、扩展 node_modules
[6/8] 清理优化 — 删除非 darwin 平台模块, .map, 测试文件
[7/8] 代码签名 — Developer ID 或 ad-hoc 回退
[8/8] 创建 DMG — ULMO 压缩, Applications 快捷方式, 安装助手
```

### 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--cn` | auto | 强制国内镜像 |
| `--intl` | auto | 强制国际镜像 |
| `--arch` | universal | `arm64` / `x64` / `universal` |
| `--jobs` | 28 | 并行线程数 |
| `--skip-build` | false | 跳过 TS + UI 编译 |
| `--skip-node` | false | 跳过 Node.js 下载 |
| `--fast` | false | 快速模式 (跳过清理) |

### 关键依赖安装机制

**核心修复: node-linker=hoisted**

pnpm 默认的 `.pnpm` 符号链接存储结构在打包复制时会产生断链。构建脚本强制使用 `node-linker=hoisted` 生成与 npm 一致的平铺 `node_modules`, 确保复制后可直接运行。

**扩展依赖处理:**

Job E 自动扫描所有 `extensions/*/package.json`, 对有 `"dependencies"` 字段的扩展安装 node_modules。Step 5 验证阶段会检测并修复断链的符号链接。

| 扩展 | 关键依赖 |
|------|----------|
| feishu | @larksuiteoapi/node-sdk |
| dingtalk | dingtalk-stream |
| wecom | zod |
| qqbot | qq-bot-sdk |
| matrix | @vector-im/matrix-bot-sdk |
| msteams | @microsoft/agents-hosting |
| nostr | nostr-tools |
| tlon | @urbit/http-api |
| twitch | @twurple/api |
| memory-lancedb | @lancedb/lancedb |
| diagnostics-otel | @opentelemetry/sdk-node |
| googlechat | google-auth-library |
| voice-call | ws, zod |
| zalo | undici |
| zalouser | @sinclair/typebox |

### 输出产物

| 文件 | 位置 |
|------|------|
| `ClawdbotCN-macOS-v{VERSION}-{ARCH}.dmg` | `build/output/` |
| `ClawdbotCN-macOS-v{VERSION}-{ARCH}.dmg.sha256` | `build/output/` |

### .app 内部结构

```
ClawdbotCN.app/Contents/
├── MacOS/ClawdbotCN              # 启动脚本 (bash, 非编译二进制)
├── Info.plist                     # 应用元数据
├── PkgInfo                        # APPL????
└── Resources/
    ├── node/bin/node              # Node.js Universal Binary
    ├── AppIcon.icns               # 应用图标
    ├── version.json               # 版本信息
    ├── uninstall.sh               # 卸载脚本
    └── gateway/                   # 核心应用
        ├── dist/                  # 编译后 TypeScript + control-ui
        ├── node_modules/          # 生产依赖 (hoisted 平铺)
        ├── extensions/            # 33 个扩展 (含各自 node_modules)
        ├── skills/                # Skills 目录
        ├── assets/                # 图标、加载页面
        ├── data/                  # mcp-index.json, qrcodes
        ├── docs/reference/        # 模板文件
        └── package.json           # 项目描述
```

## 国际版构建 (build-macos-parallel.sh)

```bash
# 一键构建 Universal 版
./build/scripts/build-macos-parallel.sh

# 指定版本 + 国内镜像
./build/scripts/build-macos-parallel.sh -v 2026.2.0 --cn

# 只构建 arm64
./build/scripts/build-macos-parallel.sh -a arm64

# 构建后自动测试
./build/scripts/build-macos-parallel.sh --test
```

## macOS 故障排除

### 缺包 (module not found)

**症状:** 启动后 `gateway-error.log` 显示 `ERR_MODULE_NOT_FOUND`

**原因:** pnpm 符号链接模式的 node_modules 复制后断链

**修复:** 构建脚本已使用 `node-linker=hoisted` 和 `rsync -rL` 解决。如仍有问题:
```bash
# 在 .app 内部重新安装依赖
cd /Applications/ClawdbotCN.app/Contents/Resources/gateway
npm install --omit=dev
```

### Gatekeeper 阻止打开

**症状:** "来自身份不明的开发者" 弹窗

**修复:** 右键 → 打开, 或:
```bash
xattr -cr /Applications/ClawdbotCN.app
```

使用 Developer ID 签名 + 公证可避免此问题。

### 端口被占用

**症状:** 启动失败, 日志显示端口冲突

**修复:** launcher.sh 内置了端口冲突检测和 GUI 对话框。也可手动:
```bash
lsof -i :18789 -sTCP:LISTEN
kill <PID>
```

## 相关文件 (macOS)

| 路径 | 说明 |
|------|------|
| `build/scripts/build-macos-cn.sh` | CN 版构建脚本 (核心) |
| `build/scripts/build-macos-parallel.sh` | 国际版构建脚本 |
| `build/scripts/build-macos-oneclick.sh` | 一键构建包装脚本 |
| `build/macos/launcher.sh` | .app 启动脚本 (含端口检测、数据迁移、LaunchAgent) |
| `build/macos/install-helper.command` | Gatekeeper 安装助手 |
| `build/macos/uninstall.sh` | 卸载脚本 |
| `scripts/codesign-mac-app.sh` | Developer ID 签名脚本 |
| `scripts/notarize-mac-artifact.sh` | Apple 公证脚本 |
| `scripts/create-dmg.sh` | DMG 创建脚本 |
| `.github/workflows/build-macos-cn.yml` | CI/CD (CN 版) |
| `.github/workflows/build-macos.yml` | CI/CD (国际版) |
