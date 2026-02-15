# OpenClawCN 任务分配方案

> **日期**：2026-01-30  
> **人员**：4 人并行开发  
> **原则**：文件不重叠、任务解耦、可独立测试

---

## 任务分配总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        并行开发时间线                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  开发 A (核心修复)     ████████████████░░░░░░░░░░  Day 1-3     │
│  开发 B (前端体验)     ████████████████████░░░░░░  Day 1-4     │
│  开发 C (构建部署)     ░░░░████████████████░░░░░░  Day 2-4     │
│  开发 D (安全配置)     ░░░░░░░░████████████████░░  Day 3-5     │
│                                                                 │
│  ──────────────────────────────────────────────────────────────│
│  合并测试              ░░░░░░░░░░░░░░░░░░░░████████  Day 5-6   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👨‍💻 开发 A：核心修复组

**技能要求**：TypeScript、API 调用、模型配置  
**分支名称**：`feature/core-fixes`  
**预计工时**：2-3 天

### 任务清单

| 序号 | 任务 | 优先级 | 文件 | 预计 |
|-----|------|--------|------|------|
| A-1 | baseUrl 继承修复 | 🔴 紧急 | `src/agents/pi-embedded-runner/model.ts` | 2h |
| A-2 | 网络错误码扩展 | 🔴 紧急 | `src/infra/unhandled-rejections.ts` | 1h |
| A-3 | Provider failover 优化 | 🟡 重要 | `src/agents/model-selection.ts` | 4h |
| A-4 | 新国产模型支持 | 🟢 可选 | `src/agents/models-config.providers.ts` | 2h |

### A-1 详细说明：baseUrl 继承修复（最优先！）

**文件**：`src/agents/pi-embedded-runner/model.ts`

**修改位置 1**：第 11-21 行
```typescript
// 修改前：
type InlineModelEntry = ModelDefinitionConfig & { provider: string };

export function buildInlineProviderModels(
  providers: Record<string, { models?: ModelDefinitionConfig[] }>,
): InlineModelEntry[] {
  return Object.entries(providers).flatMap(([providerId, entry]) => {
    const trimmed = providerId.trim();
    if (!trimmed) return [];
    return (entry?.models ?? []).map((model) => ({ ...model, provider: trimmed }));
  });
}

// 修改后：
type InlineModelEntry = ModelDefinitionConfig & { provider: string; baseUrl?: string };
type InlineProviderConfig = {
  baseUrl?: string;
  api?: ModelDefinitionConfig["api"];
  models?: ModelDefinitionConfig[];
};

export function buildInlineProviderModels(
  providers: Record<string, InlineProviderConfig>,
): InlineModelEntry[] {
  return Object.entries(providers).flatMap(([providerId, entry]) => {
    const trimmed = providerId.trim();
    if (!trimmed) return [];
    return (entry?.models ?? []).map((model) => ({
      ...model,
      provider: trimmed,
      baseUrl: entry?.baseUrl,       // ✅ 新增
      api: model.api ?? entry?.api,  // ✅ 新增
    }));
  });
}
```

**修改位置 2**：第 69-81 行（fallback 逻辑）
```typescript
// 在 fallbackModel 中添加 baseUrl
const fallbackModel: Model<Api> = normalizeModelCompat({
  id: modelId,
  name: modelId,
  api: providerCfg?.api ?? "openai-responses",
  provider,
  baseUrl: providerCfg?.baseUrl,  // ✅ 新增这一行
  reasoning: false,
  // ... 其他字段保持不变
});
```

**测试命令**：
```bash
pnpm test src/agents/pi-embedded-runner/model.test.ts
```

**验收标准**：
- [ ] 通义千问 API 调用正常
- [ ] DeepSeek API 调用正常
- [ ] 智谱 GLM API 调用正常

---

### A-2 详细说明：网络错误码扩展

**文件**：`src/infra/unhandled-rejections.ts`

