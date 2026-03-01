---
name: flyio-cli-public
name_zh: Fly.io CLI
description: "使用 Fly.io 的 flyctl CLI 在 Fly.io 上部署和运维应用：支持部署（本地或远程构建器）、查看状态/日志、SSH/控制台访问、密钥/配置管理、扩缩容、虚拟机（machines）、卷（volumes）以及 Fly Postgres（创建/绑定/管理数据库）。当被要求将应用部署至 Fly.io、调试 fly deploy/build/runtime 失败、设置 GitHub Actions 部署/预览环境，或安全地管理 Fly 应用与 Postgres 数据库时，请使用本技能。"
description_zh: 使用 Fly.io 的 flyctl CLI 在 Fly.io 上部署和运维应用：支持部署（本地或远程构建器）、查看状态/日志、SSH/控制台访问、密钥/配置管理、扩缩容、虚拟机（machines）、卷（volumes）以及 Fly Postgres（创建/绑定/管理数据库）。当被要求将应用部署至 Fly.io、调试 fly deploy/build/runtime 失败、设置 GitHub Actions 部署/预览环境，或安全地管理 Fly 应用与 Postgres 数据库时，请使用本技能。
---
# Fly.io（flyctl）CLI

使用 `flyctl` 安全、可重复地运维 Fly.io 应用。

## 常见任务

- 部署：`fly deploy` / `fly deploy --remote-only`
- 日志：`fly logs -a <app>`
- SSH / 执行命令：`fly ssh console -a <app> -C "…"`
- 密钥（secrets）：`fly secrets list/set -a <app>`
- Postgres：`fly postgres list/connect/db create/attach`
- GitHub Actions 部署 / PR 预览

## 默认行为 / 安全准则

- 优先执行**只读**命令：`fly status`、`fly logs`、`fly config show`、`fly releases`、`fly secrets list`。
- **未经用户明确批准，不得运行任何会改变状态的 Fly.io 命令**（例如：deploy/扩缩容、密钥 set/unset、卷/数据库 create/drop、应用 destroy、attach/detach）。
  - 只读操作无需批准即可执行。
  - 破坏性操作（destroy/drop）始终需要用户明确批准。
- 调试时，请将故障归类为：构建/打包阶段问题、运行时问题，或平台层问题。

## 快速入门（典型部署流程）

在应用代码仓库目录中执行：

1) 确认目标应用
- `fly app list`
- `fly status -a <app>`
- 检查 `fly.toml` 中的 `app = "..."`

2) 部署
- `fly deploy`（默认方式）
- `fly deploy --remote-only`（当本地 Docker/构建环境不一致时常用）

3) 验证
- `fly status -a <app>`
- `fly logs -a <app>`
- `fly open -a <app>`

## 调试部署/构建失败

### 常见检查项
- `fly deploy --verbose`（获取更详细的构建日志）
- 若使用 Dockerfile 构建：请确认 Dockerfile 中声明的 Ruby 版本及 Gemfile.lock 中指定的平台与构建器所用操作系统/架构匹配。

### Rails + Docker + 原生 gem（如 nokogiri、pg 等）
现象：构建过程中 Bundler 无法找到适用于当前平台的 gem，例如 `nokogiri-…-x86_64-linux`。

修复模式：
- 确保 `Gemfile.lock` 包含 Fly 构建器所用的 Linux 平台（通常为 `x86_64-linux`）。
  - 示例：`bundle lock --add-platform x86_64-linux`
- 确保 Dockerfile 中指定的 Ruby 版本与 `.ruby-version` 一致。

（参见 `references/rails-docker-builds.md`。）

## 日志、SSH、控制台

- 实时流式输出日志：
  - `fly logs -a <app>`
- SSH 控制台：
  - `fly ssh console -a <app>`
- 执行一次性命令：
  - `fly ssh console -a <app> -C "bin/rails db:migrate"`

## 密钥（secrets）/ 配置

- 列出密钥：
  - `fly secrets list -a <app>`
- 设置密钥：
  - `fly secrets set -a <app> KEY=value OTHER=value`
- 查看配置：
  - `fly config show -a <app>`

## Fly Postgres 基础操作

### 识别 Postgres 应用
- `fly postgres list`

### 将 Postgres 绑定至应用
- `fly postgres attach <pg-app> -a <app>`

### 在集群内创建数据库
- `fly postgres db create <db_name> -a <pg-app>`
- `fly postgres db list -a <pg-app>`

### 连接（psql）
- `fly postgres connect -a <pg-app>`

## GitHub Actions 部署 / 预览

- 生产环境持续交付（CD）：使用 Fly 官方 GitHub Action（`superfly/flyctl-actions/setup-flyctl`），并运行 `fly deploy`（通常配合 `--remote-only` 使用）。
- PR 预览环境：
  - 推荐为每个 PR 创建一个**独立的预览应用**，并在共享的 Fly Postgres 集群中为每个 PR 创建一个**独立数据库**。
  - 自动化实现：PR 创建时自动创建/部署/评论；PR 关闭时自动销毁。

（参见 `references/github-actions.md`。）

## 内置资源

- `references/rails-docker-builds.md`：Rails/Docker/Fly 构建失败模式及修复方案。
- `references/github-actions.md`：Fly 部署与预览工作流。
- `scripts/fly_app_from_toml.sh`：一个轻量辅助工具，用于从 fly.toml 中打印 Fly 应用名称。