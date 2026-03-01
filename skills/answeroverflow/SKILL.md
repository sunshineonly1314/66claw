---
name: answeroverflow
name_zh: AnswerOverflow
description: 通过 Answer Overflow 搜索已索引的 Discord 社区讨论。查找仅存在于 Discord 对话中的编程问题解决方案、库相关问题解答以及社区问答。
description_zh: 通过 Answer Overflow 搜索已索引的 Discord 社区讨论。查找仅存在于 Discord 对话中的编程问题解决方案、库相关问题解答以及社区问答。
---
# Answer Overflow Skill

通过 Answer Overflow 搜索已索引的 Discord 社区讨论。非常适合查找编程问题解决方案、库相关问题解答以及社区问答。

## 什么是 Answer Overflow？

Answer Overflow 对公开的 Discord 支持频道进行索引，并通过 Google 及直接 API 访问方式提供搜索功能。专为查找仅存在于 Discord 对话中的答案而设计。

## 快速搜索

使用 `web_search` 获取 Answer Overflow 的搜索结果：
```bash
# Search for a topic (Answer Overflow results often appear in Google)
web_search "site:answeroverflow.com prisma connection pooling"
```

## 获取帖子内容

### Markdown 格式 URL
添加 `/m/` 前缀或 `.md` 后缀，以获取 Markdown 格式的内容：

```
# Standard URL
https://www.answeroverflow.com/m/1234567890123456789

# With .md suffix (alternative)
https://www.answeroverflow.com/m/1234567890123456789.md
```

### 使用 `web_fetch`
```bash
# Fetch a thread in markdown format
web_fetch url="https://www.answeroverflow.com/m/<message-id>"
```

### Accept 请求头
发起请求时，API 将检查 `Accept: text/markdown` 请求头，以决定是否返回 Markdown 格式内容。

## MCP 服务器（参考）

Answer Overflow 在 `https://www.answeroverflow.com/mcp` 提供一个 MCP 服务器，支持以下工具：

| 工具 | 描述 |
|------|------|
| `search_answeroverflow` | 在所有已索引的 Discord 社区中执行搜索。支持按服务器 ID 或频道 ID 过滤。 |
| `search_servers` | 发现 Answer Overflow 已索引的 Discord 服务器。返回服务器 ID，用于后续过滤搜索。 |
| `get_thread_messages` | 获取特定帖子/讨论中的全部消息。 |
| `find_similar_threads` | 查找与给定帖子相似的其他帖子。 |

## URL 模式

| 模式 | 示例 |
|------|------|
| 帖子 | `https://www.answeroverflow.com/m/<message-id>` |
| 服务器 | `https://www.answeroverflow.com/c/<server-slug>` |
| 频道 | `https://www.answeroverflow.com/c/<server-slug>/<channel-slug>` |

## 常用搜索示例

```bash
# Find Discord.js help
web_search "site:answeroverflow.com discord.js slash commands"

# Find Next.js solutions
web_search "site:answeroverflow.com nextjs app router error"

# Find Prisma answers
web_search "site:answeroverflow.com prisma many-to-many"
```

## 使用提示

- 结果来自真实的 Discord 对话，因此上下文可能较为随意；
- 帖子中常包含多轮来回讨论，最终才得出解决方案；
- 请查看服务器/频道名称以理解上下文（例如：官方支持 vs 社区互助）；
- 许多开源项目在此处索引了其 Discord 支持频道。

## 相关链接

- **官网：** https://www.answeroverflow.com  
- **文档：** https://docs.answeroverflow.com  
- **MCP：** https://www.answeroverflow.com/mcp  
- **Discord：** https://discord.answeroverflow.com