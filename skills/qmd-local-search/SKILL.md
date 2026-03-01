---
name: qmd-local-search
name_zh: QMD本地搜索
description: 使用 qmd CLI 工具对 Markdown 文件、笔记和文档执行快速本地搜索。在文件发现场景中替代 `find`。融合 BM25 全文搜索、向量语义搜索与 LLM 重排序——全部本地运行。适用于文件查找、代码定位、文档检索，或在已索引集合中发现相关内容。
description_zh: 使用 qmd CLI 工具对 Markdown 文件、笔记和文档执行快速本地搜索。在文件发现场景中替代 `find`。融合 BM25 全文搜索、向量语义搜索与 LLM 重排序——全部本地运行。适用于文件查找、代码定位、文档检索，或在已索引集合中发现相关内容。
---
# qmd — 快速本地 Markdown 搜索

## 使用场景

- **查找文件** —— 替代 `find` 在大型目录中遍历（避免卡顿挂起）
- **搜索笔记/文档** —— 在已索引集合中执行语义或关键词搜索
- **代码发现** —— 查找实现、配置或模式
- **上下文收集** —— 在回答问题前拉取相关代码片段

## 快速参考

### 搜索（最常用）

```bash
# Keyword search (BM25)
qmd search "alpaca API" -c projects

# Semantic search (understands meaning)
qmd vsearch "how to implement stop loss"

# Combined search with reranking (best quality)
qmd query "trading rules for breakouts"

# File paths only (fast discovery)
qmd search "config" --files -c kell

# Full document content
qmd search "pattern detection" --full --line-numbers
```

### 集合管理

```bash
# List collections
qmd collection list

# Add new collection
qmd collection add /path/to/folder --name myproject --mask "*.md,*.py"

# Re-index after changes
qmd update
```

### 获取文件

```bash
# Get full file
qmd get myproject/README.md

# Get specific lines
qmd get myproject/config.py:50 -l 30

# Get multiple files by glob
qmd multi-get "*.yaml" -l 50 --max-bytes 10240
```

### 输出格式

- `--files` —— 返回路径与得分（适用于文件发现）
- `--json` —— 结构化输出，含代码片段
- `--md` —— Markdown 格式化输出
- `-n 10` —— 限制返回结果数量

## 使用技巧

1. **始终使用集合**（`-c name`）来限定搜索范围  
2. **新增文件后运行 `qmd update`**  
3. **使用 `qmd embed` 启用向量搜索**（一次性操作，耗时数分钟）  
4. **在大型目录中优先使用 `qmd search --files`**，而非 `find`  

## 模型（自动下载）

- 嵌入模型：embeddinggemma-300M  
- 重排序模型：qwen3-reranker-0.6b  
- 生成模型：Qwen3-0.6B  

全部本地运行——无需 API 密钥。