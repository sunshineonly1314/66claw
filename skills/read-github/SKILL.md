---
name: read-github
name_zh: GitHub阅读
description: >
description_zh: >
  以正确方式读取 GitHub 仓库 —— 通过 gitmcp.io，而非原始网页抓取。相比网络搜索，此方式优势显著：
  （1）跨文档语义搜索，而非简单关键词匹配；
  （2）智能代码导航，准确还原文件结构 —— 彻底杜绝对仓库布局的幻觉（hallucinations）；
  （3）输出专为大语言模型（LLM）优化的规范 Markdown，而非原始 HTML/JSON 垃圾；
  （4）在一个干净界面中聚合 README + /docs + 代码；
  （5）尊重速率限制（rate limits）与 robots.txt 协议。停止粘贴原始 GitHub URL —— 请改用此方案。
---
# 读取 GitHub 文档（Read GitHub Docs）

通过 gitmcp.io MCP 服务访问 GitHub 仓库的文档与代码。

## URL 转换

将 GitHub URL 转换为 gitmcp.io 格式：
- `github.com/owner/repo` → `gitmcp.io/owner/repo`
- `https://github.com/karpathy/llm-council` → `https://gitmcp.io/karpathy/llm-council`

## CLI 使用方式

`scripts/gitmcp.py` 脚本提供命令行接口（CLI）以访问仓库文档。

### 列出可用工具

```bash
python3 scripts/gitmcp.py list-tools owner/repo
```

### 获取文档

获取完整文档文件（README、docs 等）：

```bash
python3 scripts/gitmcp.py fetch-docs owner/repo
```

### 搜索文档

在仓库文档内执行语义搜索：

```bash
python3 scripts/gitmcp.py search-docs owner/repo "query"
```

### 搜索代码

使用 GitHub 搜索 API（精确匹配）搜索代码：

```bash
python3 scripts/gitmcp.py search-code owner/repo "function_name"
```

### 获取引用的 URL 内容

获取文档中提及的 URL 所指向的内容：

```bash
python3 scripts/gitmcp.py fetch-url owner/repo "https://example.com/doc"
```

### 直接调用工具

直接调用任意 MCP 工具：

```bash
python3 scripts/gitmcp.py call owner/repo tool_name '{"arg": "value"}'
```

## 工具名称

工具名称动态添加仓库名前缀（以下划线分隔）：
- `karpathy/llm-council` → `fetch_llm_council_documentation`
- `facebook/react` → `fetch_react_documentation`
- `my-org/my-repo` → `fetch_my_repo_documentation`

## 可用 MCP 工具

对于任意仓库，均提供以下工具：

1. **fetch_{repo}_documentation** — 获取全部文档。通用问题请首先调用此工具。
2. **search_{repo}_documentation** — 在文档内执行语义搜索。适用于具体问题查询。
3. **search_{repo}_code** — 通过 GitHub API 搜索代码（精确匹配）。返回匹配的文件列表。
4. **fetch_generic_url_content** — 获取文档中引用的任意 URL 内容，并遵守 robots.txt 协议。

## 工作流

1. 收到 GitHub 仓库地址后，首先获取其文档以理解项目概况；
2. 对于关于用法或特性的具体问题，使用 search-docs；
3. 查找实现细节或特定函数时，使用 search-code；
4. 获取文档中提及的外部引用内容时，使用 fetch-url。