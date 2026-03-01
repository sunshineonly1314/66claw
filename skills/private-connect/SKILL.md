---
name: private-connect
name_zh: 私有连接
description: 通过名称随时随地访问私有服务，无需 VPN 或 SSH 隧道
description_zh: 通过名称随时随地访问私有服务，无需 VPN 或 SSH 隧道
homepage: https://privateconnect.co
repository: https://github.com/treadiehq/private-connect
author: Treadie
gating:
  binary: connect
---
# Private Connect（私有连接）

通过名称随时随地访问私有服务，无需 VPN 或 SSH 隧道。

## 功能简介

Private Connect 让您能以简单名称（而非 IP 地址与端口号）访问私有基础设施（如数据库、API、GPU 集群）。几秒钟内即可与团队成员共享您的开发环境。

## 命令列表

### connect_reach  
按名称连接私有服务。

**示例：**  
- “连接到预发布数据库”  
- “访问生产环境 API”  
- “连接 jupyter-gpu”

### connect_status  
显示当前可用服务及其连接状态。

**示例：**  
- “有哪些服务可用？”  
- “显示我已连接的服务”  
- “预发布数据库在线吗？”

### connect_share  
将您当前的环境共享给团队成员。

**示例：**  
- “共享我的环境”  
- “生成一个 7 天后过期的共享链接”  
- “在未来一周内与团队共享我的配置”

### connect_join  
加入团队成员共享的环境。

**示例：**  
- “加入共享码 x7k9m2”  
- “连接 Bob 的环境”

### connect_clone  
完整克隆团队成员的整个环境配置。

**示例：**  
- “克隆 Alice 的环境”  
- “按资深开发人员的配置来搭建我的环境”

### connect_list_shares  
列出当前活跃的环境共享项。

**示例：**  
- “显示我当前的活跃共享项”  
- “我正在共享哪些环境？”

### connect_revoke  
撤销某项已共享的环境。

**示例：**  
- “撤销共享码 x7k9m2”  
- “停止与外包人员共享”

## 安装配置

1. 安装 Private Connect：  
```bash
curl -fsSL https://privateconnect.co/install.sh | bash
```

2. 进行身份认证：  
```bash
connect up
```

3. 该 skill 将复用您已完成认证的会话。

## 必备条件

- 已安装并完成身份认证的 Private Connect CLI  
- `connect` 命令已在 PATH 环境变量中可用  