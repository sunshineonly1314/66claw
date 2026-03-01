---
name: browser-use-api
name_zh: 浏览器API使用
version: 1.0.0
description: 通过 Browser Use API 实现云端浏览器自动化。当您需要 AI 驱动的网页浏览、网页抓取、表单填写或无需本地浏览器控制的多步骤网页任务时，请使用本 skill。触发词包括：“browser use”、“cloud browser”、“scrape website”、“automate web task”，或当本地浏览器不可用/不适用时。
description_zh: 通过 Browser Use API 实现云端浏览器自动化。当您需要 AI 驱动的网页浏览、网页抓取、表单填写或无需本地浏览器控制的多步骤网页任务时，请使用本 skill。触发词包括：“browser use”、“cloud browser”、“scrape website”、“automate web task”，或当本地浏览器不可用/不适用时。
metadata: {"clawdbot":{"emoji":"🌐","requires":{"env":["BROWSER_USE_API_KEY"]}}}
---
# Browser Use

基于云的 AI 浏览器自动化。以纯英文发送任务，获取结构化结果。

## 快速开始

```bash
# Submit task
curl -s -X POST https://api.browser-use.com/api/v2/tasks \
  -H "X-Browser-Use-API-Key: $BROWSER_USE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task": "Go to example.com and extract the main heading"}'

# Poll for result (replace TASK_ID)
curl -s "https://api.browser-use.com/api/v2/tasks/TASK_ID" \
  -H "X-Browser-Use-API-Key: $BROWSER_USE_API_KEY"
```

## 辅助脚本

使用 `scripts/browser-use.sh` 可简化执行流程：

```bash
# Run task and wait for result
./scripts/browser-use.sh "Go to hacker news and get the top 3 stories"

# Just submit (don't wait)
./scripts/browser-use.sh --no-wait "Search Google for AI news"
```

## API 参考

### 创建任务
```
POST https://api.browser-use.com/api/v2/tasks
```

请求体（Body）：
```json
{
  "task": "Plain English description of what to do",
  "llm": "gemini-3-flash-preview"  // optional, default is fast model
}
```

响应（Response）：
```json
{
  "id": "task-uuid",
  "sessionId": "session-uuid"
}
```

### 获取任务状态
```
GET https://api.browser-use.com/api/v2/tasks/{taskId}
```

响应字段说明：
- `status`：`pending` | `started` | `finished` | `failed`
- `output`：任务完成后的结果文本
- `steps`：已执行操作数组（含截图）
- `cost`：费用（单位：美元，例如 "0.02"）
- `isSuccess`：布尔型结果

### 停止任务
```
POST https://api.browser-use.com/api/v2/tasks/{taskId}/stop
```

## 定价

每项任务约 $0.01–0.05，具体取决于任务复杂度。查询余额：
```bash
curl -s https://api.browser-use.com/api/v2/credits \
  -H "X-Browser-Use-API-Key: $BROWSER_USE_API_KEY"
```

## 适用场景

- 复杂的多步骤网页工作流
- 抵制简单抓取的网站
- 表单填写与提交
- 需要记录各步骤截图
- 无法使用本地浏览器控制时

## 不适用场景

- 简单的页面获取（请改用 `web_fetch`）
- 您可访问本地浏览器时（请改用 `browser` 工具）
- 快速/高并发量的网页抓取（请改用 Code Use 或本地抓取）