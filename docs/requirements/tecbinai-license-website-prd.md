# TecbinAI 授权管理系统 - 产品需求文档

> 文档版本：v1.0
> 创建时间：2026-02-03
> 关联项目：OpenClawCN 授权验证系统
> 优先级：P0（核心功能）

---

## 一、文档概述

### 1.1 背景

OpenClawCN 客户端已实现完整的授权验证系统，需要 tecbinai.com 网站配套提供：
- 用户购买/续费授权码的页面
- 授权码管理功能（设备解绑等）
- 后端 API 接口支持客户端验证

### 1.2 目标

1. 用户能够便捷购买和续费 OpenClawCN 授权
2. 用户能够管理已绑定的设备
3. 提供稳定可靠的 API 支持客户端验证
4. 支持服务端动态控制续费链接、通知等

### 1.3 相关系统

| 系统 | 说明 |
|------|------|
| OpenClawCN 客户端 | 已实现授权验证逻辑，代码位于 `src/license/` |
| 现有 API | `https://www.tecbinai.com/api/api/v1/license/*` |
| 技能仓库 | `https://gitee.com/tecbinai/skills` |

---

## 二、页面需求

### 2.1 购买页面 `/purchase`

#### 页面入口

客户端代码中硬编码跳转地址：
```typescript
// ui/src/ui/license/license-dialogs.ts
<a href="https://www.tecbinai.com/purchase" target="_blank">立即购买</a>
```

#### 页面功能

**2.1.1 产品展示**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    OpenClawCN 授权购买                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐   ┌─────────────────┐                    │
│   │   基础版        │   │   专业版         │                    │
│   │   Basic         │   │   Professional   │                    │
│   ├─────────────────┤   ├─────────────────┤                    │
│   │                 │   │                 │                    │
│   │  ¥XXX/年       │   │  ¥XXX/年        │                    │
│   │                 │   │                 │                    │
│   │  ✓ 基础对话     │   │  ✓ 全部基础功能  │                    │
│   │  ✓ 基础技能     │   │  ✓ 高级技能      │                    │
│   │  ✓ 2台设备      │   │  ✓ 5台设备       │                    │
│   │  ✓ 7天历史记录  │   │  ✓ 30天历史记录  │                    │
│   │  ✓ 24h离线使用  │   │  ✓ 72h离线使用   │                    │
│   │                 │   │                 │                    │
│   │  [立即购买]     │   │  [立即购买]      │                    │
│   │                 │   │                 │                    │
│   └─────────────────┘   └─────────────────┘                    │
│                                                                 │
│                   企业版请联系客服                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**2.1.2 产品规格配置**

| 字段 | 基础版 (Basic) | 专业版 (Professional) | 企业版 (Enterprise) |
|------|---------------|----------------------|---------------------|
| `tier` | `basic` | `professional` | `enterprise` |
| `tierName` | 基础版 | 专业版 | 企业版 |
| `deviceLimit` | 2 | 5 | 不限 |
| `features` | `basic_chat`, `basic_skills`, `history_7days` | 基础版全部 + `advanced_skills`, `history_30days`, `priority_support` | 全部功能 |
| `offlineGracePeriodHours` | 24 | 72 | 168 (7天) |
| 价格 | 由运营定价 | 由运营定价 | 定制 |

**2.1.3 购买流程**

```
用户选择套餐
     │
     ▼
填写信息（手机号/邮箱）
     │
     ▼
选择支付方式（微信/支付宝）
     │
     ▼
完成支付
     │
     ▼
生成授权码并展示
     │
     ▼
发送授权码到手机/邮箱
     │
     ▼
引导用户在客户端激活
```

**2.1.4 授权码展示页**

