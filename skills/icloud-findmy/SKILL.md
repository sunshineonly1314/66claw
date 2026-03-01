---
name: icloud-findmy
name_zh: iCloud查找
description: 通过 iCloud 查询家庭成员设备的 Find My 位置及电池状态。
description_zh: 通过 iCloud 查询家庭成员设备的 Find My 位置及电池状态。
homepage: https://github.com/picklepete/pyicloud
metadata: {"clawdbot":{"emoji":"📍","requires":{"bins":["icloud"]},"install":[{"id":"pipx","kind":"download","command":"brew install pipx && pipx install pyicloud","bins":["icloud"],"label":"Install PyiCloud (pipx)"}]}}
---
# iCloud Find My

通过 iCloud CLI（pyicloud）访问 Find My 设备位置及电池状态。

## 设置

1. **安装 pyicloud：**  
```bash
brew install pipx
pipx install pyicloud
```

2. **认证（一次性操作）：**  

向用户索取 Apple ID，然后运行：  
```bash
icloud --username their.email@example.com --with-family --list
```  

用户需输入密码并完成双重认证（2FA）。会话将被保存，有效期为 1–2 个月。

3. **存储 Apple ID：**  

将 Apple ID 添加至您的 TOOLS.md 或工作区配置中，以便后续查询时调用：  
```markdown
## iCloud Find My
Apple ID: their.email@example.com
```

## 使用方法

### 列出全部设备

```bash
icloud --username APPLE_ID --with-family --list
```

**输出格式：**  
```
------------------------------
Name           - Liam's iPhone
Display Name   - iPhone 15 Pro
Location       - {'latitude': 52.248, 'longitude': 0.761, 'timeStamp': 1767810759054, ...}
Battery Level  - 0.72
Battery Status - NotCharging
Device Class   - iPhone
------------------------------
```

**解析提示：**  
- 设备之间以 `------------------------------` 分隔  
- 位置字段为 Python 字典（可使用 `eval()` 或正则表达式解析）  
- 电池电量为 0.0–1.0 范围（乘以 100 得到百分比）  
- 电池状态：`"Charging"` 或 `"NotCharging"`  
- 位置字段包括：`latitude`、`longitude`、`timeStamp`（毫秒）、`horizontalAccuracy`

### 查询特定设备

通过 grep 筛选输出查找特定设备：  
```bash
icloud --username APPLE_ID --with-family --list | grep -A 10 "iPhone"
```

### 解析位置

提取并格式化位置数据：  
```bash
icloud --username APPLE_ID --with-family --list | \
  grep -A 10 "Device Name" | \
  grep "Location" | \
  sed "s/Location.*- //"
```  

随后可用 Python 解析该 Python 字典字符串，或用正则表达式提取坐标。

### 解析电池电量

```bash
icloud --username APPLE_ID --with-family --list | \
  grep -A 10 "Device Name" | \
  grep "Battery Level"
```

## 设备名称

设备名称来自 iCloud，可能包含：  
- 花式 Unicode 顿号（U+2019 ’）而非 ASCII 单引号（'）  
- 完全不含顿号（例如 `"Lindas iPhone"`）  

建议采用不区分大小写的匹配方式，并在必要时对顿号进行标准化处理。

## 会话管理

- 会话有效期为 **1–2 个月**  
- 存储于用户主目录下  
- 过期后，请重新执行认证步骤  
- PyiCloud 每次请求时自动验证会话有效性  

## 常见模式

**外出前检查电量：**  
```bash
# Get battery for specific device
icloud --username ID --with-family --list | \
  grep -B 2 -A 5 "iPhone" | \
  grep "Battery Level"
```

**获取当前定位：**  
```bash
# Extract location dict and parse coordinates
icloud --username ID --with-family --list | \
  grep -A 10 "iPhone" | \
  grep "Location" | \
  sed "s/.*- //" | \
  python3 -c "import sys; loc = eval(sys.stdin.read()); print(f\"{loc['latitude']}, {loc['longitude']}\")"
```

**检查设备是否正在充电：**  
```bash
icloud --username ID --with-family --list | \
  grep -A 10 "iPhone" | \
  grep "Battery Status"
```

## 主动应用场景

- **电池预警：** 在日历事件（如外出）前检查电池电量  
- **位置上下文：** 通过查询用户当前位置，回答“附近有哪些地点”类问题  
- **在家/离家检测：** 基于坐标判断用户是否位于家中  
- **低电量提醒：** 若电量 <30% 且未充电，则发出警告  

## 故障排除

**认证错误：**  
- 会话已过期 —— 请重新认证  
- Apple ID 错误 —— 请核对已存储的 ID  
- 需要双重认证 —— 请完成 2FA 流程  

**无位置信息：**  
- 设备离线  
- Find My 功能已关闭  
- 定位服务已关闭  

**未找到设备：**  
- 使用 `--list` 精确核对设备名称  
- 设备名称区分大小写  
- 名称中可能含 Unicode 顿号  

## 注意事项

- 需运行于 macOS（因 iCloud API 存在平台特异性）  
- 如需查看家庭成员设备，必须启用家庭共享  
- 设备活跃时，位置信息约每 1–5 分钟更新一次  
- 电池读数可能为缓存值（请检查时间戳）  