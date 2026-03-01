---
name: beestat
name_zh: BeeStat
description: 通过 Beestat API 查询 ecobee 恒温器数据，包括温度、湿度、空气质量（CO₂、VOC）、传感器状态及 HVAC 运行时长。当用户询问家庭温度、恒温器状态、空气质量或供暖/制冷使用情况时使用。
description_zh: 通过 Beestat API 查询 ecobee 恒温器数据，包括温度、湿度、空气质量（CO₂、VOC）、传感器状态及 HVAC 运行时长。当用户询问家庭温度、恒温器状态、空气质量或供暖/制冷使用情况时使用。
homepage: https://beestat.io
metadata:
  clawdbot:
    emoji: "🌡️"
    requires:
      bins: ["beestat"]
      env: ["BEESTAT_API_KEY"]
---
# Beestat CLI

Beestat API（ecobee 恒温器分析）的命令行接口。支持查询温度、湿度、空气质量及 HVAC 运行时长。

## 安装

```bash
npm install -g beestat-cli
```

## 配置

1. 在 [beestat.io](https://beestat.io) 注册账户并绑定您的 ecobee 设备  
2. 向 contact@beestat.io 发送邮件，附上您的恒温器序列号，以获取 API 密钥  
3. 设置环境变量：`export BEESTAT_API_KEY="your-key"`

## 命令

### 状态

```bash
beestat status             # Current temps, humidity, setpoints, weather
beestat status --json
```

### 传感器

```bash
beestat sensors            # All sensors with temperature and occupancy
beestat sensors --json
```

### 空气质量

```bash
beestat air-quality        # CO2, VOC, and air quality score
beestat aq                 # Short alias
beestat aq --json
```

需搭配 ecobee Smart Thermostat Premium（内置空气质量传感器）使用。

**CO₂ 浓度参考：**  
- < 800 ppm：优秀  
- 800–1000 ppm：良好  
- 1000–1500 ppm：一般（建议通风）  
- > 1500 ppm：偏高（立即通风！）

**VOC 浓度参考：**  
- < 0.5 ppm：优秀  
- 0.5–1.0 ppm：良好  
- 1.0–3.0 ppm：一般  
- > 3.0 ppm：偏高  

### 恒温器

```bash
beestat thermostats        # Model info, HVAC details
beestat thermostats --json
```

### 运行时长汇总

```bash
beestat summary            # Runtime history (default 7 days)
beestat summary --days 14  # Last 14 days
beestat summary --json
```

### 强制同步

```bash
beestat sync               # Force sync with ecobee
```

## 使用示例

**用户：“家里温度是多少？”**  
```bash
beestat status
```

**用户：“空气质量还好吗？”**  
```bash
beestat aq
```

**用户：“卧室里有人吗？”**  
```bash
beestat sensors
```

**用户：“这周我们给房子供暖用了多少？”**  
```bash
beestat summary --days 7
```

**用户：“我们有哪些恒温器？”**  
```bash
beestat thermostats
```

## 注意事项

- 空气质量数据源自 ecobee 运行时统计，而非传感器硬件能力  
- 所有命令均支持 `--json`，适用于脚本编写与自动化  
- 若数据陈旧，请使用 `beestat sync` 强制刷新  