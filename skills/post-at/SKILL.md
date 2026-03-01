---
name: post-at
name_zh: 定时发布
description: 管理奥地利邮政（post.at）的包裹配送——查询包裹列表、查看配送状态、设置投递地点偏好。
description_zh: 管理奥地利邮政（post.at）的包裹配送——查询包裹列表、查看配送状态、设置投递地点偏好。
homepage: https://github.com/krausefx/post-at-cli
metadata: {"clawdbot":{"emoji":"📦","requires":{"bins":["node"]}}}
---
# post-at CLI

用于查看和管理 post.at（奥地利邮政）配送服务的非官方命令行工具。采用与网站相同的网页交互流程，需使用您自己的账户凭据。

凭据：`POST_AT_USERNAME` 和 `POST_AT_PASSWORD` 环境变量（或 `--username` / `--password` 选项）。

## 快速参考

### 登录
缓存一个短期有效的会话（自动过期）：
```bash
post-at login
# Output: Logged in as you@example.com
```

### 列出配送信息
即将送达的包裹（默认）：
```bash
post-at deliveries
# Shows: tracking number, ETA, sender, status
```

全部包裹（含已签收）：
```bash
post-at deliveries --all
```

JSON 格式输出：
```bash
post-at deliveries --json
```

限制结果数量：
```bash
post-at deliveries --limit 10
```

### 配送详情
获取指定运单号的详细信息：
```bash
post-at delivery 1042348411302810212306
# Output: tracking, expected delivery, sender, status, picture URL
```

JSON 格式输出：
```bash
post-at delivery <tracking-number> --json
```

### 投递地点选项（Wunschplatz）

列出可用的投递地点选项：
```bash
post-at routing place-options
```

常见选项：
- `Vor_Haustüre` — 门前
- `Vor_Wohnungstüre` — 住户门口
- `AufOderUnter_Briefkasten` — 邮箱下方／上方
- `Hinter_Zaun` — 围栏后方
- `In_Garage` — 车库里
- `Auf_Terrasse` — 露台上
- `Im_Carport` — 车棚内
- `In_Flexbox` — Flexbox（邮政智能投递箱）内
- `sonstige` — 其他指定地点

### 设置投递地点
使用预设快捷方式：
```bash
post-at routing place <tracking-number> \
  --preset vor-der-wohnungstuer \
  --description "Please leave at the door"
```

直接使用键值：
```bash
post-at routing place <tracking-number> \
  --key Vor_Wohnungstüre \
  --description "Bitte vor die Wohnungstür"
```

使用标签：
```bash
post-at routing place <tracking-number> \
  --place "Vor der Wohnungstüre" \
  --description "Custom instructions"
```

## 示例工作流

检查今日／明日将送达的包裹：
```bash
post-at deliveries
```

获取完整详情（含包裹照片）：
```bash
post-at delivery <tracking-number>
```

将所有待投递包裹统一设置为“送至门口”：
```bash
# First list deliveries
post-at deliveries --json > /tmp/deliveries.json

# Then set place for each (requires scripting)
# Example for a specific one:
post-at routing place 1042348411302810212306 \
  --preset vor-der-wohnungstuer \
  --description "Leave at apartment door"
```

## 注意事项

- 会话令牌有效期较短（必要时自动重新登录）
- 并非所有包裹均支持 Wunschplatz（指定投递地点）重定向
- 并非所有包裹都提供照片 URL
- 如需程序化处理，请使用 `--json` 输出格式