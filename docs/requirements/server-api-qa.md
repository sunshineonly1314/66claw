# 服务端对接需求 - 问题答复

> 文档版本：v1.1
> 更新时间：2026-02-03
> 针对服务端开发提出的确认问题进行详细答复

---

## 一、安全相关

### 1.1 HMAC 密钥传递方式

**问题**：文档中明文写出密钥，后续是否会变更？

**答复**：

这是一个**历史遗留问题**，也是我们要解决的**安全漏洞**之一。

**现状**：
- 密钥 `Cb#2026$Tecbinai@Lic3nse!Hmac^Key&Secure` 已硬编码在客户端代码中
- 位置：`src/license/types.ts` 第 372 行
- 这意味着任何人反编译客户端都能获取此密钥

**解决方案**：
- 这就是为什么需要 **RSA 签名**
- HMAC 签名用于**客户端→服务端**请求验证（验证请求来自合法客户端）
- RSA 签名用于**服务端→客户端**响应验证（验证响应来自合法服务端）
- 即使 HMAC 密钥被提取，攻击者也**无法伪造服务端响应**（因为没有 RSA 私钥）

**密钥管理计划**：
1. 短期：保持现有 HMAC 密钥用于请求签名（已泄露但仍有一定防护作用）
2. 中期：RSA 签名上线后，响应安全得到保障
3. 长期：考虑更换 HMAC 密钥 + 客户端强制更新

**结论**：暂时保持不变，RSA 签名是更重要的优先级。

---

### 1.2 心跳接口为何没有签名验证？

**问题**：`/heartbeat` 只有 key + deviceId，没有签名，是设计如此还是遗漏？

**答复**：这是**设计简化**，但你说得对，应该加上签名。

**原因分析**：
- 心跳频率低（24小时一次）
- 心跳只是状态检查，不涉及敏感操作
- 当时认为攻击价值较低

**安全风险**：
- 攻击者可以伪造心跳请求（如果知道 key 和 deviceId）
- 风险：可能导致服务端记录虚假的"最后活跃时间"

**决定**：**建议增加签名验证**

修改后的心跳请求：

```json
{
  "key": "clawd-xxxx-xxxx-xxxx-xxxx",
  "deviceId": "a1b2c3d4...",
  "timestamp": 1706956800000,
  "nonce": "a1b2c3d4e5f6g7h8",
  "sign": "hmac_sha256_signature"
}
```

签名内容格式：`key|deviceId|timestamp|nonce`（与 `/verify` 一致）

**客户端修改**：我会更新心跳请求逻辑，添加签名参数。

---

### 1.3 设备列表接口的安全性

**问题**：`GET /devices?key=xxx&deviceId=xxx` 没有签名，是否需要加？

**答复**：**应该加签名**，但可以用简化方案。

**建议方案**：改为 POST 请求 + 签名

```http
POST /api/api/v1/license/devices
Content-Type: application/json
```

```json
{
  "key": "clawd-xxxx",
  "deviceId": "a1b2c3d4...",
  "timestamp": 1706956800000,
  "nonce": "a1b2c3d4e5f6g7h8",
  "sign": "hmac_sha256_signature"
}
```

**客户端修改**：我会将 `GET /devices` 改为 `POST /devices`。

---

## 二、授权码格式

**问题**：文档示例格式与项目现有格式不一致

**答复**：

**推荐格式**：`clawd-xxxx-xxxx-xxxx-xxxx`（4段，每段4位随机字符）

**原因**：
- 更易于用户手动输入和记忆
- 格式统一，便于校验
- 长度适中（25位含分隔符）

**生成规则建议**：

