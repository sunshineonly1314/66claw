---
name: hokipoki
name_zh: Hokipoki
description: "使用 HokiPoki CLI，在不切换标签页的前提下切换 AI 模型。当某一模型卡住时，可在 Claude、Codex 和 Gemini 之间快速切换。适用于以下场景：用户希望向另一 AI 模型寻求帮助、跳转至另一 AI、获取另一模型的第二意见、切换模型、与团队成员共享 AI 订阅，或管理 HokiPoki 的提供方/监听模式。触发关键词包括：'use codex/gemini for this'（为此使用 Codex/Gemini）、'hop to another model'（跳转至另一模型）、'ask another AI'（向另一 AI 提问）、'get a second opinion'（获取第二意见）、'switch models'（切换模型）、'hokipoki'、'listen for requests'（监听请求）。"
description_zh: 使用 HokiPoki CLI，在不切换标签页的前提下切换 AI 模型。当某一模型卡住时，可在 Claude、Codex 和 Gemini 之间快速切换。适用于以下场景：用户希望向另一 AI 模型寻求帮助、跳转至另一 AI、获取另一模型的第二意见、切换模型、与团队成员共享 AI 订阅，或管理 HokiPoki 的提供方/监听模式。触发关键词包括：'use codex/gemini for this'（为此使用 Codex/Gemini）、'hop to another model'（跳转至另一模型）、'ask another AI'（向另一 AI 提问）、'get a second opinion'（获取第二意见）、'switch models'（切换模型）、'hokipoki'、'listen for requests'（监听请求）。
---
# HokiPoki 技能

通过 HokiPoki 点对点（P2P）网络，将任务路由至不同 AI CLI（Claude、Codex、Gemini）。API 密钥永不离开提供方（provider）机器；仅交换加密后的请求与结果。

## 前置条件

HokiPoki CLI 必须已安装并完成认证：

```bash
npm install -g @next-halo/hokipoki-cli
hokipoki login
```

使用 `hokipoki whoami` 验证。若尚未安装，请引导用户完成安装配置。

## 向另一 AI 请求帮助

向远程 AI 模型发送任务。始终使用 `--json` 获取可解析的输出：

```bash
# Specific files
hokipoki request --tool claude --task "Fix the auth bug" --files src/auth.ts --json

# Entire directory
hokipoki request --tool codex --task "Add error handling" --dir src/services/ --json

# Whole project (respects .gitignore)
hokipoki request --tool gemini --task "Review for security issues" --all --json

# Route to a team workspace
hokipoki request --tool claude --task "Optimize queries" --files src/db.ts --workspace my-team --json

# Skip auto-apply (just save the patch)
hokipoki request --tool codex --task "Refactor module" --dir src/ --no-auto-apply --json
```

工具选择：若用户未指定工具，请询问其希望使用的模型，或省略 `--tool`，交由 HokiPoki 自动选择。

### 补丁自动应用（Patch Auto-Apply）

当目标目录为已提交文件的 Git 仓库时，补丁将自动应用。若自动应用失败，请通知用户，并建议：

```bash
git init && git add . && git commit -m "initial"
```

## 提供方模式（Provider Mode，共享您的 AI）

注册并监听传入请求：

```bash
# Register as a provider (one-time)
hokipoki register --as-provider --tools claude codex gemini

# Start listening
hokipoki listen --tools claude codex
```

任务将在隔离的 Docker 容器中执行（只读文件系统、tmpfs 工作区、自动清理）。Docker 必须处于运行状态。

## 状态与账户（Status & Account）

```bash
hokipoki whoami      # Current user info
hokipoki status      # Account, workspaces, history
hokipoki dashboard   # Open web dashboard in browser
```

## 何时建议切换模型（When to Suggest Hopping）

- 用户在多次尝试后仍卡在某个问题上
- 用户要求采用不同方法或全新视角
- 任务涉及另一模型更擅长的领域（例如：Codex 更适合生成样板代码，Gemini 更适合大上下文分析）
- 用户明确要求尝试另一 AI

## 完整命令参考

详见 [references/commands.md](references/commands.md)，其中涵盖所有 CLI 选项、认证 token 存储位置及高级用法。