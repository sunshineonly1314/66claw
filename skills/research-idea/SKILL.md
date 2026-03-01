---
name: idea-clawdbot
name_zh: 创意调研
description: "启动后台 Clawdbot 会话，深入探索与分析商业构想。发送 'Idea: [描述]' 即可触发。此为 'idea' 技能的分支版本，已改用 sessions_spawn 替代 claude CLI + tmux + telegram CLI。结果直接发送至当前 Telegram 聊天，而非‘已保存的消息’。零外部依赖。"
description_zh: 启动后台 Clawdbot 会话，深入探索与分析商业构想。发送 'Idea: [描述]' 即可触发。此为 'idea' 技能的分支版本，已改用 sessions_spawn 替代 claude CLI + tmux + telegram CLI。结果直接发送至当前 Telegram 聊天，而非‘已保存的消息’。零外部依赖。
metadata: {"clawdbot":{"emoji":"💡"}}
---
# Idea Exploration Skill（构想探索技能，Clawdbot 原生版）

启动自主后台会话，深度探索商业构想。借助内置 Clawdbot 功能，一站式获取市场研究、技术分析、上市策略（GTM）及可落地的建议。

## 快速开始

**触发短语：** 发送 `Idea: [description]` 后，助手将：
1. 使用 `sessions_spawn` 启动后台子 agent 会话
2. 对该构想进行全面研究与分析
3. 将结果保存至 `~/clawd/ideas/<slug>/research.md`
4. 将文件及摘要自动发送回当前 Telegram 聊天

## 工作原理

```
User: "Idea: AI calendar assistant"
       ↓
┌─────────────────────────────────┐
│  1. Detect "Idea:" trigger      │
│  2. sessions_spawn background   │
│  3. Sub-agent researches        │
│  4. Writes research.md          │
│  5. Returns to main chat        │
│  6. Sends file + summary        │
└─────────────────────────────────┘
```

## 前置条件

- Clawdbot 已启用 `sessions_spawn`
- 无需任何外部 CLI（完全原生）

## AGENTS.md 集成

请将以下内容添加至您的 `AGENTS.md`：

```markdown
## Idea Exploration

**When user says "Idea: [description]":**

1. Extract the idea description
2. Create a slug from the idea (lowercase, hyphens)
3. Use `sessions_spawn` to launch a background research session:
   - **task**: Use the template from `skills/idea-clawdbot/templates/idea-exploration-prompt.md`
   - **label**: `idea-research-<slug>`
   - **cleanup**: keep (so we can review the session later)
4. Confirm: "🔬 Research started for: [idea]. I'll ping you when done (usually 3-5 minutes)."
5. When the sub-agent completes, send the research file to the chat

**Result handling:**
- Research saved to: `~/clawd/ideas/<slug>/research.md`
- Send file as document via Telegram
- Include brief summary of verdict (🟢/🟡/🟠/🔴)
```

## 分析框架

探索涵盖以下维度：

1. **核心概念分析** —— 问题本质、关键假设、独特性
2. **市场研究** —— 用户画像、总可寻址市场（TAM）/可服务可寻址市场（SAM）/可获市场份额（SOM）、竞品分析
3. **技术实现** —— 技术栈、最小可行产品（MVP）范围、潜在挑战
4. **商业模式** —— 收入来源、定价策略、单客经济模型（unit economics）
5. **上市策略（Go-to-Market）** —— 上线计划、用户获取、合作伙伴关系
6. **风险与挑战** —— 技术风险、竞争风险、监管风险
7. **结论与建议** —— 明确的“是/否”判断及具体行动方案

## 结论类型

- 🟢 **强烈推荐** —— 明确机会，应积极投入
- 🟡 **有条件推荐** —— 前景良好，但需进一步验证
- 🟠 **建议转型** —— 核心洞察有价值，但执行路径需优化
- 🔴 **不建议推进** —— 存在过多重大风险

## 示例输出

```
~/clawd/ideas/ai-calendar-assistant/
├── metadata.txt
├── research.md    # 400-500 line comprehensive analysis
```

## 使用提示

- 构想分析通常耗时 3–5 分钟
- 查看会话进度：`clawdbot sessions list --kinds spawn`
- 监控子 agent：`clawdbot sessions history <session-key>`
- 结果将自动返回至同一聊天窗口

## 模板变量

在启动子 agent 时，请在提示词模板中替换以下变量：
- `{IDEA_DESCRIPTION}`：实际构想文本
- `{IDEA_SLUG}`：URL 友好格式（例如：“ai-powered-calendar”）