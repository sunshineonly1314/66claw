---
name: octolens
name_zh: Octolens
description: 通过 Octolens API 查询并分析品牌提及信息。当用户需要获取品牌提及、追踪关键词、按来源平台（Twitter、Reddit、GitHub、LinkedIn 等）筛选、进行情感分析，或分析社交媒体互动数据时使用。支持使用 AND/OR 逻辑进行复杂筛选，并支持日期范围、作者粉丝数及收藏标记等条件。
description_zh: 通过 Octolens API 查询并分析品牌提及信息。当用户需要获取品牌提及、追踪关键词、按来源平台（Twitter、Reddit、GitHub、LinkedIn 等）筛选、进行情感分析，或分析社交媒体互动数据时使用。支持使用 AND/OR 逻辑进行复杂筛选，并支持日期范围、作者粉丝数及收藏标记等条件。
license: MIT
metadata:
  author: octolens
  version: "1.0"
compatibility: 需要 Node.js 18+（以支持 fetch API）及互联网连接
allowed-tools: Node Read
---
# Octolens API 技能

## 何时使用该技能

当用户需要以下功能时，请使用该技能：
- 从社交媒体及其他平台获取品牌提及信息
- 按来源平台（Twitter、Reddit、GitHub、LinkedIn、YouTube、HackerNews、DevTO、StackOverflow、Bluesky、新闻通讯、播客）筛选提及内容
- 分析情感倾向（正面、中性、负面）
- 按作者粉丝数或互动情况筛选
- 搜索特定关键词或标签
- 按日期范围查询提及内容
- 列出可用关键词或已保存的视图（saved views）
- 使用 AND/OR 条件执行复杂筛选逻辑

## API 认证

Octolens API 要求使用 Bearer Token 进行身份验证。用户应提供其 API 密钥，你需将其置于 `Authorization` 请求头中：

```
Authorization: Bearer YOUR_API_KEY
```

**重要提示**：在发起任何 API 请求前，务必先向用户索取其 API 密钥。将密钥存入变量以便后续请求复用。

## 基础 URL

所有 API 接口均基于基础 URL：`https://app.octolens.com/api/v1`

## 速率限制

- **限制**：每小时最多 500 次请求  
- **检查方式**：响应头中的 `X-RateLimit-*` 字段显示当前使用量

## 可用端点

### 1. POST /mentions

根据关键词获取匹配的提及内容，并支持可选筛选。返回结果按时间戳排序（最新在前）。

**关键参数：**
- `limit`（数字，取值范围 1–100）：最多返回结果数（默认：20）
- `cursor`（字符串）：上一次响应中提供的分页游标（cursor）
- `includeAll`（布尔值）：是否包含低相关性内容（默认：false）
- `view`（数字）：用于筛选的视图 ID
- `filters`（对象）：筛选条件（参见“提及内容筛选”章节）

**示例响应：**
```json
{
  "data": [
    {
      "id": "abc123",
      "url": "https://twitter.com/user/status/123",
      "body": "Just discovered @YourProduct - this is exactly what I needed!",
      "source": "twitter",
      "timestamp": "2024-01-15T10:30:00Z",
      "author": "user123",
      "authorName": "John Doe",
      "authorFollowers": 5420,
      "relevance": "relevant",
      "sentiment": "positive",
      "language": "en",
      "tags": ["feature-request"],
      "keywords": [{ "id": 1, "keyword": "YourProduct" }],
      "bookmarked": false,
      "engaged": false
    }
  ],
  "cursor": "eyJsYXN0SWQiOiAiYWJjMTIzIn0="
}
```

### 2. GET /keywords

列出组织内配置的所有关键词。

**示例响应：**
```json
{
  "data": [
    {
      "id": 1,
      "keyword": "YourProduct",
      "platforms": ["twitter", "reddit", "github"],
      "color": "#6366f1",
      "paused": false,
      "context": "Our main product name"
    }
  ]
}
```

### 3. GET /views

列出所有已保存的视图（即预配置的筛选器）。

