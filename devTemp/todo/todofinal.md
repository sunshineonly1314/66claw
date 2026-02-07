# ClawdbotCN 最终改造需求文档

> **创建日期**：2026-01-30  
> **更新日期**：2026-01-30 (融合上游 OpenClaw 2026.1.29 修复)  
> **状态**：待实施  
> **目标**：符合中国用户网络环境、交互友好、适合小白用户、点点就可上手

---

## 一、需求总览

### 1.1 优先级分类

| 优先级 | 说明 | 预计工时 |
|-------|------|---------|
| 🔴 P0 | 紧急 - 影响核心功能/稳定性 | 立即执行 |
| 🟠 P0.5 | 紧急 - 上游 Bug 修复同步 | 2-3 天 |
| 🟡 P1 | 重要 - 提升使用体验 | 5-7 天 |
| 🟢 P2 | 优化 - 长期改进 | 持续 |

### 1.2 需求清单（按功能模块划分）

#### 模块 A：上游 Bug 修复同步 (负责人: _______)

| 序号 | 需求 | 优先级 | 工作量 | 状态 | 上游 PR |
|-----|------|--------|--------|------|---------|
| A1 | **国产模型 baseUrl 继承修复** | 🔴 P0 | 0.5 天 | ⏳ 待开发 | #2740 |
| A2 | Gateway 网络错误处理加固 | 🟠 P0.5 | 0.5 天 | ⏳ 待开发 | #2980 |
| A3 | Windows 兼容性修复 (NTFS/ACL) | 🟠 P0.5 | 1 天 | ⏳ 待开发 | #3750, #2403 |
| A4 | SSH 安全加固 | 🟠 P0.5 | 0.5 天 | ⏳ 待开发 | #4001 |
| A5 | Provider failover 优化 | 🟡 P1 | 0.5 天 | ⏳ 待开发 | #2143, #2576 |
| A6 | 新国产模型支持 (MiMo/Kimi K2.5) | 🟢 P2 | 0.5 天 | ⏳ 待开发 | #3454, #4407 |

#### 模块 B：用户体验优化 (负责人: _______)

| 序号 | 需求 | 优先级 | 工作量 | 状态 |
|-----|------|--------|--------|------|
| B1 | 审批超时配置化（页面可选 + 热更新） | 🔴 P0 | 1 天 | ⏳ 待开发 |
| B2 | 安全模式名称统一 + UI说明 | 🔴 P0 | 0.5 天 | ⏳ 待开发 |
| B3 | 新手引导页面 | 🔴 P0 | 1 天 | ⏳ 待开发 |
| B4 | 错误信息人性化 | 🟡 P1 | 1 天 | ⏳ 待开发 |
| B5 | 产品价值展示页 | 🟡 P1 | 1 天 | ⏳ 待开发 |

#### 模块 C：渠道集成 (负责人: _______)

| 序号 | 需求 | 优先级 | 工作量 | 状态 |
|-----|------|--------|--------|------|
| C1 | 飞书/钉钉插件验证 + 打包 | 🔴 P0 | 0.5 天 | ⏳ 待验证 |
| C2 | 企业微信插件完善 | 🟡 P1 | 2 天 | ⏳ 待开发 |

#### 模块 D：安全与权限 (负责人: _______)

| 序号 | 需求 | 优先级 | 工作量 | 状态 |
|-----|------|--------|--------|------|
| D1 | 删除保护放宽（workspace-only） | 🟡 P1 | 0.5 天 | ⏳ 待开发 |

#### 模块 E：构建与部署 (负责人: _______)

| 序号 | 需求 | 优先级 | 工作量 | 状态 |
|-----|------|--------|--------|------|
| E1 | 构建脚本健壮性（node_modules 检查） | 🟡 P1 | 0.5 天 | ⏳ 待开发 |
| E2 | 内置 Python 运行时 | 🟡 P1 | 1 天 | ⏳ 待开发 |
| E3 | 预置更多 Skills | 🟢 P2 | 持续 | ⏳ 待开发 |

#### 模块 F：系统集成 (负责人: _______)

| 序号 | 需求 | 优先级 | 工作量 | 状态 |
|-----|------|--------|--------|------|
| F1 | 系统托盘通知（审批通知） | 🟢 P2 | 2 天 | ⏳ 待开发 |

---

## 二、模块 A：上游 Bug 修复同步（紧急）

> **背景**：上游 OpenClaw 2026.1.29 版本包含多项重要修复，部分直接影响国产模型配置。
> **参考文档**：`ronghe.md`、`ronghe-risk-assessment.md`

### A1 🔴 国产模型 baseUrl 继承修复（紧急！）

#### 问题描述
**我们的代码存在此 Bug！** 当使用自定义 provider（如通义千问、DeepSeek、智谱 GLM）时，`baseUrl` 和 `api` 配置未能正确传递到内联模型定义。

#### 影响范围
| 国产模型 | 影响 |
|---------|------|
| 通义千问 (DashScope) | ❌ 请求可能发送到错误端点 |
| DeepSeek | ❌ 请求可能发送到错误端点 |
| 智谱 GLM | ❌ 请求可能发送到错误端点 |
| 豆包 (Doubao) | ❌ 请求可能发送到错误端点 |

#### 代码位置
```
src/agents/pi-embedded-runner/model.ts:13-21
```

#### 当前代码（存在 Bug）
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

#### 修复后代码
```typescript
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
      baseUrl: entry?.baseUrl,       // ✅ 修复: 继承 baseUrl
      api: model.api ?? entry?.api,  // ✅ 修复: 继承 api
    }));
  });
}
```

