---
name: karakeep
name_zh: Karakeep
description: 在 Karakeep 实例中管理书签和链接。当用户希望保存链接、列出最近的书签或搜索其收藏时使用。触发短语包括“收藏此链接”、“保存到 karakeep”或“搜索我的书签”。
description_zh: 在 Karakeep 实例中管理书签和链接。当用户希望保存链接、列出最近的书签或搜索其收藏时使用。触发短语包括“收藏此链接”、“保存到 karakeep”或“搜索我的书签”。
metadata: {"clawdbot":{"emoji":"📦","requires":{"bins":["uv"]}}}
---
# Karakeep 技能

在 Karakeep 实例中保存和搜索书签。

## 设置

首先，配置您的实例 URL 和 API 密钥：
```bash
uv run --with requests skills/karakeep/scripts/karakeep-cli.py login --url <instance_url> <api_key>
```

## 命令

### 保存一个链接
将一个 URL 添加到您的收藏中：
```bash
uv run --with requests skills/karakeep/scripts/karakeep-cli.py add <url>
```

### 列出书签
显示最近的书签：
```bash
uv run --with requests skills/karakeep/scripts/karakeep-cli.py list --limit 10
```

### 搜索书签
查找匹配查询条件的书签。支持复杂语法，例如 `is:fav`、`title:word`、`#tag`、`after:YYYY-MM-DD` 等：
```bash
uv run --with requests skills/karakeep/scripts/karakeep-cli.py list --search "title:react is:fav"
```

## 故障排除
- 确保已设置 `KARAKEEP_API_KEY`（或 `HOARDER_API_KEY`），或运行 `login`。
- 验证脚本或配置中（`~/.config/karakeep/config.json`）的实例 URL 是否正确。