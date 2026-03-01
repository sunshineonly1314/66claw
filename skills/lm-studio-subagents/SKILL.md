---
name: lmstudio-subagents
name_zh: LM Studio子智能体
description: "为 agents 装备在 LM Studio 中搜索并卸载任务至本地模型的能力。适用场景：（1）将简单任务卸载至本地免费模型（摘要生成、信息抽取、分类、改写、初版代码审查、头脑风暴）；（2）任务需要专用模型能力（图像任务使用视觉模型、快速任务使用小模型、复杂推理使用大模型）；（3）在质量足够时，通过使用本地模型节省付费 API 代币；（4）任务需纯本地处理或涉及隐私保护。需已安装 LM Studio，并配置好 lms CLI 且服务正在运行。"
description_zh: 为 agents 装备在 LM Studio 中搜索并卸载任务至本地模型的能力。适用场景：（1）将简单任务卸载至本地免费模型（摘要生成、信息抽取、分类、改写、初版代码审查、头脑风暴）；（2）任务需要专用模型能力（图像任务使用视觉模型、快速任务使用小模型、复杂推理使用大模型）；（3）在质量足够时，通过使用本地模型节省付费 API 代币；（4）任务需纯本地处理或涉及隐私保护。需已安装 LM Studio，并配置好 lms CLI 且服务正在运行。
metadata: {"clawdbot":{"emoji":"🦞","requires":{"bins":["lms"]},"tags":["local-model","local-llm","lm-studio","privacy","subagents"]}}
license: MIT
---
# LM Studio 本地模型

通过向 LM Studio 的 API 发起调用，**直接使用 LM Studio 的本地模型**，将任务卸载至免费的本地 AI 模型。本 skill 使 agents 能够发现可用模型、依据任务需求选择合适模型，并在无需 Clawdbot 预配置的前提下，以低成本实现本地化处理。

## 本 skill 的存在意义（何时启用）

当任务质量要求可接受时，使用本 skill **将自包含的工作卸载至本地/免费模型**，从而节省付费代币，专用于真正需要主模型处理的任务。

典型适用场景：
- 摘要生成、信息抽取、分类、文本改写  
- “初版”代码审查或重构建议
- 提纲草拟、方案备选与头脑风暴

应避免 / 谨慎使用：
- 需要访问网络、专有工具或高可靠性保障的任务（请使用您的主模型）

## 关键术语

- **model_key**：`lms` 命令所使用的标识符（源自 `lms ls`）。您需将此值传入 `lms load`。
- **model_identifier**：使用 `--identifier` 加载模型时所用的标识符。可与 `model_key` 相同，也可设为自定义名称。该标识符用于向 LM Studio 发起 API 调用。
- **lm_studio_api_url**：LM Studio API 的基础 URL。默认为 `http://127.0.0.1:1234/v1`。无需 Clawdbot 配置——本 skill 可直接兼容 LM Studio 默认服务。

**注意**：上述描述已涵盖全部触发条件。以下各节提供技能被触发后实际使用的实施细节。

## 前置条件

- 已安装 LM Studio，且 `lms` CLI 已加入系统 PATH 环境变量
- LM Studio 服务正在运行（默认地址：http://127.0.0.1:1234）
- 已在 LM Studio 中下载所需模型
- 已安装 Node.js（用于辅助脚本；亦可使用 curl 替代）

## 完整工作流

### 步骤 0：预检（必需）

1) 验证 LM Studio CLI 是否可用：

```bash
exec command:"lms --help"
```

2) 验证 LM Studio 服务正在运行且可访问：

```bash
exec command:"lms server status --json"
```

### 步骤 1：列出可用模型

获取所有已下载模型：

```bash
exec command:"lms ls --json"
```

解析 JSON 输出以提取以下字段：
- model_key（例如 `meta-llama-3.1-8b-instruct` 或 `lmstudio-community/meta-llama-3.1-8b-instruct`）
- 类型（llm、vlm、embeddings）
- 大小（磁盘占用空间）
- 架构（Llama、Qwen2 等）
- 参数量（模型规模）

如需按类型筛选：
- `lms ls --json --llm` —— 仅显示 LLM 模型  
- `lms ls --json --embedding` —— 仅显示嵌入模型
- `lms ls --json --detailed` —— 显示更详细信息

