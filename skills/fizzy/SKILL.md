---
name: fizzy
name_zh: Fizzy
description: 管理 Fizzy 看板、卡片、步骤、评论和反应。当用户询问看板、卡片、任务、待办事项列表或任何与 Fizzy 相关的内容时使用本 skill。
description_zh: 管理 Fizzy 看板、卡片、步骤、评论和反应。当用户询问看板、卡片、任务、待办事项列表或任何与 Fizzy 相关的内容时使用本 skill。
version: 1.0.0
---
# Fizzy CLI Skill

## 安装与认证要求

### 通过 Homebrew 安装（macOS）

```bash
brew install robzolkos/fizzy-cli/fizzy-cli
```

### 配置凭据

CLI 需要您的 API token 和账户信息。您可通过环境变量或配置文件设置这些参数。

**环境变量（Clawdbot 推荐方式）：**

```bash
# Set these before running fizzy commands
export FIZZY_TOKEN="your_token_here"
export FIZZY_ACCOUNT="your_account_slug"  # e.g., "0000001"
export FIZZY_API_URL="https://fizzy.domain.net/"  # self-hosted
export FIZZY_BOARD="your_default_board_id"  # optional
```

**或使用配置文件**（`~/.config/fizzy/config.yaml`）：

```yaml
token: your_token_here
account: your_account_slug
api_url: https://fizzy.domain.net/
board: your_default_board_id
```

### 获取您的 Token

1. 进入您的 Fizzy 个人资料 → 个人访问令牌（Personal Access Tokens）  
2. 创建一个具备读取 + 写入权限的新令牌  

## ID 格式说明

**重要提示：** 卡片使用两种标识符：

| 字段 | 格式 | 用途 |
| -------- | --------------------------- | ----------------------------------------------- |
| `id` | `03fe4rug9kt1mpgyy51lq8i5i` | 内部 ID（仅在 JSON 响应中出现） |
| `number` | `579` | CLI 命令中使用（如 `card show`、`card update` 等） |

**所有卡片 CLI 命令均使用卡片编号（card NUMBER），而非内部 ID。**

其他资源（看板、列、评论、步骤、反应、用户）均使用其 `id` 字段。

---

## 响应结构

所有响应均遵循以下结构：

```json
{
  "success": true,
  "data": { ... },           // Single object or array
  "meta": {
    "timestamp": "2026-01-12T21:21:48Z"
  }
}
```

**带分页功能的列表响应：**

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "has_next": true,
    "next_url": "https://..."
  },
  "meta": { ... }
}
```

**错误响应：**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Not Found",
    "status": 404
  },
  "meta": { ... }
}
```

**创建/更新响应中包含位置信息（location）：**

```json
{
  "success": true,
  "data": { ... },
  "location": "/6102600/cards/579.json",
  "meta": { ... }
}
```

---

## 资源 Schema（数据结构定义）

所有资源的完整字段参考。请在 jq 查询中严格使用以下字段路径。

### 卡片（Card）Schema

**重要提示：** `card list` 和 `card show` 返回的字段不同。`steps` 仅在 `card show` 中存在。

| 字段 | 类型 | 描述 |
| -------------------- | ----------- | -------------------------------------- |
| `number` | integer | **CLI 命令中使用此字段** |
| `id` | string | 内部 ID（仅在响应中出现） |
| `title` | string | 卡片标题 |
| `description` | string | 纯文本内容（**非对象类型**） |
| `description_html` | string | 含附件的 HTML 版本 |
| `status` | string | 通常为 "published"（表示活跃卡片） |
| `closed` | boolean | true = 卡片已关闭 |
| `golden` | boolean | true = 已加星标/重要 |
| `image_url` | string/null | 页眉/背景图 URL |
| `has_more_assignees` | boolean | 显示的指派人员数量少于实际数量 |
| `created_at` | timestamp | ISO 8601 格式 |
| `last_active_at` | timestamp | ISO 8601 格式 |
| `url` | string | Web URL |
| `comments_url` | string | 评论端点 URL |
| `board` | object | 嵌套的看板对象（见下文） |
| `creator` | object | 嵌套的用户对象（见下文） |
| `assignees` | array | 用户对象数组 |
| `tags` | array | 标签对象数组 |
| `steps` | array | **仅在 `card show` 中存在，不在列表响应中** |

### 看板（Board）Schema

| 字段 | 类型 | 描述 |
| ------------ | --------- | ------------------------------- |
| `id` | string | 看板 ID（CLI 命令中使用） |
| `name` | string | 看板名称 |
| `all_access` | boolean | 所有用户均有访问权限 |
| `created_at` | timestamp | ISO 8601 格式 |
| `url` | string | Web URL |
| `creator` | object | 嵌套的用户对象 |

