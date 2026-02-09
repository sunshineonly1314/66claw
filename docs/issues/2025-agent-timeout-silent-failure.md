# 问题归档：Agent 超时静默失败

> 归档日期：2025-02
> 严重等级：P1（用户可感知的功能缺陷）
> 状态：已修复

---

## 1. 客诉原文

用户反馈 AI 助手在对话过程中突然停止响应，无任何提示。用户多次追问"你还在吗"、"你怎么不说话了"，均无回复。

## 2. 问题分析

### 2.1 日志关键信息

```
[FreeModel] 未使用免费模型: 功能未启用        ← INFO 日志，非错误
embedded run timeout: runId=xxx timeoutMs=600000
durationMs=600438 aborted=true payloads.length=14
```

### 2.2 根因定位

| 排查项 | 结论 |
|--------|------|
| `[FreeModel] 未使用免费模型` | INFO 日志，表示免费模型功能未启用（付费用户正常） |
| `durationMs=600438` | Agent 运行恰好 10 分钟后被内部超时机制中止 |
| `aborted=true` | 超时触发了 abort，但**没有向用户发送任何通知** |
| `payloads.length=14` | AI 执行了 14 轮工具调用（构建 RPG Maker 项目），任务复杂 |

### 2.3 根因链路

```
attempt.ts:636 — 内部 10 分钟计时器触发，调用 abortRun(true)
    ↓
run.ts:708-739 — 构建 payloads，但超时场景未追加提示消息
    ↓
run.ts:733 — 空 payload 处理逻辑跳过了 aborted 的情况
    ↓
controllers/chat.ts:209-212 — 前端收到 state:"aborted"，仅清理流式状态，无消息
    ↓
结果：用户看到 AI 静默消失，无任何解释
```

### 2.4 超时原因

AI 在执行一个 RPG Maker 项目构建任务，涉及大量工具调用（文件创建、编译、调试），10 分钟内未完成。这是正常的复杂任务场景，与地域/网络无关。默认超时 600 秒可通过 `agents.defaults.timeoutSeconds` 配置调整。

---

## 3. 修复方案

采用**后端 payload + 前端兜底**的双重安全机制。

### 3.1 后端：超时通知 payload（主路径）

**文件**：`src/agents/pi-embedded-runner/run.ts`

超时时追加用户友好的提示消息到 payloads，包含运行统计信息：

```typescript
if (timedOut) {
  const mins = Math.round((Date.now() - started) / 60000);
  const toolCount = attempt.toolCallCount;
  const lines = [
    `⚠️ 操作已超时（运行约${mins}分钟，执行了${toolCount}次工具调用后达到时间限制）。`,
    "",
    "任务尚未完成，您可以：",
    "• 发送消息继续当前任务（AI 会从中断处继续）",
    "• 将复杂任务拆分为更小的步骤，逐步完成",
  ];
  payloads.push({ text: lines.join("\n"), isError: true });
}
```

### 3.2 后端：空响应兜底

**文件**：`src/agents/pi-embedded-runner/run.ts`

修复 `payloads.length === 0` 时的静默失败：

```typescript
if (payloads.length === 0) {
  if (timedOut) {
    // 由超时逻辑统一处理
  } else if (aborted) {
    // 用户主动 /stop — 不需要额外提示
  } else if (attempt.lastAssistant) {
    payloads.push({ text: "⚠️ 模型返回了空响应，请重试或切换其他模型。", isError: true });
  } else {
    payloads.push({ text: "⚠️ 未收到模型响应，请检查网络连接和模型配置后重试。", isError: true });
  }
}
```

### 3.3 后端：预超时警告日志

**文件**：`src/agents/pi-embedded-runner/run/attempt.ts`

在超时阈值 80% 时输出 WARN 日志，辅助运维定位：

```typescript
const preTimeoutTimer = params.timeoutMs >= 120_000 && !isProbeSession
  ? setTimeout(() => {
      log.warn(`embedded run approaching timeout (80%): runId=${params.runId} ...`);
    }, Math.round(params.timeoutMs * 0.8))
  : undefined;
```

同时新增 `toolCallCount` 返回字段，用于超时消息中展示统计。

### 3.4 前端：aborted 状态超时兜底

**文件**：`ui/src/ui/controllers/chat.ts`

区分用户主动中止 vs 系统超时：

