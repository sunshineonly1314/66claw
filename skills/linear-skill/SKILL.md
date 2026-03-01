---
name: linear-skill
name_zh: Linear 技能
description: 通过 Linear API 管理 Linear 项目、issue 和任务。适用于需要创建、更新、搜索或管理 Linear issue、项目、团队、里程碑、评论或标签的场景。支持全部 Linear 操作，包括项目管理、issue 跟踪、任务分配、状态转换及协作工作流。
description_zh: 通过 Linear API 管理 Linear 项目、issue 和任务。适用于需要创建、更新、搜索或管理 Linear issue、项目、团队、里程碑、评论或标签的场景。支持全部 Linear 操作，包括项目管理、issue 跟踪、任务分配、状态转换及协作工作流。
---
# Linear 项目管理

使用官方 Linear SDK 管理 Linear 项目、issue 和工作流。

## 快速开始

所有命令均使用 `skills/linear/scripts/linear-cli.js`：

```bash
node skills/linear/scripts/linear-cli.js <command> [args]
```

## 核心命令

### 团队与项目

**列出团队：**
```bash
node skills/linear/scripts/linear-cli.js teams
```

**列出项目：**
```bash
node skills/linear/scripts/linear-cli.js projects
```

**创建项目：**
```bash
node skills/linear/scripts/linear-cli.js createProject "Project Name" "Description" "teamId1,teamId2"
```

### Issue

**列出 issue：**
```bash
node skills/linear/scripts/linear-cli.js issues
# With filter:
node skills/linear/scripts/linear-cli.js issues '{"state":{"name":{"eq":"In Progress"}}}'
```

**获取 issue 详情：**
```bash
node skills/linear/scripts/linear-cli.js issue ENG-123
```

**创建 issue：**
```bash
node skills/linear/scripts/linear-cli.js createIssue "Title" "Description" "teamId"
# With options (priority, projectId, assigneeId, etc.):
node skills/linear/scripts/linear-cli.js createIssue "Title" "Description" "teamId" '{"priority":2,"projectId":"project-id"}'
```

**更新 issue：**
```bash
node skills/linear/scripts/linear-cli.js updateIssue "issueId" '{"stateId":"state-id","priority":1}'
```

### 评论

**添加评论：**
```bash
node skills/linear/scripts/linear-cli.js createComment "issueId" "Comment text"
```

### 状态与标签

**获取团队状态：**
```bash
node skills/linear/scripts/linear-cli.js states "teamId"
```

**获取团队标签：**
```bash
node skills/linear/scripts/linear-cli.js labels "teamId"
```

### 用户信息

**获取当前用户：**
```bash
node skills/linear/scripts/linear-cli.js user
```

## 参考资料

- **API.md**：优先级等级、筛选器示例及常见工作流  
- 当您需要复杂筛选器或工作流模式示例时，请阅读该文档

## 常见工作流

### 为特定项目创建任务

1. 获取您的团队 ID：`node skills/linear/scripts/linear-cli.js teams`  
2. 获取您的项目 ID：`node skills/linear/scripts/linear-cli.js projects`  
3. 使用上述 ID 创建 issue：

```bash
node skills/linear/scripts/linear-cli.js createIssue "Implement login" "Add OAuth login flow" "your-team-id" '{"projectId":"your-project-id","priority":2}'
```

### 将 issue 移至不同状态

1. 获取状态列表：`node skills/linear/scripts/linear-cli.js states "teamId"`  
2. 更新 issue：`node skills/linear/scripts/linear-cli.js updateIssue "issueId" '{"stateId":"state-uuid"}'`

### 将 issue 分配给自己

1. 获取您的用户 ID：`node skills/linear/scripts/linear-cli.js user`  
2. 更新 issue：`node skills/linear/scripts/linear-cli.js updateIssue "issueId" '{"assigneeId":"your-user-id"}'`

## 输出格式

所有命令均返回 JSON 格式。可根据程序化调用需求解析输出，或按需向用户展示。