**示例响应：**
```json
{
  "data": [
    {
      "id": 1,
      "name": "High Priority",
      "icon": "star",
      "filters": {
        "sentiment": ["positive", "negative"],
        "source": ["twitter"]
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## 提及内容筛选

`/mentions` 接口支持两种强大筛选模式：

### 简单模式（隐式 AND）

将字段直接置于 filters 对象中。所有条件默认为 AND 关系。

```json
{
  "filters": {
    "source": ["twitter", "linkedin"],
    "sentiment": ["positive"],
    "minXFollowers": 1000
  }
}
```
→ `source IN (twitter, linkedin) AND sentiment = positive AND followers ≥ 1000`

### 排除项（Exclusions）

对任意数组型字段添加前缀 `!`，即可排除对应值：

```json
{
  "filters": {
    "source": ["twitter"],
    "!keyword": [5, 6]
  }
}
```
→ `source = twitter AND keyword NOT IN (5, 6)`

### 高级模式（AND/OR 分组）

使用 `operator` 和 `groups` 实现复杂逻辑：

```json
{
  "filters": {
    "operator": "AND",
    "groups": [
      {
        "operator": "OR",
        "conditions": [
          { "source": ["twitter"] },
          { "source": ["linkedin"] }
        ]
      },
      {
        "operator": "AND",
        "conditions": [
          { "sentiment": ["positive"] },
          { "!tag": ["spam"] }
        ]
      }
    ]
  }
}
```
→ `(source = twitter OR source = linkedin) AND (sentiment = positive AND tag ≠ spam)`

### 可用筛选字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `source` | string[] | 平台列表：twitter、reddit、github、linkedin、youtube、hackernews、devto、stackoverflow、bluesky、newsletter、podcast |
| `sentiment` | string[] | 取值：positive、neutral、negative |
| `keyword` | string[] | 关键词 ID（通过 /keywords 接口获取） |
| `language` | string[] | ISO 639-1 语言代码：en、es、fr、de、pt、it、nl、ja、ko、zh |
| `tag` | string[] | 标签名 |
| `bookmarked` | boolean | 筛选已收藏（true）或未收藏（false）的帖子 |
| `engaged` | boolean | 筛选已互动（true）或未互动（false）的帖子 |
| `minXFollowers` | number | Twitter 最小粉丝数 |
| `maxXFollowers` | number | Twitter 最大粉丝数 |
| `startDate` | string | ISO 8601 格式（例如："2024-01-15T00:00:00Z"） |
| `endDate` | string | ISO 8601 格式 |

## 使用内置脚本

本技能附带若干辅助脚本，用于常见操作。可借此快速调用 API：

### 获取提及内容
```bash
node scripts/fetch-mentions.js YOUR_API_KEY [limit] [includeAll]
```

### 列出关键词
```bash
node scripts/list-keywords.js YOUR_API_KEY
```

### 列出视图
```bash
node scripts/list-views.js YOUR_API_KEY
```

### 自定义筛选查询
```bash
node scripts/query-mentions.js YOUR_API_KEY '{"source": ["twitter"], "sentiment": ["positive"]}' [limit]
```

### 高级查询
```bash
node scripts/advanced-query.js YOUR_API_KEY [limit]
```

## 最佳实践

1. **始终先索取 API 密钥**，再发起请求  
2. **尽可能使用视图（views）**，复用预配置的筛选器  
3. **从简单筛选起步**，按需逐步增加复杂度  
4. **检查速率限制**：查看响应头中的 `X-RateLimit-*` 字段  
5. **对大数据集使用分页游标（cursor）**  
6. **日期格式必须为 ISO 8601**（例如："2024-01-15T00:00:00Z"）  
7. **筛选关键词前，先通过 `/keywords` 接口获取关键词 ID**  
8. **使用排除语法（`!`）过滤不相关内容**  
9. **结合 `includeAll=false` 与相关性筛选，提升结果质量**

## 常见使用场景

### 查找高粉丝数的正面 Twitter 提及
```json
{
  "limit": 20,
  "filters": {
    "source": ["twitter"],
    "sentiment": ["positive"],
    "minXFollowers": 1000
  }
}
```

### 排除垃圾信息，并获取 Reddit 与 GitHub 的提及
```json
{
  "limit": 50,
  "filters": {
    "source": ["reddit", "github"],
    "!tag": ["spam", "irrelevant"]
  }
}
```

### 复杂查询：（Twitter 或 LinkedIn）且情感为正面，时间范围为最近 7 天
```json
{
  "limit": 30,
  "filters": {
    "operator": "AND",
    "groups": [
      {
        "operator": "OR",
        "conditions": [
          { "source": ["twitter"] },
          { "source": ["linkedin"] }
        ]
      },
      {
        "operator": "AND",
        "conditions": [
          { "sentiment": ["positive"] },
          { "startDate": "2024-01-20T00:00:00Z" }
        ]
      }
    ]
  }
}
```

## 错误处理

| 状态码 | 错误码 | 描述 |
|--------|--------|------|
| 401 | unauthorized | 缺失或无效的 API 密钥 |
| 403 | forbidden | 密钥有效但无访问权限 |
| 404 | not_found | 资源（如视图 ID）不存在 |
| 429 | rate_limit_exceeded | 请求过于频繁 |
| 400 | invalid_request | 请求体格式错误 |
| 500 | internal_error | 服务端错误，请稍后重试 |

## 分步工作流

当用户提出查询 Octolens 数据的请求时：

1. **索取 API 密钥**：若尚未提供，则立即询问  
2. **理解用户需求**：明确其具体查询目标  
3. **确定所需筛选条件**：来源平台、情感倾向、日期范围等  
4. **确认是否适用已有视图**：若用户提及“已保存筛选器”，请先列出视图  
5. **构建查询**：优先尝试简单模式；复杂逻辑再启用高级模式  
6. **执行请求**：使用内置 Node.js 脚本或直接调用 fetch API  
7. **解析结果**：提取关键信息（作者、正文、情感倾向、来源平台）  
8. **处理分页**：若需更多结果，请使用响应中的 cursor 继续请求  
9. **呈现结果**：归纳核心发现，突出趋势与模式  

## 示例

### 示例 1：简单查询  
**用户**：“展示过去 7 天内来自 Twitter 的正面提及”  

**操作**（使用内置脚本）：  
```bash
node scripts/query-mentions.js YOUR_API_KEY '{"source": ["twitter"], "sentiment": ["positive"], "startDate": "2024-01-20T00:00:00Z"}'
```  

**替代方案**（直接使用 fetch API）：  
```javascript
const response = await fetch('https://app.octolens.com/api/v1/mentions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    limit: 20,
    filters: {
      source: ['twitter'],
      sentiment: ['positive'],
      startDate: '2024-01-20T00:00:00Z',
    },
  }),
});
const data = await response.json();
```  

### 示例 2：高级查询  
**用户**：“查找来自 Reddit 或 GitHub 的提及，排除带 spam 标签的内容，并限定情感为正面或中性”  

**操作**（使用内置脚本）：  
```bash
node scripts/query-mentions.js YOUR_API_KEY '{"operator": "AND", "groups": [{"operator": "OR", "conditions": [{"source": ["reddit"]}, {"source": ["github"]}]}, {"operator": "OR", "conditions": [{"sentiment": ["positive"]}, {"sentiment": ["neutral"]}]}, {"operator": "AND", "conditions": [{"!tag": ["spam"]}]}]}'
```  

**替代方案**（直接使用 fetch API）：  
```javascript
const response = await fetch('https://app.octolens.com/api/v1/mentions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    limit: 30,
    filters: {
      operator: 'AND',
      groups: [
        {
          operator: 'OR',
          conditions: [
            { source: ['reddit'] },
            { source: ['github'] },
          ],
        },
        {
          operator: 'OR',
          conditions: [
            { sentiment: ['positive'] },
            { sentiment: ['neutral'] },
          ],
        },
        {
          operator: 'AND',
          conditions: [
            { '!tag': ['spam'] },
          ],
        },
      ],
    },
  }),
});
const data = await response.json();
```  

### 示例 3：先获取关键词  
**用户**：“展示我们主产品关键词的相关提及”  

**操作步骤**：  
1. 首先列出关键词：  
```bash
node scripts/list-keywords.js YOUR_API_KEY
```  

2. 再使用该关键词 ID 查询提及：  
```bash
node scripts/query-mentions.js YOUR_API_KEY '{"keyword": [1]}'
```  

## agent 使用提示

- **优先使用内置脚本**：Node.js 脚本自动完成 JSON 解析  
- **缓存关键词**：首次获取关键词后，在当前会话中复用  
- **解释筛选逻辑**：使用复杂筛选时，向用户说明其含义  
- **提供结构示例**：当用户不确定如何构造筛选器时，展示典型结构  
- **明智分页**：在获取下一页前，主动询问用户是否需要更多结果  
- **归纳洞察**：不止输出原始数据，还需提供分析结论（如情感趋势、高频作者、平台分布等）