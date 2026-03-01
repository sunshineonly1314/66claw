---
name: geo-optimization
name_zh: 地理优化
description: "面向 AI 搜索可见性的生成式引擎优化（Generative Engine Optimization, GEO）。优化内容以在 ChatGPT、Perplexity、Claude 和 Google AI 概览（AI Overviews）中展现。适用于网站、网页或内容的 LLM 可发现性与可引用性优化。"
description_zh: 面向 AI 搜索可见性的生成式引擎优化（Generative Engine Optimization, GEO）。优化内容以在 ChatGPT、Perplexity、Claude 和 Google AI 概览（AI Overviews）中展现。适用于网站、网页或内容的 LLM 可发现性与可引用性优化。
metadata:
  version: 1.1.0
  tags: ["geo", "seo", "llm", "ai-search", "perplexity", "chatgpt", "content"]
---
# GEO：生成式引擎优化（Generative Engine Optimization）

优化内容，使其在 AI 驱动的搜索引擎（如 ChatGPT、Perplexity、Claude、Google AI 概览）中得以呈现。GEO 的核心在于内容具备**可解析性、可引用性与权威性**——而非关键词堆砌。

---

## 快速参考指南

| 目标 | 策略 |
|------|------|
| 在 AI 回答中被引用 | 添加具体统计数据与可直接引用的事实 |
| 出现在对比结果中 | 创建权威、明确的对比表格 |
| 回答用户问题 | 构建全面的 FAQ 专节 |
| 建立实体认知 | 在首段给出清晰定义 |
| 塑造权威形象 | 展示第三方提及、反向链接及内容新鲜度信号 |

---

## GEO 与 SEO：关键差异

| 维度 | 传统 SEO | GEO |
|------|----------|-----|
| 目标 | 在搜索引擎结果页（SERP）获得排名 | 在 AI 回答中被引用 |
| 关键词 | 精确匹配至关重要 | 语义理解更为关键 |
| 内容风格 | 可具推广性 | 必须客观、真实、中立 |
| 结构 | 标题用于快速浏览 | 标题 + 可解析的数据结构 |
| 链接 | 反向链接建立权威 | 引用 + 实体提及 |
| 新鲜度 | 有益 | 至关重要（LLM 偏好近期内容） |
| 格式 | 长篇内容更优 | 可引用的片段更优 |

---

## GEO 审计检查清单

每项按 0–2 分评分（0=缺失，1=部分满足，2=优秀）：

### 1. 实体清晰度（满分 10 分）
- [ ] 首段清晰定义该实体“是什么”或“是谁”
- [ ] 全文一致使用该实体名称
- [ ] 明确归类（“X 是一种 [事物类型]”）
- [ ] 阐明其与其他知名实体的关系
- [ ] 文风具备维基百科式的客观性

### 2. 可引用事实（满分 10 分）
- [ ] 包含具体数字（而非“许多”或“快速”等模糊表述）
- [ ] 统计数据时效性强且注明来源
- [ ] 主张具体且可验证
- [ ] 关键事实以独立句子呈现（便于提取）
- [ ] 存在“数据概览”或事实专节

### 3. FAQ 覆盖度（满分 10 分）
- [ ] 存在 FAQ 专节
- [ ] 问题匹配用户向 LLM 提问的常见方式
- [ ] 回答直接且完整
- [ ] 已实现 FAQ 结构化数据（schema）标记
- [ ] 覆盖“是什么”、“如何运作”、“为何”、“对比”类问题

### 4. 对比定位（满分 10 分）
- [ ] 存在对比表格
- [ ] 明确列出竞品名称
- [ ] 突出基于事实的差异（而非仅营销话术）
- [ ] 存在“X 的替代方案”相关内容
- [ ] 表述公正（无明显偏见）

### 5. 结构清晰度（满分 10 分）
- [ ] 标题层级清晰（H1→H2→H3）
- [ ] 列表项使用项目符号
- [ ] 对比内容使用表格呈现
- [ ] 段落简短（2–4 句）
- [ ] 顶部或底部设有摘要/要点速览（TL;DR）

