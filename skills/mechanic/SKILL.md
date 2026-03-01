---
name: mechanic  
name_zh: 机械师
description: "车辆保养追踪器与机械师顾问。追踪里程数、保养周期、燃油经济性、费用、保修期及召回信息。研究厂商推荐的保养计划，估算费用，预测下次保养日期，记录服务商，并主动提醒即将到期或已逾期的保养项目。支持 VIN 解码与车辆规格自动填充、NHTSA 召回监控、MPG 追踪与异常检测、保修到期提醒、出行前/季节性检查清单、里程预测、服务商历史记录、税务抵扣集成、紧急信息卡片，以及每英里成本分析。适用于讨论车辆保养、换机油、保养周期、里程追踪、燃油经济性、保修、召回、房车（RV）保养、车顶密封、发电机保养、伸缩舱（slide-outs）、冬季化处理（winterization），或任何与 mechanic 相关的主题。支持所有车型，包括卡车、轿车、摩托车、越野摩托（dirt bikes）、全地形车（ATVs）、房车（RVs）和船只。"  
description_zh: 车辆保养追踪器与机械师顾问。追踪里程数、保养周期、燃油经济性、费用、保修期及召回信息。研究厂商推荐的保养计划，估算费用，预测下次保养日期，记录服务商，并主动提醒即将到期或已逾期的保养项目。支持 VIN 解码与车辆规格自动填充、NHTSA 召回监控、MPG 追踪与异常检测、保修到期提醒、出行前/季节性检查清单、里程预测、服务商历史记录、税务抵扣集成、紧急信息卡片，以及每英里成本分析。适用于讨论车辆保养、换机油、保养周期、里程追踪、燃油经济性、保修、召回、房车（RV）保养、车顶密封、发电机保养、伸缩舱（slide-outs）、冬季化处理（winterization），或任何与 mechanic 相关的主题。支持所有车型，包括卡车、轿车、摩托车、越野摩托（dirt bikes）、全地形车（ATVs）、房车（RVs）和船只。
homepage: https://github.com/ScotTFO/mechanic-skill  
metadata: {"clawdbot":{"emoji":"🔧"}}  
---
# Mechanic — 车辆保养追踪器  

可追踪任意组合车辆的里程数与保养周期——包括卡车、轿车、摩托车、房车（RV）、越野摩托（dirt bikes）、全地形车（ATVs）、船只等。通过解码 VIN 自动填充车辆规格；研究厂商推荐的保养计划；追踪保养历史；估算费用；监控召回；追踪燃油经济性；管理保修；并主动提醒即将到期或已逾期的保养项目。

## 数据存储  

所有用户数据均存于 `<workspace>/data/mechanic/`：  

| 文件 | 用途 |  
|------|------|  
| `state.json` | 所有车辆：当前里程数/小时数、历史记录、保养记录、加油日志、保修信息、服务商、紧急信息 |  
| `<key>-schedule.json` | 每辆车的保养计划，含周期与费用估算 |  

**约定：** skill 逻辑代码存放于 `<skill>/`，用户数据存放于 `<workspace>/data/mechanic/`。此设计确保在 skill 更新或重装时数据安全无损。

## 首次设置  

若 `<workspace>/data/mechanic/state.json` 不存在：  
1. 创建 `<workspace>/data/mechanic/` 目录  
2. 向用户询问希望追踪的车辆类型  
3. 对每辆车，执行 **添加新车辆** 流程（含为每辆车选择里程上报频率）  
4. 创建 `state.json` 并填入车辆条目  
5. 配置 cron 任务（参见 **里程检查设置**）

### 状态文件结构  
```json
{
  "settings": {
    "check_in_tz": "America/Phoenix"
  },
  "providers": [
    {
      "id": "jims_diesel",
      "name": "Jim's Diesel Repair",
      "location": "123 Main St, Mesa, AZ",
      "phone": "480-555-1234",
      "specialties": ["diesel", "trucks"],
      "rating": 5,
      "notes": "Great with Power Stroke engines"
    }
  ],
  "vehicles": {
    "f350": {
      "label": "2021 Ford F-350 6.7L Power Stroke",
      "schedule_file": "f350-schedule.json",
      "check_in_frequency": "monthly",
      "current_miles": 61450,
      "last_updated": "2026-01-26",
      "last_check_in": "2026-01-26",
      "vin": "1FT8W3BT0MED12345",
      "vin_data": {
        "decoded": true,
        "decoded_date": "2026-01-26",
        "year": 2021,
        "make": "Ford",
        "model": "F-350",
        "trim": "Lariat",
        "body_class": "Pickup",
        "drive_type": "4WD",
        "engine": "6.7L Power Stroke V8 Turbo Diesel",
        "displacement_l": 6.7,
        "cylinders": 8,
        "fuel_type": "Diesel",
        "transmission": "10-Speed Automatic",
        "doors": 4,
        "gvwr_class": "Class 3",
        "bed_length": "8 ft",
        "wheel_base": "176 in",
        "plant_country": "United States",
        "plant_city": "Louisville",
        "raw_response": {}
      },
      "business_use": false,
      "business_use_percent": 0,
      "mileage_history": [
        {"date": "2026-01-26", "miles": 61450, "source": "user_reported"}
      ],
      "service_history": [
        {
          "service_id": "oil_filter",
          "date": "2025-11-15",
          "miles": 58000,
          "hours": null,
          "notes": "Full synthetic Motorcraft FL-2051S",
          "actual_cost": 125.00,
          "provider": {
            "id": "jims_diesel",
            "name": "Jim's Diesel Repair",
            "parts_warranty_months": 12,
            "labor_warranty_months": 6
          }
        }
      ],
      "fuel_history": [
        {
          "date": "2026-01-20",
          "gallons": 32.5,
          "cost": 108.55,
          "odometer": 61300,
          "mpg": 14.2,
          "notes": "Regular fill-up"
        }
      ],
      "warranties": [
        {
          "type": "factory_powertrain",
          "provider": "Ford",
          "start_date": "2021-03-15",
          "end_date": "2026-03-15",
          "start_miles": 0,
          "end_miles": 60000,
          "coverage_details": "Engine, transmission, drivetrain components",
          "status": "active"
        }
      ],
      "recalls": {
        "last_checked": "2026-01-26",
        "open_recalls": [],
        "completed_recalls": []
      },
      "emergency_info": {
        "vin": "1FT8W3BT0MED12345",
        "insurance_provider": "State Farm",
        "policy_number": "SF-123456789",
        "roadside_assistance_phone": "1-800-555-1234",
        "tire_size_front": "275/70R18",
        "tire_size_rear": "275/70R18",
        "tire_pressure_front_psi": 65,
        "tire_pressure_rear_psi": 80,
        "oil_type": "15W-40 CK-4 Full Synthetic",
        "oil_capacity": "15 quarts",
        "coolant_type": "Motorcraft Orange VC-3DIL-B",
        "def_type": "API certified DEF",
        "tow_rating_lbs": 20000,
        "gvwr_lbs": 14000,
        "gcwr_lbs": 37000,
        "key_fob_battery": "CR2450",
        "fuel_type": "Diesel (Ultra Low Sulfur)",
        "fuel_tank_gallons": 48,
        "notes": ""
      }
    }
  },
  "last_service_review": "2026-01-26"
}
```  

