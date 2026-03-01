---
name: snow-report
name_zh: 雪况报告
description: 获取全球任意滑雪度假村的雪况、天气预报及滑雪报告。当用户询问雪情、粉雪、滑雪条件或山区天气时使用。通过 OpenSnow 支持 1000 多个度假村。用户可设置常去的山峰以实现快速访问。支持 SnowTick 四字母代码（如 JHMR、TARG、MMTH）进行快速查询。
description_zh: 获取全球任意滑雪度假村的雪况、天气预报及滑雪报告。当用户询问雪情、粉雪、滑雪条件或山区天气时使用。通过 OpenSnow 支持 1000 多个度假村。用户可设置常去的山峰以实现快速访问。支持 SnowTick 四字母代码（如 JHMR、TARG、MMTH）进行快速查询。
---
# 雪况报告

从 OpenSnow 获取全球任意滑雪度假村的实时雪况。

## SnowTick — 山峰代码

类比股票代码的四字母山峰标识，用于快速查询：

| 代码 | 度假村 |
|------|--------|
| `JHMR` | 杰克逊霍尔（Jackson Hole） |
| `TARG` | 大塔吉（Grand Targhee） |
| `MMTH` | 巨人山（Mammoth） |
| `BIRD` | 雪鸟（Snowbird） |
| `ALTA` | 阿尔塔（Alta） |
| `BOAT` | 斯特姆博特（Steamboat） |
| `WHIS` | 惠斯勒（Whistler） |

完整列表见 `references/resorts.md`。在任何需输入度假村名称的位置均可直接使用这些代码。

## 命令

| 用户输入 | 执行动作 |
|----------|----------|
| “snowtick” | 快速显示所有收藏山峰的代码滚动条 |
| “snow report” / “how's the snow” | 从用户配置中调取默认山峰 |
| “snow at Mammoth” / “Jackson snow” | 查询指定度假村 |
| “JHMR” / “what's TARG at” | 按 SnowTick 代码查询 |
| “compare Jackson and Targhee” | 多山峰对比 |
| “compare JHMR TARG MMTH” | 按 SnowTick 代码对比多个山峰 |
| “powder alert” / “where's it snowing” | 在所有收藏山峰范围内检查降雪预报 |

## 用户配置

请查阅 `memory/snow-preferences.md` 查看用户设置：

```markdown
# Snow Preferences

## Default Mountain
JHMR

## Favorites
- JHMR (Jackson Hole)
- TARG (Grand Targhee)
- MMTH (Mammoth)
- ALTA (Alta)

## Report Style
- compact (default) | detailed
- skip: parking
```

代码（ticker）与 slug（网址标识符）均可使用。若尚无配置文件，则向用户询问其常去山峰，并创建该文件。

## 代码解析流程

当用户提供一个四字母大写代码时：
1. 在 `references/resorts.md` 中查找该代码；
2. 获取对应 slug；
3. 使用该 slug 构造 OpenSnow 的 URL。

示例：`JHMR` → `jacksonhole` → `opensnow.com/location/jacksonhole/snow-summary`

## 快速使用方式

### SnowTick 命令
```
1. Read user favorites from memory/snow-preferences.md
2. Open all favorite resort tabs in parallel
3. Snapshot each tab for snow data
4. Extract: base depth, 5-day forecast, current conditions
5. Format as ticker tape with best bet arrow
6. Close all tabs
```

### 单一山峰查询
```
1. browser action=open targetUrl=https://opensnow.com/location/{slug}/snow-summary
2. browser action=snapshot compact=true
3. Extract key data, close tab
```

### 多山峰对比
```
1. Open all resort tabs in parallel (browser action=open for each)
2. Snapshot all tabs
3. Extract and format comparison table
4. Close all tabs
```

## 数据提取

从 OpenSnow 快照中提取以下信息：

### 雪况概要
- `Last 24 Hours` — 已报告降雪量 + 时间戳  
- `Next 1-5 Days` — 预报降雪量  
- `Next 6-10 Days` — 延伸预报（Extended forecast）  
- `Next 11-15 Days` — 长期预报（Long range）

