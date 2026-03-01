---
name: clawdbot-sync
name_zh: 同步工具
version: 1.0.0
description: "在多个 Clawdbot 实例之间同步记忆、偏好设置及 skills。支持通过 Tailscale/SSH 上的 rsync 实现双向同步。当用户要求与另一台 Clawdbot 同步、在多个实例间共享记忆，或保持多个 agent 同步时启用。触发词：/sync、'sync with mac'、'update other clawdbot'、'share this with my other bot'。"
description_zh: 在多个 Clawdbot 实例之间同步记忆、偏好设置及 skills。支持通过 Tailscale/SSH 上的 rsync 实现双向同步。当用户要求与另一台 Clawdbot 同步、在多个实例间共享记忆，或保持多个 agent 同步时启用。触发词：/sync、'sync with mac'、'update other clawdbot'、'share this with my other bot'。
author: clawdbot
license: MIT
metadata:
  clawdbot:
    emoji: "🔄"
    triggers: ["/sync"]
    requires:
      bins: ["rsync", "ssh", "jq"]
  tags: ["sync", "multi-agent", "collaboration", "backup"]
---
# Clawdbot 同步 🔄

通过 Tailscale/SSH 在多个 Clawdbot 实例之间同步记忆、偏好设置及 skills。

## 功能特性

- **双向同步**：Clawdbot 实例间互相同步  
- **智能冲突解决**：以最新版本为准，日志类文件则合并  
- **选择性同步**：可指定需同步的内容  
- **对等节点自动发现**：基于 Tailscale  
- **试运行模式（dry-run）**：预览同步效果  

## 命令列表

| 命令 | 作用 |
|------|------|
| `/sync` | 显示当前状态及已配置的对等节点 |
| `/sync status` | 检查与所有对等节点的连接状态 |
| `/sync now [peer]` | 与指定对等节点（或全部）同步 |
| `/sync push [peer]` | 将本地更改推送至对等节点 |
| `/sync pull [peer]` | 从对等节点拉取更改 |
| `/sync add <name> <host> [user] [path]` | 添加一个对等节点 |
| `/sync remove <name>` | 移除一个对等节点 |
| `/sync diff [peer]` | 显示同步将导致的变更内容 |
| `/sync history` | 显示同步历史记录 |

## 设置步骤

### 1. 配置对等节点

```bash
handler.sh add mac-mini 100.95.193.55 clawdbot /Users/clawdbot/clawd $WORKSPACE
handler.sh add server 100.89.48.26 clawdbot /home/clawdbot/clawd $WORKSPACE
```

### 2. 确保 SSH 访问

两台设备均需配置 SSH 密钥认证：  
```bash
ssh-copy-id clawdbot@100.95.193.55
```

### 3. 测试连接

```bash
handler.sh status $WORKSPACE
```

## 同步内容

| 项目 | 默认 | 说明 |
|------|------|------|
| `memory/` | ✅ 是 | 所有记忆文件及 skill 数据 |
| `MEMORY.md` | ✅ 是 | 主记忆文件 |
| `USER.md` | ✅ 是 | 用户档案 |
| `IDENTITY.md` | ❌ 否 | 各实例拥有独立身份 |
| `skills/` | ⚙️ 可选 | 已安装的 skills |
| `config/` | ❌ 否 | 实例专属配置 |

## 处理器命令（Handler Commands）

```bash
handler.sh status $WORKSPACE                    # Check peers and connection
handler.sh sync <peer> $WORKSPACE               # Bi-directional sync
handler.sh push <peer> $WORKSPACE               # Push to peer
handler.sh pull <peer> $WORKSPACE               # Pull from peer
handler.sh diff <peer> $WORKSPACE               # Show differences
handler.sh add <name> <host> <user> <path> $WS  # Add peer
handler.sh remove <name> $WORKSPACE             # Remove peer
handler.sh history $WORKSPACE                   # Sync history
handler.sh auto <on|off> $WORKSPACE             # Auto-sync on heartbeat
```

## 冲突解决策略

1. **基于时间戳**：较新文件胜出  
2. **日志类文件合并**：仅追加型文件执行合并  
3. **跳过冲突文件**：可选择跳过冲突文件  
4. **手动解决**：标记待人工审核  

## 数据文件

存储于 `$WORKSPACE/memory/clawdbot-sync/`：

| 文件 | 用途 |
|------|------|
| `peers.json` | 已配置的对等节点列表 |
| `history.json` | 同步历史日志 |
| `config.json` | 同步偏好设置 |
| `conflicts/` | 待人工审核的冲突文件 |

## 示例会话

```
User: /sync now mac-mini
Bot: 🔄 Syncing with mac-mini (100.95.193.55)...

     📤 Pushing: 3 files changed
     • memory/streaming-buddy/preferences.json
     • memory/2026-01-26.md
     • MEMORY.md
     
     📥 Pulling: 1 file changed
     • memory/2026-01-25.md
     
     ✅ Sync complete! 4 files synchronized.
```

## 依赖要求

- `rsync`（用于高效文件同步）  
- `ssh`（用于安全传输）  
- 对等节点间具备 Tailscale 或直连网络访问能力  
- 已配置 SSH 密钥认证  

## 安全性

- 所有传输均通过 SSH（加密）  
- 不存储任何密码（仅支持密钥认证）  
- 同步路径受限于工作区（workspace）  
- 绝不同步任何系统文件  