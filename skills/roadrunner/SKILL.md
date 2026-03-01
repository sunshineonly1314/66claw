---
name: roadrunner
name_zh: RoadRunner
description: Beeper Desktop 的命令行接口（CLI），支持聊天、消息收发、搜索与提醒功能。
description_zh: Beeper Desktop 的命令行接口（CLI），支持聊天、消息收发、搜索与提醒功能。
homepage: https://github.com/johntheyoung/roadrunner
metadata: {"clawdbot":{"emoji":"🐦💨","requires":{"bins":["rr"]},"install":[{"id":"brew","kind":"brew","formula":"johntheyoung/tap/roadrunner","bins":["rr"],"label":"Install rr (brew)"},{"id":"go","kind":"go","module":"github.com/johntheyoung/roadrunner/cmd/rr@latest","bins":["rr"],"label":"Install rr (go)"}]}}
---
# roadrunner（rr）

当用户明确要求通过本地 API 操作 Beeper Desktop（发送/搜索/列出聊天与消息、设置提醒、聚焦应用）时，请使用 `rr`。  
对于 agent 场景（强制 JSON 输出、启用信封封装、禁用交互输入、只读模式），优先选用 `--agent`。

安全机制  
- 发送消息前，必须显式指定接收方（聊天 ID）与消息正文。  
- 若聊天 ID 存在歧义，则需确认或提出澄清性问题。  
- 使用 `--agent` 设置安全的 agent 默认值：`rr --agent --enable-commands=chats,messages,status chats list`  
- 使用 `--readonly` 禁用写入操作：`rr --readonly chats list --json`  
- 使用 `--enable-commands` 设置白名单：`rr --enable-commands=chats,messages chats list --json`  
- 使用 `--envelope` 返回结构化错误：`rr --json --envelope chats get "!chatid"`  

初始化设置（仅需一次）  
- `rr auth set <token>`  
- `rr auth status --check`  
- `rr doctor`  

常用命令  
- 列出账号：`rr accounts list --json`  
- 查看能力：`rr capabilities --json`  
- 搜索联系人：`rr contacts search "<account-id>" "Alice" --json`  
- 搜索联系人（带标志位）：`rr contacts search "Alice" --account-id="<account-id>" --json`  
- 解析联系人：`rr contacts resolve "<account-id>" "Alice" --json`  
- 解析联系人（带标志位）：`rr contacts resolve "Alice" --account-id="<account-id>" --json`  
- 列出聊天：`rr chats list --json`  
- 搜索聊天：`rr chats search "John" --json`  
- 搜索聊天（带过滤器）：`rr chats search --inbox=primary --unread-only --json`  
- 搜索聊天（按活跃度）：`rr chats search --last-activity-after="2024-07-01T00:00:00Z" --json`  
- 按参与者姓名搜索：`rr chats search "Jamie" --scope=participants --json`  
- 解析聊天：`rr chats resolve "Jamie" --json`  
- 获取聊天详情：`rr chats get "!chatid:beeper.com" --json`  
- 创建单聊：`rr chats create "<account-id>" --participant "<user-id>"`  
- 创建群聊：`rr chats create "<account-id>" --participant "<user-a>" --participant "<user-b>" --type group --title "Project Chat" --message "Welcome!"`  
- 设置命令默认账号：`rr --account="imessage:+123" chats list --json`  
- 账号别名：`rr accounts alias set work "slack:T123"`  
- 列出消息：`rr messages list "!chatid:beeper.com" --json`  
- 列出消息（含媒体下载）：`rr messages list "!chatid:beeper.com" --download-media --download-dir ./media --json`  
- 搜索消息：`rr messages search "dinner" --json`  
- 搜索消息（带过滤器）：`rr messages search --sender=me --date-after="2024-07-01T00:00:00Z" --media-types=image --json`  
- 发送消息：`rr messages send "!chatid:beeper.com" "Hello!"`  
- 回复消息：`rr messages send "!chatid:beeper.com" "Thanks!" --reply-to "<message-id>"`  
- 从文件发送消息：`rr messages send "!chatid:beeper.com" --text-file ./message.txt`  
- 从标准输入（stdin）发送消息：`cat message.txt | rr messages send "!chatid:beeper.com" --stdin`  
- 尾随消息（轮询）：`rr messages tail "!chatid:beeper.com" --interval 2s --stop-after 30s --json`  
- 等待消息：`rr messages wait --chat-id="!chatid:beeper.com" --contains "deploy" --wait-timeout 2m --json`  
- 消息上下文：`rr messages context "!chatid:beeper.com" "<sortKey>" --before 5 --after 2 --json`  
- 草拟消息（预填充但不发送）：`rr focus --chat-id="!chatid:beeper.com" --draft-text="Hello!"`  
- 从文件草拟消息：`rr focus --chat-id="!chatid:beeper.com" --draft-text-file ./draft.txt`  
- 带附件草拟消息：`rr focus --chat-id="!chatid:beeper.com" --draft-attachment="/path/to/file.jpg"`  
- 下载附件：`rr assets download "mxc://example.org/abc123" --dest "./attachment.jpg"`  
- 提醒功能：`rr reminders set "!chatid:beeper.com" "2h"` / `rr reminders clear "!chatid:beeper.com"`  
- 归档聊天：`rr chats archive "!chatid:beeper.com"` / `rr chats archive "!chatid:beeper.com" --unarchive`  
- 聚焦应用窗口：`rr focus`  
- 全局搜索：`rr search "dinner" --json`  
- 状态概览：`rr status --json`  
- 按账号查看状态：`rr status --by-account --json`  
- 未读消息汇总：`rr unread --json`  
- 全局搜索包含 `in_groups` 以匹配参与者姓名。

