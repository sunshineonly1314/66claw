---
name: task-board
description: "Markdown-based task board and project management inside the workspace. Create, track, and organize tasks with kanban-style columns (Todo/In Progress/Done), priorities, deadlines, and tags. Use when the user asks to manage tasks, create a todo list, track project progress, organize work items, or needs a kanban board."
nameZh: "任务控制中心"
descriptionZh: "基于Markdown的任务看板和项目管理，支持看板列、优先级、截止日期和标签"
metadata: {"openclawcn":{"emoji":"📌"}}
---

# 任务控制中心 (Task Board)

在工作区内使用 Markdown 文件管理任务，支持看板视图、优先级、截止日期和标签。所有数据以纯文本存储，天然支持 Git 版本控制。

## 触发场景

- "帮我建一个任务看板"
- "记录一下待办事项"
- "这个项目的任务进展"
- "把这个任务标记为完成"
- "看看还有哪些没做完"

## 文件结构

```
workspace/
└── tasks.md          -- 主任务文件（默认）
```

也可按项目拆分:
```
workspace/
├── tasks.md          -- 全局任务
├── tasks/
│   ├── project-a.md  -- 项目A任务
│   └── project-b.md  -- 项目B任务
```

## 任务文件格式

```markdown
# 任务看板

> 最后更新: YYYY-MM-DD HH:MM

## 待办 (Todo)

- [ ] **[P1]** 任务标题 `#标签` `截止:2026-03-01`
  - 任务描述或子任务
- [ ] **[P2]** 另一个任务 `#标签`
- [ ] 普通优先级任务

## 进行中 (In Progress)

- [-] **[P1]** 正在做的任务 `#标签` `开始:2026-02-20`
  - [x] 子任务1（已完成）
  - [ ] 子任务2（进行中）

## 已完成 (Done)

- [x] ~~已完成的任务~~ `完成:2026-02-19`
- [x] ~~另一个完成的任务~~ `完成:2026-02-18`

---

## 归档 (Archive)

<details>
<summary>2026年2月已完成 (5项)</summary>

- [x] 归档任务1
- [x] 归档任务2
</details>
```

## 操作指令

### 创建看板

```
read tasks.md  -- 检查是否已存在
write({file_path: "tasks.md", content: "看板模板内容"})
```

### 添加任务

读取现有 tasks.md，在对应列下添加:
```
edit({file_path: "tasks.md", old_string: "## 待办 (Todo)\n", new_string: "## 待办 (Todo)\n\n- [ ] **[P1]** 新任务标题 `#标签`\n"})
```

### 移动任务（状态变更）

从"待办"移到"进行中":
1. 读取 tasks.md
2. 从"待办"区删除该任务行
3. 在"进行中"区添加，标记改为 `[-]`，添加 `开始:日期`

从"进行中"移到"已完成":
1. 从"进行中"区删除
2. 在"已完成"区添加，标记改为 `[x]`，标题加 `~~删除线~~`，添加 `完成:日期`

### 查看状态

读取并汇总:
```
read({file_path: "tasks.md"})
```

输出统计:
```
任务看板状态:
- 待办: 5 项 (P1: 2, P2: 2, 普通: 1)
- 进行中: 2 项
- 已完成: 8 项
- 逾期: 1 项 ⚠️
```

### 按标签/优先级筛选

用户说"看看所有 P1 任务":
```
-- 读取 tasks.md，过滤包含 [P1] 的行
```

用户说"#前端 相关的任务":
```
-- 读取 tasks.md，过滤包含 #前端 的行
```

## 优先级标记

| 标记 | 含义 | 使用场景 |
|------|------|----------|
| `[P0]` | 紧急 | 阻塞性问题，今天必须解决 |
| `[P1]` | 高 | 本周内完成 |
| `[P2]` | 中 | 本月内完成 |
| 无标记 | 低 | 有空再做 |

## 自动维护

### 更新时间戳

每次修改 tasks.md 时更新顶部时间戳:
```
edit({file_path: "tasks.md", old_string: "> 最后更新: ...", new_string: "> 最后更新: YYYY-MM-DD HH:MM"})
```

### 月度归档

每月初将上月"已完成"任务移入折叠归档区:
```markdown
<details>
<summary>YYYY年M月已完成 (N项)</summary>
...已完成任务列表...
</details>
```

### 逾期提醒

读取任务时检查截止日期，标注逾期任务:
```
⚠️ 逾期任务:
- [P1] 任务标题 (截止: 2026-02-15, 逾期6天)
```

## 最佳实践

- **一个文件起步**: 先用单个 tasks.md，任务超过 30 条再考虑拆分
- **每日回顾**: 用户说"看看任务"时，汇总状态 + 高亮逾期项
- **保持干净**: 完成超过 30 天的任务自动归档
- **标签统一**: 建议用户保持标签一致性（`#前端` `#后端` `#设计` `#文档`）
- **Git 友好**: 纯 Markdown 格式，每次变更都可以 diff 追踪
