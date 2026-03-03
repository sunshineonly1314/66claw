---
name: weather
description: Get current weather and forecasts (no API key required).
nameZh: "天气查询"
descriptionZh: "查询全球各地实时天气和未来预报"
homepage: https://open-meteo.com/en/docs
metadata: {"openclawcn":{"emoji":"🌤️","requires":{"bins":["curl"]}}}
---

# Weather

Free weather services, no API keys needed.

## Open-Meteo (primary, JSON)

Free, no key, works in all regions including China mainland.

### Step 1: Get coordinates (geocoding)

```bash
# By city name (supports Chinese, English, pinyin)
curl -s "https://geocoding-api.open-meteo.com/v1/search?name=Beijing&count=1&language=zh"
# → {"results":[{"name":"北京市","latitude":39.9075,"longitude":116.39723,...}]}

# Chinese city name (URL-encode required)
curl -s "https://geocoding-api.open-meteo.com/v1/search?name=%E4%B8%8A%E6%B5%B7&count=1&language=zh"
```

Tips:
- Prefer pinyin or English name for accuracy (e.g. `Shanghai` not `上海`)
- Add province for disambiguation: `Rizhao` might match multiple cities
- Use `count=3` to get multiple matches if the first is wrong

### Step 2: Query weather

Current weather:
```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=39.9&longitude=116.4&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,apparent_temperature&timezone=Asia/Shanghai"
```

3-day forecast:
```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=39.9&longitude=116.4&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,weather_code,uv_index_max,precipitation_probability_max&timezone=Asia/Shanghai&forecast_days=3"
```

### Weather code reference

| Code | Meaning |
|------|---------|
| 0 | Clear sky / 晴 |
| 1-3 | Partly cloudy / 多云 |
| 45,48 | Fog / 雾 |
| 51-55 | Drizzle / 毛毛雨 |
| 61-65 | Rain / 雨 |
| 71-75 | Snow / 雪 |
| 80-82 | Rain showers / 阵雨 |
| 95 | Thunderstorm / 雷暴 |

### Response format

Present weather in a friendly format, example:
```
📍 北京 (2026-03-02)
🌡️ 3.2°C (体感 -1.8°C)
🌤️ 多云
💧 湿度 83%
💨 北风 20.5km/h
☀️ UV 指数 0.8

📅 未来3天:
  明天: 2~7°C 多云
  后天: 1~7°C 多云
```

Docs: https://open-meteo.com/en/docs

## wttr.in (fallback, text-based)

Simple text output, but may be slow or unavailable in some regions:
```bash
curl -s "wttr.in/London?format=3"
# Output: London: ⛅️ +8°C
```

Full forecast:
```bash
curl -s "wttr.in/London?T"
```

Tips:
- URL-encode spaces: `wttr.in/New+York`
- Units: `?m` (metric) `?u` (USCS)
- If wttr.in times out, use Open-Meteo above
