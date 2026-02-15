# ClawbotCN 构建打包技能

> 跨平台安装包构建技能，支持 Windows、macOS、Linux 的 Lite/Pro 版本打包。

## 技能概述

本技能用于构建 ClawbotCN 的各平台安装包，包括：

| 平台 | 版本 | 沙盒类型 | 安装包大小 |
|------|------|---------|-----------|
| Windows | Lite | 轻量沙盒 | ~150 MB |
| Windows | Pro | Docker 沙盒 | ~150 MB (+ Docker ~600MB) |
| macOS | Lite | 软沙盒 | ~100-150 MB |
| Linux | Lite | 轻量沙盒 | ~80 MB |
| Linux | Pro | Docker 沙盒 | ~80 MB (+ 镜像 ~80MB) |

## 使用方法

### Windows 构建

```powershell
# 进入构建脚本目录
cd build/scripts

# 构建所有 Windows 版本
.\build-all.ps1 -Version "2026.1.29"

# 只构建 Lite 版
.\windows\build-lite.ps1 -Version "2026.1.29"

# 只构建 Pro 版
.\windows\build-pro-core.ps1 -Version "2026.1.29"
```

### macOS 构建

```bash
# 构建 macOS Lite 版
./build/scripts/macos/build-lite.sh --version 2026.1.29 --arch arm64

# 构建通用版本 (arm64 + x64)
./build/scripts/macos/build-universal.sh --version 2026.1.29
```

### Linux 构建

```bash
# 构建 Lite 版
./build/scripts/linux/build-lite.sh --version 2026.1.29

# 构建 Pro 版
./build/scripts/linux/build-pro.sh --version 2026.1.29
```

## 目录结构

```
build/
├── scripts/                 # 构建脚本
│   ├── build-all.ps1       # Windows 主入口
│   ├── build-all.sh        # Linux/macOS 主入口
│   ├── common/             # 共享工具函数
│   ├── windows/            # Windows 构建脚本
│   ├── macos/              # macOS 构建脚本
│   └── linux/              # Linux 构建脚本
├── config/                  # 沙盒配置文件
│   ├── sandbox-lite.json   # 轻量沙盒配置
│   ├── sandbox-mac.json    # macOS 软沙盒配置
│   └── sandbox-docker.json # Docker 沙盒配置
├── docker/                  # Docker 相关文件
│   ├── Dockerfile.sandbox  # 沙盒镜像定义
│   ├── setup-sandbox.sh    # 沙盒设置脚本
│   └── check-docker.sh     # Docker 检测脚本
└── output/                  # 构建输出目录
```

## 沙盒模式说明

所有版本都支持三种沙盒模式：

| 模式 | 名称 | 说明 |
|------|------|------|
| `all` | 🛡️ 完全保护 | 所有操作都在沙盒中 |
| `non-main` | 🔒 智能保护 | 主对话正常，后台受限（推荐） |
| `off` | ⚡ 关闭保护 | 解锁全部能力，风险自担 |

## 相关文档

- [Windows 构建方案](../../docs/windowsbuild.md)
- [macOS 构建方案](../../docs/macosbuild.md)
- [Linux 构建方案](../../docs/linuxbuild.md)
- [安装向导 PRD](../../docs/guidprd.md)

## 构建要求

### Windows
- Windows 10/11
- PowerShell 5.1+
- 需要先运行 `pnpm build` 生成 dist 目录

### macOS
- macOS 15+ (Sequoia)
- Bash 4+
- 需要先运行 `pnpm build` 生成 dist 目录

### Linux
- 任意主流 Linux 发行版
- Bash 4+
- 需要先运行 `pnpm build` 生成 dist 目录
- Pro 版需要 Docker

## 输出文件

构建完成后，安装包会输出到 `build/output/` 目录：

```
build/output/
├── windows/
│   ├── lite/
│   │   └── OpenClawCN-Lite-vX.X.X.zip
│   └── pro/
│       └── OpenClawCN-Pro-Core-vX.X.X.zip
├── macos/
│   └── ClawbotCN-macOS-vX.X.X-arm64.zip
└── linux/
    ├── lite/
    │   └── openclawcn-lite-vX.X.X-linux-x64.tar.gz
    └── pro/
        └── openclawcn-pro-vX.X.X-linux-x64.tar.gz
```

## 技能作者

TecbinAI Team

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0.0 | 2026-01-29 | 初始版本 |
