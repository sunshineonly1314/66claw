---
name: arxiv-watcher-vigo
name_zh: arXiv Vigo 监控
description: 搜索并摘要 ArXiv 上的论文。当用户询问最新研究、ArXiv 上特定主题的论文，或 AI 领域论文的每日摘要时使用。  
description_zh: 搜索并摘要 ArXiv 上的论文。当用户询问最新研究、ArXiv 上特定主题的论文，或 AI 领域论文的每日摘要时使用。
---
# ArXiv Watcher

该 skill 通过调用 ArXiv API 来查找并摘要最新的研究论文。

## 能力

- **搜索**：按关键词、作者或分类查找论文。  
- **摘要**：获取论文摘要并提供简明扼要的总结。  
- **保存至记忆**：自动将已摘要的论文记录到 `memory/RESEARCH_LOG.md` 中，用于长期追踪。  
- **深度解析**：如用户提出请求，可对 PDF 链接使用 `web_fetch` 提取更多细节。

## 工作流程

1. 使用 `scripts/search_arxiv.sh "<query>"` 获取 XML 格式的结果。  
2. 解析 XML（查找 `<entry>`、`<title>`、`<summary>` 和 `<link title="pdf">`）。  
3. 向用户呈现检索结果。  
4. **强制要求**：将任何讨论过的论文的标题、作者、日期及摘要追加至 `memory/RESEARCH_LOG.md`。格式如下：  
   ```markdown
   ### [YYYY-MM-DD] TITLE_OF_PAPER
   - **Authors**: Author List
   - **Link**: ArXiv Link
   - **Summary**: Brief summary of the paper and its relevance.
   ```

## 示例

- “在 ArXiv 上搜索关于 LLM 推理的最新论文。”  
- “告诉我 ID 为 2512.08769 的论文讲了什么。”  
- “为我汇总今天 ArXiv 上关于 agent 的最新动态。”

## 资源

- `scripts/search_arxiv.sh`：直接调用 API 的脚本。