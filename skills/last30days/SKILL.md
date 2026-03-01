---
name: last30days
name_zh: 近30天
description: 在 Reddit、X 和网络上研究过去 30 天内任意主题，综合分析结果，并生成可直接复制粘贴使用的提示词。当用户希望了解某主题近期在社交平台/网络上的讨论情况、询问“人们正在如何谈论 X”或想掌握当前最佳实践时，请使用本 skill。需要 OPENAI_API_KEY 和/或 XAI_API_KEY 才能完全访问 Reddit+X；如未配置，则自动回退至网络搜索。
description_zh: 在 Reddit、X 和网络上研究过去 30 天内任意主题，综合分析结果，并生成可直接复制粘贴使用的提示词。当用户希望了解某主题近期在社交平台/网络上的讨论情况、询问“人们正在如何谈论 X”或想掌握当前最佳实践时，请使用本 skill。需要 OPENAI_API_KEY 和/或 XAI_API_KEY 才能完全访问 Reddit+X；如未配置，则自动回退至网络搜索。
---
# last30days：研究过去 30 天内的任意主题

跨 Reddit、X 和网络研究任意主题，挖掘人们当下正在真实讨论、推荐和辩论的内容。

典型使用场景：
- **提示词工程**：“Nano Banana Pro 中逼真人物图像”，“Midjourney 提示词”，“ChatGPT 图像生成” → 学习技巧，获取可直接复制粘贴的提示词  
- **推荐建议**：“最佳 Claude Code skills"，“顶级 AI 工具” → 获取一份具体提及内容的清单  
- **新闻资讯**：“OpenAI 近况如何”，“最新 AI 发布消息” → 获取当前事件与更新  
- **通用探索**：任何你感兴趣的主题 → 理解社区正在表达的观点  

## 关键：解析用户意图

执行任何操作前，请先解析用户输入，识别以下要素：

1. **主题（TOPIC）**：用户希望了解的内容（例如：“网页应用原型设计”、“Claude Code skills"、“图像生成”）  
2. **目标工具（TARGET TOOL）**（如已明确指定）：用户将在何处使用这些提示词（例如：“Nano Banana Pro”、“ChatGPT”、“Midjourney”）  
3. **查询类型（QUERY TYPE）**：用户希望开展哪类调研：  
   - **提示词工程（PROMPTING）** —— “X 的提示词”、“针对 X 的提示技巧”、“X 的最佳实践” → 用户希望学习技巧并获得可直接复制粘贴的提示词  
   - **推荐建议（RECOMMENDATIONS）** —— “最佳 X”、“顶级 X”、“我该用哪个 X”、“推荐的 X” → 用户希望获得一份具体事物的清单  
   - **新闻资讯（NEWS）** —— “X 近况如何”、“X 的新闻”、“X 的最新动态” → 用户希望了解当前事件与更新  
   - **通用探索（GENERAL）** —— 其他所有情况 → 用户希望全面了解该主题  

常见模式示例：
- `[topic] for [tool]` → “Nano Banana Pro 的网页原型设计” → **已指定目标工具**  
- `[topic] prompts for [tool]` → “Midjourney 的 UI 设计提示词” → **已指定目标工具**  
- 仅 `[topic]` → “iOS 设计原型” → **未指定目标工具，这没有问题**  
- “最佳 [主题]” 或 “顶级 [主题]” → QUERY_TYPE = RECOMMENDATIONS  
- “[主题] 的最佳方案是什么” → QUERY_TYPE = RECOMMENDATIONS  

**重要提醒：切勿在调研前主动询问目标工具。**  
- 若查询中已明确指定工具，请直接使用  
- 若查询中未指定工具，请先开展调研，再于展示结果后进行询问  

**请保存以下变量：**  
- `TOPIC = [extracted topic]`  
- `TARGET_TOOL = [extracted tool, or "unknown" if not specified]`  
- `QUERY_TYPE = [RECOMMENDATIONS | NEWS | HOW-TO | GENERAL]`  

---

## 环境检查

本 skill 根据可用 API 密钥数量，支持三种运行模式：

1. **完整模式（Full Mode）**（两个密钥均配置）：Reddit + X + 网络搜索 —— 结果最佳，且附带互动指标  
2. **部分模式（Partial Mode）**（仅配置一个密钥）：仅 Reddit 或仅 X + 网络搜索  
3. **纯网络模式（Web-Only Mode）**（未配置任何密钥）：仅网络搜索 —— 仍具实用性，但无互动指标  

**API 密钥为可选项。** 即使未配置密钥，本 skill 也会通过网络搜索回退机制正常运行。

