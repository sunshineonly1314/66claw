# 功能归档：性能档位（Performance Profile）三档切换

> 日期：2026-02-08
> 状态：已完成（含测试 Review 修复）
> 关联：2025-0208-cn-defaults-and-bugfixes.md（CN 默认参数基础设施）

---

## 一、功能概述

### 1.1 背景

ClawdbotCN 面向中国初级用户，大量配置参数对新手不友好。参数审计发现 4 个关键参数（`thinkingDefault`、`contextPruning.ttl`、`maxConcurrent`、`heartbeat.every`）对 AI 性能影响显著，但彼此耦合——单独调整某一项可能导致不一致的行为。

**核心需求**：提供"一键式"性能档位，让用户无需理解具体参数，直接选择使用偏好。

### 1.2 设计决策

| 决策点 | 候选方案 | 最终选择 | 理由 |
|--------|----------|----------|------|
| 档位数量 | 2 档（平衡/强劲） | **3 档** | 用户明确要求保留 economy 档 |
| UI 控件 | 简单 toggle / 下拉菜单 | **3-segment 滑动控件** | 复用 theme-toggle 模式，视觉一致性好 |
| 放置位置 | 配置页面 / 聊天控制栏 | **聊天控制栏 `.chat-controls`** | 切换频率高，需要即时反馈 |
| 写入策略 | fill-empty / explicit-write | **显式覆盖** | 档位切换必须立即覆盖对应字段值 |
| profile 存储 | 不存储（推导） | **存储到 `meta.performanceProfile`** | 需要在页面刷新后恢复选择状态 |
| 移动端适配 | 需要 | **不需要** | Web UI 仅 PC 端管理面板，移动端走 IM 通道 |

### 1.3 三档预设参数表

| 参数路径 | Economy（省钱） | Balanced（平衡） | Power（强劲） |
|----------|-----------------|-------------------|---------------|
| `agents.defaults.thinkingDefault` | `"low"` | `"medium"` | `"high"` |
| `agents.defaults.contextPruning.ttl` | `"10m"` | `"1h"` | `"2h"` |
| `agents.defaults.maxConcurrent` | `2` | `4` | `6` |
| `agents.defaults.heartbeat.every` | `"1h"` | `"30m"` | `"10m"` |

---

## 二、实现详情

### 2.1 后端：类型 + Schema + 函数

#### 类型定义

**文件**：`src/config/types.clawdbot.ts`

```typescript
export type PerformanceProfile = "economy" | "balanced" | "power";

// meta 节新增字段
meta?: {
  performanceProfile?: PerformanceProfile;
};
```

#### Zod Schema

**文件**：`src/config/zod-schema.ts`

```typescript
meta: z.object({
  performanceProfile: z.enum(["economy", "balanced", "power"]).optional(),
}).strict().optional(),
```

#### 后端应用函数

**文件**：`src/config/defaults.ts`

```typescript
export function applyPerformanceProfile(
  cfg: ClawdbotConfig,
  profile: PerformanceProfile,
): ClawdbotConfig
```

- 纯函数，返回新对象（不修改输入）
- 使用 spread 操作符合并，保留所有其他字段
- **不在 config 加载链路中调用**——仅 UI 触发

### 2.2 P0 修复：contextPruning.ttl 默认值

**文件**：`src/config/defaults.ts`（`applyContextPruningDefaults` 函数）

- `contextPruning.ttl` fallback 从 `"5m"` 改为 `"1h"`
- 5 分钟过于激进，会导致会话中有用的上下文被频繁清除

### 2.3 前端：UI 控件

#### 状态

**文件**：`ui/src/ui/app-view-state.ts`

```typescript
performanceProfile: "economy" | "balanced" | "power";
performanceProfileSaving: boolean;
```

**文件**：`ui/src/ui/app.ts`

```typescript
@state() performanceProfile: "economy" | "balanced" | "power" = "balanced";
@state() performanceProfileSaving = false;
```

#### 渲染

**文件**：`ui/src/ui/app-render.helpers.ts`