**修改位置**：第 24-39 行
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
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_DNS_RESOLVE_FAILED",  // ✅ 新增
  "UND_ERR_CONNECT",              // ✅ 新增
]);
```

**测试命令**：
```bash
pnpm test src/infra/unhandled-rejections.test.ts
```

---

## 👨‍💻 开发 B：前端体验组

**技能要求**：HTML/CSS/JS、UI 设计  
**分支名称**：`feature/ux-improvements`  
**预计工时**：3-4 天

### 任务清单

| 序号 | 任务 | 优先级 | 文件 | 预计 |
|-----|------|--------|------|------|
| B-1 | 安全模式 UI 说明 | 🔴 紧急 | `src/gateway/setup-page.ts` | 4h |
| B-2 | 新手引导页面 | 🔴 紧急 | `src/gateway/setup-page.ts` | 6h |
| B-3 | 审批超时 UI | 🟡 重要 | `src/gateway/setup-page.ts` | 3h |
| B-4 | 产品价值展示 | 🟡 重要 | `src/gateway/setup-page.ts` | 4h |
| B-5 | 错误信息人性化 | 🟡 重要 | `src/infra/user-friendly-error.ts` (新建) | 4h |

### B-1 详细说明：安全模式 UI 说明

**文件**：`src/gateway/setup-page.ts`

**设计稿**：
```html
<!-- 在安全模式选择区域添加说明卡片 -->
<div class="security-mode-card" data-mode="deny">
  <div class="mode-header">
    <span class="mode-icon">🛡️</span>
    <span class="mode-name">安全模式</span>
  </div>
  <div class="mode-desc">AI 无法执行系统操作，只能对话和浏览网页</div>
  <div class="mode-pros">✅ 适合：有重要文件、共用电脑</div>
  <div class="mode-cons">❌ 限制：无法执行命令、无法读写本地文件</div>
</div>

<div class="security-mode-card selected" data-mode="allowlist">
  <div class="mode-header">
    <span class="mode-icon">🔒</span>
    <span class="mode-name">智能模式</span>
    <span class="mode-badge">推荐</span>
  </div>
  <div class="mode-desc">常用操作直接执行，敏感操作会询问你</div>
  <div class="mode-pros">✅ 适合：日常工作电脑</div>
</div>

<div class="security-mode-card" data-mode="full">
  <div class="mode-header">
    <span class="mode-icon">⚡</span>
    <span class="mode-name">专家模式</span>
    <span class="mode-warning">⚠️ 需谨慎</span>
  </div>
  <div class="mode-desc">解锁全部能力，风险自担</div>
  <div class="mode-cons">⚠️ 风险：AI 可能误删文件、执行危险命令</div>
