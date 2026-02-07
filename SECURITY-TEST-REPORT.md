# 安全模块深度测试报告

**测试工程师**: B  
**测试日期**: 2026-02-04  
**测试范围**: License 模块、Gateway License 方法、Chat 附件 ID 生成

---

## 执行摘要

本次安全测试针对以下三个关键安全模块进行了深度分析：

1. **RSA 签名验证模块** (`src/license/rsa-verify.ts`)
2. **License Gateway 输入验证** (`src/gateway/server-methods/license.ts`)
3. **Chat 附件 ID 生成** (`ui/src/ui/views/chat.ts`)

**总体评估**: 代码整体安全设计良好，但存在一些需要加固的安全边界条件。

---

## 1. RSA 签名验证模块 (`src/license/rsa-verify.ts`)

### ✅ 测试通过项

1. **RSA 公钥硬编码**: ✅ 正确实现
   - 公钥安全地硬编码在客户端
   - 使用 2048 位 RSA 密钥，符合安全标准

2. **签名验证流程**: ✅ 正确实现
   - 使用 SHA256 哈希算法
   - 正确使用 Node.js crypto 模块的 `createVerify`
   - Base64 解码处理正确

3. **重放攻击防护**: ✅ 基本实现
   - 实现了 `verifyServerTime` 函数
   - 5 分钟时间窗口限制合理

4. **签名内容格式**: ✅ 正确实现
   - 使用固定字段顺序: `valid|tier|expiresAt|serverTime`
   - 避免了 JSON 序列化差异问题

### ⚠️ 安全问题

#### 🔴 高危问题

1. **时间窗口过大**
   - **位置**: `rsa-verify.ts:46`
   - **问题**: `MAX_SERVER_TIME_DRIFT_MS = 5 * 60 * 1000` (5分钟) 时间窗口过大
   - **风险**: 攻击者可以在 5 分钟内重放有效的签名响应
   - **建议**: 将时间窗口缩短到 1-2 分钟，或实现 nonce 机制

2. **错误处理信息泄露**
   - **位置**: `rsa-verify.ts:69`
   - **问题**: 错误日志可能泄露内部实现细节
   - **风险**: 攻击者可能通过错误信息推断系统行为
   - **建议**: 统一错误消息，避免泄露技术细节

#### 🟡 中危问题

3. **expiresAt 标准化逻辑可能被绕过**
   - **位置**: `rsa-verify.ts:80-92`
   - **问题**: `normalizeExpiresAt` 函数只检查是否以 "Z" 结尾，可能被特殊格式绕过
   - **风险**: 如果服务端返回非标准格式，可能导致签名验证失败或绕过
   - **建议**: 使用更严格的 ISO 8601 格式验证

4. **缺少签名内容长度限制**
   - **位置**: `buildSignContent` 函数
   - **问题**: 没有对签名内容长度进行限制
   - **风险**: 恶意输入可能导致内存消耗或 DoS
   - **建议**: 添加合理的长度限制（如 1024 字符）

#### 🟢 低危问题

5. **公钥更新机制不明确**
   - **位置**: `rsa-verify.ts:29-30`
   - **问题**: 注释提到更新公钥需要同时更新服务端，但缺少版本管理机制
   - **建议**: 实现公钥版本管理，支持多版本公钥并存

### 🔒 安全加固建议

1. **缩短时间窗口**
   ```typescript
   const MAX_SERVER_TIME_DRIFT_MS = 2 * 60 * 1000; // 2 分钟
   ```

2. **添加 nonce 机制**
   - 在签名内容中包含客户端生成的 nonce
   - 服务端维护 nonce 缓存，防止重放

3. **增强错误处理**
   ```typescript
   catch (error) {
     log.error("RSA signature verification failed"); // 不泄露具体错误
     return false;
   }
   ```

4. **添加输入验证**
   ```typescript
   if (signContent.length > 1024) {
     log.warn("Sign content too long");
     return false;
   }
   ```

---

## 2. License Gateway 输入验证 (`src/gateway/server-methods/license.ts`)

### ✅ 测试通过项

