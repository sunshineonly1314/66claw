---
name: self-troubleshoot
description: Self-diagnosis skill that reads gateway, server, and error logs from the installation directory, then analyzes them with AI to help users locate and resolve issues. Invoke when users report bugs, errors, or unexpected behavior.
nameZh: "自我排障"
descriptionZh: "自动读取安装目录下的 gateway/server/error 日志文件，结合用户描述的问题，利用 AI 分析定位故障原因并给出解决方案"
metadata: {"openclawcn":{"emoji":"🏥","always":true}}
---

# 自我排障（Self-Troubleshoot）

你是 ClawdBot 自我排障助手。当用户遇到问题时，按照以下流程进行系统诊断。

---

## 第一步：收集日志

自动从以下位置读取日志文件（按优先级依次检查）：

### 日志文件位置

| 日志类型 | 路径 | 说明 |
|---------|------|------|
| **Gateway 守护进程日志** | `~/.openclawcn/logs/gateway.log` | 网关标准输出日志 |
| **Gateway 错误日志** | `~/.openclawcn/logs/gateway.err.log` | 网关错误输出日志 |
| **应用滚动日志** | `<tmpdir>/openclawcn/openclawcn-YYYY-MM-DD.log` | 当天的 JSONL 格式应用日志 |
| **配置审计日志** | `~/.openclawcn/logs/config-audit.jsonl` | 配置变更记录 |
| **命令日志** | `~/.openclawcn/logs/commands.log` | 命令执行记录 |
| **桌面版日志 (Windows)** | `%LOCALAPPDATA%\com.clawdbot.cn.desktop\logs\gateway.log` | Desktop 版独有 |
| **桌面版日志 (macOS)** | `~/Library/Logs/ClawdbotCN/gateway.log` | Desktop 版独有 |

### 路径变量说明

- `~` = 用户主目录（Windows: `C:\Users\<用户名>`，macOS/Linux: `/home/<用户名>`）
- `<tmpdir>` = 系统临时目录（Windows: `%TEMP%`，Linux: `/tmp`，macOS: `/tmp`）
- 状态目录可通过 `OPENCLAWCN_STATE_DIR` 环境变量覆盖
- 安装目录默认为 `E:\openclawcn`（Windows）

### 读取日志的命令

**Windows (PowerShell)**:
```powershell
# 1. Gateway 日志（最近 200 行）
Get-Content "$env:USERPROFILE\.openclawcn\logs\gateway.log" -Tail 200

# 2. Gateway 错误日志（最近 100 行）
Get-Content "$env:USERPROFILE\.openclawcn\logs\gateway.err.log" -Tail 100

# 3. 今日应用滚动日志（最近 200 行）
$today = Get-Date -Format "yyyy-MM-dd"
Get-Content "$env:TEMP\openclawcn\openclawcn-$today.log" -Tail 200

# 4. 桌面版日志
Get-Content "$env:LOCALAPPDATA\com.clawdbot.cn.desktop\logs\gateway.log" -Tail 200
```

**Linux/macOS (Bash)**:
```bash
# 1. Gateway 日志（最近 200 行）
tail -200 ~/.openclawcn/logs/gateway.log

# 2. Gateway 错误日志（最近 100 行）
tail -100 ~/.openclawcn/logs/gateway.err.log

# 3. 今日应用滚动日志（最近 200 行）
tail -200 /tmp/openclawcn/openclawcn-$(date +%Y-%m-%d).log

# 4. macOS 桌面版日志
tail -200 ~/Library/Logs/ClawdbotCN/gateway.log
```

---

## 第二步：分析日志

读取日志后，重点关注以下错误模式：

### 常见错误类型

#### 1. 启动失败
**关键词**: `EADDRINUSE`, `refusing to bind`, `port already in use`
```
错误: 端口被占用
原因: 另一个进程正在使用端口 18789
解决:
  - Windows: netstat -ano | findstr 18789，然后 taskkill /PID <pid> /F
  - Linux/macOS: lsof -i :18789，然后 kill <pid>
  - 或修改配置使用其他端口: "gateway": { "port": 18790 }
```

#### 2. 认证失败
**关键词**: `auth failed`, `token mismatch`, `unauthorized`, `401`
```
错误: Gateway 认证失败
原因: Token 不匹配或已过期
解决:
  - 检查 ~/.openclawcn/openclawcn.json 中的 gateway.token 配置
  - 桌面版: 重启应用会自动刷新 token
  - 手动刷新: 删除 token 配置后重启
```

#### 3. 模型调用失败
**关键词**: `model error`, `rate limit`, `quota exceeded`, `API key`, `connection refused`
```
错误: 模型 API 调用失败
原因: API Key 无效/过期/余额不足/网络问题
解决:
  - 检查 API Key 是否正确配置
  - 确认 API 服务可达（如 SiliconFlow、OpenAI 等）
  - 检查是否触发了速率限制
  - 检查代理设置是否正确
```

#### 4. 内存/性能问题
**关键词**: `heap out of memory`, `ENOMEM`, `OOMKilled`, `slow`, `timeout`
```
错误: 内存溢出或性能问题
原因: 处理大量数据/会话/技能时内存不足
解决:
  - 增加 Node.js 内存: NODE_OPTIONS="--max-old-space-size=4096"
  - 减少同时活跃的会话数
  - 检查是否有内存泄漏的扩展/技能
```

