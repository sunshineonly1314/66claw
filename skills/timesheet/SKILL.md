---
name: timesheet
name_zh: 工时表
description: 使用 timesheet.io CLI 跟踪工时、管理项目与任务
description_zh: 使用 timesheet.io CLI 跟踪工时、管理项目与任务
user-invocable: true
homepage: https://timesheet.io
metadata: {"requires": {"bins": ["timesheet"]}}
---
# Timesheet CLI Skill

通过命令行控制 timesheet.io 的时间跟踪功能。所有命令均需使用 `--json` 标志以获取结构化输出。

## 认证

在使用其他命令前，请先检查认证状态：
```bash
timesheet auth status --json
```

若尚未认证，请引导用户运行：
```bash
timesheet auth login
```

或为自动化场景设置 API 密钥：
```bash
export TIMESHEET_API_KEY=ts_your.apikey
```

## 计时器操作

### 启动计时器
```bash
# List projects first to get project ID
timesheet projects list --json

# Start timer for a project
timesheet timer start <project-id>
```

### 检查计时器状态
```bash
timesheet timer status --json
```

返回值：状态（running/paused/stopped）、项目名称、持续时长、开始时间。

### 控制计时器
```bash
timesheet timer pause
timesheet timer resume
timesheet timer stop  # Creates a task from the timer
```

### 更新正在运行的计时器
```bash
timesheet timer update --description "Working on feature X"
timesheet timer update --billable
```

## 项目管理

### 列出项目
```bash
timesheet projects list --json
```

### 创建项目
```bash
timesheet projects create "Project Name" --json
timesheet projects create "Client Project" --billable --json
```

### 查看 / 更新 / 删除
```bash
timesheet projects show <id> --json
timesheet projects update <id> --title "New Name"
timesheet projects delete <id>
```

## 任务管理

### 列出任务
```bash
timesheet tasks list --json           # Recent tasks
timesheet tasks list --today --json   # Today's tasks
timesheet tasks list --this-week --json
```

### 手动创建任务
```bash
timesheet tasks create -p <project-id> -s "2024-01-15 09:00" -e "2024-01-15 17:00" --json
timesheet tasks create -p <project-id> -s "09:00" -e "17:00" -d "Task description" --json
```

### 更新任务
```bash
timesheet tasks update <id> --description "Updated description"
timesheet tasks update <id> --billable
timesheet tasks update <id> --start "10:00" --end "12:00"
```

### 删除任务
```bash
timesheet tasks delete <id>
```

## 团队与标签

### 团队
```bash
timesheet teams list --json
```

### 标签
```bash
timesheet tags list --json
timesheet tags create "Urgent" --color 1
timesheet tags delete <id>
```

## 报告

### 工时汇总
```bash
timesheet reports summary --today --json
timesheet reports summary --this-week --json
timesheet reports summary --this-month --json
timesheet reports summary --from 2024-01-01 --to 2024-01-31 --json
```

### 导出数据
```bash
timesheet reports export -f xlsx -s 2024-01-01 -e 2024-01-31
timesheet reports export -f csv --this-month
```

## 个人资料与配置

```bash
timesheet profile show --json
timesheet profile settings --json

timesheet config show
timesheet config set defaultProjectId <id>
```

## 常见工作流

### 为当前工作记录工时
1. 检查计时器是否正在运行：`timesheet timer status --json`  
2. 若未运行，则启动计时器：`timesheet timer start <project-id>`  
3. 完成后停止计时器：`timesheet timer stop`

### 快速工时录入
```bash
# Create a completed task directly
timesheet tasks create -p <project-id> -s "09:00" -e "12:00" -d "Morning standup and dev work" --json
```

### 按名称查找项目
```bash
timesheet projects list --json | jq '.[] | select(.title | contains("ProjectName"))'
```

## 错误处理

退出码：
- 0：成功  
- 1：通用错误  
- 2：用法错误（参数无效）  
- 3：认证错误 —— 请运行 `timesheet auth login`  
- 4：API 错误  
- 5：超出速率限制 —— 等待后重试  
- 6：网络错误  

## 提示

- 始终使用 `--json` 以编程方式解析输出  
- 使用 `--quiet` 或 `-q` 抑制非必要输出  
- 在配置中设置 `defaultProjectId`，可跳过计时器启动时的项目选择步骤  
- 当输出目标非终端（如管道）时，自动启用适合管道处理的输出格式  