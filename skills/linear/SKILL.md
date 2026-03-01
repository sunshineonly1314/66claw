---
name: linear
name_zh: Linear
description: 查询与管理 Linear 任务（issues）、项目及团队工作流。
description_zh: 查询与管理 Linear 任务（issues）、项目及团队工作流。
homepage: https://linear.app
metadata: {"clawdis":{"emoji":"📊","requires":{"env":["LINEAR_API_KEY"]}}}
---
# Linear

管理任务、查看项目状态，并实时掌握团队工作进展。

## 初始化设置

```bash
export LINEAR_API_KEY="your-api-key"
# Optional: default team key used when a command needs a team
export LINEAR_DEFAULT_TEAM="TEAM"
```

发现团队密钥（team keys）：

```bash
{baseDir}/scripts/linear.sh teams
```

若已设置 `LINEAR_DEFAULT_TEAM`，则可在 `team` 中省略团队密钥，直接调用：

```bash
{baseDir}/scripts/linear.sh create "Title" ["Description"]
```

## 快捷命令

```bash
# My stuff
{baseDir}/scripts/linear.sh my-issues          # Your assigned issues
{baseDir}/scripts/linear.sh my-todos           # Just your Todo items
{baseDir}/scripts/linear.sh urgent             # Urgent/High priority across team

# Browse
{baseDir}/scripts/linear.sh teams              # List available teams
{baseDir}/scripts/linear.sh team <TEAM_KEY>    # All issues for a team
{baseDir}/scripts/linear.sh project <name>     # Issues in a project
{baseDir}/scripts/linear.sh issue <TEAM-123>   # Get issue details
{baseDir}/scripts/linear.sh branch <TEAM-123>  # Get branch name for GitHub

# Actions
{baseDir}/scripts/linear.sh create <TEAM_KEY> "Title" ["Description"]
{baseDir}/scripts/linear.sh comment <TEAM-123> "Comment text"
{baseDir}/scripts/linear.sh status <TEAM-123> <todo|progress|review|done|blocked>
{baseDir}/scripts/linear.sh assign <TEAM-123> <userName>
{baseDir}/scripts/linear.sh priority <TEAM-123> <urgent|high|medium|low|none>

# Overview
{baseDir}/scripts/linear.sh standup            # Daily standup summary
{baseDir}/scripts/linear.sh projects           # All projects with progress
```

## 常见工作流

### 晨会站会（Morning Standup）
```bash
{baseDir}/scripts/linear.sh standup
```  
显示内容：你的待办事项、团队内被阻塞项、最近完成项、正在审核中的事项。

### 快速创建任务（源自聊天上下文）
```bash
{baseDir}/scripts/linear.sh create TEAM "Fix auth timeout bug" "Users getting logged out after 5 min"
```

### 分诊模式（Triage Mode）
```bash
{baseDir}/scripts/linear.sh urgent    # See what needs attention
```

## Git 工作流（Linear ↔ GitHub 集成）

**始终使用 Linear 生成的分支名**，以启用自动任务状态追踪。

### 获取分支名
```bash
{baseDir}/scripts/linear.sh branch TEAM-212
# Returns: dev/team-212-fix-auth-timeout-bug
```

### 为某任务创建工作树（worktree）
```bash
# 1. Get the branch name from Linear
BRANCH=$({baseDir}/scripts/linear.sh branch TEAM-212)

# 2. Pull fresh main first (main should ALWAYS match origin)
cd /path/to/repo
git checkout main && git pull origin main

# 3. Create worktree with that branch (branching from fresh origin/main)
git worktree add .worktrees/team-212 -b "$BRANCH" origin/main
cd .worktrees/team-212

# 4. Do your work, commit, push
git push -u origin "$BRANCH"
```

**⚠️ 切勿在 main 分支上直接修改文件。** 所有变更仅限于工作树中进行。

### 此设计的重要性
- Linear 的 GitHub 集成通过分支名模式识别 PR 并追踪任务状态  
- 当你从 Linear 分支发起 PR 时，对应任务将**自动进入“In Review”状态**  
- 当 PR 合并后，对应任务将**自动进入“Done”状态**  
- 手动命名分支会破坏此自动化流程  
- 保持 main 分支干净 = 避免误推送 + 工作树清理更便捷  

### 快速参考
```bash
# Full workflow example
ISSUE="TEAM-212"
BRANCH=$({baseDir}/scripts/linear.sh branch $ISSUE)

# Always start from fresh main
cd ~/workspace/your-repo
git checkout main && git pull origin main

# Create worktree (inside .worktrees/)
git worktree add .worktrees/${ISSUE,,} -b "$BRANCH" origin/main
cd .worktrees/${ISSUE,,}

# ... make changes ...
git add -A && git commit -m "fix: implement $ISSUE"
git push -u origin "$BRANCH"
gh pr create --title "$ISSUE: <title>" --body "Closes $ISSUE"
```

## 优先级等级

| 等级 | 数值 | 适用场景 |
|-------|-------|---------|
| urgent | 1 | 生产环境问题、阻塞项 |
| high | 2 | 本周内需完成的重要事项 |
| medium | 3 | 当前冲刺周期（sprint/cycle）内完成 |
| low | 4 | 锦上添花型需求 |
| none | 0 | 待办清单（backlog），暂无明确排期 |

## 团队信息（缓存）

团队密钥与 ID 通过 API 自动发现，并在首次查询后本地缓存。  
使用 `linear.sh teams` 可刷新缓存并列出所有可用团队。

## 注意事项

- 使用 GraphQL API（api.linear.app/graphql）  
- 需配置 `LINEAR_API_KEY` 环境变量  
- 任务标识符格式示例：`TEAM-123`  

## 致谢

灵感源自 Peter Schilling（ISC 许可证）开发的 [schpet/linear-cli](https://github.com/schpet/linear-cli)。  
本实现为面向 Clawdbot 集成的独立 Bash 版本。