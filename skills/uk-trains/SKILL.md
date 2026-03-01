---
name: trains
name_zh: 英国火车
description: Query UK National Rail live departure boards, arrivals, delays, and train services. Use when asked about train times, departures, arrivals, delays, platforms, or "when is the next train" for UK railways. Supports all GB stations via Darwin/Huxley2 API.
description_zh: Query UK National Rail live departure boards, arrivals, delays, and train services. Use when asked about train times, departures, arrivals, delays, platforms, or "when is the next train" for UK railways. Supports all GB stations via Darwin/Huxley2 API.
---
# 英国铁路（UK Trains）

通过英国国家铁路（National Rail）Darwin API 查询实时列车出发与到达信息。

## 设置

需申请免费 Darwin API 密钥：
1. 注册地址：https://realtime.nationalrail.co.uk/OpenLDBWSRegistration/  
2. 将 `NATIONAL_RAIL_TOKEN` 设置为环境变量（或在 skills.entries.uk-trains.apiKey 中配置）

## 命令

```bash
# Departures
./scripts/trains.py departures PAD
./scripts/trains.py departures PAD to OXF --rows 5

# Arrivals  
./scripts/trains.py arrivals MAN
./scripts/trains.py arrivals MAN from EUS

# Station search
./scripts/trains.py search paddington
./scripts/trains.py search kings
```

## 车站代码

使用三位字母 CRS 代码：
- `PAD` = 伦敦帕丁顿站（London Paddington）  
- `EUS` = 伦敦尤斯顿站（London Euston）  
- `KGX` = 伦敦国王十字站（London Kings Cross）  
- `VIC` = 伦敦维多利亚站（London Victoria）  
- `WAT` = 伦敦滑铁卢站（London Waterloo）  
- `MAN` = 曼彻斯特皮卡迪利站（Manchester Piccadilly）  
- `BHM` = 伯明翰新街站（Birmingham New Street）  
- `EDB` = 爱丁堡威弗利站（Edinburgh Waverley）  
- `GLC` = 格拉斯哥中央站（Glasgow Central）  
- `BRI` = 布里斯托尔神庙草地站（Bristol Temple Meads）  
- `LDS` = 利兹站（Leeds）  
- `LIV` = 利物浦莱姆街站（Liverpool Lime Street）  
- `RDG` = 雷丁站（Reading）  
- `OXF` = 牛津站（Oxford）  
- `CBG` = 剑桥站（Cambridge）  

## 响应格式

JSON 格式，包含：
- `locationName`、`crs` —— 车站信息  
- `messages[]` —— 服务告警  
- `trainServices[]` —— 列车列表：  
  - `std` / `sta` —— 计划出发/到达时间  
  - `etd` / `eta` —— 预期时间（“准点”、“延误”或实际时间）  
  - `platform` —— 站台编号  
  - `operator` —— 列车运营公司（TOC）  
  - `destination[].name` —— 终点站  
  - `isCancelled`、`cancelReason`、`delayReason` —— 运营中断信息  

## 消息模板

适用于 WhatsApp/聊天的紧凑格式：

```
🚂 {Origin} → {Destination}

*{dep} → {arr}* │📍{platform} │ 🚃 {coaches}
{status}

*{dep} → {arr}* │📍{platform} │ 🚃 {coaches}
{status}
```

### 元素说明
- **标题：** 🚂 表情符号 + 出发地 → 目的地  
- **时间：** 加粗显示，出发 → 到达时间  
- **站台：** 📍 + 编号（若未知则显示 “TBC”）  
- **车厢数：** 🚃 + 空格 + 数字  
- **状态：**  
  - ✅ 准点  
  - ⚠️ 误点（预计延迟 {时间}）  
  - ❌ 取消 — {原因}  
  - 🔄 从此站始发  

### 示例

```
🚂 Hemel Hempstead → Euston

*20:18 → 20:55* │📍4 │ 🚃 4
✅ On time

*20:55 → 21:30* │📍4 │ 🚃 12
✅ On time

*21:11 → 21:41* │📍4 │ 🚃 8
✅ On time
```

### 获取到达时间

要显示到达时间，需调用两次 API：
1. `departures {origin} to {dest}` —— 获取出发时间及服务 ID  
2. `arrivals {dest} from {origin}` —— 获取到达时间  

通过 serviceID 的数字前缀匹配服务（例如：`4748110HEMLHMP_` 与 `4748110EUSTON__` 匹配）。

### 注意事项
- 各服务间用空行分隔  
- 若无法获取编组数据，则省略车厢数  
- 对于延误情况，显示预期时间：`⚠️ Delayed (exp 20:35)`  