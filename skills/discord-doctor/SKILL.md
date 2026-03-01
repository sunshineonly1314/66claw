---
name: discord-doctor
name_zh: Discord 诊断
description: 快速诊断并修复 Discord 机器人、Gateway、OAuth token 及旧版配置相关问题。检查连通性、token 是否过期，并清理旧版 Clawdis 遗留组件。
description_zh: 快速诊断并修复 Discord 机器人、Gateway、OAuth token 及旧版配置相关问题。检查连通性、token 是否过期，并清理旧版 Clawdis 遗留组件。
metadata: {"clawdbot":{"emoji":"🩺","os":["darwin","linux"],"requires":{"bins":["node","curl"]}}}
---
# Discord Doctor

快速诊断并修复 Discord/Gateway 可用性问题、OAuth token 异常以及旧版 Clawdis 配置冲突。

## 使用方式

```bash
# Check status (diagnostic only)
discord-doctor

# Check and auto-fix issues
discord-doctor --fix
```

## 检查项

1. **Discord 桌面应用** —— Discord 桌面客户端是否正在运行（可选，用于监控）  
2. **Gateway 进程** —— Clawdbot gateway 守护进程是否正在运行  
3. **Gateway HTTP 服务** —— Gateway 是否在端口 18789 上响应 HTTP 请求  
4. **Discord 连接状态** —— 机器人是否实际连接至 Discord（通过 `clawdbot health` 检测）  
5. **Anthropic OAuth 状态** —— 您的 OAuth token 是否有效或已过期  
6. **旧版 Clawdis 组件** —— 检测可能导致冲突的旧 launchd 服务和配置目录  
7. **近期活动** —— 显示最近的 Discord 会话记录

## 自动修复能力

当以 `--fix` 参数运行时，本工具可执行以下操作：

- **启动 gateway**（若其未运行）  
- **安装缺失的 npm 包**（例如 discord.js、strip-ansi）  
- **在修复依赖后重启 gateway**  
- **移除旧版 launchd 服务**（`com.clawdis.gateway.plist`）  
- **备份旧版配置**（将 `~/.clawdis` 移至 `~/.clawdis-backup`）

## 常见问题与修复方案

| 问题 | 自动修复操作 |
|------|--------------|
| Gateway 未运行 | 在端口 18789 启动 gateway |
| 缺少 npm 包 | 执行 `npm install` 并安装指定包 |
| Discord 断开连接 | 重启 gateway 以重新连接 |
| OAuth token 已过期 | 显示重新认证的操作指引 |
| 旧版 launchd 服务存在 | 移除旧 `com.clawdis.gateway.plist` |
| 旧版 ~/.clawdis 配置存在 | 移至 `~/.clawdis-backup` |

## OAuth Token 相关问题

若看到 “Access token EXPIRED” 提示，请运行：  
```bash
cd ~/Clawdis && npx clawdbot configure
```  
然后选择 “Anthropic OAuth (Claude Pro/Max)” 以完成重新认证。

## 旧版 Clawdis 迁移说明

若您由 Clawdis 升级至 Clawdbot，则可能残留旧版组件，从而引发 OAuth token 冲突：

- **旧 launchd 服务**：`~/Library/LaunchAgents/com.clawdis.gateway.plist`  
- **旧配置目录**：`~/.clawdis/`  

运行 `discord-doctor --fix` 可自动清理上述组件。

## 示例输出

```
Discord Doctor
Checking Discord and Gateway health...

1. Discord App
   Running (6 processes)

2. Gateway Process
   Running (PID: 66156, uptime: 07:45)

3. Gateway HTTP
   Responding on port 18789

4. Discord Connection
   Discord: ok (@Clawdis) (321ms)

5. Anthropic OAuth
   Valid (expires in 0h 45m)

6. Legacy Clawdis
   No legacy launchd service
   No legacy config directory

7. Recent Discord Activity
   - discord:group:123456789012345678 (21h ago)

Summary
All checks passed! Discord is healthy.
```