### 步骤 2：检查当前已加载模型

查看内存中已加载的模型：

```bash
exec command:"lms ps --json"
```

解析 JSON 输出，确认当前已加载哪些模型。

若已有合适模型处于加载状态（通过 model_identifier 判定），可跳过至步骤 6（调用 API）。

### 步骤 3：模型选择

分析任务需求，选择最适配的模型：

**选择标准：**
- **任务复杂度**：简单任务选用小模型（1B–3B），复杂任务选用大模型（7B+）
- **上下文长度需求**：匹配模型最大上下文长度与任务所需长度
- **模型能力**：视觉任务选用 VLM 模型，检索任务选用嵌入模型，文本生成选用 LLM
- **内存约束**：在适配前提下优先选用已加载模型
- **模型大小**：在能力需求与可用内存之间取得平衡

**模型选择操作：**
- 从 `lms ls` 中选取一个符合任务需求的 `model_key`。
- 加载模型时，使用该 `model_key` 作为 `model_identifier`（或从中派生出简洁标识符）。
- LM Studio 中任意模型均可直接使用——无需额外配置。

### 步骤 4：加载模型

加载大型模型前，可选地预估内存需求：

```bash
exec command:"lms load --estimate-only <model_key>"
```

将选定模型加载至内存：

```bash
exec command:"lms load <model_key> --identifier \"<model_identifier>\" --ttl 3600"
```

**可选参数：**
- `--gpu=max|auto|0.0-1.0` —— 控制 GPU 卸载比例（例如 `--gpu=0.5` 表示 50% GPU，`--gpu=max` 表示全 GPU）
- `--context-length=<N>` —— 设置上下文长度（例如 `--context-length=4096`）
- `--identifier="<name>"` —— 为 API 引用指定自定义标识符（推荐使用 model_key 或派生简洁标识符）
- `--ttl=<seconds>` —— 设定空闲超时后自动卸载（推荐设为默认值，以避免抖动及清理竞争）

**重要提示**：`lms load` 命令将阻塞执行，直至模型完全加载完毕。对于大型模型（70B+），此过程可能耗时 3 分钟以上。命令将在加载完成后返回。

**示例：**
```bash
exec command:"lms load meta-llama-3.1-8b-instruct --identifier \"meta-llama-3.1-8b-instruct\" --gpu=auto --context-length=4096 --ttl 3600"
```

### 步骤 5：验证模型已加载（关键安全步骤）

**切勿在未验证模型已加载的情况下调用 API。**

**注意**：由于 `lms load` 会阻塞至加载完成，因此验证理应简单直接。但出于安全考虑，仍须执行此验证步骤。

验证模型是否确已驻留于内存中：

```bash
exec command:"lms ps --json"
```

解析 JSON 响应，检查 model_identifier 是否出现在已加载标识符列表中。

**若未找到模型：**
1. 此情况极罕见（因 `lms load` 已阻塞等待加载完成），但若发生：
2. 等待 2–3 秒（模型可能仍在最终初始化）
3. 重试验证：`exec command:"lms ps --json"`
4. 最多重复验证共 3 次
5. 若重试后仍未加载：**中止流程**并报错，**切勿调用 API**

**若已找到模型**：继续执行 LM Studio API 调用。

### 步骤 6：直接调用 LM Studio API

直接使用已加载模型调用 LM Studio 提供的 OpenAI 兼容 API。

**选项 A：使用辅助脚本（推荐，更可靠）**

```bash
exec command:"node {baseDir}/scripts/lmstudio-api.mjs <model_identifier> '<task description>' --temperature=0.7 --max-tokens=2000"
```

该脚本具备以下功能：
- 正确 JSON 编码（规避转义问题）
- 错误处理与自动重试
- 响应校验（验证 `response.model` 与请求一致）
- 统一输出格式

**选项 B：直接使用 curl 调用**

**API 地址**：使用默认 `http://127.0.0.1:1234/v1`（LM Studio 标准默认值）。无需任何配置。

**发起 API 调用：**

