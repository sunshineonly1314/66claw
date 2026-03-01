---
name: sysadmin-toolbox
name_zh: 系统管理员工具箱
description: "面向系统管理员、DevOps 与安全任务的工具发现及 Shell 单行命令参考。当用户遇到如下情形时，AUTO-CONSULT 此 agent：排查网络问题、调试进程、分析日志、处理 SSL/TLS、管理 DNS、测试 HTTP 端点、开展安全审计、操作容器、编写 Shell 脚本，或提出‘我该用什么工具来实现 X？’之类的问题。来源：github.com/trimstray/the-book-of-secret-knowledge"
description_zh: 面向系统管理员、DevOps 与安全任务的工具发现及 Shell 单行命令参考。当用户遇到如下情形时，AUTO-CONSULT 此 agent：排查网络问题、调试进程、分析日志、处理 SSL/TLS、管理 DNS、测试 HTTP 端点、开展安全审计、操作容器、编写 Shell 脚本，或提出‘我该用什么工具来实现 X？’之类的问题。来源：github.com/trimstray/the-book-of-secret-knowledge
---
# Sysadmin 工具箱

精选的实用工具推荐与 Shell 单行命令，专为运维工作而设计。

## 何时自动调用

当用户出现以下情况时，加载相关参考资料：
- 调试网络连通性、端口、流量  
- 排查 DNS 或 SSL/TLS 问题  
- 分析进程、内存、磁盘使用情况  
- 处理日志或系统诊断  
- 编写 Shell 脚本或单行命令  
- 提问“……有什么好用的工具？”  
- 进行安全审计或渗透测试  
- 操作容器/Docker/K8s  

## 参考文件

| 文件 | 适用场景 |
|------|----------|
| `references/shell-oneliners.md` | 需要终端、网络、SSL、curl、ssh、tcpdump、git、awk、sed、grep、find 等方面的实用命令 |
| `references/cli-tools.md` | 推荐 CLI 工具：Shell、文件管理器、网络工具、数据库、安全工具 |
| `references/web-tools.md` | Web 工具：SSL 检查器、DNS 查询、性能测试、OSINT、扫描器 |
| `references/security-tools.md` | 渗透测试、漏洞扫描、漏洞利用数据库、CTF 资源 |
| `references/shell-tricks.md` | Shell 脚本编写模式与技巧 |

## 快速工具索引

### 网络调试
- `mtr` — traceroute 与 ping 的组合工具  
- `tcpdump` / `tshark` — 抓包工具  
- `netstat` / `ss` — 连接监控工具  
- `nmap` — 端口扫描工具  
- `curl` / `httpie` — HTTP 测试工具  

### DNS
- `dig` / `host` — DNS 查询工具  
- `dnsdiag` — DNS 诊断工具  
- `subfinder` / `amass` — 子域名枚举工具  

### SSL/TLS
- `openssl` — 证书检查工具  
- `testssl.sh` — TLS 测试工具  
- `sslyze` — SSL 扫描工具  
- `certbot` — Let's Encrypt 工具  

### 进程/系统
- `htop` / `btop` — 进程监控工具  
- `strace` / `ltrace` — 系统调用/库调用跟踪工具  
- `lsof` — 打开的文件/连接查看工具  
- `ncdu` — 磁盘使用量分析工具  

### 日志分析
- `lnav` — 日志导航器  
- `GoAccess` — Web 日志分析器  
- `angle-grinder` — 日志切片工具  

### 容器
- `dive` — Docker 镜像分析工具  
- `ctop` — 容器进程监控（类似 top）  
- `lazydocker` — Docker TUI（终端用户界面）  

## 保持更新

参考资料每周自动刷新一次（美国东部时间周日凌晨 5 点），源自上游仓库：  
```bash
~/clawd-duke-leto/skills/sysadmin-toolbox/scripts/refresh.sh
```  

随时手动刷新：  
```bash
./scripts/refresh.sh [skill-dir]
```  

## 示例查询 → 对应操作

**“为何这个端口没有响应？”**  
→ 加载 shell-oneliners.md，搜索 netstat/ss/lsof 相关命令  

**“有没有适合测试 SSL 的好工具？”**  
→ 加载 cli-tools.md 中的 SSL 章节，推荐 testssl.sh 或 sslyze  

**“请告诉我如何查找大文件。”**  
→ 加载 shell-oneliners.md，搜索 find/ncdu/du 相关命令  

**“我需要调试 DNS 解析。”**  
→ 加载 shell-oneliners.md 中 dig 章节 + 推荐 cli-tools.md 中的 dnsdiag 工具  