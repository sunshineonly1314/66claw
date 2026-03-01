---
name: causal-inference
name_zh: 因果推断
description: 为 agent actions 添加因果推理能力。在任意高层级 action（具备可观测结果者）上触发——包括邮件、消息、日历变更、文件操作、API 调用、通知、提醒、购买、部署等。可用于规划干预措施、调试失败原因、预测结果、回填历史数据以供分析，或回答“如果我执行 X，会发生什么？”。亦可在回顾过往 action 时触发，以理解哪些有效/无效及其原因。
description_zh: 为 agent actions 添加因果推理能力。在任意高层级 action（具备可观测结果者）上触发——包括邮件、消息、日历变更、文件操作、API 调用、通知、提醒、购买、部署等。可用于规划干预措施、调试失败原因、预测结果、回填历史数据以供分析，或回答“如果我执行 X，会发生什么？”。亦可在回顾过往 action 时触发，以理解哪些有效/无效及其原因。
---
# 因果推断

一种轻量级因果层，旨在预测 action 的结果：不依赖相关性模式匹配，而是建模干预与反事实（counterfactuals）。

## 核心不变式（Core Invariant）

**每个 action 都必须能被明确表征为对某个因果模型的干预，附带预测效应 + 不确定性度量 + 可证伪的审计轨迹。**  

计划必须是 *因果有效的（causally valid）*，而不仅是看似合理（plausible）。

## 触发时机

**在任意高层级 action 上触发本 skill**，包括但不限于：

| 领域 | 应记录的 action |
|------|----------------|
| **通信** | 发送邮件、发送消息、回复、跟进、通知、提及 |
| **日历** | 创建/移动/取消会议、设置提醒、RSVP |
| **任务** | 创建/完成/延后任务、设置优先级、指派任务 |
| **文件** | 创建/编辑/共享文档、提交代码、部署 |
| **社交** | 发帖、点赞、评论、转发、私信 |
| **购买** | 下单、订阅、取消、退款 |
| **系统** | 配置变更、权限授予、集成设置 |

此外，还应在以下情形触发：
- **回顾结果** —— “那封邮件收到回复了吗？” → 记录结果，更新估计值  
- **调试失败** —— “为什么这没起作用？” → 追溯因果图  
- **回填历史** —— “分析我过去的邮件/日历” → 解析日志，重建 action  
- **规划决策** —— “我现在发还是稍后发？” → 查询因果模型  

## 回填：基于历史数据启动

勿从零开始。解析现有日志，重建过往 action 及其结果。

### 邮件回填

```bash
# Extract sent emails with reply status
gog gmail list --sent --after 2024-01-01 --format json > /tmp/sent_emails.json

# For each sent email, check if reply exists
python3 scripts/backfill_email.py /tmp/sent_emails.json
```  

### 日历回填

```bash
# Extract past events with attendance
gog calendar list --after 2024-01-01 --format json > /tmp/events.json

# Reconstruct: did meeting happen? was it moved? attendee count?
python3 scripts/backfill_calendar.py /tmp/events.json
```  

### 消息回填（WhatsApp/Discord/Slack）

```bash
# Parse message history for send/reply patterns
wacli search --after 2024-01-01 --from me --format json > /tmp/wa_sent.json
python3 scripts/backfill_messages.py /tmp/wa_sent.json
```  

### 通用回填模式

```python
# For any historical data source:
for record in historical_data:
    action_event = {
        "action": infer_action_type(record),
        "context": extract_context(record),
        "time": record["timestamp"],
        "pre_state": reconstruct_pre_state(record),
        "post_state": extract_post_state(record),
        "outcome": determine_outcome(record),
        "backfilled": True  # Mark as reconstructed
    }
    append_to_log(action_event)
```  

## 架构

### A. Action 日志（必需）

每次执行的 action 均生成结构化事件：

```json
{
  "action": "send_followup",
  "domain": "email",
  "context": {"recipient_type": "warm_lead", "prior_touches": 2},
  "time": "2025-01-26T10:00:00Z",
  "pre_state": {"days_since_last_contact": 7},
  "post_state": {"reply_received": true, "reply_delay_hours": 4},
  "outcome": "positive_reply",
  "outcome_observed_at": "2025-01-26T14:00:00Z",
  "backfilled": false
}
```  

