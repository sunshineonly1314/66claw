---
name: aviation-weather
name_zh: 航空天气
description: 从 aviationweather.gov 获取航空天气数据（METAR、TAF、PIREP）。适用于飞行计划制定、天气简报、机场状况查询，或任何与飞行员相关的天气查询。当检测到关键词 “METAR”、“TAF”、“flight weather”、“airport weather”、“aviation weather”、“pilot report”、“PIREP”，或特定 ICAO 机场代码时触发。
description_zh: 从 aviationweather.gov 获取航空天气数据（METAR、TAF、PIREP）。适用于飞行计划制定、天气简报、机场状况查询，或任何与飞行员相关的天气查询。当检测到关键词 “METAR”、“TAF”、“flight weather”、“airport weather”、“aviation weather”、“pilot report”、“PIREP”，或特定 ICAO 机场代码时触发。
---
# 航空天气

从美国联邦航空管理局（FAA）的 aviationweather.gov API 获取实时航空天气数据。

## 快速参考

```bash
# METAR for specific airports
python3 scripts/wx.py KSMO KLAX KVNY

# METAR + TAF
python3 scripts/wx.py KSMO KLAX --metar --taf

# Just TAF
python3 scripts/wx.py KSMO --taf

# PIREPs near a location (lat/lon)
python3 scripts/wx.py --pirep --lat 34.0 --lon -118.4 --radius 100

# Raw output with JSON
python3 scripts/wx.py KSMO --json

# Verbose (show raw METAR text)
python3 scripts/wx.py KSMO -v
```

## 默认机场

若未指定气象站，则默认使用圣莫尼卡地区机场：`KSMO`、`KLAX`、`KVNY`

## 飞行天气分类

- 🟢 VFR —— 云高 >3000 英尺（AGL）且能见度 >5 英里  
- 🔵 MVFR —— 云高 1000–3000 英尺 或 能见度 3–5 英里  
- 🔴 IFR —— 云高 500–1000 英尺 或 能见度 1–3 英里  
- 🟣 LIFR —— 云高 <500 英尺 或 能见度 <1 英里  

## 南加州常见机场

| 代码 | 名称 |
|------|------|
| KSMO | 圣莫尼卡机场 |
| KLAX | 洛杉矶国际机场 |
| KVNY | 范奈斯机场 |
| KBUR | 伯班克机场 |
| KTOA | 托伦斯机场 |
| KSNA | 约翰韦恩机场 |
| KFUL | 富勒顿机场 |
| KCMA | 卡马里洛机场 |
| KOXR | 奥克斯纳德机场 |
| KPSP | 棕榈泉机场 |

## 可用选项

- `--metar`、`-m`：获取 METAR（默认）  
- `--taf`、`-t`：获取 TAF 天气预报  
- `--pirep`、`-p`：获取飞行员报告（PIREP）  
- `--hours N`：METAR 历史数据时长（默认：2 小时）  
- `--lat`、`--lon`：PIREP 搜索地理位置  
- `--radius N`：PIREP 搜索半径（单位：海里；默认：100）  
- `--verbose`、`-v`：显示原始观测文本  
- `--json`：输出原始 JSON 数据  