```python
import secrets
import string

def generate_license_key():
    """
    生成授权码
    格式：clawd-xxxx-xxxx-xxxx-xxxx
    字符：小写字母 + 数字（去除易混淆的 0/o/l/1）
    """
    chars = 'abcdefghjkmnpqrstuvwxyz23456789'  # 去除 0,o,l,1,i
    parts = [''.join(secrets.choice(chars) for _ in range(4)) for _ in range(4)]
    return 'clawd-' + '-'.join(parts)

# 示例：clawd-a2b3-c4d5-e6f7-g8h9
```

**旧格式兼容**：
- 如果已有 `clawd-{timestamp}-{random8}` 格式的授权码
- 服务端**同时支持两种格式**
- 校验规则：以 `clawd-` 开头即可

**客户端校验**：只检查前缀 `clawd-`，不限制具体格式。

---

## 三、设备绑定逻辑

### 3.1 首次绑定是否需要用户确认？

**答复**：**自动绑定**，无需用户确认。

**流程**：
1. 用户首次输入授权码并点击"激活"
2. 客户端调用 `/verify` 接口
3. 服务端自动将当前设备绑定到该授权码
4. 如果设备数超限，返回 `ERROR_DEVICE_LIMIT (1004)`

**用户感知**：激活成功 = 设备已绑定

### 3.2 解绑冷却期

**答复**：**建议设置 24 小时冷却期**

**规则**：
- 解绑后 24 小时内，该授权码不能绑定新设备
- 防止用户频繁切换设备绕过限制
- 服务端记录 `last_unbind_at` 时间戳

**实现建议**：

```python
def can_bind_new_device(license):
    if license.last_unbind_at is None:
        return True
    cooldown_hours = 24
    cooldown_end = license.last_unbind_at + timedelta(hours=cooldown_hours)
    return datetime.now() > cooldown_end
```

**错误返回**：新增错误码

| 错误码 | 常量 | 说明 |
|--------|------|------|
| 1009 | ERROR_UNBIND_COOLDOWN | 解绑冷却中，请24小时后再试 |

### 3.3 设备 ID 防伪造机制

**问题**：客户端生成的 deviceId 是 SHA256 哈希，服务端无法验证真实性

**答复**：这是一个**已知的限制**，目前**没有完美的解决方案**。

**现状分析**：
- deviceId 基于 MAC地址 + 机器ID + CPU ID 等生成
- 用户可以伪造这些信息，生成不同的 deviceId
- 这意味着用户可以通过伪造 deviceId 绕过设备数限制

**缓解措施**（已实现或建议）：

| 措施 | 效果 | 状态 |
|------|------|------|
| 设备数限制 | 增加绕过成本 | ✅ 已实现 |
| 解绑冷却期 | 减慢切换速度 | 建议实现 |
| 心跳检测 | 检测异常活跃模式 | ✅ 已实现 |
| 设备名+系统信息 | 辅助人工审核 | ✅ 已实现 |
| 异常检测（后续） | 同一key短期内大量不同设备 | 建议后续实现 |

**异常检测建议**：

```python
def check_device_anomaly(license_id, device_id):
    """
    检测设备异常
    规则：7天内绑定超过 5 个不同设备视为异常
    """
    recent_devices = get_devices_bound_in_days(license_id, days=7)
    if len(recent_devices) > 5:
        return True, "短期内设备变更频繁，请联系客服"
    return False, None
```

**结论**：这是**商业软件的通用问题**，完全防止不可能，但可以增加绕过成本。

---

## 四、错误码澄清

**问题**：`1004 ERROR_DEVICE_LIMIT` 和 `1005 ERROR_KEY_BINDBY_OTHER` 的区别

**答复**：

| 错误码 | 场景 | 含义 |
|--------|------|------|
| 1004 | 设备数超限 | 你的授权码已绑定 2 台设备，不能再绑定第 3 台 |
| 1005 | 授权码被盗用 | 这个授权码被**另一个用户**（通过手机号/邮箱识别）绑定了 |

**详细解释**：

