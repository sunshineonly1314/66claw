---
name: whcli
name_zh: WH CLI
description: Willhaben 命令行工具，用于搜索奥地利最大分类信息平台。支持检索商品列表、查看详情、查询卖家资料。
description_zh: Willhaben 命令行工具，用于搜索奥地利最大分类信息平台。支持检索商品列表、查看详情、查询卖家资料。
homepage: https://github.com/pasogott/whcli
metadata: {"clawdis":{"emoji":"🏠","requires":{"bins":["whcli"]},"install":[{"id":"brew","kind":"brew","formula":"pasogott/tap/whcli","bins":["whcli"],"label":"安装 whcli（Homebrew）"},{"id":"source","kind":"download","url":"https://github.com/pasogott/whcli","bins":["whcli"],"label":"从源码安装（uv）"}]}}
---
# whcli - Willhaben 命令行工具 🏠

通过命令行搜索和浏览奥地利最大分类信息平台 [willhaben.at](https://willhaben.at)。

## 安装方式

### Homebrew（推荐）

```bash
brew install pasogott/tap/whcli
```

### 从源码安装（使用 uv）

```bash
git clone https://github.com/pasogott/whcli.git
cd whcli
uv sync
uv run whcli --help
```

## 命令说明

### 搜索

```bash
# Basic search
whcli search "iphone 15"

# With filters
whcli search "rtx 4090" --category grafikkarten --max-price 1500

# Location filter
whcli search "bicycle" -l Wien -n 20

# Only PayLivery (buyer protection)
whcli search "playstation" --paylivery

# Output as JSON for scripting
whcli search "laptop" --format json
```

**选项说明：**
| 选项 | 简写 | 描述 |
|------|------|------|
| `--category` | `-c` | 类目缩写（如：grafikkarten、smartphones 等） |
| `--min-price` | | 最低价格（欧元） |
| `--max-price` | | 最高价格（欧元） |
| `--condition` | | 商品状态：neu（全新）、gebraucht（二手）、defekt（故障）、neuwertig（近乎全新） |
| `--location` | `-l` | 地点/地区筛选 |
| `--rows` | `-n` | 返回结果数量（默认：30） |
| `--page` | `-p` | 页码 |
| `--paylivery` | | 仅限 PayLivery 商品 |
| `--format` | `-f` | 输出格式：table、json、csv |

### 查看商品详情

```bash
# View listing by ID
whcli show 1993072190

# JSON output
whcli show 1993072190 --format json
```

### 查询卖家资料

```bash
# View seller profile and ratings
whcli seller 29159134
```

## 使用示例

```bash
# Find cheap iPhones in Vienna
whcli search "iphone" -l Wien --max-price 500

# Graphics cards under €1000
whcli search "grafikkarte" --category grafikkarten --max-price 1000

# New condition only
whcli search "ps5" --condition neu

# Export search results as CSV
whcli search "furniture" -l "1220" -n 50 --format csv > results.csv
```

## 常用类目

- `grafikkarten` — 显卡  
- `smartphones` — 手机  
- `notebooks-laptops` — 笔记本电脑  
- `spielkonsolen` — 游戏主机  
- `fahrraeder` — 自行车  
- `moebel` — 家具  

## 已知限制

- ⚠️ `show` 命令存在缺陷（正在修复中）  
- 地点筛选功能可用，但可能包含邻近区域结果  
- 尚未支持 OAuth 登录（暂无法使用站内消息、收藏等功能）  

## 相关链接

- **代码仓库**：https://github.com/pasogott/whcli  
- **问题反馈**：https://github.com/pasogott/whcli/issues  
- **Homebrew Tap**：https://github.com/pasogott/homebrew-tap  