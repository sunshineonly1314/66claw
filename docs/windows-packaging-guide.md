# Windows 打包指南

本文档详细说明如何为 OpenClawCN 构建 Windows 安装包。

## 目录

1. [环境要求](#环境要求)
2. [目录结构](#目录结构)
3. [打包流程](#打包流程)
4. [关键文件说明](#关键文件说明)
5. [常见问题](#常见问题)

---

## 环境要求

### 必需软件

| 软件 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 22.12.0 | 运行时环境 |
| pnpm | >= 10.x | 包管理器 |
| Inno Setup 6 | >= 6.0 | 生成 Windows 安装程序 |
| PowerShell | >= 5.1 | 脚本执行 |

### 安装 Inno Setup

```powershell
# 方法 1: 使用 winget
winget install JRSoftware.InnoSetup

# 方法 2: 手动下载
# https://jrsoftware.org/isdl.php
```

---

## 目录结构

```
build/
├── installer/
│   ├── openclawcn-windows-unified.iss   # Inno Setup 主配置文件
│   ├── package.json                    # 精简版 package.json（无开发脚本）
│   ├── ChineseSimplified.isl          # 中文语言文件
│   └── scripts/                        # 安装包内置脚本
│       ├── StartOpenClawCN.ps1          # 启动脚本（可见窗口）
│       ├── StartOpenClawCN.bat          # 启动批处理
│       ├── StopOpenClawCN.ps1           # 停止脚本
│       ├── StopOpenClawCN.bat           # 停止批处理
│       ├── RestartOpenClawCN.ps1        # 重启脚本
│       ├── RestartOpenClawCN.bat        # 重启批处理
│       ├── StartGatewayBackground.ps1 # 后台启动脚本
│       ├── StartBackground.vbs        # VBS 静默启动器
│       ├── OpenClawCNTray.ps1           # 系统托盘应用
│       ├── StartTray.vbs              # 托盘启动器
│       ├── OpenClawCNWatchdog.ps1       # 守护进程
│       ├── ManageWatchdog.ps1         # 守护进程管理
│       ├── setup-environment.ps1      # 安装后环境配置
│       └── uninstall.ps1              # 卸载清理脚本
├── output/
│   └── windows/
│       └── OpenClawCN-Setup-v*.exe    # 生成的安装程序
└── scripts/
    └── build-all.ps1                   # 统一构建脚本
```

---

## 打包流程

### 步骤 1: 构建项目

```powershell
# 在项目根目录执行
pnpm install
pnpm build
pnpm ui:build
```

### 步骤 2: 编译安装程序

```powershell
# 方法 1: 使用命令行
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" ".\build\installer\openclawcn-windows-unified.iss"

# 方法 2: 使用构建脚本
.\build\scripts\build-all.ps1
```

### 步骤 3: 验证输出

```powershell
# 检查生成的安装程序
Get-Item ".\build\output\windows\OpenClawCN-Setup-v*.exe"
```

---

## 关键文件说明

### 1. Inno Setup 配置 (`openclawcn-windows-unified.iss`)

主要配置项：

```inno
[Setup]
AppName=OpenClawCN AI 助手
AppVersion=2026.1.30
DefaultDirName=D:\OpenClawCN
OutputDir=..\output\windows
OutputBaseFilename=OpenClawCN-Setup-v{#MyAppVersion}
```

**重要配置说明：**

| 配置项 | 说明 |
|--------|------|
| `VersionInfoVersion` | 必须是 4 段格式 (x.x.x.x) |
| `PrivilegesRequired` | 设为 `lowest` 避免管理员权限 |
| `DisableDirPage` | 设为 `no` 允许用户选择目录 |

### 2. 精简版 package.json

安装包使用精简版 `build/installer/package.json`，与开发版的区别：

| 内容 | 开发版 | 安装包版 |
|------|--------|----------|
| `postinstall` 脚本 | ✅ | ❌ 移除 |
| 开发 scripts | ✅ 70+ 个 | ❌ 移除 |
| `devDependencies` | ✅ | ❌ 移除 |
| `pnpm/vitest` 配置 | ✅ | ❌ 移除 |
| `dependencies` | ✅ | ✅ 保留 |
| `overrides` | ✅ | ✅ 保留 |

**为什么需要精简版？**
- 避免 `npm install` 执行 `postinstall.js`（开发专用脚本）
- 减少安装包体积
- 避免用户看到开发相关的脚本

### 3. 启动脚本 (`StartOpenClawCN.ps1`)

启动流程（7 步）：

```
[步骤 1/7] 设置工作目录
[步骤 2/7] 检查核心文件 (dist/entry.js, package.json)
[步骤 3/7] 检查 Node.js
[步骤 4/7] 检查端口 18789（冲突检测 + 一键解决）
[步骤 5/7] 检查/安装依赖包
[步骤 6/7] 设置环境变量和配置文件
[步骤 7/7] 启动 Gateway
```

**关键功能：**

1. **端口冲突智能处理**
   - 检测端口是否被占用
   - 判断是 OpenClawCN 进程还是其他程序
   - 提供一键解决方案（Y/N 交互）

2. **依赖包自动安装**
   - 检测 `node_modules/chalk` 是否存在
   - 自动设置国内镜像源
   - 实时显示安装进度

3. **配置文件自动创建**
   - 自动创建 `~/.openclawcn/config.json`
   - 设置 `gateway.mode=local`

4. **详细日志**
   - 日志文件：`logs/startup.log`
   - npm 日志：`logs/npm-install.log`

### 4. 卸载脚本 (`uninstall.ps1`)

卸载流程（6 步）：

```
[1/6] 停止托盘应用和守护进程
[2/6] 停止运行中的服务
[3/6] 清理开机自启动
[4/6] 清理 WSL 环境
[5/6] 清理环境变量
[6/6] 清理运行时文件 (node_modules, logs, 等)
```

**清理内容：**
- `node_modules/` - 依赖包
- `logs/` - 日志文件
- `wsl/` - WSL 镜像
- `sessions/` - 会话数据
- `.cache/` - 缓存文件
- `package-lock.json` - 锁定文件

**保留内容：**
- `~/.openclawcn/` - 用户配置（需手动删除）

### 5. 系统托盘应用 (`OpenClawCNTray.ps1`)

功能：
- 显示 Gateway 运行状态（运行中/已停止/启动中/错误）
- 右键菜单：启动/停止/重启/查看日志/打开控制台/退出
- 单实例运行（Mutex 防止多开）
- 定时状态检测（每 5 秒）

### 6. 守护进程 (`OpenClawCNWatchdog.ps1`)

功能：
- 监控 Gateway 进程状态
- 自动重启崩溃的服务
- 熔断机制（5 分钟内重启 3 次则停止）
- 异常通知（系统托盘气泡）

---

## PowerShell 脚本编码要求

**重要**: 所有 `.ps1` 文件必须使用 **UTF-8 with BOM** 编码，否则中文会乱码。

```powershell
# 保存为 UTF-8 with BOM
$content = Get-Content "script.ps1" -Raw -Encoding UTF8
[System.IO.File]::WriteAllText("script.ps1", $content, [System.Text.UTF8Encoding]::new($true))
```

---

## 安装包功能清单

### 核心功能 (P1)

| 功能 | 状态 | 说明 |
|------|------|------|
| F1: 后台静默运行 | ✅ | VBS + PowerShell 实现 |
| F2: 开机自启动 | ✅ | 注册表 + 安装选项 |
| F3: 运行状态可视化 | ✅ | 系统托盘图标 |
| F4: 基本控制操作 | ✅ | 启动/停止/重启 |
| F5: 快速访问 Web UI | ✅ | 托盘菜单一键打开 |

### 增强功能 (P2)

| 功能 | 状态 | 说明 |
|------|------|------|
| F6: 日志查看 | ✅ | 托盘菜单打开日志目录 |
| F7: 异常通知 | ✅ | 系统托盘气泡通知 |
| F8: 自动恢复 (Watchdog) | ✅ | 守护进程 + 熔断机制 |

---

## 常见问题

### Q1: 安装后启动失败，提示 "Missing config"

**原因**: 配置文件不存在或 `gateway.mode` 未设置

**解决**: 启动脚本会自动创建配置，如果仍有问题，手动创建：

```powershell
$config = @{gateway = @{mode = "local"}} | ConvertTo-Json
New-Item -Path "$env:USERPROFILE\.openclawcn" -ItemType Directory -Force
Set-Content -Path "$env:USERPROFILE\.openclawcn\config.json" -Value $config
```

### Q2: npm install 失败

**可能原因**:
1. 网络问题 - 脚本会自动设置国内镜像
2. Node.js 版本过低 - 需要 >= 22.12.0
3. 磁盘空间不足

**解决**: 查看 `logs/npm-install.log` 获取详细错误

### Q3: 端口 18789 被占用

**解决**: 启动脚本会自动检测并提供一键解决方案

### Q4: 中文显示乱码

**原因**: PowerShell 脚本编码不正确

**解决**: 确保所有 `.ps1` 文件使用 UTF-8 with BOM 编码

### Q5: 卸载后残留文件

**解决**: 卸载程序会自动清理 `node_modules`、`logs` 等目录，用户配置 `~/.openclawcn` 需手动删除

---

## 版本更新检查清单

更新版本时需要修改的文件：

1. `build/installer/openclawcn-windows-unified.iss`
   - `MyAppVersion` 定义
   - `VersionInfoVersion` (4 段格式)

2. `build/installer/package.json`
   - `version` 字段

3. `package.json` (根目录)
   - `version` 字段

---

## 参考链接

- [Inno Setup 文档](https://jrsoftware.org/ishelp/)
- [PowerShell 编码最佳实践](https://docs.microsoft.com/en-us/powershell/)
- [PRD: Windows Gateway 后台静默运行](./prd/windows-gateway-background-service.md)
