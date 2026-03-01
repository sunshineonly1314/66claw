---
name: obsidian-conversation-backup
name_zh: Obsidian对话备份
description: 面向 Obsidian 的自动对话备份系统，支持增量快照、按小时分组及格式化的聊天风格 Markdown。适用于设置对话归档、防止因 /new 重置导致的数据丢失，或在 Obsidian 仓库中以恰当格式（彩色提示框、时间戳、多段落支持）组织聊天历史。
description_zh: 面向 Obsidian 的自动对话备份系统，支持增量快照、按小时分组及格式化的聊天风格 Markdown。适用于设置对话归档、防止因 /new 重置导致的数据丢失，或在 Obsidian 仓库中以恰当格式（彩色提示框、时间戳、多段落支持）组织聊天历史。
---
# Obsidian 对话备份

自动将 Clawdbot 对话备份至 Obsidian，采用美观的聊天风格 Markdown 格式。通过每小时增量快照，防范 `/new` 重置引发的数据丢失。

## 功能特性

- **增量备份**：每小时仅快照新增消息（杜绝重复）  
- **聊天格式**：Obsidian 提示框配表情符号、时间戳，支持多段落  
- **按小时分组**：按钟点组织对话，便于快速查阅  
- **零 Token 成本**：纯 Shell 脚本，不调用任何大语言模型（LLM）  
- **智能过滤**：自动跳过空消息与系统通知  

## 快速设置

### 安装

```bash
# Extract the skill (if downloaded as .skill file)
unzip obsidian-conversation-backup.skill
cd obsidian-conversation-backup

# Run installer (interactive)
chmod +x install.sh
./install.sh
```

安装程序将询问以下信息：
- Obsidian 仓库路径  
- 会话目录位置  
- 跟踪文件存放位置  

**或手动设置：**  

1. 将 `config.example` 复制至 `config`  
2. 编辑 `config`，填入您的实际路径  
3. 使脚本具备可执行权限：`chmod +x scripts/*.sh`  

### 启用自动备份

添加至 crontab 实现每小时自动备份：

```bash
crontab -e

# Add this line (runs every hour at :00)
0 * * * * /path/to/obsidian-conversation-backup/scripts/monitor_and_save.sh
```

### 自定义聊天外观（可选）

编辑 `scripts/format_message_v2.jq` 可调整：  
- 用户表情符号（默认：🐉）  
- 助理表情符号（默认：🦞）  
- 提示框类型（默认：`[!quote]` 表示用户，`[!check]` 表示助理）  

## 使用方法

### 自动增量备份

配置 cron 后，系统将自动运行：

**每小时执行：**  
- 检查是否存在新消息（≥10 行）  
- 如有，则创建增量快照  
- 保存至：`YYYY-MM-DD-HHmm-incremental.md`  
- 若无新对话，则跳过  

**示例输出：**  
```
2026-01-20-1500-incremental.md (messages from last save to now)
2026-01-20-1600-incremental.md (new messages since 15:00)
2026-01-20-1700-incremental.md (new messages since 16:00)
```  

**防护能力**：最多丢失 1 小时对话  

### 按需完整快照

随时保存完整对话：

```bash
scripts/save_full_snapshot.sh [topic-name]
```  

**示例：**  
```bash
scripts/save_full_snapshot.sh important-decisions
scripts/save_full_snapshot.sh bug-fix-discussion
scripts/save_full_snapshot.sh  # uses "full-conversation" as default
```  

### 按小时分组（组织用途）

按钟点创建结构化分组：

```bash
scripts/create_hourly_snapshots.sh YYYY-MM-DD
```  

**示例：**  
```bash
scripts/create_hourly_snapshots.sh 2026-01-20
```  

**输出：**  
```
2026-01-20-1500-hourly.md (15:00-15:59 messages)
2026-01-20-1600-hourly.md (16:00-16:59 messages)
2026-01-20-1700-hourly.md (17:00-17:59 messages)
```  

**适用场景**：每日收尾整理，便于快速查阅  

## 聊天格式

消息以彩色 Obsidian 提示框形式呈现：

**用户消息**（蓝色 `[!quote]` 提示框）：  
```
> [!quote] 🐉 User · 15:30
> This is my message
```  

**助理消息**（绿色 `[!check]` 提示框）：  
```
> [!check] 🦞 Zoidbot · 15:31  
> This is the response
```  

**特性：**  
- 时间戳（HH:MM 格式）  
- 支持多段落（使用 `<br><br>` 分隔段落）  
- 正确换行（所有行均以 `> ` 开头）  
- 自动过滤空消息  
- 排除系统通知  

## Token 监控

