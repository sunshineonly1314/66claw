---
name: bookstack
name_zh: BookStack
description: "BookStack 维基与文档 API 集成。以编程方式管理你的知识库：创建、读取、更新和删除书籍、章节、页面与书架。支持全站内容的全文搜索。适用于以下场景：(1) 创建或编辑维基页面与文档，(2) 在书籍与章节中组织内容，(3) 搜索你的知识库，(4) 自动化文档工作流，(5) 在不同系统间同步内容。支持 HTML 与 Markdown 格式的内容。"
description_zh: BookStack 维基与文档 API 集成。以编程方式管理你的知识库：创建、读取、更新和删除书籍、章节、页面与书架。支持全站内容的全文搜索。适用于以下场景：(1) 创建或编辑维基页面与文档，(2) 在书籍与章节中组织内容，(3) 搜索你的知识库，(4) 自动化文档工作流，(5) 在不同系统间同步内容。支持 HTML 与 Markdown 格式的内容。
---
# BookStack Skill

**BookStack** 是一款开源维基与文档平台。借助此 skill，你可通过 API 全面管理整个知识库——非常适合自动化与系统集成。

## 此 skill 支持哪些功能？

- 📚 创建、编辑、删除 **书籍（Books）**
- 📑 管理书籍内的 **章节（Chapters）**
- 📄 创建/编辑含 HTML 或 Markdown 内容的 **页面（Pages）**
- 🔍 对全部内容执行 **全文搜索**
- 📁 创建与管理用于归类书籍的 **书架（Shelves）**

## 快速开始

```bash
# Alle Bücher auflisten
python3 scripts/bookstack.py list_books

# Suche in der Wissensdatenbank
python3 scripts/bookstack.py search "Home Assistant"

# Seite abrufen
python3 scripts/bookstack.py get_page 123

# Neue Seite erstellen (Markdown)
python3 scripts/bookstack.py create_page --book-id 1 --name "Meine Seite" --markdown "# Titel\n\nInhalt hier..."
```

## 全部命令

### Books（书籍）
```bash
python3 scripts/bookstack.py list_books                    # Alle Bücher
python3 scripts/bookstack.py get_book <id>                 # Buch-Details
python3 scripts/bookstack.py create_book "Name" ["Desc"]   # Neues Buch
python3 scripts/bookstack.py update_book <id> [--name] [--description]
python3 scripts/bookstack.py delete_book <id>
```

### Chapters（章节）
```bash
python3 scripts/bookstack.py list_chapters                 # Alle Kapitel
python3 scripts/bookstack.py get_chapter <id>              # Kapitel-Details
python3 scripts/bookstack.py create_chapter --book-id <id> --name "Name"
python3 scripts/bookstack.py update_chapter <id> [--name] [--description]
python3 scripts/bookstack.py delete_chapter <id>
```

### Pages（页面）
```bash
python3 scripts/bookstack.py list_pages                    # Alle Seiten
python3 scripts/bookstack.py get_page <id>                 # Seiten-Preview
python3 scripts/bookstack.py get_page <id> --content       # Mit HTML-Content
python3 scripts/bookstack.py get_page <id> --markdown      # Als Markdown

# Seite erstellen (in Buch oder Kapitel)
python3 scripts/bookstack.py create_page --book-id <id> --name "Name" --markdown "# Content"
python3 scripts/bookstack.py create_page --chapter-id <id> --name "Name" --html "<p>HTML</p>"

# Seite bearbeiten
python3 scripts/bookstack.py update_page <id> [--name] [--content] [--markdown]
python3 scripts/bookstack.py delete_page <id>
```

### Search（搜索）
```bash
python3 scripts/bookstack.py search "query"                # Alles durchsuchen
python3 scripts/bookstack.py search "query" --type page    # Nur Seiten
python3 scripts/bookstack.py search "query" --type book    # Nur Bücher
```

### Shelves（书架）
```bash
python3 scripts/bookstack.py list_shelves                  # Alle Regale
python3 scripts/bookstack.py get_shelf <id>                # Regal-Details
python3 scripts/bookstack.py create_shelf "Name" ["Desc"]  # Neues Regal
```

## 配置

在 `~/.clawdbot/clawdbot.json` 中设置如下环境变量：

```json
{
  "skills": {
    "entries": {
      "bookstack": {
        "env": {
          "BOOKSTACK_URL": "https://your-bookstack.example.com",
          "BOOKSTACK_TOKEN_ID": "dein-token-id",
          "BOOKSTACK_TOKEN_SECRET": "dein-token-secret"
        }
      }
    }
  }
}
```

### 创建 Token

1. 登录 BookStack
2. **编辑个人资料** → **API Tokens**
3. 点击 **Create Token**
4. 复制 Token ID 与 Secret

⚠️ 用户需具备含 **"Access System API"** 权限的角色！

## API 参考

- **基础 URL**：`{BOOKSTACK_URL}/api`
- **认证请求头**：`Authorization: Token {ID}:{SECRET}`
- **官方文档**：https://demo.bookstackapp.com/api/docs

---

**作者**：Seal 🦭 | **版本**：1.0.1