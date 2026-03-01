---
name: doubleword
name_zh: DoubleWord
description: 使用 Doubleword API（api.doubleword.ai）创建和管理批处理推理任务。当用户希望：（1）以批处理模式处理多个 AI 请求，（2）提交 JSONL 批处理文件进行异步推理，（3）监控批处理任务进度并检索结果，（4）使用与 OpenAI 兼容的批处理端点，（5）处理无需即时响应的大规模推理工作负载，（6）在批处理中使用 tool calling 或结构化输出，（7）借助 autobatcher 自动批处理 API 调用时，请使用该 skills。
description_zh: 使用 Doubleword API（api.doubleword.ai）创建和管理批处理推理任务。当用户希望：（1）以批处理模式处理多个 AI 请求，（2）提交 JSONL 批处理文件进行异步推理，（3）监控批处理任务进度并检索结果，（4）使用与 OpenAI 兼容的批处理端点，（5）处理无需即时响应的大规模推理工作负载，（6）在批处理中使用 tool calling 或结构化输出，（7）借助 autobatcher 自动批处理 API 调用时，请使用该 skills。
---
# Doubleword 批处理推理

利用 Doubleword 批处理 API，以高吞吐量、低成本方式异步处理多个 AI 推理请求。

## 前置条件

提交批处理任务前，您需具备：
1. **Doubleword 账户** —— 访问 https://app.doubleword.ai/ 注册
2. **API 密钥** —— 在控制台的“API 密钥”页面中创建
3. **账户信用额度** —— 充值信用额度以处理请求（详见下方定价说明）

## 何时使用批处理

批处理适用于以下场景：
- 多个相互独立、可并行执行的请求
- 无需即时响应的工作负载
- 规模过大、单独发送会超出速率限制的请求
- 对成本敏感的工作负载（24 小时窗口比实时模式便宜 50–60%）
- 大规模的 tool calling 和结构化输出生成

## 可用模型与定价

定价按每百万 token（输入 / 输出）计：

**Qwen3-VL-30B-A3B-Instruct-FP8**（中型模型）：
- 实时 SLA：$0.16 / $0.80
- 1 小时 SLA：$0.07 / $0.30（便宜 56%）
- 24 小时 SLA：$0.05 / $0.20（便宜 69%）

**Qwen3-VL-235B-A22B-Instruct-FP8**（旗舰模型）：
- 实时 SLA：$0.60 / $1.20
- 1 小时 SLA：$0.15 / $0.55（便宜 75%）
- 24 小时 SLA：$0.10 / $0.40（便宜 83%）
- 支持最高 262K 总 token，单次请求最多生成 16K 新 token

**成本估算：** 在 Doubleword 控制台上传文件，提交前即可预览费用。

## 快速入门

提交批处理的两种方式：

**通过 API：**
1. 创建包含请求的 JSONL 文件
2. 上传文件获取 file ID
3. 使用 file ID 创建批处理任务
4. 轮询状态直至完成
5. 通过 output_file_id 下载结果

**通过 Web 控制台：**
1. 访问 https://app.doubleword.ai/ 并进入“批处理”页面
2. 上传 JSONL 文件
3. 配置批处理设置（模型、完成时间窗口等）
4. 在实时仪表板中监控进度
5. 准备就绪后下载结果

## 工作流程

### 步骤 1：创建批处理请求文件

创建一个 `.jsonl` 文件，其中每行均为一个完整、合法的 JSON 对象，且对象内部不含换行符：

```json
{"custom_id": "req-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "anthropic/claude-3-5-sonnet", "messages": [{"role": "user", "content": "What is 2+2?"}]}}
{"custom_id": "req-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "anthropic/claude-3-5-sonnet", "messages": [{"role": "user", "content": "What is the capital of France?"}]}}
```

