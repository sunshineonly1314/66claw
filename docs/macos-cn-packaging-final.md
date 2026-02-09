# ClawdbotCN macOS 无证书打包方案（最终版）

> 2026-02-09 | 基于深度调研的技术决策
> 目标：苹果小白用户零命令行安装

---

## 一、核心技术决策

经过对 macOS 15 Sequoia 安全机制、现有代码库、中国网络环境的深度调研，做出以下技术决策：

### 1.1 决策总览

| 决策项 | 选择 | 理由 |
|--------|------|------|
| **应用类型** | Shell 脚本 .app（非 Swift） | 无需 Xcode 编译，维护简单，签名容易 |
| **签名方式** | Ad-hoc 签名 (`codesign --sign -`) | 免费，Apple Silicon 必须，够用 |
| **包格式** | DMG（主推）+ ZIP（备选） | DMG 最贴合 Mac 用户习惯 |
| **系统托盘** | 不做 | 无证书→TCC权限不持久→每次重启弹权限→体验差 |
| **UI 方案** | 纯浏览器 Web UI | 已有成熟 Web UI，无需 native UI |
| **服务管理** | 后台进程（非 launchd） | 简单可靠，不需要额外配置 |
| **自动更新** | Web UI 内版本检查 + 手动下载 | Sparkle 需要签名才好用，先不用 |
| **网络检测** | 首次启动智能检测 | 已有 region-cn.ts，扩展即可 |
| **分发渠道** | CDN + curl安装 + 网盘 | 多渠道覆盖不同用户 |

### 1.2 关键取舍

**砍掉 Swift 菜单栏应用的原因**：
```
无证书签名 → TCC 权限（通知、辅助功能、麦克风等）不持久化
         → 每次重启 macOS 都重新弹权限请求
         → 小白用户被反复骚扰
         → 体验反而不如纯浏览器方案

结论：用浏览器做 UI，Node.js 后台进程做服务
     → 不需要任何 macOS 特殊权限
     → 零弹窗，零烦扰
```

**选择 DMG 而非 ZIP 的原因**：
```
DMG 优势：
  ✓ DMG 本身可以正常挂载（不触发 Gatekeeper）
  ✓ 内置背景图片 → 可以画中文安装指引
  ✓ Mac 用户最熟悉的安装方式
  ✓ 拖拽到 Applications 文件夹后 .app 自动带上"Open Anyway"的 GUI 路径

ZIP 劣势：
  ✗ 解压后的 .app 没有视觉引导
  ✗ 用户可能解压到奇怪的位置
  ✗ 不如 DMG 专业
```

---

## 二、Gatekeeper 应对策略（核心难点）

### 2.1 macOS 15 Sequoia 的残酷现实

```
macOS 15 重大变化（2024年秋季）：
  ✗ 移除了"右键 → 打开"绕过 Gatekeeper 的能力
  ✗ 现在必须走：系统设置 → 隐私与安全性 → 仍然打开

  完整操作流程（7步）：
  1. 双击 .app → 被拦截
  2. 弹出"无法验证开发者"对话框 → 点击"好"
  3. 打开"系统设置"
  4. 点击"隐私与安全性"
  5. 滚动到底部找到安全性区域
  6. 看到"ClawdbotCN 已被阻止" → 点击"仍然打开"
  7. 输入密码/Touch ID → 确认

  macOS 15.1 还出过 Bug：完全无法打开未签名应用（15.2 已修复）
```

### 2.2 我们的应对方案：三重保障

```
┌──────────────────────────────────────────────────────────┐
│  保障层 1: DMG 背景图片中文教程                            │
│  ──────────────────────────────────                      │
│  在 DMG 打开时，用户就能看到清晰的中文步骤图解：            │
│  "如果提示'无法验证开发者'，请按以下步骤操作..."           │
│  配合截图标注，让小白也能顺利完成                          │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  保障层 2: 应用首次启动自动修复                            │
│  ──────────────────────────────────                      │
│  .app 内的启动脚本会自动执行 xattr -cr                    │
│  修复所有内嵌二进制的隔离属性                              │
│  用户只需要过一次 "仍然打开" 的关卡                       │
│  此后所有内部组件（node、tools等）都畅通无阻               │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  保障层 3: 备选 curl 安装路径（零 Gatekeeper）            │
│  ──────────────────────────────────                      │
│  对于完全搞不定 Gatekeeper 的用户：                       │
│  打开终端，粘贴一行命令：                                 │
│  curl -fsSL https://oss.clawdbot.cn/install.sh | bash   │
│                                                          │
│  原理：curl 下载的内容不带隔离属性                        │
│  效果：完全绕过 Gatekeeper，零警告                        │
└──────────────────────────────────────────────────────────┘
```

---

## 三、应用结构设计

### 3.1 Shell 脚本 .app 方案

不使用 Swift/Xcode，直接用 shell 脚本构建 .app bundle：

```
ClawdbotCN.app/
├── Contents/
│   ├── Info.plist                    # 应用元数据
│   ├── PkgInfo                       # "APPL????"
│   ├── MacOS/
│   │   └── ClawdbotCN               # ★ Shell 脚本入口（非编译二进制）
│   └── Resources/
│       ├── AppIcon.icns              # 应用图标
│       ├── node/                     # 内嵌 Node.js Universal Binary
│       │   └── bin/
│       │       └── node              # ad-hoc 签名
│       ├── gateway/                  # 网关应用代码
│       │   ├── dist/                 # 编译后 JS
│       │   ├── ui/dist/              # Web UI 静态文件
│       │   ├── package.json
│       │   ├── node_modules/         # 生产依赖（已精简）
│       │   ├── skills/               # 53个核心 skills
│       │   ├── extensions/           # 飞书/钉钉/企微等
│       │   ├── assets/
│       │   └── data/                 # MCP 索引
│       ├── tools/                    # 预打包工具二进制
│       │   ├── camsnap
│       │   ├── sag
│       │   ├── gog
│       │   └── ... (7个)
│       └── version.json             # 版本信息
```

