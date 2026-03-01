---
name: copey-flight-tracker
name_zh: Copey航班追踪
version: 1.0.0
description: 使用 AviationStack API 实时追踪航班，提供详细的状态、登机口信息、延误情况及实时位置。当用户请求追踪航班、查询航班状态、根据航班号（例如“追踪 AA100”、“联合航空 2402 的状态如何？”、“检查我的航班 BA123”）查询航班信息，或希望以类似 Flighty 应用的格式展示航班数据时使用。
description_zh: 使用 AviationStack API 实时追踪航班，提供详细的状态、登机口信息、延误情况及实时位置。当用户请求追踪航班、查询航班状态、根据航班号（例如“追踪 AA100”、“联合航空 2402 的状态如何？”、“检查我的航班 BA123”）查询航班信息，或希望以类似 Flighty 应用的格式展示航班数据时使用。
---
# 航班追踪器

利用 AviationStack API 追踪全球任意航班，并以简洁、类 Flighty 的格式呈现。

## 快速上手

使用 IATA 编码追踪航班：

```bash
scripts/track_flight.py AA100
scripts/track_flight.py UA2402
scripts/track_flight.py BA123
```

## 首次配置

使用本 skill 前，您需获取一个 API 密钥（一次性配置）：

1. **在 https://aviationstack.com/signup/free 获取免费 API 密钥**（每月 100 次请求）  
2. **设置环境变量：**  
   ```bash
   export AVIATIONSTACK_API_KEY='your-key-here'
   ```  
3. **安装依赖项：**  
   ```bash
   pip3 install requests
   ```  

详细配置说明请参阅 [api-setup.md](references/api-setup.md)。

## 输出格式

本 skill 以清晰易读的格式展示航班信息，包括：

- ✈️ 航空公司及航班号  
- 🛩️ 机型与注册号  
- 🛫 出发机场、航站楼、登机口、时间  
- 🛬 到达机场、航站楼、登机口、时间  
- 📊 带视觉指示符的航班状态  
- ⏱️ 延误时长计算（如适用）  
- 🌐 实时位置、高度、速度（飞行中时）  

状态指示符：  
- 🟢 进行中/飞行中/途中  
- ✅ 已降落/已抵达  
- 🟡 计划中  
- 🟠 延误中  
- 🔴 已取消  

## 高级用法

**获取原始 JSON 数据：**  
```bash
scripts/track_flight.py AA100 --json
```

**查看帮助：**  
```bash
scripts/track_flight.py --help
```

## 工作流程

当用户请求追踪航班时：

1. 从请求中提取航班号  
2. 使用该航班号运行追踪脚本  
3. 向用户呈现格式化后的输出  
4. 若需进一步处理数据，请使用 `--json` 标志  

## 航班号格式

支持 IATA 航班编码：  
- AA100（美国航空）  
- UA2402（联合航空）  
- BA123（英国航空）  
- DL456（达美航空）  

脚本将自动转换为大写并执行查询。

## 错误处理

脚本可处理常见错误：  
- 缺失 API 密钥 → 显示配置说明  
- 未找到航班 → 建议用户核实  
- API 错误 → 显示错误消息  
- 速率限制已超出 → 提示已达上限  

## API 限额

免费套餐：每月 100 次请求。请跟踪用量以确保不超限。如需高频使用，建议升级或选用替代 API（参见 references/api-setup.md）。

## 注意事项

- 使用 AviationStack 免费套餐（免费版不支持 HTTPS）  
- 实时数据频繁更新  
- 支持历史航班数据查询  
- 全球覆盖（250+ 国家/地区，13,000+ 航空公司）  