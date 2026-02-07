# PRD-05: 授权系统模块 (src/license/)

## 1. 模块概述

授权系统负责 Clawdbot 中国版 (ClawdbotCN) 的许可证管理，包括在线验证、设备绑定、心跳保活、离线模式和通知管理。

## 2. 功能需求

### 2.1 授权验证 (verify.ts)

**在线验证流程**:
1. 构建验证请求（含设备信息、签名）
2. 发送 POST 请求到 `/verify` 端点
3. RSA 签名验证（可选）
4. 返回验证结果（有效性、层级、到期时间）

**带重试验证** (`verifyLicenseWithRetry`):
- 最多 3 次重试
- 指数退避（1s, 2s, 4s）
- 最后一次失败后抛出异常

**开发模式**:
- 跳过所有验证
- 返回模拟的有效响应
- 365 天有效期

**请求签名**:
- HMAC 签名机制
- 时间戳 + 随机数 + 密钥
- 防止请求伪造

### 2.2 设备管理 (device-id.ts)

**设备指纹生成**:
- 多因素指纹：BIOS UUID + MAC 地址 + CPU ID
- 跨平台支持：
  - Windows: PowerShell/WMIC 命令
  - Linux: `/etc/machine-id`
  - macOS: `ioreg` 命令
- 虚拟网络过滤（排除虚拟 MAC 地址）
- 32位 hex 字符串输出

**设备 ID 同步**:
- 多配置目录同步
- 迁移处理
- 设备名称与 OS 信息获取

**设备操作**:
- 获取绑定设备列表
- 解绑设备（含冷却时间）
- 设备切换（单设备模式）

### 2.3 心跳保活 (heartbeat.ts)

**心跳机制**:
- 定期发送心跳到服务器
- 连续失败追踪
- 本地缓存更新
- RSA 签名验证

**失败处理**:
- 连续 3 次失败后记录警告
- 不立即吊销授权
- 依赖离线缓存机制

### 2.4 离线模式 (offline.ts)

**离线支持**:
- 24 小时宽限期
- 本地缓存验证
- 缓存过期检查
- 在线验证失败时回退

**缓存数据**:
```typescript
LicenseCache {
  key: string           // 授权码
  valid: boolean        // 有效性
  verifyTime: number    // 验证时间戳
  expiresAt: string     // 过期时间
  tier: string          // 层级
  features: string[]    // 功能列表
  deviceId: string      // 设备 ID
  nextCheckAfterHours: number  // 下次检查间隔
}
```

### 2.5 通知管理 (notifications.ts)

- 通知去重（`showOnce` 标记）
- 有效期过滤（`validUntil`）
- 优先级排序
- 已读确认

### 2.6 启动初始化 (startup.ts)

- 授权状态初始化
- Token 自动刷新启动
- 心跳定时器启动
- 缓存加载与验证

### 2.7 RSA 签名验证 (sign.ts, rsa-verify.ts)

**请求签名**:
- HMAC-SHA256 签名生成
- 时间戳 + 随机数参数
- 密钥配置管理

**响应签名验证**:
- RSA 公钥验证
- 固定字段顺序签名
- 验证结果包含详细错误信息

## 3. 授权层级

| 层级 | 说明 | 功能 |
|------|------|------|
| basic | 基础版 | 基础聊天、7天历史、基础技能 |
| pro | 专业版 | 全部功能、无限历史 |
| enterprise | 企业版 | 多设备、API 访问 |
| test | 测试版 | 开发模式 |

## 4. API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/verify` | POST | 授权码验证 |
| `/heartbeat` | POST | 心跳检查 |
| `/devices` | POST | 设备列表 |
| `/devices/unbind` | POST | 解绑设备 |
| `/devices/switch` | POST | 切换设备 |
| `/notification/ack` | POST | 通知确认 |
| `/health` | GET | 健康检查 |

## 5. 错误码系统

| 错误码 | 说明 |
|--------|------|
| ERROR_UNBIND_COOLDOWN | 解绑冷却中 |
| ERROR_DEVICE_SWITCH_COOLDOWN | 设备切换冷却中 |
| ERROR_DEVICE_LIMIT | 设备数量超限 |
| ERROR_KEY_EXPIRED | 授权码已过期 |
| ERROR_KEY_INVALID | 授权码无效 |

## 6. 非功能性需求

### 6.1 安全性
- RSA 签名验证防止响应篡改
- HMAC 请求签名防止请求伪造
- DNS IPv4 优先避免超时
- 30秒请求超时

### 6.2 可靠性
- 离线宽限期确保断网可用
- 指数退避重试
- 缓存机制降低服务器依赖

### 6.3 隐私
- 设备指纹仅用于设备识别
- 不收集个人信息
- 本地缓存加密存储