### 用户（User）Schema

| 字段 | 类型 | 描述 |
| --------------- | --------- | ------------------------------ |
| `id` | string | 用户 ID（CLI 命令中使用） |
| `name` | string | 显示名称 |
| `email_address` | string | 邮箱地址 |
| `role` | string | 角色："owner"、"admin" 或 "member" |
| `active` | boolean | 账户处于激活状态 |
| `created_at` | timestamp | ISO 8601 格式 |
| `url` | string | Web URL |

### 评论（Comment）Schema

| 字段 | 类型 | 描述 |
| ----------------- | --------- | ------------------------------------------ |
| `id` | string | 评论 ID（CLI 命令中使用） |
| `body` | object | **嵌套对象，含 html 和 plain_text 字段** |
| `body.html` | string | HTML 内容 |
| `body.plain_text` | string | 纯文本内容 |
| `created_at` | timestamp | ISO 8601 格式 |
| `updated_at` | timestamp | ISO 8601 格式 |
| `url` | string | Web URL |
| `reactions_url` | string | 反应端点 URL |
| `creator` | object | 嵌套的用户对象 |
| `card` | object | 嵌套的 {id, url} 对象 |

### 步骤（Step）Schema

| 字段 | 类型 | 描述 |
| ----------- | ------- | ------------------------------ |
| `id` | string | 步骤 ID（CLI 命令中使用） |
| `content` | string | 步骤文本 |
| `completed` | boolean | 是否已完成 |

### 列（Column）Schema

| 字段 | 类型 | 描述 |
| -------- | ------- | --------------------------------------------------- |
| `id` | string | 列 ID 或伪 ID（"not-now"、"maybe"、"done"） |
| `name` | string | 显示名称 |
| `kind` | string | 类型："not_now"、"triage"、"closed" 或自定义值 |
| `pseudo` | boolean | true = 内置列 |

### 标签（Tag）Schema

| 字段 | 类型 | 描述 |
| ------------ | --------- | ----------- |
| `id` | string | 标签 ID |
| `title` | string | 标签名称 |
| `created_at` | timestamp | ISO 8601 格式 |
| `url` | string | Web URL |

### 反应（Reaction）Schema

| 字段 | 类型 | 描述 |
| --------- | ------ | ---------------------------------- |
| `id` | string | 反应 ID（CLI 命令中使用） |
| `content` | string | Emoji 表情 |
| `url` | string | Web URL |
| `reacter` | object | 嵌套的用户对象 |

### 身份（Identity）Schema（来自 `identity show`）

| 字段 | 类型 | 描述 |
| ----------------- | ------ | --------------------------------- |
| `accounts` | array | 账户对象数组 |
| `accounts[].id` | string | 账户 ID |
| `accounts[].name` | string | 账户名称 |
| `accounts[].slug` | string | 账户 slug（配合 --account 参数使用） |
| `accounts[].user` | object | 当前账户下的用户对象 |

### 关键 Schema 差异对比

| 资源 | 文本字段 | HTML 字段 |
| -------- | --------------------------- | ---------------------------- |
| 卡片 | `.description`（字符串） | `.description_html`（字符串） |
| 评论 | `.body.plain_text`（嵌套对象） | `.body.html`（嵌套对象） |

---

## 全局标志（Global Flags）

所有命令均支持以下标志：

| 标志 | 描述 |
| ---------------- | -------------------------------------- |
| `--account SLUG` | 账户 slug（适用于多账户用户） |
| `--pretty` | 美化打印 JSON 输出 |
| `--verbose` | 显示请求/响应详情 |

---

## 分页机制（Pagination）

列表类命令使用 `--page` 实现分页。**不存在 `--limit` 标志。**

```bash
# Get first page (default)
fizzy card list --page 1

# Get specific number of results using jq
fizzy card list --page 1 | jq '.data[:5]'

# Fetch ALL pages at once
fizzy card list --all
```

支持 `--all` 和 `--page` 的命令包括：

- `board list`
- `card list`
- `comment list`
- `tag list`
- `user list`
- `notification list`

---

## 常用 jq 模式

### 缩减输出内容

```bash
# Card summary (most useful)
fizzy card list | jq '[.data[] | {number, title, status, board: .board.name}]'

# First N items
fizzy card list | jq '.data[:5]'

# Just IDs
fizzy board list | jq '[.data[].id]'

# Specific fields from single item
fizzy card show 579 | jq '.data | {number, title, status, golden}'

# Card with description length (description is a string, not object)
fizzy card show 579 | jq '.data | {number, title, desc_length: (.description | length)}'
```

### 过滤数据

