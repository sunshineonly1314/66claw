# ClawdbotCN 授权系统 - 服务端对接需求

> 文档版本：v1.0
> 创建时间：2026-02-03
> 客户端版本：ClawdbotCN
> 优先级说明：P0=阻塞发布，P1=发布后尽快，P2=后续迭代

---

## 一、概述

ClawdbotCN 客户端需要 tecbinai.com 服务端提供授权验证 API 和用户页面。本文档详细说明服务端需要实现的所有内容。

### 1.1 API 基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `https://www.tecbinai.com/api/api/v1/license` |
| 协议 | HTTPS（必须） |
| 请求格式 | JSON |
| 响应格式 | JSON |
| 字符编码 | UTF-8 |

### 1.2 通用响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

错误响应：
```json
{
  "code": 400,
  "message": "错误描述",
  "data": null
}
```

---

## 二、API 接口详细规范

### 2.1 验证授权码 `POST /verify` 【P0 必须】

客户端启动时调用，验证授权码是否有效。

#### 请求

```http
POST /api/api/v1/license/verify
Content-Type: application/json
```

```json
{
  "key": "clawd-xxxx-xxxx-xxxx-xxxx",
  "deviceId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "deviceName": "DESKTOP-ABC123",
  "appVersion": "2026.2.3",
  "osInfo": "Windows 11 x64",
  "shownNotificationIds": [1, 2, 3],
  
  "timestamp": 1706956800000,
  "nonce": "a1b2c3d4e5f6g7h8",
  "sign": "hmac_sha256_signature_hex"
}
```

#### 请求字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | string | 是 | 授权码，格式 `clawd-xxxx-xxxx-xxxx-xxxx` |
| `deviceId` | string | 是 | 设备唯一标识，SHA256哈希，32位十六进制 |
| `deviceName` | string | 否 | 设备名称（主机名） |
| `appVersion` | string | 否 | 客户端版本号 |
| `osInfo` | string | 否 | 操作系统信息，如 "Windows 11 x64" |
| `shownNotificationIds` | number[] | 否 | 已展示过的通知ID列表 |
| `timestamp` | number | 是 | 请求时间戳（毫秒） |
| `nonce` | string | 是 | 16位随机字符串 |
| `sign` | string | 是 | 请求签名（见签名算法） |

#### 请求签名算法（服务端需验证）

```
签名内容 = key + "|" + deviceId + "|" + timestamp + "|" + nonce
签名密钥 = "Cb#2026$Tecbinai@Lic3nse!Hmac^Key&Secure"
sign = HMAC-SHA256(签名内容, 签名密钥).toHex()
```

**服务端验证逻辑**：
```python
import hmac
import hashlib
import time

def verify_request_sign(key, device_id, timestamp, nonce, sign):
    # 1. 检查时间戳（允许 ±5 分钟）
    now = int(time.time() * 1000)
    if abs(now - timestamp) > 5 * 60 * 1000:
        return False, "ERROR_TIMESTAMP_EXPIRED"
    
    # 2. 验证签名
    sign_content = f"{key}|{device_id}|{timestamp}|{nonce}"
    secret_key = "Cb#2026$Tecbinai@Lic3nse!Hmac^Key&Secure"
    expected_sign = hmac.new(
        secret_key.encode('utf-8'),
        sign_content.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    if sign != expected_sign:
        return False, "ERROR_INVALID_SIGN"
    
    return True, None
```

