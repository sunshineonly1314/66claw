---
name: reflect
name_zh: 反思
description: 追加内容至每日笔记，并在 Reflect 中创建新笔记。适用于记录想法、待办事项，或将信息同步至您的知识图谱。
description_zh: 追加内容至每日笔记，并在 Reflect 中创建新笔记。适用于记录想法、待办事项，或将信息同步至您的知识图谱。
homepage: https://reflect.app
---
# Reflect 笔记技能

Reflect 是一款网络化笔记应用。所有笔记均采用端到端加密（E2E encrypted），因此其 API 为**仅追加（append-only）** 模式——我们可写入内容，但无法读取已有笔记正文。

## 初始化配置

1. 在 https://reflect.app/developer/oauth 创建 OAuth 凭据；  
2. 通过该界面生成访问令牌（access token）；  
3. 设置环境变量：  
   ```bash
   export REFLECT_TOKEN="your-access-token"
   export REFLECT_GRAPH_ID="your-graph-id"  # Find via: curl -H "Authorization: Bearer $REFLECT_TOKEN" https://reflect.app/api/graphs
   ```  

或将其保存至 1Password，并在 `scripts/reflect.sh` 中更新您的保险库（vault）/条目（item）路径。

## 支持的操作

1. **追加至每日笔记** —— 向今日笔记（或指定日期的笔记）中添加条目；  
2. **创建新笔记** —— 创建独立笔记，含主题（subject）与 Markdown 格式正文；  
3. **创建链接（Link）** —— 保存书签并附带高亮内容；  
4. **获取已存链接/书籍** —— 检索已保存的链接与书籍列表。

## API 参考

基础 URL：`https://reflect.app/api`  
认证方式：`Authorization: Bearer <access_token>`  

### 追加至每日笔记

```bash
curl -X PUT "https://reflect.app/api/graphs/$REFLECT_GRAPH_ID/daily-notes" \
  -H "Authorization: Bearer $REFLECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your text here",
    "transform_type": "list-append",
    "date": "2026-01-25",          # optional, defaults to today
    "list_name": "[[List Name]]"   # optional, append to specific list
  }'
```

### 创建笔记

```bash
curl -X POST "https://reflect.app/api/graphs/$REFLECT_GRAPH_ID/notes" \
  -H "Authorization: Bearer $REFLECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Note Title",
    "content_markdown": "# Heading\n\nContent here...",
    "pinned": false
  }'
```

### 创建链接（Link）

```bash
curl -X POST "https://reflect.app/api/graphs/$REFLECT_GRAPH_ID/links" \
  -H "Authorization: Bearer $REFLECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "title": "Page Title",
    "description": "Optional description",
    "highlights": ["Quote 1", "Quote 2"]
  }'
```

### 获取链接（Links）

```bash
curl "https://reflect.app/api/graphs/$REFLECT_GRAPH_ID/links" \
  -H "Authorization: Bearer $REFLECT_TOKEN"
```

## 辅助脚本

使用 `scripts/reflect.sh` 执行常见操作：

```bash
# Append to daily note
./scripts/reflect.sh daily "Remember to review PR #6"

# Append to specific list in daily note  
./scripts/reflect.sh daily "Buy milk" "[[Shopping]]"

# Create a new note
./scripts/reflect.sh note "Meeting Notes" "# Standup\n\n- Discussed X\n- Action item: Y"

# Save a link
./scripts/reflect.sh link "https://example.com" "Example Site" "Great resource"
```

## 典型用例

- 将聊天中产生的**待办事项（todos）** → 追加至每日笔记；  
- 保存对话中提及的**有趣链接**；  
- 创建**会议纪要**或摘要；  
- 将**提醒事项**同步至 Reflect 以持久化存储；  
- 为 `[[Ideas]]` 或 `[[Project Name]]` 等列表建立反向链接（backlink）。

## 局限性

- **无法读取笔记正文**（因端到端加密）；  
- **仅支持追加** —— 不可编辑或删除已有内容；  
- **不支持搜索** —— 无法查询已有笔记。