- `renderChatControls` 末尾添加分隔符 + `renderPerfToggle(state)`
- `renderPerfToggle`：3 段按钮 + 滑动指示器（CSS custom property `--perf-index`）
- 3 个 SVG 图标：叶子（economy）、天平（balanced）、闪电（power）
- disabled 条件：`onboarding || performanceProfileSaving || !connected`

#### 控制器

**文件**：`ui/src/ui/controllers/perf-profile.ts`（新文件）

| 函数 | 职责 |
|------|------|
| `resolvePerformanceProfile(state)` | 从 configSnapshot 读取当前档位，默认 `"balanced"` |
| `syncPerformanceProfile(state)` | 连接建立后同步档位到 UI 状态 |
| `applyPerformanceProfile(state, profile)` | 乐观更新 → clone config → 写入字段 → `config.apply` → 重新加载 |

写入链路：
1. 乐观更新 `state.performanceProfile`
2. clone `configSnapshot.config`
3. 写入 `meta.performanceProfile` + 4 个参数字段
4. `serializeConfigForm(config)` → `config.apply`
5. **重置 `configFormDirty = false`**（CRITICAL 修复，见下文）
6. `loadConfig` 重新获取最新 config + hash
7. 失败时回滚到 previous

#### 接入点

**文件**：`ui/src/ui/app-chat.ts`

- `refreshChat` 的 `Promise.all` 中添加 `syncPerformanceProfile(host)`

### 2.4 样式

**文件**：`ui/src/styles/chat/layout.css`

- `.perf-toggle` 系列样式（~110 行），复用 theme-toggle 模式
- CSS custom properties：`--perf-item-w: 64px`、`--perf-item-h: 28px`、`--perf-gap: 2px`、`--perf-pad: 3px`
- 滑动指示器：`translateX(calc(var(--perf-index) * (item + gap)))`
- light theme 覆盖
- 640px 响应式（收窄按钮 54px / 字号 10px / 图标 10px）

### 2.5 i18n

**文件**：`ui/src/ui/i18n/locales/en.ts` / `zh-CN.ts`

| Key | EN | ZH-CN |
|-----|----|-------|
| `chat.perfProfile` | Performance | 性能 |
| `chat.perfProfile.economy` | Eco | 省钱 |
| `chat.perfProfile.balanced` | Balanced | 平衡 |
| `chat.perfProfile.power` | Power | 强劲 |
| `chat.perfProfile.economy.title` | Economy: lower cost, lighter context | 经济模式：省钱省 token，轻量上下文 |
| `chat.perfProfile.balanced.title` | Balanced: recommended for most users | 平衡模式：推荐大多数用户使用 |
| `chat.perfProfile.power.title` | Power: maximum capability, higher cost | 强劲模式：最强能力，消耗更多 token |
| `chat.perfProfile.disabled` | Disabled during onboarding | 引导流程中不可用 |

---

## 三、变更文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/config/types.clawdbot.ts` | 修改 | 新增 `PerformanceProfile` 类型 + `meta.performanceProfile` 字段 |
| `src/config/zod-schema.ts` | 修改 | meta 对象新增 `performanceProfile` enum |
| `src/config/defaults.ts` | 修改 | P0 ttl 修复 + `PERFORMANCE_PRESETS` + `applyPerformanceProfile()` |
| `ui/src/ui/app-view-state.ts` | 修改 | 新增 2 个状态字段 |
| `ui/src/ui/app.ts` | 修改 | 新增 2 个 `@state()` 声明 |
| `ui/src/ui/app-render.helpers.ts` | 修改 | 新增 `renderPerfToggle` + 3 个 icon 函数 |
| `ui/src/ui/app-chat.ts` | 修改 | `refreshChat` 接入 `syncPerformanceProfile` |
| `ui/src/ui/controllers/perf-profile.ts` | **新增** | 性能档位控制器（resolve / sync / apply） |
| `ui/src/styles/chat/layout.css` | 修改 | `.perf-toggle` CSS 样式 |
| `ui/src/ui/i18n/locales/en.ts` | 修改 | 8 个新 i18n key |
| `ui/src/ui/i18n/locales/zh-CN.ts` | 修改 | 8 个新 i18n key |

---

