---
name: relay-to-agent
name_zh: 中继至代理
description: "将消息中继至任意 OpenAI 兼容 API 上的 AI agents。支持带会话管理的多轮对话。可列出 agents、发送消息、重置会话。"
description_zh: 将消息中继至任意 OpenAI 兼容 API 上的 AI agents。支持带会话管理的多轮对话。可列出 agents、发送消息、重置会话。
homepage: https://platform.openai.com/docs/api-reference/chat
metadata: {"clawdbot":{"emoji":"🤖","requires":{"bins":["node"]},"primaryEnv":"RELAY_API_KEY"}}
---
# Relay To Agent  

向任意 OpenAI 兼容端点上的 AI agents 发送消息。兼容 Connect Chat、OpenRouter、LiteLLM、vLLM、Ollama，以及任何实现 Chat Completions API 的服务。

## 列出可用 agents  

```bash
node {baseDir}/scripts/relay.mjs --list
```  

## 向 agent 发送消息  

```bash
node {baseDir}/scripts/relay.mjs --agent linkedin-alchemist "Transform this article into a LinkedIn post"
```  

## 多轮对话  

```bash
# First message
node {baseDir}/scripts/relay.mjs --agent connect-flow-ai "Analyze our latest campaign"

# Follow-up (same session, agent remembers context)
node {baseDir}/scripts/relay.mjs --agent connect-flow-ai "Compare with last month"
```  

## 重置会话  

```bash
node {baseDir}/scripts/relay.mjs --agent linkedin-alchemist --reset "Start fresh with this article..."
```  

## 选项  

| 标志 | 说明 | 默认值 |  
|------|------|--------|  
| `--agent ID` | 目标 agent 标识符 | （必填） |  
| `--reset` | 发送前重置对话 | 关闭 |  
| `--list` | 列出可用 agents | — |  
| `--session ID` | 自定义会话标识符 | `default` |  
| `--json` | 原始 JSON 输出 | 关闭 |  

## 配置  

### agents.json  

在 `{baseDir}/agents.json` 中配置 agents 与端点：  

```json
{
  "baseUrl": "https://api.example.com/v1",
  "agents": [
    {
      "id": "my-agent",
      "name": "My Agent",
      "description": "What this agent does",
      "model": "model-id-on-the-api"
    }
  ]
}
```  

### 环境变量  

```bash
export RELAY_API_KEY="sk-..."          # API key (required)
export RELAY_BASE_URL="https://..."    # Override base URL from config
export RELAY_CONFIG="/path/to/agents.json"  # Custom config path
```  

## 兼容服务  

- **Connect Chat** — `api.connectchat.ai/api`  
- **OpenRouter** — `openrouter.ai/api/v1`  
- **LiteLLM** — `localhost:4000/v1`  
- **vLLM** — `localhost:8000/v1`  
- **Ollama** — `localhost:11434/v1`  
- **任意 OpenAI 兼容 API**  

## 会话管理  

会话本地存储于 `~/.cache/relay-to-agent/sessions/`。每个 agent + 会话组合最多保留 50 条消息。使用 `--session` 可在同一 agent 下并行开展多个对话。  