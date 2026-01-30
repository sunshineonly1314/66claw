# Clawdbot 上游融合风险评估报告

> 评估日期: 2026-01-30
> 评估范围: 紧急合并项 (P0)
> 评估方法: 代码对比分析 + 影响范围评估

---

## 一、风险评估总结

| 修复类别 | 风险等级 | 合并难度 | 建议 |
|---------|---------|---------|------|
| Gateway 网络错误处理 | 🟢 低风险 | 简单 | ✅ 立即合并 |
| Session lock 清理 | 🟢 低风险 | 已具备 | ⏭️ 无需合并 (已有) |
| 图片大小错误处理 | 🟢 低风险 | 简单 | ✅ 立即合并 |
| **baseUrl 继承修复** | 🔴 **高风险** | 简单 | ⚡ **紧急合并** |
| Windows ACL 审计 | 🟡 中风险 | 中等 | ✅ 建议合并 |
| SSH 安全加固 | 🟢 低风险 | 简单 | ✅ 建议合并 |

---

## 二、详细风险分析

### 2.1 🔴 **baseUrl 继承问题 (紧急)**

#### 问题描述
**我们的代码存在此 bug！** 国产模型配置中的 `baseUrl` 未能正确传递到内联模型定义。

#### 代码对比

**我们的代码** (`src/agents/pi-embedded-runner/model.ts:13-21`):
```typescript
export function buildInlineProviderModels(
  providers: Record<string, { models?: ModelDefinitionConfig[] }>,
): InlineModelEntry[] {
  return Object.entries(providers).flatMap(([providerId, entry]) => {
    const trimmed = providerId.trim();
    if (!trimmed) return [];
    return (entry?.models ?? []).map((model) => ({ ...model, provider: trimmed }));
    // ❌ 问题: 没有传递 baseUrl 和 api
  });
}
```

**上游修复**:
```typescript
export function buildInlineProviderModels(
  providers: Record<string, InlineProviderConfig>,
): InlineModelEntry[] {
  return Object.entries(providers).flatMap(([providerId, entry]) => {
    const trimmed = providerId.trim();
    if (!trimmed) return [];
    return (entry?.models ?? []).map((model) => ({
      ...model,
      provider: trimmed,
      baseUrl: entry?.baseUrl,    // ✅ 修复: 继承 baseUrl
      api: model.api ?? entry?.api,  // ✅ 修复: 继承 api
    }));
  });
}
```

#### 影响范围
| 场景 | 影响 |
|------|------|
| 通义千问 DashScope | ❌ 请求可能发送到错误端点 |
| DeepSeek | ❌ 请求可能发送到错误端点 |
| 智谱 GLM | ❌ 请求可能发送到错误端点 |
| 豆包 Doubao | ❌ 请求可能发送到错误端点 |

#### 合并风险
- **风险等级**: 🟢 **极低**
- **原因**: 
  - 修改仅涉及 1 个文件
  - 逻辑简单，仅添加属性传递
  - 不改变现有 API 签名
  - 完全向后兼容

#### 验证方法
```bash
# 合并后测试
pnpm test src/agents/pi-embedded-runner/model.test.ts

# 手动验证配置
clawdbot models status --verbose
```

---

### 2.2 🟢 Gateway 网络错误处理

#### 代码对比

**我们的代码** (`src/infra/unhandled-rejections.ts:24-39`):
```typescript
const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "ECONNABORTED",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",           // ✅ 已有
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);
```

**上游新增**:
```typescript
const TRANSIENT_NETWORK_CODES = new Set([
  // ... 原有的 ...
  "UND_ERR_DNS_RESOLVE_FAILED",  // 🆕 新增
  "UND_ERR_CONNECT",              // 🆕 新增
]);
```

#### 影响范围
- 仅影响错误处理，不影响正常功能
- 新增的错误码可以防止更多网络错误导致的 Gateway 崩溃

#### 合并风险
- **风险等级**: 🟢 **极低**
- **原因**: 纯粹的错误码扩展，完全向后兼容

---

### 2.3 🟢 Session Lock 清理

