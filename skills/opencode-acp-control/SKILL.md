---
name: opencode-acp-control
name_zh: OpenCode ACP控制
description: 通过 Agent 客户端协议（ACP）直接控制 OpenCode。启动会话、发送提示词、恢复对话、管理 OpenCode 更新。
description_zh: 通过 Agent 客户端协议（ACP）直接控制 OpenCode。启动会话、发送提示词、恢复对话、管理 OpenCode 更新。
metadata: {"version": "1.0.2", "author": "Benjamin Jesuiter <bjesuiter@gmail.com>", "license": "MIT", "github_url": "https://github.com/bjesuiter/opencode-acp-skill"}
---
# OpenCode ACP Skill

通过 Agent 客户端协议（ACP）直接控制 OpenCode。

## 元数据

- ACP 协议文档（面向 agents/LLMs）：https://agentclientprotocol.com/llms.txt  
- GitHub 仓库：https://github.com/bjesuiter/opencode-acp-skill  
- 若您在使用该 skill 时遇到问题，请在此处提交 issue：https://github.com/bjesuiter/opencode-acp-skill/issues

## 快速参考

| 操作 | 方法 |
|------|------|
| 启动 OpenCode | `bash(command: "opencode acp", background: true)` |
| 发送消息 | `process.write(sessionId, data: "<json-rpc>\n")` |
| 读取响应 | `process.poll(sessionId)` — 每 2 秒重复一次 |
| 停止 OpenCode | `process.kill(sessionId)` |
| 列出所有会话 | `bash(command: "opencode session list", workdir: "...")` |
| 恢复会话 | 先列出会话 → 询问用户 → `session/load` |
| 检查版本 | `bash(command: "opencode --version")` |

## 启动 OpenCode

```
bash(
  command: "opencode acp",
  background: true,
  workdir: "/path/to/your/project"
)
```

请保存返回的 `sessionId` — 后续所有命令均需使用该值。

## 协议基础

- 所有消息均为 **JSON-RPC 2.0** 格式  
- 消息为 **换行分隔**（每条消息末尾需添加 `\n`）  
- 需维护一个 **消息 ID 计数器**，初始值为 0  

## 分步工作流

### 步骤 1：初始化连接

在启动 OpenCode 后立即发送：

```json
{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"clawdbot","title":"Clawdbot","version":"1.0.0"}}}
```

轮询等待响应。预期收到 `result.protocolVersion: 1`。

### 步骤 2：创建会话

```json
{"jsonrpc":"2.0","id":1,"method":"session/new","params":{"cwd":"/path/to/project","mcpServers":[]}}
```

轮询等待响应。请保存 `result.sessionId`（例如：`"sess_abc123"`）。

### 步骤 3：发送提示词（prompts）

```json
{"jsonrpc":"2.0","id":2,"method":"session/prompt","params":{"sessionId":"sess_abc123","prompt":[{"type":"text","text":"Your question here"}]}}
```

每 2 秒轮询一次。您将收到：
- `session/update` 通知（流式内容）  
- 最终响应中包含 `result.stopReason`  

### 步骤 4：读取响应

每次轮询可能返回多行。请逐行解析为 JSON：

- **通知（Notifications）**：`method: "session/update"` — 收集这些内容以构成完整响应  
- **响应（Response）**：其 `id` 与您的请求匹配 — 当收到 `stopReason` 时即可停止轮询  

### 步骤 5：取消操作（如需）

```json
{"jsonrpc":"2.0","method":"session/cancel","params":{"sessionId":"sess_abc123"}}
```

无需响应 — 此为单向通知。

## 需跟踪的状态

每个 OpenCode 实例需跟踪以下状态：
- `processSessionId` — 来自 bash 工具（clawdbot 的进程 ID）  
- `opencodeSessionId` — 来自 session/new 响应（OpenCode 的会话 ID）  
- `messageId` — 每发送一条请求即递增一次  

## 轮询策略

- 每 **2 秒** 轮询一次  
- 持续轮询直至收到含 `stopReason` 的响应  
- 最长等待时间：**5 分钟**（共 150 次轮询）  
- 若超时仍未收到响应，则视为操作失败  

## 常见终止原因

| stopReason | 含义 |
|------------|------|
| `end_turn` | Agent 已完成响应 |
| `cancelled` | 您已取消该提示词 |
| `max_tokens` | 已达 token 限制 |

## 错误处理

| 问题 | 解决方案 |
|------|----------|
| 轮询返回空响应 | 继续轮询 — agent 正在思考中 |
| JSON 解析错误 | 跳过格式异常的行，继续处理后续内容 |
| 进程已退出 | 重启 OpenCode |
| 5 分钟后仍无响应 | 终止进程，重新开始 |

## 示例：完整交互流程

```
1. bash(command: "opencode acp", background: true, workdir: "/home/user/myproject")
   -> processSessionId: "bg_42"

2. process.write(sessionId: "bg_42", data: '{"jsonrpc":"2.0","id":0,"method":"initialize",...}\n')
   process.poll(sessionId: "bg_42") -> initialize response

3. process.write(sessionId: "bg_42", data: '{"jsonrpc":"2.0","id":1,"method":"session/new","params":{"cwd":"/home/user/myproject","mcpServers":[]}}\n')
   process.poll(sessionId: "bg_42") -> opencodeSessionId: "sess_xyz789"

4. process.write(sessionId: "bg_42", data: '{"jsonrpc":"2.0","id":2,"method":"session/prompt","params":{"sessionId":"sess_xyz789","prompt":[{"type":"text","text":"List all TypeScript files"}]}}\n')
   
5. process.poll(sessionId: "bg_42") every 2 sec until stopReason
   -> Collect all session/update content
   -> Final response: stopReason: "end_turn"

6. When done: process.kill(sessionId: "bg_42")
```

