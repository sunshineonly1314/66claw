---
name: discord-chat
name_zh: Discord 聊天
description: 使用 message 工具在 Discord 频道中发送消息、回复消息及搜索消息历史。当用户希望与 Discord 进行通信（发送/回复/搜索消息）、检查 Discord 活动状态，或与 Discord 频道交互时使用。
description_zh: 使用 message 工具在 Discord 频道中发送消息、回复消息及搜索消息历史。当用户希望与 Discord 进行通信（发送/回复/搜索消息）、检查 Discord 活动状态，或与 Discord 频道交互时使用。
---
# Discord 聊天

使用 Clawdbot 的 `message` 工具与 Discord 频道交互。

## 核心操作

### 发送消息

向 Discord 频道发送消息：

```bash
message action=send channel=discord target="#channel-name" message="Your message here"
```

或通过频道 ID 发送：

```bash
message action=send channel=discord target="1234567890" message="Your message here"
```

**使用提示：**  
- 可使用带 `#` 前缀的频道名称，或直接使用频道 ID  
- 若需发送多个链接，请用 `<>` 包裹以禁用嵌入（embed）：`<https://example.com>`  
- 不支持 Markdown 表格！请改用项目符号列表（bullet list）  
- 支持使用 `effect=balloons` 或 `effectId=invisible-ink` 添加效果

### 回复消息

回复某条特定消息：

```bash
message action=send channel=discord target="#channel-name" message="Reply text" replyTo="message-id"
```

`replyTo` 参数用于创建针对指定消息 ID 的线程化回复（threaded reply）。

### 搜索消息

在频道中搜索消息：

```bash
message action=search channel=discord channelId="1234567890" query="search terms" limit=50
```

**搜索选项：**  
- `query`：搜索关键词  
- `authorId`：按作者筛选  
- `before` / `after` / `around`：用于分页的消息 ID  
- `limit`：最大返回结果数（默认为 25）

高级搜索模式详见 [SEARCH.md](references/SEARCH.md)。

### 其他操作

**读取消息：**  
```bash
message action=read channel=discord target="#channel-name" limit=20
```

**为消息添加反应（emoji）：**  
```bash
message action=react channel=discord messageId="1234567890" emoji="👍"
```

**编辑消息：**  
```bash
message action=edit channel=discord messageId="1234567890" message="Updated text"
```

**删除消息：**  
```bash
message action=delete channel=discord messageId="1234567890"
```

## 快速参考

常用模式示例：

- **向频道发布公告**：`action=send target="#announcements"`  
- **在线程中回复**：`action=send replyTo="msg-id"`  
- **查看近期活动**：`action=read limit=10`  
- **查找提及内容**：`action=search query="@username"`  
- **确认/已收到（acknowledge）**：`action=react emoji="✅"`

## 频道管理

**列出频道：**  
```bash
message action=channel-list channel=discord guildId="server-id"
```

**获取频道信息：**  
```bash
message action=channel-info channel=discord channelId="1234567890"
```

如需创建或编辑频道，请参阅 [CHANNELS.md](references/CHANNELS.md)。

## 最佳实践

1. **尽可能使用目标名称** —— `target="#general"` 比 ID 更清晰易懂  
2. **批量添加反应** —— 每条消息仅添加一个 emoji，并选择最贴切的一个  
3. **适配 Discord 格式** —— 使用项目符号而非表格；用 `<link>` 禁用嵌入  
4. **先搜索，再提问** —— 在请求信息前，先查阅历史记录  
5. **优先使用反应而非回复** —— 对于简单确认类操作，使用 reaction 更合适

## 配置说明

您的 Discord 机器人配置应置于 gateway 配置文件中。当指定 `channel=discord` 时，`message` 工具会自动路由至已配置的 Discord 插件。

如需配置帮助，请参阅 [CONFIG.md](references/CONFIG.md)。