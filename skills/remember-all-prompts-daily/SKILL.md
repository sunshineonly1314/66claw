---
name: remember-all-prompts-daily
name_zh: 每日提示记忆
description: 通过提取并按日期归档所有提示词，在 token 压缩周期间维持对话连续性。当 token 使用率达 95%（压缩前）及 1%（新冲刺开始时）自动触发，导出会话历史；并在会话重启时载入已归档的摘要，以恢复上下文。
description_zh: 通过提取并按日期归档所有提示词，在 token 压缩周期间维持对话连续性。当 token 使用率达 95%（压缩前）及 1%（新冲刺开始时）自动触发，导出会话历史；并在会话重启时载入已归档的摘要，以恢复上下文。
---
# 每日记忆全部提示词

该 skill 通过在 token 预算周期压缩前自动归档您的会话历史，并在新会话启动时恢复该历史，从而维持跨周期的对话连续性。

## 工作原理

### 1. **提取触发器（95% token 使用率）**
当 token 使用率接近 95% 时：
- 运行 `export_prompts.py` 提取当前会话历史
- 为所有提示词/响应添加时间戳并格式化
- 以日期为单位追加至 `memory/remember-all-prompts-daily.md`
- 标记归档点，以便后续执行压缩

### 2. **新会话触发器（1% token 使用率）**
当新会话启动（token 使用率重置为 1%）时：
- 检查 `memory/remember-all-prompts-daily.md` 是否存在
- 读取最新一条记录
- 将其作为“过往对话摘要”载入，以恢复上下文
- 自然延续上一会话结束处的内容

### 3. **每日文件结构**
```
# Remember All Prompts Daily

## [DATE: 2026-01-26]

### Session 1 (09:00 - 09:47)
[All prompts and responses from session]

### Session 2 (10:15 - 11:30)
[All prompts and responses from session]
```

## 脚本

### `scripts/export_prompts.py`
从当前会话中提取全部提示词/响应并归档。

**用法：**
```bash
python scripts/export_prompts.py
```

**功能说明：**
- 使用 `sessions_history()` 获取当前会话中的全部消息
- 添加时间戳与消息 ID 并格式化
- 追加至 `memory/remember-all-prompts-daily.md`
- 包含元数据（token 数量、持续时间等）

### `scripts/ingest_prompts.py`
读取每日归档文件，并在会话启动时将其注入为上下文。

**用法：**
```bash
python scripts/ingest_prompts.py
```

**功能说明：**
- 读取 `memory/remember-all-prompts-daily.md`（若存在）
- 提取最近一次会话记录
- 返回格式化后的摘要，供新会话载入使用

## 集成方式

### 心跳检查
添加至 `HEARTBEAT.md` 以监控 token 使用率：
```
Check token usage - if >95%, export session history
```

### 定时任务（可选）
用于自动触发：
```bash
# Check token at regular intervals
clawdbot cron add --text "Check token usage and export if needed" --schedule "*/15 * * * *"
```

## 示例流程

**会话 1：**
1. 正常聊天
2. token 使用率达到 95%
3. export_prompts.py 自动运行
4. 所有提示词归档至每日文件
5. 会话执行压缩

**会话 2（新冲刺）：**
1. token 预算重置为 1%
2. ingest_prompts.py 读取归档文件
3. “这是我们昨天讨论的内容……”
4. 上下文成功恢复，对话无缝延续

## 手动使用方式

### 立即导出
```bash
python skills/remember-all-prompts-daily/scripts/export_prompts.py
```

### 查看今日归档
```bash
cat memory/remember-all-prompts-daily.md | tail -100
```

### 载入上一会话内容
```bash
python skills/remember-all-prompts-daily/scripts/ingest_prompts.py
```

## Token 监控

可通过以下方式监控 token 使用率：
```bash
session_status  # Shows current token usage %
```

当您发现 token 使用率接近 95% 时，该 skill 可自动触发，或您亦可手动导出。

## 注意事项

- 仅在主会话中运行（即直接与 Ateeb 的聊天）
- 尊重隐私——仅存储您实际输入的提示词与模型响应
- 每日文件于午夜自动轮转（每日仅保留一条记录）
- 可随时手动触发