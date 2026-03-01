---
name: x-articles
name_zh: X文章
description: 使用病毒式排版、钩子句式和浏览器自动化创建并发布 X（Twitter）文章。可处理 Draft.js 的特殊行为、嵌入限制及图片上传。
description_zh: 使用病毒式排版、钩子句式和浏览器自动化创建并发布 X（Twitter）文章。可处理 Draft.js 的特殊行为、嵌入限制及图片上传。
version: 1.0.1
---
# X 文章技能

借助经验证的病毒式结构，创建、排版并发布 X（Twitter）上的长文。

## 快速参考

### 内容排版规则（至关重要）

X 文章使用 Draft.js 编辑器，具有如下特定行为：

1. **换行 = 段落分隔** —— 每个换行符都会生成一个带间距的新段落块  
2. **句子必须写在同一行** —— 同一段落中的所有句子须置于单行内  
3. **仅用纯文本，勿用 Markdown** —— X 文章使用富文本，而非 Markdown  
4. **禁用破折号（—）** —— 请替换为冒号，或重写句子  

**错误示例：**  
```
Sentence one.
Sentence two.
Sentence three.
```

**正确示例：**  
```
Sentence one. Sentence two. Sentence three.
```

### 嵌入限制（重要）

**嵌入的推文始终显示在内容块末尾，而非内联位置。**

应对方案：
- 在文中结构化地提示“参见下方推文”  
- 接受视觉流顺序：正文 → 正文 → 嵌入内容置于底部  
- 使用 `Insert > Posts` 菜单（切勿直接粘贴 URL）

### 图片规格

| 类型 | 宽高比 | 推荐尺寸 |
|------|--------|----------|
| 封面/页首图 | 5:2 | 1792×716 或相近尺寸 |
| 行内图片 | 16:9 或 4:3 | 1792×1024（DALL-E HD） |

## 病毒式文章结构

### 模板

```
HOOK (hit insecurity or opportunity)

WHAT IT IS (1-2 paragraphs with social proof)

WHY MOST PEOPLE WON'T DO IT (address objections)

THE [X]-MINUTE GUIDE
- Step 1 (time estimate)
- Step 2 (time estimate)
- ...

YOUR FIRST [N] WINS (immediate value)
- Win 1: copy-paste example
- Win 2: copy-paste example

THE COST (value comparison)

WHAT TO DO AFTER (next steps)

THE WINDOW (urgency)

CTA (soft or hard)
```

### 行之有效的钩子句式

**不安全感 / 错失恐惧（FOMO）：**  
```
everyone's talking about X... and you're sitting there wondering if you missed the window
```

**重大机遇：**  
```
this is the biggest opportunity of our lifetime
```

**新闻钩子：**  
```
X just open sourced the algo. Here's what it means for you:
```

**RIP 句式：**  
```
RIP [profession]. This AI tool will [action] in seconds.
```

**WTF 句式：**  
```
WTF!! This AI Agent [does amazing thing]. Here's how:
```

**个人故事：**  
```
When I was young, I was always drawn to people who...
```

### 行动号召（CTA）句式

**强 CTA（互动诱饵）：**  
```
RT + follow + reply 'KEYWORD' and I'll send the cheat sheet
```

**软 CTA：**  
```
If you take this advice and build something, let me know!
```

**简洁型：**  
```
Feel free to leave a like and RT if this helped.
```

## 风格指南

### Damian Player 风格（战术型）
- 全小写（刻意为之）  
- 紧迫、务实的语调  
- 字数 ≥1500  
- 大量分步细节  
- 强 CTA + 附赠资源（lead magnet）

### Alex Finn 风格（激励型）
- 标准大小写  
- 温暖、鼓舞人心的语调  
- 字数 800–1200  
- WHY（为何）与 HOW（如何）兼备  
- 软 CTA + 产品链接

### Dan Koe 风格（哲思型）
- 长篇散文（≥2000 字）  
- 以个人叙事开篇  
- 提出命名框架（如“金字塔原理”）  
- 深度教学，不止于技巧  
- 新闻简报式 CTA

## 应避免的常见错误

- 文章过短（少于 500 字）  
- 罗列事实而缺乏故事性或情感  
- 缺乏清晰章节或标题  
- 未预判并回应用户异议  
- 未设置“即时收获”章节  
- 无行动号召（CTA）  
- 使用泛泛而谈、AI 腔调的语言  
- 处处滥用破折号（—）  
- 过度使用表情符号  
- 直接粘贴推文 URL，而非使用插入菜单

## 浏览器自动化（agent-browser）

### 前置条件
- clawd 浏览器正在 CDP 端口 18800 上运行  
- 已在该浏览器中登录 X（Twitter）