### 3.2 核心启动脚本 (`Contents/MacOS/ClawdbotCN`)

```bash
#!/bin/bash
# ClawdbotCN macOS 启动脚本
# 这是一个 shell 脚本，不是编译的二进制
# macOS 会用 /bin/bash（系统自带，已签名）来执行

set -euo pipefail

# ── 路径设置 ──
MACOS_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES="$MACOS_DIR/../Resources"
NODE_BIN="$RESOURCES/node/bin/node"
GATEWAY_DIR="$RESOURCES/gateway"
TOOLS_DIR="$RESOURCES/tools"
STATE_DIR="$HOME/Library/Application Support/ClawdbotCN"
LOG_DIR="$HOME/Library/Logs/ClawdbotCN"
PORT=18789

export PATH="$RESOURCES/node/bin:$TOOLS_DIR:$PATH"

# ── 首次启动自动修复 ──
if ! "$NODE_BIN" --version >/dev/null 2>&1; then
    # Node.js 无法执行 → 可能是隔离属性
    echo "首次启动，正在配置运行环境..."

    # 移除所有隔离属性
    xattr -cr "$RESOURCES" 2>/dev/null || true

    # 确保可执行权限
    chmod +x "$NODE_BIN" 2>/dev/null || true
    chmod +x "$TOOLS_DIR"/* 2>/dev/null || true

    # 对 Node.js 进行 ad-hoc 签名（Apple Silicon 必须）
    if [ "$(uname -m)" = "arm64" ]; then
        codesign --sign - --force "$NODE_BIN" 2>/dev/null || true
        for tool in "$TOOLS_DIR"/*; do
            [ -f "$tool" ] && codesign --sign - --force "$tool" 2>/dev/null || true
        done
    fi

    # 再次检查
    if ! "$NODE_BIN" --version >/dev/null 2>&1; then
        osascript -e 'display dialog "Node.js 运行时初始化失败。\n\n请尝试在终端运行：\nxattr -cr /Applications/ClawdbotCN.app\n\n或使用一键安装命令：\ncurl -fsSL https://oss.clawdbot.cn/install.sh | bash" with title "ClawdbotCN" buttons {"好"} default button 1 with icon stop'
        exit 1
    fi
fi

# ── 创建数据目录 ──
mkdir -p "$STATE_DIR/config" 2>/dev/null || true
mkdir -p "$STATE_DIR/data" 2>/dev/null || true
mkdir -p "$STATE_DIR/tools" 2>/dev/null || true
mkdir -p "$LOG_DIR" 2>/dev/null || true

# ── 设置环境变量 ──
export CLAWDBOT_BUNDLED_SKILLS_DIR="$RESOURCES/gateway/skills"
export CLAWDBOT_BUNDLED_TOOLS_DIR="$TOOLS_DIR"
export CLAWDBOT_BUNDLED_PLUGINS_DIR="$RESOURCES/gateway/extensions"
export CLAWDBOT_STATE_DIR="$STATE_DIR"
export NODE_ENV=production

# ── 检查端口 ──
if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    # 已经在运行，直接打开浏览器
    open "http://localhost:$PORT/"
    exit 0
fi

# ── 启动 Gateway ──
cd "$GATEWAY_DIR"

# 3秒后打开浏览器（后台）
(sleep 3 && open "http://localhost:$PORT/setup") &

# 启动 Node.js Gateway（前台，日志输出到文件）
exec "$NODE_BIN" dist/entry.js gateway run --port "$PORT" \
    >> "$LOG_DIR/gateway.log" 2>> "$LOG_DIR/gateway-error.log"
```

### 3.3 Info.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>ClawdbotCN</string>
    <key>CFBundleDisplayName</key>
    <string>ClawdbotCN</string>
    <key>CFBundleIdentifier</key>
    <string>cn.clawdbot.mac</string>
    <key>CFBundleVersion</key>
    <string>2026.2.0</string>
    <key>CFBundleShortVersionString</key>
    <string>2026.2.0</string>
    <key>CFBundleExecutable</key>
    <string>ClawdbotCN</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
    <key>NSHumanReadableCopyright</key>
    <string>ClawdbotCN 2026</string>
</dict>
</plist>
```

---

## 四、DMG 设计（小白安装体验核心）

### 4.1 DMG 视觉布局

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   ┌──────────────────────────────────────────────┐  │
│   │  ★ 安装方法：拖动图标到右边文件夹 →          │  │
│   │                                              │  │
│   │  ⚠️ 首次打开如果提示"无法验证开发者"：       │  │
│   │     1. 打开「系统设置」                       │  │
│   │     2. 点击「隐私与安全性」                   │  │
│   │     3. 滚动到底部，点击「仍然打开」           │  │
│   │     4. 输入密码确认                           │  │
│   │                                              │  │
│   │  💡 也可以在终端粘贴一行命令自动安装：        │  │
│   │     curl -fsSL oss.clawdbot.cn/i | bash      │  │
│   └──────────────────────────────────────────────┘  │
│                                                     │
│      ┌──────────┐           ┌──────────────┐       │
│      │          │           │              │       │
│      │ Clawdbot │    →→→    │ Applications │       │
│      │   CN     │           │    文件夹     │       │
│      │          │           │              │       │
│      └──────────┘           └──────────────┘       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 DMG 创建脚本

```bash
#!/bin/bash
# build/scripts/create-cn-dmg.sh

