---
name: skills
description: |
  持久化长期记忆，保障 AI 会话在不同提供商及代码生成工具间的连续性。
  
  触发条件 —— 当出现以下情形时激活本 skill：
  - 用户明确提及 “satori”、“记住这个”、“保存”、“添加”、“稍后保存这个”、“存储这个”、“添加到记忆”  
  - 用户要求回顾/搜索过往决策：“我们之前决定什么？”、“提醒我”、“搜索我的笔记”、“我对 X 了解多少？”  
  - 对话中包含值得持久化的显著事实：决策、偏好、截止日期、姓名、技术栈选择、战略方向  
  - 开启新对话时，主动检索上下文将有助于推进  
  - 当用户提问时，使用 Satori 搜索
---

# Satori CLI 集成

Satori 在各类 AI 应用间持久化重要信息。它将事实同时存入向量数据库与知识图谱数据库，以供后续检索。

## 环境要求

**支持平台：** Claude Code、Cursor、Windsurf，或任何具备本地终端访问能力的 AI 工具。

## 认证

CLI 在首次运行时自动配置：
- 检查 `~/.config/satori/satori.json` 是否存在 API 密钥与记忆 ID  
- 若缺失，则自动创建该文件并配置新凭证  
- 无需手动设置  

## CLI 命令

**保存事实：**  
```bash
npx -y @satori-sh/cli@latest add "<facts>"
```

**搜索上下文：**  
```bash
npx -y @satori-sh/cli@latest search "<query>"
```

## 工作流：主动搜索

在对话起始时，若用户消息暗示已有上下文将有助推进：

1. 从用户首条消息中提取关键实体/主题  
2. 运行搜索命令，传入相关查询  
3. 解析 JSON 响应，提取相关事实  
4. 静默地将检索到的上下文融入响应  
5. **除非结果显著影响响应，否则切勿声明“我已搜索 Satori”**

**解析搜索结果：**  
CLI 返回 JSON。提取相关事实并将其作为上下文使用：  
```bash
npx -y @satori-sh/cli search "Flamingo project tech stack"
# Returns JSON with matching facts - parse and incorporate naturally
```

主动搜索的典型触发场景：
- “让我们继续推进 [项目]”  
- “[某事物] 的当前状态如何？”  
- 提及过往决策但未提供完整上下文  
- 项目名称、公司名称、人名  

## 工作流：保存事实

### 何时保存

在自然断点处保存：
- 决策讨论结束时  
- 用户明确要求时（“记住这个”、“保存这个”）  
- 明确确立具体偏好、姓名、日期、截止日期后  
- 显著项目上下文确立后  

### 保存内容

详见 `references/fact-criteria.md` 中的详细标准。

**应保存（SAVE）** —— 显著、持久的信息：
- 决策：“数据库使用 PostgreSQL”  
- 技术偏好：“用户偏好 Bun 而非 Node”  
- 名称/品牌：“公司名为 Flamingo，生产粉色饼干”  
- 日期/截止日期：“MVP 截止日期为 3 月 15 日”  
- 架构选择：“采用事件溯源的微服务架构”  
- 战略方向：“优先面向企业客户”  
- 关键联系人：“Sarah 是设计负责人”  
- 项目上下文：“Satori 是一家 AI 记忆基础设施公司”  

**不应保存（DO NOT SAVE）** —— 短暂、细粒度或显而易见的信息：
- 进行中的反馈：“配色方案还需调整”  
- Claude 的解释或代码片段  
- 临时调试上下文  
- 可从上下文中推导出的通用偏好  
- 对话填充语  

### 保存执行

1. 从对话中提取显著事实（参见标准）  
2. 以自然语言格式化，将相关事实批量组合  
3. 执行 CLI 命令  
4. 成功时：静默继续（即发即弃）  
5. 失败时：向用户通知错误  

**批处理：** API 支持批处理，因此较长的自然语言文本亦可接受：  
```bash
npx -y @satori-sh/cli add "User is building Satori, an AI memory infrastructure company. Tech stack: TypeScript, Bun, PostgreSQL. Deadline for MVP is March 15. Targeting developer tools market initially."
```

## 错误处理

若 CLI 失败或未安装：  
```
⚠️ Satori CLI error: [error message]
To install: npm install -g @satori-sh/cli
Facts were not saved. Would you like me to show what I attempted to save?
```

## 事实格式

以清晰、独立的陈述句书写事实。包含足够上下文，确保日后检索时仍能理解：

**良好示例：** “Satori 项目使用 PostgreSQL 作为主存储，FalkorDB 用于知识图谱”  
**不良示例：** “使用 Postgres 和 FalkorDB”

**良好示例：** “用户在所有 JavaScript/TypeScript 项目中均偏好 Bun 运行时而非 Node.js”  
**不良示例：** “Bun 不是 Node”