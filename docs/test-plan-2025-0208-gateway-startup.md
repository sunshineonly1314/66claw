# Gateway 启动优化 — 2.8 测试清单

**版本**: master (当前分支)
**测试日期**: 2025-02-08
**测试范围**: Gateway 启动序列优化 + UI 优雅等待 + License 并行验证

---

## 修改概要

| 模块 | 修改内容 | 影响范围 |
|------|----------|----------|
| `server.impl.ts` | License 验证两阶段并行化、条件性配置重读 | 启动速度、安全 |
| `license-check.ts` | `_licensePending` 标志、fail-close 修复、skipIntegrity、pending 状态 | 安全、License 验证 |
| `gateway.ts` | `maxBackoffMs` 选项、`setMaxBackoffMs()` 方法 | WebSocket 重连 |
| `app-gateway.ts` | 120s 启动优雅期、3s→15s backoff 切换 | UI 体验 |
| `app-render.ts` | Topbar 三态显示 (ok/starting/offline) | UI 显示 |
| `overview.ts` | 启动等待卡片（spinner + 提示文案） | UI 显示 |
| `components.css` | `.statusDot.starting` amber 动画、`.startup-spinner` | UI 样式 |
| `i18n zh-CN/en` | 3 个新翻译 key | 国际化 |

---

## 前置条件

- [ ] TypeScript 编译通过 (`npx tsc --noEmit`)
- [ ] 单元测试无新增失败 (`npx vitest run`)
- [ ] 已部署到测试环境

---

## 测试用例

### TC-01: 首次启动 — UI 优雅等待（P0）

**前提**: Gateway 未运行，浏览器清除缓存/localStorage

**步骤**:
1. 启动 Gateway（首次启动，需要 license 验证）
2. 立即打开浏览器访问 Control UI
3. 观察 UI 状态变化

**预期结果**:
- [ ] Topbar Health 显示 **amber 脉冲点** + "启动中..." 文字
- [ ] Overview 卡片显示 **spinner** + "正在等待网关启动..."
- [ ] 下方灰色提示："首次启动可能需要 1-2 分钟，请耐心等待"
- [ ] **没有红色错误框** (`.callout.danger`) 出现
- [ ] Gateway 就绪后，UI 自动连接，Topbar 切换为绿色 "OK"
- [ ] Overview 卡片错误提示消失，显示正常状态

**关注指标**:
- 从打开页面到连接成功的时间: _____ 秒
- 期间是否闪现过红色错误: 是/否

---

### TC-02: 首次启动 — 120s 超时后显示错误（P1）

**前提**: Gateway 无法启动（如端口被占用、配置错误）

**步骤**:
1. 故意阻止 Gateway 启动（如杀死进程但不重启）
2. 打开浏览器访问 Control UI
3. 等待 120 秒以上

**预期结果**:
- [ ] 前 120 秒内显示 "启动中..." 优雅等待
- [ ] 120 秒后 amber 状态切换为 **红色错误** 或 "Offline"
- [ ] 显示具体的连接错误信息

---

### TC-03: Auth 错误立即显示，不被 grace period 抑制（P0）

**前提**: Gateway 已运行，使用**错误的 token** 访问

**步骤**:
1. 启动 Gateway
2. 修改浏览器 localStorage 中的 token 为无效值
3. 刷新页面

**预期结果**:
- [ ] Auth 错误**立即显示**（不等待 120s）
- [ ] 触发 token 恢复机制（L1/L2/L3）
- [ ] 错误信息包含 token 相关关键字

---

### TC-04: 已连接后断开 — 显示红色错误（P1）

**前提**: Gateway 正在运行，UI 已成功连接

**步骤**:
1. 正常连接到 Gateway（确认 Topbar 显示绿色 OK）
2. 停止 Gateway 进程
3. 观察 UI 状态

**预期结果**:
- [ ] 立即显示红色错误（不走 grace period）
- [ ] 错误信息显示断开原因
- [ ] 重启 Gateway 后 UI 自动重连

---

### TC-05: License 并行启动 — 服务器提前可达（P0，CN 版本）

**前提**: ClawdbotCN 版本，需要 license 验证

**步骤**:
1. 停止 Gateway
2. 记录当前时间
3. 启动 Gateway，同时用 `curl` 或浏览器尝试连接 `http://localhost:18789`
4. 记录 HTTP 服务器开始响应的时间
5. 记录 License 验证完成的时间（查看日志 "License check passed"）

**预期结果**:
- [ ] HTTP 服务器在 **完整性检查通过后** 立即可达（不等 license 网络验证）
- [ ] License 验证在后台并行完成
- [ ] 启动时间相比优化前减少 _____ 秒

**对比数据**:
| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| HTTP 可达时间 | ~60-70s | ___s |
| License 完成时间 | ~60-70s | ___s |
| WebSocket 首次连接 | ~60-70s | ___s |

---

### TC-06: License 验证失败 — fail-close 安全（P0，CN 版本）

