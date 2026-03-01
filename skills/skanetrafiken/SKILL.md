---
name: skanetrafiken
name_zh: 斯堪尼亚交通
description: 斯科讷地区（瑞典）公共交通出行规划器（Skånetrafiken）。支持公交/火车行程规划，并提供实时延误信息。支持车站、地址、地标及前往哥本哈根的跨境行程。
description_zh: 斯科讷地区（瑞典）公共交通出行规划器（Skånetrafiken）。支持公交/火车行程规划，并提供实时延误信息。支持车站、地址、地标及前往哥本哈根的跨境行程。
license: MIT
compatibility: 需要 curl、jq。兼容 Claude Code 及其他兼容的 agents。
metadata:
  author: rezkam
  version: "1.2.0"
  region: sweden
---
# Skånetrafiken 出行规划器

使用实时发车信息，为瑞典斯科讷地区（Skåne）规划公共交通行程。

## 命令列表

### 1. 地点搜索

搜索车站、地址或兴趣点（POI）。

```bash
./search-location.sh <query> [limit]
```

| 参数 | 描述 |
|----------|-------------|
| `query` | 待搜索的地点名称 |
| `limit` | 返回结果数量（默认：3，上限：10） |

**输出包含：**
- `ID` — 地点标识符（在行程规划中使用）
- `Name` — 地点官方名称
- `Type` — 类型：STOP_AREA（车站）、ADDRESS（地址）或 POI（兴趣点）
- `Area` — 所属区域/市镇
- `Coordinates` — 经纬度坐标

**何时应增加返回结果数量：**
- 首条结果不符合用户意图
- 用户查询存在歧义（例如：“station”、“centrum”）
- 需向用户提供多个选项供其选择

### 2. 行程规划

使用地点 ID，在两个地点之间规划行程。

```bash
./journey.sh <from-id> <from-type> <to-id> <to-type> [datetime] [mode]
```

| 参数 | 描述 |
|----------|-------------|
| `from-id` | 出发地 ID（来自搜索结果）或坐标（`lat#lon`） |
| `from-type` | `STOP_AREA`、`ADDRESS`、`POI` 或 `LOCATION`（坐标格式） |
| `to-id` | 目的地 ID 或坐标 |
| `to-type` | 目的地类型 |
| `datetime` | 可选参数：`"18:30"`、`"tomorrow 09:00"`、`"2026-01-15 09:00"` |
| `mode` | 可选参数：`"depart"`（默认）或 `"arrive"` |

**重要提示：** 行程规划 API 仅接受 `STOP_AREA` 和 `LOCATION` 类型。对于 `ADDRESS` 或 `POI` 类型的结果，请使用其坐标作为 `lat#lon`，并指定类型为 `LOCATION`。

---

## 理解用户的时间意图

在发起查询前，需先明确用户的时间需求：

### 时间意图类型

| 用户表述 | 意图 | 查询方式 |
|-----------|--------|--------------|
| “now”、“next bus”、“how do I get to” | **立即出发（Travel Now）** | 不传 datetime 参数 |
| “in 30 minutes”、“in 1 hour”、“after lunch” | **稍后出发（Depart Later）** | 计算具体时间，使用 `depart` 模式 |
| “around 15:00”、“sometime afternoon” | **大致时间（Around Time）** | 使用偏移量查询（见下文） |
| “arrive by 18:00”、“need to be there at 9” | **准时到达（Arrive By）** | 使用 `arrive` 模式 |
| “tomorrow morning”、“on Friday at 10” | **未来时间（Future Time）** | 使用具体日期时间 |

### 处理“大致时间”类查询

当用户希望获得某个时间点“前后”的行程选项时，应提前 15–30 分钟发起查询，以同时展示该时间点前后的可选方案：

```bash
# User: "I want to travel around 15:00"
# Query at 14:30 to get options spanning 14:30-16:00+
./journey.sh ... "14:30" depart
```

### 相对时间换算

将相对时间表述转换为绝对时间：

| 用户表述 | 当前时间：14:00 | 查询时间 |
|-----------|----------------|------------|
| “in 30m” | → | “14:30” |
| “in 1h” | → | “15:00” |
| “in 2 hours” | → | “16:00” |

