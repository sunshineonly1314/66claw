---
name: ms365
description: 通过 MS Graph API 接入 Microsoft 365 服务——包括邮件（Outlook）、日历、OneDrive、待办事项（To Do）及联系人。
description_zh: 通过 MS Graph API 接入 Microsoft 365 服务——包括邮件（Outlook）、日历、OneDrive、待办事项（To Do）及联系人。
---
# Microsoft 365 集成

## 描述  
通过 MS Graph API 接入 Microsoft 365 服务——包括邮件（Outlook）、日历、OneDrive、待办事项（To Do）及联系人。

## 激活条件  
当用户提及以下任一关键词时激活：outlook、email、calendar、onedrive、microsoft、office 365、o365、ms365、my meetings、my emails、schedule meeting、send email、check calendar、to do、microsoft tasks

## 配置说明  
首次登录后，身份验证信息将被缓存。若采用设备代码流，则无需设置环境变量。

如需无头（headless）或自动化运行，请设置以下环境变量：  
- `MS365_MCP_CLIENT_ID` — Azure AD 应用的客户端 ID  
- `MS365_MCP_CLIENT_SECRET` — Azure AD 应用的密钥  
- `MS365_MCP_TENANT_ID` — 租户 ID（个人账户请使用 `"consumers"`）

## 可用命令

### 身份验证  

```bash
# Login via device code (interactive)
python3 /root/clawd/skills/ms365/ms365_cli.py login

# Check authentication status
python3 /root/clawd/skills/ms365/ms365_cli.py status

# List cached accounts
python3 /root/clawd/skills/ms365/ms365_cli.py accounts

# Get current user info
python3 /root/clawd/skills/ms365/ms365_cli.py user
```  

### 邮件（Outlook）  

```bash
# List recent emails
python3 /root/clawd/skills/ms365/ms365_cli.py mail list [--top N]

# Read specific email
python3 /root/clawd/skills/ms365/ms365_cli.py mail read MESSAGE_ID

# Send email
python3 /root/clawd/skills/ms365/ms365_cli.py mail send --to "recipient@example.com" --subject "Subject" --body "Message body"
```  

### 日历  

```bash
# List upcoming events
python3 /root/clawd/skills/ms365/ms365_cli.py calendar list [--top N]

# Create event
python3 /root/clawd/skills/ms365/ms365_cli.py calendar create --subject "Meeting" --start "2026-01-15T10:00:00" --end "2026-01-15T11:00:00" [--body "Description"] [--timezone "America/Chicago"]
```  

### OneDrive 文件  

```bash
# List files in root
python3 /root/clawd/skills/ms365/ms365_cli.py files list

# List files in folder
python3 /root/clawd/skills/ms365/ms365_cli.py files list --path "Documents"
```  

### 待办事项（To Do）  

```bash
# List task lists
python3 /root/clawd/skills/ms365/ms365_cli.py tasks lists

# Get tasks from a list
python3 /root/clawd/skills/ms365/ms365_cli.py tasks get LIST_ID

# Create task
python3 /root/clawd/skills/ms365/ms365_cli.py tasks create LIST_ID --title "Task title" [--due "2026-01-20"]
```  

### 联系人  

```bash
# List contacts
python3 /root/clawd/skills/ms365/ms365_cli.py contacts list [--top N]

# Search contacts
python3 /root/clawd/skills/ms365/ms365_cli.py contacts search "John"
```  

## 使用示例  

用户：“检查我的 Outlook 邮件”  
Agent：执行 `mail list --top 10` 命令  

用户：“我今天有哪些会议？”  
Agent：执行 `calendar list` 命令  

用户：“给 john@company.com 发一封关于项目进展的邮件”  
Agent：执行 `mail send` 并传入相应参数  

用户：“显示我的 OneDrive 文件”  
Agent：执行 `files list` 命令  

用户：“添加一项任务：复核预算”  
Agent：先列出可用任务列表，再在合适列表中创建任务  

## 提示语（Prompts）

在协助处理 Microsoft 365 相关事务时：  
- 所有操作均通过 `ms365_cli.py` 脚本执行  
- 若命令失败，请首先检查身份验证状态  
- 若尚未登录，请引导用户完成设备代码登录流程  
- 处理日历事件时，请使用 ISO 8601 时间格式  
- 默认时区为 America/Chicago  
- 发送邮件前，请向用户确认收件人与邮件正文内容  
- 处理任务时，请先列出可用任务列表，以便用户选择目标列表  

## 版权声明  

本 skill 基于 Softeria 开发的 **ms-365-mcp-server**。  
- **NPM 包**：[@softeria/ms-365-mcp-server](https://www.npmjs.com/package/@softeria/ms-365-mcp-server)  
- **GitHub 仓库**：https://github.com/Softeria/ms-365-mcp-server  
- **许可证**：MIT  