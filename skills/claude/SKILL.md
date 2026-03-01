---
name: claude
name_zh: Claude
description: Anthropic Claude 集成。通过 Anthropic API 与 Claude 模型对话。
description_zh: Anthropic Claude 集成。通过 Anthropic API 与 Claude 模型对话。
metadata: {"clawdbot":{"emoji":"🧠","always":true,"requires":{"bins":["curl","jq"]},"primaryEnv":"ANTHROPIC_API_KEY"}}
---
# Claude 🧠

Anthropic Claude 集成。

## 设置（Setup）

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

## 功能（Features）

- 与 Claude（Opus、Sonnet、Haiku）对话  
- 支持长上下文（200K tokens）  
- 支持视觉（Vision）能力  
- 支持 tool use  

## 使用示例（Usage Examples）

```
"Ask Claude: Analyze this code"
"Use Claude to summarize this document"
```

## API 参考（API Reference）

```bash
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'
```