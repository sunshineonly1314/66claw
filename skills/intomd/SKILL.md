---
name: intomd
name_zh: Markdown 转换
version: 1.0.0
description: 使用 into.md 服务抓取任意文档 URL 并转换为 Markdown。
description_zh: 使用 into.md 服务抓取任意文档 URL 并转换为 Markdown。
metadata: {"clawdbot":{"emoji":"📄","requires":{"bins":["curl"]}}}
---
# intomd

使用 `intomd` 通过 into.md 服务从文档网站抓取干净的 Markdown 内容。

## 使用方法

```bash
# Fetch markdown
curl -sL "https://into.md/$1"
```

## 示例

```bash
intomd https://zod.dev
```