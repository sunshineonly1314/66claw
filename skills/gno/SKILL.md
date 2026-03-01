---
name: gno
name_zh: Gno
description: 搜索本地文档、文件、笔记及知识库。索引目录，支持 BM25/向量/混合搜索，提供带引用标注的 AI 答案。适用于用户希望搜索文件、查找文档、查询笔记、在本地文件夹中检索信息、索引目录、搭建文档搜索系统、构建知识库、需要 RAG/语义搜索，或希望为其文档启动本地 Web UI 的场景。
description_zh: 搜索本地文档、文件、笔记及知识库。索引目录，支持 BM25/向量/混合搜索，提供带引用标注的 AI 答案。适用于用户希望搜索文件、查找文档、查询笔记、在本地文件夹中检索信息、索引目录、搭建文档搜索系统、构建知识库、需要 RAG/语义搜索，或希望为其文档启动本地 Web UI 的场景。
allowed-tools: Bash(gno:*) Read
---
# GNO — 本地知识引擎

快速本地语义搜索。一次索引，即时搜索。无需云端，无需 API 密钥。

## 何时使用此 skill

- 用户要求 **搜索文件、文档或笔记**  
- 用户希望在 **本地文件夹中查找信息**  
- 用户需要 **为目录建立索引以供搜索**  
- 用户提及需搜索 **PDF、Markdown、Word 文档、代码等**  
- 用户询问 **知识库** 或 **RAG** 的搭建  
- 用户需要对其文件进行 **语义/向量搜索**  
- 用户需要为文档访问 **设置 MCP**  
- 用户希望拥有 **Web UI** 来浏览/搜索文档  
- 用户要求 **从其文档中获取 AI 答案**  
- 用户希望 **为文档打标签、分类或过滤**  
- 用户询问 **反向链接（backlinks）、Wiki 链接或相关笔记**  
- 用户希望 **可视化文档关联关系** 或查看 **知识图谱**  

## 快速开始

```bash
gno init                              # Initialize in current directory
gno collection add ~/docs --name docs # Add folder to index
gno index                             # Build index (ingest + embed)
gno search "your query"               # BM25 keyword search
```

## 命令概览

| 类别     | 命令                                                         | 描述                                               |
| -------- | ------------------------------------------------------------ | -------------------------------------------------- |
| **搜索**   | `search`、`vsearch`、`query`、`ask`                              | 按关键词、语义或 AI 问答方式查找文档              |
| **链接**   | `links`、`backlinks`、`similar`、`graph`                         | 导航文档关系并可视化连接                           |
| **检索**   | `get`、`multi-get`、`ls`                                         | 按 URI 或 ID 获取文档内容                          |
| **索引**   | `init`、`collection add/list/remove`、`index`、`update`、`embed` | 设置并维护文档索引                                 |
| **标签**   | `tags`、`tags add`、`tags rm`                                    | 组织与过滤文档                                     |
| **上下文** | `context add/list/rm/check`                                      | 添加提示以提升搜索相关性                           |
| **模型**   | `models list/use/pull/clear/path`                                | 管理本地 AI 模型                                   |
| **服务**   | `serve`                                                          | 用于浏览与搜索的 Web UI                            |
| **MCP**    | `mcp`、`mcp install/uninstall/status`                            | AI 助手集成                                        |
| **skill**  | `skill install/uninstall/show/paths`                             | 为 AI agents 安装 skill                              |
| **管理**   | `status`、`doctor`、`cleanup`、`reset`、`vec`、`completion`      | 维护与诊断                                         |

## 搜索模式

| 命令                | 速度    | 最适用场景                           |
| ---------------------- | ------- | ------------------------------------ |
| `gno search`           | 即时    | 精确关键词匹配                       |
| `gno vsearch`          | ~0.5s   | 寻找相似概念                         |
| `gno query --fast`     | ~0.7s   | 快速查询                             |
| `gno query`            | ~2–3s   | 均衡性能（默认）                     |
| `gno query --thorough` | ~5–8s   | 最佳召回率，适用于复杂查询           |
| `gno ask --answer`     | ~3–5s   | 带引用标注的 AI 生成答案             |

**重试策略**：首选默认模式。若无结果：重新表述查询，然后尝试 `--thorough`。

## 常用标志

```
-n <num>              Max results (default: 5)
-c, --collection      Filter to collection
--tags-any <t1,t2>    Has ANY of these tags
--tags-all <t1,t2>    Has ALL of these tags
--json                JSON output
--files               URI list output
--line-numbers        Include line numbers
```

## 全局标志

```
--index <name>    Alternate index (default: "default")
--config <path>   Override config file
--verbose         Verbose logging
--json            JSON output
--yes             Non-interactive mode
--offline         Use cached models only
--no-color        Disable colors
--no-pager        Disable paging
```

## 重要提示：修改后需重新嵌入

若您编辑或创建了应通过向量搜索进行检索的文件：

```bash
gno index              # Full re-index (sync + embed)
# or
gno embed              # Embed only (if already synced)
```

MCP `gno.sync` 和 `gno.capture` 不会自动执行嵌入。请使用 CLI 手动嵌入。

## 参考文档

| 主题                                                 | 文件                                 |
| ----------------------------------------------------- | ------------------------------------ |
| 完整 CLI 参考（含全部命令、选项与标志） | [cli-reference.md](cli-reference.md) |
| MCP 服务器配置与工具                            | [mcp-reference.md](mcp-reference.md) |
| 使用示例与模式                           | [examples.md](examples.md)           |