**1004 - ERROR_DEVICE_LIMIT**：
- 你买了授权码，绑定了 A、B 两台设备
- 你想在 C 设备上使用
- 返回 1004：设备数超限
- 解决：解绑 A 或 B，然后在 C 上激活

**1005 - ERROR_KEY_BINDBY_OTHER**：
- 你买了授权码
- 但这个授权码已经被**另一个人**（用不同的手机号/邮箱）使用了
- 可能场景：授权码泄露、被盗、被转卖
- 返回 1005：授权码已被他人使用
- 解决：联系客服核实身份

**判断逻辑**：

```python
def verify_license(key, device_id, user_identifier):
    license = get_license(key)
    
    # 检查授权码是否已被其他用户使用
    if license.user_id and license.user_id != get_user_id(user_identifier):
        return error(1005, "授权码已被他人使用，请联系客服")
    
    # 检查设备数是否超限
    bound_devices = get_bound_devices(license.id)
    if len(bound_devices) >= license.device_limit:
        if device_id not in [d.device_id for d in bound_devices]:
            return error(1004, "设备数已达上限，请先解绑其他设备")
    
    # ... 其他检查
```

**注意**：如果没有用户体系（当前 API 没有用户登录），1005 可以**暂不实现**，只用 1004。

---

## 五、RSA 签名边界情况

**问题**：验证失败时，tier 和 expiresAt 为空，用空字符串还是 "null"？

**答复**：**使用空字符串 `""`**

**签名内容格式**：

| 场景 | valid | tier | expiresAt | serverTime | 签名内容 |
|------|-------|------|-----------|------------|---------|
| 验证成功 | true | basic | 2027-02-03T00:00:00.000Z | 1706956800000 | `true\|basic\|2027-02-03T00:00:00.000Z\|1706956800000` |
| 验证失败（过期） | false | basic | 2026-01-01T00:00:00.000Z | 1706956800000 | `false\|basic\|2026-01-01T00:00:00.000Z\|1706956800000` |
| 验证失败（不存在） | false | (空) | (空) | 1706956800000 | `false\|\|\|1706956800000` |

**Python 实现**：

```python
def build_sign_content(valid: bool, tier: str, expires_at: str, server_time: int) -> str:
    return f"{str(valid).lower()}|{tier or ''}|{expires_at or ''}|{server_time}"

# 示例
build_sign_content(True, "basic", "2027-02-03T00:00:00.000Z", 1706956800000)
# 输出: "true|basic|2027-02-03T00:00:00.000Z|1706956800000"

build_sign_content(False, None, None, 1706956800000)
# 输出: "false|||1706956800000"
```

**客户端验证代码**（已实现）：

```typescript
// src/license/rsa-verify.ts
export function buildSignContent(
  valid: boolean,
  tier: string | null,
  expiresAt: string | null,
  serverTime: number,
): string {
  return `${valid}|${tier ?? ""}|${expiresAt ?? ""}|${serverTime}`;
}
```

---

## 六、功能定义

### 6.1 features 完整列表

**定义表**：

| feature | 说明 | basic | professional | enterprise |
|---------|------|-------|--------------|------------|
| `basic_chat` | 基础对话 | ✅ | ✅ | ✅ |
| `basic_skills` | 基础技能 | ✅ | ✅ | ✅ |
| `history_7days` | 7天历史记录 | ✅ | ❌ | ❌ |
| `history_30days` | 30天历史记录 | ❌ | ✅ | ❌ |
| `history_unlimited` | 无限历史记录 | ❌ | ❌ | ✅ |
| `advanced_skills` | 高级技能 | ❌ | ✅ | ✅ |
| `priority_support` | 优先客服支持 | ❌ | ✅ | ✅ |
| `custom_agent` | 自定义 Agent | ❌ | ❌ | ✅ |
| `api_access` | API 调用权限 | ❌ | ❌ | ✅ |
| `multi_channel` | 多渠道接入 | ❌ | ❌ | ✅ |

