---
name: qmd-external
name_zh: QMD外链
description: 面向 Markdown 笔记与文档的本地混合搜索工具。适用于搜索笔记、查找相关内容，或从已索引的集合中检索文档。
description_zh: 面向 Markdown 笔记与文档的本地混合搜索工具。适用于搜索笔记、查找相关内容，或从已索引的集合中检索文档。
homepage: https://github.com/tobi/qmd
metadata: {"clawdbot":{"emoji":"🔍","os":["darwin","linux"],"requires":{"bins":["qmd"]},"install":[{"id":"bun-qmd","kind":"download","command":"bun install -g https://github.com/tobi/qmd","bins":["qmd"],"label":"Install qmd via Bun"}]}}
---
# qmd - Quick Markdown Search（快速 Markdown 搜索）

面向 Markdown 笔记、文档与知识库的本地搜索引擎。一次索引，快速搜索。

## 使用场景（触发短语）

- “搜索我的笔记 / 文档 / 知识库”
- “查找相关笔记”
- “从我的集合中检索一份 Markdown 文档”
- “搜索本地 Markdown 文件”

## 默认行为（重要）

- 优先使用 `qmd search`（BM25）。该模式通常瞬时响应，应作为默认选项。
- 仅当关键词搜索失败且需要语义相似性时，才使用 `qmd vsearch`（向量搜索）；冷启动时可能非常缓慢。
- 除非用户明确要求最高质量的混合结果且能容忍长时间运行/超时，否则应避免使用 `qmd query`（混合搜索 + LLM 重排序）。

## 先决条件

- Bun >= 1.0.0
- macOS：`brew install sqlite`（SQLite 扩展）
- 确保 PATH 包含：`$HOME/.bun/bin`

macOS 安装 Bun：`brew install oven-sh/bun/bun`

## 安装

`bun install -g https://github.com/tobi/qmd`

## 配置

```bash
qmd collection add /path/to/notes --name notes --mask "**/*.md"
qmd context add qmd://notes "Description of this collection"  # optional
qmd embed  # one-time to enable vector + hybrid search
```

## 索引范围

- 主要面向 Markdown 集合（常见路径如 `**/*.md`）。
- 实测表明，“非规范”Markdown 亦可良好处理：分块策略基于内容（每块约数百 token），而非严格依赖标题或结构。
- 不用于替代代码搜索；针对代码仓库/源码树，请使用专用代码搜索工具。

## 搜索模式

- `qmd search`（默认）：快速关键词匹配（BM25）
- `qmd vsearch`（最后手段）：语义相似性搜索（向量）。常因向量查询前需加载本地大语言模型（如 Qwen3-1.7B）至内存而变慢。
- `qmd query`（通常跳过）：混合搜索 + LLM 重排序。通常比 `vsearch` 更慢，且交互式使用时更易超时。

## 性能说明

- `qmd search` 通常瞬时完成。
- `qmd vsearch` 在某些机器上可能耗时约 1 分钟，原因在于查询扩展阶段可能每次运行都需将本地模型（如 Qwen3-1.7B）加载进内存；而向量查找本身通常很快。
- `qmd query` 在 `vsearch` 基础上额外增加 LLM 重排序，因此可能更慢、对交互式使用更不可靠。
- 若需频繁执行语义搜索，建议保持进程/模型常驻（例如，在您的环境中启用长期运行的 qmd/MCP 服务模式），而非每次调用都冷启动 LLM。

## 常用命令

```bash
qmd search "query"             # default
qmd vsearch "query"
qmd query "query"
qmd search "query" -c notes     # Search specific collection
qmd search "query" -n 10        # More results
qmd search "query" --json       # JSON output
qmd search "query" --all --files --min-score 0.3
```

## 有用选项

- `-n <num>`：返回结果数量
- `-c, --collection <name>`：限定搜索范围至指定集合
- `--all --min-score <num>`：返回所有得分高于阈值的结果
- `--json` / `--files`：适配 agent 的输出格式
- `--full`：返回完整文档内容

## 文档检索

```bash
qmd get "path/to/file.md"       # Full document
qmd get "#docid"                # By ID from search results
qmd multi-get "journals/2025-05*.md"
qmd multi-get "doc1.md, doc2.md, #abc123" --json
```

## 维护

```bash
qmd status                      # Index health
qmd update                      # Re-index changed files
qmd embed                       # Update embeddings
```

### 保持索引最新

建议设置定时任务（cron job）或钩子自动重建索引。例如，每日凌晨 5 点重建索引：

```bash
# Via Clawdbot cron (isolated job, runs silently):
clawdbot cron add \
  --name "qmd-reindex" \
  --cron "0 5 * * *" \
  --tz "America/New_York" \
  --session isolated \
  --message "Run: export PATH=\"\$HOME/.bun/bin:\$PATH\" && qmd update && qmd embed" 

# Or via system crontab:
0 5 * * * export PATH="$HOME/.bun/bin:$PATH" && qmd update && qmd embed
```

此举可确保您新增或编辑笔记后，知识库搜索结果始终保持最新。

## 模型与缓存

- 使用本地 GGUF 模型；首次运行时自动下载。
- 默认缓存路径：`~/.cache/qmd/models/`（可通过 `XDG_CACHE_HOME` 覆盖）。

## 与 Clawdbot 内存搜索的关系

- `qmd` 搜索的是 *您本地的文件*（即您显式索引到集合中的笔记/文档）。
- Clawdbot 的 `memory_search` 搜索的是 *agent 内存*（即此前交互中保存的事实与上下文）。
- 推荐两者结合使用：`memory_search` 用于查询“我们之前决定/学到了什么？”，`qmd` 用于查询“我磁盘上的笔记/文档里有什么？”。