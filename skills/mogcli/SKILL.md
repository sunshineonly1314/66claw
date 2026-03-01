---
name: mog
name_zh: MogCLI
description: Microsoft Ops Gadget — 面向 Microsoft 365（邮件、日历、网盘、联系人、任务、Word、PowerPoint、Excel、OneNote）的命令行工具。
description_zh: Microsoft Ops Gadget — 面向 Microsoft 365（邮件、日历、网盘、联系人、任务、Word、PowerPoint、Excel、OneNote）的命令行工具。
---
# mog — Microsoft Ops Gadget

面向 Microsoft 365 的 CLI 工具：邮件、日历、OneDrive、联系人、任务、Word、PowerPoint、Excel、OneNote。

Microsoft 版本的 `gog`（Google Ops Gadget）。模式相同，云服务不同。

## 快速参考

如需完整用法说明，请运行：
```bash
mog --ai-help
```

该命令将输出完整的、符合 dashdash 规范的文档，内容包括：
- 设置/先决条件
- 所有命令及选项
- 日期/时间格式
- 示例（正向与反向用例）
- 故障排除指南
- Slug 系统说明
- 与 gog 的兼容性说明

## 模块

| 模块 | 命令 |
|--------|----------|
| **mail** | search、get、send、folders、drafts、attachment |
| **calendar** | list、create、get、update、delete、calendars、respond、freebusy、acl |
| **drive** | ls、search、download、upload、mkdir、move、rename、copy、rm |
| **contacts** | list、search、get、create、update、delete、directory |
| **tasks** | lists、list、add、done、undo、delete、clear |
| **word** | list、export、copy |
| **ppt** | list、export、copy |
| **excel** | list、get、update、append、create、metadata、tables、add-sheet、clear、copy、export |
| **onenote** | notebooks、sections、pages、get、create-notebook、create-section、create-page、delete、search |

## 快速开始

```bash
# Mail
mog mail search "from:someone" --max 10
mog mail send --to a@b.com --subject "Hi" --body "Hello"
mog mail send --to a@b.com --subject "Report" --body-file report.md
mog mail send --to a@b.com --subject "Newsletter" --body-html "<h1>Hello</h1>"
cat draft.txt | mog mail send --to a@b.com --subject "Hi" --body-file -

# Calendar
mog calendar list
mog calendar create --summary "Meeting" --from 2025-01-15T10:00:00 --to 2025-01-15T11:00:00
mog calendar freebusy alice@example.com bob@example.com

# Drive
mog drive ls
mog drive upload ./file.pdf
mog drive download <slug> --out ./file.pdf

# Tasks
mog tasks list
mog tasks add "Buy milk" --due tomorrow
mog tasks clear

# Contacts
mog contacts list
mog contacts directory "john"

# Excel
mog excel list
mog excel get <id> Sheet1 A1:D10
mog excel update <id> Sheet1 A1:B2 val1 val2 val3 val4
mog excel append <id> TableName col1 col2 col3

# OneNote
mog onenote notebooks
mog onenote search "meeting notes"
```

## Slugs

mog 为 Microsoft 的长 GUID 生成 8 字符 slug：
- `a3f2c891` 代替 `AQMkADAwATMzAGZmAS04MDViLTRiNzgt...`
- 所有命令均支持 slug 或完整 ID
- 使用 `--verbose` 查看完整 ID

## 别名

- `mog cal` → `mog calendar`
- `mog todo` → `mog tasks`

## 凭据存储

OAuth 令牌存储在配置目录中（权限为 0600）：

| 平台 | 位置 |
|----------|----------|
| **macOS** | `~/.config/mog/` |
| **Linux** | `~/.config/mog/` |
| **Windows** | `%USERPROFILE%\.config\mog\` |

文件：
- `tokens.json` — OAuth 令牌（由操作系统静态加密）
- `settings.json` — 客户端 ID
- `slugs.json` — Slug 缓存

## 另请参阅

- `mog --ai-help` — 完整文档
- `mog <command> --help` — 命令专属帮助