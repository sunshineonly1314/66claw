# OpenClawCN macOS 中国用户打包方案

> 深度调研文档 | 2026-02-09
> 目标用户：苹果小白用户（零技术门槛）

---

## 一、总体架构设计

### 1.1 设计原则

| 原则 | 说明 |
|------|------|
| **零门槛** | 用户只需双击 DMG → 拖入 Applications → 双击启动，不需要任何命令行操作 |
| **智能网络** | 首次启动自动检测网络环境，国际网 → 原装路径，国内网 → 本地方案 |
| **全离线可用** | 核心功能无需网络，技能安装通过 CN 镜像加速 |
| **Universal Binary** | 一个包同时支持 Intel Mac (x86_64) 和 Apple Silicon (M1/M2/M3/M4) |
| **安全可信** | Developer ID 签名 + 公证（Notarization），不触发 Gatekeeper 警告 |

### 1.2 两条安装路径

```
用户下载 DMG / ZIP
       ↓
  ┌────────────────────────────────────────┐
  │  首次启动 → 网络连通性检测（3秒内完成）  │
  └────────────────────────────────────────┘
       ↓                    ↓
  ┌──────────┐       ┌──────────┐
  │ 国际网络  │       │ 仅国内网络 │
  │ 可达外网  │       │ 无法访问外网│
  └──────────┘       └──────────┘
       ↓                    ↓
  ┌──────────┐       ┌──────────┐
  │ 原装路径  │       │ CN 本地方案│
  │ - 直连下载│       │ - CN 镜像  │
  │ - GitHub  │       │ - 预打包bins│
  │ - Homebrew│       │ - 淘宝npm  │
  │ - pip 官方│       │ - 中科大pip │
  └──────────┘       └──────────┘
       ↓                    ↓
  ┌───────────────────────────────────────┐
  │        统一的 Web UI 管理界面          │
  │     http://localhost:18789/setup      │
  └───────────────────────────────────────┘
```

---

## 二、网络连通性检测方案

### 2.1 检测逻辑（首次启动时执行）

```
┌─────────────────────────────────────────────────┐
│ 第一步：区域预判（0ms，本地完成）                    │
├─────────────────────────────────────────────────┤
│ 1. 检查 OPENCLAWCN_REGION 环境变量                  │
│    → "cn" → 直接使用 CN 方案                      │
│    → "global" → 直接使用国际方案                   │
│                                                   │
│ 2. 检查系统时区                                    │
│    → Asia/Shanghai / Asia/Chongqing → CN 候选     │
│                                                   │
│ 3. 检查系统语言                                    │
│    → zh_CN / zh-Hans → CN 候选                    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 第二步：网络实际连通性检测（并行，3秒超时）          │
├─────────────────────────────────────────────────┤
│ 并行发出以下请求：                                  │
│                                                   │
│ A. 国际连通性测试:                                  │
│    ① https://registry.npmjs.org (npm 官方)        │
│    ② https://api.github.com (GitHub API)          │
│    ③ https://google.com (通用测试)                 │
│                                                   │
│ B. 国内连通性测试:                                  │
│    ① https://registry.npmmirror.com (淘宝npm)     │
│    ② https://pypi.mirrors.ustc.edu.cn (中科大pip) │
│    ③ https://goproxy.cn (Go代理)                  │
│                                                   │
│ 判定规则:                                          │
│  - 国际3个中>=2个通 → "international"              │
│  - 仅国内通 → "cn-only"                           │
│  - 全不通 → "offline"（纯离线模式）                 │
│  - 国际通但慢(>2s)，国内快(<500ms) → "cn-preferred"│
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 第三步：写入配置（持久化，后续不再重复检测）          │
├─────────────────────────────────────────────────┤
│ 写入 ~/.openclawcn/network-profile.json:            │
│ {                                                 │
│   "detectedAt": "2026-02-09T10:30:00Z",          │
│   "networkMode": "cn-only",                       │
│   "internationalLatency": null,                   │
│   "domesticLatency": 172,                         │
│   "registryUrl": "https://registry.npmmirror.com",│
│   "pipIndexUrl": "https://pypi.mirrors.ustc.edu.cn/simple/", │
│   "goProxy": "https://goproxy.cn,direct",         │
│   "brewMirror": "https://mirrors.ustc.edu.cn/...",│
│   "githubProxy": "https://gh-proxy.com"           │
│ }                                                 │
│                                                   │
│ 用户可在 Web UI 中手动切换网络模式                   │
└─────────────────────────────────────────────────┘
```

### 2.2 检测实现代码设计

```typescript
// src/config/network-detect.ts

interface NetworkProfile {
  detectedAt: string;
  networkMode: "international" | "cn-preferred" | "cn-only" | "offline";
  internationalLatency: number | null;  // ms
  domesticLatency: number | null;       // ms
  registryUrl: string;
  pipIndexUrl: string;
  goProxy: string;
  brewMirror: string;
  githubProxy: string | null;
}

async function detectNetworkProfile(): Promise<NetworkProfile> {
  // 并行检测，3秒超时
  const [intl, cn] = await Promise.allSettled([
    probeInternational(3000),  // 并行测3个国际站点
    probeDomestic(3000),       // 并行测3个国内站点
  ]);

  // 根据结果判定模式
  const intlOk = intl.status === "fulfilled" && intl.value.reachable >= 2;
  const cnOk = cn.status === "fulfilled" && cn.value.reachable >= 2;
  const intlSlow = intl.status === "fulfilled" && intl.value.avgLatency > 2000;
  const cnFast = cn.status === "fulfilled" && cn.value.avgLatency < 500;

  if (intlOk && !intlSlow) return buildProfile("international", intl, cn);
  if (intlOk && intlSlow && cnFast) return buildProfile("cn-preferred", intl, cn);
  if (cnOk) return buildProfile("cn-only", intl, cn);
  return buildProfile("offline", intl, cn);
}
```

