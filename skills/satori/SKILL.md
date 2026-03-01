---
name: satori
name_zh: Satori
description: |
description_zh: |
  为 AI 会话在不同服务商及代码生成工具之间提供持久化的长期记忆，保障上下文连续性。
  
  触发条件 —— 当出现以下情形之一时，激活本 skill：
  - 用户明确提及 “satori”、“记住这个”、“保存”、“添加”、“稍后保存这个”、“存储这个”、“添加至记忆”
  - 用户请求回顾或搜索过往决策：“我们之前决定什么了？”、“提醒我一下”、“搜索我的笔记”、“我对……了解多少？”
  - 对话中出现值得持久化的重要事实：决策、偏好、截止日期、名称、技术栈选型、战略方向等
  - 开启新对话时，主动检索上下文可能带来帮助
  - 当用户提问时，使用 Satori 搜索功能

---
# Satori CLI 集成

Satori 跨 AI 应用持久化存储重要信息，同时存入向量数据库与知识图谱数据库，便于后续检索。

## 环境要求

**适用平台：** Claude Code、Cursor、Windsurf，或任何具备本地终端访问能力的 AI 工具。

## 身份认证

CLI 在首次运行时自动完成配置：
- 检查 `~/.config/satori/satori.json` 是否存在 API 密钥与记忆 ID
- 若缺失，则自动创建该文件并生成新凭据
- 无需手动配置

## CLI 命令

**保存事实：**
```bash
npx -y @satori-sh/cli@latest add "<facts>"
```

**搜索上下文：**
```bash
npx -y @satori-sh/cli@latest search "<query>"
```

## 工作流：主动式搜索

当对话开始时，若用户消息暗示已有上下文将有助于理解：

1. 从用户首条消息中提取关键实体或主题
2. 使用相关查询执行搜索命令
3. 解析 JSON 响应，提取相关事实
4. 静默地将检索到的上下文融入回复中
5. 除非检索结果显著影响回复内容，否则不得声明“我已搜索 Satori”

**解析搜索结果：**
CLI 返回 JSON 格式数据。请提取其中相关事实，并将其作为上下文使用：
```bash
npx -y @satori-sh/cli search "Flamingo project tech stack"
# Returns JSON with matching facts - parse and incorporate naturally
```

主动搜索的典型触发场景：
- “让我们继续推进 [项目]”
- “[某事项] 当前状态如何？”
- 提及过往决策但未提供完整上下文
- 出现项目名、公司名、人名等专有名词

## 工作流：保存事实

### 何时保存

在自然停顿点进行保存：
- 决策讨论结束时
- 用户明确提出请求（如“记住这个”、“保存这个”）
- 明确确立具体偏好、名称、日期、截止期限后
- 建立重要项目上下文后

### 保存内容

详细保存准则请参阅 `references/fact-criteria.md`。

**应保存** —— 重要且具有持久价值的信息：
- 决策：“数据库选用 PostgreSQL”
- 技术偏好：“用户偏好在所有 JavaScript/TypeScript 项目中使用 Bun 运行时，而非 Node.js”
- 名称/品牌：“公司名为 Flamingo，主营粉色饼干”
- 日期/截止期限：“MVP 截止日期为 3 月 15 日”
- 架构选择：“采用微服务架构，结合事件溯源机制”
- 战略方向：“优先面向企业客户”
- 关键联系人：“Sarah 担任设计负责人”
- 项目背景：“Satori 是一家构建 AI 记忆基础设施的公司”

**不应保存** —— 临时性、细粒度或显而易见的信息：
- 进行中的反馈：“配色方案还需优化”
- Claude 提供的解释或代码片段
- 临时调试上下文
- 可从上下文中直接推导出的通用偏好
- 对话填充语（如寒暄、确认语等）

### 保存执行流程

1. 从对话中提取重要事实（参照上述准则）
2. 以自然语言格式组织，将相关事实批量整合
3. 执行 CLI 命令
4. 成功时：静默继续（即“即发即弃” fire-and-forget）
5. 失败时：向用户通知具体错误

**批量处理：** API 支持批量提交，因此较长的自然语言文本亦可接受：
```bash
npx -y @satori-sh/cli add "User is building Satori, an AI memory infrastructure company. Tech stack: TypeScript, Bun, PostgreSQL. Deadline for MVP is March 15. Targeting developer tools market initially."
```

## 错误处理

若 CLI 执行失败或尚未安装：
```
⚠️ Satori CLI error: [error message]
To install: npm install -g @satori-sh/cli
Facts were not saved. Would you like me to show what I attempted to save?
```

## 事实表述规范

请以清晰、独立、自包含的语句书写事实，确保其日后被单独检索时仍能准确传达含义：

**良好示例：** “Satori 项目主存储使用 PostgreSQL，知识图谱使用 FalkorDB”
**不良示例：** “使用 Postgres 和 FalkorDB”

**良好示例：** “用户偏好在所有 JavaScript/TypeScript 项目中使用 Bun 运行时，而非 Node.js”
**不良示例：** “Bun 而非 Node”