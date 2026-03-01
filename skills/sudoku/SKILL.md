---
name: sudoku
name_zh: 数独
description: 获取数独谜题并以 JSON 格式保存至工作区；按需渲染图像；后续可揭晓答案。
description_zh: 获取数独谜题并以 JSON 格式保存至工作区；按需渲染图像；后续可揭晓答案。
repository: https://github.com/odrobnik/sudoku-skill
metadata:
  clawdbot:
    emoji: "🧩"
    requires:
      bins: ["python3", "node"]
---
# 数独

## 概览  

获取、渲染与揭晓数独谜题。使用 `sudoku.py` 从 `sudokuonline.io` 获取新谜题，生成可打印的 PDF 或图像，并揭晓答案。

关于已保存 JSON 格式的详细说明，请参阅 [DATA_FORMAT.md](references/DATA_FORMAT.md)。

## 可用谜题类型  

*   `kids4n`：儿童 4×4  
*   `kids4l`：儿童 4×4（字母版）  
*   `kids6`：儿童 6×6  
*   `kids6l`：儿童 6×6（字母版）  
*   `easy9`：经典 9×9（简单）  
*   `medium9`：经典 9×9（中等）  
*   `hard9`：经典 9×9（困难）  
*   `evil9`：经典 9×9（极难）  

## 获取谜题  

获取新谜题并以 JSON 格式保存。默认输出为 JSON（如需人类可读格式，请使用 `--text`）。

**获取一道经典简单难度谜题：**  
```bash
./scripts/sudoku.py get easy9
```  

**获取一道儿童 6×6 谜题：**  
```bash
./scripts/sudoku.py get kids6
```  

## 渲染谜题  

将谜题渲染为图像或 PDF。

**将最新谜题渲染为 A4 PDF（用于打印）：**  
```bash
./scripts/sudoku.py render --pdf
```  

**将最新谜题渲染为清晰 PNG（用于查看）：**  
```bash
./scripts/sudoku.py render
```  

**通过短 ID 渲染某个历史谜题：**  
```bash
./scripts/sudoku.py render --id a09f3680
```  

## 揭晓答案  

揭晓最新谜题或指定谜题的答案。使用 `--id <short_id>`（例如 `a09f3680`）可指定目标谜题。

**以可打印 PDF 形式揭晓完整答案：**  
```bash
./scripts/sudoku.py reveal --pdf
```  

**为指定 ID 的谜题揭晓完整答案：**  
```bash
./scripts/sudoku.py reveal --id a09f3680 --image
```  

**以 PNG 图像形式揭晓完整答案：**  
```bash
./scripts/sudoku.py reveal
```  

**揭晓单个单元格（第 3 行，第 7 列）的答案：**  
```bash
./scripts/sudoku.py reveal --cell 3 7
```  

**揭晓特定 3×3 宫格（索引为 5）的答案：**  
```bash
./scripts/sudoku.py reveal --box 5
```  

## 分享链接  

为已存储的谜题生成分享链接。默认作用于最新谜题；如需指定其他谜题，请使用 `--id <short_id>`。

**生成 SudokuPad 分享链接（默认）：**  
```bash
./scripts/sudoku.py share
```  

**为指定 ID 生成分享链接：**  
```bash
./scripts/sudoku.py share --id a09f3680
```  

**生成 SCL 分享链接：**  
```bash
./scripts/sudoku.py share --type scl
```  

**Telegram 排版小贴士：**  
将链接格式化为简洁按钮式链接，并隐藏完整 URL：`[Easy Classic \[<id>\]](<url>)`。