---
name: supabase-users
name_zh: Supabase用户管理
description: 查询 Supabase 项目——统计用户数、列出注册用户、查看统计数据。适用于数据库查询与用户分析。
description_zh: 查询 Supabase 项目——统计用户数、列出注册用户、查看统计数据。适用于数据库查询与用户分析。
triggers:
  - supabase
  - database
  - how many users
  - new signups
  - user count
metadata:
  clawdbot:
    emoji: "⚡"
---
# Supabase ⚡

直接从聊天界面查询您的 Supabase 项目。

## 配置步骤

### 1. 获取凭据

前往 **Supabase 控制台 → 项目设置 → API**

您将看到两个标签页：
- **“可发布密钥与密钥 API 密钥”** —— 新格式（功能受限）
- **“旧版 anon / service_role API 密钥”** —— JWT 格式（功能完整）

**⚠️ 请使用旧版 JWT 密钥以获得完整访问权限！**

`service_role` JWT 密钥（以 `eyJ...` 开头）提供完整的管理员权限，包括：
- 列出含详细信息的用户
- 统计注册用户数
- 访问 `auth.users` 表

新版 `sb_secret_...` 密钥功能受限，无法访问 Admin API。

### 2. 查找您的密钥

1. 前往：**项目设置 → API**
2. 点击 **“旧版 anon, service_role API 密钥”** 标签页
3. 找到 `service_role`（标有红色 “secret” 徽章）
4. 点击 **Reveal（显示）** 并复制 `eyJ...` 令牌

直达链接：`https://supabase.com/dashboard/project/YOUR_PROJECT_REF/settings/api`

### 3. 配置方式

**选项 A：交互式配置**
```bash
python3 {baseDir}/scripts/supabase.py auth
```

**选项 B：手动配置**
创建 `~/.supabase_config.json`：
```json
{
  "url": "https://xxxxx.supabase.co",
  "service_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**选项 C：环境变量配置**
```bash
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbG..."
```

## 命令

### 用户分析
```bash
# Count total users
python3 {baseDir}/scripts/supabase.py users

# Count new users (24h)
python3 {baseDir}/scripts/supabase.py users-today

# Count new users (7 days)  
python3 {baseDir}/scripts/supabase.py users-week

# List users with details (name, email, provider, signup date)
python3 {baseDir}/scripts/supabase.py list-users

# List new users from last 24h
python3 {baseDir}/scripts/supabase.py list-users-today

# Limit results
python3 {baseDir}/scripts/supabase.py list-users --limit 5
```

### 项目信息
```bash
# Show project info and key type
python3 {baseDir}/scripts/supabase.py info

# List tables exposed via REST API
python3 {baseDir}/scripts/supabase.py tables
```

### JSON 输出
```bash
python3 {baseDir}/scripts/supabase.py list-users --json
```

## 密钥类型说明

| 密钥类型 | 格式 | 可列出用户 | 可统计用户数 | 可访问 REST 表 |
|----------|------|------------|--------------|----------------|
| JWT service_role | `eyJ...` | ✅ 是 | ✅ 是 | ✅ 是 |
| 新版 secret 密钥 | `sb_secret_...` | ❌ 否 | ❌ 否 | ✅ 是 |

**建议：** Clawdbot 集成始终使用 JWT `service_role` 密钥。

## 每日报告

通过 Clawdbot cron 设置自动化的每日用户报告。

### 示例：每日下午 5 点报告

向 Clawdbot 提问：
```
Send me a report of how many new users signed up at 5 PM every day, 
show the last 5 signups with their names
```

这将创建如下 cron 任务：
```json
{
  "name": "Daily Supabase User Report",
  "schedule": {
    "kind": "cron",
    "expr": "0 17 * * *",
    "tz": "America/Los_Angeles"
  },
  "payload": {
    "message": "Supabase daily report: Count new user signups in the last 24 hours, and list the 5 most recent signups with their name and email."
  }
}
```

### 报告输出示例

```
📊 Supabase Daily Report

New signups (last 24h): 2

Last 5 signups:
• Jane Smith <jane@example.com> (google) - 2026-01-25
• Alex Johnson <alex.j@company.com> (google) - 2026-01-25
• Sam Wilson <sam@startup.io> (email) - 2026-01-24
• Chris Lee <chris.lee@email.com> (google) - 2026-01-23
• Jordan Taylor <jordan@acme.co> (github) - 2026-01-22
```

## 故障排查

### “list-users requires a JWT service_role key”
您正在使用 `sb_secret_...` 密钥。请从以下路径获取 JWT 密钥：  
**项目设置 → API → 旧版标签页 → service_role → Reveal**

### “No API key found in request”
新版 `sb_secret_` 密钥不支持全部端点。请切换至 JWT 密钥。

### 密钥未显示
请确认您位于 **“旧版 anon, service_role API 密钥”** 标签页，而非新版 API 密钥标签页。

## 安全提示

`service_role` 密钥对您的数据库拥有 **完全管理员权限**。请务必妥善保管：
- 切勿提交至 Git
- 不要在客户端代码中暴露
- 仅在受信任的机器上使用

配置文件将自动设为权限模式 600（仅所有者可读写）。