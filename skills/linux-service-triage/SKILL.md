---
name: linux-service-triage
name_zh: Linux服务排查
description: 借助日志、systemd/PM2、文件权限、Nginx 反向代理检查及 DNS 健康检查，诊断常见 Linux 服务问题。适用于服务器应用故障、不可达或配置错误等场景。
description_zh: 借助日志、systemd/PM2、文件权限、Nginx 反向代理检查及 DNS 健康检查，诊断常见 Linux 服务问题。适用于服务器应用故障、不可达或配置错误等场景。
---
# Linux 与服务基础：日志、systemd/PM2、权限、Nginx 反向代理、DNS 检查

## 用途  
借助日志、systemd/PM2、文件权限、Nginx 反向代理检查及 DNS 健康检查，诊断常见 Linux 服务问题。

## 使用时机  
- **触发条件：**  
  - “请结合日志分析该服务为何失败，并给出精确的修复命令。”  
  - “请干净地重启该应用，并确认其正在监听正确端口。”  
  - “请修复该文件夹权限，确保服务可安全读写。”  
  - “请为该端口配置 Nginx 反向代理，并验证 DNS 与 TLS 是否正常。”  
  - “请为该脚本创建 systemd 服务，并使其在重启后持续运行。”  
- **禁止使用场景：**  
  - 需要内核级调试或深度性能剖析时。  
  - 意图渗透系统或绕过访问控制时。

## 输入要求  
- **必需项：**  
  - 服务类型：systemd 单元名称 或 PM2 进程名称。  
  - 观察到的症状：错误信息、状态输出或日志（由用户提供粘贴）。  
- **可选项：**  
  - Nginx 配置片段、域名、预期上游端口。  
  - 服务所用的文件系统路径。  
- **示例：**  
  - `systemctl status myapp` 输出 + `journalctl` 片段  
  - Nginx server block + 域名 + 上游端口  

## 输出内容  
- 默认输出：排障报告（最可能原因、日志证据、最小化修复方案）。  
- 若明确请求且操作安全：提供可直接执行的精确 Shell 命令。  
成功标准 = 服务正常运行、监听预期端口、反向代理/DNS 路径正确。

## 工作流  
1. 确认范围与安全性：  
   - 明确服务名称，并确认是否允许执行变更。  
2. 收集证据：  
   - 状态输出 + 最近日志（参见 `references/triage-commands.md`）。  
3. 分类故障类型：  
   - 配置错误、依赖缺失、权限拒绝、端口冲突、上游不可达、DNS 不匹配。  
4. 提出最小化修复方案 + 验证步骤。  
5. 验证网络路径（若为 Web 服务）：  
   - 应用监听 → Nginx 代理 → DNS 解析 → （如适用，TLS 健康检查）。  
6. 提供重启/重载计划，并确认健康检查结果。  
7. **立即暂停并询问用户**，当出现以下任一情况时：  
   - 缺少日志/状态输出；  
   - 操作需特权访问但尚未获得确认；  
   - 需要 TLS/证书管理但相关配置尚不明确。

## 输出格式  
```text
TRIAGE REPORT
- Symptom:
- Evidence (what you provided):
- Most likely cause:
- Fix plan (minimal steps):
- Exact commands (ONLY if user approved changes):
- Verification:
- Rollback:
```

## 安全性与边界情况处理  
- 默认只读：仅基于提供的输出进行诊断；不假设自身有权执行命令。  
- 避免破坏性变更；对任何高风险操作均需明确确认。  
- 优先使用 `nginx -t` 进行配置校验，再执行重载，并用 `ss` 验证端口监听状态。

## 示例  
- 输入：“journal 日志显示 /var/app/uploads 目录权限拒绝。”  
  输出：路径权限分析 + 安全的 chown/chmod 方案 + 验证步骤。  

- 输入：“本地运行正常，但域名返回 502 错误。”  
  输出：上游端口检查 + nginx 错误日志解读 + proxy_pass 配置修复方案。