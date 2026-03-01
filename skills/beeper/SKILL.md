---
name: beeper
name_zh: Beeper
description: 搜索并浏览本地 Beeper 聊天历史（会话线程、消息、全文搜索）。
description_zh: 搜索并浏览本地 Beeper 聊天历史（会话线程、消息、全文搜索）。
homepage: https://github.com/krausefx/beeper-cli
metadata: {"clawdbot":{"emoji":"🛰️","os":["darwin","linux"],"requires":{"bins":["beeper-cli"]},"install":[{"id":"go","kind":"go","pkg":"github.com/krausefx/beeper-cli/cmd/beeper-cli","bins":["beeper-cli"],"label":"Install beeper-cli (go install)"}]}}
---
# Beeper CLI

[Beeper](https://www.beeper.com/) 是一款通用聊天应用，可将 WhatsApp、Telegram、Signal、iMessage、Discord 等多个平台的消息统一汇聚至单一收件箱。

本 skill 提供对您本地 Beeper 聊天历史的**只读访问权限**。支持浏览会话线程、搜索消息及提取对话数据。

## 要求
- 已安装 Beeper 桌面版应用（提供 SQLite 数据库）
- `beeper-cli` 二进制文件已加入系统 PATH

## 数据库路径
CLI 自动检测以下路径：
- `~/Library/Application Support/BeeperTexts/index.db`（macOS）
- `~/Library/Application Support/Beeper/index.db`（macOS）

可通过以下方式覆盖默认路径：
- `--db /path/to/index.db`
- `BEEPER_DB=/path/to/index.db`

## 命令

### 列出会话线程
```bash
beeper-cli threads list --days 7 --limit 50 --json
```

### 显示会话线程详情
```bash
beeper-cli threads show --id "!abc123:beeper.local" --json
```

### 列出某线程中的消息
```bash
beeper-cli messages list --thread "!abc123:beeper.local" --limit 50 --json
```

### 搜索消息（全文搜索）
```bash
# Simple search
beeper-cli search 'invoice' --limit 20 --json

# Phrase search
beeper-cli search '"christmas party"' --limit 20 --json

# Proximity search
beeper-cli search 'party NEAR/5 christmas' --limit 20 --json

# With context window (messages before/after match)
beeper-cli search 'meeting' --context 6 --window 60m --json
```

### 数据库信息
```bash
beeper-cli db info --json
```

## 注意事项
- **只读操作**：本工具绝不会发送任何消息
- **JSON 输出**：始终使用 `--json` 获取结构化输出，便于 agents 解析
- **FTS5 搜索**：利用 Beeper 内置的全文索引（FTS5）实现快速搜索
- **私聊名称解析**：可选地通过桥接数据库解析私聊名称（使用 `--no-bridge` 禁用此功能）

## 安装

### 方案 1：使用 go install（推荐）
```bash
go install github.com/krausefx/beeper-cli/cmd/beeper-cli@latest
```

### 方案 2：从源码构建
```bash
git clone https://github.com/krausefx/beeper-cli.git
cd beeper-cli
go build ./cmd/beeper-cli
# Move beeper-cli to PATH, e.g., /usr/local/bin
```

## 示例

搜索上周与工作相关的消息：
```bash
beeper-cli threads list --days 7 --json | jq '.threads[] | select(.name | contains("work"))'
beeper-cli search 'project deadline' --limit 10 --json
```

查找包含上下文的、关于发票的消息：
```bash
beeper-cli search 'invoice' --context 3 --json
```