---
name: daily-recap
name_zh: 每日复盘
description: 生成一张每日回顾图片，画面中你的 agent 手持一块写满当日成就的海报板。该技能由 cron 触发，感知天气变化，并可自定义适配任意 agent 身份。
description_zh: 生成一张每日回顾图片，画面中你的 agent 手持一块写满当日成就的海报板。该技能由 cron 触发，感知天气变化，并可自定义适配任意 agent 身份。
metadata: {"clawdbot":{"emoji":"📋","requires":{"skills":["nano-banana-pro"]}}}
---
# 每日回顾 Skill

生成一张个性化每日回顾图片，画面中你的 agent 头像手持一块写有当日成就的海报板。

## 概述

一款基于 cron 触发的 skill，它会查阅你的 agent 的每日记忆文件与成就记录，然后生成一张定制图像：你的 agent 头像手持一块写有当日成就的海报板。图像包含适配当地天气的着装与符合一天中不同时段的光照效果。

## 功能特性

- 查阅当日记忆文件，提取成就条目  
- 检查 cron 作业摘要，识别已完成任务  
- 基于本地天气状况生成适配天气的图像  
- Agent 手持海报板，上面以马克笔书写 4–6 项关键成就  
- 可自定义适配任意 agent 身份  

## 配置方式

请在你的 `clawdbot.json` 的 `skills.entries.daily-recap` 下设置以下变量：

```json
{
  "skills": {
    "entries": {
      "daily-recap": {
        "env": {
          "RECAP_LOCATION": "Your City, ST",
          "RECAP_CHAT_ID": "your-chat-id",
          "RECAP_TIME": "17:00"
        }
      }
    }
  }
}
```

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `RECAP_LOCATION` | 天气查询地点（例如："Boston, MA"） | 必填 |
| `RECAP_CHAT_ID` | 图像投递聊天 ID（Telegram、Discord 等） | 必填 |
| `RECAP_TIME` | Cron 执行时间（24 小时制，本地时区） | `17:00` |

## Agent 身份

该 skill 会读取你的 agent 的 `IDENTITY.md` 文件以获取视觉外观细节。请在其中加入如下格式的区块：

```markdown
## Visual Appearance (for image generation)

[Your agent] is a [description] with:
- [Physical traits]
- [Clothing/accessories]
- [Style notes]
```

## 依赖项

- **nano-banana-pro** skill（用于 Gemini 图像生成）  
- 已配置的消息服务（Telegram、Discord 等）  

## Cron 设置

该 skill 包含示例 cron 作业。安装完成后，请创建你的 cron 任务：

```bash
clawdbot cron add --name "daily-recap" --schedule "0 17 * * *" --tz "America/New_York"
```

## 工作原理

1. **天气查询**：获取你所在地的当前天气状况  
2. **当日回顾**：扫描记忆文件与 cron 摘要，提取成就条目  
3. **精选成就**：挑选 4–6 项关键条目（保持简短以适配海报板）  
4. **图像生成**：生成 agent 手持写有成就的海报板的图像  
5. **投递发送**：将图像发送至你配置的聊天渠道  

## 使用提示

- 成就条目务必**简短**（每条 3–5 个词），确保海报板文字清晰可读  
- 在你的身份描述中包含适配天气的着装说明  
- 若未找到任何成就，将生成一张“安静一日”放松主题图像  
- 最佳适配风格为 Pixar/3D 动画风格提示词  

## 示例输出

你的 agent 手持海报板：  
```
TODAY'S WINS
✓ Fixed config bug
✓ Merged 50 commits
✓ Created new cron
✓ Cleaned up data
```

## 致谢

由 Clawdbot 社区创作。