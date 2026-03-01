---
name: notion-skill
name_zh: Notion技能
description: 通过官方 Notion API 操作 Notion 页面和数据库。
description_zh: 通过官方 Notion API 操作 Notion 页面和数据库。
homepage: https://developers.notion.com
metadata:
  clawdbot:
    emoji: 🧠
    requires:
      env:
        - NOTION_API_KEY
    install:
      - id: node
        kind: node
        label: "需安装 notion-cli（Node.js 版）或 notion-cli-py（Python 版）。详见下方文档。"
---
# Notion

该 skill 使 agent 能够借助官方 Notion API 操作 **Notion 页面和数据库**。

该 skill 采用声明式设计：它记录了**安全、推荐的操作方式**，并假定存在一个本地 CLI 工具（`notion-cli`），由该工具实际执行 API 调用。

## 认证

- 在 https://www.notion.so/my-integrations 创建一个 Notion Integration；
- 复制内部 Integration Token；
- 将其导出为：

```bash
export NOTION_API_KEY=secret_xxx
```

将该 Integration 共享给您希望访问的页面或数据库。未共享的内容对 API 不可见。

## 配置文件（个人 / 工作）

您可通过环境变量或配置文件定义多个配置文件（例如：个人、工作）。

默认配置文件：personal（个人）

可通过以下方式覆盖：

```bash
export NOTION_PROFILE=work
```

## 页面

**读取页面：**

```bash
notion-cli page get <page_id>
```

**追加区块（blocks）：**

```bash
notion-cli block append <page_id> --markdown "..."
```

建议优先使用追加操作，而非重写内容。

**创建页面：**

```bash
notion-cli page create --parent <page_id> --title "..."
```

## 数据库

**检查数据库 schema：**

```bash
notion-cli db get <database_id>
```

**查询数据库：**

```bash
notion-cli db query <database_id> --filter <json> --sort <json>
```

**创建新行（row）：**

```bash
notion-cli page create --database <database_id> --props <json>
```

**更新某一行：**

```bash
notion-cli page update <page_id> --props <json>
```

## Schema 变更（高级用法）

应用 schema 变更前，请务必先检查 diff。

未经明确确认，切勿修改数据库 schema。

推荐流程如下：

```bash
notion-cli db schema diff <database_id> --desired <json>
notion-cli db schema apply <database_id> --desired <json>
```

## 安全注意事项

- Notion API 存在速率限制；请谨慎进行批量操作；
- 建议优先使用追加与更新操作，避免破坏性操作；
- ID 为不透明标识符；请显式存储，切勿从 URL 中推断。