**tier 与 features 对照**：

```python
TIER_FEATURES = {
    "basic": [
        "basic_chat",
        "basic_skills", 
        "history_7days"
    ],
    "professional": [
        "basic_chat",
        "basic_skills",
        "history_30days",
        "advanced_skills",
        "priority_support"
    ],
    "enterprise": [
        "basic_chat",
        "basic_skills",
        "history_unlimited",
        "advanced_skills",
        "priority_support",
        "custom_agent",
        "api_access",
        "multi_channel"
    ]
}

def get_features_by_tier(tier: str) -> list:
    return TIER_FEATURES.get(tier, TIER_FEATURES["basic"])
```

**注意**：当前客户端**暂未使用** features 做功能限制，features 字段主要用于：
1. UI 展示（告诉用户有哪些功能）
2. 未来扩展（服务端可控制功能开关）

### 6.2 keyType 行为差异

| keyType | 说明 | 行为差异 |
|---------|------|---------|
| `test` | 测试码 | 可能有更短的有效期，用于内部测试 |
| `trial` | 试用码 | 通常 7-30 天，功能完整或部分限制 |
| `standard` | 正式码 | 付费购买，完整功能 |

**客户端行为**：
- 当前客户端**不区分** keyType
- keyType 主要用于**服务端统计**和**UI展示**

**建议**：
- `test`：不限设备数，用于开发测试
- `trial`：限制 1 台设备，试用期结束后需购买
- `standard`：正式销售，按 tier 区分设备数和功能

### 6.3 forceUpdate 字段完整格式

```json
{
  "forceUpdate": {
    "required": true,
    "blocking": true,
    "minVersion": "2026.2.0",
    "latestVersion": "2026.2.5",
    "downloadUrl": "https://www.tecbinai.com/download",
    "updateMessage": "发现重要安全更新，请立即更新到最新版本"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `required` | boolean | 是否需要更新 |
| `blocking` | boolean | 是否阻塞使用（true=必须更新才能继续） |
| `minVersion` | string | 最低要求版本 |
| `latestVersion` | string | 最新版本 |
| `downloadUrl` | string | 下载链接 |
| `updateMessage` | string | 更新说明 |

**客户端行为**：
- `blocking: true`：弹窗无法关闭，必须更新
- `blocking: false`：弹窗可关闭，提示更新

**版本比较逻辑**：

```python
def should_force_update(client_version: str, min_version: str) -> bool:
    """
    比较版本号
    格式：YYYY.M.D 或 YYYY.M.D-beta.N
    """
    # 简单实现：按字符串比较（需要保证格式统一）
    return client_version < min_version
```

---

## 七、离线宽限期

**问题**：离线宽限期具体是多久？

**答复**：**24小时**（已从72小时缩短）

**代码位置**：`src/license/types.ts` 第 373 行

```typescript
export const DEFAULT_LICENSE_CONFIG: LicenseModuleConfig = {
  // ...
  offlineGracePeriodHours: 24, // 从 72h 缩短到 24h，减少离线滥用风险
  // ...
};
```

**说明**：
- 离线宽限期由**客户端控制**，不由服务端返回
- 服务端返回的 `nextCheckAfterHours` 是建议的**在线检查间隔**（默认24小时）
- 两者概念不同：
  - `offlineGracePeriodHours`：网络断开后可继续使用的时间
  - `nextCheckAfterHours`：联网状态下多久检查一次

**tier 差异化**（建议后续实现）：

| tier | 离线宽限期 |
|------|-----------|
| basic | 24小时 |
| professional | 72小时 |
| enterprise | 7天 |

---

## 八、通知系统

**问题**：客户端缓存清空后，showOnce 通知会重新显示，是否可接受？

**答复**：**可接受，但建议服务端也做持久化**

**现状**：
- 客户端在本地存储已展示的通知 ID
- 文件位置：`~/.clawdbot/shown_notifications.json`
- 每次请求时通过 `shownNotificationIds` 参数告诉服务端

**问题场景**：
1. 用户重装客户端
2. 用户换设备
3. 客户端缓存被清空

**建议方案**：服务端**双重记录**

```sql
-- 服务端记录已确认的通知
CREATE TABLE license_notification_acks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    notification_id BIGINT NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    license_key VARCHAR(64),  -- 可选，用于跨设备同步
    action VARCHAR(32) NOT NULL,
    acked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_notification_device (notification_id, device_id)
);
```

**过滤逻辑**：

```python
def get_pending_notifications(device_id, shown_ids_from_client):
    # 合并客户端和服务端的已展示记录
    server_shown_ids = get_acked_notification_ids(device_id)
    all_shown_ids = set(shown_ids_from_client) | set(server_shown_ids)
    
    # 获取未展示的通知
    return get_notifications_not_in(all_shown_ids)