APP_PATH="$1"                              # ClawdbotCN.app 路径
VERSION="${2:-$(date +%Y.%-m.0)}"
DMG_NAME="ClawdbotCN-macOS-v${VERSION}-universal"
DMG_TEMP="build/dmg-temp"
DMG_FINAL="build/output/${DMG_NAME}.dmg"
BG_IMAGE="build/macos/dmg-background-cn.png"  # 中文背景图

# 清理
rm -rf "$DMG_TEMP" "$DMG_FINAL"
mkdir -p "$DMG_TEMP" "build/output"

# 复制应用
cp -R "$APP_PATH" "$DMG_TEMP/"

# 创建 Applications 符号链接
ln -s /Applications "$DMG_TEMP/Applications"

# 复制 README
cat > "$DMG_TEMP/安装说明.txt" << 'README'
ClawdbotCN 安装说明
==================

方法一：拖拽安装（推荐）
  1. 将 ClawdbotCN 图标拖到 Applications 文件夹
  2. 打开 启动台(Launchpad)，找到 ClawdbotCN
  3. 双击打开
  4. 如果提示"无法验证开发者"：
     → 打开「系统设置」→「隐私与安全性」
     → 滚动到底部 → 点击「仍然打开」
     → 输入密码确认

方法二：终端一键安装（如果方法一不行）
  1. 打开「终端」(在 启动台 → 其他 → 终端)
  2. 粘贴这行命令，按回车：
     curl -fsSL https://oss.clawdbot.cn/install.sh | bash

启动后会自动打开浏览器配置页面。
README

# 创建 DMG
hdiutil create -volname "$DMG_NAME" \
    -srcfolder "$DMG_TEMP" \
    -ov -format UDRW \
    "build/output/${DMG_NAME}-rw.dmg"

# 挂载设置外观
MOUNT_DIR=$(hdiutil attach "build/output/${DMG_NAME}-rw.dmg" -readwrite | tail -1 | awk '{print $NF}')

# 复制背景图
mkdir -p "$MOUNT_DIR/.background"
cp "$BG_IMAGE" "$MOUNT_DIR/.background/background.png"

# AppleScript 设置窗口外观
osascript << APPLESCRIPT
tell application "Finder"
    tell disk "$DMG_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set bounds of container window to {200, 100, 820, 540}
        set theViewOptions to icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to 100
        set background picture of theViewOptions to file ".background:background.png"
        set position of item "ClawdbotCN.app" of container window to {160, 320}
        set position of item "Applications" of container window to {460, 320}
        set position of item "安装说明.txt" of container window to {310, 445}
        close
        open
        update without registering applications
    end tell
end tell
APPLESCRIPT

# 卸载
hdiutil detach "$MOUNT_DIR"

# 转换为只读压缩格式
hdiutil convert "build/output/${DMG_NAME}-rw.dmg" \
    -format UDZO -imagekey zlib-level=9 \
    -o "$DMG_FINAL"
rm "build/output/${DMG_NAME}-rw.dmg"

# 生成校验和
shasum -a 256 "$DMG_FINAL" > "${DMG_FINAL}.sha256"

echo "DMG 创建完成: $DMG_FINAL"
echo "大小: $(du -h "$DMG_FINAL" | cut -f1)"
```

---

## 五、用户安装全流程

### 5.1 路径 A：DMG 拖拽安装（推荐，适合小白）

```
用户操作                          系统行为
─────────                        ──────
① 下载 ClawdbotCN.dmg            浏览器下载 ~140MB
        ↓
② 双击 .dmg 文件                 DMG 正常挂载（不触发 Gatekeeper）
        ↓                        显示 DMG 窗口 + 中文背景指引
        ↓
③ 拖 ClawdbotCN.app             复制到 /Applications/
   到 Applications 文件夹
        ↓
④ 弹出 DMG                      关闭虚拟磁盘
        ↓
⑤ 在启动台找到 ClawdbotCN        显示应用图标
   双击打开
        ↓
   ┌─ macOS 弹出 ─────────────────────────────────┐
   │ "ClawdbotCN"无法打开，因为 Apple 无法检查      │
   │  其是否包含恶意软件。                           │
   │                              [好的]            │
   └───────────────────────────────────────────────┘
        ↓
⑥ 点击"好的"
        ↓
⑦ 打开「系统设置」               苹果菜单  → 系统设置
   → 隐私与安全性
   → 滚动到底部
        ↓
   ┌─ 安全性区域 ─────────────────────────────────┐
   │ "ClawdbotCN"已被阻止使用，                     │
   │  因为来自身份不明的开发者。                      │
   │                         [仍然打开]             │
   └───────────────────────────────────────────────┘
        ↓
⑧ 点击「仍然打开」               弹出密码/Touch ID 验证
   输入密码确认
        ↓
⑨ ClawdbotCN 启动！              脚本自动执行：
                                  1. xattr -cr（修复内部二进制）
                                  2. 启动 Node.js Gateway
                                  3. 3秒后打开浏览器
        ↓
⑩ 浏览器自动打开                 http://localhost:18789/setup
   中文配置向导                   选AI提供商、输API Key
        ↓
⑪ 配置完成，开始使用！            从此以后双击即可启动
```

**⑤→⑨ 只需要第一次。** 之后双击就直接启动。

### 5.2 路径 B：一键命令安装（零 Gatekeeper）

对于搞不定 Gatekeeper 或偏好命令行的用户：

```
用户操作                          系统行为
─────────                        ──────
① 打开「终端」                   启动台 → 其他 → 终端
   (或 Spotlight 搜索 "终端")

