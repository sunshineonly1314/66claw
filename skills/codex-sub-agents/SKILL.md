---
name: codex-cli
name_zh: Codex子代理
description: "使用 OpenAI Codex CLI 执行编程任务。触发词：codex、code review、fix CI、refactor code、implement feature、coding agent、gpt-5-codex。使 Clawdbot 能将编程工作委托给 Codex CLI 作为 subagent 或直接工具。"
description_zh: 使用 OpenAI Codex CLI 执行编程任务。触发词：codex、code review、fix CI、refactor code、implement feature、coding agent、gpt-5-codex。使 Clawdbot 能将编程工作委托给 Codex CLI 作为 subagent 或直接工具。
---
# OpenAI Codex CLI 技能

使用 OpenAI Codex CLI (`codex`) 执行编程任务，包括代码审查、重构、缺陷修复、CI 修复及功能实现。Codex CLI 在本地机器上运行，并拥有完整的文件系统访问权限。

## 适用场景

- 用户请求代码修改、重构或功能实现
- CI/构建失败需修复
- 提交/推送前进行代码审查
- 大型代码库的探索或解释
- 需要文件编辑 + 命令执行的任务
- 需要调用 GPT-5-Codex 模型优势时（代码生成、工具调用）

## 安装与认证

Codex CLI 需要 ChatGPT Plus/Pro/Business/Enterprise 订阅。

```bash
# Install
npm i -g @openai/codex

# Authenticate (opens browser for OAuth)
codex login

# Or use API key
printenv OPENAI_API_KEY | codex login --with-api-key

# Verify auth
codex login status
```

## 核心命令

### 交互模式（TUI）
```bash
codex                           # Launch interactive terminal UI
codex "explain this codebase"   # Start with a prompt
codex --cd ~/projects/myapp     # Set working directory
```

### 非交互模式（脚本化）
```bash
codex exec "fix the CI failure"                    # Run and exit
codex exec --full-auto "add input validation"      # Auto-approve workspace writes
codex exec --json "list all API endpoints"         # JSON output for parsing
codex exec -i screenshot.png "match this design"   # With image input
```

### 会话管理
```bash
codex resume               # Pick from recent sessions
codex resume --last        # Continue most recent
codex resume <SESSION_ID>  # Resume specific session
```

## 斜杠命令（在 TUI 中）

| 命令 | 用途 |
|---------|---------|
| `/model` | 切换模型（gpt-5-codex、gpt-5） |
| `/approvals` | 设置审批模式（Auto、Read Only、Full Access） |
| `/review` | 针对分支、未提交更改或特定提交执行代码审查 |
| `/diff` | 显示 Git 差异（含未跟踪文件） |
| `/compact` | 汇总对话以释放上下文空间 |
| `/init` | 生成 AGENTS.md 模板 |
| `/status` | 显示会话配置与 token 使用量 |
| `/undo` | 撤销最近一次操作 |
| `/new` | 开启全新对话 |
| `/mcp` | 列出已配置的 MCP 工具 |
| `/mention <path>` | 将文件附加至当前对话 |

## 审批模式

| 模式 | 行为 |
|------|----------|
| **Auto**（默认） | 可在工作区中读取/编辑/运行命令；访问工作区外资源时需请求授权 |
| **Read Only** | 仅可浏览文件；执行修改操作前需获得明确授权 |
| **Full Access** | 具备完整机器访问权限（含网络），请谨慎启用 |

## 关键标志（Flags）

| 标志 | 用途 |
|------|---------|
| `--model, -m <model>` | 覆盖模型选择（gpt-5-codex、gpt-5） |
| `--cd, -C <path>` | 设置工作目录 |
| `--add-dir <path>` | 添加额外可写根目录 |
| `--image, -i <path>` | 将图像附加至提示词 |
| `--full-auto` | 工作区写入 + 失败时自动审批 |
| `--sandbox <mode>` | read-only、workspace-write、danger-full-access |
| `--json` | 输出换行分隔的 JSON |
| `--search` | 启用网络搜索工具 |

## Clawdbot 集成模式

### 模式 1：直接 exec 工具调用  
通过 Clawdbot 的 exec 工具调用 Codex 执行编程任务：

```bash
# In Clawdbot session
exec codex exec --full-auto --cd ~/projects/medreport "fix the TypeScript errors in src/components"
```

### 模式 2：subagent 委派  
启动一个使用 Codex 的编程 subagent：

```json5
// In agents.defaults or per-agent config
{
  agents: {
    list: [
      {
        id: "coder",
        workspace: "~/clawd-coder",
        model: "openai-codex/gpt-5.2",  // Uses Codex auth
        tools: {
          allow: ["exec", "read", "write", "edit", "apply_patch", "process"]
        }
      }
    ]
  }
}
```

