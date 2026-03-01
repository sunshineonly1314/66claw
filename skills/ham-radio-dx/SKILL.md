---
name: ham-radio-dx
name_zh: 业余无线电DX
description: 监测 DX 集群中的稀有台站通告，追踪活跃的 DX 远征活动，并为业余无线电爱好者提供每日波段活动摘要。
description_zh: 监测 DX 集群中的稀有台站通告，追踪活跃的 DX 远征活动，并为业余无线电爱好者提供每日波段活动摘要。
version: 1.0.0
author: captmarbles
---
# 业余无线电 DX 监测器 📻

实时监测全球 DX 集群，收到稀有 DX 台站出现通知，并追踪当前活跃的 DX 远征活动。专为希望捕捉稀有通联机会的业余无线电爱好者设计！

## 主要特性

📡 **实时 DX 通告** — 接入全球 DX 集群网络  
🌍 **稀有 DX 告警** — 稀有台站出现时即时通知  
📊 **每日摘要** — 各波段活动概况汇总  
🗺️ **DX 远征追踪** — 追踪当前活跃的远征活动  
⏰ **自动化监测** — 通过 cron 定时运行并触发告警  

## 快速入门

### 实时通告监测

```bash
# Get latest DX spots
python3 dx-monitor.py watch

# Specific cluster node
python3 dx-monitor.py watch --cluster ea7jxh

# Use your callsign
python3 dx-monitor.py watch --callsign KN4XYZ

# Only show NEW spots (filters duplicates)
python3 dx-monitor.py watch --new-only
```

**输出示例：**  
```
📡 Latest DX Spots from EA7JXH

   20m   SSB      14.195   K1ABC        - CQ Contest
   40m   CW        7.015   VP8/G3XYZ    - Falklands
   15m   FT8      21.074   ZL2ABC       - New Zealand
```

### 每日摘要

```bash
python3 dx-monitor.py digest
```

**输出示例：**  
```
# 📡 DX Digest - 2026-01-27

## Band Activity (last 100 spots)

   20m   ████████████ 24
   40m   ████████ 16
   15m   ██████ 12
   10m   ████ 8

## Rare DX Spotted

   🌍 VP8/G3XYZ    40m      7.015 - Falklands Expedition
   🌍 ZL2ABC       15m     21.074 - New Zealand
```

## DX 集群节点

可用集群如下：
- **ea7jxh** — dx.ea7jxh.eu:7373（欧洲）  
- **om0rx** — cluster.om0rx.com:7300（欧洲）  
- **oh2aq** — oh2aq.kolumbus.fi:7373（芬兰）  
- **ab5k** — ab5k.net:7373（美国）  
- **w6rk** — telnet.w6rk.com:7373（美国西海岸）  

## 自动化监测

### 实时告警（每 5 分钟检查一次）

```bash
# Add to crontab
*/5 * * * * cd ~/clawd && python3 skills/ham-radio-dx/dx-monitor.py watch --new-only --callsign YOUR_CALL >> /tmp/dx-alerts.log
```

该命令每 5 分钟检查一次新 DX 通告并记录至日志。

### 每日摘要（每日上午 9 点）

```bash
# Add to crontab
0 9 * * * cd ~/clawd && python3 skills/ham-radio-dx/dx-monitor.py digest >> ~/dx-digest-$(date +\%Y-\%m-\%d).txt
```

### Telegram 通知

集成 Clawdbot 消息工具：

```bash
# When rare DX appears, send Telegram alert
python3 dx-monitor.py watch --new-only | grep -E "(VP8|ZL|VK|ZS|P5)" && \
  echo "🚨 Rare DX spotted!" | # Send via Clawdbot message tool
```

## Clawdbot 示例提示语

- “检查 DX 集群是否有新通告”  
- “20 米波段目前有哪些活跃信号？”  
- “显示今天的 DX 摘要”  
- “当前空中是否有稀有 DX？”  
- “监控 VP8 或 ZL 呼号前缀”  

## 值得关注的稀有 DX 呼号前缀

**最热门目标：**  
- **VP8** — 福克兰群岛  
- **VK0** — 赫德岛  
- **3Y0** — 布韦岛  
- **FT5** — 阿姆斯特丹岛与圣保罗岛  
- **P5** — 朝鲜  
- **BS7** — 斯卡伯勒礁  

**其他稀有目标：**  
- **ZL** — 新西兰  
- **VK** — 澳大利亚  
- **ZS** — 南非  
- **9G** — 加纳  
- **S9** — 圣多美和普林西比  

## DX 远征资源

追踪当前活跃远征活动：
- **NG3K 日历：** https://www.ng3k.com/misc/adxo.html  
- **DX 新闻：** https://www.dx-world.net/  
- **425 DX 新闻：** http://www.425dxn.org/  

## 波段规划

常见 DX 频率范围：
- **160 米波段：** 1.830–1.840 MHz（CW），1.840–1.850 MHz（数字模式）  
- **80 米波段：** 3.500–3.600 MHz（CW），3.790–3.800 MHz（数字模式）  
- **40 米波段：** 7.000–7.040 MHz（CW），7.070–7.080 MHz（数字模式）  
- **30 米波段：** 10.100–10.140 MHz（仅限 CW/数字模式）  
- **20 米波段：** 14.000–14.070 MHz（CW），14.070–14.100 MHz（数字模式）  
- **17 米波段：** 18.068–18.100 MHz（CW），18.100–18.110 MHz（数字模式）  
- **15 米波段：** 21.000–21.070 MHz（CW），21.070–21.120 MHz（数字模式）  
- **12 米波段：** 24.890–24.920 MHz（CW），24.920–24.930 MHz（数字模式）  
- **10 米波段：** 28.000–28.070 MHz（CW），28.070–28.120 MHz（数字模式）  

## 使用提示

1. **使用您的真实呼号** — 部分集群要求有效呼号  
2. **检查多个集群** — 各区域覆盖范围不同  
3. **按波段筛选** — 聚焦于您能通联的波段  
4. **追踪稀有前缀** — 为最热门目标设置告警  
5. **清晨检查** — 最佳 DX 条件常出现在清晨  

## 技术细节

- **协议：** Telnet 连接至 DX 集群节点  
- **格式：** 标准 PacketCluster / AR-Cluster 格式  
- **状态追踪：** `/tmp/dx-monitor-state.json`  
- **依赖项：** Python 3.6+（仅标准库）  

## 未来构想

- 波段专属筛选功能  
- DXCC 实体追踪  
- 传播预测集成  
- 日志集成（请确认是否需要此项）  
- 竞赛模式（过滤竞赛台站）  
- 通过 PSKReporter 集成 FT8/FT4  

73 并祝您通联顺利！📻🌍  