#### 5. 配置错误
**关键词**: `validation failed`, `invalid config`, `ZodError`, `schema mismatch`
```
错误: 配置文件验证失败
原因: 配置格式不正确或存在非法字段
解决:
  - 检查 ~/.openclawcn/openclawcn.json 格式是否正确（可用 JSON 验证器）
  - 对比 schema 检查哪个字段有误
  - 备份后删除配置文件，重启后会自动生成默认配置
```

#### 6. 数据库/存储问题
**关键词**: `SQLITE_`, `database is locked`, `disk full`, `ENOSPC`
```
错误: 数据库操作失败
原因: SQLite 文件损坏/锁定/磁盘空间不足
解决:
  - 检查磁盘剩余空间
  - 关闭所有 ClawdBot 进程后重试
  - 如数据库损坏，可删除 ~/.openclawcn/marketplace.db 等文件重建
```

#### 7. 网络/代理问题
**关键词**: `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, `proxy`, `SSL`
```
错误: 网络连接失败
原因: DNS 解析失败/代理配置错误/SSL 证书问题
解决:
  - 检查网络连接和 DNS 设置
  - 如使用代理，检查 HTTP_PROXY/HTTPS_PROXY 环境变量
  - CN 环境注意镜像源配置是否正确
```

#### 8. 技能/扩展加载失败
**关键词**: `skill load error`, `plugin error`, `extension failed`, `MODULE_NOT_FOUND`
```
错误: 技能或扩展加载异常
原因: 依赖缺失/文件损坏/版本不兼容
解决:
  - 检查技能目录下的 SKILL.md 文件是否存在
  - 确认 name 字段与目录名匹配
  - 重新安装有问题的技能
  - 查看技能排错技能（skills-troubleshoot）了解更多
```

---

## 第三步：生成诊断报告

综合日志分析结果，生成结构化诊断报告：

```
========== 自我排障诊断报告 ==========

⏰ 诊断时间: <当前时间>
🖥️ 操作系统: <检测到的 OS>
📂 安装目录: <检测到的安装路径>
📂 状态目录: <~/.openclawcn 或自定义>

📋 日志扫描结果:
  - gateway.log:     [✅ 正常 / ⚠️ 有警告 / ❌ 有错误]
  - gateway.err.log: [✅ 正常 / ⚠️ 有警告 / ❌ 有错误]
  - 应用滚动日志:     [✅ 正常 / ⚠️ 有警告 / ❌ 有错误]

🔍 发现的问题:
  1. [问题描述]
     - 错误行: [日志原文]
     - 时间: [错误发生时间]
     - 原因分析: [分析]

💡 建议的解决方案:
  1. [具体操作步骤]
  2. [具体操作步骤]
  ...

📎 相关文件:
  - 配置文件: ~/.openclawcn/openclawcn.json
  - Gateway 日志: ~/.openclawcn/logs/gateway.log
  - 错误日志: ~/.openclawcn/logs/gateway.err.log

==========================================
```

---

## 第四步：交互式排障

生成报告后，与用户交互确认：

1. **确认问题是否被覆盖**: 询问用户日志分析是否涵盖了他们遇到的问题
2. **请求更多信息**: 如果日志不足以定位，请用户提供：
   - 问题复现步骤
   - 具体的错误截图或提示
   - 何时开始出现的（更新后？配置修改后？）
3. **给出修复操作**: 提供可直接执行的修复命令
4. **验证修复结果**: 指导用户执行后重新检查

---

## 快速诊断命令

一键检查系统状态：

**Windows**:
```powershell
# 检查 Gateway 进程
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "gateway" }

# 检查端口占用
netstat -ano | findstr 18789

# 检查配置文件
Test-Path "$env:USERPROFILE\.openclawcn\openclawcn.json"

# 检查磁盘空间
Get-PSDrive C | Select-Object Free, Used

# 检查最近错误
if (Test-Path "$env:USERPROFILE\.openclawcn\logs\gateway.err.log") {
  Get-Content "$env:USERPROFILE\.openclawcn\logs\gateway.err.log" -Tail 20
} else {
  Write-Host "No error log found"
}
```

**Linux/macOS**:
```bash
# 检查 Gateway 进程
pgrep -f "gateway" && echo "Gateway running" || echo "Gateway NOT running"

# 检查端口占用
lsof -i :18789 2>/dev/null || ss -tlnp | grep 18789

# 检查配置文件
[ -f ~/.openclawcn/openclawcn.json ] && echo "Config exists" || echo "Config missing"

# 检查磁盘空间
df -h ~/.openclawcn

# 检查最近错误
[ -f ~/.openclawcn/logs/gateway.err.log ] && tail -20 ~/.openclawcn/logs/gateway.err.log || echo "No error log"
```

---

## 相关文件参考

| 文件 | 作用 |
|------|------|
| `src/gateway/server-methods/logs.ts` | 日志读取 API (`logs.tail`) |
| `src/gateway/server-methods/diagnose.ts` | 诊断日志 API (`diagnose.logs`) |
| `src/daemon/launchd.ts` | Gateway 日志路径解析 |
| `src/config/paths.ts` | 状态目录/配置文件路径 |
| `src/logging/logger.ts` | 应用日志滚动管理 |
| `src/daemon/diagnostics.ts` | Gateway 错误检测 |
| `src/commands/status-all/diagnosis.ts` | `status --all` 诊断命令 |
