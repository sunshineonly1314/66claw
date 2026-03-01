---
name: oebb-scotty
name_zh: OEBB Scotty
description: 奥地利铁路行程规划工具（ÖBB Scotty）。当需要规划奥地利境内的火车行程、查询车站的出发/到达信息，或查找服务中断情况时使用。覆盖 ÖBB 列车、S-Bahn、区域列车，以及通往邻国的联程交通。
description_zh: 奥地利铁路行程规划工具（ÖBB Scotty）。当需要规划奥地利境内的火车行程、查询车站的出发/到达信息，或查找服务中断情况时使用。覆盖 ÖBB 列车、S-Bahn、区域列车，以及通往邻国的联程交通。
---
# ÖBB Scotty API

通过 HAFAS mgate API 查询奥地利公共交通信息，用于行程规划、车站到发查询及服务告警。

## 快速参考

| 方法 | 用途 |
|--------|---------|
| `LocMatch` | 按名称搜索车站/停靠点 |
| `TripSearch` | 规划两地之间的行程 |
| `StationBoard` | 查询某车站的出发/到达信息 |
| `HimSearch` | 获取服务告警与运行中断信息 |

**基础 URL：** `https://fahrplan.oebb.at/bin/mgate.exe`

---

## 认证

所有请求均需在 JSON 请求体中包含以下请求头：

```json
{
  "id": "1",
  "ver": "1.67",
  "lang": "deu",
  "auth": {"type": "AID", "aid": "OWDL4fE4ixNiPBBm"},
  "client": {"id": "OEBB", "type": "WEB", "name": "webapp", "l": "vs_webapp"},
  "formatted": false,
  "svcReqL": [...]
}
```

---

## 1. 位置搜索（`LocMatch`）

按名称搜索车站、停靠点、地址或兴趣点（POI）。

### 请求

```bash
curl -s -X POST "https://fahrplan.oebb.at/bin/mgate.exe" \
  -H "Content-Type: application/json" \
  -d '{
    "id":"1","ver":"1.67","lang":"deu",
    "auth":{"type":"AID","aid":"OWDL4fE4ixNiPBBm"},
    "client":{"id":"OEBB","type":"WEB","name":"webapp","l":"vs_webapp"},
    "formatted":false,
    "svcReqL":[{
      "req":{"input":{"field":"S","loc":{"name":"Wien Hbf","type":"ALL"},"maxLoc":10}},
      "meth":"LocMatch"
    }]
  }'
```

### 响应结构

```json
{
  "svcResL": [{
    "res": {
      "match": {
        "locL": [{
          "lid": "A=1@O=Wien Hbf (U)@X=16377950@Y=48184986@U=181@L=1290401@",
          "type": "S",
          "name": "Wien Hbf (U)",
          "extId": "1290401",
          "crd": { "x": 16377950, "y": 48184986 },
          "pCls": 6015
        }]
      }
    }
  }]
}
```

### 位置类型

| 类型 | 描述 |
|------|-------------|
| `S` | 车站/停靠点 |
| `A` | 地址 |
| `P` | 兴趣点（Point of Interest, POI） |

### 关键字段

| 字段 | 描述 |
|-------|-------------|
| `lid` | 位置 ID 字符串（供 TripSearch 使用） |
| `extId` | 外部车站 ID |
| `name` | 车站名称 |
| `crd.x/y` | 坐标（x=经度，y=纬度，缩放倍数为 10⁶） |
| `pCls` | 产品类别位掩码 |

---

## 2. 行程搜索（`TripSearch`）

规划两地之间的行程。

### 请求

```bash
curl -s -X POST "https://fahrplan.oebb.at/bin/mgate.exe" \
  -H "Content-Type: application/json" \
  -d '{
    "id":"1","ver":"1.67","lang":"deu",
    "auth":{"type":"AID","aid":"OWDL4fE4ixNiPBBm"},
    "client":{"id":"OEBB","type":"WEB","name":"webapp","l":"vs_webapp"},
    "formatted":false,
    "svcReqL":[{
      "req":{
        "depLocL":[{"lid":"A=1@O=Wien Hbf@L=8103000@","type":"S"}],
        "arrLocL":[{"lid":"A=1@O=Salzburg Hbf@L=8100002@","type":"S"}],
        "jnyFltrL":[{"type":"PROD","mode":"INC","value":"1023"}],
        "getPolyline":false,
        "getPasslist":true,
        "outDate":"20260109",
        "outTime":"080000",
        "outFrwd":true,
        "numF":5
      },
      "meth":"TripSearch"
    }]
  }'
```

