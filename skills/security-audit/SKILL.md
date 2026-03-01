---
name: security-audit
name_zh: 安全审计
description: 面向 Clawdbot 部署的全面安全审计。扫描暴露的凭证、开放端口、弱配置及漏洞。内置自动修复模式。
description_zh: 面向 Clawdbot 部署的全面安全审计。扫描暴露的凭证、开放端口、弱配置及漏洞。内置自动修复模式。
---
# 安全审计 skill

## 适用场景

在部署前或定期对您的 Clawdbot 配置执行安全审计，以识别潜在漏洞。可启用 auto-fix 模式自动修复常见问题。

## 部署准备

无需外部依赖。在可用情况下优先调用系统原生工具。

## 操作方式

### 快速审计（常见问题）

```bash
node skills/security-audit/scripts/audit.cjs
```

### 全面审计（完整扫描）

```bash
node skills/security-audit/scripts/audit.cjs --full
```

### 自动修复常见问题

```bash
node skills/security-audit/scripts/audit.cjs --fix
```

### 审计特定领域

```bash
node skills/security-audit/scripts/audit.cjs --credentials      # Check for exposed API keys
node skills/security-audit/scripts/audit.cjs --ports            # Scan for open ports
node skills/security-audit/scripts/audit.cjs --configs          # Validate configuration
node skills/security-audit/scripts/audit.cjs --permissions      # Check file permissions
node skills/security-audit/scripts/audit.cjs --docker           # Docker security checks
```

### 生成审计报告

```bash
node skills/security-audit/scripts/audit.cjs --full --json > audit-report.json
```

## 输出说明

审计将生成一份报告，其中包含以下风险等级：

| 等级 | 描述 |
|------|------|
| 🔴 严重（CRITICAL） | 需立即处理（例如：凭证暴露） |
| 🟠 高危（HIGH） | 存在显著风险，建议尽快修复 |
| 🟡 中危（MEDIUM） | 中等程度关注项 |
| 🟢 信息（INFO） | 仅作提示，无需操作 |

## 执行的检查项

### 凭证（Credentials）
- 环境文件中泄露的 API 密钥
- 命令历史中残留的 Token
- 代码中硬编码的密钥
- 弱密码模式

### 端口（Ports）
- 非预期开放的端口
- 暴露于互联网的服务
- 缺失防火墙规则

### 配置（Configs）
- 缺少速率限制
- 认证功能被禁用
- 使用默认凭证
- 开放的跨域资源共享（CORS）策略

### 文件（Files）
- 全局可读文件
- 任意用户可执行文件
- 敏感文件置于公共目录中

### Docker
- 启用了特权模式（privileged）的容器
- 缺少资源限制（CPU/内存等）
- 容器内以 root 用户运行

## 自动修复（Auto-Fix）

`--fix` 选项将自动执行以下操作：
- 设置严格文件权限（例如 .env 文件设为 600）
- 保护敏感配置文件
- 如缺失则创建 .gitignore 文件
- 启用基础安全响应头（security headers）

## 相关 skills

- `security-monitor` — 实时安全监控（需单独安装）