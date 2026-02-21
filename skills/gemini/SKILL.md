---
name: gemini
description: Gemini CLI for one-shot Q&A, summaries, and generation.
nameZh: "Gemini AI"
descriptionZh: "使用Gemini CLI进行问答、摘要和内容生成"
homepage: https://ai.google.dev/
metadata: {"openclawcn":{"emoji":"♊️","requires":{"bins":["gemini"]},"install":[{"id":"brew","kind":"brew","formula":"gemini-cli","bins":["gemini"],"label":"安装 Gemini CLI (brew)"},{"id":"npm","kind":"node","package":"@google/gemini-cli","bins":["gemini"],"label":"安装 Gemini CLI (npm)"}]}}
---

# Gemini CLI

Use Gemini in one-shot mode with a positional prompt (avoid interactive mode).

Quick start
- `gemini "Answer this question..."`
- `gemini --model <name> "Prompt..."`
- `gemini --output-format json "Return JSON"`

Extensions
- List: `gemini --list-extensions`
- Manage: `gemini extensions <command>`

Notes
- If auth is required, run `gemini` once interactively and follow the login flow.
- Avoid `--yolo` for safety.
