---
name: anova-oven
name_zh: ANOVA分析
description: 通过 WiFi WebSocket API 控制 Anova 精密烤箱（Precision Ovens）和精密料理棒（Precision Cookers，即低温慢煮设备）。启动烹饪模式（低温慢煮、烘烤、蒸煮），设置温度，监控状态，并远程停止烹饪。
description_zh: 通过 WiFi WebSocket API 控制 Anova 精密烤箱（Precision Ovens）和精密料理棒（Precision Cookers，即低温慢煮设备）。启动烹饪模式（低温慢煮、烘烤、蒸煮），设置温度，监控状态，并远程停止烹饪。
license: Apache-2.0
compatibility: 需 Python 3.7+、websockets 库，以及访问 Anova 云 API 的互联网连接
metadata:
  author: Akshay Dodeja
  version: "1.0.0"
  repository: https://github.com/dodeja/anova-skill
---
# Anova 烤箱与精密料理棒控制

通过 WebSocket API 控制 Anova WiFi 设备，包括精密烤箱（APO）和精密料理棒（APC）。

## 前置条件

1. **Anova 应用中的个人访问令牌（Personal Access Token）**
   - 下载 Anova 烤箱应用（iOS/Android）
   - 进入：更多 → 开发者 → 个人访问令牌
   - 创建令牌（以 `anova-` 开头）
   - 将其保存至 `~/.config/anova/token`

2. **Python 依赖项**
   ```bash
   pip3 install websockets
   ```

3. **设备配置**
   - Anova 设备已连接至 WiFi
   - 已与您的 Anova 账户配对

## 安装

```bash
# Install Python dependency
pip3 install websockets

# Store your token
mkdir -p ~/.config/anova
echo "anova-YOUR_TOKEN_HERE" > ~/.config/anova/token
chmod 600 ~/.config/anova/token
```

## 使用方法

### 列出设备
```bash
python3 scripts/anova.py list
```

### 基础烹饪操作
```bash
# Simple cook at 350°F for 30 minutes
python3 scripts/anova.py cook --temp 350 --duration 30

# Cook at 175°C for 45 minutes
python3 scripts/anova.py cook --temp 175 --unit C --duration 45
```

### 高级控制

**自定义元件：**
```bash
# Rear element only (low-temp slow cook)
python3 scripts/anova.py cook --temp 225 --elements rear --duration 180

# Bottom + rear (standard roasting)
python3 scripts/anova.py cook --temp 375 --elements bottom,rear --duration 45

# All elements (maximum heat)
python3 scripts/anova.py cook --temp 450 --elements top,bottom,rear --duration 20
```

**自定义风扇转速：**
```bash
# Low fan (gentle cooking)
python3 scripts/anova.py cook --temp 250 --fan-speed 25 --duration 120

# High fan (fast heat circulation)
python3 scripts/anova.py cook --temp 400 --fan-speed 100 --duration 30
```

**探针烹饪：**
```bash
# Cook to internal temperature (not time-based)
python3 scripts/anova.py cook --temp 350 --probe-temp 165

# Low-temp probe cook
python3 scripts/anova.py cook --temp 225 --elements rear --fan-speed 25 --probe-temp 135
```

**组合高级设置：**
```bash
# Precision low-temp cook
python3 scripts/anova.py cook --temp 225 --elements rear --fan-speed 25 --duration 180

# High-heat sear
python3 scripts/anova.py cook --temp 500 --elements top,bottom,rear --fan-speed 100 --duration 5
```

### 停止烹饪
```bash
python3 scripts/anova.py stop
```

### 监控（实时流）  
```bash
python3 scripts/anova.py monitor --monitor-duration 60
```

## 自然语言示例

**Agent 提示语：**
- “将烤箱预热至 375°F，用于烘烤”
- “以 135°F 启动低温慢煮，持续 2 小时”
- “当前烤箱温度是多少？”
- “停止烹饪”
- “在 212°F 下蒸蔬菜 15 分钟”

## 功能特性

### Anova 精密烤箱（APO）
- 低温慢煮烹饪（湿球模式）
- 烘烤（干球模式）
- 蒸煮烹饪（支持湿度控制）
- 温度控制（摄氏/华氏）
- 实时状态监控
- 遥测数据导出

### Anova 精密料理棒（APC）
- 低温慢煮烹饪
- 温度控制
- 计时器管理
- 实时状态

## API 参考

**WebSocket 终端地址：** 通过 Anova 云服务提供  
**认证方式：** 个人访问令牌（Bearer token）  
**协议：** 基于 JSON 消息的 WebSocket  

## 配置

**令牌文件：** `~/.config/anova/token`  
**默认设备：** 自动选取首个发现的设备（或通过 `--device-id` 显式指定）

## 故障排除

**“未找到令牌”：**  
```bash
echo "anova-YOUR_TOKEN" > ~/.config/anova/token
```

**“未找到设备”：**  
- 在 Anova 应用中确认设备处于在线状态  
- 验证 WiFi 连接  
- 生成新令牌  

**“连接失败”：**  
- 检查互联网连接  
- 验证令牌是否有效  
- 确保设备已与账户完成配对  

## 安全注意事项

- 启动长时间烹饪前，请务必核实目标温度  
- 使用计时器防止过度烹饪  
- 支持远程监控，但出于安全考虑仍需现场检查  
- 默认超时限制：最长 4 小时  

## 参考资料

- [Anova 开发者门户](https://developer.anovaculinary.com)  
- [GitHub：anova-wifi-device-controller](https://github.com/anova-culinary/developer-project-wifi)