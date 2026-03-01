---
name: prd
name_zh: 产品需求文档
description: 创建并管理产品需求文档（PRD）。适用场景：（1）创建含用户故事的结构化任务清单；（2）以验收标准明确功能规格；（3）为 AI agents 或人类开发者规划功能实现。
description_zh: 创建并管理产品需求文档（PRD）。适用场景：（1）创建含用户故事的结构化任务清单；（2）以验收标准明确功能规格；（3）为 AI agents 或人类开发者规划功能实现。
author: Benjamin Jesuiter <bjesuiter@gmail.com>
metadata:
  clawdbot:
    emoji: "📋"
    os: ["darwin", "linux"]
---
# PRD skill

为功能规划创建并管理产品需求文档（PRD）。

## 什么是 PRD？

**PRD（Product Requirements Document，产品需求文档）** 是一种结构化规范，其作用包括：

1. 将一项功能拆解为**若干小型、相互独立的用户故事**
2. 为每个用户故事定义**可验证的验收标准**
3. 按**依赖关系**对任务排序（数据模型 → 后端 → UI）

## 快速入门

1. 在项目中创建/编辑 `agents/prd.json`  
2. 定义带验收标准的用户故事  
3. 通过更新 `passes: false` → `true` 跟踪进度  

## prd.json 格式

```json
{
  "project": "MyApp",
  "branchName": "ralph/feature-name",
  "description": "Short description of the feature",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add priority field to database",
      "description": "As a developer, I need to store task priority.",
      "acceptanceCriteria": [
        "Add priority column: 'high' | 'medium' | 'low'",
        "Generate and run migration",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `project` | 用于上下文的项目名称 |
| `branchName` | 此功能对应的 Git 分支（须以 `ralph/` 开头） |
| `description` | 功能的一行摘要说明 |
| `userStories` | 待完成的用户故事列表 |
| `userStories[].id` | 唯一标识符（如 US-001、US-002） |
| `userStories[].title` | 简明描述性标题 |
| `userStories[].description` | “作为 [用户]，我希望 [功能]，以便 [收益]” |
| `userStories[].acceptanceCriteria` | 可验证的检查项清单 |
| `userStories[].priority` | 执行顺序（1 表示最先执行） |
| `userStories[].passes` | 完成状态（初始为 `false`，完成后改为 `true`） |
| `userStories[].notes` | 由 agent 添加的运行时备注 |

## 用户故事规模控制

**每个用户故事应能在单次上下文窗口内完成。**

### ✅ 规模适中：
- 新增数据库列及其迁移脚本  
- 在现有页面中添加一个 UI 组件  
- 使用新逻辑更新服务端动作  
- 在列表中添加筛选下拉框  

### ❌ 规模过大（需拆分）：
- “构建整个仪表盘” → 应拆分为：数据模型、查询逻辑、UI、筛选功能  
- “添加身份认证” → 应拆分为：数据模型、中间件、登录 UI、会话管理  

## 用户故事排序

用户故事按优先级顺序执行；前置故事**不得依赖**后置故事。

**正确顺序为：**  
1. 数据模型/数据库变更（迁移脚本）  
2. 服务端动作 / 后端逻辑  
3. 依赖后端的 UI 组件  
4. 仪表盘/汇总视图  

## 验收标准

必须具备可验证性，不可模糊笼统。

### ✅ 良好示例：
- “在 tasks 表中新增 `status` 列，默认值为 'pending'”  
- “筛选下拉框包含选项：全部、进行中、已完成”  
- “类型检查通过”  

### ❌ 不良示例：
- “正常工作”  
- “用户能轻松完成 X”  

**务必包含：** `"Typecheck passes"`  

## 进度跟踪

用户故事完成后，请更新 `passes: true`；使用 `notes` 字段记录运行时观察结果：

```json
"notes": "Used IF NOT EXISTS for migrations"
```

## 快速参考

| 操作 | 命令 |
|------|------|
| 创建 PRD | 保存至 `agents/prd.json` |
| 查看状态 | `cat prd.json | jq '.userStories[] | {id, passes}'` |
| 查看未完成项 | `jq '.userStories[] | select(.passes == false)' prd.json` |

## 相关资源

详见 `references/` 的完整文档：  
- `agent-usage.md` —— AI agents 如何执行 PRD（Claude Code、OpenCode 等）  
- `workflows.md` —— 顺序式工作流模式  
- `output-patterns.md` —— 模板与示例  