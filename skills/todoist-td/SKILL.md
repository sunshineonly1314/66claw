---
name: todoist-td
name_zh: Todoist-TD
description: 使用 td（Todoist CLI）从终端读取和管理 Todoist 待办事项/任务。当用户询问其待办事项/任务/日程/清单（今日/即将到期/已逾期）、希望列出收件箱/任务/项目/标签、用自然语言添加任务/待办事项，或更新/完成/删除/移动任务（例如：向任务描述中添加电话号码、更改截止日期、优先级、标签）时触发。
description_zh: 使用 td（Todoist CLI）从终端读取和管理 Todoist 待办事项/任务。当用户询问其待办事项/任务/日程/清单（今日/即将到期/已逾期）、希望列出收件箱/任务/项目/标签、用自然语言添加任务/待办事项，或更新/完成/删除/移动任务（例如：向任务描述中添加电话号码、更改截止日期、优先级、标签）时触发。
---
# 通过 `td` CLI 使用 Todoist

## 安装 / 验证

代码仓库：https://github.com/Doist/todoist-cli

若 `td` 尚未安装（例如：`command not found: td`），请从该仓库安装：

```bash
git clone https://github.com/Doist/todoist-cli
cd todoist-cli
npm install
npm run build
npm link
```

然后验证安装：

```bash
td --help
```

所有 Todoist 操作均使用 `td`。推荐使用可解析的输出格式：

- 使用 `--json`（或 `--ndjson`）列出/读取任务。  
- 使用 `td task update ...` 进行编辑（内容、截止日期、描述、优先级、标签等）。

## 快速日程概览

- 今日 + 已逾期：  
  - `td today --json`  
- 接下来 N 天：  
  - `td upcoming 7 --json`  
- 收件箱：  
  - `td inbox --json`  

向用户汇总日程时：  
- 分开呈现 **已逾期** 与 **今日到期**（可选地包含 **即将到期**）。  
- 若存在，应包含优先级（p1–p4）及任意标签。

## 查找需编辑的正确任务

首选方法如下：

1) 若你已知任务 ID，可直接使用：  
- 引用格式：`id:<taskId>`（例如：`id:6WcqCcR4wF7XW5m6`）  

2) 若仅有标题/片段信息，则先搜索/列出再匹配：  
- `td task list --json`（可选地结合其他列表命令进一步过滤，如 `today`、`upcoming`、`inbox`）  
- 然后根据 `content` + 截止日期 + 项目挑选正确条目。

查看单个任务：  
- `td task view <ref> --json`  

## 常见编辑操作

更新描述（备注）：  
- `td task update <ref> --description "..."`  

更新标题/内容：  
- `td task update <ref> --content "New task title"`  

更改截止日期/时间（自然语言通常有效）：  
- `td task update <ref> --due "tomorrow 3pm"`  

优先级：  
- `td task update <ref> --priority p1`（或 p2/p3/p4）  

标签（将替换现有全部标签）：  
- `td task update <ref> --labels "Chores,Calls"`  

完成 / 重新打开：  
- `td task complete <ref>`  
- `td task uncomplete id:<taskId>`  

删除：  
- `td task delete <ref> --yes`（仅当用户明确要求删除时才执行）  

## 添加任务

快速自然语言添加：  
- `td add "Call dentist tomorrow 10am p2 #Personal"`  

或显式添加（需要结构化字段时）：  
- `td task add --content "..." --due "..." --priority p2 --labels "..."`  

## 安全性 / 用户体验

- 对破坏性操作（如删除）执行前须确认。  
- 若多个任务匹配用户描述，请在更新前提出澄清问题（或展示候选列表）。  
- 当用户要求添加信息（例如电话号码）时，除非明确要求放入标题，否则一律置于 **描述** 中。