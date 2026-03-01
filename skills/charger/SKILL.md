---
name: charger
name_zh: 充电器
description: 通过 Google Places 查询电动汽车充电桩可用性（收藏地点、附近搜索）。
description_zh: 通过 Google Places 查询电动汽车充电桩可用性（收藏地点、附近搜索）。
metadata:
  clawdbot:
    config:
      requiredEnv:
        - GOOGLE_PLACES_API_KEY
      stateDirs:
        - config
        - .cache
---
# charger

基于 Google Places（新）电动汽车充电数据构建的高级充电桩可用性查询工具。

本技能包含一个 `bin/charger` CLI（Node.js）用于检查充电桩可用性。

## 环境准备

- 前置要求：  
  - Node.js 18+（Clawdbot 已预装 Node）  
  - `GOOGLE_PLACES_API_KEY`（建议安装于 `~/.clawdbot/.env`）

- 将 CLI 加入系统 PATH（示例）：  
  - `ln -sf "$(pwd)"/bin/charger /home/claw/clawd/bin/charger`

- 添加收藏地点：  
  - `charger favorites add home --place-id <placeId>`

## 命令

- 查询收藏地点 / 地点 ID / 关键词：  
  - `charger check home`  
  - `charger check "Wien Energie Charging Station Liniengasse 2 1060 Wien"`

- 查询附近充电桩：  
  - `charger nearby --lat 48.188472 --lng 16.348854 --radius 2000 --max 10`

## 通知机制

推荐使用如下模式：

1) `charger`（本技能）输出清晰的 `Any free: YES|NO` 结果。  
2) 由定时任务（Gateway cron）运行一个轻量级辅助脚本，该脚本仅在需要通知时才打印输出。

### 辅助脚本（实际决定是否通知）

本软件包附带 `scripts/charger-notify.sh`。

其功能包括：  
- 运行 `charger check <target>`  
- 若 `Any free: YES` **且** 上次运行结果并非 `YES`，则打印一条通知消息。  
- 其余情况均**不输出任何内容**。

因此：**无输出 = 无通知**。

状态管理：  
- 将上次状态存于 `~/.cache/charger-notify/<target>.state`，确保仅在 `NO/UNKNOWN → YES` 时触发通知。

用法：  
- `bash scripts/charger-notify.sh home`

示例通知输出：  
- `EV charger available: Tanke Wien Energie Charging Station — Amtshausgasse 9, 1050 Wien, Austria — 1/2 available (OOS 0) (updated 2026-01-21T21:05:00Z)`

### 典型 cron 调度（实现 Telegram 推送的实际方式）

Cron 是调度器，它按设定时间运行辅助脚本，并将脚本输出内容发送给您。  
由于辅助脚本**仅在充电桩变为可用时才输出**，您只会收到真正重要的消息。

每 10 分钟检查一次：  
- `*/10 * * * *`

若您希望我将此集成至 Clawdbot Gateway cron（以便接收 Telegram 推送），请告知我：  
- 目标用户（`home`）  
- 调度间隔（每 5/10/20 分钟）  
- 静默时段（可选）  