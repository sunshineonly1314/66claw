---
name: clawdbot-self-security-audit
name_zh: 安全检查
description: 对 Clawdbot 自身配置执行全面的只读安全审计。这是一个基于知识的 skill，用于指导 Clawdbot 识别系统各层面的安全加固机会。当用户提出“运行安全检查”、“审计 Clawdbot”、“检查安全加固情况”或“我的 Clawdbot 存在哪些漏洞”等请求时使用。该 skill 利用 Clawdbot 的内部能力及文件系统访问权限，检查配置、识别错误配置，并推荐修复措施。其设计具备可扩展性——可通过更新本 skill 的知识来添加新检查项。
description_zh: 对 Clawdbot 自身配置执行全面的只读安全审计。这是一个基于知识的 skill，用于指导 Clawdbot 识别系统各层面的安全加固机会。当用户提出“运行安全检查”、“审计 Clawdbot”、“检查安全加固情况”或“我的 Clawdbot 存在哪些漏洞”等请求时使用。该 skill 利用 Clawdbot 的内部能力及文件系统访问权限，检查配置、识别错误配置，并推荐修复措施。其设计具备可扩展性——可通过更新本 skill 的知识来添加新检查项。
homepage: https://github.com/TheSethRose/Clawdbot-Security-Check
metadata: {"clawdbot":{"emoji":"🔒","os":["darwin","linux"],"requires":{"files":["read"],"tools":["exec","bash"]}}}
---
# Clawdbot 自我安全审计框架

本 skill 赋予 Clawdbot 基于第一性原理推理能力，以审计自身安全态势。它不依赖静态脚本，而是让 Clawdbot 学习该框架，并动态应用以检测漏洞、理解其影响，并推荐具体修复措施。

## 核心理念

> "Security through transparency and self-awareness." — Inspired by ᴅᴀɴɪᴇʟ ᴍɪᴇssʟᴇʀ

Clawdbot should know its own attack surface. This skill embeds that knowledge directly.

## 安全原则

运行具备 shell 访问权限的 AI agent 需格外谨慎。重点关注以下三个领域：

1. **谁可以与机器人通信** —— 私信（DM）策略、群组白名单、频道限制  
2. **机器人被允许在何处执行操作** —— 网络暴露面、网关绑定地址、代理配置  
3. **机器人可访问哪些资源** —— 工具访问权限、文件权限、凭据存储方式  

应始终从最小权限起步，并在逐步建立信心后，再酌情扩大权限范围。

## 信任层级

依据角色施加适当信任等级：

| 等级 | 实体 | 信任模型 |
|------|------|----------|
| 1 | **所有者** | 完全信任 — 拥有全部访问权限 |
| 2 | **AI** | 信任但需验证 — 已沙箱化且全程日志记录 |
| 3 | **白名单** | 有限信任 — 仅限明确指定的用户 |
| 4 | **陌生人** | 零信任 — 默认屏蔽 |

## 审计命令

使用以下命令执行安全审计：

- `clawdbot security audit` — 对常见问题执行标准审计  
- `clawdbot security audit --deep` — 执行涵盖全部检查项的综合审计  
- `clawdbot security audit --fix` — 应用防护性修复措施  

## 十二大安全领域

对 Clawdbot 进行审计时，需系统性地评估以下领域：

### 1. 网关暴露 🔴 关键

**需检查内容：**  
- 网关绑定在何处？（`gateway.bind`）  
- 是否已配置身份验证？（`gateway.auth_token` 或 `CLAWDBOT_GATEWAY_TOKEN` 环境变量）  
- 暴露了哪个端口？（默认：18789）  
- 是否启用了 WebSocket 身份验证？  

**检测方法：**  
```bash
cat ~/.clawdbot/clawdbot.json | grep -A10 '"gateway"'
env | grep CLAWDBOT_GATEWAY_TOKEN
```  

**漏洞：** 绑定至 `0.0.0.0` 或 `lan` 且未启用身份验证，将导致网络可直接访问。  

**修复措施：**  
```bash
# Generate gateway token
clawdbot doctor --generate-gateway-token
export CLAWDBOT_GATEWAY_TOKEN="$(openssl rand -hex 32)"
```  

---

### 2. 私信（DM）策略配置 🟠 高危

**需检查内容：**  
- `dm_policy` 设置为何值？  
- 若为 `allowlist`，则通过 `allowFrom` 显式允许了哪些用户？  

