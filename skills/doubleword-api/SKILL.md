---
name: doubleword-api
name_zh: DoubleWord API
description: 使用 Doubleword API（api.doubleword.ai）创建和管理批处理推理任务。当用户希望：（1）以批处理模式处理多个 AI 请求，（2）提交 JSONL 批处理文件进行异步推理，（3）监控批处理任务进度并检索结果，（4）使用与 OpenAI 兼容的批处理端点，（5）处理无需即时响应的大规模推理工作负载时，请使用该 skills。
description_zh: 使用 Doubleword API（api.doubleword.ai）创建和管理批处理推理任务。当用户希望：（1）以批处理模式处理多个 AI 请求，（2）提交 JSONL 批处理文件进行异步推理，（3）监控批处理任务进度并检索结果，（4）使用与 OpenAI 兼容的批处理端点，（5）处理无需即时响应的大规模推理工作负载时，请使用该 skills。
---
# Doubleword 批处理推理

使用 Doubleword 批处理 API 异步处理多个 AI 推理请求。

## 何时使用批处理

批处理适用于以下场景：
- 多个相互独立、可并行执行的请求
- 无需即时响应的工作负载
- 规模过大、单独发送会超出速率限制的请求
- 对成本敏感的工作负载（24 小时窗口提供更优定价）

## 快速入门

任意批处理任务的基本工作流程如下：

1. **创建 JSONL 文件**（每行一个 JSON 对象）
2. **上传文件**以获取 file ID
3. **使用 file ID 创建批处理任务**
4. **轮询状态**直至完成
5. **通过 output_file_id 下载结果**

## 工作流程

### 步骤 1：创建批处理请求文件

创建一个 `.jsonl` 文件，其中每行均包含一个请求：

```json
{"custom_id": "req-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "anthropic/claude-3-5-sonnet", "messages": [{"role": "user", "content": "What is 2+2?"}]}}
{"custom_id": "req-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "anthropic/claude-3-5-sonnet", "messages": [{"role": "user", "content": "What is the capital of France?"}]}}
```

**每行必需字段：**
- `custom_id`：唯一标识符（最长 64 字符）——建议使用描述性 ID（如 `"user-123-question-5"`），便于结果映射
- `method`：值恒为 `"POST"`
- `url`：值恒为 `"/v1/chat/completions"`
- `body`：标准 API 请求，含 `model` 和 `messages`

**可选请求体（Body）参数：**
- `temperature`：取值范围 0–2（默认：1.0）
- `max_tokens`：最大响应 token 数
- `top_p`：核采样（nucleus sampling）参数
- `stop`：终止序列（stop sequences）

**文件限制：**
- 最大尺寸：200 MB
- 格式：仅支持 JSONL（JSON Lines，即换行符分隔的 JSON）
- 如需处理超大批量，请拆分为多个文件

**辅助脚本：**  
使用 `scripts/create_batch_file.py` 可编程生成 JSONL 文件：

```bash
python scripts/create_batch_file.py output.jsonl
```

修改脚本中的 `requests` 列表，以生成您所需的批处理请求。

### 步骤 2：上传文件

上传 JSONL 文件：

```bash
curl https://api.doubleword.ai/v1/files \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY" \
  -F purpose="batch" \
  -F file="@batch_requests.jsonl"
```

响应中包含 `id` 字段——请保存该 file ID 供下一步使用。

### 步骤 3：创建批处理任务

使用 file ID 创建批处理任务：

```bash
curl https://api.doubleword.ai/v1/batches \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-abc123",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'
```

**参数：**
- `input_file_id`：来自上传步骤的 file ID
- `endpoint`：值恒为 `"/v1/chat/completions"`
- `completion_window`：选择 `"24h"`（价格更优）或 `"1h"`（价格上浮 50%，结果更快）

响应中包含批处理 `id` —— 请保存该 ID 用于状态轮询。

### 步骤 4：轮询状态

检查批处理进度：

```bash
curl https://api.doubleword.ai/v1/batches/batch-xyz789 \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY"
```

**状态流转顺序：**
1. `validating` —— 正在校验输入文件格式
2. `in_progress` —— 正在处理请求
3. `completed` —— 所有请求已完成