#### 同时需要修改 fallback 逻辑（第 69-81 行）
```typescript
// 修改前:
const fallbackModel: Model<Api> = normalizeModelCompat({
  id: modelId,
  name: modelId,
  api: providerCfg?.api ?? "openai-responses",
  provider,
  // ❌ 缺少 baseUrl
  ...
});

// 修改后:
const fallbackModel: Model<Api> = normalizeModelCompat({
  id: modelId,
  name: modelId,
  api: providerCfg?.api ?? "openai-responses",
  provider,
  baseUrl: providerCfg?.baseUrl,  // ✅ 添加 baseUrl
  ...
});
```

#### 上游 Commit
```
6bf2f0eee fix(models): inherit baseUrl and api from provider config
```

#### 验收标准
- [ ] 通义千问 API 调用正常 (baseUrl 正确)
- [ ] DeepSeek API 调用正常
- [ ] 智谱 GLM API 调用正常
- [ ] 单元测试通过 `pnpm test src/agents/pi-embedded-runner/model.test.ts`

---

### A2 🟠 Gateway 网络错误处理加固

#### 问题描述
Gateway 在遇到瞬时网络错误时可能崩溃退出，影响稳定性。

#### 代码位置
```
src/infra/unhandled-rejections.ts:24-39
```

#### 需要添加的错误码
```typescript
const TRANSIENT_NETWORK_CODES = new Set([
  // ... 已有的错误码 ...
  "UND_ERR_DNS_RESOLVE_FAILED",  // 🆕 新增
  "UND_ERR_CONNECT",              // 🆕 新增
]);
```

#### 上游 Commit
```
3b879fe52 fix(infra): prevent gateway crashes on transient network errors
3a25a4fa9 fix: keep unhandled rejections safe
```

#### 风险评估
- **风险等级**: 🟢 极低
- **影响**: 仅增加容错，不改变现有逻辑

#### 验收标准
- [ ] 网络断开时 Gateway 不崩溃
- [ ] 错误被正确记录到日志
- [ ] 单元测试通过

---

### A3 🟠 Windows 兼容性修复

#### 问题 1: NTFS 文件名特殊字符
```
修复: 使用 & 替代 <> 进行 XML escaping
上游 Commit: c20035094
文件: 测试文件中的 XML 转义
```

#### 问题 2: Windows ACL 审计
```
修复: 正确处理 Windows ACL 权限检查
上游 Commit: a8ad242f8
文件: src/config/security-audit.ts (需检查)
```

#### 问题 3: 平台标签识别
```
修复: 将 Windows 平台标签正确识别为 Windows
影响: Node shell 选择
```

#### 问题 4: fileURLToPath 兼容性
```
修复: 使用 fileURLToPath 改善路径处理
上游 Commit: d93f8ffc1
```

#### 风险评估
- **风险等级**: 🟡 中等
- **建议**: 在 Windows 环境充分测试后合并

#### 验收标准
- [ ] Windows 下 `pnpm test` 全部通过
- [ ] 安装包构建正常
- [ ] 配置文件读取正常

---

### A4 🟠 SSH 安全加固

#### 问题描述
SSH target 处理存在潜在的安全隐患。

#### 上游 Commit
```
06289b36d fix(security): harden SSH target handling
b623557a2 fix: harden url fetch dns pinning
```

#### 风险评估
- **风险等级**: 🟢 低
- **影响**: 安全加固，添加检查逻辑

---

### A5 🟡 Provider Failover 优化

#### 问题 1: modelDefault 不生效
```
当 provider === "auto" 时，modelDefault 配置不生效
上游 Commit: 6c451f47f
```

#### 问题 2: 冷却中的 Provider 未跳过
```
Model failover 时未跳过正在冷却的 provider
上游 Commit: ff42a48b5
```

#### 问题 3: Memory 启动缺少 memory.md
```
Bootstrap 时未包含 MEMORY.md 文件
上游 Commit: 2cbc991bf
```

---

### A6 🟢 新国产模型支持

#### Xiaomi MiMo
```typescript
// src/agents/models-config.providers.ts
const XIAOMI_BASE_URL = "https://api.mimo.xiaomi.com/v1";

export function buildXiaomiProvider(): ProviderConfig {
  return {
    baseUrl: XIAOMI_BASE_URL,
    api: "anthropic-messages",
    models: [
      {
        id: "mimo-v2-flash",
        name: "Xiaomi MiMo V2 Flash",
        // ...
      }
    ],
  };
}
```
上游 Commit: 50d44d0bd, 78b987664

#### Kimi K2.5
```
更新 Moonshot Kimi 模型引用到 kimi-k2.5
上游 Commit: 5e635c965
```

---

## 三、模块 B：用户体验优化

## 二、详细需求说明

### 2.1 🔴 审批超时配置化（页面可选 + Gateway 热更新）

#### 背景
当前审批超时硬编码为 120 秒（2 分钟），小白用户可能来不及操作。需要支持用户在页面选择，且修改后 Gateway 热更新生效，无需重启。

#### 当前代码位置
```
src/agents/bash-tools.exec.ts:75
const DEFAULT_APPROVAL_TIMEOUT_MS = 120_000;
```

#### 需求详情

**1. 配置项设计**

```yaml
# ~/.clawdbot/config.yaml
tools:
  exec:
    approvalTimeoutMs: 300000  # 默认 5 分钟（300 秒）
    # 可选值: 120000 (2分钟), 300000 (5分钟), 600000 (10分钟)
```

**2. 前端页面设计**

在「设置 > 安全设置」页面添加：

