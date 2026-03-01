---
name: morning-email-rollup
name_zh: 早间邮件汇总
description: 每日早晨 8 点（丹佛时间）AI 生成的重要邮件与日历事件汇总简报
description_zh: 每日早晨 8 点（丹佛时间）AI 生成的重要邮件与日历事件汇总简报
metadata: {"clawdbot":{"emoji":"📧","requires":{"bins":["gog","gemini","jq","date"]}}}
---
# 早晨邮件汇总

每日自动汇总重要邮件，并于丹佛时间上午 8 点通过 Telegram 发送 AI 生成的摘要。

## 设置

**必需：** 设置您的 Gmail 账户邮箱：
```bash
export GOG_ACCOUNT="your-email@gmail.com"
```

或直接编辑脚本以设定默认值。

## 功能说明

- 每日上午 8:00（可配置时区）准时运行  
- **展示今日 Google 日历事件**  
- 搜索过去 24 小时内被标记为 **重要** 或 **已加星标** 的邮件  
- 利用 AI（Gemini CLI）为每封邮件生成自然语言摘要  
- 最多展示 20 封最重要邮件，内容包括：  
  - 🔴 未读标识（红色）  
  - 🟢 已读标识（绿色）  
  - 发件人姓名/邮箱  
  - 主题行  
  - **AI 生成的 1 句话摘要**（自然语言，非原始内容抓取）  
- 将格式化后的摘要发送至 Telegram  

## 使用方法

### 手动运行
```bash
# Default (10 emails)
bash skills/morning-email-rollup/rollup.sh

# Custom number of emails
MAX_EMAILS=20 bash skills/morning-email-rollup/rollup.sh
MAX_EMAILS=5 bash skills/morning-email-rollup/rollup.sh
```

### 查看日志
```bash
cat $HOME/clawd/morning-email-rollup-log.md
```

## 工作原理

1. **检查日历** — 通过 `gog` 查询 Google 日历，列出今日事件  
2. **搜索 Gmail** — 查询语句：`is:important OR is:starred newer_than:1d`  
3. **获取邮件详情** — 提取每封邮件的发件人、主题、日期与正文  
4. **AI 摘要生成** — 使用 Gemini CLI 生成自然语言摘要  
5. **格式化输出** — 创建带已读/未读标识的易读摘要  
6. **发送至 Telegram** — 通过 Clawdbot 消息系统投递  

## 日历集成

脚本自动从您的 Google 日历中提取今日事件，使用与查询 Gmail 相同的 `gog` CLI。

**优雅降级机制：**  
- 若 `gog` 未安装 → 日历部分将静默跳过（不报错）  
- 若今日无事件 → 日历部分将静默跳过  
- 若存在事件 → 以 12 小时制时间与标题形式展示格式化列表  

**前提要求：**  
- `gog` 必须已安装并完成身份验证  
- 使用与 Gmail 配置相同的 Google 账户（通过 `GOG_ACCOUNT` 环境变量设定）  

## 邮件筛选条件

满足以下任一条件的邮件将被纳入汇总：  
- 被 Gmail 标记为 **重要**（闪电图标）  
- 被您手动 **加星标**  
- 在 **过去 24 小时内接收**  

## AI 摘要生成

每封邮件均通过 Gemini CLI（`gemini`）生成摘要：  
- 提取邮件正文（清理 HTML/CSS）  
- 将其作为输入传给 `gemini --model gemini-2.0-flash`，并附带“用一句话总结”的提示词  
- 摘要为中至长篇幅的自然语言（非原始内容抓取）  
- 若 Gemini 不可用，则回退至已清理的正文文本  

**重要说明：** 邮件正文作为提示词的一部分传入（而非通过 stdin），因为 gemini CLI 无法正确处理带提示词的管道输入。

**示例输出：**  
```
🔴 **William Ryan: Invitation to team meeting**
   The email invites you to a team meeting tomorrow at 2pm to discuss the Q1 roadmap and assign tasks for the upcoming sprint.
```

## 已读/未读标识

- 🔴 红点 = 未读邮件  
- 🟢 绿点 = 已读邮件  