② 粘贴命令，按回车：
   curl -fsSL https://oss.clawdbot.cn/install.sh | bash

        ↓                        curl 下载的内容不带隔离属性！
                                 → 完全绕过 Gatekeeper

   ┌─ 终端输出 ────────────────────────────────────┐
   │                                               │
   │  ClawdbotCN macOS 安装程序                     │
   │  ═══════════════════════                      │
   │                                               │
   │  [1/6] 检测系统环境...                         │
   │        macOS 14.2 / Apple M2 / 磁盘空间充足    │
   │  [2/6] 检测网络环境...                         │
   │        国内网络，使用 CN 镜像加速               │
   │  [3/6] 下载安装包 (140MB)...                   │
   │        ████████████████████ 100% (12.3 MB/s)  │
   │  [4/6] 安装到 /Applications/ClawdbotCN.app...  │
   │        解压完成，设置权限                       │
   │  [5/6] 启动 Gateway 服务...                    │
   │        Gateway 已在端口 18789 启动              │
   │  [6/6] 打开配置页面...                         │
   │        浏览器已打开 http://localhost:18789      │
   │                                               │
   │  ✓ 安装完成！                                  │
   │  以后双击启动台中的 ClawdbotCN 即可使用         │
   │                                               │
   └───────────────────────────────────────────────┘
```

### 5.3 两条路径对比

| 方面 | 路径A: DMG拖拽 | 路径B: curl命令 |
|------|--------------|----------------|
| **技术门槛** | 零（纯鼠标操作） | 低（需开终端粘贴一行） |
| **Gatekeeper** | 需要走一次"仍然打开" | 完全绕过，零警告 |
| **下载体验** | 浏览器下载 | curl 带进度条 |
| **安装位置** | 用户手动拖到 Applications | 自动安装到 Applications |
| **适合人群** | 完全小白 | 稍有经验的用户 |
| **推荐度** | ★★★★☆ | ★★★★★ |

---

## 六、在线安装脚本设计 (`install.sh`)

### 6.1 完整安装脚本

```bash
#!/bin/bash
# ClawdbotCN macOS 一键安装脚本
# 用法: curl -fsSL https://oss.clawdbot.cn/install.sh | bash
#
# 原理：通过 curl 管道执行的脚本创建的文件不带隔离属性
# 效果：完全绕过 macOS Gatekeeper

set -euo pipefail

# ── 颜色定义 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# ── 配置 ──
VERSION="2026.2.0"
INSTALL_DIR="/Applications/ClawdbotCN.app"
STATE_DIR="$HOME/Library/Application Support/ClawdbotCN"
LOG_DIR="$HOME/Library/Logs/ClawdbotCN"
PORT=18789

# CDN 镜像列表（按优先级）
CDN_MIRRORS=(
    "https://oss.clawdbot.cn/macos/releases"
    "https://cos.clawdbot.cn/macos/releases"
    "https://gh-proxy.com/https://github.com/clawdbot/releases/download"
)

# ── 工具函数 ──
info()    { echo -e "${BLUE}${BOLD}$1${NC}"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
error()   { echo -e "${RED}✗${NC} $1"; exit 1; }
step()    { echo -e "\n${CYAN}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"; }

TOTAL_STEPS=6

# ── 主流程 ──
main() {
    echo ""
    info "  ClawdbotCN macOS 安装程序"
    info "  ═══════════════════════"
    echo ""

    # Step 1: 系统检测
    step 1 "检测系统环境..."
    detect_system

    # Step 2: 网络检测
    step 2 "检测网络环境..."
    detect_network

    # Step 3: 下载
    step 3 "下载安装包..."
    download_package

    # Step 4: 安装
    step 4 "安装应用..."
    install_app

    # Step 5: 启动
    step 5 "启动 Gateway 服务..."
    start_gateway

    # Step 6: 打开浏览器
    step 6 "打开配置页面..."
    open_browser

    echo ""
    success "安装完成！"
    echo ""
    echo "  以后使用方法："
    echo "    • 在启动台(Launchpad)中找到 ClawdbotCN，双击启动"
    echo "    • 或在终端运行: open /Applications/ClawdbotCN.app"
    echo ""
    echo "  配置页面: http://localhost:$PORT"
    echo ""
}

detect_system() {
    # macOS 版本
    local macos_ver
    macos_ver=$(sw_vers -productVersion)
    local major_ver
    major_ver=$(echo "$macos_ver" | cut -d. -f1)
    if [ "$major_ver" -lt 12 ]; then
        error "需要 macOS 12 Monterey 或更高版本（当前: $macos_ver）"
    fi

    # 架构
    local arch
    arch=$(uname -m)
    case "$arch" in
        arm64) ARCH_LABEL="Apple Silicon (M1/M2/M3/M4)" ;;
        x86_64) ARCH_LABEL="Intel" ;;
        *) error "不支持的架构: $arch" ;;
    esac

    # 磁盘空间
    local free_mb
    free_mb=$(df -m /Applications | tail -1 | awk '{print $4}')
    if [ "$free_mb" -lt 500 ]; then
        error "磁盘空间不足（需要 500MB，可用 ${free_mb}MB）"
    fi

    success "macOS $macos_ver / $ARCH_LABEL / 磁盘空间充足 (${free_mb}MB)"
}

