---
name: picnic
name_zh: Picnic
description: 从 Picnic 超市订购杂货——搜索商品、管理购物车、预约配送。
description_zh: 从 Picnic 超市订购杂货——搜索商品、管理购物车、预约配送。
---
# Picnic 杂货订购

使用 `picnic` CLI 工具搜索商品、管理购物车，并从 Picnic 下单购买杂货。

## 初始设置（仅需一次）

```bash
cd {baseDir} && npm install
```

然后登录：
```bash
node {baseDir}/picnic-cli.mjs login <email> <password> DE
```

若需双重验证（2FA）：
```bash
node {baseDir}/picnic-cli.mjs verify-2fa <code>
```

## 命令

所有命令均以 JSON 格式输出。可在任意目录下执行：

```bash
# Check login status
node {baseDir}/picnic-cli.mjs status

# Search for products
node {baseDir}/picnic-cli.mjs search "Milch"
node {baseDir}/picnic-cli.mjs search "Bio Eier"

# View cart
node {baseDir}/picnic-cli.mjs cart

# Add to cart (productId from search results)
node {baseDir}/picnic-cli.mjs add <productId> [count]

# Remove from cart
node {baseDir}/picnic-cli.mjs remove <productId> [count]

# Clear cart
node {baseDir}/picnic-cli.mjs clear

# Get available delivery slots
node {baseDir}/picnic-cli.mjs slots

# Select a delivery slot
node {baseDir}/picnic-cli.mjs set-slot <slotId>

# View delivery history
node {baseDir}/picnic-cli.mjs deliveries

# Get user info
node {baseDir}/picnic-cli.mjs user

# Browse categories
node {baseDir}/picnic-cli.mjs categories
```

## 典型订购流程

1. 搜索商品：`search "bananas"`  
2. 加入购物车：`add s1234567 2`  
3. 查看购物车：`cart`  
4. 获取可选配送时段：`slots`  
5. 设定配送时段：`set-slot <slotId>`  
6. 最终结账前须经用户确认（结账操作在 Picnic App 内完成）

## 注意事项

- 配置文件存储于 `~/.config/picnic/config.json`  
- 国家代码：`DE`（德国）或 `NL`（荷兰）  
- 商品 ID 以字母 's' 开头（例如：`s1234567`）  
- 修改购物车或设定配送时段前，务必获得用户确认  
- 最终结账与付款必须在 Picnic App 中完成  