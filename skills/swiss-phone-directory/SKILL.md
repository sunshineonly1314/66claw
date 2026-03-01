---
name: swiss-phone-directory
name_zh: 瑞士电话簿
description: "通过 search.ch API 查询瑞士电话黄页。支持企业、个人及电话号码反向查询。适用场景：(1) 查找瑞士公司或个人的联系方式；(2) 根据姓名或电话号码查找地址；(3) 电话号码反向查询；(4) 查找企业所属类别。需配置 SEARCHCH_API_KEY。"
description_zh: 通过 search.ch API 查询瑞士电话黄页。支持企业、个人及电话号码反向查询。适用场景：(1) 查找瑞士公司或个人的联系方式；(2) 根据姓名或电话号码查找地址；(3) 电话号码反向查询；(4) 查找企业所属类别。需配置 SEARCHCH_API_KEY。
---
# 瑞士电话黄页 skill

通过瑞士电话黄页（search.ch）搜索企业、个人及电话号码。

## 快速开始

```bash
# Search for a business
python3 scripts/searchch.py search "Migros" --location "Zürich"

# Search for a person
python3 scripts/searchch.py search "Müller Hans" --type person

# Reverse phone number lookup
python3 scripts/searchch.py search "+41442345678"

# Business-only search
python3 scripts/searchch.py search "Restaurant" --location "Bern" --type business --limit 5
```

## 命令

### search  
搜索企业、个人或电话号码。

```bash
python3 scripts/searchch.py search <query> [options]

Options:
  --location, -l    City, ZIP, street, or canton (e.g., "Zürich", "8000", "ZH")
  --type, -t        Filter: "business", "person", or "all" (default: all)
  --limit, -n       Max results (default: 10, max: 200)
  --lang            Output language: de, fr, it, en (default: de)
```

### 示例

```bash
# Find restaurants in Rapperswil
python3 scripts/searchch.py search "Restaurant" -l "Rupperswil" -t business -n 5

# Find a person by name
python3 scripts/searchch.py search "Meier Peter" -l "Zürich" -t person

# Reverse lookup a phone number
python3 scripts/searchch.py search "044 123 45 67"

# Search with canton abbreviation
python3 scripts/searchch.py search "Bäckerei" -l "SG"
```

## 输出格式

结果中包含以下字段（若可用）：  
- **Name（名称）** —— 企业或个人名称  
- **Type（类型）** —— 组织或个人  
- **Address（地址）** —— 街道、邮政编码、城市、州  
- **Phone（电话）** —— 电话号码（可能多个）  
- **Fax（传真）** —— 传真号码  
- **Email（邮箱）** —— 电子邮箱地址  
- **Website（网站）** —— 网站 URL  
- **Categories（类别）** —— 企业所属业务类别  

## 配置

配置说明详见 [references/configuration.md](references/configuration.md)。  

必需：`SEARCHCH_API_KEY` 环境变量。

## API 参考

- 基础 URL：`https://search.ch/tel/api/`  
- 调用频率限制：取决于 API 密钥等级  
- 完整文档：https://search.ch/tel/api/help.en.html  