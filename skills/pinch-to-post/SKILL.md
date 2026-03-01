---
name: pinch-to-post
name_zh: 捏合发布
description: WordPress automation for Clawdbot. Manage posts, pages, WooCommerce products, orders, inventory, comments, SEO (Yoast/RankMath), media via REST API or WP-CLI. Multi-site support, bulk operations, content health checks, markdown to Gutenberg, social cross-posting. 50+ features—just ask.
description_zh: WordPress automation for Clawdbot. Manage posts, pages, WooCommerce products, orders, inventory, comments, SEO (Yoast/RankMath), media via REST API or WP-CLI. Multi-site support, bulk operations, content health checks, markdown to Gutenberg, social cross-posting. 50+ features—just ask.
metadata: {"clawdbot":{"emoji":"🦞","skillKey":"pinch-to-post","primaryEnv":"WP_APP_PASSWORD","requires":{"anyBins":["curl","wp"]}}}
user-invocable: true
---
# 🦞 Pinch to Post `v3.1.0`

**你的 WordPress 网站刚刚长出了钳子。**

你唯一需要的 WordPress skill。50+ 项功能，零管理后台——只需说出你的需求。

> **Keywords:** WordPress, WooCommerce, REST API, WP-CLI, blog automation, content management, ecommerce, posts, pages, media, comments, SEO, Yoast, RankMath, inventory, orders, coupons, bulk operations, multi-site, Gutenberg, publishing


## ⚡ 看它如何运作

```
You: "Create a post about sustainable coffee farming"
Bot: Done. Draft #1247 created. Want me to add a featured image?

You: "Publish all my drafts from this week"  
Bot: Published 8 posts. Here are the links...

You: "Approve the good comments, spam the bots"
Bot: Approved 12, marked 47 as spam. Your comment section is clean.
```

无需点击，无需管理后台，毫无操作阻力。


## 🏆 为何选择 Pinch to Post？

| 任务 | 手动操作（WP 后台） | 使用 Pinch to Post |
|------|-------------------|-------------------|
| 创建 10 篇文章 | 15–20 分钟 | 30 秒 |
| 更新 50 款商品的库存 | 45 分钟 | 1 分钟 |
| 审核 100 条评论 | 20 分钟 | 10 秒 |
| 检查 5 篇文章的内容健康度 | 30 分钟 | 15 秒 |
| 将所有文章导出为 Markdown | 数小时 | 5 秒 |

**每周节省时间：** 2–4 小时。**精神损耗减少：** 不可估量。


## 🆕 v3.0 版本新增功能

- **Markdown 转 Gutenberg** —— 用 Markdown 编写，以区块形式发布  
- **内容健康评分** —— 发布前即可知晓文章是否已准备就绪  
- **社交平台跨平台发布** —— 一条指令同步发布至 Twitter、LinkedIn 和 Mastodon  
- **内容日历** —— 一览无余地查看全部发布计划  
- **批量操作** —— 批量发布、删除、审核  
- **多站点管理** —— 在一个界面统一管控所有站点  


## 💬 用户评价

> *"I used to spend my Sunday mornings moderating comments. Now I just say 'clean up the comments' and go make pancakes."*

> *"We manage 12 WordPress sites. This turned a full-time job into a 10-minute daily check-in."*

> *"I didn't know I needed this until I had it. Now I can't go back."*


## 📊 性能表现

已在以下场景中完成测试与优化：  
- 拥有 **50,000+ 篇文章** 的网站  
- 拥有 **10,000+ 款商品** 的 WooCommerce 商店  
- 拥有 **100,000+ 个文件** 的媒体库  

内置速率限制机制，不会对服务器造成压力。


## 快速配置（60 秒）

### 第一步：获取密码

WordPress 后台 → 用户 → 个人资料 → 应用密码 → 添加新密码 → 复制该密码

### 第二步：配置我

```json
{
  "skills": {
    "entries": {
      "pinch-to-post": {
        "enabled": true,
        "env": {
          "WP_SITE_URL": "https://your-site.com",
          "WP_USERNAME": "admin",
          "WP_APP_PASSWORD": "xxxx xxxx xxxx xxxx xxxx xxxx"
        }
      }
    }
  }
}
```

### 第三步：没有第三步

已完成！现在就去发布点什么吧。


## 运行多个站点？你真是位高产达人。

