---
name: youtube-analytics
name_zh: YouTube分析
description: "YouTube Data API v3 分析工具包。用于分析 YouTube 频道、视频及搜索结果。当用户提出以下需求时适用：检查 YouTube 频道统计数据、分析视频表现、对比频道、搜索视频、获取订阅者数量、查看互动指标、发现热门视频、获取频道上传内容，或分析 YouTube 竞争格局。需从 Google Cloud Console 获取 YouTube Data API v3 密钥。"
description_zh: YouTube Data API v3 分析工具包。用于分析 YouTube 频道、视频及搜索结果。当用户提出以下需求时适用：检查 YouTube 频道统计数据、分析视频表现、对比频道、搜索视频、获取订阅者数量、查看互动指标、发现热门视频、获取频道上传内容，或分析 YouTube 竞争格局。需从 Google Cloud Console 获取 YouTube Data API v3 密钥。
---
# YouTube Analytics 工具包

## 初始化配置

安装依赖项：

```bash
cd scripts && npm install
```

通过在项目根目录创建 `.env` 文件来配置凭证：

```
YOUTUBE_API_KEY=AIzaSy...your-api-key
YOUTUBE_DEFAULT_MAX_RESULTS=50
```

**前提条件**：需拥有一个已启用 YouTube Data API v3 的 Google Cloud 项目。您的 API 密钥可从 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 获取。

## 快速入门

| 用户输入 | 应调用的函数 |
|----------|--------------|
| “分析这个 YouTube 频道” | `analyzeChannel(channelId)` |
| “对比这两个频道” | `compareChannels([id1, id2])` |
| “这个视频表现如何？” | `analyzeVideo(videoId)` |
| “在 YouTube 上搜索 [主题]” | `searchAndAnalyze(query)` |
| “获取该频道的统计数据” | `getChannelStats(channelId)` |
| “获取该视频的观看次数” | `getVideoStats(videoId)` |
| “查找关于 [主题] 的频道” | `searchChannels(query)` |
| “显示该频道最近的上传内容” | `getChannelVideos(channelId)` |

通过从 `scripts/src/index.ts` 导入来执行函数：

```typescript
import { analyzeChannel, searchAndAnalyze } from './scripts/src/index.js';

const analysis = await analyzeChannel('UCxxxxxxxx');
```

或直接使用 tsx 运行：

```bash
npx tsx scripts/src/index.ts
```

## 工作流模式

所有分析均遵循三个阶段：

### 1. 分析（Analyze）  
运行 API 函数。每次调用均访问 YouTube Data API 并返回结构化数据。

### 2. 自动保存（Auto-Save）  
所有结果自动保存为 JSON 文件至 `results/{category}/`。文件命名规则如下：  
- 命名结果：`{sanitized_name}.json`  
- 自动生成：`YYYYMMDD_HHMMSS__{operation}.json`  

### 3. 汇总（Summarize）  
分析完成后，读取已保存的 JSON 文件，并在 `results/summaries/` 中生成 Markdown 汇总报告，包含数据表格、对比分析与洞察结论。

## 高层级函数

| 函数 | 用途 | 获取的数据 |
|------|------|------------|
| `analyzeChannel(channelId)` | 完整频道分析 | 频道信息、近期视频、每条视频平均观看次数 |
| `compareChannels(channelIds)` | 多频道对比 | 订阅者数、观看次数、视频数量的并排对比 |
| `analyzeVideo(videoId)` | 视频表现分析 | 观看次数、点赞数、评论数、点赞率、评论率 |
| `searchAndAnalyze(query, maxResults?)` | 搜索 + 统计 | 搜索结果及其完整视频统计数据 |

## 单个 API 函数

如需精细控制，可从各 API 模块单独导入特定函数。详见 [references/api-reference.md](references/api-reference.md)，其中列出了全部 13 个 API 函数，含参数说明、类型定义与使用示例。

### 频道函数

| 函数 | 用途 |
|------|------|
| `getChannel(channelId)` | 获取频道完整信息 |
| `getChannelStats(channelId)` | 获取简化统计信息（订阅者数、观看次数、视频数量） |
| `getMultipleChannels(channelIds)` | 批量获取多个频道信息 |

### 视频函数

| 函数 | 用途 |
|------|------|
| `getVideo(videoId)` | 获取视频完整信息 |
| `getVideoStats(videoId)` | 获取简化统计信息（观看次数、点赞数、评论数） |
| `getMultipleVideos(videoIds)` | 批量获取多个视频信息 |
| `getChannelVideos(channelId)` | 获取某频道近期上传的视频 |

### 搜索函数

| 函数 | 用途 |
|------|------|
| `searchVideos(query, options?)` | 搜索视频 |
| `searchChannels(query, options?)` | 搜索频道 |

## 结果存储

结果自动保存至 `results/`，目录结构如下：

```
results/
├── channels/       # Channel data and comparisons
├── videos/         # Video data and analyses
├── search/         # Search results
└── summaries/      # Human-readable markdown summaries
```

### 结果管理

```typescript
import { listResults, loadResult, getLatestResult } from './scripts/src/index.js';

// List recent results
const files = listResults('channels', 10);

// Load a specific result
const data = loadResult(files[0]);

// Get most recent result for an operation
const latest = getLatestResult('channels', 'channel_analysis');
```

## 使用提示

1. **使用频道 ID** —— 频道 ID 以 `UC` 开头（例如：`UCxxxxxxxx`）。您可在频道 URL 或网页源码中找到它。  
2. **请求汇总报告** —— 数据拉取完成后，可要求生成含表格与洞察的 Markdown 汇总报告。  
3. **频道对比** —— 使用 `compareChannels()` 对竞品频道进行并排基准测试。  
4. **批量请求** —— 使用 `getMultipleChannels()` 或 `getMultipleVideos()` 实现高效批量查询。  
5. **搜索 + 分析** —— `searchAndAnalyze()` 在一次调用中完成搜索并附带完整视频统计信息。  