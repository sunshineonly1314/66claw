# 🚀 Tauri Desktop 快速启动指南

## 📦 一键启动 (Windows)

```batch
cd apps\desktop
tauri-dev.bat
```

---

## 🛠️ 手动启动步骤

### 1️⃣ 安装依赖
```bash
cd apps/desktop
pnpm install
```

### 2️⃣ 构建 UI
```bash
cd ../..
pnpm ui:build
```

### 3️⃣ 启动应用
```bash
cd apps/desktop
pnpm tauri dev
```

---

## 🔍 诊断工具

```batch
cd apps\desktop
tauri-diagnose.bat
```

检查项:
- ✅ Node.js / pnpm / Rust 版本
- ✅ 项目文件是否完整
- ✅ 端口占用情况
- ✅ 进程运行状态

---

## 📊 当前状态

### ✅ 已启动服务
| 服务 | 端口 | 状态 |
|------|------|------|
| Vite Dev Server | 5173 | ✅ 运行中 |
| Gateway (WebSocket) | 18789 | ✅ 监听中 |
| Tauri Desktop App | - | ✅ 窗口已打开 |

### 📁 访问地址
- **前端开发服务器**: http://localhost:5173
- **Gateway WebSocket**: ws://127.0.0.1:18789
- **桌面应用窗口**: ClawdbotCN AI (1200x800)

---

## 🎯 功能测试清单

### 已验证 ✅
- [x] 窗口正常显示
- [x] Vite 热重载
- [x] 端口监听正常
- [x] 进程管理
- [x] 系统托盘 (右键菜单)

### 待测试
- [ ] Gateway 完整集成
- [ ] 多渠道消息路由
- [ ] AI Agent 对话
- [ ] 文件上传/下载
- [ ] 系统通知

---

## 🐛 常见问题

### Q1: 端口 18789 被占用？
```bash
# Windows
netstat -ano | findstr ":18789"
taskkill /PID <进程ID> /F
```

### Q2: UI 构建失败？
```bash
cd ../..
pnpm install
pnpm ui:build
```

### Q3: Rust 编译错误？
```bash
rustup update
cd apps/desktop/src-tauri
cargo clean
cargo check
```

### Q4: 看不到窗口？
- 检查任务栏 / 系统托盘
- 检查进程: `tasklist | findstr clawdbot-desktop`
- 查看日志: `%LOCALAPPDATA%\com.clawdbot.cn.desktop\logs\`

---

## 📚 更多文档

- [完整 README](README.md)
- [测试报告](../../TAURI_TEST_REPORT.md)
- [Tauri 官方文档](https://tauri.app/)

---

## 🎮 快捷键

| 操作 | 快捷键 |
|------|--------|
| 刷新窗口 | `Ctrl + R` / `F5` |
| 开发者工具 | `F12` |
| 停止开发服务器 | `Ctrl + C` |

---

**当前版本**: 2026.2.0
**更新时间**: 2026-02-17