**每行必需字段：**
- `custom_id`：唯一标识符（最长 64 字符）——建议使用描述性 ID（如 `"user-123-question-5"`），便于结果映射
- `method`：值恒为 `"POST"`
- `url`：API 端点 —— `"/v1/chat/completions"` 或 `"/v1/embeddings"`
- `body`：标准 API 请求，含 `model` 和 `messages`

**可选请求体（Body）参数：**
- `temperature`：取值范围 0–2（默认：1.0）
- `max_tokens`：最大响应 token 数
- `top_p`：核采样（nucleus sampling）参数
- `stop`：终止序列（stop sequences）
- `tools`：tool calling 的工具定义（参见“Tool Calling”章节）
- `response_format`：结构化输出的 JSON Schema（参见“Structured Outputs”章节）

**文件要求：**
- 最大尺寸：200 MB
- 格式：仅支持 JSONL（JSON Lines，即换行符分隔的 JSON）
- 每行必须为合法 JSON，且内部不得含换行符
- `custom_id` 值不得重复
- 如需处理超大批量，请拆分为多个文件

**常见陷阱：**
- JSON 对象内部含换行符（将导致解析错误）
- JSON 语法非法
- `custom_id` 值重复

**辅助脚本：**  
使用 `scripts/create_batch_file.py` 可编程生成 JSONL 文件：

```bash
python scripts/create_batch_file.py output.jsonl
```

修改脚本中的 `requests` 列表，以生成您所需的批处理请求。

### 步骤 2：上传文件

**通过 API：**  
```bash
curl https://api.doubleword.ai/v1/files \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY" \
  -F purpose="batch" \
  -F file="@batch_requests.jsonl"
```

**通过控制台：**  
在 https://app.doubleword.ai/ 的“批处理”页面中上传

响应中包含 `id` 字段——请保存该 file ID 供下一步使用。

### 步骤 3：创建批处理任务

**通过 API：**  
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

**通过控制台：**  
在网页界面中配置批处理设置

**参数：**
- `input_file_id`：来自上传步骤的 file ID
- `endpoint`：API 端点（`"/v1/chat/completions"` 或 `"/v1/embeddings"`）
- `completion_window`：根据紧急程度与预算选择：
  - `"24h"`：价格最优，结果在 24 小时内返回（通常更快）
  - `"1h"`：价格上浮 50%，结果在 1 小时内返回（通常更快）
  - Realtime：容量有限，成本最高（批处理服务专为异步场景优化）

响应中包含批处理 `id` —— 请保存该 ID 用于状态轮询。

**提交前请确认：**
- 您有权访问指定模型
- API 密钥处于激活状态
- 账户信用额度充足

### 步骤 4：轮询状态

**通过 API：**  
```bash
curl https://api.doubleword.ai/v1/batches/batch-xyz789 \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY"
```

**通过控制台：**  
在“批处理”仪表板中实时监控进度

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

**通过 API：**  
```bash
curl https://api.doubleword.ai/v1/files/file-output123/content \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY" \
  > results.jsonl
```

**通过控制台：**  
直接从“批处理”仪表板下载结果

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

## 批处理中的 Tool Calling

Tool calling（函数调用）使模型能够智能地选择并调用外部工具。Doubleword 完全兼容 OpenAI 规范。

**带工具调用的批处理请求示例：**  
```json
{
  "custom_id": "tool-req-1",
  "method": "POST",
  "url": "/v1/chat/completions",
  "body": {
    "model": "anthropic/claude-3-5-sonnet",
    "messages": [{"role": "user", "content": "What's the weather in Paris?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather for a location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {"type": "string"}
          },
          "required": ["location"]
        }
      }
    }]
  }
}
```

**典型用例：**
- 大规模调用 API 的 agent
- 为多个查询获取实时信息
- 通过标准化工具定义执行操作

## 批处理中的结构化输出

结构化输出可确保模型响应严格符合您定义的 JSON Schema，避免缺失字段或无效枚举值等问题。

