# Clawdbot Build System

Multi-platform build system for creating distributable packages.

## Quick Start

### Windows (WSL 统一版)

```powershell
# 1. 构建项目
pnpm install
pnpm build

# 2. 打包 EXE 安装程序
.\build\scripts\windows\build-wsl-unified.ps1 -Version "2026.1.30"

# 输出: build\output\windows\ClawdbotCN-Setup-v2026.1.30.exe
```

### 构建 WSL 镜像（需要 Docker）

```powershell
# 构建 WSL 发行版镜像
.\build\scripts\windows\build-wsl-image.ps1 -Version "2026.1.30"

# 输出: build\output\wsl\clawdbot-wsl-2026.1.30.tar.gz
```

### macOS / Linux

```bash
# macOS (run on macOS)
./build/scripts/macos/build-slim.sh 1.0.0

# Linux (run on Linux)
./build/scripts/linux/build-slim.sh 1.0.0
```

## Windows 版本架构

### 统一 WSL 方案

从 2026.1.30 版本开始，Windows 版本采用统一的 WSL 打包方案：

```
安装程序 (~15MB)
    ↓
用户安装时自动下载 WSL 镜像 (~150MB)
    ↓
导入 WSL 发行版
    ↓
完整的 Linux 运行环境
```

**优势：**
- 用户无需了解 WSL、Linux 等技术细节
- 一键安装，自动配置
- 国内镜像加速下载
- 完整的系统能力（浏览器控制、文件操作、Python 等）

## Directory Structure

```
build/
├── config/                    # 配置文件
│   ├── builtin-skills.json    # 内置 Skills 列表
│   ├── mirrors.json           # 国内镜像配置
│   └── sandbox-*.json         # 沙盒配置
│
├── installer/                 # Windows 安装程序
│   ├── clawdbot-windows-unified.iss  # Inno Setup 脚本
│   ├── ChineseSimplified.isl         # 中文语言
│   ├── icons/                        # 图标资源
│   └── scripts/                      # 安装脚本
│       ├── setup-environment.ps1     # 环境配置（核心）
│       └── uninstall.ps1             # 卸载脚本
│
├── scripts/
│   ├── windows/
│   │   ├── build-wsl-unified.ps1    # 打包 EXE
│   │   ├── build-wsl-image.ps1      # 构建 WSL 镜像
│   │   └── test-install.ps1         # 测试安装
│   ├── macos/                       # macOS 构建脚本
│   └── linux/                       # Linux 构建脚本
│
└── output/                    # 构建输出
    ├── windows/               # ClawdbotCN-Setup-v*.exe
    ├── wsl/                   # clawdbot-wsl-*.tar.gz
    ├── macos/
    └── linux/
```

## Output Packages

### Windows

| Package | Format | Size | Description |
|---------|--------|------|-------------|
| **ClawdbotCN-Setup** | EXE | ~15 MB | 统一安装程序（WSL） |
| WSL Image | tar.gz | ~150 MB | WSL 发行版镜像（服务器托管） |

### macOS / Linux

| Package | Format | Size | Description |
|---------|--------|------|-------------|
| Lite | ZIP/tar.gz | ~50 MB | Portable package |
| Pro | ZIP/tar.gz | ~55 MB | Docker sandbox version |

## Build Requirements

### Windows
- Windows 10 version 2004 或更高
- PowerShell 5.1+
- [Inno Setup 6](https://jrsoftware.org/isdl.php) (自动安装)
- Docker Desktop (仅构建 WSL 镜像时需要)

### macOS / Linux
- Bash
- curl
- tar
- zip (macOS only)

## 国内镜像配置

所有下载使用国内镜像：

| 资源 | 镜像地址 |
|------|---------|
| WSL 镜像 | `https://oss.clawdbot.cn/wsl/` |
| Skills | `http://121.43.61.90/api` (ClawdSkillsProxy) |
| Node.js | `https://npmmirror.com/mirrors/node` |
| npm | `https://registry.npmmirror.com` |
| pip | `https://pypi.tuna.tsinghua.edu.cn/simple` |

## 安全模式

Windows 版本支持三种安全模式：

| 模式 | 名称 | 适用场景 |
|-----|------|---------|
| `full` | 完全保护 | 敏感数据电脑，拒绝命令执行 |
| `standard` | 智能保护 | 日常工作电脑，白名单+询问 |
| `trust` | 关闭保护 | 开发者，完全信任 |

详见 [Windows 安全模式文档](../docs/windows-security-modes.md)

## Related Documentation

- [Windows WSL 打包方案](../docs/windows-wsl-packaging.md)
- [Windows 安全模式](../docs/windows-security-modes.md)
- [下载指南](../docs/download-guide.md)
