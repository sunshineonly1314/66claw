---
name: parcel-package-tracking
slug: parcel
display_name: Parcel
description: 通过 Parcel API 跟踪和添加包裹配送信息。
description_zh: 通过 Parcel API 跟踪和添加包裹配送信息。
name_zh: 包裹追踪
---
# Parcel

与 Parcel 应用程序 API 交互，以跟踪包裹并添加新的配送记录。

## 配置

该 skill 需要设置 `PARCEL_API_KEY` 环境变量。  
您的密钥可从 [web.parcelapp.net](https://web.parcelapp.net) 获取。

## 工具：`parcel`

控制 Parcel API 命令行工具（CLI）。

### 参数

- `action`（必需）：取值为 `list`、`add` 或 `carriers` 之一。
- `mode`：当使用 `list` 时，指定筛选模式（`active` 或 `recent`），默认为 `recent`。
- `tracking`：当使用 `add` 时，指定物流追踪号。
- `carrier`：当使用 `add` 时，指定承运商代码（例如 `ups`、`usps`、`fedex`）。
- `description`：当使用 `add` 时，指定包裹的描述信息。
- `notify`：当使用 `add` 时，布尔值，用于控制是否发送推送确认通知。
- `search`：当使用 `carriers` 时，指定搜索字符串。

### 使用方法

**列出所有配送记录：**  
```bash
# List recent deliveries
node ~/.clawdbot/skills/parcel/parcel-api.js list

# List active deliveries
node ~/.clawdbot/skills/parcel/parcel-api.js list --mode=active
```

**添加一条新配送记录：**  
```bash
node ~/.clawdbot/skills/parcel/parcel-api.js add \
  --tracking "1Z1234567890" \
  --carrier "ups" \
  --description "New Shoes" \
  --notify
```

**列出所有承运商：**  
```bash
node ~/.clawdbot/skills/parcel/parcel-api.js carriers "ups"
```