# License 短期令牌 API 接口文档

## 概述

短期令牌机制用于增强授权防护，防止客户端代码被篡改后绕过授权检查。

### 核心原理

1. 客户端启动时从服务端获取短期令牌（有效期 1 小时）
2. 令牌使用服务端私钥签名，客户端无法伪造
3. 客户端定期（每 30 分钟）检查令牌是否需要续期
4. 即使客户端代码被修改，没有有效令牌也无法使用功能

---

## 服务端给客户端的最终说明（联调依据）

**✅ /token 接口已上线，可开始联调。**

| 项目 | 确认 |
|------|------|
| 接口地址 | `POST /api/api/v1/license/token` |
| 生产地址 | **https://www.tecbinai.com/api/api/v1/license/token** |
| 签名格式 | `key\|deviceId\|timestamp\|nonce`（用 `\|` 分隔）✅ |
| HMAC 密钥 | **licenseKey 本身**（客户端已按此实现）✅ |
| RSA 公钥 | 使用现有公钥（已内置）✅ |
| 令牌有效期 | 1 小时 |
| 前置条件 | 设备必须先通过 `/verify` 绑定 |

**说明**：客户端 `apiBaseUrl` 为 `https://www.tecbinai.com/api/api/v1/license`，请求令牌时完整 URL 为 `{apiBaseUrl}/token`，与生产地址一致。

---

## 设计决策（回答服务端问题）

### 1. /token 和 /verify 的关系

**建议：合并到 /verify 接口**

在现有 `/verify` 响应中增加 `token` 字段，无需新增接口。

```json
// POST /api/v1/license/verify 响应
{
  "valid": true,
  "license": { ... },
  "device": { ... },
  // 新增：短期令牌
  "token": {
    "tokenId": "uuid-v4",
    "licenseKey": "xxx",
    "deviceId": "xxx",
    "issuedAt": 1234567890000,
    "expiresAt": 1234571490000,
    "allowedFeatures": ["*"],
    "signature": "base64..."
  }
}
```

**好处**：
- 启动只需 1 次请求
- 减少网络开销
- 逻辑更简单

### 2. RSA 密钥对

**复用现有密钥对！**

- 私钥：`backend/src/main/resources/keys/private_key.pem`
- 公钥：已内置在客户端 `src/license/rsa-verify.ts`

无需新生成密钥对。

### 3. 续期细节

| 项目 | 说明 |
|------|------|
| 续期接口 | 同一个 `/verify` 接口 |
| 是否传 tokenId | **不需要**，服务端只需验证 licenseKey + deviceId |
| 重试策略 | 失败后间隔 1分钟 → 2分钟 → 5分钟 重试 |
| 最大重试次数 | 3 次后触发功能限制 |

### 4. 离线/网络异常场景

**已实现离线宽限期：30 分钟**

```
令牌过期后：
├─ 30 分钟内：允许使用，显示警告
└─ 超过 30 分钟：阻止使用
```

### 5. nonce 重放防护

| 项目 | 建议 |
|------|------|
| 格式 | 32 位十六进制字符串（客户端已实现） |
| 存储 | Caffeine 内存缓存 |
| TTL | 5 分钟（与时间戳误差一致） |

### 6. allowedFeatures

**第一版返回 `["*"]`**，后续再扩展功能限制。

客户端已有 `isFeatureAllowed()` 函数，但暂未实际使用。

### 7. 错误处理

| 失败次数 | 客户端行为 |
|---------|----------|
| 1-2 次 | 记录警告，如果 license 有效则继续使用 |
| 3+ 次 | 触发功能限制，显示"网络连接异常" |

### 8. 时间戳误差

**已实现时间差校正**：

```typescript
// 客户端计算时间差
const networkDelay = (localReceiveTime - localSendTime) / 2;
const estimatedServerTime = localSendTime + networkDelay;
serverTimeDrift = token.issuedAt - estimatedServerTime;

// 后续判断过期时使用校正后的时间
const correctedNow = Date.now() + serverTimeDrift;
```

---

## API 接口

### 方案 A（推荐）：合并到 /verify

在现有 `/verify` 接口响应中增加 `token` 字段。

#### 请求参数（不变）

```json
{
  "licenseKey": "string",
  "deviceId": "string",
  "timestamp": 1234567890,
  "nonce": "string",
  "sign": "string"
}
```

#### 响应（新增 token 字段）

