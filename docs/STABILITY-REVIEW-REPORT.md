# ClawdbotCN 稳定性增强 & 代码审查报告

> 日期: 2026-02-11
> 分支: security-fixes-batch-1-phase-1
> 范围: Gateway核心服务、托盘应用、配置IO、安全模块、License校验

---

## 一、项目架构概览

| 模块 | 文件数 | 职责 |
|------|--------|------|
| **gateway/** | 141 | WebSocket/HTTP 服务器、聊天、频道管理 |
| **agents/** | 283 | AI对话引擎、Shell工具、技能系统 |
| **infra/** | 147 | 端口管理、锁文件、心跳、更新 |
| **config/** | 130 | 配置加载/验证/环境变量替换 |
| **cli/** | 97 | 命令行、Gateway运行循环 |
| **license/** | 15 | 授权验证、设备绑定、令牌管理 |
| **security/** | 14 | 反调试、完整性校验、篡改防护 |
| **ui/** | 162 | 控制台Web UI (Lit组件) |
| **Windows Tray** | 1855行 | .NET系统托盘服务 |

---

## 二、已修复的崩溃风险 (Critical)

### 2.1 Control UI 文件读取竞态条件
**文件:** `src/gateway/control-ui.ts`
**问题:** `getCompressed()` 中 `statSync()` 失败后直接调用 `readFileSync()`，若文件已被删除则二次抛出未捕获异常 → Gateway崩溃
**修复:**
- 重构 `getCompressed()` 将 stat+read 合并到单个 try-catch
- `serveFile()` 添加 try-catch，文件不存在返回404而非崩溃
- `serveIndexHtml()` 添加 try-catch，防止 index.html 不可读时崩溃

### 2.2 Gateway关闭超时过短
**文件:** `src/cli/gateway-cli/run-loop.ts`
**问题:** 关闭超时仅5秒，大量WebSocket连接/慢Channel插件/MCP服务器无法在5秒内清理完毕 → 超时强制退出(code 124) → 托盘看门狗误判为崩溃 → 触发重启风暴
**修复:** 超时从 5s 提升到 15s，给予足够时间完成:
- WebSocket drain (2s)
- HTTP server close (2s per server)
- Channel plugin cleanup
- MCP server kill
- License/security service stop

### 2.3 Gateway启动失败处理策略
**文件:** `src/cli/gateway-cli/run-loop.ts`
**问题:** `params.start()` 抛出异常时直接冒泡到 `while(true)` 循环外部，导致Gateway完全停止；但如果全部捕获重试，则 GatewayLockError 等致命错误也被吞掉
**修复:**
- `params.start()` 包裹 try-catch
- `GatewayLockError` 和非 `EADDRINUSE` 错误直接重新抛出（致命错误由调用者处理）
- 仅 `EADDRINUSE`（端口暂时被占用）触发2秒延迟重试
- 记录完整错误栈便于诊断

### 2.4 未捕获异常/Promise拒绝导致进程退出
**文件:** `src/cli/gateway-cli/run-loop.ts`
**问题:** Node 22+ 默认对 unhandledRejection 终止进程，任何漏网的Promise拒绝都会导致Gateway突然死亡
**修复:**
- 添加 `unhandledRejection` 全局处理器，记录错误但不退出
- 添加 `uncaughtException` 全局处理器，记录错误后优雅退出
- 信号清理时移除这些处理器

### 2.5 HTTP Server关闭错误中断关闭序列
**文件:** `src/gateway/server-close.ts`
**问题:** `httpServer.close()` 回调中使用 `reject(err)` — 如果关闭已关闭的服务器会抛出错误，中断整个关闭流程
**修复:** 将 `reject` 改为 `resolve`，关闭错误记录为debug日志但不阻断关闭

---

## 三、已修复的稳定性问题 (High)

### 3.1 Windows锁文件PID复用误判
**文件:** `src/infra/gateway-lock.ts`
**问题:** Windows上PID被快速复用，无心跳文件时返回"alive"导致新Gateway锁获取卡住5秒超时
**修复:**
- 无心跳文件时检查锁文件创建时间作为后备
- Gateway崩溃但未创建心跳文件时返回"unknown"让调用者重试
- 锁文件超过staleMs且无心跳时直接判定"dead"

### 3.2 托盘并发Stop/Restart竞态
**文件:** `scripts/windows/native/ClawdbotService.cs`
**问题:** 看门狗和用户同时触发Stop/Restart，两个线程同时调用 `Process.Kill()` → 其中一个抛异常 → 状态不一致
**修复:**
- 添加 `volatile bool isStopping` 标志
- `StopGatewayInternal()` 开头检查并原子设置
- 完成后重置标志

### 3.3 netstat调用无超时保护
**文件:** `scripts/windows/native/ClawdbotService.cs`
**问题:** `IsGatewayRunning()` 调用 `netstat -ano` 但无超时，系统负载高时可能挂起
**修复:** 添加5秒 `WaitForExit(5000)` 超时，超时后Kill进程并返回false

### 3.4 License验证中Date解析无NaN检查
**文件:** `src/gateway/license-check.ts`
**问题:** `new Date(localCache.expiresAt).getTime()` 对畸形日期字符串返回NaN → `Date.now() < NaN` 返回false → 逻辑错误
**修复:** 添加 `Number.isFinite(expiresAt)` 检查，NaN时返回false

### 3.5 后台Token刷新loadConfig可能崩溃
**文件:** `src/gateway/license-check.ts`
**问题:** `triggerBackgroundTokenRefresh()` 和启动时的 `loadConfig()` 调用无try-catch → 配置文件损坏时抛出异常 → 未被 `.catch()` 捕获
**修复:** 两处 `loadConfig()` 调用均添加 try-catch，失败时优雅降级

### 3.6 退出时资源泄漏
**文件:** `scripts/windows/native/ClawdbotService.cs`
**问题:** `ExitApplication()` 中 tray icon 和 context menu 的 Dispose 不完整，自定义icon未释放
**修复:**
- 添加icon资源释放（非系统图标）
- 添加contextMenu释放
- 退出前刷新日志缓冲区
- 停止定时器添加异常保护

---

## 四、已增强的防御性措施 (Medium)

### 4.1 配置清理器增强
**文件:** `src/config/config-sanitizer.ts`
- `sanitizeUnknownRootFields()` 中 `modified` 从 `const` 改为 `let`（修复了修改标志永远为false的bug）
- 添加 gateway.port 类型矫正（字符串→数字）

### 4.2 反调试模块加固
**文件:** `src/security/anti-debug.ts`
- 扩展敏感环境变量清理范围（增加 API keys）
- 自定义回调添加 try-catch
- 退出前停止定时检测器

### 4.3 License验证响应结构校验
**文件:** `src/license/verify.ts`
- 验证 `response.data` 是否为有效对象
- 验证 `data.valid` 是否为 boolean 类型
- 防止服务端返回畸形数据导致后续代码崩溃

### 4.4 配置备份轮转保护
**文件:** `src/config/io.ts`
- 备份轮转异常不再传播到上层
- 确保主配置写入不受备份失败影响

---

## 五、测试验证结果

| 指标 | 结果 |
|------|------|
| TypeScript编译 | **0 errors** |
| 测试文件总数 | 930 |
| 通过测试文件 | **927** |
| 通过测试 | **6766** |
| 失败测试文件 | 1 (pre-existing: exec-approvals Windows bypass, 17 tests) |
| 跳过测试 | 11 |
| Gateway CLI Coverage测试 | **9/9 通过** (含3个超时修复) |
| Gateway Lock Heartbeat测试 | 9/9 通过 |
| Security Protection A/B测试 | 38/38 通过 |
| Control UI测试 | 7/7 通过 |

---

## 六、变更文件清单

| 文件 | 变更类型 | 风险等级 |
|------|----------|----------|
| `src/gateway/control-ui.ts` | 修复文件读取竞态 + try-catch保护 | 🔴 Critical |
| `src/cli/gateway-cli/run-loop.ts` | 超时增加 + 全局异常兜底 + 启动失败重试 | 🔴 Critical |
| `src/gateway/server-close.ts` | HTTP close错误不中断关闭流程 | 🟡 High |
| `src/infra/gateway-lock.ts` | Windows心跳逻辑修正 | 🟡 High |
| `src/gateway/license-check.ts` | Date NaN保护 + loadConfig防御 | 🟡 High |
| `scripts/windows/native/ClawdbotService.cs` | 并发保护 + netstat超时 + 资源释放 | 🟡 High |
| `src/config/io.ts` | 备份轮转异常隔离 | 🟢 Medium |
| `src/config/config-sanitizer.ts` | modified标志修复 + port类型矫正 | 🟢 Medium |
| `src/security/anti-debug.ts` | 扩展环境变量清理 + 回调保护 | 🟢 Medium |
| `src/license/verify.ts` | 响应结构校验 | 🟢 Medium |
| `src/infra/gateway-lock-heartbeat.test.ts` | 测试适配新心跳逻辑 | 测试 |
| `src/security/software-protection-ab.test.ts` | 文件计数更新 | 测试 |

---

## 七、Gateway不崩盘保障矩阵

```
┌─────────────────────────────────────────────────────────────┐
│                    Gateway 防崩矩阵                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: 进程级保护                                       │
│  ├── unhandledRejection 全局兜底                           │
│  ├── uncaughtException 全局兜底                            │
│  ├── EADDRINUSE 2s delay 重试 (仅端口占用时重试)            │
│  └── 15s 优雅关闭超时 (原5s, 防看门狗误判)                │
│                                                             │
│  Layer 2: HTTP/WS 请求级保护                               │
│  ├── serveFile() try-catch (文件404不崩溃)                 │
│  ├── serveIndexHtml() try-catch (index不可读不崩溃)        │
│  ├── httpServer.close() 错误不中断关闭                     │
│  └── WSS close 2s 超时保护                                 │
│                                                             │
│  Layer 3: 业务逻辑保护                                     │
│  ├── loadConfig() try-catch (配置损坏不崩溃)               │
│  ├── Date.parse() NaN 检查                                 │
│  ├── License响应结构校验                                   │
│  └── 后台Token刷新指数退避                                 │
│                                                             │
│  Layer 4: 外部进程保护 (C# Tray)                           │
│  ├── isStopping 并发锁                                     │
│  ├── netstat 5s 超时                                       │
│  ├── Watchdog 指数退避 (5→10→20→30min)                    │
│  └── 端口释放等待 (防EADDRINUSE)                          │
│                                                             │
│  Layer 5: 锁文件健壮性                                     │
│  ├── Windows心跳缺失→检查锁创建时间                       │
│  ├── PID复用检测增强                                       │
│  └── 死锁5s超时自动清理                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、部署建议

1. **部署前**: 确保 `npx tsc --noEmit` 编译无错误
2. **部署后**: 监控 `logs/service.log` 和 `logs/gateway-output.log` 前30分钟
3. **观察指标**:
   - Gateway 进程存活时间 (应 > 1小时无重启)
   - 看门狗重启次数 (应为0)
   - `shutdown timed out` 日志 (应不出现)
   - `unhandled promise rejection` 日志 (应不出现)
4. **回滚条件**: 如果出现连续重启 > 3次/5分钟, 回滚到上一版本

---

*报告生成: Claude Opus 4.6 | 2026-02-11*
