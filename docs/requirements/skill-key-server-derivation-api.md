# 服务端 skillKey 派生 - API 接口规范

> 给 tecbinhome 服务端（obplugins.cn / tecbinai.com）的需求文档
> 文档版本：v1.1（2026-02-21 更新：澄清 skillKey 用途，Skill .enc 加密已废弃）
> 文档版本：v1.0 创建时间：2026-02-21
> 客户端版本：ClawdBot (OpenClawCN) v1.1.21+
> 优先级：P0（安全加固，阻塞下一版本发布）

---

## ⚠️ 重要更新（v1.1）：Skill 文件加密已废弃

**原始方案（v1.0）** 中 `skillKey` 的用途是解密 Skill 内容文件（`.md.enc`）。

**更新后（v1.1）**：经过安全架构讨论，`.md.enc` Skill 文件加密机制已在客户端 v1.1.21 中**完全废弃**：

- Skill 文件（Markdown 格式）不再生成 `.enc` 文件
- 客户端不再读取任何 `.enc` 文件
- 现有安装包中的 `.enc` 文件将被忽略

**skillKey 的新用途**：用于加密**用户 config 配置中的敏感字段**（如 API Keys 等），
通过 `encryptContent()` / `decryptContent()` 调用（AES-256-CBC，IV prepended）。
这是一个可选功能，不影响主流程。

后端**仍然需要**在 `/token` 响应中下发 `skillKey`，但用于 config 字段加密，而非 Skill 文件解密。

---

## 一、背景与问题

### 1.1 已修复的安全漏洞（历史记录）

ClawdBot v1.1.20 及以前对 Skill 内容文件（`.md.enc`）的加密使用**纯本地密钥派生**：

```
key = SHA-256( MachineGuid | "openclawcn-content-vault-v1-aes256" )
```

**致命缺陷**：密钥派生算法和盐值均以明文存在于发布包 `daemon-cli.js` 中。
红队使用 10 行 Node.js 脚本在 30 分钟内完成破解（见 `docs/security/SECURITY-AUDIT-2026-02-21.md` [CRIT-01]）。

**已修复**（v1.1.21）：
- ✅ `content-vault.ts` 完全移除本地密钥派生逻辑（`getMachineId()`、`CONTENT_VAULT_SALT`、`deriveKey()` 均已删除）
- ✅ Skill `.enc` 文件读写逻辑从 `workspace.ts`、`file-index.ts`、`clawdskillsproxy-registry.ts` 中全部删除
- ✅ `isEncryptionEnabled()` 不再读取环境变量，默认返回 `true`（安全侧失败）

### 1.2 当前架构

`requireKey()` 函数严格快速失败——若无 `skillKey`（服务端尚未下发），则加密功能不可用，
不存在任何本地 fallback。这意味着：
- 服务端何时开始下发 `skillKey` 完全由后端控制
- 客户端向后兼容（`token.skillKey` 为 optional，没有时跳过注入，不影响主流程）

### 1.3 服务端下发 skillKey 的价值

即使 Skill 文件加密废弃，config 字段加密（用于保护本地存储的 API Key 等敏感配置）
仍然依赖服务端 `skillKey`。服务端实装后：

- 用户的 API Keys 在本地磁盘以 AES-256-CBC 加密存储
- 即使攻击者获取 config 文件，也无法直接读取 API Keys
- 密钥在服务端派生，攻击者即使逆向客户端也无法复现

---

## 二、方案设计

### 2.1 架构图

```
客户端启动
    │
    ▼
POST /api/api/v1/license/token
（携带 licenseKey + deviceId + HMAC 签名）
    │
    ▼
服务端验证授权 → 用服务端私有主密钥派生 skillKey
    │
    ▼
响应（RSA 签名保护）：
{
  "token": { ...原有字段... },
  "skillKey": "base64(32字节随机派生密钥)"
}
    │
    ▼
客户端调用 injectSkillKey(skillKey)
    │
    ▼
config 中的敏感字段（API Keys等）用 skillKey 加密存储
（AES-256-CBC, [16字节 IV] + [密文]）
密钥在服务端派生，客户端无法本地重新推导
```

### 2.2 安全性对比

