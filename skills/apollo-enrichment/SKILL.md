---
name: apollo-enrichment
name_zh: Apollo增强
description: Apollo.io 联系人与公司信息增强 API。为联系人补充邮箱、电话、职位、公司数据；为组织补充行业、营收、员工数量、融资信息。支持潜在客户搜索。当用户需要增强联系人信息、查找邮箱、查询公司详情或搜索销售线索时使用。
description_zh: Apollo.io 联系人与公司信息增强 API。为联系人补充邮箱、电话、职位、公司数据；为组织补充行业、营收、员工数量、融资信息。支持潜在客户搜索。当用户需要增强联系人信息、查找邮箱、查询公司详情或搜索销售线索时使用。
version: 1.3.0
author: captmarbles
---
# Apollo Enrichment Skill

使用 [Apollo.io](https://apollo.io) API 增强联系人与公司信息。

## 配置

1. 从 [Apollo 设置页面](https://app.apollo.io/#/settings/integrations/api) 获取您的 API 密钥。
2. 设置环境变量：
   ```bash
   export APOLLO_API_KEY=your-api-key-here
   ```

## 使用方法

所有命令均调用该 skill 目录下内置的 `apollo.py` 脚本。

### 增强单个联系人

获取某位联系人的邮箱、电话、职位及公司数据。

```bash
# By email
python3 apollo.py enrich --email "john@acme.com"

# By name + company
python3 apollo.py enrich --name "John Smith" --domain "acme.com"

# Include personal email & phone
python3 apollo.py enrich --email "john@acme.com" --reveal-email --reveal-phone
```

### 批量增强联系人

单次调用最多可增强 10 位联系人。

```bash
# From JSON file with array of {email, first_name, last_name, domain}
python3 apollo.py bulk-enrich --file contacts.json

# Reveal personal contact info
python3 apollo.py bulk-enrich --file contacts.json --reveal-email --reveal-phone
```

**contacts.json 示例：**
```json
[
  {"email": "john@acme.com"},
  {"first_name": "Jane", "last_name": "Doe", "domain": "techcorp.io"}
]
```

### 增强单个公司

获取行业、营收、员工数量、融资等数据。

```bash
python3 apollo.py company --domain "stripe.com"
```

### 搜索联系人

按指定条件查找潜在客户。

```bash
# By title and company
python3 apollo.py search --titles "CEO,CTO" --domain "acme.com"

# By title and location
python3 apollo.py search --titles "VP Sales" --locations "San Francisco"

# Limit results
python3 apollo.py search --titles "Engineer" --domain "google.com" --limit 10

# Exclude competitors (Hathora/Edgegap/Nakama)
python3 apollo.py search --titles "CTO" --exclude-competitors
```

**筛选选项：**
- `--exclude-competitors` 或 `-x` — 自动排除 Hathora、Edgegap 和 Nakama（Heroic Labs）的员工

## 示例提示词

- *“使用 Apollo 增强 john@acme.com 的信息”*
- *“获取 stripe.com 的公司信息”*
- *“查找位于纽约市的金融科技公司的首席技术官（CTO）”*
- *“批量增强以下联系人列表”*
- *“Notion 的员工数量和营收是多少？”*

## 返回的数据

**联系人增强结果：**
- 姓名、职位、个人简介（headline）
- 邮箱（工作邮箱与私人邮箱）
- 电话（直拨号码与手机号）
- 公司、所属行业
- LinkedIn URL
- 所在地

**公司增强结果：**
- 公司名称、域名、Logo
- 行业、关键词
- 员工数量、营收
- 融资轮次、投资方
- 使用的技术栈
- 社交媒体链接

## 积分说明

Apollo 使用积分（credits）执行信息增强操作。您可在 [apollo.io/settings/credits](https://app.apollo.io/#/settings/credits) 查看当前积分使用情况。