购买成功后展示：

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    🎉 购买成功！                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   您的授权码：                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │     clawd-xxxx-xxxx-xxxx-xxxx                          │   │
│   │                                                         │   │
│   │                              [复制授权码]               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   套餐：基础版                                                   │
│   有效期：2026-02-03 至 2027-02-03                              │
│   设备数：最多 2 台                                              │
│                                                                 │
│   ─────────────────────────────────────────────────────────     │
│                                                                 │
│   📱 如何激活？                                                  │
│                                                                 │
│   1. 打开 OpenClawCN 应用                                       │
│   2. 在激活弹窗中输入上方授权码                                  │
│   3. 点击"激活"按钮                                             │
│                                                                 │
│   📧 授权码已发送至您的邮箱/手机                                 │
│                                                                 │
│   [前往管理中心]                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**2.1.5 必要字段**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 手机号 | string | 是 | 用于接收授权码和找回 |
| 邮箱 | string | 否 | 备用联系方式 |
| 套餐类型 | enum | 是 | basic / professional |
| 支付方式 | enum | 是 | wechat / alipay |

---

### 2.2 续费页面 `/renew`

#### 页面入口

客户端通过服务端返回的 `renewUrl` 跳转：
```typescript
// 服务端响应中返回
{
  "renewalReminder": {
    "renewUrl": "https://www.tecbinai.com/renew?key=clawd-xxx",
    "daysRemaining": 7,
    "urgency": "warning"
  }
}
```

#### 页面功能

**2.2.1 URL 参数**

| 参数 | 说明 | 示例 |
|------|------|------|
| `key` | 授权码（可选，用于预填） | `clawd-xxxx-xxxx` |
| `uid` | 用户ID（可选） | `12345` |

**2.2.2 续费流程**

```
URL携带授权码 → 自动识别用户和套餐信息
       │
       ▼
展示当前套餐信息和过期时间
       │
       ▼
选择续费时长（1年/2年/3年）
       │
       ▼
（可选）升级套餐
       │
       ▼
完成支付
       │
       ▼
自动延长有效期（无需重新激活）
```

**2.2.3 页面布局**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    续费您的 OpenClawCN                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   当前授权信息                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ 授权码：clawd-xxxx-xxxx-xxxx                           │   │
│   │ 套餐：基础版                                            │   │
│   │ 状态：⚠️ 即将过期                                       │   │
│   │ 到期时间：2026-02-10（剩余 7 天）                       │   │
│   │ 已绑定设备：2 / 2 台                                    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   选择续费方案                                                   │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐        │
│   │   续费1年     │ │   续费2年     │ │   续费3年     │        │
│   │   ¥XXX       │ │   ¥XXX       │ │   ¥XXX       │        │
│   │              │ │   省 ¥XX     │ │   省 ¥XX     │        │
│   └───────────────┘ └───────────────┘ └───────────────┘        │
│                                                                 │
│   💡 升级到专业版可享更多功能                                    │
│                                                                 │
│   [立即续费]                                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**2.2.4 特殊情况处理**

| 情况 | 处理方式 |
|------|---------|
| 授权码已过期 | 允许续费，支付后立即生效 |
| 授权码不存在 | 提示错误，引导去购买页 |
| URL无授权码参数 | 提供输入框让用户手动输入 |

---

### 2.3 授权管理中心 `/account/licenses`

#### 页面功能

用户登录后可管理自己的所有授权码。

**2.3.1 授权列表**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   我的授权                                            [购买新授权] │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ clawd-xxxx-xxxx-xxxx                                    │   │
│   │ ────────────────────────────────────────────────────── │   │
│   │ 套餐：基础版          状态：✅ 正常                      │   │
│   │ 有效期：2026-02-03 至 2027-02-03                        │   │
│   │ 设备：2 / 2 台                                          │   │
│   │                                                         │   │
│   │ [查看详情]  [续费]  [管理设备]                           │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ clawd-yyyy-yyyy-yyyy                                    │   │
│   │ ────────────────────────────────────────────────────── │   │
│   │ 套餐：专业版          状态：⚠️ 即将过期（7天）           │   │
│   │ 有效期：2025-02-03 至 2026-02-10                        │   │
│   │ 设备：3 / 5 台                                          │   │
│   │                                                         │   │
│   │ [查看详情]  [续费]  [管理设备]                           │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**2.3.2 设备管理页**