**检测方法：**  
```bash
cat ~/.clawdbot/clawdbot.json | grep -E '"dm_policy|"allowFrom"'
```  

**漏洞：** 设置为 `allow` 或 `open` 意味着任何用户均可向 Clawdbot 发送私信。  

**修复措施：**  
```json
{
  "channels": {
    "telegram": {
      "dmPolicy": "allowlist",
      "allowFrom": ["@trusteduser1", "@trusteduser2"]
    }
  }
}
```  

---

### 3. 群组访问控制 🟠 高危

**需检查内容：**  
- `groupPolicy` 设置为何值？  
- 是否已显式白名单化群组？  
- 是否配置了提及门控（mention gates）？  

**检测方法：**  
```bash
cat ~/.clawdbot/clawdbot.json | grep -E '"groupPolicy"|"groups"' 
cat ~/.clawdbot/clawdbot.json | grep -i "mention"
```  

**漏洞：** 开放式群组策略允许房间内任意成员触发命令。  

**修复措施：**  
```json
{
  "channels": {
    "telegram": {
      "groupPolicy": "allowlist",
      "groups": {
        "-100123456789": true
      }
    }
  }
}
```  

---

### 4. 凭据安全 🔴 关键

**需检查内容：**  
- 凭据文件的位置与权限  
- 环境变量使用情况  
- 认证配置文件（auth profile）存储方式  

**凭据存储映射表：**  
| 平台 | 路径 |  
|------|------|  
| WhatsApp | `~/.clawdbot/credentials/whatsapp/{accountId}/creds.json` |  
| Telegram | `~/.clawdbot/clawdbot.json` 或环境变量 |  
| Discord | `~/.clawdbot/clawdbot.json` 或环境变量 |  
| Slack | `~/.clawdbot/clawdbot.json` 或环境变量 |  
| 配对白名单 | `~/.clawdbot/credentials/channel-allowFrom.json` |  
| 认证配置文件 | `~/.clawdbot/agents/{agentId}/auth-profiles.json` |  
| 旧版 OAuth | `~/.clawdbot/credentials/oauth.json` |  

**检测方法：**  
```bash
ls -la ~/.clawdbot/credentials/
ls -la ~/.clawdbot/agents/*/auth-profiles.json 2>/dev/null
stat -c "%a" ~/.clawdbot/credentials/oauth.json 2>/dev/null
```  

**漏洞：** 权限宽松的明文凭据可被任意进程读取。  

**修复措施：**  
```bash
chmod 700 ~/.clawdbot
chmod 600 ~/.clawdbot/credentials/oauth.json
chmod 600 ~/.clawdbot/clawdbot.json
```  

---

### 5. 浏览器控制暴露 🟠 高危

**需检查内容：**  
- 是否启用了浏览器控制功能？  
- 是否为远程控制设置了身份验证令牌？  
- 控制界面（Control UI）是否强制要求 HTTPS？  
- 是否配置了专用浏览器配置文件？  

**检测方法：**  
```bash
cat ~/.clawdbot/clawdbot.json | grep -A5 '"browser"'
cat ~/.clawdbot/clawdbot.json | grep -i "controlUi|insecureAuth"
ls -la ~/.clawdbot/browser/
```  

**漏洞：** 无身份验证的暴露式浏览器控制功能，将导致远程 UI 接管；浏览器访问权限使模型可利用已登录会话。  

**修复措施：**  
```json
{
  "browser": {
    "remoteControlUrl": "https://...",
    "remoteControlToken": "...",
    "dedicatedProfile": true,
    "disableHostControl": true
  },
  "gateway": {
    "controlUi": {
      "allowInsecureAuth": false
    }
  }
}
```  

**安全提示：** 将浏览器控制 URL 视为管理员 API。  

---

### 6. 网关绑定与网络暴露 🟠 高危

**需检查内容：**  
- `gateway.bind` 设置为何值？  
- 是否配置了可信代理？  
- 是否启用了 Tailscale？  

**检测方法：**  
```bash
cat ~/.clawdbot/clawdbot.json | grep -A10 '"gateway"'
cat ~/.clawdbot/clawdbot.json | grep '"tailscale"'
```  

**漏洞：** 无身份验证的公网绑定将允许互联网直接访问网关。  

**修复措施：**  
```json
{
  "gateway": {
    "bind": "127.0.0.1",
    "mode": "local",
    "trustedProxies": ["127.0.0.1", "10.0.0.0/8"],
    "tailscale": {
      "mode": "off"
    }
  }
}
```  