detect_network() {
    local cn_ok=false intl_ok=false
    local cn_time=999 intl_time=999

    # 并行检测（3秒超时）
    cn_time=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 3 \
        https://registry.npmmirror.com 2>/dev/null || echo "999")
    intl_time=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 3 \
        https://registry.npmjs.org 2>/dev/null || echo "999")

    # 判定
    if (( $(echo "$cn_time < 5" | bc -l 2>/dev/null || echo 0) )); then cn_ok=true; fi
    if (( $(echo "$intl_time < 5" | bc -l 2>/dev/null || echo 0) )); then intl_ok=true; fi

    if $intl_ok && (( $(echo "$intl_time < $cn_time" | bc -l 2>/dev/null || echo 0) )); then
        NETWORK_MODE="international"
        success "国际网络，使用官方源"
    elif $cn_ok; then
        NETWORK_MODE="cn"
        success "国内网络，使用 CN 镜像加速"
    elif $intl_ok; then
        NETWORK_MODE="international"
        success "国际网络（国内镜像不可用）"
    else
        NETWORK_MODE="offline"
        warn "网络不可用，将尝试已缓存的安装包"
    fi
}

download_package() {
    local filename="ClawdbotCN-macOS-v${VERSION}-universal.tar.gz"
    local download_dir
    download_dir=$(mktemp -d)
    local download_path="$download_dir/$filename"
    local downloaded=false

    for mirror in "${CDN_MIRRORS[@]}"; do
        local url="${mirror}/${filename}"
        echo "  尝试下载: ${mirror%%/macos*}..."

        if curl -fL --connect-timeout 10 --max-time 300 \
            -# -o "$download_path" "$url" 2>&1; then
            # 验证文件大小（至少 50MB）
            local size
            size=$(stat -f%z "$download_path" 2>/dev/null || echo 0)
            if [ "$size" -gt 52428800 ]; then
                downloaded=true
                success "下载完成 ($(echo "scale=1; $size/1048576" | bc)MB)"
                break
            else
                warn "文件不完整，尝试下一个镜像..."
                rm -f "$download_path"
            fi
        else
            warn "下载失败，尝试下一个镜像..."
        fi
    done

    if ! $downloaded; then
        error "所有镜像下载失败。请检查网络连接后重试。"
    fi

    DOWNLOAD_PATH="$download_path"
    DOWNLOAD_DIR="$download_dir"
}