点击"管理设备"进入：

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ← 返回     设备管理 - clawd-xxxx-xxxx                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   已绑定设备（2 / 2）                                            │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ 💻 DESKTOP-ABC123                                       │   │
│   │ ────────────────────────────────────────────────────── │   │
│   │ 设备ID：a1b2c3d4e5f6...                                 │   │
│   │ 系统：Windows 11 x64                                    │   │
│   │ 最后活跃：2026-02-03 14:30                              │   │
│   │ 状态：🟢 当前设备                                        │   │
│   │                                                         │   │
│   │                                              [无法解绑] │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ 💻 MacBook-Pro                                          │   │
│   │ ────────────────────────────────────────────────────── │   │
│   │ 设备ID：x7y8z9w0v1u2...                                 │   │
│   │ 系统：macOS 14.0 arm64                                  │   │
│   │ 最后活跃：2026-01-28 09:15                              │   │
│   │ 状态：⚪ 离线                                            │   │
│   │                                                         │   │
│   │                                              [解绑设备] │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ⚠️ 提示：解绑后该设备需要重新激活才能使用                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**2.3.3 设备数据字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| `deviceId` | string | 设备唯一标识（SHA256哈希） |
| `deviceName` | string | 设备名称（主机名） |
| `osInfo` | string | 操作系统信息 |
| `lastActiveAt` | ISO8601 | 最后活跃时间 |
| `isCurrent` | boolean | 是否为当前请求的设备 |
| `firstBoundAt` | ISO8601 | 首次绑定时间 |

---

### 2.4 找回授权码页面 `/recover`

用户忘记授权码时使用。

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    找回授权码                                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   请输入购买时使用的手机号或邮箱：                                 │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   [获取验证码]                                                   │
│                                                                 │
│   验证码：                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   [找回授权码]                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、API 接口需求

### 3.1 接口基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `https://www.tecbinai.com/api/api/v1/license` |
| 协议 | HTTPS（必须） |
| 格式 | JSON |
| 字符编码 | UTF-8 |

### 3.2 接口列表

#### 3.2.1 验证授权码 `POST /verify`

**客户端调用时机**：启动时、手动刷新时

**请求参数**：

```typescript
interface LicenseVerifyRequest {
  key: string;                    // 授权码
  deviceId: string;               // 设备ID（SHA256哈希，32位）
  deviceName?: string;            // 设备名称
  appVersion?: string;            // 应用版本
  osInfo?: string;                // 操作系统信息
  shownNotificationIds?: number[]; // 已展示的通知ID列表
  
  // 签名参数（用于防重放攻击）
  timestamp?: number;             // 毫秒时间戳
  nonce?: string;                 // 16位随机字符串
  sign?: string;                  // HMAC-SHA256签名
}
```

**响应数据**：

```typescript
interface LicenseVerifyResponse {
  code: 200;
  message: "success";
  data: {
    valid: boolean;                    // 是否有效
    errorCode: LicenseErrorCode | null; // 错误码
    errorMessage: string | null;        // 错误消息
    serverTime: number;                 // 服务器时间（毫秒）
    nextCheckAfterHours?: number;       // 下次检查间隔（小时）
    
    // 授权信息（验证成功时）
    license: {
      tier: "basic" | "test" | "professional" | "enterprise";
      tierName: string;
      expiresAt: string;               // ISO 8601
      daysRemaining: number;
      keyType: "test" | "trial" | "standard";
      features: string[];              // 功能列表
    } | null;
    
    // 设备信息
    device: {
      deviceId: string;
      deviceLimit: number;             // 设备上限
      boundDevices: number;            // 已绑定数量
      isCurrentBound: boolean;         // 当前设备是否已绑定
    } | null;
    
    // 通知列表
    notifications: LicenseNotification[] | null;
    
    // 续费提醒（重要！）
    renewalReminder: {
      show: boolean;
      urgency: "info" | "warning" | "critical";
      title: string | null;
      message: string | null;
      renewUrl: string | null;         // 续费链接，如 /renew?key=xxx
      daysRemaining: number;
    } | null;
    
    // 强制更新（可选）
    forceUpdate: {
      required: boolean;
      blocking: boolean;
      minVersion: string;
      latestVersion: string;
      downloadUrl: string;
      updateMessage: string;
    } | null;
  };
}
```