```
┌─────────────────────────────────────────────────────────────┐
│  操作审批超时时间                                            │
│                                                             │
│  当 AI 需要执行敏感操作时，会等待你的确认。                    │
│  超时后将自动拒绝该操作。                                     │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  ○ 2 分钟（紧凑）                                    │    │
│  │  ● 5 分钟（推荐）                                    │    │
│  │  ○ 10 分钟（宽松）                                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  💡 选择后立即生效，无需重启                                  │
└─────────────────────────────────────────────────────────────┘
```

**3. 后端改动**

| 文件 | 改动 |
|-----|------|
| `src/agents/bash-tools.exec.ts` | 从配置读取超时时间，不再硬编码 |
| `src/gateway/config-reload.ts` | 支持 `tools.exec.approvalTimeoutMs` 热更新 |
| `src/gateway/server-methods/config.ts` | 添加 API 端点 |
| `src/gateway/setup-page.ts` | 添加前端 UI |

**4. 代码修改示例**

```typescript
// src/agents/bash-tools.exec.ts
// 改动前:
const DEFAULT_APPROVAL_TIMEOUT_MS = 120_000;

// 改动后:
function getApprovalTimeoutMs(cfg: ClawdbotConfig): number {
  const configValue = cfg.tools?.exec?.approvalTimeoutMs;
  if (typeof configValue === 'number' && configValue >= 60000) {
    return configValue;
  }
  return 300_000; // 默认 5 分钟
}

// 使用处改为:
const timeoutMs = getApprovalTimeoutMs(cfg);
```

**5. 热更新机制**

```typescript
// src/gateway/config-reload.ts
// 添加 tools.exec.approvalTimeoutMs 到热更新监听列表
export const HOT_RELOAD_PREFIXES = [
  'tools.exec.approvalTimeoutMs',
  // ... 其他已有的
];
```

---

### 2.2 🔴 安全模式名称统一 + UI说明

#### 背景
当前「完全保护」vs「完全模式」名称混淆，需要统一命名并在 UI 添加说明。

#### 命名映射

| 原名称 | 新名称 | 配置值 | 说明 |
|-------|--------|--------|------|
| 完全保护 / 安全模式 | **安全模式** | `deny` | 最严格，AI 无法执行任何系统操作 |
| 智能保护 / 智能模式 | **智能模式** | `allowlist` | 推荐，信任列表 + 询问机制 |
| 关闭保护 / 完全模式 | **专家模式** | `full` | 无限制，仅限技术高手 |

#### 需要修改的文件

| 文件 | 改动 |
|-----|------|
| `docs/todo/windows-security-modes.md` | 统一术语 |
| `docs/todo/clawdfronttodo.md` | 统一术语 |
| `docs/todo/guidprd.md` | 统一术语 |
| `docs/todo/setup-wizard-flow.md` | 统一术语 |
| `src/gateway/setup-page.ts` | 修改 UI 文案 |
| `src/gateway/setup-wizard.ts` | 修改配置逻辑 |

#### UI 说明设计

在安全模式选择卡片下方添加说明：

```
┌─────────────────────────────────────────────────────────────┐
│  🛡️ 安全模式                                                │
│  AI 无法执行系统操作，只能对话和浏览网页                      │
│                                                             │
│  ✅ 适合：有重要文件、共用电脑                               │
│  ❌ 限制：无法执行命令、无法读写本地文件                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🔒 智能模式（推荐）                                    ⭐   │
│  常用操作直接执行，敏感操作会询问你                           │
│                                                             │
│  ✅ 适合：日常工作电脑                                       │
│  ✅ 信任列表内操作：自动执行                                 │
│  ⚠️ 其他操作：弹窗询问你                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ⚡ 专家模式                                       ⚠️ 需谨慎 │
│  解锁全部能力，风险自担                                      │
│                                                             │
│  ✅ 适合：独立设备、技术高手                                 │
│  ⚠️ 风险：AI 可能误删文件、执行危险命令                      │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.3 🔴 新手引导页面

#### 背景
安装完成后用户不知道做什么，需要添加引导页面展示产品价值和使用示例。

#### 设计方案

**触发条件**：首次安装完成后，或配置向导完成后

**页面设计**：

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ✨ 欢迎使用 ClawdbotCN！                  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  💡 试试对我说：                                             │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  📁 "帮我把桌面的图片整理到一个文件夹"               │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  🔍 "搜索今天深圳的天气"                             │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  💻 "帮我写一个 Python 脚本处理 Excel"              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  🌐 "打开京东帮我搜索手机"                           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  🔒 当前安全模式：智能模式                                   │
│  📂 工作目录：C:\Clawdbot\workspace                         │
│                                                             │
│              [开始对话]    [查看更多技巧]                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 需要修改的文件

| 文件 | 改动 |
|-----|------|
| `src/gateway/setup-page.ts` | 添加引导页面 HTML/CSS/JS |
| `src/gateway/setup-wizard.ts` | 向导完成后跳转引导页 |

---

### 2.4 🔴 飞书/钉钉插件加入主干

#### 背景
飞书/钉钉插件已完整实现（`extensions/feishu/`、`extensions/dingtalk/`），需要确认是否已加入主干加载。

#### 现状分析

**已实现的功能**：

| 插件 | 文件 | 功能 |
|-----|------|------|
| 飞书 | `extensions/feishu/src/channel.ts` | 完整的渠道插件 |
| 飞书 | `extensions/feishu/src/api.ts` | Token 获取、消息发送、连接探测 |
| 飞书 | `extensions/feishu/src/webhook.ts` | Webhook 处理 |
| 钉钉 | `extensions/dingtalk/src/channel.ts` | 完整的渠道插件 |
| 钉钉 | `extensions/dingtalk/src/api.ts` | Token 获取、消息发送、Session Webhook |
| 钉钉 | `extensions/dingtalk/src/webhook.ts` | Webhook 处理 |

#### 验证任务

1. 检查 Windows 安装包是否包含 `extensions/feishu` 和 `extensions/dingtalk`
2. 检查 `plugins.entries` 配置是否正确加载
3. 验证飞书/钉钉在「渠道」页面是否可见

#### 需要修改的文件

| 文件 | 改动 |
|-----|------|
| `build/scripts/windows/build-lite-exe.ps1` | 确保复制 feishu/dingtalk 到安装包 |
| `build/installer/scripts/setup-environment.ps1` | 确保配置正确的插件路径 |
| `docs/todo/china-localization.md` | 更新文档状态为「已完成」 |

---

### 2.5 🟡 删除保护放宽（workspace-only）

#### 背景
当前智能模式完全禁止删除（`allowDelete: false`），过于严格。建议改为工作目录内可删除（需确认）。

#### 当前代码位置
```
src/config/region-cn.ts:505
tools:
  write:
    allowDelete: false  // 禁止删除文件