**前提**: ClawdbotCN 版本，模拟 license 服务器不可达

**步骤**:
1. 断开网络（或配置无效的 license server 地址）
2. 启动 Gateway
3. 尝试使用需要授权的功能

**预期结果**:
- [ ] Gateway 启动但进入受限模式
- [ ] `isLicenseValid()` 返回 `false`
- [ ] UI License 状态显示错误信息（不是 "授权无效"，而是具体错误）
- [ ] 日志输出 "License verification failed: ..." 警告

---

### TC-07: License pending 期间 isLicenseValid 返回 false（P0，CN 版本）

**前提**: ClawdbotCN 版本

**步骤**:
1. 启动 Gateway
2. 在 license 验证完成前（10-30s 窗口），通过 API 发送聊天消息

**预期结果**:
- [ ] `isLicenseValid()` 返回 `false`（不是 true）
- [ ] 聊天被拒绝，显示 "授权验证中，请稍候..." 而非 "授权无效，请先激活或续费"
- [ ] License 验证完成后，聊天恢复正常

---

### TC-08: 完整性检查失败 — 阻止启动（P0，CN 版本）

**前提**: ClawdbotCN 版本

**步骤**:
1. 修改一个受保护的核心文件（如 license-check.js）
2. 尝试启动 Gateway

**预期结果**:
- [ ] Gateway 拒绝启动，进程退出 (exit code 1)
- [ ] 日志输出 "SECURITY VIOLATION: File tampering detected"
- [ ] HTTP 服务器**从未**开始监听端口

---

### TC-09: WebSocket backoff 生命周期 3s → 15s（P2）

**前提**: Gateway 未运行

**步骤**:
1. 打开浏览器 DevTools Network 面板
2. 访问 Control UI（Gateway 未启动）
3. 观察 WebSocket 连接重试间隔
4. 启动 Gateway，等待连接成功
5. 停止 Gateway，再次观察重试间隔

**预期结果**:
- [ ] 启动前（首次连接前）：重试间隔上限 **3 秒**
- [ ] 序列大约: 800ms → 1.36s → 2.3s → 3s → 3s → 3s ...
- [ ] 连接成功后断开：重试间隔上限 **15 秒**
- [ ] 序列大约: 800ms → 1.36s → 2.3s → 3.9s → 6.6s → 11.3s → 15s → 15s ...

---

### TC-10: 非 CN 版本不受影响（P1）

**前提**: 非 CN 版本（CLAWDBOT_CN 未设置，无 license key）

**步骤**:
1. 确认环境变量 `CLAWDBOT_CN` 未设置
2. 确认配置中无 `license.key`
3. 启动 Gateway
4. 正常使用所有功能

**预期结果**:
- [ ] 无完整性检查执行
- [ ] 无 license 验证执行
- [ ] `isLicenseValid()` 返回 `true`
- [ ] 启动速度与优化前相同（无额外开销）
- [ ] UI 正常连接，无 "启动中" 闪现

---

### TC-11: 页面刷新场景（P2）

**前提**: Gateway 已运行

**步骤**:
1. 正常连接到 Gateway
2. 刷新页面 (F5)
3. 观察状态变化

**预期结果**:
- [ ] 短暂显示 "启动中..." (因为 `hasEverConnected` 重置)
- [ ] 几秒内连接成功，切换为绿色 "OK"
- [ ] 不会出现红色错误闪现

---

### TC-12: Code 1012 服务重启（P2）

**前提**: Gateway 已运行，UI 已连接

**步骤**:
1. 在 UI 中修改配置并保存（触发 gateway 重启）
2. 观察 UI 状态

**预期结果**:
- [ ] 收到 code 1012 关闭不显示错误
- [ ] 自动重连成功
- [ ] `consecutiveAuthFailures` 保持为 0

---

### TC-13: getGatewayLicenseState() pending 状态返回（P2，CN 版本）

**前提**: ClawdbotCN 版本

**步骤**:
1. 启动 Gateway
2. 在 license 验证完成前，通过 WebSocket 调用 `license.status`

**预期结果**:
- [ ] 返回 `{ checking: true, valid: false, error: "授权验证中，请稍候..." }`
- [ ] 验证完成后返回实际的 license 状态

---

## 回归测试

- [ ] 聊天功能正常发送/接收
- [ ] 定时任务 (cron) 正常运行
- [ ] 多渠道连接正常（WeChat/Telegram/etc）
- [ ] 配置修改保存正常
- [ ] 设备配对正常
- [ ] 技能安装/卸载正常

---

## 签核

| 角色 | 签名 | 日期 |
|------|------|------|
| 开发 | | 2025-02-08 |
| 测试 | | 2025-02-08 |
| 安全 | | 2025-02-08 |

---

## 备注

- 18 个预存测试失败（matrix/telegram/docker/region-cn/security-build），与本次修改无关
- Bug #5 (P3 protected function 注册延迟) 已确认可接受，不影响功能
