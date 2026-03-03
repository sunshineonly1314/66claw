# 安全方案审核意见回复

> 文档版本：v1.1 审核回复
> 日期：2026-03-02
> 针对：license-security-hardening.md v1.0 的 7 条关键问题 + 3 条次要建议

审核意见高质量，每条都切中要害。逐条正面回应，给出决策或修正。

---

## 关键问题回复

---

### 问题1：sessionSalt 表述有误——"不出现在网络请求中"

**审核方说得对，原文表述有误，予以更正。**

#### 事实澄清

sessionSalt 在 `/verify` 响应中明文下发给客户端，攻击者若能做 HTTPS 中间人（MITM），可同时拿到 licenseKey 和 sessionSalt。

#### v2 HMAC 的真实威胁模型（修正后）

v2 HMAC 针对的是**特定攻击者画像**，而非所有攻击者：

| 攻击者类型 | 能力 | v2 HMAC 是否有效 |
|-----------|------|-----------------|
| 拿到泄露 key 列表（暗网购买/内鬼）| 有 key，没抓包，没 sessionSalt | **有效** — 无法构造请求 |
| 正常用户逆向自己的客户端 | 有 key，能读本地缓存，能看抓包 | **无效** — 能拿到全部材料 |
| 工具作者（职业破解者） | 完整逆向能力，有 MITM 能力 | **无效** — 能绕过 |

#### 结论与决策

- **保留改造1**，但价值定位调整为：**防止 key 泄露后的批量滥用**（最高价值场景），不宣称防止逆向。
- **文档相应修正**：删除"不出现在网络请求中"的错误表述，改为明确威胁模型边界。
- 对于有 MITM 能力的攻击者，主要防线依然是改造4（feature-token 内存持有）和服务端实时校验，这两者不依赖 sessionSalt。

---

### 问题2：sessionSalt 刷新时机——心跳是否也刷新 salt？

**原文逻辑不完整，这里给出完整决策。**

#### 确定方案：心跳响应也返回新 salt

```
/verify  响应：sessionSalt + saltExpiresAt（首次获取）
/heartbeat 响应：sessionSalt + saltExpiresAt（每 4 小时刷新）
```

即 saltExpiresAt 实际上等同于"上次心跳时间 + 缓冲"，24 小时的意义是：
- 正常使用时：每 4 小时心跳刷新一次，salt 始终有效
- 断网时：salt 在断网后最多再撑 24 小时（覆盖 72 小时离线期的前段）

#### 客户端降级逻辑修正

原文描述"回退到 v1 签名 + 触发重新 verify"**不准确**，修正为：

```
salt 状态          客户端行为
─────────────────────────────────────────────────────
有效（未过期）     使用 v2 HMAC 签名
过期（断网中）     使用 v1 HMAC 签名（兼容模式）
                  不触发完整激活流程，只是降级签名
过期（网络恢复）   心跳成功后自动获得新 salt，切回 v2
```

**用户永远不会经历"每天重新激活"**，salt 随心跳静默续期，用户无感知。

---

### 问题3：feature-token 降级策略矛盾——到底降不降？

**这是最重要的产品决策点，需要拍板。**

#### 审核方说得对：原文矛盾，需要明确

两个方向各有代价，必须选一个：

**方向 A：高价值功能不允许降级（强安全）**

```
有内存令牌 → 用令牌中的 features 判断
无内存令牌（断网）→ 高价值功能直接拒绝，返回"需要联网验证"
```

- 安全性：攻击者改缓存完全无效
- 体验代价：断网后 agent-team、orchestrator 等功能立即不可用
- 适用场景：企业/专业用户，有稳定网络

**方向 B：分级处理（平衡安全与体验）**

```
功能分级：
  基础功能（对话、模型切换）→ 允许离线缓存降级，缓存有效期内可用
  高价值功能（agent-team、orchestrator、memory-core）→ 不允许降级，无令牌则拒绝

离线状态下：
  有效令牌（4小时内）→ 全功能
  令牌过期但缓存有效 → 基础功能可用，高价值功能显示"需要联网"
  缓存过期（72小时）→ 全部锁定
```

- 安全性：高价值功能（核心商业价值）受到严格保护
- 体验代价：断网后高价值功能不可用，但基础功能正常
- 适用场景：大多数用户接受度更高

#### 推荐决策：**方向 B，分级处理**

理由：高价值功能（agent-team、orchestrator）是商业差异化核心，值得强保护；基础对话功能强制联网会让所有用户体验变差，得不偿失。

**需要产品侧确认：** `agent-team`、`orchestrator`、`memory-core` 是否列为"不允许离线"功能？

#### 文档修正后的 checkFeatureAccess 逻辑