---

### 7. 工具访问与沙箱化 🟡 中危

**需检查内容：**  
- 是否已白名单化特权工具？  
- 是否配置了 `restrict_tools` 或 `mcp_tools`？  
- `workspaceAccess` 设置为何值？  
- 敏感工具是否在沙箱中运行？  

**检测方法：**  
```bash
cat ~/.clawdbot/clawdbot.json | grep -i "restrict|mcp|elevated"
cat ~/.clawdbot/clawdbot.json | grep -i "workspaceAccess|sandbox"
cat ~/.clawdbot/clawdbot.json | grep -i "openRoom"
```  

**工作区访问级别：**  
| 模式 | 描述 |  
|------|------|  
| `none` | 工作区完全禁止访问 |  
| `ro` | 工作区以只读方式挂载 |  
| `rw` | 工作区以读写方式挂载 |  

**漏洞：** 广泛的工具访问权限意味着一旦遭入侵，影响范围更大；较小规模模型更易被滥用工具。  

**修复措施：**  
```json
{
  "restrict_tools": true,
  "mcp_tools": {
    "allowed": ["read", "write", "bash"],
    "blocked": ["exec", "gateway"]
  },
  "workspaceAccess": "ro",
  "sandbox": "all"
}
```  

**模型建议：** 对具备文件系统或网络访问权限的 agent，应使用最新一代模型；若使用小型模型，则应禁用网络搜索和浏览器工具。  

---

### 8. 文件权限与本地磁盘规范 🟡 中危

**需检查内容：**  
- 目录权限（应为 700）  
- 配置文件权限（应为 600）  
- 符号链接安全性  

**检测方法：**  
```bash
stat -c "%a" ~/.clawdbot
ls -la ~/.clawdbot/*.json
```  

**漏洞：** 权限宽松将允许其他用户读取敏感配置。  

**修复措施：**  
```bash
chmod 700 ~/.clawdbot
chmod 600 ~/.clawdbot/clawdbot.json
chmod 600 ~/.clawdbot/credentials/*
```  

---

### 9. 插件信任与模型规范 🟡 中危

**需检查内容：**  
- 插件是否已显式白名单化？  
- 是否正在使用带工具访问权限的旧版模型？  

**检测方法：**  
```bash
cat ~/.clawdbot/clawdbot.json | grep -i "plugin|allowlist"
cat ~/.clawdbot/clawdbot.json | grep -i "model|anthropic"
```  

**漏洞：** 不受信任的插件可执行任意代码；旧版模型可能缺乏现代安全机制。  

**修复措施：**  
```json
{
  "plugins": {
    "allowlist": ["trusted-plugin-1", "trusted-plugin-2"]
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "minimax/MiniMax-M2.1"
      }
    }
  }
}
```  

---

### 10. 日志记录与敏感信息脱敏 🟡 中危

**logging.redactSensitive 设置为何值？**  
- 应设为 `tools`，以脱敏敏感工具输出  
- 若设为 `off`，凭据可能泄露至日志中  

**检测方法：**  
```bash
cat ~/.clawdbot/clawdbot.json | grep -i "logging|redact"
ls -la ~/.clawdbot/logs/
```  

**修复措施：**  
```json
{
  "logging": {
    "redactSensitive": "tools",
    "path": "~/.clawdbot/logs/"
  }
}
```  

---

### 11. 提示注入防护 🟡 中危

**需检查内容：**  
- 是否启用了 `wrap_untrusted_content` 或 `untrusted_content_wrapper`？  
- 如何处理外部/网页内容？  
- 是否将链接与附件视为恶意内容？  

**检测方法：**  
```bash
cat ~/.clawdbot/clawdbot.json | grep -i "untrusted|wrap"
```  

**提示注入缓解策略：**  
- 将私信（DM）锁定至 `pairing` 或 `allowlists`  
- 在群组中使用提及门控（mention gating）  
- 将所有链接与附件视为恶意内容  
- 在沙箱中运行敏感工具  
- 使用指令强化型模型（如 Anthropic Opus 4.5）  

**漏洞：** 不受信任的内容（如网页抓取结果、沙箱输出）可能注入恶意提示。  

**修复措施：**  
```json
{
  "wrap_untrusted_content": true,
  "untrusted_content_wrapper": "<untrusted>",
  "treatLinksAsHostile": true,
  "mentionGate": true
}
```  