```json
{
  "valid": true,
  "errorCode": null,
  "errorMessage": null,
  "serverTime": 1234567890000,
  "nextCheckAfterHours": 24,
  "license": {
    "tier": "basic",
    "tierName": "基础版",
    "expiresAt": "2026-12-31T23:59:59",
    "daysRemaining": 330,
    "keyType": "standard",
    "features": ["*"]
  },
  "device": { ... },
  "notifications": null,
  "renewalReminder": null,
  "forceUpdate": null,
  "signature": "xxx...",
  
  // ↓↓↓ 新增字段 ↓↓↓
  "token": {
    "tokenId": "550e8400-e29b-41d4-a716-446655440000",
    "licenseKey": "xxx",
    "deviceId": "xxx",
    "issuedAt": 1234567890000,
    "expiresAt": 1234571490000,  // 1 小时后
    "allowedFeatures": ["*"],
    "signature": "base64..."
  }
}
```

### 方案 B：单独 /token 接口

如果不想改 /verify，可以新增 `/token` 接口。

#### POST /api/v1/license/token

```json
// 请求
{
  "licenseKey": "string",
  "deviceId": "string",
  "timestamp": 1234567890,
  "nonce": "string",
  "sign": "string"
}

// 响应
{
  "success": true,
  "token": {
    "tokenId": "uuid-v4",
    "licenseKey": "xxx",
    "deviceId": "xxx",
    "issuedAt": 1234567890000,
    "expiresAt": 1234571490000,
    "allowedFeatures": ["*"],
    "signature": "base64..."
  }
}
```

---

## 令牌签名格式

**签名内容**（字段用 `|` 连接）：

```
tokenId|licenseKey|deviceId|issuedAt|expiresAt|features
```

其中 `features` 是 `allowedFeatures` 数组用逗号连接的字符串。

**示例**：

```
550e8400-e29b-41d4-a716-446655440000|test-key-xxx|device-xxx|1234567890000|1234571490000|*
```

**签名算法**：

```java
String signContent = String.join("|",
    token.getTokenId(),
    token.getLicenseKey(),
    token.getDeviceId(),
    String.valueOf(token.getIssuedAt()),
    String.valueOf(token.getExpiresAt()),
    String.join(",", token.getAllowedFeatures())
);

Signature signature = Signature.getInstance("SHA256withRSA");
signature.initSign(privateKey);
signature.update(signContent.getBytes(StandardCharsets.UTF_8));
String base64Signature = Base64.getEncoder().encodeToString(signature.sign());
```

---

## 服务端实现要点

### 1. 令牌签发（Java 示例）

```java
public LicenseToken issueToken(String licenseKey, String deviceId) {
    // 1. 验证授权有效性（复用现有逻辑）
    LicenseKey key = licenseKeyMapper.findByKey(licenseKey);
    if (key == null) {
        throw new LicenseException(1001, "授权码不存在");
    }
    if ("expired".equals(key.getStatus())) {
        throw new LicenseException(1002, "授权已过期");
    }
    // ... 其他验证
    
    // 2. 生成令牌
    LicenseToken token = new LicenseToken();
    token.setTokenId(UUID.randomUUID().toString());
    token.setLicenseKey(licenseKey);
    token.setDeviceId(deviceId);
    token.setIssuedAt(System.currentTimeMillis());
    token.setExpiresAt(System.currentTimeMillis() + 3600 * 1000); // 1 小时
    token.setAllowedFeatures(Arrays.asList("*")); // 第一版返回 *
    
    // 3. 签名（复用现有私钥）
    String signContent = buildSignContent(token);
    token.setSignature(rsaSign(signContent, privateKey));
    
    return token;
}
```

### 2. nonce 防重放（Caffeine 示例）

```java
private final Cache<String, Boolean> nonceCache = Caffeine.newBuilder()
    .expireAfterWrite(5, TimeUnit.MINUTES)
    .maximumSize(10000)
    .build();

public void validateNonce(String nonce) {
    if (nonceCache.getIfPresent(nonce) != null) {
        throw new LicenseException("Nonce already used");
    }
    nonceCache.put(nonce, true);
}
```

---

## 客户端已完成

