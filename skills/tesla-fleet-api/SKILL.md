---
name: tesla-fleet-api
name_zh: 特斯拉车队API
description: 在集成 Tesla 官方 Fleet API 以读取车辆/能源设备数据或下发远程指令（例如：启动 HVAC 预调节、唤醒车辆、充电控制）时使用。涵盖接入流程（开发者应用注册、区域/基础 URL）、OAuth 令牌流程（第三方令牌与合作伙伴令牌、刷新轮换）、必需的域名/公钥托管，以及使用 Tesla 官方 vehicle-command/tesla-http-proxy 实现已签名的车辆指令。
description_zh: 在集成 Tesla 官方 Fleet API 以读取车辆/能源设备数据或下发远程指令（例如：启动 HVAC 预调节、唤醒车辆、充电控制）时使用。涵盖接入流程（开发者应用注册、区域/基础 URL）、OAuth 令牌流程（第三方令牌与合作伙伴令牌、刷新轮换）、必需的域名/公钥托管，以及使用 Tesla 官方 vehicle-command/tesla-http-proxy 实现已签名的车辆指令。
version: 1.1.3
metadata: {"clawdbot":{"requires":{"bins":["python3"]}}}
---
# Tesla Fleet API

通过官方 Fleet API 控制 Tesla 车辆。

## 脚本概览

| 脚本 | 用途 |
|--------|---------|
| `command.py` | 车辆指令（空调、充电、车门锁等） |
| `vehicle_data.py` | 读取车辆数据（电池、空调、位置等） |
| `vehicles.py` | 列出车辆 + 刷新缓存 |
| `auth.py` | 认证与配置 |
| `tesla_oauth_local.py` | 带本地回调服务器的 OAuth 辅助工具 |

---

## 设置 / 配置

设置说明详见 **`SETUP.md`**：

- [SETUP.md](SETUP.md)

（涵盖 `.env`、`config.json`/`auth.json`、代理设置及密钥注册。）

---

## command.py — 车辆指令

在您的 Tesla 车辆上执行指令。若您仅拥有一辆车，则自动选择该车。

### 用法

```bash
command.py [VEHICLE] <command> [options]
```

- `VEHICLE` — 车辆名称或 VIN（单辆车时可选）
- 可不指定车辆直接运行指令：`command.py honk`
- 或指定车辆名称：`command.py flash honk`（车辆名为 "flash"，指令为 "honk"）

---

### 空调控制

#### 启动/停止空调
```bash
command.py climate start
command.py climate stop
command.py flash climate start          # specific vehicle
```

#### 设定温度
```bash
command.py climate temps <driver_temp> [passenger_temp]
command.py climate temps 21             # both seats 21°C
command.py climate temps 22 20          # driver 22°C, passenger 20°C
```

#### 空调守护模式（Climate Keeper Mode）
```bash
command.py climate keeper <mode>
```
模式：`off`、`keep`、`dog`、`camp`

---

### 座椅加热器

```bash
command.py seat-heater --level <level> [--position <position>]
command.py seat-heater -l <level> [-p <position>]
```

**档位：**
| 值 | 名称 |
|-------|------|
| 0 | 关闭 |
| 1 | 低档 |
| 2 | 中档 |
| 3 | 高档 |

**位置：**
| 值 | 名称 |
|-------|-------|
| 0 | `driver`、`front_left`、`fl` |
| 1 | `passenger`、`front_right`、`fr` |
| 2 | `rear_left`、`rl` |
| 3 | `rear_left_back` |
| 4 | `rear_center`、`rc` |
| 5 | `rear_right`、`rr` |
| 6 | `rear_right_back` |
| 7 | `third_left` |
| 8 | `third_right` |

**示例：**
```bash
command.py seat-heater -l high                    # driver (default)
command.py seat-heater -l medium -p passenger
command.py seat-heater --level low --position rear_left
command.py seat-heater -l 2 -p 4                  # medium, rear center
command.py seat-heater -l off -p driver           # turn off
```

---

### 座椅冷却器（通风）

```bash
command.py seat-cooler --level <level> [--position <position>]
command.py seat-cooler -l <level> [-p <position>]
```

档位与位置同座椅加热器。