```bash
exec command:"curl -X POST <lm_studio_api_url>/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer lmstudio' \
  -d '{
    \"model\": \"<model_identifier>\",
    \"messages\": [{\"role\": \"user\", \"content\": \"<task description>\"}],
    \"temperature\": 0.7,
    \"max_tokens\": 2000
  }'"
```

**参数说明：**
- `model`（必需）：加载模型时所用的 model_identifier（必须与步骤 4 中的 `--identifier` 一致）
- `messages`（必需）：消息对象数组，含 `role`（"user"/"assistant"/"system"）与 `content` 字段
- `temperature`（可选）：采样温度（0.0–2.0，默认 0.7）
- `max_tokens`（可选）：最大生成 token 数（依任务调整）

**响应格式：**
- 解析 JSON 响应
- **校验 `response.model` 字段是否与请求的 model_identifier 一致**（若请求模型未加载，LM Studio 可能自动选用其他模型）
- 提取 `choices[0].message.content` 字段内容，即模型响应
- 检查响应中是否存在 `error` 字段，用于错误处理

**示例（使用脚本）：**
```bash
exec command:"node {baseDir}/scripts/lmstudio-api.mjs meta-llama-3.1-8b-instruct 'Summarize this document and extract key points' --temperature=0.7 --max-tokens=2000"
```

**示例（使用 curl）：**
```bash
exec command:"curl -X POST http://127.0.0.1:1234/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer lmstudio' \
  -d '{
    \"model\": \"meta-llama-3.1-8b-instruct\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Summarize this document and extract key points\"}],
    \"temperature\": 0.7,
    \"max_tokens\": 2000
  }'"
```

### 步骤 7：格式化并返回结果

提取并格式化 API 响应：

**若使用辅助脚本：**
1. 解析脚本返回的 JSON 输出（已预先校验）
2. 提取 `content` 字段——其中包含模型响应
3. 可选地使用 `usage` 字段获取 token 统计信息
4. 根据任务上下文适当格式化结果
5. 将格式化后的结果返回给用户

**若直接使用 curl：**
1. 解析 curl 命令返回的 JSON 响应
2. **校验 `response.model` 字段**——确保其与请求的 `model_identifier` 一致（重要：LM Studio 可能自动选择模型）
3. 提取 `choices[0].message.content` 字段——其中包含模型响应
4. 检查错误：若响应含 `error` 字段，则按需处理
5. 若 `response.model` 与请求不符，记录警告但继续执行（LM Studio 行为）
6. 根据任务上下文适当格式化结果
7. 将格式化后的结果返回给用户

**错误处理：**
- 若存在 `error` 字段：向用户报告错误信息
- 若 `response.model` 与请求不符：记录警告，继续使用响应（LM Studio 可能已自动选择模型）
- 若响应结构异常：记录警告，并尝试提取内容
- 若 API 调用失败（HTTP 状态码非 200）：报告 HTTP 错误

### 步骤 8：卸载模型（清理）

**默认策略**：依赖 `--ttl` 实现自动清理，以避免抖动和竞态条件。仅在遭遇内存压力或用户明确要求立即清理时，才显式卸载模型。

若在 API 调用完成后显式卸载模型：

```bash
exec command:"lms unload <model_identifier>"
```

**注意**：`lms unload` 接受 model_key 或 identifier。因我们使用 `--identifier` 加载模型，故为保持一致性，此处应使用 model_identifier。

**优雅处理错误：**
- 若模型已卸载：无操作，继续流程
- 若模型仍在使用中：记录警告，建议稍后手动清理
- 若卸载失败：记录警告，建议手动清理

## 模型选择指南

### 决策输入（需关注的指标）

从 `lms ls --json`（及可选的 `lms ls --json --detailed`）中提取以下信息：
- `type`：`llm` | `vlm` | `embedding`
- `vision`：布尔值（若任务含图像，则需 `vision=true`）
- `trainedForToolUse`：布尔值（若工具/函数调用至关重要，则建议设为 true）
- `maxContextLength`：数值（长文档需充足上下文）
- `paramsString` / 模型大小：粗略反映成本/速度比

同时检查运行时状态：
- `lms ps --json`：已加载候选模型列表（优先选用以避免加载延迟与内存波动）

