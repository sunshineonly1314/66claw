---
name: aviationstack-flight-tracker
name_zh: AviationStack 航班追踪
version: 1.0.0
description: 使用 AviationStack API 实时追踪航班，提供详细状态、登机口信息、延误情况及实时位置。当用户要求追踪某趟航班、查询航班状态、通过航班号（例如：“追踪 AA100”、“联合航空 2402 航班当前状态如何？”、“查询我的 BA123 航班”）查询航班信息，或希望以类似 Flighty 应用的格式化视图展示航班数据时，请使用本 skill。
description_zh: 使用 AviationStack API 实时追踪航班，提供详细状态、登机口信息、延误情况及实时位置。当用户要求追踪某趟航班、查询航班状态、通过航班号（例如：“追踪 AA100”、“联合航空 2402 航班当前状态如何？”、“查询我的 BA123 航班”）查询航班信息，或希望以类似 Flighty 应用的格式化视图展示航班数据时，请使用本 skill。
---
# 航班追踪器

利用 AviationStack API 追踪全球任意航班，并以简洁、类似 Flighty 的格式呈现结果。

## 快速开始

使用 IATA 航班代码追踪航班：

```bash
scripts/track_flight.py AA100
scripts/track_flight.py UA2402
scripts/track_flight.py BA123
```

## 首次设置

在使用本 skill 前，您需获取一个 API 密钥（一次性设置）：

1. **免费获取 API 密钥**：访问 https://aviationstack.com/signup/free（每月 100 次请求）
2. **设置环境变量：**
   ```bash
   export AVIATIONSTACK_API_KEY='your-key-here'
   ```
3. **安装依赖项：**
   ```bash
   pip3 install requests
   ```

详细设置说明请参阅 [api-setup.md](references/api-setup.md)。

## 输出格式

该 skill 以清晰易读的格式展示航班信息，包括：

- ✈️ 航空公司与航班号  
- 🛩️ 机型与注册号  
- 🛫 出发机场、航站楼、登机口、起降时间  
- 🛬 到达机场、航站楼、登机口、起降时间  
- 📊 带可视化指示符的航班状态  
- ⏱️ 延误时长计算（如适用）  
- 🌐 实时位置、高度、速度（仅限飞行中）

状态指示符含义：
- 🟢 运行中 / 飞行中 / 航程中  
- ✅ 已降落 / 已到达  
- 🟡 已计划  
- 🟠 已延误  
- 🔴 已取消  

## 高级用法

**获取原始 JSON 数据：**  
```bash
scripts/track_flight.py AA100 --json
```

**查看帮助信息：**  
```bash
scripts/track_flight.py --help
```

## 工作流程

当用户请求追踪某趟航班时：

1. 从用户请求中提取航班号  
2. 使用该航班号运行追踪脚本  
3. 向用户呈现格式化后的输出结果  
4. 若需进一步处理数据，请使用 `--json` 标志  

## 航班号格式

支持 IATA 航班编码格式：
- AA100（美国航空）  
- UA2402（联合航空）  
- BA123（英国航空）  
- DL456（达美航空）  

脚本将自动转换为大写并完成查询。

## 错误处理

脚本可处理以下常见错误：
- 缺少 API 密钥 → 显示设置说明  
- 未找到航班 → 提示用户核实航班号  
- API 错误 → 显示错误消息  
- 请求超出速率限制 → 提示已达限额  

## API 用量限制

免费版：每月 100 次请求。请留意用量，避免超限。如需高频使用，建议升级至付费版或选用其他 API（详见 references/api-setup.md）。

## 注意事项

- 使用 AviationStack 免费版（免费计划不支持 HTTPS）  
- 实时数据更新频率高  
- 支持历史航班数据查询  
- 全球覆盖（250+ 国家/地区，13,000+ 家航空公司）