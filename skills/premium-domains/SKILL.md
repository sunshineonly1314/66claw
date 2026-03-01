---
name: premium-domains
name_zh: 精品域名
description: 在 Afternic、Sedo、Atom、Dynadot、Namecheap、NameSilo 和 Unstoppable Domains 等平台搜索待售优质域名
description_zh: 在 Afternic、Sedo、Atom、Dynadot、Namecheap、NameSilo 和 Unstoppable Domains 等平台搜索待售优质域名
metadata: {"clawdbot":{"emoji":"💎","requires":{"bins":["curl"]}}}
---
# Premium Domain Search（优质域名搜索）

在主流域名交易市场中查找待售域名。免费 API，仅需 curl 调用。

## 使用方法

```bash
curl -s "https://api.domaindetails.com/api/marketplace/search?domain=example.com" | jq
```

## 涵盖的交易平台

- **Afternic** — GoDaddy 旗下的优质域名市场  
- **Sedo** — 全球性域名交易平台  
- **Atom** — 专注优质域名的市场  
- **Dynadot** — 提供拍卖与一口价列表  
- **Namecheap** — 整合于注册商平台的市场  
- **NameSilo** — 性价比突出的市场  
- **Unstoppable Domains** — Web3 域名  

## 返回字段说明

- `found` — 是否存在相关列表项  
- `marketplaces.<name>.listing.price` — 价格（单位为美分或美元）  
- `marketplaces.<name>.listing.currency` — 货币类型（如 USD、EUR 等）  
- `marketplaces.<name>.listing.url` — 列表详情页直链  
- `marketplaces.<name>.listing.listingType` — 交易方式（buy_now、auction 或 make_offer）  

## 请求频率限制

- 每分钟最多 100 次请求（无需身份认证）