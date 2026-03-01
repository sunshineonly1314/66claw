---
name: project-manager
description: 管理基于 JSON 的内部项目系统。支持创建任务、在看板上移动任务，并与 Apple Reminders 同步。
description_zh: 管理基于 JSON 的内部项目系统。支持创建任务、在看板上移动任务，并与 Apple Reminders 同步。
---
# Skill: Project Manager (Vivi OS)

## 描述
管理基于 JSON 的内部项目系统。支持创建任务、在看板上移动任务，并与 Apple Reminders 同步。

## 数据位置
数据库：`/Users/fz1/clawd/data/pm/projects.json`

## 命令（心智模型）

### 1. 列出任务
*   **操作**：读取 JSON 并按列分组显示任务，或按项目筛选任务。
*   **用法**：“我们当前有哪些待办事项？”，“SaaS 项目的当前状态”。

### 2. 添加任务（Add）
*   **操作**：向数组 `tasks` 中插入对象。
*   **字段**：`projectId`、`title`、`priority`（low/med/high/crit）、`sync`（true/false）。
*   **副作用**：若 `sync: true`，则执行 skill `apple-reminders` 创建提醒事项。

### 3. 移动任务（Move）
*   **操作**：更新某项任务的 `status`。
*   **状态流转**：`todo` → `in_progress` → `review` → `done`（或 `blocked`）。
*   **通知**：若任务移至 `review` 或 `blocked`，需在聊天中通知 David。

### 4. 同步（Sync）
*   **操作**：强制将任务状态变更同步至 Apple Reminders（通过 `sync: true`）。

## 业务规则
1.  **评审（Review）**：仅当需要 David 明确批准时，才可将任务移至 `review`。
2.  **聚焦（Focus）**：`in_progress` 中同时进行的任务数不得超过 3 个。
3.  **夜班（Night Shift）**：夜班人员须阅读此 JSON 文件，以便在无明确指令时确定优先处理事项。