---

### 12. 危险命令拦截 🟡 中危

**需检查内容：**  
- `blocked_commands` 中包含哪些命令？  
- 是否包含如下模式：`rm -rf`、`curl |`、`git push --force`、`mkfs` 及 fork bomb？  

**检测方法：**  
```bash
cat ~/.clawdbot/clawdbot.json | grep -A10 '"blocked_commands"'
```  

**漏洞：** 若未进行拦截，恶意提示可能导致数据损毁或凭据窃取。  

**修复措施：**  
```json
{
  "blocked_commands": [
    "rm -rf",
    "curl |",
    "git push --force",
    "mkfs",
    ":(){:|:&}"
  ]
}
```  

---

### 13. 密钥扫描就绪度 🟡 中危

**需检查内容：**  
- 是否已配置 detect-secrets？  
- 是否存在 `.secrets.baseline` 文件？  
- 是否已运行基线扫描？  

**检测方法：**  
```bash
ls -la .secrets.baseline 2>/dev/null
which detect-secrets 2>/dev/null
```  

**密钥扫描（CI）：**  
```bash
# Find candidates
detect-secrets scan --baseline .secrets.baseline

# Review findings
detect-secrets audit

# Update baseline after rotating secrets or marking false positives
detect-secrets scan --baseline .secrets.baseline --update
```  

**漏洞：** 代码库中泄露的凭据可能导致系统被攻陷。  

---

## 审计函数

`--fix` 标志启用以下防护措施：

- 将常见频道的 `groupPolicy` 由 `open` 更改为 `allowlist`  
- 将 `logging.redactSensitive` 由 `off` 重置为 `tools`  
- 加固本地权限：将 `.clawdbot` 目录权限收紧至 `700`，配置文件权限收紧至 `600`  
- 保护状态文件，包括凭据与认证配置文件  

## 高层审计检查清单

按以下优先级顺序处理发现的问题：

1. **🔴 锁定私信（DM）与群组访问** —— 若工具在开放设置下启用  
2. **🔴 立即修复公网网络暴露问题**  
3. **🟠 通过令牌与 HTTPS 加固浏览器控制**  
4. **🟠 修正凭据与配置文件的文件权限**  
5. **🟡 仅加载受信任的插件**  
6. **🟡 对具备工具访问权限的机器人，使用现代模型**  

## 访问控制模型

### 私信（DM）访问模型

| 模式 | 描述 |  
|------|------|  
| `pairing` | 默认模式 —— 未知发送方须经验证码批准 |  
| `allowlist` | 未知发送方未经握手即被屏蔽 |  
| `open` | 公开访问 —— 需在白名单中显式添加星号（*） |  
| `disabled` | 忽略所有入站私信（DM） |  

### 斜杠命令（Slash Commands）

斜杠命令仅对基于频道白名单授权的发送方可用。`/exec` 命令仅为操作员提供会话便利，不修改全局配置。

## 威胁模型与缓解措施

### 潜在风险

| 风险 | 缓解措施 |  
|------|----------|  
| Shell 命令执行 | `blocked_commands`、`restrict_tools` |  
| 文件与网络访问 | `sandbox`、`workspaceAccess: none/ro` |  
| 社会工程学与提示注入 | `wrap_untrusted_content`、`mentionGate` |  
| 浏览器会话劫持 | 专用配置文件、令牌认证、HTTPS |  
| 凭据泄露 | `logging.redactSensitive: tools`、环境变量 |  

## 事件响应

若怀疑发生入侵，请按以下步骤操作：

### 隔离（Containment）
1. **停止网关进程** —— `clawdbot daemon stop`  
2. **将 gateway.bind 设为回环地址** —— `"bind": "127.0.0.1"`  
3. **禁用高风险私信（DM）与群组** —— 设为 `disabled`  

### 凭据轮换（Rotation）
1. **更换网关身份验证令牌** —— `clawdbot doctor --generate-gateway-token`  
2. **轮换浏览器控制与钩子（hook）令牌**  
3. **撤销并轮换模型提供商的 API 密钥**  

### 复查（Review）
1. **检查网关日志与会话转录** —— `~/.clawdbot/logs/`  
2. **审查近期配置变更** —— Git 历史或备份  
3. **使用 deep 标志重新运行安全审计** —— `clawdbot security audit --deep`  

## 漏洞报告

请将安全问题报告至：**security@clawd.bot**  