**带结构化输出的批处理请求示例：**  
```json
{
  "custom_id": "structured-req-1",
  "method": "POST",
  "url": "/v1/chat/completions",
  "body": {
    "model": "anthropic/claude-3-5-sonnet",
    "messages": [{"role": "user", "content": "Extract key info from: John Doe, 30 years old, lives in NYC"}],
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "person_info",
        "schema": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "age": {"type": "integer"},
            "city": {"type": "string"}
          },
          "required": ["name", "age", "city"]
        }
      }
    }
  }
}
```

**优势：**
- 保证 Schema 合规性
- 不会遗漏必需字段
- 不会出现幻觉生成的枚举值
- 无缝兼容 OpenAI 接口

## autobatcher：自动批处理

autobatcher 是一个 Python 客户端，可自动将单个 API 调用聚合为批处理请求，在不修改代码的前提下降低成本。

**安装：**  
```bash
pip install autobatcher
```

**工作原理：**
1. **聚合阶段**：请求在时间窗口（默认 1 秒）内累积，或达到批处理大小阈值
2. **提交批处理**：将累积的请求统一提交
3. **结果轮询**：系统监控已完成响应
4. **透明返回**：您的代码接收到标准 ChatCompletion 响应

**核心优势：** 通过自动批处理显著降低成本，同时仍可使用熟悉的 OpenAI 接口编写常规异步代码。

**文档：** https://github.com/doublewordai/autobatcher

## 其他操作

### 列出所有批处理任务

**通过 API：**  
```bash
curl https://api.doubleword.ai/v1/batches?limit=10 \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY"
```

**通过控制台：**  
在仪表板中查看全部批处理任务

### 取消批处理任务

**通过 API：**  
```bash
curl https://api.doubleword.ai/v1/batches/batch-xyz789/cancel \
  -X POST \
  -H "Authorization: Bearer $DOUBLEWORD_API_KEY"
```

**通过控制台：**  
在批处理详情页点击“取消”

**注意事项：**
- 尚未处理的请求将被取消
- 已处理完成的结果仍可下载
- 仅对已完成的工作计费
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

### 处理工具调用

处理工具调用响应：

```python
import json

with open('results.jsonl') as f:
    for line in f:
        result = json.loads(line)
        message = result['response']['body']['choices'][0]['message']

        if message.get('tool_calls'):
            for tool_call in message['tool_calls']:
                print(f"Tool: {tool_call['function']['name']}")
                print(f"Args: {tool_call['function']['arguments']}")
```

## 最佳实践

1. **使用描述性 custom_ids**：在 ID 中包含上下文，便于结果映射  
   - 推荐：`"user-123-question-5"`、`"dataset-A-row-42"`  
   - 不推荐：`"1"`、`"req1"`  

2. **本地验证 JSONL**：上传前确保每行均为合法 JSON，且内部不含换行符  

3. **禁止重复 ID**：每个 `custom_id` 在批处理内必须唯一  

4. **拆分大文件**：通过拆分为多个批处理，确保单个文件不超过 200 MB  

5. **选择合适的时间窗口**：为节省成本，优先选用 `24h`（便宜 50–83%）；仅在时效敏感时选用 `1h`  

6. **优雅处理错误**：始终检查 `error_file_id` 并重试失败请求  

7. **监控 request_counts**：通过 `completed`/`total` 比率跟踪进度  

8. **保存文件 ID**：存储 batch_id、input_file_id、output_file_id，便于后续检索  

9. **使用成本估算器**：提交大规模批处理前，在控制台预览费用  

10. **考虑使用 autobatcher**：对于持续性工作负载，使用 autobatcher 自动批处理单个 API 调用  

## 参考文档

获取完整 API 细节，请参阅：  
- **API 参考文档**：`references/api_reference.md` —— 全面的端点说明与数据结构  
- **入门指南**：`references/getting_started.md` —— 详细的配置与账户管理说明  
- **定价详情**：`references/pricing.md` —— 各模型成本与 SLA 对比  