---
name: factory-ai
name_zh: 工厂AI
description: 使用 Factory AI 的 droid CLI 执行软件工程任务。支持交互模式、执行模式（exec mode）、MCP 服务器和插件。
description_zh: 使用 Factory AI 的 droid CLI 执行软件工程任务。支持交互模式、执行模式（exec mode）、MCP 服务器和插件。
metadata: {"clawdbot":{"emoji":"🤖","requires":{"bins":["droid"]}}}
---
# Factory AI Droid CLI

使用 `droid` 构建功能、调试、重构及部署代码。

## 安装

已安装于：`/Users/mitchellbernstein/.local/bin/droid`

## 认证

```bash
droid login
# or set FACTORY_API_KEY env var
export FACTORY_API_KEY=your-api-key
```

## 命令

### 交互模式
```bash
droid                           # Start fresh session
droid "fix the login bug"       # Start with prompt
droid -r                        # Resume last session
droid -r session-id             # Resume specific session
```

### 非交互模式（执行模式）
```bash
droid exec "analyze this file"
droid exec "commit my changes with a good message"
droid exec "deploy to fly.io"
droid exec --help               # Show exec options
```

### 执行模式选项
```bash
droid exec --force "fix lint errors"    # Auto-apply without confirmation
droid exec --json "analyze code"        # JSON output
droid exec --model claude "task"        # Specify model
```

### MCP 服务器
```bash
droid mcp list                    # List installed MCP servers
droid mcp add server-name         # Add MCP server
droid mcp remove server-name      # Remove MCP server
```

### 插件
```bash
droid plugin list                 # List plugins
droid plugin add name             # Add plugin
```

## 使用模式

### 功能开发
```bash
droid exec "add a user settings page with dark mode toggle"
```

### 调试
```bash
droid exec "fix this error: [paste error]"
```

### 代码审查
```bash
droid exec "review the PR for security issues"
```

### Git 操作
```bash
droid exec "create a PR for my changes"
droid exec "write a good commit message for the staged changes"
```

### 部署
```bash
droid exec "deploy to fly.io"
```

### 多文件变更
```bash
droid
# Then in interactive mode:
@src/components/
@src/api/
Implement authentication flow
```

## 注意事项

- Droid 具备对您组织内整个代码库的深度理解能力  
- 支持模型灵活性（OpenAI、Anthropic、xAI 等）  
- 通过 MCP 服务器扩展功能  
- 基于会话的记忆机制，保障上下文连续性  