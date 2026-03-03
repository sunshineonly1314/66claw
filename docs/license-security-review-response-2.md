# 安全方案审核意见回复（第二轮）

> 文档版本：v1.2 审核回复
> 日期：2026-03-02
> 针对服务端第二轮 4 条技术问题

---

## 问题1：改造1 和改造4 的依赖链，P1 排期是否被卡？

**结论：feature-token 接口不依赖 v2 HMAC，可独立上线，依赖链不存在。**

### 澄清

feature-token 接口的请求签名可以独立设计，与 v2 HMAC 解耦：

```
阶段一（P0）：改造1 上线
  /verify 和 /heartbeat 新增 sessionSalt 下发
  /heartbeat 支持 v2 HMAC 验签

阶段二（P1）：改造4 独立上线
  /feature-token 接口使用什么签名？
  → 直接复用 /verify 已有的签名方式即可
  → 甚至可以不做请求签名，改为：服务端验证 licenseKey + deviceId 组合是否在库中绑定
  → 最简单、最安全：服务端直接查库，不依赖客户端签名
```

### 推荐做法：feature-token 接口用服务端查库，不做客户端签名验证

原因：

- feature-token 的安全核心是**服务端发什么**，而不是**客户端签了什么**
- 客户端带 `{ licenseKey, deviceId }` 过来，服务端查库验证绑定关系，没问题就签发 JWT
- 客户端能伪造 `{ licenseKey, deviceId }`？可以，但伪造的 key 查库是无效的
- 所以签名在这个接口上几乎没有额外价值，反而引入依赖

### 排期结论

```
P0（本周）：改造1、改造2、改造3
P1（下周）：改造4、改造5、改造6   ← 和 P0 无依赖，可并行推进
P2（之后）：改造7
```

改造4 可以与改造1 并行开发，**不需要等改造1 上线**。

---

## 问题2：心跳刷新 salt 的竞态——服务端保留新旧两个 salt

**结论：方案正确，保留 `current_salt` + `previous_salt`，两个都可以通过验签。**

### 服务端数据库结构

```sql
ALTER TABLE license_devices
  ADD COLUMN current_salt      VARCHAR(64),
  ADD COLUMN current_salt_exp  BIGINT,
  ADD COLUMN previous_salt     VARCHAR(64),
  ADD COLUMN previous_salt_exp BIGINT;
```

### 服务端 salt 轮换逻辑

```
收到心跳请求，验签时：
  1. 用 current_salt 验签 → 通过？继续
  2. 用 previous_salt 验签 → 通过？继续（说明客户端是旧 salt，正常竞态）
  3. 两个都失败 → 降级到 v1 HMAC 验签（向后兼容）

验签通过后，生成新 salt，轮换：
  previous_salt     = current_salt
  previous_salt_exp = current_salt_exp
  current_salt      = newSalt
  current_salt_exp  = now + 24h

响应中返回 current_salt（客户端更新本地缓存）
```

### 客户端处理

客户端收到心跳响应后更新缓存中的 salt。如果客户端在收到响应前崩溃：

- 客户端重启，缓存里是旧 salt
- 发心跳时用旧 salt 签名
- 服务端用 previous_salt 验签 → 通过
- 服务端返回新 current_salt，客户端更新
- 竞态自动修复

### previous_salt 的有效期

`previous_salt_exp` 建议设为 `current_salt 生成时间 + 8小时`（不是 24 小时）：

- 正常心跳间隔 4 小时，8 小时的 previous 窗口足够覆盖一次心跳失败重试
- 不要设太长，避免旧 salt 泄露后长期有效

---

## 问题3：KWK 在 native addon 中的实际保护预期

**明确回答：预期是"阻止大部分逆向者，对有 IDA 经验的攻击者增加数小时成本"，而不是"完全阻止专业逆向"。**

### 为什么这个预期是合理的

代码保护没有绝对安全，只有成本对抗。评估标准是：

```
攻击收益（破解后能得到什么）vs 攻击成本（花多少时间）
```

即使攻击者从 native addon 里提取了 KWK，获得了 OBFUSCATION_KEY，并解密了 .jsc：

- 他还要面对 V8 字节码反编译（工具不成熟，耗时 1-3 天）
- 即使拿到源码，license 验证核心逻辑仍然依赖服务端 RSA 签名（无法伪造）
- 即使 patch 了客户端验签，也拿不到 feature-token（服务端签发）
- 破解收益：只能让本地缓存认为 valid=true，但高价值功能仍受 feature-token 限制

