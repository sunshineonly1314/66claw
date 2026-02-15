---
name: xiaohongshu
description: "Automate Xiaohongshu (RedNote) content research via browser: search keywords, filter by most-liked/most-commented, analyze articles (title, text, images/video), and generate Chinese summary reports."
nameZh: "小红书内容研究"
descriptionZh: "自动化小红书内容调研：搜索关键词、按最多点赞/评论筛选、逐篇分析标题文案图片视频、生成中文总结报告"
metadata: {"openclawcn":{"emoji":"📕"}}
---

# 小红书内容调研自动化 (Xiaohongshu Content Research)

使用 `browser` 工具操作小红书网页版 (xiaohongshu.com)，自动完成关键词搜索、筛选排序、逐篇文章分析，并生成中文总结报告。

适用场景：内容调研、竞品分析、热门话题追踪、爆款文案学习。

## 快速开始

用户说："帮我搜索小红书关键词'AI绘画'，分析热门文章" → 按下方完整工作流执行。

## 完整工作流

### Step 1: 启动浏览器并打开小红书

```
browser({action: "start", target: "host"})
browser({action: "navigate", targetUrl: "https://www.xiaohongshu.com/explore"})
browser({action: "screenshot"})   -- 验证页面加载成功
```

**重要**: 使用 `target: "host"` 复用用户已有的浏览器（可能已登录小红书），避免登录问题。

### Step 2: 登录处理

截图后分析页面状态：

**场景 A — 已登录**：页面正常显示探索内容，无登录弹窗 → 直接继续操作。

**场景 B — 弹出登录弹窗**：看到登录弹窗（手机号登录 / QR码扫码），弹窗右上角有关闭按钮 ×。
- 小红书**未登录也可搜索和浏览**，点击 × 关闭弹窗即可：
```
browser({action: "snapshot"})   -- 找到关闭按钮
browser({action: "act", request: {kind: "click", ref: "关闭按钮ref"}})
browser({action: "screenshot"})  -- 验证弹窗已关闭
```

**场景 C — 强制要求登录**：某些操作（如查看文章详情）可能要求登录。
- 提示用户："小红书要求登录才能继续，请在弹出的登录界面中用手机扫码登录或输入手机号验证码登录。"
- 登录后取 screenshot 验证，再继续工作流。

### Step 3: 搜索关键词

```
browser({action: "snapshot"})   -- 获取页面结构，找到搜索框
browser({action: "act", request: {kind: "click", ref: "搜索输入框ref"}})
browser({action: "act", request: {kind: "type", text: "用户指定的关键词", ref: "搜索输入框ref"}})
browser({action: "act", request: {kind: "press", key: "Enter"}})
browser({action: "act", request: {kind: "wait", timeMs: 2000}})
browser({action: "screenshot"})  -- 验证搜索结果页面
```

搜索结果页 URL 格式：`https://www.xiaohongshu.com/search_result?keyword=xxx`

### Step 4: 应用筛选条件

搜索结果页右上角有"筛选"按钮，点击后展开筛选面板。

**筛选面板包含**：
- 排序依据：综合 / 最新 / 最多点赞 / 最多评论 / 最多收藏
- 笔记类型：不限 / 视频 / 图文
- 发布时间：不限 / 一天内 / 一周内 / 半年内
- 搜索范围 / 位置距离

**第一轮：最多点赞**

```
browser({action: "snapshot"})   -- 找到"筛选"按钮
browser({action: "act", request: {kind: "click", ref: "筛选按钮ref"}})
browser({action: "screenshot"})  -- 验证筛选面板已展开
browser({action: "act", request: {kind: "click", ref: "最多点赞ref"}})
browser({action: "act", request: {kind: "wait", timeMs: 2000}})
browser({action: "screenshot"})  -- 验证结果已按点赞排序
```

采集当前排序下的文章列表（见 Step 5），记录到"最多点赞"分组。

**第二轮：最多评论**

```
browser({action: "snapshot"})   -- 找到筛选面板（可能需要重新展开）
browser({action: "act", request: {kind: "click", ref: "最多评论ref"}})
browser({action: "act", request: {kind: "wait", timeMs: 2000}})
browser({action: "screenshot"})  -- 验证结果已按评论排序
```

采集当前排序下的文章列表，记录到"最多评论"分组。

### Step 5: 采集搜索结果列表

小红书搜索结果为**瀑布流布局**（双列卡片），每张卡片包含：封面图、标题、作者头像和昵称、点赞数。

**采集方法**：