### 首次设置（可选但推荐）

若用户希望添加 API 密钥以获得更优结果：

```bash
mkdir -p ~/.config/last30days
cat > ~/.config/last30days/.env << 'ENVEOF'
# last30days API Configuration
# Both keys are optional - skill works with WebSearch fallback

# For Reddit research (uses OpenAI's web_search tool)
OPENAI_API_KEY=

# For X/Twitter research (uses xAI's x_search tool)
XAI_API_KEY=
ENVEOF

chmod 600 ~/.config/last30days/.env
echo "Config created at ~/.config/last30days/.env"
echo "Edit to add your API keys for enhanced research."
```  

**即使未配置密钥，也请勿中断流程。** 请继续以纯网络模式运行。

---

## 调研执行

**重要提醒：脚本会自动检测 API 密钥。** 请运行脚本并查看输出，以判断当前所处模式。

**步骤 1：运行调研脚本**  
```bash
python3 ./scripts/last30days.py "$ARGUMENTS" --emit=compact 2>&1
```  

该脚本将自动完成以下任务：  
- 检测可用的 API 密钥  
- 若缺少密钥，则显示推广横幅（此为有意为之的营销策略）  
- 如密钥存在，则运行 Reddit/X 搜索  
- 若需补充数据，则提示执行网络搜索  

**步骤 2：检查输出模式**  

脚本输出将标明当前模式：  
- **“Mode: both”** 或 **“Mode: reddit-only”** 或 **“Mode: x-only”**：脚本已获取结果，网络搜索仅作补充  
- **“Mode: web-only”**：未配置 API 密钥，Claude 必须通过网络搜索完成全部调研  

**步骤 3：执行网络搜索**  

**所有模式下均需执行网络搜索**，以补充数据（在纯网络模式下则承担全部数据来源职能）。  

请根据 QUERY_TYPE 选择搜索关键词：

**若为 RECOMMENDATIONS 类型**（“最佳 X”、“顶级 X”、“我该用哪个 X”）：  
- 搜索关键词：`best {TOPIC} recommendations`  
- 搜索关键词：`{TOPIC} list examples`  
- 搜索关键词：`most popular {TOPIC}`  
- 目标：查找具体名称，而非泛泛而谈的建议  

**若为 NEWS 类型**（“X 近况如何”、“X 的新闻”）：  
- 搜索关键词：`{TOPIC} news 2026`  
- 搜索关键词：`{TOPIC} announcement update`  
- 目标：查找当前事件与最新进展  

**若为 PROMPTING 类型**（“X 的提示词”、“针对 X 的提示技巧”）：  
- 搜索关键词：`{TOPIC} prompts examples 2026`  
- 搜索关键词：`{TOPIC} techniques tips`  
- 目标：查找提示技巧与示例，以便生成可直接复制粘贴的提示词  

**若为 GENERAL 类型**（默认）：  
- 搜索关键词：`{TOPIC} 2026`  
- 搜索关键词：`{TOPIC} discussion`  
- 目标：查找人们实际发表的观点  

**所有查询类型均需遵守以下原则：**  
- **严格使用用户的原始措辞** —— 切勿基于自身知识替换或添加技术名词  
  - 若用户说“ChatGPT 图像提示”，则搜索 “ChatGPT 图像提示”  
  - **切勿添加** “DALL-E”、“GPT-4o” 或其他您认为相关的术语  
  - 您的知识可能已过时 —— 请信任用户的措辞  
- **排除** reddit.com、x.com、twitter.com（已由脚本覆盖）  
- **包含**：博客、教程、文档、新闻、GitHub 仓库  
- **切勿输出 “Sources:” 列表** —— 此类信息属于干扰项，我们将在结尾统一展示统计数据  

**步骤 3：等待后台脚本完成**  
请使用 TaskOutput 获取脚本结果，再进入综合分析阶段。

**深度选项**（由用户命令传入）：  
- `--quick` → 更快，来源更少（各 8–12 条）  
- （默认）→ 平衡（各 20–30 条）  
- `--deep` → 全面（Reddit 50–70 条，X 40–60 条）  

---

## 判官 Agent：整合全部信源

**待全部搜索完成后，请在内部完成整合（暂勿展示统计数据）：**

判官 Agent 必须做到：  
1. 对 Reddit/X 信源赋予更高权重（因其具备互动信号：点赞数、转发数等）  
2. 对网络搜索信源赋予较低权重（缺乏互动数据）  
3. 识别三类信源中共同出现的模式（最强信号）  
4. 注意不同信源间的矛盾点  
5. 提炼出前 3–5 条可操作的洞见  