| 攻击场景 | 改动前 | 改动后 |
|---------|--------|--------|
| 10 行脚本本机解密 | ✅ 可以 | ❌ 不行，skillKey 不在本地 |
| 拿安装包去其他机器解密 | ✅ 可以（知道算法即可） | ❌ 不行，需向服务端验证授权 |
| 离线使用（token 宽限期内） | ✅ 正常 | ✅ 正常（skillKey 随 token 一起缓存） |
| 断网超过宽限期（48小时CN用户） | ✅ 照用 | ⚠️ 无法解密 Skill（预期行为） |
| 逆向客户端找 skillKey | — | ❌ 内存中存在，但无法重新推导 |

### 2.3 skillKey 派生规则（服务端内部）

服务端使用一个**永不对外暴露的主密钥** `SERVER_SKILL_MASTER_KEY`（存储在服务器
环境变量或密钥管理服务中），对每个 `deviceId` 派生专属的 `skillKey`：

```
skillKey = HMAC-SHA256( SERVER_SKILL_MASTER_KEY, deviceId + "|skill-content-v2" )
```

**关键点**：
- `SERVER_SKILL_MASTER_KEY` 是一个 256-bit 随机密钥，只存在于服务端
- 同一台设备每次获取的 `skillKey` 相同（确定性派生）→ 离线缓存可用
- 不同设备的 `skillKey` 完全不同 → 设备绑定
- 攻击者拿到 `skillKey` 也无法反推 `SERVER_SKILL_MASTER_KEY`

**主密钥生成（首次部署时执行一次）**：

```bash
# 生成主密钥（保存到环境变量或密钥管理服务）
openssl rand -hex 32
# 示例输出: a3f8d2e1c4b5a6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1
```

---

## 三、接口规范

### 3.1 改动接口：`POST /api/api/v1/license/token`

在**现有** `/token` 接口响应的 `token` 对象中新增 `skillKey` 字段。
**无需新增接口**，完全向后兼容（老客户端忽略新字段）。

#### 3.1.1 请求（不变）

```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "abc123...",
  "timestamp": 1708473600000,
  "nonce": "a1b2c3d4e5f6a7b8",
  "sign": "hmac-sha256-hex..."
}
```

#### 3.1.2 响应（新增 `skillKey` 字段）

```json
{
  "success": true,
  "token": {
    "tokenId": "550e8400-e29b-41d4-a716-446655440000",
    "licenseKey": "XXXX-XXXX-XXXX-XXXX",
    "deviceId": "abc123...",
    "issuedAt": 1708473600000,
    "expiresAt": 1708477200000,
    "allowedFeatures": ["*"],
    "skillKey": "base64(32字节派生密钥)",
    "signature": "base64-rsa-signature..."
  }
}
```

#### 3.1.3 字段说明

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `skillKey` | string | **新增，必须** | Base64 编码的 32 字节密钥，由服务端用 HMAC-SHA256 对 deviceId 派生 |

**`skillKey` 的值**：

```
Base64( HMAC-SHA256( SERVER_SKILL_MASTER_KEY, deviceId + "|skill-content-v2" ) )
```

- 输出固定为 32 字节（256-bit），Base64 编码后为 44 字符
- 同一 deviceId 每次结果相同（幂等）
- 在授权有效期间稳定不变

#### 3.1.4 RSA 签名内容（扩展现有签名）

现有签名内容：
```
tokenId|licenseKey|deviceId|issuedAt|expiresAt|features
```

**改为**（在末尾追加 skillKey）：
```
tokenId|licenseKey|deviceId|issuedAt|expiresAt|features|skillKey
```

其中 `skillKey` 就是 Base64 编码后的密钥字符串（44字符）。

**Java 签名代码改动**：

```java
// 改动前
String signContent = String.join("|",
    token.getTokenId(),
    token.getLicenseKey(),
    token.getDeviceId(),
    String.valueOf(token.getIssuedAt()),
    String.valueOf(token.getExpiresAt()),
    String.join(",", token.getAllowedFeatures())
);

// 改动后（追加 skillKey）
String signContent = String.join("|",
    token.getTokenId(),
    token.getLicenseKey(),
    token.getDeviceId(),
    String.valueOf(token.getIssuedAt()),
    String.valueOf(token.getExpiresAt()),
    String.join(",", token.getAllowedFeatures()),
    token.getSkillKey()   // ← 新增
);
```