---

## 恢复会话

通过让用户从可用会话列表中选择，恢复先前的 OpenCode 会话。

### 步骤 1：列出可用会话

```
bash(command: "opencode session list", workdir: "/path/to/project")
```

示例输出：
```
ID                                  Updated              Messages
ses_451cd8ae0ffegNQsh59nuM3VVy      2026-01-11 15:30     12
ses_451a89e63ffea2TQIpnDGtJBkS      2026-01-10 09:15     5
ses_4518e90d0ffeJIpOFI3t3Jd23Q      2026-01-09 14:22     8
```

### 步骤 2：请用户选择目标会话

向用户展示列表，并询问希望恢复哪一个会话：

```
"Which session would you like to resume?
 
1. ses_451cd8ae... (12 messages, updated 2026-01-11)
2. ses_451a89e6... (5 messages, updated 2026-01-10)
3. ses_4518e90d... (8 messages, updated 2026-01-09)

Enter session number or ID:"
```

### 步骤 3：加载所选会话

待用户响应（例如：“1”、“第一个”或“ses_451cd8ae...”）后：

1. **启动 OpenCode ACP**：  
   ```
   bash(command: "opencode acp", background: true, workdir: "/path/to/project")
   ```

2. **初始化连接**：  
   ```json
   {"jsonrpc":"2.0","id":0,"method":"initialize","params":{...}}
   ```

3. **加载会话**：  
   ```json
   {"jsonrpc":"2.0","id":1,"method":"session/load","params":{"sessionId":"ses_451cd8ae0ffegNQsh59nuM3VVy","cwd":"/path/to/project","mcpServers":[]}}
   ```

**注意**：`session/load` 需要 `cwd` 和 `mcpServers` 两个参数。

加载时，OpenCode 将把完整的对话历史以流式方式返回给您。

### 恢复会话工作流概览

```
function resumeSession(workdir):
    # List available sessions
    output = bash("opencode session list", workdir: workdir)
    sessions = parseSessionList(output)
    
    if sessions.empty:
        notify("No previous sessions found. Starting fresh.")
        return createNewSession(workdir)
    
    # Ask user to choose
    choice = askUser("Which session to resume?", sessions)
    selectedId = matchUserChoice(choice, sessions)
    
    # Start OpenCode and load session
    process = bash("opencode acp", background: true, workdir: workdir)
    initialize(process)
    
    session_load(process, selectedId, workdir, mcpServers: [])
    
    notify("Session resumed. Conversation history loaded.")
    return process
```

### 重要说明

- **历史重放**：加载时，所有先前的消息将以流式方式重新返回  
- **记忆保留**：Agent 记住全部对话内容  
- **进程无关性**：会话可在 OpenCode 重启后继续存在  

---

## 更新 OpenCode

OpenCode 在重启时自动更新。请按以下工作流检查并触发更新。

### 步骤 1：检查当前版本

```
bash(command: "opencode --version")
```

返回示例：`opencode version 1.1.13`  
从中提取版本号（例如：`1.1.13`）。

### 步骤 2：检查最新版本

```
webfetch(url: "https://github.com/anomalyco/opencode/releases/latest", format: "text")
```

重定向 URL 中包含最新版本标签：
- 重定向至：`https://github.com/anomalyco/opencode/releases/tag/v1.2.0`  
- 从 URL 路径中提取版本号（例如：`1.2.0`）

### 步骤 3：比较并更新

若最新版本 > 当前版本：

1. **停止所有正在运行的 OpenCode 进程**：  
   ```
   process.list()  # Find all "opencode acp" processes
   process.kill(sessionId) # For each running instance
   ```

2. **重启实例**（OpenCode 启动时将自动下载新二进制文件）：  
   ```
   bash(command: "opencode acp", background: true, workdir: "/path/to/project")
   ```

3. **为每个实例重新初始化**（执行 initialize + session/load 以恢复已有会话）

### 步骤 4：验证更新结果

```
bash(command: "opencode --version")
```

若版本仍未匹配最新版：
- 提示用户：“OpenCode 自动更新可能失败。当前版本：X.X.X，最新版本：Y.Y.Y”  
- 建议手动更新：`curl -fsSL https://opencode.dev/install | bash`

### 更新工作流概览

```
function updateOpenCode():
    current = bash("opencode --version")  # e.g., "1.1.13"
    
    latestPage = webfetch("https://github.com/anomalyco/opencode/releases/latest")
    latest = extractVersionFromRedirectUrl(latestPage)  # e.g., "1.2.0"
    
    if semverCompare(latest, current) > 0:
        # Stop all instances
        for process in process.list():
            if process.command.includes("opencode"):
                process.kill(process.sessionId)
        
        # Wait briefly for processes to terminate
        sleep(2 seconds)
        
        # Restart triggers auto-update
        bash("opencode acp", background: true)
        
        # Verify
        newVersion = bash("opencode --version")
        if newVersion != latest:
            notify("Auto-update may have failed. Manual update recommended.")
    else:
        notify("OpenCode is up to date: " + current)
```

### 重要说明

- **会话持久化**：`opencodeSessionId` 可在重启后继续存在 — 使用 `session/load` 恢复  
- **自动更新**：OpenCode 在重启时自动下载新二进制文件  
- **无数据丢失**：对话历史在服务端完整保留  