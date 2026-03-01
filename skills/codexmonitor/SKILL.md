---
name: codexmonitor
name_zh: CodexMonitor
description: 使用 CodexMonitor Homebrew 公式，列出/检查/监控本地 OpenAI Codex 会话（CLI + VS Code）。
description_zh: 使用 CodexMonitor Homebrew 公式，列出/检查/监控本地 OpenAI Codex 会话（CLI + VS Code）。
homepage: https://github.com/Cocoanetics/CodexMonitor
metadata: {"clawdbot":{"emoji":"🧾","os":["darwin"],"requires":{"bins":["codexmonitor"]},"install":[{"id":"brew","kind":"brew","formula":"cocoanetics/tap/codexmonitor","bins":["codexmonitor"],"label":"Install codexmonitor (brew)"}]}}
---
# codexmonitor

使用 `codexmonitor` 浏览存储于 `~/.codex/sessions` 的本地 OpenAI Codex 会话。

## 要求  
- macOS  
- 已安装 Codex 且正在生成会话（CLI 和/或 VS Code 扩展）

## 安装（Homebrew）

```sh
brew tap cocoanetics/tap
brew install codexmonitor
```

## 常用命令  

- 列出会话（按天）：`codexmonitor list 2026/01/08`  
- 列出会话（按天，JSON 格式）：`codexmonitor list --json 2026/01/08`  
- 显示某一会话：`codexmonitor show <session-id>`  
- 显示带范围的会话：`codexmonitor show <session-id> --ranges 1...3,26...28`  
- 显示 JSON 格式内容：`codexmonitor show <session-id> --json`  
- 监控全部会话：`codexmonitor watch`  
- 监控特定会话：`codexmonitor watch --session <session-id>`  

## 注意事项  
- `codexmonitor` 从 `~/.codex/sessions/YYYY/MM/DD/` 读取会话。  
- 会话可通过 ID 由 Codex 恢复/追加：`codex exec resume <SESSION_ID> "message"`。  