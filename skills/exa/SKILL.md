---
name: exa
name_zh: Exa
description: Neural web search and code context via Exa AI API. Requires EXA_API_KEY. Use for finding documentation, code examples, research papers, or company info.
description_zh: Neural web search and code context via Exa AI API. Requires EXA_API_KEY. Use for finding documentation, code examples, research papers, or company info.
metadata: {"clawdbot":{"emoji":"🧠","requires":{"env":["EXA_API_KEY"]}}}
---
# Exa —— 神经网络网络搜索

直接通过 API 接入 Exa 的神经网络搜索引擎。

## 设置方法

**1. 获取 API 密钥：**  
前往 [Exa 控制台](https://dashboard.exa.ai/api-keys) 获取密钥。

**2. 在环境中配置密钥：**  
```bash
export EXA_API_KEY="your-key-here"
```

## 使用方式

### 网络搜索
```bash
bash scripts/search.sh "query" [num_results] [type]
```
*   `type`：搜索模式（auto 默认，另有 neural、fast、deep）  
*   `category`：内容类别（company、research-paper、news、github、tweet、personal-site、pdf）

### 代码上下文搜索
查找相关代码片段与文档。
```bash
bash scripts/code.sh "query" [num_results]
```

### 内容提取
从 URL 提取全文内容。
```bash
bash scripts/content.sh "url1" "url2"
```