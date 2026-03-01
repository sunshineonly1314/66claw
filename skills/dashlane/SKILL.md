---
name: dashlane
name_zh: Dashlane
description: 从 Dashlane 保险库中访问密码、安全笔记、密钥及一次性验证码（OTP）
description_zh: 从 Dashlane 保险库中访问密码、安全笔记、密钥及一次性验证码（OTP）
homepage: https://cli.dashlane.com
metadata: {"clawdbot":{"emoji":"🔐","requires":{"bins":["dcli"]}}}
---
# Dashlane 命令行工具（CLI）

通过命令行访问您的 Dashlane 保险库。仅支持只读访问：密码、安全笔记、密钥及一次性验证码（OTP）。

## 安装

```bash
brew install dashlane/tap/dashlane-cli
```

## 认证

首次同步将触发认证流程：
```bash
dcli sync
```

**步骤：**
1. 输入您的 Dashlane 邮箱地址  
2. **⚠️ 重要：在浏览器中打开屏幕上显示的 URL**（设备注册）  
3. 输入邮箱收到的验证码  
4. 输入您的主密码（Master Password）

查看当前账户信息：
```bash
dcli accounts whoami
```

## 获取密码

```bash
# Search by URL or title (copies password to clipboard by default)
dcli p mywebsite
dcli password mywebsite

# Get specific field
dcli p mywebsite -f login      # Username/login
dcli p mywebsite -f email      # Email
dcli p mywebsite -f otp        # TOTP 2FA code
dcli p mywebsite -f password   # Password (default)

# Output formats
dcli p mywebsite -o clipboard  # Copy to clipboard (default)
dcli p mywebsite -o console    # Print to stdout
dcli p mywebsite -o json       # Full JSON output (all matches)

# Search by specific fields
dcli p url=example.com
dcli p title=MyBank
dcli p id=xxxxxx               # By vault ID
dcli p url=site1 title=site2   # Multiple filters (OR)
```

## 获取安全笔记

```bash
dcli note [filters]
dcli n [filters]               # Shorthand

# Filter by title (default)
dcli n my-note
dcli n title=api-keys

# Output formats: text (default), json
dcli n my-note -o json
```

## 获取密钥

Dashlane 的密钥（secrets）是一种专用于存储敏感数据的内容类型。

```bash
dcli secret [filters]

# Filter by title (default)
dcli secret api_keys
dcli secret title=api_keys -o json
```

## 其他命令

```bash
# Sync vault manually (auto-sync every hour by default)
dcli sync

# Lock the vault (requires master password to unlock)
dcli lock

# Logout completely
dcli logout

# Backup vault to current directory
dcli backup
dcli backup --directory /path/to/backup
```

## 配置

```bash
# Save master password in OS keychain (default: true)
dcli configure save-master-password true

# Disable auto-sync
dcli configure disable-auto-sync true

# Enable biometrics unlock (macOS only)
dcli configure user-presence --method biometrics

# Disable user presence check
dcli configure user-presence --method none
```

## 各平台持久化机制

### macOS  
主密码默认存储于 **钥匙串（Keychain）** 中，重启后仍有效。  
```bash
dcli configure save-master-password true
```

### Linux（服务器/无界面环境）  
无原生密钥管理器。可选方案如下：  
1. **环境变量方式**（安全性较低，但配置简单）：  
   ```bash
   export DASHLANE_MASTER_PASSWORD="..."
   ```  
2. **本地加密文件**：`save-master-password true` 存储于 `~/.local/share/dcli/`  
3. **外部密钥管理服务**（如 HashiCorp Vault、AWS Secrets Manager 等），用于注入该环境变量  

### Docker / CI 环境  
使用传入容器的 `DASHLANE_MASTER_PASSWORD` 环境变量。  
```bash
docker run -e DASHLANE_MASTER_PASSWORD="..." myimage
```

### SSO / 密码免登录  
dcli 当前尚不支持 —— 必须使用传统主密码（Master Password）。

## 高级功能：注入密钥（secrets）

```bash
# Inject secrets into environment variables
dcli exec -- mycommand

# Inject into templated files
dcli inject < template.txt > output.txt

# Read secret by path
dcli read "dl://vault/secret-id"
```

## 示例

### 获取两步验证（2FA）所需的 OTP  
```bash
dcli p github -f otp
# Returns: 123456 (25s remaining)
```

### 从保险库获取 SSH 密钥  
将私钥存入安全笔记，然后执行：  
```bash
dcli n SSH_KEY | ssh-add -
```

### 脚本化调用  
```bash
# Get password for a script
PASSWORD=$(dcli p myservice -o console)

# Get JSON and parse with jq
dcli p myservice -o json | jq -r '.[0].password'
```

## 故障排查

- **被锁定？** 运行 `dcli sync` 解锁  
- **SSO 用户：** 需已安装 Chrome 浏览器且具备图形界面  
- **免密登录：** 当前尚不支持  
- **调试模式：** `dcli --debug <command>`  

文档：https://cli.dashlane.com