```

**这样即使客户端缓存丢失，服务端记录仍然有效。**

---

## 九、业务流程确认

### 9.1 购买流程

**问题**：授权码是立即生成还是支付成功回调后生成？

**答复**：**支付成功回调后生成**

**推荐流程**：

```
用户选择套餐 → 创建订单（状态：待支付）
                    │
                    ▼
              跳转支付（微信/支付宝）
                    │
                    ▼
              支付成功回调
                    │
                    ▼
              生成授权码 + 更新订单状态
                    │
                    ▼
              展示授权码 + 发送通知
```

**不推荐先生成授权码的原因**：
- 支付可能失败
- 订单可能被取消
- 容易产生未支付的废弃授权码

### 9.2 用户关联

**问题**：授权码如何关联到用户？

**答复**：**购买时通过手机号/邮箱关联**

**方案 A：简单模式（推荐先实现）**

- 购买时必填手机号
- 授权码关联到手机号
- 用户通过手机号找回授权码
- 不需要注册登录系统

```sql
-- 授权码表
licenses (
    license_key,
    phone_number,  -- 关联手机号
    email,         -- 备用邮箱
    ...
)
```

**方案 B：账户体系（后续扩展）**

- 用户注册账户
- 登录后关联授权码
- 一个账户可有多个授权码
- 网页端管理授权

```sql
-- 用户表
users (
    id,
    phone_number,
    email,
    password_hash,
    ...
)

-- 授权码表
licenses (
    license_key,
    user_id,  -- 关联用户ID
    ...
)
```

**建议**：先实现方案 A，满足基本需求，后续再扩展账户体系。

### 9.3 续费逻辑

**问题**：续费是延长有效期还是生成新授权码？

**答复**：**延长当前授权码有效期**

**逻辑**：

```python
def renew_license(license_key, renew_years):
    license = get_license(license_key)
    
    # 计算新的过期时间
    if license.expires_at > datetime.now():
        # 未过期：从当前过期时间延长
        new_expires_at = license.expires_at + timedelta(days=365 * renew_years)
    else:
        # 已过期：从今天开始计算
        new_expires_at = datetime.now() + timedelta(days=365 * renew_years)
    
    license.expires_at = new_expires_at
    license.save()
    
    return license