**其他状态：**
- `failed` —— 批处理失败（请检查 `error_file_id`）
- `expired` —— 批处理超时
- `cancelling`/`cancelled` —— 批处理已取消

**响应中包含：**
- `output_file_id` —— 在此处下载结果
- `error_file_id` —— 失败的请求（如有）
- `request_counts` —— 总请求数 / 已完成数 / 失败数

**轮询频率：** 处理期间每 30–60 秒检查一次。

**早期访问：** 批处理尚未完全完成时，即可通过 `output_file_id` 获取部分结果——请检查 `X-Incomplete` 响应头。

### 步骤 5：下载结果

下载已完成的结果：

```bash
curl https://api.doubleword.ai/v1/files/file-output123/content \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY" \
  > results.jsonl
```

**响应头（Response Headers）：**
- `X-Incomplete: true` —— 批处理仍在进行中，后续还有更多结果
- `X-Last-Line: 45` —— 部分下载的续传位置（resume point）

**输出格式（每行）：**  
```json
{
  "id": "batch-req-abc",
  "custom_id": "request-1",
  "response": {
    "status_code": 200,
    "body": {
      "id": "chatcmpl-xyz",
      "choices": [{
        "message": {
          "role": "assistant",
          "content": "The answer is 4."
        }
      }]
    }
  }
}
```

**下载错误（如有）：**  
```bash
curl https://api.doubleword.ai/v1/files/file-error123/content \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY" \
  > errors.jsonl
```

**错误格式（每行）：**  
```json
{
  "id": "batch-req-def",
  "custom_id": "request-2",
  "error": {
    "code": "invalid_request",
    "message": "Missing required parameter"
  }
}
```

## 其他操作

### 列出所有批处理任务

```bash
curl https://api.doubleword.ai/v1/batches?limit=10 \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY"
```

### 取消批处理任务

```bash
curl https://api.doubleword.ai/v1/batches/batch-xyz789/cancel \
  -X POST \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY"
```

**注意事项：**
- 尚未处理的请求将被取消
- 已处理完成的结果仍可下载
- 已完成的批处理任务不可取消

## 常见模式

### 处理结果

逐行解析 JSONL 输出：

```python
import json

with open('results.jsonl') as f:
    for line in f:
        result = json.loads(line)
        custom_id = result['custom_id']
        content = result['response']['body']['choices'][0]['message']['content']
        print(f"{custom_id}: {content}")
```

### 处理部分结果

检查批处理是否未完成，并恢复处理：

```python
import requests

response = requests.get(
    'https://api.doubleword.ai/v1/files/file-output123/content',
    headers={'Authorization': f'Bearer {api_key}'}
)

if response.headers.get('X-Incomplete') == 'true':
    last_line = int(response.headers.get('X-Last-Line', 0))
    print(f"Batch incomplete. Processed {last_line} requests so far.")
    # Continue polling and download again later
```

### 重试失败请求

从错误文件中提取失败请求并重新提交：

```python
import json

failed_ids = []
with open('errors.jsonl') as f:
    for line in f:
        error = json.loads(line)
        failed_ids.append(error['custom_id'])

print(f"Failed requests: {failed_ids}")
# Create new batch with only failed requests
```

## 最佳实践

1. **使用描述性 custom_ids**：在 ID 中包含上下文，便于结果映射  
   - 推荐：`"user-123-question-5"`  
   - 不推荐：`"1"`、`"req1"`  

2. **本地验证 JSONL**：上传前确保每行均为合法 JSON  

3. **拆分大文件**：确保单个文件不超过 200 MB  

4. **选择合适的时间窗口**：为节省成本，优先选用 `24h`；仅在时效敏感时选用 `1h`  

5. **优雅处理错误**：始终检查 `error_file_id` 并重试失败请求  

6. **监控 request_counts**：通过 `completed`/`total` 比率跟踪进度  

7. **保存文件 ID**：存储 batch_id、input_file_id、output_file_id，便于后续检索  

## 参考文档

如需获取完整的 API 细节（含身份验证、速率限制及高级参数），请参阅：  
- **API 参考文档**：`references/api_reference.md` —— 全面的端点说明与数据结构  