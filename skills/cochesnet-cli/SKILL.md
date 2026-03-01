---
name: cochesnet-cli
name_zh: CochesNet CLI
description: 使用 cochesnet CLI 搜索 coches.net 上的车辆广告并获取详细信息。当用户请求 coches.net 市场数据，或您需要 cochesnet-cli 的确切 CLI 命令与参数时启用。
description_zh: 使用 cochesnet CLI 搜索 coches.net 上的车辆广告并获取详细信息。当用户请求 coches.net 市场数据，或您需要 cochesnet-cli 的确切 CLI 命令与参数时启用。
compatibility: 需已安装 cochesnet-cli（Node.js 18+），且可访问 apps.gw.coches.net。
license: MIT
metadata:
  author: pjtf93
  version: "0.1.0"
---
## 用途
使用 cochesnet CLI 搜索车辆广告并获取广告详情。

## 使用时机
- 用户要求从终端搜索 coches.net 广告列表。  
- 用户需要已知广告 ID 对应的详细信息。  
- 用户希望获得 JSON 格式输出以便脚本调用。

## 命令
### 搜索广告列表
```
cochesnet search "<query>" [--limit <n>] [--page <n>]
```

### 广告详情
```
cochesnet listing <adId>
```

### JSON 输出
在任一命令中添加 `--json` 参数：
```
cochesnet search "bmw" --json
cochesnet listing 58229053 --json
```

## 配置
环境变量：
- `COCHESNET_BASE_URL`（默认值：https://apps.gw.coches.net）  
- `COCHESNET_APP_VERSION`（默认值：7.94.0）  
- `COCHESNET_HTTP_USER_AGENT`（默认值：coches.net 7.94.0）  
- `COCHESNET_X_USER_AGENT`（默认值：3）  
- `COCHESNET_TENANT`（默认值：coches）  
- `COCHESNET_VARIANT`（可选的 X-Adevinta-MT-Variant 请求头）

## 输出预期
- 搜索结果：表格或 JSON 格式，含 id、title、price、year、km、location、url 字段。  
- 广告详情：表格或 JSON 格式，含 title、price、url、seller、description 字段。

## 示例
```
cochesnet search "bmw" --limit 5
cochesnet search "toyota" --page 2
cochesnet listing 58229053
```

## 错误处理
- 执行失败时返回非零退出码。  
- 在脚本中使用时，请配合 `--json` 并检查退出码。