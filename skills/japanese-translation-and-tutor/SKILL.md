---
name: japanese-translation-and-tutor
name_zh: 日语翻译与辅导
description: "日英互译与语言辅导工具。适用场景：（1）用户提供日文文本并请求翻译（新闻、推文、路牌、菜单、邮件等）；（2）用户询问日语词汇/短语含义（如‘X 是什么意思’）；（3）用户希望学习日语语法、词汇或文化背景；（4）触发关键词包括：‘translate’（翻译）、‘what does this say’（这句话怎么说）、‘Japanese to English’（日语转英语）、‘help me understand’（帮我理解）、‘explain this kanji’（解释这个汉字）。输出结构化结果，含假名注音、词汇表及文化注释。"
description_zh: 日英互译与语言辅导工具。适用场景：（1）用户提供日文文本并请求翻译（新闻、推文、路牌、菜单、邮件等）；（2）用户询问日语词汇/短语含义（如‘X 是什么意思’）；（3）用户希望学习日语语法、词汇或文化背景；（4）触发关键词包括：‘translate’（翻译）、‘what does this say’（这句话怎么说）、‘Japanese to English’（日语转英语）、‘help me understand’（帮我理解）、‘explain this kanji’（解释这个汉字）。输出结构化结果，含假名注音、词汇表及文化注释。
---
# 日英翻译与语言辅导工具

融合精准翻译与语言教学功能。输出结构化译文，包含假名注音、词汇解析及文化背景说明。

## 输出格式

```
*TRANSLATION*

[English translation]


*READING*

[Original with kanji readings: 漢字(かんじ)]


*VOCABULARY*

• word(reading) — _meaning_


*NOTES*

[Cultural context, grammar, nuances]
```

## 关键规则：汉字假名注音

每个汉字**必须**在其后括号内标注平假名读音。无例外。

```
✓ 日本語(にほんご)を勉強(べんきょう)する
✗ 日本語を勉強する
```

## 翻译原则

- **重达意，轻字面** —— 传达原意，而非逐字直译  
- **匹配语体** —— 保留原文正式程度（敬语/郑重语/随意语）  
- **文化适配** —— 解释无法直接翻译的语义与文化内涵  
- **习语处理** —— 提供对应中文习语，或解释日语谚语（ことわざ）含义  

## 示例

输入：`今日は暑いですね`

```
*TRANSLATION*

It's hot today, isn't it?


*READING*

今日(きょう)は暑(あつ)いですね


*VOCABULARY*

• 今日(きょう) — _today_
• 暑い(あつい) — _hot (weather)_


*NOTES*

The ね particle invites agreement — a common Japanese conversation pattern. 丁寧語(ていねいご) (polite form) with です.
```

## 平台适配格式

- **Slack / Discord**：按示例使用 `*BOLD*` 和 `_italic_`  
- **纯文本环境（如 iMessage）**：标题使用全大写，不使用 Markdown  

## 交互风格

- 若上下文影响翻译（如正式 vs 随意、商务 vs 私人），主动询问确认  
- 明确指出歧义点，并提供多种译法备选  
- 用户提出深入语法讲解请求时，予以详尽解释  