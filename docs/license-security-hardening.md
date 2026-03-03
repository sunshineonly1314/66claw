# OpenClawCN 激活码安全加固方案

> 文档版本：v1.0
> 适用版本：ClawdbotCN 1.6.x
> 撰写日期：2026-03-02
> 阅读对象：**客户端开发** + **服务端开发**

---

## 一、现状与威胁分析

### 1.1 当前架构概述

```
用户激活码 (licenseKey)
    │
    ▼
客户端 POST /verify  ─── HMAC-SHA256(key|deviceId|ts|nonce, secretKey=licenseKey)
    │
    ▼
服务端返回 { valid, tier, expiresAt, signature(RSA-2048), serverTime }
    │
    ▼
客户端 RSA 验签 → 存入 AES-256-GCM 加密缓存 → HMAC 完整性保护
    │
    ▼
心跳每 4 小时续期，离线最多 72 小时
```

### 1.2 现有防线（已实现，不动）

| 防线 | 实现位置 | 效果 |
|------|----------|------|
| RSA-2048 响应签名 | `src/license/rsa-verify.ts` | 防止响应伪造 |
| AES-256-GCM 缓存加密 | `src/infra/secure-storage.js` | 防止缓存明文篡改 |
| HMAC-SHA256 缓存完整性 | `src/license/offline.ts:46` | 防止解密后字段篡改 |
| 72 小时硬限制 | `src/license/offline.ts:323` | 字节码保护，强制联网 |
| 时钟回拨检测 | `src/license/offline.ts:298` | 防止调时间延长离线 |
| 原生 C++ RSA 验证 | `native/build/Release/*.node` | 比 JS 更难 patch |
| V8 字节码保护 | `cn/scripts/build/compile-bytecode.ts` | 核心逻辑不可直接阅读 |

### 1.3 当前三个真实漏洞

---

**漏洞 A：HMAC 签名密钥 = licenseKey 本身（高危）**

```
// src/license/sign.ts:68
// 现状：直接用 licenseKey 作为 HMAC 密钥
const data = `${key}|${deviceId}|${timestamp}|${nonce}`;
const signature = crypto.createHmac("sha256", secretKey).update(data).digest("hex");
// secretKey 此处 = licenseKey（攻击者知道这个值）
```

攻击路径：攻击者抓包 → 知道 licenseKey → 知道签名算法（在字节码里，但可通过 v8 反编译工具提取格式）→ 自己构造签名 → 绕过签名校验，直接对服务端接口做暴力枚举。

---

**漏洞 B：RC4 加密字节码（中危）**

RC4 于 2015 年被 RFC 7465 正式禁用，已有工具可在数秒内还原 RC4 密钥流。字节码文件用 RC4 加密后，保护强度接近于零。

---

**漏洞 C：RSA 公钥指纹硬编码于 JS 层（低危）**

```
// src/license/rsa-verify.ts:261
// 用特征字符串检测是否是"真实公钥"：
return RSA_PUBLIC_KEY.includes("kDtHShdtjfCopovpCcIR");
```

这行代码本身就是一个公钥指纹，V8 字节码的常量池中字符串以接近明文形式存储，可被提取。攻击者知道公钥内容后，可部署自建 license 服务器 + 替换本地公钥实施中间人。

---

## 二、改造方案总览

### 改造优先级

| 优先级 | 改造项 | 主要负责方 | 难度 |
|--------|--------|-----------|------|
| **P0** | [改造1] 服务端下发 sessionSalt，升级 HMAC 密钥 | 服务端 0.5天 + 客户端 0.5天 | 低 |
| **P0** | [改造2] 请求速率限制 + 枚举防护 | 服务端 0.5天 | 低 |
| **P0** | [改造3] RC4 → AES-256-CTR 字节码加密 | 客户端构建 1天 | 中 |
| **P1** | [改造4] 服务端下发短效功能令牌 | 服务端 1.5天 + 客户端 1天 | 中 |
| **P1** | [改造5] heartbeat 携带运行时健康信号 | 服务端 1天 + 客户端 0.5天 | 低 |
| **P1** | [改造6] License 吊销主动查询 | 服务端 0.5天 + 客户端 0.5天 | 低 |
| **P2** | [改造7] 多因子设备指纹强化 | 服务端 1天 + 客户端 0.5天 | 中 |

---

## 三、详细改造方案

---

