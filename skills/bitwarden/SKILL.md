---
name: bitwarden
name_zh: Bitwarden
description: 使用 rbw CLI 安全地访问和管理 Bitwarden/Vaultwarden 密码。
description_zh: 使用 rbw CLI 安全地访问和管理 Bitwarden/Vaultwarden 密码。
metadata: {"clawdbot":{"emoji":"🔒","os":["linux","macos"],"requires":{"bins":["rbw"]}}}
---
# Bitwarden Skill

使用 `rbw` CLI 与 Bitwarden 或 Vaultwarden 保险库进行交互。

## 使用方法与配置

### 1. 初始化设置（首次运行）
```bash
rbw config set email <your_email>
rbw config set baseurl <vault_url> # Optional, defaults to bitwarden.com
rbw login
```
*注意：登录需要主密码，且可能还需两步验证（电子邮件/TOTP）。*

### 2. 解锁保险库
```bash
rbw unlock
```
*注意：`rbw` 将会话密钥缓存在 agent 中。若需交互式输入（pinentry），请确认是否可将 `pinentry-curses`（基于 CLI 的 pinentry 工具）配置为 pinentry 提供程序。*

### 3. 管理操作
- **列出条目：** `rbw list`  
- **获取条目：** `rbw get "Name"`  
- **获取 JSON 格式数据：** `rbw get --full "Name"`  
- **搜索：** `rbw search "query"`  
- **添加条目：** `rbw add ...`  
- **同步：** `rbw sync`（刷新保险库）  
*注意：获取详细信息前，请务必先执行同步操作，以确保数据准确性。*

## 工具

agent 使用 `exec` 来运行 `rbw` 命令。  
- 解锁时，若 `rbw` 通过 pinentry-curses 提示输入密码，请改用 `tmux`。  
- 添加条目时，`rbw add` 可能需要配置 `EDITOR`，或依赖 `tmux`。