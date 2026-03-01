---
name: munger-observer
name_zh: 芒格观察者
description: 每日智慧复盘：将查理·芒格的思维模型应用于你的工作与思考。当被要求复盘决策、分析思维模式、识别认知偏差、应用思维模型、执行“芒格复盘”或运行“芒格观察者”时启用。可在定时每日复盘或手动请求（如“run munger observer”、“review my thinking”、“check for blind spots”、“apply mental models”）时触发。
description_zh: 每日智慧复盘：将查理·芒格的思维模型应用于你的工作与思考。当被要求复盘决策、分析思维模式、识别认知偏差、应用思维模型、执行“芒格复盘”或运行“芒格观察者”时启用。可在定时每日复盘或手动请求（如“run munger observer”、“review my thinking”、“check for blind spots”、“apply mental models”）时触发。
---
# 芒格观察者  

自动化每日复盘，运用查理·芒格的思维模型，揭示认知盲点与思维陷阱。

## 流程  

### 1. 汇总今日活动  
- 读取今日记忆文件（`memory/YYYY-MM-DD.md`）  
- 扫描会话日志，提取今日活动  
- 提取内容：所做决策、处理任务、攻克问题、用户请求  

### 2. 应用思维模型  

**逆向思维（Inversion）**  
- 什么可能导致失败？此处成功的反面是什么？  
- “告诉我我会在哪里丧命，这样我就永远不去那里。”  

**二阶思维（Second-Order Thinking）**  
- 然后呢？后果的后果是什么？  
- 短期收益是否正在制造长期问题？  

**激励分析（Incentive Analysis）**  
- 正在奖励哪些行为？隐藏的激励结构是什么？  
- “给我看激励机制，我就能告诉你结果。”  

**机会成本（Opportunity Cost）**  
- 什么未被做？专注于此的代价是什么？  
- 被放弃的最佳替代选项是什么？  

**偏差识别（Bias Detection）**  
- 确认偏误（Confirmation bias）：是否只寻求支持性信息？  
- 沉没成本谬误（Sunk cost fallacy）：是否因过去投入而继续坚持？  
- 社会认同（Social proof）：是否因他人这么做而跟进？  
- 易得性偏差（Availability bias）：是否过度看重近期/鲜明的信息？  

**能力圈（Circle of Competence）**  
- 是否在已知领域内运作，抑或已越界？  
- 若已越界，是否保有相应的谦逊与谨慎？  

**安全边际（Margin of Safety）**  
- 若事情出错，缓冲空间有多大？  
- 是否在任何地方都已逼近极限？  

### 3. 生成输出  

**若发现洞见：** 提供 1–2 条简洁、芒格式的观察  
**若无显著发现：** “一切正常——今日未检测到认知地雷。”  

## 输出格式  
```
🧠 **Munger Observer** — [Date]

[Insight 1: Model applied + observation + implication]

[Insight 2 if applicable]

— "Invert, always invert." — Carl Jacobi (Munger's favorite)
```  

## 示例  
```
🧠 **Munger Observer** — January 19, 2026

**Opportunity Cost Alert:** Heavy focus on infrastructure today. The content queue is aging — are drafts decaying in value while we polish tools?

**Second-Order Check:** Speed improvement is good first-order thinking. Second-order: faster responses may raise expectations for response quality. Speed without substance is a trap.

— "Invert, always invert."
```  

## 定时设置（可选）  
配置 cron 作业以实现每日自动复盘：  
- 推荐时间：工作日结束时（例如当地时间下午 5 点）  
- 触发消息：`MUNGER_OBSERVER_RUN`  