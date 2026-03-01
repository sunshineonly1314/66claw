---
name: nmap-recon
description: 使用 Nmap 进行网络侦察与端口扫描。当被要求扫描目标、探测开放端口、识别服务、检查漏洞或执行网络侦察任务时启用。
description_zh: 使用 Nmap 进行网络侦察与端口扫描。当被要求扫描目标、探测开放端口、识别服务、检查漏洞或执行网络侦察任务时启用。
---
# Nmap 侦察（Nmap Recon）

使用 Nmap 进行网络侦察与端口扫描。当被要求扫描目标、探测开放端口、识别服务、检查漏洞或执行网络侦察任务时启用。

## 触发词（Triggers）

- "scan [target]", "port scan", "nmap", "what ports are open", "recon [target]", "service detection", "vulnerability scan"

## 前置要求

- 必须已安装 `nmap`（Kali Linux 默认预装，亦可通过包管理器获取）  
- 执行 SYN 扫描与操作系统探测需 root/sudo 权限  

## 使用方法

### 快速扫描（前 1000 个端口）
```bash
nmap -sC -sV -oA scan_$(date +%Y%m%d_%H%M%S) TARGET
```

### 全端口扫描（Full Port Scan）
```bash
nmap -p- -sC -sV -oA fullscan_$(date +%Y%m%d_%H%M%S) TARGET
```

### 快速扫描（Fast Scan，快速初筛）
```bash
nmap -F -T4 TARGET
```

### 隐蔽 SYN 扫描（Stealth SYN Scan，需 root 权限）
```bash
sudo nmap -sS -sV -O -oA stealth_$(date +%Y%m%d_%H%M%S) TARGET
```

### UDP 扫描（前 100 个端口）
```bash
sudo nmap -sU --top-ports 100 -oA udp_$(date +%Y%m%d_%H%M%S) TARGET
```

### 漏洞扫描（Vulnerability Scan）
```bash
nmap --script vuln -oA vulnscan_$(date +%Y%m%d_%H%M%S) TARGET
```

### 激进扫描（Aggressive Scan，含操作系统识别、版本探测、脚本执行与路由追踪）
```bash
nmap -A -T4 -oA aggressive_$(date +%Y%m%d_%H%M%S) TARGET
```

## 输出解析（Output Parsing）

Nmap 支持多种输出格式，均由 `-oA` 控制：
- `.nmap` —— 人类可读格式  
- `.xml` —— 机器可解析格式  
- `.gnmap` —— 可 grep 格式  

### 从可 grep 输出中解析开放端口：
```bash
grep "open" scan.gnmap | awk -F'[/]' '{print $1}' | tr ',' '\n' | sort -u
```

### 提取服务版本信息：
```bash
grep -E "^[0-9]+/" scan.nmap | awk '{print $1, $3, $4}'
```

### 从 XML 输出中快速摘要：
```bash
xmllint --xpath "//port[@state='open']" scan.xml 2>/dev/null
```

## 常用扫描配置模板（Common Scan Profiles）

| 模板名称 | 命令 | 使用场景 |
|----------|------|-----------|
| Quick（快速） | `nmap -F -T4` | 快速初始侦察 |
| Standard（标准） | `nmap -sC -sV` | 服务识别 + 默认脚本 |
| Full（全端口） | `nmap -p- -sC -sV` | 扫描全部 65535 个端口 |
| Stealth（隐蔽） | `sudo nmap -sS -T2` | 规避入侵检测系统（IDS）的扫描 |
| Vuln（漏洞） | `nmap --script vuln` | 漏洞检测 |
| Aggressive（激进） | `nmap -A -T4` | 全面枚举 |

## 脚本类别（Script Categories）

```bash
# List available scripts
ls /usr/share/nmap/scripts/

# Run specific category
nmap --script=default,safe TARGET
nmap --script=vuln TARGET
nmap --script=exploit TARGET
nmap --script=auth TARGET

# Run specific script
nmap --script=http-title TARGET
nmap --script=smb-vuln* TARGET
```

## 目标指定（Target Specification）

```bash
# Single host
nmap 192.168.1.1

# CIDR range
nmap 192.168.1.0/24

# Range
nmap 192.168.1.1-254

# From file
nmap -iL targets.txt

# Exclude hosts
nmap 192.168.1.0/24 --exclude 192.168.1.1
```

## 时序模板（Timing Templates）

- `-T0` Paranoid（极度谨慎，规避 IDS）  
- `-T1` Sneaky（隐秘，规避 IDS）  
- `-T2` Polite（温和，速度较慢）  
- `-T3` Normal（常规，默认）  
- `-T4` Aggressive（激进，速度快）  
- `-T5` Insane（极致快速，可能遗漏端口）  

## 授权要求（Authorization Required）

⚠️ **仅允许扫描你拥有所有权或已获明确书面授权的目标。**

严禁扫描：
- 未经许可的公共基础设施  
- 你无权控制的网络  
- 未经批准的生产系统  

## 示例工作流（Example Workflow）

```bash
# 1. Quick scan to find live hosts
nmap -sn 192.168.1.0/24 -oA live_hosts

# 2. Fast port scan on discovered hosts
nmap -F -T4 -iL live_hosts.gnmap -oA quick_ports

# 3. Deep scan interesting hosts
nmap -p- -sC -sV -oA deep_scan TARGET

# 4. Vulnerability scan
nmap --script vuln -oA vuln_scan TARGET
```