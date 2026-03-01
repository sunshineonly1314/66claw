---
name: triple-memory
name_zh: 三元记忆
version: 1.0.0
description: 一套完整的记忆系统，融合 LanceDB 自动召回、Git-Notes 结构化记忆与基于文件的工作区搜索。适用于搭建全面的 agent 记忆、需要跨会话持久化上下文，或需协同多个记忆后端来管理决策/偏好/任务等场景。
description_zh: 一套完整的记忆系统，融合 LanceDB 自动召回、Git-Notes 结构化记忆与基于文件的工作区搜索。适用于搭建全面的 agent 记忆、需要跨会话持久化上下文，或需协同多个记忆后端来管理决策/偏好/任务等场景。
metadata:
  clawdbot:
    emoji: "🧠"
    requires:
      plugins:
        - memory-lancedb
      skills:
        - git-notes-memory
---
# Triple Memory 系统

一种综合性的记忆架构，整合三种互补系统，以实现跨会话的最大化上下文保留能力。

## 架构概览

```
User Message
     ↓
[LanceDB auto-recall] → injects relevant conversation memories
     ↓
Agent responds (using all 3 systems)
     ↓
[LanceDB auto-capture] → stores preferences/decisions automatically
     ↓
[Git-Notes] → structured decisions with entity extraction
     ↓
[File updates] → persistent workspace docs
```

## 三大系统

### 1. LanceDB（对话记忆）
- **自动召回**：在每次响应前注入相关记忆  
- **自动捕获**：自动存储偏好、决策、事实等信息  
- **工具**：`memory_recall`、`memory_store`、`memory_forget`  
- **触发词**：“remember”（记住）、“prefer”（偏好）、“my X is”（我的 X 是……）、“I like/hate/want”（我喜欢／讨厌／想要）

### 2. Git-Notes 记忆（结构化、本地）
- **分支感知**：记忆按 Git 分支隔离  
- **实体抽取**：自动提取主题、人名、概念等  
- **重要性等级**：critical（关键）、high（高）、normal（普通）、low（低）  
- **不调用任何外部 API**

### 3. 文件搜索（工作区）
- **搜索范围**：MEMORY.md、memory/*.md 及任意工作区文件  
- **脚本**：`scripts/file-search.sh`

## 设置步骤

### 启用 LanceDB 插件
```json
{
  "plugins": {
    "slots": { "memory": "memory-lancedb" },
    "entries": {
      "memory-lancedb": {
        "enabled": true,
        "config": {
          "embedding": { "apiKey": "${OPENAI_API_KEY}", "model": "text-embedding-3-small" },
          "autoRecall": true,
          "autoCapture": true
        }
      }
    }
  }
}
```

### 安装 Git-Notes 记忆模块
```bash
clawdhub install git-notes-memory
```

### 创建文件搜索脚本
将 `scripts/file-search.sh` 复制到您的工作区。

## 使用方法

### 会话启动时（始终执行）
```bash
python3 skills/git-notes-memory/memory.py -p $WORKSPACE sync --start
```

### 存储重要决策
```bash
python3 skills/git-notes-memory/memory.py -p $WORKSPACE remember \
  '{"decision": "Use PostgreSQL", "reason": "Team expertise"}' \
  -t architecture,database -i h
```

### 搜索工作区文件
```bash
./scripts/file-search.sh "database config" 5
```

### 对话记忆（自动执行）
LanceDB 自动处理该功能。如需手动操作，请使用以下工具：  
- `memory_recall "query"` —— 搜索对话记忆  
- `memory_store "text"` —— 手动存储某项内容  
- `memory_forget` —— 删除记忆（符合 GDPR 要求）

## 重要性等级

| 标记 | 等级 | 使用场景 |
|------|------|----------|
| `-i c` | 关键 | “始终记住”、明确表达的偏好 |
| `-i h` | 高 | 决策、修正、偏好设置 |
| `-i n` | 普通 | 一般性信息 |
| `-i l` | 低 | 临时笔记 |

## 各系统适用场景

| 系统 | 适用场景 |
|------|----------|
| **LanceDB** | 对话上下文、自动检索 |
| **Git-Notes** | 结构化决策、按实体/标签可检索 |
| **文件搜索** | 工作区文档、日常日志、MEMORY.md |

## 文件结构

```
workspace/
├── MEMORY.md              # Long-term curated memory
├── memory/
│   ├── active-context.md  # Current session state
│   └── YYYY-MM-DD.md      # Daily logs
├── scripts/
│   └── file-search.sh     # Workspace search
└── skills/
    └── git-notes-memory/  # Structured memory
```

## 静默运行

切勿向用户宣告记忆操作，仅静默执行即可：  
- ❌ “我会记住这个”  
- ❌ “正在保存至记忆”  
- ✅ （静默存储并继续）