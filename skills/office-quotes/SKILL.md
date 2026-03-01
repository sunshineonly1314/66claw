---
name: office-quotes
name_zh: 办公报价
description: 生成《办公室》（美版）随机台词。提供 326 条离线台词，另支持在线模式（含 SVG 卡片、角色头像及完整剧集元数据），后端由 akashrajpurohit API 提供。适用于娱乐、破冰活动，或任何需要《办公室》台词的任务。
description_zh: 生成《办公室》（美版）随机台词。提供 326 条离线台词，另支持在线模式（含 SVG 卡片、角色头像及完整剧集元数据），后端由 akashrajpurohit API 提供。适用于娱乐、破冰活动，或任何需要《办公室》台词的任务。
metadata: {"clawdbot":{"requires":{"bins":["office-quotes"]},"install":[{"id":"node","kind":"node","package":"office-quotes-cli","bins":["office-quotes"],"label":"Install office-quotes CLI (npm)"}]}}
---
# office-quotes 技能

生成美剧《办公室》（The Office）的随机台词。

## 安装

```bash
npm install -g office-quotes-cli
```

## 使用方法

```bash
# Random offline quote (text only)
office-quotes

# API quote with SVG card
office-quotes --source api

# PNG output (best for Telegram)
office-quotes --source api --format png

# Light theme
office-quotes --source api --theme light
```

## 选项

| 选项 | 描述 |
|--------|-------------|
| `--source <src>` | 台词来源：local（默认）、api |
| `--format <fmt>` | 输出格式：svg、png、jpg、webp（默认：svg） |
| `--theme <theme>` | SVG 主题：dark、light（默认：dark） |
| `--json` | 以 JSON 格式输出 |

## 台词示例

> "Would I rather be feared or loved? Easy. Both. I want people to be afraid of how much they love me." — Michael Scott

> "Bears. Beets. Battlestar Galactica." — Jim Halpert

> "Whenever I'm about to do something, I think, 'Would an idiot do that?' And if they would, I do not do that thing." — Dwight Schrute

## 来源

https://github.com/gumadeiras/office-quotes-cli