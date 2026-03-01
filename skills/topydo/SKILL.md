---
name: topydo
name_zh: Topydo
description: Manage todo.txt tasks using topydo CLI. Add, list, complete, prioritize, tag, and organize tasks with dependencies, due dates, recurrence, and projects. Use for any task management, todo lists, or when the user mentions tasks, todos, or todo.txt.
description_zh: Manage todo.txt tasks using topydo CLI. Add, list, complete, prioritize, tag, and organize tasks with dependencies, due dates, recurrence, and projects. Use for any task management, todo lists, or when the user mentions tasks, todos, or todo.txt.
license: MIT
compatibility: Requires Python 3 and pip. Works on macOS, Linux, and Windows.
metadata: {"clawdbot":{"requires":{"bins":["topydo"]},"install":[{"id":"brew","kind":"brew","formula":"topydo","bins":["topydo"],"label":"Install topydo (brew)"},{"id":"pip","kind":"uv","package":"topydo","bins":["topydo"],"label":"Install topydo (pip)"}]}}
---
# topydo — Todo.txt 任务管理器

topydo 是一款功能强大的命令行工具，用于管理符合 todo.txt 格式的任务。支持依赖关系、截止日期、起始日期、重复规则、优先级、项目和上下文。

## 任务格式参考

```
(A) 2025-01-11 Task text +Project @Context due:2025-01-15 t:2025-01-10 rec:1w star:1
│   │          │         │        │        │             │            │      │
│   │          │         │        │        │             │            │      └─ Star marker
│   │          │         │        │        │             │            └─ Recurrence
│   │          │         │        │        │             └─ Start/threshold date
│   │          │         │        │        └─ Due date
│   │          │         │        └─ Context
│   │          │         └─ Project
│   │          └─ Task description
│   └─ Creation date
└─ Priority (A-Z)
```

## 安装

### Homebrew（macOS，推荐）
```bash
brew install topydo
```

### pip（全平台）
```bash
pip3 install topydo
```

启用可选功能：
```bash
pip3 install 'topydo[columns,prompt,ical]'
```

### apt（Ubuntu/Debian）
```bash
sudo apt install python3-pip && pip3 install topydo
```

## 配置

配置文件查找路径（按优先级顺序）：
- `topydo.conf` 或 `.topydo`（当前目录）  
- `~/.topydo` 或 `~/.config/topydo/config`  
- `/etc/topydo.conf`  

示例 `~/.topydo`：
```ini
[topydo]
filename = ~/todo.txt
archive_filename = ~/done.txt
colors = 1
identifiers = text

[add]
auto_creation_date = 1

[sort]
sort_string = desc:importance,due,desc:priority
ignore_weekends = 1
```

## 添加任务

基础任务：
```bash
topydo add "Buy groceries"
```

带优先级（A 为最高）：
```bash
topydo add "(A) Urgent task"
```

带项目与上下文：
```bash
topydo add "Write report +ProjectX @office"
```

带绝对截止日期：
```bash
topydo add "Submit proposal due:2025-01-15"
```

带相对截止日期：
```bash
topydo add "Call mom due:tomorrow"
```

带工作日截止日期：
```bash
topydo add "Weekly review due:fri"
```

带起始/门槛日期：
```bash
topydo add "Future task t:2025-02-01"
```

带每周重复规则：
```bash
topydo add "Water plants due:sat rec:1w"
```

带严格重复规则（每月 1 日固定执行）：
```bash
topydo add "Pay rent due:2025-02-01 rec:+1m"
```

带依赖关系（必须先完成任务 1）：
```bash
topydo add "Write tests before:1"
```

作为任务 1 的子任务：
```bash
topydo add "Review code partof:1"
```

## 列出任务

列出所有相关任务：
```bash
topydo ls
```

包含隐藏/被阻塞任务：
```bash
topydo ls -x
```

按项目过滤：
```bash
topydo ls +ProjectX
```

按上下文过滤：
```bash
topydo ls @office
```

按优先级过滤：
```bash
topydo ls "(A)"
```

按优先级范围过滤：
```bash
topydo ls "(>C)"
```

筛选今日到期任务：
```bash
topydo ls due:today
```

