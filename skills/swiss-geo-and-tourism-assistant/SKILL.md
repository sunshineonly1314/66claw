---
name: swiss-geo
name_zh: 瑞士地理旅游助手
description: 瑞士地理数据、兴趣点（POI）与旅游信息。支持地点/地址搜索、海拔查询、城市 POI 查找（餐厅、咖啡馆、景点，通过 OpenStreetMap）、公共交通时刻表、地图链接。当用户咨询瑞士地点、景点、短途旅行或坐标时启用。
description_zh: 瑞士地理数据、兴趣点（POI）与旅游信息。支持地点/地址搜索、海拔查询、城市 POI 查找（餐厅、咖啡馆、景点，通过 OpenStreetMap）、公共交通时刻表、地图链接。当用户咨询瑞士地点、景点、短途旅行或坐标时启用。
---
# 瑞士地理（Swiss Geo）技能

接入 Swisstopo 瑞士地理数据。

## 功能

### 1. 地点/地址搜索
```bash
curl -s "https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=SUCHTEXT&type=locations&sr=4326"
```  
- 返回纬度/经度（WGS84）、标签（Label）、所属市镇（Gemeinde）  
- `type=locations` 用于地址/地点搜索，`type=layers` 用于图层搜索  

### 2. 海拔查询
先通过搜索获取坐标，再转换为 LV95 坐标系：  
```bash
# Umrechnung WGS84 → LV95 (grobe Näherung für Schweiz):
# easting = 2600000 + (lon - 7.4) * 73000
# northing = 1200000 + (lat - 46.95) * 111000

curl -s "https://api3.geo.admin.ch/rest/services/height?easting=EASTING&northing=NORTHING&sr=2056"
```  
返回海拔高度（米，海平面以上）。

### 3. 地物识别（市镇、州等）
```bash
curl -s "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=LON,LAT&tolerance=0&layers=all:LAYER_ID&sr=4326"
```  

重要图层 ID：  
- `ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill` — 市镇边界（Gemeindegrenzen）  
- `ch.swisstopo.swissboundaries3d-kanton-flaeche.fill` — 州边界（Kantonsgrenzen）  
- `ch.bafu.bundesinventare-flachmoore` — 泥炭沼泽（Flachmoore）  
- `ch.bafu.schutzgebiete-paerke_nationaler_bedeutung` — 自然公园（Naturpärke）  

### 4. 生成地图链接
```
https://map.geo.admin.ch/?lang=de&topic=ech&bgLayer=ch.swisstopo.pixelkarte-farbe&E=LON&N=LAT&zoom=ZOOM
```  
- `zoom`：缩放级别（0–13，13=最高细节）  
- `E`/`N`：WGS84 坐标  
- `layers`：逗号分隔的图层 ID 列表，用于激活显示  

## 示例工作流：“马特洪峰位于何处？海拔多高？”

1. **搜索：**  
```bash
curl -s "https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=Matterhorn&type=locations&sr=4326"
```  
→ lat=45.9766, lon=7.6586  

2. **查询海拔（LV95）：**  
```bash
# easting ≈ 2600000 + (7.6586-7.4)*73000 = 2618878
# northing ≈ 1200000 + (45.9766-46.95)*111000 = 1091893
curl -s "https://api3.geo.admin.ch/rest/services/height?easting=2618878&northing=1091893&sr=2056"
```  
→ 4477.5 米  

3. **生成地图链接：**  
```
https://map.geo.admin.ch/?lang=de&E=7.6586&N=45.9766&zoom=10
```  

### 5. 查询徒步小径
```bash
# Wanderwege in einem Gebiet finden (bbox = west,south,east,north)
curl -s "https://api3.geo.admin.ch/rest/services/api/MapServer/find?layer=ch.swisstopo.swisstlm3d-wanderwege&searchText=ORTSNAME&searchField=name"

# Wanderwege an einem Punkt identifizieren
curl -s "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=LON,LAT&tolerance=50&layers=all:ch.swisstopo.swisstlm3d-wanderwege&sr=4326&imageDisplay=500,500,96&mapExtent=5.9,45.8,10.5,47.8"
```  

**徒步小径分类：**  
- `wanderweg` — 黄色标记（T1）  
- `bergwanderweg` — 白-红-白标记（T2-T3）  
- `alpinwanderweg` — 白-蓝-白标记（T4-T6）  

