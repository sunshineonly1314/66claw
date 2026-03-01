---
name: anylist
name_zh: AnyList
description: 通过 AnyList 管理杂货与购物清单。当用户询问购物清单、杂货，或要求添加/勾选待购商品时使用。
description_zh: 通过 AnyList 管理杂货与购物清单。当用户询问购物清单、杂货，或要求添加/勾选待购商品时使用。
homepage: https://www.anylist.com
metadata:
  clawdbot:
    emoji: "🛒"
    requires:
      bins: ["anylist"]
---
# AnyList CLI

通过 AnyList 管理杂货与购物清单。

## 安装

```bash
npm install -g anylist-cli
```

## 配置

```bash
# Authenticate interactively
anylist auth

# Or set environment variables for non-interactive use
export ANYLIST_EMAIL="your@email.com"
export ANYLIST_PASSWORD="your-password"
```

## 命令

### 清单（Lists）

```bash
anylist lists              # Show all lists
anylist lists --json       # Output as JSON
```

### 商品项（Items）

```bash
anylist items "Grocery"              # Show items in a list
anylist items "Grocery" --unchecked  # Only unchecked items
anylist items "Grocery" --json       # Output as JSON
```

### 添加商品项（Add Items）

```bash
anylist add "Grocery" "Milk"
anylist add "Grocery" "Milk" --category dairy
anylist add "Grocery" "Chicken" --category meat --quantity "2 lbs"
```

**分类（Categories）：** produce, meat, seafood, dairy, bakery, bread, frozen, canned, condiments, beverages, snacks, pasta, rice, cereal, breakfast, baking, spices, seasonings, household, personal care, other

### 管理商品项（Manage Items）

```bash
anylist check "Grocery" "Milk"      # Mark as checked
anylist uncheck "Grocery" "Milk"    # Mark as unchecked
anylist remove "Grocery" "Milk"     # Remove from list
anylist clear "Grocery"             # Clear all checked items
```

## 使用示例

**用户：“购物清单上有什么？”**  
```bash
anylist items "Grocery" --unchecked
```

**用户：“把牛奶和鸡蛋加入杂货清单”**  
```bash
anylist add "Grocery" "Milk" --category dairy
anylist add "Grocery" "Eggs" --category dairy
```

**用户：“勾选面包”**  
```bash
anylist check "Grocery" "Bread"
```

**用户：“添加制作玉米饼所需的食材”**  
```bash
anylist add "Grocery" "Ground beef" --category meat
anylist add "Grocery" "Taco shells" --category other
anylist add "Grocery" "Lettuce" --category produce
anylist add "Grocery" "Tomatoes" --category produce
anylist add "Grocery" "Cheese" --category dairy
```

## 注意事项

- 清单名称与商品项名称不区分大小写  
- 若某商品项已存在，再次添加将取消其勾选状态（对食谱场景很有用）  
- 使用 `--json` 进行脚本化操作与程序化访问