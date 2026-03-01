---
name: clawdbot-macos-build
name_zh: macOS构建
description: 从源码构建 Clawdbot macOS 菜单栏应用。当您需要安装 Clawdbot.app 辅助程序（用于菜单栏状态显示、系统权限管理以及 Mac 硬件访问，例如摄像头/屏幕录制）时使用。该 skill 自动处理依赖安装、UI 构建、Swift 编译、代码签名及应用打包。
description_zh: 从源码构建 Clawdbot macOS 菜单栏应用。当您需要安装 Clawdbot.app 辅助程序（用于菜单栏状态显示、系统权限管理以及 Mac 硬件访问，例如摄像头/屏幕录制）时使用。该 skill 自动处理依赖安装、UI 构建、Swift 编译、代码签名及应用打包。
---
# Clawdbot macOS 应用构建

macOS 辅助应用提供菜单栏状态显示、原生通知，以及对 Mac 硬件（摄像头、屏幕录制、系统命令等）的访问能力。本 skill 从源码构建该应用。

## 前置条件

- macOS（10.14 及以上版本）
- Xcode 15+（含命令行工具）
- Node.js >= 22
- pnpm 包管理器
- 30+ GB 可用磁盘空间（用于存储 Swift 构建产物）
- 网络连接（需下载大型依赖）

## 快速构建

```bash
# Clone repo
cd /tmp && rm -rf clawdbot-build && git clone https://github.com/clawdbot/clawdbot.git clawdbot-build

# Install + build
cd /tmp/clawdbot-build
pnpm install
pnpm ui:build

# Accept Xcode license (one-time)
sudo xcodebuild -license accept

# Build macOS app with ad-hoc signing
ALLOW_ADHOC_SIGNING=1 bash scripts/package-mac-app.sh

# Install to /Applications
cp -r dist/Clawdbot.app /Applications/Clawdbot.app

# Launch
open /Applications/Clawdbot.app
```

## 构建步骤详解

### 1. 克隆代码仓库
从 GitHub 克隆最新版 Clawdbot 源码。其中包含位于 `apps/macos/` 的 macOS 应用源码。

### 2. 安装依赖（pnpm install）
为整个工作区安装 Node.js 依赖（耗时约 1 分钟）。部分扩展中提示“缺少二进制文件”的警告可忽略，不影响构建。

### 3. 构建 UI（pnpm ui:build）
编译控制界面（Vite → TypeScript/React）。输出路径为 `dist/control-ui/`。耗时约 30 秒。

### 4. 接受 Xcode 许可协议
每次更新 Xcode 后仅需执行一次。若在 Swift 构建阶段出现 “license not agreed” 错误，请运行：
```bash
sudo xcodebuild -license accept
```

### 5. 打包 macOS 应用（scripts/package-mac-app.sh）
运行完整的 Swift 构建流水线：
- 获取 Swift 包依赖（如 SwiftUI 库等）
- 针对您的 CPU 架构编译 macOS 应用（M1 及更新机型为 arm64，Intel 机型为 x86_64）
- 打包资源（模型目录、本地化文件等）
- 对应用进行代码签名

**签名选项：**
- **Ad-hoc 签名**（最快）：`ALLOW_ADHOC_SIGNING=1` —— 适用于本地测试；此方式生成的应用无法通过苹果公证（notarization）以供分发
- **Developer ID 签名**（生产环境）：若您拥有签名证书，请设置 `SIGN_IDENTITY="Developer ID Application: <name>"`

该步骤耗时约 10–20 分钟，具体取决于您的 Mac 性能。

### 6. 安装至 /Applications 目录
将构建完成的应用复制到系统 Applications 文件夹，使其行为与任意其他 macOS 应用一致。

### 7. 启动应用
打开应用。首次运行时，您将看到一系列系统权限提示（通知、辅助功能、屏幕录制等）——请全部允许，以确保完整功能可用。

## 故障排查

### “Invalid tools version”（工具版本无效）
Swift 构建要求版本 ≥ 6.2。请更新 Xcode：
```bash
softwareupdate -i -a
```

### “License not agreed”（未接受许可协议）
```bash
sudo xcodebuild -license accept
```

### “No signing identity found”（未找到签名身份）
本地构建请使用 ad-hoc 签名：
```bash
ALLOW_ADHOC_SIGNING=1 bash scripts/package-mac-app.sh
```

### Swift 编译卡住或异常缓慢
- 确保 Xcode 已完全更新：`xcode-select --install` 或通过 App Store 更新
- 检查磁盘空间：`df -h`（需至少 30GB 可用空间）
- 关闭其他应用程序以释放内存

### 构建后应用无法启动
请检查其是否已正确签名：
```bash
codesign -v /Applications/Clawdbot.app
```

若签名失败，请使用 `ALLOW_ADHOC_SIGNING=1` 重新构建。

## 应用功能说明

- **菜单栏状态** —— 查看 Gateway 健康状况并接收通知
- **权限管理** —— 主导各类 TCC 权限提示（通知、辅助功能、屏幕录制、麦克风等）
- **本地/远程模式：**
  - **本地模式**：Gateway 运行于您的 Mac 上；应用负责管理 launchd 服务
  - **远程模式**：应用通过 SSH/Tailscale 连接至另一台机器（VPS 或家庭服务器）上的 Gateway；即使您的 Mac 处于睡眠状态，仍可保持可访问性
- **Mac 硬件访问**：摄像头、屏幕录制、Canvas、语音唤醒词（voice wake-word）
- **深度链接（Deep linking）**：通过 agent URL scheme 触发 `clawdbot://` 请求

参阅官方文档：https://docs.clawd.bot/platforms/macos

## 构建用于分发的版本

如需面向生产环境分发，请准备：
- Apple Developer ID 证书（需付费）
- 公证（notarization）凭证
- 参见：https://docs.clawd.bot/platforms/mac/release

个人用途下，ad-hoc 签名已足够。

## 后续操作

应用成功启动后：
1. 完成权限检查清单（TCC 提示）
2. 选择 **本地** 或 **远程** 模式
3. 若选择本地模式：请确保 Gateway 正在运行（`clawdbot gateway status`）
4. 点击 Clawdbot.app 菜单栏图标进行配置

随后您即可在终端中管理 Gateway：
```bash
clawdbot gateway status
clawdbot gateway restart
```