---
name: literature-review
name_zh: 文献综述
version: 1.2.0
description: 通过 Semantic Scholar、OpenAlex、Crossref 和 PubMed 等学术 API 检索文献，辅助撰写文献综述。当用户需要查找某主题的相关论文、获取特定 DOI 的详细信息，或基于规范引用草拟文献综述章节时使用。
description_zh: 通过 Semantic Scholar、OpenAlex、Crossref 和 PubMed 等学术 API 检索文献，辅助撰写文献综述。当用户需要查找某主题的相关论文、获取特定 DOI 的详细信息，或基于规范引用草拟文献综述章节时使用。
---
# 文献综述

利用多引擎搜索集成（S2、OA、CR、PM）辅助撰写学术文献综述。

## 功能

- **多源检索**：使用 Semantic Scholar（S2）、OpenAlex（OA）、Crossref（CR）和 PubMed（PM）查找相关学术论文。
- **完整摘要**：所有来源均返回完整摘要（PubMed 使用 `efetch` 获取完整 XML 记录）。
- **DOI 提取**：从所有来源中提取 DOI，用于交叉引用与去重。
- **自动去重**：在跨多个来源检索（`--source all` 或 `--source both`）时，结果将依据 DOI 自动去重。
- **礼貌式访问**：自动通过环境变量 `USER_EMAIL` 提供邮箱信息，以接入 OpenAlex/Crossref 的“礼貌池”（Polite Pool）。
- **摘要重建**：从 OpenAlex 倒排索引格式重建摘要。
- **综合归纳**：依据元数据将论文按主题分组，并草拟综述章节。

## 环境变量

| 变量 | 用途 | 默认值 |
|----------|---------|---------|
| `USER_EMAIL` | 礼貌式 API 访问所用邮箱 | `anonymous@example.org` |
| `CLAWDBOT_EMAIL` | 若未设置 USER_EMAIL，则作为备用邮箱 | — |
| `SEMANTIC_SCHOLAR_API_KEY` | 可选的 S2 API 密钥（用于提升调用频率上限） | — |
| `OPENALEX_API_KEY` | 可选的 OpenAlex API 密钥 | — |

## 工作流

### 1. 广泛检索（覆盖全部数据库）
从所有主流学术数据库获取全面概览。结果将依据 DOI 自动去重。
```bash
python3 scripts/lit_search.py search "impact of glycyrrhiza on bifidobacterium" --limit 5 --source all
```

### 2. 精准检索
- **OpenAlex**（`oa`）：速度快、覆盖面广，摘要质量高。
- **Semantic Scholar**（`s2`）：提供高质量的引用数据及 TL;DR 摘要。
- **Crossref**（`cr`）：基于 DOI 的精确元数据（不提供摘要）。
- **PubMed**（`pm`）：生物医学研究领域的金标准，提供完整摘要及 PMID。

```bash
python3 scripts/lit_search.py search "prebiotic effects of liquorice" --source pm
```

### 3. 多源比对检索
同时检索 S2 和 OA，确保无遗漏。默认启用去重。
```bash
python3 scripts/lit_search.py search "Bifidobacterium infantis growth" --source both
```

### 4. 获取完整详情（S2）
检索包括 TL;DR 摘要在内的详细元数据。
```bash
python3 scripts/lit_search.py details "DOI:10.1016/j.foodchem.2023.136000"
```

### 5. 撰写综述
1.  **提取要点**：从已检索到的摘要中提取关键发现。
2.  **组织结构**：将发现按逻辑结构归类（例如按时间顺序或主题分类）。
3.  **草拟成文**：采用“逐步思考”方式，综合多个来源生成连贯叙述。

## 输出格式

每条结果包含：
- `id`：来源特有标识符（PubMed 使用 PMID，OpenAlex 使用其 ID，S2 使用论文 ID，Crossref 使用 DOI）
- `doi`：如可用则提供 DOI（用于去重）
- `title`：论文标题
- `year`：出版年份
- `authors`：作者姓名列表
- `abstract`：完整摘要文本（如可用）
- `venue`：期刊或会议名称
- `citationCount`：引用次数（S2、OA 提供）
- `source`：该结果来源的数据库

## 成功使用提示

- **引用规范**：务必通过 DOI 或 PMID 核对参考文献，确保准确性。
- **筛选策略**：聚焦于 `citationCount` 较高或近年发表的论文，以构建更前沿的综述。
- **医学领域首选 PubMed**：使用 `--source pm` 获取最可靠的生物医学文献。
- **去重机制**：多源检索会自动剔除重复项；若需原始计数，请使用单一来源检索。