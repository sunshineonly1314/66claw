---
name: x-to-kindle
name_zh: X Kindle
description: 将 X/Twitter 帖子发送至 Kindle 设备，实现免干扰阅读。当用户分享 X/Twitter 链接并希望在 Kindle 上阅读，或明确要求将某条推文/推文串发送至其 Kindle 设备时启用。
description_zh: 将 X/Twitter 帖子发送至 Kindle 设备，实现免干扰阅读。当用户分享 X/Twitter 链接并希望在 Kindle 上阅读，或明确要求将某条推文/推文串发送至其 Kindle 设备时启用。
---
# X to Kindle

通过电子邮件将 X/Twitter 帖子转换为 Kindle 可读文档。

## 要求

- 已配置应用专用密码（App Password）的 Gmail 账户（或其他 SMTP 设置）  
- Kindle 邮箱地址（可在亚马逊账户设置中找到）

## 工作流

当用户分享 X 链接时：

1. **通过 fxtwitter API 提取内容**：  
   ```
   https://api.fxtwitter.com/status/<tweet_id>
   ```  
   从 URL 中提取：`twitter.com/*/status/<id>` 或 `x.com/*/status/<id>`  

2. **格式化为 HTML 邮件**：  
   ```html
   <html>
   <body>
     <h1>@{author_handle}</h1>
     <p>{tweet_text}</p>
     <p><em>{timestamp}</em></p>
     <p><a href="{original_url}">View on X</a></p>
   </body>
   </html>
   ```  

3. **通过 SMTP 发送至用户 Kindle 邮箱**，邮件主题设为推文预览。

## 配置

存入 TOOLS.md 文件：  
```markdown
## Kindle
- Address: user@kindle.com

## Email (Gmail SMTP)
- From: your@gmail.com
- App Password: xxxx xxxx xxxx xxxx
- Host: smtp.gmail.com
- Port: 587
```

## 示例

用户发送：`https://x.com/elonmusk/status/1234567890`  

1. 获取 `https://api.fxtwitter.com/status/1234567890`  
2. 提取作者、正文、发布时间戳  
3. 向 Kindle 邮箱发送 HTML 邮件  
4. 确认：“已发送至 Kindle 📚”