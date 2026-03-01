---
name: github-kb
name_zh: GitHub知识库
description: 管理本地 GitHub 知识库，并通过 gh CLI 提供 GitHub 搜索能力。当用户询问有关仓库、PR、issues 的问题，请求克隆 GitHub 仓库、探索代码库，或需要 GitHub 项目相关信息时使用。支持通过 gh CLI 搜索 GitHub，并通过 GITHUB_KB.md 目录管理本地知识库。通过 GITHUB_TOKEN 和 GITHUB_KB_PATH 环境变量配置。
description_zh: 管理本地 GitHub 知识库，并通过 gh CLI 提供 GitHub 搜索能力。当用户询问有关仓库、PR、issues 的问题，请求克隆 GitHub 仓库、探索代码库，或需要 GitHub 项目相关信息时使用。支持通过 gh CLI 搜索 GitHub，并通过 GITHUB_KB.md 目录管理本地知识库。通过 GITHUB_TOKEN 和 GITHUB_KB_PATH 环境变量配置。
---
# GitHub 知识库

通过 gh CLI 管理本地 GitHub 知识库并提供 GitHub 搜索能力。核心文件：KB 目录根目录下的 GITHUB_KB.md，其中以简短描述汇总所有项目。

## 配置

使用前请设置环境变量：  
- `GITHUB_TOKEN` —— GitHub 个人访问令牌（可选，用于私有仓库）  
- `GITHUB_KB_PATH` —— 本地 KB 目录路径（默认：`/home/node/clawd/github-kb`）  

示例：  
```bash
export GITHUB_TOKEN="ghp_xxxx..."
export GITHUB_KB_PATH="/your/path/github-kb"
```

**令牌隐私：** 切勿硬编码令牌。请通过环境变量或容器密钥注入。

## GitHub CLI（gh）

**前提：** 必须已安装并完成身份验证。

**安装：**  
- **macOS：** `brew install gh`  
- **Linux：** `apt install gh` 或参阅 [官方安装指南](https://github.com/cli/cli/blob/trunk/docs/install_linux.md)  
- **Windows：** `winget install GitHub.cli`  

**身份验证：**  
```bash
# Interactive login
gh auth login

# Or use token from GITHUB_TOKEN env var
gh auth login --with-token <(echo "$GITHUB_TOKEN")
```

**验证：** `gh auth status`

若 `gh` 未安装或未认证，则跳过搜索操作，仅使用本地 KB 功能。

### 搜索仓库

```bash
# Search repos by keyword
gh search repos <query> [--limit <n>]

# Examples:
gh search repos "typescript cli" --limit 10
gh search repos "language:python stars:>1000" --limit 20
gh search repos "topic:mcp" --limit 15
```

**搜索限定符：**  
- `language:<lang>` —— 按编程语言筛选  
- `stars:<n>` 或 `stars:><n>` —— 按星标数筛选  
- `topic:<name>` —— 按主题筛选  
- `user:<owner>` —— 在特定用户的仓库中搜索  
- `org:<org>` —— 在特定组织的仓库中搜索  

### 搜索 Issues

```bash
gh search issues "react hooks bug" --limit 20
gh search issues "repo:facebook/react state:open" --limit 30
gh search issues "language:typescript label:bug" --limit 15
```

**搜索限定符：**  
- `repo:<owner/repo>` —— 在特定仓库中搜索  
- `state:open|closed` —— 按 issue 状态筛选  
- `author:<username>` —— 按作者筛选  
- `label:<name>` —— 按标签筛选  
- `language:<lang>` —— 按仓库语言筛选  
- `comments:<n>` 或 `comments:><n>` —— 按评论数筛选  

### 搜索拉取请求（Pull Requests）

```bash
# Search PRs
gh search prs <query> [--limit <n>]

# Examples:
gh search prs "repo:vercel/next.js state:open" --limit 30
gh search prs "language:go is:merged" --limit 15
```

**搜索限定符：**  
- `repo:<owner/repo>` —— 在特定仓库中搜索  
- `state:open|closed|merged` —— 按 PR 状态筛选  
- `author:<username>` —— 按作者筛选  
- `label:<name>` —— 按标签筛选  
- `language:<lang>` —— 按仓库语言筛选  
- `is:merged|unmerged` —— 按合并状态筛选  

### 查看 PR / Issue 详情

```bash
# View issue/PR details
gh issue view <number> --repo <owner/repo>
gh pr view <number> --repo <owner/repo>

# View with comments
gh issue view <number> --repo <owner/repo> --comments
gh pr view <number> --repo <owner/repo> --comments
```

## 本地知识库工作流

### 查询 KB 中的仓库

1. 阅读 GITHUB_KB.md，了解已有项目  
2. 在 ${GITHUB_KB_PATH:-/home/node/clawd/github-kb}/ 下定位项目目录  

### 将新仓库克隆至 KB

1. 若未知完整仓库名，请先搜索 GitHub  
2. 克隆至 KB 目录：  
   ```bash
   git clone https://github.com/<owner>/<name>.git ${GITHUB_KB_PATH:-/home/node/clawd/github-kb}/<name>
   ```  
3. 生成项目描述：阅读 README 或关键文件以理解项目  
4. 更新 GITHUB_KB.md：按现有格式为新仓库添加条目：  
   ```markdown
   ### [<name>](/<name>)
   Brief one-line description of what the project does. Additional context if useful (key features, tech stack, etc.).
   ```  
5. 确认完成：告知用户仓库已克隆及存放位置  

### 默认克隆位置

若用户仅说“克隆 X”而未指定目录，则默认克隆至 ${GITHUB_KB_PATH:-/home/node/clawd/github-kb}/。

## GITHUB_KB.md 格式

目录文件遵循以下结构：

```markdown
# GitHub Knowledge Base

This directory contains X GitHub projects covering various domains.

---

## Category Name

### [project-name](/project-name)
Brief description of the project.
```

更新时请保持分类与格式一致。