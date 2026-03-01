---
name: auto-updater
name_zh: 自动更新
description: "每日自动更新 Clawdbot 及所有已安装的 skills。通过 cron 运行，检查更新、应用更新，并向用户发送包含变更摘要的消息。"
description_zh: 每日自动更新 Clawdbot 及所有已安装的 skills。通过 cron 运行，检查更新、应用更新，并向用户发送包含变更摘要的消息。
metadata: {"version":"1.0.0","clawdbot":{"emoji":"🔄","os":["darwin","linux"]}}
---
# Auto-Updater Skill

借助每日更新检查，自动保持您的 Clawdbot 和 skills 始终处于最新状态。

## 功能说明

该 skill 会配置一个每日执行的 cron 任务，用于：

1. 更新 Clawdbot 自身（通过 `clawdbot doctor` 或包管理器）
2. 更新所有已安装的 skills（通过 `clawdhub update --all`）
3. 向您发送本次更新内容的摘要消息

## 安装设置

### 快速开始

请 Clawdbot 设置 auto-updater：

```
Set up daily auto-updates for yourself and all your skills.
```

或手动添加 cron 任务：

```bash
clawdbot cron add \
  --name "Daily Auto-Update" \
  --cron "0 4 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --wake now \
  --deliver \
  --message "Run daily auto-updates: check for Clawdbot updates and update all skills. Report what was updated."
```

### 配置选项

| 选项 | 默认值 | 说明 |
|--------|---------|-------------|
| 执行时间 | 凌晨 4:00 | 更新任务执行时间（使用 `--cron` 修改） |
| 时区 | 系统默认时区 | 使用 `--tz` 设置 |
| 消息投递位置 | 主会话 | 更新摘要消息的发送目标 |

## 更新机制说明

### Clawdbot 更新

对于 **npm/pnpm/bun 安装方式**：
```bash
npm update -g clawdbot@latest
# or: pnpm update -g clawdbot@latest
# or: bun update -g clawdbot@latest
```

对于 **源码安装方式**（git checkout）：
```bash
clawdbot update
```

每次更新后，务必运行 `clawdbot doctor` 以应用数据库迁移。

### Skill 更新

```bash
clawdhub update --all
```

该操作将比对注册中心中所有已安装的 skills，并更新存在新版本的那些 skill。

## 更新摘要格式

更新完成后，您将收到类似如下格式的消息：

```
🔄 Daily Auto-Update Complete

**Clawdbot**: Updated to v2026.1.10 (was v2026.1.9)

**Skills Updated (3)**:
- prd: 2.0.3 → 2.0.4
- browser: 1.2.0 → 1.2.1  
- nano-banana-pro: 3.1.0 → 3.1.2

**Skills Already Current (5)**:
gemini, sag, things-mac, himalaya, peekaboo

No issues encountered.
```

## 手动命令

仅检查更新（不应用）：
```bash
clawdhub update --all --dry-run
```

查看当前各 skill 的版本：
```bash
clawdhub list
```

查看 Clawdbot 当前版本：
```bash
clawdbot --version
```

## 故障排查

### 更新未执行

1. 确认 cron 已启用：检查配置中的 `cron.enabled` 项
2. 确保 Gateway 持续运行
3. 检查 cron 任务是否存在：`clawdbot cron list`

### 更新失败

若更新失败，摘要消息中将包含错误详情。常见修复方法如下：

- **权限错误**：确保 Gateway 用户对 skill 目录具有写入权限  
- **网络错误**：检查网络连接状况
- **包冲突**：运行 `clawdbot doctor` 进行诊断

### 禁用自动更新

移除 cron 任务：
```bash
clawdbot cron remove "Daily Auto-Update"
```

或在配置中临时禁用：
```json
{
  "cron": {
    "enabled": false
  }
}
```

## 相关资源

- [Clawdbot 更新指南](https://docs.clawd.bot/install/updating)
- [ClawdHub CLI](https://docs.clawd.bot/tools/clawdhub)
- [Cron 任务](https://docs.clawd.bot/cron)