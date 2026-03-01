---
name: bw-vault
name_zh: BW保险库
description: 配置并使用 Bitwarden CLI（`bw`）。适用于安装 CLI、身份验证（登录/解锁）或从保险库中读取密钥。支持邮箱/密码、API 密钥和 SSO 三种认证方式。
description_zh: 配置并使用 Bitwarden CLI（`bw`）。适用于安装 CLI、身份验证（登录/解锁）或从保险库中读取密钥。支持邮箱/密码、API 密钥和 SSO 三种认证方式。
homepage: https://bitwarden.com/help/cli/
metadata: {"clawdbot":{"emoji":"🔒","requires":{"bins":["bw"]},"install":[{"id":"npm","kind":"node","package":"@bitwarden/cli","bins":["bw"],"label":"Install Bitwarden CLI (npm)"},{"id":"brew","kind":"brew","formula":"bitwarden-cli","bins":["bw"],"label":"Install Bitwarden CLI (brew)"},{"id":"choco","kind":"download","package":"bitwarden-cli","bins":["bw"],"label":"Install Bitwarden CLI (choco)"}]}}
---
# Bitwarden CLI Skill

Bitwarden 命令行接口（CLI）提供对您的 Bitwarden 保险库的完整访问能力，可编程式地检索密码、安全笔记及其他密钥。

## 工作流要求

**重要提示：** 务必在专用的 tmux 会话内运行 `bw` 命令。CLI 在完成身份验证后，所有保险库操作均需依赖会话密钥（`BW_SESSION`）。tmux 会话可确保该环境变量在各命令间持续有效。

### 必需工作流

1. **验证 CLI 是否已安装**：运行 `bw --version`，确认 CLI 可用  
2. **创建专用 tmux 会话**：`tmux new-session -d -s bw-session`  
3. **连接并完成身份验证**：在该会话中运行 `bw login` 或 `bw unlock`  
4. **导出会话密钥**：解锁后，按 CLI 提示导出 `BW_SESSION`  
5. **执行保险库命令**：在**同一会话中**使用 `bw get`、`bw list` 等命令  

### 认证方式

| 方式 | 命令 | 使用场景 |
|------|------|----------|
| 邮箱/密码 | `bw login` | 交互式会话、首次配置 |
| API 密钥 | `bw login --apikey` | 自动化任务、脚本（需单独执行解锁） |
| SSO | `bw login --sso` | 企业/组织账户 |

使用邮箱/密码完成 `bw login` 后，您的保险库将自动解锁。若通过 API 密钥或 SSO 登录，则必须随后运行 `bw unlock` 才能解密保险库。

### 会话密钥管理

解锁命令将输出一个会话密钥。您**必须**将其导出：

```bash
# Bash/Zsh
export BW_SESSION="<session_key_from_unlock>"

# Or capture automatically
export BW_SESSION=$(bw unlock --raw)
```

会话密钥在您运行 `bw lock` 或 `bw logout` 前持续有效。它**不会**跨终端窗口持久化——因此必须使用 tmux。

## 读取密钥

```bash
# Get password by item name
bw get password "GitHub"

# Get username
bw get username "GitHub"

# Get TOTP code
bw get totp "GitHub"

# Get full item as JSON
bw get item "GitHub"

# Get specific field
bw get item "GitHub" | jq -r '.fields[] | select(.name=="api_key") | .value'

# List all items
bw list items

# Search items
bw list items --search "github"
```

## 安全防护机制

- **切勿**在日志、代码或用户可见的命令输出中暴露密钥  
- **切勿**将密钥写入磁盘，除非绝对必要  
- **务必**在完成保险库操作后使用 `bw lock`  
- **优先**将密钥直接读入环境变量，或通过管道传递给其他命令  
- 若收到 “Vault is locked”（保险库已锁定）错误，请使用 `bw unlock` 重新认证  
- 若收到 “You are not logged in”（您尚未登录）错误，请先运行 `bw login`  
- 若系统上不可用 tmux，请立即中止并请求协助  

## 环境变量

| 变量 | 用途 |
|------|------|
| `BW_SESSION` | 用于保险库解密的会话密钥（所有保险库命令均必需） |
| `BW_CLIENTID` | API 密钥的客户端 ID（用于 `--apikey` 登录） |
| `BW_CLIENTSECRET` | API 密钥的客户端密钥（用于 `--apikey` 登录） |
| `BITWARDENCLI_APPDATA_DIR` | 自定义配置目录（支持多账户配置） |

## 自托管服务器

对于 Vaultwarden 或自托管的 Bitwarden：

```bash
bw config server https://your-bitwarden-server.com
```

## 参考文档

- [入门指南](references/get-started.md) — 安装与初始配置  
- [CLI 示例](references/cli-examples.md) — 常见使用模式与高级操作