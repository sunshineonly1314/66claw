---
name: build-packaging
name_zh: 构建打包
description: Cross-platform installer build skill for Windows, macOS, Linux Lite/Pro packaging.
description_zh: 跨平台安装包构建技能，支持 Windows、macOS、Linux 的 Lite/Pro 版本打包。
metadata: {"clawdbot":{"emoji":"📦","requires":{"bins":["pnpm"]}}}
---
# ClawbotCN 构建打包技能

> 跨平台安装包构建技能，支持 Windows、macOS、Linux 的 Lite/Pro 版本打包。

## 使用方法

### Windows 构建
```powershell
cd build/scripts
.\build-all.ps1 -Version "2026.1.29"
```

### macOS 构建
```bash
./build/scripts/macos/build-lite.sh --version 2026.1.29 --arch arm64
```

### Linux 构建
```bash
./build/scripts/linux/build-lite.sh --version 2026.1.29
```

## 构建要求
- pnpm (需要先运行 `pnpm build` 生成 dist 目录)
- Windows: PowerShell 5.1+
- macOS: macOS 15+ (Sequoia), Bash 4+
- Linux: 任意主流发行版, Bash 4+, Pro 版需要 Docker
