---
name: ontology
name_zh: 本体
description: 用于结构化 agent 记忆与可组合 skills 的带类型知识图谱。适用于创建/查询实体（Person、Project、Task、Event、Document）、链接相关对象、强制执行约束、将多步操作建模为图变换，或当 skills 需要共享状态时。在触发词为“remember”、“what do I know about”、“link X to Y”、“show dependencies”、实体 CRUD 操作，或跨 skills 数据访问时启用。
description_zh: 用于结构化 agent 记忆与可组合 skills 的带类型知识图谱。适用于创建/查询实体（Person、Project、Task、Event、Document）、链接相关对象、强制执行约束、将多步操作建模为图变换，或当 skills 需要共享状态时。在触发词为“remember”、“what do I know about”、“link X to Y”、“show dependencies”、实体 CRUD 操作，或跨 skills 数据访问时启用。
---
# 本体（Ontology）

一种带类型的词汇表 + 约束系统，用于将知识表示为可验证的图。

## 核心概念

一切皆为具有 **类型**、**属性** 及与其他实体 **关系** 的 **实体**。每次变更均在提交前依据类型约束进行校验。

```
Entity: { id, type, properties, relations, created, updated }
Relation: { from_id, relation_type, to_id, properties }
```

## 何时使用

| 触发词 | 对应操作 |
|---------|----------|
| “Remember that...” | 创建/更新实体 |
| “What do I know about X?” | 查询图谱 |
| “Link X to Y” | 创建关系 |
| “Show all tasks for project Z” | 图遍历 |
| “What depends on X?” | 依赖关系查询 |
| 规划多步工作 | 建模为图变换 |
| skill 需要共享状态 | 读写本体对象 |

## 核心类型

```yaml
# Agents & People
Person: { name, email?, phone?, notes? }
Organization: { name, type?, members[] }

# Work
Project: { name, status, goals[], owner? }
Task: { title, status, due?, priority?, assignee?, blockers[] }
Goal: { description, target_date?, metrics[] }

# Time & Place
Event: { title, start, end?, location?, attendees[], recurrence? }
Location: { name, address?, coordinates? }

# Information
Document: { title, path?, url?, summary? }
Message: { content, sender, recipients[], thread? }
Thread: { subject, participants[], messages[] }
Note: { content, tags[], refs[] }

# Resources
Account: { service, username, credential_ref? }
Device: { name, type, identifiers[] }
Credential: { service, secret_ref }  # Never store secrets directly

# Meta
Action: { type, target, timestamp, outcome? }
Policy: { scope, rule, enforcement }
```

## 存储

默认：`memory/ontology/graph.jsonl`

```jsonl
{"op":"create","entity":{"id":"p_001","type":"Person","properties":{"name":"Alice"}}}
{"op":"create","entity":{"id":"proj_001","type":"Project","properties":{"name":"Website Redesign","status":"active"}}}
{"op":"relate","from":"proj_001","rel":"has_owner","to":"p_001"}
```

可通过脚本或直接文件操作进行查询。对于复杂图谱，建议迁移至 SQLite。

## 工作流

### 创建实体

```bash
python3 scripts/ontology.py create --type Person --props '{"name":"Alice","email":"alice@example.com"}'
```

### 查询

```bash
python3 scripts/ontology.py query --type Task --where '{"status":"open"}'
python3 scripts/ontology.py get --id task_001
python3 scripts/ontology.py related --id proj_001 --rel has_task
```

### 链接实体

```bash
python3 scripts/ontology.py relate --from proj_001 --rel has_task --to task_001
```

### 校验

```bash
python3 scripts/ontology.py validate  # Check all constraints
```

## 约束

在 `memory/ontology/schema.yaml` 中定义：

```yaml
types:
  Task:
    required: [title, status]
    status_enum: [open, in_progress, blocked, done]
  
  Event:
    required: [title, start]
    validate: "end >= start if end exists"

  Credential:
    required: [service, secret_ref]
    forbidden_properties: [password, secret, token]  # Force indirection

relations:
  has_owner:
    from_types: [Project, Task]
    to_types: [Person]
    cardinality: many_to_one
  
  blocks:
    from_types: [Task]
    to_types: [Task]
    acyclic: true  # No circular dependencies
```

## Skill 合约

使用本体的 Skills 应声明：

```yaml
# In SKILL.md frontmatter or header
ontology:
  reads: [Task, Project, Person]
  writes: [Task, Action]
  preconditions:
    - "Task.assignee must exist"
  postconditions:
    - "Created Task has status=open"
```

## 将规划建模为图变换

将多步规划建模为一系列图操作：

```
Plan: "Schedule team meeting and create follow-up tasks"

1. CREATE Event { title: "Team Sync", attendees: [p_001, p_002] }
2. RELATE Event -> has_project -> proj_001
3. CREATE Task { title: "Prepare agenda", assignee: p_001 }
4. RELATE Task -> for_event -> event_001
5. CREATE Task { title: "Send summary", assignee: p_001, blockers: [task_001] }
```

每一步均在执行前完成校验；若违反约束则回滚。

## 集成模式

### 与因果推理集成

将本体变更记录为因果动作：

```python
# When creating/updating entities, also log to causal action log
action = {
    "action": "create_entity",
    "domain": "ontology", 
    "context": {"type": "Task", "project": "proj_001"},
    "outcome": "created"
}
```

### 跨 skill 通信

```python
# Email skill creates commitment
commitment = ontology.create("Commitment", {
    "source_message": msg_id,
    "description": "Send report by Friday",
    "due": "2026-01-31"
})

# Task skill picks it up
tasks = ontology.query("Commitment", {"status": "pending"})
for c in tasks:
    ontology.create("Task", {
        "title": c.description,
        "due": c.due,
        "source": c.id
    })
```

## 快速入门

```bash
# Initialize ontology storage
mkdir -p memory/ontology
touch memory/ontology/graph.jsonl

# Create schema (optional but recommended)
cat > memory/ontology/schema.yaml << 'EOF'
types:
  Task:
    required: [title, status]
  Project:
    required: [name]
  Person:
    required: [name]
EOF

# Start using
python3 scripts/ontology.py create --type Person --props '{"name":"Alice"}'
python3 scripts/ontology.py list --type Person
```

## 参考资料

- `references/schema.md` — 完整类型定义与约束模式  
- `references/queries.md` — 查询语言与遍历示例