### 当前状况（“Right Now”栏目下）
- 气温 + 体感温度  
- 风速、风向、阵风  
- 天气状况（晴天、降雪等）

### 当地专家（每日雪况）
- 专家姓名  
- 预报文字描述  

### AI 综述
- 简明当前状况摘要  

## 输出格式

### SnowTick（收藏山峰仪表盘）
```
📈 SnowTick — {date}

JHMR  12"  ▲ 6"   ❄️ snowing
FISH   8"  ▲ 2"   ☀️ clear  
SGAR  24"  ▲ 12"  ❄️ snowing ←
BALD  36"  ▲ 8"   🌨️ flurries
BRDG   6"  ▲ 0"   ☀️ clear
ROCK   2"  — 0"   ☀️ clear

▲ = next 5 days | ← = best bet
```

列项：代码 | 底部积雪深度 | 5 日预报 | 当前状况  

### 简洁格式（默认）
```
🏔️ {Resort} [{TICK}] — {date}

**Snow:** {24hr}" | Next 5d: {forecast}"
**Now:** {temp}°F, {conditions}, wind {speed} mph
**Daily Snow:** {1 sentence summary}
```

### 详细格式
```
🏔️ {Resort} [{TICK}] — {date}

**Now:** {temp}°F ({feels}°F), {conditions}, wind {speed} mph {dir}

| Period | Snow |
|--------|------|
| Last 24hr | X" |
| Next 5 days | X" |
| Next 6-10 days | X" |
| Next 11-15 days | X" |

**Daily Snow ({expert}):** {full summary}

**AI Overview:** {summary}
```

### 对比表格
```
📊 Snow Comparison — {date}

| Ticker | Resort | 24hr | Next 5d | Next 10d | Temp |
|--------|--------|------|---------|----------|------|
| JHMR | Jackson Hole | 0" | 0" | 8" | 11°F |
| TARG | Grand Targhee | 0" | 2" | 12" | 8°F |
| ALTA | Alta | 0" | 1" | 6" | 15°F |

**Best Bet:** TARG — most snow coming
```

### 粉雪警报
```
🚨 Powder Alert — {date}

Checking your favorites for incoming snow...

| Ticker | Resort | Next 5d | Next 10d |
|--------|--------|---------|----------|
| TARG | Grand Targhee | 6" | 18" | ← Best
| JHMR | Jackson Hole | 0" | 8" |
| ALTA | Alta | 2" | 10" |

**Verdict:** TARG looking best for next week
```

## 度假村 Slug 与 SnowTick 代码对照表

完整列表（含所有代码）请参阅 `references/resorts.md`。

**速查参考：**  
| 地区 | 代码 |
|------|------|
| 怀俄明州 | `JHMR` `TARG` `SNWK` |
| 犹他州 | `ALTA` `BIRD` `PCMR` `DEER` |
| 科罗拉多州 | `VAIL` `AJAX` `TELL` `BOAT` |
| 加利福尼亚州 | `MMTH` `PALI` `KIRK` `HVLY` |
| 蒙大拿州 | `BSKY` `FISH` `BRDG` |
| 不列颠哥伦比亚省（BC） | `WHIS` `RVLK` |
| 日本 | `NSKO` `HAKU` |

对于未列出的度假村：请访问 opensnow.com 进行搜索，从 URL 中提取 slug，并将对应代码添加至参考资料中。

## 首次设置流程

若用户在无配置状态下请求雪况报告：

1. 提问：“您的常去山峰是哪座？我将设为默认山峰。”  
2. 创建 `memory/snow-preferences.md` 文件并填入用户回答；  
3. 提问：“是否还需添加其他常去山峰用于对比？”  
4. 获取用户首份雪况报告。

## 注意事项

- OpenSnow 页面依赖 JavaScript 渲染，需浏览器环境；  
- 数据全天持续更新，早间报告最新鲜；  
- 11–15 天预报可能需付费订阅（仅展示可见内容）；  
- 如需获取度假村专属信息（如缆车运行状态、已压雪雪道），请访问该度假村官网。