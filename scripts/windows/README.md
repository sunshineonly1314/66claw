# Clawdbot Windows 打包指南

本目录包含 Windows 安装程序的构建脚本。

## 目录结构

```
scripts/windows/
├── README.md           # 本文档
├── setup.iss           # Inno Setup 安装脚本
├── clawdbot.bat        # 启动脚本
├── start-gateway.bat   # Gateway 自启动脚本
├── build-installer.ps1 # PowerShell 构建脚本
└── node-portable/      # Node.js 便携版 (自动下载)
```

## 前置要求

1. **安装 Inno Setup 6**
   - 下载: https://jrsoftware.org/isinfo.php
   - 安装到默认路径: `C:\Program Files (x86)\Inno Setup 6`

2. **安装 Node.js 22+**
   - 用于构建项目

3. **安装 pnpm**
   ```bash
   npm install -g pnpm
   ```

## 构建步骤

### 1. 构建项目

```bash
# 在项目根目录
pnpm install
pnpm build
pnpm ui:build
```

### 2. 运行打包脚本

```powershell
cd scripts/windows
.\build-installer.ps1
```

脚本会自动:
- 下载 Node.js 便携版
- 安装生产依赖
- 构建安装程序

### 3. 输出

构建完成后，安装程序位于:
```
installer/ClawdbotSetup-2026.1.25-x64.exe
```

## 安装程序功能

- 一键安装到 Program Files
- 可选创建桌面快捷方式
- 可选开机自动启动
- 安装完成后自动打开配置向导
- 完整的卸载支持

## 自定义构建

### 修改版本号

编辑 `setup.iss`:
```ini
#define MyAppVersion "2026.1.25"
```

或通过参数传递:
```powershell
.\build-installer.ps1 -Version "2026.2.1"
```

### 跳过 Node.js 下载

如果已有 Node.js 便携版:
```powershell
.\build-installer.ps1 -SkipNodeDownload
```

### 修改 Node.js 版本

```powershell
.\build-installer.ps1 -NodeVersion "22.13.0"
```

## 测试安装程序

1. 在虚拟机或测试环境中运行安装程序
2. 验证:
   - 安装过程正常
   - 配置向导正常打开
   - Gateway 可以启动
   - 卸载正常

## 故障排除

### Inno Setup 未找到

确保 Inno Setup 安装在默认路径，或修改 `build-installer.ps1` 中的路径。

### 构建失败

1. 确保已运行 `pnpm build`
2. 确保 `dist/` 目录存在
3. 检查 PowerShell 执行策略: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

### 安装后无法启动

1. 检查 Node.js 便携版是否正确
2. 检查 PATH 环境变量
3. 以管理员身份运行

## 相关文档

- [Inno Setup 文档](https://jrsoftware.org/ishelp/)
- [Node.js 便携版](https://nodejs.org/en/download/prebuilt-binaries)
