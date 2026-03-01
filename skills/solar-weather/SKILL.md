---
name: solar-weather
name_zh: 太阳天气
description: 监测太阳天气状况，包括地磁暴、太阳耀斑、极光预报及太阳风数据。使用美国国家海洋和大气管理局（NOAA）空间天气预报中心的实时数据。
description_zh: 监测太阳天气状况，包括地磁暴、太阳耀斑、极光预报及太阳风数据。使用美国国家海洋和大气管理局（NOAA）空间天气预报中心的实时数据。
version: 1.0.0
author: captmarbles
---
# 太阳天气监测器 🌞

实时追踪空间天气状况！监测来自 NOAA 空间天气预报中心（SWPC）的太阳耀斑、地磁暴、极光预报及太阳风数据。

## 功能

🌞 **当前状况** — 实时空间天气状态  
📅 **3 日预报** — 预测即将发生的太阳活动  
🌌 **极光预报** — 你将看到北极光吗？  
🌊 **太阳风** — 追踪太阳风磁场  
🚨 **预警** — 当前有效的空间天气警告  
📊 **概览** — 快速、全面的综合摘要  

适用于：
- 📻 业余无线电操作员  
- 🌌 极光追逐者与摄影师  
- 🛰️ 卫星操作员  
- ⚡ 电网运营人员  
- 🌍 空间天气爱好者  

## 使用方法

### 当前空间天气

```bash
python3 solar-weather.py current
```

**输出：**  
```
🌞 Space Weather Conditions
   2026-01-27 18:38:00 UTC

   📻 R0: none ✅
      Radio Blackouts (Solar Flares)

   ☢️  S0: none ✅
      Solar Radiation Storm

   🌍 G0: none ✅
      Geomagnetic Storm
```

### 3 日预报

```bash
python3 solar-weather.py forecast
```

显示今日、明日及后日的太阳事件发生概率（百分比形式）。

### 极光预报

```bash
python3 solar-weather.py aurora
```

**输出：**  
```
🌌 Aurora Forecast

Current Conditions:
   Geomagnetic: none
   Solar Wind Bz: -2 nT

Tomorrow (2026-01-28):
   Geomagnetic: minor

🔮 Aurora Outlook:
   ⚠️  MODERATE - Aurora possible at high latitudes
```

### 太阳风数据

```bash
python3 solar-weather.py solarwind
```

**输出：**  
```
🌊 Solar Wind Magnetic Field
   Time: 2026-01-27 18:36:00.000
   Bt: 8 nT (Total Magnitude)
   Bz: -2 nT (North/South Component)

   ✅ Slightly negative Bz
```

**注意：** Bz 分量为负值（尤其 < -5 nT）有利于极光活动！

### 当前预警

```bash
python3 solar-weather.py alerts
```

显示 NOAA 发布的当前有效空间天气警戒（Watch）、警告（Warning）与警报（Alert）。

### 快速概览

```bash
python3 solar-weather.py summary
```

对当前状况、太阳风及次日预报的综合性概述。

## 理解空间天气等级体系

NOAA 使用三种等级衡量空间天气严重程度：

### R 等级 — 无线电中断（太阳耀斑）
- **R0**：无影响  
- **R1–R2**：轻微/中等 — 高频（HF）无线电通信质量下降  
- **R3–R5**：强烈/严重/极端 — HF 无线电通信中断  

### S 等级 — 太阳辐射风暴
- **S0**：无影响  
- **S1–S2**：轻微/中等 — 卫星可能出现异常  
- **S3–S5**：强烈/严重/极端 — 卫星受损风险、宇航员受辐射风险  

### G 等级 — 地磁暴（极光！）
- **G0**：无地磁暴  
- **G1–G2**：轻微/中等 — 高纬度地区可见极光  
- **G3–G5**：强烈/严重/极端 — **中纬度地区亦可见极光！**  

## Clawdbot 示例提示词

- *“当前空间天气状况如何？”*  
- *“今晚有极光预报吗？”*  
- *“显示太阳风数据”*  
- *“目前有地磁暴预警吗？”*  
- *“给我一份空间天气概览”*  
- *“我在 [location] 能看到极光吗？”*  

## JSON 输出

在任意命令后添加 `--json`，即可获取结构化数据：

```bash
python3 solar-weather.py current --json
python3 solar-weather.py aurora --json
```

## 数据来源

所有数据均来自 **NOAA 空间天气预报中心（SWPC）**：  
- 美国联邦政府官方空间天气监测机构  
- 实时更新  
- 免费开放的公共 API  
- https://www.swpc.noaa.gov/  

## 极光观测者小贴士 🌌

**极光最佳观测条件：**  
1. **地磁暴**（G1 或更高）✅  
2. **Bz 为负值**（< -5 nT）✅  
3. **晴朗、无光污染的夜空** 🌙  
4. **高纬度地区**（或强地磁暴期间的中纬度地区）  

**观测时机建议：**  
- 每日运行 `aurora` 命令查看最新信息  
- 关注 G 等级预警  
- 持续监测太阳风 Bz 分量  
- 活动峰值通常出现在日落后 1–2 小时内  

## 业余无线电操作员 📻

**HF 传播影响：**  
- **R 等级事件** 会干扰 HF 无线电通信  
- **太阳耀斑** 可引发突发性电离层扰动（SID）  
- 在通联竞赛（contest）或远距离通信（DXing）前，请先运行 `current`  
- 通过 `alerts` 监测无线电中断预警  

## 未来构想

- 基于位置的极光可见性预测  
- 重大事件的推送通知  
- 历史地磁暴数据  
- 太阳耀斑预测  
- 地磁暴期间的卫星过境预警  

祝您空间天气观测愉快！ 🌞⚡🌌