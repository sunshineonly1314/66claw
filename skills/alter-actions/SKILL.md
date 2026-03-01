---
name: alter-action-trigger
name_zh: 动作调整
description: 通过 x-callback-url 触发 Alter macOS 应用操作。涵盖 84+ 种操作，包括“任意提问”、“翻译”、“摘要生成”、“语法修正”等。
description_zh: 通过 x-callback-url 触发 Alter macOS 应用操作。涵盖 84+ 种操作，包括“任意提问”、“翻译”、“摘要生成”、“语法修正”等。
metadata: {"clawdbot":{"requires":{"os":["darwin"]},"emoji":"🌀"}}
user-invocable: true
homepage: https://alterhq.com/blog/alter-callback-urls-guide
---
# Alter Action Trigger

从 Clawdbot 或命令行通过 x-callback-url 触发 Alter 操作。

## 快速入门

```bash
# Trigger an action directly
node index.js trigger ask-anything --input "What is AI?"

# Find actions with natural language
node index.js find "summarize video"

# List all actions in a category
node index.js list --category writing
```

## URL 格式

所有 Alter 操作均采用 x-callback-url 格式：  
```
alter://action/{action-id}?input={encoded-text}&param={value}
```

## 函数说明

### `triggerAction(actionId, input, params)`  
通过 x-callback-url 触发 Alter 操作。

### `findActions(query)`  
根据自然语言查询匹配对应操作。

### `listActions(category)`  
列出全部操作，支持按类别筛选。

### `getActionInfo(actionId)`  
返回某项特定操作的详细信息。

### `buildCallbackUrl(actionId, input, params)`  
构建 x-callback-url，但不执行。

---

## 可用操作参考

### 📝 写作类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `analyze-prose` | 分析散文 | 对文本质量进行评估，并提供评分与改进建议 | 无 |
| `aphorisms` | 名言警句 | 查找并输出已知的经典名言 | 无 |
| `change-tone` | 调整语气 | 在保留原意前提下变更文本语气 | `tone`：坚定型、友好型、非正式型、专业型、简洁直接型 |
| `correct-grammar` | 修正语法与拼写 | 修复语法与拼写错误 | 无 |
| `cut-filler-words` | 删除填充词 | 删除冗余填充词，使文本更自信有力 | 无 |
| `fill-in` | 补全文本 | 智能补全不完整文本 | 无 |
| `improve-writing` | 提升写作质量 | 优化文本清晰度、连贯性与语法 | 无 |
| `lengthen` | 扩展文本 | 添加细节以扩充原文 | 无 |
| `poll` | 创建投票 | 生成引人参与的投票内容 | 无 |
| `rewrite` | 重写文本 | 以全新视角重写文本 | 无 |
| `shorten` | 缩减文本 | 在保留核心信息前提下压缩文本 | 无 |
| `write-essay` | 撰写论文 | 构建结构严谨的论文 | `input`：主题/说明 |

### 💻 编程类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `act-code` | 代码操作 | 修改并优化代码 | `input`：说明 |
| `document` | 注释代码 | 为代码添加注释文档 | 无 |
| `explain-code` | 解释代码 | 解释代码逻辑与文档 | 无 |
| `fill-code` | 补全代码 | 填补缺失的代码片段 | 无 |
| `fix-code` | 修复代码 | 修复代码错误 | `input`：错误信息 |
| `language-gpt` | Language-GPT | 提供编程语言专家级见解 | `input`：问题 |
| `suggest-improvements` | 建议代码改进 | 分析代码并提出优化建议 | 无 |
| `transcode` | 跨语言转译 | 在不同编程语言间转换代码 | `language`：目标语言 |

### 🌐 翻译类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `translate` | 翻译 | 在多种语言间互译文本 | `language`：阿拉伯语、中文、荷兰语、英语、菲律宾语、法语、德语、印尼语、意大利语、日语、韩语、葡萄牙语、俄语、西班牙语、越南语 |
| `translate-to-english` | 译为英文 | 将任意语言翻译为英文 | 无 |
| `translate-to-french` | 译为法文 | 将任意语言翻译为法语 | 无 |
| `translate-to-spanish` | 译为西班牙文 | 将任意语言翻译为西班牙语 | 无 |