### 6. 权威信号（满分 10 分）
- [ ] 明确声明作者/公司资质
- [ ] 展示客户名称/标识（社交证明）
- [ ] 案例研究附带真实数据
- [ ] 第三方提及/引用
- [ ] 标注“最后更新”日期

### 7. 新鲜度（满分 10 分）
- [ ] 页面标注最近更新日期
- [ ] 内容体现当前年份
- [ ] 无过时引用
- [ ] 定期更新内容
- [ ] 设有新闻/更新日志专节

**评分标准：**  
- 60–70 分：GEO 准备度极佳  
- 45–59 分：良好，需部分优化  
- 30–44 分：一般，存在显著缺口  
- <30 分：较差，亟需全面重构  

---

## 内容优化模板

### 模板 1：实体定义页

```markdown
# [Entity Name]

**[Entity Name]** is a [category] that [primary function]. 
Unlike [alternative/competitor], [Entity Name] offers [key differentiator].

## [Entity Name] by the Numbers

- [Specific stat 1]
- [Specific stat 2]
- [Specific stat 3]
- [Specific stat 4]

## How [Entity Name] Works

[2-3 paragraphs explaining core functionality]

## Who Uses [Entity Name]

[Named customers with context]

## Frequently Asked Questions

### What is [Entity Name]?
[Direct answer in 2-3 sentences]

### How is [Entity Name] different from [Competitor]?
[Factual comparison]

### How much does [Entity Name] cost?
[Pricing info or guidance]

*Last updated: [Date]*
```

### 模板 2：对比页（“X 的替代方案”）

```markdown
# Best [Competitor] Alternative: [Your Product] (2026)

> **Summary:** [Your Product] is a [category] offering [key differentiators]. 
> [Customers] report [specific result] compared to [Competitor].

*Last updated: [Date]*

## Why [Users] Look for [Competitor] Alternatives

### Problem 1: [Specific Pain Point]
[Explanation with specifics]

### Problem 2: [Specific Pain Point]
[Explanation with specifics]

## [Your Product] vs [Competitor]: Comparison

| Feature | [Competitor] | [Your Product] |
|---------|--------------|----------------|
| [Feature 1] | [Their approach] | [Your approach] |
| [Feature 2] | [Their approach] | [Your approach] |
| [Feature 3] | [Their approach] | [Your approach] |

## Key Differences

### [Differentiator 1]
[Factual explanation with numbers]

### [Differentiator 2]
[Factual explanation with numbers]

## Customer Results

> "[Quote with specific result]"
> — [Name], [Title], [Company]

## Frequently Asked Questions

### Is [Your Product] a good alternative to [Competitor]?
[Direct answer]

### How does [Your Product] compare to [Competitor] on [key factor]?
[Specific comparison]

### Can I migrate from [Competitor] to [Your Product]?
[Migration info]

## Summary

[Your Product] is a [category] offering [key benefits]. [Customers] 
using [Your Product] instead of [Competitor] report [specific results].

*[Your Product] has [credibility stat]. Learn more at [link].*
```

### 模板 3：FAQ 页（面向 LLM 优化）

```markdown
# [Topic] FAQ

Answers to common questions about [topic].

*Last updated: [Date]*

## General Questions

### What is [thing]?
[Thing] is a [category] that [function]. It is used by [who] to [accomplish what].

### How does [thing] work?
[Thing] works by [process]. [Additional detail].

### Who uses [thing]?
[Thing] is used by [user types], including [specific examples like Company A, Company B].

## Comparison Questions

### How is [thing] different from [alternative]?
[Thing] differs from [alternative] in [specific ways]:
- [Difference 1]
- [Difference 2]
- [Difference 3]

### Is [thing] better than [alternative]?
[Thing] is better suited for [use cases] because [reasons]. 
[Alternative] may be better for [other use cases].

## Pricing & Access

### How much does [thing] cost?
[Pricing information or range]

### Is there a free trial?
[Trial information]

## Technical Questions

### What are the requirements for [thing]?
[Requirements list]

### How do I get started with [thing]?
1. [Step 1]
2. [Step 2]
3. [Step 3]
```

---

## 平台专属优化策略

### Perplexity AI

