---
name: paprika
name_zh: Paprika
description: 从 Paprika 食谱管理器访问食谱、餐食计划和购物清单。当用户询问食谱、餐食规划或烹饪相关事宜时使用。
description_zh: 从 Paprika 食谱管理器访问食谱、餐食计划和购物清单。当用户询问食谱、餐食规划或烹饪相关事宜时使用。
homepage: https://www.paprikaapp.com
metadata:
  clawdbot:
    emoji: "📖"
    requires:
      bins: ["paprika"]
---
# Paprika 食谱命令行工具（CLI）

Paprika 食谱管理器的命令行接口。用于访问食谱、餐食计划及购物清单。

## 安装

```bash
npm install -g paprika-recipe-cli
```

## 配置

```bash
# Authenticate interactively
paprika auth

# Or set environment variables
export PAPRIKA_EMAIL="your@email.com"
export PAPRIKA_PASSWORD="your-password"
```

## 命令

### 食谱

```bash
paprika recipes                       # List all recipes
paprika recipes --category "Dinner"   # Filter by category
paprika recipes --json

paprika recipe "Pasta Carbonara"      # View by name
paprika recipe <uid>                  # View by UID
paprika recipe "Pasta" --ingredients-only
paprika recipe "Pasta" --json

paprika search "chicken"              # Search recipes
```

### 餐食规划

```bash
paprika meals                         # Show all planned meals
paprika meals --date 2026-01-08       # Filter by date
paprika meals --json
```

### 购物清单

```bash
paprika groceries                     # Show unpurchased items
paprika groceries --all               # Include purchased
paprika groceries --json
```

### 分类

```bash
paprika categories                    # List all categories
```

## 使用示例

**用户：“我有哪些适合晚餐的食谱？”**  
```bash
paprika recipes --category "Dinner"
```

**用户：“显示意大利面卡邦尼拉食谱”**  
```bash
paprika recipe "Pasta Carbonara"
```

**用户：“做千层面需要哪些食材？”**  
```bash
paprika recipe "Lasagna" --ingredients-only
```

**用户：“餐食计划里有什么？”**  
```bash
paprika meals
```

**用户：“我的购物清单上有什么？”**  
```bash
paprika groceries
```

**用户：“查找鸡肉食谱”**  
```bash
paprika search "chicken"
```

## 注意事项

- 食谱名称支持模糊匹配  
- 使用 `--json` 实现程序化访问  
- 需启用 Paprika 云同步功能  