**含徒步小径的地图链接：**  
```
https://map.geo.admin.ch/?lang=de&E=LON&N=LAT&zoom=10&layers=ch.swisstopo.swisstlm3d-wanderwege&bgLayer=ch.swisstopo.pixelkarte-farbe
```  

### 6. 山屋与住宿
```bash
curl -s "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=LON,LAT&tolerance=5000&layers=all:ch.swisstopo.unterkuenfte-winter&sr=4326&imageDisplay=500,500,96&mapExtent=5.9,45.8,10.5,47.8"
```  

**含山屋的地图链接：**  
```
https://map.geo.admin.ch/?lang=de&E=LON&N=LAT&zoom=11&layers=ch.swisstopo.unterkuenfte-winter&bgLayer=ch.swisstopo.pixelkarte-farbe
```  

### 7. 缆车与索道
```bash
# Seilbahnen mit Bundeskonzession
curl -s "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=LON,LAT&tolerance=2000&layers=all:ch.bav.seilbahnen-bundeskonzession&sr=4326&imageDisplay=500,500,96&mapExtent=5.9,45.8,10.5,47.8"

# Alle Seilbahnen (swissTLM3D)
curl -s "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=LON,LAT&tolerance=2000&layers=all:ch.swisstopo.swisstlm3d-uebrigerverkehr&sr=4326&imageDisplay=500,500,96&mapExtent=5.9,45.8,10.5,47.8"
```  

**含缆车的地图链接：**  
```
https://map.geo.admin.ch/?lang=de&E=LON&N=LAT&zoom=11&layers=ch.bav.seilbahnen-bundeskonzession&bgLayer=ch.swisstopo.pixelkarte-farbe
```  

### 8. 自然灾害
```bash
# Lawinengefahr
curl -s "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=LON,LAT&tolerance=100&layers=all:ch.bafu.silvaprotect-lawinen&sr=4326&imageDisplay=500,500,96&mapExtent=5.9,45.8,10.5,47.8"

# Sturzgefahr (Steinschlag, Felssturz)
curl -s "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=LON,LAT&tolerance=100&layers=all:ch.bafu.silvaprotect-sturz&sr=4326&imageDisplay=500,500,96&mapExtent=5.9,45.8,10.5,47.8"

# Hochwasser-Warnkarte (aktuell)
curl -s "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=LON,LAT&tolerance=500&layers=all:ch.bafu.hydroweb-warnkarte_national&sr=4326&imageDisplay=500,500,96&mapExtent=5.9,45.8,10.5,47.8"
```  

**灾害图层：**  
| 图层 ID | 描述 |  
|---------|------|  
| `ch.bafu.silvaprotect-lawinen` | 雪崩区域（Lawinengebiete） |  
| `ch.bafu.silvaprotect-sturz` | 崩塌区域（Sturzgebiete） |  
| `ch.bafu.hydroweb-warnkarte_national` | 当前洪水（Hochwasser aktuell） |  
| `ch.bafu.gefahren-waldbrand_warnung` | 森林火灾风险（Waldbrandgefahr） |  
| `ch.vbs.sperr-gefahrenzonenkarte` | 军事禁入区（Militärische Sperrzonen） |  

**含自然灾害的地图链接：**  
```
https://map.geo.admin.ch/?lang=de&E=LON&N=LAT&zoom=12&layers=ch.bafu.silvaprotect-lawinen,ch.bafu.silvaprotect-sturz&bgLayer=ch.swisstopo.pixelkarte-farbe
```  

### 9. 天气（瑞士）

**实时天气（通过 wttr.in）：**  
```bash
curl -s "wttr.in/Zürich?format=%l:+%c+%t+%h+%w&lang=de"
# Zürich: ⛅️ +5°C 78% ↙12km/h
```  

**MeteoSwiss 预警（地图）：**  
```
https://map.geo.admin.ch/?lang=de&layers=ch.meteoschweiz.gefahren-warnungen
```  

**SLF 雪崩公报：**  
- 当前：https://www.slf.ch/de/lawinenbulletin-und-schneesituation.html  
- API（实验性）：https://www.slf.ch/avalanche/mobile/bulletin_de.json  

**BAFU 洪水（实时水位）：**  
```
https://map.geo.admin.ch/?lang=de&layers=ch.bafu.hydroweb-messstationen_gefahren
```  

### 10. 公共交通时刻表（transport.opendata.ch）

**查询行程：**  
```bash
curl -s "https://transport.opendata.ch/v1/connections?from=Zürich&to=Bern&limit=3"
```  

