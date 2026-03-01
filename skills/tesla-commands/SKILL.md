---
name: tesla-commands
name_zh: 特斯拉指令
description: 通过 MyTeslaMate API 控制您的特斯拉车辆。支持多车账户、空调控制及充电计划。
description_zh: 通过 MyTeslaMate API 控制您的特斯拉车辆。支持多车账户、空调控制及充电计划。
metadata: {"tags": ["tesla", "myteslamate", "ev", "car-control", "automation"]}
---
# 特斯拉命令 Skill 🚗

本 skill 允许您通过 MyTeslaMate API 监控并控制您的特斯拉车辆。

## 前置条件

要使用本 skill，您需满足以下条件：  
1. 拥有一个已配置车辆的 **MyTeslaMate** 账户。  
2. 一个来自 MyTeslaMate 的 **API Token**（请前往 [app.myteslamate.com/fleet](https://app.myteslamate.com/fleet) 获取）。  
3. 您车辆的 **VIN 码**。

### 环境变量  
以下环境变量必须设置，skill 方可正常运行：  
- `TESLA_MATE_TOKEN`：您的 MyTeslaMate API Token。  
- `TESLA_VIN`：您车辆的 VIN 码（若通过命令行指定，则此项为可选）。

## Tools

### tesla-control

管理车辆状态、空调、充电及充电计划。

**用法：**  
`public-skills/tesla-commands/bin/tesla-control.py [options]`

**选项：**  
- `--list`：列出账户下所有车辆及其 VIN 码。  
- `--status`：获取完整的车辆数据（包括电池、空调、位置、门锁等）。  
- `--wake`：将休眠中的车辆唤醒。  
- `--climate [on|off]`：开启或关闭空调。  
- `--charge-limit [50-100]`：设置电池充电上限百分比。  
- `--set-schedule [HH:MM]`：设置定时充电启动时间。  
- `--clear-schedule`：禁用定时充电。  
- `--vin [VIN]`：指定目标车辆（覆盖默认的 `TESLA_VIN`）。

## 示例

**唤醒车辆：**  
```bash
./bin/tesla-control.py --wake
```

**将充电上限设为 80%：**  
```bash
./bin/tesla-control.py --charge-limit 80
```

**设置充电于 02:00 开始：**  
```bash
./bin/tesla-control.py --set-schedule 02:00
```