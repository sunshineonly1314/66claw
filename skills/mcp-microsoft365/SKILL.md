---
name: mcp-microsoft365
description: 通过模型上下文协议（MCP）实现完整的 Microsoft 365 集成。
description_zh: 通过模型上下文协议（MCP）实现完整的 Microsoft 365 集成。
---
# Microsoft 365 MCP 服务器

通过模型上下文协议（MCP）实现完整的 Microsoft 365 集成。

## 功能特性

### 📧 邮件（Outlook）
- 列出、读取、发送和搜索邮件  
- 按文件夹（收件箱、已发送、草稿）筛选  
- 支持 HTML 邮件  

### 📅 日历
- 列出与创建日程事件  
- Teams 会议集成  
- 查询空闲/忙碌状态  

### 📁 OneDrive
- 浏览文件与文件夹  
- 搜索文件  
- 读取文件内容  

### ✅ 任务（Microsoft To-Do）
- 列出任务清单  
- 创建与管理任务  
- 设置重要性与截止日期  

### 💬 Teams
- 列出聊天会话  
- 读取与发送消息  

### 👥 用户
- 列出组织内用户  
- 获取用户个人资料  

## 前提要求

- Node.js 18+  
- 已配置 Microsoft Graph 权限的 Azure Entra ID 应用  

## 配置步骤

### 1. 创建 Azure Entra ID 应用

1. 访问 [Azure 门户](https://portal.azure.com)  
2. 导航至 **Microsoft Entra ID** → **应用注册** → **新建注册**  
3. 配置如下：  
   - 名称：`MCP-Microsoft365`  
   - 支持的账户类型：单租户（推荐）  
   - 重定向 URI：`http://localhost:3000/callback`  

### 2. 添加 API 权限

为 Microsoft Graph 添加以下 **应用权限（Application permissions）**：

```
Mail.Read, Mail.Send, Mail.ReadWrite
Calendars.Read, Calendars.ReadWrite
Files.Read.All, Files.ReadWrite.All
Tasks.Read.All, Tasks.ReadWrite.All
Chat.Read.All, Chat.ReadWrite.All
User.Read.All
```

**重要提示：** 点击“授予管理员同意”

### 3. 获取凭据

请保存以下值：  
- 应用（客户端）ID  
- 目录（租户）ID  
- 客户端密钥（在“证书与密钥”下创建）

### 4. 安装

```bash
# Clone/download the skill
cd mcp-microsoft365

# Install dependencies
npm install

# Build
npm run build
```

### 5. 配置 mcporter

```bash
mcporter config add m365 --stdio "node /path/to/mcp-microsoft365/dist/index.js"
```

编辑 `config/mcporter.json` 文件，添加环境变量：

```json
{
  "mcpServers": {
    "m365": {
      "command": "node /path/to/dist/index.js",
      "env": {
        "TENANT_ID": "your-tenant-id",
        "CLIENT_ID": "your-client-id",
        "CLIENT_SECRET": "your-client-secret",
        "DEFAULT_USER": "user@yourdomain.com"
      }
    }
  }
}
```

## 使用方式

### 邮件  
```bash
# List recent emails
mcporter call m365.m365_mail_list top:5

# Send email
mcporter call m365.m365_mail_send to:"recipient@email.com" subject:"Hello" body:"<p>Hi!</p>"

# Search
mcporter call m365.m365_mail_search query:"important"
```

### 日历  
```bash
# List events
mcporter call m365.m365_calendar_list top:10

# Create event with Teams meeting
mcporter call m365.m365_calendar_create subject:"Team Sync" start:"2026-01-27T10:00:00" end:"2026-01-27T11:00:00" isOnline:true
```

### 文件  
```bash
# List OneDrive root
mcporter call m365.m365_files_list

# Search files
mcporter call m365.m365_files_search query:"report"
```

### 任务  
```bash
# List task lists
mcporter call m365.m365_tasks_lists
```

### Teams  
```bash
# List chats
mcporter call m365.m365_teams_chats top:10
```

## 19 个可用工具

| 工具 | 描述 |
|------|-------------|
| `m365_mail_list` | 列出邮件 |
| `m365_mail_read` | 根据 ID 读取邮件 |
| `m365_mail_send` | 发送邮件 |
| `m365_mail_search` | 搜索邮件 |
| `m365_calendar_list` | 列出日程事件 |
| `m365_calendar_create` | 创建日程事件 |
| `m365_calendar_availability` | 查询空闲/忙碌状态 |
| `m365_files_list` | 列出文件 |
| `m365_files_search` | 搜索文件 |
| `m365_files_read` | 读取文件内容 |
| `m365_files_info` | 获取文件元数据 |
| `m365_tasks_lists` | 列出任务清单 |
| `m365_tasks_list` | 列出任务 |
| `m365_tasks_create` | 创建任务 |
| `m365_teams_chats` | 列出聊天会话 |
| `m365_teams_messages` | 读取消息 |
| `m365_teams_send` | 发送消息 |
| `m365_users_list` | 列出用户 |
| `m365_user_info` | 获取用户个人资料 |

## 作者

**Mahmoud Alkhatib**  
- 网站：[malkhatib.com](https://malkhatib.com)  
- YouTube：[@malkhatib](https://youtube.com/@malkhatib)  
- Twitter：[@malkhateeb](https://twitter.com/malkhateeb)  

## 许可证

MIT