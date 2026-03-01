---
name: flights
name_zh: 航班
description: 跟踪航班状态、延误情况及航线搜索。使用 FlightAware 数据。
description_zh: 跟踪航班状态、延误情况及航线搜索。使用 FlightAware 数据。
homepage: https://flightaware.com
metadata: {"clawdis":{"emoji":"✈️","requires":{"bins":[],"env":[]}}}
---
# 航班（Flights）Skill

使用 FlightAware 数据跟踪航班状态、搜索航线及监控延误情况。

## 快捷命令（Quick Commands）

```bash
cd skills/flights

# Search flights by route
uv run python scripts/flights.py search PVD ORF --airline MX

# Get specific flight status
uv run python scripts/flights.py status MXY704
```

## 使用示例（Usage Examples）

**搜索 Breeze 航空公司 PVD → ORF 航线：**  
```bash
flights.py search PVD ORF --airline MX
```

**查询特定航班：**  
```bash
flights.py status AA100
flights.py status MXY704 --date 2026-01-08
```

## 输出格式（Output Format）

```json
{
  "flight": "MXY704",
  "airline": "Breeze Airways",
  "origin": "PVD",
  "destination": "ORF",
  "departure": "Thu 05:04PM EST",
  "arrival": "06:41PM EST",
  "status": "Scheduled / Delayed",
  "aircraft": "BCS3"
}
```

## 状态值（Status Values）

- `Scheduled` — 航班准点  
- `Scheduled / Delayed` — 预计延误  
- `En Route / On Time` — 已起飞，准点  
- `En Route / Delayed` — 已起飞，延误中  
- `Arrived / Gate Arrival` — 已降落并停靠登机口  
- `Cancelled` — 航班取消  

## 航空公司代码（Airline Codes）

| 代码 | 航空公司 |
|------|---------|
| MX/MXY | Breeze Airways |
| AA | 美国航空 |
| DL | 达美航空 |
| UA | 联合航空 |
| WN | 西南航空 |
| B6 | 捷蓝航空 |

## 可选：AviationStack API

如需更详细的数据，请设置 `AVIATIONSTACK_API_KEY`（可在 aviationstack.com 免费获取试用版）。

## 依赖项（Dependencies）

```bash
cd skills/flights && uv sync
```