### 改造1：HMAC 密钥升级（服务端下发 sessionSalt）

#### 目标

让 HMAC 签名密钥不再是 licenseKey 本身，而是由服务端参与派生，攻击者知道 licenseKey 也无法伪造请求签名。

#### 服务端改造

**1. `/verify` 接口响应新增字段**

```json
// 现有响应
{
  "code": 200,
  "data": {
    "valid": true,
    "license": { "tier": "professional", "expiresAt": "2027-01-29T16:14:43Z" },
    "signature": "base64...",
    "serverTime": 1741000800000
  }
}

// 改造后：新增 sessionSalt 字段
{
  "code": 200,
  "data": {
    "valid": true,
    "license": { "tier": "professional", "expiresAt": "2027-01-29T16:14:43Z" },
    "signature": "base64...",
    "serverTime": 1741000800000,
    "sessionSalt": "base64(32字节随机数)",   // ← 新增
    "saltExpiresAt": 1741087200000            // ← 新增：24小时后过期
  }
}
```

**2. 服务端存储 sessionSalt**

```sql
-- 新增表（或在现有 license_devices 表中新增字段）
ALTER TABLE license_devices ADD COLUMN session_salt VARCHAR(64);
ALTER TABLE license_devices ADD COLUMN salt_expires_at BIGINT;

-- 逻辑：每次 /verify 成功后更新
UPDATE license_devices
SET session_salt = :newSalt, salt_expires_at = :now + 86400000
WHERE license_key = :key AND device_id = :deviceId;
```

**3. `/heartbeat` 接口验签升级**

```
// 服务端验签逻辑升级：
// 旧：HMAC(key|deviceId|ts|nonce, key)   ← key 既是数据又是密钥，弱
// 新：HMAC(key|deviceId|ts|nonce, HKDF(key+deviceId, sessionSalt, "openclawcn-request-v2"))
// 兼容：如果请求中没有带 sign v2 标记，降级到旧验签（保持向后兼容）
```

#### 客户端改造

**文件：`src/license/sign.ts`**

新增函数（在现有 `generateSign` 下方添加，不改动原有函数以保持兼容）：

```typescript
/**
 * 使用服务端派生盐生成强化版请求签名（v2）
 *
 * @param key - 授权码
 * @param deviceId - 设备ID
 * @param timestamp - 时间戳
 * @param nonce - 随机数
 * @param sessionSalt - 服务端下发的 base64 盐值
 * @returns HMAC-SHA256 签名（hex）
 */
export function generateSignV2(
  key: string,
  deviceId: string,
  timestamp: number,
  nonce: string,
  sessionSalt: string,
): string {
  const saltBuffer = Buffer.from(sessionSalt, "base64");
  // HKDF 派生 HMAC 密钥：ikm = key+deviceId, salt = sessionSalt, info = "openclawcn-request-v2"
  const hmacKey = crypto.hkdfSync(
    "sha256",
    Buffer.from(key + deviceId, "utf8"),
    saltBuffer,
    Buffer.from("openclawcn-request-v2", "utf8"),
    32
  );
  const data = `${key}|${deviceId}|${timestamp}|${nonce}`;
  return crypto.createHmac("sha256", hmacKey).update(data, "utf8").digest("hex");
}
```

**文件：`src/license/offline.ts`（缓存新增 sessionSalt 存储）**

在 `LicenseCache` 类型扩展中新增（与 `signedPayload` 同级）：

```typescript
// 在 createLicenseCache() 中，如果响应包含 sessionSalt，存入缓存
if (response.sessionSalt && response.saltExpiresAt) {
  cache.sessionSalt = response.sessionSalt;
  cache.saltExpiresAt = response.saltExpiresAt;
}
```

**心跳请求优先使用 v2 签名（`src/license/verify.ts` 的 `sendHeartbeat`）：**

```typescript
// 心跳构建请求时，优先读缓存中的 sessionSalt
const cache = await loadLicenseCache();
const now = Date.now();

let signParams;
if (cache?.sessionSalt && cache?.saltExpiresAt && now < cache.saltExpiresAt) {
  // v2：使用服务端下发的盐
  const ts = getTimestamp();
  const nonce = generateNonce();
  signParams = {
    timestamp: ts,
    nonce,
    sign: generateSignV2(key, deviceId, ts, nonce, cache.sessionSalt),
    signVersion: 2,  // 告知服务端用哪种验签方式
  };
} else {
  // v1 兼容：salt 过期或不存在时，回退到旧签名（同时触发重新 verify 刷新 salt）
  signParams = generateSignParams(key, deviceId, key);
  signParams.signVersion = 1;
}
```