**顶层字段：**  
- `settings` — 全局设置（如时区等）  
- `providers` — 可复用的服务商列表  
- `vehicles` — 以简短 slug 为键（例如 `f350`、`rv`、`crf450`）  
- `last_service_review` — 上一次全面审查的日期  

**每辆车的字段：**  
- `label` — 人类可读的车辆名称  
- `schedule_file` — 保养计划 JSON 文件路径  
- `check_in_frequency` — 询问里程数/小时数的频率（每周/双周/每月/每季度）  
- `current_miles` / `current_hours` — 最近已知读数  
- `last_updated` / `last_check_in` — 时间追踪字段  
- `vin` — 车辆识别号码（VIN）（用于召回查询、VIN 解码及紧急信息）  
- `vin_data` — 来自 NHTSA VPIC API 的解码 VIN 数据（规格、发动机、变速箱等）  
- `business_use` — 是否用于商业用途（布尔值）  
- `business_use_percent` — 商业用途占比（0–100）  
- `mileage_history` — 按时间顺序排列的里程数/小时数记录数组  
- `service_history` — 按时间顺序排列的已完成保养记录数组（可选含 `actual_cost` 和 `provider`）  
- `fuel_history` — 按时间顺序排列的加油记录数组  
- `warranties` — 保修记录数组  
- `recalls` — 召回监控状态（最后检查时间、未完成/已完成）  
- `emergency_info` — 快速参考的车辆规格与紧急联系人  

## 读取状态  

skill 加载时，读取：  
1. `<workspace>/data/mechanic/state.json` — 所有车辆的当前状态  
2. 根据当前对话内容，读取对应的 `<key>-schedule.json` 文件（一个或多个）  

## 添加新车辆  

当用户希望追踪一辆新车时：  

### 1. 收集车辆信息  
**优先询问 VIN。** 若用户提供 VIN，则运行 **VIN 解码**（见下文），自动填充年份、品牌、型号、发动机、变速箱、驱动形式及其他规格。此举可避免向用户重复提问本可通过自动查询获取的信息。  

需询问以下内容：  
- **VIN**（强烈推荐——可自动填充规格，启用召回监控与紧急信息）  
- **年份、品牌、型号**（仅在未提供 VIN 时询问）  
- **发动机/配置等级（trim）**（仅在无 VIN 或 VIN 解码不完整时询问）  
- **使用模式** — 日常通勤、拖曳、越野、周末玩乐等  
- **当前里程数/小时数**  
- **是否用于商业用途？** — 若是，占比多少？（启用税务抵扣追踪）  
- **保修信息** — 是否存在有效原厂或延保？到期日期/里程数？  
- **紧急信息** — 保险公司、道路救援电话、轮胎尺寸（可后续补充）  

若用户暂无 VIN，可继续手动录入信息，并注明：VIN 可稍后补填，以解锁自动填充与召回监控功能。

### 2. 确定使用强度等级（Duty Level）  
通过询问使用场景，对保养计划进行分类：  

| 使用场景 | 强度等级 | 影响 |  
|----------|-----------|------|  
| 日常通勤 | Normal | 标准周期 |  
| 拖曳、载重 | Severe | 周期缩短（通常为标准周期的 50–75%） |  
| 越野、多尘环境 | Severe | 周期缩短，滤清器更换更频繁 |  
| 极端温度（炎热沙漠、严寒） | Severe | 周期缩短，关注油液与电瓶状况 |  
| 赛道/竞速 | Severe+ | 高频次保养，专用油液 |  
| 轻度使用、车库停放 | Normal | 标准周期，但需留意按时间触发的项目 |  

多数厂商同时发布“常规”与“严苛/特殊工况”两种保养计划，请选用匹配实际使用场景的版本。

### 3. 选择上报频率  
询问用户希望多久被提醒一次该车的里程数/小时数：  

| 频率 | 适用场景 |  
|------|----------|  
| **每周** | 越野摩托、赛车、商用/车队车辆、高里程日常用车 |  
| **每两周** | 活跃骑行/驾驶者、保养周期较短的车辆 |  
| **每月** | 大多数轿车与卡车（推荐默认值） |  
| **每季度** | 季节性车辆、低里程车辆、“车库珍藏款”、封存船只 |  

根据车辆类型与使用模式建议频率，但允许用户覆盖。

### 4. 研究保养计划  
**查找该年份/品牌/型号/发动机对应厂商推荐的保养周期：**  
- 通过网络搜索获取官方保养计划  
- 查阅车主手册中的保养周期  
- 参考爱好者论坛获取真实世界经验建议  
- 结合第 2 步确定的使用强度等级进行调整  

### 5. 构建保养计划文件  
创建 `<workspace>/data/mechanic/<key>-schedule.json`：  

```json
{
  "vehicle": {
    "year": 2021,
    "make": "Ford",
    "model": "F-350",
    "type": "truck",
    "engine": "6.7L Power Stroke V8 Turbo Diesel",
    "transmission": "10R140 10-Speed Automatic",
    "duty": "severe",
    "notes": "Tows fifth wheel RV"
  },
  "services": [
    {
      "id": "oil_filter",
      "name": "Engine Oil & Filter Change",
      "interval_miles": 7500,
      "interval_months": 6,
      "details": "Specific oil type, filter part number, capacity, and any special instructions.",
      "priority": "critical",
      "cost_diy": "$XX-XX",
      "cost_shop": "$XX-XX",
      "cost_dealer": "$XX-XX",
      "cost_note": "Optional note about related expensive repairs"
    }
  ]
}
```  

**每个保养项目必需字段：**  
- `id` — 唯一 snake_case 标识符  
- `name` — 人类可读名称  
- 至少一项周期设定：`interval_miles`、`interval_months`、`interval_hours` 或 `interval_rides`  
- `details` — 具体部件、油液、容量及任何警告  
- `priority` — `critical`、`high`、`medium` 或 `low`  
- `cost_diy`、`cost_shop`、`cost_dealer` — 估算费用区间  

**费用调研：**  
- 搜索该特定车型各项保养的典型费用  
- DIY = 仅零件成本  
- Shop = 独立维修厂  
- Dealer = 厂商授权经销商  
- 对故障/维修成本远高于预防性保养的项目，添加 `cost_note`  

### 6. 添加至状态文件  
将车辆添加至 `state.json` 中的 `vehicles` 对象下：  

