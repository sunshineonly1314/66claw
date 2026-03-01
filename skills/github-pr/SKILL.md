---
name: github-pr
name_zh: GitHub PR
description: 在本地获取、预览、合并及测试 GitHub 拉取请求（PR）。非常适合在 PR 合并前尝试上游变更。
description_zh: 在本地获取、预览、合并及测试 GitHub 拉取请求（PR）。非常适合在 PR 合并前尝试上游变更。
homepage: https://cli.github.com
metadata:
  clawdhub:
    emoji: "🔀"
    requires:
      bins: ["gh", "git"]
---
# GitHub PR 工具

从 GitHub 获取拉取请求（PR）并将其合并至本地分支。适用于以下场景：
- 在 PR 合并前尝试上游变更  
- 将开放 PR 中的功能整合进自己的 fork  
- 在本地测试 PR 的兼容性  

## 前置条件

- 已认证的 `gh` CLI（需运行 `gh auth login`）  
- 已配置远程仓库的 Git 仓库  

## 命令

### 预览一个 PR
```bash
github-pr preview <owner/repo> <pr-number>
```  
显示 PR 标题、作者、状态、变更文件列表、CI 状态以及最近评论。

### 将 PR 分支拉取至本地
```bash
github-pr fetch <owner/repo> <pr-number> [--branch <name>]
```  
将 PR 的 HEAD 提交拉取为本地分支（默认分支名：`pr/<number>`）。

### 将 PR 合并至当前分支
```bash
github-pr merge <owner/repo> <pr-number> [--no-install]
```  
拉取并合并 PR；可选地在合并后执行安装步骤。

### 完整测试流程
```bash
github-pr test <owner/repo> <pr-number>
```  
依次执行：拉取 PR、合并、安装依赖、构建 + 运行测试。

## 示例

```bash
# Preview MS Teams PR from clawdbot
github-pr preview clawdbot/clawdbot 404

# Fetch it locally
github-pr fetch clawdbot/clawdbot 404

# Merge into your current branch
github-pr merge clawdbot/clawdbot 404

# Or do the full test cycle
github-pr test clawdbot/clawdbot 404
```

## 注意事项

- 默认从 `upstream` 远程仓库获取 PR  
- 使用 `--remote <name>` 可指定其他远程仓库  
- 合并冲突需手动解决  
- `test` 命令可自动识别包管理器（npm/pnpm/yarn/bun）