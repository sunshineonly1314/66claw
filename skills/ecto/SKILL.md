---
name: ecto
name_zh: Ecto
description: Ghost.io Admin API CLI，用于管理博客文章、页面、标签及内容。
description_zh: Ghost.io Admin API CLI，用于管理博客文章、页面、标签及内容。
---
# ecto — Ghost.io Admin API CLI

通过 Admin API 管理 Ghost.io 博客。支持多站点配置、Markdown 到 HTML 转换，以及面向脚本的 JSON 输出。

## 快速参考

### 认证
```bash
ecto auth add <name> --url <ghost-url> --key <admin-api-key>
ecto auth list
ecto auth default <name>
ecto auth remove <name>
```

环境变量覆盖项：`GHOST_URL`、`GHOST_ADMIN_KEY`、`GHOST_SITE`

### 文章
```bash
ecto posts [--status draft|published|scheduled|all] [--limit N] [--json]
ecto post <id|slug> [--json] [--body]
ecto post create --title "Title" [--markdown-file file.md] [--stdin-format markdown] [--tag tag1,tag2] [--status draft|published]
ecto post edit <id|slug> [--title "New Title"] [--markdown-file file.md] [--status draft|published]
ecto post delete <id|slug> [--force]
ecto post publish <id|slug>
ecto post unpublish <id|slug>
ecto post schedule <id|slug> --at "2025-01-25T10:00:00Z"
```

### 页面
```bash
ecto pages [--status draft|published|all] [--limit N] [--json]
ecto page <id|slug> [--json] [--body]
ecto page create --title "Title" [--markdown-file file.md] [--status draft|published]
ecto page edit <id|slug> [--title "New Title"] [--markdown-file file.md]
ecto page delete <id|slug> [--force]
ecto page publish <id|slug>
```

### 标签
```bash
ecto tags [--json]
ecto tag <id|slug> [--json]
ecto tag create --name "Tag Name" [--description "desc"]
ecto tag edit <id|slug> [--name "New Name"] [--description "desc"]
ecto tag delete <id|slug> [--force]
```

### 图片
```bash
ecto image upload <path> [--json]
```

### 站点信息
```bash
ecto site [--json]
ecto settings [--json]
ecto users [--json]
ecto user <id|slug> [--json]
ecto newsletters [--json]
ecto newsletter <id> [--json]
```

### Webhook
```bash
ecto webhook create --event <event> --target-url <url> [--name "Hook Name"]
ecto webhook delete <id> [--force]
```

事件类型：`post.published`、`post.unpublished`、`post.added`、`post.deleted`、`page.published` 等。

## 多站点支持

使用 `--site <name>` 指定目标已配置站点：
```bash
ecto posts --site blog2
```

## 常见工作流

从 Markdown 创建并发布：
```bash
ecto post create --title "My Post" --markdown-file post.md --tag blog --status published
```

从标准输入（stdin）管道传入内容：
```bash
echo "# Hello World" | ecto post create --title "Quick Post" --stdin-format markdown
```

安排文章发布时间：
```bash
ecto post schedule future-post --at "2025-02-01T09:00:00Z"
```

批量发布草稿：
```bash
for id in $(ecto posts --status draft --json | jq -r '.posts[].id'); do
  ecto post publish "$id"
done
```

## 局限性
- Ghost API 不支持列出图片或 webhook
- 成员/订阅管理无法通过 Admin API 实现
- 用户仅支持只读访问

## 完整文档

运行 `ecto --ai-help` 获取全面文档。