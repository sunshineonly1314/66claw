---
name: clauditor
name_zh: Clauditor
description: 针对 Clawdbot agents 的防篡改审计看门狗。检测并记录可疑的文件系统活动，并通过 HMAC 链式机制确保证据不可伪造。
description_zh: 针对 Clawdbot agents 的防篡改审计看门狗。检测并记录可疑的文件系统活动，并通过 HMAC 链式机制确保证据不可伪造。
homepage: https://github.com/apollostreetcompany/clauditor
metadata: {"clawdbot":{"emoji":"🛡️","requires":{"bins":["cargo","systemctl"],"os":"linux"}}}
---
# Clauditor

一款安全看门狗，用于监控文件系统活动并生成防篡改日志。即使 Clawdbot 被攻破，也无法停止该看门狗、伪造日志条目或删除证据。

## 安装（向导模式）

使用 CLI 向导引导用户完成安装流程：

```bash
cd /path/to/clauditor
cargo build --release
```

### Agent 工作流

1. **检查状态：** `./target/release/clauditor wizard status`  
   - 返回包含 `current_step`（取值范围 1–6）和 `complete`（true/false）的 JSON

2. **获取下一步操作：** `./target/release/clauditor wizard next`  
   - 显示该步骤 **WHAT**（执行什么）、**WHY**（为何重要）以及需运行的 **EXACT COMMAND**（精确命令）

3. **用户执行 sudo 命令**

4. **验证：** `./target/release/clauditor wizard verify`  
   - 确认该步骤已完成

5. **重复上述步骤，直至 `complete: true`**

### 示例交互

```
User: "Install clauditor"

Agent: [runs wizard status → current_step: 1]
Agent: "Step 1 of 6: Create system user

This creates a 'sysaudit' user that runs the watchdog. Even if you're 
compromised, you can't kill a process owned by another user.

Run this:
sudo useradd --system --shell /usr/sbin/nologin --no-create-home sysaudit

Let me know when done."

User: "done"

Agent: [runs wizard verify → success]
Agent: [runs wizard next → step 2...]
```

## 安装后

### 检查状态
```bash
systemctl status systemd-journaldd
```

### 生成摘要
```bash
./target/release/clauditor digest \
  --log /var/lib/.sysd/.audit/events.log \
  --key /etc/sysaudit/key \
  --format markdown
```

## 快速安装（高级用户）

```bash
sudo bash wizard/wizard.sh
```

## 配置

- 配置文件：`/etc/sysaudit/config.toml`  
- 密钥：`/etc/sysaudit/key`  
- 日志：`/var/lib/.sysd/.audit/events.log`  

编辑配置文件以自定义 `watch_paths` 和 `target_uid`。