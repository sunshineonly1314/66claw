---
name: bmkg-monitor
name_zh: BMKG 监测
description: 利用印尼气象、气候与地球物理局（BMKG）官方数据监控印尼地震信息。当用户询问最新地震、有感地震，或印尼某次具体地震事件的信息时使用。
description_zh: 利用印尼气象、气候与地球物理局（BMKG）官方数据监控印尼地震信息。当用户询问最新地震、有感地震，或印尼某次具体地震事件的信息时使用。
---
# BMKG 监控器

利用印尼气象、气候与地球物理局（Badan Meteorologi, Klimatologi, dan Geofisika，BMKG）的实时数据，监控并分析印尼地区的地震活动。

## 快速开始

运行监控脚本来获取最新数据：

```bash
# Get the latest significant earthquake (M5.0+)
python3 scripts/get_gempa.py latest

# Get list of earthquakes felt by people (including smaller ones)
python3 scripts/get_gempa.py felt

# Get recent history of M5.0+ earthquakes
python3 scripts/get_gempa.py recent

# Get detailed Moment Tensor and Phase history
python3 scripts/get_gempa.py detail <EVENT_ID>
```

## 工作流程

### 1. 检查近期震动
若用户报告感到震动，或提问“发生地震了吗？”，请首先运行 `get_gempa.py felt`。该列表包含震级较小、震源较浅、人们实际能感受到的地震。

### 2. 深度分析
当发生显著地震时，参考 [references/seismology.md](references/seismology.md) 解释：
- 震级数值的含义；
- 报告中所列的烈度等级（MMI 标度）；
- 基于震源深度与地理位置评估潜在影响。

### 3. 与新闻协同研判
若用户提供“矩张量”或“沙滩球”图（通常来自 BMKG 的详细报告），请查阅 `references/seismology.md` 中的“矩张量”章节，以判断该地震属于走滑型、正断型还是逆冲型。

## 参考资料
- [seismology.md](references/seismology.md) — 震级、MMI 标度及断层类型说明。