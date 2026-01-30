# 打包命令快速参考

## 完整构建流程

```bash
# 1. 安装依赖
pnpm install

# 2. 构建
pnpm build && pnpm ui:build

# 3. 打包 (选择平台)
pnpm win:standalone   # Windows 独立版
pnpm linux:standalone # Linux 独立版
pnpm mac:package      # macOS App
```

## Windows

```powershell
# 独立版 (推荐小白)
pnpm win:standalone

# 便携版 (需用户安装 Node.js)
pnpm win:portable

# 安装程序 (需要 Inno Setup)
pnpm win:installer
```

## Linux

```bash
# 独立版 x64
pnpm linux:standalone

# 独立版 arm64
./scripts/linux/build-standalone.sh --arch arm64

# 便携版
pnpm linux:portable
```

## macOS

```bash
# 当前架构
pnpm mac:package

# 通用二进制
BUILD_ARCHS=all bash scripts/package-mac-app.sh

# 创建 DMG
bash scripts/package-mac-dist.sh
```

## 输出位置

| 平台 | 命令 | 输出 |
|------|------|------|
| Windows | `win:standalone` | `build/windows-standalone/clawdbot-windows-x64-standalone.zip` |
| Windows | `win:portable` | `build/windows/clawdbot-windows-x64.zip` |
| Windows | `win:installer` | `installer/ClawdbotSetup-*.exe` |
| Linux | `linux:standalone` | `build/linux-standalone/clawdbot-linux-*-standalone.tar.gz` |
| Linux | `linux:portable` | `build/linux/clawdbot-linux-portable.tar.gz` |
| macOS | `mac:package` | `dist/Clawdbot.app` |
