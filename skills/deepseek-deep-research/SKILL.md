---
name: deepseek-deep-research
name_zh: DeepSeek深度研究
description: 使用 DeepSeek API 执行复杂、长时间运行的研究任务。当用户要求开展需多源综合、竞品分析、市场调研或受益于系统化搜索与分析的综合性技术调查时使用。🇨🇳 中国专用 skill，替代 gemini-deep-research。
description_zh: 使用 DeepSeek API 执行深度研究任务。支持竞品分析、市场调研、技术调查等需要多源综合的复杂研究。🇨🇳 中国专用。
metadata: {"openclawcn":{"emoji":"🔬","requires":{"env":["DEEPSEEK_API_KEY"]},"primaryEnv":"DEEPSEEK_API_KEY","cnOnly":true}}
---
# DeepSeek 深度研究

🇨🇳 **中国专用** — 替代 gemini-deep-research，使用 DeepSeek 官方 API 执行深度研究任务。

## 前置条件

- `DEEPSEEK_API_KEY` 环境变量（从 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 获取）
- DeepSeek API 有免费额度，超出后按量计费

## 工作原理

利用 DeepSeek 的深度推理能力（deepseek-reasoner / deepseek-chat），将复杂研究任务拆解为子问题，逐步搜索、分析并综合生成报告。

## 使用方法

### 基础研究

通过 `curl` 调用 DeepSeek API 执行深度研究：

```bash
curl -s "https://api.deepseek.com/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-reasoner",
    "messages": [
      {"role": "system", "content": "你是一位专业的深度研究助手。请对以下主题进行全面、系统的研究分析，包括：1) 背景概述 2) 关键发现 3) 数据与证据 4) 分析与洞察 5) 结论与建议。请用中文回答。"},
      {"role": "user", "content": "研究主题：[用户的研究问题]"}
    ],
    "stream": false,
    "max_tokens": 8192
  }'
```

### 流式输出（适合长报告）

```bash
curl -s "https://api.deepseek.com/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-reasoner",
    "messages": [
      {"role": "system", "content": "你是一位专业的深度研究助手..."},
      {"role": "user", "content": "研究主题：[用户的研究问题]"}
    ],
    "stream": true,
    "max_tokens": 8192
  }'
```

### 使用 deepseek-chat（更快，适合初步调研）

```bash
curl -s "https://api.deepseek.com/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "system", "content": "你是一位专业的研究助手。请对以下主题进行简明扼要的调研分析。"},
      {"role": "user", "content": "[用户的研究问题]"}
    ],
    "max_tokens": 4096
  }'
```

## 研究工作流

### 第一步：明确研究范围
与用户确认：
- 研究主题和具体问题
- 希望覆盖的维度（技术、市场、竞品等）
- 输出格式偏好（报告、对比表、摘要等）
- 语言偏好（中文/英文）

### 第二步：分解研究任务
将复杂研究拆解为 3-5 个子问题，分别调用 DeepSeek API。

### 第三步：综合分析
将各子问题的回答汇总，交叉验证，生成最终报告。

### 第四步：保存报告
将研究报告保存至带时间戳的文件：
```
deep-research-YYYY-MM-DD-HH-MM-SS.md
```

## 输出报告模板

```markdown
# [研究主题] 深度研究报告

## 研究概述
- **主题**: [主题]
- **时间**: [日期]
- **研究模型**: DeepSeek Reasoner / DeepSeek Chat

## 执行摘要
[2-3 段核心发现]

## 详细分析

### 1. 背景与现状
[相关背景信息]

### 2. 关键发现
[核心发现，含数据支撑]

### 3. 竞品/对比分析
| 维度 | A | B | C |
|------|---|---|---|
| ... | ... | ... | ... |

### 4. 趋势与展望
[未来趋势预测]

## 结论与建议
[可操作的建议]

## 附录
- 研究方法说明
- 数据来源
```

## API 详情

- **端点**: `https://api.deepseek.com/chat/completions`
- **推荐模型**: `deepseek-reasoner`（深度推理）或 `deepseek-chat`（快速响应）
- **认证方式**: Bearer Token
- **兼容性**: OpenAI API 格式兼容

## 与 Gemini Deep Research 的区别

| 特性 | DeepSeek | Gemini |
|------|----------|--------|
| 连接稳定性 | ✅ 稳定 | ⚠️ 可能超时 |
| API Key | DeepSeek 平台 | Google AI Studio |
| 免费额度 | 有 | 有 |
| 中文能力 | 优秀 | 良好 |
| 深度推理 | deepseek-reasoner | deep-research agent |
| 网络搜索 | 需配合 web_search | 内置 |

## 注意事项

- `deepseek-reasoner` 响应较慢但推理质量更高，适合复杂研究
- `deepseek-chat` 响应更快，适合初步调研或简单问题
- 需要联网搜索最新信息时，建议配合 `web_search` 工具使用
- API 有 rate limit，复杂研究建议分步执行
