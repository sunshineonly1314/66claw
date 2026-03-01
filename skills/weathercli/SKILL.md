---
name: weathercli
name_zh: Weather CLI
description: 获取全球任意地点的当前天气状况和天气预报。返回包含温度、湿度、风速、降水等信息的结构化数据。无需 API 密钥。
description_zh: 获取全球任意地点的当前天气状况和天气预报。返回包含温度、湿度、风速、降水等信息的结构化数据。无需 API 密钥。
---
# Weather CLI

使用 `weathercli` 命令获取全球任意地点的天气信息。

## 命令

### 当前天气
获取实时天气状况，包括温度、湿度、风速和降水情况。

```bash
weathercli current "<location>"
weathercli current "<location>" --json
```

**返回内容：** 当前温度、“体感温度”、湿度百分比、风速/风向、气压、云量、紫外线指数、降水量、天气状况描述，以及本地时区的时间戳。

### 天气预报
获取每日或每小时天气预报。

```bash
# Daily forecast (default: 7 days, max: 16)
weathercli forecast "<location>" --days <N>

# Hourly forecast (max: 384 hours)
weathercli forecast "<location>" --hourly --hours <N>

# JSON output for parsing
weathercli forecast "<location>" --json
```

**返回内容：** 每日/每小时：温度（最高/最低或当前值）、天气状况、降水概率与降水量、风速/风向、紫外线指数、日出/日落时间（仅限每日预报）。

### 地点搜索
查找某地点的地理坐标与时区信息。

```bash
weathercli search "<location>"
weathercli search "<location>" --json
```

**返回内容：** 地点名称、坐标（纬度/经度）、国家、地区/州、时区。

## 地点格式

地点输入灵活，系统将自动进行地理编码：
- 城市名称：`"London"`、`"Tokyo"`、`"New York"`  
- 城市 + 国家：`"Paris, France"`、`"Berlin, Germany"`  
- 城市 + 州/地区：`"Portland, Oregon"`、`"Barcelona, Catalonia"`  
- 名称存在歧义时：请添加国家或地区以提高精度

## 选项

- `--json` —— 输出结构化 JSON（推荐用于程序解析）  
- `--no-color` —— 禁用彩色输出（适用于纯文本解析）  
- `--days N` —— 预报天数（1–16，默认为 7）  
- `--hourly` —— 显示每小时预报（而非每日预报）  
- `--hours N` —— 每小时预报的小时数（1–384）  
- `--verbose` —— 显示详细的请求信息  

## 输出格式

### 人类可读格式（默认）
温度采用彩色编码，辅以表情符号与单位；所有时间均按地点本地时区显示。

### JSON 结构

**当前天气：**  
```json
{
  "location": {
    "name": "Tokyo",
    "latitude": 35.6895,
    "longitude": 139.6917,
    "country": "Japan",
    "timezone": "Asia/Tokyo"
  },
  "time": "2026-01-12T18:45:00+09:00",
  "temperature": 4.7,
  "apparent": 1.8,
  "humidity": 66,
  "wind_speed": 3.6,
  "wind_direction": 135,
  "condition": "Clear sky",
  "weather_code": 0,
  "precipitation": 0,
  "cloud_cover": 0,
  "pressure": 1015.2,
  "uv_index": 0
}
```

**天气预报：**  
```json
{
  "location": { ... },
  "daily": [
    {
      "date": "2026-01-12",
      "temp_max": 12.1,
      "temp_min": 4.3,
      "condition": "Slight rain",
      "precip_prob": 75,
      "precipitation": 1.5,
      "sunrise": "2026-01-12T08:04:00+09:00",
      "sunset": "2026-01-12T16:45:00+09:00",
      "wind_speed_max": 15.3,
      "wind_direction": 202,
      "uv_index_max": 2.4
    }
  ]
}
```

## 使用指南

### 适用场景

- 用户询问天气、温度、预报或天气状况  
- 规划活动并需要天气数据  
- 查询是否会降雨、降雪或晴天  
- 为旅行规划获取气候信息  
- 需要日出/日落时间  
- 对比多个地点的天气状况  

### 地点处理

1. 若用户提供了明确地点，则直接使用  
2. 若地点存在歧义（例如“Portland”），请请求澄清或补充上下文  
3. 若未找到该地点，建议检查拼写，或添加国家/地区名  
4. 对于经纬度输入，请先使用 `search` 命令验证有效性  

### 输出解析

- **务必使用 `--json` 进行程序化解析**  
- 提取 `temperature`、`condition`、`wind_speed` 以快速生成摘要  
- 查看 `precip_prob` 判断降雨可能性  
- 使用 `sunrise` / `sunset` 辅助日照时段规划  
- `weather_code` 遵循世界气象组织（WMO）标准（0–99）  

### 最佳实践

- 旅行规划建议请求 3–5 天预报（无需全部 16 天）  
- 日常详细安排建议使用每小时预报  
- 关注 `apparent` 温度以评估“体感舒适度”  
- 紫外线指数 >3 时，建议采取防晒措施  
- 风速 >20 km/h 时，应注明“有风”  

## 示例

**快速查询天气：**  
```bash
weathercli current "London" --json | jq '.temperature, .condition'
```

**为期一周的旅行预报：**  
```bash
weathercli forecast "Barcelona" --days 5 --json
```

**今日详细每小时预报：**  
```bash
weathercli forecast "Seattle" --hourly --hours 24
```

**同时查询多个城市：**  
```bash
for city in "Tokyo" "London" "New York"; do
  weathercli current "$city" --json | jq -r '"\(.location.name): \(.temperature)°C, \(.condition)"'
done
```

**精确定位地点：**  
```bash
weathercli search "Springfield" --json
```

## 注意事项

- **无需 API 密钥** —— 使用免费的 Open-Meteo API  
- **全球覆盖** —— 支持全球任意地点  
- **温度单位为摄氏度（°C）** —— 如需华氏度，请转换（°F = °C × 9/5 + 32）  
- **风速单位为千米每小时（km/h）** —— 如需英里每小时（mph），请乘以 0.621  
- **本地时区** —— 所有时间均自动转换为对应地点本地时区  
- **调用频率限制** —— 适用于个人及 agent 场景；请勿高频密集调用  
- **数据准确性** —— 整合多个气象数据源  
- **更新频率** —— 当前天气每 15 分钟更新一次  
- **离线支持** —— 需要互联网连接  

## 错误处理

**地点未找到：**  
```
Error: location not found: Atlantis
```  
→ 请检查拼写，或尝试添加国家/地区名  

**网络错误：**  
```
Error: weather API error: network timeout
```  
→ 稍候重试  

**输入无效：**  
```
Error: invalid days value
```  
→ 请确认 `--days` 取值在 1–16 范围内  

## 安装

若 `weathercli` 不可用：  
```bash
# Via Go
go install github.com/pjtf93/weathercli/cmd/weathercli@latest

# Or download binary from releases
# https://github.com/pjtf93/weathercli/releases
```