**切勿在漏洞修复前公开披露漏洞。**  

## 审计执行步骤

运行安全审计时，请遵循以下顺序：

### 步骤 1：定位配置  
```bash
CONFIG_PATHS=(
  "$HOME/.clawdbot/clawdbot.json"
  "$HOME/.clawdbot/config.yaml"
  "$HOME/.clawdbot/.clawdbotrc"
  ".clawdbotrc"
)
for path in "${CONFIG_PATHS[@]}"; do
  if [ -f "$path" ]; then
    echo "Found config: $path"
    cat "$path"
    break
  fi
done
```  

### 步骤 2：执行各领域检查  
对上述 13 个领域逐一执行：  
1. 解析相关配置项  
2. 与安全基线比对  
3. 按严重程度标记偏差  

### 步骤 3：生成报告  
按严重程度格式化发现项：  
```
🔴 CRITICAL: [vulnerability] - [impact]
🟠 HIGH: [vulnerability] - [impact]
🟡 MEDIUM: [vulnerability] - [impact]
✅ PASSED: [check name]
```  

### 步骤 4：提供修复方案  
对每项发现，输出：  
- 所需的具体配置变更  
- 示例配置  
- （若安全）应用命令  

## 报告模板  

```
═══════════════════════════════════════════════════════════════
🔒 CLAWDBOT SECURITY AUDIT
═══════════════════════════════════════════════════════════════
Timestamp: $(date -Iseconds)

┌─ SUMMARY ───────────────────────────────────────────────
│ 🔴 Critical:  $CRITICAL_COUNT
│ 🟠 High:      $HIGH_COUNT
│ 🟡 Medium:    $MEDIUM_COUNT
│ ✅ Passed:    $PASSED_COUNT
└────────────────────────────────────────────────────────

┌─ FINDINGS ──────────────────────────────────────────────
│ 🔴 [CRITICAL] $VULN_NAME
│    Finding: $DESCRIPTION
│    → Fix: $REMEDIATION
│
│ 🟠 [HIGH] $VULN_NAME
│    ...
└────────────────────────────────────────────────────────

This audit was performed by Clawdbot's self-security framework.
No changes were made to your configuration.
```  

## 扩展本 skill  

如需添加新的安全检查项，请执行以下步骤：

1. **识别漏洞** —— 哪种错误配置会产生风险？  
2. **确定检测方法** —— 哪个配置项或系统状态可揭示该问题？  
3. **定义基线** —— 安全配置应为何种形式？  
4. **编写检测逻辑** —— 使用 Shell 命令或文件解析  
5. **记录修复方案** —— 提供具体修复步骤  
6. **指定严重程度** —— 关键、高危、中危、低危  

### 示例：添加 SSH 加固检查  

```
## 14. SSH Agent Forwarding 🟡 Medium

**What to check:** Is SSH_AUTH_SOCK exposed to containers?

**Detection:**
```bash  
env | grep SSH_AUTH_SOCK  
```

**Vulnerability:** Container escape via SSH agent hijacking.

**Severity:** Medium
```  

## 安全评估问题  

审计过程中，请思考以下问题：

1. **暴露面**：哪些网络接口可访问 Clawdbot？  
2. **身份验证**：每个接入点需要何种验证？  
3. **隔离性**：Clawdbot 与宿主机之间存在哪些边界？  
4. **信任源**：哪些内容来源被视为“可信”？  
5. **可审计性**：是否存在 Clawdbot 行为的证据？  
6. **最小权限**：Clawdbot 是否仅拥有必要权限？  

## 应用原则  

- **零修改** —— 本 skill 仅执行读取操作，绝不更改配置  
- **纵深防御** —— 多重检查可捕获不同攻击向量  
- **可操作输出** —— 每项发现均附带具体修复方案  
- **可扩展设计** —— 新检查项可自然集成  

## 参考资料  

- 官方文档：https://docs.clawd.bot/gateway/security  
- 原始框架：[ᴅᴀɴɪᴇʟ ᴍɪᴇssʟᴇʀ on X](https://x.com/DanielMiessler/status/2015865548714975475)  
- 仓库地址：https://github.com/TheSethRose/Clawdbot-Security-Check  
- 漏洞报告：security@clawd.bot  

---  

**谨记：** 本 skill 的存在，旨在使 Clawdbot 对自身安全态势具备自感知能力。请定期使用、按需扩展，切勿跳过审计环节。  