#### 响应

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "valid": true,
    "errorCode": null,
    "errorMessage": null,
    "serverTime": 1706956800000,
    "nextCheckAfterHours": 24,
    
    "license": {
      "tier": "basic",
      "tierName": "基础版",
      "expiresAt": "2027-02-03T00:00:00.000Z",
      "daysRemaining": 365,
      "keyType": "standard",
      "features": ["basic_chat", "basic_skills", "history_7days"]
    },
    
    "device": {
      "deviceId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      "deviceLimit": 2,
      "boundDevices": 1,
      "isCurrentBound": true
    },
    
    "notifications": [
      {
        "id": 4,
        "type": "promo",
        "priority": 10,
        "title": "春节优惠",
        "content": "续费享8折优惠，截止2月15日",
        "showOnce": true,
        "validUntil": "2026-02-15T23:59:59.000Z",
        "action": {
          "type": "url",
          "text": "立即续费",
          "url": "https://www.tecbinai.com/renew?promo=spring2026"
        }
      }
    ],
    
    "renewalReminder": {
      "show": false,
      "urgency": null,
      "title": null,
      "message": null,
      "renewUrl": null,
      "daysRemaining": 365
    },
    
    "forceUpdate": null,
    
    "signature": "base64_rsa_signature_here"
  }
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `valid` | boolean | 授权是否有效 |
| `errorCode` | number\|null | 错误码（见错误码表） |
| `errorMessage` | string\|null | 错误消息（中文） |
| `serverTime` | number | 服务器当前时间戳（毫秒），**重要：用于客户端校验** |
| `nextCheckAfterHours` | number | 建议的下次检查间隔（小时），默认24 |
| `license` | object\|null | 授权信息（验证成功时返回） |
| `device` | object\|null | 设备信息 |
| `notifications` | array\|null | 待展示的通知列表 |
| `renewalReminder` | object\|null | 续费提醒 |
| `forceUpdate` | object\|null | 强制更新信息 |
| `signature` | string | **RSA签名（重要！见下文）** |

#### 错误码定义

| 错误码 | 常量名 | 说明 | 客户端行为 |
|--------|--------|------|-----------|
| 1001 | ERROR_KEY_NOT_FOUND | 授权码不存在 | 提示重新输入 |
| 1002 | ERROR_KEY_EXPIRED | 授权已过期 | 弹出过期弹窗，引导续费 |
| 1003 | ERROR_KEY_REVOKED | 授权已被撤销 | 提示联系客服 |
| 1004 | ERROR_DEVICE_LIMIT | 设备数超限 | 弹出设备管理弹窗 |
| 1005 | ERROR_KEY_BINDBY_OTHER | 授权码已被他人使用 | 提示联系客服 |
| 1006 | ERROR_INVALID_SIGN | 请求签名验证失败 | 提示检查客户端版本 |
| 1007 | ERROR_TIMESTAMP_EXPIRED | 时间戳过期 | **提示用户检查系统时间** |
| 1008 | ERROR_KEY_EXHAUSTED | 使用次数用尽 | 提示购买新授权 |

#### 验证失败响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "valid": false,
    "errorCode": 1002,
    "errorMessage": "授权已过期，请续费后继续使用",
    "serverTime": 1706956800000,
    "nextCheckAfterHours": 24,
    "license": null,
    "device": null,
    "notifications": null,
    "renewalReminder": {
      "show": true,
      "urgency": "critical",
      "title": "授权已过期",
      "message": "您的授权已过期 30 天，请续费后继续使用",
      "renewUrl": "https://www.tecbinai.com/renew?key=clawd-xxxx",
      "daysRemaining": -30
    },
    "forceUpdate": null,
    "signature": "base64_rsa_signature_here"
  }
}
```

---

### 2.2 心跳检测 `POST /heartbeat` 【P0 必须】

客户端每24小时调用一次，检查授权状态。

#### 请求

```http
POST /api/api/v1/license/heartbeat
Content-Type: application/json
```

```json
{
  "key": "clawd-xxxx-xxxx-xxxx-xxxx",
  "deviceId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

#### 响应

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "valid": true,
    "daysRemaining": 365,
    "serverTime": 1706956800000,
    "signature": "base64_rsa_signature_for_heartbeat"
  }
}
```

#### 心跳响应签名（RSA）

签名内容格式：`valid|daysRemaining|serverTime`

```
签名内容 = "true|365|1706956800000"
signature = RSA_SHA256_Sign(签名内容, 私钥).toBase64()
```

---

### 2.3 获取设备列表 `GET /devices` 【P1】

#### 请求

```http
GET /api/api/v1/license/devices?key=clawd-xxxx&deviceId=a1b2c3d4
```

#### 响应

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "devices": [
      {
        "deviceId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
        "deviceName": "DESKTOP-ABC123",
        "osInfo": "Windows 11 x64",
        "lastActiveAt": "2026-02-03T14:30:00.000Z",
        "firstBoundAt": "2026-01-01T10:00:00.000Z",
        "isCurrent": true
      },
      {
        "deviceId": "x7y8z9w0v1u2t3s4r5q6p7o8n9m0l1k2",
        "deviceName": "MacBook-Pro",
        "osInfo": "macOS 14.0 arm64",
        "lastActiveAt": "2026-01-28T09:15:00.000Z",
        "firstBoundAt": "2026-01-15T08:00:00.000Z",
        "isCurrent": false
      }
    ],
    "deviceLimit": 2
  }
}
```