```bash
# Cards with a specific status
fizzy card list --all | jq '[.data[] | select(.status == "published")]'

# Golden cards only
fizzy card list --indexed-by golden | jq '[.data[] | {number, title}]'

# Cards with non-empty descriptions
fizzy card list | jq '[.data[] | select(.description | length > 0) | {number, title}]'

# Cards with steps (must use card show, steps not in list)
fizzy card show 579 | jq '.data.steps'
```

### 提取嵌套数据

```bash
# Comment text only (body.plain_text for comments)
fizzy comment list --card 579 | jq '[.data[].body.plain_text]'

# Card description (just .description for cards - it's a string)
fizzy card show 579 | jq '.data.description'

# Step completion status
fizzy card show 579 | jq '[.data.steps[] | {content, completed}]'
```

### 活动分析

```bash
# Cards with steps count (requires card show for each)
fizzy card show 579 | jq '.data | {number, title, steps_count: (.steps | length)}'

# Comments count for a card
fizzy comment list --card 579 | jq '.data | length'
```

---

## 命令参考

### 身份（Identity）

```bash
fizzy identity show                    # Show your identity and accessible accounts
```

### 看板（Boards）

```bash
fizzy board list [--page N] [--all]
fizzy board show BOARD_ID
fizzy board create --name "Name" [--all_access true/false] [--auto_postpone_period N]
fizzy board update BOARD_ID [--name "Name"] [--all_access true/false] [--auto_postpone_period N]
fizzy board delete BOARD_ID
```

### 卡片（Cards）

#### 列表与查看

```bash
fizzy card list [flags]
  --board ID                           # Filter by board
  --column ID                          # Filter by column ID or pseudo: not-yet, maybe, done
  --assignee ID                        # Filter by assignee user ID
  --tag ID                             # Filter by tag ID
  --indexed-by LANE                    # Filter: all, closed, not_now, stalled, postponing_soon, golden
  --page N                             # Page number
  --all                                # Fetch all pages

fizzy card show CARD_NUMBER            # Show card details (includes steps)
```

#### 创建与更新

```bash
fizzy card create --board ID --title "Title" [flags]
  --description "HTML"                 # Card description (HTML)
  --description_file PATH              # Read description from file
  --image SIGNED_ID                    # Header image (use signed_id from upload)
  --tag-ids "id1,id2"                  # Comma-separated tag IDs
  --created-at TIMESTAMP               # Custom created_at

fizzy card update CARD_NUMBER [flags]
  --title "Title"
  --description "HTML"
  --description_file PATH
  --image SIGNED_ID
  --created-at TIMESTAMP

fizzy card delete CARD_NUMBER
```

#### 状态变更

```bash
fizzy card close CARD_NUMBER           # Close card (sets closed: true)
fizzy card reopen CARD_NUMBER          # Reopen closed card
fizzy card postpone CARD_NUMBER        # Move to Not Now lane
fizzy card untriage CARD_NUMBER        # Remove from column, back to triage
```

**注意：** 卡片的 `status` 字段对活跃卡片始终为 "published"。请使用以下方式判断状态：

- `closed: true/false` 判断是否已关闭  
- `--indexed-by not_now` 查找已推迟的卡片  
- `--indexed-by closed` 查找已关闭的卡片  

#### 操作（Actions）

```bash
fizzy card column CARD_NUMBER --column ID     # Move to column (use column ID or: maybe, not-yet, done)
fizzy card assign CARD_NUMBER --user ID       # Toggle user assignment
fizzy card tag CARD_NUMBER --tag "name"       # Toggle tag (creates tag if needed)
fizzy card watch CARD_NUMBER                  # Subscribe to notifications
fizzy card unwatch CARD_NUMBER                # Unsubscribe
fizzy card golden CARD_NUMBER                 # Mark as golden/starred
fizzy card ungolden CARD_NUMBER               # Remove golden status
fizzy card image-remove CARD_NUMBER           # Remove header image
```

#### 附件（Attachments）

```bash
fizzy card attachments show CARD_NUMBER                    # List attachments
fizzy card attachments download CARD_NUMBER [INDEX]        # Download (1-based index)
  -o, --output FILENAME                                    # Output filename (single file)
```

### 列（Columns）

看板默认包含伪列：`not-yet`、`maybe`、`done`

```bash
fizzy column list --board ID
fizzy column show COLUMN_ID --board ID
fizzy column create --board ID --name "Name" [--color HEX]
fizzy column update COLUMN_ID --board ID [--name "Name"] [--color HEX]
fizzy column delete COLUMN_ID --board ID
```

### 评论（Comments）

```bash
fizzy comment list --card NUMBER [--page N] [--all]
fizzy comment show COMMENT_ID --card NUMBER
fizzy comment create --card NUMBER --body "HTML" [--body_file PATH] [--created-at TIMESTAMP]
fizzy comment update COMMENT_ID --card NUMBER [--body "HTML"] [--body_file PATH]
fizzy comment delete COMMENT_ID --card NUMBER
```