---

## LLM 响应格式规范

向用户呈现行程结果时，请遵循以下 emoji 使用规范和格式指南。

### Emoji 参考表

| Emoji | 用途 |
|-------|---------|
| 🚂 | 火车（Pågatåg、Öresundståg） |
| 🚌 | 公交车 |
| 🚇 | 地铁（哥本哈根） |
| 🚋 | 有轨电车 |
| ⛴️ | 渡轮 |
| 🚶 | 步行路段 |
| ⏱️ | 时间/时长 |
| 🕐 | 发车时间 |
| 🏁 | 到达时间 |
| 📍 | 车站/停靠点 |
| 🏠 | 出发地（家/起点） |
| 🎯 | 目的地 |
| ⚠️ | 延误或运营中断 |
| ✅ | 准点 |
| 🔄 | 换乘/换线 |
| 🛤️ | 站台/轨道 |

### 响应结构

**必须始终包含工具输出中的以下关键要素：**

1. **出发时间** — 用户实际需要开始行动的时间（含步行时间）
2. **步行路段** — 任何步行的距离与时长
3. **交通工具发车时间** — 公交/火车实际发车时间
4. **到达时间** — 用户抵达目的地的时间
5. **任何延误信息** — 显示与原计划的时间偏差

### 示例响应格式

**简单直达行程：**
```
🏠 **Leave home at 09:00**

🚶 Walk 450m to Möllevångstorget (5 min)

📍 **Möllevångstorget** → 🎯 **Malmö C**
🚌 Bus 5 departs 09:07 from Möllevångstorget
🏁 Arrives 09:18 at Malmö C

⏱️ Total: 18 min
```

**含换乘的行程：**
```
🏠 **Leave at 08:45**

🚶 Walk 300m to Västra Hamnen (4 min)

📍 **Västra Hamnen** → 🔄 **Malmö C** → 🎯 **Lund C**

**Leg 1:**
🚌 Bus 2 departs 08:51 [🛤️ Läge A]
🏁 Arrives Malmö C 09:05

🔄 Transfer at Malmö C (6 min)

**Leg 2:**
🚂 Pågatåg departs 09:11 [🛤️ Spår 4]
🏁 Arrives Lund C 09:23

⏱️ Total: 38 min | 🔄 1 change
```

**含延误的行程：**
```
🕐 **Depart 14:30** from Triangeln

🚂 Öresundståg 1042 → København H
⚠️ +8 min delay (expected 14:38 instead of 14:30)
🏁 Arrives ~15:25 (normally 15:17)
```

### 步行路段详情

**至关重要：必须始终展示工具输出中的步行细节：**

- 距离（单位：米，来自 `line.distance`）
- 将步行时间纳入“出发时间”计算
- 必须同时展示行程起点和终点的步行信息

示例工具输出：
```
→ WALK 450m from Kalendegatan to Möllevångstorget
```

格式化为：
```
🚶 Walk 450m to Möllevångstorget (~5 min)
```

步行时间估算：约 100 米/分钟（正常步行速度）

### 展示多个选项

当提供多个行程选项时，务必清晰标明各选项的时间：

```
I found 3 options for you:

**Option 1 - Leave now (09:00)** ✅ Recommended
🚶 5 min walk → 🚌 Bus 5 at 09:07 → arrives 09:25
⏱️ Total: 25 min

**Option 2 - Leave in 15m (09:15)**
🚶 5 min walk → 🚌 Bus 5 at 09:22 → arrives 09:40
⏱️ Total: 25 min

**Option 3 - Leave in 30m (09:30)**
🚶 5 min walk → 🚂 Train at 09:37 → arrives 09:48
⏱️ Total: 18 min | Faster but later departure
```

### 时间偏移标注

使用清晰的标注表示发车时间：

| 标注 | 含义 |
|----------|---------|
| "now" | 立即 |
| "in 15m" | 从现在起 15 分钟后 |
| "in 1h" | 从现在起 1 小时后 |
| "at 14:30" | 具体时间点 |

---

## LLM 工作流：如何规划行程

当用户请求规划行程时，请遵循以下工作流：

### 第一步：理解时间意图

