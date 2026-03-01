---
name: whats
name_zh: Whats
description: 通过 wacli 命令行工具向他人发送 WhatsApp 消息，或搜索/同步 WhatsApp 历史记录（不适用于普通用户聊天）。
description_zh: 通过 wacli 命令行工具向他人发送 WhatsApp 消息，或搜索/同步 WhatsApp 历史记录（不适用于普通用户聊天）。
homepage: https://wacli.sh
metadata: {"clawdbot":{"emoji":"📱","requires":{"bins":["wacli"]},"install":[{"id":"brew","kind":"brew","formula":"steipete/tap/wacli","bins":["wacli"],"label":"安装 wacli（brew）"},{"id":"go","kind":"go","module":"github.com/steipete/wacli/cmd/wacli@latest","bins":["wacli"],"label":"安装 wacli（go）"}]}}
---
# wacli

仅当用户明确要求你代其向他人发送 WhatsApp 消息，或明确要求同步/搜索 WhatsApp 历史记录时，才可使用 `wacli`。
**切勿**在普通用户聊天中使用 `wacli`；Clawdbot 会自动路由 WhatsApp 对话。
若用户正通过 WhatsApp 与你聊天，则除非用户明确要求你联系第三方，否则你不应调用此工具。

安全性
- 必须明确指定接收方 + 消息正文。
- 发送前须确认接收方及消息内容。
- 若存在任何歧义，请先提出澄清性问题。

认证与同步
- `wacli auth`（二维码登录 + 初始同步）
- `wacli sync --follow`（持续同步）
- `wacli doctor`

查找聊天与消息
- `wacli chats list --limit 20 --query "name or number"`
- `wacli messages search "query" --limit 20 --chat <jid>`
- `wacli messages search "invoice" --after 2025-01-01 --before 2025-12-31`

历史记录回填
- `wacli history backfill --chat <jid> --requests 2 --count 50`

发送
- 文本：`wacli send text --to "+14155551212" --message "Hello! Are you free at 3pm?"`
- 群组：`wacli send text --to "1234567890-123456789@g.us" --message "Running 5 min late."`
- 文件：`wacli send file --to "+14155551212" --file /path/agenda.pdf --caption "Agenda"`

注意事项
- 存储目录：`~/.wacli`（可通过 `--store` 覆盖）。
- 解析输出时，请使用 `--json` 获取机器可读格式。
- 回填操作需保持手机在线；结果为尽力而为（best-effort）。
- WhatsApp CLI 并非用于日常用户聊天，而是专为向他人发送消息设计。
- JID 格式：个人聊天形如 `<number>@s.whatsapp.net`；群组形如 `<id>@g.us`（可使用 `wacli chats list` 查找）。