---
name: uptime-kuma
name_zh: Uptime Kuma
description: 与 Uptime Kuma 监控服务器交互。用于检查监控项状态、增删监控项、暂停/恢复检测、查看心跳历史。当用户提及 Uptime Kuma、服务器监控、正常运行时间检查或服务健康监控时触发。
description_zh: 与 Uptime Kuma 监控服务器交互。用于检查监控项状态、增删监控项、暂停/恢复检测、查看心跳历史。当用户提及 Uptime Kuma、服务器监控、正常运行时间检查或服务健康监控时触发。
---
# Uptime Kuma Skill

通过 Socket.IO API 的 CLI 封装工具管理 Uptime Kuma 监控项。

## 设置

需安装 `uptime-kuma-api` Python 包：
```bash
pip install uptime-kuma-api
```

环境变量（在 shell 或 Clawdbot 配置中设置）：
- `UPTIME_KUMA_URL` —— 服务器 URL（例如：`http://localhost:3001`）
- `UPTIME_KUMA_USERNAME` —— 登录用户名
- `UPTIME_KUMA_PASSWORD` —— 登录密码

## 使用方法

脚本位置：`scripts/kuma.py`

### 命令列表

```bash
# Overall status summary
python scripts/kuma.py status

# List all monitors
python scripts/kuma.py list
python scripts/kuma.py list --json

# Get monitor details
python scripts/kuma.py get <id>

# Add monitors
python scripts/kuma.py add --name "My Site" --type http --url https://example.com
python scripts/kuma.py add --name "Server Ping" --type ping --hostname 192.168.1.1
python scripts/kuma.py add --name "SSH Port" --type port --hostname server.local --port 22

# Pause/resume monitors
python scripts/kuma.py pause <id>
python scripts/kuma.py resume <id>

# Delete monitor
python scripts/kuma.py delete <id>

# View heartbeat history
python scripts/kuma.py heartbeats <id> --hours 24

# List notification channels
python scripts/kuma.py notifications
```

### 监控类型

- `http` —— HTTP/HTTPS 端点  
- `ping` —— ICMP ping  
- `port` —— TCP 端口检测  
- `keyword` —— HTTP + 关键词搜索  
- `dns` —— DNS 解析  
- `docker` —— Docker 容器  
- `push` —— 推送式（被动）监控  
- `mysql`、`postgres`、`mongodb`、`redis` —— 数据库检测  
- `mqtt` —— MQTT 代理  
- `group` —— 监控组  

### 常见工作流

**检查当前宕机项：**  
```bash
python scripts/kuma.py status
python scripts/kuma.py list  # Look for 🔴
```

**添加间隔 30 秒的 HTTP 监控项：**  
```bash
python scripts/kuma.py add --name "API Health" --type http --url https://api.example.com/health --interval 30
```

**维护模式（暂停全部监控）：**  
```bash
for id in $(python scripts/kuma.py list --json | jq -r '.[].id'); do
  python scripts/kuma.py pause $id
done
```