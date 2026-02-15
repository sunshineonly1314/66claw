# 服务端 RSA 签名改造文档

> 创建时间：2026-02-03
> 状态：待实施
> 优先级：P0（重要安全措施）

---

## 一、改造目标

将许可证验证响应从 **HMAC 对称签名** 升级为 **RSA 非对称签名**。

**安全收益：**
- 即使客户端代码被反编译，攻击者只能获取公钥
- 没有私钥，无法伪造有效的许可证签名
- 彻底解决"签名密钥硬编码"的安全隐患
- 包含 serverTime 防止重放攻击

---

## 二、改造范围

| 接口 | 改动内容 |
|------|----------|
| `POST /api/v1/license/verify` | 响应中增加 `signature` 字段 |
| `POST /api/v1/license/heartbeat` | 响应中增加 `signature` 字段 |

**不需要改动的接口：**
- `/api/v1/license/devices` - 设备列表
- 其他接口

**保留的机制：**
- 客户端→服务端的 HMAC 请求签名继续保留（两者互补）

---

## 三、实施步骤

### 步骤 1：生成 RSA 密钥对

```bash
# 生成 2048 位 RSA 私钥
openssl genrsa -out openclawcn_license_private.pem 2048

# 从私钥导出公钥
openssl rsa -in openclawcn_license_private.pem -pubout -out openclawcn_license_public.pem
```

**密钥存储：**
- `openclawcn_license_private.pem` → 服务端环境变量或密钥管理系统（**绝不能泄露**）
- `openclawcn_license_public.pem` → 发给客户端开发者，硬编码到客户端

---

### 步骤 2：修改验证接口响应

**当前响应格式：**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "valid": true,
    "errorCode": null,
    "errorMessage": null,
    "serverTime": 1706947200000,
    "nextCheckAfterHours": 24,
    "license": {
      "tier": "basic",
      "tierName": "基础版",
      "expiresAt": "2026-12-31T23:59:59Z",
      "daysRemaining": 332,
      "keyType": "standard",
      "features": ["basic_chat", "basic_skills"]
    },
    "device": {
      "deviceId": "xxx-xxx-xxx",
      "deviceLimit": 2,
      "boundDevices": 1,
      "isCurrentBound": true
    },
    "notifications": null,
    "renewalReminder": null,
    "forceUpdate": null
  }
}
```

**改造后响应格式：**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "valid": true,
    "errorCode": null,
    "errorMessage": null,
    "serverTime": 1706947200000,
    "nextCheckAfterHours": 24,
    "license": { ... },
    "device": { ... },
    "notifications": null,
    "renewalReminder": null,
    "forceUpdate": null,
    "signature": "Base64编码的RSA签名"  // ← 新增字段
  }
}
```

---

### 步骤 3：签名生成逻辑

**重要：使用固定字段拼接，避免 JSON 序列化顺序差异**

#### /verify 接口签名格式

```
签名内容 = "valid|tier|expiresAt|serverTime"
```

| 字段 | 类型 | 说明 |
|------|------|------|
| valid | boolean | 验证是否通过（true/false） |
| tier | string | 产品等级（basic/test），验证失败时为空字符串 |
| expiresAt | string | 过期时间 ISO 字符串，验证失败时为空字符串 |
| serverTime | long | 服务器时间戳（毫秒） |

**示例：**
```
# 验证成功
true|basic|2026-12-31T23:59:59Z|1706947200000

# 验证失败
false||1706947200000
```

#### /heartbeat 接口签名格式

```
签名内容 = "valid|daysRemaining|serverTime"
```

| 字段 | 类型 | 说明 |
|------|------|------|
| valid | boolean | 是否有效 |
| daysRemaining | int | 剩余天数 |
| serverTime | long | 服务器时间戳（毫秒） |

**示例：**
```
true|30|1706947200000
```

---

**签名算法：** SHA256withRSA

#### Java 实现示例

```java
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.nio.charset.StandardCharsets;

public class LicenseSignature {
    
    private static PrivateKey privateKey;
    
    // 初始化时加载私钥
    static {
        try {
            String privateKeyPem = System.getenv("LICENSE_RSA_PRIVATE_KEY");
            // 去除 PEM 头尾和换行
            String privateKeyContent = privateKeyPem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
            
            byte[] keyBytes = Base64.getDecoder().decode(privateKeyContent);
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            privateKey = keyFactory.generatePrivate(spec);
        } catch (Exception e) {
            throw new RuntimeException("Failed to load RSA private key", e);
        }
    }
    
    /**
     * 对 /verify 响应进行签名
     * 签名内容格式：valid|tier|expiresAt|serverTime
     */
    public static String signVerifyResponse(
            boolean valid,
            String tier,        // 验证失败时为 null
            String expiresAt,   // 验证失败时为 null
            long serverTime
    ) throws Exception {
        // 构建签名内容（null 转为空字符串）
        String signContent = String.format("%s|%s|%s|%d",
            valid,
            tier != null ? tier : "",
            expiresAt != null ? expiresAt : "",
            serverTime
        );
        
        return sign(signContent);
    }
    
    /**
     * 对 /heartbeat 响应进行签名
     * 签名内容格式：valid|daysRemaining|serverTime
     */
    public static String signHeartbeatResponse(
            boolean valid,
            int daysRemaining,
            long serverTime
    ) throws Exception {
        String signContent = String.format("%s|%d|%d",
            valid,
            daysRemaining,
            serverTime
        );
        
        return sign(signContent);
    }
    
    /**
     * RSA 签名
     */
    private static String sign(String content) throws Exception {
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initSign(privateKey);
        signature.update(content.getBytes(StandardCharsets.UTF_8));
        byte[] signatureBytes = signature.sign();
        return Base64.getEncoder().encodeToString(signatureBytes);
    }
}
```

