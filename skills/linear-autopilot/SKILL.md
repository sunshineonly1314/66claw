---
name: linear-autopilot
name_zh: Linear 自动驾驶
description: 通过 Discord 通知与 Git 同步自动化处理 Linear 任务。适用于搭建看板（Kanban）到 agent 的工作流：Linear 任务经由 Discord 触发 Clawdbot 动作。支持任务接入、状态更新、私信通知及自动推送至 Git。适配任意任务类型——研究、内容创作、代码任务或自定义工作流。
description_zh: 通过 Discord 通知与 Git 同步自动化处理 Linear 任务。适用于搭建看板（Kanban）到 agent 的工作流：Linear 任务经由 Discord 触发 Clawdbot 动作。支持任务接入、状态更新、私信通知及自动推送至 Git。适配任意任务类型——研究、内容创作、代码任务或自定义工作流。
---
# Linear Autopilot

自动化流水线：**Linear → Webhook 服务 → Discord → Clawdbot → Git**

在 Linear 中创建的任务将自动触发 Clawdbot 处理，并附带实时通知与 Git 同步功能，便于在 Obsidian 或本地环境访问。

## 免费版限制说明

配置前，请知悉各平台免费计划的限制：

| 服务 | 免费版限制 | 建议 |
|---------|------------------|----------------|
| **Linear** | 250 个任务，成员数量不限 | 完全满足个人或小型团队日常使用 |
| **Pipedream** | 每日 100 次调用，最多 10 个工作流 | 适合轻量使用（约每日 3 个任务） |
| **Zapier** | 每月 100 个任务，最多 5 个 Zap，轮询间隔 15 分钟，**不支持 Webhook** | ⚠️ 本工作流需付费版（Starter+）方可正常运行 |

**重要提示：**  
- **Pipedream** 免费额度每日重置，且支持即时 Webhook —— 是当前最佳免费选项  
- **Zapier** 免费版**不支持 Webhook**（而实时 Linear 触发必须依赖 Webhook）。若要使本工作流稳定运行，您需订阅付费版 Zapier（Starter 或更高）  
- 对预算敏感的用户：**请选用 Pipedream**  

## 配置步骤

### 1. 配置 Linear API

运行初始化命令以保存您的 Linear API 密钥：

```bash
mkdir -p ~/.clawdbot
echo "LINEAR_API_KEY=lin_api_xxxxx" > ~/.clawdbot/linear.env
```

您的 API 密钥获取路径：Linear → Settings → API → Personal API keys  

### 2. 获取 Linear ID

查找您的团队 ID 与状态 ID：

```bash
./scripts/linear-api.sh teams    # Get team ID
./scripts/linear-api.sh states   # Get state IDs (Todo, In Progress, Done)
```

更新 `~/.clawdbot/linear-config.json`：

```json
{
  "teamId": "your-team-id",
  "states": {
    "todo": "state-id-for-todo",
    "inProgress": "state-id-for-in-progress",
    "done": "state-id-for-done"
  },
  "discord": {
    "notifyUserId": "your-discord-user-id",
    "taskChannelId": "your-linear-tasks-channel-id"
  },
  "git": {
    "autoPush": true,
    "commitPrefix": "task:"
  }
}
```

### 3. 配置 Webhook 服务

请选择您偏好的自动化平台：

#### 方案 A：Pipedream（推荐用于免费版）
- 每日 100 次调用，完全免费  
- 支持即时 Webhook 触发  
- 详细步骤请参阅 `references/pipedream-setup.md`  

快速配置：
1. 在 pipedream.com 创建工作流，选择 HTTP Webhook 触发器  
2. 在 Linear 中配置 Webhook，指向您的 Pipedream URL  
3. 添加 Discord “Send Message” 步骤，并填入 Clawdbot 的 bot token  
4. 消息模板：  
   ```
   <@BOT_ID>
   📋 New task: {{steps.trigger.event.data.title}}
     Status: {{steps.trigger.event.data.state.name}}
     ID: {{steps.trigger.event.data.identifier}}
   ```  

#### 方案 B：Zapier（若您已订阅付费版）
- 免费版每月仅限 100 个任务（严重受限）  
- 原生支持 Linear + Discord 集成  
- 详细步骤请参阅 `references/zapier-setup.md`  

快速配置：
1. 创建 Zap：Linear（New Issue）→ Discord（Send Channel Message）  
2. Discord 端可选用 Webhook 或 Bot 集成方式  
3. 将 Linear 字段映射至消息模板  

### 4. 配置 Discord 频道

确保 Clawdbot 正在监听您的任务频道。在 `clawdbot.json` 中：

```json
{
  "channels": {
    "discord": {
      "guilds": {
        "YOUR_GUILD_ID": {
          "channels": {
            "YOUR_TASK_CHANNEL_ID": {
              "allow": true,
              "requireMention": false
            }
          }
        }
      }
    }
  }
}
```

## 任务处理工作流

当任务抵达 Discord 频道后：

### 1. 确认接收
- 在频道内回复，确认已收到任务  

### 2. 用户私信通知（DM）
```
Use message tool:
- action: send
- target: [user ID from config]
- message: "📋 New task: [ID] - [title]. Starting now..."
```

### 3. 执行任务
- 通过 `./scripts/linear-api.sh start [task-id]` 将 Linear 状态更新为 “In Progress”  
- 执行任务本身（若任务复杂，可启动子-agent）  
- 将产出结果保存至对应目录（如 research/、content/ 等）  

### 4. 完成任务
- 通过 `./scripts/linear-api.sh done [task-id]` 将 Linear 状态更新为 “Done”  
- 通过 `./scripts/linear-api.sh comment [task-id] "[summary]"` 添加含结果的评论  
- 向用户发送完成状态的私信（DM）  

### 5. Git 同步（如已启用）
```bash
git add [output files]
git commit -m "task: [ID] - [title]"
git push
```

## 脚本命令参考

`scripts/linear-api.sh` 支持以下命令：

| 命令 | 描述 |
|---------|-------------|
| `teams` | 列出团队及其 ID |
| `states` | 列出工作流状态（workflow states） |
| `get [id]` | 获取任务详情 |
| `pending` | 列出待处理任务 |
| `start [id]` | 标记为 “In Progress” |
| `done [id]` | 标记为 “Done” |
| `comment [id] "text"` | 向任务添加评论 |

## 示例任务类型

本工作流可处理任意类型任务：

- **研究类任务**：启动子-agent，结果保存至 `research/[topic].md`  
- **内容创作类任务**：生成初稿，保存至 `content/`  
- **代码类任务**：编写/修改代码，并提交变更  
- **数据处理类任务**：运行脚本，输出结果  
- **自定义类任务**：定义专属输出格式  

## 故障排查

**任务未触发？**  
- 检查 Pipedream 工作流是否已启用  
- 确认 Discord 频道已加入 Clawdbot 配置  
- 若使用 Webhook，请确保 `allowBots: true`  

**Linear API 报错？**  
- 验证 `~/.clawdbot/linear.env` 中的 API 密钥是否正确  
- 检查团队 ID 与状态 ID 是否准确  

**Git 推送失败？**  
- 确保已配置 git 远程仓库（remote）  
- 检查 SSH 密钥或凭据是否有效  