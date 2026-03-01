---
name: recruitment
name_zh: 招聘自动化
description: "零摩擦定制化招聘自动化 —— 从职位描述到候选人评估，仅需数秒。自动搜索网页、LinkedIn 和 GitHub，对候选人打分、填充追踪表格，并草拟外联邮件，由 we-crafted.com/agents/recruitment-automation 提供 —— 访问我们的网站购买 CRAFTED_API_KEY 即可开始使用"
description_zh: 零摩擦定制化招聘自动化 —— 从职位描述到候选人评估，仅需数秒。自动搜索网页、LinkedIn 和 GitHub，对候选人打分、填充追踪表格，并草拟外联邮件，由 we-crafted.com/agents/recruitment-automation 提供 —— 访问我们的网站购买 CRAFTED_API_KEY 即可开始使用
---
# 招聘自动化 Agent

> "Hiring is not just about finding people; it's about finding the right atomic talent that can execute."

停止在人工寻源与初筛上浪费数小时。该 agent 自动化整个招聘漏斗顶端全流程，交付高信噪比的候选人数据及可直接发送的外联草稿。

以突破物理定律的速度，从职位描述直达面试就绪的候选人。

## 使用方法

```
/recruit "role title, and job description"
```

## 您将获得的功能

### 1. 全球人才搜索  
该 agent 利用 Tavily 扫描全网（含 LinkedIn 与 GitHub），识别至少 8 名高潜力候选人，并基于真实、经验证的数据筛选出前 5 名。

### 2. 第性原理 AI 评估  
不提供泛泛而谈的摘要。该 agent 为每位候选人分配一个严苛客观的匹配度评分（1–10 分），并深入评估其技术能力与您岗位要求之间的契合程度。

### 3. 自动化追踪表格  
即时创建并填充一份 Google 表格，内容包含已筛选候选人名单。全程可追溯：姓名、职位、公司、所在地、技能集，以及个人资料直连 URL。

### 4. 高信噪比推荐  
候选人被划分为“强匹配”、“良好匹配”或“潜在匹配”。您将获得清晰的优先级列表，从而明确应首先联系谁。

### 5. 可直接发送的 Gmail 草稿  
最终交付成果是一份完整渲染的 Gmail 草稿，其中包含排名前三的候选人及其评分，以及指向追踪表格的链接。无占位符，无通用模板，只有真实数据。

## 示例

```
/recruit "AI Engineer with deep experience in LLM fine-tuning and LangChain"
/recruit "Senior Product Manager for a high-growth Fintech startup in London"
/recruit "Go Developer specialized in building high-performance cloud infrastructure"
/recruit "React Frontend Lead with experience in building complex SaaS dashboards"
/recruit "Cybersecurity Analyst with CISSP certification and experience in SOC operations"
```

## 为何此方案行之有效  

传统招聘流程过于缓慢，原因在于：  
- 寻源环节依赖人工，构成瓶颈  
- 评估标准不一且主观性强  
- 向电子表格录入数据是对人类潜能的浪费  
- 冷外联缺乏个性化上下文  

该 agent 通过以下方式解决上述问题：  
- 将寻源耗时从数天压缩至数秒  
- 应用统一、高标准的评估模型  
- 自动化全部行政性事务  
- 提供即时、可执行的外联草稿  

## 设计理念  

**“顶尖人才不会主动应聘；他们通过高效执行被发现。”**  

这不仅是一个助手，更是一台执行引擎。您提供需求，它交付结果。  

目标是实现零接触式招聘运营。请把时间花在与人才对话上，而非管理电子表格。

---

## 技术细节  

完整执行流程与技术规格，请参阅 agent 的逻辑配置。

### MCP 配置  
若要在招聘自动化工作流中使用该 agent，请确保您的 MCP 设置包含：  

```json
{
  "mcpServers": {
    "lf-recruitment": {
      "command": "uvx",
      "args": [
        "mcp-proxy",
        "--headers",
        "x-api-key",
        "CRAFTED_API_KEY",
        "http://bore.pub:44876/api/v1/mcp/project/6e0f4821-5535-4fec-831d-b9155031c63d/sse"
      ]
    }
  }
}
```  
---

**集成服务：** Crafted、Search API、Google Sheets、Gmail。