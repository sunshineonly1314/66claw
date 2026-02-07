# 服务端对接 - 技术细节确认

> 针对服务端开发的跟进问题，逐一明确回答

---

## 1. features / keyType / forceUpdate 完整定义

### 1.1 features 完整列表

| feature | 说明 | basic | professional | enterprise |
|---------|------|:-----:|:------------:|:----------:|
| `basic_chat` | 基础对话 | ✅ | ✅ | ✅ |
| `basic_skills` | 基础技能 | ✅ | ✅ | ✅ |
| `history_7days` | 7天历史记录 | ✅ | ❌ | ❌ |
| `history_30days` | 30天历史记录 | ❌ | ✅ | ❌ |
| `history_unlimited` | 无限历史记录 | ❌ | ❌ | ✅ |
| `advanced_skills` | 高级技能 | ❌ | ✅ | ✅ |
| `priority_support` | 优先客服 | ❌ | ✅ | ✅ |
| `custom_agent` | 自定义Agent | ❌ | ❌ | ✅ |
| `api_access` | API调用权限 | ❌ | ❌ | ✅ |
| `multi_channel` | 多渠道接入 | ❌ | ❌ | ✅ |

**服务端返回示例**：

```json
// basic
"features": ["basic_chat", "basic_skills", "history_7days"]

// professional  
"features": ["basic_chat", "basic_skills", "history_30days", "advanced_skills", "priority_support"]

// enterprise
"features": ["basic_chat", "basic_skills", "history_unlimited", "advanced_skills", "priority_support", "custom_agent", "api_access", "multi_channel"]
```

### 1.2 keyType 行为差异

| keyType | 说明 | 设备数 | 有效期 | 用途 |
|---------|------|--------|--------|------|
| `test` | 测试码 | 不限 | 开发者定 | 内部测试 |
| `trial` | 试用码 | 1台 | 7-30天 | 用户试用 |
| `standard` | 正式码 | 按tier | 付费购买 | 正式销售 |

**注意**：客户端当前不区分 keyType，主要用于服务端统计和 UI 展示。

### 1.3 forceUpdate 完整格式

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

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `required` | boolean | 是 | 是否需要更新 |
| `blocking` | boolean | 是 | true=必须更新才能用，false=可跳过 |
| `minVersion` | string | 是 | 最低要求版本 |
| `latestVersion` | string | 是 | 最新版本 |
| `downloadUrl` | string | 是 | 下载链接 |
| `updateMessage` | string | 否 | 更新说明 |

**不需要强制更新时**：`"forceUpdate": null`

---

## 2. 心跳接口签名格式

**确认：与 /verify 一致**

### 请求格式

```json
{
  "key": "clawd-xxxx-xxxx-xxxx-xxxx",
  "deviceId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "timestamp": 1706956800000,
  "nonce": "a1b2c3d4e5f6g7h8",
  "sign": "hmac_sha256_signature_hex"
}
```

### 签名算法

```
签名内容 = key + "|" + deviceId + "|" + timestamp + "|" + nonce
签名密钥 = "Cb#2026$Tecbinai@Lic3nse!Hmac^Key&Secure"
sign = HMAC-SHA256(签名内容, 签名密钥).toHex()
```

**与 /verify 完全一致，服务端可复用同一套验证代码。**

---

## 3. POST /devices 请求格式

**确认：就是这样**

### 请求

```http
POST /api/api/v1/license/devices
Content-Type: application/json
```

```json
{
  "key": "clawd-xxxx-xxxx-xxxx-xxxx",
  "deviceId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "timestamp": 1706956800000,
  "nonce": "a1b2c3d4e5f6g7h8",
  "sign": "hmac_sha256_signature_hex"
}
```

### 签名算法

同上，与 /verify、/heartbeat 完全一致。

### 响应

不变，与原来 GET 接口一样：

```json
{
  "code": 200,
  "data": {
    "devices": [...],
    "deviceLimit": 2
  }
}
```

