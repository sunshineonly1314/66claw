---
name: prompt-log
name_zh: 提示日志
description: 从 AI 编程会话日志（Clawdbot、Claude Code、Codex）中提取对话记录。当用户要求导出提示历史、会话日志或从 .jsonl 会话文件中提取对话记录时使用。
description_zh: 从 AI 编程会话日志（Clawdbot、Claude Code、Codex）中提取对话记录。当用户要求导出提示历史、会话日志或从 .jsonl 会话文件中提取对话记录时使用。
---
# Prompt Log（提示日志）

## 快速开始

在会话文件上运行打包的脚本：

```bash
scripts/extract.sh <session-file>
```

## 输入

- **会话文件**：来自 Clawdbot、Claude Code 或 Codex 的 `.jsonl` 会话日志。
- **可选过滤器**：`--after` 和 `--before` ISO 时间戳。
- **可选输出**：用于生成 Markdown 对话记录的 `--output` 路径。

## 输出

- 生成一份 Markdown 格式的对话记录，默认保存至当前项目下的 `.prompt-log/YYYY-MM-DD-HHMMSS.md`。

## 示例

```bash
scripts/extract.sh ~/.codex/sessions/2026/01/12/abcdef.jsonl
scripts/extract.sh ~/.claude/projects/my-proj/xyz.jsonl --after "2026-01-12T10:00:00" --before "2026-01-12T12:00:00"
scripts/extract.sh ~/.clawdbot/agents/main/sessions/123.jsonl --output my-transcript.md
```

## 依赖项

- 要求 `jq` 在 PATH 中可用。
- 在 macOS 上，若 `gdate` 可用则优先使用；否则回退至 `date`。