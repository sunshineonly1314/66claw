---
name: gurkerlcli
name_zh: Gurkerl CLI
version: 0.1.6
description: 通过 gurkerl.at 实现奥地利在线杂货购物。当用户提及“杂货”、“Einkauf”（采购）、“Lebensmittel bestellen”（订购食品）、“Gurkerl”、购物车，或希望在奥地利在线搜索/订购食品时使用。
description_zh: 通过 gurkerl.at 实现奥地利在线杂货购物。当用户提及“杂货”、“Einkauf”（采购）、“Lebensmittel bestellen”（订购食品）、“Gurkerl”、购物车，或希望在奥地利在线搜索/订购食品时使用。
tools: [bash]
---
# 🥒 gurkerlcli — 奥地利杂货购物命令行工具

[gurkerl.at](https://gurkerl.at) 在线杂货购物（仅限奥地利）的命令行接口。

## 安装

```bash
# Via Homebrew
brew tap pasogott/tap
brew install gurkerlcli

# Or via pipx
pipx install gurkerlcli
```  

## 认证

**首次使用前需登录：**  

```bash
gurkerlcli auth login --email user@example.com --password xxx
gurkerlcli auth whoami     # Check login status
gurkerlcli auth logout     # Clear session
```  

会话将安全存储于 macOS Keychain 中。

**替代方式：环境变量**

```bash
export GURKERL_EMAIL=your-email@example.com
export GURKERL_PASSWORD=your-password
```  

或添加至 `~/.env.local` 以实现持久化。

## 命令

### 🔍 搜索商品

```bash
gurkerlcli search "bio milch"
gurkerlcli search "äpfel" --limit 10
gurkerlcli search "brot" --json          # JSON output for scripting
```  

### 🛒 购物车

```bash
gurkerlcli cart list                     # View cart contents
gurkerlcli cart add <product_id>         # Add product
gurkerlcli cart add <product_id> -q 3    # Add with quantity
gurkerlcli cart remove <product_id>      # Remove product
gurkerlcli cart clear                    # Empty cart (asks for confirmation)
gurkerlcli cart clear --force            # Empty cart without confirmation
```  

### 📝 购物清单

```bash
gurkerlcli lists list                    # Show all lists
gurkerlcli lists show <list_id>          # Show list details
gurkerlcli lists create "Wocheneinkauf"  # Create new list
gurkerlcli lists delete <list_id>        # Delete list
```  

### 📦 订单历史

```bash
gurkerlcli orders list                   # View past orders
```  

## 示例工作流

### 查看购物车内容

```bash
gurkerlcli cart list
```  

输出：  
```
🛒 Shopping Cart
┌─────────────────────────────────┬──────────────┬───────────────┬──────────┐
│ Product                         │          Qty │         Price │ Subtotal │
├─────────────────────────────────┼──────────────┼───────────────┼──────────┤
│ 🥛 nöm BIO-Vollmilch 3,5%       │     2x 1.0 l │ €1.89 → €1.70 │    €3.40 │
│ 🧀 Bergbaron                    │     1x 150 g │         €3.99 │    €3.99 │
├─────────────────────────────────┼──────────────┼───────────────┼──────────┤
│                                 │              │        Total: │    €7.39 │
└─────────────────────────────────┴──────────────┴───────────────┴──────────┘

⚠️  Minimum order: €39.00 (€31.61 remaining)
```  

### 搜索并加入购物车

```bash
# Find product
gurkerlcli search "hafermilch"

# Add to cart (use product ID from search results)
gurkerlcli cart add 123456 -q 2
```  

### 从购物车移除商品

```bash
# List cart to see product IDs
gurkerlcli cart list --json | jq '.items[].product_id'

# Remove specific product
gurkerlcli cart remove 123456
```  

## 调试

使用 `--debug` 参数启用详细输出：

```bash
gurkerlcli cart add 12345 --debug
gurkerlcli cart remove 12345 --debug
```  

## 使用提示

- **最低订单金额**：€39.00（方可享受配送）  
- **配送时段**：请访问 gurkerl.at 网站查看可选时段  
- **促销商品**：标有箭头的价格（如 €1.89 → €1.70）表示折扣价  
- **JSON 输出**：使用 `--json` 参数便于脚本调用/自动化  

## 局限性

- ⏳ 结账功能尚未实现（请使用网站完成）  
- 🇦🇹 仅限奥地利（维也纳、格拉茨、林茨地区）  
- 🔐 需持有有效的 gurkerl.at 账户  

## 更新日志

- **v0.1.6** — 修复购物车移除功能（改用 DELETE 而非 POST）  
- **v0.1.5** — 修复购物车添加已有商品功能（改用 POST 而非 PUT）  

## 相关链接

- [gurkerl.at](https://gurkerl.at)  
- [GitHub 仓库](https://github.com/pasogott/gurkerlcli)  