```

#### 修改方案

**1. 新增配置选项**

```yaml
tools:
  write:
    allowDelete: "workspace-only"  # 仅工作目录内可删除
    # 可选值: false (完全禁止), "workspace-only" (工作目录内可删除), true (允许删除)
```

**2. 代码改动**

```typescript
// src/agents/file-tools.ts
function canDelete(cfg: ClawdbotConfig, targetPath: string): boolean {
  const allowDelete = cfg.tools?.write?.allowDelete;
  
  if (allowDelete === false) return false;
  if (allowDelete === true) return true;
  if (allowDelete === "workspace-only") {
    const workspace = cfg.agents?.defaults?.workspace;
    if (!workspace) return false;
    return targetPath.startsWith(workspace);
  }
  return false; // 默认禁止
}
```

**3. 审批流程**

工作目录内删除时，仍需弹出审批确认：

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ AI 想要删除文件                                          │
│                                                             │
│  文件：C:\Clawdbot\workspace\temp\old_file.txt              │
│                                                             │
│  ⚠️ 删除后无法恢复！                                         │
│                                                             │
│        [允许删除]    [拒绝]                                  │
└─────────────────────────────────────────────────────────────┘
```

#### 需要修改的文件

| 文件 | 改动 |
|-----|------|
| `src/config/region-cn.ts` | 修改 `allowDelete` 默认值 |
| `src/agents/file-tools.ts` | 添加 `workspace-only` 逻辑 |
| `src/gateway/setup-wizard.ts` | 配置向导中的默认值 |

---

### 2.6 🟡 构建脚本健壮性（node_modules 检查）

#### 背景
Bug #6 显示 robocopy 错误被静默忽略，导致安装包缺少 node_modules。

#### 需要修改的文件

| 文件 | 改动 |
|-----|------|
| `build/scripts/windows/build-lite.ps1` | 添加前置检查和后置验证 |
| `build/scripts/windows/build-lite-exe.ps1` | 同上 |

#### 代码修改

```powershell
# build/scripts/windows/build-lite.ps1

# === 前置检查 ===
Write-Host "检查 node_modules..."
if (-not (Test-Path "$sourceDir\node_modules\chalk")) {
    Write-Error "ERROR: node_modules 不完整，请先运行 'pnpm install'"
    exit 1
}

# === 复制 node_modules ===
Write-Host "复制 node_modules..."
$robocopyArgs = @(
    "$sourceDir\node_modules",
    "$destDir\node_modules",
    "/E", "/NFL", "/NDL", "/NJH", "/NJS"
)
$result = Start-Process -FilePath "robocopy.exe" -ArgumentList $robocopyArgs -Wait -PassThru -NoNewWindow
if ($result.ExitCode -gt 7) {
    Write-Error "ERROR: robocopy 失败，退出码: $($result.ExitCode)"
    exit 1
}

# === 后置验证 ===
Write-Host "验证关键模块..."
$criticalModules = @("chalk", "typescript", "@anthropic-ai/sdk")
foreach ($module in $criticalModules) {
    if (-not (Test-Path "$destDir\node_modules\$module")) {
        Write-Error "ERROR: 关键模块 '$module' 未复制成功"
        exit 1
    }
}
Write-Host "✅ node_modules 复制成功"
```

---

### 2.7 🟡 内置 Python 运行时

#### 背景
小白用户最常见的问题是没有 Python（Bug #4）。

#### 方案选择

**方案 A：内置 Python 便携版（推荐）**

```
优点：
- 用户无需额外操作
- 安装包大小增加约 25MB

实现：
1. 下载 python-3.11-embed-amd64.zip
2. 解压到 C:\Clawdbot\python\
3. 在 start.bat 中设置 PATH
```

**方案 B：首次启动检测 + 一键安装**

```
优点：
- 安装包体积不变

实现：
1. 启动时检测 python --version
2. 未安装则显示提示：
   ┌─────────────────────────────────────────────────────┐
   │  ⚠️ 检测到 Python 未安装                             │
   │                                                      │
   │  部分功能需要 Python 支持。                          │
   │                                                      │
   │  [一键安装 Python]    [跳过（稍后安装）]              │
   └─────────────────────────────────────────────────────┘
```

#### 需要修改的文件

| 文件 | 改动 |
|-----|------|
| `build/scripts/windows/build-lite-exe.ps1` | 下载并打包 Python |
| `build/installer/scripts/setup-environment.ps1` | 配置 Python 环境变量 |
| `scripts/windows/start.bat` | 设置 PATH 包含内置 Python |

---

### 2.8 🟡 错误信息人性化

#### 背景
用户看不懂技术报错（如 `ERR_MODULE_NOT_FOUND`）。

#### 错误映射表

