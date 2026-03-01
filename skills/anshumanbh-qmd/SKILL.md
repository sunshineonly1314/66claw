---
name: anshumanbh-qmd
name_zh: QMD文档
description: 使用 qmd 高效搜索 Markdown 知识库。当需要在 Obsidian 仓库或 Markdown 文档集合中查找相关内容时，请使用此 skill，以最小的 token 消耗达成目标。
description_zh: 使用 qmd 高效搜索 Markdown 知识库。当需要在 Obsidian 仓库或 Markdown 文档集合中查找相关内容时，请使用此 skill，以最小的 token 消耗达成目标。
argument-hint: "<搜索查询> [--collection <名称>] [--semantic]"
---
# QMD 搜索 skill

使用 qmd（一种本地索引工具）高效搜索 Markdown 知识库；qmd 结合 BM25 与向量嵌入技术，仅返回相关片段，而非整份文件。

## 为何选用此 skill

- **96% 的 token 节省** —— 返回相关片段，而非读取整份文件  
- **即时响应** —— 内容已预索引，搜索极快  
- **本地化且私密** —— 所有索引与搜索均在本地完成  
- **混合式搜索** —— BM25 实现关键词匹配，向量搜索实现语义相似性匹配  

## 命令

### 搜索（BM25 关键词匹配）
```bash
qmd search "your query" --collection <name>
```  
快速、精准的基于关键词的搜索。适用于特定术语或短语。

### 向量搜索（语义）
```bash
qmd vsearch "your query" --collection <name>
```  
基于语义相似性的搜索。适用于概念性查询，其中措辞可能不固定。

### 混合搜索（二者结合 + 重排序）
```bash
qmd hybrid "your query" --collection <name>
```  
融合两种方法，并通过 LLM 进行重排序。最全面，但通常属于过度设计。

## 使用方法

1. **检查集合是否存在**：  
   ```bash
   qmd collection list
   ```  

2. **搜索该集合**：  
   ```bash
   # For specific terms
   qmd search "api authentication" --collection notes

   # For conceptual queries
   qmd vsearch "how to handle errors gracefully" --collection notes
   ```  

3. **阅读结果**：qmd 返回带文件路径与上下文的相关片段  

## 安装配置（如尚未安装 qmd）

```bash
# Install qmd
bun install -g https://github.com/tobi/qmd

# Add a collection (e.g., Obsidian vault)
qmd collection add ~/path/to/vault --name notes

# Generate embeddings for vector search
qmd embed --collection notes
```  

## 调用示例

```
/qmd api authentication          # BM25 search for "api authentication"
/qmd how to handle errors --semantic   # Vector search for conceptual query
/qmd --setup                     # Guide through initial setup
```  

## 最佳实践

- 对于具体术语、人名或技术关键词，请使用 **BM25 搜索** (`qmd search`)  
- 当查询概念性内容（措辞可能变化）时，请使用 **向量搜索** (`qmd vsearch`)  
- 除非需要极致召回率，否则避免使用混合搜索——它更慢  
- 在添加大量新内容后，请重新运行 `qmd embed`，以保持向量索引最新  

## 参数处理

- `$ARGUMENTS` 包含完整搜索查询  
- 若存在 `--semantic` 标志，则改用 `qmd vsearch`，而非 `qmd search`  
- 若存在 `--setup` 标志，则引导用户完成安装与集合配置  
- 若指定了 `--collection <name>`，则使用该集合；否则默认检查可用集合  

## 工作流

1. 从 `$ARGUMENTS` 解析参数  
2. 检查 qmd 是否已安装 (`which qmd`)  
3. 若未安装，提供安装与配置引导  
4. 若执行搜索：  
   - 若未指定集合，则列出所有可用集合  
   - 执行相应搜索命令  
   - 将结果（含文件路径）呈现给用户  
5. 若用户希望阅读某条具体结果，请对对应文件路径调用 Read 工具