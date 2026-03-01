---
name: hubspot
name_zh: HubSpot
description: HubSpot CRM 与 CMS API 集成，支持联系人、公司、交易（deals）、负责人（owners）及内容管理。
description_zh: HubSpot CRM 与 CMS API 集成，支持联系人、公司、交易（deals）、负责人（owners）及内容管理。
metadata: {"clawdbot":{"secrets":["HUBSPOT_ACCESS_TOKEN"]}}
---
# HubSpot Skill

通过 REST API 与 HubSpot CRM 及 CMS 进行交互。

## 设置

设置您的 HubSpot 私有应用访问令牌（access token）：  
```
HUBSPOT_ACCESS_TOKEN=pat-na2-xxxxx
```

## API 基础地址

所有端点均基于：`https://api.hubapi.com`

授权请求头（Authorization header）：`Bearer $HUBSPOT_ACCESS_TOKEN`

---

## CRM 对象

### 联系人（Contacts）

**创建联系人：**  
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"email":"test@example.com","firstname":"Test","lastname":"User","phone":"555-1234","company":"Acme Inc","jobtitle":"Manager"}}' \
  "https://api.hubapi.com/crm/v3/objects/contacts" | jq
```

**列出联系人：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/contacts?limit=10" | jq
```

**搜索联系人：**  
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filterGroups":[{"filters":[{"propertyName":"email","operator":"CONTAINS_TOKEN","value":"example.com"}]}],"limit":10}' \
  "https://api.hubapi.com/crm/v3/objects/contacts/search" | jq
```

**按 ID 获取联系人：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/contacts/{contactId}?properties=email,firstname,lastname,phone,company" | jq
```

**按邮箱获取联系人：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/contacts/{email}?idProperty=email" | jq
```

### 公司（Companies）

**列出公司：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/companies?limit=10&properties=name,domain,industry" | jq
```

**搜索公司：**  
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filterGroups":[{"filters":[{"propertyName":"name","operator":"CONTAINS_TOKEN","value":"acme"}]}],"limit":10}' \
  "https://api.hubapi.com/crm/v3/objects/companies/search" | jq
```

**按 ID 获取公司：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/companies/{companyId}?properties=name,domain,industry,numberofemployees" | jq
```

### 交易（Deals）

**创建交易：**  
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"dealname":"New Deal","amount":"10000","closedate":"2026-06-01","description":"Deal notes here"}}' \
  "https://api.hubapi.com/crm/v3/objects/deals" | jq
```

**列出交易：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/deals?limit=10&properties=dealname,amount,dealstage,closedate" | jq
```

**搜索交易：**  
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filterGroups":[{"filters":[{"propertyName":"dealstage","operator":"EQ","value":"closedwon"}]}],"limit":10}' \
  "https://api.hubapi.com/crm/v3/objects/deals/search" | jq
```

**按 ID 获取交易：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/objects/deals/{dealId}?properties=dealname,amount,dealstage,closedate,pipeline" | jq
```

### 负责人（Owners）

**列出负责人（用户）：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/owners" | jq
```

---

## 更新与分配负责人（Owner）

**更新联系人属性：**  
```bash
curl -s -X PATCH -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"phone":"555-9999","jobtitle":"Director"}}' \
  "https://api.hubapi.com/crm/v3/objects/contacts/{contactId}" | jq
```

**为联系人分配负责人：**  
```bash
curl -s -X PATCH -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"hubspot_owner_id":"{ownerId}"}}' \
  "https://api.hubapi.com/crm/v3/objects/contacts/{contactId}" | jq
```

**为交易分配负责人：**  
```bash
curl -s -X PATCH -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"hubspot_owner_id":"{ownerId}"}}' \
  "https://api.hubapi.com/crm/v3/objects/deals/{dealId}" | jq
```

---

## 关联关系（Associations）

**获取某公司的关联联系人：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v4/objects/companies/{companyId}/associations/contacts" | jq
```

**获取某联系人的关联交易：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v4/objects/contacts/{contactId}/associations/deals" | jq
```

**创建关联关系（交易 → 联系人）：**  
```bash
curl -s -X POST -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs":[{"from":{"id":"{dealId}"},"to":{"id":"{contactId}"},"types":[{"associationCategory":"HUBSPOT_DEFINED","associationTypeId":3}]}]}' \
  "https://api.hubapi.com/crm/v4/associations/deals/contacts/batch/create" | jq
```

常见关联类型 ID：  
- 3：交易 → 联系人  
- 5：交易 → 公司  
- 1：联系人 → 公司  

---

## 属性（Properties，即 Schema）

**列出联系人属性：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/properties/contacts" | jq '.results[].name'
```

**列出公司属性：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/properties/companies" | jq '.results[].name'
```

**列出交易属性：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/crm/v3/properties/deals" | jq '.results[].name'
```

---

## CMS

### 页面（Pages）

**列出网站页面：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/cms/v3/pages/site-pages?limit=10" | jq
```

**列出落地页（Landing Pages）：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/cms/v3/pages/landing-pages?limit=10" | jq
```

### 域名（Domains）

**列出域名：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/cms/v3/domains" | jq
```

---

## 文件（Files）

**列出文件：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/files/v3/files?limit=10" | jq
```

**搜索文件：**  
```bash
curl -s -H "Authorization: Bearer $HUBSPOT_ACCESS_TOKEN" \
  "https://api.hubapi.com/files/v3/files/search?name=logo" | jq
```

---

## 搜索运算符（Search Operators）

在搜索端点的筛选条件中，可使用以下运算符：

| 运算符 | 说明 |
|--------|------|
| `EQ` | 等于 |
| `NEQ` | 不等于 |
| `LT` | 小于 |
| `LTE` | 小于或等于 |
| `GT` | 大于 |
| `GTE` | 大于或等于 |
| `CONTAINS_TOKEN` | 包含某词 |
| `NOT_CONTAINS_TOKEN` | 不包含某词 |
| `HAS_PROPERTY` | 具有值 |
| `NOT_HAS_PROPERTY` | 无值 |

---

## PowerShell 示例

在 Windows/PowerShell 环境中，请使用 Invoke-RestMethod：

```powershell
$headers = @{ 
  "Authorization" = "Bearer $env:HUBSPOT_ACCESS_TOKEN"
  "Content-Type" = "application/json" 
}

# List contacts
Invoke-RestMethod -Uri "https://api.hubapi.com/crm/v3/objects/contacts?limit=10" -Headers $headers

# Search contacts
$body = @{
  filterGroups = @(@{
    filters = @(@{
      propertyName = "email"
      operator = "CONTAINS_TOKEN"
      value = "example.com"
    })
  })
  limit = 10
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method POST -Uri "https://api.hubapi.com/crm/v3/objects/contacts/search" -Headers $headers -Body $body
```

---

## 注意事项

- 支持完整的 CRUD 操作（需具备相应权限范围）  
- 速率限制：私有应用每 10 秒最多 100 次请求  
- 分页：使用 `after` 参数（来自 `paging.next.after`）获取下一页数据  
- 门户 ID（Portal ID）位于记录 URL 中：`https://app-na2.hubspot.com/contacts/{portalId}/record/...`  