**查询发车时刻表：**  
```bash
curl -s "https://transport.opendata.ch/v1/stationboard?station=Zürich+HB&limit=5"
```  

**查询车站：**  
```bash
curl -s "https://transport.opendata.ch/v1/locations?query=Paradeplatz"
```  

**解析示例输出：**  
```bash
curl -s "https://transport.opendata.ch/v1/stationboard?station=Bern&limit=3" | python3 -c "
import sys,json
data = json.load(sys.stdin)
for s in data.get('stationboard', []):
    time = s.get('stop', {}).get('departure', '')[11:16]
    cat = s.get('category', '') + s.get('number', '')
    print(f\"{time} {cat} → {s.get('to', '')}\")"
```  

**参数：**  
| 参数 | 描述 |  
|------|------|  
| `from` / `to` | 起点/终点（名称或 ID） |  
| `station` | 查询发车时刻表的车站 |  
| `limit` | 最大返回结果数 |  
| `date` | 日期（YYYY-MM-DD） |  
| `time` | 时间（HH:MM） |  
| `isArrivalTime` | 1 = 返回到达时间（而非出发时间） |  

### 11. 其他实用数据

**公共交通站点：**  
```bash
curl -s "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=LON,LAT&tolerance=500&layers=all:ch.bav.haltestellen-oev&sr=4326&imageDisplay=500,500,96&mapExtent=5.9,45.8,10.5,47.8"
```  

**滑雪登山与雪鞋徒步路线：**  
```
https://map.geo.admin.ch/?lang=de&E=LON&N=LAT&zoom=11&layers=ch.swisstopo-karto.skitouren,ch.swisstopo-karto.schneeschuhrouten&bgLayer=ch.swisstopo.pixelkarte-farbe
```  

**坡度（适用于登山路线规划）：**  
```
https://map.geo.admin.ch/?lang=de&E=LON&N=LAT&zoom=13&layers=ch.swisstopo-karto.hangneigung&bgLayer=ch.swisstopo.pixelkarte-farbe
```  

### 12. 城市兴趣点（POI）——通过 OpenStreetMap（Overpass API）

**免费，无需 API Key。** 适用于城市中的餐厅、咖啡馆、冰淇淋店、博物馆、景点等。

#### 基础查询（边界框 Bounding Box）
```bash
# POIs in einem Gebiet suchen (south,west,north,east)
# Beispiel: Eisdielen in Zürich-Zentrum
curl -s "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A10%5D%3Bnode%5B%22amenity%22%3D%22ice_cream%22%5D%2847.36%2C8.52%2C47.39%2C8.56%29%3Bout%3B"
```  

#### 基于城市区域的查询（推荐）
```bash
# Alle Eisdielen in der Stadt Zürich
curl -s "https://overpass-api.de/api/interpreter" --data-urlencode 'data=[out:json][timeout:15];
area["name"="Zürich"]["admin_level"="8"]->.city;
(
  node["amenity"="ice_cream"](area.city);
  node["shop"="ice_cream"](area.city);
);
out body;'
```  

#### 重要 POI 标签

| 类别 | OSM 标签 | 示例 |
|------|----------|------|
| 🍦 冰淇淋店 | `amenity=ice_cream` | Gelateria |
| 🍕 餐厅 | `amenity=restaurant` | + `cuisine=*` |
| ☕ 咖啡馆 | `amenity=cafe` | |
| 🍺 酒吧/酒馆 | `amenity=bar` / `pub` | |
| 🏛️ 博物馆 | `tourism=museum` | |
| 🎭 剧院 | `amenity=theatre` | |
| ⛪ 教堂 | `amenity=place_of_worship` | |
| 🏰 景点 | `tourism=attraction` | |
| 👁️ 观景点 | `tourism=viewpoint` | |
| 🎡 游乐园 | `leisure=amusement_arcade` | |
| 🏊 游泳池 | `leisure=swimming_pool` | + `access=yes` |
| 🎮 游乐场 | `leisure=playground` | |
| 🌳 公园 | `leisure=park` | |

#### 示例：苏黎世老城的博物馆与景点
```bash
curl -s "https://overpass-api.de/api/interpreter" --data-urlencode 'data=[out:json][timeout:15];
(
  node["tourism"="museum"](47.366,8.538,47.378,8.548);
  node["tourism"="attraction"](47.366,8.538,47.378,8.548);
  node["historic"](47.366,8.538,47.378,8.548);
);
out body;'
```  

