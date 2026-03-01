---
name: roborock
name_zh: RoboRock
description: 控制 Roborock 扫地机器人（状态查询、启动清扫、地图管理、耗材监控）。当用户要求执行清扫、检查扫地机器人状态、控制机器人或管理清扫计划时使用。在出现 vacuum（吸尘）、roborock（Roborock）、clean floor（清洁地面）、hoover（吸尘器）、robot cleaner（机器人清洁器）等关键词时触发。
description_zh: 控制 Roborock 扫地机器人（状态查询、启动清扫、地图管理、耗材监控）。当用户要求执行清扫、检查扫地机器人状态、控制机器人或管理清扫计划时使用。在出现 vacuum（吸尘）、roborock（Roborock）、clean floor（清洁地面）、hoover（吸尘器）、robot cleaner（机器人清洁器）等关键词时触发。
metadata: {"clawdbot":{"emoji":"🧹","requires":{"bins":["roborock"]},"install":[{"id":"pipx","kind":"uv","package":"python-roborock","bins":["roborock"],"label":"安装 roborock CLI（pipx）"}]}}
---
# Roborock 扫地机器人控制

通过 `roborock` CLI 控制 Roborock 扫地机器人。

## 首次设置

### 1. 安装 CLI
```bash
pipx install python-roborock
```

### 2. 登录 Roborock 账户
```bash
roborock login
```
输入您在 Roborock/Xiaomi Home App 中注册的邮箱和密码。

### 3. 查找您的设备 ID
```bash
roborock list-devices
```
记下您的设备 ID（格式类似 `AbCdEf123456789XyZ`）。

### 4. 保存设备 ID（可选）
添加至您的 TOOLS.md 文件中以便快速查阅：
```markdown
## Roborock Vacuum
- **Device ID:** your-device-id-here
- **Model:** Roborock S7 Max Ultra (or your model)
```

## 快速命令

所有命令均需指定 `--device_id "YOUR_DEVICE_ID"` —— 请将其替换为您实际的设备 ID。

### 检查状态
```bash
roborock status --device_id "YOUR_DEVICE_ID"
```

### 启动清扫
```bash
roborock command --device_id "YOUR_DEVICE_ID" start
```

### 停止/暂停
```bash
roborock command --device_id "YOUR_DEVICE_ID" stop
roborock command --device_id "YOUR_DEVICE_ID" pause
```

### 返回充电座
```bash
roborock command --device_id "YOUR_DEVICE_ID" home
```

### 清洁指定房间
首先获取房间 ID：
```bash
roborock rooms --device_id "YOUR_DEVICE_ID"
```
然后清洁特定房间：
```bash
roborock command --device_id "YOUR_DEVICE_ID" segment_clean --rooms 16,17
```

## 维护命令

### 检查耗材寿命
```bash
roborock consumables --device_id "YOUR_DEVICE_ID"
```
显示滤网、主刷、边刷及传感器的剩余使用寿命。

### 重置耗材计数
```bash
roborock reset-consumable filter --device_id "YOUR_DEVICE_ID"
roborock reset-consumable main_brush --device_id "YOUR_DEVICE_ID"
roborock reset-consumable side_brush --device_id "YOUR_DEVICE_ID"
```

### 上次清扫记录
```bash
roborock clean-record --device_id "YOUR_DEVICE_ID"
```

### 清洁汇总（历史全部数据）
```bash
roborock clean-summary --device_id "YOUR_DEVICE_ID"
```

## 地图与房间

### 获取地图列表
```bash
roborock maps --device_id "YOUR_DEVICE_ID"
```

### 缓存家庭布局
```bash
roborock home
```

### 保存地图图像
```bash
roborock map-image --device_id "YOUR_DEVICE_ID" --output /tmp/vacuum-map.png
```

### 房间功能
```bash
roborock features --device_id "YOUR_DEVICE_ID"
```

## 设置

### 音量
```bash
roborock volume --device_id "YOUR_DEVICE_ID"
roborock set-volume 50 --device_id "YOUR_DEVICE_ID"
```

### 勿扰模式
```bash
roborock dnd --device_id "YOUR_DEVICE_ID"
```

### LED 状态指示灯
```bash
roborock led-status --device_id "YOUR_DEVICE_ID"
```

### 儿童锁
```bash
roborock child-lock --device_id "YOUR_DEVICE_ID"
```

## 交互式会话
如需连续执行多条命令且避免重复输入设备 ID：
```bash
roborock session --device_id "YOUR_DEVICE_ID"
```

## 故障排查

**命令静默失败：**
1. 检查登录状态：`roborock login`
2. 启用调试模式：`roborock -d status --device_id "YOUR_DEVICE_ID"`
3. 确保扫地机器人已开机并连接到 Wi-Fi 网络

**“未找到设备”：**
- 运行 `roborock list-devices` 验证设备 ID 是否正确
- 确认您已登录正确的 Roborock 账户

**“认证失败”：**
- 重新运行 `roborock login`
- 确认您使用的账户与 Xiaomi Home / Roborock App 中一致

## 常见任务

**“打扫整个房子”：**
```bash
roborock command --device_id "YOUR_DEVICE_ID" start
```

**“打扫厨房”：**
```bash
roborock rooms --device_id "YOUR_DEVICE_ID"  # find kitchen room ID
roborock command --device_id "YOUR_DEVICE_ID" segment_clean --rooms <kitchen_id>
```

**“扫地机器人清扫完了吗？”：**
```bash
roborock status --device_id "YOUR_DEVICE_ID"
```

**“让扫地机器人回充”：**
```bash
roborock command --device_id "YOUR_DEVICE_ID" home
```

**“它上次是什么时候清扫的？”：**
```bash
roborock clean-record --device_id "YOUR_DEVICE_ID"
```

**“检查主刷/滤网寿命”：**
```bash
roborock consumables --device_id "YOUR_DEVICE_ID"
```

## 支持的机型

适用于大多数 Roborock 扫地机器人，包括：
- Roborock S 系列（S4、S5、S6、S7、S8）
- Roborock Q 系列（Q5、Q7、Q8）
- Roborock E 系列
- 小米米家扫地机器人（基于 Roborock 平台）

## 致谢

本工具基于 [python-roborock](https://github.com/humbertogontijo/python-roborock) 库开发。