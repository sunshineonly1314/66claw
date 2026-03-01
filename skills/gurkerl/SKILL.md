---
name: gurkerl
name_zh: Gurkerl
description: 通过 MCP 实现 Gurkerl.at 杂货购物功能——搜索商品、管理购物车、订单、食谱、收藏夹等。
description_zh: 通过 MCP 实现 Gurkerl.at 杂货购物功能——搜索商品、管理购物车、订单、食谱、收藏夹等。
homepage: https://www.gurkerl.at/seite/mcp-server
metadata:
  clawdbot:
    emoji: "🥒"
    requires:
      bins: ["curl", "jq"]
    env:
      - GURKERL_EMAIL
      - GURKERL_PASS
    tags:
      - grocery
      - shopping
      - austria
      - mcp
      - rohlik
      - delivery
---
# Gurkerl.at MCP 技能

奥地利杂货配送服务（Rohlik 集团旗下）。支持商品搜索、购物车管理、订单查看、食谱浏览等功能。

> **Note:** This skill uses Gurkerl's official MCP server. The same approach works for other Rohlik Group brands (Rohlik.cz, Knuspr.de, Kifli.hu) — just change the MCP URL in the script.  

## 配置步骤

设置环境变量：  
```bash
export GURKERL_EMAIL="your@email.com"
export GURKERL_PASS="your-password"
```  

如需持久化访问，请添加至 `~/.config/systemd/user/clawdbot-gateway.service.d/gurkerl.conf`：  
```ini
[Service]
Environment="GURKERL_EMAIL=your@email.com"
Environment="GURKERL_PASS=your-password"
```  

## CLI 使用方式

```bash
# Search products (German keywords)
gurkerl search_products '{"keyword":"Milch"}'
gurkerl search_products '{"keyword":"Bio Eier","sort_type":"orderPriceAsc"}'

# Get cart
gurkerl get_cart

# Add to cart
gurkerl add_items_to_cart '{"items":[{"productId":1234567,"quantity":2}]}'

# View orders
gurkerl fetch_orders '{"limit":3}'
gurkerl fetch_orders '{"order_type":"upcoming"}'

# Search recipes
gurkerl search_recipes_by_vector_similarity '{"query":"vegetarisch schnell"}'
```  

## 可用工具

### 商品与搜索
| 工具 | 描述 |
|------|------|
| `search_products` | 按关键词、筛选条件和排序方式搜索。请使用德语关键词。 |
| `get_products_details_batch` | 获取多个商品 ID 的详细信息 |
| `get_product_composition` | 查看营养成分、过敏原及配料表 |
| `get_category_products` | 浏览某类目下的全部商品 |
| `get_main_categories` | 列出所有门店类目 |
| `get_brands_navigation` | 列出所有可选品牌 |

### 购物车
| 工具 | 描述 |
|------|------|
| `get_cart` | 查看当前购物车内容 |
| `add_items_to_cart` | 添加商品：`{"items":[{"productId":123,"quantity":1}]}` |
| `update_cart_item` | 修改数量：`{"product_id":123,"quantity":3}` |
| `remove_cart_item` | 移除某项：`{"product_id":123}` |
| `clear_cart` | 清空整个购物车 |

### 订单
| 工具 | 描述 |
|------|------|
| `fetch_orders` | 获取订单历史。参数：`limit`、`order_type`（delivered/upcoming/both）、`date_from`、`date_to` |
| `repeat_order` | 重新下单：`{"order_id":12345678}` |
| `cancel_order` | 取消待配送订单（分两步：先 `customer_confirmed:false`，再 `true`） |
| `get_alternative_timeslots` | 获取可选配送时段 |
| `change_order_timeslot` | 更改配送时段 |

### 食谱
| 工具 | 描述 |
|------|------|
| `search_recipes_by_vector_similarity` | 语义化食谱搜索 |
| `get_recipe_detail` | 完整食谱（含映射到商品的食材清单） |
| `generate_recipe_with_ingredients_search` | AI 生成食谱（含匹配商品） |
| `get_recipes_navigation` | 浏览食谱分类 |

### 用户与收藏
| 工具 | 描述 |
|------|------|
| `get_user_info` | 账户资料 |
| `get_user_credits` | 可用积分/优惠券 |
| `get_user_addresses` | 已保存的收货地址 |
| `get_all_user_favorites` | 所有收藏商品 |
| `get_user_shopping_lists_preview` | 列出全部购物清单 |
| `get_user_shopping_list_detail` | 查看清单内容 |
| `create_shopping_list` | 创建新清单 |
| `add_products_to_shopping_list` | 将商品加入清单 |

### 客户支持
| 工具 | 描述 |
|------|------|
| `submit_claim` | 就缺失/损坏商品提交保修申请 |
| `get_customer_support_contact_info` | 电话、邮箱、WhatsApp 联系方式 |
| `get_user_reusable_bags_info` | 查询环保袋押金状态 |
| `adjust_user_reusable_bags` | 更正环保袋数量 |

### 其他
| 工具 | 描述 |
|------|------|
| `calculate_average_user_order` | 基于历史订单生成典型采购单 |
| `get_faq_content` | 常见问题解答（FAQ）：general（通用）、xtra_general（额外通用）、xtra_price（价格相关）、baby_club（婴儿俱乐部）、christmas（圣诞节） |
| `fetch_all_job_listings` | 招聘职位信息 |

## 搜索提示

- 请使用**德语**关键词搜索奥地利 Gurkerl：如 “Milch”（牛奶）、“Brot”（面包）、“Eier”（鸡蛋）、“Käse”（奶酪）  
- 可用筛选条件：`news`（新品）、`sales`（促销中）  
- 排序方式：`orderPriceAsc`、`orderPriceDesc`、`recommended`（默认）  
- 包含营养信息：`"include_nutritions":true`  
- 包含过敏原信息：`"include_allergens":true`  

## 示例工作流

### 每周采购  
```bash
# Check what's on sale
gurkerl search_products '{"filters":[{"filterSlug":"sales","valueSlug":"sales"}]}'

# Add milk to cart
gurkerl search_products '{"keyword":"Milch"}'  # Get product ID
gurkerl add_items_to_cart '{"items":[{"productId":MILK_ID,"quantity":2}]}'

# Review cart
gurkerl get_cart
```  

### 重订上一单  
```bash
gurkerl fetch_orders '{"limit":1}'  # Get order ID
gurkerl repeat_order '{"order_id":ORDER_ID}'
```  

### 查找食谱并添加所需食材  
```bash
gurkerl search_recipes_by_vector_similarity '{"query":"schnelles Abendessen"}'
gurkerl get_recipe_detail '{"recipe_id":RECIPE_ID,"include_product_mapping":true}'
# Add matched products to cart
```  