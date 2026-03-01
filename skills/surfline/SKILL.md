---
name: surfline
name_zh: Surfline
description: 从 Surfline 公共端点（无需登录）获取冲浪预报和当前海况信息。可用于查询 Surfline 冲浪点 ID、获取特定冲浪点的预报/海况，以及汇总多个常用冲浪点的信息。
description_zh: 从 Surfline 公共端点（无需登录）获取冲浪预报和当前海况信息。可用于查询 Surfline 冲浪点 ID、获取特定冲浪点的预报/海况，以及汇总多个常用冲浪点的信息。
---
# Surfline（公共接口，无需登录）

该 skill 使用 Surfline 的 **公共端点**（无需账户，不依赖 Cookie）。

## 快速入门

1) 查找冲浪点 ID：

```bash
python3 scripts/surfline_search.py "Cardiff Reef"
python3 scripts/surfline_search.py "D Street"
```

2) 获取指定冲浪点 ID 的报告（默认输出文本 + JSON）：

```bash
python3 scripts/surfline_report.py <spotId>
# or only one format:
python3 scripts/surfline_report.py <spotId> --text
python3 scripts/surfline_report.py <spotId> --json
```

3) 常用冲浪点汇总（支持多个冲浪点）（默认输出文本 + JSON）：

创建 `~/.config/surfline/favorites.json`（参见 `references/favorites.json.example`）。

```bash
python3 scripts/surfline_favorites.py
```

## 注意事项

- 请温和发起请求：避免高频调用端点。脚本中已包含基础缓存机制。
- 冲浪点 ID 是稳定的；建议一次性获取并长期复用。
- 若 Surfline 更改端点或字段结构，请更新 `scripts/surfline_client.py`。