1. **输入类型验证**: ✅ 正确实现
   - `validateLicenseKey` 和 `validateDeviceId` 都检查了类型
   - 正确处理了 null/undefined 情况

2. **长度限制**: ✅ 正确实现
   - License key: 8-256 字符
   - Device ID: 1-128 字符

3. **字符集限制**: ✅ 正确实现
   - 使用正则表达式限制允许的字符
   - 防止特殊字符注入

4. **输入清理**: ✅ 正确实现
   - 使用 `trim()` 清理空白字符

### ⚠️ 安全问题

#### 🟡 中危问题

1. **正则表达式可能被绕过**
   - **位置**: `license.ts:40, 43`
   - **问题**: 正则 `/^[a-zA-Z0-9\-_]+$/` 可能被 Unicode 字符绕过
   - **风险**: 某些 Unicode 字符可能被误判为合法字符
   - **建议**: 使用更严格的字符集验证，或使用 `\p{ASCII}`

2. **缺少速率限制**
   - **位置**: `license.activate` 处理器
   - **问题**: 没有对激活请求进行速率限制
   - **风险**: 攻击者可以进行暴力破解或 DoS 攻击
   - **建议**: 实现请求速率限制（如每分钟最多 5 次）

3. **错误消息可能泄露信息**
   - **位置**: `license.ts:134, 272`
   - **问题**: 错误消息可能帮助攻击者了解验证逻辑
   - **建议**: 统一错误消息，避免泄露验证细节

#### 🟢 低危问题

4. **Device ID 最小长度未定义**
   - **位置**: `validateDeviceId` 函数
   - **问题**: Device ID 只检查了最大长度，没有最小长度要求
   - **建议**: 添加最小长度要求（如至少 8 字符）

5. **缺少输入规范化**
   - **问题**: 虽然使用了 `trim()`，但没有进行 Unicode 规范化
   - **风险**: 某些 Unicode 变体可能绕过验证
   - **建议**: 使用 `String.prototype.normalize('NFKC')`

### 🔒 安全加固建议

1. **增强正则表达式**
   ```typescript
   const LICENSE_KEY_PATTERN = /^[a-zA-Z0-9\-_]+$/u; // 添加 u flag
   // 或使用更严格的方式
   const isValid = /^[\x00-\x7F]+$/.test(trimmed) && LICENSE_KEY_PATTERN.test(trimmed);
   ```

2. **添加速率限制**
   ```typescript
   const rateLimiter = new Map<string, number[]>();
   // 实现基于 IP 或 key 的速率限制
   ```

3. **统一错误消息**
   ```typescript
   return { valid: false, error: "授权码格式不正确" }; // 不泄露具体原因
   ```

4. **添加输入规范化**
   ```typescript
   const normalized = key.trim().normalize('NFKC');
   ```

---

## 3. Chat 附件 ID 生成 (`ui/src/ui/views/chat.ts`)

### ✅ 测试通过项

1. **使用 Web Crypto API**: ✅ 正确实现
   - 使用 `crypto.getRandomValues` 替代 `Math.random`
   - 符合密码学安全随机数生成标准

2. **ID 格式设计**: ✅ 合理
   - 格式: `att-${timestamp}-${hex}`
   - 包含时间戳和随机数，确保唯一性

3. **随机数长度**: ✅ 合理
   - 使用 6 字节 (48 位) 随机数
   - 提供足够的熵值

### ⚠️ 安全问题

#### 🟡 中危问题

1. **时间戳可预测性**
   - **位置**: `chat.ts:117`
   - **问题**: ID 中包含 `Date.now()`，可能被预测
   - **风险**: 如果随机数部分熵不足，可能被猜测
   - **建议**: 增加随机数长度到 8-16 字节，或使用 UUID

2. **缺少错误处理**
   - **位置**: `generateAttachmentId` 函数
   - **问题**: 如果 `crypto.getRandomValues` 失败，没有降级方案
   - **风险**: 可能导致功能不可用
   - **建议**: 添加错误处理和降级方案

#### 🟢 低危问题

