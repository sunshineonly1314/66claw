---
name: domaindetails
name_zh: 域名详情
description: 查询域名 WHOIS/RDAP 信息并检查域名交易平台挂牌情况。免费 API，无需身份认证。
description_zh: 查询域名 WHOIS/RDAP 信息并检查域名交易平台挂牌情况。免费 API，无需身份认证。
metadata: {"clawdbot":{"emoji":"🌐","requires":{"bins":["curl"]}}}
---
# domaindetails

域名信息查询与交易平台搜索。免费 API，仅需 curl 即可调用。

## 域名查询

```bash
curl -s "https://mcp.domaindetails.com/lookup/example.com" | jq
```

返回信息：注册商、创建/过期日期、域名服务器、DNSSEC 状态、联系人信息。

## 交易平台搜索

```bash
curl -s "https://api.domaindetails.com/api/marketplace/search?domain=example.com" | jq
```

返回来自以下平台的挂牌信息：Sedo、Afternic、Atom、Dynadot、Namecheap、NameSilo、Unstoppable Domains。

## 请求频率限制

- 每分钟最多 100 次请求（无需身份认证）

## CLI 工具（可选）

```bash
npx domaindetails example.com
```