解析用户需求：
- **“How do I get to...”** → 立即出发（Travel now）
- **“I need to be there at 18:00”** → 准时到达模式（Arrive mode）
- **“Sometime around 3pm”** → 查询 14:30，展示前后时间段选项
- **“In about an hour”** → 基于当前时间计算

### 第二步：分别搜索出发地与目的地

独立搜索出发地和目的地：

```bash
./search-location.sh "Malmö C"
./search-location.sh "Emporia"
```

### 第三步：验证搜索结果

**仔细核查每条结果：**

1. **是否完全匹配或高度接近？** — 若名称与用户所求一致，即可继续。

2. **是否返回多条结果？** — 脚本最多返回 10 条匹配项。若首条结果不够明确，请向用户确认。

3. **名称差异是否显著？** — 若用户查询“Hyllie 附近的商场”，而结果为“Emporia”，请向用户确认：“我在 Hyllie 附近找到了 Emporia 购物中心。是否正确？”

4. **未返回任何结果？** — 尝试下方列出的替代策略。

### 第四步：处理模糊或失败的搜索

**当结果不匹配或存在歧义时，请提出澄清性问题：**

```
I searched for "centrum" and found multiple locations:
1. Malmö Centrum (bus stop)
2. Lund Centrum (bus stop)
3. Helsingborg Centrum (bus stop)

Which one did you mean?
```

**当未返回任何结果时，请尝试以下策略：**

1. **地址搜索时添加城市名：**
   ```bash
   # If "Storgatan 10" fails, try:
   ./search-location.sh "Storgatan 10, Malmö"
   ```

2. **尝试使用官方车站名称：**
   ```bash
   # If "Malmö station" fails, try:
   ./search-location.sh "Malmö C"
   ```

3. **仅使用地标名称（不含城市名）：**
   ```bash
   # If "Emporia, Malmö" fails, try:
   ./search-location.sh "Emporia"
   ```

4. **最后手段：使用坐标：**
   - 若已知大致位置，可直接使用 `lat#lon` 格式
   - 向用户提问：“我未能找到该地点。您能否提供详细地址或坐标？”

### 第五步：为行程规划 API 转换类型

行程规划 API 仅接受以下两种类型：
- `STOP_AREA` — 公交/火车车站（直接使用 ID）
- `LOCATION` — GPS 坐标，格式为 `lat#lon`

**若搜索结果为 ADDRESS 或 POI：**
- 使用搜索结果中的坐标
- 格式化为 `lat#lon`，类型设为 `LOCATION`

示例：
```bash
# Search returns: ID: 123, Type: ADDRESS, Coordinates: 55.605, 13.003
# Use in journey as:
./journey.sh "55.605#13.003" LOCATION 9021012080000000 STOP_AREA
```

### 第六步：执行行程规划查询

确认出发地与目的地的 ID/坐标后：

```bash
./journey.sh <from-id> <from-type> <to-id> <to-type> [datetime] [mode]
```

### 第七步：使用 emoji 格式化响应

请参照上方 emoji 指南清晰呈现结果。**务必使用工具输出中的实际数值 — 切勿推测或估算。**

---

## 查询格式规范

**搜索 API 对格式敏感，请严格遵守以下规则：**

### 地标与兴趣点（POI）：仅使用名称

使用地标名称，**不要**包含城市名。

```bash
# CORRECT
./search-location.sh "Emporia"
./search-location.sh "Triangeln"
./search-location.sh "Turning Torso"

# WRONG - city name breaks POI search
./search-location.sh "Emporia, Malmö"        # May return wrong location!
./search-location.sh "Triangeln, Malmö"      # Unnecessary, may fail
```

### 街道地址：必须包含城市名

为提升准确率，请包含城市名。

```bash
# CORRECT
./search-location.sh "Kalendegatan 12, Malmö"
./search-location.sh "Storgatan 25, Lund"
./search-location.sh "Drottninggatan 5, Helsingborg"

# RISKY - may be ambiguous
./search-location.sh "Kalendegatan 12"       # Works if unambiguous
```

### 火车站：使用官方名称

中央车站请使用带 “C” 后缀的名称。

