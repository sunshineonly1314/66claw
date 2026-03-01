---
name: anachb
name_zh: A-Nach-B
description: 奥地利公共交通（VOR AnachB）覆盖全奥地利。查询实时到发信息、搜索车站/站点、规划两地间出行路线、查看服务中断情况。当用户询问奥地利火车、巴士、有轨电车、地铁（U-Bahn）或涉及奥地利公共交通的出行方向时使用。
description_zh: 奥地利公共交通（VOR AnachB）覆盖全奥地利。查询实时到发信息、搜索车站/站点、规划两地间出行路线、查看服务中断情况。当用户询问奥地利火车、巴士、有轨电车、地铁（U-Bahn）或涉及奥地利公共交通的出行方向时使用。
---
# VOR AnachB — 奥地利公共交通 API

通过 HAFAS API 查询奥地利公共交通的实时到发信息、路线规划及服务中断情况。

## 快速参考

| 脚本 | 用途 |
|--------|---------|
| `search.sh` | 按名称搜索车站/站点 |
| `departures.sh` | 查询某车站的实时到发信息 |
| `route.sh` | 规划两地之间的出行路线 |
| `disruptions.sh` | 查询当前服务中断情况 |

**API：** HAFAS（Hacon Fahrplan-Auskunfts-System）  
**端点：** `https://vao.demo.hafas.de/gate`

---

## 1. 搜索车站/站点

按名称查找车站 ID：

```bash
./search.sh "Stephansplatz"
./search.sh "Wien Hauptbahnhof"
./search.sh "Linz"
./search.sh "Salzburg Hbf"
```

返回车站名称、ID（extId）及地理坐标。

**响应字段：**
- `name`：车站名称
- `extId`：用于其他查询的车站 ID
- `type`：S（车站）、A（地址）、P（兴趣点）
- `coordinates`：WGS84 坐标（经度/纬度，单位为 1e-6）

---

## 2. 实时到发信息

获取某车站的下一班出发列车/车辆信息：

```bash
./departures.sh <station-id> [count]

# Examples:
./departures.sh 490132000        # Wien Stephansplatz, 10 departures
./departures.sh 490132000 20     # Wien Stephansplatz, 20 departures
./departures.sh 490060200        # Wien Hauptbahnhof
./departures.sh 444130000        # Linz Hbf
./departures.sh 455000100        # Salzburg Hbf
```

**响应字段：**
- `line`：线路名称（如 U1、S1、RJ 等）
- `direction`：终点站
- `departure`：计划出发时间
- `delay`：延误分钟数（如有）
- `platform`：站台/轨道编号

---

## 3. 路线规划

规划两车站之间的出行路线：

```bash
./route.sh <from-id> <to-id> [results]

# Examples:
./route.sh 490132000 490060200        # Stephansplatz → Hauptbahnhof
./route.sh 490132000 444130000 5      # Wien → Linz, 5 results
./route.sh "Graz Hbf" "Wien Hbf"      # Search by name (slower)
```

**响应字段：**
- `departure`：出发时间
- `arrival`：到达时间
- `duration`：行程总时长
- `changes`：换乘次数
- `legs`：包含线路信息的行程分段数组

---

## 4. 服务中断

查询当前服务中断情况：

```bash
./disruptions.sh [category]

# Examples:
./disruptions.sh            # All disruptions
./disruptions.sh TRAIN      # Train disruptions only
./disruptions.sh BUS        # Bus disruptions only
```

---

## 常用车站 ID

| 车站 | ID |
|---------|-----|
| 维也纳圣斯蒂芬广场（Wien Stephansplatz） | 490132000 |
| 维也纳中央火车站（Wien Hauptbahnhof） | 490134900 |
| 维也纳西站（Wien Westbahnhof） | 490024300 |
| 维也纳普拉特尔斯特恩站（Wien Praterstern） | 490056100 |
| 维也纳卡尔广场（Wien Karlsplatz） | 490024600 |
| 维也纳瑞典广场（Wien Schwedenplatz） | 490119500 |
| 林茨中央火车站（Linz Hbf） | 444116400 |
| 萨尔茨堡中央火车站（Salzburg Hbf） | 455000200 |
| 格拉茨中央火车站（Graz Hbf） | 460086000 |
| 因斯布鲁克中央火车站（Innsbruck Hbf） | 481070100 |
| 克拉根福中央火车站（Klagenfurt Hbf） | 492019500 |
| 圣珀尔滕中央火车站（St. Pölten Hbf） | 431543300 |
| 维也纳新城中央火车站（Wiener Neustadt Hbf） | 430521000 |
| 克雷姆斯多瑙河畔（Krems a.d. Donau） | 431046400 |

**提示：** 始终使用 `./search.sh` 查找正确的车站 ID。

---

## 交通类型编码

| 编码 | 类型 |
|------|------|
| ICE/RJ/RJX | 高速列车 |
| IC/EC | 城际列车/欧洲城际列车 |
| REX/R | 区域快车/区域列车 |
| S | 城郊铁路（S-Bahn） |
| U | 维也纳地铁（U-Bahn） |
| STR | 有轨电车（Straßenbahn） |
| BUS | 巴士 |
| AST | 需求响应式交通 |

---

## API 详情（高级用法）

脚本基于 HAFAS JSON API。如需自定义查询：

```bash
curl -s -X POST "https://vao.demo.hafas.de/gate" \
  -H "Content-Type: application/json" \
  -d '{
    "svcReqL": [{
      "req": { ... },
      "meth": "METHOD_NAME",
      "id": "1|1|"
    }],
    "client": {"id": "VAO", "v": "1", "type": "AND", "name": "nextgen"},
    "ver": "1.73",
    "lang": "de",
    "auth": {"aid": "nextgen", "type": "AID"}
  }'
```

**可用方法：**
- `LocMatch` — 位置/车站搜索
- `StationBoard` — 到发信息查询
- `TripSearch` — 路线规划
- `HimSearch` — 服务中断/公告信息
- `JourneyDetails` — 特定行程详情

---

## 使用提示

1. **先查车站 ID**：在查询到发信息或规划路线前，务必始终使用 `search.sh` 获取准确的车站 ID。

2. **车站 vs 站点**：大型车站通常含多个站台，其主车站 ID 已涵盖全部站台。

3. **实时数据**：到发信息在可用时包含实时延误数据。

4. **覆盖全国**：本 API 覆盖全奥地利公共交通，不仅限于维也纳地区。

5. **跨境线路**：部分线路延伸至邻国（如德国、捷克共和国等）。