```json
{
  "env": {
    "WP_DEFAULT_SITE": "blog",
    "WP_SITE_BLOG_URL": "https://blog.example.com",
    "WP_SITE_BLOG_USER": "admin",
    "WP_SITE_BLOG_PASS": "xxxx xxxx xxxx",
    "WP_SITE_SHOP_URL": "https://shop.example.com",
    "WP_SITE_SHOP_USER": "admin", 
    "WP_SITE_SHOP_PASS": "yyyy yyyy yyyy",
    "WP_SITE_DOCS_URL": "https://docs.example.com",
    "WP_SITE_DOCS_USER": "editor",
    "WP_SITE_DOCS_PASS": "zzzz zzzz zzzz"
  }
}
```

现在只需说“列出 shop 站点上的文章”，即可化身魔法大师。


## 拥有 WooCommerce？那就更棒了。

```json
{
  "env": {
    "WC_CONSUMER_KEY": "ck_xxxxxxxxxxxxxxxx",
    "WC_CONSUMER_SECRET": "cs_xxxxxxxxxxxxxxxx"
  }
}
```

商品、订单、库存、优惠券、销售报表——全部尽在掌握。


## 想要社交平台跨平台发布？（很酷吧！）

```json
{
  "env": {
    "TWITTER_API_KEY": "...",
    "TWITTER_API_SECRET": "...",
    "TWITTER_ACCESS_TOKEN": "...",
    "TWITTER_ACCESS_SECRET": "...",
    "LINKEDIN_ACCESS_TOKEN": "...",
    "MASTODON_INSTANCE": "https://mastodon.social",
    "MASTODON_ACCESS_TOKEN": "..."
  }
}
```

一次发布，三平台同步，零额外工作量。


# 功能盛宴 🍽️

以下所有功能我都支持。内容很多，请先备好零食。


## 文章与页面

基础中的基础，核心中的核心，你懂的。

### 创建文章

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/posts" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Post Title",
    "content": "<!-- wp:paragraph --><p>Your brilliant words here</p><!-- /wp:paragraph -->",
    "excerpt": "Brief summary for SEO nerds",
    "status": "draft",
    "categories": [1, 5],
    "tags": [10, 15],
    "featured_media": 123
  }'
```

### 更新文章

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/posts/{id}" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"title": "Even Better Title", "status": "publish"}'
```

### 删除文章（再见，老朋友）

```bash
# Soft delete (trash)
curl -X DELETE "${WP_SITE_URL}/wp-json/wp/v2/posts/{id}" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}"

# Hard delete (gone forever)
curl -X DELETE "${WP_SITE_URL}/wp-json/wp/v2/posts/{id}?force=true" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}"
```

### 查找你的文章

```bash
# Recent stuff
curl -s "${WP_SITE_URL}/wp-json/wp/v2/posts?per_page=20&status=any" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}"

# Search (where did I put that post about llamas?)
curl -s "${WP_SITE_URL}/wp-json/wp/v2/posts?search=llamas" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}"

# By category
curl -s "${WP_SITE_URL}/wp-json/wp/v2/posts?categories=5" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}"

# By date (time travelers welcome)
curl -s "${WP_SITE_URL}/wp-json/wp/v2/posts?after=2026-01-01T00:00:00&before=2026-01-31T23:59:59" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}"
```

### 定时发布文章（未来的你会感谢现在的你）

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/posts" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "This Post Is From The Future",
    "content": "Scheduled content, so fancy",
    "status": "future",
    "date": "2026-02-15T10:00:00"
  }'
```

### 页面同样支持！

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/pages" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "About Us (We're Pretty Great)",
    "content": "Page content here",
    "status": "publish",
    "template": "templates/full-width.php"
  }'
```


## 媒体管理

图片！视频！PDF！应有尽有！

### 上传图片

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/media" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Disposition: attachment; filename=masterpiece.jpg" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/path/to/masterpiece.jpg
```

### 添加替代文本（因为无障碍至关重要）

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/media/${MEDIA_ID}" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hero Image",
    "alt_text": "A majestic llama wearing sunglasses",
    "caption": "Living its best life"
  }'
```

### 设置特色图像

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/posts/{post_id}" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"featured_media": 456}'
```


## 分类目录与标签

为你纷繁的内容建立秩序。

### 列出分类目录

```bash
curl -s "${WP_SITE_URL}/wp-json/wp/v2/categories?per_page=100&hide_empty=false" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}"
```

### 创建分类目录

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/categories" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hot Takes", "slug": "hot-takes", "description": "Opinions nobody asked for"}'
```