分页机制  
- 聊天列表：`rr chats list --cursor="<oldestCursor>" --direction=before --json`  
- 消息列表：`rr messages list "!chatid:beeper.com" --cursor="<sortKey>" --direction=before --json`  
- 消息搜索（最多 20 条）：`rr messages search "project" --limit=20 --json`  
- 消息搜索分页：`rr messages search "project" --cursor="<cursor>" --direction=before --json`  
- 全局搜索消息分页（最多 20 条）：`rr search "dinner" --messages-limit=20 --json`  
- 全局搜索消息页码：`rr search "dinner" --messages-cursor="<cursor>" --messages-direction=before --json`  

注意事项  
- 需 Beeper Desktop 正在运行；API token 从应用设置中获取。  
- token 存储于 `~/.config/beeper/config.json`；`BEEPER_TOKEN` 可覆盖该路径。  
- `BEEPER_ACCOUNT` 设置默认账号 ID（支持别名）。  
- 消息搜索为字面匹配（非语义匹配）。  
- `rr contacts resolve` 行为严格，遇到模糊姓名即失败；必要时可通过 `contacts search` 解析为 ID 后再执行。  
- 若私聊标题显示您自己的 Matrix ID，请使用 `--scope=participants` 按姓名查找。  
- JSON 输出中，单聊对象包含 `display_name` 字段（由参与者推导得出）。  
- 消息 JSON 包含 `is_sender`、`is_unread`、`attachments` 和 `reactions` 字段。  
- `downloaded_attachments` 仅在使用 `--download-media` 时填充。  
- `rr messages send` 返回 `pending_message_id`（临时 ID）。  
- 自动化场景下优先选用 `--json`（及 `--no-input`）。  
- `BEEPER_URL` 覆盖 API 基础 URL；`BEEPER_TIMEOUT` 设置超时秒数。  
- JSON/纯文本输出至 stdout；错误与提示信息输出至 stderr。  
- 破坏性命令默认会提示确认，除非指定 `--force`；`--no-input`/`BEEPER_NO_INPUT` 若未提供 `--force` 将直接失败。  
- 对 list/search 类命令使用 `--fail-if-empty`，可在无结果时以退出码 1 退出。  
- 使用 `--fields` 配合 `--plain` 可选择输出列（逗号分隔）。  
- 在 bash/zsh 中，`!` 触发历史扩展；建议使用单引号，或禁用历史扩展（bash 中为 `set +H`，zsh 中为 `setopt NO_HIST_EXPAND`）。  
- `rr version --json` 返回 `features` 数组，用于能力发现。  
- `rr capabilities --json` 返回完整 CLI 能力元数据。  
- 信封（envelope）错误码：`AUTH_ERROR`、`NOT_FOUND`、`VALIDATION_ERROR`、`CONNECTION_ERROR`、`INTERNAL_ERROR`。  