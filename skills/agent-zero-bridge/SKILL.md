---
name: agent-zero-bridge
name_zh: Agent Zero桥接
description: 将复杂的编码、研究或自主任务委托给 Agent Zero 框架。当用户说“请 Agent Zero 帮忙”、“委托给 A0”、“让 Agent Zero 构建”或需要具备自修正循环的长时间运行自主编码任务时，使用本 skill。
description_zh: 将复杂的编码、研究或自主任务委托给 Agent Zero 框架。当用户说“请 Agent Zero 帮忙”、“委托给 A0”、“让 Agent Zero 构建”或需要具备自修正循环的长时间运行自主编码任务时，使用本 skill。
---
# Agent Zero Bridge

Clawdbot 与 [Agent Zero](https://github.com/frdel/agent-zero) 之间的双向通信桥梁。

## 使用场景

- 需要多次迭代/自修正的复杂编码任务  
- 长时间运行的构建、测试或基础设施工作  
- 需要持久化 Docker 执行环境的任务  
- 需要大量顺序调用工具的研究任务  
- 用户明确要求使用 Agent Zero  

## 初始化配置（仅首次需执行）

### 1. 前置条件
- Node.js 18+（需内置 `fetch` 支持）  
- Agent Zero 已运行（推荐使用 Docker，端口 50001）  
- Clawdbot Gateway 已启用 HTTP 端点  

### 2. 安装  
```bash
# Copy skill to Clawdbot skills directory
cp -r <this-skill-folder> ~/.clawdbot/skills/agent-zero-bridge

# Create config from template
cd ~/.clawdbot/skills/agent-zero-bridge
cp .env.example .env
```  

### 3. 配置 `.env` 文件  
```env
# Agent Zero (get token from A0 settings or calculate from runtime ID)
A0_API_URL=http://127.0.0.1:50001
A0_API_KEY=your_agent_zero_token

# Clawdbot Gateway
CLAWDBOT_API_URL=http://127.0.0.1:18789
CLAWDBOT_API_TOKEN=your_gateway_token

# For Docker containers reaching host (use your machine's LAN IP)
CLAWDBOT_API_URL_DOCKER=http://192.168.1.x:18789
```  

### 4. 获取 Agent Zero Token  
```python
# Calculate from A0's runtime ID
import hashlib, base64
runtime_id = "your_A0_PERSISTENT_RUNTIME_ID"  # from A0's .env
hash_bytes = hashlib.sha256(f"{runtime_id}::".encode()).digest()
token = base64.urlsafe_b64encode(hash_bytes).decode().replace("=", "")[:16]
print(token)
```  

### 5. 启用 Clawdbot Gateway 端点  
在 `~/.clawdbot/clawdbot.json` 中添加：  
```json
{
  "gateway": {
    "bind": "0.0.0.0",
    "auth": { "mode": "token", "token": "your_token" },
    "http": { "endpoints": { "chatCompletions": { "enabled": true } } }
  }
}
```  
然后执行：`clawdbot gateway restart`  

### 6. 将客户端部署至 Agent Zero 容器  
```bash
docker exec <container> mkdir -p /a0/bridge/lib
docker cp scripts/lib/. <container>:/a0/bridge/lib/
docker cp scripts/clawdbot_client.js <container>:/a0/bridge/
docker cp .env <container>:/a0/bridge/
docker exec <container> sh -c 'echo "DOCKER_CONTAINER=true" >> /a0/bridge/.env'
```  

## 使用方法  

### 向 Agent Zero 发送任务  
```bash
node scripts/a0_client.js "Build a REST API with JWT authentication"
node scripts/a0_client.js "Review this code" --attach ./file.py
node scripts/a0_client.js "New task" --new  # Start fresh conversation
```  

### 查询任务状态  
```bash
node scripts/a0_client.js status
node scripts/a0_client.js history
node scripts/a0_client.js reset  # Clear conversation
```  

### 任务分解（创建受追踪项目）  
```bash
node scripts/task_breakdown.js "Build e-commerce platform"
# Creates notebook/tasks/projects/<name>.md with checkable steps
```  

### 从 Agent Zero → Clawdbot  
在 A0 容器内执行：  
```bash
# Report progress
node /a0/bridge/clawdbot_client.js notify "Working on step 3..."

# Ask for input
node /a0/bridge/clawdbot_client.js "Should I use PostgreSQL or SQLite?"

# Invoke Clawdbot tool
node /a0/bridge/clawdbot_client.js tool web_search '{"query":"Node.js best practices"}'
```  

## 故障排查  

| 错误 | 解决方法 |  
|------|----------|  
| 401 / API 密钥错误 | 检查 `A0_API_KEY` 是否与 Agent Zero 的 `mcp_server_token` 一致 |  
| Docker 连接被拒绝 | 在 `CLAWDBOT_API_URL_DOCKER` 中使用宿主机局域网 IP，并确保 Gateway 绑定地址为 `0.0.0.0` |  
| A0 返回 500 错误 | 检查 Agent Zero 所配置的 LLM API 密钥（Gemini / OpenAI）是否有效 |