---

### 2.4 解绑设备 `POST /devices/unbind` 【P1】

#### 请求

```http
POST /api/api/v1/license/devices/unbind
Content-Type: application/json
```

```json
{
  "key": "clawd-xxxx-xxxx-xxxx-xxxx",
  "deviceId": "x7y8z9w0v1u2t3s4r5q6p7o8n9m0l1k2"
}
```

#### 响应

```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

#### 业务规则

- 不能解绑当前设备（`isCurrent: true` 的设备）
- 解绑后该设备需要重新激活才能使用

---

### 2.5 确认通知 `POST /notification/ack` 【P2】

#### 请求

```json
{
  "key": "clawd-xxxx-xxxx-xxxx-xxxx",
  "deviceId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "notificationId": 4,
  "action": "clicked"
}
```

`action` 可选值：
- `clicked`：用户点击了操作按钮
- `dismissed`：用户关闭了通知
- `closed`：通知自动关闭

---

### 2.6 健康检查 `GET /health` 【P0】

#### 响应

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "status": "ok",
    "timestamp": 1706956800000,
    "version": "1.0.0"
  }
}
```

---

## 三、RSA 签名机制 【P0 重要！】

### 3.1 为什么需要 RSA 签名？

当前客户端使用 HMAC 签名验证请求，但 HMAC 密钥是硬编码在客户端代码中的，存在被提取的风险。

**RSA 签名的优势**：
- 公钥可以安全地硬编码在客户端
- 私钥只存在服务端，无法被提取
- 即使攻击者获取公钥，也无法伪造签名

### 3.2 服务端需要做什么

#### 步骤 1：生成 RSA 密钥对

```bash
# 生成 2048 位私钥
openssl genrsa -out license_private_key.pem 2048

# 从私钥导出公钥
openssl rsa -in license_private_key.pem -pubout -out license_public_key.pem
```

#### 步骤 2：保存私钥

将私钥保存到服务器环境变量：
```bash
export LICENSE_RSA_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEow...（私钥内容）...
-----END RSA PRIVATE KEY-----"
```

#### 步骤 3：把公钥给我

将 `license_public_key.pem` 的内容发给我，我会更新到客户端代码中：
- 文件位置：`src/license/rsa-verify.ts` 第31-39行

#### 步骤 4：在响应中添加签名

**验证接口 `/verify` 签名**：

```python
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_private_key

def sign_verify_response(valid, tier, expires_at, server_time, private_key_pem):
    """
    签名验证响应
    
    签名内容格式：valid|tier|expiresAt|serverTime
    示例："true|basic|2027-02-03T00:00:00.000Z|1706956800000"
    """
    # 构建签名内容
    sign_content = f"{str(valid).lower()}|{tier or ''}|{expires_at or ''}|{server_time}"
    
    # 加载私钥
    private_key = load_pem_private_key(private_key_pem.encode(), password=None)
    
    # RSA-SHA256 签名
    signature = private_key.sign(
        sign_content.encode('utf-8'),
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    
    # 返回 Base64 编码
    return base64.b64encode(signature).decode('utf-8')
```

**心跳接口 `/heartbeat` 签名**：

```python
def sign_heartbeat_response(valid, days_remaining, server_time, private_key_pem):
    """
    签名心跳响应
    
    签名内容格式：valid|daysRemaining|serverTime
    示例："true|365|1706956800000"
    """
    sign_content = f"{str(valid).lower()}|{days_remaining}|{server_time}"
    
    private_key = load_pem_private_key(private_key_pem.encode(), password=None)
    
    signature = private_key.sign(
        sign_content.encode('utf-8'),
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    
    return base64.b64encode(signature).decode('utf-8')
```

### 3.3 签名内容格式总结

| 接口 | 签名内容格式 | 示例 |
|------|------------|------|
| `/verify` | `valid\|tier\|expiresAt\|serverTime` | `true\|basic\|2027-02-03T00:00:00.000Z\|1706956800000` |
| `/heartbeat` | `valid\|daysRemaining\|serverTime` | `true\|365\|1706956800000` |