```
-- 1. 获取当前可见文章
browser({action: "snapshot"})   -- 提取文章卡片信息

-- 2. 滚动加载更多（重复执行直到采集够数量）
browser({action: "act", request: {kind: "evaluate", fn: "window.scrollBy(0, 800)"}})
browser({action: "act", request: {kind: "wait", timeMs: 1500}})
browser({action: "snapshot"})   -- 提取新加载的文章

-- 3. 也可用 evaluate 批量提取
browser({action: "act", request: {kind: "evaluate", fn: "JSON.stringify([...document.querySelectorAll('.note-item')].map(el => ({title: el.querySelector('.title')?.textContent, author: el.querySelector('.author-wrapper .name')?.textContent, likes: el.querySelector('.like-wrapper .count')?.textContent})))"}})
```

**注意**：小红书前端选择器可能变化，优先使用 `snapshot` 获取 ARIA 结构，结合 `ref` 定位元素。如果 snapshot 无法提取完整数据，再使用 `evaluate` 执行 JS。

记录每篇文章的位置信息（ref 或在列表中的索引），供 Step 6 逐篇点击。

### Step 6: 逐篇分析文章详情

小红书文章详情通常以**弹窗/overlay** 形式在当前页面上层展示（不跳转新页面）。

**对每篇文章重复以下流程**：

```
-- 1. 点击文章卡片
browser({action: "act", request: {kind: "click", ref: "文章卡片ref"}})
browser({action: "act", request: {kind: "wait", timeMs: 2000}})

-- 2. 截图查看文章详情（图片/视频内容需要视觉分析）
browser({action: "screenshot"})  -- 分析图片/视频内容

-- 3. snapshot 提取文字内容
browser({action: "snapshot"})    -- 提取标题、正文、标签、互动数据

-- 4. 如需提取更多结构化数据
browser({action: "act", request: {kind: "evaluate", fn: "JSON.stringify({title: document.querySelector('.note-detail .title')?.textContent, content: document.querySelector('.note-detail .content')?.textContent, tags: [...document.querySelectorAll('.note-detail .tag')].map(t=>t.textContent), likes: document.querySelector('.like-wrapper .count')?.textContent, comments: document.querySelector('.comment-wrapper .count')?.textContent, collects: document.querySelector('.collect-wrapper .count')?.textContent})"}})

-- 5. 滚动查看更多图片（多图文章需要滑动查看）
browser({action: "screenshot"})  -- 如果有多张图片，滚动后再截图

-- 6. 关闭详情弹窗，返回搜索结果
browser({action: "act", request: {kind: "click", ref: "关闭按钮ref或弹窗外区域"}})
-- 或按 Escape 关闭
browser({action: "act", request: {kind: "press", key: "Escape"}})
browser({action: "act", request: {kind: "wait", timeMs: 1000}})
browser({action: "screenshot"})  -- 验证已返回搜索结果列表
```

