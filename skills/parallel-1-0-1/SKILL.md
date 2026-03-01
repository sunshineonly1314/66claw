---
name: parallel-1-0-1
name_zh: Parallel 1.0.1
description: 通过 Parallel.ai API 实现高精度网页搜索与研究。专为 AI agents 优化，提供丰富文本摘录与引用来源。
description_zh: 通过 Parallel.ai API 实现高精度网页搜索与研究。专为 AI agents 优化，提供丰富文本摘录与引用来源。
triggers:
  - parallel
  - deep search
  - research
metadata:
  clawdbot:
    emoji: "🔬"
---
# Parallel.ai 🔬

专为 AI agents 构建的高精度网页搜索 API，在多项研究基准测试中表现优于 Perplexity/Exa。

## 设置

```bash
pip install parallel-web
```

API 密钥已配置完毕。使用 Python SDK。

```python
from parallel import Parallel
client = Parallel(api_key="YOUR_KEY")
response = client.beta.search(
    mode="one-shot",
    max_results=10,
    objective="your query"
)
```

## 快速使用

```bash
# Search with Python SDK
python3 {baseDir}/scripts/search.py "Who is the CEO of Anthropic?" --max-results 5

# JSON output
python3 {baseDir}/scripts/search.py "latest AI news" --json
```

## 响应格式

返回结构化结果，包含：
- `search_id` —— 唯一搜索标识符  
- `results[]` —— 结果数组，其中每项包含：  
  - `url` —— 来源 URL  
  - `title` —— 页面标题  
  - `excerpts[]` —— 相关文本摘录  
  - `publish_date` —— （如可用）  
- `usage` —— API 使用统计信息  

## 适用场景

- **深度研究**：需交叉验证的事实  
- **公司/人物研究**：需附带引用来源  
- **事实核查**：输出需基于证据  
- **复杂查询**：需多跳推理能力  
- 在研究类任务中，精度高于传统搜索引擎  

## API 参考文档

文档：https://docs.parallel.ai  
平台：https://platform.parallel.ai  