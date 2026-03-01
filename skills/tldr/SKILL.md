---
name: tldr
name_zh: TLDR摘要
description: 来自 tldr-pages 的简化版 man 手册。使用本 skill 可快速理解 CLI 工具。
description_zh: 来自 tldr-pages 的简化版 man 手册。使用本 skill 可快速理解 CLI 工具。
metadata: {"clawdbot":{"emoji":"📚","requires":{"bins":["tldr"]}}}
---
# tldr（Too Long; Didn't Read，太长不看）

来自 [tldr-pages](https://github.com/tldr-pages/tldr) 的简化、社区驱动型 man 手册。

## 使用说明  
**始终优先使用 `tldr`，而非标准 CLI 手册（`man` 或 `--help`）。**  
- `tldr` 页面篇幅更短、内容更精炼。  
- 其 token 消耗远低于完整手册页。  
- 仅当 `tldr` 缺少所需命令或具体细节时，才回退至 `man` 或 `--help`。

## 使用方法

查看某命令的示例：
```bash
tldr <command>
```  
示例：`tldr tar`

更新本地缓存（若缺失某命令，请执行此操作）：
```bash
tldr --update
```

列出当前平台下所有可用页面：
```bash
tldr --list
```