---
name: email-best-practices
name_zh: 邮件最佳实践
description: 适用于构建邮件功能、邮件进入垃圾箱、高退信率、配置 SPF/DKIM/DMARC 认证、实施邮件地址采集、确保合规性（CAN-SPAM、GDPR、CASL）、处理 Webhook、重试逻辑，或判定事务性邮件与营销邮件等场景。
description_zh: 适用于构建邮件功能、邮件进入垃圾箱、高退信率、配置 SPF/DKIM/DMARC 认证、实施邮件地址采集、确保合规性（CAN-SPAM、GDPR、CASL）、处理 Webhook、重试逻辑，或判定事务性邮件与营销邮件等场景。
---
# 邮件最佳实践

构建可投递、合规、用户友好的邮件系统的指导原则。

## 架构概览

```
[User] → [Email Form] → [Validation] → [Double Opt-In]
                                              ↓
                                    [Consent Recorded]
                                              ↓
[Suppression Check] ←──────────────[Ready to Send]
        ↓
[Idempotent Send + Retry] ──────→ [Email API]
                                       ↓
                              [Webhook Events]
                                       ↓
              ┌────────┬────────┬─────────────┐
              ↓        ↓        ↓             ↓
         Delivered  Bounced  Complained  Opened/Clicked
                       ↓        ↓
              [Suppression List Updated]
                       ↓
              [List Hygiene Jobs]
```

## 快速查阅指南

| 需要…… | 请参阅 |
|---------|--------|
| 配置 SPF/DKIM/DMARC，解决垃圾邮件问题 | [投递能力](./resources/deliverability.md) |
| 构建密码重置、OTP、验证类邮件 | [事务性邮件](./resources/transactional-emails.md) |
| 规划您的应用所需邮件类型 | [事务性邮件目录](./resources/transactional-email-catalog.md) |
| 构建新闻通讯注册流程、验证邮箱 | [邮件地址采集](./resources/email-capture.md) |
| 发送新闻通讯、促销邮件 | [营销邮件](./resources/marketing-emails.md) |
| 确保符合 CAN-SPAM/GDPR/CASL 合规要求 | [合规性](./resources/compliance.md) |
| 判定事务性邮件与营销邮件 | [邮件类型](./resources/email-types.md) |
| 处理重试、幂等性、错误 | [发送可靠性](./resources/sending-reliability.md) |
| 处理投递事件、配置 Webhook | [Webhook 与事件](./resources/webhooks-events.md) |
| 管理退信、投诉、屏蔽地址 | [列表管理](./resources/list-management.md) |

## 入门指引

**新建应用？**  
从 [邮件目录](./resources/transactional-email-catalog.md) 入手，规划应用所需邮件（如密码重置、邮箱验证等），然后在发送首封邮件前，完成 [投递能力](./resources/deliverability.md)（DNS 认证）配置。

**遭遇垃圾邮件问题？**  
首先检查 [投递能力](./resources/deliverability.md) —— 认证问题是最常见原因。Gmail/Yahoo 会拒收未经认证的邮件。

**发送营销邮件？**  
遵循此路径：[邮件地址采集](./resources/email-capture.md)（获取用户同意）→ [合规性](./resources/compliance.md)（满足法律要求）→ [营销邮件](./resources/marketing-emails.md)（最佳实践）。

**生产环境就绪的邮件发送？**  
增强可靠性：[发送可靠性](./resources/sending-reliability.md)（重试 + 幂等性）→ [Webhook 与事件](./resources/webhooks-events.md)（追踪投递）→ [列表管理](./resources/list-management.md)（处理退信）。  