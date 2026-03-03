# 服务端安全接口需求文档

> 客户端代码已全部写好，等服务端接上即可生效。
> 按优先级排序，请后端同事按顺序实现。

---

## API 1：更新包签名（P0 — 半天）

### 背景
客户端已实现 Ed25519 验签，公钥已嵌入客户端代码。
但 CI 发版时没有用私钥签名安装包，验签形同虚设。

### CI / 运维需要做的

1. **一次性生成 Ed25519 密钥对**：使用 openssl 生成 Ed25519 私钥和公钥
2. **私钥存储**：私钥存入 GitHub Secrets，命名为 `UPDATE_SIGNING_PRIVATE_KEY`
3. **公钥同步**：将公钥内容交给客户端同事，替换客户端代码中的嵌入公钥
4. **CI 发版签名**：CI 构建流程最后一步，使用 Ed25519 私钥对每个安装包（.exe / .dmg）进行签名，生成同名的 `.sig` 签名文件
5. **上传分发**：`.sig` 文件必须与安装包一起上传到 OSS/CDN，放在同一目录下

### 客户端行为
- 客户端下载更新时，会自动查找与安装包同名的 `.sig` 文件
- 下载签名文件后，使用内嵌公钥验证签名
- 验签失败 → 拒绝安装该更新

---

## API 2：License 验证响应加 RSA 签名（P0 — 1天）

### 背景
客户端已实现 RSA-2048 验签，公钥嵌在原生 C++ 模块中。
但当前服务端 License 验证 API 返回的响应没有签名，攻击者可以搭假服务器返回伪造的成功响应来绕过授权。

### 接口

`POST https://www.obplugins.cn/api/api/v1/license/verify`

### 响应改动

在现有响应的基础上，**新增一个 `signature` 字段**，其他字段不变。

| 字段 | 类型 | 说明 |
|------|------|------|
| valid | boolean | 是否有效 |
| tier | string | 授权等级（如 "pro"） |
| expiresAt | string | 过期时间，ISO 8601 格式 |
| features | string[] | 功能列表（如 ["agent-team", "orchestrator", "mcp-marketplace"]） |
| deviceId | string | 设备 ID |
| **signature** | **string** | **新增：Base64 编码的 RSA-SHA256 签名** |

### 签名规则

**签名算法**：RSA-SHA256（PKCS#1 v1.5 填充）

**待签名内容的拼接规则**：
- 将以下 5 个字段按顺序用竖线 `|` 拼接为一个字符串
- 顺序为：valid → tier → expiresAt → features → deviceId
- features 字段需要先按字母排序，然后用英文逗号 `,` 拼接
- 整个字符串使用 UTF-8 编码

**拼接示例**：假设 valid=true, tier=pro, expiresAt=2027-01-01T00:00:00Z, features=[agent-team, orchestrator, mcp-marketplace], deviceId=abc123，则待签名字符串为：

`true|pro|2027-01-01T00:00:00Z|agent-team,mcp-marketplace,orchestrator|abc123`

**签名步骤**：
1. 按上述规则拼接出待签名字符串
2. 使用 RSA 私钥 + SHA-256 哈希算法对该字符串进行签名
3. 将签名结果进行 Base64 编码
4. 将 Base64 字符串放入响应的 `signature` 字段

### 密钥管理
- **私钥**：仅存服务端，建议使用阿里云 KMS（密钥管理服务）托管
- **公钥**：已嵌入客户端原生 C++ 模块，无需改动
- **密钥生成**：参考 `docs/server-rsa-upgrade.md` 中的说明

### 客户端行为
- 收到 License 验证响应后，客户端自动提取 `signature` 字段进行验签
- 验签失败 → 拒绝该响应，视为被篡改

---

## API 3：安全违规上报（P1 — 半天）

### 背景
客户端能检测到多种盗版/攻击行为（调试器注入、文件篡改、蜜罐触发等），但目前只在本地记录，重启就丢失。
需要上报到服务端，让运营团队能实时感知盗版行为并采取措施。