**注意**：
- `valid` 为布尔值，转为小写字符串 `"true"` 或 `"false"`
- `tier` 和 `expiresAt` 为空时使用空字符串 `""`
- `serverTime` 为毫秒时间戳
- 字段之间用 `|` 分隔

---

## 四、续费提醒策略

### 4.1 renewalReminder 字段逻辑

服务端根据剩余天数返回不同的 `renewalReminder`：

```python
def build_renewal_reminder(days_remaining, license_key):
    """
    构建续费提醒
    """
    if days_remaining > 30:
        return {
            "show": False,
            "urgency": None,
            "title": None,
            "message": None,
            "renewUrl": None,
            "daysRemaining": days_remaining
        }
    
    # 构建续费链接（可以加上营销参数）
    renew_url = f"https://www.tecbinai.com/renew?key={license_key}"
    
    if days_remaining <= 0:
        # 已过期
        return {
            "show": True,
            "urgency": "critical",
            "title": "授权已过期",
            "message": f"您的授权已过期 {abs(days_remaining)} 天，请续费后继续使用",
            "renewUrl": renew_url,
            "daysRemaining": days_remaining
        }
    elif days_remaining <= 7:
        # 7天内到期
        return {
            "show": True,
            "urgency": "critical",
            "title": "授权即将过期",
            "message": f"您的授权将在 {days_remaining} 天后过期，请及时续费",
            "renewUrl": renew_url,
            "daysRemaining": days_remaining
        }
    elif days_remaining <= 14:
        # 14天内到期
        return {
            "show": True,
            "urgency": "warning",
            "title": "授权即将过期",
            "message": f"您的授权将在 {days_remaining} 天后过期，建议提前续费",
            "renewUrl": renew_url,
            "daysRemaining": days_remaining
        }
    else:
        # 15-30天
        return {
            "show": True,
            "urgency": "info",
            "title": "续费提醒",
            "message": f"您的授权将在 {days_remaining} 天后过期",
            "renewUrl": renew_url,
            "daysRemaining": days_remaining
        }
```

### 4.2 urgency 等级说明

| urgency | 客户端行为 |
|---------|-----------|
| `info` | 轻提示，用户可忽略 |
| `warning` | 中等提示，建议处理 |
| `critical` | 强提示，弹窗提醒 |

---

## 五、通知系统

### 5.1 通知数据结构

```json
{
  "id": 4,
  "type": "promo",
  "priority": 10,
  "title": "春节优惠",
  "content": "续费享8折优惠，截止2月15日\n\n详情请访问官网查看",
  "showOnce": true,
  "validUntil": "2026-02-15T23:59:59.000Z",
  "action": {
    "type": "url",
    "text": "立即查看",
    "url": "https://www.tecbinai.com/promo/spring2026"
  }
}
```

### 5.2 通知类型

| type | 说明 | 用途 |
|------|------|------|
| `info` | 普通信息 | 功能公告 |
| `warning` | 警告信息 | 维护通知 |
| `promo` | 促销信息 | 优惠活动 |
| `update` | 更新信息 | 版本更新 |

### 5.3 通知过滤逻辑

服务端在返回通知时需要：

1. 过滤掉 `shownNotificationIds` 中已包含的通知（如果 `showOnce: true`）
2. 过滤掉已过期的通知（`validUntil < 当前时间`）
3. 按 `priority` 降序排列（数字大的优先）

---

## 六、页面需求

### 6.1 购买页面 `/purchase` 【P0】

客户端硬编码跳转地址：`https://www.tecbinai.com/purchase`

**页面功能**：
- 展示产品套餐（基础版/专业版/企业版）
- 支持微信/支付宝支付
- 购买成功后展示授权码
- 发送授权码到用户手机/邮箱

### 6.2 续费页面 `/renew` 【P0】

客户端通过 `renewalReminder.renewUrl` 跳转。

**URL 参数**：
- `key`：授权码（可选，用于预填）
- `promo`：促销码（可选）

**页面功能**：
- 根据 `key` 自动识别用户和套餐
- 展示当前套餐信息和到期时间
- 选择续费时长（1年/2年/3年）
- 可选升级套餐
- 支付完成后自动延长有效期

### 6.3 授权管理页面 `/account/licenses` 【P1】

**页面功能**：
- 用户登录后查看所有授权码
- 每个授权码显示：状态、到期时间、已绑定设备数
- 点击进入设备管理
- 续费入口