**工作原理：** 三层重排序系统  
1. 从网络索引中初步检索  
2. 进行相关性评分  
3. 基于权威性与新鲜度选择引用来源  

**优化策略：**  
- 强大的域名权威性至关重要  
- 新鲜度信号极为关键（更新日期）  
- 直接回答用户问题  
- 被其他权威信源引用  
- 结构化数据有助于内容解析  

### ChatGPT / SearchGPT

**工作原理：** Bing 搜索驱动 + LLM 综合  

**优化策略：**  
- Bing 索引至关重要（向 Bing 提交站点地图）  
- E-E-A-T（经验、专业性、权威性、可信度）信号权重极高  
- 采用对话式内容结构  
- FAQ 格式效果极佳  
- 明确命名的实体有助于识别  

### Google AI 概览（AI Overviews）

**工作原理：** Google 索引 + Gemini 综合  

**优化策略：**  
- 传统 SEO 依然重要（排名有助提升）  
- 特色摘要（Featured Snippet）优化  
- 结构化数据标记（FAQ、HowTo、Product）  
- 内容清晰、权威  
- 移动端优先索引  

### Claude

**工作原理：** 训练数据 + 检索（启用网络访问时）  

**优化策略：**  
- 高质量内容进入训练数据源  
- 维基百科提及有助于实体识别  
- 技术准确性备受重视  
- 表达清晰、结构严谨  
- 被权威信源引用  

---

## 技术实现

### GEO 专用结构化数据（Schema）标记

**组织（Organization）Schema：**  
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Company Name",
  "description": "Clear description of what company does",
  "url": "https://example.com",
  "foundingDate": "2017",
  "numberOfEmployees": "50-100",
  "sameAs": [
    "https://twitter.com/company",
    "https://linkedin.com/company/company"
  ]
}
```

**FAQ Schema：**  
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is [thing]?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Direct answer here."
    }
  }]
}
```

**产品（Product）Schema：**  
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Product description",
  "brand": {"@type": "Brand", "name": "Brand"},
  "offers": {
    "@type": "Offer",
    "priceCurrency": "USD",
    "price": "99"
  }
}
```

### llms.txt 协议

在您网站根目录创建 `/llms.txt`，帮助 LLM 理解您的网站：

```
# Site Name

> Brief description of what this site/company is.

## Main Sections

- [Products](/products): Description of products section
- [Documentation](/docs): Technical documentation
- [Blog](/blog): Industry insights and updates

## Key Facts

- Founded: 2017
- Customers: 500+ companies
- Key metric: [specific number]

## Contact

