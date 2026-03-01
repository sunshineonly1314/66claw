---
name: n8n-workflow-automation
name_zh: n8n工作流自动化
description: 设计并输出具备健壮触发机制、幂等性、错误处理、日志记录、重试逻辑及人工审核队列（human-in-the-loop review queues）的 n8n 工作流 JSON。适用于需要可审计、不会静默失败的自动化场景。
description_zh: 设计并输出具备健壮触发机制、幂等性、错误处理、日志记录、重试逻辑及人工审核队列（human-in-the-loop review queues）的 n8n 工作流 JSON。适用于需要可审计、不会静默失败的自动化场景。
---
# 具备重试、日志与审核队列的 n8n 工作流自动化

## 目的
设计并输出具备健壮触发机制、幂等性、错误处理、日志记录、重试逻辑及人工审核队列（human-in-the-loop review queues）的 n8n 工作流 JSON。

## 使用时机
- 触发机制（TRIGGERS）：  
  - 构建一个每周一运行、并发送合规性摘要邮件的 n8n 工作流。  
  - 为该工作流添加错误处理与重试机制，并配置失败项的人工审核队列。  
  - 创建一个 Webhook 工作流，记录每次运行日志，并向追踪表写入状态行。  
  - 使该 n8n 流程具备幂等性，避免重跑时重复生成记录。  
  - 为该工作流注入审计日志能力，并加入人工审批步骤。  
- **不适用场景（DO NOT USE WHEN…）：**  
  - 仅需纯代码自动化而无需 n8n（请使用脚本/CI 类 skill）。  
  - 需绕过安全控制或隐藏审计痕迹。  
  - 需采购或推荐禁用物品/服务。

## 输入
- 必需项（REQUIRED）：  
  - 工作流意图：触发类型 + 调度计划/时区 + 成功判定标准。  
  - 目标位置：结果写入位置（邮件/云盘/表格/数据库）及所需字段。  
- 可选项（OPTIONAL）：  
  - 待修改的现有 n8n 工作流 JSON。  
  - 示例载荷（sample payloads）或示例记录。  
  - 去重键（dedup keys）定义（即：何种字段组合可唯一标识一条记录）。  
- 示例（EXAMPLES）：  
  - Cron：每周一 08:00（欧洲/伦敦时区）；发送摘要邮件 + 上传至云盘  
  - Webhook：接收 JSON；按规则路由至不同文件夹  

## 输出
- 默认（只读）：一份工作流设计规范（含节点结构、数据契约、失败模式）。  
- 若明确要求输出 JSON：`workflow.json`（n8n 可导入 JSON） + `runbook.md`（基于模板生成）。  
成功标准 = 工作流具备幂等性、每次运行均记录日志、重试安全可靠、且失败项自动路由至审核队列。

## 工作流流程（WORKFLOW）
1. 明确触发机制：  
   - Cron / Webhook / 手动；调度计划/时区；并发预期。  
2. 定义数据契约（data contract）：  
   - 输入 Schema、必填字段及校验规则。  
3. 设计幂等性机制：  
   - 选定去重键（dedup key(s)）及存储位置（DB/表格），防止重试时产生重复记录。  
4. 添加可观测性（observability）：  
   - 生成 `run_id`，记录运行起止时间，保存状态行及错误详情。  
5. 实现错误处理：  
   - 为各节点配置错误分支、带退避（backoff）的重试机制，以及最终失败通知。  
6. 添加人工审核队列（HITL review queue）：  
   - 将失败项写入队列（表格/数据库），并强制要求人工审批后方可重处理。  
7. “零静默失败”防护门（“No silent failure” gates）：  
   - 若实际计数/阈值未达标，则中止工作流并发出告警。  
8. 输出：  
   - 若用户明确请求 JSON：生成可导入的 n8n 工作流 JSON + 运行手册（runbook）。  
9. 遇到以下情况须**立即暂停并询问用户**：  
   - 目标系统未知；  
   - 无可用去重键；  
   - 凭据策略（如环境变量）未明确指定；  
   - 工作流需调用尚未获批的特权访问权限。

## 输出格式（OUTPUT FORMAT）
若输出 **n8n 工作流 JSON**，须符合：

```json
{
  "name": "<workflow name>",
  "nodes": [ { "name": "Trigger", "type": "n8n-nodes-base.cron", "parameters": {}, "position": [0,0] } ],
  "connections": {},
  "settings": {},
  "active": false
}
```

同时输出 `runbook.md`，使用 `assets/runbook-template.md` 生成。

## 安全性与边界情况（SAFETY & EDGE CASES）
- 默认为只读；仅当用户明确请求时才输出工作流 JSON。  
- JSON 中不得包含任何密钥（secrets）；仅引用环境变量名或凭据名称。  
- 必须包含审计日志 + 失败通知；禁止设计可能静默丢弃数据的工作流。  
- 遵循最小权限原则：仅调用必需的 API，尽可能缩小作用域（scopes）。

## 示例（EXAMPLES）
- 输入：“每周一 Cron 触发，发送合规性摘要邮件，失败时重试。”  
  输出：节点映射图 + `workflow.json`，含 Cron → 获取数据 → 聚合 → 发送邮件，以及指向审核队列的错误分支。

- 输入：“接收 Webhook 的工作流，需记录每次运行并写入状态行。”  
  输出：Webhook → 校验 → 处理 → 追加状态行；出错时 → 记录日志 + 发送通知 + 加入队列。