---

## 4. 错误码 1009 响应格式

**确认：需要返回剩余时间**

### 响应格式

```json
{
  "code": 200,
  "data": {
    "valid": false,
    "errorCode": 1009,
    "errorMessage": "解绑冷却中，请 12 小时后再试",
    "cooldownRemainingHours": 12,
    "cooldownEndsAt": "2026-02-04T02:30:00.000Z"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `errorCode` | number | 1009 |
| `errorMessage` | string | 包含剩余时间的提示 |
| `cooldownRemainingHours` | number | 剩余冷却小时数（向上取整） |
| `cooldownEndsAt` | string | 冷却结束时间（ISO 8601） |

**触发场景**：调用 `/verify` 或 `/devices/unbind` 时，如果该授权码在冷却期内。

---

## 5. 完整错误码列表（更新版）

| 错误码 | 常量 | 说明 |
|--------|------|------|
| 1001 | ERROR_KEY_NOT_FOUND | 授权码不存在 |
| 1002 | ERROR_KEY_EXPIRED | 授权已过期 |
| 1003 | ERROR_KEY_REVOKED | 授权已被撤销 |
| 1004 | ERROR_DEVICE_LIMIT | 设备数超限 |
| 1005 | ERROR_KEY_BINDBY_OTHER | 授权码已被他人使用 |
| 1006 | ERROR_INVALID_SIGN | 签名验证失败 |
| 1007 | ERROR_TIMESTAMP_EXPIRED | 时间戳过期（±5分钟） |
| 1008 | ERROR_KEY_EXHAUSTED | 使用次数用尽 |
| **1009** | **ERROR_UNBIND_COOLDOWN** | **解绑冷却中（新增）** |

---

## 6. 服务端实现清单（最终版）

| 变更项 | 详情 |
|--------|------|
| `POST /heartbeat` | 增加 `timestamp`, `nonce`, `sign` 参数，验证逻辑同 /verify |
| `GET→POST /devices` | 改为 POST + 签名，响应不变 |
| 新增错误码 1009 | 解绑冷却中，返回 `cooldownRemainingHours` 和 `cooldownEndsAt` |
| 响应增加 `signature` | RSA 签名（/verify 和 /heartbeat 都要加） |
| 解绑冷却逻辑 | 24小时内不能绑定新设备 |

---

## 7. 签名验证代码（服务端参考）

三个接口共用同一套签名验证：

```python
import hmac
import hashlib
import time

SIGN_SECRET_KEY = "Cb#2026$Tecbinai@Lic3nse!Hmac^Key&Secure"

def verify_request_sign(key: str, device_id: str, timestamp: int, nonce: str, sign: str) -> tuple[bool, str]:
    """
    验证请求签名
    返回: (是否通过, 错误码或None)
    """
    # 1. 检查时间戳（±5分钟）
    now_ms = int(time.time() * 1000)
    if abs(now_ms - timestamp) > 5 * 60 * 1000:
        return False, "ERROR_TIMESTAMP_EXPIRED"
    
    # 2. 计算期望签名
    sign_content = f"{key}|{device_id}|{timestamp}|{nonce}"
    expected_sign = hmac.new(
        SIGN_SECRET_KEY.encode('utf-8'),
        sign_content.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # 3. 比较签名
    if sign != expected_sign:
        return False, "ERROR_INVALID_SIGN"
    
    return True, None


# 使用示例（三个接口通用）
@app.post("/api/api/v1/license/verify")
@app.post("/api/api/v1/license/heartbeat")  
@app.post("/api/api/v1/license/devices")
def handle_request(request):
    ok, error = verify_request_sign(
        request.key,
        request.device_id,
        request.timestamp,
        request.nonce,
        request.sign
    )
    if not ok:
        return {"code": 200, "data": {"valid": False, "errorCode": get_error_code(error)}}
    
    # ... 业务逻辑
```

---

以上确认无误，可以开始实现。如有其他问题随时沟通。
