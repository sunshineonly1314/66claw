---
name: gpt
name_zh: GPT
description: OpenAI GPT 集成。通过 OpenAI API 实现聊天补全、图像生成、文本嵌入与模型微调。
description_zh: OpenAI GPT 集成。通过 OpenAI API 实现聊天补全、图像生成、文本嵌入与模型微调。
metadata: {"clawdbot":{"emoji":"🤖","always":true,"requires":{"bins":["curl","jq"]},"primaryEnv":"OPENAI_API_KEY"}}
---
# GPT 🤖

OpenAI GPT 集成。

## 配置

```bash
export OPENAI_API_KEY="sk-..."
```

## 功能特性

- 聊天补全（GPT-4、GPT-4o）
- 图像生成（DALL-E）
- 文本嵌入（Embeddings）
- 模型微调（Fine-tuning）
- Assistant API

## 使用示例

```
"Ask GPT: Explain quantum computing"
"Generate image of a sunset"
"Create embeddings for this text"
```

## API 参考文档

```bash
curl -s https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'
```