### 启发式规则（简易选择策略）

采用“约束优先，再评分”方法：

1) **硬性约束**
- 若任务基于视觉/图像 → 仅考虑 `vision=true` 为 true 的模型
- 若需嵌入能力 → 仅考虑 `type=embedding` 模型
- 若任务要求最小上下文窗口 → 仅考虑 `maxContextLength >= needed` 满足要求的模型

2) **偏好 / 评分**
- 若已加载模型满足约束，优先选用（`lms ps`）
- 若任务受益于结构化工具调用，优先选用 `trainedForToolUse=true`
- 简单快速任务优选小模型；深度推理任务优选大模型

3) **后备方案**
- 若无模型满足全部约束：择最接近者（并发出警告），或回退至主模型

### 内存优化

- 优先检查 `lms ps` —— 在适配前提下优先复用已加载模型
- 使用 `lms load --estimate-only <model_key>` 预览内存需求
- 使用 `--ttl` 避免大型模型长期驻留内存

## 安全检查

### 关键：加载验证

**切勿在未验证模型已加载的情况下调用 API。**

验证步骤（步骤 5）为强制要求。缺失该步骤将导致：
- API 调用因“模型不可用”而失败
- 浪费资源发起注定失败的 API 请求
- 产生令人困惑的错误信息

### 重试逻辑

加载验证内置重试机制以应对最终一致性：
1. 加载完成后立即执行首次检查
2. 若未发现模型，等待 2–3 秒
3. 总计最多重试 3 次
4. 若重试后仍未加载，则中止流程

### 模型标识符一致性

确保模型标识符使用一致：
- 使用 `model_key`（来自 `lms ls`）作为 `lms load` 的参数
- API 调用中使用相同的 `model_identifier`（来自 `--identifier`）
- API 调用中使用的标识符必须与加载时指定的一致

## 错误处理

### 模型未找到

**现象**：`lms ls` 未列出该模型，或 `lms load` 因“模型未找到”而失败

**响应：**
- 错误信息：“模型 <model-key> 在 LM Studio 中未找到”
- 建议：“请先使用 `lms get <model-key>` 下载模型，或通过 LM Studio UI 下载”

### API 调用失败

**现象**：curl 命令返回非 200 状态码或错误响应

**响应：**
- 检查响应中的 HTTP 状态码
- 若为 404：模型未找到或未加载——请验证 model_identifier 是否与已加载模型一致
- 若为 500：LM Studio 服务端错误——检查服务日志，尝试重新加载模型
- 若连接被拒绝：LM Studio 服务未运行——请先启动服务
- 若响应 JSON 中含错误信息，请提取并展示
- 建议：“请使用 `lms ps` 验证模型是否已加载，检查 LM Studio 服务状态，或尝试重新加载模型”

### 无效 API 响应

**现象**：API 调用成功，但响应结构异常或缺失内容

**响应：**
- 检查响应是否含 `choices` 数组
- 检查 `choices[0].message.content` 是否存在
- 若结构异常：记录警告，并尝试提取任何可用内容
- 若响应完全损坏：报告错误，并建议重试 API 调用

### 加载超时

**现象**：`lms load` 命令挂起或耗时极长

**响应：**
- `lms load` 会阻塞至加载完成，对大型模型（70B+）可能耗时 3 分钟以上
- exec 工具默认超时时间为 1800 秒（30 分钟），通常已足够
- 若超时发生：“模型加载超时——可能因内存不足或模型文件损坏所致”
- 建议：“尝试更小模型，通过卸载其他模型释放内存，或验证模型文件完整性”

### 加载验证失败

**现象**：加载命令成功，但 `lms ps` 在重试后仍未显示模型

**响应：**
- 此情况极罕见（因 `lms load` 已阻塞等待加载完成）
- 若发生：中止工作流并报错：“模型加载完成后未出现”
- **切勿调用 API**
- 建议：“检查 LM Studio 日志，确认标识符与加载时一致，或尝试重新加载模型”

### 内存不足

**现象**：`lms load` 因内存相关错误而失败

**响应：**
- 错误信息：“内存不足，无法加载模型”
- 建议：“使用 `lms unload --all` 卸载其他模型，或选择更小模型”
- 使用 `lms load --estimate-only` 预览内存需求

