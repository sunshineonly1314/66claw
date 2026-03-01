---
name: markdown-converter
name_zh: Markdown转换器
description: 使用 markitdown 将文档和文件转换为 Markdown 格式。适用于将 PDF、Word（.docx）、PowerPoint（.pptx）、Excel（.xlsx、.xls）、HTML、CSV、JSON、XML、含 EXIF/OCR 信息的图像、含转录文本的音频、ZIP 压缩包、YouTube 网址或 EPub 文件转换为 Markdown，以便供 LLM 处理或文本分析。
description_zh: 使用 markitdown 将文档和文件转换为 Markdown 格式。适用于将 PDF、Word（.docx）、PowerPoint（.pptx）、Excel（.xlsx、.xls）、HTML、CSV、JSON、XML、含 EXIF/OCR 信息的图像、含转录文本的音频、ZIP 压缩包、YouTube 网址或 EPub 文件转换为 Markdown，以便供 LLM 处理或文本分析。
---
# Markdown 转换器

使用 `uvx markitdown` 将文件转换为 Markdown —— 无需安装。

## 基本用法

```bash
# Convert to stdout
uvx markitdown input.pdf

# Save to file
uvx markitdown input.pdf -o output.md
uvx markitdown input.docx > output.md

# From stdin
cat input.pdf | uvx markitdown
```

## 支持的格式

- **文档**：PDF、Word（.docx）、PowerPoint（.pptx）、Excel（.xlsx、.xls）  
- **网页/数据**：HTML、CSV、JSON、XML  
- **媒体**：图像（EXIF + OCR）、音频（EXIF + 转录）  
- **其他**：ZIP（遍历内容）、YouTube 网址、EPub  

## 选项

```bash
-o OUTPUT      # Output file
-x EXTENSION   # Hint file extension (for stdin)
-m MIME_TYPE   # Hint MIME type
-c CHARSET     # Hint charset (e.g., UTF-8)
-d             # Use Azure Document Intelligence
-e ENDPOINT    # Document Intelligence endpoint
--use-plugins  # Enable 3rd-party plugins
--list-plugins # Show installed plugins
```

## 示例

```bash
# Convert Word document
uvx markitdown report.docx -o report.md

# Convert Excel spreadsheet
uvx markitdown data.xlsx > data.md

# Convert PowerPoint presentation
uvx markitdown slides.pptx -o slides.md

# Convert with file type hint (for stdin)
cat document | uvx markitdown -x .pdf > output.md

# Use Azure Document Intelligence for better PDF extraction
uvx markitdown scan.pdf -d -e "https://your-resource.cognitiveservices.azure.com/"
```

## 注意事项

- 输出保留原始文档结构：标题、表格、列表、链接  
- 首次运行会缓存依赖项；后续运行速度更快  
- 对于提取效果较差的复杂 PDF，请配合 Azure Document Intelligence 使用 `-d`  