#### 效果

攻击者抓到请求包，知道 licenseKey，但不知道 sessionSalt（存在服务端，不出现在客户端网络请求中），无法构造合法签名，暴力枚举接口从而无效。

---

### 改造2：服务端请求速率限制（纯服务端，客户端不用改）

#### 规则表

```
对象                      限制                  触发动作
同一 IP，/verify          5次/分钟              429 Too Many Requests
同一 licenseKey，/verify  20次/小时             429
同一 deviceId，/verify    10次/小时             429
同一 IP，连续失败3次       延迟响应30秒          HTTP 200 但延迟返回
同一 IP，连续失败10次      封禁该 IP 24小时      403
非法 licenseKey 格式       立即拒绝，不查库      400
```

#### 实现建议

```javascript
// 使用 Redis 或内存 LRU 实现滑动窗口计数器
// Key 格式：rate:verify:ip:{ip}  TTL: 60s
// Key 格式：rate:verify:key:{keyHash}  TTL: 3600s

// 失败计数器（持久化）：
// Key 格式：fail:ip:{ip}  累计失败次数，超阈值封禁

// 封禁列表：
// Key 格式：ban:ip:{ip}  TTL: 86400s
```

#### 重要：licenseKey 格式预校验（无需查库）

在进入业务逻辑前，先正则校验格式，不合法的直接 400 拒绝，不消耗数据库资源：

```javascript
// 客户端约定格式：8-256位，字母数字加-_
const LICENSE_KEY_PATTERN = /^[a-zA-Z0-9\-_]{8,256}$/;
if (!LICENSE_KEY_PATTERN.test(req.body.key)) {
  return res.status(400).json({ code: 400, message: "Invalid license key format" });
}
```

---

### 改造3：RC4 → AES-256-CTR 字节码加密（纯客户端构建，不影响运行时）

#### 目标文件

`scripts/obfuscate-dist.ts`（当前 RC4 加密实现处）

#### 改造要点

- 将现有 RC4 流加密替换为 AES-256-CTR（流模式，速度相当，安全强度远高于 RC4）
- 密钥从构建时环境变量注入，不硬编码在脚本里
- 输出格式：前 16 字节为 IV（随机），后续为密文

#### 解密端同步更新

运行时加载 `.jsc` 文件的 loader stub 中，解密逻辑同步替换。

**注意：** 这是纯构建工具改造，不影响 Tauri/Node.js 运行时行为，改造后需在 Windows + macOS 两台构建机上全量验证一次。

---

### 改造4：服务端下发短效功能令牌

#### 设计目标

本地缓存不再是功能判断的最终依据。即使攻击者破解了本地缓存，也拿不到有效的功能令牌。

#### 服务端新增接口

```
POST https://www.obplugins.cn/api/api/v1/license/feature-token
```

**请求：**

```json
{
  "key": "用户激活码",
  "deviceId": "32位hex设备ID",
  "timestamp": 1741000800000,
  "nonce": "16位随机字符串",
  "sign": "HMAC签名（v2格式）"
}
```

**响应：**

```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOiJSUzI1NiJ9...",
    "expiresAt": 1741015200000
  }
}
```

**JWT Payload（服务端用 RSA 私钥签名，与 license verify 同一密钥对）：**

```json
{
  "sub": "sha256(licenseKey前8位)",
  "did": "sha256(deviceId前8位)",
  "tier": "professional",
  "features": ["agent-team", "orchestrator", "memory-core"],
  "iat": 1741000800,
  "exp": 1741015200,
  "jti": "唯一令牌ID（防重放）"
}
```

**有效期：4 小时**（与心跳间隔一致，心跳成功后顺带刷新令牌）

#### 服务端校验逻辑

```
1. 验证请求签名（v2 HMAC）
2. 查询数据库：key 是否 valid，deviceId 是否已绑定
3. 检查 jti 未被使用过（防重放，Redis 存 jti TTL=4h）
4. 签发 JWT，RSA 私钥签名
5. 记录日志：{ key_hash, device_hash, tier, issued_at }
```

#### 客户端改造

**新增模块：`src/license/feature-token.ts`**

