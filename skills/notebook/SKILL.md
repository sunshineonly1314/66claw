---
name: Notebook
name_zh: 笔记本
description: 本地优先的个人知识库，用于追踪想法、项目、任务、习惯，以及您自定义的任意对象类型。基于 YAML，无云厂商锁定。
description_zh: 本地优先的个人知识库，用于追踪想法、项目、任务、习惯，以及您自定义的任意对象类型。基于 YAML，无云厂商锁定。
---
# Notebook Skill：面向对象的个人知识库

目的：追踪您自定义的任意对象类型，例如想法、项目、任务、习惯、书籍和人物。

位置：{WORKSPACE}/skills/notebook/

## Agent 入门协议

当尚未定义任何对象类型时，引导用户完成初始化设置。

### 第一步：建议首个类型

```
It looks like you have not defined any object types yet.
Notebook works best when you define the types of things you want to track.

What would you like to start with?

1. Ideas for capturing thoughts and features
2. Projects for long term work with goals
3. Tasks for actionable items with due dates
4. Something custom tell me what you want to track
```

### 第二步：共同定义该类型

若用户选择预设模板：
```
Great. Let us set up [type].

I will create it with useful fields. You can add or remove them later.

For [type], what fields do you want?
- title (text, required)
- status (select)
- priority (select)
- tags (text)
- notes (longtext)
- [custom fields]

What fields should [type] have?
```

若用户希望自定义：
```
Tell me what you want to track and what details matter.

Example: I want to track books I read. I need title, author, status, rating, and notes.

I will translate that into a type definition.
```

### 第三步：创建首个对象

```
Now let us add your first [type].

What do you want to track as your first [type]?

Example: The Andromeda Strain for books or Home automation for projects
```

### 第四步：展示工作流

```
Perfect. You now have:
- Type: [typename] with [N] fields
- 1 [typename] object: [title]

What would you like to do next?

- notebook list [typename] to see all items
- notebook expand [typename] [title] to add details
- notebook add [typename] to add another
- notebook type-add [typename] to add more fields later
```

### 第五步：提供扩展选项

```
Would you like to deepen this [typename] with some questions?
Say expand and I will ask questions to add depth.
```

## 快速参考

### 定义类型

```
notebook type-add typename field1:text field2:select(a|b|c) field3:number
```

字段类型：
- text：短字符串
- longtext：多行笔记
- select(a|b|c)：从列表中单选一项
- number：数值型字段
- date：日期字段
- list：字符串数组

### 操作对象

```
notebook add typename "Title" [-t tag1,tag2 -p priority]
notebook list typename
notebook get typename title
notebook expand typename title
notebook edit typename "title" field:value
notebook link type1:title1 type2:title2
notebook delete typename title
notebook find "query"
notebook stats
```

## 示例工作流

```
# 1. Define a type
notebook type-add idea title:text status:select(raw|expanded|archived) priority:select(high|medium|low) tags:text notes:longtext

# 2. Add your first idea
notebook add idea "Voice capture while driving" -t voice,automation -p high

# 3. Deepen it
notebook expand idea "voice capture"

# 4. Link to other objects
notebook add project "Home automation" -t household
notebook link idea:"voice capture" project:"home automation"

# 5. Update as you work
notebook edit idea "voice capture" status:expanded
```

## 数据存储位置

```
/data/notebook/
├── objects/
├── types.yaml
└── index.json
```

## 设计原则

- 用户自定义：由您定义真正重要的对象类型。
- 本地优先：采用纯 YAML 文件，不依赖任何云服务或厂商锁定。
- 可链接：对象之间可相互引用。
- 可扩展：按需新增类型与字段。
- 可深化：通过智能提问促进深度思考。