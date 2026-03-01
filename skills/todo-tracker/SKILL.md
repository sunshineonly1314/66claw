---
name: todo-tracker
name_zh: 待办追踪
description: 用于跨会话跟踪任务的持久化 TODO 临时记事本。当用户说“add to TODO”、“what's on the TODO”、“mark X done”、“show TODO list”、“remove from TODO”，或询问待处理任务时触发。亦在心跳事件中触发，以提醒陈旧条目。
description_zh: 用于跨会话跟踪任务的持久化 TODO 临时记事本。当用户说“add to TODO”、“what's on the TODO”、“mark X done”、“show TODO list”、“remove from TODO”，或询问待处理任务时触发。亦在心跳事件中触发，以提醒陈旧条目。
---
# TODO Tracker

在工作区中维护一个持久化的 TODO.md 临时记事本。

## 文件位置

工作区根目录下的 `TODO.md`（例如：`/Users/nuthome/nuri-bot/TODO.md`）

## 命令

### 查看 TODO
当用户询问：“what's on the TODO?”、“show TODO”、“pending tasks?”  
```bash
cat TODO.md
```  
随后按优先级对条目进行汇总。

### 添加条目
当用户说：“add X to TODO”、“TODO: X”、“remember to X”  
```bash
bash skills/todo-tracker/scripts/todo.sh add "<priority>" "<item>"
```  
支持的优先级：`high`、`medium`、`low`（默认：中等）

示例：
```bash
bash skills/todo-tracker/scripts/todo.sh add high "Ingest low-code docs"
bash skills/todo-tracker/scripts/todo.sh add medium "Set up Zendesk escalation"
bash skills/todo-tracker/scripts/todo.sh add low "Add user memory feature"
```

### 标记为完成
当用户说：“mark X done”、“completed X”、“finished X”  
```bash
bash skills/todo-tracker/scripts/todo.sh done "<item-pattern>"
```  
支持模糊匹配文本。将条目移至 ✅ 已完成 区域，并附上日期。

### 删除条目
当用户说：“remove X from TODO”、“delete X from TODO”  
```bash
bash skills/todo-tracker/scripts/todo.sh remove "<item-pattern>"
```

### 按优先级列出
```bash
bash skills/todo-tracker/scripts/todo.sh list high
bash skills/todo-tracker/scripts/todo.sh list medium
bash skills/todo-tracker/scripts/todo.sh list low
```

## 心跳集成（Heartbeat Integration）

在心跳事件中检查 TODO.md：
1. 统计高优先级条目数量  
2. 检查是否存在陈旧条目（添加时间 > 7 天前）  
3. 若存在条目，则在心跳响应中包含简要摘要  

示例心跳检查：
```bash
bash skills/todo-tracker/scripts/todo.sh summary
```

## TODO.md 文件格式

```markdown
# TODO - Nuri Scratch Pad

*Last updated: 2026-01-17*

## 🔴 High Priority
- [ ] Item one (added: 2026-01-17)
- [ ] Item two (added: 2026-01-15) ⚠️ STALE

## 🟡 Medium Priority
- [ ] Item three (added: 2026-01-17)

## 🟢 Nice to Have
- [ ] Item four (added: 2026-01-17)

## ✅ Done
- [x] Completed item (done: 2026-01-17)
```

## 响应格式

显示 TODO 时：
```
📋 **TODO List** (3 items)

🔴 **High Priority** (1)
• Ingest low-code docs

🟡 **Medium Priority** (1)  
• Zendesk escalation from Discord

🟢 **Nice to Have** (1)
• User conversation memory

⚠️ 1 item is stale (>7 days old)
```