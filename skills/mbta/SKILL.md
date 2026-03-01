---
name: mbta
name_zh: MBTA
description: 提供波士顿地区地铁、公交、通勤铁路及轮渡的实时 MBTA 交通预测。可查询发车时间、搜索站点/线路、查看服务告警，并运行实时仪表盘。当用户询问波士顿公共交通、T 线路时刻表、何时出发赶火车，或 MBTA 服务状态时使用。
description_zh: 提供波士顿地区地铁、公交、通勤铁路及轮渡的实时 MBTA 交通预测。可查询发车时间、搜索站点/线路、查看服务告警，并运行实时仪表盘。当用户询问波士顿公共交通、T 线路时刻表、何时出发赶火车，或 MBTA 服务状态时使用。
metadata: {"clawdbot":{"requires":{"bins":["python3"],"pip":["requests"]}}}
---
# MBTA 交通  

通过 v3 API 查询实时 MBTA 预测信息。

## 设置  

```bash
# Optional but recommended for higher rate limits
export MBTA_API_KEY=your_key_here  # Free at https://api-v3.mbta.com/portal

# Install dependencies
pip install requests pyyaml flask  # flask only needed for dashboard
```  

## 快捷命令  

```bash
cd skills/mbta

# Next departures from a stop
python scripts/mbta.py next --stop place-alfcl  # Alewife
python scripts/mbta.py next --stop place-harsq --route Red  # Harvard, Red Line only

# Search for stop IDs
python scripts/mbta.py stops --search "Porter"
python scripts/mbta.py stops --search "Kendall"

# List routes
python scripts/mbta.py routes              # All routes
python scripts/mbta.py routes --type rail  # Subway only
python scripts/mbta.py routes --type bus   # Buses

# Service alerts
python scripts/mbta.py alerts              # All alerts
python scripts/mbta.py alerts --route Red  # Red Line alerts

# All configured departures (uses config.yaml)
python scripts/mbta.py departures --config config.yaml

# Start web dashboard
python scripts/mbta.py dashboard --config config.yaml --port 6639
```  

## 配置  

编辑 `config.yaml` 以配置您的常用站点：

```yaml
panels:
  - title: "My Station"
    walk_minutes: 5  # Filter out trains you can't catch
    services:
      - label: "Red Line"
        destination: "to Alewife"
        route_id: "Red"
        stop_id: "place-harsq"
        direction_id: 0  # 0 or 1 for direction
        limit: 3
```  

关键字段说明：  
- `walk_minutes`：早于此时间出发的列车将被过滤掉  
- `direction_id`：0 = 出城/北向，1 = 进城/南向（依线路而异）  
- `headsign_contains`：可选筛选器（例如 "Ashmont"，用于排除 Braintree 方向）  

## 查找站点/线路 ID  

```bash
# Search stops
python scripts/mbta.py stops --search "Davis"
# Returns: place-davis: Davis

# Get routes
python scripts/mbta.py routes --type rail
# Returns route IDs like "Red", "Orange", "Green-E"
```  

## JSON 输出  

添加 `--json` 参数以获取机器可读的 JSON 输出：

```bash
python scripts/mbta.py next --stop place-alfcl --json
python scripts/mbta.py departures --config config.yaml --json
```  

## 常用站点 ID  

| 车站 | 站点 ID |  
|------|---------|  
| Alewife | place-alfcl |  
| Harvard | place-harsq |  
| Kendall/MIT | place-knncl |  
| Park Street | place-pktrm |  
| South Station | place-sstat |  
| North Station | place-north |  
| Back Bay | place-bbsta |  
| Downtown Crossing | place-dwnxg |  

## 回答用户问题  

**“下趟红线列车什么时候发车？”**  
```bash
python scripts/mbta.py next --stop place-alfcl --route Red
```  

**“我现在出发能赶上地铁吗？”**  
将下一班列车发车时间与用户步行时间对比。若下一班车 ≤ 步行分钟数，则回复：“现在出发！”  

**“橙线目前有延误吗？”**  
```bash
python scripts/mbta.py alerts --route Orange
```  

**“哪些公交车开往哈佛大学？”**  
```bash
python scripts/mbta.py stops --search "Harvard"
# Then check routes at that stop
python scripts/mbta.py next --stop <stop_id>
```  