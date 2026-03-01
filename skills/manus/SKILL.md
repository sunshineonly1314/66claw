---
name: manus
name_zh: Manus
description: 通过 Manus API 创建并管理 AI agent 任务。Manus 是一款自主式 AI agent，能够浏览网页、调用工具，并交付完整的工作成果。
description_zh: 通过 Manus API 创建并管理 AI agent 任务。Manus 是一款自主式 AI agent，能够浏览网页、调用工具，并交付完整的工作成果。
homepage: https://manus.im
metadata: {"clawdbot":{"emoji":"🤖","requires":{"env":["MANUS_API_KEY"]},"primaryEnv":"MANUS_API_KEY"}}
---
# Manus AI Agent

使用 Manus API 创建自主式 AI 任务。Manus 可浏览网页、调用工具，并交付完整成果（如报告、代码、演示文稿等）。

## API 基础地址

`https://api.manus.ai/v1`

## 认证方式

请求头（Header）：`API_KEY: <your-key>`

可通过以下任一方式设置：
- 设置环境变量 `MANUS_API_KEY`
- 或在 clawdbot 配置中设置 `skills.manus.apiKey`

## 推荐工作流

当使用 Manus 执行生成文件类任务（如幻灯片、报告等）时：

1. **创建任务**，传入 `createShareableLink: true`
2. **轮询任务完成状态**，使用 task_id 查询
3. **从响应中提取输出文件** 并下载至本地
4. **以直接文件附件形式交付给用户**（切勿依赖 manus.im 的分享链接）

## 创建任务

```bash
curl -X POST "https://api.manus.ai/v1/tasks" \
  -H "API_KEY: $MANUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Your task description here",
    "agentProfile": "manus-1.6",
    "taskMode": "agent",
    "createShareableLink": true
  }'
```

响应：
```json
{
  "task_id": "abc123",
  "task_title": "Task Title",
  "task_url": "https://manus.im/app/abc123"
}
```

## Agent 配置文件（Profiles）

| 配置文件 | 描述 | 适用场景 |
|----------|------|-----------|
| `manus-1.6` | 标准模式（默认） | 大多数任务 |
| `manus-1.6-lite` | 更快、更轻量 | 快速/简单任务 |
| `manus-1.6-max` | 更复杂、更全面 | 深度研究/分析类任务 |

**默认行为**：除非用户另行指定，否则始终使用 `manus-1.6`。

## 任务模式（Task Modes）

| 模式 | 描述 |
|------|------|
| `chat` | 对话模式 |
| `adaptive` | 自动选择最优方法 |
| `agent` | 全自主 agent 模式（推荐用于文件生成类任务） |

## 获取任务状态与输出

```bash
curl "https://api.manus.ai/v1/tasks/{task_id}" \
  -H "API_KEY: $MANUS_API_KEY"
```

可能的状态值：`pending`、`running`、`completed`、`failed`

**重要提示**：当状态为 `completed` 时，请检查 `output` 数组中的文件：
- 查找 `type: "output_file"` 类型条目
- 直接从 `fileUrl` 下载文件
- 保存至本地并作为附件发送给用户

## 提取输出文件

任务响应中包含如下形式的输出：
```json
{
  "output": [
    {
      "content": [
        {
          "type": "output_file",
          "fileUrl": "https://private-us-east-1.manuscdn.com/...",
          "fileName": "presentation.pdf"
        }
      ]
    }
  ]
}
```

请使用 curl 下载这些文件并直接交付给用户，切勿依赖分享链接（share URLs）。

## 列出任务

```bash
curl "https://api.manus.ai/v1/tasks" \
  -H "API_KEY: $MANUS_API_KEY"
```

## 最佳实践

1. **务必在通知用户任务完成前完成轮询**；
2. **将输出文件下载至本地**，而非提供 manus.im 链接（此类链接可能不可靠）；
3. **对生成文件/文档类任务，请使用 `agent` 模式**；
4. **设定合理预期** —— Manus 任务处理复杂工作可能耗时 2–10 分钟甚至更长。

## 文档

- API 参考：https://open.manus.ai/docs  
- 主文档：https://manus.im/docs