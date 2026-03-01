---
name: clawdbot-skill-update
name_zh: 技能更新
description: 支持动态工作区检测的全面备份、更新与恢复工作流
description_zh: 支持动态工作区检测的全面备份、更新与恢复工作流
homepage: https://github.com/pasogott/clawdbot-skill-update
metadata: {"clawdbot":{"emoji":"💾","requires":{"bins":["bash","jq","tar","git"]},"tags":["backup","restore","update","multi-agent"]}}
---
# Clawdbot Update 技能

面向 Clawdbot 安装的全面、**模块化**备份、更新与恢复工作流。

## 仓库信息

- **GitHub**：https://github.com/clawdbot/clawdbot  
- **上游源（Upstream）**：`origin/main`  
- **本地克隆路径（Local Clone）**：`~/code/clawdbot`（默认）  

## 技能说明

本技能提供一套完整的、**模块化**的 Clawdbot 更新工作流，并支持**动态工作区检测**：  
- 配置文件  
- Agent 状态与会话  
- 凭据与认证 token  
- **全部 agent 工作区（从配置中自动检测）**  
- Cron 任务与沙箱（sandbox）  
- Git 仓库状态  

### 核心特性

✅ **动态工作区检测** —— 从配置中读取工作区路径  
✅ **多 Agent 支持** —— 自动处理多个 agents  
✅ **安全回滚** —— 支持完整恢复能力  
✅ **Git 集成** —— 追踪版本与远程仓库  
✅ **验证机制** —— 内置更新前后检查  
✅ **试运行（Dry Run）** —— 备份前预览效果  

## 文件说明

- `config.json` —— 技能配置（仓库 URL、路径等）  
- `backup-clawdbot-dryrun.sh` —— **试运行（Dry run）** 预览（不执行任何更改）  
- `backup-clawdbot-full.sh` —— **动态**全量备份脚本  
- `restore-clawdbot.sh` —— **动态**恢复脚本  
- `validate-setup.sh` —— 更新前后验证脚本  
- `check-upstream.sh` —— 检查可用更新  
- `UPDATE_CHECKLIST.md` —— 分步更新检查清单  
- `QUICK_REFERENCE.md` —— 快速命令参考  
- `SKILL.md` —— 当前文件  
- `README.md` —— 快速入门指南  

### 动态特性说明

备份与恢复脚本现已支持：  
- 从 `~/.clawdbot/clawdbot.json` 中读取工作区路径  
- 支持任意数量的 agents  
- 对缺失工作区进行容错处理  
- 基于 agent ID 生成安全的文件名  

## 使用场景

当用户提出以下请求时，可触发本技能：  
- “更新 clawdbot”  
- “升级至最新版本”  
- “更新前备份 clawdbot”  
- “从备份中恢复 clawdbot”  
- “回滚 clawdbot 更新”  

## 使用方法

### 1. 备份预览（试运行）

```bash
~/.skills/clawdbot-update/backup-clawdbot-dryrun.sh
```

**输出内容包括：**  
- 即将被备份的文件列表  
- 预估备份体积  
- 工作区检测结果  
- 可用磁盘空间  
- 将被跳过的文件  

**注意：此操作不会创建或修改任何文件！**

### 2. 执行全量备份

```bash
~/.skills/clawdbot-update/backup-clawdbot-full.sh
```

**备份内容包括：**  
- `~/.clawdbot/clawdbot.json`（配置）  
- `~/.clawdbot/sessions/`（会话状态）  
- `~/.clawdbot/agents/`（多 agent 状态）  
- `~/.clawdbot/credentials/`（认证 token）  
- `~/.clawdbot/cron/`（定时任务）  
- `~/.clawdbot/sandboxes/`（沙箱状态）  
- 全部 agent 工作区（动态检测！）  
- Git 提交哈希与仓库状态  

**输出文件：** `~/.clawdbot-backups/pre-update-YYYYMMDD-HHMMSS/`

### 3. 更新 Clawdbot

请遵循如下检查清单：

```bash
cat ~/.skills/clawdbot-update/UPDATE_CHECKLIST.md
```

**关键步骤：**  
1. 创建备份  
2. 停止网关（gateway）  
3. 拉取最新代码  
4. 根据破坏性变更调整配置  
5. 运行 doctor 工具  
6. 测试各项功能  
7. 以守护进程模式启动网关  

### 4. 从备份恢复

```bash
~/.skills/clawdbot-update/restore-clawdbot.sh ~/.clawdbot-backups/pre-update-YYYYMMDD-HHMMSS
```

**恢复内容包括：**  
- 全部配置  
- 全部状态文件  
- 全部工作区  
- （可选）Git 版本  

## 重要说明

### 多 Agent 部署

本技能专为多 agent 部署设计，支持：  
- 多个具有独立工作区的 agents  
- 沙箱（sandbox）配置  
- 多渠道提供商路由（WhatsApp / Telegram / Discord / Slack 等）  