---

## 四、服务端实现

### 4.1 主密钥管理

```java
// application.yml 或环境变量
skill:
  master-key: ${SKILL_MASTER_KEY}  # 256-bit hex，只存在于服务器

// 读取配置
@Value("${skill.master-key}")
private String skillMasterKeyHex;
```

**部署要求**：
- `SKILL_MASTER_KEY` 必须存储在环境变量或密钥管理服务（KMS），不得写入代码或配置文件提交版本控制
- 一旦生成，不可更改（改变后所有已加密的 `.enc` 文件将无法解密）
- 生产和测试环境使用不同的主密钥

### 4.2 skillKey 派生（Java）

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

/**
 * 为指定 deviceId 派生 Skill 解密密钥。
 * 结果是确定性的：同一 deviceId 每次返回相同密钥。
 */
public String deriveSkillKey(String deviceId) {
    try {
        // 主密钥：从配置读取的 hex 字符串转 bytes
        byte[] masterKey = hexToBytes(skillMasterKeyHex);

        // 派生材料：deviceId + 固定上下文
        String material = deviceId + "|skill-content-v2";

        // HMAC-SHA256 派生
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(masterKey, "HmacSHA256"));
        byte[] derived = mac.doFinal(material.getBytes(StandardCharsets.UTF_8));

        // Base64 编码（44字符，无换行）
        return Base64.getEncoder().encodeToString(derived);
    } catch (Exception e) {
        throw new RuntimeException("Failed to derive skill key", e);
    }
}

private byte[] hexToBytes(String hex) {
    int len = hex.length();
    byte[] data = new byte[len / 2];
    for (int i = 0; i < len; i += 2) {
        data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                             + Character.digit(hex.charAt(i + 1), 16));
    }
    return data;
}
```

### 4.3 在 /token 接口中集成

```java
public TokenResponse issueToken(String licenseKey, String deviceId) {
    // ...现有验证逻辑（不变）...

    // 生成令牌（现有）
    LicenseToken token = new LicenseToken();
    token.setTokenId(UUID.randomUUID().toString());
    token.setLicenseKey(licenseKey);
    token.setDeviceId(deviceId);
    token.setIssuedAt(System.currentTimeMillis());
    token.setExpiresAt(System.currentTimeMillis() + 3600 * 1000L);
    token.setAllowedFeatures(Collections.singletonList("*"));

    // ↓↓↓ 新增：派生并设置 skillKey ↓↓↓
    String skillKey = deriveSkillKey(deviceId);
    token.setSkillKey(skillKey);

    // RSA 签名（改为包含 skillKey 的新格式）
    String signContent = buildSignContent(token); // 见 4.1.4
    token.setSignature(rsaSign(signContent, privateKey));

    return TokenResponse.success(token);
}
```

### 4.4 /verify 接口同步改动（推荐）

若 `/verify` 接口也会返回 token（启动时一次性完成验证+获取 token），
则 `/verify` 的响应中 token 字段也需要包含 `skillKey`，逻辑相同。

```java
// /verify 响应中的 token 字段同样调用 deriveSkillKey(deviceId)
```

---

## 五、向后兼容性

### 5.1 老客户端（v1.1.20 及以下）

老客户端不认识 `skillKey` 字段，直接忽略。行为不变，继续使用本地 MachineGuid 派生。
**服务端无需任何版本判断**，直接在所有响应中返回 `skillKey` 即可。

### 5.2 新客户端（v1.1.21+）

新客户端逻辑：
1. 从 token 响应中读取 `skillKey`
2. 验证 RSA 签名（签名内容已包含 skillKey，防止篡改）
3. 将 `skillKey` 注入 content-vault，替代本地派生
4. 随 token 一起缓存到本地（离线宽限期内可用）

### 5.3 降级策略（客户端侧）

若服务端暂时未部署新版本（`skillKey` 字段缺失），客户端**临时 fallback** 到现有
MachineGuid 本地派生（维持现状，不破坏功能）。一旦服务端部署后自动切换。

---

## 六、测试验收

### 6.1 接口验证

```bash
# 测试 /token 接口，验证响应中包含 skillKey
curl -s -X POST https://www.obplugins.cn/api/api/v1/license/token \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "TEST-KEY",
    "deviceId": "test-device-001",
    "timestamp": 1708473600000,
    "nonce": "a1b2c3d4e5f6a7b8",
    "sign": "..."
  }' | jq '.token.skillKey'