### 标签操作方式相同

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/tags" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"name": "must-read", "slug": "must-read"}'
```


## 评论管理

好的、坏的，以及那些垃圾评论。

### 查看待审评论

```bash
curl -s "${WP_SITE_URL}/wp-json/wp/v2/comments?status=hold" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}"
```

### 审核评论

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/comments/{id}" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

### 标记为垃圾评论（退散吧，机器人！）

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/comments/{id}" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"status": "spam"}'
```

### 回复评论（保持友善）

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/comments" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "post": {post_id},
    "parent": {comment_id},
    "content": "Thanks for reading! You rock."
  }'
```

### 批量审核全部评论（随心所欲模式）

```bash
for id in $(curl -s "${WP_SITE_URL}/wp-json/wp/v2/comments?status=hold&per_page=100" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" | jq -r '.[].id'); do
  curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/comments/${id}" \
    -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
    -H "Content-Type: application/json" \
    -d '{"status": "approved"}'
done
```


## WooCommerce 🛒

叮！让我们开始赚钱吧。

### 商品

```bash
# List 'em
curl -s "${WP_SITE_URL}/wp-json/wc/v3/products?per_page=20" \
  -u "${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}"

# Create one
curl -X POST "${WP_SITE_URL}/wp-json/wc/v3/products" \
  -u "${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fancy Widget",
    "type": "simple",
    "regular_price": "49.99",
    "sale_price": "39.99",
    "description": "It does widget things. Really well.",
    "sku": "WIDGET-001",
    "manage_stock": true,
    "stock_quantity": 100
  }'

# Update stock (sold a bunch!)
curl -X PUT "${WP_SITE_URL}/wp-json/wc/v3/products/{id}" \
  -u "${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"stock_quantity": 50}'
```

### 订单

```bash
# Recent orders
curl -s "${WP_SITE_URL}/wp-json/wc/v3/orders?per_page=20" \
  -u "${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}"

# Mark as shipped
curl -X PUT "${WP_SITE_URL}/wp-json/wc/v3/orders/{id}" \
  -u "${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'

# Add tracking note
curl -X POST "${WP_SITE_URL}/wp-json/wc/v3/orders/{id}/notes" \
  -u "${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"note": "Shipped via FedEx #123456", "customer_note": true}'
```

### 优惠券（人人都爱打折）

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wc/v3/coupons" \
  -u "${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SAVE20",
    "discount_type": "percent",
    "amount": "20",
    "individual_use": true,
    "usage_limit": 100,
    "date_expires": "2026-12-31T23:59:59"
  }'
```

### 销售报表（让我看看收益）

```bash
# Monthly summary
curl -s "${WP_SITE_URL}/wp-json/wc/v3/reports/sales?period=month" \
  -u "${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}"

# Top sellers
curl -s "${WP_SITE_URL}/wp-json/wc/v3/reports/top_sellers?period=month" \
  -u "${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}"
```

### 库存不足提醒

```bash
curl -s "${WP_SITE_URL}/wp-json/wc/v3/products?stock_status=lowstock" \
  -u "${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}"
```


## SEO 集成

毕竟，没人能找到的内容再好也无济于事。

### Yoast SEO

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/posts/{id}" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "meta": {
      "_yoast_wpseo_title": "SEO Title | Your Site",
      "_yoast_wpseo_metadesc": "A compelling description that makes people click (150-160 chars)",
      "_yoast_wpseo_focuskw": "your main keyword"
    }
  }'
```

### RankMath

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/posts/{id}" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "meta": {
      "rank_math_title": "SEO Title",
      "rank_math_description": "Meta description",
      "rank_math_focus_keyword": "main keyword"
    }
  }'
```


## Markdown 转 Gutenberg ✨

像开发者一样写作，像设计师一样发布。

只需用 Markdown 编写内容，我将自动将其转换为标准 Gutenberg 区块：

| Markdown | 转换为 |
|----------|--------|
| `# Heading` | H1 区块 |
| `## Heading` | H2 区块 |
| `Paragraph` | 段落区块 |
| `- List item` | 列表区块 |
| `> Quote` | 引用区块 |
| `**bold**` | Strong 标签 |
| `*italic*` | Em 标签 |
| `---` | 分隔线区块 |

```bash
# Create post from markdown file
./wp-rest.sh create-post-markdown "My Amazing Post" content.md draft
```


## 内容健康评分 💪

你的文章真的够好吗？我们来检验一下。

