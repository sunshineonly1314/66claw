---
name: network-scanner
name_zh: 网络扫描器
description: 扫描网络以发现设备、收集 MAC 地址、厂商信息和主机名。支持配置文件中预定义的已知网络，或自定义 CIDR 地址段。
description_zh: 扫描网络以发现设备、收集 MAC 地址、厂商信息和主机名。支持配置文件中预定义的已知网络，或自定义 CIDR 地址段。
homepage: https://github.com/clawdbot/skills
metadata:
  clawdbot:
    emoji: "🔍"
    requires:
      bins: ["nmap", "dig"]
    tags:
      - network
      - discovery
      - devices
      - nmap
---
# 网络扫描器

使用 nmap 发现并识别本地或远程网络中的设备。可收集 IP 地址、主机名（通过反向 DNS 查询）、MAC 地址及厂商识别信息。

## 前置依赖

- `nmap` — 网络扫描工具（`apt install nmap` 或 `brew install nmap`）  
- `dig` — DNS 查询工具（通常已预装）  
- `sudo` 权限推荐用于 MAC 地址识别  

## 快速开始

```bash
# Auto-detect and scan current network
python3 scripts/scan.py

# Scan a specific CIDR
python3 scripts/scan.py 192.168.1.0/24

# Scan with custom DNS server for reverse lookups
python3 scripts/scan.py 192.168.1.0/24 --dns 192.168.1.1

# Output as JSON
python3 scripts/scan.py --json
```

## 配置说明

在 `~/.config/network-scanner/networks.json` 中配置命名网络：

```json
{
  "networks": {
    "home": {
      "cidr": "192.168.1.0/24",
      "dns": "192.168.1.1",
      "description": "Home Network"
    },
    "office": {
      "cidr": "10.0.0.0/24",
      "dns": "10.0.0.1",
      "description": "Office Network"
    }
  }
}
```

随后可通过名称执行扫描：

```bash
python3 scripts/scan.py home
python3 scripts/scan.py office --json
```

### 命令列表

```bash
# Create example config
python3 scripts/scan.py --init-config

# List configured networks
python3 scripts/scan.py --list

# Scan without sudo (may miss MAC addresses)
python3 scripts/scan.py home --no-sudo
```

## 输出格式

**Markdown（默认）：**  
```
### Home Network
*Last scan: 2026-01-28 00:10*

| IP | Name | MAC | Vendor |
|----|------|-----|--------|
| 192.168.1.1 | router.local | AA:BB:CC:DD:EE:FF | Ubiquiti |
| 192.168.1.100 | nas.local | 11:22:33:44:55:66 | Synology |

*2 devices found*
```

**JSON（--json）：**  
```json
{
  "network": "Home Network",
  "cidr": "192.168.1.0/24",
  "devices": [
    {
      "ip": "192.168.1.1",
      "hostname": "router.local",
      "mac": "AA:BB:CC:DD:EE:FF",
      "vendor": "Ubiquiti"
    }
  ],
  "scanned_at": "2026-01-28T00:10:00",
  "device_count": 2
}
```

## 典型应用场景

- **设备资产盘点**：持续跟踪网络中所有设备  
- **安全审计**：识别未知或可疑设备  
- **文档归档**：生成网络拓扑图用于技术文档  
- **自动化集成**：与智能家居系统联动，实现设备在线状态检测  

## 使用技巧

- 使用 `sudo` 可提升 MAC 地址识别准确率（nmap 需要特权才能执行 ARP 探测）  
- 配置本地 DNS 服务器以获得更优的主机名解析效果  
- 加入 cron 或心跳任务，实现每日自动资产更新  
- 在脚本中扩展 `MAC_VENDORS`，以增强设备识别能力  