### 📊 摘要类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `summarize-detailed` | 详尽摘要 | 提供含概览、要点与关键结论的全面摘要 | 无 |
| `summarize-micro` | 微摘要 | 简洁聚焦的摘要 | 无 |
| `summarize-newsletter` | 新闻简报摘要 | 提取新闻简报中的关键更新 | 无 |

### 🔍 提取类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `extract-mails` | 邮箱地址 | 提取电子邮件地址 | 无 |
| `extract-names` | 姓名 | 提取人名 | 无 |
| `extract-any` | 人物/公司 | 提取个人或企业相关信息 | 无 |
| `extract-predictions` | 预测内容 | 提取预测性陈述 | 无 |
| `extract-recommendations` | 建议内容 | 提取建议性内容 | 无 |
| `extract-todo` | 待办任务 | 提取可执行任务 | 无 |
| `extract-trends` | 趋势分析 | 提取趋势性内容 | 无 |
| `extract-wisdom` | 提炼智慧 | 提取洞见与有趣信息 | 无 |

### 📋 格式化类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `format-to-bullet-list` | 项目符号列表 | 将文本转为带项目符号的列表 | 无 |
| `format-to-markdown-checklist` | Markdown 检查清单 | 将文本转为 Markdown 检查清单 | 无 |
| `format-to-markdown-table` | Markdown 表格 | 将文本转为 Markdown 表格 | 无 |
| `format-to-numbered-list` | 编号列表 | 将文本转为编号列表 | 无 |
| `sort-az` | 升序排列（A-Z） | 按字母顺序升序排列 | 无 |
| `sort-za` | 降序排列（Z-A） | 按字母顺序降序排列 | 无 |

### 🎨 创作类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `create-alter-action` | Alter 操作 | 创建 Alter 操作 | `input`：说明 |
| `create-charts` | 图表 | 创建 Recharts 可视化图表 | `input`：说明 |
| `create-diagrams` | 图解 | 生成 Mermaid 图解 | `input`：说明 |
| `create-html` | HTML 页面 | 创建 HTML 页面 | `input`：说明 |
| `create-images` | 图像 | 生成 AI 图像（Flux、Ideogram） | `input`：说明 |
| `create-maps` | 地图 | 创建 LeafletJS 地图 | `input`：说明 |
| `create-presentations` | HTML 演示文稿 | 生成幻灯片演示文稿 | `input`：说明 |
| `create-react-app` | Tailwind React 应用 | 创建 React 应用 | `input`：说明 |

### 🔎 解释类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `analyze-paper` | 分析论文 | 分析学术研究论文 | 无 |
| `explain-selection` | 解释概念 | 以通俗易懂方式解释复杂概念 | 无 |
| `hidden-message` | 隐藏信息 | 揭示文本中隐藏的信息 | 无 |

### 🔀 Git 类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `git-commit` | 提交信息 | 生成 Git 提交信息 | 无 |
| `git-review` | 代码审查 | 审查代码变更 | 无 |
| `git-summarize` | 提交摘要 | 汇总 Git 提交记录 | 无 |
| `pull-request` | 拉取请求 | 创建 PR 描述 | 无 |

### 🧠 协同智能类操作（专家级 GPT）

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `business-strategist-gpt` | 商业战略专家 | 提供商业战略建议 | `input`：问题 |
| `children-educator` | 儿童教育专家 | 提供早期儿童教育指导 | `input`：问题 |
| `e-commerce-strategist-gpt` | 电商战略专家 | 提供电商战略建议 | `input`：问题 |
| `hrmanager-gpt` | 人力资源经理专家 | 提供人力资源管理指导 | `input`：问题 |
| `marketer-gpt` | 营销专家 | 提供营销策略建议 | `input`：问题 |
| `mental-models-gpt` | 思维模型专家 | 提供辅助决策的思维模型 | `input`：问题 |
| `software-architect-gpt` | 软件架构师专家 | 提供软件架构设计指导 | `input`：问题 |

### 💬 通用类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `ask-anything` | 任意提问 | 开放式 AI 对话 | `input`：说明 |
| `ask-web` | 网络搜索 | 带信源引用的网络搜索 | `input`：问题 |

