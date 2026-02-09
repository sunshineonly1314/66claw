---
name: packaging
description: 打包 Clawdbot 为各平台分发包的完整指南。
nameZh: "打包工具"
descriptionZh: "打包Clawdbot为各平台分发包的完整指南"
---

# Packaging Skill

打包 Clawdbot 为各平台分发包的完整指南。

## 概述

Clawdbot 支持三个主要平台的打包：

| 平台 | 打包方式 | 输出格式 |
|------|----------|----------|
| Windows | 独立版/便携版/安装程序 | ZIP / EXE |
| macOS | 原生 App | .app / .dmg |
| Linux | 独立版/便携版 | tar.gz |

## 前置条件

所有平台打包前，确保：

```bash
# 1. 安装依赖
pnpm install

# 2. 构建项目
pnpm build

# 3. 构建 UI
pnpm ui:build
```

---

## Windows 打包

### 独立版（推荐小白用户）

包含 Node.js 运行时，用户无需额外安装。

```powershell
# 使用 npm script
pnpm win:standalone

# 或直接运行脚本
powershell -ExecutionPolicy Bypass -File scripts/windows/build-standalone.ps1
```

**输出：** `build/windows-standalone/clawdbot-windows-x64-standalone.zip`

**自定义选项：**
```powershell
# 指定输出目录
.\scripts\windows\build-standalone.ps1 -OutputDir "D:\release"

# 指定 Node.js 版本
.\scripts\windows\build-standalone.ps1 -NodeVersion "22.13.1"
```

### 便携版（需用户安装 Node.js）

体积较小，但需要用户自行安装 Node.js 22+。

```powershell
pnpm win:portable
```

**输出：** `build/windows/clawdbot-windows-x64.zip`

### 安装程序（EXE）

使用 Inno Setup 创建完整安装程序。

**前置要求：**
- 安装 [Inno Setup 6](https://jrsoftware.org/isinfo.php)

```powershell
pnpm win:installer
```

**输出：** `installer/ClawdbotSetup-{version}-x64.exe`

**功能特性：**
- 自动创建桌面快捷方式
- 可选开机自启
- 支持静默安装
- 自动检测端口冲突

---

## macOS 打包

### 构建 .app

```bash
pnpm mac:package

# 或指定架构
BUILD_ARCHS=all bash scripts/package-mac-app.sh  # 通用二进制
BUILD_ARCHS=arm64 bash scripts/package-mac-app.sh  # 仅 Apple Silicon
BUILD_ARCHS=x86_64 bash scripts/package-mac-app.sh  # 仅 Intel
```

**输出：** `dist/Clawdbot.app`

### 创建分发包

```bash
# 创建 DMG 和 ZIP
bash scripts/package-mac-dist.sh
```

**输出：**
- `dist/Clawdbot-{version}.dmg`
- `dist/Clawdbot-{version}.zip`

### 代码签名（可选）

```bash
# 签名
bash scripts/codesign-mac-app.sh

# 公证
bash scripts/notarize-mac-artifact.sh
```

**环境变量：**
- `APPLE_DEVELOPER_ID`: 开发者证书 ID
- `APP_STORE_CONNECT_ISSUER_ID`: App Store Connect 凭证
- `APP_STORE_CONNECT_KEY_ID`: API Key ID
- `APP_STORE_CONNECT_API_KEY_P8`: API Key 私钥

---

## Linux 打包

### 独立版（推荐小白用户）

包含 Node.js 运行时。

```bash
pnpm linux:standalone

# 或指定架构
./scripts/linux/build-standalone.sh --arch x64
./scripts/linux/build-standalone.sh --arch arm64

# 指定 Node.js 版本
./scripts/linux/build-standalone.sh --node-version 22.13.1
```

**输出：** `build/linux-standalone/clawdbot-linux-{arch}-standalone.tar.gz`

### 便携版

```bash
pnpm linux:portable
```

**输出：** `build/linux/clawdbot-linux-portable.tar.gz`

---

## 包大小参考

| 平台 | 版本 | 解压后 | 压缩后 |
|------|------|--------|--------|
| Windows | 独立版 | ~200MB | ~80MB |
| Windows | 便携版 | ~50MB | ~20MB |
| macOS | .app | ~100MB | ~40MB |
| Linux | 独立版 (x64) | ~200MB | ~80MB |
| Linux | 便携版 | ~50MB | ~20MB |

---

## Node.js 版本冲突处理

### Windows 独立版

`start.bat` 使用绝对路径调用便携版 Node.js：

```batch
"%~dp0node\node.exe" "%~dp0dist\entry.js" gateway run
```

无论用户系统安装了什么版本的 Node.js，都不会冲突。

### Linux 独立版

`start.sh` 优先使用便携版 Node.js：

```bash
export PATH="$SCRIPT_DIR/node/bin:$PATH"
```

---

## 最佳实践

### 选择打包方式

| 目标用户 | 推荐方式 |
|----------|----------|
| 小白用户 | 独立版 (含 Node.js) |
| 开发者 | 便携版 |
| 企业部署 | 安装程序 (Windows) / 独立版 (Linux) |

### CI/CD 集成

```yaml
# GitHub Actions 示例
jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build && pnpm ui:build
      - run: pnpm win:standalone
      - uses: actions/upload-artifact@v4
        with:
          name: windows-standalone
          path: build/windows-standalone/*.zip

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build && pnpm ui:build
      - run: pnpm linux:standalone
      - uses: actions/upload-artifact@v4
        with:
          name: linux-standalone
          path: build/linux-standalone/*.tar.gz
```

---

## 故障排除

### Windows: npm install 失败

检查 node-portable 目录是否存在且完整：

```powershell
ls scripts/windows/node-portable/node.exe
```

### Linux: 权限问题

确保脚本有执行权限：

```bash
chmod +x scripts/linux/*.sh
```

### macOS: 签名失败

检查证书是否正确安装：

```bash
security find-identity -p codesigning -v
```

---

## 相关文件

| 路径 | 说明 |
|------|------|
| `scripts/windows/build-standalone.ps1` | Windows 独立版脚本 |
| `scripts/windows/build-portable.ps1` | Windows 便携版脚本 |
| `scripts/windows/build-installer.ps1` | Windows 安装程序脚本 |
| `scripts/windows/setup.iss` | Inno Setup 配置 |
| `scripts/linux/build-standalone.sh` | Linux 独立版脚本 |
| `scripts/linux/build-portable.sh` | Linux 便携版脚本 |
| `scripts/package-mac-app.sh` | macOS App 打包脚本 |
| `scripts/package-mac-dist.sh` | macOS 分发包脚本 |