### 2.3 四种网络模式对比

| 模式 | npm源 | pip源 | Go代理 | GitHub | Homebrew | 二进制下载 |
|------|-------|-------|--------|--------|----------|-----------|
| **international** | npmjs.org | pypi.org | proxy.golang.org | 直连 | 直连 | 直连 |
| **cn-preferred** | npmmirror.com | 中科大 | goproxy.cn | 直连(慢) | 中科大 | CN镜像优先 |
| **cn-only** | npmmirror.com | 中科大 | goproxy.cn | gh-proxy.com | 中科大 | CN镜像/代理 |
| **offline** | 预打包缓存 | 预打包缓存 | 预打包缓存 | 不可用 | 不可用 | 仅预打包 |

---

## 三、打包方案详细设计

### 3.1 发布包格式

提供三种格式供用户选择：

| 格式 | 文件 | 大小 | 适合用户 |
|------|------|------|---------|
| **DMG（推荐）** | `OpenClawCN-macOS-v2026.2.0-universal.dmg` | ~140MB | 小白用户，拖拽安装 |
| **ZIP** | `OpenClawCN-macOS-v2026.2.0-universal.zip` | ~130MB | 偏好便携/解压即用 |
| **PKG** | `OpenClawCN-macOS-v2026.2.0-universal.pkg` | ~135MB | 企业批量部署 |

### 3.2 DMG 内容布局

```
┌─────────────────────────────────────────────┐
│                                             │
│      ┌──────────┐    ┌──────────────┐      │
│      │          │    │              │      │
│      │ OpenClawCN │    │ Applications │      │
│      │   .app   │ →  │    文件夹     │      │
│      │          │    │              │      │
│      └──────────┘    └──────────────┘      │
│                                             │
│  ← 将 OpenClawCN 拖到 Applications 文件夹 →   │
│                                             │
│  📖 使用指南.pdf                              │
│                                             │
└─────────────────────────────────────────────┘
```

### 3.3 应用包内部结构

```
OpenClawCN.app/
├── Contents/
│   ├── Info.plist                    # 应用元数据
│   ├── MacOS/
│   │   └── OpenClawCN                  # Universal Binary (Swift 菜单栏应用)
│   ├── Resources/
│   │   ├── OpenClawCN.icns             # 应用图标
│   │   ├── DeviceModels/             # 设备模型
│   │   ├── node/                     # ★ 内置 Node.js 运行时
│   │   │   └── bin/
│   │   │       └── node              # Universal Binary (arm64+x64)
│   │   ├── gateway/                  # ★ 网关应用代码
│   │   │   ├── dist/                 # 编译后的 JS
│   │   │   ├── ui/dist/              # Web UI
│   │   │   ├── package.json
│   │   │   ├── node_modules/         # 生产依赖（已精简）
│   │   │   ├── skills/               # 53个核心 skills
│   │   │   ├── extensions/           # 扩展（飞书、钉钉、企微等）
│   │   │   ├── assets/               # 静态资源
│   │   │   └── data/                 # MCP 索引（离线备份）
│   │   ├── tools/                    # ★ 预打包二进制工具
│   │   │   ├── camsnap               # 截图工具
│   │   │   ├── sag                   # 日程
│   │   │   ├── gog                   # Gmail
│   │   │   ├── goplaces             # 地点
│   │   │   ├── openhue              # 智能灯
│   │   │   ├── spogo                # Spotify
│   │   │   └── jira                 # Jira
│   │   └── config/                   # 默认配置模板
│   │       └── defaults.json
│   └── Frameworks/
│       ├── Sparkle.framework/        # 自动更新
│       └── libswiftCompatibilitySpan.dylib
│
├── 使用指南.html                      # 可选：内嵌帮助文档
└── (Sparkle XPC services)
```

### 3.4 与 Windows 方案的对照