**此处切勿展示统计数据 —— 它们将在结尾、邀请环节之前统一呈现。**  

---

## 第一步：内化调研成果

**关键提醒：您的综合分析必须严格基于实际调研内容，而非您既有的知识储备。**

请仔细阅读调研输出。重点关注：  
- **信源中实际提及的具体产品/工具名称**（例如：若调研提及 “ClawdBot” 或 “clawdbot”，则其为一款不同于 “Claude Code” 的自托管 AI 工具 —— 切勿混淆）  
- **信源中的具体引述与洞见** —— 请使用这些内容，而非泛泛而谈的知识  
- **信源实际表达的观点**，而非您对该主题的主观假设  

**应避免的反模式（ANTI-PATTERN）**：若用户询问 “clawdbot skills"，而调研返回的是 ClawdBot 内容（一款自托管 AI agent），则**切勿**仅因两者都涉及 "skills" 就将其综合为 “Claude Code skills"。请忠实反映调研的实际内容。

### 若 QUERY_TYPE = RECOMMENDATIONS

**关键提醒：必须提取具体名称，而非泛化模式。**

当用户询问 “最佳 X” 或 “顶级 X” 时，他们期望获得一份具体事物的清单：  
- 扫描调研内容，找出具体的产品名、工具名、项目名、skill 名等  
- 统计每个名称的提及次数  
- 记录每个名称由哪些信源推荐（Reddit 帖子、X 推文、博客文章）  
- 按受欢迎程度/提及频次排序列出  

**针对 “最佳 Claude Code skills" 的错误综合示例：**  
> "Skills are powerful. Keep them under 500 lines. Use progressive disclosure."  

**针对 “最佳 Claude Code skills" 的正确综合示例：**  
> "Most mentioned skills: /commit (5 mentions), remotion skill (4x), git-worktree (3x), /pr (3x). The Remotion announcement got 16K likes on X."  

### 所有 QUERY_TYPE 均需从实际调研输出中识别：

- **提示格式（PROMPT FORMAT）** —— 调研是否推荐 JSON、结构化参数、自然语言或关键词？**此项至关重要。**  
- 在多个信源中反复出现的前 3–5 个模式/技巧  
- 信源实际提及的具体关键词、结构或方法  
- 信源指出的常见陷阱  

**若调研指出 “使用 JSON 提示” 或 “结构化提示”，您后续必须按该格式交付提示词。**  

---

## 第二步：展示摘要 + 发出邀请

**关键提醒：切勿输出任何 “Sources:” 列表。最终展示应简洁清晰。**

**请严格按以下顺序展示：**

**首先 —— 我学到了什么（依据 QUERY_TYPE）：**  

**若为 RECOMMENDATIONS 类型** —— 展示调研中提及的具体内容：  
```
🏆 Most mentioned:
1. [Specific name] - mentioned {n}x (r/sub, @handle, blog.com)
2. [Specific name] - mentioned {n}x (sources)
3. [Specific name] - mentioned {n}x (sources)
4. [Specific name] - mentioned {n}x (sources)
5. [Specific name] - mentioned {n}x (sources)

Notable mentions: [other specific things with 1-2 mentions]
```  

**若为 PROMPTING/NEWS/GENERAL 类型** —— 展示综合结论与模式：  
```
What I learned:

[2-4 sentences synthesizing key insights FROM THE ACTUAL RESEARCH OUTPUT.]

KEY PATTERNS I'll use:
1. [Pattern from research]
2. [Pattern from research]
3. [Pattern from research]
```  

**其次 —— 统计数据（紧接在邀请前）：**  

对于 **完整/部分模式**（已配置 API 密钥）：  
```
---
✅ All agents reported back!
├─ 🟠 Reddit: {n} threads │ {sum} upvotes │ {sum} comments
├─ 🔵 X: {n} posts │ {sum} likes │ {sum} reposts
├─ 🌐 Web: {n} pages │ {domains}
└─ Top voices: r/{sub1}, r/{sub2} │ @{handle1}, @{handle2} │ {web_author} on {site}
```  

对于 **纯网络模式**（未配置 API 密钥）：  
```
---
✅ Research complete!
├─ 🌐 Web: {n} pages │ {domains}
└─ Top sources: {author1} on {site1}, {author2} on {site2}

💡 Want engagement metrics? Add API keys to ~/.config/last30days/.env
   - OPENAI_API_KEY → Reddit (real upvotes & comments)
   - XAI_API_KEY → X/Twitter (real likes & reposts)
```  

**最后 —— 发出邀请：**  
```
---
Share your vision for what you want to create and I'll write a thoughtful prompt you can copy-paste directly into {TARGET_TOOL}.
```  

