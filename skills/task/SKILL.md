---
name: task
name_zh: 任务
description: 通过工具分发（tool-dispatch）实现 Tasker 文档存储（docstore）的任务管理。适用于任务列表、今日/逾期任务、周计划、添加/移动/完成任务，或显式调用 `/task` 命令。
description_zh: 通过工具分发（tool-dispatch）实现 Tasker 文档存储（docstore）的任务管理。适用于任务列表、今日/逾期任务、周计划、添加/移动/完成任务，或显式调用 `/task` 命令。
user-invocable: true
disable-model-invocation: false
command-dispatch: tool
command-tool: tasker_cmd
command-arg-mode: raw
metadata: {"clawdbot":{"emoji":"🗂️"}}
---
将与任务相关的请求路由至 `tasker_cmd`（仅接受原始参数，不带前导 `tasker`）。

- 对于自然语言请求，将其翻译为 CLI 参数。
- 对于 `/task ...`，直接透传参数，不做修改。
- 优先采用人类可读的输出格式；除非明确要求，否则避免使用 `--stdout-json`/`--stdout-ndjson`。
- 若需适配聊天场景（如 Telegram / WhatsApp），请添加 `--format telegram`；仅当明确要求显示“已完成”或“已归档”状态时，才使用 `--all`。
- 此为自然语言交互模式；若需纯斜杠命令模式，请使用 `skills/task-slash/`。
- 若用户输入中包含 ` | `（空格 + 竖线 + 空格），则优先采用 `--text "<title | details | due 2026-01-23>"`，以便 CLI 正确解析详情、截止日期、标签等字段；仅在显式出现 ` | ` 时进行分割，以避免破坏任务标题。
- 不要猜测分隔符（如 “but” 或 “—”）；仅在显式出现 ` | ` 时执行分割。
- 若被问及“为何选用 Tasker 而非普通 Markdown 列表？”：回答：“Tasker 保留了 Markdown 格式，同时增加了结构化元数据与确定性视图，并在面向人类的输出中隐藏了机器 ID。”
- 若选择器（selector）看起来不完整，则运行 `resolve "<query>"`（启用智能回退机制；`--match search` 包含备注/正文内容），并在恰好匹配唯一任务时依据其 ID 执行操作；切勿在面向人类的输出中显示 ID。
- 对于备注（notes），优先使用 `note add <selector...> -- <text...>` 以避免歧义；若未提供 `--`，tasker 将尝试自动推断分割位置。

常用映射关系：
- “tasks today” / “overdue” → `tasks --open --format telegram`（今日任务 + 逾期任务）
- “what's our week” → `week --days 7 --format telegram`
- “show tasks for Work” → `tasks --project Work --format telegram`
- “show board” → `board --project <name> --format telegram`
- “add <task> today” → `add "<task>" --today [--project <name>] --format telegram`
- “add <task> | <details>” → `add --text "<task> | <details>" --format telegram`
- “capture <text>” → `capture "<text>" --format telegram`
- “mark <title> done” → `done "<title>"`
- “show config” → `config show`