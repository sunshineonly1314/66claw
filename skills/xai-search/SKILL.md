---
name: xai-search
name_zh: XAI搜索
description: 使用 xAI 的 Grok API 与 agentic 搜索工具，实时搜索 X/Twitter 和网页。
description_zh: 使用 xAI 的 Grok API 与 agentic 搜索工具，实时搜索 X/Twitter 和网页。
metadata: {"clawdbot":{"emoji":"🔍"}}
---
# xAI 搜索（Grok API）

使用 xAI 的 agentic 搜索功能，实时查询 X/Twitter 和网页。该功能依托 Grok 的 `web_search` 和 `x_search` 工具。

**文档：** https://docs.x.ai/docs/

## 环境

在您的环境中设置 `XAI_API_KEY`。

## 快速使用（curl）

### 网页搜索
```bash
curl -s https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-3-fast",
    "messages": [{"role": "user", "content": "YOUR QUERY HERE"}],
    "tools": [{"type": "function", "function": {"name": "web_search"}}]
  }' | jq -r '.choices[0].message.content'
```

### X/Twitter 搜索
```bash
curl -s https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-3-fast",
    "messages": [{"role": "user", "content": "YOUR QUERY HERE"}],
    "tools": [{"type": "function", "function": {"name": "x_search"}}]
  }' | jq -r '.choices[0].message.content'
```

### 组合搜索（网页 + X）
```bash
curl -s https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-3-fast",
    "messages": [{"role": "user", "content": "YOUR QUERY HERE"}],
    "tools": [
      {"type": "function", "function": {"name": "web_search"}},
      {"type": "function", "function": {"name": "x_search"}}
    ]
  }' | jq -r '.choices[0].message.content'
```

## 辅助脚本

为方便起见，请使用该 skill 文件夹中的 `xai-search` 脚本：

```bash
# Web search
xai-search web "latest news about AI"

# X/Twitter search  
xai-search x "what are people saying about Clawdbot"

# Both
xai-search both "current events today"
```

## 模型

- `grok-3-fast` — 速度快，适用于快速搜索  
- `grok-4-1-fast` — 推理模型，更适合复杂查询  

## X 搜索筛选条件

您可通过以下方式筛选 X 搜索结果：
- `allowed_x_handles` / `excluded_x_handles` — 限定特定账号  
- `from_date` / `to_date` — 时间范围（ISO8601 格式）  
- `enable_image_understanding` — 分析帖文中的图片  
- `enable_video_understanding` — 分析帖文中的视频  

## 网页搜索筛选条件

- `allowed_domains` / `excluded_domains` — 限定特定网站  
- `enable_image_understanding` — 分析网页中的图片  

## 使用提示

- 获取突发新闻：使用 X 搜索  
- 查询事实性/研究类信息：使用网页搜索，或两者结合  
- 分析情绪/观点：使用 X 搜索  
- 模型将在必要时发起多次搜索调用（agentic 方式）  