`monitor_and_save.sh` 脚本同时追踪 Token 使用量：

**Telegram 提醒：**  
- **80 万 Token（80%）**：“请考虑尽快执行 /new”  
- **90 万 Token（90%）**：“立即执行 /new”  

**实现方式：**  
```bash
# Sends warning only when crossing threshold (one-time)
# No repeated warnings
# Resets when back under 800k
```  

## 文件结构

```
scripts/
├── monitor_and_save.sh           # Hourly incremental backup + token monitoring
├── save_full_snapshot.sh         # On-demand full conversation save
├── create_hourly_snapshots.sh    # Organize by clock hour
└── format_message_v2.jq          # Chat formatting logic
```  

## 配置说明

### 跟踪文件

系统使用隐藏文件记录状态：

```bash
/root/clawd/.last_save_line_count       # For token monitoring
/root/clawd/.last_snapshot_timestamp    # For incremental saves
/root/clawd/.token_warning_sent         # For warning deduplication
```  

**注意**：请勿删除这些文件，否则可能导致增量备份内容重复  

### 会话文件位置

默认路径：`/root/.clawdbot/agents/main/sessions/*.jsonl`  

若您的会话文件位于他处，请在每个脚本中更新 `SESSION_FILE` 路径。

## 故障排查

### 未生成快照

1. 检查 cron 是否运行：`crontab -l`  
2. 验证脚本是否具备执行权限：`chmod +x scripts/*.sh`  
3. 查看日志：手动运行脚本以定位错误  

### 消息溢出提示框

- 确保 `format_message_v2.jq` 包含 `gsub("\n\n"; "<br><br>")` 行  
- 检查所有行是否均以 `> ` 开头  
- 验证 jq 是否已安装：`jq --version`  

### 快照中出现重复内容

- 删除跟踪文件并让系统重置：  
  ```bash
  rm /root/clawd/.last_snapshot_timestamp
  ```  

### 提示框为空白

- 更新 `format_message_v2.jq` 以过滤空消息  
- 检查是否包含 `if ($text_content | length) > 0` 条件  

## 系统要求

- **jq**：JSON 解析（`apt-get install jq`）  
- **cron**：用于自动备份  
- **Obsidian 仓库**：Markdown 文件的目标目录  

## 高级自定义

### 更改备份频率

编辑 crontab：  
```bash
# Every 2 hours
0 */2 * * * /path/to/monitor_and_save.sh

# Every 30 minutes
*/30 * * * * /path/to/monitor_and_save.sh

# Specific times only (9am, 12pm, 6pm, 9pm)
0 9,12,18,21 * * * /path/to/monitor_and_save.sh
```  

### 更改最小消息阈值

编辑 `monitor_and_save.sh`：  
```bash
# Change from 10 to 5 messages minimum
if [[ $new_lines -lt 5 ]]; then
```  

### 添加更多提示框样式

Obsidian 提示框类型：  
- `[!quote]` — 蓝色  
- `[!check]` — 绿色  
- `[!note]` — 青色  
- `[!tip]` — 紫色  
- `[!warning]` — 橙色  
- `[!danger]` — 红色  

### 自定义 Telegram 通知

编辑 `monitor_and_save.sh` 修改提醒文本或添加自定义通知。

## 最佳实践

1. **每日结束时运行按小时分组** — 作为组织工具，而非备份手段  
2. **保持增量备份持续运行** — 这是您的安全网  
3. **设置后测试脚本** — 首先手动运行以验证输出  
4. **备份跟踪文件** — 将 `.last_snapshot_timestamp` 纳入仓库备份范围  
5. **使用描述性主题名称** — 全量快照时请使用有意义的名称  

## 示例工作流

**日常流程：**  
1. 每小时自动增量备份（无需人工干预）  
2. 每日结束时：`scripts/create_hourly_snapshots.sh 2026-01-20`  
3. 在 Obsidian 中审阅组织好的按小时文件  
4. 如需，可手动删除旧的增量备份（按小时分组已涵盖全部内容）  

**执行 /new 重置前：**  
1. （可选）`scripts/save_full_snapshot.sh before-reset`  
2. 安全运行 `/new` — 对话已备份完成  
3. 继续聊天 — 增量备份将自动恢复  

## 与 Clawdbot 集成

本技能支持以下功能：  
- **HEARTBEAT.md**：自动 Token 监控  
- **MEMORY.md**：对话归档系统  
- **Telegram 集成**：警告通知  
- **任意 Obsidian 仓库**：兼容现有仓库  

## 致谢

由 Clawdbot 社区开发，旨在提供可靠的对话备份与精美的 Obsidian 格式体验。