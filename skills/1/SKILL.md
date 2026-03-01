---
name: 1
name_zh: 一
description: 基于 Ensue 构建的个人知识库，用于捕获与检索认知成果。当用户希望保存知识、回顾已有认知、管理工具集，或基于过往学习持续深化理解时使用。触发关键词包括：“保存这个”、“记住”、“我对 X 了解多少”、“加入工具箱”、“我关于 X 的笔记”、“存储这个概念”。
description_zh: 基于 Ensue 构建的个人知识库，用于捕获与检索认知成果。当用户希望保存知识、回顾已有认知、管理工具集，或基于过往学习持续深化理解时使用。触发关键词包括：“保存这个”、“记住”、“我对 X 了解多少”、“加入工具箱”、“我关于 X 的笔记”、“存储这个概念”。
metadata: {"clawdbot":{"emoji":"🧠","requires":{"env":["ENSUE_API_KEY"]},"primaryEnv":"ENSUE_API_KEY","homepage":"https://ensue-network.ai"}}
---
# 第二大脑（Second Brain）

一个用于**构建随时间复利增长的理解力**的个人知识库。它不是简单的笔记堆砌，而是一套结构化的系统，使您所积累的知识真正可检索、可复用。

## 设计理念

您的第二大脑应满足以下原则：
- **捕获的是理解，而非仅是事实** —— 为未来可能已遗忘上下文的自己而写  
- **确保可检索性** —— 结构清晰，便于在需要时快速定位  
- **保持常青（evergreen）** —— 不包含私人信息、凭证或有时效性的数据  
- **反映真实经验** —— 仅保存您实际学习过或使用过的知识  

保存前请自问：*未来的我会为此感谢现在的我吗？*

## 命名空间结构

```
public/                           --> Shareable knowledge
  concepts/                       --> How things work
    [domain]/                     --> Organize by topic
      [concept-name]              --> Individual concepts
  toolbox/                        --> Tools and technologies
    _index                        --> Master index of tools
    [category]/                   --> Group by type
      [tool-name]                 --> Individual tools
  patterns/                       --> Reusable solutions
    [domain]/                     --> Design patterns, workflows
  references/                     --> Quick-reference material
    [topic]/                      --> Cheatsheets, syntax, APIs

private/                          --> Personal only
  notes/                          --> Scratchpad, drafts
  journal/                        --> Dated reflections
```

**典型领域示例：** `programming`、`devops`、`design`、`business`、`data`、`security`、`productivity`

## 内容格式

### 概念（Concepts）

用于阐释某事物的工作原理：

```
CONCEPT NAME
============

What it is:
[One-line definition]

Why it matters:
[What problem it solves, when you'd need it]

How it works:
[Explanation with examples]
[ASCII diagrams for architecture/flows where helpful]

+----------+      +----------+
| Client   | ---> | Server   |
+----------+      +----------+

Key insight:
[The "aha" moment - what makes this click]

Related: [links to related concepts]
```

### 工具箱条目（Toolbox Entries）

用于记录您实际使用过的工具与技术：

```
TOOL NAME

Category: [category]
Website: [url]
Cost: [free/paid/freemium]

What it does:
[Brief description]

Why I use it:
[Personal experience - what problem it solved for you]

When to reach for it:
[Scenarios where this is the right choice]

Quick start:
[Minimal setup/usage to get going]

Gotchas:
[Things that tripped you up]
```

### 模式（Patterns）

用于归纳可复用的解决方案：

```
PATTERN NAME

Problem:
[What situation triggers this pattern]

Solution:
[The approach, with code/pseudocode if relevant]

Trade-offs:
[Pros and cons, when NOT to use it]

Example:
[Concrete implementation]
```

### 参考资料（References）

用于存放需快速查阅的材料：

```
REFERENCE: [TOPIC]

[Organized, scannable content]
[Tables, lists, code snippets]
[Minimal prose, maximum signal]
```

## 交互规则

### 保存知识