**结论：AES-256-CTR + KWK 这层的价值是阻挡 80% 的普通逆向者，让剩余 20% 的专业逆向者多花时间。** 主防线不是字节码，而是 feature-token 服务端校验。

### 关于白盒加密（White-Box AES）

白盒加密可以让 KWK 提取难度从"数小时"提升到"数天至数周"，代价是：

- 需要专门的白盒 AES 工具库（如 Chow/Michiels 方案）
- native addon 体积增大约 256KB（查找表）
- 构建工具链复杂度显著上升

**当前阶段建议：暂不投入白盒加密。** 等 feature-token 机制上线、验证破解者攻击路径后，再评估白盒加密的 ROI。因为如果 feature-token 防线有效，字节码的破解收益本身就极低，白盒加密的边际收益不足以覆盖成本。

---

## 问题4：吊销时效性——在签发 feature-token 时直接拒绝已吊销 key

**结论：采用对方建议，在服务端签发 feature-token 时直接检查吊销状态，废弃独立的吊销查询接口（改造6）。**

### 为什么这个方案更好

原来的改造6（独立吊销接口 + 心跳顺带查询）存在以下问题：

1. 最坏情况 4 小时延迟（心跳间隔）
2. 增加了额外接口，维护成本高
3. 吊销响应需要 RSA 签名，否则可伪造，设计复杂

服务端在签发 feature-token 时检查吊销：

```
/feature-token 服务端逻辑：
  1. 验证 licenseKey + deviceId 绑定关系
  2. 查询 license 是否被吊销（新增一步，查同一张表）→ 已吊销则返回 { code: 403, reason: "revoked" }
  3. 未吊销 → 签发 JWT
```

### 实际吊销时效

```
feature-token 有效期：4 小时
吊销后，客户端最多可用：当前令牌剩余有效期（0~4 小时）
下次刷新令牌时（最迟 4 小时后）：服务端拒绝签发 → 客户端无新令牌 → 高价值功能锁定
```

这个时效已经完全可以接受，不需要额外手段。

### 心跳也同步检查吊销（一行逻辑，顺手做）

心跳响应可以新增一个字段 `revoked: boolean`：

```
/heartbeat 服务端处理时，顺手查一下吊销表：
  如果 revoked=true：
    返回 { valid: false, revoked: true }（包含在 RSA 签名内容中）
    客户端清缓存、清 feature-token、通知用户
```

这不是新接口，只是心跳响应多一个字段，服务端一行查询，客户端一个分支判断。

### 废弃改造6（独立吊销接口）

原改造6 的功能，由以下两个机制联合覆盖，独立接口不再需要：

| 机制 | 吊销感知时机 |
|------|------------|
| feature-token 签发时检查 | 当前令牌到期后（最多 4 小时） |
| heartbeat 顺带字段 | 每 4 小时一次，与 feature-token 刷新错开约 2 小时 |

实际最坏时效约 2 小时，满足需求，无需额外接口。

---

## 修订后影响文档更新列表

| 编号 | 修改位置 | 修改内容 |
|------|---------|---------|
| R12 | 优先级表 | P1 说明不依赖 P0，可并行推进；改造4 不要求 v2 HMAC |
| R13 | 改造1 | 补充 previous_salt 竞态处理方案 |
| R14 | 改造3 | 补充白盒加密评估结论：暂不投入，说明理由 |
| R15 | 改造6 | 废弃独立吊销接口；改为：feature-token 签发时检查 + heartbeat 顺带字段 |
| R16 | 服务端工作量表 | 删除 S6（独立吊销接口）；S4（feature-token）新增"签发时检查吊销"；S5（heartbeat）新增 `revoked` 字段 |

---

## 最终方案确认状态

| 改造项 | 状态 | 备注 |
|--------|------|------|
| 改造1：sessionSalt | 确认，补充 previous_salt 竞态处理 | |
| 改造2：速率限制 | 确认，直接 429 | |
| 改造3：AES-256-CTR | 确认，暂不做白盒加密 | |
| 改造4：feature-token | 确认，不依赖改造1，可并行 | |
| 改造5：clientHealth | 确认，辅助信号定位，`_tier_limit` 纳入 RSA 签名 | |
| 改造6：独立吊销接口 | **废弃**，合并进 feature-token 签发 + heartbeat 字段 | |
| 改造7：多因子指纹 | P2，磁盘序列号替换 installTimestamp | |

**方案无阻塞问题，可进入开发排期。**
