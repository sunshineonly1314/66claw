---
name: grocery-list
name_zh: 购物清单
description: 独立运行的购物清单、食谱与膳食规划工具，数据本地存储，无需任何外部服务。
description_zh: 独立运行的购物清单、食谱与膳食规划工具，数据本地存储，无需任何外部服务。
homepage: https://clawdhub.com/skills/grocery-list
metadata: { "clawdbot": { "emoji": "🛒", "requires": { "bins": ["uv"] } } }
---
# 购物清单与膳食规划器

功能完备的购物清单、食谱与膳食规划工具，所有数据以本地 JSON 文件形式存储。无需订阅，亦不依赖任何外部服务。

## 功能特性

- **多张清单**——如日常购物单、Costco 清单、Target 清单等；
- **智能分类**——果蔬、乳制品、肉类、烘焙、冷冻、杂货、日用品等；
- **数量解析**——例如输入 “2 gallons milk”（2 加仑牛奶），自动识别数量为 2，单位为 “gallon”（加仑）；
- **食谱存储**——可保存食谱及其所需食材；
- **膳食规划**——按日期与餐别（早餐/午餐/晚餐）规划膳食；
- **食谱转清单**——一键将某食谱全部食材添加至任意清单；
- **家庭成员分配**——可为清单条目指定负责的家庭成员；
- **通知支持**——通过 `notify` 命令接入心跳检测或 cron 任务调度。

## 命令

### 清单管理

```bash
uv run {baseDir}/scripts/grocery.py lists                    # Show all lists
uv run {baseDir}/scripts/grocery.py list "Grocery"           # Show items in a list
uv run {baseDir}/scripts/grocery.py list "Grocery" --unchecked
uv run {baseDir}/scripts/grocery.py list create "Costco"     # Create new list
uv run {baseDir}/scripts/grocery.py list delete "Costco"     # Delete a list
```

### 条目管理

```bash
uv run {baseDir}/scripts/grocery.py add "Grocery" "Milk"
uv run {baseDir}/scripts/grocery.py add "Grocery" "Milk" --category dairy --qty "2 gallons"
uv run {baseDir}/scripts/grocery.py add "Grocery" "Chicken" --assignee "Erin"
uv run {baseDir}/scripts/grocery.py check "Grocery" "Milk"
uv run {baseDir}/scripts/grocery.py uncheck "Grocery" "Milk"
uv run {baseDir}/scripts/grocery.py remove "Grocery" "Milk"
uv run {baseDir}/scripts/grocery.py clear "Grocery"          # Clear checked items
```

### 食谱管理

```bash
uv run {baseDir}/scripts/grocery.py recipes                  # List all recipes
uv run {baseDir}/scripts/grocery.py recipe "Tacos"           # View a recipe
uv run {baseDir}/scripts/grocery.py recipe add "Tacos" --ingredients "ground beef,tortillas,cheese,lettuce,tomatoes"
uv run {baseDir}/scripts/grocery.py recipe add "Tacos" --category "Mexican" --servings 4
uv run {baseDir}/scripts/grocery.py recipe delete "Tacos"
uv run {baseDir}/scripts/grocery.py recipe search "chicken"
```

### 膳食规划

```bash
uv run {baseDir}/scripts/grocery.py meals                    # Show this week's meals
uv run {baseDir}/scripts/grocery.py meals --date 2026-01-15
uv run {baseDir}/scripts/grocery.py meal add --date 2026-01-15 --type dinner --recipe "Tacos"
uv run {baseDir}/scripts/grocery.py meal add-to-list --date 2026-01-15 --list "Grocery"
uv run {baseDir}/scripts/grocery.py meal remove --date 2026-01-15 --type dinner
```

### 通知

```bash
uv run {baseDir}/scripts/grocery.py notify                   # Pending alerts for heartbeat
uv run {baseDir}/scripts/grocery.py stats                    # Quick summary
```

## 分类体系

内置分类，支持自动识别：

- **果蔬（produce）**——水果、蔬菜；  
- **乳制品（dairy）**——牛奶、奶酪、鸡蛋、酸奶；  
- **肉类（meat）**——鸡肉、牛肉、猪肉、鱼类；  
- **烘焙（bakery）**——面包、餐包、贝果；  
- **冷冻（frozen）**——冰淇淋、速冻食品；  
- **杂货（pantry）**——罐头、意面、大米；  
- **饮品（beverages）**——饮料、汽水、果汁；  
- **零食（snacks）**——薯片、饼干；  
- **日用品（household）**——清洁用品、纸制品；  
- **个护用品（personal）**——洗漱用品、药品；  
- **其他（other）**——未归类条目。

## JSON 输出

所有命令均支持 `--json` 参数，便于程序化调用：

```bash
uv run {baseDir}/scripts/grocery.py list "Grocery" --json
uv run {baseDir}/scripts/grocery.py recipes --json
uv run {baseDir}/scripts/grocery.py meals --json
```

## 数据存储

所有数据本地存储于 `~/.clawdbot/grocery-list/data.json`，无需云账户。

## 使用示例

**“把牛奶和鸡蛋加入购物清单”**  
```bash
uv run {baseDir}/scripts/grocery.py add "Grocery" "Milk" --category dairy
uv run {baseDir}/scripts/grocery.py add "Grocery" "Eggs" --category dairy
```

**“购物清单上有什么？”**  
```bash
uv run {baseDir}/scripts/grocery.py list "Grocery" --unchecked
```

**“计划周六晚餐吃墨西哥卷饼（tacos）”**  
```bash
uv run {baseDir}/scripts/grocery.py meal add --date 2026-01-18 --type dinner --recipe "Tacos"
```

**“把墨西哥卷饼的食材加入购物清单”**  
```bash
uv run {baseDir}/scripts/grocery.py meal add-to-list --date 2026-01-18 --list "Grocery"
```

**“标记牛奶为已购”**  
```bash
uv run {baseDir}/scripts/grocery.py check "Grocery" "Milk"
```