保存前务必确认：
1. “是否将此内容保存至您的第二大脑？”  
2. 展示即将保存内容的草稿  
3. 在获得确认后执行保存  
4. 保存完成后，告知用户已保存的内容及其位置  

### 检索知识

当相关主题出现时：
- 搜索已有知识  
- 呈现关联的概念  
- 将新学习内容与既有理解建立连接  

### 维护质量

保存前须核查：
- 是否为“已遗忘上下文的未来自己”而撰写  
- 是否阐明了“为何如此（WHY）”，而不仅是“是什么（WHAT）”  
- 是否包含具体实例  
- 是否未包含凭证、API 密钥或私有路径  
- 是否采用利于检索的结构组织  

## 反模式（Anti-Patterns）

1. **禁止自动保存** —— 必须始终先征得用户同意  
2. **禁止保存未使用的工具** —— 仅收录实际使用过的工具  
3. **禁止保存尚未充分理解的概念** —— 先学习，再保存  
4. **禁止包含密钥** —— 不得保存 API 密钥、密码或令牌  
5. **禁止创建浅层条目** —— 若无法清晰阐释，切勿保存  
6. **禁止重复创建** —— 保存前先检查是否已存在，必要时更新而非新建  

## API 使用方式

请使用封装脚本：

```bash
{baseDir}/scripts/ensue-api.sh <method> '<json_args>'
```

### 支持的操作

**搜索知识：**  
```bash
{baseDir}/scripts/ensue-api.sh discover_memories '{"query": "how does X work", "limit": 5}'
```

**按命名空间列出条目：**  
```bash
{baseDir}/scripts/ensue-api.sh list_keys '{"prefix": "public/concepts/", "limit": 20}'
```

**获取特定条目：**  
```bash
{baseDir}/scripts/ensue-api.sh get_memory '{"key_names": ["public/concepts/programming/recursion"]}'
```

**创建新条目：**  
```bash
{baseDir}/scripts/ensue-api.sh create_memory '{"items":[
  {"key_name":"public/concepts/domain/name","description":"Short description","value":"Full content","embed":true}
]}'
```

**更新已有条目：**  
```bash
{baseDir}/scripts/ensue-api.sh update_memory '{"key_name": "public/toolbox/_index", "value": "Updated content"}'
```

**删除条目：**  
```bash
{baseDir}/scripts/ensue-api.sh delete_memory '{"key_name": "public/notes/old-draft"}'
```

## 工具箱索引

请将 `public/toolbox/_index` 作为主参考索引维护：

```
TOOLBOX INDEX
=============

Categories:
  languages/      Programming languages
  frameworks/     Libraries and frameworks
  devtools/       Development utilities
  infrastructure/ Deployment, hosting, CI/CD
  productivity/   Workflow and productivity tools
  data/           Databases, analytics, data tools

Recent additions:
  [tool] - [one-line description]

Browse: "show my toolbox" or "what tools do I have for [category]"
```

## 意图映射（Intent Mapping）

| 用户表达 | 对应操作 |
|-----------|--------|
| “保存这个”、“记住这个” | 起草条目 → 请求确认 → 保存 |
| “我对 X 了解多少” | 搜索并返回相关条目 |
| “将 [工具] 加入工具箱” | 创建工具箱条目 |
| “列出我的 [领域] 概念” | 对该命名空间调用 list_keys |
| “显示我的工具箱” | 展示工具箱索引 |
| “更新 [条目]” | 获取条目 → 展示差异 → 更新 |
| “删除 [条目]” | 请求确认 → 删除 |
| “搜索 [主题]” | 在全部知识中执行语义搜索 |

## 初始化设置

需配置 `ENSUE_API_KEY` 环境变量。

获取密钥地址：https://www.ensue-network.ai/dashboard

在 clawdbot.json 中配置如下：
```json
"skills": {
  "entries": {
    "second-brain": {
      "apiKey": "your-ensue-api-key"
    }
  }
}
```

## 安全规范

- **绝不** 记录或显示 API 密钥  
- **绝不** 在知识条目中存储凭证、令牌或密钥  
- **绝不** 包含个人文件路径或系统细节  