### 6.4 设备管理页面 【P1】

**页面功能**：
- 展示已绑定的设备列表
- 每个设备显示：名称、系统、最后活跃时间
- 支持解绑非当前设备

---

## 七、数据库设计建议

### 7.1 授权码表 `licenses`

```sql
CREATE TABLE licenses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    license_key VARCHAR(64) UNIQUE NOT NULL,      -- 授权码 clawd-xxxx-xxxx-xxxx-xxxx
    user_id BIGINT,                                -- 关联用户
    tier VARCHAR(32) NOT NULL DEFAULT 'basic',     -- 产品等级
    tier_name VARCHAR(64),                         -- 等级名称
    key_type VARCHAR(32) DEFAULT 'standard',       -- test/trial/standard
    features JSON,                                 -- 功能特性列表
    device_limit INT DEFAULT 2,                    -- 设备数上限
    expires_at DATETIME NOT NULL,                  -- 过期时间
    status VARCHAR(32) DEFAULT 'active',           -- active/expired/revoked
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 7.2 设备绑定表 `license_devices`

```sql
CREATE TABLE license_devices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    license_id BIGINT NOT NULL,
    device_id VARCHAR(64) NOT NULL,                -- 设备ID（SHA256哈希）
    device_name VARCHAR(128),                      -- 设备名称
    os_info VARCHAR(128),                          -- 操作系统信息
    app_version VARCHAR(32),                       -- 客户端版本
    first_bound_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_license_device (license_id, device_id),
    FOREIGN KEY (license_id) REFERENCES licenses(id)
);
```

### 7.3 通知表 `license_notifications`

```sql
CREATE TABLE license_notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(32) NOT NULL,                     -- info/warning/promo/update
    priority INT DEFAULT 0,
    title VARCHAR(256) NOT NULL,
    content TEXT NOT NULL,
    show_once BOOLEAN DEFAULT TRUE,
    valid_until DATETIME,
    action_type VARCHAR(32),                       -- url/dismiss
    action_text VARCHAR(64),
    action_url VARCHAR(512),
    target_tiers JSON,                             -- 目标用户等级，null表示所有
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

### 7.4 通知确认表 `license_notification_acks`

```sql
CREATE TABLE license_notification_acks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    notification_id BIGINT NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,                   -- clicked/dismissed/closed
    acked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_notification_device (notification_id, device_id)
);
```

---

## 八、时间戳防篡改

### 8.1 客户端可能篡改时间的攻击

用户可能通过修改系统时间来：
- 延长离线宽限期
- 绕过授权过期检查

### 8.2 服务端防护措施

1. **请求时间戳验证**：检查 `timestamp` 是否在 ±5 分钟内，超出返回 `ERROR_TIMESTAMP_EXPIRED (1007)`

2. **响应包含 serverTime**：客户端使用 `serverTime` 而非本地时间进行校验

3. **RSA 签名包含 serverTime**：签名内容包含 `serverTime`，防止篡改

---

## 九、错误处理

### 9.1 网络错误

客户端会自动重试 3 次，使用指数退避（1s, 2s, 4s）。

### 9.2 服务器错误

返回 HTTP 5xx 时，客户端会进入离线模式（如果有有效缓存）。

### 9.3 超时

客户端设置 30 秒超时，超时后重试或进入离线模式。

---

## 十、上线检查清单

### P0 - 阻塞发布

- [ ] `POST /verify` 接口正常工作
- [ ] `POST /heartbeat` 接口正常工作
- [ ] `GET /health` 接口正常工作
- [ ] RSA 密钥对已生成
- [ ] RSA 签名已添加到响应
- [ ] `/purchase` 页面可访问
- [ ] `/renew` 页面可访问
- [ ] 请求签名验证已实现
- [ ] 时间戳验证已实现（±5分钟）
- [ ] 错误码返回正确

### P1 - 发布后尽快

- [ ] `GET /devices` 接口
- [ ] `POST /devices/unbind` 接口
- [ ] `/account/licenses` 页面
- [ ] 设备管理页面

### P2 - 后续迭代

- [ ] `POST /notification/ack` 接口
- [ ] 通知管理后台
- [ ] 数据统计后台

---

## 十一、联系方式

如有疑问，请联系：
- 客户端开发：[待填写]
- 服务端开发：[待填写]

---

> 文档版本：v1.0
> 最后更新：2026-02-03
