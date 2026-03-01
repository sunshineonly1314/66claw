---
name: nest-devices
name_zh: Nest设备
description: 通过 Device Access API 控制 Nest 智能家居设备（恒温器、摄像头、门铃）。当被要求检查或调节室内温度、查看摄像头画面、确认门口访客、监控房间状态，或设置温度日程时使用。
description_zh: 通过 Device Access API 控制 Nest 智能家居设备（恒温器、摄像头、门铃）。当被要求检查或调节室内温度、查看摄像头画面、确认门口访客、监控房间状态，或设置温度日程时使用。
metadata:
  clawdbot:
    emoji: "🏠"
---
# Nest 设备接入

通过 Google 的智能设备管理 API（Smart Device Management API）控制 Nest 设备。

## 配置步骤

### 1. Google Cloud 与 Device Access

1. 在 [console.cloud.google.com](https://console.cloud.google.com) 创建一个 Google Cloud 项目  
2. 支付 5 美元费用，并在 [console.nest.google.com/device-access](https://console.nest.google.com/device-access) 创建一个 Device Access 项目  
3. 创建 OAuth 2.0 凭据（Web 应用程序类型）  
4. 将 `https://www.google.com` 添加为已授权的重定向 URI  
5. 将您的 Nest 账户关联至该 Device Access 项目  

### 2. 获取刷新令牌（Refresh Token）

运行 OAuth 流程以获取刷新令牌：

```bash
# 1. Open this URL in browser (replace CLIENT_ID and PROJECT_ID):
https://nestservices.google.com/partnerconnections/PROJECT_ID/auth?redirect_uri=https://www.google.com&access_type=offline&prompt=consent&client_id=CLIENT_ID&response_type=code&scope=https://www.googleapis.com/auth/sdm.service

# 2. Authorize and copy the 'code' parameter from the redirect URL

# 3. Exchange code for tokens:
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=CLIENT_ID" \
  -d "client_secret=CLIENT_SECRET" \
  -d "code=AUTH_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=https://www.google.com"
```

### 3. 存储凭据

存储于 1Password 或环境变量中：

**1Password（推荐）：**  
新建一项，字段包括：`project_id`、`client_id`、`client_secret`、`refresh_token`

**环境变量：**  
```bash
export NEST_PROJECT_ID="your-project-id"
export NEST_CLIENT_ID="your-client-id"
export NEST_CLIENT_SECRET="your-client-secret"
export NEST_REFRESH_TOKEN="your-refresh-token"
```

## 使用方法

### 列出设备
```bash
python3 scripts/nest.py list
```

### 恒温器（Thermostat）

```bash
# Get status
python3 scripts/nest.py get <device_id>

# Set temperature (Celsius)
python3 scripts/nest.py set-temp <device_id> 21 --unit c --type heat

# Set temperature (Fahrenheit)
python3 scripts/nest.py set-temp <device_id> 70 --unit f --type heat

# Change mode (HEAT, COOL, HEATCOOL, OFF)
python3 scripts/nest.py set-mode <device_id> HEAT

# Eco mode
python3 scripts/nest.py set-eco <device_id> MANUAL_ECO
```

### 摄像头（Cameras）

```bash
# Generate live stream URL (RTSP, valid ~5 min)
python3 scripts/nest.py stream <device_id>
```

## Python API

```python
from nest import NestClient

client = NestClient()

# List devices
devices = client.list_devices()

# Thermostat control
client.set_heat_temperature(device_id, 21.0)  # Celsius
client.set_thermostat_mode(device_id, 'HEAT')
client.set_eco_mode(device_id, 'MANUAL_ECO')

# Camera stream
result = client.generate_stream(device_id)
rtsp_url = result['results']['streamUrls']['rtspUrl']
```

## 配置说明

脚本按以下顺序查找凭据：

1. **1Password**：设置 `NEST_OP_VAULT` 和 `NEST_OP_ITEM`（或使用默认值：保险库名称为 "Alfred"，条目名称为 "Nest Device Access API"）  
2. **环境变量**：`NEST_PROJECT_ID`、`NEST_CLIENT_ID`、`NEST_CLIENT_SECRET`、`NEST_REFRESH_TOKEN`

## 温度参考对照表

| 设置 | 摄氏度 | 华氏度 |
|---------|---------|------------|
| 节能模式（离家） | 15–17°C | 59–63°F |
| 舒适模式 | 19–21°C | 66–70°F |
| 温暖模式 | 22–23°C | 72–73°F |
| 夜间模式 | 17–18°C | 63–65°F |

---

## 实时事件（门铃、移动侦测等）

如需在有人按门铃或检测到移动时即时收到提醒，您需配置 Google Cloud Pub/Sub 并搭配 Webhook。

### 前置条件

- 已安装并完成身份验证的 Google Cloud CLI（`gcloud`）  
- Cloudflare 账户（免费版即可）用于建立隧道  
- 配置文件中已启用 Clawdbot hooks  

### 1. 启用 Clawdbot Hooks

在您的 `clawdbot.json` 中添加：

```json
{
  "hooks": {
    "enabled": true,
    "token": "your-secret-token-here"
  }
}
```

生成令牌：`openssl rand -hex 24`

### 2. 创建 Pub/Sub 主题（Topic）

```bash
gcloud config set project YOUR_GCP_PROJECT_ID

# Create topic
gcloud pubsub topics create nest-events

# Grant SDM permission to publish (both the service account and publisher group)
gcloud pubsub topics add-iam-policy-binding nest-events \
  --member="serviceAccount:sdm-prod@sdm-prod.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

gcloud pubsub topics add-iam-policy-binding nest-events \
  --member="group:sdm-publisher@googlegroups.com" \
  --role="roles/pubsub.publisher"
```

### 3. 将主题关联至 Device Access

访问 [console.nest.google.com/device-access](https://console.nest.google.com/device-access) → 您的项目 → 编辑 → 将 Pub/Sub 主题设为：

```
projects/YOUR_GCP_PROJECT_ID/topics/nest-events
```

### 4. 配置 Cloudflare 隧道

```bash
# Install cloudflared
curl -L -o ~/.local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x ~/.local/bin/cloudflared

# Authenticate (opens browser)
~/.local/bin/cloudflared tunnel login

# Create named tunnel
~/.local/bin/cloudflared tunnel create nest-webhook

# Note the Tunnel ID (UUID) from output
```

创建 `~/.cloudflared/config.yml`：

```yaml
tunnel: nest-webhook
credentials-file: /home/YOUR_USER/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: nest.yourdomain.com
    service: http://localhost:8420
  - service: http_status:404
```

配置 DNS 路由：

```bash
~/.local/bin/cloudflared tunnel route dns nest-webhook nest.yourdomain.com
```

### 5. 创建 systemd 服务

**Webhook 服务器**（`/etc/systemd/system/nest-webhook.service`）：

```ini
[Unit]
Description=Nest Pub/Sub Webhook Server
After=network.target

[Service]
Type=simple
User=YOUR_USER
Environment=CLAWDBOT_GATEWAY_URL=http://localhost:18789
Environment=CLAWDBOT_HOOKS_TOKEN=your-hooks-token-here
ExecStart=/usr/bin/python3 /path/to/skills/nest-devices/scripts/nest-webhook.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Cloudflare 隧道**（`/etc/systemd/system/cloudflared-nest.service`）：

```ini
[Unit]
Description=Cloudflare Tunnel for Nest Webhook
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USER
ExecStart=/home/YOUR_USER/.local/bin/cloudflared tunnel run nest-webhook
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nest-webhook cloudflared-nest
```

### 6. 创建 Pub/Sub 推送订阅（Push Subscription）

```bash
gcloud pubsub subscriptions create nest-events-sub \
  --topic=nest-events \
  --push-endpoint="https://nest.yourdomain.com/nest/events" \
  --ack-deadline=30
```

### 7. 测试

```bash
# Test webhook endpoint
curl https://nest.yourdomain.com/health

# Simulate doorbell event
curl -X POST http://localhost:8420/nest/events \
  -H "Content-Type: application/json" \
  -d '{"message":{"data":"eyJyZXNvdXJjZVVwZGF0ZSI6eyJuYW1lIjoiZW50ZXJwcmlzZXMvdGVzdC9kZXZpY2VzL0RPT1JCRUxMLTAxIiwiZXZlbnRzIjp7InNkbS5kZXZpY2VzLmV2ZW50cy5Eb29yYmVsbENoaW1lLkNoaW1lIjp7ImV2ZW50SWQiOiJ0ZXN0In19fX0="}}'
```

### 支持的事件类型

| 事件 | 行为 |
|-------|-----------|
| `DoorbellChime.Chime` | 🔔 **提醒** — 向 Telegram 发送照片 |
| `CameraPerson.Person` | 🚶 **提醒** — 向 Telegram 发送照片 |
| `CameraMotion.Motion` | 📹 仅记录（不触发提醒） |
| `CameraSound.Sound` | 🔊 仅记录（不触发提醒） |
| `CameraClipPreview.ClipPreview` | 🎬 仅记录（不触发提醒） |

> **Staleness filter:** Events older than 5 minutes are logged but never alerted. This prevents notification floods if queued Pub/Sub messages are delivered late.

### 图像捕获机制

当门铃或人员事件触发提醒时：

1. **主路径**：SDM `GenerateImage` API — 快速、事件专属快照  
2. **备用路径**：通过 `ffmpeg` 对 RTSP 直播流进行帧捕获（需已安装 `ffmpeg`）  

### 环境变量说明

| 变量 | 是否必需 | 描述 |
|----------|----------|-------------|
| `CLAWDBOT_GATEWAY_URL` | 否 | 网关 URL（默认值：`http://localhost:18789`） |
| `CLAWDBOT_HOOKS_TOKEN` | 是 | 网关 hooks 令牌，用于感知类通知 |
| `OP_SVC_ACCT_TOKEN` | 是 | 1Password 服务账号令牌，用于获取 Nest API 凭据 |
| `TELEGRAM_BOT_TOKEN` | 是 | Telegram 机器人令牌，用于发送提醒 |
| `TELEGRAM_CHAT_ID` | 是 | Telegram 聊天 ID，用于接收提醒 |
| `PORT` | 否 | Webhook 服务器端口（默认值：`8420`） |

### 重要配置注意事项

- **请严格核对 Device Access 控制台中完整的 Pub/Sub 主题路径**，确保其与您的 GCP 项目完全一致：`projects/YOUR_GCP_PROJECT_ID/topics/nest-events`  
- **必须使用推送订阅（push subscription），而非拉取订阅（pull subscription）** — Webhook 期望通过 HTTP POST 接收消息  
- **配置完成后务必进行端到端测试**：按下门铃并确认照片成功送达。切勿仅依赖模拟的 POST 请求进行验证。

---

## 局限性

- 摄像头事件图像约 5 分钟后过期（RTSP 备用路径将捕获当前直播帧）  
- 实时事件依赖 Pub/Sub 配置（详见上文）  
- 无 Cloudflare 账户的快速隧道（quick tunnel）不提供正常运行时间保障  
- 部分较老款 Nest 设备可能不支持全部功能  
- 为避免通知疲劳，系统有意未对移动和声音事件触发提醒  