---
name: irish-takeaway
name_zh: 爱尔兰外卖
description: 在爱尔兰查找附近外卖餐厅，并通过 Deliveroo / Just Eat 浏览菜单。利用 Google Places API 实现餐厅发现，借助浏览器自动化完成菜单抓取。
description_zh: 在爱尔兰查找附近外卖餐厅，并通过 Deliveroo / Just Eat 浏览菜单。利用 Google Places API 实现餐厅发现，借助浏览器自动化完成菜单抓取。
metadata: {"clawdbot":{"emoji":"🍕","requires":{"bins":["goplaces"],"env":["GOOGLE_PLACES_API_KEY"]}}}
---
# 爱尔兰外卖餐厅查找器 🍕🇮🇪

查找附近外卖餐厅，并从 Deliveroo 或 Just Eat 获取其菜单。

## 前置条件

- 已安装 `goplaces` CLI（`brew install steipete/tap/goplaces`）  
- 已设置 `GOOGLE_PLACES_API_KEY` 环境变量  
- 系统中可用浏览器工具  

## 工作流程

### 第一步：查找附近外卖餐厅

使用 goplaces 搜索指定位置附近的餐厅：

```bash
# Search by coordinates (negative longitude needs = syntax)
goplaces search "takeaway" --lat=53.7179 --lng=-6.3561 --radius-m=3000 --limit=10

# Search by cuisine
goplaces search "chinese takeaway" --lat=53.7179 --lng=-6.3561 --radius-m=2000

# Filter by rating
goplaces search "pizza" --lat=53.7179 --lng=-6.3561 --min-rating=4 --open-now
```

爱尔兰常见城市地理坐标：
- **德罗赫达（Drogheda）**：53.7179, -6.3561  
- **都柏林市区（Dublin City）**：53.3498, -6.2603  
- **科克（Cork）**：51.8985, -8.4756  
- **戈尔韦（Galway）**：53.2707, -9.0568  

### 第二步：获取 Deliveroo 菜单（浏览器自动化）

1. 启动浏览器并导航至 Deliveroo：
```
browser action=start target=host
browser action=navigate targetUrl="https://deliveroo.ie/" target=host
```

2. 若出现 Cookie 提示，请点击“全部接受（Accept all）”按钮  

3. 在地址搜索框中输入您的位置：
```
browser action=act request={"kind": "type", "ref": "<textbox-ref>", "text": "Drogheda, Co. Louth"}
```

4. 从自动补全下拉列表中选择对应位置  

5. 在餐厅列表中查找并点击目标餐厅  

6. 截取快照以提取菜单项 —— 关注以下元素：  
   - 类别标题（h2 标签）  
   - 包含名称、描述、价格的菜品按钮  
   - 菜品描述中列出的过敏原信息（Allergen info）  

### 第三步：解析菜单数据

菜单项通常以按钮形式呈现，结构如下：  
- **名称（Name）**：位于段落（paragraph）元素内  
- **描述（Description）**：位于文本内容中  
- **价格（Price）**：通常为 “€X.XX” 格式  
- **过敏原（Allergens）**：列于描述之后（如 Gluten、Milk 等）  

### 示例对话流程

用户：“我在德罗赫达附近有哪些外卖餐厅？”  
→ 运行 goplaces 搜索 → 展示评分最高的 5–10 家结果  

用户：“给我看看 Mizzoni's 的菜单。”  
→ 浏览器打开 Deliveroo → 输入位置 → 点击餐厅 → 截取快照 → 解析菜单  

用户：“他们有哪些披萨？”  
→ 按类别筛选菜单项 → 展示披萨选项及其价格  

### Just Eat 替代方案

若目标餐厅未入驻 Deliveroo，可尝试 Just Eat：  
```
browser action=navigate targetUrl="https://www.just-eat.ie/" target=host
```  

流程类似：输入邮编/地址 → 浏览餐厅列表 → 点击进入查看菜单  

### 使用提示

- 始终优先关闭 Cookie 弹窗  
- 等待自动补全建议出现后再点击  
- 部分餐厅标注“订单追踪受限（Limited order tracking）”，但仍支持菜单浏览  
- 价格信息常与过敏原说明一同出现在描述中  
- 使用 `snapshot` 命令时添加 `compact=true` 参数可获得更简洁的输出  

### 常见菜单分类

- 套餐与特别优惠（Meal Deals & Special Offers）  
- 披萨（按尺寸分类：小号/中号/大号/XL/火车轮 Pizza Wagon Wheel）  
- 开胃菜（Starters）  
- 意面（Pasta）  
- 汉堡（Burgers）  
- 小食（Sides）  
- 甜点（Desserts）  
- 饮料（Drinks）  

## 未来增强功能

- [ ] 集成 Twilio 实现电话语音下单  
- [ ] 跨平台价格比对  
- [ ] 记忆用户收藏的餐厅  
- [ ] 订单历史追踪  