### 接口

`POST https://www.obplugins.cn/api/api/v1/license/security-report`

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceId | string | 是 | 设备唯一标识 |
| licenseKey | string | 是 | License Key（如 "OCN-xxxxx"） |
| appVersion | string | 是 | 客户端版本号（如 "1.6.0"） |
| platform | string | 是 | 平台标识（如 "win32-x64"、"darwin-arm64"） |
| violations | array | 是 | 违规事件列表，每项包含以下字段 |

**violations 数组中每项的字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 违规类型（见下表枚举值） |
| timestamp | number | 是 | 事件发生的 Unix 毫秒时间戳 |
| method | string | 否 | 检测方式（仅 debugger_detected 类型使用） |
| file | string | 否 | 被篡改的文件路径（仅 integrity_tampered 类型使用） |
| name | string | 否 | 蜜罐名称（仅 honeypot_triggered 类型使用） |
| detail | string | 否 | 补充信息（仅 env_reinjected 等类型使用） |

### 响应

| 字段 | 类型 | 说明 |
|------|------|------|
| received | boolean | 固定返回 true，表示服务端已收到 |

### 违规类型枚举

| type 值 | 含义 | 严重程度 |
|---------|------|---------|
| `debugger_detected` | 检测到调试器（V8 inspect 端口或 OS 级调试器） | 高 |
| `integrity_tampered` | 受保护的 .jsc 字节码文件 SHA-256 哈希不匹配 | 严重 |
| `honeypot_triggered` | 蜜罐函数被调用（正常使用绝不会触发） | 严重 |
| `function_tampered` | 受保护函数的源代码指纹不匹配（被运行时篡改） | 严重 |
| `checkpoint_failed` | 分散在各模块的验证检查点返回失败 | 高 |
| `env_reinjected` | 已删除的危险环境变量被重新注入 | 中 |
| `cache_hmac_mismatch` | License 本地缓存的 HMAC 签名不匹配 | 高 |
| `anomaly_threshold` | 5 分钟内异常累计次数超过安全阈值 | 严重 |

### 服务端建议处理逻辑

- 同一 License Key 累计 **10 次**违规 → 在后台标记为「可疑用户」
- 同一 License Key 累计 **50 次**违规 → 可选自动吊销该 License
- 违规类型为 `integrity_tampered` 或 `honeypot_triggered` → **立即推送告警通知管理员**（这两种类型说明文件已被破解者修改）

---

## API 4：完整性哈希服务端下发（P1 — 1天）

### 背景
客户端启动时会校验核心文件的完整性（SHA-256 哈希），当前哈希基准值存在客户端本地的 JSON 文件中。
攻击者可以同时替换受保护的 .jsc 文件和哈希文件来绕过校验。
如果哈希基准值从服务端下发，攻击者就无法同时篡改服务端数据，安全性大幅提升。

客户端已实现从服务端拉取哈希的逻辑（5 秒超时，超时自动回退到本地哈希文件）。

### 接口

`GET https://www.obplugins.cn/api/api/v1/license/integrity-hashes`

### 请求参数（Query String）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| version | string | 是 | 客户端版本号（如 "1.6.0"） |
| platform | string | 是 | 平台标识（如 "win32-x64"、"darwin-arm64"） |

### 响应

| 字段 | 类型 | 说明 |
|------|------|------|
| version | string | 对应的版本号 |
| platform | string | 对应的平台 |
| generatedAt | string | 哈希生成时间，ISO 8601 格式 |
| hashes | array | 文件哈希列表，每项包含 file 和 hash 两个字段 |

**hashes 数组中每项的字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| file | string | 文件相对路径（如 "security/anti-debug.jsc"） |
| hash | string | 文件的 SHA-256 哈希值（十六进制小写） |

### 数据来源与入库流程

