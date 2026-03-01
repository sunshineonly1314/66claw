---
name: flight-tracker
name_zh: 航班追踪
description: 航班跟踪与时刻表查询。利用 OpenSky Network，按区域、呼号或机场实时跟踪航班。搜索机场之间的航班时刻表。适用于如下查询：“瑞士上空有哪些航班？”、“从汉堡飞往苏黎世的航班何时抵达？”、“跟踪航班 SWR123”。
description_zh: 航班跟踪与时刻表查询。利用 OpenSky Network，按区域、呼号或机场实时跟踪航班。搜索机场之间的航班时刻表。适用于如下查询：“瑞士上空有哪些航班？”、“从汉堡飞往苏黎世的航班何时抵达？”、“跟踪航班 SWR123”。
homepage: https://openskynetwork.github.io/opensky-api/
---
# 航班追踪器（Flight Tracker）

实时跟踪航班，并搜索机场之间的航班时刻表。

## 快捷命令（Quick Commands）

### 实时航班追踪（Live Flight Tracking）

#### 追踪指定区域（边界框）上空的航班  
```bash
# Switzerland (lat_min, lat_max, lon_min, lon_max)
curl -s "https://opensky-network.org/api/states/all?lamin=45.8&lomin=5.9&lamax=47.8&lomax=10.5" | \
  jq -r '.states[] | "\(.[1]) - \(.[2]) | Alt: \(.[7])m | Speed: \(.[9])m/s | From: \(.[5])"'
```

### 按呼号追踪特定航班  
```bash
curl -s "https://opensky-network.org/api/states/all?icao24=<aircraft-icao>" | jq .
```

#### 获取实时航班信息  
```bash
# Use helper script
python3 scripts/track.py --region switzerland
python3 scripts/track.py --callsign SWR123
python3 scripts/track.py --airport LSZH
```

### 航班时刻表（Flight Schedules）

搜索两机场之间的计划航班：

```bash
# Basic usage (shows search links)
python3 scripts/schedule.py HAM ZRH

# With specific date
python3 scripts/schedule.py --from HAM --to ZRH --date 2026-01-15

# With API key (optional, for detailed results)
export AVIATIONSTACK_API_KEY='your_key_here'
python3 scripts/schedule.py HAM ZRH
```

**未提供 API key 时：** 显示有用的搜索链接（Google Flights、FlightRadar24、航空公司官网等）  

**提供 API key 时：** 获取实时时刻表数据，含起飞/到达时间、航站楼、登机口及状态  

免费 API key 可在 [aviationstack.com](https://aviationstack.com) 获取（每月 100 次请求）

## 预设区域（Regions）

脚本中预定义的区域：

- **switzerland**: 瑞士领空  
- **europe**: 欧洲领空（粗略范围）  
- **zurich**: 苏黎世周边区域  
- **geneva**: 日内瓦周边区域  

## API 接口端点（API Endpoints）

### 所有航班状态（All states）  
```bash
GET https://opensky-network.org/api/states/all
```  

可选参数：  
- `lamin`、`lomin`、`lamax`、`lomax`：边界框坐标  
- `icao24`：特定飞机（十六进制代码）  
- `time`：Unix 时间戳（0 表示当前时间）  

### 响应格式（Response Format）

每条航班状态包含：  
```
[0]  icao24      - Aircraft ICAO24 address (hex)
[1]  callsign    - Flight callsign (e.g., "SWR123")
[2]  origin_country - Country name
[5]  origin      - Origin airport (if available)
[7]  baro_altitude - Altitude in meters
[9]  velocity    - Speed in m/s
[10] heading     - Direction in degrees
[11] vertical_rate - Climb/descent rate in m/s
```  

## 机场代码（Airport Codes）

### ICAO（用于实时追踪）  
- **LSZH** — 苏黎世  
- **LSGG** — 日内瓦  
- **LSZB** — 伯尔尼  
- **LSZA** — 卢加诺  
- **LFSB** — 巴塞尔-米卢斯（欧洲机场）  

### IATA（用于时刻表查询）  
- **ZRH** — 苏黎世  
- **GVA** — 日内瓦  
- **BSL** — 巴塞尔  
- **BRN** — 伯尔尼  
- **LUG** — 卢加诺  
- **HAM** — 汉堡  
- **FRA** — 法兰克福  
- **MUC** — 慕尼黑  
- **BER** — 柏林  
- **LHR** — 伦敦希思罗  
- **CDG** — 巴黎戴高乐  
- **AMS** — 阿姆斯特丹  

## 注意事项（Notes）

### 实时追踪（OpenSky Network）  
- 免费 API，含速率限制（匿名用户：每日 400 次）  
- 数据源自全球 ADS-B 接收器，实时性强  
- 无需 API key  
- 数据每 10 秒更新一次  
- 注册账户可获得更高限额及历史数据访问权限  

### 航班时刻表（AviationStack）  
- 可选 API key 以获取更详尽的时刻表数据  
- 免费套餐：每月 100 次请求  
- 未提供 API key 时：提供 Google Flights、FlightRadar24 等搜索链接  
- 支持按日期查询  