| 模块 | 文件 | 状态 |
|------|------|------|
| 令牌管理 | `src/license/token.ts` | ✅ |
| 令牌验证 | `src/gateway/license-check.ts` | ✅ |
| 离线宽限期 | 30 分钟 | ✅ |
| 时间差校正 | 自动计算 | ✅ |
| 重试策略 | 1分钟/2分钟/5分钟 | ✅ |
| RSA 公钥 | 复用现有 | ✅ |

---

## 测试场景

| 场景 | 预期行为 |
|------|---------|
| 正常获取令牌 | 返回有效令牌，客户端验证签名通过 |
| 授权过期 | 返回错误码 1002，不签发令牌 |
| 伪造令牌 | 客户端签名验证失败，拒绝使用 |
| 网络中断 | 30 分钟宽限期内可用，超时阻止使用 |
| 时间不同步 | 客户端自动校正，正常判断过期 |

---

## 测试方案

以下为联调与验收的测试方案说明，不要求必须执行脚本，按场景人工验证即可。

### 一、/token 接口单独验证（可选）

在服务端联调前，可先用脚本校验接口契约与签名：

- **脚本**：`scripts/test-license-token.ts`
- **用法**：在项目根目录执行  
  `npx tsx scripts/test-license-token.ts`（或 `bun scripts/test-license-token.ts`）
- **前提**：环境变量或脚本内配置好 `apiBaseUrl`、有效的 `licenseKey`、与已绑定的 `deviceId`
- **验证点**：
  - 请求格式（licenseKey、deviceId、timestamp、nonce、sign）正确
  - 响应含 token 且字段完整（tokenId、issuedAt、expiresAt、signature 等）
  - 客户端用内置公钥能验签通过

### 二、客户端 + 服务端联调

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 使用**有效 Key** 启动 Gateway，打开 Web UI | Gateway 正常启动，可进入聊天/设置 |
| 2 | 在 Web UI 发送一条消息（或通过飞书/钉钉等已配置通道发消息） | 消息正常发送并收到回复 |
| 3 | 等待约 30 分钟（或 mock 时间），触发令牌续期 | 客户端静默续期，功能无中断；日志可见续期请求 |
| 4 | 断网（或关闭服务端），等待 &lt; 30 分钟 | 仍可发送消息，UI 可有“网络异常”类提示 |
| 5 | 断网超过 30 分钟后再发消息 | 发送被拒绝，提示需恢复网络或授权 |
| 6 | 使用**已过期 Key** 启动 Gateway | Gateway 以受限模式启动（或按当前实现阻止部分能力），Web UI 可见授权过期提示 |
| 7 | 在授权过期状态下通过 Web UI 或通道发消息 | 发送被拒绝，返回 UNAUTHORIZED 或等同提示 |

### 三、授权与过期一致性

| 场景 | 预期 |
|------|------|
| Key 过期后启动 | 不保存无效授权到本地缓存；Gateway 进入受限模式或明确提示过期 |
| 运行中 Key 过期（心跳或续期发现） | 本地授权状态更新为过期，后续发送被拒 |
| 心跳失败且本地缓存已过期 | 视为未授权，发送被拒 |

### 四、异常与安全

| 场景 | 预期 |
|------|------|
| /token 返回 4xx/5xx 或无效 JSON | 客户端按重试策略（1 分钟、2 分钟、5 分钟）重试，连续失败后限制功能 |
| 服务端返回 token 但 signature 错误或篡改 | 客户端验签失败，不写入本地，视为无有效令牌，限制功能 |
| nonce 重放（同一 nonce 两次请求） | 服务端第二次拒绝；客户端收到错误后按重试策略处理 |

### 五、验收通过标准

- **接口**：`POST /api/api/v1/license/token` 按文档返回 token，签名格式与 RSA 验签通过。
- **端到端**：有效 Key + 有效 token 时可正常发消息；无有效 token（未获取、过期超宽限期、验签失败）时发消息被拒。
- **过期**：Key 或 token 过期后，客户端不再允许发送消息，且 UI/通道有明确提示。

---

## 时间线

| 阶段 | 任务 | 状态 |
|-----|------|------|
| 客户端 | 令牌管理模块 | ✅ 完成 |
| 客户端 | 集成令牌验证 | ✅ 完成 |
| 客户端 | 离线宽限期 | ✅ 完成 |
| 客户端 | 时间差校正 | ✅ 完成 |
| 服务端 | /token 接口 | ✅ 完成 |
| 测试 | 联调测试 | ✅ 完成 (2026-02-04) |