```json
{
  "<key>": {
    "label": "2021 Ford F-350 6.7L Power Stroke",
    "schedule_file": "<key>-schedule.json",
    "check_in_frequency": "monthly",
    "current_miles": 61450,
    "current_hours": null,
    "last_updated": "2026-01-26",
    "last_check_in": "2026-01-26",
    "vin": null,
    "vin_data": {
      "decoded": false
    },
    "business_use": false,
    "business_use_percent": 0,
    "mileage_history": [
      {"date": "2026-01-26", "miles": 61450, "source": "user_reported"}
    ],
    "service_history": [],
    "fuel_history": [],
    "warranties": [],
    "recalls": {
      "last_checked": null,
      "open_recalls": [],
      "completed_recalls": []
    },
    "emergency_info": {
      "vin": null,
      "insurance_provider": null,
      "policy_number": null,
      "roadside_assistance_phone": null,
      "tire_size_front": null,
      "tire_size_rear": null,
      "tire_pressure_front_psi": null,
      "tire_pressure_rear_psi": null,
      "oil_type": null,
      "oil_capacity": null,
      "coolant_type": null,
      "tow_rating_lbs": null,
      "gvwr_lbs": null,
      "key_fob_battery": null,
      "fuel_type": null,
      "fuel_tank_gallons": null,
      "notes": ""
    }
  }
}
```  

**键名规范：** 使用简短易记的 slug — 如 `f350`、`civic`、`r1`、`rv`、`crf450`、`harley`、`bass_boat` 等。

### 7. 更新 Cron 任务  
更新 cron 任务提示，纳入新车。若该车频率高于当前 cron 设置，则将 cron 更新为更高频次。

### 8. VIN 解码与自动填充  
若已提供 VIN，则运行 **VIN 解码**，自动填充车辆规格、紧急信息字段及计划文件中的车辆信息部分。向用户展示解码结果以供确认。

### 9. 执行首次召回检查  
若已提供 VIN，则立即检查是否存在未完成召回（参见 **NHTSA 召回监控**）。若无 VIN，则按品牌/型号/年份查询。

## 车型与特殊注意事项  

| 类型 | 追踪单位 | 关键保养项目 |  
|------|-----------|----------------------|  
| **轿车（Car）** | 英里数 | 机油、滤清器、刹车、轮胎、变速箱、冷却液 |  
| **卡车（Truck）** | 英里数 | 同轿车 + 差速器油、分动箱（四驱）、拖曳导致的刹车磨损加剧 |  
| **摩托车（Motorcycle）** | 英里数 | 机油、链条/链轮、气门间隙、前叉油、刹车油、冷却液（水冷式）、轮胎（磨损更快） |  
| **越野摩托（Dirt Bike）** | 小时数 + 骑行次数 | 空气滤清器（每次骑行！）、机油（极频繁）、气门间隙、悬挂保养、链条、冷却液 |  
| **全地形车/多功能车（ATV/UTV）** | 小时数 + 英里数 | 类似越野摩托 + CV 关节防尘罩、传动带（CVT）、绞盘保养 |  
| **房车/拖车（RV/Trailer）** | 英里数 + 月数 | 车顶/密封胶检查、伸缩舱（slide-outs）、轮毂轴承、电刹、轮胎（按年限更换）、供水系统、发电机、冬季化处理 |  
| **船只（Boat）** | 小时数 | 机油、水泵叶轮、下部单元油、锌块/阳极、冬季化处理、拖车轴承 |  
| **第五轮拖车/拖车（Fifth Wheel/Trailer）** | 英里数 + 月数 | 无发动机，但需关注：轴承、刹车、轮胎、车顶、密封件、伸缩舱、管道系统、液化石油气（LP gas）、季节性准备 |  

### 周期类型  
保养项目可组合使用以下任意类型：  
- `interval_miles` — 基于里程表读数  
- `interval_hours` — 基于发动机/使用小时数（发电机、越野摩托、船只）  
- `interval_months` — 基于时间（所有物品随时间老化）  
- `interval_rides` — 按使用次数（例如越野摩托空气滤清器 = 每次骑行）  

**任一周期最先达到即触发保养。**  

---  

## VIN 解码与自动填充  

当用户在车辆设置期间或之后提供 VIN 时，使用免费的 NHTSA VPIC API 解码，自动查询并存储车辆规格。

### NHTSA VPIC API（VIN 解码器）  

**端点：** `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json`  

无需 API 密钥，免费且无调用限制。  

**示例：**  
```
GET https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1FT8W3BT0MED12345?format=json
```  

### 需提取的关键字段  

API 返回一个 `Results` 数组，其中单个对象包含约 140+ 字段。提取并映射如下：  

| VPIC 字段 | 映射至 | 说明 |  
|------------|---------|------|  
| `ModelYear` | `vin_data.year` | 车辆年份 |  
| `Make` | `vin_data.make` | 制造商 |  
| `Model` | `vin_data.model` | 车型名称 |  
| `Trim` | `vin_data.trim` | 配置等级（如 Lariat、XLT 等） |  
| `BodyClass` | `vin_data.body_class` | 车型类别（皮卡、SUV、摩托车等） |  
| `DriveType` | `vin_data.drive_type` | 驱动形式（4WD、AWD、RWD、FWD） |  
| `DisplacementL` | `vin_data.displacement_l` | 发动机排量（升） |  
| `EngineCylinders` | `vin_data.cylinders` | 气缸数 |  
| `FuelTypePrimary` | `vin_data.fuel_type` | 燃料类型（汽油、柴油、电动等） |  
| `EngineModel` | `vin_data.engine` | 结合排量生成标签 |  
| `TransmissionStyle` | `vin_data.transmission` | 变速箱类型（自动、手动、CVT） |  
| `TransmissionSpeeds` | （追加至变速箱字段） | “10 速自动变速箱” |  
| `Doors` | `vin_data.doors` | 车门数 |  
| `GVWR` | `vin_data.gvwr_class` | 总质量等级（GVWR class） |  
| `WheelBaseShort` | `vin_data.wheel_base` | 轴距（英寸） |  
| `BedLengthIN` | `vin_data.bed_length` | 货厢长度（如适用） |  
| `PlantCountry` | `vin_data.plant_country` | 组装国 |  
| `PlantCity` | `vin_data.plant_city` | 组装城市 |  

**注意：** 许多字段在不适用时返回空字符串 `""`。仅存储非空值。

### VIN 数据存储  

将解码数据存入车辆的 `vin_data` 对象中（位于 `state.json`）：  

```json
{
  "vin_data": {
    "decoded": true,
    "decoded_date": "2026-01-27",
    "year": 2021,
    "make": "Ford",
    "model": "F-350",
    "trim": "Lariat",
    "body_class": "Pickup",
    "drive_type": "4WD",
    "engine": "6.7L Power Stroke V8 Turbo Diesel",
    "displacement_l": 6.7,
    "cylinders": 8,
    "fuel_type": "Diesel",
    "transmission": "10-Speed Automatic",
    "doors": 4,
    "gvwr_class": "Class 3",
    "bed_length": "8 ft",
    "wheel_base": "176 in",
    "plant_country": "United States",
    "plant_city": "Louisville",
    "raw_response": {}
  }
}
```  

将 `raw_response` 存为完整的 VPIC 返回对象以供参考——其中包含更多未来可能有用字段（如 `AirBagLocFront`、`SeatBeltsAll`、`TPMS`、`ActiveSafetySysNote` 等）。  