```typescript
/**
 * 功能令牌管理
 * 令牌存内存，不写磁盘
 */

let _token: string | null = null;
let _tokenExpiresAt: number = 0;

/**
 * 获取有效的功能令牌（内存中）
 */
export function getFeatureToken(): string | null {
  if (_token && Date.now() < _tokenExpiresAt - 60_000) {
    // 提前 1 分钟认为过期，避免边界时刻
    return _token;
  }
  return null;
}

/**
 * 存入新令牌
 */
export function setFeatureToken(token: string, expiresAt: number): void {
  _token = token;
  _tokenExpiresAt = expiresAt;
}

/**
 * 清除令牌（登出或 license 失效时）
 */
export function clearFeatureToken(): void {
  _token = null;
  _tokenExpiresAt = 0;
}

/**
 * 从服务端请求新令牌
 */
export async function refreshFeatureToken(key: string): Promise<boolean> {
  try {
    const cache = await loadLicenseCache();
    const deviceId = getDeviceId();
    // 构造请求（使用 v2 签名）
    const response = await sendRequest("POST", "/feature-token", {
      key, deviceId, ...buildSignParamsV2(key, deviceId, cache?.sessionSalt)
    });
    if (response.code === 200 && response.data?.token) {
      setFeatureToken(response.data.token, response.data.expiresAt);
      return true;
    }
  } catch (err) {
    // 失败时不报错，降级到缓存模式
  }
  return false;
}
```

**功能门控逻辑调整：**

```typescript
// 在 agent-team、orchestrator 等高价值功能入口处：
// 优先检查内存令牌 → 降级到本地缓存

async function checkFeatureAccess(feature: string): Promise<boolean> {
  // 1. 优先：内存令牌（服务端背书，最可信）
  const token = getFeatureToken();
  if (token) {
    return verifyTokenFeature(token, feature);  // 本地 JWT 验签，不联网
  }
  // 2. 降级：本地缓存（离线模式）
  const cache = await getOfflineCache();
  return cache?.features?.includes(feature) ?? false;
}
```

#### 效果

攻击者破解本地缓存，改 `features` 字段 → 但没有有效的内存令牌 → 高价值功能仍无法使用。

离线用户（断网）→ 降级到缓存模式，正常使用 8 小时（72 小时内基础功能可用）。

---

### 改造5：heartbeat 携带运行时健康信号

#### 目标

让服务端感知到客户端是否被篡改，静默降级而不是明显告警（攻击者以为破解成功）。

#### 客户端心跳请求新增字段

在 `src/license/verify.ts` 的 `sendHeartbeat` 中，请求体新增：

```typescript
const request = {
  key,
  deviceId,
  // 以下为新增字段
  clientHealth: {
    // 1. 是否有调试端口（--inspect 标志）
    hasDebugger: process.debugPort !== 0,
    // 2. execArgv 是否包含可疑参数
    suspiciousArgs: process.execArgv.some(
      arg => arg.includes("inspect") || arg.includes("debug")
    ),
    // 3. 离线缓存完整性状态（在上次 loadLicenseCache 时已计算，缓存结果）
    cacheStatus: getLastCacheIntegrityStatus(),  // "ok" | "hmac_fail" | "rsa_fail" | "missing"
    // 4. 客户端版本（与服务端记录的版本对比，检测降级攻击）
    appVersion: VERSION,
  }
};
```

#### 服务端处理逻辑

```
收到 heartbeat：
  1. 正常更新验证时间（现有逻辑不变）
  2. 检查 clientHealth：
     - hasDebugger=true    → 记录告警日志，设备信誉 -10 分
     - cacheStatus!=ok     → 记录告警日志，设备信誉 -20 分
     - suspiciousArgs=true → 记录告警日志，设备信誉 -10 分
  3. 信誉分 < 60：heartbeat 响应中加入降级标志（客户端不显示给用户）
  4. 信誉分 < 30：停止下发 feature-token，返回 valid=false

响应新增字段（仅内部使用，UI 不展示）：
{
  "valid": true,
  "daysRemaining": 300,
  "signature": "...",
  "serverTime": 1741000800000,
  "_tier_limit": "basic"   // ← 服务端强制降级（客户端据此限制功能，不弹窗）
}
```

**关键原则：不在界面上显示"检测到篡改"，静默降级。** 攻击者以为破解成功，但功能在慢慢退化，难以定位原因。

---

### 改造6：License 吊销主动查询