3. **ID 碰撞可能性**
   - **问题**: 虽然概率很低，但在高并发情况下仍可能发生碰撞
   - **建议**: 使用全局计数器或 UUID

4. **ID 可枚举性**
   - **问题**: 时间戳部分可能被用于枚举附件
   - **建议**: 考虑添加额外的混淆或使用更长的随机部分

### 🔒 安全加固建议

1. **增强随机性**
   ```typescript
   function generateAttachmentId(): string {
     const array = new Uint8Array(16); // 增加到 16 字节
     crypto.getRandomValues(array);
     const hex = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
     return `att-${hex}`; // 移除时间戳，完全依赖随机数
   }
   ```

2. **添加错误处理**
   ```typescript
   function generateAttachmentId(): string {
     try {
       const array = new Uint8Array(6);
       crypto.getRandomValues(array);
       const hex = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
       return `att-${Date.now()}-${hex}`;
     } catch (error) {
       // 降级方案：使用 crypto.randomUUID() 如果可用
       if (crypto.randomUUID) {
         return `att-${crypto.randomUUID()}`;
       }
       throw new Error("Failed to generate attachment ID");
     }
   }
   ```

3. **使用 UUID (推荐)**
   ```typescript
   function generateAttachmentId(): string {
     if (crypto.randomUUID) {
       return `att-${crypto.randomUUID()}`;
     }
     // 降级方案
     const array = new Uint8Array(16);
     crypto.getRandomValues(array);
     // 格式化为 UUID v4 格式
     return `att-${formatAsUUID(array)}`;
   }
   ```

---

## 4. 综合安全评估

### 安全评分

| 模块 | 安全评分 | 状态 |
|------|---------|------|
| RSA 签名验证 | 7/10 | 🟡 良好，需改进 |
| License 输入验证 | 8/10 | 🟢 良好 |
| 附件 ID 生成 | 7/10 | 🟡 良好，需改进 |

### 总体安全状态: 🟡 **良好，需要加固**

---

## 5. 优先级修复建议

### 🔴 高优先级（立即修复）

1. **缩短 RSA 签名验证时间窗口** (rsa-verify.ts)
   - 从 5 分钟缩短到 1-2 分钟
   - 或实现 nonce 机制

2. **增强 License Key 输入验证** (license.ts)
   - 添加 Unicode 规范化
   - 增强正则表达式验证

### 🟡 中优先级（近期修复）

3. **添加速率限制** (license.ts)
   - 实现激活请求速率限制

4. **增强附件 ID 生成** (chat.ts)
   - 增加随机数长度
   - 添加错误处理

5. **统一错误消息** (所有模块)
   - 避免泄露技术细节

### 🟢 低优先级（长期改进）

6. **实现公钥版本管理** (rsa-verify.ts)
7. **添加输入长度限制** (rsa-verify.ts)
8. **使用 UUID 生成附件 ID** (chat.ts)

---

## 6. 测试覆盖情况

### 已创建的测试文件

1. ✅ `src/license/rsa-verify.security.test.ts` - RSA 签名验证安全测试
2. ✅ `src/gateway/server-methods/license.security.test.ts` - License 输入验证测试
3. ✅ `ui/src/ui/views/chat.security.test.ts` - 附件 ID 生成测试

### 测试覆盖范围

- ✅ 边界条件测试
- ✅ 输入验证测试
- ✅ 错误处理测试
- ✅ 安全边界测试
- ✅ 注入攻击防护测试

---

## 7. 结论

本次安全测试发现了 **2 个高危问题**、**5 个中危问题** 和 **4 个低危问题**。整体代码安全设计良好，但需要在以下方面进行加固：

1. **时间窗口管理**: 缩短重放攻击的时间窗口
2. **输入验证**: 增强 Unicode 和特殊字符处理
3. **错误处理**: 统一错误消息，避免信息泄露
4. **速率限制**: 防止暴力破解和 DoS 攻击

建议按照优先级逐步修复这些问题，并在修复后进行回归测试。

---

**报告生成时间**: 2026-02-04  
**测试工具**: 手动代码审查 + 自动化测试  
**下次审查建议**: 修复高优先级问题后 1 个月内进行复查
