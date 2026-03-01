---
name: claude-connect
name_zh: Claude连接
description: "即时将 Claude 连接到 Clawdbot，并保持 24/7 持续连接。设置完成后运行一次即可绑定您的订阅，之后将永久自动刷新令牌。"
description_zh: 即时将 Claude 连接到 Clawdbot，并保持 24/7 持续连接。设置完成后运行一次即可绑定您的订阅，之后将永久自动刷新令牌。
---
# claude-connect

**一步完成 Claude 订阅与 Clawdbot 的连接。**

自动执行以下操作：
- ✅ 从 macOS Keychain 读取 Claude OAuth 令牌  
- ✅ 以标准 OAuth 格式将其写入 Clawdbot  
- ✅ 每 2 小时自动刷新一次（在过期前）  
- ✅ 刷新成功或失败时向您发送通知  
- ✅ 兼容 `clawdbot onboard`（修复 OAuth auth-profiles bug）

---

## 快速开始

**1. 安装 skill：**  
```bash
clawdhub install claude-connect
cd ~/clawd/skills/claude-connect
```

**2. 确保 Claude CLI 已登录：**  
```bash
claude auth
# Follow the browser login flow
```

**3. 运行安装器：**  
```bash
./install.sh
```

完成！令牌将每 2 小时自动刷新一次。

---

## 功能说明

### 修复 `clawdbot onboard` 的 OAuth Bug

运行 `clawdbot onboard --auth-choice claude-cli` 时，有时无法正确将 OAuth 令牌写入 `auth-profiles.json`。

本 skill 可：
1. 从 macOS Keychain（Claude CLI 存储令牌的位置）读取 OAuth 令牌  
2. 以 **标准 OAuth 格式** 写入 `~/.clawdbot/agents/main/agent/auth-profiles.json`：  
   ```json
   {
     "profiles": {
       "anthropic:claude-cli": {
         "type": "oauth",
         "provider": "anthropic",
         "access": "sk-ant-...",
         "refresh": "sk-ant-ort...",
         "expires": 1234567890
       }
     }
   }
   ```  
3. 配置自动刷新（通过 launchd 每 2 小时运行一次）  
4. 保持您的连接全天候（24/7）在线  

---

## 安装方式

### 自动安装（推荐）

```bash
cd ~/clawd/skills/claude-connect
./install.sh
```

安装器将自动执行以下操作：
- ✅ 验证 Claude CLI 是否已配置  
- ✅ 创建配置文件  
- ✅ 配置自动刷新任务（launchd）  
- ✅ 执行首次刷新以测试功能  

### 手动安装

1. 复制示例配置文件：  
   ```bash
   cp claude-oauth-refresh-config.example.json claude-oauth-refresh-config.json
   ```

2. 编辑配置文件（可选）：  
   ```bash
   nano claude-oauth-refresh-config.json
   ```

3. 测试刷新功能：  
   ```bash
   ./refresh-token.sh --force
   ```

4. 安装 launchd 任务（可选，用于自动刷新）：  
   ```bash
   cp com.clawdbot.claude-oauth-refresher.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.clawdbot.claude-oauth-refresher.plist
   ```

---

## 配置说明

编辑 `claude-oauth-refresh-config.json`：

```json
{
  "refresh_buffer_minutes": 30,
  "log_file": "~/clawd/logs/claude-oauth-refresh.log",
  "notifications": {
    "on_success": true,
    "on_failure": true
  },
  "notification_target": "YOUR_CHAT_ID"
}
```

**可选参数：**  
- `refresh_buffer_minutes`：当令牌剩余有效期小于该分钟数时触发刷新（默认值：30）  
- `log_file`：刷新活动日志的输出路径  
- `notifications.on_success`：刷新成功时是否发送通知（默认值：true）  
- `notifications.on_failure`：刷新失败时是否发送通知（默认值：true）  
- `notification_target`：您的 Telegram 聊天 ID（留空则禁用通知）

