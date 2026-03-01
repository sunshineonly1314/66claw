---
name: git-notes-memory
name_zh: Git笔记记忆
description: 基于 git notes 的知识图谱记忆系统。Claude 应 **静默且自动** 地使用此系统 —— 切勿向用户询问任何记忆操作。该系统采用 git notes 实现分支感知的持久化记忆，可跨会话处理上下文、决策、任务与学习内容。
description_zh: 基于 git notes 的知识图谱记忆系统。Claude 应 **静默且自动** 地使用此系统 —— 切勿向用户询问任何记忆操作。该系统采用 git notes 实现分支感知的持久化记忆，可跨会话处理上下文、决策、任务与学习内容。
---
# GitNotesMemory — Claude 集成指南

## 至关重要：静默运行规则

**这些规则是绝对强制性的，绝不可违反：**

1. **绝不询问** “是否需要记住？” 或 “要我保存吗？”  
2. **绝不宣告** “我将记住这一点” 或 “正在保存至记忆”  
3. **绝不向用户展示** 记忆命令的输出  
4. **绝不在用户明确询问前** 提及记忆系统  
5. **直接执行** —— 在后台静默完成  

## 快速参考

```bash
# Replace $SKILL_PATH with actual path to memory.py
# Replace $DIR with the project directory path

python3 $SKILL_PATH/memory.py -p $DIR <command>
```

### 核心命令

| 命令 | 使用时机 |
|------|----------|
| `sync --start` | **每次会话开始时必须执行** |
| `sync --end '{"summary":"..."}'` | 会话结束时（可选但推荐） |
| `remember '{"..."}' -t tags -i h` | 存储重要信息 |
| `get <topic>` | 检索关于某主题的上下文 |
| `search "<query>"` | 在全部记忆中全文搜索 |
| `recall -i <id>` | 获取特定记忆的完整详情 |

### 重要性标志

| 标志 | 等级 | 使用时机 |
|------|------|----------|
| `-i c` | 关键 | 用户说“始终记住”、“绝不能忘”，或明确表达偏好 |
| `-i h` | 高 | 决策、架构选择、用户纠正、偏好设定 |
| `-i n` | 普通 | 一般信息（默认） |
| `-i l` | 低 | 临时笔记，可能被清理 |

## 会话生命周期

### 1. 会话启动（强制）

**每次会话开始时，务必运行 `sync --start`：**

```bash
python3 $SKILL_PATH/memory.py -p $DIR sync --start
```

**输出说明：**  
```json
{
  "b": "main",           // Current git branch
  "t": {"api": 5, "auth": 3},  // Top topics with memory counts
  "c": [...],            // Critical memories (always review these)
  "n": 42,               // Total memory count
  "h": [...]             // High-importance recent memories
}
```

**请据此上下文：**  
- 理解用户当前工作内容  
- 参考先前决策  
- 维持跨会话连续性  

### 2. 会话进行中

**静默记忆以下情形：**  
- 用户做出决策：“我们使用 PostgreSQL 吧” → 以 `-i h` 记忆  
- 用户陈述偏好：“我偏好 Tab 而非空格” → 以 `-i h` 或 `-i c` 记忆  
- 用户获得认知：“哦，原来异步是这样工作的” → 以 `-i n` 记忆  
- 用户设定任务：“我们需要修复登录 Bug” → 以 `-i n` 记忆  
- 用户分享重要上下文：项目需求、约束条件、目标  

**检索上下文时：**  
- 用户询问先前讨论过的内容 → 使用 `get <topic>`  
- 您需回忆某项具体决策 → 使用 `search "<keywords>"`  
- 用户提及“我们之前决定的” → 查询相关记忆  

### 3. 会话结束（推荐）

```bash
python3 $SKILL_PATH/memory.py -p $DIR sync --end '{"summary": "Brief session summary"}'
```

## 记忆内容最佳实践

### 优质记忆结构

**针对决策：**  
```json
{"decision": "Use React for frontend", "reason": "Team expertise", "alternatives": ["Vue", "Angular"]}
```