install_app() {
    # 停止已有实例
    if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        warn "检测到已运行的实例，正在停止..."
        pkill -f "ClawdbotCN.*gateway" 2>/dev/null || true
        sleep 2
    fi

    # 备份旧版本
    if [ -d "$INSTALL_DIR" ]; then
        warn "检测到旧版本，正在备份..."
        mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)" 2>/dev/null || true
    fi

    # 解压到临时目录
    local temp_extract
    temp_extract=$(mktemp -d)
    tar -xzf "$DOWNLOAD_PATH" -C "$temp_extract"

    # 找到 .app 目录
    local app_dir
    app_dir=$(find "$temp_extract" -name "ClawdbotCN.app" -maxdepth 2 -type d | head -1)
    if [ -z "$app_dir" ]; then
        error "安装包结构异常：找不到 ClawdbotCN.app"
    fi

    # 移动到 Applications
    mv "$app_dir" "$INSTALL_DIR"

    # 设置权限（关键：通过 curl 安装不需要 xattr，但权限仍需设置）
    chmod +x "$INSTALL_DIR/Contents/MacOS/ClawdbotCN"
    chmod +x "$INSTALL_DIR/Contents/Resources/node/bin/node" 2>/dev/null || true
    find "$INSTALL_DIR/Contents/Resources/tools" -type f -exec chmod +x {} \; 2>/dev/null || true

    # Apple Silicon: ad-hoc 签名
    if [ "$(uname -m)" = "arm64" ]; then
        codesign --sign - --force "$INSTALL_DIR/Contents/Resources/node/bin/node" 2>/dev/null || true
        for tool in "$INSTALL_DIR/Contents/Resources/tools"/*; do
            [ -f "$tool" ] && codesign --sign - --force "$tool" 2>/dev/null || true
        done
    fi

    # 创建数据目录
    mkdir -p "$STATE_DIR/config"
    mkdir -p "$STATE_DIR/data"
    mkdir -p "$STATE_DIR/tools"
    mkdir -p "$LOG_DIR"

    # 清理
    rm -rf "$DOWNLOAD_DIR"

    success "安装到 $INSTALL_DIR"
}

start_gateway() {
    local node_bin="$INSTALL_DIR/Contents/Resources/node/bin/node"
    local gateway_dir="$INSTALL_DIR/Contents/Resources/gateway"

    export PATH="$(dirname "$node_bin"):$INSTALL_DIR/Contents/Resources/tools:$PATH"
    export CLAWDBOT_BUNDLED_SKILLS_DIR="$gateway_dir/skills"
    export CLAWDBOT_BUNDLED_TOOLS_DIR="$INSTALL_DIR/Contents/Resources/tools"
    export CLAWDBOT_BUNDLED_PLUGINS_DIR="$gateway_dir/extensions"
    export CLAWDBOT_STATE_DIR="$STATE_DIR"
    export NODE_ENV=production

    # 后台启动
    cd "$gateway_dir"
    nohup "$node_bin" dist/entry.js gateway run --port "$PORT" \
        >> "$LOG_DIR/gateway.log" 2>> "$LOG_DIR/gateway-error.log" &

    # 等待启动（最多 15 秒）
    local waited=0
    while [ $waited -lt 15 ]; do
        if curl -s "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
            success "Gateway 已在端口 $PORT 启动"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    warn "Gateway 启动较慢，请等待片刻后访问 http://localhost:$PORT"
}

open_browser() {
    sleep 1
    open "http://localhost:$PORT/setup"
    success "浏览器已打开配置页面"
}

# ── 启动 ──
main "$@"
```

---

## 七、构建脚本设计

### 7.1 一键构建 (`build/scripts/build-macos-cn.sh`)

```bash
#!/bin/bash
# ClawdbotCN macOS 一键构建脚本（无 Swift，无 Xcode 依赖）
# 用法:
#   ./build/scripts/build-macos-cn.sh                  # 自动检测
#   ./build/scripts/build-macos-cn.sh --cn             # 强制使用国内镜像
#   ./build/scripts/build-macos-cn.sh --skip-build     # 跳过编译（使用已有 dist/）
#   ./build/scripts/build-macos-cn.sh --arch arm64     # 仅 arm64

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build/output"
STAGING_DIR="$BUILD_DIR/staging"
VERSION="${VERSION:-$(node -p "require('$PROJECT_ROOT/package.json').version" 2>/dev/null || echo "2026.2.0")}"
ARCH="${ARCH:-universal}"
NODE_VERSION="22.13.0"
SKIP_BUILD="${SKIP_BUILD:-false}"
USE_CN="${USE_CN:-auto}"

echo "╔═══════════════════════════════════════════╗"
echo "║  ClawdbotCN macOS 构建 v${VERSION}          ║"
echo "║  架构: ${ARCH} | Node: ${NODE_VERSION}            ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# ── Step 1: 网络检测 & 镜像配置 ──
echo "[1/7] 网络检测..."
if [ "$USE_CN" = "auto" ]; then
    cn_ms=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 3 \
        https://registry.npmmirror.com 2>/dev/null || echo "999")
    intl_ms=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 3 \
        https://registry.npmjs.org 2>/dev/null || echo "999")
    if (( $(echo "$cn_ms < $intl_ms" | bc -l) )); then
        USE_CN="true"
    else
        USE_CN="false"
    fi
fi

if [ "$USE_CN" = "true" ]; then
    echo "  使用国内镜像"
    export NPM_CONFIG_REGISTRY="https://registry.npmmirror.com"
    NODE_MIRROR="https://npmmirror.com/mirrors/node"
else
    echo "  使用国际源"
    NODE_MIRROR="https://nodejs.org/dist"
fi

# ── Step 2: 编译 ──
echo "[2/7] 编译项目..."
if [ "$SKIP_BUILD" = "false" ]; then
    cd "$PROJECT_ROOT"
    pnpm install
    pnpm build
    pnpm ui:build 2>/dev/null || echo "  (UI build skipped)"
fi

# ── Step 3: 生产依赖 ──
echo "[3/7] 安装生产依赖..."
DEPS_DIR=$(mktemp -d)
cp "$PROJECT_ROOT/package.json" "$DEPS_DIR/"
cp "$PROJECT_ROOT/pnpm-lock.yaml" "$DEPS_DIR/" 2>/dev/null || true
cd "$DEPS_DIR"
npm install --omit=dev --ignore-scripts 2>/dev/null || \
    pnpm install --prod --ignore-scripts 2>/dev/null

# ── Step 4: 下载 Node.js ──
echo "[4/7] 下载 Node.js $NODE_VERSION..."
NODE_DIR=$(mktemp -d)

download_node() {
    local arch=$1
    local url="${NODE_MIRROR}/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${arch}.tar.gz"
    echo "  下载 ${arch}..."
    curl -fL -# -o "$NODE_DIR/node-${arch}.tar.gz" "$url"
    mkdir -p "$NODE_DIR/${arch}"
    tar -xzf "$NODE_DIR/node-${arch}.tar.gz" -C "$NODE_DIR/${arch}" --strip-components=1
}

case "$ARCH" in
    universal)
        download_node "arm64"
        download_node "x64"
        # 合并 Universal Binary
        mkdir -p "$NODE_DIR/universal/bin"
        lipo -create \
            "$NODE_DIR/arm64/bin/node" \
            "$NODE_DIR/x64/bin/node" \
            -output "$NODE_DIR/universal/bin/node"
        NODE_BIN_DIR="$NODE_DIR/universal/bin"
        ;;
    arm64|x64)
        download_node "$ARCH"
        NODE_BIN_DIR="$NODE_DIR/$ARCH/bin"
        ;;
esac

# ── Step 5: 组装 .app ──
echo "[5/7] 组装 ClawdbotCN.app..."
rm -rf "$STAGING_DIR"
APP_DIR="$STAGING_DIR/ClawdbotCN.app/Contents"
mkdir -p "$APP_DIR/MacOS"
mkdir -p "$APP_DIR/Resources/node/bin"
mkdir -p "$APP_DIR/Resources/gateway"
mkdir -p "$APP_DIR/Resources/tools"

# Info.plist
cat > "$APP_DIR/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>ClawdbotCN</string>
    <key>CFBundleDisplayName</key><string>ClawdbotCN</string>
    <key>CFBundleIdentifier</key><string>cn.clawdbot.mac</string>
    <key>CFBundleVersion</key><string>${VERSION}</string>
    <key>CFBundleShortVersionString</key><string>${VERSION}</string>
    <key>CFBundleExecutable</key><string>ClawdbotCN</string>
    <key>CFBundleIconFile</key><string>AppIcon</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>LSMinimumSystemVersion</key><string>12.0</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

echo "APPL????" > "$APP_DIR/PkgInfo"

# 启动脚本（核心）
# [从上面第三章 3.2 节的脚本复制到这里]
# 由于内容较长，实际构建时从 build/macos/launcher.sh 模板复制
cp "$SCRIPT_DIR/../macos/launcher.sh" "$APP_DIR/MacOS/ClawdbotCN"
chmod +x "$APP_DIR/MacOS/ClawdbotCN"

# 复制 Node.js
cp "$NODE_BIN_DIR/node" "$APP_DIR/Resources/node/bin/"

# 复制 Gateway 代码
cp -R "$PROJECT_ROOT/dist" "$APP_DIR/Resources/gateway/"
cp "$PROJECT_ROOT/package.json" "$APP_DIR/Resources/gateway/"
cp -R "$DEPS_DIR/node_modules" "$APP_DIR/Resources/gateway/"
[ -d "$PROJECT_ROOT/ui/dist" ] && cp -R "$PROJECT_ROOT/ui" "$APP_DIR/Resources/gateway/"
[ -d "$PROJECT_ROOT/assets" ] && cp -R "$PROJECT_ROOT/assets" "$APP_DIR/Resources/gateway/"
[ -d "$PROJECT_ROOT/data" ] && cp -R "$PROJECT_ROOT/data" "$APP_DIR/Resources/gateway/"

# 复制 Skills
cp -R "$PROJECT_ROOT/skills" "$APP_DIR/Resources/gateway/"

# 复制 Extensions
for ext in feishu dingtalk wecom qqbot telegram discord slack whatsapp memory-core; do
    if [ -d "$PROJECT_ROOT/extensions/$ext" ]; then
        mkdir -p "$APP_DIR/Resources/gateway/extensions"
        cp -R "$PROJECT_ROOT/extensions/$ext" "$APP_DIR/Resources/gateway/extensions/"
    fi
done

# 复制图标
if [ -f "$PROJECT_ROOT/assets/AppIcon.icns" ]; then
    cp "$PROJECT_ROOT/assets/AppIcon.icns" "$APP_DIR/Resources/"
fi

# 版本信息
cat > "$APP_DIR/Resources/version.json" << VJSON
{
    "version": "$VERSION",
    "variant": "cn",
    "platform": "darwin",
    "arch": "$ARCH",
    "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "nodeVersion": "$NODE_VERSION"
}
VJSON

# ── Step 6: 清理 + 签名 ──
echo "[6/7] 清理优化 & 签名..."
NM_DIR="$APP_DIR/Resources/gateway/node_modules"

# 删除非 darwin 平台文件
find "$NM_DIR" -path "*/win32*" -exec rm -rf {} + 2>/dev/null || true
find "$NM_DIR" -path "*/linux*" -exec rm -rf {} + 2>/dev/null || true
if [ "$ARCH" = "arm64" ]; then
    find "$NM_DIR" -path "*darwin-x64*" -exec rm -rf {} + 2>/dev/null || true
