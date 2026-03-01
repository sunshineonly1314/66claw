---
name: pptx-creator
name_zh: PPTX 创建器
description: 依据大纲、数据源或 AI 生成内容创建专业级 PowerPoint 演示文稿。支持自定义模板、样式预设、基于数据生成图表／表格，以及 AI 生成图片。当被要求创建幻灯片、路演材料（pitch decks）、报告或演示文稿时使用。
description_zh: 依据大纲、数据源或 AI 生成内容创建专业级 PowerPoint 演示文稿。支持自定义模板、样式预设、基于数据生成图表／表格，以及 AI 生成图片。当被要求创建幻灯片、路演材料（pitch decks）、报告或演示文稿时使用。
homepage: https://python-pptx.readthedocs.io
metadata: {"clawdbot":{"emoji":"📽️","requires":{"bins":["uv"]}}}
---
# PowerPoint 创建器

依据大纲、主题或数据源创建专业级演示文稿。

## 快速入门

### 从大纲／Markdown 创建
```bash
uv run {baseDir}/scripts/create_pptx.py --outline outline.md --output deck.pptx
```

### 从主题创建
```bash
uv run {baseDir}/scripts/create_pptx.py --topic "Q4 Sales Review" --slides 8 --output review.pptx
```

### 使用样式模板创建
```bash
uv run {baseDir}/scripts/create_pptx.py --outline outline.md --template corporate --output deck.pptx
```

### 从 JSON 结构创建
```bash
uv run {baseDir}/scripts/create_pptx.py --json slides.json --output deck.pptx
```

## 大纲格式（Markdown）

```markdown
# Presentation Title
subtitle: Annual Review 2026
author: Your Name

## Introduction
- Welcome and agenda
- Key objectives for today
- ![image](generate: modern office building, minimalist style)

## Market Analysis
- chart: bar
- data: sales_by_region.csv
- Market grew 15% YoY
- Strong competitive position

## Financial Summary
- table: quarterly_results
- Strong Q4 performance
- Revenue targets exceeded
```

## JSON 结构

```json
{
  "title": "Quarterly Review",
  "subtitle": "Q4 Performance",
  "author": "Your Name",
  "template": "corporate",
  "slides": [
    {
      "title": "Introduction",
      "layout": "title_and_content",
      "bullets": ["Welcome", "Agenda", "Goals"],
      "notes": "Speaker notes here"
    },
    {
      "title": "Revenue Chart",
      "layout": "chart",
      "chart_type": "bar"
    },
    {
      "title": "Team",
      "layout": "image_and_text",
      "image": "generate: professional team collaboration, corporate style",
      "bullets": ["Leadership", "Sales", "Operations"]
    }
  ]
}
```

## 内置样式模板

- `minimal` — 简洁白底，Helvetica Neue 字体，蓝色强调色（默认）  
- `corporate` — 专业蓝调，Arial 字体，商务就绪  
- `creative` — 大胆橙色强调色，Avenir 字体，现代风格  
- `dark` — 深色背景，SF Pro 字体，青色强调色  
- `executive` — 金色强调色，Georgia／Calibri 字体，典雅精致  
- `startup` — 紫色强调色，Poppins／Inter 字体，专为路演材料优化  

### 生成全部模板
```bash
uv run {baseDir}/scripts/create_template.py --all
```

### 列出可用模板
```bash
uv run {baseDir}/scripts/create_pptx.py --list-templates
```

## 自定义模板

### 将现有 PPTX 文件保存为模板
```bash
uv run {baseDir}/scripts/create_pptx.py --save-template "my-brand" --from existing.pptx
```

### 分析模板结构
```bash
uv run {baseDir}/scripts/analyze_template.py existing.pptx
uv run {baseDir}/scripts/analyze_template.py existing.pptx --json
```

### 基于自定义模板构建演示文稿
```bash
uv run {baseDir}/scripts/use_template.py \
  --template my-brand \
  --slides content.json \
  --keep-slides 2 \
  --output presentation.pptx
```

## 数据源

### CSV／Excel 文件
```markdown
## Regional Sales
- chart: pie
- data: sales.csv
- columns: region, revenue
```

### 内联数据（Inline Data）
```markdown
## Quarterly Comparison
- chart: bar
- data:
  - Q1: 120
  - Q2: 145  
  - Q3: 132
  - Q4: 178
```

## 图片生成

使用兼容的图像生成 skills 在线生成图片：

```markdown
## Our Vision
- ![hero](generate: futuristic cityscape, clean energy, optimistic)
- Building tomorrow's solutions
```

或通过 JSON 方式指定：
```json
{
  "title": "Innovation",
  "image": {
    "generate": "abstract technology visualization, blue tones",
    "position": "right",
    "size": "half"
  }
}
```

## 版式（Layouts）

- `title` — 标题页  
- `title_and_content` — 标题 + 项目符号列表（默认）  
- `two_column` — 左右并列内容  
- `image_and_text` — 图片配文字  
- `chart` — 全图图表页  
- `table` — 数据表格页  
- `section` — 章节分隔页  
- `blank` — 空白页（供自定义内容使用）  

## 图表类型

- `bar` / `bar_stacked`  
- `column` / `column_stacked`  
- `line` / `line_markers`  
- `pie` / `doughnut`  
- `area` / `area_stacked`  
- `scatter`  

## 示例

### 路演材料（Pitch Deck）
```bash
uv run {baseDir}/scripts/create_pptx.py \
  --topic "Series A pitch for tech startup" \
  --slides 10 \
  --template startup \
  --output pitch-deck.pptx
```

### 高管报告（Executive Report）
```bash
uv run {baseDir}/scripts/create_pptx.py \
  --outline report.md \
  --template executive \
  --output board-report.pptx
```

### 市场营销演示（Marketing Presentation）
```bash
uv run {baseDir}/scripts/create_pptx.py \
  --outline campaign.md \
  --template creative \
  --output marketing-deck.pptx
```