```bash
# CORRECT
./search-location.sh "Malmö C"
./search-location.sh "Lund C"
./search-location.sh "Helsingborg C"
./search-location.sh "Malmö Hyllie"
./search-location.sh "Malmö Triangeln"

# WRONG
./search-location.sh "Malmö"                 # Ambiguous!
./search-location.sh "Malmö Central"         # Not official name
./search-location.sh "Lund station"          # Not official name
```

### 哥本哈根（跨境）：使用丹麦语名称或常用别名

```bash
# All work
./search-location.sh "København H"
./search-location.sh "Nørreport"
./search-location.sh "Copenhagen Airport"
./search-location.sh "Köpenhamn"
```

---

## 示例

### 示例 1：立即出发

用户：“如何从马尔默中央车站（Malmö C）前往隆德中央车站（Lund C）？”

```bash
./search-location.sh "Malmö C"
./search-location.sh "Lund C"
./journey.sh 9021012080000000 STOP_AREA 9021012080040000 STOP_AREA
```

**响应：**
```
🏠 **Leave now** from Malmö C

📍 **Malmö C** → 🎯 **Lund C**
🚂 Öresundståg 1324 departs 09:04 [🛤️ Spår 2b]
🏁 Arrives 09:16 at Lund C [🛤️ Spår 1]

⏱️ Total: 12 min | ✅ Direct, no changes
```

### 示例 2：含步行的地址查询

用户：“我需要从马尔默 Kalendegatan 12 号前往 Emporia。”

```bash
./search-location.sh "Kalendegatan 12, Malmö"
./search-location.sh "Emporia"
./journey.sh "55.595#13.001" LOCATION "55.563#12.973" LOCATION
```

**响应：**
```
🏠 **Leave at 10:05**

🚶 Walk 320m to Möllevångstorget (~3 min)

📍 **Möllevångstorget** → 🎯 **Emporia**
🚌 Bus 32 departs 10:10
🏁 Arrives 10:28 at Emporia

🚶 Walk 150m to destination (~2 min)

⏱️ Total: 25 min
```

### 示例 3：准时到达查询

用户：“我需要在明天 18:00 前抵达哥本哈根中央车站。”

```bash
./search-location.sh "Malmö C"
./search-location.sh "København H"
./journey.sh 9021012080000000 STOP_AREA 9921000008600626 STOP_AREA "tomorrow 18:00" arrive
```

**响应：**
```
🎯 **Arrive by 18:00** at København H

📍 **Malmö C** → 🎯 **København H**
🚂 Öresundståg departs **17:21** [🛤️ Spår 1]
🏁 Arrives **17:56** ✅ 4 min buffer

⏱️ Journey: 35 min

💡 Leave Malmö C by 17:21 to arrive on time!
```

### 示例 4：大致时间查询

用户：“我想在 15:00 左右前往隆德。”

```bash
# Query 30 min earlier to show options around 15:00
./journey.sh 9021012080000000 STOP_AREA 9021012080040000 STOP_AREA "14:30"
```

**响应：**
```
Options around 15:00 for Malmö C → Lund C:

**Option 1 - Depart 14:34** (in 25m)
🚂 Pågatåg → arrives 14:52
⏱️ 18 min

**Option 2 - Depart 14:49** (in 40m)
🚂 Öresundståg → arrives 15:01
⏱️ 12 min

**Option 3 - Depart 15:04** (in 55m) ✅ Closest to 15:00
🚂 Pågatåg → arrives 15:22
⏱️ 18 min

Which works best for you?
```

### 示例 5：相对时间查询

用户：“我想大约一小时后出发。”

```bash
# Current time: 13:00, so query for 14:00
./journey.sh ... "14:00"
```

**响应：**
```
Options departing around 14:00 (in ~1h):

**Leave at 13:55** (in 55m)
🚶 5 min walk → 🚌 Bus 5 at 14:02 → arrives 14:25

**Leave at 14:10** (in 1h 10m)
🚶 5 min walk → 🚂 Train at 14:17 → arrives 14:35

Let me know which one works!
```

### 示例 6：含延误的行程

当工具输出显示延误时：
```
From: 14:30 Malmö C [+8 min late]
```

