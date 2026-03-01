---
name: huckleberry
name_zh: Huckleberry
description: 通过 Huckleberry CLI 追踪婴儿睡眠、喂养、尿布更换及生长发育情况。适用于用户询问如何记录婴儿活动、开始/停止睡眠、奶瓶喂养、尿布更换或生长测量等场景。
description_zh: 通过 Huckleberry CLI 追踪婴儿睡眠、喂养、尿布更换及生长发育情况。适用于用户询问如何记录婴儿活动、开始/停止睡眠、奶瓶喂养、尿布更换或生长测量等场景。
---
# Huckleberry CLI

[Huckleberry](https://huckleberrycare.com/)（一款婴儿追踪应用）的命令行接口。只需一次认证，即可在终端中记录婴儿睡眠、喂养、尿布及生长发育数据。

> **Note:** This is an unofficial tool and is not affiliated with Huckleberry.

## 安装

```bash
pip install huckleberry-cli
```

## 快速入门

```bash
huckleberry login
huckleberry children
huckleberry sleep start
```

## 命令

### 睡眠（Sleep）

```bash
huckleberry sleep start      # Start sleep timer
huckleberry sleep stop       # Complete sleep (saves duration)
huckleberry sleep pause      # Pause sleep timer
huckleberry sleep resume     # Resume paused sleep
huckleberry sleep cancel     # Cancel without saving
```

### 喂养（Feeding）

**母乳喂养：**  
```bash
huckleberry feed start --side=left    # Start nursing (left side)
huckleberry feed start --side=right   # Start nursing (right side)
huckleberry feed switch               # Switch sides mid-feed
huckleberry feed stop                 # Complete feeding
```

**奶瓶喂养：**  
```bash
huckleberry feed bottle <amount> [--type=TYPE] [--units=UNITS]

# Examples:
huckleberry feed bottle 120                           # 120ml formula (default)
huckleberry feed bottle 4 --units=oz                  # 4oz formula
huckleberry feed bottle 100 --type="Breast Milk"      # 100ml pumped milk
```

喂养类型：`Formula`、`Breast Milk`、`Mixed`  
计量单位：`ml`（默认）、`oz`

### 尿布（Diapers）

```bash
huckleberry diaper pee                              # Wet only
huckleberry diaper poo                              # Dirty only
huckleberry diaper both                             # Wet + dirty
huckleberry diaper dry                              # Dry check

# With details:
huckleberry diaper poo --color=yellow               # With color
huckleberry diaper poo --consistency=soft           # With consistency
huckleberry diaper both --color=brown --consistency=runny
```

尿布颜色：`yellow`、`green`、`brown`、`black`、`red`  
粪便性状：`runny`、`soft`、`solid`、`hard`

### 生长发育（Growth）

```bash
huckleberry growth --weight=7.5                     # Weight in kg
huckleberry growth --height=65                      # Height in cm
huckleberry growth --head=42                        # Head circumference in cm
huckleberry growth --weight=7.5 --height=65 --head=42  # All at once

# Imperial units:
huckleberry growth --weight=16.5 --units=imperial   # Weight in lbs
```

### 信息（Info）

```bash
huckleberry children           # List children
huckleberry --json children    # JSON output (--json before subcommand)
huckleberry status             # Current status
```

### 多个孩子（Multiple Children）

```bash
huckleberry --child="Baby" sleep start   # Specify child by name
huckleberry -c "Baby" diaper pee
```

## 认证

配置文件存储于 `~/.config/huckleberry/config.json`。

```bash
huckleberry login                        # Interactive setup
```

或使用环境变量：  
```bash
export HUCKLEBERRY_EMAIL="your@email.com"
export HUCKLEBERRY_PASSWORD="your-password"
export HUCKLEBERRY_TIMEZONE="America/Los_Angeles"
```

## 系统要求

- Python 3.11+  
- [huckleberry-api](https://github.com/Woyken/py-huckleberry-api)

## 单位换算

- 1 盎司（oz）≈ 30 毫升（ml）  
- 1 磅（lb）≈ 0.45 千克（kg）  
- 1 英寸（inch）≈ 2.54 厘米（cm）  