若 `vin_data.decoded` 为 `false` 或缺失，则表示 VIN 尚未解码。

### 自动填充流程  

VIN 解码完成后：  
1. **更新 `vin_data`** — 存储全部解码字段  
2. **更新 `label`** — 基于解码所得年份/品牌/型号/发动机构建（例如：“2021 年福特 F-350 6.7L Power Stroke”）  
3. **更新 `emergency_info`** — 自动填充可推导字段：  
   - `fuel_type` 来自 `FuelTypePrimary`  
   - `gvwr_lbs` 来自 `GVWR`（解析重量等级以估算磅数）  
4. **更新计划文件** — 在 `vehicle` 区域填充解码所得规格  
5. **向用户展示** — 显示已解码内容，确认准确性，并询问 VIN 无法提供的信息（如使用模式、强度等级、保险等）

### 触发解码时机  

| 触发条件 | 操作 |  
|----------|------|  
| 新增车辆时提供 VIN | 立即解码并自动填充 |  
| 用户为现有车辆提供 VIN | 解码并回填 `vin_data` 及任何空字段 |  
| 用户说“查一下我的 VIN” | 解码并显示规格 |  
| 用户修改/更正 VIN | 重新解码并更新 |  

### 后续补填 VIN  

若车辆最初添加时未提供 VIN，而用户后续补填：  
1. 解码 VIN  
2. 存入 `vin_data`  
3. 更新 `vin` 字段  
4. 回填任何空的 `emergency_info` 字段  
5. 若解码信息更精确，则更新 `label`  
6. 使用新 VIN 立即执行召回检查  
7. 确认已更新内容  

### VIN 解码展示格式  

向用户展示解码后的 VIN 数据时：  
```
🔍 VIN Decoded — [VIN]
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Vehicle
Year: [year] | Make: [make] | Model: [model]
Trim: [trim] | Body: [body_class]
Drive: [drive_type] | Doors: [doors]

🔧 Powertrain
Engine: [engine] ([displacement]L, [cylinders] cyl)
Fuel: [fuel_type]
Transmission: [transmission]

📏 Specs
GVWR: [gvwr_class]
Wheel Base: [wheel_base]
Bed Length: [bed_length] (if truck)

🏭 Built in [plant_city], [plant_country]
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```  

### 局限性  
- **VPIC 数据源自 NHTSA** — 最适合美国市场车辆。进口/海外市场的 VIN 可能数据不全。  
- **拖车与房车** — VIN 解码对拖车、第五轮拖车及房车可能返回有限数据，因其由不同制造商生产，VIN 编码方式各异。  
- **摩托车与动力运动车辆** — 覆盖率不一。日本品牌（本田、雅马哈、川崎、铃木）通常解码良好；小型制造商可能不支持。  
- **1981 年以前车辆** — VIN 于 1981 年才标准化，更早 VIN 无法解码。  
- 若解码返回数据稀疏，则退回手动录入及网络检索规格。

---  

## NHTSA 召回监控  

使用免费的 NHTSA API（无需 API 密钥）监控所有已追踪车辆的未完成召回。

### API 接口  
- **按品牌/型号/年份查询：** `https://api.nhtsa.dot.gov/recalls/recallsByVehicle?make=Ford&model=F-350&modelYear=2021`  
- **按 VIN 查询（更精准）：** `https://api.nhtsa.dot.gov/recalls/recallsByVin?vin=XXXXX`  

若已存储 VIN，优先使用基于 VIN 的查询；否则退回到品牌/型号/年份查询。

### 召回数据存储  
每辆车在 state.json 中：  
```json
{
  "recalls": {
    "last_checked": "2026-01-26",
    "open_recalls": [
      {
        "nhtsa_id": "26V-123",
        "component": "FUEL SYSTEM",
        "summary": "Fuel line may crack under pressure",
        "consequence": "Fuel leak, fire risk",
        "remedy": "Dealer will replace fuel line at no cost",
        "date_reported": "2025-12-01",
        "status": "open"
      }
    ],
    "completed_recalls": [
      {
        "nhtsa_id": "24V-456",
        "component": "ELECTRICAL",
        "summary": "Battery cable may corrode",
        "date_completed": "2025-06-15",
        "notes": "Done at dealer"
      }
    ]
  }
}
```  

### 检查时机  
- **每月 cron 任务：** 在里程检查 cron 中包含召回检查。无论车辆上报频率如何，每月对所有车辆检查一次召回。  
- **新增车辆时：** 新增车辆后立即检查。  
- **按需检查：** 用户询问“我的卡车有召回吗？”  

### 召回报告格式  
在保养审查输出中包含：  
```
⚠️ OPEN RECALLS
- [NHTSA ID] — [Component]: [Summary]
  Remedy: [What the dealer will do]
  ⚡ Contact your dealer to schedule this recall service (free)
```  

当用户报告已完成某项召回时，将其从 `open_recalls` 移至 `completed_recalls`，并记录完成日期。

---  

## 燃油 / MPG 追踪  

记录加油数据，以监控燃油经济性、早期发现机械问题，并跟踪燃油支出。

### 记录一次加油  
当用户说“加满油了”、“加了汽油/柴油”或报告一次加油时：  
1. 记录：**日期**、**加仑数**、**费用**（总额或每加仑单价）、**里程表读数**  
2. 计算 MPG：`(current_odometer - previous_odometer) / gallons`  
3. 追加至该车的 `fuel_history` 数组  
4. 检查 MPG 异常  

### 加油历史条目  
```json
{
  "date": "2026-01-20",
  "gallons": 32.5,
  "cost": 108.55,
  "price_per_gallon": 3.34,
  "odometer": 61300,
  "mpg": 14.2,
  "partial_fill": false,
  "notes": ""
}
```  

### MPG 计算方式  
- **单次加油 MPG：** `(current_odometer - previous_fill_odometer) / gallons`（若上次为非满油则跳过）  
- **滚动平均值：** 最近 10 次加油的平均值（若不足 10 次则取全部）  
- **趋势：** 将最近 3 次加油 MPG 与滚动平均值对比  

### 异常检测  
若某次加油 MPG **低于滚动平均值 15% 以上**，则标记：  
```
⚠️ MPG Alert — [Vehicle]
Last fill-up: 10.5 MPG (your average is 14.2 MPG)
26% below your rolling average — this could indicate:
- Tire pressure issues
- Air filter needs replacement
- Fuel system issue
- Change in driving conditions (heavy towing, headwinds)
- Mechanical problem developing

Check tire pressures first, then review recent driving conditions.
```  

### 燃油报告格式  
当用户询问“我的燃油经济性如何？”或“MPG 报告”时：  
```
⛽ Fuel Report — [Vehicle]
Last fill-up: [X] MPG on [date]
Rolling average: [X] MPG (last 10 fills)
Trend: [improving/stable/declining]
Total fuel cost (YTD): $[X]
Total gallons (YTD): [X]
Average cost per gallon: $[X]
```  

### 非满油情况  
若用户未加满油，标记 `partial_fill: true`。该条目跳过 MPG 计算（数学不准确），但仍记录费用与加仑数。

