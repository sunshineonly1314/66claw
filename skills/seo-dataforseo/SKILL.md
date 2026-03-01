---
name: seo-dataforseo
name_zh: DataForSEO SEO
description: "使用 DataForSEO API 进行 SEO 关键词研究。执行关键词分析、YouTube 关键词研究、竞品分析、搜索结果页面（SERP）分析及趋势追踪。当用户提出以下请求时使用：关键词调研、搜索量/CPC/竞争度分析、关键词建议获取、关键词难度评估、竞品分析、热门话题发现、YouTube SEO 研究，或着陆页关键词优化。需具备 DataForSEO API 账户，并在 .env 文件中配置凭据。"
description_zh: 使用 DataForSEO API 进行 SEO 关键词研究。执行关键词分析、YouTube 关键词研究、竞品分析、搜索结果页面（SERP）分析及趋势追踪。当用户提出以下请求时使用：关键词调研、搜索量/CPC/竞争度分析、关键词建议获取、关键词难度评估、竞品分析、热门话题发现、YouTube SEO 研究，或着陆页关键词优化。需具备 DataForSEO API 账户，并在 .env 文件中配置凭据。
---
# SEO 关键词研究（DataForSEO）

## 配置

安装依赖项：

```bash
pip install -r scripts/requirements.txt
```

通过在项目根目录创建 `.env` 文件来配置凭据：

```
DATAFORSEO_LOGIN=your_email@example.com
DATAFORSEO_PASSWORD=your_api_password
```

凭据获取地址：https://app.dataforseo.com/api-access

## 快速开始

| 用户输入 | 应调用的函数 |
|-----------|-----------------|
| “为 [主题] 研究关键词” | `keyword_research("topic")` |
| “获取 [创意] 的 YouTube 关键词数据” | `youtube_keyword_research("idea")` |
| “分析竞品 [domain.com]” | `competitor_analysis("domain.com")` |
| “当前有哪些热门话题？” | `trending_topics()` |
| “对 [关键词列表] 进行关键词分析” | `full_keyword_analysis(["kw1", "kw2"])` |
| “为 [主题] 生成着陆页关键词” | `landing_page_keyword_research(["kw1"], "competitor.com")` |

通过从 `scripts/main.py` 导入来执行函数：

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path("scripts")))
from main import *

result = keyword_research("AI website builders")
```

## 工作流模式

每项研究任务均遵循三个阶段：

### 1. 研究  
调用 API 函数。每次函数调用均向 DataForSEO API 发起请求，并返回结构化数据。

### 2. 自动保存  
所有结果将自动以带时间戳的 JSON 文件形式保存至 `results/{category}/`。文件命名规则：`YYYYMMDD_HHMMSS__operation__keyword__extra_info.json`

### 3. 汇总  
研究完成后，读取已保存的 JSON 文件，并在 `results/summary/` 中生成 Markdown 格式汇总文档，内容包括数据表格、按优先级排序的机会列表，以及战略建议。

## 高层函数

这些是 `scripts/main.py` 中的主要函数。每个函数均编排多个 API 调用，以完成完整的研究工作流。

| 函数 | 用途 | 获取的数据 |
|----------|---------|----------------|
| `keyword_research(keyword)` | 单关键词深度分析 | 概览、关键词建议、相关关键词、难度评分 |
| `youtube_keyword_research(keyword)` | YouTube 内容研究 | 概览、关键词建议、YouTube SERP 排名、YouTube 趋势 |
| `landing_page_keyword_research(keywords, competitor_domain)` | 着陆页 SEO 分析 | 概览、搜索意图、难度、SERP 分析、竞品关键词 |
| `full_keyword_analysis(keywords)` | 战略性内容规划 | 概览、难度、搜索意图、关键词创意、历史搜索量、Google Trends 数据 |
| `competitor_analysis(domain, keywords)` | 竞品情报分析 | 域名关键词、Google Ads 关键词、竞品域名 |
| `trending_topics(location_name)` | 当前趋势分析 | 当前热门搜索词 |

### 参数  

所有函数均接受一个可选的 `location_name` 参数（默认值：“United States”）。大多数函数还提供布尔型标志，用于跳过特定子分析（例如 `include_suggestions=False`）。

### 独立 API 函数  

如需更精细的控制，可从 API 模块中导入特定函数。详见 [references/api-reference.md](references/api-reference.md)，其中列出了全部 25 个 API 函数，含参数说明、调用限制与使用示例。

## 结果存储  

结果自动保存至 `results/`，目录结构如下：

```
results/
├── keywords_data/    # Search volume, CPC, competition
├── labs/             # Suggestions, difficulty, intent
├── serp/             # Google/YouTube rankings
├── trends/           # Google Trends data
└── summary/          # Human-readable markdown summaries
```

### 结果管理  

```python
from core.storage import list_results, load_result, get_latest_result

# List recent results
files = list_results(category="labs", limit=10)

# Load a specific result
data = load_result(files[0])

# Get most recent result for an operation
latest = get_latest_result(category="labs", operation="keyword_suggestions")
```

### 工具函数  

```python
from main import get_recent_results, load_latest

# List recent files across all categories
files = get_recent_results(limit=10)

# Load latest result for a category
data = load_latest("labs", "keyword_suggestions")
```

## 创建汇总文档  

完成研究后，在 `results/summary/` 中创建一份 Markdown 格式的汇总文档，应包含：

- **数据表格**：含搜索量、CPC、竞争度、难度等指标  
- **机会排序列表**：按搜索量或机会得分排序  
- **SERP 分析**：展示当前排名靠前的内容  
- **建议**：涵盖内容策略、标题、标签等方面的建议  

汇总文件名应具有描述性（例如：`results/summary/ai-tools-keyword-research.md`）。

## 使用提示  

1. **力求具体** —— “为‘AI 网站构建器’获取关键词建议” 效果优于 “研究 AI 相关内容”  
2. **务必生成汇总** —— 每次研究后都应创建一份命名明确的汇总文档  
3. **批量处理关联关键词** —— 一次性传入多个相关关键词便于横向对比  
4. **明确目标场景** —— “用于 YouTube 视频” 与 “用于着陆页” 所关注的核心数据不同  
5. **主动请求竞品分析** —— “哪些视频当前正在排名？” 可帮助识别内容空白点  

## 默认设置  

- **地理位置**：美国（代码 2840）  
- **语言**：英语  
- **API 限制**：搜索量/概览类请求最多 700 个关键词；难度/意图类请求最多 1000 个；趋势类请求最多 5 个；关键词创意类请求最多 200 个