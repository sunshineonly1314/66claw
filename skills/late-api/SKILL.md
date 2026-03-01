---
name: late-api
name_zh: Late API
description: 官方 Late API 参考文档，支持跨 13 个社交平台发布帖子。涵盖身份验证、端点、webhooks 及各平台专属功能。在使用 Late 社交媒体排期 API 进行开发时请参考本技能。
description_zh: 官方 Late API 参考文档，支持跨 13 个社交平台发布帖子。涵盖身份验证、端点、webhooks 及各平台专属功能。在使用 Late 社交媒体排期 API 进行开发时请参考本技能。
---
# Late API 参考文档

通过单一 API 跨 13 个社交平台排期发布帖子。

**基础 URL：** `https://getlate.dev/api/v1`

**文档：** [getlate.dev/docs](https://getlate.dev/docs)

## 快速入门

```bash
# 1. Create profile
curl -X POST https://getlate.dev/api/v1/profiles \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"name": "My Brand"}'

# 2. Connect account (opens OAuth)
curl "https://getlate.dev/api/v1/connect/twitter?profileId=PROFILE_ID" \
  -H "Authorization: Bearer YOUR_API_KEY"

# 3. Create post
curl -X POST https://getlate.dev/api/v1/posts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"content": "Hello!", "platforms": [{"platform": "twitter", "accountId": "ACC_ID"}], "publishNow": true}'
```

## 规则文件

请查阅以下独立规则文件以获取详细文档：

- [rules/authentication.md](rules/authentication.md) — API 密钥格式、使用示例、核心概念  
- [rules/posts.md](rules/posts.md) — 创建、排期、重试帖子，批量上传  
- [rules/accounts.md](rules/accounts.md) — 列出账号、健康检查、粉丝统计  
- [rules/connect.md](rules/connect.md) — OAuth 流程、Bluesky 应用密码、Telegram Bot Token  
- [rules/platforms.md](rules/platforms.md) — 所有 13 个平台的平台专属数据  
- [rules/webhooks.md](rules/webhooks.md) — 配置 webhooks、验证签名、事件类型  
- [rules/media.md](rules/media.md) — 预签名上传、支持的格式、平台限制  
- [rules/queue.md](rules/queue.md) — 队列管理、插槽配置  
- [rules/analytics.md](rules/analytics.md) — YouTube 日观看量、LinkedIn 分析数据  
- [rules/tools.md](rules/tools.md) — 媒体下载、话题标签检查器、字幕提取  
- [rules/errors.md](rules/errors.md) — 错误代码、速率限制、发布日志  
- [rules/sdks.md](rules/sdks.md) — 直接调用 API 的示例  

## 支持的平台

Twitter/X、Instagram、Facebook、LinkedIn、TikTok、YouTube、Pinterest、Reddit、Bluesky、Threads、Google Business、Telegram、Snapchat

---

*[Late](https://getlate.dev) — 面向开发者的社交媒体排期 API*