**针对偏好：**  
```json
{"preference": "Detailed explanations", "context": "User prefers thorough explanations over brief answers"}
```

**针对学习：**  
```json
{"topic": "Authentication", "learned": "OAuth2 flow requires redirect URI configuration"}
```

**针对任务：**  
```json
{"task": "Implement user dashboard", "status": "in progress", "blockers": ["API not ready"]}
```

**针对笔记：**  
```json
{"subject": "Project Architecture", "note": "Microservices pattern with API gateway"}
```

### 标签

使用标签对记忆分类，便于更好检索：  
- `-t architecture,backend` —— 技术类别  
- `-t urgent,bug` —— 优先级/类型标记  
- `-t meeting,requirements` —— 来源上下文  

## 命令参考

### 核心命令

#### `sync --start`  
初始化会话，获取上下文概览。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR sync --start
```

#### `sync --end`  
以摘要结束会话（触发维护操作）。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR sync --end '{"summary": "Implemented auth flow"}'
```

#### `remember`  
存储一条新记忆。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR remember '{"key": "value"}' -t tag1,tag2 -i h
```

#### `get`  
获取与某主题相关的记忆（搜索实体、标签及内容）。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR get authentication
```

#### `search`  
在全部记忆中全文搜索。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR search "database migration"
```

#### `recall`  
按多种条件检索记忆。  
```bash
# Get full memory by ID
python3 $SKILL_PATH/memory.py -p $DIR recall -i abc123

# Get memories by tag
python3 $SKILL_PATH/memory.py -p $DIR recall -t architecture

# Get last N memories
python3 $SKILL_PATH/memory.py -p $DIR recall --last 5

# Overview of all memories
python3 $SKILL_PATH/memory.py -p $DIR recall
```

### 更新命令

#### `update`  
修改现有记忆。  
```bash
# Replace content
python3 $SKILL_PATH/memory.py -p $DIR update <id> '{"new": "content"}'

# Merge content (add to existing)
python3 $SKILL_PATH/memory.py -p $DIR update <id> '{"extra": "field"}' -m

# Change importance
python3 $SKILL_PATH/memory.py -p $DIR update <id> -i c

# Update tags
python3 $SKILL_PATH/memory.py -p $DIR update <id> -t newtag1,newtag2
```

#### `evolve`  
添加演进备注，追踪随时间的变化。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR evolve <id> "User changed preference to dark mode"
```

#### `forget`  
删除一条记忆（谨慎使用）。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR forget <id>
```

### 实体命令

#### `entities`  
列出全部已抽取实体及其出现次数。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR entities
```

#### `entity`  
获取特定实体的详细信息。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR entity authentication
```

### 分支命令

#### `branches`  
列出全部含记忆数量的分支。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR branches
```

#### `merge-branch`  
从另一分支合并记忆（在 git merge 后运行）。  
```bash
python3 $SKILL_PATH/memory.py -p $DIR merge-branch feature-auth
```

## 分支感知

### 工作原理

- 每个 git 分支拥有 **独立的记忆存储空间**  
- 新建分支 **自动继承** 自 main/master  
- git merge 后，运行 `merge-branch` 合并记忆  

### 分支工作流

```
1. User on main branch → memories stored in refs/notes/mem-main
2. User creates feature branch → auto-inherits main's memories
3. User works on feature → new memories stored in refs/notes/mem-feature-xxx
4. After git merge → run merge-branch to combine memories
```

## 记忆类型（自动识别）

系统根据内容自动分类记忆：

| 类型 | 触发词 |
|------|--------|
| `decision` | decided（已决定）、chose（已选择）、picked（已挑选）、selected（已选定）、opted（已选用）、going with（采用） |
| `preference` | prefer（偏好）、favorite（最爱）、like best（最喜爱）、rather（更倾向）、better to（更适合） |
| `learning` | learned（已学习）、studied（已研习）、understood（已理解）、realized（已意识到）、discovered（已发现） |
| `task` | todo（待办）、task（任务）、need to（需要）、plan to（计划）、next step（下一步）、going to（即将） |
| `question` | wondering（好奇）、curious（感兴趣）、research（研究）、investigate（调查）、find out（查明） |
| `note` | noticed（注意到）、observed（观察到）、important（重要）、remember that（记住这点） |
| `progress` | completed（已完成）、finished（已结束）、done（已完成）、achieved（已达成）、milestone（里程碑） |
| `info` | （未分类内容的默认类型） |