### 导航至文章编辑器
```bash
# Open new article
agent-browser --cdp 18800 navigate "https://x.com/compose/article"

# Take snapshot to see current state
agent-browser --cdp 18800 snapshot
```

### 粘贴内容
```bash
# Put content in clipboard
cat article.txt | pbcopy

# Click content area, select all, paste
agent-browser --cdp 18800 click '[contenteditable="true"]'
agent-browser --cdp 18800 press "Meta+a"
agent-browser --cdp 18800 press "Meta+v"
```

### 上传封面图
```bash
# Upload to file input
agent-browser --cdp 18800 upload 'input[type="file"]' /path/to/cover.png

# Wait for Edit media dialog, click Apply
agent-browser --cdp 18800 snapshot | grep -i apply
agent-browser --cdp 18800 click @e5  # Apply button ref
```

### 发布
```bash
# Find and click Publish button
agent-browser --cdp 18800 snapshot | grep -i publish
agent-browser --cdp 18800 click @e35  # Publish button ref

# Confirm in dialog
agent-browser --cdp 18800 click @e5   # Confirm
```

### 清理（重要！）
```bash
# Close tab after publishing
agent-browser --cdp 18800 tab list
agent-browser --cdp 18800 tab close 1
```

### 故障排查：陈旧元素引用（Stale Element Refs）

若点击失败（因元素引用已失效），请使用 JS evaluate：  
```bash
agent-browser --cdp 18800 evaluate "(function() { 
  const btns = document.querySelectorAll('button'); 
  for (let btn of btns) { 
    if (btn.innerText.includes('Publish')) { 
      btn.click(); 
      return 'clicked'; 
    } 
  } 
  return 'not found'; 
})()"
```

## 内容准备脚本

### 将 Markdown 转换为 X 友好格式

```bash
# scripts/format-for-x.sh
#!/bin/bash
# Converts markdown to X Articles format

INPUT="$1"
OUTPUT="${2:-${INPUT%.md}-x-ready.txt}"

cat "$INPUT" | \
  # Remove markdown headers, keep text
  sed 's/^## /\n/g' | \
  sed 's/^### /\n/g' | \
  sed 's/^# /\n/g' | \
  # Remove markdown bold/italic
  sed 's/\*\*//g' | \
  sed 's/\*//g' | \
  # Remove em dashes
  sed 's/ — /: /g' | \
  sed 's/—/:/g' | \
  # Join lines within paragraphs (keeps blank lines as separators)
  awk 'BEGIN{RS=""; FS="\n"; ORS="\n\n"} {gsub(/\n/, " "); print}' \
  > "$OUTPUT"

echo "Created: $OUTPUT"
```

## 发布前检查清单

- [ ] 首行钩子即抓人眼球  
- [ ] 早期即回应潜在异议  
- [ ] 分步说明含时间预估  
- [ ] 包含“即时收获”章节  
- [ ] 文末设有 CTA  
- [ ] 无破折号（—）  
- [ ] 所有句子均置于单行内  
- [ ] 封面图宽高比为 5:2  
- [ ] 嵌入内容标注为“参见下方”  
- [ ] 已校对，剔除 AI 腔调语言  

## 可转发推文式金句模板

用于推广您的文章：

**成果 + 成本：**  
```
I gave an AI agent full access to my MacBook. It checks email, manages calendar, pushes code. Costs $20/month. A VA costs $2000.
```

**你无需 X：**  
```
You don't need a Mac Mini. You don't need a server. I'm running my AI agent on an old MacBook Air from a drawer.
```

**缺口警示：**  
```
The gap between 'has AI agent' and 'doesn't' is about to get massive. I set mine up in 15 minutes.
```

**紧迫感：**  
```
Most people will bookmark this and never set it up. Don't be most people. The window is closing.
```

## 示例工作流

1. **撰写文章**：以 Markdown 编写，结构清晰  
2. **运行格式化脚本**：转换为 X 友好的纯文本  
3. **生成封面图**：使用 DALL-E（1792×716 或 5:2 宽高比）  
4. **通过浏览器自动化打开 X 文章编辑器**  
5. **粘贴内容**，并在编辑器中手动添加章节标题  
6. **通过文件输入上传封面图**  
7. **在章节分隔处添加行内图片**  
8. **插入嵌入内容**（将自动显示于底部）  
9. **预览并校对全文**  
10. **发布**  
11. **发布宣传推文**：含钩子句 + 文章链接  

## 相关 Skills

- `bird` —— X/Twitter 命令行工具，用于发布推文  
- `de-ai-ify` —— 去除文本中 AI 风格术语  
- `ai-pdf-builder` —— 生成 PDF（用于附赠资源）  