### v2026.1.8 版本破坏性变更

**严重警告：**  
- **私信（DM）锁定**：DM 默认策略更改为 `pairing`，不再开放  
- **群组（Groups）**：`telegram.groups` 和 `whatsapp.groups` 现均为白名单机制  
- **沙箱（Sandbox）**：默认作用域由隐式（implicit）更改为 `"agent"`  
- **时间戳**：信封（agent envelopes）中统一采用 UTC 格式  

### 备份验证

备份完成后，请务必验证：  
```bash
BACKUP_DIR=~/.clawdbot-backups/pre-update-YYYYMMDD-HHMMSS
cat "$BACKUP_DIR/BACKUP_INFO.txt"
ls -lh "$BACKUP_DIR"
```

其中应包含：  
- ✅ `clawdbot.json`  
- ✅ `credentials.tar.gz`  
- ✅ `workspace-*.tar.gz`（每个 agent 各一个）  

### 必须的配置变更

**示例：将 WhatsApp 切换为配对模式（pairing）：**  
```bash
jq '.whatsapp.dmPolicy = "pairing"' ~/.clawdbot/clawdbot.json | sponge ~/.clawdbot/clawdbot.json
```

**示例：显式设置沙箱作用域：**  
```bash
jq '.agent.sandbox.scope = "agent"' ~/.clawdbot/clawdbot.json | sponge ~/.clawdbot/clawdbot.json
```

## 工作流

### 标准更新流程

```bash
# 1. Check for updates
~/.skills/clawdbot-update/check-upstream.sh

# 2. Validate current setup
~/.skills/clawdbot-update/validate-setup.sh

# 3. Dry run
~/.skills/clawdbot-update/backup-clawdbot-dryrun.sh

# 4. Backup
~/.skills/clawdbot-update/backup-clawdbot-full.sh

# 5. Stop gateway
cd ~/code/clawdbot
pnpm clawdbot gateway stop

# 6. Update code
git checkout main
git pull --rebase origin main
pnpm install
pnpm build

# 7. Run doctor
pnpm clawdbot doctor --yes

# 8. Test
pnpm clawdbot gateway start  # foreground for testing

# 9. Deploy
pnpm clawdbot gateway stop
pnpm clawdbot gateway start --daemon
```

### 回滚流程

```bash
# Quick rollback
~/.skills/clawdbot-update/restore-clawdbot.sh <backup-dir>

# Manual rollback
cd ~/code/clawdbot
git checkout <old-commit>
pnpm install && pnpm build
cp <backup-dir>/clawdbot.json ~/.clawdbot/
pnpm clawdbot gateway restart
```

## 更新后测试

### 功能性测试

- [ ] 各渠道私信（DM）正常（检查配对策略）  
- [ ] 群组提及（mentions）可响应  
- [ ] 输入指示器（typing indicators）正常  
- [ ] Agent 路由正常  
- [ ] 沙箱隔离正常  
- [ ] 工具限制策略已生效  

### 新增功能

```bash
pnpm clawdbot agents list
pnpm clawdbot logs --tail 50
pnpm clawdbot providers list --usage
pnpm clawdbot skills list
```

### 监控建议

```bash
# Live logs
pnpm clawdbot logs --follow

# Or Web UI
open http://localhost:3001/logs

# Check status
pnpm clawdbot status
pnpm clawdbot gateway status
```

## 故障排查

### 常见问题

**网关无法启动：**  
```bash
pnpm clawdbot logs --grep error
pnpm clawdbot doctor
```

**认证错误：**  
```bash
# OAuth profiles might need re-login
pnpm clawdbot providers login <provider>
```

**沙箱异常：**  
```bash
# Check sandbox config
jq '.agent.sandbox' ~/.clawdbot/clawdbot.json

# Check per-agent sandbox
jq '.routing.agents[] | {name, sandbox}' ~/.clawdbot/clawdbot.json
```

### 紧急恢复

若发生严重问题：

```bash
# 1. Stop gateway
pnpm clawdbot gateway stop

# 2. Full restore
LATEST_BACKUP=$(ls -t ~/.clawdbot-backups/ | head -1)
~/.skills/clawdbot-update/restore-clawdbot.sh ~/.clawdbot-backups/$LATEST_BACKUP

# 3. Restart
pnpm clawdbot gateway start
```

## 安装方式

### 通过 ClawdHub 安装

```bash
clawdbot skills install clawdbot-update
```

### 手动安装

```bash
git clone <repo-url> ~/.skills/clawdbot-update
chmod +x ~/.skills/clawdbot-update/*.sh
```

## 许可证

MIT —— 见 [LICENSE](LICENSE)

## 作者

**Pascal Schott** ([@pasogott](https://github.com/pasogott))

为 Clawdbot 贡献  
https://github.com/clawdbot/clawdbot