</div>
```

**CSS 样式**：
```css
.security-mode-card {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.security-mode-card.selected {
  border-color: #4CAF50;
  background: #f1f8e9;
}
.security-mode-card:hover {
  border-color: #9e9e9e;
}
.mode-badge {
  background: #4CAF50;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.mode-warning {
  background: #ff9800;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
```

---

### B-5 详细说明：错误信息人性化

**新建文件**：`src/infra/user-friendly-error.ts`

```typescript
/**
 * 用户友好错误处理
 * 将技术错误转换为用户可理解的提示
 */

export interface UserFriendlyError {
  /** 用户看到的友好提示 */
  message: string;
  /** 建议的操作 */
  action?: string;
  /** 操作按钮 */
  actionButton?: { label: string; handler: string };
  /** 技术详情（展开查看） */
  technicalDetail?: string;
}

const ERROR_MAPPINGS: Array<{
  pattern: RegExp | string;
  friendly: Omit<UserFriendlyError, "technicalDetail">;
}> = [
  {
    pattern: /ERR_MODULE_NOT_FOUND/,
    friendly: {
      message: "启动失败：缺少必要组件",
      action: "请重新安装软件",
    },
  },
  {
    pattern: /无法将"py"识别为|python.*not found/i,
    friendly: {
      message: "需要安装 Python 才能执行这个操作",
      actionButton: { label: "一键安装", handler: "installPython" },
    },
  },
  {
    pattern: /ECONNREFUSED/,
    friendly: {
      message: "无法连接到服务器",
      action: "请检查网络连接，或稍后重试",
    },
  },
  {
    pattern: /API.*Key.*无效|Unauthorized|401/i,
    friendly: {
      message: "API Key 验证失败",
      action: "请检查 API Key 是否正确",
    },
  },
  {
    pattern: /找不到路径|ENOENT/,
    friendly: {
      message: "找不到指定的文件或文件夹",
      action: "请检查路径是否正确",
    },
  },
];

export function wrapError(err: Error | string): UserFriendlyError {
  const msg = typeof err === "string" ? err : err.message;

  for (const mapping of ERROR_MAPPINGS) {
    const matches =
      typeof mapping.pattern === "string"
        ? msg.includes(mapping.pattern)
        : mapping.pattern.test(msg);
    if (matches) {
      return {
        ...mapping.friendly,
        technicalDetail: msg,
      };
    }
  }

  // 默认：直接显示原始错误
  return { message: msg };
}

export function formatUserError(err: UserFriendlyError): string {
  let result = `❌ ${err.message}`;
  if (err.action) {
    result += `\n💡 ${err.action}`;
  }
  return result;
}
```

---

## 👨‍💻 开发 C：构建部署组

**技能要求**：PowerShell、打包、CI/CD  
**分支名称**：`feature/build-improvements`  
**预计工时**：2-3 天

### 任务清单

| 序号 | 任务 | 优先级 | 文件 | 预计 |
|-----|------|--------|------|------|
| C-1 | 构建脚本健壮性 | 🟡 重要 | `scripts/windows/build-installer.ps1` | 4h |
| C-2 | 飞书/钉钉打包验证 | 🔴 紧急 | `build/installer/*.iss` | 2h |
| C-3 | 内置 Python 运行时 | 🟡 重要 | `scripts/windows/build-installer.ps1` | 4h |
| C-4 | 预置 Skills 打包 | 🟢 可选 | `build/config/builtin-skills.json` | 2h |

### C-1 详细说明：构建脚本健壮性

**文件**：`scripts/windows/build-installer.ps1`

**在脚本开头添加前置检查**：
```powershell
# ============================================
# 前置检查
# ============================================

Write-Host ""
Write-Host "步骤 0: 前置检查..." -ForegroundColor Green

# 检查 dist 目录
if (-not (Test-Path "$RootDir\dist")) {
    Write-Host "错误: 未找到 dist 目录" -ForegroundColor Red
    Write-Host "请先运行: pnpm build" -ForegroundColor Yellow
    exit 1
}

# 检查 node_modules
$criticalModules = @("chalk", "typescript", "@anthropic-ai/sdk", "@sinclair/typebox")
foreach ($module in $criticalModules) {
    $modulePath = Join-Path $RootDir "node_modules\$module"
    if (-not (Test-Path $modulePath)) {
        Write-Host "错误: 缺少关键模块 '$module'" -ForegroundColor Red
        Write-Host "请先运行: pnpm install" -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "  ✅ 前置检查通过" -ForegroundColor Green
```

**在复制 node_modules 后添加后置验证**：
```powershell
# ============================================
# 后置验证
# ============================================

Write-Host ""
Write-Host "步骤 X: 后置验证..." -ForegroundColor Green

# 验证安装包大小
$installerPath = Join-Path $OutputDir "OpenClawCN-Setup-v$Version.exe"
if (Test-Path $installerPath) {
    $size = (Get-Item $installerPath).Length / 1MB
    if ($size -lt 50) {
        Write-Host "警告: 安装包过小 ($([math]::Round($size, 2)) MB)，可能缺少组件" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ 安装包大小: $([math]::Round($size, 2)) MB" -ForegroundColor Green
    }
}

# 验证关键文件是否包含在安装包中
$requiredFiles = @(
    "dist\entry.js",
    "node_modules\chalk",
    "extensions\feishu",
    "extensions\dingtalk"
)
# ... 验证逻辑
```

---

### C-2 详细说明：飞书/钉钉打包验证

**文件**：`build/installer/openclawcn-windows-unified.iss`

**添加飞书/钉钉到安装脚本**：
```iss
; 飞书插件
Source: "{#SourceDir}\extensions\feishu\*"; DestDir: "{app}\extensions\feishu"; Flags: ignoreversion recursesubdirs

; 钉钉插件
Source: "{#SourceDir}\extensions\dingtalk\*"; DestDir: "{app}\extensions\dingtalk"; Flags: ignoreversion recursesubdirs

; 企业微信插件
Source: "{#SourceDir}\extensions\wecom\*"; DestDir: "{app}\extensions\wecom"; Flags: ignoreversion recursesubdirs
```

**验证命令**：
```powershell
# 构建后验证
$installDir = "C:\Program Files\OpenClawCN"
@("feishu", "dingtalk", "wecom") | ForEach-Object {
    $pluginPath = Join-Path $installDir "extensions\$_"
    if (Test-Path $pluginPath) {
        Write-Host "✅ $_" -ForegroundColor Green
    } else {
        Write-Host "❌ $_" -ForegroundColor Red
    }
}
```

---

## 👨‍💻 开发 D：安全配置组

**技能要求**：TypeScript、安全策略  
**分支名称**：`feature/security-config`  
**预计工时**：2-3 天

### 任务清单

| 序号 | 任务 | 优先级 | 文件 | 预计 |
|-----|------|--------|------|------|
| D-1 | 审批超时配置化 | 🔴 紧急 | `src/agents/bash-tools.exec.ts` | 4h |
| D-2 | 热更新规则添加 | 🔴 紧急 | `src/gateway/config-reload.ts` | 2h |
| D-3 | 删除保护包装器 | 🟡 重要 | `src/agents/pi-tools.read.ts` | 6h |
| D-4 | 安全配置默认值 | 🟡 重要 | `src/config/region-cn.ts` | 2h |

### D-1 详细说明：审批超时配置化

**文件**：`src/agents/bash-tools.exec.ts`

**修改位置**：第 75 行附近

```typescript
// 修改前：
const DEFAULT_APPROVAL_TIMEOUT_MS = 120_000;

// 修改后：
const DEFAULT_APPROVAL_TIMEOUT_MS = 300_000; // 默认 5 分钟

/**
 * 从配置读取审批超时时间
 */
function getApprovalTimeoutMs(cfg?: OpenClawCNConfig): number {
  const configValue = cfg?.tools?.exec?.approvalTimeoutMs;
  if (typeof configValue === "number" && configValue >= 60_000) {
    return Math.min(configValue, 600_000); // 最大 10 分钟
  }
  return DEFAULT_APPROVAL_TIMEOUT_MS;
}
```

**使用处修改**（搜索 `DEFAULT_APPROVAL_TIMEOUT_MS` 的所有使用位置）：
```typescript
// 将硬编码的 DEFAULT_APPROVAL_TIMEOUT_MS 替换为函数调用
const timeoutMs = getApprovalTimeoutMs(cfg);
const expiresAtMs = Date.now() + timeoutMs;
```

---

### D-2 详细说明：热更新规则添加

**文件**：`src/gateway/config-reload.ts`

**修改位置**：`BASE_RELOAD_RULES` 数组，在 `tools` 规则之前添加

```typescript
const BASE_RELOAD_RULES: ReloadRule[] = [
  { prefix: "gateway.remote", kind: "none" },
  { prefix: "gateway.reload", kind: "none" },
  { prefix: "hooks.gmail", kind: "hot", actions: ["restart-gmail-watcher"] },
  { prefix: "hooks", kind: "hot", actions: ["reload-hooks"] },
  // ... 其他规则 ...
  
  // ✅ 新增：审批超时热更新
  { prefix: "tools.exec.approvalTimeoutMs", kind: "hot" },
  
  // 保持原有规则
  { prefix: "tools", kind: "none" },
  // ...
];
```

---

### D-3 详细说明：删除保护包装器

**文件**：`src/agents/pi-tools.read.ts`

> ⚠️ **重要**：不要创建新的 `file-tools.ts`！Write 工具来自外部包，需要在这里包装。

**添加删除检查函数**：
```typescript
import type { OpenClawCNConfig } from "../config/config.js";

type DeletePolicy = boolean | "workspace-only";

/**
 * 检查是否允许删除操作
 */
function canDelete(
  policy: DeletePolicy,
  targetPath: string,
  workspaceDir?: string
): boolean {
  if (policy === true) return true;
  if (policy === false) return false;
  if (policy === "workspace-only") {
    if (!workspaceDir) return false;
    const normalizedTarget = path.resolve(targetPath);
    const normalizedWorkspace = path.resolve(workspaceDir);
    return normalizedTarget.startsWith(normalizedWorkspace + path.sep);
  }
  return false;
}

/**
 * 检查工具参数是否包含删除操作
 */
function isDeleteOperation(params: Record<string, unknown>): boolean {
  // Write 工具的删除通常通过特定参数标识
  // 需要检查外部包的具体实现
  return params.delete === true || params.action === "delete";
}

/**
 * 创建带删除保护的 Write 工具
 */
export function createDeleteProtectedWriteTool(
  root: string,
  cfg?: OpenClawCNConfig
) {
  const base = createWriteTool(root) as unknown as AnyAgentTool;
  const policy = cfg?.tools?.write?.allowDelete ?? false;
  const workspaceDir = cfg?.agents?.defaults?.workspace;

  const wrapped: AnyAgentTool = {
    ...base,
    execute: async (toolCallId, params, signal) => {
      const record = params as Record<string, unknown>;
      
      if (isDeleteOperation(record)) {
        const targetPath = String(record.path ?? "");
        if (!canDelete(policy, targetPath, workspaceDir)) {
          return {
            output: "❌ 删除操作被安全策略阻止。当前设置只允许在工作目录内删除文件。",
            isError: true,
          };
        }
      }
      
      return base.execute(toolCallId, params, signal);
    },
  };

  return wrapSandboxPathGuard(
    wrapToolParamNormalization(wrapped, CLAUDE_PARAM_GROUPS.write),
    root
  );
}
```

---

## 依赖关系图

```
     开发 A                开发 B              开发 C              开发 D
        │                    │                   │                   │
   ┌────┴────┐          ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
   │ A-1,A-2 │          │ B-1,B-2 │         │  C-2    │         │  D-1    │
   │ (无依赖) │          │ (无依赖) │         │ (无依赖) │         │ (无依赖) │
   └────┬────┘          └────┬────┘         └────┬────┘         └────┬────┘
        │                    │                   │                   │
        │                    │                   │              ┌────┴────┐
        │                    │                   │              │   D-2   │
        │                    │                   │              │(依赖D-1)│
        │                    │                   │              └────┬────┘
        │                    │                   │                   │
        ▼                    ▼                   ▼                   ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │                          合并到 main                                 │
   └─────────────────────────────────────────────────────────────────────┘
```

---

## 每日站会检查点

### Day 1
- [ ] 开发 A：A-1 baseUrl 修复完成？
- [ ] 开发 B：B-1 安全模式 UI 开始？
- [ ] 开发 C：C-2 插件打包验证？
- [ ] 开发 D：D-1 审批超时开始？

### Day 2
- [ ] 开发 A：A-2 网络错误完成？测试通过？
- [ ] 开发 B：B-1 完成？B-2 开始？
- [ ] 开发 C：C-1 构建健壮性？
- [ ] 开发 D：D-1 完成？D-2 开始？

### Day 3
- [ ] 开发 A：A-3 failover 开始？
- [ ] 开发 B：B-3, B-4 进行中？
- [ ] 开发 C：C-3 Python 运行时？
- [ ] 开发 D：D-3 删除保护开始？

### Day 4-5
- [ ] 各分支合并到 main
- [ ] 集成测试
- [ ] 构建安装包测试

---

## Git 工作流

```bash
# 开发 A
git checkout -b feature/core-fixes
# ... 开发 ...
git push -u origin feature/core-fixes

# 开发 B
git checkout -b feature/ux-improvements
# ... 开发 ...
git push -u origin feature/ux-improvements

# 开发 C
git checkout -b feature/build-improvements
# ... 开发 ...
git push -u origin feature/build-improvements

# 开发 D
git checkout -b feature/security-config
# ... 开发 ...
git push -u origin feature/security-config
```

---

## 文件冲突矩阵

| 文件 | A | B | C | D | 冲突风险 |
|-----|---|---|---|---|---------|
| `src/agents/pi-embedded-runner/model.ts` | ✏️ | | | | 无 |
| `src/infra/unhandled-rejections.ts` | ✏️ | | | | 无 |
| `src/gateway/setup-page.ts` | | ✏️ | | | 无 |
| `src/infra/user-friendly-error.ts` | | 🆕 | | | 无 |
| `scripts/windows/build-installer.ps1` | | | ✏️ | | 无 |
| `src/agents/bash-tools.exec.ts` | | | | ✏️ | 无 |
| `src/gateway/config-reload.ts` | | | | ✏️ | 无 |
| `src/agents/pi-tools.read.ts` | | | | ✏️ | 无 |
| `src/config/region-cn.ts` | | | | ✏️ | 无 |

✏️ = 修改  🆕 = 新建

**结论**：4 个人修改的文件完全不重叠，可以安全并行开发。

---

*任务分配完成：2026-01-30*
