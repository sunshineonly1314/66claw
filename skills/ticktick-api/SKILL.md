---
name: ticktick-api
name_zh: TickTick API
description: TickTick 任务管理器集成。支持列出项目与任务、创建新任务、完成任务、删除任务。当用户希望管理待办清单、添加提醒、查看待处理任务或标记任务为已完成时使用。需通过 `ticktick-setup` 完成 OAuth 设置。
description_zh: TickTick 任务管理器集成。支持列出项目与任务、创建新任务、完成任务、删除任务。当用户希望管理待办清单、添加提醒、查看待处理任务或标记任务为已完成时使用。需通过 `ticktick-setup` 完成 OAuth 设置。
---
# TickTick 集成

通过 TickTick 的开放 API 管理任务。

## 设置

首次使用时：

1. 访问 https://developer.ticktick.com 并创建一个应用  
2. 添加重定向 URI：`http://127.0.0.1:8765/callback`  
3. 运行设置命令：

```bash
ticktick-setup <client_id> <client_secret>
```

4. 在浏览器中打开认证 URL，授权后粘贴回调 URL  

## 使用方式

```bash
# List projects
ticktick projects

# List all tasks
ticktick tasks

# List tasks from specific project
ticktick tasks <project_id>

# Add task (inbox)
ticktick add "Buy milk"

# Add task to project with due date
ticktick add "Buy milk" --project <id> --due 2026-01-30

# Complete task
ticktick complete <project_id> <task_id>

# Delete task
ticktick delete <project_id> <task_id>
```

## API 参考

基础 URL：`https://api.ticktick.com/open/v1`

| 端点 | 方法 | 描述 |
|----------|--------|-------------|
| /project | GET | 列出所有项目 |
| /project/{id}/data | GET | 获取指定项目及其任务 |
| /task | POST | 创建任务 |
| /task/{id} | POST | 更新任务 |
| /project/{pid}/task/{tid}/complete | POST | 完成任务 |
| /task/{pid}/{tid} | DELETE | 删除任务 |

## 任务对象

```json
{
  "title": "Task title",
  "content": "Description", 
  "projectId": "project-id",
  "dueDate": "2026-01-25T12:00:00+0000",
  "priority": 0,
  "tags": ["tag1"]
}
```

优先级：0=无，1=低，3=中，5=高  