```typescript
// 高价值功能列表（不允许离线降级）
const HIGH_VALUE_FEATURES = new Set([
  "agent-team",
  "orchestrator",
  "memory-core",
]);

async function checkFeatureAccess(feature: string): Promise<boolean> {
  // 1. 优先：内存令牌（服务端背书）
  const token = getFeatureToken();
  if (token) {
    return verifyTokenFeature(token, feature);
  }

  // 2. 高价值功能：令牌不存在则拒绝（不允许降级）
  if (HIGH_VALUE_FEATURES.has(feature)) {
    return false;  // 提示"需要联网验证"
  }

  // 3. 基础功能：降级到缓存
  const cache = await getOfflineCache();
  return cache?.features?.includes(feature) ?? false;
}
```

---

### 问题4：clientHealth 信号全部可伪造

**审核方说得对，这层防护对专业攻击者无效。**

#### 明确定位

clientHealth 的价值层级：

```
防护价值           针对的攻击者
─────────────────────────────────────────────────
有效               普通用户 patch（直接改代码但不知道有上报）
部分有效           中级攻击者（知道有上报，但漏改部分字段）
无效               专业破解者（完整逆向，知道所有字段，全部伪造）
```

#### 结论与决策

- **保留改造5**，但文档明确定位为：**辅助信号，不是主防线**
- 其核心价值是：收集真实用户的破解尝试数据（大多数人只是简单 patch，不会 patch 上报字段），为运营分析提供数据
- 文档新增明确说明："专业攻击者可绕过此层，主防线是 feature-token 服务端校验"

---

### 问题5：`_tier_limit` 字段必须包含在 RSA 签名中

**审核方说得对，这是严重设计缺陷，已纳入修正。**

#### 修正方案

心跳响应的 RSA 签名内容从：

```
// 旧：valid|daysRemaining|serverTime
```

扩展为：

```
// 新：valid|daysRemaining|serverTime|tierLimit
// tierLimit = "" 表示无限制，"basic" 表示强制降到基础版
```

客户端现有的 `verifyHeartbeatResponseSignature` 函数，其验签内容字符串同步更新：

```typescript
// src/license/rsa-verify.ts
// 修改 buildHeartbeatSignContent：
const signContent = `${valid}|${daysRemaining}|${serverTime}|${tierLimit ?? ""}`;
```

**这条修改必须在改造5上线前完成，否则 `_tier_limit` 字段形同虚设。**

#### 同步修改列表

| 位置 | 修改内容 |
|------|---------|
| `src/license/rsa-verify.ts` | heartbeat 签名字符串加入 `tierLimit` |
| `src/license/verify.ts` | `sendHeartbeat` 解析 `tierLimit`，传入验签函数 |
| 服务端 `/heartbeat` 接口 | 签名 payload 加入 `tierLimit` 字段 |

---

### 问题6：吊销列表用 SHA256 前 16 位，改为前 32 位

**审核方说得对，改前 32 位（128 bit），无任何代价，碰撞概率从 2^-64 降到 2^-128。**

#### 决策

直接改，原文中所有"前 16 位"改为"前 32 位"：

```typescript
// 修正
biosUuidHash: sha256(biosUuid).slice(0, 32),   // 128 bit
macHash: sha256(physicalMac).slice(0, 32),
// 吊销列表
revokedKeys: [sha256(licenseKey).slice(0, 32)]  // 128 bit，碰撞率 2^-128
```

---

### 问题7：AES-256-CTR 密钥管理细节缺失

**审核方指出的是关键问题，补充完整链路。**

#### 完整密钥管理链路

```
构建时（CI 环境）：
  OBFUSCATION_KEY = CI 环境变量（32字节随机，每个版本不同）
         │
         ▼
  AES-256-CTR 加密所有 .jsc 文件
  OBFUSCATION_KEY 本身 → 用"构建时密钥包装密钥（KWK）"再加密
         │
         ▼
  KWK_ENCRYPTED_OBFUSCATION_KEY 嵌入 loader stub（二进制，非明文）
         │
         ▼
运行时（客户端）：
  loader stub 读取 KWK_ENCRYPTED_OBFUSCATION_KEY
  用硬编码在 native C++ addon 中的 KWK 解密得到 OBFUSCATION_KEY
  AES-256-CTR 解密 .jsc 文件 → 传给 bytenode 执行
```

#### 密钥保护层次

| 密钥 | 存储位置 | 提取难度 |
|------|---------|---------|
| `OBFUSCATION_KEY` | 加密后嵌入 loader，不出现明文 | 中（需先破 native addon） |
| `KWK`（密钥包装密钥） | native C++ addon 中（编译后） | 高（需逆向 .node 二进制） |
| CI 环境变量 | CI 服务器，不入代码库 | 很高（需入侵 CI） |

#### 每版本不同密钥

```
OBFUSCATION_KEY = HKDF-SHA256(
  ikm  = CI_MASTER_SECRET,   // CI 环境变量，长期保存
  salt = BUILD_TIMESTAMP,    // 每次构建不同
  info = "openclawcn-obfuscation-v1"
)
```

效果：即使某个版本的密钥泄露，只影响该版本，其他版本密钥不同。

**保留原有限制不变**：即使攻击者提取了 OBFUSCATION_KEY 并解密 .jsc，仍面对 V8 字节码反编译的困难，两层防护串联。

