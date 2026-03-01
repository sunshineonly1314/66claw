---
name: grok-search
name_zh: Grok搜索
description: 通过 xAI Responses API，使用 xAI Grok 服务端搜索工具（web_search、x_search）在网页或 X/Twitter 上执行搜索。适用于需要获取 X 平台上的推文/话题/用户、希望以 Grok 替代 Brave 浏览器，或需要结构化 JSON 输出并附带引用来源的场景。
description_zh: 通过 xAI Responses API，使用 xAI Grok 服务端搜索工具（web_search、x_search）在网页或 X/Twitter 上执行搜索。适用于需要获取 X 平台上的推文/话题/用户、希望以 Grok 替代 Brave 浏览器，或需要结构化 JSON 输出并附带引用来源的场景。
homepage: https://docs.x.ai/docs/guides/tools/search-tools
triggers: ["grok", "xai", "search x", "search twitter", "find tweets", "x search", "twitter search", "web_search", "x_search"]
metadata: {"clawdbot":{"emoji":"🔎","requires":{"bins":["node"],"env":["XAI_API_KEY"]},"primaryEnv":"XAI_API_KEY"}}
---
通过捆绑脚本（搜索 + 聊天 + 模型列表）在本地运行 xAI Grok。搜索的默认输出为*美化格式的 JSON*（agent-友好），并附带引用来源。

## API 密钥

脚本按以下顺序查找 xAI API 密钥：
- `XAI_API_KEY` 环境变量  
- `~/.clawdbot/clawdbot.json` → `env.XAI_API_KEY`  
- `~/.clawdbot/clawdbot.json` → `skills.entries["grok-search"].apiKey`  
- 备用方案：`skills.entries["search-x"].apiKey` 或 `skills.entries.xai.apiKey`  

## 运行方式

使用 `{baseDir}`，确保命令在任意工作区布局下均可正常执行。

### 搜索

- 网页搜索（JSON 格式）：  
  - `node {baseDir}/scripts/grok_search.mjs "<query>" --web`  

- X/Twitter 搜索（JSON 格式）：  
  - `node {baseDir}/scripts/grok_search.mjs "<query>" --x`  

### 聊天

- 文本聊天：  
  - `node {baseDir}/scripts/chat.mjs "<prompt>"`  

- 视觉聊天：  
  - `node {baseDir}/scripts/chat.mjs --image /path/to/image.jpg "<prompt>"`  

### 模型

- 列出可用模型：  
  - `node {baseDir}/scripts/models.mjs`  

## 有用参数标志

输出控制：
- `--links-only` 仅打印引用来源的 URL  
- `--text` 在美化格式输出中隐藏引用来源部分  
- `--raw` 将原始 Responses API 负载输出至 stderr（用于调试）  

通用参数：
- `--max <n>` 限制结果数量（默认为 8）  
- `--model <id>`（默认 `grok-4-1-fast`）  

仅适用于 X 的过滤器（通过 x_search 工具参数在服务端实现）：
- `--days <n>`（例如：7）  
- `--from YYYY-MM-DD` / `--to YYYY-MM-DD`  
- `--handles @a,@b`（限定于指定账号）  
- `--exclude @bots,@spam`（排除指定账号）  

## 输出结构（JSON）

```json
{
  "query": "...",
  "mode": "web" | "x",
  "results": [
    {
      "title": "...",
      "url": "...",
      "snippet": "...",
      "author": "...",
      "posted_at": "..."
    }
  ],
  "citations": ["https://..."]
}
```  

## 注意事项

- `citations` 尽可能从 xAI 响应标注中合并/校验得出（比盲目信任模型生成的 JSON 更可靠）。  
- 对于推文/话题，请优先使用 `--x`；对于通用研究，请优先使用 `--web`。  