---
name: clawdbot-release-check
name_zh: 发布检查
description: 检查 clawdbot 新版本发布，并在每个新版本首次出现时通知一次。
description_zh: 检查 clawdbot 新版本发布，并在每个新版本首次出现时通知一次。
homepage: https://github.com/clawdbot/clawdbot
metadata: {"clawdbot":{"emoji":"🔄","requires":{"bins":["curl","jq"]}}}
---
# Clawdbot 版本更新检查

从 GitHub 检查 clawdbot 的新版本发布，并在每个新版本首次出现时通知您一次，无重复打扰。

## 安装方法

```bash
clawdhub install clawdbot-release-check
```

## 快速设置（配合 cron）

```bash
# Add daily update check at 9am, notify via Telegram
{baseDir}/scripts/setup.sh --telegram YOUR_TELEGRAM_ID

# Custom hour (e.g., 8am)
{baseDir}/scripts/setup.sh --hour 8 --telegram YOUR_TELEGRAM_ID

# Remove cron job
{baseDir}/scripts/setup.sh --uninstall
```

设置完成后，请重启 gateway：
```bash
launchctl kickstart -k gui/$(id -u)/com.clawdis.gateway
```

## 手动使用方式

```bash
# Check for updates (silent if up-to-date or already notified)
{baseDir}/scripts/check.sh

# Show version info
{baseDir}/scripts/check.sh --status

# Force notification (bypass "already notified" state)
{baseDir}/scripts/check.sh --force

# Show highlights from ALL missed releases
{baseDir}/scripts/check.sh --all-highlights

# Clear state (will notify again on next check)
{baseDir}/scripts/check.sh --reset

# Help
{baseDir}/scripts/check.sh --help
```

## 工作原理

1. 从 `github.com/clawdbot/clawdbot/releases` 获取最新发布版本信息
2. 与您当前安装的版本（取自 `package.json`）进行比对
3. 若本地版本落后，则展示该版本发布说明中的重点更新内容
4. 保存状态记录，防止重复通知

## 示例输出

```
🔄 **Clawdbot Update Available!**

Current: `2.0.0-beta5`
Latest:  `2026.1.5-3`

_(3 versions behind)_

**Highlights:**
- Models: add image-specific model config
- Agent tools: new `image` tool
- Config: default model shorthands

🔗 https://github.com/clawdbot/clawdbot/releases/tag/v2026.1.5-3

To update: `cd /path/to/clawdis && git pull && pnpm install && pnpm build`
```

## 文件说明

**状态文件** —— `~/.clawdbot/clawdbot-release-check-state.json`：
```json
{
  "lastNotifiedVersion": "v2026.1.5-3",
  "lastCheckMs": 1704567890123
}
```

**缓存文件** —— `~/.clawdbot/clawdbot-release-check-cache.json`：
- 发布数据缓存 24 小时（节省 API 调用次数）
- 每个版本仅提取一次重点更新内容（节省 token）
- 使用 `--clear-cache` 强制刷新缓存

## 配置项

环境变量：
- `CLAWDBOT_DIR` —— Clawdbot 源码路径（自动从 `~/dev/clawdis`、`~/clawdbot` 或 npm 全局安装位置探测）
- `CACHE_MAX_AGE_HOURS` —— 缓存有效期（单位：小时；默认值：24）