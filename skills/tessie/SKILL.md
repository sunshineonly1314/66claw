---
name: tessie
description: 通过 Tessie API 控制您的 Tesla 车辆 —— 一个拥有 50 万+ 用户的 Tesla 管理平台。
description_zh: 通过 Tessie API 控制您的 Tesla 车辆 —— 一个拥有 50 万+ 用户的 Tesla 管理平台。
---
# Tessie Skill

通过 Tessie API 控制您的 Tesla 车辆 —— 一个拥有 50 万+ 用户的 Tesla 管理平台。

## 设置

获取您的 Tessie API 凭据：
1. 访问 https://tessie.com/developers  
2. 注册并创建 API 密钥  
3. 在 Clawdbot 中配置：

```yaml
skills:
  entries:
    tessie:
      apiKey: "your-tessie-api-key-here"
```

或通过环境变量配置：
```bash
export TESSIE_API_KEY="your-tessie-api-key-here"
```

**注意**：车辆 ID 与 VIN 将自动从 API 检测，无需手动配置。

## 功能

### 车辆状态
- **电量水平**：当前剩余电量百分比  
- **续航里程**：预估行驶里程  
- **位置**：车辆当前坐标  
- **车辆状态**：车门锁/解锁、充电状态、休眠模式  
- **连接状态**：车辆在线/离线？

### 空调控制
- **启动/停止**：开启或关闭空调  
- **预热/预冷**：设定座舱温度（自动识别华氏/摄氏）  
- **除霜**：为车窗/后视镜除霜  

### 充电
- **启动/停止**：远程控制充电  
- **充电上限**：设定日常/标准充电上限  
- **充电状态**：当前充电速率、完成所需时间、电量水平  

### 行驶记录
- **近期行程**：最近几次出行的距离、能耗、起止位置  

## 使用示例

```
# Check battery and range
"tessie battery"
"tessie how much charge"
"tessie range"

# Preheat the car (assumes Fahrenheit if > 50)
"tessie preheat 72"
"tessie precool"
"tessie turn on climate"

# Check drives
"tessie show my drives"
"tessie recent drives"
"tessie drives 5"

# Charging commands
"tessie start charging"
"tessie stop charging"
"tessie set charge limit to 90%"
"tessie charging status"

# Vehicle location
"tessie where is my car"
"tessie location"

# Vehicle state
"tessie is the car locked?"
"tessie vehicle status"
```

## API 端点（Tessie）

### 认证
所有请求均需包含：
```
Authorization: Bearer <api-key>
```

### 获取车辆列表
```
GET https://api.tessie.com/vehicles
```
返回完整车辆列表，其中嵌入 `last_state`

### 获取行程记录
```
GET https://api.tessie.com/{VIN}/drives?limit=10
```
返回近期行程历史

### 获取驻车记录
```
GET https://api.tessie.com/{VIN}/idles?limit=10
```
返回停车会话（含空调与哨兵模式使用情况）

### 指令
所有控制指令均使用 VIN（而非 vehicle_id）：
```
POST https://api.tessie.com/{VIN}/command/{command}
```

**可用指令**：  
- `start_climate`、`stop_climate`、`set_temperatures`  
- `start_charging`、`stop_charging`、`set_charge_limit`  
- `lock`、`unlock`、`enable_sentry`、`disable_sentry`  
- `activate_front_trunk`、`activate_rear_trunk`  
- `open_windows`、`close_windows`、`vent_windows`  

完整列表：参见 https://developer.tessie.com

## 注意事项

- Tessie 充当您与 Tesla API 之间的中间层  
- 提供比原始 Tesla API 更丰富的数据与分析能力  
- 需先将 Tesla 账户绑定至 Tessie  
- API 指令使用 VIN（自动检测）  
- 所有温度内部统一使用摄氏度  
- **尚未部署** —— 已准备就绪，待用户审核后部署  