1. 每次 CI 构建完成后，构建脚本会生成 `dist/security/integrity-hashes.json` 文件，内含所有受保护文件的路径和 SHA-256 哈希
2. CI 最后一步：将该 JSON 文件的内容，按 **version + platform** 作为联合键，存入数据库
3. 每次发版自动覆盖更新（同 version + platform 的记录直接替换）
4. 此 API 根据客户端传入的 version 和 platform 查询数据库，返回对应记录

### 客户端行为
- 启动时自动请求此 API，获取服务端哈希基准值
- 5 秒内未收到响应 → 回退到本地哈希文件
- 收到响应后，逐一校验本地 .jsc 文件的 SHA-256 是否匹配

---

## API 5：功能令牌签名下发（P2 — 2天）

### 背景
当前功能权限由本地 License 缓存决定，攻击者通过 patch 本地判断逻辑即可解锁所有付费功能。
改为服务端签发短期令牌后，即使客户端被全面 patch，没有有效签名令牌也无法使用核心功能。

### 接口

`GET https://www.obplugins.cn/api/api/v1/license/features`

### 请求参数（Query String）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | License Key |
| deviceId | string | 是 | 设备唯一标识 |

### 响应

| 字段 | 类型 | 说明 |
|------|------|------|
| actions | string[] | 该用户可用的功能列表（如 ["agent-team", "orchestrator", "mcp-marketplace", "dispatch"]） |
| expiresAt | number | 令牌过期时间，Unix 毫秒时间戳 |
| signature | string | Base64 编码的 RSA-SHA256 签名 |

### 签名规则

**签名算法**：与 API 2 相同，RSA-SHA256（PKCS#1 v1.5 填充）

**待签名内容的拼接规则**：
- 将以下 3 个字段按顺序用竖线 `|` 拼接
- 顺序为：actions → expiresAt → deviceId
- actions 字段需要先按字母排序，然后用英文逗号 `,` 拼接
- expiresAt 使用数字字符串形式

**拼接示例**：假设 actions=[agent-team, dispatch, mcp-marketplace, orchestrator], expiresAt=1709452800000, deviceId=abc123，则待签名字符串为：

`agent-team,dispatch,mcp-marketplace,orchestrator|1709452800000|abc123`

### 令牌策略
- **有效期**：1 小时
- **刷新频率**：客户端每 50 分钟主动刷新一次
- **离线用户**：走已有的 8 小时离线宽限期机制，不受此令牌影响
- **令牌验签失败或过期**：核心付费功能降级不可用，基础功能仍可正常使用

---

## 汇总

| 序号 | API | 优先级 | 预估工作量 | 客户端代码状态 |
|------|-----|--------|-----------|--------------|
| 1 | 更新包 Ed25519 签名 | P0 | 半天 | 验签已实现，等 CI 配密钥 + 签名流程 |
| 2 | License 响应 RSA 签名 | P0 | 1天 | 验签已实现，等响应新增 signature 字段 |
| 3 | 安全违规上报 | P1 | 半天 | 上报逻辑已写好，等 API 上线 |
| 4 | 完整性哈希下发 | P1 | 1天 | 拉取逻辑已实现，等 API + CI 入库流程 |
| 5 | 功能令牌签名 | P2 | 2天 | 接口已预留 |

### 注意事项

1. **API 2 和 API 5 共用同一套 RSA 密钥对**，私钥只在服务端存储，公钥已嵌入客户端
2. **API 1 使用 Ed25519 密钥对**，与 RSA 密钥无关，需要单独生成
3. 所有签名相关的私钥建议使用阿里云 KMS 托管，不要明文存储在服务器磁盘
4. API 3 的违规上报接口需要做好限流（建议每个 deviceId 每分钟最多 10 次），防止被恶意刷量
5. API 4 的哈希数据需要在每次发版时自动入库，建议在 CI 流程中添加上传步骤

**联系人**：客户端安全模块代码在 `src/security/` 和 `src/license/` 目录下