#### 代码对比

**我们的代码** (`src/agents/session-write-lock.ts`):
```typescript
// ✅ 已有完整的清理逻辑
function releaseAllLocksSync(): void { ... }

process.on("exit", () => { releaseAllLocksSync(); });
process.on("SIGINT", onSigInt);
process.on("SIGTERM", onSigTerm);
```

#### 评估结果
- **状态**: ✅ **无需合并**
- **原因**: 我们的代码已经实现了相同的功能

---

### 2.4 🟡 Windows ACL 审计

#### 影响分析
- 涉及 Windows 特定的文件权限检查
- 主要影响 `src/config/security-audit.ts` 和测试文件

#### 合并风险
- **风险等级**: 🟡 **中等**
- **原因**:
  - 需要仔细检查 Windows API 调用
  - 可能需要额外的测试覆盖
  - 但不影响核心功能

#### 建议
- 在 Windows 环境下充分测试后再合并

---

### 2.5 🟢 SSH 安全加固

#### 影响分析
- 涉及 SSH 目标解析的安全检查
- 防止潜在的命令注入

#### 合并风险
- **风险等级**: 🟢 **低**
- **原因**: 安全加固通常是添加检查，不破坏现有功能

---

## 三、合并顺序建议

基于风险和依赖关系，建议按以下顺序合并：

### 阶段 1: 立即合并 (无依赖，低风险)
```
1. baseUrl 继承修复 (6bf2f0eee) ← 🔴 最紧急，影响国产模型
2. Gateway 网络错误码 (3b879fe52, 3a25a4fa9)
3. 图片大小错误处理 (b59ea0e3f)
```

### 阶段 2: 安全加固 (可独立合并)
```
4. SSH 安全加固 (06289b36d)
5. DNS pinning (b623557a2)
```

### 阶段 3: Windows 相关 (需测试验证)
```
6. NTFS XML escaping (c20035094)
7. Windows ACL 审计 (a8ad242f8)
8. 平台标签识别 (相关 commits)
```

---

## 四、回滚方案

### 如果合并后出现问题

#### baseUrl 修复回滚
```bash
# 如果 baseUrl 修复导致问题
git revert <commit-hash>

# 或临时在配置中显式指定每个模型的 baseUrl
{
  "models": {
    "providers": {
      "qwen-dashscope": {
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "models": [
          {
            "id": "qwen-max",
            "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1"  // 显式指定
          }
        ]
      }
    }
  }
}
```

#### Gateway 错误处理回滚
```bash
# 如果网络错误处理导致问题
git revert <commit-hash>

# 通常不需要回滚，因为只是增加了容错
```

---

## 五、测试清单

### 合并前
- [ ] 备份当前代码 (`git stash` 或新分支)
- [ ] 记录当前测试状态 (`pnpm test`)

### 合并后 (每个修复)
- [ ] 运行相关单元测试
- [ ] 检查 TypeScript 编译 (`pnpm build`)
- [ ] 检查 lint (`pnpm lint`)

### 国产模型专项测试
- [ ] 通义千问 API 调用测试
- [ ] DeepSeek API 调用测试
- [ ] 智谱 GLM API 调用测试
- [ ] 验证 baseUrl 正确传递

### Windows 专项测试
- [ ] Windows 下运行 `pnpm test`
- [ ] Windows 安装包构建
- [ ] 配置文件读取测试

---

## 六、结论

### 🔴 紧急行动项

**立即合并 `6bf2f0eee` (baseUrl 继承修复)**

这个 bug 直接影响所有使用自定义 baseUrl 的国产模型提供商：
- 通义千问
- DeepSeek
- 智谱 GLM
- 豆包

用户可能遇到的症状：
- 模型调用失败
- 请求发送到错误的 API 端点
- 认证失败

### ✅ 安全合并项

以下修复可以安全合并，风险极低：
- Gateway 网络错误码扩展
- SSH 安全加固
- DNS pinning

### ⏸️ 无需合并项

- Session lock 清理 (我们已有等效实现)

---

*评估完成。建议立即执行 baseUrl 继承修复的合并。*