**分析记录内容**：
- 标题
- 正文文案（全文或摘要）
- 内容类型（图文/视频）
- 图片描述（通过 screenshot 视觉分析）
- 视频封面/画面描述（通过 screenshot 视觉分析）
- 标签 (#hashtag)
- 互动数据（点赞、评论、收藏数）
- 亮点/特色分析

### Step 7: 生成中文总结报告

汇总所有采集和分析结果，使用下方报告模板生成 .md 文件。

```
Write({file_path: "用户指定路径/小红书调研报告-关键词.md", content: "报告内容"})
```

## 报告模板

```markdown
# 小红书内容调研报告

## 调研概述
- **搜索关键词**：[关键词]
- **调研时间**：[日期]
- **筛选条件**：最多点赞 / 最多评论
- **分析文章数**：[数量] 篇

---

## 热门文章排行

### 最多点赞 TOP 文章

| 排名 | 标题 | 作者 | 点赞数 | 评论数 | 收藏数 | 类型 |
|------|------|------|--------|--------|--------|------|
| 1 | ... | ... | ... | ... | ... | 图文/视频 |

### 最多评论 TOP 文章

| 排名 | 标题 | 作者 | 点赞数 | 评论数 | 收藏数 | 类型 |
|------|------|------|--------|--------|--------|------|
| 1 | ... | ... | ... | ... | ... | 图文/视频 |

---

## 逐篇内容分析

### 1.《文章标题》
- **作者**：xxx
- **互动数据**：点赞 xxx | 评论 xxx | 收藏 xxx
- **内容类型**：图文 / 视频
- **文案摘要**：
  > 文案核心内容概述...
- **图片/视频内容描述**：
  > 对文章中图片或视频画面的描述...
- **标签**：#tag1 #tag2 #tag3
- **亮点分析**：该文章的独特之处、吸引点分析

（每篇文章重复上述格式）

---

## 内容趋势总结

### 共性特征
- 这些热门文章的共同点...

### 热门话题方向
- 当前该关键词下最热门的子话题...

### 写作风格分析
- 标题特点（长度、句式、关键词）...
- 文案风格（口语化/专业/故事型）...
- 常用句式和表达...

### 视觉内容特点
- 图片风格（实拍/设计/截图）...
- 封面特点...
- 视频时长和内容偏好...

---

## 内容创作建议
- 基于以上分析，建议的内容创作方向...
- 标题写作建议...
- 文案结构建议...
- 视觉素材建议...
```

## Browser 工具速查

| 操作 | 示例 | 说明 |
|------|------|------|
| 启动浏览器 | `browser({action:"start", target:"host"})` | 使用用户已有浏览器 |
| 导航页面 | `browser({action:"navigate", targetUrl:"https://..."})` | 打开指定 URL |
| 页面截图 | `browser({action:"screenshot"})` | 视觉分析图片/视频 |
| DOM 快照 | `browser({action:"snapshot"})` | 提取文字/结构 |
| 点击元素 | `browser({action:"act", request:{kind:"click", ref:"xxx"}})` | 通过 ref 点击 |
| 输入文字 | `browser({action:"act", request:{kind:"type", text:"...", ref:"xxx"}})` | 在指定元素输入 |
| 按键 | `browser({action:"act", request:{kind:"press", key:"Enter"}})` | 发送键盘事件 |
| 等待 | `browser({action:"act", request:{kind:"wait", timeMs:2000}})` | 等待页面加载 |
| 执行 JS | `browser({action:"act", request:{kind:"evaluate", fn:"..."}})` | 执行 JavaScript |
| 滚动页面 | `browser({action:"act", request:{kind:"evaluate", fn:"window.scrollBy(0,800)"}})` | 触发懒加载 |

## 常见问题与注意事项

### 1. 登录弹窗处理
- **问题**：打开小红书后弹出登录界面
- **方案**：小红书未登录也可搜索和浏览大部分内容。找到弹窗右上角的 × 关闭按钮点击关闭即可。如果查看文章详情被强制要求登录，提示用户手动登录。
- **最佳实践**：使用 `target: "host"` 启动浏览器，复用已登录状态。

### 2. 瀑布流动态加载
- **问题**：搜索结果不是一次性加载完毕，需要滚动触发加载
- **方案**：使用 `evaluate` 执行 `window.scrollBy(0, 800)` 滚动，等待 1-2 秒后再取 snapshot。重复此过程直到采集足够文章。
- **验证**：每次滚动后 snapshot 检查是否有新内容加载。

### 3. 操作间隔控制
- **问题**：操作过快可能触发小红书反爬机制
- **方案**：每次重要操作后使用 `wait` 等待 1-2 秒。避免短时间内大量快速请求。如遇验证码，提示用户手动完成。

### 4. 文章详情弹窗
- **问题**：点击文章后以弹窗/overlay 形式展示，不是新页面
- **方案**：在当前页面上操作弹窗内容。关闭弹窗时点击关闭按钮或弹窗外区域或按 Escape 键，返回搜索结果列表继续下一篇。

### 5. 视频内容分析
- **问题**：无法直接提取视频内容
- **方案**：通过 `screenshot` 截取视频封面或播放中的画面，利用视觉分析描述视频内容。如果视频有文字字幕，可从截图中识别。

### 6. 图片内容分析
- **问题**：图文笔记可能包含多张图片
- **方案**：通过 `screenshot` 截图并视觉分析。多图文章需要在详情弹窗中滑动查看每张图片，逐张截图分析。

### 7. 选择器变化
- **问题**：小红书前端 CSS 选择器可能随版本更新变化
- **方案**：优先使用 `snapshot` 获取 ARIA/role 结构，通过 `ref` 定位元素。只在 snapshot 无法满足需求时才用 `evaluate` 执行带选择器的 JS。

## 验证模式

每步重要操作后，**必须** screenshot 或 snapshot 验证结果：
- 搜索后 → 验证搜索结果是否出现
- 筛选后 → 验证排序是否生效（观察结果顺序变化）
- 点击文章后 → 验证详情弹窗是否打开
- 关闭弹窗后 → 验证已返回搜索结果列表
- 滚动后 → 验证是否有新内容加载

此验证模式可防止级联错误，确保每步操作的结果符合预期。