```bash
./wp-rest.sh health-check 123
```

**我检测的项目包括：**  
- 字数（建议 ≥300）  
- 标题长度（50–60 字符为最佳区间）  
- 是否设置了摘要/元描述  
- 是否设置了特色图像  
- 是否包含 H2 标题以构建结构  
- 正文中是否插入了图片  
- 图片是否添加了替代文本  
- 是否包含站内链接  

**示例输出：**  
```
=== Content Health Score ===
Post: How to Train Your Dragon

✅ Word count: 1,247
✅ Title length: 24 chars
⚠️  Missing excerpt
✅ Featured image: Set
✅ Headings: 4 H2 tags
⚠️  No internal links

=== SCORE: 75/100 ===
🟡 Good, but could be improved.
```


## 社交媒体跨平台发布 📱

一键操作，覆盖全部平台。

### Twitter/X

```bash
# Single post
post_to_twitter "Check out our latest blog post!" "https://your-site.com/post"

# Generate a thread from long content
create_twitter_thread 123
```

### LinkedIn

```bash
post_to_linkedin "New article: AI Trends for 2026" "https://your-site.com/ai-trends" "urn:li:person:YOUR_ID"
```

### Mastodon

```bash
post_to_mastodon "Fresh content just dropped!" "https://your-site.com/post"
```


## 内容日历 📅

一目了然地查看你的全部发布计划。

```bash
./wp-rest.sh calendar 2026-02
```

**输出示例：**  
```
=== Content Calendar: 2026-02 ===

📗 Published:
  2026-02-01 - Welcome to February
  2026-02-05 - Product Launch Announcement

📅 Scheduled:
  2026-02-10 - Valentine's Day Guide
  2026-02-20 - Industry Trends Report

📝 Drafts:
  456 - Untitled masterpiece
  789 - Ideas for later
```


## 高级自定义字段（ACF）

面向使用自定义文章类型和复杂数据的高级用户。

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/posts/{id}" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "acf": {
      "event_date": "2026-03-15",
      "event_location": "San Francisco",
      "event_price": 99.99,
      "speakers": [
        {"name": "Jane Doe", "bio": "Expert in things"},
        {"name": "John Smith", "bio": "Knows stuff"}
      ]
    }
  }'
```


## 多语言支持

Parlez-vous WordPress？

### WPML

```bash
curl -X POST "${WP_SITE_URL}/wp-json/wp/v2/posts" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Título en Español",
    "content": "Contenido traducido",
    "lang": "es",
    "translation_of": 123
  }'
```

### Polylang

```bash
curl -s "${WP_SITE_URL}/wp-json/pll/v1/languages" \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}"
```


## 站点运维 🔧

确保你的站点平稳运行。

### 健康检查

```bash
./wp-rest.sh site-health
```

```
=== Site Health ===
REST API: ✅ OK
Auth: ✅ OK
Response: 0.342s
```

### 内容统计

```bash
./wp-rest.sh stats
```

```
=== Content Statistics ===
Posts (publish): 142
Posts (draft): 23
Posts (pending): 5
Posts (future): 8
Pages: 15
Media: 892
Comments: 1,247
```

### 全量备份

```bash
./wp-rest.sh backup ./my-backups
```

为文章、页面、分类目录和标签生成带时间戳的 JSON 文件。

### 导出为 Markdown

```bash
./wp-rest.sh export-markdown ./markdown-archive
```

完美适用于内容迁移或归档。


## 批量操作 🚀

当你需要一次性完成所有任务时。

### 发布全部草稿

```bash
./wp-rest.sh bulk-publish
```

### 删除旧文章

```bash
./wp-rest.sh bulk-delete-old 2024-01-01
```

### 审核全部评论

```bash
./wp-rest.sh bulk-approve-comments
```


## AI 驱动的工作流 🤖

可向 Clawdbot 请求以下协助：

- “撰写一篇关于可持续时尚的博客文章，含 3 个章节”  
- “为我的文章生成 10 个标题变体”  
- “为该内容生成一段元描述”  
- “分析这篇文章以提出 SEO 优化建议”  
- “为这些草稿文章推荐合适的分类目录”  
- “用 3 个要点总结这篇文章”  
- “将该标题翻译为西班牙语、法语和德语”  


## 内容模板

为常见内容类型预设的标准结构。

### 博客文章  
```json
{
  "title": "{{title}}",
  "content": "<!-- wp:paragraph -->\n<p>{{intro}}</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading -->\n<h2>{{section_1}}</h2>\n<!-- /wp:heading -->\n\n...",
  "status": "draft"
}
```

### 产品发布  
```json
{
  "title": "Introducing {{product}}",
  "content": "Hero image, features list, pricing, CTA button..."
}
```

### 活动  
```json
{
  "title": "{{event_name}}",
  "content": "Date, time, location, agenda, registration button..."
}
```

### 教程指南  
```json
{
  "title": "How to {{task}}",
  "content": "Requirements, step-by-step instructions, tips..."
}
```


## WP-CLI 参考手册

适用于本地安装或通过 SSH 访问的场景。

```bash
# Posts
wp post create --post_title="Title" --post_status="draft"
wp post list --post_type=post --format=table
wp post delete {id} --force