# 预期: "base64字符串，44字符"
```

### 6.2 skillKey 一致性验证

```bash
# 同一 deviceId 两次请求，skillKey 必须相同
SKILL_KEY_1=$(curl ... | jq -r '.token.skillKey')
SKILL_KEY_2=$(curl ... | jq -r '.token.skillKey')
[ "$SKILL_KEY_1" = "$SKILL_KEY_2" ] && echo "✅ 一致" || echo "❌ 不一致"
```

### 6.3 RSA 签名验证（客户端视角）

客户端收到响应后，用内置 RSA 公钥验签，签名内容为：
```
tokenId|licenseKey|deviceId|issuedAt|expiresAt|features|skillKey
```
验签通过 → `skillKey` 未被中间人篡改。

### 6.4 不同 deviceId 隔离验证

```
device-001 的 skillKey ≠ device-002 的 skillKey
→ 确保 Skill 内容不能跨设备解密
```

### 6.5 验收标准

| 验收项 | 标准 |
|--------|------|
| `/token` 响应包含 `skillKey` | Base64，44字符，非空 |
| 同一 deviceId 多次请求 skillKey 相同 | 完全一致（确定性派生）|
| 不同 deviceId 的 skillKey 不同 | 不能相同 |
| RSA 签名包含 skillKey | 客户端验签通过 |
| 老客户端兼容 | 忽略 skillKey 字段，功能正常 |
| 主密钥不出现在任何响应中 | 响应中无 masterKey 相关字段 |

---

## 七、部署注意事项

### 7.1 主密钥生成与存储

```bash
# 1. 生产环境：生成主密钥（只做一次）
SKILL_MASTER_KEY=$(openssl rand -hex 32)
echo $SKILL_MASTER_KEY
# → 保存到服务器环境变量 / AWS Secrets Manager / 阿里云 KMS 等

# 2. 测试环境：单独生成，与生产隔离
```

### 7.2 主密钥不可更换

> ⚠️ **警告**：主密钥一旦投入生产，**不可更换**。
>
> 若更换主密钥，则所有已分发的 `.md.enc` Skill 文件将因 skillKey 变化而无法解密，
> 所有用户的 Skill 内容将显示为空或报错。
>
> 若发生主密钥泄露，需同时重新加密所有 Skill 文件并更新客户端。

### 7.3 上线顺序

```
1. 服务端部署新版本（响应中包含 skillKey）
2. 验收测试通过
3. 客户端 v1.1.21 发布（使用 skillKey 解密）
```

顺序不可颠倒：客户端必须在服务端就绪后才能发布，否则 skillKey 为空时
客户端会 fallback 到旧方案（兼容）。

---

## 八、客户端联动说明

客户端改动由我方完成，服务端只需关注本文档描述的接口变更。
联调完成后，客户端会同步删除 `content-vault.ts` 中的本地密钥派生逻辑，
从根本上消除安全漏洞。

| 模块 | 文件 | 改动 |
|------|------|------|
| token 类型 | `src/license/token.ts` | `LicenseToken` 新增 `skillKey?: string` |
| token 签名验证 | `src/license/token.ts` | `verifyTokenSignature()` 签名内容追加 `skillKey` |
| 密钥注入 | `src/security/content-vault.ts` | 新增 `injectSkillKey()`，`deriveKey()` 优先用注入的 key |
| token 刷新 | `src/license/token.ts` | 刷新成功后调用 `injectSkillKey(token.skillKey)` |

---

## 九、联系人

| 角色 | 负责内容 |
|------|---------|
| 客户端（本方） | TypeScript 客户端改动 |
| 服务端（tecbinhome） | Java 接口改动、主密钥管理、部署 |

---

*文档版本：v1.0 | 2026-02-21 | 安全等级：内部*
