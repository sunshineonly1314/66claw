---
name: nameserver-reverse
description: 通过兼容 MCP 协议的客户端提供域名情报工具。
description_zh: 通过兼容 MCP 协议的客户端提供域名情报工具。
---
# DomainKits MCP 服务器

通过兼容 MCP 协议的客户端提供域名情报工具。

## 接口端点

| 接口端点 | 描述 |
|----------|------|
| `https://mcp.domainkits.com/mcp/nrds` | 新注册域名搜索（Newly Registered Domains Search） |
| `https://mcp.domainkits.com/mcp/ns-reverse` | NS 反向查询（NS Reverse Lookup） |

## 配置

### Claude Desktop

编辑配置文件：  
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
```json
{
  "mcpServers": {
    "domainkits-nrds": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.domainkits.com/mcp/nrds",
        "--transport",
        "http-first"
      ]
    },
    "domainkits-ns-reverse": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.domainkits.com/mcp/ns-reverse",
        "--transport",
        "http-first"
      ]
    }
  }
}
```

### Cursor

编辑 `~/.cursor/mcp.json`：  
```json
{
  "mcpServers": {
    "domainkits-nrds": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.domainkits.com/mcp/nrds"]
    },
    "domainkits-ns-reverse": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.domainkits.com/mcp/ns-reverse"]
    }
  }
}
```

---
### Gemini CLI

```bash
gemini extensions install https://github.com/ABTdomain/domainkits-mcp
```


## 工具

### search_nrds

按关键词搜索新注册域名。

**参数：**

| 名称 | 类型 | 是否必需 | 默认值 | 描述 |
|------|------|----------|--------|------|
| keyword | 字符串 | 是 | - | 搜索词（仅限 a-z、0-9、连字符，最多 20 个字符） |
| days | 整数 | 是 | - | 1–7 天 |
| position | 字符串 | 否 | any | `start`、`end` 或 `any` |
| tld | 字符串 | 否 | all | 按顶级域（TLD）过滤（例如：`com`、`net`、`org`） |

**示例：**  
```bash
curl -X POST https://mcp.domainkits.com/mcp/nrds \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_nrds","arguments":{"keyword":"ai","days":7,"position":"start","tld":"com"}}}'
```

---

### search_ns_reverse

查询托管于指定域名服务器（nameserver）上的 gTLD 域名。

**参数：**

| 名称 | 类型 | 是否必需 | 默认值 | 描述 |
|------|------|----------|--------|------|
| ns | 字符串 | 是 | - | 域名服务器主机名（例如：`ns1.google.com`） |
| tld | 字符串 | 否 | all | 按顶级域（TLD）过滤（例如：`com`、`net`、`org`） |
| min_len | 整数 | 否 | - | 域名前缀最小长度 |
| max_len | 整数 | 否 | - | 域名前缀最大长度 |

**示例：**  
```bash
curl -X POST https://mcp.domainkits.com/mcp/ns-reverse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_ns_reverse","arguments":{"ns":"ns1.google.com","tld":"com","min_len":4,"max_len":8}}}'
```

---

## 限制

- 每 IP 每分钟最多 10 次请求  
- 每次响应最多返回 5 个域名  
- NRDS 数据可能存在 24–48 小时延迟  

## 完整访问权限

如需完整结果、高级筛选及导出功能：  
- **NRDS**：[domainkits.com/search/new](https://domainkits.com/search/new)  
- **NS 反向查询**：[domainkits.com/tools/ns-reverse](https://domainkits.com/tools/ns-reverse)  

## 关于

[DomainKits](https://domainkits.com) —— 面向投资者、品牌管理者与研究人员的域名情报工具。

## 隐私政策

- IP 地址经匿名化处理  
- 搜索查询经匿名化处理  
- 日志保留时长为 7 天  
- 不收集任何个人数据  

## 许可证

MIT  