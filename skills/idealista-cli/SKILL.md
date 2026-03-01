---
name: idealista-cli
name_zh: Idealista CLI
description: 使用 idealista CLI 按地点（城市、城镇、区域、街道）搜索 Idealista 房源，并获取房源详情。当用户请求 Idealista 市场数据，或需要 idealista-cli 的 CLI 命令/参数时启用本 skill。
description_zh: 使用 idealista CLI 按地点（城市、城镇、区域、街道）搜索 Idealista 房源，并获取房源详情。当用户请求 Idealista 市场数据，或需要 idealista-cli 的 CLI 命令/参数时启用本 skill。
compatibility: 需已安装 idealista-cli（Node.js 18+），且能访问 app.idealista.com。
license: MIT
metadata:
  author: pjtf93
  version: "0.1.0"
---
## 用途
搜索 Idealista 房源并获取房源详情。

## 启用时机
- 用户希望按城市/城镇/区域/街道搜索 Idealista 房源。  
- 用户希望根据广告 ID 获取房源详情。  
- 用户需要 JSON 输出以便脚本调用。

## 命令
### 地点建议
```
idealista locations "<query>" --operation <sale|rent|transfer> --property-type <homes|rooms|offices|garages|land>
```

### 搜索房源
```
idealista search "<query>" --operation <sale|rent|transfer> --property-type <homes|rooms|offices|garages|land>
```

可选筛选器：  
- `--page <n>`  
- `--limit <n>`  
- `--min-price <amount>` / `--max-price <amount>`  
- `--min-size <sqm>` / `--max-size <sqm>`  
- `--bedrooms <count>`  
- `--order <field>` / `--sort <order>`  
- `--location-id <id>`（跳过地点查找）

### 房源详情
```
idealista listing <adId>
```

### JSON 输出
在任意命令后添加 `--json` 参数：  
```
idealista search "madrid" --json
idealista listing 123456789 --json
```

## 配置
默认值已预填入 APK；如需覆盖，请使用环境变量：  
- `IDEALISTA_API_KEY`  
- `IDEALISTA_SIGNATURE_SECRET`  
- `IDEALISTA_OAUTH_CONSUMER_KEY`  
- `IDEALISTA_OAUTH_CONSUMER_SECRET`  
- `IDEALISTA_DEVICE_ID`  
- `IDEALISTA_APP_VERSION`  
- `IDEALISTA_BASE_URL`  
- `IDEALISTA_USER_AGENT`  
- `IDEALISTA_DNT`  

## 输出预期
- 地点建议：表格或 JSON 格式，含 `locationId`、名称、类型。  
- 搜索结果：表格或 JSON 格式，含 id、价格、房间数、面积、地址、位置、URL。  
- 房源详情：表格或 JSON 格式，含价格、房间数、面积、地址、URL、描述。

## 示例
```
idealista locations "madrid" --operation sale --property-type homes
idealista search "madrid" --operation rent --property-type homes --limit 20
idealista listing 123456789
```

## 错误处理
- 执行失败时返回非零退出码。  
- 脚本调用时，请使用 `--json` 并检查退出码。