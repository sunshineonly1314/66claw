---
name: swiss-transport
name_zh: 瑞士交通
description: 提供瑞士公共交通实时信息。适用于查询瑞士境内火车、公交、有轨电车或轮渡时刻表。支持车站搜索、出发时刻板、A 到 B 的行程规划以及详细换乘信息。可用于如下查询：“苏黎世下一班火车何时发车？”、“如何从伯尔尼前往日内瓦？”、“显示巴塞尔 SBB 车站的出发信息”。
description_zh: 提供瑞士公共交通实时信息。适用于查询瑞士境内火车、公交、有轨电车或轮渡时刻表。支持车站搜索、出发时刻板、A 到 B 的行程规划以及详细换乘信息。可用于如下查询：“苏黎世下一班火车何时发车？”、“如何从伯尔尼前往日内瓦？”、“显示巴塞尔 SBB 车站的出发信息”。
homepage: https://transport.opendata.ch
---
# 瑞士公共交通

使用官方 transport.opendata.ch API 查询瑞士公共交通（SBB、BLS、ZVV 等）信息。

## 快捷命令

### 搜索车站  
```bash
curl -s "https://transport.opendata.ch/v1/locations?query=Zürich" | jq -r '.stations[] | "\(.name) (\(.id))"'
```  

### 获取下一班出发信息  
```bash
curl -s "https://transport.opendata.ch/v1/stationboard?station=Zürich%20HB&limit=10" | \
  jq -r '.stationboard[] | "\(.stop.departure[11:16]) \(.category) \(.number) → \(.to)"'
```  

### 规划 A 到 B 的行程  
```bash
curl -s "https://transport.opendata.ch/v1/connections?from=Zürich&to=Bern&limit=3" | \
  jq -r '.connections[] | "Departure: \(.from.departure[11:16]) | Arrival: \(.to.arrival[11:16]) | Duration: \(.duration[3:]) | Changes: \(.transfers)"'
```  

### 获取含分段详情的换乘信息  
```bash
curl -s "https://transport.opendata.ch/v1/connections?from=Zürich%20HB&to=Bern&limit=1" | \
  jq '.connections[0].sections[] | {from: .departure.station.name, to: .arrival.station.name, departure: .departure.departure, arrival: .arrival.arrival, transport: .journey.category, line: .journey.number}'
```  

## API 接口端点

### `/v1/locations` —— 车站搜索  
```bash
curl "https://transport.opendata.ch/v1/locations?query=<station-name>"
```  

参数：  
- `query`（必填）：待搜索的车站名称  
- `type`（可选）：按类型过滤（station、address、poi）  

### `/v1/stationboard` —— 出发时刻板  
```bash
curl "https://transport.opendata.ch/v1/stationboard?station=<station>&limit=<number>"
```  

参数：  
- `station`（必填）：车站名称或 ID  
- `limit`（可选）：返回结果数量（默认为 40）  
- `transportations[]`（可选）：按交通方式类型过滤（ice_tgv_rj、ec_ic、ir、re_d、ship、s_sn_r、bus、cableway、arz_ext、tramway_underground）  
- `datetime`（可选）：日期/时间（ISO 格式）  

### `/v1/connections` —— 行程规划器  
```bash
curl "https://transport.opendata.ch/v1/connections?from=<start>&to=<destination>&limit=<number>"
```  

参数：  
- `from`（必填）：起始车站  
- `to`（必填）：目的地车站  
- `via[]`（可选）：途经车站（一个或多个）  
- `date`（可选）：日期（YYYY-MM-DD）  
- `time`（可选）：时间（HH:MM）  
- `isArrivalTime`（可选）：0（出发，默认）或 1（到达）  
- `limit`（可选）：连接数（最多 16 个）  

## 辅助脚本

使用 `scripts/journey.py` 进行格式化的行程规划：

```bash
python3 scripts/journey.py "Zürich HB" "Bern"
python3 scripts/journey.py "Basel" "Lugano" --limit 5
```

## 注意事项

- 所有时间均为瑞士当地时间（CET/CEST）  
- 车站名称支持自动补全（例如输入 “Zürich” 可匹配 “Zürich HB”）  
- API 默认返回 JSON 格式数据  
- 无需 API 密钥  
- 实时数据包含延误信息与站台变更通知  