---
name: novafon_api
name_zh: Novafon
description: Novafon 数据 API 与呼叫 API 集成及请求示例——通过 JSON-RPC 操作数据、报表及电话呼叫管理。
description_zh: Novafon 数据 API 与呼叫 API 集成及请求示例——通过 JSON-RPC 操作数据、报表及电话呼叫管理。
metadata: {"clawdbot":{"emoji":"📞","always":true,"requires":{"bins":["curl","jq"]}}}
---
# Novafon API 📞

Novafon 提供两个 JSON-RPC API：用于访问数据与报表的 **Data API**，以及用于创建和管理电话呼叫的 **Call API**。:contentReference[oaicite:1]{index=1}

## 🔑 配置

### 📦 环境变量

| 变量 | 描述 | 是否必需 |
|------|------|----------|
| `NOVAFON\_DATA\_API\_URL` | Data API 基础 URL（通常为 dataapi-jsonrpc.novofon.ru/v2.0） | 是 |
| `NOVAFON\_CALL\_API\_URL` | Call API 基础 URL（通常为 callapi-jsonrpc.novofon.ru/v4.0） | 是 |
| `NOVAFON\_API\_TOKEN` | 有效的 \*\*access\_token\*\*（API 密钥或会话令牌） | 是 |

---

## 🧠 概述

📌 两个 API 均采用 \*\*JSON-RPC 2.0\*\*（HTTP POST 方法，请求体为 JSON）。:contentReference[oaicite:2]{index=2}  
📌 所有参数与字段均使用 \*\*snake\_case\*\* 命名风格。:contentReference[oaicite:3]{index=3}  
📌 需在管理员后台将您的 IP 地址加入白名单。:contentReference[oaicite:4]{index=4}

---

## 🗂 Data API — 数据与报表操作

### 📌 基本原则

\- 基础 URL：`${NOVAFON\_DATA\_API\_URL}` → JSON-RPC 请求。:contentReference[oaicite:5]{index=5}  
\- 错误处理机制详尽（含错误码与助记符）。:contentReference[oaicite:6]{index=6}  
\- 支持过滤、排序与分页。:contentReference[oaicite:7]{index=7}

---

### 📊 📈 📉 基础请求示例

```bash
# Data API 基础请求示例
curl -s "${NOVAFON\_DATA\_API\_URL}" \\
&nbsp; -H "Content-Type: application/json" \\
&nbsp; -d '{
&nbsp;   "jsonrpc":"2.0",
&nbsp;   "id":"req1",
&nbsp;   "method":"get.account",
&nbsp;   "params":{
&nbsp;     "access\_token":"'"${NOVAFON\_API\_TOKEN}"'"
&nbsp;   }
&nbsp; }' | jq '.'
```