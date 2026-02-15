# OpenClawCN 代码兼容性检查报告

> **检查日期**：2026-01-30  
> **检查人**：顶级开发人员  
> **目的**：验证 todofinal.md 方案与现有代码的兼容性

---

## 一、检查结论总览

| 模块 | 任务 | 风险等级 | 构建影响 | 需修正 |
|-----|------|---------|---------|--------|
| A1 | baseUrl 继承修复 | 🟢 低 | 无 | ❌ |
| A2 | 网络错误处理 | 🟢 极低 | 无 | ❌ |
| A3 | Windows 兼容性 | 🟡 中 | 可能 | ⚠️ |
| B1 | 审批超时配置化 | 🟡 中 | 无 | ⚠️ |
| D1 | 删除保护放宽 | 🔴 **高** | 无 | ✅ 必须 |
| E1 | 构建脚本健壮性 | 🔴 **高** | 是 | ✅ 必须 |
| C1 | 飞书/钉钉 | 🟢 低 | 无 | ❌ |
| F1 | 系统托盘通知 | 🟡 中 | 可能 | ⚠️ |

---

## 二、严重问题（必须修正）

### 🔴 问题 1：D1 删除保护方案文件路径错误

**方案中写的**：
```
文件：src/agents/file-tools.ts
改动：添加 workspace-only 逻辑
```

**实际情况**：
- ❌ `src/agents/file-tools.ts` **不存在**！
- ✅ Write 工具来自外部包 `@mariozechner/pi-coding-agent@0.49.3`
- ✅ 实际包装位置是 `src/agents/pi-tools.read.ts`

**代码证据**：
```typescript
// src/agents/pi-tools.read.ts:2
import { createEditTool, createReadTool, createWriteTool } from "@mariozechner/pi-coding-agent";

// src/agents/pi-tools.read.ts:255-258
export function createSandboxedWriteTool(root: string) {
  const base = createWriteTool(root) as unknown as AnyAgentTool;
  return wrapSandboxPathGuard(wrapToolParamNormalization(base, CLAUDE_PARAM_GROUPS.write), root);
}
```

**修正方案**：
```typescript
// 在 src/agents/pi-tools.read.ts 中添加删除检查包装器
// 而不是创建新的 src/agents/file-tools.ts

export function createDeleteProtectedWriteTool(
  root: string, 
  allowDelete: boolean | "workspace-only",
  workspaceDir?: string
) {
  const base = createWriteTool(root) as unknown as AnyAgentTool;
  
  // 包装删除检查逻辑
  const wrapped = {
    ...base,
    execute: async (toolCallId, params, signal) => {
      // 检查是否是删除操作
      if (isDeleteOperation(params) && !canDelete(allowDelete, params.path, workspaceDir)) {
        return { error: "删除操作被安全策略阻止" };
      }
      return base.execute(toolCallId, params, signal);
    }
  };
  
  return wrapSandboxPathGuard(wrapToolParamNormalization(wrapped, CLAUDE_PARAM_GROUPS.write), root);
}
```

---

### 🔴 问题 2：E1 构建脚本路径完全错误

**方案中写的**：
```
文件：build/scripts/windows/build-lite.ps1
文件：build/scripts/windows/build-lite-exe.ps1
```

**实际情况**：
- ❌ `build/scripts/windows/build-lite.ps1` **不存在**！
- ❌ `build/scripts/windows/build-lite-exe.ps1` **不存在**！

**实际构建脚本位置**：
```
scripts/windows/build-installer.ps1      ✅ 主构建脚本
scripts/windows/build-standalone.ps1     ✅ 独立版构建
scripts/windows/build-portable.ps1       ✅ 便携版构建
build/scripts/windows/build-wsl-unified.ps1  ✅ WSL 构建
```

**修正方案**：
将方案中涉及的文件修改为正确路径：

| 错误路径 | 正确路径 |
|---------|---------|
| `build/scripts/windows/build-lite.ps1` | `scripts/windows/build-installer.ps1` |
| `build/scripts/windows/build-lite-exe.ps1` | `scripts/windows/build-installer.ps1` |

---

## 三、中等风险问题（建议修正）

### 🟡 问题 3：B1 审批超时热更新配置缺失

**方案中写的**：
```typescript
// src/gateway/config-reload.ts
// 添加 tools.exec.approvalTimeoutMs 到热更新监听列表
export const HOT_RELOAD_PREFIXES = [
  'tools.exec.approvalTimeoutMs',
  // ...
];
```

**实际情况**：
```typescript
// src/gateway/config-reload.ts:75
{ prefix: "tools", kind: "none" },  // ⚠️ tools 前缀默认不热更新！
```

**影响**：
- 修改 `tools.exec.approvalTimeoutMs` 不会自动触发热更新
- 用户需要重启 Gateway 才能生效

**修正方案**：
```typescript
// 在 BASE_RELOAD_RULES 中添加（在 tools 之前）
const BASE_RELOAD_RULES: ReloadRule[] = [
  // ... 其他规则 ...
  { prefix: "tools.exec.approvalTimeoutMs", kind: "hot" },  // 🆕 添加
  // ... 保持 tools 规则不变 ...
  { prefix: "tools", kind: "none" },
];
```

---

### 🟡 问题 4：F1 系统托盘通知依赖风险

**方案中写的**：
```json
// package.json
// 添加 node-notifier 依赖
```

