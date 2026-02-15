# OpenClawCN WSL 打包指南

本目录包含专为 Windows Subsystem for Linux (WSL) 环境优化的打包脚本。

## 目录结构

```
scripts/wsl/
├── README.md              # 本文档
├── setup.iss              # Inno Setup 安装脚本 (Windows EXE)
├── build-installer.ps1    # Windows EXE 安装程序构建脚本
├── build-standalone.sh    # 独立版构建脚本（包含 Node.js）
├── build-portable.sh      # 便携版构建脚本（需用户安装 Node.js）
└── launchers/             # Windows 启动器脚本
    ├── setup-wsl.ps1      # WSL 环境配置
    ├── deploy-to-wsl.ps1  # 部署到 WSL
    ├── start-openclawcn.bat # 启动脚本 (命令行)
    ├── start-openclawcn.vbs # 启动脚本 (后台静默)
    ├── stop-openclawcn.bat  # 停止脚本
    └── check-wsl.ps1      # 环境检查脚本
```

## WSL 版本特点

相比 Linux 原生版本，WSL 版本具有以下优化：

1. **自动打开 Windows 浏览器** - 使用 `wslview`、`cmd.exe`、`powershell.exe` 等方式
2. **Windows 快捷方式支持** - 可在 Windows 桌面创建启动快捷方式
3. **WSL 环境检测** - 自动识别并适配 WSL 环境
4. **路径互操作** - 支持 WSL 和 Windows 路径转换

## 前置条件

### 在 WSL 中运行

1. 已安装 WSL2 (推荐 Ubuntu 22.04+)
2. 已安装 Node.js 22+
3. 已运行 `pnpm build` 生成 `dist/` 目录

### 可选：安装 wslu

```bash
# Ubuntu/Debian
sudo apt install wslu

# 其他发行版: https://wslutiliti.es/wslu/install.html
```

安装 wslu 后，`wslview` 命令可自动在 Windows 浏览器中打开链接。

## 构建步骤

### 1. 构建项目

```bash
# 在项目根目录
pnpm install
pnpm build
pnpm ui:build
```

### 2. 构建 Windows EXE 安装程序（推荐）

一键安装程序，用户双击即可自动完成 WSL 环境配置和 OpenClawCN 部署：

```powershell
# 在 Windows PowerShell 中运行
cd scripts/wsl
.\build-installer.ps1
```

**前置要求：**
1. 安装 [Inno Setup 6](https://jrsoftware.org/isinfo.php)
2. 已在 WSL 中构建独立版包（见下方步骤 3）

**输出：** `buildout/wsl/OpenClawCN-WSL-Setup-vX.X.X.exe`

**安装程序功能：**
- 自动检测并安装 WSL2
- 自动安装 Ubuntu 发行版
- 自动部署 OpenClawCN 到 WSL
- 创建 Windows 桌面快捷方式
- 安装完成后自动打开 Windows 浏览器配置页面

### 3. 构建独立版 tar.gz（给 Linux 用户）

包含 Node.js，解压即用：

```bash
cd scripts/wsl

# 当前架构
./build-standalone.sh

# 指定架构
./build-standalone.sh --arch x64
./build-standalone.sh --arch arm64

# 指定 Node.js 版本
./build-standalone.sh --node-version 22.13.1
```

输出：`build/wsl-standalone/openclawcn-wsl-{arch}-standalone.tar.gz`

### 4. 构建便携版 tar.gz

轻量版，需用户自行安装 Node.js：

```bash
cd scripts/wsl
./build-portable.sh
```

输出：`build/wsl/openclawcn-wsl-portable.tar.gz`

## 输出目录

```
buildout/
└── wsl/
    └── OpenClawCN-WSL-Setup-vX.X.X.exe    # Windows 一键安装程序

build/
├── wsl/
│   ├── openclawcn-portable/
│   └── openclawcn-wsl-portable.tar.gz
└── wsl-standalone/
    ├── openclawcn/
    └── openclawcn-wsl-x64-standalone.tar.gz
```

## 包大小参考

| 版本 | 大小 | 说明 |
|------|------|------|
| **Windows EXE 安装程序** | ~85MB | 一键安装，自动配置 WSL |
| 独立版 tar.gz (x64) | ~80MB | 解压后 ~200MB |
| 便携版 tar.gz | ~20MB | 解压后 ~50MB，需安装 Node.js |

## 用户使用方式

### 独立版用户

```bash
# 解压
tar -xzf openclawcn-wsl-x64-standalone.tar.gz
cd openclawcn

# 启动并打开配置向导（自动打开 Windows 浏览器）
./setup.sh

# 或者只启动服务
./start.sh

# 后台运行
./start-daemon.sh
./stop.sh

# 可选：创建 Windows 桌面快捷方式
./create-windows-shortcut.sh
```

### 便携版用户

```bash
# 解压
tar -xzf openclawcn-wsl-portable.tar.gz
cd openclawcn-portable

# 安装依赖（首次）
./install.sh

# 启动
./setup.sh
```

## 与其他版本的对比

| 功能 | WSL 版 (exe) | WSL 版 (tar.gz) | Linux 原生版 | Windows 原生版 |
|------|--------------|-----------------|--------------|----------------|
| 一键安装 (exe) | ✅ | ❌ | ❌ | ✅ |
| 自动配置 WSL | ✅ | ❌ | - | - |
| 自动打开 Windows 浏览器 | ✅ | ✅ | ❌ | ✅ |
| Windows 桌面快捷方式 | ✅ | ✅ | ❌ | ✅ |
| WSL 环境检测 | ✅ | ✅ | ❌ | ❌ |
| systemd 服务 | ✅ | ✅ | ✅ | ❌ |
| 安装包格式 | exe | tar.gz | tar.gz | exe |

## 故障排除

### 无法打开 Windows 浏览器

1. 安装 wslu：`sudo apt install wslu`
2. 或手动在 Windows 浏览器中访问 `http://localhost:18789`

### WSL 中无法访问 localhost

确保 WSL2 版本较新：
```bash
wsl --version
```

### Node.js 版本问题

推荐使用 nvm 管理 Node.js 版本：
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
```

### systemd 不可用

WSL2 需要手动启用 systemd：

1. 编辑 `/etc/wsl.conf`：
   ```ini
   [boot]
   systemd=true
   ```

2. 从 PowerShell 重启 WSL：
   ```powershell
   wsl --shutdown
   ```

## 相关文档

- [WSL 官方文档](https://docs.microsoft.com/en-us/windows/wsl/)
- [wslu 工具包](https://wslutiliti.es/wslu/)
- [Linux 打包指南](../linux/README.md)
- [Windows 打包指南](../windows/README.md)