---  

## 实际费用追踪  

追踪用户实际支付的保养费用，以建立准确的支出记录。

### 记录费用  
当用户登记已完成的保养时：  
1. 确认保养详情后，询问：**“您最终支付了多少？”**（或若用户已主动提供则直接接受）  
2. 存为服务历史条目中的 `actual_cost`  
3. 若用户不知情或不愿分享，留空即可 — 不应阻断记录流程  

### 服务历史条目（含费用）  
```json
{
  "service_id": "oil_filter",
  "date": "2025-11-15",
  "miles": 58000,
  "hours": null,
  "notes": "Full synthetic, Motorcraft filter",
  "actual_cost": 125.00,
  "cost_type": "shop",
  "provider": {
    "id": "jims_diesel",
    "name": "Jim's Diesel Repair"
  }
}
```  

`cost_type` 取值：`diy`、`shop`、`dealer`、`warranty`、`recall`（免费）

### 支出分析  
按需追踪并报告：  
- **按车辆、按年度：** “今年您在 F-350 上已花费 $X”  
- **实际 vs 估算：** 将 `actual_cost` 与计划中的费用估算对比  
- **分类汇总：** 按服务类型分组（换机油、换滤清器、换轮胎等）  
- **历史总计：** 每辆车的总保养支出  

### 年度摘要  
当用户询问或每年年末：  
```
💰 [Year] Maintenance Summary — [Vehicle]
Total spent: $[X]
Services performed: [count]
Biggest expense: [service] — $[X]
Average cost per service: $[X]
vs. Estimated: $[X] ([over/under] by [X]%)
```  

---  

## 保修追踪  

追踪保修信息，以明确保障范围，并在临近到期时发出提醒。

### 保修条目结构  
```json
{
  "type": "factory_powertrain",
  "provider": "Ford",
  "start_date": "2021-03-15",
  "end_date": "2026-03-15",
  "start_miles": 0,
  "end_miles": 60000,
  "coverage_details": "Engine, transmission, transfer case, driveshaft, axle assemblies",
  "status": "active",
  "contact_phone": "1-800-392-3673",
  "claim_number": null,
  "notes": ""
}
```  

### 保修类型  

| 类型 | 典型保障范围 |  
|------|-----------------|  
| `factory_bumper_to_bumper` | 除易损件外全部覆盖，期限最短 |  
| `factory_powertrain` | 发动机、变速箱、传动系统 — 期限更长 |  
| `factory_corrosion` | 车身锈穿 — 通常 5 年以上 |  
| `factory_emissions` | 排放组件 — 法定强制要求主要组件 8 年/8 万英里 |  
| `extended` | 第三方或厂商延保 |  
| `parts_warranty` | 维修厂/经销商提供的特定部件保修（如“新交流发电机，2 年保修”） |  
| `labor_warranty` | 维修厂针对特定维修的工时担保 |  

### 到期提醒  
每次保养审查时检查保修。当满足以下任一条件即提醒：  
- **距离 end_date 不足 3 个月**，或  
- **距离 end_miles 不足 3,000 英里**（以先到者为准）  

提醒格式：  
```
⚠️ WARRANTY EXPIRING SOON
[Vehicle] — [Warranty type] from [Provider]
Expires: [date] or [miles] miles (whichever first)
Remaining: ~[X] months / ~[X] miles
Coverage: [details]
💡 Schedule any warranty-covered concerns before expiration!
```  

### 保修覆盖查询  
当用户询问“这是否在保修范围内？”或标记某项待办保养时：  
1. 检查该车辆所有有效保修  
2. 将服务类型与保修覆盖范围匹配  
3. 若可能覆盖：“此项可能受您的 [保修类型]（来自 [提供商]，到期日 [日期]）保障。请在自费支付前联系他们。”

### 状态值  
- `active` — 当前有效  
- `expiring_soon` — 处于提醒阈值内  
- `expired` — 已超 end_date 或 end_miles  
- `claimed` — 已提交保修索赔  

---  

## 出行前 / 季节性检查清单  

当提及行程或季节变更时，生成车辆专属检查清单。

### 触发短语  
当用户说出以下内容时激活：  
- “我要出发旅行了” / “公路旅行” / “要去[地点]”  
- “这个周末要拖曳” / “把房车拖到[地点]”  
- “准备过冬了” / “该做冬季化处理了”  
- “春天来了” / “该解除冬季化了”  
- “这个周末要越野” / “去越野路线骑行”  

### 清单生成方式  
结合以下要素构建清单：  

1. **已逾期/即将到期的保养** — 从该车的保养审查中提取  
2. **目的地天气** — 若给出地点则查询预报（高温、寒冷、降雨、降雪、海拔）  
3. **行程相关项目** — 基于用户所做事项  
4. **季节性项目** — 基于当前日期与所在地  

### 拖曳检查清单（卡车 + 拖车/房车）  
```
🚛 Pre-Tow Checklist — [Truck] + [Trailer/RV]

TRUCK:
□ Engine oil level
□ Coolant level
□ DEF level (diesel)
□ Tire pressures (loaded spec: front [X] psi, rear [X] psi)
□ Brake controller connected and tested
□ Transmission temp gauge working
□ All lights working
□ Mirrors adjusted for towing

HITCH/CONNECTION:
□ Fifth wheel / gooseneck / ball mount secured
□ Pin box / kingpin locked (verify with tug test)
□ Safety chains crossed under tongue
□ Breakaway cable attached
□ 7-pin connector — test all lights (brake, turn, running, reverse)
□ Breakaway battery charged

TRAILER/RV:
□ Tire pressures (spec: [X] psi) — check age on sidewall
□ Wheel lug torque (spec: [X] ft-lbs)
□ Slides fully retracted and locked
□ Awning secured
□ Fridge set to travel mode (or propane off)
□ All compartments latched
□ Stabilizer jacks fully up
□ Roof vents closed
□ TV antenna down
□ Water heater bypass (if applicable)
□ LP gas tank valve position (check local laws for travel)
□ Cargo secured inside (open fridge, cabinets after arrival)

OVERDUE/DUE SERVICES:
[List any from service review]
```  

### 季节性检查清单  

**冬季前 / 冬季化处理：**  
- 防冻液保护等级（使用比重计测试）  
- 电瓶负载测试（低温使容量降低 30–50%）  
- 雨刷片与玻璃水（耐寒型）  
- 轮胎状况（全季节胎或冬季胎？）  
- 块状加热器工作状态（柴油卡车）  
- 房车：完整冬季化流程（吹干管路、加入房车防冻液、热水器排水、旁通）  
- 船只：发动机冬季化、气缸雾化、燃油稳定剂、排水系统  

**夏季前 / 解除冬季化：**  
- 空调系统检查（在需要前先运行）  
- 冷却液液位与状态  
- 房车：解除冬季化供水系统、消毒水箱、检查空调机组  
- 检查轮胎气压（高温升高气压）  
- 检查皮带与软管（高温加速老化）  