- Website: https://example.com
- Email: hello@example.com
```

---

## GEO 表现监测

### 手动测试

定期在各平台使用以下提示词进行搜索：

**Perplexity：**  
- “[您的公司] 是什么？”  
- “[竞品] 的最佳替代方案”  
- “[您的品类] 对比”  
- “[您的产品] 如何运作？”  

**ChatGPT：**  
- 启用网页浏览功能后执行相同查询  
- “对比 [您的产品] 与 [竞品]”  

**Google（AI 概览）：**  
- “[您的品类] 解决方案”  
- “[竞品] 替代方案”  

### 监测工具

| 工具 | 追踪内容 | 价格 |
|------|----------|------|
| Otterly.AI | 多平台 AI 可见性 | 免费版可用 |
| Ahrefs Brand Radar | AI 搜索提及 | $129+/月 |
| Profound | 企业级基准评估 | 企业定制 |
| 手动追踪 | DIY 表格 | 免费 |

### 关键指标

- **提及率（Mention rate）：** 在相关查询中出现的百分比  
- **引用率（Citation rate）：** 出现提及中实际引用/链接到您的百分比  
- **情感倾向（Sentiment）：** 正面/中性/负面描述  
- **声量份额（Share of voice）：** 您的提及量与竞品之比  
- **位置（Position）：** 在 AI 回答中出现的位置（第 1、第 2 位等）  

---

## GEO 内容原则

### 应当（DO）：
- ✅ 使用具体数字（如“0.5 秒”，而非“快速”）  
- ✅ 使主张具备可引用性且独立成句  
- ✅ 以清晰层级结构组织内容  
- ✅ 包含 FAQ 专节  
- ✅ 定期更新内容并标注日期  
- ✅ 创建对比内容  
- ✅ 使用表格呈现数据  
- ✅ 保持事实准确、语气中立  
- ✅ 列出真实客户与成果  

### 不应（DON'T）：  
- ❌ 使用模糊最高级（如“最佳”、“领先”、“顶级”）  
- ❌ 堆砌关键词（LLM 可轻易识别）  
- ❌ 撰写无结构的大段文字  
- ❌ 隐藏信息（务必全面）  
- ❌ 使用过时统计数据  
- ❌ 忽略竞品（应直接回应）  
- ❌ 明显带有推广意图（中立性胜出）  

---

## 快速启动检查清单

针对您希望为 GEO 优化的任意页面：

1. [ ] 在首段添加清晰的实体定义  
2. [ ] 包含 5 个以上具体、可引用的统计数据  
3. [ ] 添加含 5 个以上问题的 FAQ 专节  
4. [ ] 创建对比表格（如适用）  
5. [ ] 添加“最后更新”日期  
6. [ ] 实施 FAQ 结构化数据（schema）标记  
7. [ ] 确保 H1→H2→H3 层级结构清晰  
8. [ ] 在 Perplexity 上测试：您的内容是否出现？  

---

## 自动化 GEO 监测

使用随附的监测脚本，跟踪您的引用率随时间变化！

### 快速启动

**测试当前可见性：**  
```bash
python3 scripts/geo-monitor.py --test
```

**单次查询测试：**  
```bash
python3 scripts/geo-monitor.py --query "best game server orchestration platform"
```

**生成每日报告：**  
```bash
python3 scripts/geo-daily-report.py
```

### 设置自动化监测

**1. 创建测试查询文件**（`scripts/geo-test-queries.json`）：  
```json
{
  "queries": [
    {
      "query": "your target query here",
      "category": "brand|product|comparison|problem|competitor"
    }
  ]
}
```

**2. 执行每日监测：**  
```bash
# Add to cron for daily 9am checks
0 9 * * * cd /path/to/skill && bash scripts/geo-daily-monitor.sh
```

### 报告解读

**引用率（Citation Rate）：** 在 AI 回答中出现的查询占比  
- 0–20%：初期阶段，亟需改进  
- 20–40%：可见性正在建立  
- 40–60%：表现强劲  
- 60%+：占据主导权威地位  

**追踪类别：**  
- 品牌类查询（您理应完全覆盖！）  
- 产品/功能类查询  
- 对比类查询（vs 竞品）  
- 问题/痛点类查询  
- 竞品对比类查询  

### 监测最佳实践

1. **起始阶段选取 15–20 个战略性查询**，覆盖全部类别  
2. **优化期间（前两周）每日测试**  
3. **达成目标引用率后改为每周检查**  
4. **内容更新后追踪变化**（预期滞后 3–7 天）  
5. **聚焦缺口**——引用率为 0% 的查询即为您的机会点  

### 需追踪内容

**当前状态：**  
- 总引用率  
- 各类别引用数  
- 被引用时的位置（第 1、第 2 位等）  
- 关键缺口（0% 覆盖率）  

**长期趋势：**  
- 引用率走势（周/月）  
- 新增引用数  
- 流失引用数（内容新鲜度！）  
- 各类别改善情况  

### 包含文件

- `scripts/geo-monitor.py` —— 主测试脚本（调用 Perplexity API）  
- `scripts/geo-daily-report.py` —— 格式化报告生成器  
- `scripts/geo-daily-monitor.sh` —— 兼容 cron 的封装脚本  
- `scripts/geo-test-queries.json` —— 查询文件示例  

**要求：** Perplexity API 密钥（通过 Clawdbot 中的 web_search 配置）

---

## 资源

- [Awesome GEO GitHub](https://github.com/amplifying-ai/awesome-generative-engine-optimization)  
- [普林斯顿大学 GEO 研究论文](https://arxiv.org/pdf/2311.09735)  
- [Google AI 搜索指南](https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search)  
- [Perplexity 排名因素](https://firstpagesage.com/seo-blog/perplexity-ai-optimization-ranking-factors-and-strategy/)  