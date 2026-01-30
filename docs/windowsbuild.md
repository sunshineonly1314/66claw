# Clawdbot Windows 一键安装包构建方案

> 本文档描述 Clawdbot Windows 版本的打包、分发和更新策略。

---

## 目录

- [版本概述](#版本概述)
- [Clawdbot Lite（轻量版）](#clawdbot-lite轻量版)
- [Clawdbot Pro（专业版）](#clawdbot-pro专业版)
- [Clawdbot WSL（WSL2 版）](#clawdbot-wslwsl2-版)
- [分卷下载策略](#分卷下载策略)
- [增量更新机制](#增量更新机制)
- [构建脚本](#构建脚本)
- [安装流程](#安装流程)
- [目录结构](#目录结构)
- [系统要求](#系统要求)
- [常见问题](#常见问题)

---

## 版本概述

| 版本 | 目标场景 | 沙盒类型 | 安装包大小 | 适合用户 |
|------|---------|---------|-----------|---------|
| **Clawdbot Lite** | 独立设备 / 轻量使用 | Windows 轻量沙盒 | **~25 MB** (EXE) | 有闲置电脑、追求简单 |
| **Clawdbot Pro** | 主力电脑 / 高安全需求 | Docker 容器沙盒 | **~25 MB** (EXE) + Docker | 需要严格隔离保护 |
| **Clawdbot WSL** | WSL2 环境 | Linux 原生 | **~80 MB** (tar.gz) | 开发者、Linux 爱好者 |

> 📦 **Slim 架构**：安装包只包含 Node.js 运行时和核心代码，首次运行自动从国内镜像下载依赖（约2-3分钟）。

### 版本选择指南

```
┌─────────────────────────────────────────────────────────────────┐
│                      选择适合你的版本                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Q1: 你在什么设备上运行 Clawdbot？                               │
│                                                                 │
│     A) 闲置/废弃电脑 ──► Clawdbot Lite                          │
│     B) 日常主力电脑 ──► 继续回答 Q2                              │
│                                                                 │
│  Q2: 你的电脑已经安装了 Docker 吗？                              │
│                                                                 │
│     A) 已安装 ──► Clawdbot Pro 主程序包 (~150MB)                │
│     B) 未安装 ──► Clawdbot Pro 完整包 (~750MB)                  │
│                   或 主程序包 + Docker环境包                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Clawdbot Lite（轻量版）

### 产品定位

- **目标用户**：有独立设备部署的用户、追求轻量安装的用户
- **安全策略**：Windows 原生轻量沙盒（受限权限 + 目录隔离）
- **特点**：安装快、资源占用少、无需 Docker

### 轻量沙盒机制

Lite 版采用 Windows 原生安全机制实现轻量沙盒：

| 保护层 | 实现方式 | 保护范围 |
|--------|---------|---------|
| **目录隔离** | 工作目录限制在 `C:\Clawdbot\workspace` | 防止访问用户文件 |
| **权限限制** | 使用受限用户账户运行服务 | 降低系统权限 |
| **路径白名单** | 只允许访问指定目录 | 防止目录遍历 |
| **命令过滤** | 禁止危险命令 (del, format, rd 等) | 防止破坏性操作 |
| **网络限制** | 可选的防火墙规则 | 限制出站连接 |

#### 沙盒配置文件 (`config/sandbox-lite.json`)

```json
{
  "enabled": true,
  "mode": "lite",
  "workspace": {
    "root": "C:\\Clawdbot\\workspace",
    "allowedPaths": [
      "C:\\Clawdbot\\workspace",
      "C:\\Clawdbot\\temp"
    ]
  },
  "commands": {
    "blocked": [
      "del", "erase", "rd", "rmdir", "format",
      "reg", "regedit", "shutdown", "taskkill",
      "net user", "net localgroup", "takeown", "icacls"
    ],
    "shellRestricted": true
  },
  "network": {
    "restrictOutbound": false,
    "allowedHosts": []
  }
}
```

### 包含组件

| 组件 | 版本 | 压缩大小 | 解压大小 |
|------|------|---------|---------|
| Node.js Portable | v22.x LTS | 25 MB | 80 MB |
| Clawdbot 核心 | latest | 15 MB | 40 MB |
| node_modules (生产依赖) | - | 60 MB | 180 MB |
| 内置扩展 (extensions) | 全部 | 15 MB | 40 MB |
| 轻量沙盒模块 | - | 5 MB | 15 MB |
| 配置向导 + 启动器 | - | 5 MB | 10 MB |
| **总计** | - | **~125 MB** | **~365 MB** |

### 安装包规格

| 格式 | 大小 | 说明 |
|------|------|------|
| `Clawdbot-Lite-vX.X.X.zip` | ~130 MB | 便携版，解压即用 |
| `Clawdbot-Lite-Setup-vX.X.X.exe` | ~140 MB | 安装程序，带向导 |

---

## Clawdbot Pro（专业版）

### 产品定位

- **目标用户**：在主力电脑上使用、需要严格安全隔离的用户
- **安全策略**：Docker 容器沙盒（完整隔离）
- **特点**：文件系统、网络、进程完全隔离

### Docker 沙盒机制

Pro 版使用 Docker 容器实现完整沙盒隔离：

| 保护层 | 实现方式 | 保护范围 |
|--------|---------|---------|
| **文件系统隔离** | 容器独立文件系统 | 完全隔离主机文件 |
| **进程隔离** | Linux namespace | 进程互不可见 |
| **网络隔离** | Docker 网络 | 可配置网络策略 |
| **资源限制** | cgroups | CPU/内存限制 |
| **用户隔离** | 非 root 用户运行 | 最小权限原则 |

#### 沙盒配置 (`config/sandbox.json`)

```json
{
  "enabled": true,
  "mode": "all",
  "scope": "session",
  "image": "clawdbot-sandbox:bookworm-slim",
  "workspaceAccess": "rw",
  "resources": {
    "memory": "512m",
    "cpus": "2"
  },
  "network": {
    "mode": "bridge",
    "allowInternet": true
  }
}
```

### 分卷下载包

#### 包 1：主程序包 (`Clawdbot-Pro-Core`)

| 组件 | 版本 | 压缩大小 |
|------|------|---------|
| Node.js Portable | v22.x LTS | 25 MB |
| Clawdbot 核心 | latest | 15 MB |
| node_modules (生产依赖) | - | 60 MB |
| 内置扩展 (extensions) | 全部 | 15 MB |
| 沙盒配置 + 脚本 | - | 5 MB |
| Docker 检测 + 引导脚本 | - | 3 MB |
| 配置向导 + 启动器 | - | 5 MB |
| **总计** | - | **~130 MB** |

#### 包 2：Docker 环境包 (`Clawdbot-Docker-Env`)

| 组件 | 版本 | 压缩大小 |
|------|------|---------|
| Docker Desktop 安装程序 | 4.52.0 | 500 MB |
| WSL 2 更新包 | 2.1.5+ | 60 MB |
| 沙盒 Docker 镜像 (离线) | debian:bookworm-slim | 50 MB |
| 自动化安装脚本 | - | 2 MB |
| **总计** | - | **~612 MB** |

#### 包 3：完整包 (`Clawdbot-Pro-Full`)

| 内容 | 大小 |
|------|------|
| 主程序包 + Docker环境包 | **~750 MB** |

### 安装包规格

| 文件名 | 大小 | 适用场景 |
|--------|------|---------|
| `Clawdbot-Pro-Core-vX.X.X.exe` | ~140 MB | 已有 Docker 用户 |
| `Clawdbot-Docker-Env-vX.X.X.exe` | ~620 MB | Docker 环境包（可选） |
| `Clawdbot-Pro-Full-vX.X.X.exe` | ~760 MB | 完整安装，新用户推荐 |

---

## Clawdbot WSL（WSL2 版）

### 产品定位

- **目标用户**：开发者、Linux 爱好者、已有 WSL2 环境的用户
- **运行环境**：Windows Subsystem for Linux 2 (Ubuntu 推荐)
- **特点**：Linux 原生环境、自动打开 Windows 浏览器、支持 systemd

### WSL 版本优势

| 优势 | 说明 |
|------|------|
| **Linux 原生环境** | 完全兼容 Linux 工具链和 Skills |
| **Windows 浏览器集成** | 使用 wslview 自动在 Windows 浏览器打开配置页面 |
| **桌面快捷方式** | 可在 Windows 桌面创建启动快捷方式 |
| **systemd 支持** | 可配置为 systemd 服务自动启动 |
| **路径互操作** | 支持 WSL 和 Windows 路径转换 |

### 包含组件

#### 独立版（包含 Node.js）

| 组件 | 版本 | 压缩大小 | 解压大小 |
|------|------|---------|---------|
| Node.js Linux | v22.x LTS | 30 MB | 90 MB |
| Clawdbot 核心 | latest | 15 MB | 40 MB |
| node_modules (生产依赖) | - | 30 MB | 100 MB |
| WSL 专用启动脚本 | - | 1 MB | 2 MB |
| **总计** | - | **~80 MB** | **~230 MB** |

#### 便携版（需用户安装 Node.js）

| 组件 | 版本 | 压缩大小 | 解压大小 |
|------|------|---------|---------|
| Clawdbot 核心 | latest | 15 MB | 40 MB |
| WSL 专用启动脚本 | - | 1 MB | 2 MB |
| **总计** | - | **~20 MB** | **~45 MB** |

### 安装包规格

| 文件名 | 大小 | 说明 |
|--------|------|------|
| `clawdbot-wsl-x64-standalone.tar.gz` | ~80 MB | 独立版，解压即用 |
| `clawdbot-wsl-arm64-standalone.tar.gz` | ~80 MB | ARM64 独立版 |
| `clawdbot-wsl-portable.tar.gz` | ~20 MB | 便携版，需自行安装 Node.js |

### 构建脚本

WSL 版本的构建脚本位于 `scripts/wsl/` 目录：

```bash
# 构建独立版
cd scripts/wsl
./build-standalone.sh

# 构建便携版
./build-portable.sh

# 指定架构
./build-standalone.sh --arch arm64

# 指定 Node.js 版本
./build-standalone.sh --node-version 22.13.1
```

### 用户使用方式

```bash
# 解压
tar -xzf clawdbot-wsl-x64-standalone.tar.gz
cd clawdbot

# 启动并打开 Windows 浏览器配置向导
./setup.sh

# 或者只启动服务
./start.sh

# 后台运行
./start-daemon.sh
./stop.sh

# 创建 Windows 桌面快捷方式
./create-windows-shortcut.sh
```

### WSL 环境要求

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| **WSL 版本** | WSL 2 | WSL 2.1.5+ |
| **发行版** | Ubuntu 20.04 | Ubuntu 22.04/24.04 |
| **systemd** | 可选 | 启用（用于服务管理） |
| **wslu** | 可选 | 安装（用于打开 Windows 浏览器） |

---

## 分卷下载策略

### 下载流程

```
用户访问下载页面
        │
        ▼
┌───────────────────┐
│ 检测是否已安装     │
│ Docker Desktop    │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
  已安装       未安装
    │           │
    ▼           ▼
下载主程序包   提供选择：
(~140MB)      ├─ 完整包 (~760MB) [推荐]
    │         └─ 主程序包 + Docker环境包
    │              (分两次下载)
    ▼
  安装完成
```

### 在线检测工具

提供一个轻量检测工具 `Clawdbot-Detector.exe` (~5MB)：

```powershell
# 检测脚本逻辑
function Test-Environment {
    $result = @{
        WindowsVersion = (Get-WmiObject Win32_OperatingSystem).Version
        DockerInstalled = Test-Path "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        WSLInstalled = (wsl --status 2>$null) -ne $null
        VirtualizationEnabled = (Get-WmiObject Win32_ComputerSystem).HypervisorPresent
    }
    
    if ($result.DockerInstalled) {
        Write-Host "✓ Docker 已安装，推荐下载：主程序包 (~140MB)"
    } else {
        Write-Host "✗ Docker 未安装，推荐下载：完整包 (~760MB)"
    }
    
    return $result
}
```

---

## 增量更新机制

### 更新策略

| 更新类型 | 触发条件 | 下载内容 | 大小 |
|---------|---------|---------|------|
| **核心更新** | Clawdbot 版本变化 | dist/ + 配置 | ~20 MB |
| **依赖更新** | node_modules 变化 | 差异包 | ~10-50 MB |
| **扩展更新** | extensions 变化 | 单个扩展 | ~1-5 MB |
| **全量更新** | 主版本升级 | 主程序包 | ~140 MB |
| **Docker 更新** | Docker 版本变化 | 用户自行更新 | - |

### 更新文件结构

```
updates/
├── manifest.json              # 版本清单
├── v1.0.1/
│   ├── core-patch.zip        # 核心补丁 (~20MB)
│   └── checksum.sha256
├── v1.1.0/
│   ├── full-update.zip       # 全量更新 (~140MB)
│   └── checksum.sha256
└── latest.json               # 最新版本信息
```

### 更新清单 (`manifest.json`)

```json
{
  "versions": [
    {
      "version": "1.0.1",
      "releaseDate": "2026-02-01",
      "type": "patch",
      "fromVersion": "1.0.0",
      "downloadUrl": "https://releases.clawdbot.com/updates/v1.0.1/core-patch.zip",
      "size": 20971520,
      "checksum": "sha256:abc123..."
    },
    {
      "version": "1.1.0",
      "releaseDate": "2026-03-01",
      "type": "minor",
      "fromVersion": "1.0.x",
      "downloadUrl": "https://releases.clawdbot.com/updates/v1.1.0/full-update.zip",
      "size": 146800640,
      "checksum": "sha256:def456..."
    }
  ],
  "latest": {
    "lite": "1.1.0",
    "pro": "1.1.0"
  }
}
```

### 自动更新流程

```
启动 Clawdbot
      │
      ▼
检查更新 (manifest.json)
      │
      ├─ 无更新 ──► 正常启动
      │
      └─ 有更新
           │
           ▼
     显示更新提示
           │
     ┌─────┴─────┐
     │           │
   立即更新    稍后提醒
     │
     ▼
下载增量包 / 全量包
     │
     ▼
验证 checksum
     │
     ▼
备份当前版本
     │
     ▼
应用更新
     │
     ▼
重启服务
```

---

## 构建脚本

### Lite 版构建脚本

```powershell
# scripts/windows/build-lite.ps1

param(
    [string]$Version = "1.0.0",
    [string]$OutputDir = "dist/lite"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Clawdbot Lite 构建脚本 v$Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 准备目录
$BuildDir = "$OutputDir/Clawdbot-Lite-$Version"
if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

# 2. 下载 Node.js Portable
$NodeVersion = "22.13.0"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
$NodeZip = "$OutputDir/node.zip"

Write-Host "[1/6] 下载 Node.js v$NodeVersion..." -ForegroundColor Yellow
if (-not (Test-Path $NodeZip)) {
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
}
Expand-Archive -Path $NodeZip -DestinationPath "$BuildDir/node-temp" -Force
Move-Item "$BuildDir/node-temp/node-v$NodeVersion-win-x64" "$BuildDir/node"
Remove-Item "$BuildDir/node-temp" -Recurse -Force

# 3. 构建 Clawdbot
Write-Host "[2/6] 构建 Clawdbot 核心..." -ForegroundColor Yellow
pnpm install --omit=dev
pnpm build

# 4. 复制文件
Write-Host "[3/6] 复制应用文件..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$BuildDir/app" -Force | Out-Null
Copy-Item -Recurse "dist/*" "$BuildDir/app/dist/"
Copy-Item -Recurse "node_modules" "$BuildDir/app/"
Copy-Item "package.json" "$BuildDir/app/"

# 5. 复制扩展
Write-Host "[4/6] 复制扩展..." -ForegroundColor Yellow
Copy-Item -Recurse "extensions" "$BuildDir/"

# 6. 复制轻量沙盒模块
Write-Host "[5/6] 配置轻量沙盒..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$BuildDir/config" -Force | Out-Null
Copy-Item "scripts/windows/sandbox-lite.json" "$BuildDir/config/"
Copy-Item "scripts/windows/sandbox-lite.ps1" "$BuildDir/"

# 7. 创建启动器和配置向导
Write-Host "[6/6] 创建启动器..." -ForegroundColor Yellow
Copy-Item "scripts/windows/launcher.exe" "$BuildDir/clawdbot.exe"
Copy-Item "scripts/windows/setup-wizard.exe" "$BuildDir/"
Copy-Item "scripts/windows/uninstall.ps1" "$BuildDir/"

# 8. 创建版本信息
@{
    version = $Version
    variant = "lite"
    buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    nodeVersion = $NodeVersion
} | ConvertTo-Json | Out-File "$BuildDir/version.json" -Encoding UTF8

# 9. 打包
Write-Host "打包中..." -ForegroundColor Yellow
$ZipPath = "$OutputDir/Clawdbot-Lite-$Version.zip"
Compress-Archive -Path "$BuildDir/*" -DestinationPath $ZipPath -Force

# 10. 计算校验和
$Hash = (Get-FileHash $ZipPath -Algorithm SHA256).Hash
$Hash | Out-File "$ZipPath.sha256"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  构建完成！" -ForegroundColor Green
Write-Host "  输出: $ZipPath" -ForegroundColor Green
Write-Host "  大小: $([math]::Round((Get-Item $ZipPath).Length / 1MB, 2)) MB" -ForegroundColor Green
Write-Host "  SHA256: $Hash" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
```

### Pro 版构建脚本 - 主程序包

```powershell
# scripts/windows/build-pro-core.ps1

param(
    [string]$Version = "1.0.0",
    [string]$OutputDir = "dist/pro"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Clawdbot Pro Core 构建脚本 v$Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 准备目录
$BuildDir = "$OutputDir/Clawdbot-Pro-Core-$Version"
if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

# 2. 下载 Node.js Portable
$NodeVersion = "22.13.0"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
$NodeZip = "$OutputDir/node.zip"

Write-Host "[1/7] 下载 Node.js v$NodeVersion..." -ForegroundColor Yellow
if (-not (Test-Path $NodeZip)) {
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
}
Expand-Archive -Path $NodeZip -DestinationPath "$BuildDir/node-temp" -Force
Move-Item "$BuildDir/node-temp/node-v$NodeVersion-win-x64" "$BuildDir/node"
Remove-Item "$BuildDir/node-temp" -Recurse -Force

# 3. 构建 Clawdbot
Write-Host "[2/7] 构建 Clawdbot 核心..." -ForegroundColor Yellow
pnpm install --omit=dev
pnpm build

# 4. 复制文件
Write-Host "[3/7] 复制应用文件..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$BuildDir/app" -Force | Out-Null
Copy-Item -Recurse "dist/*" "$BuildDir/app/dist/"
Copy-Item -Recurse "node_modules" "$BuildDir/app/"
Copy-Item "package.json" "$BuildDir/app/"

# 5. 复制扩展
Write-Host "[4/7] 复制扩展..." -ForegroundColor Yellow
Copy-Item -Recurse "extensions" "$BuildDir/"

# 6. Docker 沙盒配置
Write-Host "[5/7] 配置 Docker 沙盒..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$BuildDir/config" -Force | Out-Null
Copy-Item "scripts/windows/sandbox.json" "$BuildDir/config/"
Copy-Item "Dockerfile.sandbox" "$BuildDir/"

# 7. Docker 检测和引导脚本
Write-Host "[6/7] 添加 Docker 检测脚本..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$BuildDir/docker" -Force | Out-Null
Copy-Item "scripts/windows/check-docker.ps1" "$BuildDir/docker/"
Copy-Item "scripts/windows/install-docker.ps1" "$BuildDir/docker/"
Copy-Item "scripts/windows/setup-sandbox.ps1" "$BuildDir/docker/"

# 8. 创建启动器
Write-Host "[7/7] 创建启动器..." -ForegroundColor Yellow
Copy-Item "scripts/windows/launcher-pro.exe" "$BuildDir/clawdbot.exe"
Copy-Item "scripts/windows/setup-wizard-pro.exe" "$BuildDir/"
Copy-Item "scripts/windows/uninstall.ps1" "$BuildDir/"

# 9. 创建版本信息
@{
    version = $Version
    variant = "pro-core"
    buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    nodeVersion = $NodeVersion
    requiresDocker = $true
    dockerEnvPackage = "Clawdbot-Docker-Env-$Version.exe"
} | ConvertTo-Json | Out-File "$BuildDir/version.json" -Encoding UTF8

# 10. 打包
Write-Host "打包中..." -ForegroundColor Yellow
$ZipPath = "$OutputDir/Clawdbot-Pro-Core-$Version.zip"
Compress-Archive -Path "$BuildDir/*" -DestinationPath $ZipPath -Force

# 11. 计算校验和
$Hash = (Get-FileHash $ZipPath -Algorithm SHA256).Hash
$Hash | Out-File "$ZipPath.sha256"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  构建完成！" -ForegroundColor Green
Write-Host "  输出: $ZipPath" -ForegroundColor Green
Write-Host "  大小: $([math]::Round((Get-Item $ZipPath).Length / 1MB, 2)) MB" -ForegroundColor Green
Write-Host "  SHA256: $Hash" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
```

### Pro 版构建脚本 - Docker 环境包

```powershell
# scripts/windows/build-docker-env.ps1

param(
    [string]$Version = "1.0.0",
    [string]$DockerVersion = "4.52.0",
    [string]$OutputDir = "dist/pro"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Docker 环境包构建脚本 v$Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 准备目录
$BuildDir = "$OutputDir/Clawdbot-Docker-Env-$Version"
if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

# 2. 下载 Docker Desktop
Write-Host "[1/4] 下载 Docker Desktop v$DockerVersion..." -ForegroundColor Yellow
$DockerUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
$DockerInstaller = "$BuildDir/Docker-Desktop-Installer.exe"
if (-not (Test-Path $DockerInstaller)) {
    Invoke-WebRequest -Uri $DockerUrl -OutFile $DockerInstaller
}

# 3. 下载 WSL 2 更新包
Write-Host "[2/4] 下载 WSL 2 更新包..." -ForegroundColor Yellow
$WslUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
$WslInstaller = "$BuildDir/wsl_update_x64.msi"
if (-not (Test-Path $WslInstaller)) {
    Invoke-WebRequest -Uri $WslUrl -OutFile $WslInstaller
}

# 4. 构建并导出沙盒镜像
Write-Host "[3/4] 构建沙盒 Docker 镜像..." -ForegroundColor Yellow
docker build -t clawdbot-sandbox:bookworm-slim -f Dockerfile.sandbox .
New-Item -ItemType Directory -Path "$BuildDir/images" -Force | Out-Null
docker save clawdbot-sandbox:bookworm-slim | gzip > "$BuildDir/images/clawdbot-sandbox.tar.gz"

# 5. 添加安装脚本
Write-Host "[4/4] 添加安装脚本..." -ForegroundColor Yellow
Copy-Item "scripts/windows/install-docker-env.ps1" "$BuildDir/"
Copy-Item "scripts/windows/import-sandbox-image.ps1" "$BuildDir/"

# 6. 创建版本信息
@{
    version = $Version
    variant = "docker-env"
    buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    dockerVersion = $DockerVersion
    wslVersion = "2.1.5+"
    sandboxImage = "clawdbot-sandbox:bookworm-slim"
} | ConvertTo-Json | Out-File "$BuildDir/version.json" -Encoding UTF8

# 7. 打包
Write-Host "打包中..." -ForegroundColor Yellow
$ZipPath = "$OutputDir/Clawdbot-Docker-Env-$Version.zip"
Compress-Archive -Path "$BuildDir/*" -DestinationPath $ZipPath -Force

# 8. 计算校验和
$Hash = (Get-FileHash $ZipPath -Algorithm SHA256).Hash
$Hash | Out-File "$ZipPath.sha256"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  构建完成！" -ForegroundColor Green
Write-Host "  输出: $ZipPath" -ForegroundColor Green
Write-Host "  大小: $([math]::Round((Get-Item $ZipPath).Length / 1MB, 2)) MB" -ForegroundColor Green
Write-Host "  SHA256: $Hash" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
```

---

## 安装流程

### Lite 版安装流程

```
运行 Clawdbot-Lite-Setup.exe
              │
              ▼
      ┌───────────────┐
      │  欢迎界面     │
      │  接受协议     │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  选择安装目录  │
      │  默认:        │
      │  C:\Clawdbot  │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  解压文件     │
      │  ~30秒        │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  配置向导     │
      │  - API Key    │
      │  - 消息渠道   │
      │  - 代理设置   │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  创建快捷方式  │
      │  配置开机启动  │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  启动服务     │
      │  完成安装     │
      └───────────────┘
```

### Pro 版安装流程（完整包）

```
运行 Clawdbot-Pro-Full-Setup.exe (需管理员权限)
              │
              ▼
      ┌───────────────┐
      │  系统检测     │
      │  - Win版本    │
      │  - 虚拟化     │
      │  - 磁盘空间   │
      └───────┬───────┘
              │
         检测通过?
         /      \
        是       否
        │        │
        ▼        ▼
      继续    显示错误
        │     退出安装
        ▼
      ┌───────────────┐
      │  检测 Docker  │
      └───────┬───────┘
              │
        已安装?
         /    \
        是     否
        │      │
        │      ▼
        │  ┌───────────────┐
        │  │ 安装 WSL 2    │
        │  └───────┬───────┘
        │          │
        │          ▼
        │  ┌───────────────┐
        │  │ 安装 Docker   │
        │  │ Desktop       │
        │  └───────┬───────┘
        │          │
        │     需要重启?
        │      /    \
        │     是     否
        │     │      │
        │     ▼      │
        │  重启电脑   │
        │  自动继续   │
        │     │      │
        └─────┴──────┘
              │
              ▼
      ┌───────────────┐
      │  导入沙盒镜像  │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  安装主程序   │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  配置向导     │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  完成安装     │
      └───────────────┘
```

---

## 目录结构

### Lite 版目录结构

```
C:\Clawdbot\
├── node\                         # Node.js Portable
│   ├── node.exe
│   └── npm.cmd
├── app\                          # Clawdbot 核心
│   ├── dist\                     # 编译后的代码
│   ├── node_modules\             # 依赖
│   └── package.json
├── extensions\                   # 扩展插件
│   ├── msteams\
│   ├── matrix\
│   └── ...
├── config\                       # 配置文件
│   ├── settings.json             # 主配置
│   ├── sandbox-lite.json         # 轻量沙盒配置
│   └── credentials\              # 凭证 (加密)
├── workspace\                    # 沙盒工作目录
│   └── (用户文件)
├── logs\                         # 日志
├── temp\                         # 临时文件
├── clawdbot.exe                  # 启动器
├── setup-wizard.exe              # 配置向导
├── sandbox-lite.ps1              # 沙盒脚本
├── uninstall.ps1                 # 卸载脚本
└── version.json                  # 版本信息
```

### Pro 版目录结构

```
C:\Clawdbot\
├── node\                         # Node.js Portable
│   ├── node.exe
│   └── npm.cmd
├── app\                          # Clawdbot 核心
│   ├── dist\
│   ├── node_modules\
│   └── package.json
├── extensions\                   # 扩展插件
├── config\                       # 配置文件
│   ├── settings.json
│   ├── sandbox.json              # Docker 沙盒配置
│   └── credentials\
├── docker\                       # Docker 相关
│   ├── images\                   # 离线镜像
│   │   └── clawdbot-sandbox.tar.gz
│   ├── check-docker.ps1
│   ├── install-docker.ps1
│   └── setup-sandbox.ps1
├── workspace\                    # 工作目录 (挂载到容器)
├── logs\
├── clawdbot.exe                  # 启动器
├── setup-wizard-pro.exe          # 配置向导
├── Dockerfile.sandbox            # 沙盒 Dockerfile
├── uninstall.ps1
└── version.json
```

---

## 系统要求

### Lite 版

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| **操作系统** | Windows 10 (任意版本) | Windows 10/11 |
| **处理器** | 1 GHz 双核 | 2 GHz 四核+ |
| **内存** | 2 GB | 4 GB+ |
| **磁盘空间** | 500 MB | 1 GB+ |
| **网络** | 需要互联网 | 稳定宽带 |

### Pro 版

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| **操作系统** | Windows 10 22H2 (Build 19045) | Windows 11 23H2+ |
| **处理器** | 64位，支持 SLAT | 64位四核+ |
| **内存** | 4 GB | 8 GB+ |
| **磁盘空间** | 5 GB | 10 GB+ |
| **虚拟化** | 启用 (BIOS/UEFI) | 启用 |
| **WSL** | WSL 2.1.5+ | 最新版 |
| **网络** | 需要互联网 | 稳定宽带 |

---

## 版本对比总结

| 对比项 | Clawdbot Lite | Clawdbot Pro |
|--------|--------------|--------------|
| **安装包大小** | ~140 MB | 主程序 ~140MB / 完整 ~760MB |
| **安装时间** | 1-2 分钟 | 5-15 分钟 |
| **需要重启** | 否 | 可能 (首次安装 WSL 2) |
| **管理员权限** | 否 | 是 |
| **沙盒类型** | Windows 轻量沙盒 | Docker 容器沙盒 |
| **隔离级别** | ⭐⭐⭐ (中) | ⭐⭐⭐⭐⭐ (高) |
| **磁盘占用** | ~400 MB | ~4-5 GB |
| **内存占用** | ~200 MB | ~500 MB + Docker |
| **适合小白** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **增量更新** | ✅ 支持 | ✅ 支持 |
| **分卷下载** | - | ✅ 支持 |

---

## 沙盒开关控制

### 开关机制概述

**所有版本都支持开关沙盒保护**，用户可以根据需要启用或关闭沙盒。

| 版本 | 沙盒类型 | 默认状态 | 可关闭 |
|------|---------|---------|--------|
| **Lite** | Windows 轻量沙盒 | ✅ 开启 | ✅ 可关闭 |
| **Pro** | Docker 容器沙盒 | ✅ 开启 | ✅ 可关闭 |

### 沙盒模式

项目内置三种沙盒模式（安装向导中对应三个选项）：

| 模式 | 安装向导名称 | 说明 | 适用场景 |
|------|-------------|------|---------|
| `"all"` | 🛡️ 完全保护 | 所有会话都使用沙盒 | 共享电脑、有敏感数据 |
| `"non-main"` | 🔒 智能保护（推荐） | 仅非主会话使用沙盒 | 工作电脑、日常使用 |
| `"off"` | ⚡ 关闭保护 | 关闭沙盒，解锁全部能力 | 独立设备、懂行高手 |

### 配置方式

#### 方式一：配置向导（推荐小白用户）

安装完成后，在配置向导中可以选择：

```
┌─────────────────────────────────────────────────────────────┐
│                    沙盒保护设置                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  请选择沙盒保护级别：                                        │
│                                                             │
│  ○ 完全保护 (推荐)                                          │
│    所有操作都在沙盒中运行，最安全                            │
│                                                             │
│  ○ 智能保护                                                 │
│    主要对话在主机运行，其他在沙盒中                          │
│                                                             │
│  ○ 关闭保护 (不推荐)                                        │
│    ⚠️ AI 可直接访问系统，仅限专用设备                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 方式二：配置文件

编辑 `config/settings.json`：

```json5
{
  "agents": {
    "defaults": {
      "sandbox": {
        // 沙盒模式：off / non-main / all
        "mode": "all",
        
        // 作用范围：session / agent / shared
        "scope": "session",
        
        // 工作区访问：none / ro / rw
        "workspaceAccess": "rw"
      }
    }
  }
}
```

#### 方式三：命令行

```powershell
# 查看当前沙盒配置
clawdbot config get agents.defaults.sandbox.mode

# 关闭沙盒
clawdbot config set agents.defaults.sandbox.mode off

# 开启完全沙盒
clawdbot config set agents.defaults.sandbox.mode all

# 智能沙盒（仅非主会话）
clawdbot config set agents.defaults.sandbox.mode non-main
```

### Lite 版轻量沙盒配置

Lite 版使用 `config/sandbox-lite.json`：

```json5
{
  // 总开关
  "enabled": true,  // false = 完全关闭轻量沙盒
  
  "mode": "lite",
  
  // 工作目录限制
  "workspace": {
    "root": "C:\\Clawdbot\\workspace",
    "allowedPaths": [
      "C:\\Clawdbot\\workspace",
      "C:\\Clawdbot\\temp"
    ],
    // 是否强制限制在工作目录
    "enforceRoot": true  // false = 可访问任意目录
  },
  
  // 命令过滤
  "commands": {
    // 禁止的危险命令
    "blocked": [
      "del", "erase", "rd", "rmdir", "format",
      "reg", "regedit", "shutdown", "taskkill"
    ],
    // 是否限制 shell
    "shellRestricted": true  // false = 允许任意命令
  }
}
```

**快速开关**：

```powershell
# 关闭 Lite 轻量沙盒
clawdbot config set sandbox-lite.enabled false

# 开启 Lite 轻量沙盒
clawdbot config set sandbox-lite.enabled true
```

### Pro 版 Docker 沙盒配置

Pro 版使用 `config/sandbox.json`：

```json5
{
  // Docker 沙盒模式
  "mode": "all",  // off = 关闭 Docker 沙盒
  
  "scope": "session",
  "workspaceAccess": "rw",
  
  // Docker 相关配置
  "docker": {
    "image": "clawdbot-sandbox:bookworm-slim",
    "network": "none",  // none / bridge / host
    "readOnlyRoot": true
  }
}
```

**快速开关**：

```powershell
# 关闭 Docker 沙盒
clawdbot config set agents.defaults.sandbox.mode off

# 开启 Docker 沙盒（所有会话）
clawdbot config set agents.defaults.sandbox.mode all
```

### 关闭沙盒的风险提示

当用户尝试关闭沙盒时，显示警告：

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  警告：关闭沙盒保护                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  关闭沙盒后，AI Agent 将可以：                               │
│                                                             │
│  • 访问和修改系统上的任何文件                                │
│  • 执行任意系统命令                                         │
│  • 访问网络和其他系统资源                                    │
│                                                             │
│  建议仅在以下情况关闭沙盒：                                  │
│  1. 这是一台专用/废弃设备                                   │
│  2. 你完全理解风险并愿意承担                                │
│  3. 有其他安全措施（如网络隔离）                            │
│                                                             │
│  [取消]                              [我理解风险，继续关闭] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 临时关闭沙盒（会话级）

用户也可以在运行时临时调整：

```bash
# 当前会话临时关闭沙盒
/exec elevated

# 恢复沙盒
/exec sandbox
```

注意：`/exec elevated` 是显式逃逸机制，仅对授权发送者生效。

---

## 常见问题

### Q1: Lite 版的轻量沙盒安全吗？

Lite 版沙盒提供基本保护：
- 限制工作目录
- 过滤危险命令
- 受限权限运行

但不如 Docker 沙盒完善。如果你在主力电脑上使用且担心安全，建议使用 Pro 版。

### Q2: Pro 版 Docker 会影响我现有的 Docker 环境吗？

不会。Clawdbot 使用独立的沙盒镜像，不会影响你现有的 Docker 容器和镜像。

### Q3: 如果已有 Docker，只下载主程序包可以吗？

可以。主程序包会自动检测 Docker 环境，如果已安装则直接使用。

### Q4: 更新时需要重新下载 Docker 吗？

不需要。增量更新只更新 Clawdbot 核心（~20-80MB），Docker 环境保持不变。

### Q5: 中国用户下载慢怎么办？

我们提供：
1. 国内镜像下载源（阿里云/腾讯云）
2. 分卷下载（先下主程序，Docker 包可后台下载）
3. 离线包（完整版 ~760MB）

### Q6: 可以关闭沙盒保护吗？

**可以**。两个版本都支持关闭沙盒：

| 版本 | 关闭方式 |
|------|---------|
| **Lite** | 设置 `sandbox-lite.enabled: false` |
| **Pro** | 设置 `agents.defaults.sandbox.mode: "off"` |

命令行快速关闭：
```powershell
# Lite 版
clawdbot config set sandbox-lite.enabled false

# Pro 版
clawdbot config set agents.defaults.sandbox.mode off
```

⚠️ **警告**：关闭沙盒后，AI 可直接访问系统，仅建议在专用设备上关闭。

### Q7: Pro 版关闭 Docker 沙盒后和 Lite 版有什么区别？

关闭 Docker 沙盒后，Pro 版的行为与 Lite 版相似，但仍有区别：

| 对比项 | Lite (轻量沙盒关闭) | Pro (Docker 沙盒关闭) |
|--------|-------------------|---------------------|
| 执行环境 | 直接在 Windows 主机 | 直接在 Windows 主机 |
| Docker 依赖 | 无 | 仍需 Docker（其他功能可能用到） |
| 切换回沙盒 | 可随时开启轻量沙盒 | 可随时开启 Docker 沙盒 |
| 磁盘占用 | ~400MB | ~4-5GB |

### Q8: 可以在 Lite 版上使用 Docker 沙盒吗？

可以，但需要手动：
1. 安装 Docker Desktop
2. 修改配置启用 Docker 沙盒模式

更简单的方式是直接下载 Pro 版主程序包，它会自动检测已安装的 Docker。

---

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0.0 | 2026-01-29 | 初始版本，支持 Lite/Pro 双版本 |

---

*文档最后更新：2026-01-29*