### 📧 邮件类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `mail-draft` | 邮件草稿 | 创建邮件草稿 | `input`：说明 |
| `mail-multi-summary` | 多线程会话摘要 | 汇总多个邮件往来线程 | 无 |
| `mail-reply` | 邮件回复 | 生成邮件回复 | `answerType`：是否有更新？不可用？不清楚？等 |
| `mail-summary` | 邮件线程摘要 | 汇总单个邮件线程 | 无 |

### 📱 社交媒体类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `linkedin-post` | LinkedIn 帖子 | 创建 LinkedIn 帖子 | 无 |
| `linkedin-reply` | LinkedIn 回复 | 生成 LinkedIn 回复 | 无 |
| `twitter-post` | Twitter 帖子 | 创建吸引人的推文 | 无 |
| `twitter-reply` | Twitter 回复 | 生成推文回复 | 无 |
| `twitter-thread` | Twitter 线程 | 创建 Twitter 线程 | 无 |

### 📺 YouTube 类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `youtube-hidden-message` | YouTube 隐藏信息 | 分析视频中隐藏的信息 | 无 |
| `youtube-summarize-detailed` | YouTube 详尽摘要 | 全面的视频摘要 | 无 |
| `youtube-summarize-micro` | YouTube 微摘要 | 快速视频摘要 | 无 |

### 🎯 其他类操作

| 操作 ID | 名称 | 描述 | 参数 |
|---------|------|------|------|
| `create-a-keynote-deck` | 生成 Keynote 幻灯片 | 生成 Keynote 演示文稿 | `input`：说明 |
| `edit-a-keynote-deck` | 编辑 Keynote 幻灯片 | 编辑 Keynote 幻灯片 | `input`：说明 |
| `translate-the-deck` | 翻译演示文稿 | 翻译 Keynote 演示文稿 | `language`：目标语言 |
| `write-presenter-notes` | 撰写演讲者备注 | 创建演讲者备注 | 无 |
| `meeting-scribe` | 会议报告 | 将会议录音转录为纪要 | 无 |
| `spreadsheet-formula` | 电子表格公式 | 创建电子表格公式 | `input`：说明 |
| `user-story` | 用户故事 | 创建敏捷开发用户故事 | 无 |

---

## 分类汇总

| 类别 | 描述 | 操作数量 |
|------|------|----------|
| `code` | 编程与开发 | 8 |
| `writing` | 文本编辑与创作 | 12 |
| `translate` | 语言翻译 | 4 |
| `summarize` | 内容摘要 | 2 |
| `extract` | 信息提取 | 7 |
| `format` | 文本格式化 | 6 |
| `create` | 内容创作 | 8 |
| `explain` | 解释与分析 | 4 |
| `git` | Git 版本控制 | 4 |
| `co-intelligences` | 专家级 AI 助手 | 7 |

---

## 使用示例

### 在 Clawdbot 中调用

```javascript
// Trigger ask-anything with a question
const { triggerAction } = require('./index.js');
triggerAction('ask-anything', 'What is machine learning?');

// Find actions for "translate text"
const { findActions } = require('./index.js');
const matches = findActions('translate text');
console.log(matches[0]); // { id: 'translate', name: 'Translate', ... }

// Build URL without triggering
const { buildCallbackUrl } = require('./index.js');
const url = buildCallbackUrl('translate', null, { language: 'French' });
// -> alter://action/translate?language=French
```

### 在命令行中调用

```bash
# Ask a question
node index.js trigger ask-anything --input "Explain quantum computing"

# Translate with specific language
node index.js trigger translate --param "language=Japanese"

# Fix code with error message
node index.js trigger fix-code --input "TypeError: undefined is not a function"

# Change tone
node index.js trigger change-tone --param "tone=Professional"

# Search for actions
node index.js find "create a chart"

# Get action details
node index.js info create-images
```

---

## 注意事项

- 所有操作均作用于 Alter 当前选中的文本或文件  
- 参数将自动进行 URL 编码  
- 标有 `hasParameters: false` 的操作通常需在 Alter 中预先选中内容  
- 在 macOS 上，使用 `open` 命令触发 x-callback-url  