所有邮件均显示其中一种标识，确保 Telegram/其他渠道中视觉一致性。

## 格式化说明

**主题与摘要清理：**  
- 主题行中的多余引号将自动移除（例如 `""Agent Skills""` → `Agent Skills`）  
- Gemini 生成的摘要同样会清理首尾引号  
- 确保 Telegram 或其他渠道中输出整洁、易读  

## Cron 调度

在您偏好的时间设置每日 cron 任务：  
```bash
cron add --name "Morning Email Rollup" \
  --schedule "0 8 * * *" \
  --tz "America/Denver" \
  --session isolated \
  --message "GOG_ACCOUNT=your-email@gmail.com bash /path/to/skills/morning-email-rollup/rollup.sh"
```  

请根据需要调整时间（上午 8:00）与时区。

## 自定义选项

### 更改邮件数量

默认汇总 **10 封邮件**。如需更改：

**临时（单次）：**  
```bash
MAX_EMAILS=20 bash skills/morning-email-rollup/rollup.sh
```

**永久：**  
编辑 `skills/morning-email-rollup/rollup.sh`：  
```bash
MAX_EMAILS="${MAX_EMAILS:-20}"  # Change 10 to your preferred number
```

### 更改搜索条件

编辑 `skills/morning-email-rollup/rollup.sh`：  

```bash
# Current: important or starred from last 24h
IMPORTANT_EMAILS=$(gog gmail search 'is:important OR is:starred newer_than:1d' --max 20 ...)

# Examples of other searches:
# Unread important emails only
IMPORTANT_EMAILS=$(gog gmail search 'is:important is:unread newer_than:1d' --max 20 ...)

# Specific senders
IMPORTANT_EMAILS=$(gog gmail search 'from:boss@company.com OR from:client@example.com newer_than:1d' --max 20 ...)

# By label/category
IMPORTANT_EMAILS=$(gog gmail search 'label:work is:important newer_than:1d' --max 20 ...)
```

### 更改执行时间

更新 cron 调度：  
```bash
# List cron jobs to get the ID
cron list

# Update schedule (example: 7am instead of 8am)
cron update <job-id> --schedule "0 7 * * *" --tz "America/Denver"
```

### 更改摘要风格

编辑 `summarize_email()` 函数中的提示词（位于 `rollup.sh` 文件中）：  

```bash
# Current: medium-to-long 1 sentence
"Summarize this email in exactly 1 sentence of natural language. Make it medium to long length. Don't use quotes:"

# Shorter summaries
"Summarize in 1 short sentence:"

# More detail
"Summarize in 2-3 sentences with key details:"
```

### 更换 AI 模型

编辑 `summarize_email()` 中的 gemini 命令：  
```bash
# Current: gemini-2.0-flash (fast)
gemini --model gemini-2.0-flash "Summarize..."

# Use a different model
gemini --model gemini-pro "Summarize..."
```

## 故障排除

### 未收到汇总简报  
```bash
# Check if cron job is enabled
cron list

# Check last run status
cron runs <job-id>

# Test manually
bash skills/morning-email-rollup/rollup.sh
```

### 邮件缺失  
- Gmail 的重要性标记可能过滤掉预期邮件  
- 请确认邮件确实在 Gmail 中被标记为“重要”或“已加星标”  
- 尝试手动执行搜索：`gog gmail search 'is:important newer_than:1d'`

### 摘要未生成  
- 检查 `gemini` CLI 是否已安装：`which gemini`  
- 手动测试：`echo "test" | gemini "Summarize this:"`  
- 验证 Gemini 是否已完成身份验证（首次运行时应有提示）

### 时区错误  
- Cron 使用 `America/Denver`（MST/MDT）  
- 更新方式：`cron update <job-id> --tz "Your/Timezone"`

## 日志历史

所有汇总运行记录均保存至：  
```
$HOME/clawd/morning-email-rollup-log.md
```  

日志格式：  
```markdown
- [2026-01-15 08:00:00] 🔄 Starting morning email rollup
- [2026-01-15 08:00:02] ✅ Rollup complete: 15 emails
```