**出行前（通用）：**  
- 所有油液液位  
- 轮胎气压与状况  
- 灯光与信号灯  
- 刹车（目视检查或近期保养记录）  
- 雨刷片  
- 应急包（搭电线、手电筒、急救包）  
- 行驶证与保险是否有效  

---  

## 里程预测  

计算驾驶节奏，并预测未来保养项目的到期时间。

### 计算方式  
需 `mileage_history` 中至少有 **2 个相隔 14 天以上的数据点**。  

```
average_miles_per_month = (latest_miles - earliest_miles) / months_between_readings
```  

使用完整历史数据计算稳定平均值，但若驾驶模式发生显著变化，则对近期数据赋予更高权重。

### 保养日期预测  
对每项保养：  
1. 计算剩余里程：`next_due_miles - current_miles`  
2. 预测月数：`miles_remaining / average_miles_per_month`  
3. 预测日期：`today + projected_months`  
4. 同时独立检查基于时间的周期  

包含在保养审查中：  
```
📅 Projected Service Dates
- Oil Change: ~[Month Year] (at ~[X] miles)
- Fuel Filters: ~[Month Year] (at ~[X] miles)
- Trans Fluid: ~[Month Year] (at ~[X] miles)
```  

### 预算预测  
当用户询问或包含在审查中：  
```
💰 Next 6-Month Budget Forecast — [Vehicle]
At [X] miles/month, expect:
- Oil change (~[Month]): $[X]
- Fuel filters (~[Month]): $[X]
- Cabin air filter (~[Month]): $[X]
Total estimated: $[X]
```  

### 数据不足  
若数据点少于 2 个，或读数间隔过近：  
- 注明：“需更多里程历史才能预测日期 — 下次上报后即可提供”  
- 仍显示基于里程的估算（不含日期）  

---  

## 服务商追踪  

追踪保养服务执行地点，便于快速参考与服务商管理。

### 记录服务商信息  
登记已完成保养时，可选询问：  
- **维修厂名称**（或“同上次一样” / “DIY”）  
- **位置**（城市/地址）  
- **电话号码**  
- **满意度评分**（1–5 分）  
- **零件保修期**（月）  
- **工时保修期**（月）  

勿使其成为负担 — 若用户仅说“刚换了机油”，先登记服务，再随意询问地点。若用户明显不感兴趣则跳过。

### 服务商存储  
服务商信息存于两处：  

1. **全局 `providers` 数组**（位于 state.json 根目录）— 可跨车辆复用：  
```json
{
  "id": "jims_diesel",
  "name": "Jim's Diesel Repair",
  "location": "123 Main St, Mesa, AZ",
  "phone": "480-555-1234",
  "specialties": ["diesel", "trucks"],
  "rating": 5,
  "notes": "Great with Power Stroke engines"
}
```  

2. **每条 service_history 条目中** — 通过 `id` 引用，并可附加服务专属保修：  
```json
{
  "provider": {
    "id": "jims_diesel",
    "name": "Jim's Diesel Repair",
    "parts_warranty_months": 12,
    "labor_warranty_months": 6
  }
}
```  

### 服务商查询  
响应以下问题：  
- “我上次换机油是在哪做的？” → 在 service_history 中搜索最近的 oil_filter 条目，返回服务商  
- “我上次变速箱保养是在哪家店做的？” → 按 service_id 搜索  
- “显示我在 Jim’s 做过的所有保养” → 按 provider.id 过滤 service_history  
- “Jim’s 的电话是多少？” → 在 providers 数组中查找  
- “同上次一样” → 使用最近一条 service_history 条目中的 provider  

---  

## 税务抵扣集成  

对标注为商业用途的车辆，协助追踪可抵扣的保养费用。

### 配置  
每辆车在 state.json 中：  
```json
{
  "business_use": true,
  "business_use_percent": 50
}
```  

若 `business_use` 为 `true` 且未设置百分比，则默认为 100%。

### 抵扣追踪  
当商业用途车辆完成一项含 `actual_cost` 的保养时：  

1. 计算可抵扣部分：`actual_cost × (business_use_percent / 100)`  
2. 向用户说明：  
   ```
   💼 Tax Note: This $450 trans fluid service is 50% business use.
   Deductible amount: $225.00 (vehicle maintenance expense)
   ```  
3. 建议登录 tax-professional skill 记录：  
   ```
   Want me to log this to your tax deductions? 
   → $225.00 as vehicle maintenance expense
   ```  

### 与 tax-professional skill 集成  
若用户确认，则引用 `skills/tax-professional/SKILL.md` 并记录至 `data/tax-professional/YYYY-expenses.json`：  
```json
{
  "date": "2026-01-15",
  "category": "vehicle_maintenance",
  "description": "Trans fluid service — F-350 (50% business use)",
  "amount": 225.00,
  "vehicle": "f350",
  "full_cost": 450.00,
  "business_percent": 50,
  "receipt": false
}
```  

### 年度税务摘要  
按需或报税时：  
```
💼 [Year] Business Vehicle Deductions — [Vehicle]
Total maintenance costs: $[X]
Business use: [X]%
Deductible amount: $[X]
Services included: [count] services
```  

---  

## 紧急信息卡片  

存储并快速检索关键车辆信息，用于路边紧急情况、配件查询或快速参考。

### 紧急信息结构  
每辆车在 state.json 中：  
```json
{
  "emergency_info": {
    "vin": "1FT8W3BT0MED12345",
    "insurance_provider": "State Farm",
    "policy_number": "SF-123456789",
    "roadside_assistance_phone": "1-800-555-1234",
    "tire_size_front": "275/70R18",
    "tire_size_rear": "275/70R18",
    "tire_pressure_front_psi": 65,
    "tire_pressure_rear_psi": 80,
    "oil_type": "15W-40 CK-4 Full Synthetic",
    "oil_capacity": "15 quarts",
    "coolant_type": "Motorcraft Orange VC-3DIL-B",
    "def_type": "API certified DEF",
    "trans_fluid": "Motorcraft Mercon ULV",
    "tow_rating_lbs": 20000,
    "gvwr_lbs": 14000,
    "gcwr_lbs": 37000,
    "payload_lbs": 4300,
    "key_fob_battery": "CR2450",
    "fuel_type": "Diesel (Ultra Low Sulfur)",
    "fuel_tank_gallons": 48,
    "lug_nut_torque_ft_lbs": 165,
    "jack_points": "Frame rails, front and rear",
    "notes": ""
  }
}
```  

### 快速访问查询  
即时响应以下问题：  
- “我的 VIN 是什么？” → 返回 VIN  
- “我的卡车轮胎规格是什么？” → 轮胎尺寸与气压  
- “我的卡车该用什么机油？” → 机油类型与容量  
- “保险信息？” → 提供商、保单号、电话  
- “道路救援电话？” → 电话号码  
- “我的牵引额定值是多少？” → 牵引额定值、总质量（GVWR）、总组合质量（GCWR）  
- “智能钥匙电池型号？” → 电池类型  
- “螺栓扭矩？” → 扭矩规格  

