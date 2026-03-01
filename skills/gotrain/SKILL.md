---
name: gotrain
name_zh: GoTrain
description: MTA 系统列车发车信息（纽约地铁、长岛铁路 LIRR、大都会北方铁路 Metro-North）。当用户需要查询列车时刻、运行时刻表或 MTA 公共交通服务预警时使用。覆盖大纽约地区范围内的 MTA 地铁、LIRR 和 Metro-North。
description_zh: MTA 系统列车发车信息（纽约地铁、长岛铁路 LIRR、大都会北方铁路 Metro-North）。当用户需要查询列车时刻、运行时刻表或 MTA 公共交通服务预警时使用。覆盖大纽约地区范围内的 MTA 地铁、LIRR 和 Metro-North。
metadata: {"clawdbot":{"requires":{"bins":["gotrain"]},"install":[{"id":"node","kind":"node","package":"gotrain-cli","bins":["gotrain"],"label":"安装 gotrain CLI（npm）"}]}}
---
# gotrain

面向纽约市公共交通发车信息（MTA 地铁、LIRR、Metro-North）的原子化命令行工具。

## 安装

```bash
npm install -g gotrain-cli
```

## 命令

| 命令 | 描述 |
|---------|-------------|
| `gotrain stations [query]` | 列出/搜索车站 |
| `gotrain departures <station-id>` | 显示某车站的列车发车信息 |
| `gotrain alerts` | 查看当前生效的服务预警 |
| `gotrain fav <id>` | 切换收藏车站状态 |
| `gotrain favs` | 列出所有收藏的车站 |

## 常用车站 ID

- `MNR-149` - 新港（New Haven）
- `MNR-151` - 新港州街站（New Haven-State St）
- `MNR-1` - 大中央车站（Grand Central）
- `MNR-203` - 宾夕法尼亚车站（MNR 线，Penn Station (MNR)）
- `LIRR-349` - 大中央车站（Grand Central）
- `SUBWAY-631` - 大中央-42 街站（Grand Central-42 St）

## 示例

```bash
# Search for Penn Station
gotrain stations penn

# New Haven to Grand Central departures
gotrain departures MNR-149

# Check service alerts
gotrain alerts

# Add favorite station
gotrain fav MNR-149
```

## 源代码

https://github.com/gumadeiras/gotrain-cli