elif [ "$ARCH" = "x64" ]; then
    find "$NM_DIR" -path "*darwin-arm64*" -exec rm -rf {} + 2>/dev/null || true
fi

# 删除不需要的文件
find "$NM_DIR" -name "*.md" -delete 2>/dev/null || true
find "$NM_DIR" -name "*.map" -delete 2>/dev/null || true
find "$NM_DIR" -name "LICENSE*" -delete 2>/dev/null || true
find "$NM_DIR" -name "CHANGELOG*" -delete 2>/dev/null || true
find "$NM_DIR" -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
find "$NM_DIR" -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true
find "$NM_DIR" -type d -name "examples" -exec rm -rf {} + 2>/dev/null || true

# Ad-hoc 签名
codesign --sign - --force "$APP_DIR/Resources/node/bin/node" 2>/dev/null || true
find "$APP_DIR/Resources/tools" -type f -exec codesign --sign - --force {} \; 2>/dev/null || true
codesign --sign - --force "$STAGING_DIR/ClawdbotCN.app" 2>/dev/null || true

echo "  清理后大小: $(du -sh "$STAGING_DIR/ClawdbotCN.app" | cut -f1)"

# ── Step 7: 打包 ──
echo "[7/7] 创建发行包..."
mkdir -p "$BUILD_DIR"

# tar.gz（用于 curl 安装）
tar -czf "$BUILD_DIR/ClawdbotCN-macOS-v${VERSION}-${ARCH}.tar.gz" \
    -C "$STAGING_DIR" ClawdbotCN.app

# DMG
if command -v hdiutil >/dev/null 2>&1; then
    bash "$SCRIPT_DIR/create-cn-dmg.sh" \
        "$STAGING_DIR/ClawdbotCN.app" "$VERSION"
fi

# ZIP
if command -v ditto >/dev/null 2>&1; then
    ditto -c -k --sequesterRsrc \
        "$STAGING_DIR/ClawdbotCN.app" \
        "$BUILD_DIR/ClawdbotCN-macOS-v${VERSION}-${ARCH}.zip"
fi

# 校验和
cd "$BUILD_DIR"
shasum -a 256 ClawdbotCN-macOS-v${VERSION}-${ARCH}.* > "SHA256SUMS-${VERSION}.txt" 2>/dev/null

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  构建完成！                                ║"
echo "╠═══════════════════════════════════════════╣"
ls -lh "$BUILD_DIR"/ClawdbotCN-macOS-v${VERSION}* 2>/dev/null | \
    awk '{printf "║  %-40s %s ║\n", $NF, $5}'
echo "╚═══════════════════════════════════════════╝"
```

---

## 八、日常使用体验

### 8.1 启动（双击 .app 后的体验）

```
用户双击 ClawdbotCN.app
    ↓
浏览器自动打开 http://localhost:18789
    ↓
