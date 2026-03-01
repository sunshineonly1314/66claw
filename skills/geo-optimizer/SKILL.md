---
name: geo-optimizer
name_zh: 地理优化器
version: 1.0.0
description: 针对 AI 引用（GEO）优化内容。当用户提到“GEO”、“生成式引擎优化”、“AI 引用”、“被 AI 引用”、“AI 友好型内容”，或需为 ChatGPT/Claude/Perplexity 提升可见性而创作内容时使用。
description_zh: 针对 AI 引用（GEO）优化内容。当用户提到“GEO”、“生成式引擎优化”、“AI 引用”、“被 AI 引用”、“AI 友好型内容”，或需为 ChatGPT/Claude/Perplexity 提升可见性而创作内容时使用。
---
# GEO 内容优化器

## 使用时机
- 为 AI 引用而创作内容  
- 重构文章以提升 AI 兼容性
- 增强内容在 AI 回答中的可引用性
- 在 AI 优先的搜索中展开竞争
- 添加 AI 系统可识别的权威性信号

## 核心概念
**SEO** = 在搜索引擎结果中获得排名  
**GEO** = 在 AI 生成的回答中被引用

## 8 大 GEO 维度

| 维度 | 低分（1–2 分） | 高分（4–5 分） |
|-----------|-----------|------------|
| 定义清晰度 | 模糊笼统 | 具备可引用性的定义，并含量化指标 |
| 可引用性陈述 | 泛泛而谈的主张 | 含具体事实及来源的陈述 |
| 事实密度 | 以观点为主 | 数据密集型内容 |
| 来源引用 | 无引用 | 可追溯至权威来源 |
| 问答格式 | 纯叙述性文本 | 明确划分的问答章节 |
| 权威性信号 | 无资质说明 | 专家署名、专业资质展示 |
| 内容时效性 | 过时信息 | 引用陈旧资料，但数据最新 |
| 结构清晰度 | 层级混乱 | 标题层级清晰，含列表与表格 |

## GEO 得分
每项维度按 1–5 分打分，总分 /40：
- 32–40 分：已具备 AI 就绪性  
- 24–31 分：需进一步优化  
- 16–23 分：需大幅改进  

## 快速提效方案（30 分钟内可完成的编辑）

1. 添加带日期和来源的具体统计数据  
2. 创建独立的定义段落  
3. 插入附带资质说明的专家引述  
4. 添加对比表格  
5. 创建含 5–7 个问题的常见问题解答（FAQ）章节  
6. 将模糊主张替换为经验证的事实  
7. 插入权威来源的引用标注  

## 输出格式

```markdown
## GEO Audit
Current Score: [X]/40

### Dimension Scores
| Dimension | Score | Quick Fix |
|-----------|-------|-----------|
| [dimension] | [1-5] | [action] |

## Optimized Content Sections

### Definition (Citable)
[Term] is [category] that [function], [key metric].

### Key Statistics
- [Stat with source and date]
- [Stat with source and date]

### FAQ Section
**Q: [Common question]?**
A: [Direct, quotable answer with citation]
```

## 集成能力
可与以下技能组合使用：
- **app-planning-skill** → 规划内容策略  
- **writing-plans** → 构建内容项目结构  

---
评分细则详见 references/dimensions.md  
优化模式详见 references/patterns.md  
优化前后示例详见 references/examples.md  