---
name: de-ai-ify
name_zh: 去AI化
description: 清除 AI 生成文本中的术语堆砌，还原自然的人类表达风格
description_zh: 清除 AI 生成文本中的术语堆砌，还原自然的人类表达风格
version: 1.0.0
author: theflohart
tags: [写作, 编辑, 语气, AI 检测]
---
# 去 AI 化（De-AI-ify）文本

清除 AI 生成文本中的典型模式，让您的文字回归自然、真实的人类表达风格。

## 使用方式

```
/de-ai-ify <file_path>
```

## 清除内容

### 1. 过度使用的过渡词

- “此外（Moreover）”、“而且（Furthermore）”、“另外（Additionally）”、“然而（Nevertheless）”  
- 过度使用“但是（However）”  
- 以“虽然 X，但 Y（While X, Y）”开头的句式  

### 2. AI 套话

- “在当今这个快节奏的世界里（In today's fast-paced world）”  
- “让我们深入探讨（Let's dive deep）”  
- “释放您的潜能（Unlock your potential）”  
- “充分利用……的力量（Harness the power of）”  

### 3. 模糊弱化的表达（Hedging Language）

- “需要指出的是（It's important to note）”  
- “值得一提的是（It's worth mentioning）”  
- 模糊量化词：“各种（various）”、“大量（numerous）”、“无数（myriad）”  

### 4. 企业黑话（Corporate Buzzwords）

- “utilize” → 替换为 “use”（使用）  
- “facilitate” → 替换为 “help”（帮助）  
- “optimize” → 替换为 “improve”（改进）  
- “leverage” → 替换为 “use”（使用）  

### 5. 机械式表达模式（Robotic Patterns）

- 提出修辞性问题后立即给出答案  
- 过度追求排比结构  
- 总是严格列举恰好三项内容  
- 特意声明“重点强调……”  

## 补充内容

### 自然的人类语气

- 句子长度富于变化  
- 采用对话式语调  
- 多用直接陈述句  
- 使用具体实例  

### 人类语言的节奏感

- 过渡自然流畅  
- 表达自信笃定  
- 带有个人视角  
- 用词真实可信  

## 处理流程

1. **读取原始文件**  
2. **创建副本，文件名添加 “-HUMAN” 后缀**  
3. **执行去 AI 化处理**  
4. **生成修改日志（change log）**  

## 输出结果

您将获得：

- 一份语气自然、富有“人味”的新文件  
- 修改日志，清晰列出各项修正  
- 需补充具体实例的位置清单  

## 示例改写

**改写前（AI 风格）：** “在当今这个快速演进的数字生态中，深刻理解如何高效‘利用’人工智能，绝不仅仅关乎采用前沿技术——更在于‘释放’其变革性潜力，从而‘开启’前所未有的机遇之门。”  

**改写后（人类风格）：** “AI 在特定任务上效果最佳：编写代码、分析数据、回答问题。聚焦它真正擅长的事。”  