筛选已逾期任务：
```bash
topydo ls "due:<today"
```

筛选本周五前到期任务：
```bash
topydo ls "due:<=fri"
```

组合多个过滤条件：
```bash
topydo ls +ProjectX @office due:today
```

排除特定上下文：
```bash
topydo ls -- -@waiting
```

按优先级排序：
```bash
topydo ls -s priority
```

按截止日期降序、再按优先级排序：
```bash
topydo ls -s desc:due,priority
```

按项目分组：
```bash
topydo ls -g project
```

限制结果数量为 5 条：
```bash
topydo ls -n 5
```

自定义输出格式：
```bash
topydo ls -F "%I %p %s %{due:}d"
```

以 JSON 格式输出：
```bash
topydo ls -f json
```

## 完成任务

按 ID 完成任务：
```bash
topydo do 1
```

完成多个任务：
```bash
topydo do 1 2 3
```

完成所有今日到期任务：
```bash
topydo do -e due:today
```

按自定义日期完成：
```bash
topydo do -d yesterday 1
```

## 优先级管理

设为优先级 A：
```bash
topydo pri 1 A
```

为多个任务设置优先级：
```bash
topydo pri 1 2 3 B
```

移除优先级：
```bash
topydo depri 1
```

## 任务打标

设置截止日期：
```bash
topydo tag 1 due tomorrow
```

为任务加星标：
```bash
topydo tag 1 star 1
```

移除某个标签：
```bash
topydo tag 1 due
```

设置带相对日期的自定义标签：
```bash
topydo tag -r 1 review 2w
```

## 修改任务

向任务追加文本：
```bash
topydo append 1 "additional notes"
```

追加截止日期：
```bash
topydo append 1 due:friday
```

在文本编辑器中编辑任务：
```bash
topydo edit 1
```

编辑某项目下的全部任务：
```bash
topydo edit -e +ProjectX
```

## 删除任务

按 ID 删除：
```bash
topydo del 1
```

删除多个任务：
```bash
topydo del 1 2 3
```

按表达式删除：
```bash
topydo del -e completed:today
```

## 依赖关系

添加依赖（任务 2 依赖于任务 1）：
```bash
topydo dep add 2 to 1
```

任务 2 属于任务 1 的一部分：
```bash
topydo dep add 2 partof 1
```

列出依赖于任务 1 的任务：
```bash
topydo dep ls 1 to
```

列出任务 1 所依赖的任务：
```bash
topydo dep ls to 1
```

移除依赖关系：
```bash
topydo dep rm 2 to 1
```

可视化依赖关系（需 graphviz）：
```bash
topydo dep dot 1 | dot -Tpng -o deps.png
```

## 推迟任务

推迟 1 周：
```bash
topydo postpone 1 1w
```

推迟 3 天：
```bash
topydo postpone 1 3d
```

推迟（含起始日期）：
```bash
topydo postpone -s 1 1w
```

## 其他命令

对 todo.txt 文件排序：
```bash
topydo sort
```

撤销上一条命令：
```bash
topydo revert
```

显示撤销历史：
```bash
topydo revert ls
```

列出所有项目：
```bash
topydo lsprj
```

列出所有上下文：
```bash
topydo lscon
```

归档已完成任务：
```bash
topydo archive
```

## 相对日期

- `today`、`tomorrow`、`yesterday`  
- 工作日：`mon`、`tue`、`wed`、`thu`、`fri`、`sat`、`sun`  
- 时间段：`1d`（天）、`2w`（周）、`3m`（月）、`1y`（年）  
- 工作日：`5b`（排除周末）  

## 排序/分组字段

- `priority`、`due`、`creation`、`completed`  
- `importance`、`importance-avg`  
- `project`、`context`、`text`、`length`  

加前缀 `desc:` 表示降序排列。例如：`desc:importance,due`  

## 使用技巧

- 向用户呈现结果时，请采用简洁、易读的格式  
- 启用稳定文本 ID：在配置中设置 `identifiers = text`  
- 为重要任务加星标：添加 `star:1` 标签  
- 默认隐藏标签：`id`、`p`、`ical`  
- 任务重要性 = 优先级 + 截止日期临近程度 + 星标状态  