**潜在风险**：
1. `node-notifier` 在 Windows 上可能需要额外的 toast 通知权限
2. 部分 Windows 版本（LTSC、精简版）可能不支持
3. 打包后可能需要额外的 native 模块支持

**建议**：
- 优先使用 Windows 原生 PowerShell 通知：
```typescript
// 使用 PowerShell 原生通知（无需额外依赖）
import { spawn } from 'child_process';

function sendWindowsToast(title: string, message: string) {
  const script = `
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02
    $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template)
    $xml.GetElementsByTagName("text")[0].AppendChild($xml.CreateTextNode("${title}")) | Out-Null
    $xml.GetElementsByTagName("text")[1].AppendChild($xml.CreateTextNode("${message}")) | Out-Null
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("OpenClawCN")
    $notifier.Show([Windows.UI.Notifications.ToastNotification]::new($xml))
  `;
  spawn('powershell', ['-Command', script]);
}
```

---

## 四、低风险（验证通过）

### ✅ A1: baseUrl 继承修复

**验证结果**：
```typescript
// src/agents/pi-embedded-runner/model.ts:11-21
type InlineModelEntry = ModelDefinitionConfig & { provider: string };

export function buildInlineProviderModels(
  providers: Record<string, { models?: ModelDefinitionConfig[] }>,
): InlineModelEntry[] {
  return Object.entries(providers).flatMap(([providerId, entry]) => {
    const trimmed = providerId.trim();
    if (!trimmed) return [];
    return (entry?.models ?? []).map((model) => ({ ...model, provider: trimmed }));
    // ❌ 确认：缺少 baseUrl 和 api 继承
  });
}
```

**结论**：文件存在，代码结构与方案一致，可安全修改。

---

### ✅ A2: 网络错误处理

**验证结果**：
```typescript
// src/infra/unhandled-rejections.ts:24-39
const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  // ... 已有的错误码 ...
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  // ❌ 确认：缺少 UND_ERR_DNS_RESOLVE_FAILED 和 UND_ERR_CONNECT
]);
```

**结论**：只需添加两个错误码，无风险。

---

### ✅ C1: 飞书/钉钉插件

**验证结果**：
```
extensions/feishu/      ✅ 存在，包含完整插件结构
extensions/dingtalk/    ✅ 存在，包含完整插件结构
extensions/wecom/       ✅ 额外发现：企业微信插件也存在
```

**结论**：插件已存在，只需验证打包流程。

---

## 五、文件修改汇总（修正后）

### 模块 A：上游 Bug 修复同步

| 文件 | 正确路径 | 改动 |
|-----|---------|------|
| ✅ | `src/agents/pi-embedded-runner/model.ts` | baseUrl/api 继承 |
| ✅ | `src/infra/unhandled-rejections.ts` | 添加网络错误码 |

### 模块 B：用户体验优化

| 文件 | 正确路径 | 改动 |
|-----|---------|------|
| ✅ | `src/agents/bash-tools.exec.ts` | 审批超时配置化 |
| ⚠️ | `src/gateway/config-reload.ts` | **需添加**热更新规则 |
| ✅ | `src/gateway/setup-page.ts` | UI 修改 |

### 模块 D：安全与权限

| 原方案 | 正确方案 | 改动 |
|-------|---------|------|
| ❌ `src/agents/file-tools.ts` | ✅ `src/agents/pi-tools.read.ts` | 包装删除检查 |
| ✅ | `src/config/region-cn.ts` | 默认值修改 |

### 模块 E：构建与部署

| 原方案 | 正确方案 | 改动 |
|-------|---------|------|
| ❌ `build/scripts/windows/build-lite.ps1` | ✅ `scripts/windows/build-installer.ps1` | 健壮性检查 |
| ❌ `build/scripts/windows/build-lite-exe.ps1` | ✅ `scripts/windows/build-installer.ps1` | 同上 |

---

## 六、风险缓解建议

### 立即执行（无风险）

```bash
# 1. A1: baseUrl 修复 - 可立即执行
# 修改 src/agents/pi-embedded-runner/model.ts

# 2. A2: 网络错误处理 - 可立即执行
# 修改 src/infra/unhandled-rejections.ts

# 3. 测试
pnpm test src/agents/pi-embedded-runner/model.test.ts
pnpm test src/infra/unhandled-rejections.test.ts
```

### 需要重新设计（高风险）

1. **D1 删除保护**：需要在 `pi-tools.read.ts` 中实现，而不是创建新文件
2. **E1 构建脚本**：需要修改 `scripts/windows/build-installer.ps1`

### 建议测试顺序

```
1. A1 (baseUrl) → 测试国产模型
2. A2 (网络错误) → 测试网络中断恢复
3. B1 (审批超时) → 测试配置热更新
4. 完整构建测试 → pnpm build && scripts/windows/build-installer.ps1
```

---

## 七、结论

1. **可以安全执行**：A1, A2, C1（这些改动简单，向后兼容）

2. **需要修正方案后执行**：
   - D1：文件路径错误，需要改为 `pi-tools.read.ts`
   - E1：文件路径错误，需要改为 `scripts/windows/build-installer.ps1`
   - B1：需要添加 config-reload 规则

3. **建议推迟**：F1（系统托盘通知），建议先用 PowerShell 原生方案

**风险评估**：如果按原方案直接执行，D1 和 E1 会因为文件不存在导致开发阻塞，但**不会导致项目无法构建**（因为只是新增/修改逻辑，不是删除核心代码）。

---

*检查完成：2026-01-30*