#### 示例：适合家庭的场所（游乐场、公园）
```bash
curl -s "https://overpass-api.de/api/interpreter" --data-urlencode 'data=[out:json][timeout:15];
area["name"="Zürich"]["admin_level"="8"]->.city;
(
  node["leisure"="playground"](area.city);
  way["leisure"="playground"](area.city);
);
out center body;'
```  

#### 解析响应（Python）
```bash
curl -s "https://overpass-api.de/api/interpreter?data=..." | python3 -c "
import sys, json
data = json.load(sys.stdin)
for el in data.get('elements', []):
    tags = el.get('tags', {})
    name = tags.get('name', 'Unbenannt')
    lat, lon = el.get('lat', el.get('center', {}).get('lat', '')), el.get('lon', el.get('center', {}).get('lon', ''))
    addr = tags.get('addr:street', '')
    website = tags.get('website', '')
    opening = tags.get('opening_hours', '')
    print(f'{name}')
    if addr: print(f'  📍 {addr} {tags.get(\"addr:housenumber\", \"\")}')
    if opening: print(f'  🕐 {opening}')
    if website: print(f'  🔗 {website}')
    print()
"
```  

#### 瑞士主要城市的坐标（Bbox）

| 城市 | 南 | 西 | 北 | 东 |
|------|----|----|----|----|
| 苏黎世市中心 | 47.36 | 8.52 | 47.39 | 8.56 |
| 苏黎世老城 | 47.366 | 8.538 | 47.378 | 8.548 |
| 伯尔尼市中心 | 46.94 | 7.43 | 46.96 | 7.46 |
| 巴塞尔市中心 | 47.55 | 7.58 | 47.57 | 7.61 |
| 卢塞恩市中心 | 47.04 | 8.29 | 47.06 | 8.32 |
| 日内瓦市中心 | 46.19 | 6.13 | 46.21 | 6.16 |

### 13. 瑞士旅游局 API（MySwitzerland）

**⚠️ 需要 API Key**（请求头：`x-api-key`）

**注意：** 此 API 主要适用于户外旅游（徒步、登山、地区信息）。对于城市 POI（餐厅、咖啡馆、博物馆），第 12 节的 Overpass API 更为合适。

**搜索景点：**  
```bash
curl -s "https://opendata.myswitzerland.io/v1/attractions/?lang=de&limit=5" \
  -H "x-api-key: $MYSWITZERLAND_API_KEY"
```  

**搜索路线：**  
```bash
curl -s "https://opendata.myswitzerland.io/v1/tours/?lang=de&limit=5" \
  -H "x-api-key: $MYSWITZERLAND_API_KEY"
```  

**获取某条路线的地理数据（GeoJSON）：**  
```bash
curl -s "https://opendata.myswitzerland.io/v1/tours/TOUR_ID/geodata" \
  -H "x-api-key: $MYSWITZERLAND_API_KEY"
```  

**目的地信息：**  
```bash
curl -s "https://opendata.myswitzerland.io/v1/destinations/?lang=de" \
  -H "x-api-key: $MYSWITZERLAND_API_KEY"
```  

**响应字段：**  
- `name` — 景点/路线名称  
- `abstract` — 简短描述  
- `geo.latitude`、`geo.longitude` — 坐标  
- `classification` — 分类（季节、类型等）  

## 示例工作流

### “在苏黎世，哪里可以带孩子吃冰淇淋？附近还有什么？”
1. 通过 Overpass API 搜索冰淇淋店（第 12 节）  
2. 查找附近的景点/游乐场  
3. 查询前往该处的公共交通（第 10 节）  
4. 生成地图链接（第 4 节）  

### “在恩嘎丁地区，能否安排一条含缆车与山屋的徒步路线？”
1. 搜索缆车（第 7 节）  
2. 查找徒步小径（第 5 节）  
3. 识别山屋（第 6 节）  
4. 查询 MySwitzerland 路线（第 13 节）  

## 提示
- **城市 POI：** → 使用 Overpass API（免费、详尽）  
- **户外旅游：** → 使用 MySwitzerland API（需 API Key）  
- **地图与地理数据：** → 使用 Swisstopo（免费）  
- **公共交通时刻表：** → 使用 transport.opendata.ch（免费）  
- 搜索结果中包含 `origin`（如 address、sn25、gg25 等）用于分类  
- 如需精确 LV95 坐标，请参阅 [references/api.md](references/api.md)  
- 可通过逗号组合 Swisstopo 图层：`layers=layer1,layer2,layer3`  