---
name: bearblog
name_zh: Bear 博客
description: 在 Bear Blog（bearblog.dev）上创建和管理博客文章。支持扩展 Markdown、自定义属性及基于浏览器的发布。
description_zh: 在 Bear Blog（bearblog.dev）上创建和管理博客文章。支持扩展 Markdown、自定义属性及基于浏览器的发布。
metadata: {"clawdbot":{"emoji":"🐻","homepage":"https://bearblog.dev","requires":{"config":["browser.enabled"]}}}
---
# Bear Blog 技能

在 [Bear Blog](https://bearblog.dev) —— 一款极简、快速的博客平台 —— 上创建、编辑和管理文章。

## 认证

Bear Blog 要求基于浏览器的身份验证。只需通过浏览器工具登录一次，Cookie 即可持久化。

```
browser action:navigate url:https://bearblog.dev/accounts/login/
```

## 创建文章

### 第一步：导航至文章编辑器

```
browser action:navigate url:https://<subdomain>.bearblog.dev/dashboard/post/
```

### 第二步：填写编辑器内容

Bear Blog 使用 **纯文本标题格式** — 无需 JavaScript DOM 操作！

编辑器包含两个文本域：
- `header_content` — 元数据属性（每行一项）
- `body_content` — 实际文章内容（Markdown 格式）

**标题格式：**  
```
title: Your Post Title
link: custom-slug
published_date: 2026-01-05 14:00
tags: tag1, tag2, tag3
make_discoverable: true
is_page: false
class_name: custom-css-class
meta_description: SEO description for the post
meta_image: https://example.com/image.jpg
lang: en
canonical_url: https://original-source.com/post
alias: alternative-url
```

**正文格式：** 标准 Markdown（含扩展功能，详见下文）。

模板中使用分隔符 `___`（三个下划线）来区分标题与正文。

### 第三步：发布

点击发布按钮，或使用 `publish: true` 提交表单。

## 文章属性参考

| 属性 | 描述 | 示例 |
|------|------|------|
| `title` | 文章标题（必需） | `title: My Post` |
| `link` | 自定义 URL slug | `link: my-custom-url` |
| `published_date` | 发布日期/时间 | `published_date: 2026-01-05 14:30` |
| `tags` | 逗号分隔的标签 | `tags: tech, ai, coding` |
| `make_discoverable` | 是否显示在发现动态中 | `make_discoverable: true` |
| `is_page` | 静态页面 vs 博客文章 | `is_page: false` |
| `class_name` | 自定义 CSS 类（已转为小写并添加连字符） | `class_name: featured` |
| `meta_description` | SEO 元描述 | `meta_description: A post about...` |
| `meta_image` | Open Graph 图片 URL | `meta_image: https://...` |
| `lang` | 语言代码 | `lang: fr` |
| `canonical_url` | SEO 规范 URL | `canonical_url: https://...` |
| `alias` | 替代 URL 路径 | `alias: old-url` |

## 扩展 Markdown

Bear Blog 使用 [Mistune](https://github.com/lepture/mistune) 并启用插件：

### 文本格式
- `~~strikethrough~~` → ~~删除线~~
- `^superscript^` → 上标
- `~subscript~` → 下标
- `==highlighted==` → 高亮（mark）
- `**bold**` 和 `*italic*` — 标准语法

### 脚注
```markdown
Here's a sentence with a footnote.[^1]

[^1]: This is the footnote content.
```

### 任务列表
```markdown
- [x] Completed task
- [ ] Incomplete task
```

### 表格
```markdown
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```

### 代码块
````markdown
```python
def hello():
    print("Hello, world!")
```
````

通过 Pygments 实现语法高亮（在 ```).

### Math (LaTeX)
- Inline: `$E = mc^2$`
- Block: `$$\int_0^\infty e^{-x^2} dx$$`

### Abbreviations
``` 后指定语言）  
markdown  
*[HTML]: 超文本标记语言  
HTML 规范由 W3C 维护。  
```

### Admonitions
```markdown  
.. note::  
   这是一条备注提示。  

.. warning::  
   这是一条警告提示。  
```

### Table of Contents
```markdown  
.. toc::  
```

## Dynamic Variables

Use `{{ variable }}` in your content:

### Blog Variables
- `{{ blog_title }}` — Blog title
- `{{ blog_description }}` — Blog meta description
- `{{ blog_created_date }}` — Blog creation date
- `{{ blog_last_modified }}` — Time since last modification
- `{{ blog_last_posted }}` — Time since last post
- `{{ blog_link }}` — Full blog URL
- `{{ tags }}` — Rendered tag list with links

### Post Variables (in post templates)
- `{{ post_title }}` — Current post title
- `{{ post_description }}` — Post meta description
- `{{ post_published_date }}` — Publication date
- `{{ post_last_modified }}` — Time since modification
- `{{ post_link }}` — Full post URL
- `{{ next_post }}` — Link to next post
- `{{ previous_post }}` — Link to previous post

### Post Listing
```markdown  
{{ posts }}  
{{ posts limit:5 }}  
{{ posts tag:"tech" }}  
{{ posts tag:"tech,ai" limit:10 order:asc }}  
{{ posts description:True image:True content:True }}  
```

Parameters:
- `tag:` — filter by tag(s), comma-separated
- `limit:` — max number of posts
- `order:` — `asc` or `desc` (default: desc)
- `description:True` — show meta descriptions
- `image:True` — show meta images
- `content:True` — show full content (only on pages)

### Email Signup (upgraded blogs only)
```markdown  
{{ email-signup }}  
{{ email_signup }}  
```

## Links

### Standard Links
```markdown  
[链接文字](https://example.com)  
[带标题的链接](https://example.com "标题文字")  
```

### Open in New Tab
Prefix URL with `tab:`:
```markdown  
[外部链接](tab:https://example.com)  
```

### Heading Anchors
Headings automatically get slugified IDs:
```markdown  
## 我的小节标题  
```
Links to: `#my-section-title`

## Typography

Automatic replacements:
- `(c)` → ©
- `(C)` → ©
- `(r)` → ®
- `(R)` → ®
- `(tm)` → ™
- `(TM)` → ™
- `(p)` → ℗
- `(P)` → ℗
- `+-` → ±

## Raw HTML

HTML is supported directly in Markdown:

```html  
<div class="custom-class" style="text-align: center;">  
  <p>居中显示且具有自定义样式的文本</p>  
</div>  
```

**Note:** `<script>`, `<object>`, `<embed>`, `<form>` are stripped for free accounts. Iframes are whitelisted (YouTube, Vimeo, Spotify, etc.).

## Whitelisted Iframe Sources

- youtube.com, youtube-nocookie.com
- vimeo.com
- soundcloud.com
- spotify.com
- codepen.io
- google.com (docs, drive, maps)
- bandcamp.com
- apple.com (music embeds)
- archive.org
- And more...

## Dashboard URLs

Replace `<subdomain>` with your blog subdomain:

- **Blog list:** `https://bearblog.dev/dashboard/`
- **Dashboard:** `https://<subdomain>.bearblog.dev/dashboard/`
- **New post:** `https://<subdomain>.bearblog.dev/dashboard/post/`
- **Edit post:** `https://<subdomain>.bearblog.dev/dashboard/post/<uid>/`
- **Styles:** `https://<subdomain>.bearblog.dev/dashboard/styles/`
- **Navigation:** `https://<subdomain>.bearblog.dev/dashboard/nav/`
- **Analytics:** `https://<subdomain>.bearblog.dev/dashboard/analytics/`
- **Settings:** `https://<subdomain>.bearblog.dev/dashboard/settings/`

## Example: Complete Post

**Header content:**
```  
title: 开始使用 AI 助手  
link: ai-assistants-intro  
published_date: 2026-01-05 15:00  
tags: ai, 教程, tech  
make_discoverable: true  
is_page: false  
meta_description: 新手入门指南：如何使用 AI 助手  
lang: en  
```

**Body content:**
```markdown  
AI 助手正在改变我们的工作方式。以下是您需要了解的内容。  

## 为何使用 AI 助手？  

它们可协助完成：  
- [x] 写作与编辑  
- [x] 研究与分析  
- [ ] 泡咖啡（尚未实现！）  

> "The best tool is the one you actually use." — Someone wise  

## 入门指南  

可参阅 [OpenAI](tab:https://openai.com) 或 [Anthropic](tab:https://anthropic.com) 获取主流选项。  

---  

*您对 AI 的使用体验如何？欢迎告诉我！*  

{{ previous_post }} {{ next_post }}  
```

## 使用技巧

1. **发布前预览** — 使用预览按钮检查格式是否正确  
2. **使用模板** — 在仪表板设置中配置文章模板，确保标题格式统一  
3. **定时发布** — 将 `published_date` 设置为未来时间  
4. **草稿模式** — 不点击发布即可保存为草稿  
5. **自定义 CSS** — 添加 `class_name` 并在博客 CSS 中进行样式定制  
6. **SEO 优化** — 务必设置 `meta_description` 和 `meta_image`

## 故障排查

- **文章未显示？** 检查 `publish` 状态与 `published_date`  
- **标签无效？** 请用逗号分隔，不要加引号  
- **样式异常？** 检查 `class_name` 是否已转为小写并添加连字符  
- **日期格式错误？** 请使用 `YYYY-MM-DD HH:MM`