### 参数

| 参数 | 描述 |
|-------|-------------|
| `depLocL` | 出发地（多个可选）——使用 LocMatch 返回的 `lid` |
| `arrLocL` | 目的地（多个可选） |
| `outDate` | 出发日期（YYYYMMDD 格式） |
| `outTime` | 出发时间（HHMMSS 格式） |
| `outFrwd` | `true` = 正向搜索（未来），`false` = 反向搜索（过去） |
| `numF` | 返回的行程数量 |
| `jnyFltrL` | 产品筛选器（见下文） |
| `getPasslist` | 是否包含中途停靠站 |

### 产品筛选器取值

| 位 | 值 | 产品类型 |
|-----|-------|---------|
| 0 | 1 | ICE/RJX（高速列车） |
| 1 | 2 | IC/EC（城际列车） |
| 2 | 4 | NJ（夜行列车） |
| 3 | 8 | D/EN（特快列车） |
| 4 | 16 | REX/R（区域快车） |
| 5 | 32 | S-Bahn（城市快铁） |
| 6 | 64 | 公交车 |
| 7 | 128 | 渡轮 |
| 8 | 256 | U-Bahn（地铁） |
| 9 | 512 | 有轨电车 |

使用 `1023` 表示全部产品类型，或对特定位对应的值求和。

### 响应结构

```json
{
  "svcResL": [{
    "res": {
      "outConL": [{
        "date": "20260109",
        "dur": "025200",
        "chg": 0,
        "dep": {
          "dTimeS": "075700",
          "dPltfS": {"txt": "8A-B"}
        },
        "arr": {
          "aTimeS": "104900",
          "aPltfS": {"txt": "7"}
        },
        "secL": [{
          "type": "JNY",
          "jny": {
            "prodX": 0,
            "dirTxt": "Salzburg Hbf",
            "stopL": [...]
          }
        }]
      }],
      "common": {
        "locL": [...],
        "prodL": [...]
      }
    }
  }]
}
```

### 关键行程字段

| 字段 | 描述 |
|-------|-------------|
| `dur` | 行程总时长（HHMMSS 格式） |
| `chg` | 换乘次数 |
| `dTimeS` | 计划出发时间 |
| `dTimeR` | 实时出发时间（如可用） |
| `aTimeS` | 计划到达时间 |
| `aTimeR` | 实时到达时间（如可用） |
| `dPltfS.txt` | 出发站台 |
| `aPltfS.txt` | 到达站台 |
| `secL` | 行程分段（行程段） |
| `secL[].jny.prodX` | 在 `common.prodL[]` 数组中的索引（用于获取列车名称） |

### 理解 prodX（产品索引）

**重要提示：** 行程分段中的 `prodX` 字段是 `common.prodL[]` 数组的索引，而非列车名称本身。要获取实际列车名称（例如 "S7"、"RJX 662"），必须查表获取 `common.prodL[prodX].name`。

### 使用 jq 提取行程摘要

原始 TripSearch 响应内容非常冗长。使用以下 jq 过滤器可提取简洁摘要，并解析出列车名称：

```bash
curl -s -X POST "https://fahrplan.oebb.at/bin/mgate.exe" \
  -H "Content-Type: application/json" \
  -d '{ ... }' | jq '
    .svcResL[0].res as $r |
    $r.common.prodL as $prods |
    [$r.outConL[] | {
      dep: .dep.dTimeS,
      arr: .arr.aTimeS,
      depPlatform: .dep.dPltfS.txt,
      arrPlatform: .arr.aPltfS.txt,
      dur: .dur,
      chg: .chg,
      legs: [.secL[] | select(.type == "JNY") | {
        train: $prods[.jny.prodX].name,
        dir: .jny.dirTxt,
        dep: .dep.dTimeS,
        arr: .arr.aTimeS,
        depPlatform: .dep.dPltfS.txt,
        arrPlatform: .arr.aPltfS.txt
      }]
    }]'
```

示例输出：
```json
[
  {
    "dep": "213900",
    "arr": "221100",
    "depPlatform": "1",
    "arrPlatform": "3A-B",
    "dur": "003200",
    "chg": 0,
    "legs": [{"train": "S 7", "dir": "Flughafen Wien Bahnhof", "dep": "213900", "arr": "221100", ...}]
  }
]
```

---

## 3. 车站时刻表（`StationBoard`）

获取某车站的出发或到达信息。

### 请求