---

## 次要建议回复

---

### 次要1：速率限制"延迟 30 秒"的 DoS 风险

**审核方说得对。**

修正：改为直接返回 429，不做同步阻塞。

```javascript
// 错误做法（原文）
await sleep(30000);  // 阻塞服务端线程 → 攻击者并发放大成 DoS
return res.status(200).json(...);

// 正确做法（修正）
return res.status(429).json({
  code: 429,
  message: "请求过于频繁，请稍后再试",
  retryAfter: 30  // 告知客户端等待时间，不阻塞服务端
});
// 封禁逻辑用 Redis TTL 实现，不阻塞
```

---

### 次要2：installTimestamp 作为设备指纹因子可被复制

**审核方说得对，这个因子价值有限。**

#### 替换方案

将 `installTimestamp` 替换为更难复制的因子：

| 候选因子 | Windows | macOS | 可复制性 |
|---------|---------|-------|---------|
| 磁盘序列号 | `wmic diskdrive get serialNumber` | `diskutil info /` | 低（需实际磁盘） |
| 主板序列号 | `wmic baseboard get serialnumber` | `ioreg -c IOPlatformExpertDevice` | 低（需实际硬件） |
| TPM 设备 ID | `Get-TpmVersion` | N/A | 极低（硬件绑定） |
| CPU ID | `wmic cpu get processorId` | `sysctl -n machdep.cpu.brand_string` | 低 |

**推荐**：Windows 用磁盘序列号（`diskdrive serialNumber`），macOS 用 `IOPlatformUUID`（已在 device-id.ts 中有实现）。

注意：设备指纹改造（改造7）本来是 P2 优先级，这个因子替换可以同步进行，不增加额外工作量。

---

### 次要3：漏洞 C（公钥指纹硬编码）无对应修复项

**这是一个有意识的"接受风险"决策，原文未说明，补充如下。**

#### 为什么不修复

公钥硬编码是 **RSA 体系的标准做法**，不是缺陷：

- 公钥本来就是公开的，攻击者知道公钥，也无法从公钥推导私钥
- 真正的风险是：攻击者用自己的私钥 + 替换客户端公钥 → 伪造签名
- 这个攻击需要**同时做两件事**：生成自己的 RSA 密钥对 + 修改客户端二进制

#### 真正的缓解措施（已有）

- native C++ addon 中存储公钥（比 JS 更难 patch）
- V8 字节码保护（公钥字符串在字节码常量池里，需要专用工具提取）
- feature-token 机制（即使公钥被替换，攻击者自建 license 服务器，也无法获取真正的 feature-token，因为 feature-token 由我们服务端下发，攻击者控制不了）

#### 结论

**接受风险，不新增修复项。** 改造4（feature-token）已经从根本上限制了"替换公钥 + 自建服务器"的收益，因为高价值功能令牌不来自本地签名，来自我们服务端。

---

## 修订后文档更新列表

以下条目需在 v1.0 文档中更新（由原作者统一修订后出 v1.1）：

| 编号 | 修改位置 | 修改内容 |
|------|---------|---------|
| R1 | 改造1·效果描述 | 更正威胁模型边界，删除"不出现在网络请求中"表述 |
| R2 | 改造1·客户端降级逻辑 | 明确 salt 随心跳刷新，降级只换签名算法，不触发重新激活 |
| R3 | 改造4·降级策略 | 明确分级处理：高价值功能不降级，基础功能允许缓存降级 |
| R4 | 改造4·代码示例 | 更新 `checkFeatureAccess` 实现，加入 `HIGH_VALUE_FEATURES` 判断 |
| R5 | 改造5·定位描述 | 明确"辅助信号，非主防线" |
| R6 | 改造5·`_tier_limit` | 明确必须纳入 RSA 签名 payload，列出同步修改清单 |
| R7 | 改造6·hash 长度 | 前 16 位 → 前 32 位 |
| R8 | 改造3·密钥管理 | 补充完整密钥链路（KWK + 每版本派生密钥） |
| R9 | 改造2·速率限制 | 延迟阻塞 → 直接 429 |
| R10 | 改造7·installTimestamp | 替换为磁盘序列号 hash |
| R11 | 漏洞C | 补充"接受风险"说明及现有缓解措施 |

---

## 核心结论

7 条关键问题：

- **问题1、2**：文档表述有误，已修正，方案本身仍然有价值（防 key 泄露场景）
- **问题3**：需要产品侧拍板高价值功能是否允许离线，推荐方向 B（分级处理）
- **问题4**：防护定位明确调整为辅助信号，不影响方案整体结构
- **问题5**：严重设计缺陷，已给出修正，上线前必须完成
- **问题6**：简单修正（16→32位），无争议
- **问题7**：补充了完整密钥管理链路

整体方案架构不变，需要产品侧决策的只有**问题3（feature-token 降级策略）**。建议本周内拍板，不影响 P0 改造并行推进。
