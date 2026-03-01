---
name: miniflux-news
name_zh: Miniflux新闻
description: 通过 Miniflux 实例的 REST API（使用 API token）获取并初步筛选最新未读 RSS/新闻条目。当用户要求获取最新 Miniflux 未读条目、列出带标题/链接的近期条目，或为特定 Miniflux 条目生成简短摘要时使用。附带一个封装脚本，用于通过 `~/.config/clawdbot/miniflux-news.json` 中的凭据（或由环境变量 `MINIFLUX_URL` 和 `MINIFLUX_TOKEN` 覆盖）调用 Miniflux API（`/v1/entries` 和 `/v1/entries/{id}`）。
description_zh: 通过 Miniflux 实例的 REST API（使用 API token）获取并初步筛选最新未读 RSS/新闻条目。当用户要求获取最新 Miniflux 未读条目、列出带标题/链接的近期条目，或为特定 Miniflux 条目生成简短摘要时使用。附带一个封装脚本，用于通过 `~/.config/clawdbot/miniflux-news.json` 中的凭据（或由环境变量 `MINIFLUX_URL` 和 `MINIFLUX_TOKEN` 覆盖）调用 Miniflux API（`/v1/entries` 和 `/v1/entries/{id}`）。
---
# Miniflux 新闻

使用附带脚本获取条目，然后格式化为清晰列表，并可选地生成摘要。

## 配置（凭据）

该 skill 默认从本地配置文件读取 Miniflux 凭据。

### 配置文件（推荐）

路径：
- `~/.config/clawdbot/miniflux-news.json`

格式：
```json
{
  "url": "https://your-miniflux.example",
  "token": "<api-token>"
}
```

使用脚本创建/更新该文件：

```bash
python3 skills/miniflux-news/scripts/miniflux.py configure \
  --url "https://your-miniflux.example" \
  --token "<api-token>"
```

### 环境变量（覆盖方式）

可覆盖配置文件（适用于 CI 场景）：

```bash
export MINIFLUX_URL="https://your-miniflux.example"
export MINIFLUX_TOKEN="<api-token>"
```

Token 权限范围：需具备读取权限的 Miniflux API token。

## 获取最新条目

列出最新未读条目（默认行为）：

```bash
python3 skills/miniflux-news/scripts/miniflux.py entries --limit 20
```

按类别名称筛选：

```bash
python3 skills/miniflux-news/scripts/miniflux.py entries --category "News" --limit 20
```

如需机器可读输出：

```bash
python3 skills/miniflux-news/scripts/miniflux.py entries --limit 50 --json
```

### 响应格式

- 返回紧凑的项目符号列表：**[id] 标题 — 来源订阅源** + 链接。
- 向用户确认希望摘要的数量（例如：“摘要 3 篇” 或 “摘要 id 123,124”）。

## 查看完整内容

显示 Miniflux 中存储的完整文章内容（适用于阅读或生成更优摘要）：

```bash
python3 skills/miniflux-news/scripts/miniflux.py entry 123 --full --format text
```

如需获取 Miniflux 所存储的原始 HTML：

```bash
python3 skills/miniflux-news/scripts/miniflux.py entry 123 --full --format html
```

## 类别

列出所有类别：

```bash
python3 skills/miniflux-news/scripts/miniflux.py categories
```

## 将条目标记为已读（仅限显式操作）

该 skill **绝不可**隐式地将任何条目标记为已读。仅当用户明确要求将特定 id 标记为已读时才执行此操作。

将指定 id 标记为已读：

```bash
python3 skills/miniflux-news/scripts/miniflux.py mark-read 123 124 --confirm
```

将某类别中所有未读条目标记为已读（仍属显式操作，需提供 `--confirm`；含安全确认 `--limit`）：

```bash
python3 skills/miniflux-news/scripts/miniflux.py mark-read-category "News" --confirm --limit 500
```

## 摘要生成

为指定条目 id 获取完整内容（机器可读）：

```bash
python3 skills/miniflux-news/scripts/miniflux.py entry 123 --json
```

摘要生成规则：
- 摘要最多包含 3–6 个要点。
- 首句须直指核心价值（“所以这有什么意义？”）。
- 若内容为空或被截断，则如实说明，并基于标题及可用片段生成摘要。
- 不得捏造事实；若原文含关键数字/名称，请直接引用。

## 故障排查

- 若脚本报错“缺少凭据”，请设置 `MINIFLUX_URL`/`MINIFLUX_TOKEN`，或创建 `~/.config/clawdbot/miniflux-news.json`。
- 若收到 HTTP 401 错误：token 错误或已过期。
- 若收到 HTTP 404 错误：基础 URL 错误（应为 Miniflux 的 Web 根路径）。