| 方面 | Windows 方案 | macOS 方案（新设计） |
|------|-------------|-------------------|
| **安装方式** | Inno Setup .exe | DMG 拖拽 / PKG |
| **运行时** | scripts/windows/node-portable/ | Contents/Resources/node/ |
| **启动入口** | OpenClawCNService.exe (C# 托盘) | OpenClawCN.app (Swift 菜单栏) |
| **服务管理** | Windows 启动文件夹 | launchd LaunchAgent |
| **自动更新** | 手动 | Sparkle 框架 |
| **区域标识** | 环境变量 OPENCLAWCN_REGION=cn | 同 + 时区/语言自动检测 |
| **工具目录** | {app}\tools\ | Contents/Resources/tools/ |
| **Skills目录** | {app}\skills\ | Contents/Resources/gateway/skills/ |
| **Web UI 端口** | 18789 | 18789 |
| **代码签名** | 无（EXE 会被 SmartScreen 拦截） | Developer ID + 公证 |
| **中国优化** | OPENCLAWCN_REGION=cn 硬编码 | 智能检测 + 手动切换 |

---

## 四、构建流程设计

### 4.1 总体构建流水线

```
┌─────────────────────────────────────────────────────────┐
│  Phase 1: 编译（可并行）                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ TypeScript  │  │  UI Build  │  │  Swift Build       │ │
│  │  pnpm build │  │ pnpm ui:  │  │  arm64 + x86_64    │ │
│  │             │  │  build     │  │  → lipo universal  │ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 2: 依赖准备（可并行）                              │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │ npm install       │  │ 下载 Node.js Universal      │ │
│  │ --omit=dev        │  │ arm64 + x64 → lipo merge    │ │
│  │ --ignore-scripts  │  │                              │ │
│  └──────────────────┘  └──────────────────────────────┘ │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │ 编译 Extensions   │  │ 准备 bundled-bins (macOS)    │ │
│  │ feishu/dingtalk/  │  │ camsnap/sag/gog/...        │ │
│  │ wecom/qqbot       │  │ darwin-arm64 + darwin-x64   │ │
│  └──────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 3: 清理优化                                       │
│  - 删除非 darwin 平台的 native 模块                       │
│  - 删除 .ts/.map/.md/LICENSE/CHANGELOG                   │
│  - 删除 test/docs/examples 目录                          │
│  - 删除 .bin 符号链接                                     │
│  - 预估最终大小 → 告警如果超过 200MB                       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 4: 组装 .app                                      │
│  - 创建 OpenClawCN.app 目录结构                             │
│  - 写入 Info.plist (版本号、Bundle ID、Sparkle配置)        │
│  - 复制 Swift 二进制到 MacOS/                             │
│  - 复制 Node.js、gateway、tools、skills 到 Resources/    │
│  - 嵌入 Sparkle.framework                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 5: 签名 + 公证                                    │
│  - 深度代码签名 (codesign --deep --force --timestamp)     │
│  - Sparkle 框架和 XPC 单独签名                            │
│  - 公证提交 (notarytool submit)                          │
│  - 等待公证完成 → staple                                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 6: 打包分发                                       │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ DMG     │  │ ZIP      │  │ PKG (企业部署)         │  │
│  │ hdiutil │  │ ditto    │  │ productbuild           │  │
│  └─────────┘  └──────────┘  └───────────────────────┘  │
│  → 生成 SHA256 校验和                                     │
│  → 上传到 CDN（阿里云 OSS / 腾讯云 COS）                  │
└─────────────────────────────────────────────────────────┘
```

### 4.2 CI/CD 工作流（GitHub Actions）

```yaml
# .github/workflows/build-macos-cn.yml
name: Build macOS CN Package

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build-arm64:
    runs-on: macos-14  # Apple Silicon
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm install -g pnpm@10.23.0
      - run: pnpm install
      - run: pnpm build
      - run: pnpm ui:build
      - run: swift build -c release --product OpenClawCN --arch arm64
      # 下载 Node.js arm64
      - run: |
          curl -fsSL https://nodejs.org/dist/v22.13.0/node-v22.13.0-darwin-arm64.tar.gz | tar xz
      # 准备 bundled-bins arm64
      - run: bash build/scripts/prepare-macos-bins.sh --arch arm64
      # 上传 artifacts
      - uses: actions/upload-artifact@v4
        with:
          name: build-arm64
          path: build/staging-arm64/

  build-x64:
    runs-on: macos-15  # Intel
    steps:
      # 同上，架构改为 x64
      ...

  package-universal:
    needs: [build-arm64, build-x64]
    runs-on: macos-14
    steps:
      - uses: actions/download-artifact@v4
      # 合并 Universal Binary
      - run: |
          lipo -create arm64/node/bin/node x64/node/bin/node \
            -output universal/node/bin/node
          lipo -create arm64/MacOS/OpenClawCN x64/MacOS/OpenClawCN \
            -output universal/MacOS/OpenClawCN
      # 组装 .app
      - run: bash build/scripts/assemble-macos-app.sh
      # 代码签名
      - run: bash scripts/codesign-mac-app.sh dist/OpenClawCN.app
      # 公证
      - run: |
          xcrun notarytool submit dist/OpenClawCN.app.zip \
            --apple-id "$APPLE_ID" \
            --password "$APP_PASSWORD" \
            --team-id "$TEAM_ID" \
            --wait
          xcrun stapler staple dist/OpenClawCN.app
      # 创建 DMG
      - run: bash scripts/create-dmg.sh
      # 创建 ZIP
      - run: ditto -c -k --sequesterRsrc dist/OpenClawCN.app dist/OpenClawCN.zip
      # 生成校验和
      - run: shasum -a 256 dist/*.dmg dist/*.zip > dist/SHA256SUMS.txt
      # 上传到 CDN
      - run: bash build/scripts/upload-to-cn-cdn.sh
```

### 4.3 构建脚本设计

#### 4.3.1 一键构建（开发者本地使用）

```bash
#!/bin/bash
# build/scripts/build-macos-cn.sh
# 用法：
#   ./build/scripts/build-macos-cn.sh                # 自动检测
#   ./build/scripts/build-macos-cn.sh --cn           # 强制使用国内镜像
#   ./build/scripts/build-macos-cn.sh --arch arm64   # 仅 arm64
#   ./build/scripts/build-macos-cn.sh --format dmg   # 仅生成 DMG
#   ./build/scripts/build-macos-cn.sh --skip-sign    # 跳过签名（开发用）

set -euo pipefail

# 参数解析
ARCH="${ARCH:-universal}"
FORMAT="${FORMAT:-all}"       # dmg|zip|pkg|all
USE_CN_MIRROR="${USE_CN_MIRROR:-auto}"
SKIP_SIGN="${SKIP_SIGN:-false}"
JOBS="${JOBS:-$(sysctl -n hw.ncpu)}"
VERSION="${VERSION:-$(node -p "require('./package.json').version")}"

# 步骤 1: 网络检测 + 镜像配置
if [ "$USE_CN_MIRROR" = "auto" ]; then
  echo "🔍 检测网络环境..."
  CN_LATENCY=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 3 \
    https://registry.npmmirror.com 2>/dev/null || echo "999")
  INTL_LATENCY=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 3 \
    https://registry.npmjs.org 2>/dev/null || echo "999")

  if (( $(echo "$CN_LATENCY < $INTL_LATENCY" | bc -l) )); then
    USE_CN_MIRROR="true"
    echo "📡 使用国内镜像（延迟更低）"
  else
    USE_CN_MIRROR="false"
    echo "🌐 使用国际源"
  fi
fi

if [ "$USE_CN_MIRROR" = "true" ]; then
  export NPM_CONFIG_REGISTRY="https://registry.npmmirror.com"
  export PIP_INDEX_URL="https://pypi.mirrors.ustc.edu.cn/simple/"
  export GOPROXY="https://goproxy.cn,direct"
  NODE_MIRROR="https://npmmirror.com/mirrors/node"
  GITHUB_PROXY="https://gh-proxy.com/"
fi

# 步骤 2-6: 按照 Phase 1-6 执行...
```

---

## 五、macOS 特有的 CN 优化

### 5.1 Homebrew 中国镜像配置

首次启动时，如果检测到 CN 网络模式，自动配置 Homebrew 镜像：

```bash
# 自动注入到用户 shell 环境
# 使用中科大 USTC 镜像（实测最快）

export HOMEBREW_API_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles/api"
export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles"
export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.ustc.edu.cn/brew.git"
export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.ustc.edu.cn/homebrew-core.git"
export HOMEBREW_PIP_INDEX_URL="https://pypi.mirrors.ustc.edu.cn/simple"

# 备选：清华TUNA
# HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
# HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"

# 备选：阿里云
# HOMEBREW_BOTTLE_DOMAIN="https://mirrors.aliyun.com/homebrew/homebrew-bottles"
```

### 5.2 Node.js 下载镜像

```bash
# Node.js 二进制下载（用于构建时）
# 优先级：淘宝NPM > 华为云 > 清华TUNA

NODE_VERSION="22.13.0"
NODE_MIRRORS=(
  "https://npmmirror.com/mirrors/node/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${ARCH}.tar.gz"
  "https://mirrors.huaweicloud.com/nodejs/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${ARCH}.tar.gz"
  "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${ARCH}.tar.gz"
  "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${ARCH}.tar.gz"  # 国际回退
)
```

### 5.3 macOS Skills 工具二进制 CN 下载

预打包的 7 个工具需要 macOS Universal Binary 版本。来源策略：

| 工具 | 大小 | 来源(CN) | 来源(国际) |
|------|------|---------|-----------|
| camsnap | ~3MB | 香港服务器 `43.129.194.117:8888` | GitHub Release |
| sag | ~10MB | 香港服务器 | GitHub Release |
| gog | ~21MB | 香港服务器 | GitHub Release |
| goplaces | ~8MB | 香港服务器 | GitHub Release |
| openhue | ~9MB | ClawdSkillsProxy `121.43.61.90` | GitHub Release |
| spogo | ~13MB | 香港服务器 | GitHub Release |
| jira | ~20MB | ClawdSkillsProxy | GitHub Release |

大型代理工具（按需下载，不预打包）：

| 工具 | 大小 | 来源(CN) | 用途 |
|------|------|---------|------|
| ffmpeg | ~90MB | ClawdSkillsProxy | 视频处理 |
| yt-dlp | ~18MB | ClawdSkillsProxy | 视频下载 |
| gh (GitHub CLI) | ~15MB | ClawdSkillsProxy | GitHub 操作 |
| himalaya | ~13MB | ClawdSkillsProxy | 邮件管理 |
| uv | ~21MB | ClawdSkillsProxy | Python 包管理 |
| rclone | ~27MB | ClawdSkillsProxy | 云存储同步 |
| sherpa-onnx | ~21MB | ClawdSkillsProxy | 语音识别 |

### 5.4 Native 模块平台适配

需要为 macOS 打包的 native .node 文件：

| 模块 | darwin-arm64 | darwin-x64 | 说明 |
|------|-------------|------------|------|
| **sharp** | `@img/sharp-darwin-arm64` | `@img/sharp-darwin-x64` | 图像处理 + libvips vendor |
| **node-pty** | `@lydell/node-pty-darwin-arm64` | `@lydell/node-pty-darwin-x64` | 伪终端 |
| **sqlite-vec** | darwin-arm64 .node | darwin-x64 .node | 向量数据库 |
| **canvas** (可选) | `@napi-rs/canvas-darwin-arm64` | `@napi-rs/canvas-darwin-x64` | 绘图 |
| **node-llama** (可选) | `@node-llama-cpp/mac-arm64` | `@node-llama-cpp/mac-x64` | LLM推理 |

**清理策略**：构建时删除非当前平台的 native 模块：
- arm64 包：删除 `*-darwin-x64`, `*-win32-*`, `*-linux-*`
- x64 包：删除 `*-darwin-arm64`, `*-win32-*`, `*-linux-*`
- universal 包：保留两个 darwin 平台，删除 win32 和 linux

---

## 六、用户安装体验设计

### 6.1 小白用户安装流程（DMG 方式）

```
步骤 1: 下载
  用户从官网/微信群/百度网盘下载：
  OpenClawCN-macOS-v2026.2.0-universal.dmg（~140MB）

步骤 2: 安装
  ┌──────────────────────────────────────┐
  │ 双击 DMG 文件                         │
  │  ↓                                   │
  │ 看到应用图标和 Applications 文件夹     │
  │  ↓                                   │
  │ 拖拽 OpenClawCN.app → Applications     │
  │  ↓                                   │
  │ 完成！弹出 DMG                        │
  └──────────────────────────────────────┘

步骤 3: 首次启动
  ┌──────────────────────────────────────┐
  │ 在 Launchpad 或 Applications 中      │
  │ 双击 OpenClawCN                        │
  │  ↓                                   │
  │ [已签名+公证] 直接打开，无安全提示     │
  │  ↓                                   │
  │ 菜单栏出现 OpenClawCN 图标             │
  │  ↓                                   │
  │ 自动检测网络环境（3秒）               │
  │  ↓                                   │
  │ 自动打开浏览器：                      │
  │ http://localhost:18789/setup          │
  │  ↓                                   │
  │ 中文设置向导                          │
  │  ├─ 选择AI提供商（推荐硅基流动）       │
  │  ├─ 输入API Key                      │
  │  ├─ 可选：连接飞书/钉钉/企微          │
  │  └─ 完成！开始使用                    │
  └──────────────────────────────────────┘
```

### 6.2 未签名包的处理（开发版/ad-hoc签名）

如果包未经 Apple 公证，需要额外步骤：

```
步骤 A: 移除隔离属性
  系统提示"无法验证开发者" → 用户需要：

  方案1（推荐，GUI 操作）:
    打开 系统设置 → 隐私与安全性 → 下滑找到
    "OpenClawCN 已被阻止" → 点击"仍然打开"

  方案2（终端操作）:
    打开终端.app，粘贴命令：
    xattr -cr /Applications/OpenClawCN.app
    然后再次双击打开

步骤 B: 权限授予
  首次使用某些功能时，macOS 会弹出权限请求：
    - 通知权限 → 允许（用于消息提醒）
    - 辅助功能权限 → 允许（用于自动化）
    - 麦克风权限 → 允许（用于语音功能，可选）
    - 屏幕录制 → 允许（用于截屏分析，可选）
```

### 6.3 菜单栏应用功能

```
macOS 菜单栏（右上角）:

  🤖 OpenClawCN 图标
   │
   ├─ 打开控制面板        → 浏览器打开 Web UI
   ├─ ──────────────
   ├─ Gateway 状态: ✅ 运行中
   ├─ 端口: 18789
   ├─ ──────────────
   ├─ 启动 Gateway
   ├─ 停止 Gateway
   ├─ 重启 Gateway
   ├─ ──────────────
   ├─ 网络模式: 🇨🇳 国内
   ├─ 切换网络模式...     → 子菜单：国际/国内/离线
   ├─ ──────────────
   ├─ 开机自启动 ✓
   ├─ 查看日志...
   ├─ 检查更新...         → Sparkle 自动更新
   ├─ ──────────────
   └─ 退出 OpenClawCN
```

### 6.4 Launchd 服务管理

```xml
<!-- ~/Library/LaunchAgents/com.openclawcn.gateway.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclawcn.gateway</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/OpenClawCN.app/Contents/Resources/node/bin/node</string>
        <string>/Applications/OpenClawCN.app/Contents/Resources/gateway/dist/entry.js</string>
        <string>gateway</string>
        <string>run</string>
        <string>--port</string>
        <string>18789</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>OPENCLAWCN_BUNDLED_SKILLS_DIR</key>
        <string>/Applications/OpenClawCN.app/Contents/Resources/gateway/skills</string>
        <key>OPENCLAWCN_BUNDLED_TOOLS_DIR</key>
        <string>/Applications/OpenClawCN.app/Contents/Resources/tools</string>
        <key>OPENCLAWCN_BUNDLED_PLUGINS_DIR</key>
        <string>/Applications/OpenClawCN.app/Contents/Resources/gateway/extensions</string>
        <key>OPENCLAWCN_STATE_DIR</key>
        <string>~/Library/Application Support/OpenClawCN</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>~/Library/Logs/OpenClawCN/gateway.log</string>
    <key>StandardErrorPath</key>
    <string>~/Library/Logs/OpenClawCN/gateway-error.log</string>
</dict>
</plist>
```

---

## 七、CN 区下载分发方案

### 7.1 CDN 分发（主推）

| 渠道 | URL | 说明 |
|------|-----|------|
| **阿里云 OSS** | `https://oss.openclawcn.cn/macos/latest/` | 主 CDN，全国加速 |
| **腾讯云 COS** | `https://cos.openclawcn.cn/macos/latest/` | 备用 CDN |
| **官网下载页** | `https://openclawcn.cn/download` | 自动检测架构 |

### 7.2 社交渠道分发

| 渠道 | 方式 | 大小限制 |
|------|------|---------|
| **微信群** | 直接发文件 / 发下载链接 | 200MB（文件）/ 无限（链接） |
| **百度网盘** | 分享链接+提取码 | 无限制 |
| **蓝奏云** | 分享链接 | 100MB（需分卷） |
| **阿里云盘** | 分享链接 | 无限制 |
| **Gitee Release** | Git 标签发布 | 100MB |

### 7.3 自动更新（Sparkle）

CN 用户的 Sparkle 更新源指向国内 CDN：

```xml
<!-- Info.plist -->
<key>SUFeedURL</key>
<string>https://oss.openclawcn.cn/macos/sparkle/appcast.xml</string>
```

```xml
<!-- appcast.xml -->
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>OpenClawCN macOS Updates</title>
    <item>
      <title>版本 2026.2.1</title>
      <sparkle:releaseNotesLink>
        https://oss.openclawcn.cn/macos/sparkle/notes/2026.2.1-cn.html
      </sparkle:releaseNotesLink>
      <pubDate>Mon, 10 Feb 2026 00:00:00 +0800</pubDate>
      <enclosure
        url="https://oss.openclawcn.cn/macos/releases/OpenClawCN-2026.2.1.dmg"
        sparkle:version="20260201"
        sparkle:shortVersionString="2026.2.1"
        length="146800640"
        type="application/octet-stream"
        sparkle:edSignature="..."
      />
    </item>
  </channel>
</rss>
```

---

## 八、代码签名与公证

### 8.1 签名策略

| 场景 | 证书类型 | 效果 |
|------|---------|------|
| **正式发布** | Developer ID Application | Gatekeeper 自动通过，用户零感知 |
| **TestFlight** | Apple Distribution | 仅限测试用户 |
| **开发测试** | Apple Development | 本机运行，需手动信任 |
| **无证书** | Ad-hoc (-) | 每次启动需确认，权限不持久 |

### 8.2 公证流程

```bash
# 1. 打包为 ZIP（公证要求）
ditto -c -k --sequesterRsrc dist/OpenClawCN.app dist/OpenClawCN-notarize.zip

# 2. 提交公证
xcrun notarytool submit dist/OpenClawCN-notarize.zip \
  --apple-id "developer@openclawcn.cn" \
  --password "@keychain:AC_PASSWORD" \
  --team-id "TEAM_ID" \
  --wait --timeout 30m

# 3. 查看公证结果（如果失败）
xcrun notarytool log <submission-id> \
  --apple-id "developer@openclawcn.cn" \
  --password "@keychain:AC_PASSWORD" \
  --team-id "TEAM_ID"

# 4. 装订公证票据
xcrun stapler staple dist/OpenClawCN.app

# 5. 验证
spctl -a -vvv dist/OpenClawCN.app
# 预期输出: dist/OpenClawCN.app: accepted
# source=Notarized Developer ID
```

### 8.3 权限文件 (Entitlements)

```xml
<!-- build/macos/OpenClawCN.entitlements -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <!-- 基础权限 -->
    <key>com.apple.security.automation.apple-events</key>
    <true/>

    <!-- 硬件访问（可选 skill 需要） -->
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>

    <!-- 位置服务（可选） -->
    <key>com.apple.security.personal-information.location</key>
    <true/>

    <!-- JIT 编译（node-llama-cpp 需要） -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
</dict>
</plist>
```

---

## 九、数据目录规划

### 9.1 macOS 目录约定

```
~/Library/Application Support/OpenClawCN/    # 主数据目录
├── config/
│   ├── openclawcn.json                        # 主配置
│   ├── network-profile.json                 # 网络检测结果
│   └── exec-approvals.json                  # 命令执行授权
├── data/
│   ├── mcp-index.json                       # MCP 市场索引
│   └── skills-cache/                        # Skills 缓存
├── logs/
│   ├── gateway.log
│   └── gateway-error.log
├── tools/                                   # 运行时下载的工具
│   ├── ffmpeg
│   ├── yt-dlp
│   └── ...
└── models/                                  # LLM 模型（可选）
    └── ...

~/Library/Logs/OpenClawCN/                   # 系统日志目录
├── gateway.log
└── gateway-error.log

~/Library/LaunchAgents/
└── com.openclawcn.gateway.plist               # 开机自启配置

~/Library/Caches/OpenClawCN/                 # 缓存（可清理）
├── npm-cache/
├── pip-cache/
└── download-cache/
```

### 9.2 与 Windows 目录对照

| 用途 | Windows | macOS |
|------|---------|-------|
| 主数据 | `%APPDATA%\OpenClawCN\` | `~/Library/Application Support/OpenClawCN/` |
| 日志 | `%APPDATA%\OpenClawCN\logs\` | `~/Library/Logs/OpenClawCN/` |
| 缓存 | `%LOCALAPPDATA%\OpenClawCN\Cache\` | `~/Library/Caches/OpenClawCN/` |
| 自启动 | 启动文件夹快捷方式 | LaunchAgent plist |
| 工具安装 | `{app}\tools\` | 应用包内 + 运行时目录 |

---

## 十、与现有代码的集成点

### 10.1 需要修改的现有文件

| 文件 | 修改内容 |
|------|---------|
| `src/config/region-cn.ts` | 添加 macOS 特定的 Homebrew 镜像配置注入 |
| `src/config/defaults.ts` | 添加 macOS 数据目录路径 |
| `src/agents/skills-install.ts` | 添加 macOS Homebrew 镜像回退 |
| `src/agents/shell-utils.ts` | 确认 macOS shell 检测逻辑 |
| `src/infra/brew.ts` | 添加 CN 镜像环境变量注入 |
| `src/macos/gateway-daemon.ts` | 添加网络检测启动钩子 |
| `src/macos/relay.ts` | 添加网络模式切换 IPC 命令 |
| `src/entry.ts` | 添加 macOS + CN 启动初始化 |

### 10.2 需要新增的文件

| 文件 | 用途 |
|------|------|
| `src/config/network-detect.ts` | 网络连通性检测模块 |
| `src/config/network-profile.ts` | 网络配置持久化 |
| `build/scripts/build-macos-cn.sh` | macOS CN 一键构建脚本 |
| `build/scripts/prepare-macos-bins.sh` | macOS 二进制工具准备脚本 |
| `build/scripts/assemble-macos-app.sh` | macOS .app 组装脚本 |
| `build/scripts/upload-to-cn-cdn.sh` | CDN 上传脚本 |
| `.github/workflows/build-macos-cn.yml` | CI/CD 工作流 |

### 10.3 已有可复用的文件

| 文件 | 复用方式 |
|------|---------|
| `scripts/package-mac-app.sh` | .app 打包核心逻辑，直接扩展 |
| `scripts/codesign-mac-app.sh` | 代码签名，完整可用 |
| `scripts/create-dmg.sh` | DMG 创建，完整可用 |
| `build/scripts/build-macos-parallel.sh` | 并行构建参考 |
| `build/scripts/build-macos-oneclick.sh` | 一键构建参考 |
| `.github/workflows/build-macos.yml` | CI/CD 参考 |
| `src/config/cn-mirrors.ts` | CN 镜像源列表，完整可用 |
| `src/agents/skills/mirror-download-engine.ts` | 镜像下载引擎，完整可用 |

---

## 十一、测试计划

### 11.1 构建测试

| 测试项 | 方法 | 预期 |
|--------|------|------|
| arm64 构建 | M1/M2 Mac 上构建 | ✅ 成功，<15分钟 |
| x64 构建 | Intel Mac 上构建 | ✅ 成功，<15分钟 |
| Universal 合并 | lipo -create | ✅ file 显示 universal |
| DMG 创建 | create-dmg.sh | ✅ 拖拽安装可用 |
| 包大小 | du -sh | < 200MB |

### 11.2 安装测试矩阵

| 机型 | macOS 版本 | 测试内容 | 预期 |
|------|-----------|---------|------|
| MacBook Air M1 | macOS 14 Sonoma | 全流程安装 | ✅ |
| MacBook Pro M3 | macOS 15 Sequoia | 全流程安装 | ✅ |
| MacBook Pro Intel | macOS 13 Ventura | 全流程安装 | ✅ |
| iMac Intel | macOS 12 Monterey | 全流程安装 | ✅ |
| Mac mini M2 | macOS 14 Sonoma | 无显示器安装 | ✅ |

### 11.3 网络测试

| 测试场景 | 方法 | 预期 |
|---------|------|------|
| 纯国际网络 | VPN + 海外IP | → international 模式 |
| 纯国内网络 | 无VPN，GFW环境 | → cn-only 模式 |
| 混合网络 | 有VPN但国内快 | → cn-preferred 模式 |
| 完全离线 | 断网安装 | → offline 模式，核心功能可用 |
| 网络切换 | 安装后切换 | Web UI 手动切换网络模式 |

### 11.4 功能测试

| 测试项 | 预期 |
|--------|------|
| Gateway 启动 | 3秒内就绪，Web UI 可访问 |
| Skills 浏览 | 53个核心 skills 在 UI 中可见 |
| Skills 安装（CN） | 通过 CN 镜像成功安装 |
| AI 对话 | 硅基流动/通义千问 API 可用 |
| 飞书扩展 | 正常连接和回复 |
| 菜单栏 | 图标正常，所有菜单项可用 |
| 开机自启 | 重启后自动启动 Gateway |
| 自动更新 | Sparkle 检查到新版本 |

---

## 十二、时间估算与分工

### 12.1 开发阶段

| 阶段 | 任务 | 依赖现有代码 | 预估工作量 |
|------|------|-------------|-----------|
| **P0: 网络检测** | `network-detect.ts` + `network-profile.ts` | 新增 | 2天 |
| **P1: 构建脚本** | `build-macos-cn.sh` + `prepare-macos-bins.sh` | 扩展现有 | 3天 |
| **P2: .app 组装** | 扩展 `package-mac-app.sh` | 扩展现有 | 2天 |
| **P3: CN 镜像集成** | Homebrew/pip/npm 镜像注入 | 扩展 `region-cn.ts` | 2天 |
| **P4: 菜单栏优化** | Swift 菜单增加网络模式切换 | 扩展现有 Swift | 2天 |
| **P5: DMG/PKG 打包** | 美化 DMG + PKG 脚本 | 扩展现有 | 1天 |
| **P6: CI/CD** | GitHub Actions 工作流 | 参考现有 | 1天 |
| **P7: CDN 上传** | 阿里云 OSS 上传自动化 | 新增 | 1天 |
| **P8: 测试** | 全平台测试 | - | 3天 |

**总计：约 17 个工作日**

### 12.2 优先级排序

```
P0 ─→ P1 ─→ P2 ─→ P5 （核心构建链路，先跑通）
              ↓
         P3 + P4     （CN优化，可并行）
              ↓
         P6 ─→ P7    （自动化）
              ↓
              P8      （测试）
```

---

## 十三、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| Apple Developer 证书费用 ($99/年) | 无证书→Gatekeeper拦截 | 先发布 ad-hoc 版本+手动信任教程 |
| Node.js 22 在旧 macOS 不支持 | macOS 12 以下无法运行 | 最低支持 macOS 12 Monterey |
| 大型 native 模块编译失败 | sharp/node-pty 构建问题 | 使用 prebuilt binaries |
| CN CDN 成本 | 流量费用 | 限速下载 + 分发到网盘 |
| Sparkle 更新被拦截 | 自动更新失败 | 备用手动下载链接 |
| GitHub Actions macOS runner 收费 | CI 成本高 | 自建 Mac mini CI 节点 |

---

## 十四、与 Windows 方案的统一性设计

### 14.1 跨平台统一的配置

```json
// ~/.openclawcn/openclawcn.json（macOS 和 Windows 共用 schema）
{
  "region": "cn",
  "network": {
    "mode": "cn-only",
    "npmRegistry": "https://registry.npmmirror.com",
    "pipIndex": "https://pypi.mirrors.ustc.edu.cn/simple/",
    "goProxy": "https://goproxy.cn,direct"
  },
  "gateway": {
    "port": 18789,
    "token": "..."
  },
  "tools": {
    "exec": {
      "security": "full",
      "safeBins": ["..."]
    }
  }
}
```

### 14.2 跨平台统一的环境变量

| 环境变量 | Windows | macOS | 说明 |
|---------|---------|-------|------|
| `OPENCLAWCN_REGION` | start-gateway.bat | LaunchAgent plist | 区域标识 |
| `OPENCLAWCN_BUNDLED_SKILLS_DIR` | {app}\skills | Resources/gateway/skills | Skills 目录 |
| `OPENCLAWCN_BUNDLED_TOOLS_DIR` | {app}\tools | Resources/tools | 工具目录 |
| `OPENCLAWCN_BUNDLED_PLUGINS_DIR` | {app}\extensions | Resources/gateway/extensions | 扩展目录 |
| `OPENCLAWCN_STATE_DIR` | %APPDATA%\OpenClawCN | ~/Library/Application Support/OpenClawCN | 数据目录 |
| `OPENCLAWCN_GATEWAY_TOKEN` | 固定值 | 首次启动生成 | Gateway 认证 |

---

## 附录 A：快速参考 - 现有 macOS 代码文件清单

```
关键源代码：
├── src/macos/gateway-daemon.ts        # 网关守护进程
├── src/macos/relay.ts                 # Swift-Node IPC 中继
├── src/infra/brew.ts                  # Homebrew 检测
├── src/infra/capability-detect.ts     # 能力检测（macOS app 检测）
├── src/daemon/service-env.ts          # 服务环境（PATH 配置）
├── src/config/region-cn.ts            # CN 区域配置
├── src/config/cn-mirrors.ts           # CN 镜像源

构建脚本：
├── scripts/package-mac-app.sh         # .app 打包
├── scripts/codesign-mac-app.sh        # 代码签名
├── scripts/create-dmg.sh             # DMG 创建
├── build/scripts/build-macos-parallel.sh  # 并行构建
├── build/scripts/build-macos-oneclick.sh  # 一键构建

CI/CD：
├── .github/workflows/build-macos.yml  # GitHub Actions

文档：
├── docs/platforms/macos.md            # macOS 平台文档
├── docs/platforms/macos-vm.md         # macOS VM 文档
├── build/macos-packaging-guide.md     # 打包指南

Swift 应用：
├── apps/macos/Sources/                # Swift 源代码
├── apps/macos/Package.swift           # Swift 包定义
```

## 附录 B：镜像源完整列表

| 工具 | 镜像1（最快） | 镜像2 | 镜像3 | 国际回退 |
|------|-------------|-------|-------|---------|
| npm | npmmirror.com | 腾讯云 | 华为云 | npmjs.org |
| pip | 中科大 | 阿里云 | 清华 | pypi.org |
| Go | 七牛 goproxy.cn | 阿里云 | goproxy.io | proxy.golang.org |
| Cargo | 字节 rsproxy.cn | 中科大 | 清华 | crates.io |
| Homebrew | 中科大 | 清华 | 阿里云 | brew.sh |
| Conda | 清华 | 阿里云 | 中科大 | anaconda.com |
| Node.js | 淘宝npm | 华为云 | 清华 | nodejs.org |
| GitHub | gh-proxy.com | ghfast.top | ghproxy.cn | github.com |

## 附录 C：macOS 最低系统要求

| 项目 | 要求 |
|------|------|
| macOS 版本 | 12.0 Monterey 或更高 |
| 芯片 | Intel x86_64 或 Apple Silicon (M1/M2/M3/M4) |
| 内存 | 最低 4GB，推荐 8GB+ |
| 磁盘 | 安装需 500MB，运行推荐预留 2GB+ |
| Node.js | 内置，无需单独安装 |
| Python | macOS 自带 / Homebrew 安装 |
| Xcode CLT | 可选（某些 skill 需要编译） |
