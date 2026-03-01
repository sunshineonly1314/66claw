---
name: wienerlinien
name_zh: 维也纳交通
description: 维也纳公共交通（Wiener Linien）实时数据技能。当用户询问维也纳公共交通（地铁 U-Bahn、有轨电车、公交、夜班车）的发车时刻、时刻表、服务中断、电梯状态或出行指引时，请使用此 skill。可查询站点、线路及交通信息。
description_zh: 维也纳公共交通（Wiener Linien）实时数据技能。当用户询问维也纳公共交通（地铁 U-Bahn、有轨电车、公交、夜班车）的发车时刻、时刻表、服务中断、电梯状态或出行指引时，请使用此 skill。可查询站点、线路及交通信息。
---
# Wiener Linien 实时 API

查询维也纳公共交通的实时发车信息、服务中断、电梯停运及运营信息。

## 快速参考

| 端点 | 用途 |
|------|------|
| `/monitor` | 查询某一站点的实时发车信息 |
| `/trafficInfoList` | 查询当前全部服务中断信息 |
| `/trafficInfo` | 查询特定中断事件的详细信息 |
| `/newsList` | 查询服务公告与电梯维护信息 |

**基础 URL：** `https://www.wienerlinien.at/ogd_realtime`

---

## 查找站点 ID

站点通过 **RBL 编号**（Rechnergestütztes Betriebsleitsystem，计算机辅助运营调度系统）标识。请参考如下参考数据：

```bash
# Search stops by name
curl -s "https://www.wienerlinien.at/ogd_realtime/doku/ogd/wienerlinien-ogd-haltepunkte.csv" | grep -i "stephansplatz"

# Format: StopID;DIVA;StopText;Municipality;MunicipalityID;Longitude;Latitude
```

**常用站点 ID（RBL）：**

| 站点 | RBL ID | 线路 |
|------|--------|------|
| Stephansplatz（圣斯蒂芬广场） | 252, 4116, 4119 | U1, U3 |
| Karlsplatz（卡尔广场） | 143, 144, 4101, 4102 | U1, U2, U4 |
| Westbahnhof（西站） | 1346, 1350, 1368 | U3, U6 |
| Praterstern（普拉特之星） | 4205, 4210 | U1, U2 |
| Schwedenplatz（瑞典广场） | 1489, 1490, 4103 | U1, U4 |
| Schottentor（舍滕托尔） | 40, 41, 4118 | U2, 有轨电车（Trams） |

---

## 1. 实时发车信息（`/monitor`）

获取一个或多个站点的下一班发车信息。

### 请求方式

```bash
# Single stop
curl -s "https://www.wienerlinien.at/ogd_realtime/monitor?stopId=252"

# Multiple stops
curl -s "https://www.wienerlinien.at/ogd_realtime/monitor?stopId=252&stopId=4116"

# With disruption info
curl -s "https://www.wienerlinien.at/ogd_realtime/monitor?stopId=252&activateTrafficInfo=stoerungkurz&activateTrafficInfo=stoerunglang&activateTrafficInfo=aufzugsinfo"
```

### 参数

| 参数 | 是否必需 | 描述 |
|------|----------|------|
| `stopId` | 是（1 个或多个） | RBL 站点 ID |
| `activateTrafficInfo` | 否 | 是否包含中断信息：`stoerungkurz`、`stoerunglang`、`aufzugsinfo` |
| `aArea` | 否 | `1` = 包含具有相同 DIVA 编号的所有站台 |

### 响应结构

```json
{
  "data": {
    "monitors": [{
      "locationStop": {
        "properties": {
          "name": "60201234",      // DIVA number
          "title": "Stephansplatz", // Stop name
          "attributes": { "rbl": 252 }
        },
        "geometry": {
          "coordinates": [16.3726, 48.2085]  // lon, lat (WGS84)
        }
      },
      "lines": [{
        "name": "U1",
        "towards": "Leopoldau",
        "direction": "H",           // H=hin, R=retour
        "type": "ptMetro",
        "barrierFree": true,
        "realtimeSupported": true,
        "trafficjam": false,
        "departures": {
          "departure": [{
            "departureTime": {
              "timePlanned": "2025-01-08T19:30:00.000+0100",
              "timeReal": "2025-01-08T19:31:30.000+0100",
              "countdown": 3  // minutes until departure
            }
          }]
        }
      }]
    }]
  },
  "message": { "value": "OK", "messageCode": 1 }
}
```

### 关键字段

| 字段 | 描述 |
|------|------|
| `countdown` | 距离发车剩余分钟数 |
| `timePlanned` | 计划发车时间 |
| `timeReal` | 实时预测发车时间（如可用） |
| `barrierFree` | 是否无障碍（轮椅可通行） |
| `trafficjam` | 是否受交通拥堵影响导致到站延迟 |
| `type` | `ptMetro`、`ptTram`、`ptBusCity`、`ptBusNight` |

---

## 2. 服务中断信息（`/trafficInfoList`）

获取当前全部服务中断信息。

### 请求方式

```bash
# All disruptions
curl -s "https://www.wienerlinien.at/ogd_realtime/trafficInfoList"

# Filter by line
curl -s "https://www.wienerlinien.at/ogd_realtime/trafficInfoList?relatedLine=U3&relatedLine=U6"

# Filter by stop
curl -s "https://www.wienerlinien.at/ogd_realtime/trafficInfoList?relatedStop=252"

# Filter by type
curl -s "https://www.wienerlinien.at/ogd_realtime/trafficInfoList?name=aufzugsinfo"
```

### 参数

| 参数 | 描述 |
|------|------|
| `relatedLine` | 线路名称（如 U1、13A 等），可重复多次 |
| `relatedStop` | RBL 站点 ID，可重复多次 |
| `name` | 类别：`stoerunglang`、`stoerungkurz`、`aufzugsinfo`、`fahrtreppeninfo` |

