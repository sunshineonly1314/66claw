---
name: asana
name_zh: Asana
description: "通过 Asana REST API 将 Asana 与 Clawdbot 集成。适用于需要列出/搜索/创建/更新 Asana 任务/项目/工作区的场景，或为个人本地专用集成（OOB/手动粘贴授权码）配置 Asana OAuth（授权码模式）的情形。"
description_zh: 通过 Asana REST API 将 Asana 与 Clawdbot 集成。适用于需要列出/搜索/创建/更新 Asana 任务/项目/工作区的场景，或为个人本地专用集成（OOB/手动粘贴授权码）配置 Asana OAuth（授权码模式）的情形。
---
# Asana（Clawdbot skill）

本 skill 面向 **个人本地专用** 的 Asana 集成设计，采用基于 **OAuth** 的 **带外（OOB）/手动粘贴授权码** 流程。

## 本 skill 提供的功能
- 一个轻量级 Node CLI 工具，支持：
  - 生成 Asana 授权 URL；
  - 使用授权码换取访问令牌（access token）和刷新令牌（refresh token）；
  - 自动刷新访问令牌；
  - 执行基础 API 调用（例如：`/users/me`、`/workspaces`、tasks）。

## 配置步骤（OAuth，OOB/手动粘贴）

### 0) 创建 Asana 应用
在 Asana 开发者控制台（My apps）中：
- 创建新应用；
- 启用你将用到的权限范围（典型组合：`tasks:read`、`tasks:write`、`projects:read`）；
- 将重定向 URI 设置为 OOB 值（手动粘贴授权码）：
  - `urn:ietf:wg:oauth:2.0:oob`

### 1) 提供凭据（两种方式）

**方式 A（Clawdbot 推荐）：** 保存至本地凭据文件：
```bash
node scripts/configure.mjs --client-id "..." --client-secret "..."
```  
该命令将写入 `~/.clawdbot/asana/credentials.json`。

**方式 B：** 设置环境变量（shell/session）：
- `ASANA_CLIENT_ID`  
- `ASANA_CLIENT_SECRET`  

### 2) 执行 OAuth 流程
从仓库根目录执行：

1) 打印授权 URL：
```bash
node scripts/oauth_oob.mjs authorize
```  
2) 在浏览器中打开打印出的 URL，点击 **Allow**，复制授权码；  
3) 使用授权码换取令牌并本地保存：
```bash
node scripts/oauth_oob.mjs token --code "PASTE_CODE_HERE"
```  

令牌将保存在：
- `~/.clawdbot/asana/token.json`  

## 聊天交互方式（同时支持显式命令 + 自然语言）

你可以选择以下任一方式：
- **显式命令**：消息开头以 `/asana ...` 起始；  
- **自然语言**：例如，“列出分配给我的任务”。

对于 Clawdbot，需实现映射逻辑，将用户请求翻译为对应的 `asana_api.mjs` 命令。

示例：
- `/asana tasks-assigned` → `tasks-assigned --assignee me`  
- “列出分配给我的任务” → `tasks-assigned --assignee me`  
- “列出项目 <project> 中的所有任务” → 先解析 `<project>` 得到 project gid，再执行 `tasks-in-project --project <gid>`  
- “列出截止日期在 2026-01-01 至 2026-01-15 之间的任务” → `search-tasks --assignee me --due_on.after 2026-01-01 --due_on.before 2026-01-15`  

（可选辅助）`scripts/asana_chat.mjs` 可将常见短语映射为命令模板。

## 使用 API 辅助工具

基础校验（我是谁）：
```bash
node scripts/asana_api.mjs me
```  

列出所有工作区：
```bash
node scripts/asana_api.mjs workspaces
```  

设置默认工作区（可选）：
```bash
node scripts/asana_api.mjs set-default-workspace --workspace <workspace_gid>
```  
设置后，在支持该参数的命令中即可省略 `--workspace`。

显式指定工作区列出项目：
```bash
node scripts/asana_api.mjs projects --workspace <workspace_gid>
```  
使用默认工作区列出项目：
```bash
node scripts/asana_api.mjs projects
```  

列出某项目中的任务：
```bash
node scripts/asana_api.mjs tasks-in-project --project <project_gid>
```  

列出分配给我的任务（Asana 要求必须指定工作区）：
```bash
node scripts/asana_api.mjs tasks-assigned --workspace <workspace_gid> --assignee me
```  
或使用默认工作区：
```bash
node scripts/asana_api.mjs tasks-assigned --assignee me
```  

搜索任务（高级搜索）：
```bash
node scripts/asana_api.mjs search-tasks --workspace <workspace_gid> --text "release" --assignee me
# also supports convenience: --project <project_gid>
```  

查看某任务：
```bash
node scripts/asana_api.mjs task <task_gid>
```  

标记某任务为已完成：
```bash
node scripts/asana_api.mjs complete-task <task_gid>
```  

更新某任务：
```bash
node scripts/asana_api.mjs update-task <task_gid> --name "New title" --due_on 2026-02-01
```  

为某任务添加评论：
```bash
node scripts/asana_api.mjs comment <task_gid> --text "Update: shipped"
```  

创建新任务：
```bash
node scripts/asana_api.mjs create-task --workspace <workspace_gid> --name "Test task" --notes "from clawdbot" --projects <project_gid>
```  

## 注意事项 / 常见陷阱
- OAuth 访问令牌会过期；系统使用刷新令牌自动获取新的访问令牌。  
- 若后续需支持多用户，应将 OOB 替换为真实的重定向/回调服务。  
- 切勿记录（log）任何令牌信息。