#### 场景

发现某批 licenseKey 被泄露或破解工具流传，服务端需要能主动吊销。当前只有客户端发起心跳才能感知吊销，4 小时内攻击者可以正常使用。

#### 服务端新增接口

```
GET https://www.obplugins.cn/api/api/v1/license/revocation-check
?deviceId={deviceId}&since={timestamp}
```

**响应：**

```json
{
  "code": 200,
  "data": {
    "revokedKeys": ["key1hashPrefix", "key2hashPrefix"],
    "revokedAt": 1741000800000,
    "signature": "RSA签名（防止伪造吊销列表）"
  }
}
```

**说明：**
- `revokedKeys` 中存 licenseKey 的 SHA256 前 16 位（不暴露完整 key）
- 响应用 RSA 签名，客户端验签后才信任
- 服务端按需更新，只有真正吊销时才有数据

#### 客户端改造

在 `src/license/heartbeat.ts` 的 `performHeartbeat` 末尾追加检查：

```typescript
// 心跳成功后，顺带查一次吊销列表（轻量 GET 请求）
try {
  const revoked = await checkRevocationList(deviceId, lastRevocationCheck);
  if (revoked) {
    log.warn("License has been revoked by server");
    clearLicenseCache();
    clearFeatureToken();
    onLicenseInvalid?.();
  }
} catch {
  // 吊销查询失败不影响主流程
}
```

---

### 改造7：多因子设备指纹强化（P2，可延后）

#### 当前问题

`deviceId = SHA256(BIOS_UUID | MAC_Address)` 存在单点：

- 复制 `~/.openclawcn/.device_id` 文件到另一台机器，即可共享 license
- 服务端当前仅对比 deviceId 字符串，无法区分"同一台机器"和"复制了 ID 文件的不同机器"

#### 改造方案

**客户端：上报多因子原始哈希（不上报明文硬件信息）**

在 `/verify` 和 `/heartbeat` 请求中新增：

```typescript
// 在 buildVerifyRequest() 中新增：
hardwareFactors: {
  // 各因子分别 Hash，不拼接（防止服务端推断硬件信息）
  biosUuidHash: sha256(biosUuid).slice(0, 16),     // 前16位用于模糊匹配
  macHash: sha256(physicalMac).slice(0, 16),
  installTsHash: sha256(String(installTimestamp)).slice(0, 16),
}
```

**服务端：首次绑定时记录，后续做模糊校验**

```sql
-- 设备绑定表新增列
ALTER TABLE license_devices
ADD COLUMN bios_hash_prefix VARCHAR(16),
ADD COLUMN mac_hash_prefix VARCHAR(16),
ADD COLUMN install_ts_hash VARCHAR(16);
```

```
校验规则（首次绑定后续验证）：
  3/3 因子匹配 → 正常
  2/3 因子匹配 → 正常（允许硬件小幅变化，如换网卡）
  1/3 因子匹配 → 疑似换机，返回 needsReactivation 标志，用户需重新绑定
  0/3 因子匹配 → 新设备，按设备数限制处理
```

---

## 四、服务端工作量汇总

> 供服务端同学参考，按优先级排序。

### P0（本周完成）

| 编号 | 接口/功能 | 说明 | 估时 |
|------|----------|------|------|
| S1 | `/verify` 响应新增 `sessionSalt` + `saltExpiresAt` | 生成随机盐，存到设备记录 | 0.5天 |
| S2 | `/heartbeat` 支持 v2 HMAC 验签（兼容 v1） | 根据请求中 `signVersion` 字段切换验签逻辑 | 0.5天 |
| S3 | `/verify` + `/heartbeat` 速率限制中间件 | IP+key+device 三维限速，Redis 滑动窗口 | 0.5天 |

### P1（下周完成）

| 编号 | 接口/功能 | 说明 | 估时 |
|------|----------|------|------|
| S4 | `POST /feature-token` 新接口 | 验签 → 查库 → 签发 JWT（RSA 签名） | 1.5天 |
| S5 | `/heartbeat` 接受 `clientHealth` 字段 | 解析健康信号，计算设备信誉分，写入 DB | 1天 |
| S6 | `GET /revocation-check` 新接口 | 查吊销列表，RSA 签名响应 | 0.5天 |
| S7 | 设备信誉评分系统（后台） | 信誉分影响 feature-token 下发，触发静默降级 | 1天 |

### P2（下下周）

