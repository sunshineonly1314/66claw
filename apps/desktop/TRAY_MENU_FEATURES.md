# 系统托盘新增功能说明

## 🎉 新增功能

已成功为 Tauri 桌面应用的系统托盘添加了 4 个服务管理按钮：

### 托盘菜单结构

```
┌─────────────────────────────┐
│ 显示主窗口                  │
│ 隐藏到托盘                  │
├─────────────────────────────┤
│ ▶ 启动服务                 │  ← 新增
│ ⏸ 停止服务                 │  ← 新增
│ 🔄 重启服务                 │  ← 新增
├─────────────────────────────┤
│ 📁 查看日志                 │  ← 新增
├─────────────────────────────┤
│ 退出                        │
└─────────────────────────────┘
```

---

## 📋 功能详情

### 1. ▶ 启动服务

**功能**: 启动 Node.js Gateway 后台服务

**实现**:
- 检查服务是否已在运行
- 如果未运行,启动 Gateway sidecar 进程
- 端口: 18789
- 自动生成认证 token

**代码位置**: [tray.rs:L39-48](src-tauri/src/tray.rs#L39-L48)

**使用场景**:
- 应用启动时 Gateway 未自动启动
- 手动停止后需要重新启动
- 开发模式下手动启动服务

---

### 2. ⏸ 停止服务

**功能**: 停止 Node.js Gateway 后台服务

**实现**:
- 检查服务是否正在运行
- 如果运行中,终止 sidecar 进程
- 清理进程资源

**代码位置**: [tray.rs:L49-57](src-tauri/src/tray.rs#L49-L57)

**使用场景**:
- 临时停止服务以节省资源
- 调试或维护时需要停止服务
- 端口冲突需要释放 18789 端口

---

### 3. 🔄 重启服务

**功能**: 重启 Node.js Gateway 后台服务

**实现**:
- 先停止当前运行的服务
- 等待 500ms 确保端口释放
- 重新启动服务并生成新 token

**代码位置**: [tray.rs:L58-63](src-tauri/src/tray.rs#L58-L63)

**使用场景**:
- 配置修改后需要重启生效
- 服务出现异常需要重启恢复
- 更新插件/技能后重新加载

**注意**: 重启会生成新的认证 token,已连接的客户端需要重新认证

---

### 4. 📁 查看日志

**功能**: 在系统文件管理器中打开日志目录

**实现**:
- Windows: 使用 `explorer` 打开目录
- macOS: 使用 `open` 打开目录
- Linux: 使用 `xdg-open` 打开目录

**日志位置**:
- **Windows**: `<exe目录>/logs/`
- **macOS**: `~/Library/Logs/ClawdbotCN/`
- **Linux**: `<app目录>/logs/`

**代码位置**: [tray.rs:L64-75](src-tauri/src/tray.rs#L64-L75)

**使用场景**:
- 查看 Gateway 运行日志
- 调试服务启动失败问题
- 检查错误堆栈信息

---

## 🔧 技术实现

### 新增文件修改

#### 1. `src-tauri/src/sidecar.rs`

新增函数:
```rust
// 检查服务运行状态
pub fn is_sidecar_running() -> bool

// 重启服务
pub fn restart_sidecar(app: AppHandle) -> Result<(), Box<dyn std::error::Error>>

// 获取日志目录
pub fn logs_directory() -> Result<PathBuf, Box<dyn std::error::Error>>
```

**说明**: 添加服务管理核心功能

---

#### 2. `src-tauri/src/commands.rs`

新增 IPC 命令:
```rust
// 启动服务
#[tauri::command]
pub async fn start_service(app: AppHandle) -> Result<String, String>

// 停止服务
#[tauri::command]
pub async fn stop_service() -> Result<String, String>

// 重启服务
#[tauri::command]
pub async fn restart_service(app: AppHandle) -> Result<String, String>

// 获取服务状态
#[tauri::command]
pub async fn get_service_status() -> Result<ServiceStatus, String>

// 打开日志目录
#[tauri::command]
pub async fn open_logs_directory() -> Result<String, String>
```

**说明**: 提供前端可调用的 API 接口

---

#### 3. `src-tauri/src/platform/mod.rs`

新增函数:
```rust
// 跨平台打开目录
pub fn open_directory(path: &Path) -> Result<(), Box<dyn std::error::Error>>
```

**说明**: 统一跨平台文件管理器调用接口

---

#### 4. `src-tauri/src/platform/windows.rs`

新增函数:
```rust
// Windows: 使用 explorer 打开目录
pub fn open_directory(path: &Path) -> Result<(), Box<dyn std::error::Error>>
```

---

#### 5. `src-tauri/src/platform/macos.rs`

新增函数:
```rust
// macOS: 使用 open 命令打开目录
pub fn open_directory(path: &Path) -> Result<(), Box<dyn std::error::Error>>
```

---

#### 6. `src-tauri/src/tray.rs`

更新托盘菜单:
```rust
// 添加 4 个新菜单项
&MenuItem::with_id(app, "start_service", "▶ 启动服务", true, None::<&str>)?,
&MenuItem::with_id(app, "stop_service", "⏸ 停止服务", true, None::<&str>)?,
&MenuItem::with_id(app, "restart_service", "🔄 重启服务", true, None::<&str>)?,
&MenuItem::with_id(app, "open_logs", "📁 查看日志", true, None::<&str>)?,
```

实现菜单事件处理逻辑

---

#### 7. `src-tauri/src/main.rs`

注册新命令:
```rust
.invoke_handler(tauri::generate_handler![
    commands::get_gateway_info,
    commands::start_service,         // 新增
    commands::stop_service,          // 新增
    commands::restart_service,       // 新增
    commands::get_service_status,    // 新增
    commands::open_logs_directory,   // 新增
])
```

---

## 🎯 使用示例

### 从前端调用 (TypeScript)

```typescript
import { invoke } from '@tauri-apps/api/core';

// 启动服务
try {
  const result = await invoke('start_service');
  console.log(result); // "服务启动成功"
} catch (error) {
  console.error(error); // "服务已在运行中"
}

// 停止服务
try {
  const result = await invoke('stop_service');
  console.log(result); // "服务已停止"
} catch (error) {
  console.error(error); // "服务未在运行"
}

// 重启服务
try {
  const result = await invoke('restart_service');
  console.log(result); // "服务重启成功"
} catch (error) {
  console.error(error);
}

// 获取服务状态
const status = await invoke('get_service_status');
console.log(status);
// { running: true, port: 18789 }

// 打开日志目录
try {
  const result = await invoke('open_logs_directory');
  console.log(result); // "已打开日志目录: D:\path\to\logs"
} catch (error) {
  console.error(error);
}
```

---

## 🔍 调试信息

### 控制台输出

启动服务:
```
[Tray] Service starting...
[Sidecar] Starting Node.js sidecar...
[Sidecar] Node: "D:\...\node\node.exe"
[Sidecar] Backend: "D:\...\dist\entry.js"
[Sidecar] Port: 18789
[Sidecar] Node.js sidecar started on port 18789
```

停止服务:
```
[Sidecar] Node.js sidecar stopped
```

重启服务:
```
[Sidecar] Restarting sidecar...
[Sidecar] Node.js sidecar stopped
[Sidecar] Starting Node.js sidecar...
[Sidecar] Node.js sidecar started on port 18789
```

打开日志:
```
[Tray] Opening logs directory: "D:\...\logs"
```

### 错误处理

服务已运行时启动:
```
[Tray] Service already running
```

服务未运行时停止:
```
[Tray] Service not running
```

端口被占用:
```
端口 18789 已被其他程序占用。

可能原因：
• 已有一个 ClawdbotCN 实例在运行
• 其他程序正在使用该端口

请关闭占用该端口的程序后重试。
```

---

## 📊 当前状态

### ✅ 已实现功能

- [x] 启动服务按钮 (托盘菜单)
- [x] 停止服务按钮 (托盘菜单)
- [x] 重启服务按钮 (托盘菜单)
- [x] 查看日志按钮 (托盘菜单)
- [x] 服务状态检查
- [x] IPC 命令支持
- [x] 跨平台文件管理器调用
- [x] 错误处理和用户提示
- [x] 开发模式热重载

### 🎯 测试清单

- [x] 代码编译成功 (Rust)
- [x] 托盘菜单显示正确
- [ ] 启动服务功能测试
- [ ] 停止服务功能测试
- [ ] 重启服务功能测试
- [ ] 查看日志功能测试
- [ ] Windows 平台测试
- [ ] macOS 平台测试 (待测试)

---

## 🐛 已知问题

### 1. 开发模式限制

在开发模式下 (`tauri dev`):
- ⚠️ Node.js sidecar 不会自动启动
- ⚠️ "启动服务" 按钮会失败 (node binary not found)
- ✅ 可以手动运行 `pnpm gateway:dev` 在另一个终端

**解决方案**: 生产构建会包含 Node.js 运行时

### 2. 服务状态持久化

重启应用后:
- ❌ 服务状态不会持久化
- ❌ 之前的 token 失效

**解决方案**: 每次启动应用会重新生成 token

---

## 🚀 下一步

### 增强功能
1. **状态指示器**
   - 在托盘图标上显示服务运行状态
   - 菜单项根据状态启用/禁用

2. **通知提示**
   - 服务启动/停止/重启成功时显示系统通知
   - 错误时显示错误通知

3. **日志查看器**
   - 在应用内嵌入日志查看界面
   - 实时日志流

4. **性能监控**
   - 显示 CPU/内存使用情况
   - Gateway 请求统计

---

## 📚 相关文档

- [完整开发文档](README.md)
- [快速启动指南](QUICK_START.md)
- [测试报告](../../TAURI_TEST_REPORT.md)
- [Tauri 菜单 API](https://tauri.app/reference/javascript/api/namespacecore#menu)

---

**更新时间**: 2026-02-17
**版本**: 2026.2.0
**开发者**: Claude Sonnet 4.5
