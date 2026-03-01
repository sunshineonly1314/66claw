---
name: task-status
name_zh: 任务状态
description: 为长时间运行的任务在聊天中发送简短状态描述。适用于需在多步骤操作期间提供周期性更新、确认任务完成或通知失败情形的场景。本技能包含自动化周期性监控（每 5 秒发送一次更新）、状态消息模板，以及用于统一状态报告的辅助函数。
description_zh: 为长时间运行的任务在聊天中发送简短状态描述。适用于需在多步骤操作期间提供周期性更新、确认任务完成或通知失败情形的场景。本技能包含自动化周期性监控（每 5 秒发送一次更新）、状态消息模板，以及用于统一状态报告的辅助函数。
---
# Task Status 技能

## 快速开始

### 手动状态更新
```bash
python scripts/send_status.py "Starting data fetch..." "progress" "step1"
python scripts/send_status.py "Processing complete" "success" "final"
python scripts/send_status.py "Error: Missing API key" "error" "auth"
```

### 自动周期性监控（每 5 秒一次）
```bash
# Start monitoring a long-running task
python scripts/monitor_task.py start "My Long Task" "processing"

# Monitor will send "Still working..." updates every 5 seconds
# When task completes, report final status
python scripts/monitor_task.py stop "My Long Task" "success" "Completed successfully!"
```

## 状态类型

- **progress**：工作正在进行中（显示 🔄 或 ->）  
- **success**：任务已完成（显示 ✅ 或 OK）  
- **error**：任务失败（显示 ❌ 或 !）  
- **warning**：存在问题但仍在继续（显示 ⚠️ 或 ?）  

## 周期性监控

`monitor_task.py` 脚本提供自动更新功能：

### 启动监控器
```bash
python scripts/monitor_task.py start "<task_name>" "<status_type>" [--interval <seconds>]
```

- 自动每 5 秒发送一次 “Still working...” 更新  
- 在后台运行，直至被主动停止  
- 可通过不同参数自定义更新间隔  

### 停止监控器
```bash
python scripts/monitor_task.py stop "<task_name>" "<final_status>" "<final_message>"
```

### 示例：大文件处理
```bash
# Start monitoring
python scripts/monitor_task.py start "video_processing" "progress"

# ... long processing happens here ...

# Stop with final status
python scripts/monitor_task.py stop "video_processing" "success" "Processing complete!"
```

## 手动更新（快速状态）

适用于无需监控的单次状态更新：

```bash
python scripts/send_status.py "Still fetching data..." "progress" "fetch"
python scripts/send_status.py "Processing records: 250/1000" "progress" "process"
python scripts/send_status.py "Complete! 3 files ready" "success" "final"
python scripts/send_status.py "Error: Connection timeout" "error" "api"
```

## 各方法适用场景

### 适合使用手动更新的情形：
- 任务耗时较短（少于 30 秒）  
- 您希望自主控制更新发送时机  
- 任务具有离散、有意义的关键节点  

### 适合使用周期性监控的情形：
- 任务持续时间较长（超过 1 分钟）  
- 您需要每 5 秒一次的稳定“心跳”更新  
- 任务存在长时间静默期  
- 您希望向用户确认工作仍在持续进行  

## 消息规范

状态消息请控制在 140 字符以内。示例如下：

- **Progress（进行中）**：“Still fetching data...” 或 “Processing records: 250/1000”  
- **Success（成功）**：“Complete! 3 files ready” 或 “Task finished successfully”  
- **Error（错误）**：“Error: Connection timeout” 或 “Failed: Missing API key”  
- **Warning（警告）**：“Continuing despite timeout” 或 “Partial success: 5/10 files”  

## 高级用法

### 带附加细节
```bash
python scripts/send_status.py "Uploading..." "progress" "upload" --details "File: report.pdf (2.4MB)"
```

### 自定义更新间隔
```bash
python scripts/monitor_task.py start "data_sync" "progress" --interval 10
```

### 在 Python 脚本中导入使用
```python
from send_status import send_status

def long_task():
    send_status("Starting...", "progress", "step1")
    # ... work
    send_status("Step complete", "success", "step1")
```

## 与 Clawdbot Cron 配合自动化

对于定时任务，请使用 Clawdbot 的 cron 功能：

```python
# In a script or session
from cron import add

# Every 5 seconds, check status
job = {
    "text": "Check status update",
    "interval": "5s",
    "enabled": True
}
add(job)
```

此方式可在您未主动关注时也确保状态更新。

## 安装方法

要使用本技能，请将 `task-status` 文件夹复制到您的 Clawdbot skills 目录中：

```
C:\Users\Luffy\AppData\Roaming\npm\node_modules\clawdbot\skills\task-status
```

或者将其添加至您的工作区，并在 `AGENTS.md` 或 `TOOLS.md` 中引用。

安装完成后，该技能即可用于任何需要周期性状态更新的任务场景。