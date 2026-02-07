# Clawdbot 加密保护模块运维手册

> 版本：2026.1.25+
> 更新日期：2026-02-03
> 编写人：运维团队

---

## 一、概述

### 1.1 模块说明

本次升级引入了以下安全保护机制：

| 模块 | 功能 | 影响范围 |
|------|------|----------|
| RSA 签名验证 | 验证服务端响应真实性 | 授权验证、心跳 |
| DEV 模式编译时控制 | 防止通过环境变量绕过授权 | 生产构建 |
| 离线宽限期缩短 | 72h → 24h | 离线用户 |
| 反调试检测 | 检测调试环境并退出 | 生产环境 |
| 文件完整性校验 | 检测代码篡改 | 关键文件 |

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Gateway 启动流程                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   checkLicenseOnGatewayStart()                              │
│   ├── 1. checkIntegrityOnStartup()    文件完整性校验        │
│   │       └── 读取 integrity-hashes.json                    │
│   │       └── 对比 19 个关键文件的 SHA-256                  │
│   │                                                         │
│   ├── 2. verifyLicenseOnStartup()     授权验证              │
│   │       └── 发送 /verify 请求                             │
│   │       └── RSA 签名验证                                  │
│   │       └── 启动心跳服务（24h 间隔）                      │
│   │                                                         │
│   └── 3. startAntiDebug()             反调试检测            │
│           └── 每 30 秒检测一次                              │
│           └── 检测到调试器则退出                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     Gateway 关闭流程                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   createGatewayCloseHandler()                               │
│   ├── stopLicenseServices()           停止心跳              │
│   └── stopSecurityServices()          停止反调试            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、构建指南

### 2.1 构建命令

| 环境 | 命令 | 说明 |
|------|------|------|
| 开发 | `pnpm build` | DEV 模式可用 |
| **生产** | `pnpm build:prod` | **必须使用！** |
| **Windows 打包** | `.\scripts\windows\build-windows.ps1` | 自动调用 build:prod |

### 2.2 生产构建流程

```bash
# 生产构建（必须使用此命令）
pnpm build:prod
```

`build:prod` 执行以下步骤：

1. **TypeScript 编译** (`tsc`)
2. **DEV 模式禁用** (`scripts/replace-dev-flag.ts`)
   - 将 `__DEV_BUILD__` 替换为 `false`
   - 影响文件：`dist/license/startup.js`, `dist/security/anti-debug.js`
3. **完整性哈希生成** (`scripts/generate-integrity-hashes.ts`)
   - 扫描 `dist/license/` 和 `dist/security/` 目录
   - 输出：`dist/security/integrity-hashes.json`

### 2.3 构建验证清单

```bash
# 1. 检查 DEV 模式是否已禁用
Select-String -Path "dist\license\startup.js" -Pattern "if \(!false\)"
# 应该看到 "if (!false)" 表示已替换

# 2. 检查 RSA 验证是否启用
Select-String -Path "dist\license\types.js" -Pattern "enableRsaVerify"
# 应该看到 "enableRsaVerify: true"

# 3. 检查完整性哈希是否生成
Test-Path "dist\security\integrity-hashes.json"
# 应该返回 True

# 4. 检查哈希文件内容
Get-Content "dist\security\integrity-hashes.json" | ConvertFrom-Json | Measure-Object
# 应该显示 19 个文件
```

### 2.4 ⚠️ 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 使用 `pnpm build` 发布 | DEV 模式未禁用 | 使用 `pnpm build:prod` |
| 手动修改 dist 文件 | 完整性校验失败 | 重新执行 `pnpm build:prod` |
| 缺少 integrity-hashes.json | 构建不完整 | 重新执行 `pnpm build:prod` |

---

## 三、配置说明

### 3.1 关键配置项

文件：`src/license/types.ts`

```typescript
export const DEFAULT_LICENSE_CONFIG: LicenseModuleConfig = {
  apiBaseUrl: "https://www.tecbinai.com/api/api/v1/license",
  signSecretKey: "...",                    // HMAC 签名密钥（旧）
  offlineGracePeriodHours: 24,             // 离线宽限期（小时）
  heartbeatIntervalHours: 24,              // 心跳间隔（小时）
  enableSign: true,                        // 启用请求签名
  devMode: false,                          // DEV 模式（运行时设置）
  enableRsaVerify: true,                   // 启用 RSA 响应验证
};
```

### 3.2 环境变量

| 变量 | 作用 | 生产环境 |
|------|------|----------|
| `CLAWDBOT_CN=1` | 启用 CN 版本授权检查 | 需要设置 |
| `CLAWDBOT_REGION=cn` | 同上 | 需要设置 |
| `CLAWDBOT_DEV=1` | DEV 模式（仅开发构建有效） | **无效** |
| `CLAWDBOT_LICENSE_DEV=1` | DEV 模式（仅开发构建有效） | **无效** |
| `NODE_ENV=development` | DEV 模式（仅开发构建有效） | **无效** |

### 3.3 RSA 公钥

位置：`src/license/rsa-verify.ts`

```
公钥指纹：kDtHShdtjfCopovpCcIR
算法：RSA 2048-bit
签名算法：SHA256withRSA
```

