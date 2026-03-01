---
name: instapaper
name_zh: Instapaper
description: "在操作 instapaper-cli（ip）工具或对其进行故障排查时使用：身份验证、列出/导出/导入书签、批量修改、文件夹/高亮/正文内容、选择输出格式（ndjson/json/plain）、基于游标的同步，以及解读 stderr-json 和退出码以实现自动化。"
description_zh: 在操作 instapaper-cli（ip）工具或对其进行故障排查时使用：身份验证、列出/导出/导入书签、批量修改、文件夹/高亮/正文内容、选择输出格式（ndjson/json/plain）、基于游标的同步，以及解读 stderr-json 和退出码以实现自动化。
---
# Instapaper CLI

## 概述

使用此 skill 通过 `ip` CLI（需已安装且在 `PATH` 中可用）执行 Instapaper 操作，尤其适用于需要可靠自动化、结构化输出或故障排查指导的场景。

## 安装 CLI

- Go 安装：`go install github.com/vburojevic/instapaper-cli/cmd/ip@latest`
- Homebrew：`brew tap vburojevic/tap && brew install instapaper-cli`
- 源码编译安装：`go build ./cmd/ip`（以 `./ip` 身份运行）

## 工作流程（快速路径）

1. 验证环境配置  
   - 确保 `INSTAPAPER_CONSUMER_KEY` 和 `INSTAPAPER_CONSUMER_SECRET` 已设置，或在登录时传入。  
   - 推荐使用 `--password-stdin` 进行身份验证；切勿保存密码。  
   - 在执行长时间任务前，运行 `ip doctor --json`（或 `ip auth status`）。

2. 为自动化选择输出格式  
   - 默认为 `--ndjson`（流式处理，每行一个对象）。  
   - 对单个对象或紧凑数组，使用 `--json`。  
   - 对稳定、面向行的纯文本，使用 `--plain`。  
   - 添加 `--stderr-json` 获取结构化错误，添加 `--progress-json` 用于长时间运行任务。

3. 确定性地读取数据  
   - 使用 `list` 或 `export`，配合 `--cursor`/`--cursor-dir` 或 `--since/--until` 边界参数。  
   - 使用 `--updated-since` 实现增量同步。  
   - 当 API 不支持某类过滤时，使用 `--select` 进行客户端过滤。

4. 安全地执行变更操作  
   - 尽可能使用 `--dry-run` 或 `--idempotent`。  
   - 执行批量操作时，使用 `--ids` 或 `--stdin`，并考虑 `--batch`。  
   - 删除操作需显式指定确认标志。

5. 处理扩展功能  
   - 文本视图：使用 `ip text` 获取文章 HTML。  
   - 高亮内容：使用 `ip highlights list/add/delete`。  
   - 文件夹：使用 `ip folders list/add/delete/order`。

6. 故障排查  
   - 使用 `--debug` 查看请求耗时与状态。  
   - 使用 `--stderr-json`，并将 `exit_code` 映射到具体操作。

## 命令参考

当您需要精确的命令行选项、格式或示例时，请查阅以下文档：

- `references/commands.md`：涵盖身份验证、列表/导出/导入、变更操作、文件夹、高亮及正文内容等各命令的使用示例。  
- `references/output-and-sync.md`：输出格式、进度流、游标/边界语法及过滤方法。  
- `references/errors.md`：退出码及结构化 stderr 错误码。

## 安全守则（Guardrails）

- 避免使用 `--format table` 进行解析；该格式仅供人类阅读。  
- 对大型导出任务，请使用 `--output` 或 `--output-dir`，避免对 stdout 造成压力。  
- 在 Windows 上推荐使用 `--password-stdin`，以防密码被回显。