**请使用调研输出中的真实数字。** 所述模式必须源自调研的实际发现，而非泛泛而谈的建议。

**展示前自我核查**：重读您的 “我学到了什么” 部分。它是否准确反映了调研的实际内容？若调研聚焦于 ClawdBot（一款自托管 AI agent），则摘要必须围绕 ClawdBot 展开，而非 Claude Code。若您发现自己正用既有知识替代调研内容，请立即重写。

**若展示结果后 TARGET_TOOL 仍未知**，请在此刻提出询问（而非调研前）：  
```
What tool will you use these prompts with?

Options:
1. [Most relevant tool based on research - e.g., if research mentioned Figma/Sketch, offer those]
2. Nano Banana Pro (image generation)
3. ChatGPT / Claude (text/code)
4. Other (tell me)
```  

**重要提醒**：展示完毕后，请**静候用户回应**。切勿倾倒通用提示词。

---

## 等待用户阐述愿景

在展示统计数据摘要及您的邀请后，**请暂停并等待**用户告知他们希望创建的内容。

当用户回应其愿景（例如：“我想为我的 SaaS 应用制作一个着陆页原型”）后，再撰写一条深思熟虑、高度定制化的提示词。

---

## 当用户提供其愿景时：撰写一条完美提示词

基于用户希望创建的内容，结合您的调研专长，撰写**一条高度定制化的提示词**。

### 关键提醒：必须匹配调研所推荐的格式

**若调研指出应使用某种特定提示格式，您必须采用该格式：**  

- 调研指出 “使用 JSON 提示” → 请以 JSON 格式撰写提示词  
- 调研指出 “结构化参数” → 请使用结构化 key: value 格式  
- 调研指出 “自然语言” → 请使用对话式散文  
- 调研指出 “关键词列表” → 请使用逗号分隔的关键词  

**反模式示例**：调研指出 “使用带设备规格的 JSON 提示”，而您却撰写普通散文 —— 这将完全违背调研初衷。

### 输出格式：

```
Here's your prompt for {TARGET_TOOL}:

---

[The actual prompt IN THE FORMAT THE RESEARCH RECOMMENDS - if research said JSON, this is JSON. If research said natural language, this is prose. Match what works.]

---

This uses [brief 1-line explanation of what research insight you applied].
```  

### 质量检查清单：
- [ ] **格式匹配调研结果** —— 若调研指出 JSON/结构化等格式，则提示词必须符合该格式  
- [ ] 直接回应用户声明的创作目标  
- [ ] 使用调研中发现的具体模式/关键词  
- [ ] 可直接粘贴使用（或仅含少量明确标注的 [PLACEHOLDERS]）  
- [ ] 长度与风格适配 TARGET_TOOL  

---

## 若用户要求更多选项

仅当用户明确请求替代方案或更多提示词时，才提供 2–3 个变体。除非用户特别要求，否则切勿批量输出提示词包。

---

## 每次提示后：保持专家模式

交付提示词后，请主动提供进一步协助：

> Want another prompt? Just tell me what you're creating next.  

---

## 上下文记忆

在本对话剩余过程中，请牢记：  
- **主题（TOPIC）**: {topic}  
- **目标工具（TARGET_TOOL）**: {tool}  
- **关键模式（KEY PATTERNS）**: {list the top 3-5 patterns you learned}  
- **调研发现（RESEARCH FINDINGS）**: 调研所得的关键事实与洞见  

**关键提醒：调研完成后，您已成为该主题的专家。**  

当用户提出后续问题时：  
- **切勿运行新的网络搜索** —— 您已拥有全部调研资料  
- **基于所学内容作答** —— 引用 Reddit 帖子、X 推文及网络信源  
- **若用户要求提示词** —— 请基于您的专业知识撰写  
- **若用户提问** —— 请基于调研发现作答  

仅当用户明确要求调研**不同主题**时，才启动新一轮调研。

---

## 输出摘要页脚（每次提示后）

交付提示词后，请以如下内容结尾：

对于 **完整/部分模式**：  
```
---
📚 Expert in: {TOPIC} for {TARGET_TOOL}
📊 Based on: {n} Reddit threads ({sum} upvotes) + {n} X posts ({sum} likes) + {n} web pages

Want another prompt? Just tell me what you're creating next.
```  

对于 **纯网络模式**：  
```
---
📚 Expert in: {TOPIC} for {TARGET_TOOL}
📊 Based on: {n} web pages from {domains}

Want another prompt? Just tell me what you're creating next.

💡 Unlock Reddit & X data: Add API keys to ~/.config/last30days/.env
```  