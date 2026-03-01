---
name: weather-pollen
name_zh: 花粉天气
description: 使用免费 API 获取任意地点的天气与花粉报告。支持获取当前天气状况、天气预报及花粉浓度数据。
description_zh: 使用免费 API 获取任意地点的天气与花粉报告。支持获取当前天气状况、天气预报及花粉浓度数据。
metadata: {"clawdbot":{"emoji":"🌤️","requires":{"bins":["curl"]}}}
---
# 天气与花粉技能

使用免费 API 获取任意地点的天气与花粉报告。

## 使用方式

当被问及 Anna, TX（或已配置地点）的天气或花粉情况时，请调用本技能提供的 `weather_report` 工具。

## 工具

### weather_report
获取指定地点的天气与花粉数据。

**参数：**
- `includePollen`（布尔值，默认 true）— 是否包含花粉数据
- `location`（字符串，可选）— 显示用的地点名称（经纬度通过环境变量配置）

**示例：**
```json
{"includePollen": true, "location": "Anna, TX"}
```

## 配置方式

通过环境变量设定地理位置（默认为 Anna, TX）：
- `WEATHER_LAT` — 纬度（默认：33.3506）
- `WEATHER_LON` — 经度（默认：-96.3175）
- `WEATHER_LOCATION` — 地点显示名称（默认："Anna, TX"）

## 所用 API
- **天气数据：** Open-Meteo（免费，无需 API 密钥）
- **花粉数据：** Pollen.com（免费，无需 API 密钥）