```

**好处**：
- 用户不需要重新激活
- 设备绑定保持不变
- 使用体验连续

---

## 十、补充内容

### 10.1 完整的 tier/features 对照表

（见第六节 6.1）

### 10.2 forceUpdate 字段完整格式

（见第六节 6.3）

### 10.3 测试用例 / Mock 数据

**测试授权码**（服务端可预置）：

| 授权码 | 状态 | 用途 |
|--------|------|------|
| `clawd-test-valid-basic-ok` | 有效，basic，365天 | 测试正常验证 |
| `clawd-test-valid-pro-ok` | 有效，professional，365天 | 测试专业版 |
| `clawd-test-expired-30day` | 过期30天 | 测试过期流程 |
| `clawd-test-device-limit` | 设备数已满（2/2） | 测试设备超限 |
| `clawd-test-revoked` | 已撤销 | 测试撤销状态 |
| `clawd-test-notfound` | 不存在 | 测试无效授权码 |

**Mock 响应示例**：

```json
// clawd-test-valid-basic-ok 的响应
{
  "code": 200,
  "data": {
    "valid": true,
    "errorCode": null,
    "serverTime": 1706956800000,
    "license": {
      "tier": "basic",
      "tierName": "基础版",
      "expiresAt": "2027-02-03T00:00:00.000Z",
      "daysRemaining": 365,
      "keyType": "test",
      "features": ["basic_chat", "basic_skills", "history_7days"]
    },
    "device": {
      "deviceId": "test-device-id",
      "deviceLimit": 2,
      "boundDevices": 1,
      "isCurrentBound": true
    },
    "renewalReminder": null,
    "forceUpdate": null,
    "signature": "mock-signature-for-testing"
  }
}
```

### 10.4 客户端公钥更新机制

**问题**：如果将来需要更换 RSA 密钥对怎么办？

**答复**：这是一个**关键问题**，需要提前规划。

**方案：密钥轮换 + 双密钥过渡期**

**步骤**：

1. **服务端准备新密钥对**
   - 生成新的 RSA 密钥对
   - 新私钥存入服务端

2. **双签名过渡期**
   - 服务端同时返回**两个签名**
   - `signature`：新密钥签名
   - `signatureLegacy`：旧密钥签名（过渡期）

3. **客户端更新**
   - 新版客户端使用新公钥
   - 发布新版本

4. **强制更新**
   - 等大部分用户更新后
   - 设置 `forceUpdate` 强制旧版本更新
   - 服务端停止返回 `signatureLegacy`

**客户端代码预留**（建议实现）：

```typescript
// src/license/rsa-verify.ts

// 主公钥（当前使用）
const RSA_PUBLIC_KEY_V1 = `-----BEGIN PUBLIC KEY-----
...当前公钥...
-----END PUBLIC KEY-----`;

// 备用公钥（未来轮换时启用）
const RSA_PUBLIC_KEY_V2 = null;

export function verifyLicenseSignature(signContent: string, signature: string): boolean {
  // 优先尝试 V2 密钥（如果有）
  if (RSA_PUBLIC_KEY_V2) {
    const v2Result = verifyWithKey(signContent, signature, RSA_PUBLIC_KEY_V2);
    if (v2Result) return true;
  }
  
  // 使用 V1 密钥
  return verifyWithKey(signContent, signature, RSA_PUBLIC_KEY_V1);
}
```

**时间线建议**：
- 密钥有效期建议 2-3 年
- 每次轮换至少预留 3 个月过渡期
- 记录密钥版本和生效时间

---

## 十一、API 变更汇总

根据本次讨论，需要调整的接口：

| 接口 | 变更 |
|------|------|
| `POST /heartbeat` | 增加 `timestamp`, `nonce`, `sign` 参数 |
| `GET /devices` | 改为 `POST /devices`，增加签名 |
| 所有响应 | 增加 `signature` 字段（RSA签名） |

**客户端对应修改**：我会更新客户端代码适配这些变更。

---

## 十二、下一步行动

### 服务端

1. ✅ 确认以上所有问题答复
2. 生成 RSA 密钥对，将公钥发给客户端开发
3. 实现 `/verify`、`/heartbeat` 接口（含签名）
4. 实现 `/purchase`、`/renew` 页面
5. 准备测试授权码

### 客户端

1. 更新 RSA 公钥（收到后）
2. 修改 `/heartbeat` 请求添加签名
3. 修改 `/devices` 请求从 GET 改为 POST
4. 验证 RSA 签名逻辑
5. 联调测试

---

> 文档版本：v1.1
> 最后更新：2026-02-03