┌─────────────────────────────────────────┐
│  ClawdbotCN 控制面板                     │
│  ─────────────────                      │
│                                         │
│  状态: ✅ 运行中                         │
│  端口: 18789                            │
│                                         │
│  [💬 开始对话]  [⚙️ 设置]  [📦 技能]     │
│                                         │
│  已连接 AI: 硅基流动 DeepSeek V3        │
│  已安装技能: 53 个                       │
│  扩展: 飞书 ✓  钉钉 ✓                  │
│                                         │
└─────────────────────────────────────────┘
```

### 8.2 关闭

```
关闭方式：
  ① 关闭终端窗口 → Gateway 停止
  ② Ctrl+C → 优雅关闭
  ③ 关闭浏览器 → Gateway 仍在运行（后台）
     → 下次双击 .app → 检测到已运行 → 直接打开浏览器
```

### 8.3 后续版本升级

```
方式一（推荐）：
  Web UI 中显示"有新版本 2026.3.0"
  点击"下载更新" → 下载新 DMG → 覆盖安装

方式二：
  重新执行 curl 命令（自动覆盖旧版本）
  curl -fsSL https://oss.clawdbot.cn/install.sh | bash
```

---

## 九、与现有代码的集成

### 9.1 复用现有资产

| 现有文件 | 复用方式 |
|---------|---------|
| `build/scripts/build-macos-parallel.sh` | Phase 1-3 编译逻辑直接复用 |
| `scripts/create-dmg.sh` | DMG 创建基础，扩展中文背景 |
| `scripts/install-mac.sh` | 在线安装脚本基础，扩展 CN 检测 |
| `src/config/region-cn.ts` | 区域检测逻辑，完整复用 |
| `src/config/cn-mirrors.ts` | 镜像源配置，完整复用 |
| `src/agents/skills/mirror-download-engine.ts` | 下载引擎，完整复用 |
| `.github/workflows/build-macos.yml` | CI/CD 基础，精简后复用 |

### 9.2 需要新增的文件

| 文件 | 用途 | 估计行数 |
|------|------|---------|
| `build/macos/launcher.sh` | .app 启动脚本模板 | ~80行 |
| `build/scripts/build-macos-cn.sh` | 一键构建脚本 | ~200行 |
| `build/scripts/create-cn-dmg.sh` | CN DMG 创建 | ~60行 |
| `build/macos/dmg-background-cn.png` | DMG 中文背景图 | 设计稿 |
| `scripts/install-macos-cn.sh` | 在线安装脚本 | ~200行 |

### 9.3 需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `.github/workflows/build-macos.yml` | 添加 CN 构建 job |
| `src/entry.ts` | 添加 macOS 首次启动网络检测钩子 |

---

## 十、开发优先级

```
第一阶段（跑通核心链路）—— 3天
├── build/macos/launcher.sh          # .app 启动脚本
├── build/scripts/build-macos-cn.sh  # 构建脚本
└── 在 Mac 上手动测试一次完整流程

第二阶段（安装体验）—— 2天
├── scripts/install-macos-cn.sh      # curl 安装脚本
├── build/scripts/create-cn-dmg.sh   # DMG 打包
└── build/macos/dmg-background-cn.png # 背景图

第三阶段（自动化）—— 2天
├── .github/workflows/build-macos-cn.yml  # CI/CD
└── CDN 上传自动化

第四阶段（测试）—— 2天
├── M1/M2/M3 Mac 测试
├── Intel Mac 测试
├── 纯国内网络测试
└── 小白用户实测
```

**总计约 9 个工作日**（相比之前方案省了近一半，因为砍掉了 Swift + 签名 + 公证）

---

## 附录：关键技术点速查

### A1: 为什么 curl 安装不触发 Gatekeeper？

```
macOS Gatekeeper 通过 "com.apple.quarantine" 扩展属性标记下载的文件。
这个属性只有通过以下方式下载时才会被添加：
  ✓ Safari / Chrome / Firefox 浏览器下载
  ✓ AirDrop 接收
  ✓ 邮件附件保存

以下方式下载的文件 **不会** 添加隔离属性：
  ✗ curl / wget 命令行下载
  ✗ git clone
  ✗ scp / rsync
  ✗ 脚本内部创建的文件

所以 `curl | bash` 安装方式下载并解压的所有文件
都不带隔离属性，Gatekeeper 完全不干预。
```

### A2: Ad-hoc 签名的局限

```
Ad-hoc 签名 (codesign --sign -) 的特性：
  ✓ 满足 Apple Silicon 对代码签名的最低要求
  ✓ 免费，无需 Apple Developer 账号
  ✓ 本地即可完成
  ✗ Gatekeeper 仍然会拦截（ad-hoc ≠ 受信任）
  ✗ TCC 权限不持久化（重启后需重新授权）
  ✗ 不能做 notarization（公证）

对我们的影响：
  • Node.js 二进制必须 ad-hoc 签名才能在 M1+ 上运行 → 构建时自动处理
  • .app 被 Gatekeeper 拦截 → 用户走一次"仍然打开"
  • 没有菜单栏 TCC 权限问题 → 因为我们不用 Swift 原生 UI
```

### A3: 最终包大小估算

```
组件                  大小
──────                ────
Node.js Universal     ~80MB
dist/ (编译后JS)      ~5MB
node_modules (精简)   ~30MB
ui/dist              ~3MB
skills (53个)         ~2MB
extensions            ~5MB
tools (7个)           ~15MB
assets + data         ~1MB
──────────────────────────
总计（压缩前）         ~141MB
tar.gz（压缩后）       ~90MB
DMG（压缩后）          ~95MB
```
