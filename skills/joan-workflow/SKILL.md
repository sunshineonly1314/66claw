---
name: Joan 工作流
name_zh: Joan 工作流
description: 当用户提及“joan”、“pods”、“workspace”、“domain knowledge”、“context sync”、“joan init”、“joan todo”，或需要了解 Joan 知识管理系统工作原理时，应启用此 skill。它提供关于 pods、todos、plans 和 workspace 管理的工作流指导。
description_zh: 当用户提及“joan”、“pods”、“workspace”、“domain knowledge”、“context sync”、“joan init”、“joan todo”，或需要了解 Joan 知识管理系统工作原理时，应启用此 skill。它提供关于 pods、todos、plans 和 workspace 管理的工作流指导。
version: 0.1.0
---
# Joan 工作流

Joan 是一款面向工作区（workspace）的知识与任务管理系统，专为 AI 辅助开发而设计。本 skill 阐述了何时以及如何使用 Joan 的核心概念。

## 核心概念

### 工作区（Workspaces）

工作区是 Joan 中最高层级的组织单元。每个工作区包含以下要素：
- **Pods**：版本化的领域知识文档  
- **Todos**：限定于该工作区范围的任务  
- **Plans**：与 todos 关联的实施规范  
- **Members**：具有角色（管理员、成员）的团队成员  

### Pods

Pods 是版本化的 Markdown 文档，用于承载领域知识。请在以下场景中使用 pods：
- 记录项目架构与设计决策  
- 存储领域专属术语及业务规则  
- 在团队成员与 AI 助手之间共享知识  
- 维护随项目演进而持续更新的“活文档”

**Pod 生命周期：**  
1. 使用 `joan pod create` 在本地创建  
2. 在 `.joan/pods/` 中编辑 Markdown 文件  
3. 使用 `joan pod push` 推送到服务器  
4. 使用 `joan pod pull` 拉取最新版本  

### Todos

Todos 是限定于工作区范围的任务。请在以下场景中使用 todos：
- 跨团队成员追踪工作项  
- 分配任务并设定优先级  
- 将实施计划与具体任务关联  

**Todo 工作流：**  
1. 使用 `joan todo create` 创建  
2. 使用 `joan todo list` 列出  
3. 随工作进展及时更新状态  
4. 完成后归档  

### Plans

Plans 是与 todos 关联的实施规范。请在以下场景中使用 plans：
- 记录某项功能的具体实现方式  
- 将复杂任务拆解为若干步骤  
- 向团队共享实施思路  

## CLI 命令参考

### 项目初始化

```bash
joan init                    # Interactive workspace selection
joan init -w <workspace-id>  # Non-interactive with specific workspace
joan status                  # Show project and auth status
```

### Pod 管理

```bash
joan pod list               # List tracked pods
joan pod list --all         # List all workspace pods
joan pod add                # Add workspace pods to project
joan pod create             # Create new pod locally
joan pod pull               # Pull pods from server
joan pod push               # Push local pods to server
joan pod open               # Open pod in browser
```

### Todo 管理

```bash
joan todo list              # List todos for tracked pods
joan todo list --mine       # List todos assigned to me
joan todo create            # Create new todo
joan todo update <id>       # Update todo fields
joan todo archive <id>      # Archive completed todo
```

### Plan 管理

```bash
joan plan list <todo-id>    # List plans for a todo
joan plan create <todo-id>  # Create implementation plan
joan plan pull <todo-id>    # Pull plans from server
joan plan push <todo-id>    # Push plans to server
```

### 上下文生成

```bash
joan context claude         # Generate CLAUDE.md with Joan context
```

## 何时使用何者

### 启动新项目时

1. 运行 `joan init` 将项目接入工作区  
2. 选取与项目领域相关的 pods  
3. 运行 `joan context claude` 将上下文注入 CLAUDE.md  
4. 编码前通读生成的 pod 引用  

### 开发某项功能前

1. 检查相关 pods 是否已存在：`joan pod list --all`  
2. 补充缺失的 pods：`joan pod add`  
3. 拉取最新版本：`joan pod pull`  
4. 阅读 pods，理解领域上下文  

### 完成工作后

1. 思考是否应将新认知沉淀为 pod  
2. 更新或新建 todos，反映工作进展  
3. 推送本地变更：`joan pod push` 和 `joan todo push`  

### 记录新知识时

1. 创建 pod：`joan pod create`  
2. 以 Markdown 形式撰写领域知识  
3. 推送以共享：`joan pod push`  
4. 更新 CLAUDE.md 上下文：`joan context claude`  

## MCP 集成

Joan 在 `https://joan.land/mcp/joan` 提供 MCP 服务，含以下工具：
- `list_workspaces` —— 列出可访问的工作区  
- `list_pods` —— 列出某工作区内的 pods  
- `get_pod` —— 获取 pod 内容  

MCP 服务采用 OAuth 2.1 认证。请先通过 CLI 执行 `joan auth login` 完成认证。

## 项目配置

Joan 将项目配置存储于 `.joan/config.yaml`：

```yaml
workspace_id: <uuid>
tracked_pods:
  - name: "Pod Name"
    id: <uuid>
```

Pods 以 Markdown 文件形式本地存储于 `.joan/pods/`。

## 最佳实践

### Pod 编写

- 使用清晰、具描述性的标题  
- 注明该知识适用的场景与时机  
- 保持每个 pod 聚焦于单一领域概念  
- 知识演进时及时更新 pods  
- 必要时引用相关 pods  

### Todo 管理

- 创建粒度适中的 todos（不宜过大或过小）  
- 将 todos 与相关 pods 关联，提供上下文支撑  
- 及时更新状态，确保团队信息同步  
- 归档已完成 todos，降低信息噪音  

### 上下文同步

- 更改受跟踪 pods 后，运行 `joan context claude`  
- 开展重要工作前，先拉取 pods 最新版本  
- 及时推送变更，与团队共享成果  