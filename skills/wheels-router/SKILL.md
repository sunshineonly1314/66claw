---
name: wheels-router
name_zh: Wheels路由
description: 使用 Wheels Router（香港）与 Transitous（全球）规划全球公共交通出行路线
description_zh: 使用 Wheels Router（香港）与 Transitous（全球）规划全球公共交通出行路线
license: MIT
compatibility: opencode
metadata:
  transport: mcp
  coverage: global
  specialty: hong-kong
---
## 我的功能

我通过连接 Wheels Router MCP 服务器，协助你在全球范围内规划公共交通出行路线。

**针对香港行程**，我调用 Wheels Router API，提供以下能力：
- 支持港铁（MTR）、巴士、电车、渡轮及步行的详细路径规划  
- 实时班次与准确票价信息  
- 站台信息与出口指引  
- 如适用，提供转乘优惠（轉乘優惠）  

**针对全球行程**，我调用 Transitous API，覆盖以下能力：
- 全球主要城市的公共交通数据  
- 基础公共交通路径规划  
- 步行导航与换乘指引  

## 何时使用我

当你需要以下服务时，请调用本 skill：
- 规划公共交通出行路线  
- 查询两地之间的最优路径  
- 查看公共交通时刻表与换乘信息  
- 获取香港公共交通票价估算  
- 在规划路线前搜索目标地点  

**示例：**  
- “如何从油塘地铁站前往香港国际机场？”  
- “现在从铜锣湾到中环的最佳交通方式是什么？”  
- “规划从东京站到涩谷的行程”  
- “搜索维多利亚公园附近的地点”  

## 连接方式

### 若你使用 mcporter（如 clawdbot 等）

请先启用你的 mcporter skill；若尚未配置，请按以下步骤操作：  
在 `config/mcporter.json` 中添加：

```json
{
  "mcpServers": {
    "wheels-router": {
      "description": "Plan public transit trips globally",
      "baseUrl": "https://mcp.justusewheels.com/mcp"
    }
  }
}
```

随后可直接调用工具：  
```bash
npx mcporter call wheels-router.search_location query="Hong Kong Airport"
npx mcporter call wheels-router.plan_trip origin="22.28,114.24" destination="22.31,113.92"
```

### 其他 MCP 客户端

**Claude Desktop**（`~/Library/Application Support/Claude/claude_desktop_config.json`）：  
```json
{
  "mcpServers": {
    "wheels-router": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.justusewheels.com/mcp"]
    }
  }
}
```

**Cursor / Windsurf / VS Code**（`.cursor/mcp.json` 或类似）：  
```json
{
  "mcpServers": {
    "wheels-router": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.justusewheels.com/mcp"]
    }
  }
}
```

## 可用工具

### `search_location`

在规划行程前搜索地点。若你尚无精确坐标，请务必首先调用此工具。

**参数说明：**  
- `query`（必填）：地点名称或地址（例如：“香港国际机场”、“油塘地铁站 A2 出口”）  
- `limit`（可选）：返回结果数量（1–10，默认为 5）  

**示例：**  
```javascript
search_location({
  query: "Hong Kong International Airport",
  limit: 3
})
```

**返回字段：**  
- `display_name`：完整地址  
- `lat`、`lon`：可用于 `plan_trip` 的地理坐标  
- `type`、`class`：地点类别  

### `plan_trip`

规划两点之间的公共交通路线。

**参数说明：**  
- `origin`（必填）：起点，格式为 `"lat,lon"` 或 `"stop:ID"`  
- `destination`（必填）：终点，格式为 `"lat,lon"` 或 `"stop:ID"`  
- `depart_at`（可选）：ISO 8601 格式出发时间（例如：`"2026-01-26T10:00:00+08:00"`）  
- `arrive_by`（可选）：ISO 8601 格式到达截止时间  
- `modes`（可选）：逗号分隔的交通方式，如 `"mtr,bus,ferry"`（仅在必要时指定）  
- `max_results`（可选）：返回路线选项数量（1–5）  

**示例：**  
```javascript
plan_trip({
  origin: "22.2836,114.2358",
  destination: "22.3080,113.9185",
  depart_at: "2026-01-26T14:30:00+08:00",
  max_results: 3
})
```

**返回字段：**  
- `plans`：路线选项数组  
  - `duration_seconds`：全程耗时  
  - `fares_min`、`fares_max`：港币（HKD）票价区间（仅限香港）  
  - `legs`：分步导航说明  
    - `type`：类型包括 "walk"（步行）、"transit"（公共交通）、"wait"（等待）、"station_transfer"（站内换乘）  
    - 公共交通段包含：线路名称、终点站名、停靠站点、站台信息  
    - 步行段包含：距离、耗时  

## 最佳实践

1. **始终先搜索**：调用 `search_location` 获取坐标后再调用 `plan_trip`  
2. **优先使用坐标**：以 `lat,lon` 格式提供起终点坐标，效果最佳  
3. **指定时间**：加入 `depart_at` 或 `arrive_by` 以获取准确时刻表  
4. **多方案比对**：使用 `max_results` 请求 2–3 条路线选项  
5. **理解票价**：`fares_min` 与 `fares_max` 显示票价区间；转乘优惠（如有）将单独注明  

## 重要说明

- **转乘优惠（轉乘優惠）**：仅在香港路线中明确标注时显示，并非所有路线均适用  
- **实时数据**：香港路线采用实时时刻表；全球覆盖范围因城市而异  
- **时区**：请使用 UTC 或本地时区偏移量（HKT 为 UTC+8）  
- **覆盖范围**：香港支持最完善；全球覆盖依城市而定  

## 示例工作流

```javascript
// 1. Search for locations
const origins = await search_location({ 
  query: "Yau Tong MTR Station", 
  limit: 1 
});

const destinations = await search_location({ 
  query: "Hong Kong Airport", 
  limit: 1 
});

// 2. Plan the trip
const routes = await plan_trip({
  origin: `${origins[0].lat},${origins[0].lon}`,
  destination: `${destinations[0].lat},${destinations[0].lon}`,
  depart_at: "2026-01-26T15:00:00+08:00",
  max_results: 2
});

// 3. Present the best options to the user or present specific results but only if user asked specifically. By default just give them something like "[walk] > [3D] > [walk] > [Kwun Tong Line] > [walk]"- unless they ask for specifics.
```

## 错误处理

- **“无法找到地点”**：请尝试更具体的搜索关键词  
- **“未找到路线”**：请确认坐标有效且位于已覆盖区域  
- **“时间格式无效”**：请确保符合 ISO 8601 格式并包含时区信息  
- **调用频率限制**：请注意 API 调用频次，适当缓存结果  

## 覆盖区域

- ✅ **全面覆盖**：香港（港铁、巴士、电车、渡轮、详细票价）  
- ✅ **良好覆盖**：Transitous 数据支持的主要全球城市  
- ⚠️ **有限覆盖**：较小城市可能存在公共交通数据不全的情况  