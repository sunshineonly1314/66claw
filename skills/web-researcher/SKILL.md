---
name: web-researcher
description: "General-purpose web research automation using the browser tool. Performs structured research workflows: search engines, multi-page scraping, data extraction, form filling, and report generation. Use when the user needs to research a topic online, scrape web data, fill web forms, test websites, or extract structured information from web pages."
nameZh: "网页研究"
descriptionZh: "通用网页研究自动化：搜索引擎查询、多页面抓取、数据提取和报告生成"
metadata: {"openclawcn":{"emoji":"🔍"}}
---

# 网页研究 (Web Researcher)

使用 `browser` 工具执行通用网页研究工作流：搜索→抓取→分析→报告。适用于任何需要从网页获取和分析信息的场景。

## 触发场景

- "帮我调研一下 XXX"
- "从网上搜集 XXX 的信息"
- "打开这个网站帮我看看"
- "帮我填一下这个表单"
- "抓取这个页面的数据"

## 核心工作流

### 1. 搜索引擎研究

```
browser({action: "start", target: "host"})
browser({action: "navigate", targetUrl: "https://www.google.com"})
browser({action: "snapshot"})
browser({action: "act", request: {kind: "click", ref: "搜索框ref"}})
browser({action: "act", request: {kind: "type", text: "搜索关键词", ref: "搜索框ref"}})
browser({action: "act", request: {kind: "press", key: "Enter"}})
browser({action: "act", request: {kind: "wait", timeMs: 2000}})
browser({action: "screenshot"})  -- 查看搜索结果
browser({action: "snapshot"})    -- 提取结果链接和摘要
```

**百度搜索** (中文内容优先):
```
browser({action: "navigate", targetUrl: "https://www.baidu.com"})
```

**必应搜索**:
```
browser({action: "navigate", targetUrl: "https://www.bing.com"})
```

也可直接用 web_search 工具（更快）:
```
web_search({query: "搜索关键词", maxResults: 10})
```

### 2. 页面内容抓取

打开目标页面:
```
browser({action: "navigate", targetUrl: "https://target-site.com/page"})
browser({action: "act", request: {kind: "wait", timeMs: 2000}})
```

提取文字内容:
```
browser({action: "snapshot"})
```

提取视觉内容（图表、布局）:
```
browser({action: "screenshot"})
```

执行 JS 提取结构化数据:
```
browser({action: "act", request: {kind: "evaluate", fn: "JSON.stringify({title: document.title, content: document.querySelector('article')?.textContent?.slice(0,2000)})"}})
```

### 3. 多页面遍历

当需要从列表页逐一访问详情页:

```
-- 获取列表页所有链接
browser({action: "snapshot"})  -- 提取链接列表

-- 对每个链接:
browser({action: "act", request: {kind: "click", ref: "链接ref"}})
browser({action: "act", request: {kind: "wait", timeMs: 2000}})
browser({action: "snapshot"})  -- 提取详情内容
browser({action: "act", request: {kind: "evaluate", fn: "window.history.back()"}})
browser({action: "act", request: {kind: "wait", timeMs: 1500}})
```

### 4. 滚动加载（懒加载/瀑布流页面）

```
-- 初始快照
browser({action: "snapshot"})

-- 滚动加载更多
browser({action: "act", request: {kind: "evaluate", fn: "window.scrollBy(0, 800)"}})
browser({action: "act", request: {kind: "wait", timeMs: 1500}})
browser({action: "snapshot"})  -- 检查新加载内容

-- 重复直到内容足够或到底
```

### 5. 表单填写

```
browser({action: "snapshot"})  -- 识别表单字段
browser({action: "act", request: {kind: "click", ref: "字段ref"}})
browser({action: "act", request: {kind: "type", text: "填写内容", ref: "字段ref"}})
-- 下拉选择
browser({action: "act", request: {kind: "click", ref: "下拉框ref"}})
browser({action: "act", request: {kind: "click", ref: "选项ref"}})
-- 提交
browser({action: "act", request: {kind: "click", ref: "提交按钮ref"}})
```

### 6. 登录处理

如遇登录墙:
1. 先尝试用 `target: "host"` 复用已登录浏览器
2. 如需登录，提示用户手动完成:
   - "该网站需要登录，请在弹出的浏览器窗口中登录，完成后告诉我"
3. 登录后 screenshot 验证，继续工作流

## 研究报告模板

```markdown
# [主题] 网页研究报告

## 研究概述
- **研究主题**: [主题]
- **时间**: [日期]
- **数据来源**: [网站列表]
- **页面数**: [访问页面数]

## 核心发现
1. **发现一** — 详细描述 [来源](url)
2. **发现二** — 详细描述 [来源](url)

## 数据汇总
| 维度 | 数据 | 来源 |
|------|------|------|
| ... | ... | ... |

## 详细分析
[基于抓取数据的分析]

## 附录：数据来源
- [页面标题](url) — 访问时间
```

## browser 工具速查

| 操作 | 示例 |
|------|------|
| 启动 | `browser({action:"start", target:"host"})` |
| 导航 | `browser({action:"navigate", targetUrl:"https://..."})` |
| 截图 | `browser({action:"screenshot"})` |
| 快照 | `browser({action:"snapshot"})` |
| 点击 | `browser({action:"act", request:{kind:"click", ref:"xxx"}})` |
| 输入 | `browser({action:"act", request:{kind:"type", text:"...", ref:"xxx"}})` |
| 按键 | `browser({action:"act", request:{kind:"press", key:"Enter"}})` |
| 等待 | `browser({action:"act", request:{kind:"wait", timeMs:2000}})` |
| JS | `browser({action:"act", request:{kind:"evaluate", fn:"..."}})` |
| 滚动 | `browser({action:"act", request:{kind:"evaluate", fn:"window.scrollBy(0,800)"}})` |

## 最佳实践

- **先 web_search，后 browser**: 简单查询用 web_search，需要深度抓取再用 browser
- **screenshot + snapshot 配合**: screenshot 看布局/图表，snapshot 提取文字
- **每步验证**: 关键操作后 screenshot 确认结果
- **操作间隔**: 每次交互后 wait 1-2 秒，避免被反爬
- **复用会话**: 用 `target: "host"` 复用已有浏览器，保持登录态
- **异常处理**: 遇到验证码/弹窗 → 提示用户处理 → screenshot 验证后继续