### 步骤（To-Do Items）

步骤包含在 `card show` 响应中返回。无独立的列表命令。

```bash
fizzy step show STEP_ID --card NUMBER
fizzy step create --card NUMBER --content "Text" [--completed]
fizzy step update STEP_ID --card NUMBER [--content "Text"] [--completed] [--not_completed]
fizzy step delete STEP_ID --card NUMBER
```

### 反应（Reactions）

```bash
fizzy reaction list --card NUMBER --comment COMMENT_ID
fizzy reaction create --card NUMBER --comment COMMENT_ID --content "emoji"
fizzy reaction delete REACTION_ID --card NUMBER --comment COMMENT_ID
```

### 标签（Tags）

使用 `card tag` 时会自动创建标签。列表命令显示所有现有标签。

```bash
fizzy tag list [--page N] [--all]
```

### 用户（Users）

```bash
fizzy user list [--page N] [--all]
fizzy user show USER_ID
```

### 通知（Notifications）

```bash
fizzy notification list [--page N] [--all]
fizzy notification read NOTIFICATION_ID
fizzy notification read-all
fizzy notification unread NOTIFICATION_ID
```

### 文件上传（File Uploads）

```bash
fizzy upload file PATH
# Returns: { "signed_id": "...", "attachable_sgid": "..." }
```

| ID | 用途 |
| ----------------- | --------------------------------------------------- |
| `signed_id` | 卡片页眉/背景图（需配合 `--image` 标志） |
| `attachable_sgid` | 富文本中的内联图片（描述、评论等） |

---

## 示例工作流（Example Workflows）

### 创建含步骤的卡片

```bash
# Create the card
CARD=$(fizzy card create --board BOARD_ID --title "New Feature" \
  --description "<p>Feature description</p>" | jq -r '.data.number')

# Add steps
fizzy step create --card $CARD --content "Design the feature"
fizzy step create --card $CARD --content "Implement backend"
fizzy step create --card $CARD --content "Write tests"
```

### 创建含内联图片的卡片

```bash
# Upload image
SGID=$(fizzy upload file screenshot.png | jq -r '.data.attachable_sgid')

# Create description file with embedded image
cat > desc.html << EOF
<p>See the screenshot below:</p>
<action-text-attachment sgid="$SGID"></action-text-attachment>
EOF

# Create card
fizzy card create --board BOARD_ID --title "Bug Report" --description_file desc.html
```

### 创建含背景图的卡片（仅在用户明确要求时）

```bash
# Validate file is an image
MIME=$(file --mime-type -b /path/to/image.png)
if [[ ! "$MIME" =~ ^image/ ]]; then
  echo "Error: Not a valid image (detected: $MIME)"
  exit 1
fi

# Upload and get signed_id
SIGNED_ID=$(fizzy upload file /path/to/header.png | jq -r '.data.signed_id')

# Create card with background
fizzy card create --board BOARD_ID --title "Card" --image "$SIGNED_ID"
```

### 将卡片沿工作流推进

```bash
# Move to a column
fizzy card column 579 --column maybe

# Assign to user
fizzy card assign 579 --user USER_ID

# Mark as golden (important)
fizzy card golden 579

# When done, close it
fizzy card close 579
```

### 添加带反应的评论

```bash
# Add comment
COMMENT=$(fizzy comment create --card 579 --body "<p>Looks good!</p>" | jq -r '.data.id')

# Add reaction
fizzy reaction create --card 579 --comment $COMMENT --content "👍"
```

---

## 富文本格式（Rich Text Formatting）

卡片描述与评论支持 HTML。如需多个段落并保持间距，请使用：

```html
<p>First paragraph.</p>
<p><br /></p>
<p>Second paragraph with spacing above.</p>
```

**注意：** 每个 `attachable_sgid` 仅可使用一次。如需多次使用，请重新上传该文件。

---

## 默认行为（Default Behaviors）

- **卡片图片：** 默认采用内联方式（通过描述中的 `attachable_sgid` 实现）。仅当用户明确提及“背景”或“页眉”时，才使用背景/页眉图（配合 `signed_id` 与 `--image`）。  
- **评论图片：** 始终以内联方式插入。评论不支持背景图。

---

## 工作流概览（Workflow Summary）

1. **确定操作意图** — 用户希望执行什么操作？  
2. **检查账户上下文** — 如需，使用 `--account=SLUG`  
3. **运行 fizzy 命令**（通过 Bash）  
4. **使用 jq 解析 JSON 输出**，以减少 token 消耗  
5. **清晰汇报结果**，包括卡片编号/实体 ID 以便引用  