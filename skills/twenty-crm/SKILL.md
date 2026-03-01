---
name: twenty-crm
name_zh: Twenty CRM
description: 通过 REST/GraphQL 与 Twenty CRM（自托管版）交互。
description_zh: 通过 REST/GraphQL 与 Twenty CRM（自托管版）交互。
metadata: {"clawdbot":{"emoji":"🗂️","os":["darwin","linux"]}}
---
# Twenty CRM

通过 REST 和 GraphQL 与您自托管的 Twenty 实例进行交互。

## 配置

创建 `config/twenty.env`（示例见 `config/twenty.env.example`）：

- `TWENTY_BASE_URL`（例如 `https://crm.example.com` 或 `http://localhost:3000`）  
- `TWENTY_API_KEY`（Bearer token）

脚本将自动加载此文件。

## 命令

### 低阶辅助命令

- REST GET：`skills/twenty-crm/scripts/twenty-rest-get.sh "/companies" 'filter={"name":{"ilike":"%acme%"}}&limit=10'`  
- REST POST：`skills/twenty-crm/scripts/twenty-rest-post.sh "/companies" '{"name":"Acme"}'`  
- REST PATCH：`skills/twenty-crm/scripts/twenty-rest-patch.sh "/companies/<id>" '{"employees":550}'`  
- REST DELETE：`skills/twenty-crm/scripts/twenty-rest-delete.sh "/companies/<id>"`  

- GraphQL：`skills/twenty-crm/scripts/twenty-graphql.sh 'query { companies(limit: 5) { totalCount } }'`  

### 常见对象操作（示例）

- 创建公司：`skills/twenty-crm/scripts/twenty-create-company.sh "Acme" "acme.com" 500`  
- 按名称查找公司：`skills/twenty-crm/scripts/twenty-find-companies.sh "acme" 10`  

## 注意事项

- Twenty 同时支持 REST（`/rest/...`）与 GraphQL（`/graphql`）。  
- 对象名称/端点可能因您的工作区元数据及 Twenty 版本而异。  
- 认证令牌有效期可能较短（取决于您的配置）；若收到 `401` 错误，请刷新令牌。  