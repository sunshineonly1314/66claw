---
name: pymupdf-pdf
name_zh: PDF解析
description: 使用 PyMuPDF（fitz）进行快速本地 PDF 解析，支持输出为 Markdown/JSON 格式，并可选提取图像与表格。当速度比鲁棒性更重要时使用，或作为重量级解析器不可用时的备用方案。默认采用单 PDF 解析模式，每个文档生成独立的输出目录。
description_zh: 使用 PyMuPDF（fitz）进行快速本地 PDF 解析，支持输出为 Markdown/JSON 格式，并可选提取图像与表格。当速度比鲁棒性更重要时使用，或作为重量级解析器不可用时的备用方案。默认采用单 PDF 解析模式，每个文档生成独立的输出目录。
---
# PyMuPDF PDF

## 概述
使用 PyMuPDF 在本地解析 PDF，以实现快速、轻量级的内容提取；默认输出为 Markdown，同时可选输出 JSON 以及图像/表格，所有输出均存放在按文档划分的独立目录中。

## 先决条件 / 何时查阅参考文档
若遇到导入错误（PyMuPDF 未安装）或 Nix `libstdc++` 相关问题，请参阅：
- `references/pymupdf-notes.md`

## 快速开始（单个 PDF）
```bash
# Run from the skill directory
./scripts/pymupdf_parse.py /path/to/file.pdf \
  --format md \
  --outroot ./pymupdf-output
```

## 选项
- `--format md|json|both`（默认值：`md`）
- `--images`：提取图像
- `--tables`：提取简易的基于行的表格 JSON（快速/粗略）
- `--outroot DIR`：更改输出根目录
- `--lang`：在 JSON 输出的元数据中添加语言提示

## 输出约定
- 默认创建 `./pymupdf-output/<pdf-basename>/`。
- Markdown 输出：`output.md`
- JSON 输出：`output.json`（包含 `lang`）
- 图像：`images/` 子目录
- 表格：`tables.json`（基于行的粗略提取）

## 注意事项
- PyMuPDF 速度快，但在处理复杂 PDF 时鲁棒性较低。
- 如需更高鲁棒性的解析，请在已安装的情况下使用重型 OCR 解析器（例如 MinerU）。