| 编号 | 接口/功能 | 说明 | 估时 |
|------|----------|------|------|
| S8 | 多因子设备指纹存储与校验 | `/verify` 接受 `hardwareFactors`，模糊匹配 | 1天 |

**服务端总工作量：约 6.5 天**

---

## 五、客户端工作量汇总

| 编号 | 改造项 | 涉及文件 | 估时 |
|------|--------|----------|------|
| C1 | `generateSignV2()` + sessionSalt 缓存 | `src/license/sign.ts`, `src/license/offline.ts` | 0.5天 |
| C2 | heartbeat 使用 v2 签名 | `src/license/verify.ts` | 0.5天 |
| C3 | RC4 → AES-256-CTR 字节码加密 | `scripts/obfuscate-dist.ts` + loader | 1天 |
| C4 | `feature-token.ts` 新模块 + 门控逻辑 | 新文件 + 各高价值功能入口 | 1天 |
| C5 | heartbeat 携带 clientHealth 字段 | `src/license/verify.ts` | 0.5天 |
| C6 | 吊销列表检查 | `src/license/heartbeat.ts` | 0.5天 |

**客户端总工作量：约 4 天**

---

## 六、不需要改动的模块

以下模块已足够强健，**不动**：

- `src/license/offline.ts` — HMAC + RSA 双重校验逻辑（保持原样）
- `src/license/rsa-verify.ts` — RSA 验签逻辑（保持原样，密钥只在下次轮换时更新）
- V8 字节码编译流程 — 继续编译 `src/license/`、`src/security/` 等核心目录
- 72 小时硬限制 — 不改（改了反而削弱防护）
- 时钟回拨检测 — 不改
- Tauri 架构 / sidecar 架构 — 完全不动

---

## 七、接口协议变更兼容性说明

所有改造均向后兼容：

1. `sessionSalt` 是新增字段，旧版客户端忽略它
2. 服务端 v2 HMAC 验签通过 `signVersion` 字段区分，不传则按 v1 处理
3. `feature-token` 是新接口，旧客户端不调用，旧客户端仍走缓存模式
4. `clientHealth` 是心跳可选字段，不传则服务端不做健康检查

**结论：旧版本客户端不会因服务端升级而崩溃。**

---

## 八、密钥管理规范

### RSA 密钥对

| 项目 | 要求 |
|------|------|
| 私钥存储 | 服务端环境变量 `LICENSE_RSA_PRIVATE_KEY`，不入代码库 |
| 公钥存储 | 客户端 `src/license/rsa-verify.ts` 硬编码（正常做法） |
| 密钥长度 | 当前 RSA-2048，2026 年仍安全，暂不升级 |
| 轮换周期 | 建议 1 年轮换一次，或发生私钥泄露时立即轮换 |
| 轮换方式 | 新版本客户端内嵌新公钥，旧客户端有 30 天过渡期（服务端同时维护新旧两个密钥对） |

### sessionSalt

| 项目 | 要求 |
|------|------|
| 生成方式 | 服务端 `crypto.randomBytes(32)` |
| 有效期 | 24 小时（随心跳续期） |
| 存储位置 | 服务端数据库 + 客户端缓存（AES 加密） |
| 泄露影响 | 仅影响该设备该 24 小时内的请求签名，不影响 licenseKey 本身 |

---

## 九、攻防效果对比

| 攻击手段 | 改造前 | 改造后 |
|----------|--------|--------|
| 暴力枚举 licenseKey | ★★★☆☆（仅靠服务端限速） | ★★★★★（速率限制 + v2 HMAC 需 sessionSalt） |
| 修改本地缓存获取高价值功能 | ★★★☆☆（AES+HMAC+RSA 已较强） | ★★★★★（无内存令牌则高价值功能不可用） |
| 字节码反编译 | ★★★☆☆（RC4 可破） | ★★★★☆（AES-256-CTR） |
| 复制设备 ID 换机 | ★★☆☆☆（仅字符串对比） | ★★★★☆（多因子指纹） |
| 吊销后继续使用 | ★★☆☆☆（等下次心跳，最多 4 小时） | ★★★★☆（主动查询吊销列表） |
| 调试器 patch 验签函数 | ★★★☆☆（C++ addon 较难 patch） | ★★★★☆（健康信号上报 + 静默降级） |

---

*文档结束。如需针对任何改造项展开实现细节，请告知。*
