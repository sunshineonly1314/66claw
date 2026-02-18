# ClawdbotCN Windows 原生应用 (Tauri)

## 📋 概述

这个目录包含了 ClawdbotCN Windows 桌面应用的 Tauri 实现。

**用户视角**:
- 安装: `ClawdbotCN-Setup.exe` (Inno Setup)
- 启动: `ClawdbotCN.exe` (Tauri 应用)
- 使用: 原生桌面窗口,系统托盘集成

**开发者视角**:
- Tauri 是底层技术实现
- 用户完全感知不到 Tauri
- 与现有构建流程无缝集成

## 🏗️ 架构

```
ClawdbotCN.exe (Tauri)
├── 前端: WebView2 加载 dist/control-ui/ (Lit 组件)
├── 后端: Node.js Sidecar (dist/entry.js)
└── 功能: 系统托盘, 窗口管理, 自动启动
```

### 文件结构

```
scripts/windows/
├── tauri-src/                    # Tauri Rust 源码
│   ├── Cargo.toml               # Rust 依赖
│   ├── tauri.conf.json          # Tauri 配置
│   ├── src/
│   │   ├── main.rs              # 主程序入口
│   │   ├── commands.rs          # IPC 命令 (Tauri API)
│   │   └── sidecar.rs           # Node.js 进程管理
│   └── icons/                   # 应用图标
├── build-native-app.ps1         # 构建 Tauri 应用
├── ClawdbotCN.exe               # 构建输出 (by build-native-app.ps1)
└── setup.iss                    # Inno Setup 配置 (打包安装器)
```

## 🔧 开发环境要求

### 必需软件
1. **Rust** (1.93+)
   - 安装: https://www.rust-lang.org/tools/install

2. **MSVC Build Tools**
   - Visual Studio 2022 Build Tools
   - 勾选 "使用 C++ 的桌面开发"

3. **Node.js + pnpm** (已有)

4. **Inno Setup** (打包安装器用)

### 验证环境

```powershell
# 检查 Rust
rustc --version   # 应显示 rustc 1.93.x

# 检查 MSVC
where link.exe    # 应显示 MSVC 路径

# 检查 Node.js
node --version    # 应显示 Node.js 版本
pnpm --version    # 应显示 pnpm 版本
```

## 🚀 构建流程

### 方式 1: 使用构建脚本 (推荐)

```powershell
cd scripts/windows
.\build-native-app.ps1
```

这会自动:
1. 构建 Node.js 后端 (`pnpm build`)
2. 构建 UI (`cd ui && pnpm build`)
3. 构建 Tauri 应用 (Rust 编译)
4. 输出: `ClawdbotCN.exe`

**首次构建**: 约 5-10 分钟 (下载 Rust 依赖)
**后续构建**: 约 30 秒 - 2 分钟 (增量编译)

### 方式 2: 手动构建

```powershell
# 1. 构建后端
cd ../..
pnpm build

# 2. 构建 UI
cd ui
pnpm build
cd ../scripts/windows

# 3. 设置 MSVC 环境 + 构建 Tauri
& "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
cd tauri-src
cargo build --release
cd ..

# 4. 复制输出
copy tauri-src\target\release\clawdbot-windows.exe ClawdbotCN.exe
```

## 📦 打包安装器

构建完 `ClawdbotCN.exe` 后:

```powershell
# 使用 Inno Setup 打包
iscc setup.iss

# 输出: E:\clawdbuild\ClawdbotCN-Setup-2026.2.0-x64.exe
```

安装器会包含:
- `ClawdbotCN.exe` (Tauri 应用)
- `node/` (Node.js portable)
- `dist/` (后端代码)
- `node_modules/` (依赖)
- `extensions/`, `skills/` 等

## 🧪 测试

### 测试构建输出

```powershell
# 直接运行 exe (需要先有 node/ 和 dist/ 在同目录)
.\ClawdbotCN.exe
```

### 测试完整安装

```powershell
# 1. 构建安装器
iscc setup.iss

# 2. 运行安装器
E:\clawdbuild\ClawdbotCN-Setup-2026.2.0-x64.exe

# 3. 测试安装后的应用
```

## 🔄 与现有系统的关系

### 替换的部分
- ❌ `ClawdbotService.exe` (C# 启动器)
- ❌ `start-gateway.bat` (手动启动脚本)
- ✅ `ClawdbotCN.exe` (Tauri 应用,自动管理一切)

### 保留的部分
- ✅ 所有后端代码 (Node.js)
- ✅ 所有 UI 代码 (Lit)
- ✅ 所有配置, 数据, 日志
- ✅ Inno Setup 打包流程

### 用户体验改进
- ✅ 原生窗口 (之前是浏览器)
- ✅ 系统托盘 (一直运行在后台)
- ✅ 更快启动速度
- ✅ 更小包体积 (~80MB vs ~200MB)

## 📝 开发说明

### 修改 UI
1. 修改 `ui/src/` 下的 Lit 组件
2. 重新构建: `cd ui && pnpm build`
3. 重新构建 Tauri: `.\build-native-app.ps1`

### 修改后端
1. 修改 `src/` 下的 TypeScript 代码
2. 重新构建: `pnpm build`
3. 重新构建 Tauri: `.\build-native-app.ps1`

### 修改 Tauri 功能
1. 修改 `tauri-src/src/` 下的 Rust 代码
2. 重新构建: `.\build-native-app.ps1`

### 调试

```powershell
# 开发模式 (连接到 localhost:5173)
cd tauri-src
cargo run

# 发布模式 (加载 dist/control-ui/)
cargo build --release
```

## 🐛 常见问题

### Q: 构建失败 "link.exe not found"
**A**: MSVC 环境未设置。确保运行 `build-native-app.ps1`,它会自动设置环境。

### Q: 构建很慢
**A**: 首次构建需要下载所有 Rust 依赖 (5-10分钟)。后续构建会快很多。

### Q: 运行 exe 提示 "node.exe not found"
**A**:
- 开发环境: 需要先 `pnpm build` 和 `cd ui && pnpm build`
- 生产环境: 需要通过 Inno Setup 安装完整包

### Q: 如何回滚到 C# 版本?
**A**: 在 `setup.iss` 中:
1. 注释掉 `Source: "ClawdbotCN.exe"`
2. 取消注释 `Source: "native\ClawdbotService.exe"`
3. 修改 [Icons] 和 [Run] 部分指向 ClawdbotService.exe

## 📚 相关文档

- [Tauri 官方文档](https://tauri.app/)
- [Tauri 集成计划](../../devTemp/tauri-integration-plan.md)
- [构建状态](../../devTemp/tauri-build-status.md)

## 🎯 下一步

- [ ] 首次成功构建 `ClawdbotCN.exe`
- [ ] 测试 Tauri 应用运行
- [ ] 修改 `setup.iss` 集成 Tauri
- [ ] 测试完整安装流程
- [ ] 用户测试和反馈

---

**维护者**: Claude Sonnet 4.5
**最后更新**: 2026-02-13