**示例：**
```bash
command.py seat-cooler -l medium -p driver
command.py seat-cooler -l high -p passenger
```

---

### 座椅自动空调

```bash
command.py seat-climate [--position <position>] <mode>
command.py seat-climate [-p <position>] <mode>
```

模式：`auto`、`on`、`off`

**示例：**
```bash
command.py seat-climate auto                      # driver auto
command.py seat-climate -p passenger auto
command.py seat-climate -p driver off             # disable auto
```

---

### 方向盘加热器

```bash
command.py steering-heater <on|off>
```

**示例：**
```bash
command.py steering-heater on
command.py steering-heater off
```

---

### 预调节计划

用于调度出发前预调节的现代 API（替代已弃用的 `set_scheduled_departure`）。

#### 添加计划
```bash
command.py precondition add --time <HH:MM> [--days <days>] [--id <id>] [--one-time] [--disabled]
command.py precondition add -t <HH:MM> [-d <days>] [--id <id>]
```

**天数选项：**
| 值 | 描述 |
|-------|-------------|
| `all` | 每日（默认） |
| `weekdays` | 周一至周五 |
| `weekends` | 周六与周日 |
| `mon,tue,wed,...` | 特定日期（逗号分隔） |

星期名称：`sun`、`mon`、`tue`、`wed`、`thu`、`fri`、`sat`（或完整名称）

**示例：**
```bash
command.py precondition add -t 08:00              # every day at 8am
command.py precondition add -t 08:00 -d weekdays  # Mon-Fri
command.py precondition add -t 07:30 -d mon,wed,fri
command.py precondition add -t 09:00 --one-time   # one-time only
command.py precondition add -t 08:30 --id 123     # modify existing schedule
command.py precondition add -t 08:00 --disabled   # create but disabled
```

#### 删除计划
```bash
command.py precondition remove --id <id>
```

**示例：**
```bash
command.py precondition remove --id 123
command.py precondition remove --id 1
```

---

### 充电控制

#### 启动/停止充电
```bash
command.py charge start
command.py charge stop
```

#### 设定充电上限
```bash
command.py charge limit <percent>
```

百分比必须为 50–100。

**示例：**
```bash
command.py charge limit 80
command.py charge limit 90
command.py flash charge limit 70                  # specific vehicle
```

---

### 车门与安全

```bash
command.py lock                   # lock all doors
command.py unlock                 # unlock all doors
command.py honk                   # honk the horn
command.py flash                  # flash the lights
command.py wake                   # wake vehicle from sleep
```

**指定车辆名称：**
```bash
command.py flash wake             # wake vehicle named "flash"
command.py flash flash            # flash lights on vehicle "flash"
```

---

## vehicle_data.py — 读取车辆数据

默认以人类可读格式获取车辆数据。

### 用法

```bash
vehicle_data.py [VEHICLE] [flags] [--json]
```

- `VEHICLE` — 车辆名称或 VIN（单辆车时可选）
- 不带标志 = 所有数据
- `--json` = 原始 JSON 输出

### 标志

| 标志 | 长格式 | 数据 |
|------|------|------|
| `-c` | `--charge` | 电量、充电上限、充电状态 |
| `-t` | `--climate` | 车内/车外温度、HVAC 状态 |
| `-d` | `--drive` | 档位、速度、功率、航向 |
| `-l` | `--location` | GPS 坐标 |
| `-s` | `--state` | 车门锁、车门、车窗、里程表、软件版本 |
| `-g` | `--gui` | GUI 设置（单位、24 小时制） |
| | `--config-data` | 车辆配置（型号、颜色、轮毂） |

### 示例

```bash
# All data
vehicle_data.py
vehicle_data.py flash

# Specific data
vehicle_data.py -c                        # charge only
vehicle_data.py -c -t                     # charge + climate
vehicle_data.py flash -c -l               # charge + location

# Raw JSON
vehicle_data.py --json
vehicle_data.py -c --json
```

### 示例输出