## 四、测试 Review 与修复

### 4.1 边界测试矩阵

| # | 场景 | 预期行为 | 结果 |
|---|------|----------|------|
| 1 | 未连接时点击档位 | 按钮 disabled | PASS |
| 2 | onboarding 期间 | 按钮 disabled | PASS |
| 3 | 保存中重复点击 | 忽略（`performanceProfileSaving`） | PASS |
| 4 | 点击当前已选档位 | 忽略（`profile === current`） | PASS |
| 5 | `config.apply` 失败 | 回滚到 previous | PASS |
| 6 | `config.get` 无 hash | 抛错 → 回滚 | PASS |
| 7 | 连续快速切换 2 次 | 第 2 次被 `performanceProfileSaving` 阻止 | PASS |
| 8 | 配置页面表单脏 + 切换档位 | 表单基线应刷新 | **FAIL → 已修复** |
| 9 | 切换后再保存配置表单 | 应包含新档位值 | **FAIL → 已修复** |

### 4.2 发现的问题与处理

| 等级 | 问题 | 处理 |
|------|------|------|
| **CRITICAL** | `configFormDirty` 未重置 → `applyConfigSnapshot` 跳过更新 `configFormOriginal` → 配置页面脏检测永久失效 | **已修复**：`config.apply` 成功后 `loadConfig` 前插入 `state.configFormDirty = false` |
| **CRITICAL** | 配置表单旧基线覆盖档位新值（用户切到配置页面保存时用旧值覆盖） | **已修复**：同上（根因相同） |
| MEDIUM | `serializeConfigForm` 用 `JSON.stringify` 丢失 JSON5 注释 | 预存问题，不在本次范围。建议后续切换到 JSON5.stringify |
| LOW | 无前端权限检查（toggle 始终可见） | 当前无影响（全员 admin）。建议未来增加只读角色时补充 |
| INFO | `credentials` 字段在 TS 类型中存在但不在 Zod `.strict()` schema 中 | 预存问题，与本次无关 |

### 4.3 CRITICAL 修复详情

**文件**：`ui/src/ui/controllers/perf-profile.ts` 第 134-135 行

```typescript
// config.apply 成功后：
state.configFormDirty = false;  // ← 新增
await loadConfig(state as never);
```

**修复原理**：
- `loadConfig` 内部调用 `applyConfigSnapshot`
- `applyConfigSnapshot` 检查 `configFormDirty`：如果为 `true` 则跳过更新 `configForm` 和 `configFormOriginal`
- 性能档位切换成功后，config 已经变了，表单基线必须同步刷新
- 设置 `configFormDirty = false` 确保 `applyConfigSnapshot` 用最新 config 刷新基线
- 副作用：如果用户同时在配置页面有未保存的编辑，这些编辑会被丢弃——这是正确行为（config 已被档位切换覆盖）

---

## 五、架构注意事项

### 5.1 写入策略差异

| 机制 | 策略 | 说明 |
|------|------|------|
| `applyCnDefaults()` | fill-empty（`??`） | 只填空不覆盖，不持久化 |
| `applyPerformanceProfile()` | explicit-write | 显式覆盖，持久化到 config.json5 |

两者互不冲突：`applyCnDefaults` 在 config 加载链路中运行（运行时），`applyPerformanceProfile` 仅在用户点击 UI 时触发（写入时）。

### 5.2 config.apply 响应无 hash

`config.apply` 的响应为 `{ ok, path, config, restart, hotReloadedChannels }`，不包含 `hash` 字段。因此 `applyPerformanceProfile` 必须在 `config.apply` 后调用 `loadConfig`（即 `config.get`）来获取最新的 hash，否则下次切换会因 hash 缺失而失败。

### 5.3 PERFORMANCE_PRESETS 双端一致性

后端 `src/config/defaults.ts` 和前端 `ui/src/ui/controllers/perf-profile.ts` 各自维护了一份 `PERFORMANCE_PRESETS`。实际写入以前端控制器为准（它直接操作 config 对象并调用 `config.apply`）。后端的 `applyPerformanceProfile` 函数供 API/CLI 场景使用。两份数据必须保持一致。
