---
name: atxp
name_zh: ATXP
description: 访问 ATXP 付费 API 工具，支持网页搜索、AI 图像生成、音乐创作、视频生成及 X/Twitter 搜索。当用户需要实时网页搜索、AI 生成的多媒体内容（图像、音乐、视频）或 X/Twitter 搜索时使用。需通过 `npx atxp login` 进行身份验证。
description_zh: 访问 ATXP 付费 API 工具，支持网页搜索、AI 图像生成、音乐创作、视频生成及 X/Twitter 搜索。当用户需要实时网页搜索、AI 生成的多媒体内容（图像、音乐、视频）或 X/Twitter 搜索时使用。需通过 `npx atxp login` 进行身份验证。
---
# ATXP 工具

通过命令行接口（CLI）访问 ATXP 的付费 API 工具。

## 身份验证

```bash
# Check if authenticated
echo $ATXP_CONNECTION

# If not set, login:
npx atxp login
source ~/.atxp/config
```

## 命令

| 命令 | 描述 |
|------|------|
| `npx atxp search <query>` | 实时网页搜索 |
| `npx atxp image <prompt>` | AI 图像生成 |
| `npx atxp music <prompt>` | AI 音乐生成 |
| `npx atxp video <prompt>` | AI 视频生成 |
| `npx atxp x <query>` | X/Twitter 搜索 |

## 使用方法

1. 确认 `$ATXP_CONNECTION` 已正确设置  
2. 运行对应命令  
3. 解析并呈现结果  

## 编程式访问

```typescript
import { atxpClient, ATXPAccount } from '@atxp/client';

const client = await atxpClient({
  mcpServer: 'https://search.mcp.atxp.ai',
  account: new ATXPAccount(process.env.ATXP_CONNECTION),
});

const result = await client.callTool({
  name: 'search_search',
  arguments: { query: 'your query' },
});
```

## MCP 服务器

| 服务器 | 工具 |
|--------|------|
| `search.mcp.atxp.ai` | `search_search` |
| `image.mcp.atxp.ai` | `image_create_image` |
| `music.mcp.atxp.ai` | `music_create` |
| `video.mcp.atxp.ai` | `create_video` |
| `x-live-search.mcp.atxp.ai` | `x_live_search` |