# Media
wp media import /path/to/image.jpg --title="Title"

# Database
wp db export backup.sql
wp db optimize
wp search-replace 'old' 'new' --dry-run

# Cache
wp cache flush
wp transient delete --expired

# Users
wp user list
wp user create bob bob@email.com --role=editor
```


## 错误代码（当问题发生时）

| 代码 | 含义 | 应对措施 |
|------|------|-----------|
| 401 | “你是谁？” | 检查用户名/密码 |
| 403 | “无权访问” | 用户权限不足，请提升权限 |
| 404 | “找不到资源” | 检查 URL 或 ID 是否正确 |
| 400 | “请求格式错误” | 检查 JSON 语法是否正确 |
| 500 | “服务器故障” | 检查服务器日志，祈祷 |


## 专业技巧 🎯

1. **先草稿，后发布** —— 上线前务必审阅  
2. **善用 jq** —— 像高手一样解析 JSON：`curl ... | jq '.id'`  
3. **使用 dry-run 测试** —— 适用于 WP-CLI 操作  
4. **批量操作前先备份** —— 务必！务必！  
5. **检查权限设置** —— 确保当前用户角色具备对应操作权限  
6. **使用摘要** —— 更利于 SEO 和归档页展示  
7. **上传前优化图片** —— 加快网站速度 = 提升访客体验  
8. **设置替代文本** —— 无障碍至关重要（SEO 也青睐它）  
9. **定时发布内容** —— 规律性发布优于随机爆发  
10. **关注速率限制** —— 共享主机可能……比较敏感  


## ❓ 常见问题（FAQ）

**是否支持 WordPress.com？**  
仅支持 Business/eCommerce 方案（因其开放 REST API 接入权限）。自托管 WordPress 完全兼容。

**是否支持自定义文章类型？**  
支持！任何在 REST API 中注册的文章类型均可自动启用。

**会破坏我的网站吗？**  
不会。所有功能均基于官方 WordPress REST API——即区块编辑器所依赖的同一套系统。

**需要安装插件吗？**  
不需要。WordPress 自 4.7 版起已内置 REST API。

**我的用户账号需要哪些权限？**  
管理员角色可获得完整访问权限，编辑者角色可管理内容，作者角色仅可管理其本人发布的文章。

**是否支持 WP Engine / Kinsta / Flywheel？**  
支持。适用于任何未禁用 REST API 的主机（几乎不存在此类主机）。

**是否支持多站点（WordPress Network）？**  
支持！请在配置中将每个子站点分别设置为独立站点。


## 🔧 故障排查

```
Not working?
    │
    ▼
┌─────────────────────────────┐
│ Check Application Password  │
│ (regenerate if needed)      │
└──────────────┬──────────────┘
               │
               ▼
         Still broken?
               │
               ▼
┌─────────────────────────────┐
│ Check user role has         │
│ required capabilities       │
└──────────────┬──────────────┘
               │
               ▼
         Still broken?
               │
               ▼
┌─────────────────────────────┐
│ Check REST API is enabled   │
│ (visit /wp-json/ in browser)│
└──────────────┬──────────────┘
               │
               ▼
         Still broken?
               │
               ▼
┌─────────────────────────────┐
│ Check server error logs     │
└─────────────────────────────┘
```

**快速修复方案：**  
- **401 错误：** 密码错误或已过期，请重新生成。  
- **403 错误：** 当前用户权限不足，请尝试使用管理员账号。  
- **404 错误：** 网站 URL 错误或某插件禁用了 REST API。  
- **500 错误：** 服务器异常，请检查主机错误日志。  


*以 🦞 与大量咖啡因打造。*  
*专为更愿与网站对话、而非点击操作的人而生。*