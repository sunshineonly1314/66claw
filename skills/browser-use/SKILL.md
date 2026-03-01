---
name: browser-use
name_zh: 浏览器使用
description: 使用 Browser Use 云 API 为 Clawdbot 启动云浏览器并运行自主浏览器任务。主要用途是创建带配置文件（持久化登录状态/ Cookie）的浏览器会话，供 Clawdbot 控制。次要用途是运行任务子智能体，实现快速自主浏览器自动化。文档位于 docs.browser-use.com 和 docs.cloud.browser-use.com。
description_zh: 使用 Browser Use 云 API 为 Clawdbot 启动云浏览器并运行自主浏览器任务。主要用途是创建带配置文件（持久化登录状态/ Cookie）的浏览器会话，供 Clawdbot 控制。次要用途是运行任务子智能体，实现快速自主浏览器自动化。文档位于 docs.browser-use.com 和 docs.cloud.browser-use.com。
---
# Browser Use

Browser Use 通过 API 提供云浏览器及自主浏览器自动化能力。

**文档：**  
- 开源库：https://docs.browser-use.com  
- 云 API：https://docs.cloud.browser-use.com  

## 配置

**API 密钥** 从 Clawdbot 配置中读取，路径为 `⟦skills`.entries.browser-use.apiKey⟧。

若未配置，请向用户提示：  
> To use Browser Use, you need an API key. Get one at https://cloud.browser-use.com (new signups get $10 free credit). Then configure it:
> ```
> clawdbot config set skills.entries.browser-use.apiKey "bu_your_key_here"
> ```
  
基础 URL：`https://api.browser-use.com/api/v2`  

所有请求均需携带请求头：`X-Browser-Use-API-Key: <apiKey>`  

---

## 1. 浏览器会话（主要用途）

为 Clawdbot 启动云浏览器，供其直接控制。使用配置文件以持久化登录状态和 Cookie。

### 创建浏览器会话

```bash
# With profile (recommended - keeps you logged in)
curl -X POST "https://api.browser-use.com/api/v2/browsers" \
  -H "X-Browser-Use-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"profileId": "<profile-uuid>", "timeout": 60}'

# Without profile (fresh browser)
curl -X POST "https://api.browser-use.com/api/v2/browsers" \
  -H "X-Browser-Use-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"timeout": 60}'
```

**响应：**  
```json
{
  "id": "session-uuid",
  "cdpUrl": "https://<id>.cdp2.browser-use.com",
  "liveUrl": "https://...",
  "status": "active"
}
```

### 将 Clawdbot 连接到该浏览器

```bash
gateway config.patch '{"browser":{"profiles":{"browseruse":{"cdpUrl":"<cdpUrl-from-response>"}}}}'
```

此后即可使用 `browser` 工具，并指定 `profile=browseruse` 来控制该浏览器。

### 列出 / 停止浏览器会话

```bash
# List active sessions
curl "https://api.browser-use.com/api/v2/browsers" -H "X-Browser-Use-API-Key: $API_KEY"

# Get session status
curl "https://api.browser-use.com/api/v2/browsers/<session-id>" -H "X-Browser-Use-API-Key: $API_KEY"

# Stop session (unused time is refunded)
curl -X PATCH "https://api.browser-use.com/api/v2/browsers/<session-id>" \
  -H "X-Browser-Use-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "stopped"}'
```

**定价：** $0.06/小时（按需付费）或 $0.03/小时（企业版）。单次会话最长 4 小时。按分钟计费，未使用时间将退款。

---

## 2. 配置文件

配置文件可在不同浏览器会话间持久化 Cookie 和登录状态。先创建一个配置文件，在浏览器中登录您的账号，之后即可重复使用。

```bash
# List profiles
curl "https://api.browser-use.com/api/v2/profiles" -H "X-Browser-Use-API-Key: $API_KEY"

# Create profile
curl -X POST "https://api.browser-use.com/api/v2/profiles" \
  -H "X-Browser-Use-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Profile"}'

# Delete profile
curl -X DELETE "https://api.browser-use.com/api/v2/profiles/<profile-id>" \
  -H "X-Browser-Use-API-Key: $API_KEY"
```

**提示：** 您还可借助 Browser Use Chrome 扩展程序，将本地 Chrome 浏览器中的 Cookie 同步至云端。

---

## 3. 任务（子智能体）

运行自主浏览器任务——即一个代您处理浏览器交互的子智能体。只需提供指令（prompt），它便会完成对应任务。

**务必使用 `browser-use-llm`** —— 专为浏览器任务优化，执行速度比其他模型快 3–5 倍。

```bash
curl -X POST "https://api.browser-use.com/api/v2/tasks" \
  -H "X-Browser-Use-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Go to amazon.com and find the price of the MacBook Air M3",
    "llm": "browser-use-llm"
  }'
```

### 轮询任务完成状态

```bash
curl "https://api.browser-use.com/api/v2/tasks/<task-id>" -H "X-Browser-Use-API-Key: $API_KEY"
```

**响应：**  
```json
{
  "status": "finished",
  "output": "The MacBook Air M3 is priced at $1,099",
  "isSuccess": true,
  "cost": "0.02"
}
```

状态值包括：`pending`、`running`、`finished`、`failed`、`stopped`

### 任务选项

| 选项 | 描述 |
|------|------|
| `task` | 您的指令（必填） |
| `llm` | 务必使用 `browser-use-llm` |
| `startUrl` | 起始页面 |
| `maxSteps` | 最大操作步数（默认为 100） |
| `sessionId` | 复用已有会话 |
| `profileId` | 使用配置文件进行身份认证 |
| `flashMode` | 更快的执行模式 |
| `vision` | 视觉理解能力 |

---

## 完整 API 参考

请参阅 [references/api.md](references/api.md)，其中包含全部端点说明，涵盖会话（Sessions）、文件（Files）、Skills 及 Skills 商店。