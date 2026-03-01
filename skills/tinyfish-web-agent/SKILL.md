---
name: tinyfish
name_zh: TinyFish网页代理
description: 使用 TinyFish/Mino 网页 agent 提取/爬取网站内容、抽取数据，并通过自然语言自动化浏览器操作。适用于需要从网页提取/爬取数据、应对防机器人保护站点，或自动化网页任务的场景。
description_zh: 使用 TinyFish/Mino 网页 agent 提取/爬取网站内容、抽取数据，并通过自然语言自动化浏览器操作。适用于需要从网页提取/爬取数据、应对防机器人保护站点，或自动化网页任务的场景。
---
# TinyFish 网页 Agent

依赖：`MINO_API_KEY` 环境变量

## 最佳实践

1. **明确指定 JSON 格式**：始终清晰描述所需返回的数据结构  
2. **并行调用**：当需从多个相互独立的网站提取数据时，应分别发起并行调用，而非合并至单个提示中  

## 基础提取/爬取

从网页中提取数据。请明确指定所需 JSON 结构：

```python
import requests
import json
import os

response = requests.post(
    "https://mino.ai/v1/automation/run-sse",
    headers={
        "X-API-Key": os.environ["MINO_API_KEY"],
        "Content-Type": "application/json",
    },
    json={
        "url": "https://example.com",
        "goal": "Extract product info as JSON: {\"name\": str, \"price\": str, \"in_stock\": bool}",
    },
    stream=True,
)

for line in response.iter_lines():
    if line:
        line_str = line.decode("utf-8")
        if line_str.startswith("data: "):
            event = json.loads(line_str[6:])
            if event.get("type") == "COMPLETE" and event.get("status") == "COMPLETED":
                print(json.dumps(event["resultJson"], indent=2))
```

## 多项数据提取

提取具有显式结构的数据列表：

```python
json={
    "url": "https://example.com/products",
    "goal": "Extract all products as JSON array: [{\"name\": str, \"price\": str, \"url\": str}]",
}
```

## 隐身模式

用于防机器人保护的网站：

```python
json={
    "url": "https://protected-site.com",
    "goal": "Extract product data as JSON: {\"name\": str, \"price\": str, \"description\": str}",
    "browser_profile": "stealth",
}
```

## 代理

通过指定国家/地区路由请求：

```python
json={
    "url": "https://geo-restricted-site.com",
    "goal": "Extract pricing data as JSON: {\"item\": str, \"price\": str, \"currency\": str}",
    "browser_profile": "stealth",
    "proxy_config": {
        "enabled": True,
        "country_code": "US",
    },
}
```

## 输出

当 `event["type"] == "COMPLETE"` 时，结果以 `event["resultJson"]` 格式返回。

## 并行提取

当需从多个相互独立的来源提取数据时，应分别发起并行 API 调用，而非合并至单个提示中：

**推荐** —— 并行调用：
```python
# Compare pizza prices - run these simultaneously
call_1 = extract("https://pizzahut.com", "Extract pizza prices as JSON: [{\"name\": str, \"price\": str}]")
call_2 = extract("https://dominos.com", "Extract pizza prices as JSON: [{\"name\": str, \"price\": str}]")
```

**不推荐** —— 单一合并调用：
```python
# Don't do this - less reliable and slower
extract("https://pizzahut.com", "Extract prices from Pizza Hut and also go to Dominos...")
```

每个独立的提取任务都应作为单独的 API 调用。这不仅执行更快（并行执行），而且更可靠。