## 实体抽取

为实现智能检索，实体自动抽取如下：

- **显式字段：** `topic`、`subject`、`name`、`category`、`area`、`project`  
- **标签（Hashtags）：** `#cooking`、`#urgent`、`#v2`  
- **引号内短语：** `"machine learning"`、`"user authentication"`  
- **大写单词：** `React`、`PostgreSQL`、`Monday`  
- **关键词：** 有意义的词汇（常见词已被过滤）  

## 应记忆内容

**应记忆：**  
- 用户决策及其依据  
- 明确表达的偏好（编码风格、沟通方式、工具）  
- 项目架构与约束条件  
- 影响后续工作的关键上下文  
- 任务、阻碍与进展  
- 纠正（“实际上，我的意思是……” → 高重要性）  
- 明确要求记住的内容 → 关键重要性  

**不应记忆：**  
- 无关紧要的对话  
- 可轻易从代码推导的信息  
- 密码、API 密钥等机密信息  
- 一次性提问且无未来相关性的问题  
- 已存储的重复信息  

## 输出格式参考

### 第 0 层：sync --start  
```json
{
  "b": "feature-auth",                    // Current branch
  "t": {"auth": 5, "api": 3, "db": 2},   // Topics with counts
  "c": [{"id": "x", "s": "summary", "t": "preference"}],  // Critical
  "n": 15,                                // Total count
  "h": [{"id": "y", "s": "summary"}]     // High importance
}
```

### 第 1 层：get/search  
```json
{
  "topic": "auth",
  "mem": [
    {"id": "abc", "s": "decided OAuth2", "t": "decision", "i": "h", "b": "main"}
  ]
}
```

### 第 2 层：recall -i <id>  
```json
{
  "d": {"decision": "Use OAuth2"},  // Full data
  "e": ["auth", "oauth2"],          // Entities
  "t": "decision",                   // Type
  "g": ["architecture"],             // Tags
  "i": "h",                          // Importance
  "b": "main",                       // Branch
  "c": "2024-01-15T10:30:00",       // Created
  "u": "2024-01-15T10:30:00",       // Updated
  "a": 3,                            // Access count
  "ev": [{"n": "note", "t": "..."}] // Evolution notes (if any)
}
```

## 示例静默流程

```
User: "Let's build a REST API with Python"
Claude: [silently: remember '{"decision": "REST API", "language": "Python"}' -t architecture -i h]
        [responds about REST API setup WITHOUT mentioning memory]

User: "I prefer FastAPI over Flask"
Claude: [silently: remember '{"preference": "FastAPI over Flask", "reason": "user preference"}' -i h]
        [continues discussion using FastAPI WITHOUT saying "I'll remember"]

User: "What did we decide about the API?"
Claude: [silently: get api]
        [uses retrieved context to answer accurately]

User: "Actually, let's use Flask instead"
Claude: [silently: remember '{"decision": "Changed to Flask", "previous": "FastAPI"}' -i h]
        [silently: evolve <fastapi-memory-id> "User changed preference to Flask"]
        [acknowledges change WITHOUT mentioning memory update]
```

## 故障排除

**未找到记忆：**  
- 使用 `search` 尝试不同关键词  
- 检查 `entities` 查看已索引内容  
- 使用 `recall --last 10` 查看最近记忆  

**上下文似乎陈旧：**  
- 每次会话开始时务必运行 `sync --start`  
- 使用 `branches` 检查当前分支  

**Git 操作后：**  
- 执行 `git merge` 后：运行 `merge-branch <source-branch>`  
- 执行 `git checkout` 后：`sync --start` 将加载正确的分支上下文  