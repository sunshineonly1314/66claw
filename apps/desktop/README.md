# ClawdbotCN Desktop (Tauri)

跨平台桌面应用，基于 Tauri 2.x 构建。

## 📋 目录

- [功能特性](#功能特性)
- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [开发指南](#开发指南)
- [构建发布](#构建发布)
- [故障排查](#故障排查)

---

## 功能特性

### ✅ 已实现
- 🪟 **跨平台支持**: Windows、macOS (Linux 计划中)
- 🎨 **原生体验**: 系统托盘集成、原生窗口
- 🔐 **安全认证**: 自动生成 Gateway token
- 🚀 **自动启动**: 内置 Node.js Gateway sidecar
- 🌐 **Web 界面**: 基于 Vite + Lit Elements
- 📦 **一键安装**: NSIS (Windows) / DMG (macOS)

### 🏗️ 架构

```
┌─────────────────────────────────────┐
│     Tauri WebView (前端)            │
│     http://localhost:5173           │
└──────────────┬──────────────────────┘
               │ Tauri IPC Commands
┌──────────────▼──────────────────────┐
│     Rust 后端 (Tauri Core)          │
│     - 窗口管理                      │
│     - 系统托盘                      │
│     - Sidecar 进程管理              │
└──────────────┬──────────────────────┘
               │ Child Process
┌──────────────▼──────────────────────┐
│     Node.js Gateway (Sidecar)       │
│     ws://127.0.0.1:18789            │
│     - AI Agent 核心                 │
│     - 多渠道消息路由                │
└─────────────────────────────────────┘
```

---

## 系统要求

### 开发环境
- **Node.js**: >= 22.12.0 ([下载](https://nodejs.org/))
- **Rust**: >= 1.93 ([下载](https://rustup.rs/))
- **pnpm**: >= 10.23.0 (`npm install -g pnpm`)

### 运行环境
- **Windows**: Windows 10/11 (x64)
- **macOS**: macOS 13.0+ (Intel / Apple Silicon)

---

## 快速开始

### 方式一: 使用脚本 (推荐)

**Windows**:
```batch
# 开发模式
cd apps\desktop
tauri-dev.bat

# 诊断工具
tauri-diagnose.bat
```

### 方式二: 手动命令

```bash
# 1. 安装依赖
cd apps/desktop
pnpm install

# 2. 构建 UI 前端
cd ../..
pnpm ui:build

# 3. 启动开发模式
cd apps/desktop
pnpm tauri dev
```

---

## 开发指南

### 项目结构

```
apps/desktop/
├── src-tauri/              # Rust 后端代码
│   ├── Cargo.toml         # Rust 依赖
│   ├── tauri.conf.json    # Tauri 配置
│   ├── icons/             # 应用图标
│   └── src/
│       ├── main.rs        # 入口点
│       ├── lib.rs         # 库模块
│       ├── sidecar.rs     # Node.js sidecar 管理
│       ├── commands.rs    # IPC 命令
│       ├── tray.rs        # 系统托盘
│       └── platform/      # 平台特定代码
│           ├── mod.rs
│           ├── windows.rs
│           └── macos.rs
├── package.json           # 前端依赖
├── tauri-dev.bat          # 开发启动脚本
├── tauri-build.bat        # 构建脚本
└── tauri-diagnose.bat     # 诊断工具
```

### 常用命令

```bash
# 开发模式 (热重载)
pnpm tauri dev

# 构建生产版本
pnpm tauri build

# 仅构建 UI
cd ../.. && pnpm ui:build

# 仅构建后端
cd ../.. && pnpm build

# 检查 Rust 代码
cd src-tauri && cargo check

# 格式化代码
cd src-tauri && cargo fmt
```

### 开发模式说明

在开发模式下:
- ✅ Vite 开发服务器在 `http://localhost:5173`
- ✅ Tauri 窗口加载 Vite 服务器
- ⚠️ **Node.js sidecar 不会自动启动**

如需测试完整功能，需要手动启动 Gateway:
```bash
cd ../..
pnpm gateway:dev
```

---

## 构建发布

### Windows 构建

```batch
# 使用脚本
cd apps\desktop
tauri-build.bat

# 手动构建
cd apps\desktop
pnpm tauri build
```

**输出位置**:
- 安装包: `src-tauri/target/release/bundle/nsis/*.exe`
- 绿色版: `src-tauri/target/release/clawdbot-desktop.exe`

### macOS 构建

```bash
cd apps/desktop
pnpm tauri build
```

**输出位置**:
- DMG 映像: `src-tauri/target/release/bundle/dmg/*.dmg`
- App 包: `src-tauri/target/release/bundle/macos/*.app`

### 构建优化

```toml
# Cargo.toml - 添加发布优化
[profile.release]
opt-level = "z"     # 优化体积
lto = true          # 链接时优化
codegen-units = 1   # 更好的优化
strip = true        # 移除符号
```

---

## 配置文件

### tauri.conf.json

关键配置项:

```json
{
  "productName": "ClawdbotCN",
  "identifier": "com.clawdbot.cn.desktop",
  "version": "2026.2.0",

  "build": {
    "devUrl": "http://localhost:5173",
    "frontendDist": "../../../dist/control-ui"
  },

  "app": {
    "windows": [{
      "width": 1200,
      "height": 800,
      "title": "ClawdbotCN AI"
    }],
    "security": {
      "csp": "..."  // 内容安全策略
    }
  },

  "bundle": {
    "targets": ["nsis", "dmg"],
    "icon": ["icons/icon.png", "icons/icon.ico", "icons/icon.icns"]
  }
}
```

### Cargo.toml

主要依赖:

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-png"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
dirs = "5"
```

---

## IPC Commands

### get_gateway_info

获取 Gateway 连接信息。

**调用方式**:
```javascript
import { invoke } from '@tauri-apps/api/core';

const info = await invoke('get_gateway_info');
console.log(info);
// { port: 18789, token: "abc123..." }
```

**实现**: [commands.rs](src-tauri/src/commands.rs)

---

## 系统托盘

### 菜单项
- **显示主窗口**: 从托盘恢复窗口
- **隐藏到托盘**: 最小化到系统托盘
- **退出**: 完全退出应用 (清理 sidecar)

### 事件
- **左键点击**: 显示主窗口
- **右键点击**: 打开托盘菜单

**实现**: [tray.rs](src-tauri/src/tray.rs)

---

## Sidecar 管理

### 启动流程

1. 检查端口 18789 是否可用
2. 生成随机 Gateway token (48 字符)
3. 解析资源路径 (跨平台)
4. 启动 Node.js 子进程:
   ```bash
   node dist/entry.js gateway run --port 18789 --allow-unconfigured
   ```
5. 注入 token 到 WebView URL hash

### 环境变量

| 变量 | 说明 |
|------|------|
| `OPENCLAWCN_GATEWAY_TOKEN` | 认证 token |
| `OPENCLAWCN_BUNDLED_PLUGINS_DIR` | 插件目录 |
| `OPENCLAWCN_BUNDLED_SKILLS_DIR` | 技能目录 |
| `OPENCLAWCN_DESKTOP_MODE` | 桌面模式标志 |
| `OPENCLAWCN_NO_RESPAWN` | 禁用自动重启 |

### 日志位置

- **Windows**: `%LOCALAPPDATA%\com.clawdbot.cn.desktop\logs\gateway.log`
- **macOS**: `~/Library/Logs/ClawdbotCN/gateway.log`

**实现**: [sidecar.rs](src-tauri/src/sidecar.rs)

---

## 故障排查

### 问题: 端口被占用

**错误信息**:
```
端口 18789 已被其他程序占用
```

**解决方案**:
```bash
# Windows: 查找占用进程
netstat -ano | findstr ":18789"
taskkill /PID <进程ID> /F

# macOS/Linux
lsof -ti:18789 | xargs kill -9
```

### 问题: Sidecar 启动失败

**检查清单**:
1. Node.js 运行时是否存在? (`node/node.exe`)
2. 后端代码是否存在? (`dist/entry.js`)
3. 端口是否冲突?
4. 防火墙是否阻止?

**日志位置**: 见 [Sidecar 管理](#sidecar-管理)

### 问题: UI 无法连接 Gateway

**检查**:
1. 运行 `tauri-diagnose.bat` 检查端口
2. 打开浏览器开发者工具查看 WebSocket 连接
3. 检查 token 是否正确注入 (URL hash)

### 问题: 编译失败

**常见原因**:
- Rust 版本过低 → `rustup update`
- 缺少系统依赖 → 见 [系统要求](#系统要求)
- Cargo 缓存损坏 → `cargo clean`

---

## 性能优化

### 减小打包体积

1. **启用 LTO**:
   ```toml
   [profile.release]
   lto = true
   ```

2. **移除调试符号**:
   ```toml
   [profile.release]
   strip = true
   ```

3. **前端代码分割**:
   ```javascript
   // vite.config.js
   build: {
     rollupOptions: {
       output: {
         manualChunks(id) {
           if (id.includes('node_modules')) {
             return 'vendor';
           }
         }
       }
     }
   }
   ```

### 启动速度优化

- 使用延迟加载 (lazy loading)
- 优化图片资源 (WebP, AVIF)
- 启用 Brotli 压缩

---

## 测试

### 单元测试

```bash
# Rust 测试
cd src-tauri
cargo test

# TypeScript 测试
cd ../..
pnpm test
```

### E2E 测试

```bash
# WebDriver 测试
pnpm tauri dev &
pnpm test:e2e
```

---

## 贡献指南

### 代码风格

- **Rust**: `cargo fmt` + `cargo clippy`
- **TypeScript**: `pnpm format` + `pnpm lint`

### 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
refactor: 代码重构
test: 测试相关
```

---

## 相关文档

- [Tauri 官方文档](https://tauri.app/)
- [Tauri API 参考](https://tauri.app/reference/)
- [项目整体架构](../../README.md)
- [测试报告](../../TAURI_TEST_REPORT.md)

---

## 许可证

MIT License - 详见 [LICENSE](../../LICENSE)

---

**维护者**: ClawdbotCN Team
**最后更新**: 2026-02-17
