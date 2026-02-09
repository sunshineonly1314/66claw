# 运维手册：License 验证中国区降级方案

> **事件**：2026-02-08 起大量中国内陆用户 License 验证失败（`fetch failed`）
> **影响**：新用户无法激活，已激活用户离线宽限期到期后功能受限
> **根因**：`www.tecbinai.com`（腾讯云香港）从内陆访问不稳定
> **代码修复**：已合入多 URL 自动降级机制（见末尾「代码变更清单」）
整理成运维手册：需要你做的事
配置备用域名 license.tecbinai.com（DNS 解析到同一台腾讯云 HK 服务器，或用内陆 CDN/反代）。如果你有内陆服务器（比如技能镜像那台 121.43.61.90），可以直接用 IP：


apiFallbackUrls: ["http://121.43.61.90/api/api/v1/license"],
紧急临时方案：对正在报错的客户，让他们设环境变量绕过 DNS：


CLAWDBOT_LICENSE_API_URL=https://IP地址/api/api/v1/license
排查根因：www.tecbinai.com 从内陆最近大面积不通，可能是：

域名没有 ICP 备案 → 部分省份 ISP 拦截
腾讯云 HK 节点跨境带宽紧张
DNS 被 SNI 检测命中
建议 curl -v https://www.tecbinai.com/api/api/v1/license/health 从几个内陆节点测一下。
---

## 一、紧急止血（10 分钟内可完成）

### 1.1 客户自助：设置环境变量

对正在报错的客户，指导其设置环境变量直连 IP，绕过 DNS 解析：

**Windows（PowerShell 管理员）：**

```powershell
# 替换 <IP> 为实际可达的服务器 IP
[System.Environment]::SetEnvironmentVariable(
  'CLAWDBOT_LICENSE_API_URL',
  'https://<IP>/api/api/v1/license',
  'User'
)
```

设置后重启 Clawdbot Gateway 即可生效。

**Linux / macOS：**

```bash
# 写入 shell profile（替换 <IP> 为实际可达的服务器 IP）
echo 'export CLAWDBOT_LICENSE_API_URL="https://<IP>/api/api/v1/license"' >> ~/.bashrc
source ~/.bashrc
```

**Docker：**

```yaml
# docker-compose.yml
environment:
  - CLAWDBOT_LICENSE_API_URL=https://<IP>/api/api/v1/license
```

### 1.2 获取可用 IP

```bash
# 从能正常访问的机器上解析当前 IP
dig +short www.tecbinai.com
nslookup www.tecbinai.com
```

将解析到的 IP 提供给客户使用。

---

## 二、配置备用域名（推荐，1 小时内完成）

### 2.1 方案 A：新建子域名（推荐）

创建 `license.tecbinai.com`，DNS 解析到同一台腾讯云 HK 服务器：

```
license.tecbinai.com  →  A 记录  →  <腾讯云 HK 服务器 IP>
```

**优点**：SNI 域名不同，可能绕过部分 ISP 的 SNI 检测拦截。

**Nginx 配置**（在 HK 服务器上添加）：

```nginx
server {
    listen 443 ssl;
    server_name license.tecbinai.com;

    # 使用同一套证书（通配符证书）或单独申请
    ssl_certificate     /etc/ssl/certs/tecbinai.com.pem;
    ssl_certificate_key /etc/ssl/private/tecbinai.com.key;

    location /api/api/v1/license/ {
        proxy_pass http://127.0.0.1:<license-service-port>/api/api/v1/license/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

配置完成后，更新代码中的备用 URL：

```typescript
// src/gateway/license-check.ts
apiFallbackUrls: [
  "https://license.tecbinai.com/api/api/v1/license",
],
```

### 2.2 方案 B：利用现有内陆服务器反代

如果已有内陆服务器（如技能镜像 `121.43.61.90`），在上面配置反向代理：

```nginx
# 在 121.43.61.90 上添加
location /api/api/v1/license/ {
    proxy_pass https://www.tecbinai.com/api/api/v1/license/;
    proxy_ssl_server_name on;
    proxy_set_header Host www.tecbinai.com;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_connect_timeout 10s;
    proxy_read_timeout    30s;
}
```

更新代码：

```typescript
// src/gateway/license-check.ts
apiFallbackUrls: [
  "http://121.43.61.90/api/api/v1/license",
],
```

> **注意**：内陆服务器需有 ICP 备案。HTTP（非 HTTPS）可在内网/专线场景使用；
> 公网环境建议配置 HTTPS，避免中间人篡改 License 响应。

### 2.3 方案 C：腾讯云 CDN / Global Accelerator

如果问题是跨境带宽而非 DNS/SNI：

1. 腾讯云全球加速（GA）：为 HK 服务器配置中国内陆加速入口
2. 腾讯云 CDN：动态加速（DSA）模式，域名需 ICP 备案
3. Cloudflare：免费方案自带全球 Anycast，但域名需转入 CF 管理

---

## 三、排查根因

### 3.1 多节点连通性测试

从不同省份/ISP 测试（推荐使用 [boce.com](https://www.boce.com/) 或 [ping.chinaz.com](https://ping.chinaz.com/)）：

```bash
# 基础连通
curl -v --connect-timeout 10 https://www.tecbinai.com/api/api/v1/license/health

# DNS 解析耗时
time dig www.tecbinai.com

