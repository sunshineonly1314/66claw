# 功能归档：CN 区域默认配置 + Bug 修复

> 日期：2025-02-08
> 状态：已完成
> 测试：85/85 通过（defaults-cn: 21, region-cn: 64），config 全目录 385/385 通过

---

## 一、功能概述

### 1.1 背景

ClawdbotCN 面向中国用户，核心理念是"开箱即用"——用户只需填写 API Key，其他参数自动配好最优值。

**此前的问题**：

- `CN_DEFAULT_SECURITY_CONFIG` 和 `CN_REGION_CONFIG` 已在 `region-cn.ts` 中定义，但**从未在生产代码中应用**
- 新用户的 `tools.exec.security` 默认是 `"deny"`（所有命令禁用），AI 完全无法执行操作
- sandbox、超时、并发等参数没有 CN 优化值
- 中国用户首次启动后还需手动配置大量参数才能正常使用

### 1.2 解决方案

实现 `applyCnDefaults()` 函数，在配置加载链路中自动为 CN 区域用户填充最优默认值。核心设计原则：

- **只填空不覆盖**（fill-empty）：仅当字段值为 `undefined` 时设置默认值
- **运行时生效**：默认值不持久化到配置文件，迁移到非 CN 区域时自动失效
- **平台感知**：Windows 和 macOS/Linux 使用不同的并发参数

---

## 二、实现详情

### 2.1 新增功能：`applyCnDefaults()`

**文件**：[src/config/defaults.ts](../../src/config/defaults.ts) (L400-L545, +156 行)

当 `detectChinaRegion()` 返回 `true` 时，自动填充以下默认值：

| # | 配置路径 | 默认值 | 说明 |
|---|---------|--------|------|
| 1 | `tools.exec.security` | `"allowlist"` | 白名单模式（与 setup-wizard 一致） |
| 2 | `tools.exec.ask` | `"on-miss"` | 未知命令询问用户（与 setup-wizard 一致） |
| 2b | `tools.exec.safeBins` | `CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist` | 30+ 常用命令白名单 |
| 3 | `agents.defaults.sandbox.mode` | `"non-main"` | 非主代理沙箱隔离（与 CN_DEFAULT_SECURITY_CONFIG 一致） |
| 4 | `agents.defaults.sandbox.scope` | `"session"` | 会话级沙箱隔离 |
| 5 | `agents.defaults.sandbox.workspaceAccess` | `"rw"` | 工作目录读写权限 |
| 6 | `agents.defaults.maxConcurrent` | Win: `3`, 其他: `4` | 主代理并发数（平台感知） |
| 7 | `agents.defaults.subagents.maxConcurrent` | Win: `6`, 其他: `8` | 子代理并发数（平台感知） |
| 8 | `agents.defaults.timeoutSeconds` | `900` | 15 分钟超时 |

> **勘误 (2025-02-08)**：初版错误使用了 AI 生成文档 `config-defaults-guide.md` 中的需求值
> (`security: "full"`, `ask: "off"`, `sandbox.mode: "off"`)，与生产代码中 `setup-wizard.ts` 和
> `CN_DEFAULT_SECURITY_CONFIG` 的实际模式不一致。已修正为与生产代码对齐的值。

**代码风格**：与现有 `apply*Defaults` 函数一致，使用手动展开（`{ ...cfg, tools: { ...cfg.tools, ... } }`），不引入新工具函数。

### 2.2 配置链注入

**文件**：[src/config/io.ts](../../src/config/io.ts) (3 处注入 + 1 行 import)

`applyCnDefaults` 被注入到默认值链中，位置统一为 `applySessionDefaults` 之后、`applyAgentDefaults` 之前。

**注入位置**：

| 位置 | 函数 | 行号 |
|------|------|------|
| 1 | `loadConfig()` | L258 |
| 2 | `readConfigFileSnapshot()` 文件不存在路径 | L312 |
| 3 | `readConfigFileSnapshot()` 文件有效路径 | L436 |

**链顺序关键决策**：`applyCnDefaults` 必须在 `applyAgentDefaults` 之前运行。原因：`applyAgentDefaults` 会设置全局 `maxConcurrent=4`，而 CN Windows 需要 `maxConcurrent=3`。先写入 3，后续发现已有值就跳过。

完整默认值链：
```
applyModelDefaults(
  applyCompactionDefaults(
    applyContextPruningDefaults(
      applyAgentDefaults(
        applyCnDefaults(          // ← 新增
          applySessionDefaults(
            applyLoggingDefaults(
              applyMessageDefaults(config)
            )
          )
        )
      )
    )
  )
)
```

### 2.3 单元测试

**文件**：[src/config/defaults-cn.test.ts](../../src/config/defaults-cn.test.ts) (新建, 21 个测试)

