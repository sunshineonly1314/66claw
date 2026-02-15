# OpenClawCN Windows 原生打包

本目录包含 Windows 原生 EXE 安装程序的构建脚本。

## 目录结构

```
scripts/windows/
├── build-windows.ps1        # 主打包脚本（统一版）
├── setup.iss                # Inno Setup 配置
├── openclawcn.bat             # 启动脚本
├── start-gateway.bat        # Gateway 启动脚本
├── verify-installation.ps1  # 安装验证脚本
├── package-bundled-skills.ps1  # Skills 打包脚本
├── node-portable/           # Node.js 便携版（自动下载）
└── README.md                # 本文档
```

## 快速开始

### 1. 前置要求

- **Inno Setup 6**: https://jrsoftware.org/isinfo.php
- **Node.js 22+**: 用于构建项目
- **pnpm**: 包管理器

### 2. 构建项目

```bash
# 在项目根目录
pnpm install
pnpm build
```

### 3. 打包 EXE

```powershell
cd scripts/windows
.\build-windows.ps1
```

### 4. 输出

```
installer/OpenClawCNSetup-{version}-x64.exe
```

## 打包参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-Version` | `"2026.2.1"` | 版本号 |
| `-NodeVersion` | `"22.13.1"` | Node.js 版本 |
| `-SkipNodeDownload` | `false` | 跳过 Node.js 下载 |
| `-SkipBuild` | `false` | 跳过项目构建 |
| `-SkipDeps` | `false` | 跳过依赖安装 |

### 示例

```powershell
# 完整打包
.\build-windows.ps1

# 指定版本
.\build-windows.ps1 -Version "2026.3.1"

# 跳过下载（已有 Node.js）
.\build-windows.ps1 -SkipNodeDownload

# 快速打包（跳过构建）
.\build-windows.ps1 -SkipBuild -SkipDeps
```

## 安装程序功能

- ✅ 包含完整 Node.js 运行时（无需用户安装）
- ✅ 包含中国区插件（飞书/钉钉/企微）
- ✅ 自动创建桌面/开始菜单快捷方式
- ✅ 支持开机自启动
- ✅ 安装后自动打开配置向导
- ✅ 完整卸载支持

## 验证安装

```powershell
.\verify-installation.ps1 -InstallDir "C:\Program Files\OpenClawCN"
```

## 故障排除

### Inno Setup 未找到

确保安装在以下路径之一：
- `C:\Program Files (x86)\Inno Setup 6`
- `C:\Program Files\Inno Setup 6`

### 构建失败

1. 确保已运行 `pnpm build`
2. 确保 `dist/` 目录存在
3. 检查 PowerShell 执行策略：
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

### Node.js 下载失败

脚本会自动尝试国内镜像（npmmirror.com），如果仍失败：
1. 手动下载 Node.js：https://nodejs.org/dist/v22.13.1/node-v22.13.1-win-x64.zip
2. 解压到 `scripts/windows/node-portable/`

## 相关链接

- [Inno Setup 文档](https://jrsoftware.org/ishelp/)
- [Node.js 下载](https://nodejs.org/)
- [OpenClawCN 文档](https://docs.openclawcn.cn/)