**错误码定义**：

```typescript
enum LicenseErrorCode {
  ERROR_KEY_NOT_FOUND = 1001,      // 授权码不存在
  ERROR_KEY_EXPIRED = 1002,        // 授权已过期
  ERROR_KEY_REVOKED = 1003,        // 授权已撤销
  ERROR_DEVICE_LIMIT = 1004,       // 设备数超限
  ERROR_KEY_BINDBY_OTHER = 1005,   // 已被他人使用
  ERROR_INVALID_SIGN = 1006,       // 签名验证失败
  ERROR_TIMESTAMP_EXPIRED = 1007,  // 时间戳过期（请检查系统时间）
  ERROR_KEY_EXHAUSTED = 1008,      // 使用次数用尽
}
```

**签名验证逻辑**（服务端实现）：

```typescript
// 服务端验证签名
function verifyRequestSign(request: LicenseVerifyRequest): boolean {
  const { key, deviceId, timestamp, nonce, sign } = request;
  
  // 1. 检查时间戳（允许 ±5 分钟）
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    return false; // 时间戳过期
  }
  
  // 2. 验证签名
  const data = `${key}|${deviceId}|${timestamp}|${nonce}`;
  const expectedSign = crypto
    .createHmac('sha256', SIGN_SECRET_KEY)
    .update(data)
    .digest('hex');
  
  return sign === expectedSign;
}
```

---

#### 3.2.2 心跳检测 `POST /heartbeat`

**客户端调用时机**：每24小时一次

**请求参数**：

```typescript
interface LicenseHeartbeatRequest {
  key: string;
  deviceId: string;
}
```

**响应数据**：

```typescript
interface LicenseHeartbeatResponse {
  code: 200;
  data: {
    valid: boolean;
    daysRemaining: number;
    serverTime: number;
  };
}
```

---

#### 3.2.3 获取设备列表 `GET /devices`

**请求参数**（Query）：

```
?key=clawd-xxxx&deviceId=a1b2c3d4
```

**响应数据**：

```typescript
interface DeviceListResponse {
  code: 200;
  data: {
    devices: Array<{
      deviceId: string;
      deviceName: string;
      osInfo: string;
      lastActiveAt: string;      // ISO 8601
      firstBoundAt: string;       // ISO 8601
      isCurrent: boolean;
    }>;
    deviceLimit: number;
  };
}
```

---

#### 3.2.4 解绑设备 `POST /devices/unbind`

**请求参数**：

```typescript
interface UnbindDeviceRequest {
  key: string;
  deviceId: string;              // 要解绑的设备ID
}
```

**响应数据**：

```typescript
interface UnbindDeviceResponse {
  code: 200;
  message: "success";
}
```

**业务规则**：
- 不能解绑当前设备（`isCurrent: true`）
- 解绑后该设备需要重新激活

---

#### 3.2.5 确认通知 `POST /notification/ack`

**请求参数**：

```typescript
interface NotificationAckRequest {
  key: string;
  deviceId: string;
  notificationId: number;
  action: "clicked" | "dismissed" | "closed";
}
```

---

#### 3.2.6 激活授权码 `POST /activate`

**请求参数**：

```typescript
interface LicenseActivateRequest {
  key: string;
  deviceId: string;
  deviceName?: string;
  appVersion?: string;
  osInfo?: string;
}
```

**响应数据**：与 `/verify` 相同

**业务规则**：
- 首次激活自动绑定设备
- 设备数超限返回 `ERROR_DEVICE_LIMIT`

---

#### 3.2.7 健康检查 `GET /health`

**响应数据**：

```typescript
interface HealthCheckResponse {
  code: 200;
  data: {
    status: "ok" | "error";
    timestamp: number;
    version: string;
  };
}
```

---

### 3.3 通知系统

服务端可通过 `notifications` 字段向客户端推送通知。

**通知数据结构**：