### 验证后 API 调用失败

**现象**：模型经验证已加载，但 API 调用仍失败

**响应：**
- 向用户报告错误
- 检查模型是否仍处于加载状态：`lms ps --json`
- 若模型已消失：重新加载并重试 API 调用
- 若模型仍在加载但 API 失败：检查 API URL，严格核对 model_identifier 是否一致
- 即便失败，若用户要求，仍应尝试卸载模型（清理）

### 模型已加载

**现象**：`lms ps` 显示模型已加载

**响应：**
- 跳过加载步骤（步骤 4）
- 直接进入验证（步骤 5），然后调用 API（步骤 6）
- 此为性能优化，非错误
- 确保 model_identifier 与已加载模型一致

### 卸载失败

**现象**：`lms unload` 失败（模型仍在使用等）

**响应：**
- 记录警告：“无法卸载模型 <model-key>”
- 建议：“模型可能仍在使用，请稍后手动执行 `lms unload <model-key>` 卸载”
- 继续工作流（卸载失败不影响流程完成）

## 示例

### 简单任务：文档摘要

```bash
# 1. List models
exec command:"lms ls --json --llm"

# 2. Check loaded
exec command:"lms ps --json"

# 3. Select small model (e.g., meta-llama-3.1-8b-instruct)

# 4. Load model
exec command:"lms load meta-llama-3.1-8b-instruct --identifier \"meta-llama-3.1-8b-instruct\" --ttl 3600"

# 5. Verify loaded
exec command:"lms ps --json"
# Parse and confirm model appears

# 6. Call LM Studio API (using helper script)
exec command:"node {baseDir}/scripts/lmstudio-api.mjs meta-llama-3.1-8b-instruct 'Summarize this document and extract 5 key points' --temperature=0.7 --max-tokens=2000"

# 7. Parse response and extract content field

# 8. Optional explicit unload after completion (otherwise rely on TTL)
exec command:"lms unload meta-llama-3.1-8b-instruct"
```

### 复杂任务：代码库分析

```bash
# 1-2. List and check (same as above)

# 3. Select larger model (e.g., meta-llama-3.1-70b-instruct)

# 4. Load with context length
exec command:"lms load meta-llama-3.1-70b-instruct --identifier \"meta-llama-3.1-70b-instruct\" --context-length=8192 --gpu=auto --ttl 3600"

# 5. Verify loaded
exec command:"lms ps --json"

# 6. Call LM Studio API with longer context (using helper script)
exec command:"node {baseDir}/scripts/lmstudio-api.mjs meta-llama-3.1-70b-instruct 'Analyze the codebase architecture, identify main components, and suggest improvements' --temperature=0.3 --max-tokens=4000"

# 7. Parse response and format results

# 8. Optional unload (same as above)
```

### 视觉任务：图像描述

```bash
# 1. List VLM models
exec command:"lms ls --json"

# 2-3. Select VLM model (e.g., qwen2-vl-7b-instruct)

# 4. Load VLM model
exec command:"lms load qwen2-vl-7b-instruct --identifier \"qwen2-vl-7b-instruct\" --gpu=max --ttl 3600"

# 5. Verify loaded
exec command:"lms ps --json"

# 6. Call LM Studio API with image (if supported by model, using helper script)
exec command:"node {baseDir}/scripts/lmstudio-api.mjs qwen2-vl-7b-instruct 'Describe this image in detail, including objects, colors, composition, and any text visible' --temperature=0.7 --max-tokens=2000"

# 7-8. Parse response and unload
```

## LM Studio API 详情

### 辅助脚本（推荐）

本 skill 包含 `scripts/lmstudio-api.mjs`，用于实现可靠的 API 调用。该脚本为可选组件，但因其更优的错误处理与响应校验而强烈推荐。

**优势：**
- 正确 JSON 编码（规避转义问题）
- 内置错误处理
- 响应校验（验证 `response.model` 与请求一致）
- 统一输出格式
- 支持环境变量（`LM_STUDIO_API_URL`）

