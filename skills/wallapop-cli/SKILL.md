---
name: wallapop-cli
name_zh: Wallapop CLI
description: 使用 wallapop CLI 搜索商品列表、获取商品详情、查看用户资料及列出分类。当用户询问 Wallapop 市场数据，或你需要 wallapop-cli 的命令与标志（flag）时启用。
description_zh: 使用 wallapop CLI 搜索商品列表、获取商品详情、查看用户资料及列出分类。当用户询问 Wallapop 市场数据，或你需要 wallapop-cli 的命令与标志（flag）时启用。
compatibility: 需已安装 wallapop-cli（Node.js 18+）、可访问 api.wallapop.com 的网络连接，以及可选的 WALLAPOP_ACCESS_TOKEN（用于非搜索类端点）。
---
## 目的
提供简洁、准确的 wallapop-cli 使用命令。

## 启用时机
- 用户询问如何从终端搜索 Wallapop 商品列表。
- 用户需要用于筛选搜索结果的 CLI 标志（价格、位置、分类、数量限制等）。
- 用户需要查询商品或用户资料的命令。
- 用户需要 JSON 格式输出以便脚本调用。

## 命令
### 搜索商品列表
```
wallapop search "<query>" [--lat <lat>] [--lng <lng>] [--min-price <n>] [--max-price <n>] [--category <id>] [--limit <n>]
```
说明：
- 若未指定 `--lat/--lng`，则默认使用已配置的位置。
- `--limit` 在本地对结果进行截断。

### 商品详情
```
wallapop item <item_id>
```

### 用户资料
```
wallapop user <user_id>
```

### 分类列表
```
wallapop categories
```

### JSON 输出（所有命令通用）
添加全局标志 `--json`：
```
wallapop --json search "laptop"
wallapop --json item abc123
```

## 配置
- 位置默认值可通过环境变量设置：
  - `WALLAPOP_LAT`
  - `WALLAPOP_LNG`
- 可选的身份认证令牌（用于非搜索类端点）：
  - `WALLAPOP_ACCESS_TOKEN`

## 输出预期
- 搜索：表格或 JSON 数组，包含 id、title、price、distance 和 user 字段。
- 商品：表格或 JSON，含 title、description、taxonomy、user、images 字段。
- 用户：表格或 JSON，含用户资料字段。
- 分类：表格或 JSON 列表，含 category id 与 name。

## 示例（安全占位符）
```
wallapop search "camera" --min-price 50 --max-price 200
wallapop search "chair" --lat 40.0 --lng -3.0 --limit 5
wallapop item abc123
wallapop user user123
wallapop --json categories
```

## 错误处理
- 执行失败时返回非零退出码。
- 在脚本中调用时，建议使用 `--json` 并通过检查退出码来处理错误。