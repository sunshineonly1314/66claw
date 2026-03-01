---
name: resend
name_zh: Resend
description: 通过 Resend API 管理已接收（入站）邮件及附件。当用户询问其邮件、收到的消息或邮件附件时使用。
description_zh: 通过 Resend API 管理已接收（入站）邮件及附件。当用户询问其邮件、收到的消息或邮件附件时使用。
homepage: https://resend.com
metadata:
  clawdbot:
    emoji: "📧"
    requires:
      bins: ["resend"]
      env: ["RESEND_API_KEY"]
---
# Resend CLI

Resend 邮件 API 的命令行工具，用于查询已接收（入站）邮件及附件。

## 安装

```bash
npm install -g @mjrussell/resend-cli
```

## 设置

1. 在 [resend.com](https://resend.com) 注册账号  
2. 为您的域名配置入站邮件路由  
3. 在“API Keys → Create API key”中创建 API 密钥（需具备读取权限）  
4. 设置环境变量：`export RESEND_API_KEY="re_your_key"`

## 命令

### 列出邮件  
```bash
resend email list              # List recent emails (default 10)
resend email list -l 20        # List 20 emails
resend email list --json       # Output as JSON
```

### 获取邮件详情  
```bash
resend email get <id>          # Show email details
resend email get <id> --json   # Output as JSON
```

### 附件  
```bash
resend email attachments <email_id>                    # List attachments
resend email attachment <email_id> <attachment_id>     # Get attachment metadata
resend email attachments <email_id> --json             # Output as JSON
```

### 域名  
```bash
resend domain list             # List configured domains
resend domain get <id>         # Get domain details with DNS records
resend domain list --json      # Output as JSON
```

## 使用示例

**用户：“我有新邮件吗？”**  
```bash
resend email list -l 5
```

**用户：“给我看看最新的邮件”**  
```bash
resend email list --json | jq -r '.data.data[0].id'  # Get ID
resend email get <id>
```

**用户：“那封邮件有哪些附件？”**  
```bash
resend email attachments <email_id>
```

**用户：“我配置了哪些域名？”**  
```bash
resend domain list
```

**用户：“显示邮件 X 的完整内容”**  
```bash
resend email get <email_id>
```

## 注意事项

- 此 CLI 仅支持 **已接收（入站）** 邮件，不支持发信  
- 脚本编写时，请使用 `--json` 标志并配合管道符（`|`）传给 `jq`  
- 邮件 ID 为 UUID，显示于列表输出中  