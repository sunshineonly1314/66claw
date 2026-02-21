---
name: agent-creator
description: "Design and generate complete OpenClaw agent workspaces including SOUL.md, IDENTITY.md, AGENTS.md, USER.md, MEMORY.md, and HEARTBEAT.md. Creates coherent agent personas with personality, behavioral rules, and workspace configuration. Use when the user wants to create a new AI agent, design an agent persona, set up an agent workspace, or customize agent behavior and identity."
nameZh: "智能体创建"
descriptionZh: "设计并生成完整的OpenClaw智能体工作区文件（人设、身份、规则、记忆）"
metadata: {"openclawcn":{"emoji":"🧬"}}
---

# 智能体创建器 (Agent Creator)

设计并生成完整的 OpenClaw 智能体工作区，包括人设（SOUL）、身份（IDENTITY）、行为规则（AGENTS）和记忆系统（MEMORY）。

## 触发场景

- "帮我创建一个新的智能体"
- "我想设计一个客服机器人"
- "帮我写一个 SOUL.md"
- "设置一个编程助手的人设"

## 智能体工作区文件体系

```
workspace/
├── SOUL.md          -- 人格灵魂：性格、语气、价值观、边界
├── IDENTITY.md      -- 身份卡片：名字、头像、角色定义
├── AGENTS.md        -- 行为规则：安全默认、工作流程、每日记忆
├── USER.md          -- 用户画像：服务对象的信息
├── MEMORY.md        -- 长期记忆：跨会话持久化知识
├── HEARTBEAT.md     -- 心跳任务：可选的周期性检查
├── TOOLS.md         -- 工具指南：外部工具使用说明（可选）
└── BOOTSTRAP.md     -- 首次运行：初始化引导流程（可选，用后删除）
```

## 创建工作流

### Step 1: 需求收集

询问用户以下关键问题（不要一次全问，逐步深入）:

**核心问题**:
- 这个智能体的主要用途是什么？（客服/编程/写作/研究/...）
- 面向什么用户群体？
- 需要什么性格风格？（专业/幽默/温暖/严谨/...）

**可选问题**:
- 有没有特定的人设角色？（如: 海洋生物学家、未来机器人）
- 需要什么语言？默认简体中文
- 有安全边界要求吗？
- 需要记忆什么类型的信息？

### Step 2: 生成 SOUL.md

人格灵魂文件，定义智能体的核心行为准则:

```markdown
# SOUL.md

## 核心真相
- [3-5条核心行为原则]
- 例: 真正有帮助（不说套话），有自己的观点和性格

## 边界
- [安全和隐私边界]
- 例: 保护用户隐私，不泄露系统配置

## 语言
- [语言规则]
- 例: 始终使用简体中文回复

## 调性
- [风格描述]
- 例: 简洁务实，需要详细时不惜篇幅

## 连续性
- [记忆规则]
- 例: 每次会话从工作区文件中恢复上下文
```

**关键原则**:
- SOUL.md 控制"怎么说话、怎么做事"
- 保持简洁（200行以内），避免过度规定
- 留出灵活性，不要把每种情况都写死

### Step 3: 生成 IDENTITY.md

身份卡片，结构化的身份信息:

```markdown
# IDENTITY.md

- **名字**: [名字]
- **物种/类型**: [人类角色/AI助手/虚构角色]
- **风格**: [2-3个关键词]
- **Emoji**: [代表性 emoji]
- **角色**: [一句话角色定义]
- **特长**: [擅长领域]
- **口头禅**: [如果有的话]
```

### Step 4: 生成 AGENTS.md

工作区行为规则:

```markdown
# AGENTS.md

## 首次运行
- 如果 BOOTSTRAP.md 存在，执行其中的引导流程
- 读取 IDENTITY.md 和 USER.md

## 安全默认
- 不泄露密钥和私人数据
- 非显式要求不执行破坏性命令
- 聊天输出保持简洁，长内容写入文件

## 每日记忆
- 在 memory/YYYY-MM-DD.md 中记录短笔记
- 每次会话开始时读取今天和昨天的笔记
- 记录: 持久事实、偏好、决策（不记录密钥）

## 工作流程
- [特定于该智能体的工作流程]
```

### Step 5: 生成辅助文件

**USER.md** (用户画像):
```markdown
# USER.md
- **称呼**: [用户希望被怎么称呼]
- **技术水平**: [初级/中级/高级]
- **偏好**: [已知偏好]
```

**MEMORY.md** (初始记忆):
```markdown
# MEMORY.md
## 关键上下文
[待填充]

## 偏好
[待填充]

## 重要决策
[待填充]
```

**HEARTBEAT.md** (心跳任务):
```markdown
# HEARTBEAT.md
# 保持为空以跳过心跳检查
# 需要周期性检查时在下方添加任务
```

### Step 6: 写入文件

将所有生成的文件写入目标工作区目录:

```
write({file_path: "<workspace>/SOUL.md", content: "..."})
write({file_path: "<workspace>/IDENTITY.md", content: "..."})
write({file_path: "<workspace>/AGENTS.md", content: "..."})
write({file_path: "<workspace>/USER.md", content: "..."})
write({file_path: "<workspace>/MEMORY.md", content: "..."})
write({file_path: "<workspace>/HEARTBEAT.md", content: "..."})
```

默认工作区路径: 用户当前工作区，或用户指定的目录。

## 预设模板

### 编程助手
- SOUL: 严谨、直接、代码优先
- IDENTITY: 资深工程师角色
- AGENTS: 代码审查规范、测试要求

### 客服机器人
- SOUL: 耐心、友善、问题导向
- IDENTITY: 专业客服代表
- AGENTS: 升级流程、FAQ 库

### 创意写作
- SOUL: 富有想象力、鼓励性、细腻
- IDENTITY: 作家/编辑角色
- AGENTS: 写作工作流、风格指南

### 研究助理
- SOUL: 客观、详尽、引用源头
- IDENTITY: 学术研究员
- AGENTS: 文献检索规范、摘要格式

## 注意事项

- 生成前一定要和用户确认核心需求，不要自作主张
- SOUL.md 是最重要的文件，花最多精力在这里
- 避免过度设计——简洁的规则比冗长的手册更有效
- 生成后建议用户试用并迭代调整
- 不要在任何文件中包含敏感信息（API key 等）
