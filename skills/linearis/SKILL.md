---
name: linearis
name_zh: Linearis
version: 1.0.0
description: Linear.app 的命令行工具（CLI），用于 issue 跟踪。可用于列出、创建、更新和搜索 Linear issue、评论、文档、周期（cycles）及项目。专为 LLM agents 优化，输出为 JSON 格式。
description_zh: Linear.app 的命令行工具（CLI），用于 issue 跟踪。可用于列出、创建、更新和搜索 Linear issue、评论、文档、周期（cycles）及项目。专为 LLM agents 优化，输出为 JSON 格式。
metadata: {"clawdbot":{"emoji":"📋","requires":{"bins":["linearis"]},"install":[{"id":"npm","kind":"node","package":"linearis","bins":["linearis"],"label":"Install linearis (npm)"}]}}
---
# linearis

面向 [Linear.app](https://linear.app) 的命令行工具（CLI），输出 JSON 格式，专为 LLM agents 设计。

## 设置

```bash
npm install -g linearis
```

认证方式（任选其一）：
- `echo "lin_api_..." > ~/.linear_api_token`（推荐）
- `export LINEAR_API_TOKEN="lin_api_..."`
- `--api-token <token>` 标志

获取 API 密钥：Linear 设置 → 安全与访问 → 个人 API 密钥

## 命令

### Issue

```bash
linearis issues list -l 20              # List recent issues
linearis issues list -l 10 --team WHO   # Filter by team
linearis issues search "bug"            # Full-text search
linearis issues read ABC-123            # Get issue details
linearis issues create --title "Fix bug" --team WHO --priority 2
linearis issues update ABC-123 --status "Done"
linearis issues update ABC-123 --title "New title" --assignee user123
linearis issues update ABC-123 --labels "Bug,Critical" --label-by adding
linearis issues update ABC-123 --parent-ticket EPIC-100  # Set parent
```

### 评论

```bash
linearis comments create ABC-123 --body "Fixed in PR #456"
```

### 文档

```bash
linearis documents list
linearis documents list --project "Backend"
linearis documents create --title "Spec" --content "# Overview..."
linearis documents read <doc-id>
linearis documents update <doc-id> --content "Updated"
linearis documents delete <doc-id>
```

### 文件上传/下载

```bash
linearis embeds upload ./screenshot.png
linearis embeds download "<url>" --output ./file.png
```

### 团队、用户、项目

```bash
linearis teams list
linearis users list --active
linearis projects list
linearis cycles list --team WHO --active
```

### 完整用法

```bash
linearis usage  # Complete command reference (~1k tokens)
```

## 输出

所有命令默认返回 JSON 格式。可管道传输至 `jq` 进行后续处理：

```bash
linearis issues list -l 5 | jq '.[].identifier'
```

## 优先级取值

- 0：无优先级  
- 1：紧急  
- 2：高  
- 3：中  
- 4：低  

## 相关链接

- 文档：https://github.com/czottmann/linearis  
- 博客：https://zottmann.org/2025/09/03/linearis-my-linear-cli-built.html