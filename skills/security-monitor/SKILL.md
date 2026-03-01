---
name: security-monitor
name_zh: 安全监控
description: 面向 Clawdbot 的实时安全监控。检测入侵行为、异常 API 调用、密钥使用模式，并在发生数据泄露时发出告警。
description_zh: 面向 Clawdbot 的实时安全监控。检测入侵行为、异常 API 调用、密钥使用模式，并在发生数据泄露时发出告警。
---
# 安全监控 skill

## 适用场景

持续运行安全监控，以检测针对您 Clawdbot 部署的入侵、数据泄露及其他异常活动。

## 部署准备

无需外部依赖。作为后台进程运行。

## 操作方式

### 启动实时监控

```bash
node skills/security-monitor/scripts/monitor.cjs --interval 60
```

### 以守护进程模式（后台）运行

```bash
node skills/security-monitor/scripts/monitor.cjs --daemon --interval 60
```

### 监控特定威胁类型

```bash
node skills/security-monitor/scripts/monitor.cjs --threats=credentials,ports,api-calls
```

## 监控内容

| 威胁类型 | 检测方式 | 响应动作 |
|----------|----------|----------|
| **暴力破解攻击** | 检测失败登录尝试 | 发出告警 + 记录 IP |
| **端口扫描** | 检测高频连接请求 | 发出告警 |
| **进程异常** | 检测非预期进程 | 发出告警 |
| **文件变更** | 检测未授权修改 | 发出告警 |
| **容器健康状态** | 检测 Docker 异常 | 发出告警 |

## 输出形式

- 控制台输出（stdout）
- JSON 格式日志存于 `/root/clawd/clawdbot-security/logs/alerts.log`
- Telegram 告警（支持配置）

## 守护进程模式（Daemon Mode）

使用 systemd 或 PM2 保持监控长期运行：

```bash
# With PM2
pm2 start monitor.cjs --name "clawdbot-security" -- --daemon --interval 60
```

## 与安全审计协同使用

建议先运行安全审计，再开启持续监控：

```bash
# One-time audit
node skills/security-audit/scripts/audit.cjs --full

# Continuous monitoring
node skills/security-monitor/scripts/monitor.cjs --daemon
```

## 相关 skills

- `security-audit` — 一次性安全扫描（需单独安装）