---
name: purelymail
name_zh: PurelyMail
description: 为 Clawdbot agents 配置并测试 PurelyMail 邮件服务。生成配置文件、测试 IMAP/SMTP、验证收件箱连接性。
description_zh: 为 Clawdbot agents 配置并测试 PurelyMail 邮件服务。生成配置文件、测试 IMAP/SMTP、验证收件箱连接性。
homepage: https://purelymail.com
metadata:
  clawdhub:
    emoji: "📬"
    requires:
      bins: ["python3"]
---
# Clawdbot 的 PurelyMail 配置

使用 [PurelyMail](https://purelymail.com) 为您的 Clawdbot agent 配置电子邮件——这是一款简洁、注重隐私的邮件服务，专为 agent 收件箱而设计。

## 为何选择 PurelyMail？

- **价格低廉**：约 $10/年，支持无限邮箱地址；
- **简洁高效**：无冗余功能，专注邮件本身；
- **注重隐私**：总部位于美国，数据留存极少；
- **稳定可靠**：投递成功率极高；
- **Agent-友好**：IMAP/SMTP 配置简单便捷。

## 快速入门（向导模式）

最简便的配置方式是使用交互式向导：

```bash
purelymail wizard
```

向导将执行以下操作：
1. ✓ 检查您是否已拥有 PurelyMail 账户；
2. ✓ 测试您的 IMAP/SMTP 连接；
3. ✓ 生成 clawdbot.json 配置；
4. ✓ 可选：发送一封测试邮件。

## 手动配置

### 1. 创建 PurelyMail 账户

1. 访问 [purelymail.com](https://purelymail.com) 并注册；
2. 添加您的域名（或使用其子域名）；
3. 为您的 agent 创建一个邮箱（例如：`agent@yourdomain.com`）；
4. 记下密码。

### 2. 生成 Clawdbot 配置

```bash
purelymail config --email agent@yourdomain.com --password "YourPassword"
```

输出 JSON 片段，可添加至您的 `clawdbot.json`：

```json
{
  "skills": {
    "entries": {
      "agent-email": {
        "env": {
          "AGENT_EMAIL": "agent@yourdomain.com",
          "AGENT_EMAIL_PASSWORD": "YourPassword",
          "AGENT_IMAP_SERVER": "imap.purelymail.com",
          "AGENT_SMTP_SERVER": "smtp.purelymail.com"
        }
      }
    }
  }
}
```

### 3. 测试连接

```bash
purelymail test --email agent@yourdomain.com --password "YourPassword"
```

测试 IMAP 与 SMTP 连通性。

### 4. 发送测试邮件

```bash
purelymail send-test --email agent@yourdomain.com --password "YourPassword" --to you@example.com
```

### 5. 查看收件箱

```bash
purelymail inbox --email agent@yourdomain.com --password "YourPassword" --limit 5
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `config` | 生成 clawdbot.json 配置片段 |
| `test` | 测试 IMAP/SMTP 连通性 |
| `send-test` | 发送一封测试邮件 |
| `inbox` | 列出最近的收件箱消息 |
| `read` | 阅读指定邮件 |
| `setup-guide` | 输出完整配置说明 |

## 环境变量

在 clawdbot.json 中完成配置后，以下环境变量即可使用：

- `AGENT_EMAIL` —— 邮箱地址；
- `AGENT_EMAIL_PASSWORD` —— 密码；
- `AGENT_IMAP_SERVER` —— IMAP 服务器（imap.purelymail.com）；
- `AGENT_SMTP_SERVER` —— SMTP 服务器（smtp.purelymail.com）。

## PurelyMail 设置

| 设置 | 值 |
|------|----|
| IMAP 服务器 | `imap.purelymail.com` |
| IMAP 端口 | `993`（SSL） |
| SMTP 服务器 | `smtp.purelymail.com` |
| SMTP 端口 | `465`（SSL） 或 `587`（STARTTLS） |
| 认证方式 | 邮箱地址 + 密码 |

## 使用提示

- 为您的 agent 使用强密码且确保唯一；
- 可考虑为 agent 邮件单独注册一个域名；
- PurelyMail 支持“通配符邮箱”（catch-all addresses），非常适合路由场景；
- 请为您的 PurelyMail 账户启用双重身份验证（2FA），并在 agent 中使用应用专用密码。