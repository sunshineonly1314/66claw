---
name: fail2ban-reporter
name_zh: Fail2Ban报告器
description: "自动将 fail2ban 封禁的 IP 地址上报至 AbuseIPDB，并通过 Telegram 发送通知。适用于监控服务器安全性、上报攻击者或检查已被封禁的 IP 地址。该工具持续监听 fail2ban 的新封禁事件，自动上报至 AbuseIPDB 并发送告警。"
description_zh: 自动将 fail2ban 封禁的 IP 地址上报至 AbuseIPDB，并通过 Telegram 发送通知。适用于监控服务器安全性、上报攻击者或检查已被封禁的 IP 地址。该工具持续监听 fail2ban 的新封禁事件，自动上报至 AbuseIPDB 并发送告警。
---
# fail2ban Reporter

监控 fail2ban 的封禁事件，并自动将攻击者上报至 AbuseIPDB。

## 设置步骤

1. 在 https://www.abuseipdb.com/account/api 免费获取 AbuseIPDB API 密钥  
2. 存储密钥：`pass insert abuseipdb/api-key`  
3. 安装监控器：`bash {baseDir}/scripts/install.sh`  

## 手动使用

### 上报所有当前已被封禁的 IP 地址

```bash
bash {baseDir}/scripts/report-banned.sh
```

### 查询指定 IP 地址

```bash
bash {baseDir}/scripts/check-ip.sh <ip>
```

### 显示封禁统计信息

```bash
bash {baseDir}/scripts/stats.sh
```

## 自动上报

安装脚本会配置一个 fail2ban action，用于自动上报新增封禁。

```bash
bash {baseDir}/scripts/install.sh    # install auto-reporting
bash {baseDir}/scripts/uninstall.sh  # remove auto-reporting
```

## 心跳（Heartbeat）集成

添加至 HEARTBEAT.md 中，以周期性检查新封禁：

```markdown
- [ ] Check fail2ban stats and report any unreported IPs to AbuseIPDB
```

## 工作流程

1. fail2ban 封禁某个 IP → 触发 action `report-single.sh`  
2. 脚本以上报 SSH 暴力破解分类的方式向 AbuseIPDB 提交报告  
3. 发送 Telegram 通知（如已配置）  
4. 将上报记录写入 `/var/log/abuseipdb-reports.log`  

## API 参考文档

完整 API 文档请参阅 [references/abuseipdb-api.md](references/abuseipdb-api.md)。