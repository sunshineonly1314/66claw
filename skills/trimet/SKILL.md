---
name: trimet
name_zh: TriMet
description: 获取波特兰市公共交通信息，包括到站时间、行程规划及服务提醒。当用户询问波特兰市的公交、MAX 轻轨、列车或公共交通时使用。
description_zh: 获取波特兰市公共交通信息，包括到站时间、行程规划及服务提醒。当用户询问波特兰市的公交、MAX 轻轨、列车或公共交通时使用。
homepage: https://trimet.org
metadata:
  clawdbot:
    emoji: "🚃"
    requires:
      bins: ["trimet"]
      env: ["TRIMET_APP_ID"]
---
# TriMet CLI 工具

面向波特兰 TriMet 公共交通数据的命令行工具，支持查询车辆到站时间、规划行程及查看服务提醒。

## 安装

```bash
npm install -g trimet-cli
```

## 配置

1. 从 https://developer.trimet.org/ 免费获取 API 密钥  
2. 设置环境变量：`export TRIMET_APP_ID="your-key"`

## 命令列表

### 到站时间查询

```bash
trimet arrivals <stop-id>              # Real-time arrivals
trimet arrivals 8383 --line 90         # Filter by route
trimet arrivals 8383 --json
```

### 行程规划

```bash
trimet trip -f <from> -t <to>
trimet trip -f 8383 -t 9969
trimet trip -f "Pioneer Square" -t "PDX Airport"
trimet trip -f 8383 -t 9969 --arrive-by "5:30 PM"
trimet trip -f 8383 -t 9969 --depart-at "2:00 PM"
trimet trip -f 8383 -t 9969 --json
```

### 下一班次发车

```bash
trimet next -f <from> -t <to>          # Simplified view
trimet next -f 8383 -t 9969 -c 5       # Show 5 options
trimet next -f 8383 -t 9969 --line 90  # Filter by route
```

### 服务提醒

```bash
trimet alerts                          # All alerts
trimet alerts --route 90               # Alerts for route
trimet alerts --json
```

## 常用站点 ID

- 先驱法院广场站（Pioneer Courthouse Square）：8383（西行方向），8384（东行方向）  
- 波特兰国际机场（PDX Airport）：10579  
- 波特兰联合车站（Portland Union Station）：7787  
- 比弗顿交通中心（Beaverton TC）：9969  

## 使用示例

**用户：“下一班 MAX 轻轨什么时候到？”**  
```bash
trimet arrivals 8383
```

**用户：“我怎么去机场？”**  
```bash
trimet trip -f "Pioneer Square" -t "PDX Airport"
```

**用户：“我需要在下午 5 点前到达市中心。”**  
```bash
trimet trip -f <user-location-stop> -t 8383 --arrive-by "5:00 PM"
```

**用户：“蓝线（Blue Line）目前有延误吗？”**  
```bash
trimet alerts --route 100
```

**用户：“开往比弗顿的下一班列车？”**  
```bash
trimet next -f 8383 -t 9969
```

## 线路编号

- MAX 蓝线（Blue Line）：100  
- MAX 红线（Red Line）：90  
- MAX 黄线（Yellow Line）：190  
- MAX 橙线（Orange Line）：290  
- MAX 绿线（Green Line）：200  

## 注意事项

- 站点 ID 标示于 TriMet 各站点及 trimet.org 网站上  
- 行程规划支持输入地址（例如：“Portland, Pioneer Square”）  
- 时间支持自然语言格式（如 “5:30 PM” 或 “17:30”）