**响应：**
```
📍 **Malmö C** → 🎯 **Lund C**
🚂 Öresundståg 1042
⚠️ **Running 8 min late**
🕐 Scheduled: 14:30 → Expected: ~14:38
🏁 Arrives ~14:50 (normally 14:42)
```

---

## 何时提出澄清性问题

**以下情形必须主动提问：**

1. **搜索无结果：**  
   - “我未能找到 [地点]。您能否提供更多细节，例如完整地址或附近地标？”

2. **存在多个合理匹配项：**  
   - “我找到了若干个与 ‘[查询词]’ 匹配的地点：[列表]。您指的是哪一个？”

3. **结果名称与用户查询差异显著：**  
   - “您查询的是 ‘[用户原始查询]’，但我找到的最接近结果是 ‘[结果名称]’。是否正确？”

4. **用户请求过于模糊：**  
   - “从马尔默出发” → “马尔默的哪个地点？中央车站（Malmö C），还是某个具体地址？”

5. **跨境场景存在歧义：**  
   - “哥本哈根” 可能指不同车站 — 请确认用户需要的是 København H（中央车站）、机场站，还是其他车站。

6. **时间信息不明确：**  
   - “您希望何时出发？现在，还是特定时间？”

---

## 日期时间格式

所有时间均采用瑞典当地时间（CET/CEST）。

| 格式 | 示例 | 含义 |
|--------|---------|---------|
| _(空)_ | | 立即出发 |
| `HH:MM` | `"18:30"` | 今日 18:30 |
| `tomorrow HH:MM` | `"tomorrow 09:00"` | 明日 09:00 |
| `YYYY-MM-DD HH:MM` | `"2026-01-15 09:00"` | 特定日期 |

---

## 输出格式

### 行程选项（原始工具输出）

```
══════════════════════════════════════════════════════════════
OPTION 1: Malmö C → Lund C
══════════════════════════════════════════════════════════════
Date:    2026-01-14
Depart:  09:04
Arrive:  09:16
Changes: 0

LEGS:
  → ORESUND Öresundståg 1324
    From: 09:04 Malmö C [Spår 2b]
    To:   09:16 Lund C [Spår 1]
    Direction: mot Helsingborg C
```

### 交通类型

| 类型 | Emoji | 描述 |
|------|-------|-------------|
| `TRAIN` | 🚂 | Pågatåg（区域列车） |
| `ORESUND` | 🚂 | Öresundståg（跨境列车） |
| `BUS` | 🚌 | 城市或区域公交车 |
| `WALK` | 🚶 | 步行路段 |
| `TRAM` | 🚋 | 有轨电车/轻轨 |
| `METRO` | 🚇 | 哥本哈根地铁 |
| `FERRY` | ⛴️ | 渡轮 |

### 状态指示符

| 指示符 | Emoji | 含义 |
|-----------|-------|---------|
| _(无)_ | ✅ | 准点 |
| `[+X min late]` | ⚠️ | 延误 |
| `[-X min early]` | ℹ️ | 提前运行 |
| `[PASSED]` | ❌ | 已发车 |
| `AVVIKELSE` | 🚨 | 运营中断 |

---

## 错误处理

### “未找到地点”

搜索未返回任何结果。

**应对策略：**
1. 检查拼写（瑞典语特殊字符：å、ä、ö）
2. 尝试使用带 “C” 后缀的官方车站名称（如 “Malmö C”）
3. 对于地标，移除城市后缀
4. 对于地址，添加城市名称
5. 向用户寻求进一步澄清

### “未找到行程”

无可用路线。

**应对策略：**
1. 检查该时段是否有运营服务（深夜/凌晨班次有限）
2. 尝试调整出发时间
3. 建议用户考虑邻近车站

---

## 快速参考表

| 地点类型 | 搜索格式 | 行程规划类型 |
|--------------|---------------|--------------|
| 火车站 | `"Malmö C"` | STOP_AREA |
| 公交站 | `"Möllevångstorget"` | STOP_AREA |
| 地址 | `"Street 12, City"` | 使用坐标 → LOCATION |
| 地标/兴趣点（POI） | `"Emporia"`（不含城市名！） | 使用坐标 → LOCATION |
| 坐标 | `55.605#13.003` | LOCATION |