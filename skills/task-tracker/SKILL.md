---
name: task-tracker
name_zh: 任务追踪器
description: "支持每日站会和每周复盘的个人任务管理。适用场景：(1) 用户说‘daily standup’或询问当前待办事项；(2) 用户说‘weekly review’或询问上周进展；(3) 用户希望添加/更新/完成任务；(4) 用户询问阻塞项或截止日期；(5) 用户分享会议纪要并希望提取任务；(6) 用户询问‘本周有哪些任务到期’等类似问题。"
description_zh: 支持每日站会和每周复盘的个人任务管理。适用场景：(1) 用户说‘daily standup’或询问当前待办事项；(2) 用户说‘weekly review’或询问上周进展；(3) 用户希望添加/更新/完成任务；(4) 用户询问阻塞项或截止日期；(5) 用户分享会议纪要并希望提取任务；(6) 用户询问‘本周有哪些任务到期’等类似问题。
homepage: https://github.com/kesslerio/task-tracker-clawdbot-skill
metadata: {"clawdbot":{"emoji":"📋","requires":{"files":["~/clawd/memory/work/TASKS.md"]},"install":[{"id":"init","kind":"download","script":"python3 scripts/init.py","label":"从模板初始化 TASKS.md"}]}}
---
<div align="center">

![Task Tracker](https://img.shields.io/badge/Task_Tracker-Clawdbot_skill-blue?style=for-the-badge&logo=checklist)
![Python](https://img.shields.io/badge/Python-3.10+-yellow?style=flat-square&logo=python)
![Status](https://img.shields.io/badge/Status-Production-green?style=flat-square)
![Issues](https://img.shields.io/badge/Issues-0-black?style=flat-square)
![Last Updated](https://img.shields.io/badge/Last_Updated-Jan_2026-orange?style=flat-square)

**支持每日站会和每周复盘的个人任务管理**

[主页](https://github.com/kesslerio/task-tracker-clawdbot-skill) • [触发模式](#what-this-skill-does) • [命令参考](#commands-reference)

</div>

---

# 任务追踪器（Task Tracker）

一款面向 daily standup（每日站会）和 weekly review（每周复盘）的个人任务管理 agent。用于跟踪工作任务、凸显优先事项，并管理阻塞项。

---

## 该 agent 的功能

1. **列出任务** — 按优先级、状态或截止日期筛选并展示当前待办事项  
2. **每日站会** — 展示今日最高优先级任务、阻塞项及已完成事项  
3. **每周复盘** — 总结上周工作、归档已完成项、规划本周任务  
4. **添加任务** — 创建带优先级和截止日期的新任务  
5. **完成任务** — 将任务标记为已完成  
6. **从会议纪要中提取任务** — 从会议笔记中抽取待办事项  

---

## 文件结构

```
~/clawd/memory/work/
├── TASKS.md              # Active tasks (source of truth)
├── ARCHIVE-2026-Q1.md    # Completed tasks by quarter
└── WORKFLOW.md           # Workflow documentation
```

**TASKS.md 格式：**  
```markdown
# Work Tasks

## 🔴 High Priority (This Week)
- [ ] **Set up Apollo.io** — Access for Lilla
  - Due: ASAP
  - Blocks: Lilla (podcast outreach)

## 🟡 Medium Priority (This Week)
- [ ] **Review newsletter concept** — Figma design
  - Due: Before Feb 1

## ✅ Done
- [x] **Set up team calendar** — Shared Google Calendar
```

---

## 快速入门

### 查看您的任务  
```bash
python3 ~/clawd/skills/task-tracker/scripts/tasks.py list
```

### 每日站会  
```bash
python3 ~/clawd/skills/task-tracker/scripts/standup.py
```

### 每周复盘  
```bash
python3 ~/clawd/skills/task-tracker/scripts/weekly_review.py
```

---

## 命令参考

### 列出任务  
```bash
# All tasks
tasks.py list

# Only high priority
tasks.py list --priority high

# Only blocked
tasks.py list --status blocked

# Due today or this week
tasks.py list --due today
tasks.py list --due this-week
```

### 添加任务  
```bash
# Simple
tasks.py add "Draft project proposal"

# With details
tasks.py add "Draft project proposal" \
  --priority high \
  --due "Before Mar 15" \
  --blocks "Sarah (client review)"
```

### 完成任务  
```bash
tasks.py done "proposal"  # Fuzzy match - finds "Draft project proposal"
```

### 显示阻塞项  
```bash
tasks.py blockers              # All blocking tasks
tasks.py blockers --person sarah  # Only blocking Sarah
```

### 从会议纪要中提取任务  
```bash
extract_tasks.py --from-text "Meeting: discuss Q1 planning, Sarah to own budget review"
# Outputs: tasks.py add "Discuss Q1 planning" --priority medium
#          tasks.py add "Sarah to own budget review" --owner sarah
```

---

## 优先级等级

| 表情符号 | 含义 | 使用场景 |
|----------|------|-----------|
| 🔴 **高** | 关键、阻塞型、截止日期驱动型 | 影响收入、阻塞他人 |
| 🟡 **中** | 重要但不紧急 | 评审、反馈、规划 |
| 🟢 **低** | 监控中、已委派 | 等待他人响应、积压任务 |

---

## 状态工作流

```
Todo → In Progress → Done
      ↳ Blocked (waiting on external)
      ↳ Waiting (delegated, monitoring)
```

---

## 自动化（Cron）

| 任务 | 执行时间 | 执行内容 |
|------|-----------|------------|
| 每日站会 | 工作日 8:30 AM | 向 Telegram Journaling 群组发布站会摘要 |
| 每周复盘 | 每周一 9:00 AM | 发布复盘摘要，并归档已完成项 |

---

## 自然语言触发词

| 您说 | agent 执行操作 |
|------|----------------|
| "daily standup" | 运行 standup.py，并向 Journaling 群组发布 |
| "weekly review" | 运行 weekly_review.py，并发布复盘摘要 |
| "what's on my plate?" | 列出全部任务 |
| "what's blocking Lilla?" | 显示阻塞 Lilla 的任务 |
| "mark IMCAS done" | 完成匹配的任务 |
| "what's due this week?" | 列出本周到期的任务 |
| "add task: X" | 将任务 X 添加至 TASKS.md |
| "extract tasks from: [notes]" | 解析会议纪要，输出 add 命令 |

---

## 示例

**晨间检查：**  
```
$ python3 scripts/standup.py

📋 Daily Standup — Tuesday, January 21

🎯 #1 Priority: Complete project proposal draft
   ↳ Blocking: Sarah (client review)

⏰ Due Today:
  • Complete project proposal draft
  • Schedule team sync

🔴 High Priority:
  • Review Q1 budget (due: Before Mar 15)
  • Draft blog post (due: ASAP)

✅ Recently Completed:
  • Set up shared calendar
  • Update team documentation
```

**添加任务：**  
```
$ python3 scripts/tasks.py add "Draft blog post" --priority high --due ASAP

✅ Added task: Draft blog post
```

**从会议纪要中提取任务：**  
```
$ python3 scripts/extract_tasks.py --from-text "Meeting: Sarah needs budget review, create project timeline"

# Extracted 2 task(s) from meeting notes
# Run these commands to add them:

tasks.py add "Budget review for Sarah" --priority high
tasks.py add "Create project timeline" --priority medium
```

---

## 集成点

- **Telegram Journaling 群组**：自动发布每日站会/每周复盘摘要  
- **Obsidian**：每日站会记录至 `01-Daily/YYYY-MM-DD.md`  
- **MEMORY.md**：每周复盘期间推广模式识别与重复性阻塞项  
- **Cron**：自动化执行站会与复盘  

---

## 故障排查

**“任务文件未找到”**  
```bash
# Create from template
python3 scripts/init.py
```

**任务未显示**  
- 检查 `~/clawd/memory/work/TASKS.md` 路径下是否存在 TASKS.md  
- 验证任务格式（复选框 `- [ ]`、标题层级 `## 🔴`）  
- 运行 `tasks.py list` 进行调试  

**日期解析问题**  
- 支持的截止日期格式包括：`ASAP`、`YYYY-MM-DD`、`Before Mar 15`、`Before product launch`  
- `check_due_date()` 可处理常见日期格式  

---

## 文件

| 文件 | 用途 |
|------|------|
| `scripts/tasks.py` | 主 CLI 工具 —— 支持 list（列出）、add（添加）、done（完成）、blockers（阻塞项）、archive（归档）等操作 |
| `scripts/standup.py` | 生成每日站会摘要 |
| `scripts/weekly_review.py` | 生成每周复盘摘要 |
| `scripts/extract_tasks.py` | 从会议纪要中提取任务 |
| `scripts/utils.py` | 公共工具函数（DRY 原则） |
| `scripts/init.py` | 依据模板初始化新的 TASKS.md |
| `references/task-format.md` | 任务格式规范文档 |
| `assets/templates/TASKS.md` | 新建任务文件的模板 |