```typescript
} else if (payload.state === "aborted") {
  state.chatStream = null;
  state.chatRunId = null;
  const elapsed = state.chatStreamStartedAt ? Date.now() - state.chatStreamStartedAt : 0;
  state.chatStreamStartedAt = null;
  const isUserAbort = payload.stopReason === "rpc" || payload.stopReason === "stop";
  if (!isUserAbort && elapsed >= 300_000) {
    // 非用户主动中止 + 运行超过 5 分钟 → 大概率超时
    state.chatMessages = [...state.chatMessages, {
      role: "assistant",
      content: [{ type: "text", text: "⚠️ 操作超时，您可以发送消息继续对话。" }],
      timestamp: Date.now(), isError: true,
    }];
  }
}
```

### 3.5 前端：aborted 时刷新历史

**文件**：`ui/src/ui/app-gateway.ts`

```typescript
// 修复前：仅 final/error 触发 loadChatHistory
// 修复后：aborted 也触发，确保后端写入 transcript 的超时消息能被加载
if (state === "final" || state === "error" || state === "aborted")
  void loadChatHistory(host);
```

### 3.6 i18n 国际化

**文件**：`ui/src/ui/i18n/locales/zh-CN.ts` & `en.ts`

新增 `chat.timeoutAborted` 和 `chat.emptyResponse` 键。

---

## 4. 事件流路径分析

### 内部超时（主路径）

```
attempt.ts 10min 计时器 → abortRun(true) → timedOut=true, aborted=true
  → run.ts 构建 payloads + 超时 payload
  → emitAgentEvent → state:"final" 广播
  → app-gateway.ts → loadChatHistory() → 从 transcript 加载超时消息
```

### 外部中止（兜底路径）

```
chat-abort.ts → broadcastChatAborted → state:"aborted" + stopReason
  → controllers/chat.ts → 检查 elapsed >= 300s → 显示超时兜底消息
  → app-gateway.ts → loadChatHistory() → 刷新历史
```

**无重复消息风险**：内部超时走 `"final"` 路径，前端 `"aborted"` 处理器是独立的安全兜底。

---

## 5. 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/agents/pi-embedded-runner/run.ts` | 超时 payload、空响应兜底、emitAgentEvent 条件修复 |
| `src/agents/pi-embedded-runner/run/attempt.ts` | 预超时警告计时器、toolCallCount 返回值、计时器清理 |
| `src/agents/pi-embedded-runner/run/types.ts` | 新增 `toolCallCount: number` 字段 |
| `ui/src/ui/controllers/chat.ts` | `stopReason` 类型、aborted 超时兜底逻辑 |
| `ui/src/ui/app-gateway.ts` | aborted 状态触发 `loadChatHistory` |
| `ui/src/ui/chat/error-hints.ts` | `isAlreadyFormattedChinese` 透传后端格式化消息、新增错误模式 |
| `ui/src/ui/i18n/locales/zh-CN.ts` | 新增 `chat.timeoutAborted`、`chat.emptyResponse` |
| `ui/src/ui/i18n/locales/en.ts` | 新增 `chat.timeoutAborted`、`chat.emptyResponse` |

---

## 6. 测试验证

| 测试 | 结果 |
|------|------|
| `pi-embedded-helpers.iscontextoverflowerror.test.ts` (5 tests) | 通过 |
| `chat-type.test.ts` (2 tests) | 通过 |
| `chat-sanitize.test.ts` (4 tests) | 通过 |
| `chat-attachments.test.ts` (12 tests) | 通过 |
| TypeScript 编译 `tsc --noEmit` | 通过，零错误 |

---

## 7. 未改动项（刻意保留）

| 项目 | 原因 |
|------|------|
| 默认超时 600s | 可通过 `agents.defaults.timeoutSeconds` 配置，10 分钟对多数场景够用 |
| `[FreeModel]` 日志 | INFO 级别，非错误，无需改动 |
| 阅读指示器 90s 超时卡片 | 已有机制，继续保留 |
| UI 7 阶段等待动画 | 已有机制，与本次修复互补 |

---

## 8. 后续优化建议

| 优先级 | 建议 | 说明 |
|--------|------|------|
| P2 | `maxToolCalls` 配置 | 限制单次运行最大工具调用次数，防止无限循环 |
| P2 | 单 profile 频率限制提示优化 | 当前为 generic 消息，可展示具体的冷却时间 |
| P3 | 图片拒绝反馈 | 模型不支持图片时给用户明确提示 |
| P3 | 超时时间动态建议 | 根据历史运行时长，建议用户调整超时配置 |
