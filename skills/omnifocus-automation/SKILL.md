---
name: omnifocus-automation
name_zh: OmniFocus自动化
description: 通过 Omni Automation 管理 OmniFocus 中的任务、项目和文件夹。适用于任务管理、待办清单、项目跟踪、GTD 工作流、添加/完成/编辑任务、设置截止日期、管理标签以及重复任务。需在 macOS 上安装 OmniFocus。
description_zh: 通过 Omni Automation 管理 OmniFocus 中的任务、项目和文件夹。适用于任务管理、待办清单、项目跟踪、GTD 工作流、添加/完成/编辑任务、设置截止日期、管理标签以及重复任务。需在 macOS 上安装 OmniFocus。
---
# OmniFocus

通过 JXA（JavaScript for Automation）控制 OmniFocus。

## 要求

- 已安装 OmniFocus 3 或 4 的 macOS 系统
- OmniFocus 必须正在运行（或会自动启动）

## 快速参考

```bash
# Run via the wrapper script
./scripts/of <command> [args...]

# Or directly
osascript -l JavaScript ./scripts/omnifocus.js <command> [args...]
```

## 命令

### 列出/查询

| 命令 | 描述 |
|------|------|
| `inbox` | 列出收件箱任务 |
| `folders` | 列出所有文件夹 |
| `projects [folder]` | 列出项目（可选按文件夹筛选） |
| `tasks <project>` | 列出项目中的任务 |
| `tags` | 列出所有标签 |
| `today` | 今日到期或已逾期的任务 |
| `flagged` | 已标记且未完成的任务 |
| `search <query>` | 按名称搜索任务 |
| `info <taskId>` | 完整任务详情 |

### 创建

| 命令 | 描述 |
|------|------|
| `add <name> [project]` | 将任务添加至收件箱或项目 |
| `newproject <name> [folder]` | 创建项目 |
| `newfolder <name>` | 创建顶级文件夹 |
| `newtag <name>` | 创建或获取标签 |

### 修改

| 命令 | 描述 |
|------|------|
| `complete <taskId>` | 标记为已完成 |
| `uncomplete <taskId>` | 标记为未完成 |
| `delete <taskId>` | 永久删除 |
| `rename <taskId> <name>` | 重命名任务 |
| `note <taskId> <text>` | 追加备注内容 |
| `setnote <taskId> <text>` | 替换备注内容 |
| `defer <taskId> <date>` | 设置延迟日期（YYYY-MM-DD） |
| `due <taskId> <date>` | 设置截止日期 |
| `flag <taskId> [true\|false]` | 设置标记状态 |
| `tag <taskId> <tag>` | 添加标签（如不存在则自动创建） |
| `untag <taskId> <tag>` | 移除标签 |
| `move <taskId> <project>` | 移动至指定项目 |

### 重复任务

```bash
# repeat <taskId> <method> <interval> <unit>
of repeat abc123 fixed 1 weeks
of repeat abc123 due-after-completion 2 days
of repeat abc123 defer-after-completion 1 months
of unrepeat abc123
```

支持的方法：`fixed`、`due-after-completion`、`defer-after-completion`  
支持的单位：`days`、`weeks`、`months`、`years`

## 输出格式

所有命令均返回 JSON。成功响应包含 `"success": true`；错误响应包含 `"error": "message"`。

```json
{
  "success": true,
  "task": {
    "id": "abc123",
    "name": "Task name",
    "note": "Notes here",
    "flagged": false,
    "completed": false,
    "deferDate": "2026-01-30",
    "dueDate": "2026-02-01",
    "project": "Project Name",
    "tags": ["tag1", "tag2"],
    "repeat": {"method": "fixed", "rule": "RRULE:FREQ=WEEKLY;INTERVAL=1"}
  }
}
```

## 示例

```bash
# Add task to inbox
of add "Buy groceries"

# Add task to specific project
of add "Review docs" "Work Projects"

# Set due date and flag
of due abc123 2026-02-01
of flag abc123 true

# Add tags
of tag abc123 "urgent"
of tag abc123 "home"

# Create recurring task
of add "Weekly review" "Habits"
of repeat xyz789 fixed 1 weeks

# Search and complete
of search "groceries"
of complete abc123

# Get today's tasks
of today
```

## 注意事项

- 任务 ID 是 OmniFocus 内部 ID（所有任务响应中均返回）
- 日期采用 ISO 格式：YYYY-MM-DD
- 项目和文件夹名称区分大小写
- 使用 `tag` 命令时，若标签不存在则自动创建
- 所有输出均为 JSON，便于解析

## 技术细节

本 skill 主要使用 JavaScript for Automation（JXA）执行各项操作；针对标签和重复任务操作，因已知 JXA 在调用特定 OmniFocus API 时存在类型转换缺陷，故回退使用 AppleScript。

该混合方案具备以下优势：
- 输出 JSON，便于解析
- 对标签名称中的特殊字符提供稳健转义
- 提供带清晰消息的错误处理

**首次运行：** OmniFocus 可能提示允许自动化访问。请在“系统设置 > 隐私与安全性 > 自动化”中启用此权限。