# TCP 握手 + TLS 耗时
curl -w "dns: %{time_namelookup}s\ntcp: %{time_connect}s\ntls: %{time_appconnect}s\ntotal: %{time_total}s\n" \
     -o /dev/null -s https://www.tecbinai.com/api/api/v1/license/health

# 跳过 DNS，直接用 IP 测试（区分 DNS 问题 vs 网络问题）
curl -v --connect-timeout 10 \
     --resolve "www.tecbinai.com:443:<IP>" \
     https://www.tecbinai.com/api/api/v1/license/health
```

### 3.2 常见根因判断

| 现象 | 可能原因 | 验证方法 | 解决方案 |
|------|----------|----------|----------|
| `ENOTFOUND` / DNS 超时 | DNS 解析失败 | `dig www.tecbinai.com @8.8.8.8` vs `@114.114.114.114` | 换 DNS 或用 IP 直连 |
| TCP 连接超时 | 跨境网络不通 / GFW 干扰 | `telnet <IP> 443` | 方案 B（内陆反代）或 方案 C（加速器） |
| TLS 握手失败 | SNI 被检测拦截 | `openssl s_client -connect <IP>:443 -servername www.tecbinai.com` | 方案 A（换域名换 SNI） |
| HTTP 可达但慢（>10s） | 跨境带宽拥塞 | 用 `curl -w` 观测各阶段耗时 | 方案 C（CDN/加速器） |
| 部分省份不通，部分正常 | ICP 备案问题 / ISP 策略 | 多省份多 ISP 交叉测试 | 域名备案 + 内陆节点 |

### 3.3 ICP 备案检查

```bash
# 查询域名是否有 ICP 备案
# 访问：https://beian.miit.gov.cn/
# 查询：tecbinai.com
```

未备案的域名在中国内陆可能被部分 ISP 间歇性拦截（尤其移动、广电）。
如果未备案且短期无法完成，优先使用方案 B（已备案的内陆服务器反代）。

---

## 四、验证修复

### 4.1 代码部署后

新版 Gateway 启动日志应显示：

```
# CN 用户正常启动
[gateway:license] Checking license on gateway start...
[license:verify] Sending POST request to https://www.tecbinai.com/api/api/v1/license/verify

# 主 URL 失败时自动降级
[license:verify] Network failed on https://www.tecbinai.com/.../verify → ENOTFOUND (...), trying fallback...
[license:verify] [fallback 1/1] Sending POST request to https://license.tecbinai.com/.../verify
[license:verify] Fallback URL succeeded: https://license.tecbinai.com/api/api/v1/license
```

### 4.2 验证清单

- [ ] 主 URL 正常时：直接通过，不触发降级
- [ ] 主 URL 网络失败时：自动降级到备用 URL
- [ ] 主 URL HTTP 错误时（4xx/5xx）：**不降级**（服务端能响应说明网络通了）
- [ ] 所有 URL 都失败时：进入离线模式（CN 用户 48h 宽限）
- [ ] 环境变量 `CLAWDBOT_LICENSE_API_URL` 设置时：覆盖主 URL
- [ ] Setup Wizard 输入授权码验证：使用已配置的降级逻辑（3 次重试）
- [ ] 错误日志包含详细信息：`ENOTFOUND` / `ECONNREFUSED` / `ETIMEDOUT`（不再是 `fetch failed`）

### 4.3 客户回访话术

> 您好，我们已定位到近期授权验证失败的原因（内陆到香港服务器的网络波动），
> 新版本已增加自动降级和备用线路支持。请更新到最新版后重试。
> 如仍有问题，可临时设置环境变量 `CLAWDBOT_LICENSE_API_URL` 直连服务器 IP。

---

## 五、代码变更清单

| 文件 | 变更 |
|------|------|
| `src/license/types.ts` | `LicenseModuleConfig` 新增 `apiFallbackUrls?: string[]` |
| `src/license/verify.ts` | `sendRequest()` 支持多 URL 降级 + 网络错误诊断增强 |
| `src/license/startup.ts` | 支持 `CLAWDBOT_LICENSE_API_URL` 环境变量覆盖 |
| `src/gateway/license-check.ts` | CN 区域自动注入备用 URL + 离线宽限期 48h |
| `src/gateway/setup-wizard.ts` | Setup Wizard 重试次数 2→3 |

### 降级架构图

```
客户端 sendRequest()
  │
  ├─ 尝试 ① apiBaseUrl (www.tecbinai.com)
  │   └─ 网络失败? ──→ 记录 ENOTFOUND/ETIMEDOUT 等详细信息
  │
  ├─ 尝试 ② apiFallbackUrls[0] (license.tecbinai.com / 121.43.61.90)
  │   └─ 成功? ──→ 返回结果
  │
  └─ 全部失败 ──→ 离线模式（CN: 48h / 其他: 24h）
         │
         └─ 离线缓存有效? ──→ canProceed: true
         └─ 离线缓存过期? ──→ 需要用户重新联网验证
```

---

## 六、长期优化建议

1. **内陆专用节点**：在已备案的阿里云/腾讯云内陆区域部署 License API 镜像
2. **健康检查探针**：部署定时任务从多省份探测 License API 可达性，异常时自动告警
3. **客户端网络诊断**：在 Setup Wizard 验证失败时，自动运行连通性检测并展示给用户
4. **离线体验优化**：离线模式下明确告知用户「离线运行中，剩余 Xh」，而非静默降级
