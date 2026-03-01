---
name: clawdbot-jira-skill
name_zh: ClawdBot Jira技能
description: 通过 Jira Cloud REST API 管理 Jira 问题、状态流转与工作日志。
description_zh: 通过 Jira Cloud REST API 管理 Jira 问题、状态流转与工作日志。
homepage: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
metadata:
  {
    "clawdbot":
      {
        "emoji": "🧭",
        "requires":
          {
            "bins": ["curl", "jq", "bc", "python3"],
            "env": ["JIRA_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
            "optional_env": ["JIRA_BOARD"],
          },
      },
  }
---
# Jira Skill

通过 Clawdbot 操作 Jira 问题与工作日志（搜索、查看状态、创建问题、记录工时、汇总工作日志）。

## 设置步骤

1. 获取您的 API 密钥：https://id.atlassian.com/manage-profile/security/api-tokens  
2. 点击“创建 API Token”  
3. 设置环境变量：  
   ```bash
   export JIRA_EMAIL="you@example.com"
   export JIRA_API_TOKEN="your-api-token"
   export JIRA_URL="https://your-domain.atlassian.net"
   # Optional project scope (comma-separated). Empty = search all.
   export JIRA_BOARD="ABC"
   ```  

需配置 `curl`、`jq`、`bc` 与 `python3`。

## 快捷命令

所有命令位于 `{baseDir}/scripts/jira.sh` 中。

- `{baseDir}/scripts/jira.sh search "timeout" [max]` —— 在 `JIRA_BOARD` 内按摘要或问题编号模糊搜索  
- `{baseDir}/scripts/jira.sh link ABC-123` —— 生成问题的浏览器链接  
- `{baseDir}/scripts/jira.sh issue ABC-123` —— 快速查看问题详情  
- `{baseDir}/scripts/jira.sh status ABC-123 "In Progress"` —— 移动问题（自动校验可用的状态流转）  
- `{baseDir}/scripts/jira.sh transitions ABC-123` —— 列出允许的状态流转  
- `{baseDir}/scripts/jira.sh assign ABC-123 "name or email"` —— 通过用户搜索分配问题  
- `{baseDir}/scripts/jira.sh assign-me ABC-123` —— 将问题分配给自己  
- `{baseDir}/scripts/jira.sh comment ABC-123 "text"` —— 添加评论  
- `{baseDir}/scripts/jira.sh create "Title" ["Description"]` —— 在 `JIRA_BOARD` 中创建 Task  
- `{baseDir}/scripts/jira.sh log ABC-123 2.5 [YYYY-MM-DD]` —— 记录工时（默认为当前 UTC 时间）  
- `{baseDir}/scripts/jira.sh my [max]` —— 查看分配给您的待处理问题  
- `{baseDir}/scripts/jira.sh hours 2025-01-01 2025-01-07` —— 按问题汇总您记录的工时（JSON 格式）  
- `{baseDir}/scripts/jira.sh hours-day 2025-01-07 [name|email]` —— 按天汇总所有人记录的工时（按用户/问题分组）；支持可选筛选器（姓名/邮箱；亦可解析为 accountId）  
- `{baseDir}/scripts/jira.sh hours-issue ABC-123 [name|email]` —— 汇总某问题下的全部工时；支持可选筛选器（姓名/邮箱；亦可解析为 accountId）  

## 命令参考

- **搜索问题**  

  ```bash
  {baseDir}/scripts/jira.sh search "payment failure" [maxResults]
  ```  

- **问题链接**  

  ```bash
  {baseDir}/scripts/jira.sh link ABC-321
  ```  

- **问题详情**  

  ```bash
  {baseDir}/scripts/jira.sh issue ABC-321
  ```  

- **更新状态**  

  ```bash
  {baseDir}/scripts/jira.sh status ABC-321 "Done"
  ```  

- **列出状态流转**  

  ```bash
  {baseDir}/scripts/jira.sh transitions ABC-321
  ```  

- **分配问题**  

  ```bash
  {baseDir}/scripts/jira.sh assign ABC-321 "Jane Doe"
  ```  

- **分配给自己**  

  ```bash
  {baseDir}/scripts/jira.sh assign-me ABC-321
  ```  

- **添加评论**  

  ```bash
  {baseDir}/scripts/jira.sh comment ABC-321 "Deployed to staging"
  ```  

- **创建问题**  

  ```bash
  {baseDir}/scripts/jira.sh create "Fix auth timeout" "Users being logged out after 5m"
  ```  

- **记录工时**  

  ```bash
  {baseDir}/scripts/jira.sh log PB-321 1.5 2025-01-18
  ```  

- **我的待处理问题**  

  ```bash
  {baseDir}/scripts/jira.sh my [maxResults]
  ```  

- **按问题汇总我的工时**  

  ```bash
  {baseDir}/scripts/jira.sh hours 2025-01-01 2025-01-05
  ```  

- **按天汇总所有人的工时**  

  ```bash
  {baseDir}/scripts/jira.sh hours-day 2025-01-05
  ```  

- **按天汇总指定用户的工时**  

  ```bash
  {baseDir}/scripts/jira.sh hours-day 2025-01-05 "jane"
  ```  

- **汇总某问题下的工时**  
  ```bash
  {baseDir}/scripts/jira.sh hours-issue ABC-321 "jane"
  ```  

## 注意事项

- 工作日志相关命令使用 Jira 的 `worklog/updated` 与 `worklog/list` 组合接口，在大型项目中可能需要数秒响应。  
- `hours` 按 `JIRA_EMAIL` 过滤；`hours-day` 返回所有用户及其各问题的工时总计。  
- 工时相关命令的输出均为 JSON 格式，便于在其他工具中复用。  
- 状态流转操作会在提交前，严格校验服务器提供的合法流转列表。  