### 响应

```json
{
  "data": {
    "trafficInfos": [{
      "name": "eD_23",
      "title": "Gumpendorfer Straße",
      "description": "U6 Bahnsteig Ri. Siebenhirten - Aufzug außer Betrieb",
      "priority": "1",
      "time": {
        "start": "2025-01-08T06:00:00.000+0100",
        "end": "2025-01-08T22:00:00.000+0100"
      },
      "relatedLines": ["U6"],
      "relatedStops": [4611],
      "attributes": {
        "status": "außer Betrieb",
        "station": "Gumpendorfer Straße",
        "location": "U6 Bahnsteig Ri. Siebenhirten"
      }
    }],
    "trafficInfoCategories": [{
      "id": 1,
      "name": "aufzugsinfo",
      "title": "Aufzugsstörungen"
    }]
  }
}
```

### 中断类别

| 名称 | 描述 |
|------|------|
| `stoerunglang` | 长期中断 |
| `stoerungkurz` | 短期中断 |
| `aufzugsinfo` | 电梯停运 |
| `fahrtreppeninfo` | 自动扶梯停运 |

---

## 3. 特定中断详情（`/trafficInfo`）

根据名称查询某项特定中断的详细信息。

```bash
curl -s "https://www.wienerlinien.at/ogd_realtime/trafficInfo?name=eD_265&name=eD_37"
```

---

## 4. 服务公告（`/newsList`）

计划内维护、电梯服务窗口期、运营公告等。

```bash
# All news
curl -s "https://www.wienerlinien.at/ogd_realtime/newsList"

# Filter by line/stop/category
curl -s "https://www.wienerlinien.at/ogd_realtime/newsList?relatedLine=U6&name=aufzugsservice"
```

### 类别

| 名称 | 描述 |
|------|------|
| `aufzugsservice` | 计划内电梯维护 |
| `news` | 一般性服务公告 |

---

## 参考数据（CSV 格式）

### 站点（Haltepunkte）—— 主要数据集

```bash
curl -s "https://www.wienerlinien.at/ogd_realtime/doku/ogd/wienerlinien-ogd-haltepunkte.csv"
# StopID;DIVA;StopText;Municipality;MunicipalityID;Longitude;Latitude
```

**StopID 即 API 调用中使用的 RBL 编号。**

### 车站（Haltestellen）

```bash
curl -s "https://www.wienerlinien.at/ogd_realtime/doku/ogd/wienerlinien-ogd-haltestellen.csv"
# DIVA;PlatformText;Municipality;MunicipalityID;Longitude;Latitude
```

### 线路

```bash
curl -s "https://www.wienerlinien.at/ogd_realtime/doku/ogd/wienerlinien-ogd-linien.csv"
# LineID;LineText;SortingHelp;Realtime;MeansOfTransport
```

**运输方式（MeansOfTransport）：** `ptMetro`、`ptTram`、`ptBusCity`、`ptBusNight`

---

## 常见使用场景

### “Stephansplatz 站下一班 U1 何时发车？”

```bash
# Stephansplatz U1 platform RBL: 4116
curl -s "https://www.wienerlinien.at/ogd_realtime/monitor?stopId=4116" | jq '.data.monitors[].lines[] | select(.name=="U1") | {line: .name, towards: .towards, departures: [.departures.departure[].departureTime.countdown]}'
```

### “目前是否有地铁（U-Bahn）服务中断？”

```bash
curl -s "https://www.wienerlinien.at/ogd_realtime/trafficInfoList?relatedLine=U1&relatedLine=U2&relatedLine=U3&relatedLine=U4&relatedLine=U6" | jq '.data.trafficInfos[] | {title, description, lines: .relatedLines}'
```

### “哪些电梯处于停运状态？”

```bash
curl -s "https://www.wienerlinien.at/ogd_realtime/trafficInfoList?name=aufzugsinfo" | jq '.data.trafficInfos[] | {station: .attributes.station, location: .attributes.location, status: .attributes.status}'
```

### “查询 Karlsplatz 站全部发车信息并附带所有中断详情”

```bash
curl -s "https://www.wienerlinien.at/ogd_realtime/monitor?stopId=143&stopId=144&stopId=4101&stopId=4102&activateTrafficInfo=stoerungkurz&activateTrafficInfo=stoerunglang&activateTrafficInfo=aufzugsinfo"
```

---

## 错误码

| 代码 | 含义 |
|------|------|
| 311 | 数据库不可用 |
| 312 | 站点不存在 |
| 316 | 请求频率超限 |
| 320 | 查询参数无效 |
| 321 | 缺少必需参数 |
| 322 | 数据库中无对应数据 |

---

## 车辆类型

| 类型 | 描述 |
|------|------|
| `ptMetro` | 地铁（U-Bahn） |
| `ptTram` | 有轨电车（Straßenbahn） |
| `ptBusCity` | 城市公交（City bus） |
| `ptBusNight` | 夜班车（N 线路） |

---

## 使用提示

1. **多站台处理**：单个车站可能对应多个 RBL ID（每个站台/方向各一个）。如需完整发车信息，请查询全部对应 ID。

2. **实时性说明**：请检查 `realtimeSupported` —— 部分线路仅提供计划时刻，不支持实时预测。

3. **倒计时 vs 实时时间**：显示界面推荐使用 `countdown`；精确计时逻辑推荐使用 `timeReal`。

4. **无障碍路径规划**：轮椅用户请按 `barrierFree: true` 字段筛选。

5. **查找站点 ID**：可通过车站名称在 CSV 文件中搜索，然后将 StopID 作为 `stopId` 参数使用。