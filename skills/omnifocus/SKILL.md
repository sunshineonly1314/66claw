---
name: omnifocus
name_zh: OmniFocus
description: "通过 JavaScript for Automation (JXA) 脚本管理 OmniFocus 任务。当用户要求 Clawdbot 与 OmniFocus 交互时使用，包括：(1) 将任务添加至收件箱；(2) 列出或搜索任务（收件箱、可用、已标记、已逾期、即将到期）；(3) 完成任务；(4) 更新任务属性（备注、截止日期、标记）；(5) 获取 OmniFocus 统计数据；(6) 报告任务状态；或 (7) 根据用户查询对 OmniFocus 中的任务执行操作。"
description_zh: 通过 JavaScript for Automation (JXA) 脚本管理 OmniFocus 任务。当用户要求 Clawdbot 与 OmniFocus 交互时使用，包括：(1) 将任务添加至收件箱；(2) 列出或搜索任务（收件箱、可用、已标记、已逾期、即将到期）；(3) 完成任务；(4) 更新任务属性（备注、截止日期、标记）；(5) 获取 OmniFocus 统计数据；(6) 报告任务状态；或 (7) 根据用户查询对 OmniFocus 中的任务执行操作。
---
# OmniFocus 任务管理

通过 JavaScript for Automation (JXA) 脚本自动化 OmniFocus 任务管理。

## 快速开始

所有脚本均位于 `scripts/` 目录中，并使用 JXA。运行方式如下：

```bash
osascript -l JavaScript scripts/<script-name>.js [args]
```

**关键脚本：**
- `add_task.js` — 将任务添加至收件箱
- `list_tasks.js` — 按筛选条件列出任务
- `search_tasks.js` — 按关键词搜索任务
- `complete_task.js` — 按名称完成任务
- `update_task.js` — 更新任务属性
- `get_stats.js` — 获取 OmniFocus 统计数据

## 核心操作

### 添加任务

```bash
osascript -l JavaScript scripts/add_task.js "Task name" ["Note"] ["YYYY-MM-DD"]
```

**示例：**
```bash
osascript -l JavaScript scripts/add_task.js "Buy groceries"
osascript -l JavaScript scripts/add_task.js "Review doc" "Check sections 1-3"
osascript -l JavaScript scripts/add_task.js "Submit report" "Q1" "2026-01-31"
```

**返回值：** 任务 ID

### 列出任务

```bash
osascript -l JavaScript scripts/list_tasks.js [filter] [limit]
```

**筛选器：**
- `inbox` — 收件箱任务
- `available` — 可用（未被阻塞）任务（默认）
- `flagged` — 已标记任务
- `due-soon` — 3 天内到期任务
- `overdue` — 已逾期任务
- `all` — 所有未完成任务

**返回值：** 包含任务详情（名称、ID、备注、截止日期、是否已标记、项目、标签）的 JSON 数组

### 搜索任务

```bash
osascript -l JavaScript scripts/search_tasks.js "keyword" [limit]
```

在任务名称和备注中搜索，不区分大小写。

**返回值：** 匹配任务的 JSON 数组

### 完成任务

```bash
osascript -l JavaScript scripts/complete_task.js "Task name"
```

优先在收件箱中搜索，再搜索全部任务；完成首个匹配项。

### 更新任务

```bash
osascript -l JavaScript scripts/update_task.js "Task name" [--note "text"] [--due "YYYY-MM-DD"] [--flag true/false]
```

**示例：**
```bash
osascript -l JavaScript scripts/update_task.js "Review" --note "Added notes"
osascript -l JavaScript scripts/update_task.js "Submit" --due "2026-02-01"
osascript -l JavaScript scripts/update_task.js "Important" --flag true
```

### 获取统计数据

```bash
osascript -l JavaScript scripts/get_stats.js
```

**返回值：** 包含以下计数的 JSON：
- 总数、未完成数、收件箱数
- 已标记数、已逾期数、即将到期数
- 可用数、被阻塞数

## 使用指南

### 回应用户查询时

1. **执行操作前先列出任务**，以确认目标
2. **解析 JSON 输出**，用于结构化处理
3. **以用户友好的格式呈现结果**（而非原始 JSON）
4. **在完成或修改任务前进行确认**
5. **优雅地处理错误**（如任务未找到等）

### 常见模式

**每日回顾：**
```bash
# Statistics overview
osascript -l JavaScript scripts/get_stats.js

# What needs attention
osascript -l JavaScript scripts/list_tasks.js overdue
osascript -l JavaScript scripts/list_tasks.js due-soon
```

**任务查询：**
```bash
# "What's in my inbox?"
osascript -l JavaScript scripts/list_tasks.js inbox

# "What are my next actions?"
osascript -l JavaScript scripts/list_tasks.js available 10

# "Show my flagged tasks"
osascript -l JavaScript scripts/list_tasks.js flagged
```

**任务管理：**
```bash
# "Add a task to call John"
osascript -l JavaScript scripts/add_task.js "Call John"

# "Find tasks about the project"
osascript -l JavaScript scripts/search_tasks.js "project"

# "Mark 'Buy milk' as complete"
osascript -l JavaScript scripts/complete_task.js "Buy milk"

# "Flag the review task"
osascript -l JavaScript scripts/update_task.js "Review" --flag true
```

### 输出处理

脚本返回 JSON 以提供结构化数据。向用户呈现时：

1. 解析 JSON
2. 清晰格式化结果
3. 汇总统计数量及关键信息
4. 突出紧急事项（已逾期、即将到期）

**示例响应格式：**
```
Found 3 overdue tasks:
• Submit Q1 report (due Jan 20)
• Review contract (due Jan 23)
• Call vendor (due Jan 24)

And 5 tasks due in the next 3 days:
• [list tasks]

Would you like me to flag or update any of these?
```

### 错误处理

常见错误：
- **任务未找到** —— 请再次核对名称，或先执行搜索
- **无任务** —— 返回空结果，请明确告知用户
- **日期格式无效** —— 请使用 YYYY-MM-DD 格式
- **OmniFocus 未运行** —— 脚本需 OmniFocus 正在运行

### 多步骤操作

**先查找，后执行：**
```bash
# 1. Search for task
RESULTS=$(osascript -l JavaScript scripts/search_tasks.js "meeting")

# 2. Parse and identify target task name

# 3. Complete the task
osascript -l JavaScript scripts/complete_task.js "Team meeting notes"
```

## 技术参考

有关详细 API 信息和高级用法，请参阅：
- **JXA API 参考文档：** `references/jxa-api.md` —— 对象模型与方法
- **自动化指南：** `references/automation-guide.md` —— 详细的脚本说明与工作流

在以下情况下请阅读这些文件：
- 构建复杂查询
- 理解 OmniFocus 数据模型
- 实现自定义工作流
- 调试脚本

## 要求

- macOS
- 已安装并正在运行 OmniFocus
- 脚本具有可执行权限（chmod +x）

## 注意事项

- 脚本使用 JXA（JavaScript for Automation），而非 AppleScript
- 任务匹配对精确名称区分大小写，对搜索不区分大小写
- 日期格式：YYYY-MM-DD（ISO 8601）
- 所有操作均作用于默认 OmniFocus 文档
- 除添加、完成和更新操作外，其余操作均为只读安全操作