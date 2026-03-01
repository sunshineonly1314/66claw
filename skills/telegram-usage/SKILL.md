---
name: telegram-usage
name_zh: Telegram使用分析
description: 显示会话使用统计信息（配额、会话时长、token、上下文）
description_zh: 显示会话使用统计信息（配额、会话时长、token、上下文）
metadata: {"clawdbot":{"emoji":"📊","requires":{"bins":["node"]}}}
---
# Telegram 使用统计

通过运行处理器脚本，展示全面的会话使用统计信息。

## 功能说明

显示一条简明的状态消息，包含：  
- **剩余配额**：API 配额剩余百分比，并附带可视化指示符  
- **重置倒计时**：距配额重置的剩余时间  

## 如何使用该 skill

当用户请求使用统计、配额信息或会话数据时：

```bash
node /home/drew-server/clawd/skills/telegram-usage/handler.js
```

该命令将输出适用于 Telegram `parseMode` 的格式化 HTML 内容。

## 输出格式

响应内容被格式化为一条整洁的 Telegram 消息，具备以下特征：  
- 分节标题（加粗）  
- 清晰的百分比与剩余时间数值  
- 可视化指示符（emoji）  
- 所有信息整合于单条消息中，便于快速查阅  

## 示例输出

```
📊 API Usage

🔋 Quota: 🟢 47%
⏱️ Resets in: 53m
```

## 注意事项

- 数据实时从 `clawdbot models status` 中拉取  
- 每次调用均返回最新的 API 配额数值  
- 使用纯文本格式以保障 Telegram 兼容性  