```
🚗 My Tesla (online)
   VIN: 5YJ... (redacted)

⚡ Charge State
────────────────────────────────────────
  Battery:    [███████████████░░░░░] 78%
  Limit:      80%
  State:      Charging
  Power:      11 kW (16A × 234V × 3φ)
  Added:      37.2 kWh
  Remaining:  10m
  Range:      438 km (272 mi)
  Cable:      IEC

🌡️  Climate State
────────────────────────────────────────
  Inside:     11.9°C
  Outside:    6.0°C
  Set to:     20.5°C
  Climate:    Off
```

---

## auth.py — 认证

管理 OAuth 令牌与配置。

### 用法

```bash
auth.py <command> [options]
```

### 命令

#### 登录（OAuth 流程）
```bash
auth.py login
```
交互式：生成认证 URL，提示输入授权码，并交换为令牌。

#### 交换授权码
```bash
auth.py exchange <code>
```
将授权码交换为令牌（非交互式）。

#### 刷新令牌
```bash
auth.py refresh
```
刷新访问令牌。注意：刷新令牌会轮换——新令牌将被自动保存。

#### 注册域名
```bash
auth.py register --domain <domain>
```
向 Tesla 注册您的应用域名（签署指令所必需）。

注册后，请注册您的虚拟密钥：
```
https://tesla.com/_ak/<domain>
```

#### 显示配置
```bash
auth.py config
```
显示当前配置（敏感信息已脱敏）。

#### 设置配置
```bash
auth.py config set [options]
```

选项：
- `--client-id <id>`
- `--client-secret <secret>`
- `--redirect-uri <uri>`
- `--audience <url>`
- `--base-url <url>`
- `--ca-cert <path>`
- `--domain <domain>`

**示例：**
```bash
# Initial setup
auth.py config set \
  --client-id "abc123" \
  --client-secret "secret" \
  --redirect-uri "http://localhost:18080/callback"

# Configure proxy
auth.py config set \
  --base-url "https://localhost:4443" \
  --ca-cert "/path/to/tls-cert.pem"
```

---

## tesla_fleet.py — 列出车辆

以人类可读格式列出车辆。

```bash
python3 scripts/tesla_fleet.py vehicles
python3 scripts/tesla_fleet.py vehicles --json
```

### 示例输出

```
🚗 Name:   My Tesla
🔖 VIN:    5YJ... (redacted)
🟢 Status: Online
👤 Access: Owner
```

---

## 配置 / 代理 / 文件布局

全部设置与配置详见 **[SETUP.md](SETUP.md)**。

---

## 区域性基础 URL

| 区域 | Audience URL |
|--------|--------------|
| 欧洲 | `https://fleet-api.prd.eu.vn.cloud.tesla.com` |
| 北美 | `https://fleet-api.prd.na.vn.cloud.tesla.com` |
| 中国 | `https://fleet-api.prd.cn.vn.cloud.tesla.cn` |

OAuth 令牌端点（所有区域）：
```
https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token
```

---

## 故障排除

### “车辆不可用：车辆离线或休眠”
请先唤醒车辆：
```bash
command.py wake
```

### “命令未签名” / “车辆拒绝”
确保代理正在运行且已正确配置：
```bash
./scripts/start_proxy.sh <private-key.pem>
auth.py config set --base-url "https://localhost:4443" --ca-cert "<tls-cert.pem>"
```

### 令牌过期
```bash
auth.py refresh
```

### 多辆车
通过名称或 VIN 指定车辆：
```bash
command.py flash climate start
command.py 5YJ... honk
```

---

## 完整命令参考

### command.py

```
climate start|stop
climate temps <driver> [passenger]
climate keeper off|keep|dog|camp

seat-heater -l <level> [-p <position>]
seat-cooler -l <level> [-p <position>]
seat-climate [-p <position>] auto|on|off

steering-heater on|off

precondition add -t <HH:MM> [-d <days>] [--id <id>] [--one-time]
precondition remove --id <id>

charge start|stop
charge limit <percent>

lock
unlock
honk
flash
wake
```

### vehicle_data.py

```
[VEHICLE] [-c] [-t] [-d] [-l] [-s] [-g] [--config-data] [--json]
```

### auth.py

```
login
exchange <code>
refresh
register --domain <domain>
config
config set [--client-id] [--client-secret] [--redirect-uri] [--audience] [--base-url] [--ca-cert] [--domain]
```