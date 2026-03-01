---
name: research-company
name_zh: 公司调研
description: 面向 B2B 企业的公司研究技能，可生成专业 PDF 报告。当被要求研究某家公司、分析一家企业、创建客户档案，或基于公司网址生成市场情报时启用。输出为排版精美、可下载的 PDF 报告。
description_zh: 面向 B2B 企业的公司研究技能，可生成专业 PDF 报告。当被要求研究某家公司、分析一家企业、创建客户档案，或基于公司网址生成市场情报时启用。输出为排版精美、可下载的 PDF 报告。
---
# 公司研究

基于公司网址，生成结构完整、专业排版的客户研究 PDF 报告。

## 工作流程

1. **研究**该公司（网页抓取 + 多源搜索）
2. **构建**JSON 数据结构
3. **生成**PDF（通过 `scripts/generate_report.py`）
4. **交付**PDF 给用户

## 第一阶段：研究（并行执行）

并发执行以下搜索，以最小化上下文占用：

```
WebFetch: [company URL]
WebSearch: "[company name] funding news 2024"
WebSearch: "[company name] competitors market"
WebSearch: "[company name] CEO founder leadership"
```

从官网提取信息：公司名称、所属行业、总部地址、成立时间、高管团队、产品/服务、定价模式、目标客户、案例研究、客户评价、近期新闻。

## 第二阶段：构建数据结构

创建符合该模式的 JSON（完整规范详见 `references/data-schema.md`）：

```json
{
  "company_name": "...",
  "source_url": "...",
  "report_date": "January 20, 2026",
  "executive_summary": "3-5 sentences...",
  "profile": { "name": "...", "industry": "...", ... },
  "products": { "offerings": [...], "differentiators": [...] },
  "target_market": { "segments": "...", "verticals": [...] },
  "use_cases": [{ "title": "...", "description": "..." }],
  "competitors": [{ "name": "...", "strengths": "...", "differentiation": "..." }],
  "industry": { "trends": [...], "opportunities": [...], "challenges": [...] },
  "developments": [{ "date": "...", "title": "...", "description": "..." }],
  "lead_gen": { "keywords": {...}, "outreach_angles": [...] },
  "info_gaps": ["..."]
}
```

## 第三阶段：生成 PDF

```bash
# Install if needed
pip install reportlab

# Save JSON to temp file
cat > /tmp/research_data.json << 'EOF'
{...your JSON data...}
EOF

# Generate PDF
python3 scripts/generate_report.py /tmp/research_data.json /path/to/output/report.pdf
```

## 第四阶段：交付

将 PDF 保存至工作区文件夹，并提供下载链接：
```
[Download Company Research Report](computer:///sessions/.../report.pdf)
```

## 质量标准

- **准确性**：所有主张均须基于可观测证据，并注明信息来源
- **具体性**：包含产品名称、量化指标、客户实例等细节
- **完整性**：对缺失信息标注为“未公开可得”
- **杜绝虚构**：绝不编造任何信息

## 相关资源

- `scripts/generate_report.py` —— PDF 生成器（基于 reportlab）
- `references/data-schema.md` —— 含示例的完整 JSON 模式定义