---

## 使用方法

### 手动刷新

```bash
# Refresh now (even if not expired)
./refresh-token.sh --force

# Refresh only if needed
./refresh-token.sh
```

### 查看状态

```bash
# View recent logs
tail ~/clawd/logs/claude-oauth-refresh.log

# Check auth profile
cat ~/.clawdbot/agents/main/agent/auth-profiles.json | jq '.profiles."anthropic:claude-cli"'

# Check Clawdbot status
clawdbot models status
```

### 禁用通知

向 Clawdbot 发送指令：  
```
Disable Claude refresh success notifications
```

或编辑配置文件：  
```json
{
  "notifications": {
    "on_success": false,
    "on_failure": true
  }
}
```

---

## 工作原理

### 刷新流程

1. **从 Keychain 读取：** 从 `Claude Code-credentials` 获取 OAuth 令牌  
2. **检查过期时间：** 仅当剩余有效期 < 30 分钟（或 `--force`）时才刷新  
3. **调用 OAuth API：** 获取新的 access token 和 refresh token  
4. **更新 auth-profiles.json：** 以标准 OAuth 格式写入  
5. **更新 Keychain：** 将新令牌同步回 Keychain  
6. **重启网关：** 使网关加载新令牌  
7. **发送通知：** （可选）推送成功或失败消息  

### 自动刷新（launchd）

通过 `~/Library/LaunchAgents/com.clawdbot.claude-oauth-refresher.plist` 每 2 小时运行一次。

**控制命令：**  
```bash
# Stop auto-refresh
launchctl unload ~/Library/LaunchAgents/com.clawdbot.claude-oauth-refresher.plist

# Start auto-refresh
launchctl load ~/Library/LaunchAgents/com.clawdbot.claude-oauth-refresher.plist

# Check if running
launchctl list | grep claude
```

---

## 故障排查

### 开通后 OAuth 无法工作

**现象：** `clawdbot onboard --auth-choice claude-cli` 执行成功，但 Clawdbot 无法使用令牌  

**解决方法：**  
```bash
cd ~/clawd/skills/claude-connect
./refresh-token.sh --force
```  

该命令将以标准 OAuth 格式写入令牌。

### 令牌频繁过期

**现象：** 认证在 8 小时后持续失败  

**解决方法：** 确保 launchd 任务正在运行：  
```bash
launchctl load ~/Library/LaunchAgents/com.clawdbot.claude-oauth-refresher.plist
launchctl list | grep claude
```

### Keychain 中无令牌

**现象：** `No 'Claude Code-credentials' entries found`  

**解决方法：** 使用 Claude CLI 登录：  
```bash
claude auth
# Follow browser flow
```  

然后再次运行刷新命令：  
```bash
./refresh-token.sh --force
```

---

## 卸载

```bash
cd ~/clawd/skills/claude-connect
./uninstall.sh
```

或手动卸载：  
```bash
# Stop auto-refresh
launchctl unload ~/Library/LaunchAgents/com.clawdbot.claude-oauth-refresher.plist
rm ~/Library/LaunchAgents/com.clawdbot.claude-oauth-refresher.plist

# Remove skill
rm -rf ~/clawd/skills/claude-connect
```

---

## 升级

若您此前已安装旧版本：

```bash
cd ~/clawd/skills/claude-connect
./validate-update.sh  # Check what changed
clawdhub update claude-connect  # Update to latest
./install.sh  # Re-run installer if needed
```

---

## 参见

- [QUICKSTART.md](QUICKSTART.md) — 60 秒快速设置指南  
- [UPGRADE.md](UPGRADE.md) — 从旧版本升级说明  
- [Clawdbot 文档](https://docs.clawd.bot) — 模型认证说明  

---

**版本：** 1.1.0  
**作者：** TunaIssaCoding  
**许可证：** MIT  
**代码仓库：** https://github.com/TunaIssaCoding/claude-connect