```typescript
interface LicenseNotification {
  id: number;                      // 唯一ID
  type: "info" | "warning" | "promo" | "update";
  priority: number;                // 数字越大越优先
  title: string;
  content: string;
  showOnce: boolean;               // 是否只展示一次
  validUntil?: string;             // 有效期（ISO 8601）
  action?: {
    type: "url" | "dismiss";
    text: string;                  // 按钮文字
    url?: string;                  // 跳转链接
  };
}
```

**通知用途示例**：
- 促销活动（续费优惠）
- 版本更新提醒
- 功能公告
- 维护通知

---

## 四、续费提醒策略

### 4.1 提醒规则

服务端根据剩余天数返回不同的 `renewalReminder`：

| 剩余天数 | urgency | show | 行为 |
|---------|---------|------|------|
| > 30 | - | false | 不提醒 |
| 15-30 | `info` | true | 轻提示 |
| 7-14 | `warning` | true | 中提示 |
| 1-7 | `critical` | true | 强提示 |
| ≤ 0 | `critical` | true | 已过期 |

### 4.2 续费链接生成

```
renewUrl = "https://www.tecbinai.com/renew?key={授权码}"
```

可附加营销参数：
```
renewUrl = "https://www.tecbinai.com/renew?key={授权码}&promo=spring2026&discount=20"
```

---

## 五、安全要求

### 5.1 请求签名验证

1. 验证 `timestamp` 在 ±5 分钟内
2. 验证 `sign` 是否正确
3. 记录 `nonce` 防止重放攻击

### 5.2 时间戳校验

如果客户端时间与服务器时间偏差超过 5 分钟，返回 `ERROR_TIMESTAMP_EXPIRED (1007)`。

客户端收到此错误后会提示用户检查系统时间。

### 5.3 HTTPS

所有接口必须使用 HTTPS。

### 5.4 敏感信息保护

- 授权码在传输和存储时注意保护
- 设备ID是哈希值，不包含原始信息

---

## 六、运营支持功能

### 6.1 后台管理需求

| 功能 | 说明 |
|------|------|
| 授权码管理 | 查看、创建、撤销、续期 |
| 用户管理 | 查看用户、关联授权码 |
| 设备管理 | 查看设备、强制解绑 |
| 通知管理 | 创建、编辑、定时发布通知 |
| 数据统计 | 活跃用户、续费率、设备分布 |

### 6.2 运营工具

| 功能 | 说明 |
|------|------|
| 批量生成授权码 | 活动、渠道分发 |
| 优惠码 | 折扣、延长有效期 |
| 黑名单 | 撤销滥用授权 |

---

## 七、优先级排期

### P0 - 必须上线（阻塞客户端发布）

1. ✅ `/verify` 接口
2. ✅ `/heartbeat` 接口
3. ✅ `/activate` 接口
4. 🔲 `/purchase` 购买页面
5. 🔲 `/renew` 续费页面

### P1 - 发布后尽快完成

6. 🔲 `/devices` 接口
7. 🔲 `/devices/unbind` 接口
8. 🔲 `/account/licenses` 管理中心

### P2 - 后续迭代

9. 🔲 `/recover` 找回授权码
10. 🔲 通知管理后台
11. 🔲 数据统计后台

---

## 八、FAQ

### Q1: 授权码格式是什么？

```
clawd-xxxx-xxxx-xxxx-xxxx
```
- 前缀 `clawd-`
- 4组随机字符，每组4位
- 全部小写

### Q2: 设备ID如何生成？

客户端基于以下信息生成 SHA256 哈希：
- MAC地址
- 机器ID（Windows UUID / Linux machine-id / macOS IOPlatformUUID）
- 主机名
- 平台架构

### Q3: 用户更换设备怎么办？

用户可以在管理中心解绑旧设备，然后在新设备上重新激活。

### Q4: 服务器宕机时客户端怎么办？

客户端支持离线模式：
- 基础版：24小时离线使用
- 专业版：72小时离线使用
- 企业版：7天离线使用

超过宽限期后必须联网验证。

---

> 文档结束
> 
> 如有疑问请联系：[待填写联系方式]
