---
name: substack-formatter
name_zh: Substack 格式化
description: 将纯文本转换为带正确 HTML 格式的 Substack 文章格式，便于复制粘贴至 Substack 编辑器。
description_zh: 将纯文本转换为带正确 HTML 格式的 Substack 文章格式，便于复制粘贴至 Substack 编辑器。
---
# Substack 文章格式化工具

## 概述  
将纯文本转换为专业的 Substack 格式。处理所有技术性格式细节，确保加粗/斜体/标题在粘贴至 Substack 编辑器后能正确显示。

## 该 skills 的功能
- ✅ **为 Substack 格式化文本**：具备规范的结构与合理间距  
- ✅ **转换为 Substack 编辑器可识别的 HTML 格式**  
- ✅ **保留原始内容**：仅调整视觉呈现，不改动语义  
- ✅ **确保复制粘贴效果可靠**：加粗、斜体、标题、项目符号均完整保留  

## 技术方案  
**问题：** Substack 编辑器将原始 Markdown 视为纯文本  
**解决方案：** 转换为 HTML，并以 `text/html` 格式复制  

## 使用方法  

### 基础格式化  
```
Format this for Substack:
[Your plain text content here]
```  

### 启用极简格式化  
```
Format for Substack (minimal):
[Your plain text content here]
```  

## 格式化选项  

### **标准格式**  
- 规范的段落结构  
- 清晰简洁的 HTML 输出  
- 内容完整保留，同时提升可读性  

### **极简格式**  
- 仅优化空白与间距  
- 不改变任何强调样式（如加粗、斜体）  
- 严格保持原始内容一字不差  

## 格式化特性  

### **结构层面**  
- **段落清晰**：提升整体可读性  
- **节间间距合理**：增强内容组织感  
- **视觉层级分明**：突出主次关系  

### **HTML 输出规范**  
- **加粗文本：** 使用 `<strong>` 标签  
- **强调文本：** 使用 `<em>` 标签  
- **标题：** 使用 `<h2>`、`<h3>` 等标签划分章节  
- **列表：** 使用 `<ul><li>` 表示无序列表，`<ol><li>` 表示有序列表  
- **段落：** 采用规范的 `<p>` 标签结构  

## 复制粘贴流程  

1. **运行格式化器** → 获取 HTML 输出  
2. **调用内置复制脚本** → 以 `text/html` 格式复制到剪贴板  
3. **粘贴至 Substack** → 格式完美保留  
4. **无需手动调整** → 加粗、斜体、标题等功能自动生效  

## 示例  

### 输入（纯文本）：  
```
I used to think being productive meant doing more things. Last week I tried something different. I did fewer things but focused completely on each one. The result was surprising. I got more done in less time and felt less stressed. Sometimes the answer isn't addition, it's subtraction.
```  

### 输出（适配 Substack 的格式化结果）：  
```html
<p><strong>I used to think being productive meant doing more things.</strong></p>

<p>Last week I tried something different:</p>

<p>I did fewer things.<br>
But focused completely on each one.</p>

<p>The result was surprising.</p>

<p><em>I got more done in less time and felt less stressed.</em></p>

<p><strong>Sometimes the answer isn't addition, it's subtraction.</strong></p>

<p>What's one thing you could subtract from your routine?</p>
```  

## 包含工具  

- **`formatter.py`** — 主格式化脚本  
- **`copy_to_substack.py`** — 执行 HTML 转换并正确复制  
- **`test_formatter.py`** — 使用示例进行测试  
- **各类结构对应的示例与模板**  

## 设计理念  
**为可读性而格式化，为你的话语风格而留白。** 本工具提升视觉呈现效果，同时完整保留你的核心信息与个人风格。