**更新公钥流程**：
1. 服务端生成新密钥对
2. 更新 `src/license/rsa-verify.ts` 中的 `RSA_PUBLIC_KEY`
3. 重新构建并发布客户端
4. 服务端切换到新私钥

---

## 四、服务端依赖

### 4.1 必需接口

| 接口 | 方法 | 新增字段 | 状态 |
|------|------|----------|------|
| `/api/v1/license/verify` | POST | `signature` | 必需 |
| `/api/v1/license/heartbeat` | POST | `signature` | 必需 |

### 4.2 签名格式

#### /verify 接口

```
签名内容 = "valid|tier|expiresAt|serverTime"

示例：
- 成功：true|basic|2027-01-29T16:14:43Z|1706947200000
- 失败：false|||1706947200000
```

#### /heartbeat 接口

```
签名内容 = "valid|daysRemaining|serverTime"

示例：true|365|1706947200000
```

### 4.3 服务端检查清单

```bash
# 测试 /verify 接口
curl -X POST https://www.tecbinai.com/api/api/v1/license/verify \
  -H "Content-Type: application/json" \
  -d '{"key":"TEST-KEY","deviceId":"test-device"}'

# 检查响应是否包含 signature 字段
# 预期响应：
# {
#   "code": 200,
#   "data": {
#     "valid": true,
#     "serverTime": 1706947200000,
#     "signature": "Base64EncodedSignature...",
#     ...
#   }
# }
```

---

## 五、故障排查

### 5.1 常见错误及解决

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `服务端响应缺少签名` | 服务端未返回 signature | 联系服务端确认 RSA 签名已部署 |
| `RSA 签名验证失败` | 签名不匹配 | 检查公钥是否与服务端私钥配对 |
| `服务器时间偏差过大` | 时间差 > 5 分钟 | 同步客户端/服务端时间 |
| `检测到调试环境，程序退出` | 使用了 --inspect 等参数 | 生产环境禁止调试 |
| `Integrity check failed` | 文件被篡改 | 重新构建或检查文件 |
| `验证服务连接失败` | 网络问题 | 检查网络连接 |
| `未找到授权码` | 配置缺失 | 检查 license.key 配置 |

### 5.2 日志关键字

```bash
# 授权验证成功
grep "License check passed" /var/log/clawdbot.log

# RSA 验证
grep "RSA signature verification" /var/log/clawdbot.log

# 反调试
grep "security:anti-debug" /var/log/clawdbot.log

# 完整性校验
grep "security:integrity" /var/log/clawdbot.log

# 心跳
grep "license:heartbeat" /var/log/clawdbot.log
```

### 5.3 调试模式（仅限开发环境）

```bash
# 开发环境启用 DEV 模式
# 注意：生产构建中此方法无效！
export CLAWDBOT_LICENSE_DEV=1
pnpm dev
```

---

## 六、监控指标

### 6.1 建议监控项

| 指标 | 阈值 | 告警级别 |
|------|------|----------|
| 授权验证失败率 | > 1% | 严重 |
| 心跳失败次数 | 连续 3 次 | 警告 |
| RSA 验证失败 | 任何 | 严重 |
| 完整性校验失败 | 任何 | 警告 |
| 反调试触发 | 任何 | 信息 |

### 6.2 健康检查

```bash
# Gateway 健康检查
curl http://localhost:18789/health

# 授权状态检查（通过 Gateway API）
# 需要 WebSocket 连接
```

---

## 七、回滚方案

### 7.1 紧急回滚

如果新版本出现严重问题：

1. **回滚到旧版本构建产物**
2. **服务端临时方案**（如果是签名问题）：
   - 返回空 signature 字段
   - 客户端会因 "缺少签名" 失败
   - 需要同时回滚客户端

### 7.2 配置回滚

如果需要临时禁用 RSA 验证（不推荐）：

```typescript
// src/license/types.ts
enableRsaVerify: false,  // 临时禁用
```

然后重新构建发布。

---

## 八、安全注意事项

### 8.1 禁止操作

| 操作 | 原因 |
|------|------|
| 手动修改 dist 目录文件 | 完整性校验失败 |
| 生产环境使用 --inspect | 会被反调试检测 |
| 使用 `pnpm build` 发布生产 | DEV 模式未禁用 |
| 泄露 HMAC 签名密钥 | 请求可被伪造 |
| 泄露 RSA 私钥 | 响应可被伪造 |

### 8.2 密钥管理

| 密钥 | 位置 | 访问权限 |
|------|------|----------|
| RSA 公钥 | 客户端代码 | 公开 |
| RSA 私钥 | 服务端环境变量 | 仅服务端 |
| HMAC 密钥 | 客户端代码 + 服务端 | 已知风险，依赖 RSA 加强 |

---

## 九、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 2026.1.25 | 2026-02-03 | RSA 签名验证、DEV 模式控制、反调试、完整性校验 |

---

## 十、联系方式

| 角色 | 职责 |
|------|------|
| 服务端负责人 | RSA 签名接口、时间同步 |
| 客户端负责人 | 授权验证模块、构建流程 |
| 运维负责人 | 部署、监控、故障处理 |

---

**文档维护**：如有变更请及时更新本手册。
