---
name: postiz
name_zh: Postiz
description: Postiz 是一款面向 28+ 个平台的社交媒体及聊天消息定时发布工具，支持平台包括：X、LinkedIn、LinkedIn Page、Reddit、Instagram、Facebook Page、Threads、YouTube、Google My Business、TikTok、Pinterest、Dribbble、Discord、Slack、Kick、Twitch、Mastodon、Bluesky、Lemmy、Farcaster、Telegram、Nostr、VK、Medium、Dev.to、Hashnode、WordPress、ListMonk
description_zh: Postiz 是一款面向 28+ 个平台的社交媒体及聊天消息定时发布工具，支持平台包括：X、LinkedIn、LinkedIn Page、Reddit、Instagram、Facebook Page、Threads、YouTube、Google My Business、TikTok、Pinterest、Dribbble、Discord、Slack、Kick、Twitch、Mastodon、Bluesky、Lemmy、Farcaster、Telegram、Nostr、VK、Medium、Dev.to、Hashnode、WordPress、ListMonk
homepage: https://docs.postiz.com/public-api/introduction
metadata: {"clawdbot":{"emoji":"🌎","requires":{"bins":[],"env":["POSTIZ_API_KEY"]}}}
---
# Postiz 技能

Postiz 是一款面向 28+ 个平台的社交媒体及聊天消息定时发布工具：

X、LinkedIn、LinkedIn Page、Reddit、Instagram、Facebook Page、Threads、YouTube、Google My Business、TikTok、Pinterest、Dribbble、Discord、Slack、Kick、Twitch、Mastodon、Bluesky、Lemmy、Farcaster、Telegram、Nostr、VK、Medium、Dev.to、Hashnode、WordPress、ListMonk

## 初始化配置

1. 获取您的 API 密钥：https://platform.postiz.com/settings  
2. 点击“Settings”（设置）  
3. 点击“Reveal”（显示）  
4. 设置环境变量：  
   ```bash
   export POSTIZ_API_KEY="your-api-key"
   ```

## 获取所有已添加的渠道

```bash
curl -X GET "https://api.postiz.com/public/v1/integrations" \
  -H "Authorization: $POSTIZ_API_KEY"
```

## 获取某渠道下一个可用的发布时间槽位

```bash
curl -X GET "https://api.postiz.com/public/v1/find-slot/:id" \
  -H "Authorization: $POSTIZ_API_KEY"
```

## 上传新文件（form-data 格式）

```bash
curl -X POST "https://api.postiz.com/public/v1/upload" \
  -H "Authorization: $POSTIZ_API_KEY" \
  -F "file=@/path/to/your/file.png"
```

## 从已有 URL 上传新文件

```bash
curl -X POST "https://api.postiz.com/public/v1/upload-from-url" \
  -H "Authorization: $POSTIZ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/image.png"
  }'
```

## 查看已发布消息列表

```bash
curl -X GET "https://api.postiz.com/public/v1/posts?startDate=2024-12-14T08:18:54.274Z&endDate=2024-12-14T08:18:54.274Z&customer=optionalCustomerId" \
  -H "Authorization: $POSTIZ_API_KEY"
```

## 安排一条新消息

各渠道的设置说明详见：  
https://docs.postiz.com/public-api/introduction  
位于页面左下角菜单中

```bash
curl -X POST "https://api.postiz.com/public/v1/posts" \
  -H "Authorization: $POSTIZ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
  "type": "schedule",
  "date": "2024-12-14T10:00:00.000Z",
  "shortLink": false,
  "tags": [],
  "posts": [
    {
      "integration": {
        "id": "your-x-integration-id"
      },
      "value": [
        {
          "content": "Hello from the Postiz API! 🚀",
          "image": [{ "id": "img-123", "path": "https://uploads.postiz.com/photo.jpg" }]
        }
      ],
      "settings": {
        "__type": "provider name",
        rest of the settings
      }
    }
  ]
}'
```

## 删除一条已发布消息

```bash
curl -X DELETE "https://api.postiz.com/public/v1/posts/:id" \
  -H "Authorization: $POSTIZ_API_KEY"
```