---
name: domainkits
name_zh: 域名
description: 域名情报工具包——按关键词搜索新注册域名（NRDS），或通过域名服务器（NS Reverse）反向查询域名。适用于域名投资者、品牌保护及研究场景。
description_zh: 域名情报工具包——按关键词搜索新注册域名（NRDS），或通过域名服务器（NS Reverse）反向查询域名。适用于域名投资者、品牌保护及研究场景。
metadata: {"clawdbot":{"emoji":"🌐","requires":{"bins":["curl"]},"homepage":"https://domainkits.com"}}
user-invocable: true
---
# DomainKits — 域名情报工具包

面向域名投资者、品牌管理者与研究人员的域名情报分析工具。

---

## 工具 1：search_nrds（新注册域名搜索）

搜索过去 1–7 天内注册的域名。

**接口地址：** `POST https://mcp.domainkits.com/mcp/nrds`

| 参数 | 类型 | 是否必需 | 默认值 | 描述 |
|------|------|----------|--------|------|
| keyword | 字符串 | 是 | - | 搜索关键词（仅限 a–z、0–9、连字符；最长 20 字符） |
| days | 整数 | 是 | - | 回溯天数：1–7 天 |
| position | 字符串 | 否 | any | `start`、`end` 或 `any` |
| tld | 字符串 | 否 | all | 筛选顶级域：`com`、`net`、`org` 等 |

**示例：**  
```bash
curl -X POST https://mcp.domainkits.com/mcp/nrds \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_nrds","arguments":{"keyword":"ai","days":7,"position":"start","tld":"com"}}}'
```

---

## 工具 2：search_ns_reverse（NS 反向查询）

查找托管于指定域名服务器上的通用顶级域（gTLD）域名。

**接口地址：** `POST https://mcp.domainkits.com/mcp/ns-reverse`

| 参数 | 类型 | 是否必需 | 默认值 | 描述 |
|------|------|----------|--------|------|
| ns | 字符串 | 是 | - | 域名服务器主机名（例如：`ns1.google.com`） |
| tld | 字符串 | 否 | all | 筛选顶级域：`com`、`net`、`org` 等 |
| min_len | 整数 | 否 | - | 域名前缀最小长度 |
| max_len | 整数 | 否 | - | 域名前缀最大长度 |

**示例：**  
```bash
curl -X POST https://mcp.domainkits.com/mcp/ns-reverse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_ns_reverse","arguments":{"ns":"ns1.cloudflare.com","tld":"com","min_len":4,"max_len":10}}}'
```

---

## 使用限制

- 每 IP 每分钟最多 10 次请求  
- 每次响应最多返回 5 个域名  
- NRDS 数据存在 24–48 小时延迟  

## 完整功能访问入口

- **NRDS 查询：** https://domainkits.com/search/new  
- **NS 反向查询：** https://domainkits.com/tools/ns-reverse  
```

---
```