```bash
curl -s -X POST "https://fahrplan.oebb.at/bin/mgate.exe" \
  -H "Content-Type: application/json" \
  -d '{
    "id":"1","ver":"1.67","lang":"deu",
    "auth":{"type":"AID","aid":"OWDL4fE4ixNiPBBm"},
    "client":{"id":"OEBB","type":"WEB","name":"webapp","l":"vs_webapp"},
    "formatted":false,
    "svcReqL":[{
      "req":{
        "stbLoc":{"lid":"A=1@O=Wien Hbf@L=8103000@","type":"S"},
        "date":"20260109",
        "time":"080000",
        "type":"DEP",
        "maxJny":20
      },
      "meth":"StationBoard"
    }]
  }'
```

### 参数

| 参数 | 描述 |
|-------|-------------|
| `stbLoc` | 车站位置 |
| `date` | 日期（YYYYMMDD 格式） |
| `time` | 时间（HHMMSS 格式） |
| `type` | `DEP`（出发）或 `ARR`（到达） |
| `maxJny` | 最大返回行程数 |

### 响应结构

```json
{
  "svcResL": [{
    "res": {
      "jnyL": [{
        "prodX": 0,
        "dirTxt": "Salzburg Hbf",
        "stbStop": {
          "dTimeS": "080000",
          "dPltfS": {"txt": "8A-B"}
        }
      }],
      "common": {
        "prodL": [{
          "name": "RJX 662",
          "cls": 1,
          "prodCtx": {"catOutL": "Railjet Xpress"}
        }]
      }
    }
  }]
}
```

---

## 4. 服务告警（`HimSearch`）

获取当前运行中断和服务通知信息。

### 请求

```bash
curl -s -X POST "https://fahrplan.oebb.at/bin/mgate.exe" \
  -H "Content-Type: application/json" \
  -d '{
    "id":"1","ver":"1.67","lang":"deu",
    "auth":{"type":"AID","aid":"OWDL4fE4ixNiPBBm"},
    "client":{"id":"OEBB","type":"WEB","name":"webapp","l":"vs_webapp"},
    "formatted":false,
    "svcReqL":[{
      "req":{
        "himFltrL":[{"type":"PROD","mode":"INC","value":"255"}],
        "maxNum":20
      },
      "meth":"HimSearch"
    }]
  }'
```

### 响应结构

```json
{
  "svcResL": [{
    "res": {
      "msgL": [{
        "hid": "HIM_FREETEXT_843858",
        "head": "Verringertes Sitzplatzangebot",
        "text": "Wegen einer technischen Störung...",
        "prio": 0,
        "sDate": "20260108",
        "eDate": "20260108"
      }]
    }
  }]
}
```

---

## 常用车站 ID

| 车站 | extId |
|---------|-------|
| 维也纳中央车站（Wien Hbf） | 8103000 |
| 维也纳梅德灵车站（Wien Meidling） | 8100514 |
| 维也纳西站（Wien Westbahnhof） | 8101003 |
| 萨尔茨堡中央车站（Salzburg Hbf） | 8100002 |
| 林茨中央车站（Linz Hbf） | 8100013 |
| 格拉茨中央车站（Graz Hbf） | 8100173 |
| 因斯布鲁克中央车站（Innsbruck Hbf） | 8100108 |
| 克拉根福中央车站（Klagenfurt Hbf） | 8100085 |
| 圣波尔滕中央车站（St. Pölten Hbf） | 8100008 |
| 维也纳新施塔特中央车站（Wr. Neustadt Hbf） | 8100516 |

---

## 时间格式

- 日期：`YYYYMMDD`（例如：`20260109`）
- 时间：`HHMMSS`（例如：`080000` = 08:00:00）
- 时长：`HHMMSS`（例如：`025200` = 2 小时 52 分钟）

---

## 错误处理

检查响应中的 `err` 字段：

```json
{
  "err": "OK",           // Success
  "err": "PARSE",        // Invalid request format
  "err": "NO_MATCH",     // No results found
  "errTxt": "..."        // Error details
}
```

---

## 产品类别（cls 值）

| cls | 产品类型 |
|-----|---------|
| 1 | ICE/RJX |
| 2 | IC/EC |
| 4 | 夜行列车 |
| 8 | NJ/EN |
| 16 | REX/区域列车 |
| 32 | S-Bahn |
| 64 | 公交车 |
| 128 | 渡轮 |
| 256 | U-Bahn |
| 512 | 有轨电车 |
| 1024 | 按需服务 |
| 2048 | 其他 |