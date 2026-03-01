---
name: last30days-lite
name_zh: 近30天精简版
description: 在过去 30 天内，跨 Reddit、X/Twitter 和网络研究任意主题。将调研结果综合为可操作的洞见或可直接复制粘贴的提示词。
description_zh: 在过去 30 天内，跨 Reddit、X/Twitter 和网络研究任意主题。将调研结果综合为可操作的洞见或可直接复制粘贴的提示词。
metadata: {"clawdbot":{"emoji":"📅","requires":{"bins":["bird"]}}}
---
# last30days 📅

利用最近 30 天内 Reddit、X/Twitter 和网络上的讨论，研究任意主题。返回综合洞见与可操作提示词。

## 概览

人工智能领域每月都在重塑自身。本 skill 通过调研人们**当下**的真实讨论（而非六个月前曾有效的做法），助您始终站在前沿。

**本 skill 的功能包括：**  
- 使用时效性筛选（过去 30 天）搜索网络、Reddit 和 X/Twitter  
- 发现真实从业者的实践经验，而非仅靠 SEO 优化的内容  
- 将调研结果综合为可操作的洞见  
- 基于当前最佳实践生成可直接复制粘贴的提示词  

**最适合以下场景：**  
- 提示词调研（ChatGPT、Midjourney、Claude 等工具中真正有效的技巧）  
- 趋势发现（哪些内容正在走红，人们正在推荐什么）  
- 产品反馈（真实用户如何看待 X？）  
- 更新迅速的主题（时效性至关重要）  

**前提要求：**  
- Brave 搜索（已内置至 Clawdbot）  
- `bird` CLI（用于 X/Twitter，可选但强烈推荐）  
- 无需额外 API 密钥  

## 使用方式

当用户请求某主题的近期信息，或使用 `/last30days [topic]` 命令时：

### 步骤 1：网络搜索（Brave，带时效性筛选）  
```
web_search(query="[topic]", freshness="pm", count=5)
```  
- `pm` = 过去一个月  
- 同时尝试：`pd`（24 小时内）、`pw`（一周内）  

### 步骤 2：Reddit 搜索  
```
web_search(query="site:reddit.com [topic]", freshness="pm", count=5)
```  
聚焦于 r/ClaudeAI、r/ChatGPT、r/LocalLLaMA、r/MachineLearning、r/StableDiffusion 等板块。

### 步骤 3：X/Twitter 搜索  
```bash
bird search "[topic]" -n 10 --plain
```  
关注从业者分享的真实经验，而非仅为博取互动的帖子。

### 步骤 4：深度挖掘（可选）  
对有前景的网址，使用 `web_fetch` 获取完整内容：  
```
web_fetch(url="https://reddit.com/...", maxChars=10000)
```  

### 步骤 5：综合分析  
将各项发现整合为：  
1. **关键模式** —— 人们实际在用且行之有效的方法是什么？  
2. **常见错误** —— 哪些做法应避免？  
3. **工具/技巧** —— 具体提及的方法有哪些？  
4. **可直接复制粘贴的提示词**（如适用）—— 整合了最佳实践的即用型提示词  

## 输出格式  

```markdown
## 📅 Last 30 Days: [Topic]

### What's Working
- [Pattern 1]
- [Pattern 2]

### Common Mistakes
- [Mistake 1]

### Key Techniques
- [Technique with source]

### Sources
- [URL 1] - [brief description]
- [URL 2] - [brief description]

### Ready-to-Use Prompt (if applicable)
```  
[基于调研结果生成的提示词]  
```
```  

## 示例  

- `/last30days Midjourney v7 prompting`  
- `/last30days Claude Code best practices`  
- `/last30days what are people saying about M4 MacBook`  
- `/last30days Suno music prompts that actually work`  

## 注意事项  

- 无需额外 API 密钥（使用 Brave + bird）  
- bird 需要 X/Twitter cookies（已预配置）  
- 注重信号而非噪音 —— 优先考虑高赞内容与经认证的从业者  