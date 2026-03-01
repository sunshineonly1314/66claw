---
name: context7
name_zh: Context7
description: Context7 MCP - 面向任意库的智能文档搜索与上下文支持
description_zh: Context7 MCP - 面向任意库的智能文档搜索与上下文支持
metadata:
  version: 1.0.3
  tags: ["documentation", "search", "context", "mcp", "llm"]
  clawdbot:
    requires:
      bins: ["node"]
      npm: true
    install:
      - id: "skill-install"
        kind: "skill"
        source: "clawdhub"
        slug: "context7"
        label: "Install Context7 skill"
---
# Context7 MCP

Context7 利用大语言模型（LLM）提供面向任意库的智能文档搜索与上下文支持。

## 设置

1. 将 `.env.example` 复制到 `.env`，并添加您的 Context7 API 密钥：
   ```bash
   cp .env.example .env
   ```

   将您的 API 密钥添加至 `.env`：
   ```
   CONTEXT7_API_KEY=your-api-key-here
   ```

   您的密钥可从 [context7.com/dashboard](https://context7.com/dashboard) 获取。

2. 安装依赖项：
   ```bash
   npm install
   ```

## 使用方法

Context7 提供两个主要命令：

### 搜索命令（Search Command）

按库名称进行搜索，并由 LLM 驱动的智能排序机制对结果进行排序：

```bash
npx tsx query.ts search <library_name> <query>

# Examples:
npx tsx query.ts search "nextjs" "setup ssr"
npx tsx query.ts search "react" "useEffect cleanup"
npx tsx query.ts search "better-auth" "authentication flow"
```

该命令调用 Context7 搜索 API：
```
GET https://context7.com/api/v2/libs/search?libraryName=<name>&query=<query>
```

**响应内容包括：**
- id：库 ID（例如 `/vercel/next.js`）
- name：显示名称
- trustScore：来源可信度（0–100）
- benchmarkScore：质量指标（0–100）
- versions：可用的版本标签

### 上下文命令（Context Command）

获取经 LLM 重排序的智能文档上下文：

```bash
npx tsx query.ts context <owner/repo> <query>

# Examples:
npx tsx query.ts context "vercel/next.js" "setup ssr"
npx tsx query.ts context "facebook/react" "useState hook"
```

该命令调用 Context7 上下文 API：
```
GET https://context7.com/api/v2/context?libraryId=<repo>&query=<query>&type=txt
```

**响应内容包括：**
- title：文档章节标题
- content：文档正文/片段
- source：源页面 URL

### 快速参考

```bash
# Search for documentation
npx tsx query.ts search "library-name" "your search query"

# Get context from a specific repo
npx tsx query.ts context "owner/repo" "your question"
```

## 最佳实践

遵循以下最佳实践，以充分发挥 Context7 API 的能力：

### 优化搜索相关性

使用 `/libs/search` 接口时，请始终在查询参数中包含用户的原始问题。这使 API 能借助 LLM 驱动的排序机制，为特定任务找到最相关的库，而非仅依赖简单的名称匹配。

**示例：** 若用户询问有关 Next.js 中服务端渲染（SSR）的问题，则应使用如下搜索参数：
- `libraryName=nextjs`
- `query=setup+ssr`

此举可确保针对该具体任务获得最优排序结果。

### 使用明确的库 ID

为在调用 `/context` 接口时获得最快且最准确的结果，请提供完整的 libraryId（例如 `/vercel/next.js`）。若您已知用户所指的具体库，可跳过搜索步骤，直接调用上下文接口，从而降低延迟。

### 利用版本控制

为确保面向旧版或特定项目需求的文档准确性，请在 libraryId 中采用 `/owner/repo/version` 格式指定版本号。您可在搜索接口的响应中查得可用的版本标签。

### 选择合适的响应类型

根据您的实际需求，通过 `type` 参数定制 `/context` 响应：
- 当您需要以编程方式处理标题、内容片段及源 URL（适用于 UI 展示）时，请使用 `type=json`；
- 当您希望将文档内容直接作为纯文本输入至 LLM 提示词（prompt）中时，请使用 `type=txt`。

### 按质量分值筛选

当以编程方式从搜索结果中选取库时，请利用 `trustScore` 和 `benchmarkScore` 对高质量、高信誉的文档来源进行优先排序，从而提升终端用户体验。

### 查找导航页

可通过获取位于以下地址的 `llms.txt` 文件，在本说明文档中查找导航页及其他页面：
```
https://context7.com/docs/llms.txt
```

## API 参考

### Context7 REST API

**搜索接口（Search Endpoint）：**
```
GET https://context7.com/api/v2/libs/search
  ?libraryName=<library_name>
  &query=<user_query>
```

**上下文接口（Context Endpoint）：**
```
GET https://context7.com/api/v2/context
  ?libraryId=<owner/repo>
  &query=<user_query>
  &type=txt|json
```

## 故障排除

**未返回任何结果？**
- 请确认您的 API 密钥有效；
- 请核对库名称拼写是否正确（例如应为 'react'，而非 'React'）。

**出现身份验证错误？**
- 请确保已在 `.env` 中设置 CONTEXT7_API_KEY 环境变量；
- 请前往 context7.com/dashboard 检查密钥是否已过期。

## 许可证

MIT