存储于 `memory/causal/action_log.jsonl`。

### B. 因果图（按领域）

每领域初始定义 10–30 个可观测变量。

**邮件领域：**  
```
send_time → reply_prob
subject_style → open_rate
recipient_type → reply_prob
followup_count → reply_prob (diminishing)
time_since_last → reply_prob
```  

**日历领域：**  
```
meeting_time → attendance_rate
attendee_count → slip_risk
conflict_degree → reschedule_prob
buffer_time → focus_quality
```  

**消息领域：**  
```
response_delay → conversation_continuation
message_length → response_length
time_of_day → response_prob
platform → response_delay
```  

**任务领域：**  
```
due_date_proximity → completion_prob
priority_level → completion_speed
task_size → deferral_risk
context_switches → error_rate
```  

图定义存储于 `memory/causal/graphs/`。

### C. 估计模块

对每个“可调参数”（干预变量），估计其处理效应：

```python
# Pseudo: effect of morning vs evening sends
effect = mean(reply_prob | send_time=morning) - mean(reply_prob | send_time=evening)
uncertainty = std_error(effect)
```  

优先采用简单回归或倾向得分匹配；当因果图明确且需验证可识别性时，再进阶至 do-演算。

### D. 决策策略

在执行 action 前：

1. 识别干预变量（组）  
2. 查询因果模型，获取预期结果分布  
3. 计算期望效用及不确定性边界  
4. 若不确定性 > 阈值，或预期损害 > 阈值 → 拒绝执行或交由用户确认  
5. 记录预测结果，供后续验证  

## 工作流

### 每次 action 执行时

```
BEFORE executing:
1. Log pre_state
2. If enough historical data: query model for expected outcome
3. If high uncertainty or risk: confirm with user

AFTER executing:
1. Log action + context + time
2. Set reminder to check outcome (if not immediate)

WHEN outcome observed:
1. Update action log with post_state + outcome
2. Re-estimate treatment effects if enough new data
```  

### 规划某项 action 时

```
1. User request → identify candidate actions
2. For each action:
   a. Map to intervention(s) on causal graph
   b. Predict P(outcome | do(action))
   c. Estimate uncertainty
   d. Compute expected utility
3. Rank by expected utility, filter by safety
4. Execute best action, log prediction
5. Observe outcome, update model
```  

### 调试失败时

```
1. Identify failed outcome
2. Trace back through causal graph
3. For each upstream node:
   a. Was the value as expected?
   b. Did the causal link hold?
4. Identify broken link(s)
5. Compute minimal intervention set that would have prevented failure
6. Log counterfactual for learning
```  

## 快速启动：今日即可启动

```bash
# 1. Create the infrastructure
mkdir -p memory/causal/graphs memory/causal/estimates

# 2. Initialize config
cat > memory/causal/config.yaml << 'EOF'
domains:
  - email
  - calendar
  - messaging
  - tasks

thresholds:
  max_uncertainty: 0.3
  min_expected_utility: 0.1

protected_actions:
  - delete_email
  - cancel_meeting
  - send_to_new_contact
  - financial_transaction
EOF

# 3. Backfill one domain (start with email)
python3 scripts/backfill_email.py

# 4. Estimate initial effects
python3 scripts/estimate_effect.py --treatment send_time --outcome reply_received --values morning,evening
```  

## 安全约束

定义需显式用户批准的“受保护变量”：

```yaml
protected:
  - delete_email
  - cancel_meeting
  - send_to_new_contact
  - financial_transaction

thresholds:
  max_uncertainty: 0.3  # don't act if P(outcome) uncertainty > 30%
  min_expected_utility: 0.1  # don't act if expected gain < 10%
```  

## 文件

- `memory/causal/action_log.jsonl` —— 所有带结果的已记录 action  
- `memory/causal/graphs/` —— 领域专属因果图定义  
- `memory/causal/estimates/` —— 已学习的处理效应  
- `memory/causal/config.yaml` —— 安全阈值与受保护变量  

## 参考文献

- 形式化干预语义详见 `references/do-calculus.md`  
- 处理效应估计方法详见 `references/estimation.md`  