**用法：**
```bash
node {baseDir}/scripts/lmstudio-api.mjs <model_identifier> '<task>' [--temperature=0.7] [--max-tokens=2000] [--api-url=http://127.0.0.1:1234/v1]
```

**输出：**
```json
{
  "content": "<model response>",
  "model": "<model used>",
  "usage": {"prompt_tokens": 100, "completion_tokens": 200, "total_tokens": 300}
}
```

**注意**：若系统未安装 Node.js，可直接使用 curl（参见步骤 6 的选项 B）。

### API 端点格式

LM Studio 提供 OpenAI 兼容的 API 端点：
- 基础 URL：`http://127.0.0.1:1234/v1`（默认值，无需配置）
- 聊天补全：`POST /v1/chat/completions`
- 模型列表：`GET /v1/models`

### 确定 API URL

API URL 默认为 `http://127.0.0.1:1234/v1`（LM Studio 标准默认值）。**无需任何配置**——本 skill 开箱即用，兼容 LM Studio 默认服务。

辅助脚本支持 `LM_STUDIO_API_URL` 环境变量，以便覆盖默认 URL。

### 请求格式（OpenAI 兼容）

```json
{
  "model": "<model_identifier>",
  "messages": [
    {"role": "user", "content": "<task description>"}
  ],
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**必需字段：**
- `model`：必须与加载时使用的标识符一致（即 `--identifier` 的值）
- `messages`：消息对象数组，含 `role`（"user"/"assistant"/"system"）与 `content` 字段

**可选字段：**
- `temperature`：0.0–2.0（默认 0.7）
- `max_tokens`：最大生成 token 数
- `stream`：`true`，用于流式响应（不推荐用于 exec 工具）
- `top_p`：核心采样参数
- `frequency_penalty`：-2.0 至 2.0
- `presence_penalty`：-2.0 至 2.0

### 响应格式

**成功响应：**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "<model_identifier>",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "<model response>"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

**错误响应：**
```json
{
  "error": {
    "message": "Error description",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

### 响应解析

1. 解析 curl 命令返回的 JSON 响应
2. 检查是否存在 `error` 字段——若存在则处理错误
3. **校验 `response.model` 字段**——确保其与请求的 `model_identifier` 一致（LM Studio 可能因请求模型未加载而自动选用其他模型）
4. 提取 `choices[0].message.content` 字段——其中包含模型响应
5. 可选地提取 `usage` 字段获取 token 统计信息
6. 格式化并返回内容给用户

**重要提示**：务必校验 `response.model` 是否与请求模型一致。LM Studio 可能自动选择/加载模型，因此即使 `lms ps` 未显示您请求的模型，API 调用仍可能成功。若 `response.model` 不匹配，应记录警告或按需处理。

### 认证

LM Studio API 通常使用：
- 请求头：`Authorization: Bearer lmstudio`
- 某些部署可能无需认证（请查阅 LM Studio 服务端设置）

## 注意事项

- **模型标识符**：加载模型时使用的 `--identifier` 与 API 调用中使用的 `model` 必须一致
- **JSON 输出**：对 `lms` 命令，始终使用 `--json` 标志以获得机器可读输出
- **已加载模型**：首先检查 `lms ps`——若模型已加载，跳过加载步骤以节省时间
- **清理策略**：优先使用 `--ttl` 避免抖动；仅在内存压力或用户明确要求时显式卸载
- **无需配置**：模型无需在 Clawdbot 中预配置——LM Studio 中任意模型皆可使用
- **加载耗时**：`lms load` 会阻塞至加载完成。大型模型（70B+）可能耗时 3 分钟以上，属正常现象
- **API 兼容性**：LM Studio 使用 OpenAI 兼容 API 格式，因此标准 OpenAI 请求/响应模式均适用
- **模型校验**：始终校验 `response.model` 字段是否与请求的 model_identifier 一致。LM Studio 可能自动选择/加载模型，因此 API 调用可能成功，即使 `lms ps` 未显示您请求的模型
- **模型名校验**：LM Studio API 可能不会拒绝未知模型名——它可能使用当前已加载的任意模型。在发起 API 调用前，务必通过 `lms ls` 验证模型存在
- **测试版本**：已在 LM Studio 0.3.39 版本上测试。不同版本行为可能略有差异