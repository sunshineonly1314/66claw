---
name: pi-admin
name_zh: Pi 管理
description: 树莓派系统管理。监控资源、管理系统服务、执行更新与维护任务。
description_zh: 树莓派系统管理。监控资源、管理系统服务、执行更新与维护任务。
metadata: {"clawdis":{"emoji":"🥧","requires":{"bins":[]}}}
---
# 树莓派系统管理

面向树莓派主机的完整系统监控与内省工具集。可获取网络详情、系统资源、存储状态、服务运行情况等全部信息。

## 适用场景  
- 检查树莓派网络配置（IP 地址、Tailscale 状态）；  
- 监控系统资源（CPU、内存、存储空间）；  
- 查看运行中的服务及其状态；  
- 检测 CPU 温度与硬件信息；  
- 排查系统故障；  
- 获取系统概览以辅助调试。

## 使用方法  

```bash
# Information Commands
cd /home/srose/clawd/skills/pi-admin
./skill.sh overview
./skill.sh network
./skill.sh tailscale
./skill.sh resources
./skill.sh storage
./skill.sh services
./skill.sh hardware

# Maintenance Commands
./skill.sh update       # Update system packages
./skill.sh clean        # Clean unused packages, logs, Docker
./skill.sh reboot       # Reboot with countdown
./skill.sh restart-gateway  # Restart the Clawdis Gateway

# Complete system info
./skill.sh all
```  

## 可用工具  

| 工具 | 描述 |  
|------|------|  
| `overview` | 系统状态快速摘要 |  
| `network` | IP 地址、主机名、网络接口 |  
| `tailscale` | Tailscale 状态、IP 地址、连接节点 |  
| `resources` | CPU 占用率、内存占用率、CPU 温度 |  
| `storage` | 磁盘使用率、挂载点 |  
| `services` | 运行中的服务、网关服务状态 |  
| `hardware` | CPU 信息、树莓派型号、GPU 信息 |  
| `all` | 完整详细系统信息快照 |

## 示例  

```bash
# Quick system check
./skill.sh overview

# Debug network issues
./skill.sh network && ./skill.sh tailscale

# Check if Gateway is running
./skill.sh services | grep gateway

# Monitor disk space
./skill.sh storage
```  

## 采集信息  

**网络：**  
- 主机名；  
- 本地 IP 地址（eth0、wlan0）；  
- 网络接口详情；  
- DNS 配置。

**Tailscale：**  
- 运行状态（运行中/已停止）；  
- Tailscale IP 地址；  
- 已连接节点；  
- 出口节点状态。

**系统资源：**  
- CPU 使用率；  
- 内存使用率（已用/空闲/总量）；  
- CPU 温度；  
- 系统运行时间（uptime）。

**存储：**  
- 各挂载点磁盘使用率；  
- inode 使用率；  
- 可用空间。

**服务：**  
- 网关服务状态；  
- Docker 容器状态；  
- systemd 服务状态；  
- 端口监听状态。

**硬件：**  
- CPU 型号与核心数；  
- 树莓派型号；  
- GPU 内存；  
- 总 RAM 容量。

## 维护命令  

### `update`  
通过 apt 更新系统软件包：  
- 更新软件包索引；  
- 显示可升级软件包列表；  
- 升级前需手动确认；  
- 升级后提示是否需要重启；  
- **模拟运行**：`./skill.sh update --dry-run` 显示将要升级的内容。

### `clean`  
清理系统以释放磁盘空间：  
- 卸载未使用的软件包（autoremove）；  
- 清空软件包缓存；  
- 清理旧系统日志（保留最近 7 天）；  
- 可选：清理 Docker 相关产物；  
- 显示释放的空间大小；  
- **模拟运行**：`./skill.sh clean --dry-run` 显示将要清理的内容。

### `reboot`  
安全重启系统：  
- 10 秒倒计时；  
- 按 Ctrl+C 可取消；  
- 使用 systemctl reboot 执行；  
- **模拟运行**：`./skill.sh reboot --dry-run` 仅显示倒计时，不实际重启。

### `restart-gateway`  
重启 Clawdis 网关服务：  
- 停止所有正在运行的网关进程；  
- 在端口 18789 上启动全新网关；  
- 确认端口处于监听状态；  
- 显示访问 URL；  
- **模拟运行**：`./skill.sh restart-gateway --dry-run` 显示将要执行的操作。

### `optimize`  
应用安全系统优化：  
- 禁用蓝牙服务（节省约 50MB 内存）；  
- 禁用 ModemManager（节省约 30MB 内存）；  
- 禁用 Avahi/Zeroconf（节省约 20MB 内存）；  
- 将 swappiness 设为 10（提升内存利用效率）；  
- **模拟运行**：`./skill.sh optimize --dry-run` 显示将要变更的内容；  
- **撤销操作**：`./skill.sh optimize --undo` 将恢复全部更改。

**总计内存节省：** 约 100MB  
**可逆性：** 是，使用 `--undo` 标志可回滚全部更改  

**注意：** 所有维护命令均需 sudo 权限，并在执行变更前请求确认。使用 `--dry-run` 标志可预览变更内容而不实际应用。