---
name: github-pat
name_zh: GitHub个人令牌
description: 使用个人访问令牌（PAT）与 GitHub 交互。安全、由用户控制的访问方式——无需 OAuth，也不需要完整的账户访问权限。支持克隆、推送、分支管理、拉取请求（PR）和议题（issues）。当用户希望操作 GitHub 仓库时使用。
description_zh: 使用个人访问令牌（PAT）与 GitHub 交互。安全、由用户控制的访问方式——无需 OAuth，也不需要完整的账户访问权限。支持克隆、推送、分支管理、拉取请求（PR）和议题（issues）。当用户希望操作 GitHub 仓库时使用。
---
# GitHub PAT

使用个人访问令牌（PAT）与 GitHub 交互。用户通过 PAT 的作用域（scopes）控制访问权限。

## 设置

用户提供其 PAT：
```
1. Create PAT at github.com/settings/tokens
2. Select scopes (repo for full, public_repo for public only)
3. Provide token to agent
```

存储于 TOOLS.md 中，或通过 `--token` 传入。

## 命令

```bash
# List repos you have access to
python3 scripts/gh.py repos [--token TOKEN]

# Clone a repo
python3 scripts/gh.py clone owner/repo [--token TOKEN]

# Create branch
python3 scripts/gh.py branch <branch-name> [--repo owner/repo]

# Commit and push
python3 scripts/gh.py push "<message>" [--branch branch] [--repo owner/repo]

# Open a pull request
python3 scripts/gh.py pr "<title>" [--body "description"] [--base main] [--head branch]

# Create an issue
python3 scripts/gh.py issue "<title>" [--body "description"] [--repo owner/repo]

# View repo info
python3 scripts/gh.py info owner/repo
```

## 安全模型

- **用户控制访问权限**：通过 PAT 作用域实现  
- **不使用 OAuth**：不会出现“允许完全访问”类提示  
- **最小权限原则**：用户仅创建满足需求的最少作用域 PAT  
- **支持细粒度 PAT**：可为特定仓库配置精确访问权限  

## 令牌存储

Agent 将令牌存储在 TOOLS.md 的 `### GitHub` 小节中。切勿在日志或消息中暴露该令牌。