### 紧急卡片格式  
当用户索要“紧急信息”或“车辆卡片”时：  
```
🚨 Emergency Info — [Vehicle Label]
━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIN: [vin]
Insurance: [provider] — Policy #[number]
Roadside: [phone]

🔧 Specs
Tires: F:[size] R:[size]
Pressure: F:[X]psi R:[X]psi
Oil: [type] ([capacity])
Coolant: [type]
Fuel: [type] ([tank] gal)
Key fob battery: [type]

📏 Ratings
Tow: [X] lbs | GVWR: [X] lbs
GCWR: [X] lbs | Payload: [X] lbs
Lug torque: [X] ft-lbs
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```  

### 填充方式  
添加新车时，收集所有可用信息。许多规格可通过年份/品牌/型号检索。允许用户逐步填写个人信息（如保险、道路救援号码）。字段可为空，待后续填充。

---  

## 每英里成本分析  

按每英里计算车辆拥有总成本。

### 计算方式  
需含至少 2 个数据点的里程历史。

```
total_miles_driven = latest_miles - earliest_miles (from mileage_history)

Maintenance cost per mile = total_actual_costs / total_miles_driven
Fuel cost per mile = total_fuel_cost / total_miles_driven
Total operating cost per mile = (total_actual_costs + total_fuel_cost) / total_miles_driven
```  

### 报告格式  
当用户询问“每英里成本”或“运营成本”时：  
```
📊 Cost Per Mile — [Vehicle]
Period: [earliest date] to [latest date] ([X] miles driven)

Maintenance only: $[X.XX]/mile
Fuel only: $[X.XX]/mile (if fuel tracking active)
Total operating: $[X.XX]/mile

💡 National averages (approximate):
Cars: ~$0.10/mi maintenance, ~$0.12/mi fuel
Trucks: ~$0.14/mi maintenance, ~$0.20/mi fuel (diesel)
Heavy-duty diesel (towing): ~$0.18/mi maintenance, ~$0.25/mi fuel
```  

### 车队概览  
若追踪多辆车，则显示对比：  
```
📊 Fleet Cost Per Mile
[Vehicle 1]: $[X.XX]/mi (maintenance) | $[X.XX]/mi (total)
[Vehicle 2]: $[X.XX]/mi (maintenance) | $[X.XX]/mi (total)
Fleet average: $[X.XX]/mi
```  

### 说明  
- 仅包含已记录 `actual_cost` 的服务（跳过空值）  
- 若无燃油数据，则仅显示保养成本  
- 若数据周期过短（<3 个月或 <1,000 英里），则警告：“数据有限 — 随时间推移将更准确”  
- 每英里成本自然随昂贵的一次性服务被摊销至更多英里而下降  

---  

## 里程检查（Cron 触发）  

单个 cron 任务 **每周** 运行（最高频次），依据各车的 `check_in_frequency` 与 `last_check_in` 日期，检查哪些车辆需进行里程上报。同时执行每月召回检查。  

> Prompt: "Mechanic skill: mileage check"  

当该任务触发时：  
1. 读取 `<workspace>/data/mechanic/state.json`  
2. 对每辆车，检查其是否需上报：  
   - 将 `last_check_in` 日期与 `check_in_frequency` 比较  
   - **每周：** 若距上次上报 ≥7 天则需上报  
   - **双周：** 若距上次上报 ≥14 天则需上报  
   - **每月：** 若距上次上报 ≥30 天则需上报  
   - **每季度：** 若距上次上报 ≥90 天则需上报  
3. **每月召回检查：** 若距任一车辆的 `recalls.last_checked` ≥30 天，则从 NHTSA API 获取最新召回信息并更新状态  
4. 若 **无车辆需上报且未发现新召回**，则回复 `HEARTBEAT_OK`（静默跳过）  
5. 若有车辆需上报，则仅向这些车辆询问当前读数  
6. 若发现新召回，即使无车辆需里程上报，也须在消息中包含  
7. 用户响应后，更新状态与 `last_check_in`  
8. 对已更新车辆运行 **保养审查**（含保修提醒、预测、召回）  

### 里程检查设置  

创建一个 **每周** 运行的 cron 任务。其内部将过滤出需上报的车辆。检查 `<workspace>/USER.md` 获取时区。  

**Cron 表达式：** `0 17 * * 0`（用户所在时区每周日 17:00）  

**Cron 任务配置：**  
- **会话：** 隔离，投递至用户聊天频道  
- **提示：** 读取 mechanic skill，从 `data/mechanic/state.json` 加载状态。检查每辆车的 `check_in_frequency` 与 `last_check_in` 以确定哪些需上报。若距上次召回检查 ≥30 天，亦检查召回。若无车辆需上报且无新召回，则回复 HEARTBEAT_OK。否则，仅向需上报车辆询问当前读数，报告任何新召回，然后运行含费用、保修提醒与预测的保养审查。语气需自然友好。  

### 更改上报频率  

用户可随时更改每辆车的频率：  
- “每周检查我的越野摩托” → 更新该车的 `check_in_frequency`  
- “减少对卡车的询问频率” → 改为每季度  
- “将所有车辆改为每月上报” → 更新全部  

更新 `check_in_frequency`（位于 `state.json`）并确认更改。

## 里程数/小时数更新  

当用户在任何上下文中（不仅限于月度）报告里程数或小时数时：  

1. 更新该车的 `current_miles` 和/或 `current_hours`  
2. 将 `last_updated` 设为今日  
3. 追加至 `mileage_history`：  
```json
{"date": "YYYY-MM-DD", "miles": <value>, "source": "user_reported"}
```  
4. 运行 **保养审查**  

## 保养审查  

每次里程数/小时数更新后，分析该车计划文件中的所有保养项目。

### 对每个保养项目：  
1. 从 `service_history` 中查找该项 **上一次执行时间**（按 `service_id` 匹配）  
2. 若从未执行过，假设在 **0 英里 / 0 小时**（购车时）执行  
3. 对照所有适用周期计算：  
   - `miles_since_service` 与 `interval_miles`  
   - `months_since_service` 与 `interval_months`  
   - `hours_since_service` 与 `interval_hours`  
4. 分类：  
   - **🔴 已逾期：** 任一周期已超出  
   - **🟡 即将到期：** 任一周期剩余 ≤15%  
   - **🟢 正常：** 尚未到期  

### 报告格式  

**完整报告（发现问题时）：**  
```
🔧 Vehicle Service Report

━━━ [Vehicle Label] @ [miles] mi ━━━

⚠️ OPEN RECALLS
- [NHTSA ID] — [Component]: [Summary]
  Remedy: [description] (FREE at dealer)

⚠️ WARRANTY ALERTS
- [Warranty type] from [Provider] — expires [date] or [miles] mi
  [X] months / [X] miles remaining

🔴 OVERDUE
- [service] — [X] miles/months overdue
  💰 DIY: $X | Shop: $X | Dealer: $X
  [💼 [X]% deductible] (if business use)

🟡 DUE SOON
- [service] — due in ~[X] miles/months
  💰 DIY: $X | Shop: $X | Dealer: $X

📅 PROJECTED SCHEDULE (next 6 months)
- [service] — ~[Month Year] at ~[X] mi ($[X] est.)
- [service] — ~[Month Year] at ~[X] mi ($[X] est.)
Total upcoming (6mo): ~$[X]

⛽ FUEL ECONOMY
Current: [X] MPG | Average: [X] MPG | Trend: [stable/improving/declining]
[⚠️ MPG Alert if applicable]

💰 SPENDING (YTD)
Maintenance: $[X] | Fuel: $[X] | Total: $[X]
Cost per mile: $[X.XX]

[Repeat for each vehicle]

🟢 [count] services current across all vehicles
```  