#### Spring Boot Controller 示例

```java
@PostMapping("/verify")
public ApiResponse<LicenseVerifyResponse> verify(@RequestBody LicenseVerifyRequest request) {
    // 1. 正常的验证逻辑
    LicenseVerifyResponse data = licenseService.verify(request);
    
    // 2. 生成签名（使用固定字段拼接）
    String signature = LicenseSignature.signVerifyResponse(
        data.isValid(),
        data.getLicense() != null ? data.getLicense().getTier() : null,
        data.getLicense() != null ? data.getLicense().getExpiresAt() : null,
        data.getServerTime()
    );
    
    // 3. 设置签名到响应
    data.setSignature(signature);
    
    return ApiResponse.success(data);
}

@PostMapping("/heartbeat")
public ApiResponse<HeartbeatResponse> heartbeat(@RequestBody HeartbeatRequest request) {
    HeartbeatResponse data = licenseService.heartbeat(request);
    
    String signature = LicenseSignature.signHeartbeatResponse(
        data.isValid(),
        data.getDaysRemaining(),
        data.getServerTime()
    );
    
    data.setSignature(signature);
    
    return ApiResponse.success(data);
}
```

#### Node.js 实现示例

```javascript
const crypto = require('crypto');

// 从环境变量加载私钥
const PRIVATE_KEY = process.env.LICENSE_RSA_PRIVATE_KEY;

/**
 * RSA 签名
 */
function sign(content) {
    const sign = crypto.createSign('SHA256');
    sign.update(content, 'utf8');
    return sign.sign(PRIVATE_KEY, 'base64');
}

/**
 * 对 /verify 响应进行签名
 */
function signVerifyResponse(valid, tier, expiresAt, serverTime) {
    const signContent = `${valid}|${tier || ''}|${expiresAt || ''}|${serverTime}`;
    return sign(signContent);
}

/**
 * 对 /heartbeat 响应进行签名
 */
function signHeartbeatResponse(valid, daysRemaining, serverTime) {
    const signContent = `${valid}|${daysRemaining}|${serverTime}`;
    return sign(signContent);
}

// 使用示例
app.post('/api/v1/license/verify', (req, res) => {
    const data = verifyLicense(req.body);
    
    data.signature = signVerifyResponse(
        data.valid,
        data.license?.tier,
        data.license?.expiresAt,
        data.serverTime
    );
    
    res.json({ code: 200, message: 'success', data });
});
```

---

## 四、重要注意事项

### 4.1 serverTime 防重放攻击

**客户端会验证 serverTime：**
- 检查 serverTime 与本地时间差不超过 **5 分钟**
- 超过则拒绝响应，提示"服务器时间偏差过大，可能是重放攻击"

**服务端要求：**
- serverTime 必须是当前服务器时间（毫秒时间戳）
- 确保服务器时间准确（建议使用 NTP 同步）

### 4.2 私钥安全

- **绝不能** 将私钥提交到代码仓库
- **绝不能** 在日志中打印私钥
- 建议使用环境变量或密钥管理服务（如 AWS KMS、HashiCorp Vault）

### 4.3 版本兼容

**过渡期建议：**
1. 服务端先添加 `signature` 字段（旧客户端会忽略）
2. 客户端升级后，开启 RSA 验证
3. 稳定后，服务端可以移除旧的 HMAC 签名逻辑

---

## 五、测试验证

### 5.1 本地测试

```bash
# 生成测试密钥对
openssl genrsa -out test_private.pem 2048
openssl rsa -in test_private.pem -pubout -out test_public.pem

# 测试签名
echo '{"valid":true,"serverTime":1706947200000}' > test_data.json
openssl dgst -sha256 -sign test_private.pem -out signature.bin test_data.json
base64 signature.bin > signature.b64

# 测试验证
openssl dgst -sha256 -verify test_public.pem -signature signature.bin test_data.json
# 输出: Verified OK
```

### 5.2 集成测试清单

- [ ] 正常许可证验证通过
- [ ] 篡改响应数据后，签名验证失败
- [ ] 伪造签名后，验证失败
- [ ] 旧客户端（无 RSA 验证）正常工作

---

## 六、上线步骤

1. **服务端部署**
   - 生成正式密钥对
   - 配置私钥到环境变量
   - 部署带签名的验证接口
   - 验证接口正常工作

2. **客户端配置**
   - 将公钥发给客户端开发者
   - 客户端更新公钥（`src/license/rsa-verify.ts`）
   - 客户端开启 RSA 验证（`enableRsaVerify: true`）
   - 发布新版本

---

## 七、回滚方案

如果出现问题：
1. 客户端：将 `enableRsaVerify` 改回 `false`，发布热修复版本
2. 服务端：无需回滚（`signature` 字段对旧客户端无影响）

---

> 最后更新：2026-02-03
> 客户端开发者：已准备好，等待公钥
> 服务端开发者：待实施
