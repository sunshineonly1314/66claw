---
name: qmd-search
name_zh: QMD搜索
description: 使用 qmd CLI 在本地快速搜索 Markdown 文件、笔记和文档。可替代 `find` 用于文件发现。融合 BM25 全文检索、向量语义搜索与大语言模型（LLM）重排序，全部在本地运行。适用于文件搜索、代码查找、文档定位，或在已索引的集合中发现内容。
description_zh: 使用 qmd CLI 在本地快速搜索 Markdown 文件、笔记和文档。可替代 `find` 用于文件发现。融合 BM25 全文检索、向量语义搜索与大语言模型（LLM）重排序，全部在本地运行。适用于文件搜索、代码查找、文档定位，或在已索引的集合中发现内容。
---
# qmd — 快速本地 Markdown 搜索

## 适用场景

- **查找文件** —— 在大型目录中替代 `find`（避免卡顿挂起）
- **搜索笔记/文档** —— 在已索引的集合中进行语义或关键词搜索
- **代码发现** —— 查找实现、配置或模式
- **上下文收集** —— 在回答问题前提取相关代码片段

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

### 集合（Collections）

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

- `--files` —— 路径 + 相关性得分（用于文件发现）
- `--json` —— 结构化输出，含代码片段
- `--md` —— Markdown 格式化输出
- `-n 10` —— 限制结果数量

## 使用提示

1. **始终使用集合**（`-c name`）来限定搜索范围  
2. **新增文件后务必运行 `qmd update`**  
3. **运行 `qmd embed` 启用向量搜索**（一次性操作，耗时数分钟）  
4. **对于大型目录，优先使用 `qmd search --files`，而非 `find`**

## 模型（自动下载）

- 嵌入模型（Embedding）：embeddinggemma-300M  
- 重排序模型（Reranking）：qwen3-reranker-0.6b  
- 生成模型（Generation）：Qwen3-0.6B  

全部本地运行——无需 API 密钥。