### 模式 3：CLI 后端回退  
将 Codex 配置为纯文本回退方案：

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "codex-cli": {
          command: "codex",
          args: ["exec", "--full-auto"],
          output: "text",
          sessionArg: null  // Codex manages its own sessions
        }
      }
    }
  }
}
```

### 模式 4：MCP 服务器模式  
将 Codex 作为 MCP 服务器供其他 agents 使用：

```bash
codex mcp-server  # Exposes Codex tools via stdio MCP
```

## Clawdbot 配置：OpenAI Codex 提供方  

通过 `openai-codex` 提供方，使用您的 ChatGPT Pro 订阅：

```json5
{
  agents: {
    defaults: {
      model: { primary: "openai-codex/gpt-5.2" },
      models: {
        "openai-codex/gpt-5.2": { alias: "Codex" },
        "anthropic/claude-opus-4-5": { alias: "Opus" }
      }
    }
  }
}
```

认证信息将自动从 `~/.codex/auth.json` 同步至 Clawdbot 的认证配置文件。

## 代码审查工作流  

```bash
# Interactive review
codex
/review  # Choose: branch, uncommitted, or specific commit

# Non-interactive
codex exec "review the changes in this PR against main branch"
```

## 多目录项目  

```bash
# Work across monorepo packages
codex --cd apps/frontend --add-dir ../backend --add-dir ../shared

# Or in TUI
codex --cd ~/projects/myapp --add-dir ~/projects/shared-lib
```

## 自定义斜杠命令  

在 `~/.codex/prompts/` 中创建可复用提示词：

```markdown
<!-- ~/.codex/prompts/pr.md -->
---
description: Prepare and open a draft PR
argument-hint: [BRANCH=<name>] [TITLE="<title>"]
---

Create branch `dev/$BRANCH` if specified.
Stage and commit changes with a clear message.
Open a draft PR with title $TITLE or auto-generate one.
```

调用方式：`/prompts:pr BRANCH=feature-auth TITLE="Add OAuth flow"`

## MCP 集成  

添加 MCP 服务器以扩展 Codex 功能：

```bash
# Add stdio server
codex mcp add github -- npx @anthropic/mcp-server-github

# Add HTTP server
codex mcp add docs --url https://mcp.deepwiki.com/mcp

# List configured
codex mcp list
```

## 网络搜索  

在 `~/.codex/config.toml` 中启用：

```toml
[features]
web_search_request = true

[sandbox_workspace_write]
network_access = true
```

此后 Codex 即可搜索最新文档、API 等信息。

## 最佳实践  

1. **以 `/init` 开始**，生成包含仓库特有指令的 AGENTS.md  
2. **提交前使用 `/review`** 进行 AI 辅助代码审查  
3. **合理设置 `/approvals`** —— 可信仓库用 Auto，探索性任务用 Read Only  
4. **单体仓库（monorepo）请使用 `--add-dir`**，而非 `danger-full-access`  
5. **恢复会话**，以在多次编程会话间保持上下文连续性  
6. **附加图像**，用于 UI 工作、设计规范、错误截图等场景  

## 示例工作流  

### 修复 CI 失败  
```bash
codex exec --full-auto "The CI is failing on the lint step. Fix all ESLint errors."
```

### 重构组件  
```bash
codex exec --cd src/components "Refactor UserProfile.tsx to use React Query instead of useEffect for data fetching"
```

### 根据规格实现功能  
```bash
codex exec -i spec.png --cd ~/projects/app "Implement this feature based on the design spec"
```

### 审查 PR  
```bash
codex exec "Review the diff between main and feature/auth branch. Focus on security issues."
```

## 故障排查  

| 问题 | 解决方案 |
|-------|----------|
| 认证失败 | 运行 `codex logout`，然后运行 `codex login` |
| 命令被阻止 | 检查 `/approvals`，可能需要 `--full-auto` |
| 上下文耗尽 | 使用 `/compact` 进行汇总 |
| 当前目录错误 | 使用 `--cd` 标志，或检查 `/status` |
| 模型不可用 | 确认订阅等级是否支持该模型 |

## 参考资料  

- [Codex CLI 概览](https://developers.openai.com/codex/cli)  
- [Codex CLI 功能说明](https://developers.openai.com/codex/cli/features)  
- [Codex CLI 参考文档](https://developers.openai.com/codex/cli/reference)  
- [斜杠命令指南](https://developers.openai.com/codex/cli/slash-commands)  
- [AGENTS.md 规范](https://agents.md)  
- [Codex GitHub 仓库](https://github.com/openai/codex)  