---
name: research
name_zh: 研究
description: 通过 Gemini CLI 进行深度研究——在后台子 agent 中运行，避免消耗您的 Claude token。
description_zh: 通过 Gemini CLI 进行深度研究——在后台子 agent 中运行，避免消耗您的 Claude token。
homepage: https://github.com/google/gemini-cli
metadata: {"clawdbot":{"emoji":"🔬","requires":{"bins":["gemini"]}}}
---
# Research Skill（研究技能）

通过启动子 agent，利用 Gemini CLI 对任一主题开展深度研究。该方式使用您的 Google AI 订阅配额，而非 Claude token——特别适合耗时较长的研究任务，可避免过度占用 Clawdbot 配额。

## 工作原理

**当用户说“Research: [主题]”或提出深度研究请求时：**

### 第一步：澄清问题（始终执行）

在启动任何研究前，先提出 2–3 个简短问题以明确研究焦点：

**首先聚焦目标：**
> "Before I dive in - what's your goal here? Are you learning about this topic, making a decision, writing something, or just curious?"

**然后根据用户回答灵活调整：**

若为学习/求知目的：
- “您最感兴趣的具体方面是哪些？”
- “技术深度应如何把握？（高层概述 vs 深度技术细节）”

若为决策支持：
- “您希望做出哪方面的决策？”
- “是否有特定标准或约束条件需要我重点关注？”

若为写作/创作用途：
- “最终输出形式是什么？（博客文章、报告、演示文稿等）”
- “目标受众是谁？”

**保持自然对话风格——最多提 2–3 个问题。** 切勿审讯式提问。

### 第二步：启动研究 Agent

获得上下文后，使用 `sessions_spawn` 执行研究任务：

```
sessions_spawn(
  task: "Research: [FULL TOPIC WITH CONTEXT]
  
Use Gemini CLI to research this topic. Run:

gemini --yolo \"[RESEARCH PROMPT]\"

The research prompt should ask Gemini to cover:
1. Overview & Core Concepts - what is this, terminology, why it matters
2. Current State - latest developments, major players
3. Technical Deep Dive - how it works, mechanisms, key techniques
4. Practical Applications - real-world use cases, tools available
5. Challenges & Open Problems - technical, ethical, barriers
6. Future Outlook - trends, predictions, emerging areas
7. Resources - key papers, researchers, communities, courses

Save the output to: ~/clawd/research/[slug]/research.md

Be thorough (aim for 500+ lines). Include specific examples and citations.

IMPORTANT - When research is complete:
1. Send a wake event to notify the main agent immediately:
   cron(action: 'wake', text: '🔬 Research complete: [TOPIC]. Key findings: [2-3 bullet points]. Full report: ~/clawd/research/[slug]/research.md', mode: 'now')
2. When asked to produce an announce message, reply exactly: ANNOUNCE_SKIP",
  label: "research-[slug]"
)
```

**重要提示：** 务必在任务中完整包含当前对话上下文，以便子 agent 全面理解背景。

### 第三步：收到唤醒事件（Wake Event）后

您将收到附带研究摘要的唤醒通知。此时需：
- 向用户分享研究成果
- 主动提供全文报告阅读服务，或就特定章节深入探讨

## 输出位置

研究报告保存至：
```
~/clawd/research/<slug>/research.md
```

## 使用提示

- 研究通常耗时 3–8 分钟，具体取决于复杂度
- Gemini CLI 使用您的 Google AI 订阅配额
- `--yolo` 标志自动批准文件操作（无需交互）
- 查看 `~/clawd/research/` 可获取全部历史研究报告
- 始终在 spawn 任务中包含对话上下文，以提升结果质量