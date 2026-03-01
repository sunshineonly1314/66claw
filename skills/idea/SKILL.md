---
name: idea
name_zh: IDEA
description: "启动后台 Claude 会话以探索并分析商业创意。说出 'Idea: [描述]' 即可触发。"
description_zh: 启动后台 Claude 会话以探索并分析商业创意。说出 'Idea: [描述]' 即可触发。
homepage: https://github.com/anthropics/claude-code
metadata: {"clawdbot":{"emoji":"💡","requires":{"bins":["claude","tmux","telegram"]}}}
---
# 创意探索 skill

启动自主运行的 Claude Code 会话，深入探索商业创意。获取市场调研、技术分析、上市策略（GTM）及可落地的建议。

## 快速开始

**触发短语：** 说出 `Idea: [description]`，助手将：  
1. 在 tmux 中启动一个 Claude Code 会话  
2. 全面调研并分析该创意  
3. 将结果保存至 `~/clawd/ideas/<slug>/research.md`  
4. 将文件发送至您的 Telegram「已保存消息」  
5. 完成后通过 cron 向您发送通知  

## 工作原理

```
User: "Idea: AI calendar assistant"
       ↓
┌─────────────────────────────────┐
│  1. explore-idea.sh starts      │
│  2. Creates tmux session        │
│  3. Runs Claude Code            │
│  4. Claude analyzes & writes    │
│  5. notify-research-complete.sh │
│     → Sends file to "me"        │
│     → Queues notification       │
│  6. Cron checks queue (1 min)   │
│  7. Notifies user in chat       │
└─────────────────────────────────┘
```

## 设置

### 前置条件
- `claude` CLI（Claude Code）  
- `tmux`  
- `telegram` CLI（supertelegram）  
- 已启用 cron 的 Clawdbot  

### 1. 创建脚本

完整实现详见 `~/clawd/scripts/explore-idea.sh`。

核心组件包括：  
- 创建含 prompt 与运行脚本的创意专属目录  
- 清除 OAuth 环境变量以使用 Claude Max  
- 使用 `--dangerously-skip-permissions` 运行 claude 命令  
- 完成后调用通知脚本  

### 2. 配置 Cron 任务

```bash
# Cron job to check notification queue every minute
{
  name: "Check notification queue",
  sessionTarget: "isolated",
  wakeMode: "now",
  payload: {
    kind: "agentTurn",
    message: "Check ~/.clawdbot/notify-queue/ for .json files...",
    deliver: true,
    channel: "telegram",
    to: "YOUR_CHAT_ID"
  },
  schedule: { kind: "every", everyMs: 60000 }
}
```

### 3. 添加 AGENTS.md 说明

```markdown
**When user says "Idea: [description]":**
1. Extract the idea description
2. Execute: `CLAWD_SESSION_KEY="main" ~/clawd/scripts/explore-idea.sh "[idea]"`
3. Confirm: "Idea exploration started. You'll be notified when complete."
```

## 分析框架

探索涵盖以下维度：

1. **核心概念分析** —— 问题本质、关键假设、独特性  
2. **市场调研** —— 目标用户、总可服务市场（TAM）/可服务可获得市场（SAM）/可获得市场（SOM）、竞品分析  
3. **技术实现** —— 技术栈、最小可行产品（MVP）范围、技术难点  
4. **商业模式** —— 收入来源、定价策略、单客户经济模型（unit economics）  
5. **上市策略（GTM）** —— 上线计划、用户获取、合作伙伴关系  
6. **风险与挑战** —— 技术风险、竞争风险、监管风险  
7. **结论与建议** —— 明确的是/否判断，并附带行动方案  

## 结论类型

- 🟢 **强烈推荐** —— 明确的机遇，应积极投入  
- 🟡 **有条件推荐** —— 前景良好，但需进一步验证  
- 🟠 **建议转型** —— 核心洞察有价值，但执行方案需优化  
- 🔴 **放弃** —— 存在过多重大风险  

## 示例输出

```
~/clawd/ideas/ai-calendar-assistant/
├── metadata.txt
├── prompt.txt
├── run-claude.sh
└── research.md    # 400-500 line comprehensive analysis
```

## 使用提示

- 创意分析通常耗时 3–5 分钟  
- 查看进度：`tmux attach -t idea-<slug>-<timestamp>`  
- 即使通知失败，文件仍会发送至「已保存消息」  
- 若通知卡住，请检查 `~/.clawdbot/notify-queue/`  