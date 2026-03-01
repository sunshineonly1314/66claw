---
name: spots
name_zh: 地点推荐
description: 基于网格扫描的穷尽式 Google Places 搜索。可发现所有地点，而不仅限于 Google 默认返回的结果。
description_zh: 基于网格扫描的穷尽式 Google Places 搜索。可发现所有地点，而不仅限于 Google 默认返回的结果。
metadata:
  clawdbot:
    emoji: 📍
    private: true
---
# spots

**发掘 Google 未展示的隐藏宝藏。**

可执行文件：`~/projects/spots/spots` 或 `go install github.com/foeken/spots@latest`

## 使用方法

```bash
# Search by location name
spots "Arnhem Centrum" -r 800 -q "breakfast,brunch" --min-rating 4

# Search by coordinates (share location from Telegram)
spots -c 51.9817,5.9093 -r 500 -q "coffee"

# Get reviews for a place
spots reviews "Koffiebar FRENKIE"

# Export to map
spots "Amsterdam De Pijp" -r 600 -o map --out breakfast.html

# Setup help
spots setup
```

## 选项

| 标志 | 描述 | 默认值 |
|------|------|--------|
| `-c, --coords` | 直接指定纬度,经度 | - |
| `-r, --radius` | 单位：米 | 500 |
| `-q, --query` | 搜索关键词 | breakfast,brunch,ontbijt,café,bakkerij |
| `--min-rating` | 1–5 | - |
| `--min-reviews` | 返回数量 | - |
| `--open-now` | 仅返回营业中地点 | false |
| `-o, --output` | 输出格式：json/csv/map | json |

## 配置

需启用 Google Places API 与 Geocoding API 的 Google API 密钥。

```bash
spots setup  # full instructions
export GOOGLE_PLACES_API_KEY="..."
```

密钥存储于 1Password：`op://Echo/Google API Key/credential`

## 源码

https://github.com/foeken/spots