**全部正常（简版）：**  
```
🔧 All vehicles current ✅
[Vehicle] @ [mi] — next: [soonest service] at ~[miles] (~[Month])
No open recalls | Warranties current
```  

**当多项保养同时到期时**，提供合并总价估算，并建议一次性进厂完成。

### 条件性章节  
仅包含含相关数据的章节：  
- 若无未完成召回，则跳过召回章节  
- 若无即将到期保修，则跳过保修提醒  
- 若无 fuel_history 数据，则跳过燃油经济性章节  
- 若里程数据不足，则跳过预测章节  
- 若无 actual_cost 数据，则跳过支出章节  
- 若车辆非商业用途，则跳过税务备注  

## 登记已完成的保养  

当用户表示已完成某项保养（例如：“刚换了机油”，“在 65,000 英里时更换了燃油滤清器”）时：  

1. 确认是哪辆车及哪项保养  
2. 询问费用（轻松地 — “花了多少钱？” / “总共多少？”）  
3. 可选记录服务商（“在哪做的？” / “同上次一样？”）  
4. 添加至该车的 `service_history`：  
```json
{
  "service_id": "<matching id>",
  "date": "YYYY-MM-DD",
  "miles": <mileage_at_service>,
  "hours": <hours_if_applicable>,
  "notes": "<any details the user mentions>",
  "actual_cost": <amount_or_null>,
  "cost_type": "shop",
  "provider": {
    "id": "<provider_id>",
    "name": "<provider_name>",
    "parts_warranty_months": null,
    "labor_warranty_months": null
  }
}
```  
5. 若为商业用途车辆，注明可抵扣部分  
6. 如适用，提供登录 tax-professional 的选项  
7. 确认已登记内容  
8. 重新计算该项保养的下次到期日  

## 即时查询  

响应关于任一已追踪车辆的任何问题。若不明确，询问具体是哪辆车。  

**示例：**  
- “我下次换机油是什么时候？” → 检查相关车辆  
- “我的卡车该用什么机油？” → 参考计划详情或 emergency_info  
- “我需要做哪些保养？” → 全面审查，涵盖所有车辆  
- “我刚跑满 70,000 英里” → 更新里程，运行审查  
- “我在 61,000 英里时换了新轮胎” → 登记服务，从此处开始追踪轮胎换位  
- “我刚买了辆新[车辆]” → 引导完成添加流程  
- “换机油要花多少钱？” → 参考费用估算  
- “最紧急的是什么？” → 跨所有车辆优先排序  
- “我的卡车有召回吗？” → 检查 NHTSA API  
- “我的燃油经济性如何？” → MPG 报告  
- “我今年花了多少钱？” → 支出汇总  
- “我的保修还有效吗？” → 检查保修状态  
- “这是否在保修范围内？” → 将服务匹配至有效保修  
- “我要去公路旅行了” → 出行前检查清单  
- “我的变速箱油什么时候该换？” → 里程预测  
- “我上次换机油是在哪做的？” → 服务商查询  
- “我的 VIN 是什么？” → 紧急信息  
- “查一下我的 VIN” / “解码我的 VIN” → 运行 VIN 解码，显示规格  
- “这是我的 VIN：[VIN]” → 解码、存储、自动填充、运行召回检查  
- “我的轮胎规格是什么？” → 紧急信息  
- “每英里成本？” → 运营成本分析  
- “接下来 6 个月我在保养上要花多少钱？” → 预算预测  

## 环境感知  

检查 `<workspace>/USER.md` 获取用户所在地，并据此定制建议：  

**炎热气候（沙漠、南部州）：**  
- 高温显著缩短电瓶寿命  
- 轮胎紫外线损伤 — 建议为停放车辆配备轮胎罩  
- 冷却系统压力更大  
- 橡胶部件（皮带、软管、密封件）老化更快  
- 泥蜂/黄蜂易筑巢于通风口与排气管（房车尤甚）  

**寒冷气候（北部州、山区）：**  
- 房车与船只的冬季化处理至关重要  
- 低温降低电瓶容量  
- 检查防冻液保护等级  
- 寒冷季节前检查暖风/供暖系统  

**多尘/越野环境：**  
- 发动机与座舱空气滤清器需更频繁检查  
- 房车发电机空气滤清器  
- 检查 CV 关节防尘罩（ATV/UTV）  

**沿海/海洋环境：**  
- 腐蚀风险更高  
- 更频繁清洗底盘  
- 检查电气连接  

## 费用估算  

**标记已逾期或即将到期的保养时，务必包含费用估算：**  
- **DIY** — 仅零件成本  
- **Shop** — 独立维修厂 / 专业维修店  
- **Dealer** — 厂商授权经销商  

对可能导致高昂故障成本的项目，包含 `cost_note` 警告。  

呈现一批保养项目时，提供 **合并总价估算**，以便一次性进厂完成。

## 重要通用说明  

- **变速箱冲洗（Transmission flushes）** — 许多现代变速箱（尤其是福特 10R 系列、CVT）**仅应执行排空加注（drain-and-fill），绝不可冲洗（flush）**。务必查阅厂商建议。  
- **房车车顶（RV roofs）** — 水渗入是房车头号杀手。务必始终强调密封胶与车顶检查。  
- **轮胎年限（Tire age）** — 无论胎纹深度如何，轮胎应在 5–6 年后更换，房车/拖车轮胎尤需如此。  
- **严苛工况（Severe duty）** — 若用户拖曳、载重、越野行驶或在极端温度下运行，其几乎必然适用严苛/特殊工况保养计划，无论其是否意识到。  
- **零件编号（Part numbers）** — 在保养计划详情中包含 OEM 零件编号。用户可据此寻找等效的售后市场零件。  
- **季节性项目（Seasonal items）** — 根据用户所在地与当前季节，标记冬季化、解除冬季化及季节性准备事项。  
- **发电机小时数（Generator hours）** — 单独追踪（区别于车辆里程），发电机有其自身保养周期。  
- **脱离式电瓶（Breakaway batteries）（拖车）** — 常被遗忘。应纳入拖车/房车检查。  
- **召回完成（Recall completions）** — 经销商处召回维修**永远免费**。切勿为召回维修付费。  
- **保修维修（Warranty work）** — 详尽记录一切。保留收据。在服务历史中注明保修索赔编号。  
- **燃油追踪一致性（Fuel tracking consistency）** — 为获得准确 MPG 计算，加油时**务必加至同一水平（加满）**。非满油情况需明确标记。