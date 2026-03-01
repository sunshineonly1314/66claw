---
name: tailscale
name_zh: Tailscale
version: 1.0.0
description: 通过 CLI 和 API 管理 Tailscale 尾部网络。当用户要求“检查 tailscale 状态”、“列出 tailscale 设备”、“ping 某设备”、“通过 tailscale 发送文件”、“tailscale funnel”、“创建认证密钥”、“查看谁在线”，或提及 Tailscale 网络管理时使用。
description_zh: 通过 CLI 和 API 管理 Tailscale 尾部网络。当用户要求“检查 tailscale 状态”、“列出 tailscale 设备”、“ping 某设备”、“通过 tailscale 发送文件”、“tailscale funnel”、“创建认证密钥”、“查看谁在线”，或提及 Tailscale 网络管理时使用。
---
# Tailscale 技能  

混合型技能：本地操作使用 CLI，全尾部网络管理使用 API。

## 配置  

API 配置（可选，用于全尾部网络操作）： `~/.clawdbot/credentials/tailscale/config.json`  

```json
{
  "apiKey": "tskey-api-k...",
  "tailnet": "-"
}
```  

获取您的 API 密钥路径：Tailscale 管理控制台 → 设置 → 密钥 → 生成 API 密钥  

`tailnet` 可设为：`-`（自动识别）、您的组织名称，或您的邮箱域名。

---

## 本地操作（CLI）  

仅作用于当前机器。

### 状态与诊断  
```bash
# Current status (peers, connection state)
tailscale status
tailscale status --json | jq '.Peer | to_entries[] | {name: .value.HostName, ip: .value.TailscaleIPs[0], online: .value.Online}'

# Network diagnostics (NAT type, DERP, UDP)
tailscale netcheck
tailscale netcheck --format=json

# Get this machine's Tailscale IP
tailscale ip -4

# Identify a Tailscale IP
tailscale whois 100.x.x.x
```  

### 连通性  
```bash
# Ping a peer (shows direct vs relay)
tailscale ping <hostname-or-ip>

# Connect/disconnect
tailscale up
tailscale down

# Use an exit node
tailscale up --exit-node=<node-name>
tailscale exit-node list
tailscale exit-node suggest
```  

### 文件传输（Taildrop）  
```bash
# Send files to a device
tailscale file cp myfile.txt <device-name>:

# Receive files (moves from inbox to directory)
tailscale file get ~/Downloads
tailscale file get --wait ~/Downloads  # blocks until file arrives
```  

### 服务暴露  
```bash
# Share locally within tailnet (private)
tailscale serve 3000
tailscale serve https://localhost:8080

# Share publicly to internet
tailscale funnel 8080

# Check what's being served
tailscale serve status
tailscale funnel status
```  

### SSH  
```bash
# SSH via Tailscale (uses MagicDNS)
tailscale ssh user@hostname

# Enable SSH server on this machine
tailscale up --ssh
```  

---

## 全尾部网络操作（API）  

用于管理整个尾部网络，需配置 API 密钥。

### 列出全部设备  
```bash
./scripts/ts-api.sh devices

# With details
./scripts/ts-api.sh devices --verbose
```  

### 设备详情  
```bash
./scripts/ts-api.sh device <device-id-or-name>
```  

### 检查在线状态  
```bash
# Quick online check for all devices
./scripts/ts-api.sh online
```  

### 授权/删除设备  
```bash
./scripts/ts-api.sh authorize <device-id>
./scripts/ts-api.sh delete <device-id>
```  

### 设备标签与路由  
```bash
./scripts/ts-api.sh tags <device-id> tag:server,tag:prod
./scripts/ts-api.sh routes <device-id>
```  

### 认证密钥（Auth Keys）  
```bash
# Create a reusable auth key
./scripts/ts-api.sh create-key --reusable --tags tag:server

# Create ephemeral key (device auto-removes when offline)
./scripts/ts-api.sh create-key --ephemeral

# List keys
./scripts/ts-api.sh keys
```  

### DNS 管理  
```bash
./scripts/ts-api.sh dns                 # Show DNS config
./scripts/ts-api.sh dns-nameservers     # List nameservers
./scripts/ts-api.sh magic-dns on|off    # Toggle MagicDNS
```  

### 访问控制策略（ACLs）  
```bash
./scripts/ts-api.sh acl                 # Get current ACL
./scripts/ts-api.sh acl-validate <file> # Validate ACL file
```  

---

## 常见使用场景  

**“当前谁在线？”**  
```bash
./scripts/ts-api.sh online
```  

**“把该文件发送到我的手机”**  
```bash
tailscale file cp document.pdf my-phone:
```  

**“将我的开发服务器公开暴露”**  
```bash
tailscale funnel 3000
```  

**“为一台新服务器创建密钥”**  
```bash
./scripts/ts-api.sh create-key --reusable --tags tag:server --expiry 7d
```  

**“连接是直连还是经中继？”**  
```bash
tailscale ping my-server
```  