| 原始错误 | 用户友好提示 | 建议操作 |
|---------|------------|---------|
| `ERR_MODULE_NOT_FOUND: Cannot find package 'chalk'` | 启动失败：缺少必要组件 | 请重新安装软件 |
| `py : 无法将"py"识别为 cmdlet` | 需要安装 Python 才能执行这个操作 | [一键安装] |
| `找不到路径 D:\xxx` | 找不到文件夹 "D:\xxx" | 请检查路径是否正确 |
| `ECONNREFUSED` | 无法连接到服务器 | 请检查网络连接 |
| `API Key 无效` | API Key 验证失败 | 请检查 API Key 是否正确 |

#### 实现方案

**1. 错误类型定义**

```typescript
// src/infra/user-friendly-error.ts
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

export function wrapError(err: Error): UserFriendlyError {
  const msg = err.message;
  
  if (msg.includes('ERR_MODULE_NOT_FOUND')) {
    return {
      message: '启动失败：缺少必要组件',
      action: '请重新安装软件',
      technicalDetail: msg,
    };
  }
  
  if (msg.includes('无法将"py"识别为') || msg.includes('python')) {
    return {
      message: '需要安装 Python 才能执行这个操作',
      actionButton: { label: '一键安装', handler: 'installPython' },
      technicalDetail: msg,
    };
  }
  
  // 默认：直接显示原始错误
  return { message: msg };
}
```

**2. 前端展示**

```html
<!-- 错误提示组件 -->
<div class="error-toast">
  <div class="error-icon">❌</div>
  <div class="error-content">
    <div class="error-message">{message}</div>
    <div class="error-action">{action}</div>
    <button class="error-action-btn" onclick="{handler}">{actionButton.label}</button>
    <details class="error-details">
      <summary>查看技术详情</summary>
      <pre>{technicalDetail}</pre>
    </details>
  </div>
</div>
```

#### 需要修改的文件

| 文件 | 改动 |
|-----|------|
| `src/infra/user-friendly-error.ts` | 新增：错误包装函数 |
| `src/gateway/setup-page.ts` | 使用友好错误提示 |
| `src/cli/commands/gateway.ts` | 启动失败时显示友好提示 |

---

### 2.9 🟡 产品价值展示页

#### 背景
用户不知道 ClawdbotCN 能用来干什么。

#### 设计方案

在主页面添加「功能概览」区域：

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 ClawbotCN 能帮你做什么？                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📁 文件整理                                                │
│  "帮我把桌面的图片按日期整理"                                │
│                                                             │
│  🔍 信息搜索                                                │
│  "搜索今天的热点新闻"                                        │
│                                                             │
│  📊 数据处理                                                │
│  "把这个 Excel 做成柱状图"                                   │
│                                                             │
│  💻 代码助手                                                │
│  "帮我写一个爬虫脚本"                                        │
│                                                             │
│  🌐 网页操作                                                │
│  "帮我打开京东搜索手机"                                      │
│                                                             │
│  📝 办公自动化                                              │
│  "帮我批量重命名这些文件"                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 需要修改的文件

| 文件 | 改动 |
|-----|------|
| `src/gateway/setup-page.ts` | 添加功能概览区域 |

---

### 2.10 🟢 预置更多 Skills

#### 背景
用户反馈 Skills 太少，无法满足需求。

#### Skills 清单

| 分类 | Skill | 描述 | 优先级 |
|-----|-------|------|--------|
| 文件操作 | file-organizer | 按类型/日期整理文件 | 🔴 高 |
| 文件操作 | batch-rename | 批量重命名 | 🔴 高 |
| 文件操作 | file-search | 本地文件搜索 | 🟡 中 |
| 数据处理 | excel-helper | Excel 读写、图表生成 | 🔴 高 |
| 数据处理 | json-csv-converter | JSON/CSV 互转 | 🟡 中 |
| 图片处理 | image-compress | 图片压缩 | 🟡 中 |
| 网络操作 | web-screenshot | 网页截图 | 🟡 中 |
| 网络操作 | content-extractor | 网页内容提取 | 🟡 中 |
| 效率工具 | clipboard-manager | 剪贴板管理 | 🟢 低 |
| 效率工具 | quick-launcher | 快捷启动 | 🟢 低 |

#### 实现方式

1. 从 Skills 仓库（gitee.com/tecbinai/skills）获取
2. 预置到安装包中
3. 首次启动自动加载

#### 需要修改的文件

| 文件 | 改动 |
|-----|------|
| `build/config/builtin-skills.json` | 添加预置 Skills 列表 |
| `build/scripts/windows/build-lite-exe.ps1` | 打包预置 Skills |

---

### 2.11 🟢 系统托盘通知（审批通知）

#### 背景
用户关闭浏览器就收不到审批通知。

#### 方案

使用 Windows Toast Notification 发送系统通知：

```
┌─────────────────────────────────────────────┐
│  ClawbotCN                              ×   │
├─────────────────────────────────────────────┤
│  🔔 AI 需要你的确认                          │
│                                             │
│  AI 想要执行：pip install pandas            │
│                                             │
│  [查看详情]                                  │
└─────────────────────────────────────────────┘
```

#### 技术方案