| 测试组 | 数量 | 覆盖点 |
|--------|------|--------|
| 门控测试 | 2 | 非 CN 区域返回原始 config（同引用） |
| 填空测试 | 7 | 空 config 在 CN 区域正确填入所有默认值 |
| 不覆盖测试 | 4 | 已设置的值不被覆盖 |
| 平台差异测试 | 4 | Windows 得到 maxConcurrent=3，macOS/Linux 得到 4 |
| 链集成测试 | 2 | 与 applyAgentDefaults 链式调用时 CN 值不被冲掉 |
| 不可变性测试 | 2 | 原始 config 对象不被修改 |

Mock 方式：`process.env.CLAWDBOT_REGION = "cn"` + `vi.spyOn(os, "platform")`

---

## 三、Bug 修复

### 3.1 region-cn.test.ts — 4 个失败测试修复

**文件**：[src/config/region-cn.test.ts](../../src/config/region-cn.test.ts)

| # | 测试名 | 原因 | 修复 |
|---|--------|------|------|
| 1 | "免费模型应该有 pricing: '免费' 标记" (L124) | `pricing === "免费"` 过于严格，modelscope 模型使用 `"免费(2000次/天)"` | 改为 `pricing?.startsWith("免费")` |
| 2 | "pricing 字段格式应该一致" (L471) | 合法格式清单缺少 `"按量计费"` 和 `"免费(xxx)"` 模式 | 增加 `startsWith("免费")` 和 `"按量计费"` |
| 3 | "免费模型应该是 Qwen2" (L570) | SiliconFlow 已将免费模型从 Qwen2-7B 升级为 Qwen3-8B | 断言改为检查 `Qwen3-8B` |
| 4 | "描述应该说不需要 Group ID" (L587) | MiniMax 描述已改为 "Agent/代码专家"，"不需要 Group ID" 移到了 `authHint` | 拼接 `description + authHint` 一起检查 |

### 3.2 setup-page.ts — P1 XSS 安全漏洞修复

**文件**：[src/gateway/setup-page.ts](../../src/gateway/setup-page.ts) (L98-L100)

**问题**：`JSON.stringify(gatewayToken)` 如果 token 包含 `</script>`，会提前关闭 script 标签，造成 XSS 注入攻击。

**修复前**：
```typescript
const tokenScript = gatewayToken
  ? `<script>window.__GATEWAY_TOKEN__ = ${JSON.stringify(gatewayToken)};</script>`
  : `<script>window.__GATEWAY_TOKEN__ = null;</script>`;
```

**修复后**：
```typescript
const safeToken = gatewayToken
  ? JSON.stringify(gatewayToken).replace(/<\//g, "<\\/")
  : "null";
const tokenScript = `<script>window.__GATEWAY_TOKEN__ = ${safeToken};</script>`;
```

### 3.3 setup-page.ts — P1 空引用风险修复

**文件**：[src/gateway/setup-page.ts](../../src/gateway/setup-page.ts)

**问题 1**：`showStatus()` 函数中 `document.getElementById(elementId)` 可能返回 null (L7903-7911)

**修复**：添加 `if (!el) return;` 早期返回

**问题 2**：Init IIFE 中 `getElementById('page0')` / `getElementById('page1')` 可能返回 null (L7929-7942)

**修复**：提取变量 + 添加 `if (page0)` / `if (page1)` 条件保护

---

## 四、文件变更清单

| 文件 | 操作 | 变更量 | 说明 |
|------|------|--------|------|
| `src/config/defaults.ts` | 修改 | +156 行 | 新增 `applyCnDefaults()` 函数 + 导入 |
| `src/config/io.ts` | 修改 | +13/-3 行 | 3 处默认值链注入 + 导入 |
| `src/config/defaults-cn.test.ts` | **新建** | ~200 行 | 21 个单元测试 |
| `src/config/region-cn.test.ts` | 修改 | +13/-10 行 | 4 个断言修复 |
| `src/gateway/setup-page.ts` | 修改 | +12/-9 行 | XSS 修复 + null 检查 |

### UI 增强（linter 自动变更，非本次手动修改）

| 文件 | 说明 |
|------|------|
| `ui/src/ui/views/skills.ts` | 新增诊断卡片组件（`analyzeDiagnostics` + `renderDiagnosticCard`） |
| `ui/src/ui/app-view-state.ts` | 视图状态扩展 |

---

## 五、验证结果

```
src/config/defaults-cn.test.ts    21/21 ✅
src/config/region-cn.test.ts      64/64 ✅  (修复前 60/64)
src/config/ 全目录                385/385 ✅  (45 个测试文件)
TypeScript 编译                   0 errors ✅  (本次修改文件)
```

---

## 六、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| CN 默认值是否持久化到磁盘 | **否** | 只存在于运行时；config 文件只保存用户显式选择 |
| `tools.exec.allowlist` 是否注入 | **否** | `security="full"` 时所有命令已允许 |
| Skills 镜像是否通过此函数设置 | **否** | CN 镜像已是代码硬编码默认值 |
| 是否修改 setup-wizard.ts | **否** | `applyCnDefaults` 在 loadConfig() 时自动生效 |
| 链中位置 | applySession 之后、applyAgent 之前 | 确保 CN 平台感知值优先于全局默认值 |
