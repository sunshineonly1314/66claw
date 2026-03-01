---
name: pihole
description: 通过 Pi-hole v6 API 控制您的 Pi-hole DNS 广告拦截器。
description_zh: 通过 Pi-hole v6 API 控制您的 Pi-hole DNS 广告拦截器。
---
# Pi-hole 技能

通过 Pi-hole v6 API 控制您的 Pi-hole DNS 广告拦截器。

## 设置

在 Clawdbot 配置中设置 Pi-hole API 配置：

```yaml
skills:
  entries:
    pihole:
      apiUrl: "https://pi-hole.local/api"  # v6 API path
      apiToken: "your-app-password-here"       # Get from Pi-hole Admin
      insecure: false                          # Set to true for self-signed certs
```

或者，设置环境变量：
```bash
export PIHOLE_API_URL="https://pi-hole.local/api"
export PIHOLE_API_TOKEN="your-app-password-here"
export PIHOLE_INSECURE="false"
```

### 获取 API 凭据

1. 在 `http://pi-hole.local/admin` 打开 Pi-hole 管理后台  
2. 进入 **Settings（设置）** > **API（API）**  
3. 生成一个应用密码（app password）  
4. 将该密码用作 `apiToken`  

## 功能能力

### 状态查询
- 获取当前 Pi-hole 状态（启用/禁用）  
- 查看统计信息：已拦截查询数、今日查询总数、当前被拦截域名数、活跃客户端数  
- 查看近期查询活动  

### 控制指令
- **启用/禁用**：开启或关闭 Pi-hole  
- **禁用 5 分钟**：临时关闭广告拦截功能，持续 5 分钟  
- **自定义时长禁用**：设定精确的禁用时长（单位：分钟）  

### 拦截分析
- **检查被拦截域名**：查看指定时间窗口内被拦截的域名  
- **显示高频被拦截域名**：列出被拦截次数最多的域名  

## 使用示例

```
# Check Pi-hole status
"pihole status"

# Turn off ad blocking
"pihole off"

# Turn on ad blocking
"pihole on"

# Disable for 5 minutes (for a site that needs ads)
"pihole disable 5m"

# Disable for 30 minutes
"pihole disable 30"

# See what was blocked in the last 30 minutes
"pihole blocked"

# See blocked domains in last 10 minutes (600 seconds)
"pihole blocked 600"

# Show statistics
"pihole stats"
```

## API 接口（Pi-hole v6）

### 认证
```
POST /api/auth
Content-Type: application/json
{"password":"your-app-password"}

Response:
{
  "session": {
    "sid": "session-token-here",
    "validity": 1800
  }
}
```

### 状态
```
GET /api/dns/blocking
Headers: sid: <session-token>

Response:
{
  "blocking": "enabled" | "disabled",
  "timer": 30  // seconds until re-enable (if disabled with timer)
}
```

### 启用/禁用
```
POST /api/dns/blocking
Headers: sid: <session-token>
Content-Type: application/json

Enable:
{"blocking":true}

Disable:
{"blocking":false}

Disable with timer (seconds):
{"blocking":false,"timer":300}
```

### 统计信息
```
GET /api/stats/summary
Headers: sid: <session-token>

Response:
{
  "queries": {
    "total": 233512,
    "blocked": 23496,
    "percent_blocked": 10.06
  },
  "gravity": {
    "domains_being_blocked": 165606
  },
  "clients": {
    "active": 45
  }
}
```

### 查询记录
```
GET /api/queries?start=-<seconds>
Headers: sid: <session-token>

Response:
{
  "queries": [
    {
      "domain": "example.com",
      "status": "GRAVITY",
      "time": 1768363900,
      "type": "A"
    }
  ]
}
```

## v5 与 v6 API 差异

Pi-hole v6 引入了重大 API 变更：

| 功能 | v5 API | v6 API |
|---------|----------|----------|
| 基础 URL | `/admin/api.php` | `/api` |
| 认证方式 | 令牌置于 URL 或请求头中 | 基于会话 |
| 状态查询 | `?status` | `/api/dns/blocking` |
| 统计信息 | `?summaryRaw` | `/api/stats/summary` |
| 查询记录 | `?recentBlocked` | `/api/queries` |
| 白名单 | API 支持 | **API 不再支持** |

**重要提示：** 域名白名单功能已无法通过 v6 API 实现，您必须通过 Pi-hole 管理后台 UI 手动添加白名单。

## SSL 证书

### 生产环境（有效证书）
```yaml
{
  "apiUrl": "https://pi-hole.example.com/api",
  "apiToken": "...",
  "insecure": false
}
```

### 自签名证书 / 本地证书
```yaml
{
  "apiUrl": "https://pi-hole.local/api",
  "apiToken": "...",
  "insecure": true
}
```

`insecure` 标志为 curl 添加 `-k` 选项，用于跳过证书验证。

## 安全说明

- 会话令牌 30 分钟（1800 秒）后自动过期  
- API 密码通过 JSON 请求体发送，而非 URL  
- 所有请求均设定了 30 秒超时  
- 令牌不会出现在进程列表中（通过环境变量传递）  

## 故障排查

### “认证失败”
- 检查 `apiToken` 是否与 Pi-hole 应用密码一致  
- 验证 `apiUrl` 是否正确（结尾必须为 `/api`）  
- 确保 Pi-hole 可从当前网络访问  

### “无法确定状态”
- 检查 API URL 是否可达  
- 若使用 HTTPS + 自签名证书，请设置 `insecure: true`  
- 验证 API 密码是否正确  

### 网络错误
- 确保 clawdbot 所在机器可访问 Pi-hole  
- 检查防火墙规则是否允许 API 访问  
- 验证 URL 协议（http vs https）是否正确  

## 前置要求

- Pi-hole v6 或更高版本  
- 已在 Pi-hole 管理后台生成应用密码  
- 网络可访问 Pi-hole API  
- `curl`、`jq`（大多数 Unix 系统已预装）  