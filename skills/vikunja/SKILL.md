---
name: vikunja
name_zh: Vikunja
description: 在 Vikunja（一款开源项目管理工具）中管理项目与任务：创建项目、添加任务、设定截止日期与优先级，并跟踪完成状态。
description_zh: 在 Vikunja（一款开源项目管理工具）中管理项目与任务：创建项目、添加任务、设定截止日期与优先级，并跟踪完成状态。
homepage: https://vikunja.io
metadata: {"clawdbot":{"emoji":"📋","requires":{"bins":["uv"],"env":["VIKUNJA_URL","VIKUNJA_USER","VIKUNJA_PASSWORD"]},"primaryEnv":"VIKUNJA_URL"}}
---
# Vikunja 项目管理

在开源、可自托管的项目管理工具 [Vikunja](https://vikunja.io) 中管理项目与任务。

## 初始化设置

请设置以下环境变量：
- `VIKUNJA_URL` —— 您的 Vikunja 实例地址（例如：`https://vikunja.example.com`）
- `VIKUNJA_USER` —— 用户名或邮箱
- `VIKUNJA_PASSWORD` —— 密码

## 命令

### 项目操作
```bash
# List all projects
uv run {baseDir}/scripts/vikunja.py projects

# Get project details
uv run {baseDir}/scripts/vikunja.py project <ID>

# Create a project
uv run {baseDir}/scripts/vikunja.py create-project "Project Name" -d "Description"
```

### 任务操作
```bash
# List all tasks
uv run {baseDir}/scripts/vikunja.py tasks

# List tasks in a specific project
uv run {baseDir}/scripts/vikunja.py tasks --project <PROJECT_ID>

# Create a task
uv run {baseDir}/scripts/vikunja.py create-task "Task title" --project <ID> --due 2026-01-15 --priority 3

# Mark task complete
uv run {baseDir}/scripts/vikunja.py complete <TASK_ID>
```

### 可选参数
- `--json` —— 以 JSON 格式输出结果（供程序化调用）

## 优先级等级
- 0：无
- 1：低
- 2：中
- 3：高
- 4：紧急
- 5：关键

## 示例

```bash
# Create a project for Q1 planning
uv run {baseDir}/scripts/vikunja.py create-project "Q1 2026 Planning" -d "Quarterly planning tasks"

# Add a high-priority task
uv run {baseDir}/scripts/vikunja.py create-task "Review budget" --project 5 --due 2026-01-20 --priority 3

# Check what's due
uv run {baseDir}/scripts/vikunja.py tasks --project 5 --json
```