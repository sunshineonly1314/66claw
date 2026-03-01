---
name: ga4-analytics
name_zh: GA4分析
description: "Google Analytics 4、Search Console 与 Indexing API 工具包。分析网站流量、页面表现、用户人口统计、实时访客、搜索查询及 SEO 指标。当用户提出以下请求时使用：检查网站流量、分析页面浏览量、查看流量来源、了解用户人口统计、获取实时访客数据、检查 Search Console 查询、分析 SEO 表现、请求 URL 重新索引、检查索引状态、对比日期范围、检查跳出率、查看转化数据，或获取电商收入。需配置具备 GA4 和 Search Console 访问权限的 Google Cloud 服务账号。"
description_zh: Google Analytics 4、Search Console 与 Indexing API 工具包。分析网站流量、页面表现、用户人口统计、实时访客、搜索查询及 SEO 指标。当用户提出以下请求时使用：检查网站流量、分析页面浏览量、查看流量来源、了解用户人口统计、获取实时访客数据、检查 Search Console 查询、分析 SEO 表现、请求 URL 重新索引、检查索引状态、对比日期范围、检查跳出率、查看转化数据，或获取电商收入。需配置具备 GA4 和 Search Console 访问权限的 Google Cloud 服务账号。
---
# GA4 Analytics 工具包

## 初始化设置

安装依赖项：

```bash
cd scripts && npm install
```

通过在项目根目录创建 `.env` 文件来配置凭据：

```
GA4_PROPERTY_ID=123456789
GA4_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SEARCH_CONSOLE_SITE_URL=https://your-domain.com
GA4_DEFAULT_DATE_RANGE=30d
```

**前提条件**：一个已启用 Analytics Data API、Search Console API 和 Indexing API 的 Google Cloud 项目；一个拥有您的 GA4 属性与 Search Console 访问权限的服务账号。

## 快速入门

| 用户输入 | 应调用的函数 |
|----------|--------------|
| "显示过去 30 天的网站流量" | `siteOverview("30d")` |
| "我的热门搜索词有哪些？" | `searchConsoleOverview("30d")` |
| "此刻谁正在访问网站？" | `liveSnapshot()` |
| "请为以下 URL 重新索引" | `reindexUrls(["https://example.com/page1", ...])` |
| "对比本月与上月数据" | `compareDateRanges({startDate: "30daysAgo", endDate: "today"}, {startDate: "60daysAgo", endDate: "31daysAgo"})` |
| "哪些页面流量最高？" | `contentPerformance("30d")` |

通过从 `scripts/src/index.ts` 导入执行函数：

```typescript
import { siteOverview, searchConsoleOverview } from './scripts/src/index.js';

const overview = await siteOverview('30d');
```

或直接使用 tsx 运行：

```bash
npx tsx scripts/src/index.ts
```

## 工作流模式

所有分析均遵循三个阶段：

### 1. 分析（Analyze）
运行 API 函数。每次调用均访问 Google API 并返回结构化数据。

### 2. 自动保存（Auto-Save）
所有结果自动保存为带时间戳的 JSON 文件至 `results/{category}/`。文件命名规则：`YYYYMMDD_HHMMSS__operation__extra_info.json`

### 3. 汇总（Summarize）
分析完成后，读取已保存的 JSON 文件，并在 `results/summaries/` 中生成 Markdown 汇总报告，包含数据表格、趋势分析与建议。

## 高层级函数

### GA4 Analytics

| 函数 | 用途 | 获取内容 |
|------|------|-----------|
| `siteOverview(dateRange?)` | 全面的网站快照 | 页面浏览量、流量来源、人口统计、事件 |
| `trafficAnalysis(dateRange?)` | 流量深度分析 | 来源、各来源/媒介的会话数、新访客 vs 回访客 |
| `contentPerformance(dateRange?)` | 热门页面分析 | 页面浏览量、着陆页、退出页 |
| `userBehavior(dateRange?)` | 用户参与模式 | 人口统计、事件、每日参与指标 |
| `compareDateRanges(range1, range2)` | 时段对比 | 两个日期范围的并排指标对比 |
| `liveSnapshot()` | 实时数据 | 活跃用户、当前页面、当前事件 |

### Search Console

| 函数 | 用途 | 获取内容 |
|------|------|-----------|
| `searchConsoleOverview(dateRange?)` | SEO 快照 | 热门查询、热门页面、设备与国家分布 |
| `keywordAnalysis(dateRange?)` | 关键词深度分析 | 按设备分类的查询词 |
| `seoPagePerformance(dateRange?)` | 页面 SEO 指标 | 按点击量排名的热门页面、国家分布 |

### Indexing

| 函数 | 用途 |
|------|------|
| `reindexUrls(urls)` | 请求对多个 URL 进行重新索引 |
| `checkIndexStatus(urls)` | 检查 URL 是否已被索引 |

### 工具函数（Utility）

| 函数 | 用途 |
|------|------|
| `getAvailableFields()` | 列出所有可用的 GA4 维度与指标 |

### 单个 API 函数

如需精细控制，可从各 API 模块导入特定函数。详见 [references/api-reference.md](references/api-reference.md)，其中列出了 30+ 个 API 函数的完整参数、类型与示例。

## 日期范围

所有函数均支持灵活的日期范围格式：

| 格式 | 示例 | 描述 |
|------|------|------|
| 简写格式 | `"7d"`, `"30d"`, `"90d"` | 从若干天前到今天 |
| 显式格式 | `{startDate: "2024-01-01", endDate: "2024-01-31"}` | 具体起止日期 |
| GA4 相对格式 | `{startDate: "30daysAgo", endDate: "today"}` | GA4 原生相对格式 |

默认为 `"30d"`（可通过 `GA4_DEFAULT_DATE_RANGE` 在 `.env` 中配置）。

## 结果存储

结果自动保存至 `results/`，目录结构如下：

```
results/
├── reports/          # GA4 standard reports
├── realtime/         # Real-time snapshots
├── searchconsole/    # Search Console data
├── indexing/         # Indexing API results
└── summaries/        # Human-readable markdown summaries
```

### 管理结果

```typescript
import { listResults, loadResult, getLatestResult } from './scripts/src/index.js';

// List recent results
const files = listResults('reports', 10);

// Load a specific result
const data = loadResult(files[0]);

// Get most recent result for an operation
const latest = getLatestResult('reports', 'site_overview');
```

## 常用维度与指标

### 维度（Dimensions）
`pagePath`, `pageTitle`, `sessionSource`, `sessionMedium`, `country`, `deviceCategory`, `browser`, `date`, `eventName`, `landingPage`, `newVsReturning`

### 指标（Metrics）
`screenPageViews`, `activeUsers`, `sessions`, `newUsers`, `bounceRate`, `averageSessionDuration`, `engagementRate`, `conversions`, `totalRevenue`, `eventCount`

## 使用提示

1. **明确指定日期范围** — “最近 7 天”或“最近 90 天”提供的洞察不同于默认的 30 天  
2. **请求汇总报告** — 数据拉取完成后，可要求生成含表格与洞察的 Markdown 汇总  
3. **对比不同时段** — 使用 `compareDateRanges()` 发现趋势（例如本月 vs 上月）  
4. **检查实时数据** — `liveSnapshot()` 显示当前正在访问网站的用户  
5. **结合 GA4 与 Search Console** — 流量数据叠加搜索查询数据，呈现完整图景  