```typescript
// 使用 node-notifier 或 PowerShell
import notifier from 'node-notifier';

function sendApprovalNotification(approval: ExecApprovalRecord) {
  notifier.notify({
    title: 'ClawbotCN - AI 需要你的确认',
    message: `AI 想要执行：${approval.request.command}`,
    icon: path.join(__dirname, 'icon.png'),
    sound: true,
    wait: true,
  });
  
  notifier.on('click', () => {
    // 打开浏览器到审批页面
    open(`http://localhost:18789/approval/${approval.id}`);
  });
}
```

#### 需要修改的文件

| 文件 | 改动 |
|-----|------|
| `package.json` | 添加 node-notifier 依赖 |
| `src/gateway/exec-approval-manager.ts` | 创建审批时发送系统通知 |
| `src/gateway/server-methods/exec-approval.ts` | 支持通知点击跳转 |

---

## 七、修改文件汇总（按模块）

### 模块 A：上游 Bug 修复同步

| 文件 | 任务编号 | 改动内容 | 上游 Commit |
|-----|---------|---------|-------------|
| `src/agents/pi-embedded-runner/model.ts` | A1 | baseUrl/api 继承修复 | 6bf2f0eee |
| `src/infra/unhandled-rejections.ts` | A2 | 网络错误码扩展 | 3b879fe52, 3a25a4fa9 |
| `src/config/security-audit.ts` | A3 | Windows ACL 审计 | a8ad242f8 |
| `src/infra/ssh-config.ts` (待确认) | A4 | SSH target 加固 | 06289b36d |
| `src/agents/auth-profiles.ts` | A5 | Provider cooldown 跳过 | ff42a48b5 |
| `src/agents/model-selection.ts` | A5 | modelDefault 修复 | 6c451f47f |
| `src/agents/bootstrap-files.ts` | A5 | MEMORY.md 支持 | 2cbc991bf |
| `src/agents/models-config.providers.ts` | A6 | MiMo/Kimi K2.5 | 50d44d0bd, 5e635c965 |

### 模块 B：用户体验优化

| 文件 | 任务编号 | 改动内容 |
|-----|---------|---------|
| `src/agents/bash-tools.exec.ts` | B1 | 审批超时配置化 (第75行 `DEFAULT_APPROVAL_TIMEOUT_MS`) |
| `src/gateway/config-reload.ts` ⚠️ | B1 | **需新增热更新规则** (当前 `tools` 是 `kind: "none"`) |
| `src/gateway/setup-page.ts` | B1, B2, B3, B5 | 超时设置UI、安全模式说明、新手引导、功能概览 |
| `src/gateway/setup-wizard.ts` | B2, B3 | 安全模式命名、引导跳转 |
| `src/infra/user-friendly-error.ts` | B4 | 新增：错误包装函数 |

> ⚠️ **热更新注意**：当前 `config-reload.ts:75` 中 `{ prefix: "tools", kind: "none" }` 意味着 tools 配置变更不触发热更新。需要在此规则之前添加 `{ prefix: "tools.exec.approvalTimeoutMs", kind: "hot" }`

### 模块 C：渠道集成

| 文件 | 任务编号 | 改动内容 |
|-----|---------|---------|
| `extensions/feishu/*` | C1 | 验证飞书插件 |
| `extensions/dingtalk/*` | C1 | 验证钉钉插件 |
| `build/scripts/windows/build-lite-exe.ps1` | C1 | 插件打包 |

### 模块 D：安全与权限

| 文件 | 任务编号 | 改动内容 |
|-----|---------|---------|
| `src/config/region-cn.ts` | D1 | 删除保护默认值 |
| ~~`src/agents/file-tools.ts`~~ ⚠️ | D1 | **文件不存在！** |
| `src/agents/pi-tools.read.ts` ✅ | D1 | workspace-only 包装器 |
| `src/gateway/setup-wizard.ts` | D1 | 配置向导默认值 |

> ⚠️ **修正说明**：Write 工具来自外部包 `@mariozechner/pi-coding-agent`，需要在 `pi-tools.read.ts` 中包装删除检查逻辑，而不是创建新的 `file-tools.ts`

### 模块 E：构建与部署

| 文件 | 任务编号 | 改动内容 |
|-----|---------|---------|
| ~~`build/scripts/windows/build-lite.ps1`~~ ⚠️ | E1 | **文件不存在！** |
| ~~`build/scripts/windows/build-lite-exe.ps1`~~ ⚠️ | E1 | **文件不存在！** |
| `scripts/windows/build-installer.ps1` ✅ | E1, E2, E3 | 健壮性、Python、Skills |
| `scripts/windows/build-portable.ps1` ✅ | E1 | 便携版健壮性 |
| `build/installer/scripts/setup-environment.ps1` | E2 | Python 环境配置 |
| `build/config/builtin-skills.json` ✅ | E3 | 已存在：预置 Skills 列表 |

> ⚠️ **修正说明**：实际的 Windows 构建脚本位于 `scripts/windows/` 目录，不是 `build/scripts/windows/`

### 模块 F：系统集成

| 文件 | 任务编号 | 改动内容 |
|-----|---------|---------|
| `package.json` | F1 | 添加 node-notifier 依赖 |
| `src/gateway/exec-approval-manager.ts` | F1 | 发送系统通知 |

### 需要更新的文档

| 文件 | 改动 |
|-----|------|
| `docs/todo/windows-security-modes.md` | 安全模式命名统一 |
| `docs/todo/clawdfronttodo.md` | 安全模式命名统一 |
| `docs/todo/guidprd.md` | 安全模式命名统一 |
| `docs/todo/setup-wizard-flow.md` | 安全模式命名统一 |
| `docs/todo/china-localization.md` | 飞书/钉钉状态更新 |
| `ronghe.md` | 上游融合需求文档 |
| `ronghe-risk-assessment.md` | 上游融合风险评估 |

---

## 八、实施计划（按模块并行）

### 总体时间线

```
Week 1 (紧急修复)
├── Day 1-2: 模块 A (上游同步) - 开发 A
│   ├── A1: baseUrl 继承修复 ⚡ 最优先
│   ├── A2: Gateway 网络错误
│   └── A4: SSH 安全加固
│
├── Day 1-2: 模块 B (用户体验) - 开发 B
│   ├── B1: 审批超时配置化
│   └── B2: 安全模式名称统一
│
└── Day 2-3: 模块 C (渠道集成) - 开发 C
    └── C1: 飞书/钉钉验证

Week 2 (功能完善)
├── Day 4-5: 模块 A (继续) - 开发 A
│   ├── A3: Windows 兼容性修复
│   └── A5: Provider failover 优化
│
├── Day 4-5: 模块 B (继续) - 开发 B
│   ├── B3: 新手引导页面
│   └── B4: 错误信息人性化
│
└── Day 4-5: 模块 E (构建) - 开发 D
    ├── E1: 构建脚本健壮性
    └── E2: 内置 Python

Week 3+ (持续优化)
├── 模块 D: 删除保护放宽
├── 模块 A6: 新国产模型支持
├── 模块 E3: 预置更多 Skills
└── 模块 F1: 系统托盘通知
```

### Phase 0：紧急修复（立即执行）

> **目标**: 修复影响国产模型的核心 Bug
> **负责人**: 开发 A
> **预计工时**: 0.5 天

| 序号 | 任务 | 文件 | 验收标准 |
|-----|------|------|---------|
| A1 | baseUrl 继承修复 | `src/agents/pi-embedded-runner/model.ts` | 通义千问/DeepSeek/智谱调用正常 |

**操作步骤**:
```bash
# 1. 手动修改代码（参考上文详细说明）
# 2. 运行测试
pnpm test src/agents/pi-embedded-runner/model.test.ts
# 3. 验证国产模型
clawdbot models status --verbose
```

---

### Phase 1：紧急（P0）- 预计 3 天（并行）

#### 开发 A - 上游同步
| 天数 | 任务 | 产出 |
|-----|------|------|
| Day 1 | A1: baseUrl 修复 | 国产模型配置生效 |
| Day 1 | A2: 网络错误处理 | Gateway 稳定性提升 |
| Day 2 | A4: SSH 安全加固 | 安全性提升 |
| Day 3 | 联调测试 | 上游修复完成 |

#### 开发 B - 用户体验
| 天数 | 任务 | 产出 |
|-----|------|------|
| Day 1 | B1: 审批超时配置化 | 可配置超时 + 热更新 |
| Day 2 | B2: 安全模式名称统一 | 文档 + UI 更新 |
| Day 3 | B3: 新手引导页面 | 引导页面上线 |

#### 开发 C - 渠道集成
| 天数 | 任务 | 产出 |
|-----|------|------|
| Day 2 | C1: 飞书/钉钉验证 | 确认插件可用 |
| Day 3 | 打包测试 | 安装包包含插件 |

---

### Phase 2：重要（P1）- 预计 4 天（并行）

#### 开发 A - 上游同步（继续）
| 天数 | 任务 | 产出 |
|-----|------|------|
| Day 4 | A3: Windows 兼容性 | NTFS/ACL 修复 |
| Day 5 | A5: Provider failover | 模型切换优化 |

#### 开发 B - 用户体验（继续）
| 天数 | 任务 | 产出 |
|-----|------|------|
| Day 4 | B4: 错误信息人性化 | 友好错误提示 |
| Day 5 | B5: 产品价值展示 | 功能概览页面 |

#### 开发 D - 构建与部署
| 天数 | 任务 | 产出 |
|-----|------|------|
| Day 4 | E1: 构建脚本健壮性 | 前置/后置检查 |
| Day 5 | E2: 内置 Python | 安装包含 Python |

#### 开发 E - 安全与权限
| 天数 | 任务 | 产出 |
|-----|------|------|
| Day 6 | D1: 删除保护放宽 | workspace-only 模式 |

---

### Phase 3：优化（P2）- 持续

| 模块 | 任务 | 负责人 | 周期 |
|-----|------|--------|------|
| A | A6: 新国产模型支持 | 开发 A | 0.5 天 |
| E | E3: 预置更多 Skills | 开发 D | 持续 |
| F | F1: 系统托盘通知 | 开发 B | 2 天 |

---

## 九、验收标准

### 模块 A：上游 Bug 修复同步

#### A1 国产模型 baseUrl 继承修复
- [ ] 通义千问 API 调用正常 (endpoint: `dashscope.aliyuncs.com`)
- [ ] DeepSeek API 调用正常 (endpoint: `api.deepseek.com`)
- [ ] 智谱 GLM API 调用正常 (endpoint: `open.bigmodel.cn`)
- [ ] 豆包 API 调用正常 (endpoint: `ark.cn-beijing.volces.com`)
- [ ] 单元测试通过 `pnpm test src/agents/pi-embedded-runner/model.test.ts`

#### A2 Gateway 网络错误处理
- [ ] 网络断开时 Gateway 不崩溃
- [ ] DNS 解析失败时 Gateway 不崩溃
- [ ] 错误被正确记录到日志（非 fatal）

#### A3 Windows 兼容性
- [ ] Windows 下 `pnpm test` 全部通过
- [ ] 安装包构建正常（无 robocopy 错误）
- [ ] 配置文件特殊字符正常处理

#### A4 SSH 安全加固
- [ ] SSH 连接正常工作
- [ ] 潜在注入风险被阻止

#### A5 Provider Failover
- [ ] `provider: "auto"` 时 modelDefault 生效
- [ ] 冷却中的 provider 被跳过
- [ ] MEMORY.md 正确加载

### 模块 B：用户体验优化

#### B1 审批超时配置化
- [ ] 前端页面可选择 2/5/10 分钟
- [ ] 选择后立即生效（热更新）
- [ ] 无需重启 Gateway
- [ ] 配置持久化到 config.yaml

#### B2 安全模式名称统一
- [ ] 所有文档使用统一名称
- [ ] UI 显示统一名称
- [ ] 每个模式有清晰的能力说明

#### B3 新手引导
- [ ] 安装完成后自动显示
- [ ] 显示使用示例
- [ ] 可点击开始对话

### 模块 C：渠道集成

#### C1 飞书/钉钉
- [ ] 安装包包含插件文件
- [ ] 渠道页面可见
- [ ] 可配置并启用

### 模块 D：安全与权限

#### D1 删除保护
- [ ] 工作目录内可删除（需确认）
- [ ] 工作目录外禁止删除
- [ ] 删除前有二次确认

---

## 十、风险评估

### 上游同步风险

| 风险 | 影响 | 概率 | 缓解措施 |
|-----|------|------|---------|
| 命名空间冲突 (openclaw vs clawdbot) | 🟡 中 | 高 | 手动适配，保持 clawdbot 命名 |
| 配置格式变更 | 🟡 中 | 低 | 保持向后兼容 |
| 测试覆盖不足 | 🟡 中 | 中 | 重点测试国产渠道和模型 |
| baseUrl 修复导致回归 | 🟢 低 | 极低 | 代码改动简单，向后兼容 |

### 用户体验优化风险

| 风险 | 影响 | 概率 | 缓解措施 |
|-----|------|------|---------|
| 热更新可能影响运行中的审批 | 🟡 中 | 低 | 只更新新创建的审批 |
| Python 便携版兼容性 | 🟡 中 | 中 | 使用官方 embed 版本 |
| Skills 依赖冲突 | 🟢 低 | 低 | 预置 Skills 使用最小依赖 |

### 不合并上游的风险

| 风险 | 影响 | 概率 | 缓解措施 |
|-----|------|------|---------|
| 国产模型配置问题持续存在 | 🔴 高 | 确定 | **必须立即合并 A1** |
| 安全漏洞积累 | 🔴 高 | 中 | 优先合并安全修复 |
| 技术债增加 | 🟡 中 | 高 | 定期同步上游 |

---

## 十一、人员分工指南

### 角色定义

| 角色 | 职责 | 技能要求 |
|-----|------|---------|
| 开发 A | 上游同步 (模块 A) | 熟悉 TypeScript、模型配置、API |
| 开发 B | 用户体验 (模块 B) | 熟悉前端、UI/UX |
| 开发 C | 渠道集成 (模块 C) | 熟悉飞书/钉钉 API |
| 开发 D | 构建部署 (模块 E) | 熟悉 PowerShell、打包 |
| 开发 E | 安全权限 (模块 D, F) | 熟悉安全策略 |

### 并行开发注意事项

1. **代码冲突避免**
   - 各模块修改文件尽量不重叠
   - `src/gateway/setup-page.ts` 多人修改，需协调
   - 使用 feature 分支开发

2. **分支策略**
   ```
   main
   ├── feature/upstream-sync-A1-A4  (开发 A)
   ├── feature/ux-B1-B5             (开发 B)
   ├── feature/channel-C1           (开发 C)
   ├── feature/build-E1-E3          (开发 D)
   └── feature/security-D1-F1       (开发 E)
   ```

3. **合并顺序**
   - 先合并 A1 (baseUrl 修复) - 最紧急
   - 再合并其他模块 A 修复
   - 最后合并功能增强

### 每日站会检查点

- [ ] A1 baseUrl 修复是否完成？
- [ ] 国产模型调用是否正常？
- [ ] 是否有代码冲突需要解决？
- [ ] 测试覆盖是否充分？

---

## 十二、相关文档

### 项目文档
- [审查报告](./README.md)
- [Bug 追踪](./bug.md)
- [安全模式详解](./windows-security-modes.md)
- [前端修改方案](./clawdfronttodo.md)
- [安装向导流程](./setup-wizard-flow.md)

### 上游融合文档
- [上游融合需求文档](../ronghe.md) - 详细的上游更新分析
- [上游融合风险评估](../ronghe-risk-assessment.md) - 代码对比和风险分析

### 代码兼容性检查
- [代码兼容性检查报告](./code-compatibility-check.md) - 方案与现有代码的兼容性验证 ⚠️ **重要**

### 上游参考
- 上游仓库: https://github.com/openclaw/openclaw
- 上游版本: 2026.1.29 (stable)
- 上游 CHANGELOG: 见 `ronghe.md` 附录

---

## 附录：快速执行指南

### 紧急修复 A1 - 立即执行

```bash
# Step 1: 修改文件
# 编辑 src/agents/pi-embedded-runner/model.ts
# 参考本文档 A1 章节的详细代码

# Step 2: 测试
pnpm test src/agents/pi-embedded-runner/model.test.ts

# Step 3: 验证国产模型
# 配置通义千问/DeepSeek 后测试 API 调用
clawdbot models status --verbose

# Step 4: 提交
git add src/agents/pi-embedded-runner/model.ts
git commit -m "fix(models): inherit baseUrl and api from provider config

国产模型 (通义千问/DeepSeek/智谱) 配置修复
上游 PR: #2740"
```

### 模块 A 其他修复 - Cherry-pick

```bash
# 网络错误处理 (A2)
# 手动添加错误码到 src/infra/unhandled-rejections.ts:
# - UND_ERR_DNS_RESOLVE_FAILED
# - UND_ERR_CONNECT

# 测试
pnpm test src/infra/unhandled-rejections.test.ts
```

---

*文档最后更新: 2026-01-30*
*下次同步检查点: 上游 2026.2.x 版本发布时*
