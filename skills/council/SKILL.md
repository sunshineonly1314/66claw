---
name: council
name_zh: 议事会
description: 借助 Memory Bridge 实现的议会厅（Council Chamber）编排能力。单次会话、多角色参与、结构化审议。
description_zh: 借助 Memory Bridge 实现的议会厅（Council Chamber）编排能力。单次会话、多角色参与、结构化审议。
metadata: {"clawdbot":{"emoji":"🏛️","requires":{"bins":["sqlite3"]},"features":{"memory_bridge":true,"chamber_pattern":true}}}
---
# Council — 议会厅编排模式

不启动彼此隔离的 agent 实例，而是创建一个**议会厅（Council Chamber）**，让多位专家角色在单次会话中协同审议，实现观点交叉启发，并输出统一的审议记录。

## 前置条件

- SQLite3（用于成员数据库）
- Graphiti 服务（Memory Bridge）
- Clawdbot 网关（sessions_spawn）

## 初始化设置

初始化议会数据库：
```bash
bash command:"{baseDir}/init-db.sh"
```

## 🏛️ 议会厅模式（The Chamber Pattern）

**传统方式**（孤立式 Silos）：
- 启动 3 个独立的 agent
- 各自独立分析
- 无观点交叉启发
- 输出碎片化

**议会厅方式**（会议厅模式）：
- 单次 agent 会话
- 协调多个 persona 角色
- 结构化轮次发言机制
- 输出统一的审议记录

## 工具

### council_chamber  
启动一次议会厅会话（推荐使用）。

**用法：**  
```bash
bash command:"
TOPIC='YOUR_TOPIC'
MEMBERS='architect,analyst,security'

{baseDir}/references/chamber-orchestrator.sh \"\$TOPIC\" \"\$MEMBERS\"
"
```

**功能说明：**  
1. 获取 Graphiti 上下文（Memory Bridge）  
2. 从数据库加载成员 persona  
3. 构建含轮次结构的议会任务  
4. 创建会话记录  
5. 输出供 sessions_spawn 使用的任务

### council_list_members  
列出所有已注册成员。

**用法：**  
```bash
bash command:"sqlite3 -header -column ~/.clawdbot/council.db 'SELECT id, name, role FROM council_members'"
```

### council_add_member  
注册新成员。

**用法：**  
```bash
bash command:"
sqlite3 ~/.clawdbot/council.db \"
INSERT INTO council_members (id, name, role, system_message, expertise)
VALUES ('MEMBER_ID', 'NAME', 'ROLE', 'SYSTEM_MESSAGE', 'EXPERTISE');
\""
```

## 议会厅会话结构

**三轮审议（3-Turn Deliberation）：**

1. **第一轮：初步分析**  
   - 每位 persona 提供其独特视角  
   - 各自声音保持鲜明可辨  

2. **第二轮：交叉启发**  
   - 成员相互评述对方观点  
   - 实时回应  
   - 开展良性辩论  

3. **第三轮：综合归纳**  
   - 寻求共识基础  
   - 解决分歧点  
   - 向用户提供执行摘要（Executive Summary）

## 默认成员

| ID | 名称 | 角色 |
|----|------|------|
| architect | 系统架构师 | 技术设计 |
| analyst | 技术分析师 | 研究与分析 |
| security | 安全官 | 风险评估 |
| designer | 用户体验设计师 | 用户体验 |
| strategist | 商业战略师 | 投资回报率与战略 |

## 示例

```bash
# User: "Start council on Salesforce integration"
council_chamber topic:"Salesforce Integration" members:"architect,strategist"

# Output:
# 🏛️ Convening Council Chamber...
# 🧠 Memory Bridge: [Retrieved 10 facts about Salesforce]
# 👥 Loaded 2 personas
# ✅ Chamber Task ready for sessions_spawn
```

**优势：**  
- ✅ 观点交叉启发（成员彼此响应）  
- ✅ 单一记录文件（一个 .jsonl 文件）  
- ✅ 共享上下文（Memory Bridge 仅加载一次）  
- ✅ 结构化输出（三轮审议流程）