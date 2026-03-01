---
name: basecamp-cli
name_zh: Basecamp CLI
description: 通过 TypeScript 编写的 CLI 管理 Basecamp（通过 bc3 API / 37signals Launchpad）项目、待办事项、消息和 Campfire。当您希望从终端列出/创建/更新 Basecamp 项目与待办事项，或在 Clawdbot 工作流中集成 Basecamp 自动化时使用。
description_zh: 通过 TypeScript 编写的 CLI 管理 Basecamp（通过 bc3 API / 37signals Launchpad）项目、待办事项、消息和 Campfire。当您希望从终端列出/创建/更新 Basecamp 项目与待办事项，或在 Clawdbot 工作流中集成 Basecamp 自动化时使用。
---
# Basecamp CLI

本仓库包含一个独立的 CLI。

## 安装

```bash
npm i -g @emredoganer/basecamp-cli
```

## 认证

在 37signals Launchpad 中创建一个集成（OAuth 应用）：
- https://launchpad.37signals.com/integrations

然后执行：
```bash
basecamp auth configure --client-id <id> --redirect-uri http://localhost:9292/callback
export BASECAMP_CLIENT_SECRET="<secret>"
basecamp auth login
```

## 注意事项

- 本工具使用 Basecamp 官方发布的 bc3-api 文档：https://github.com/basecamp/bc3-api
- `BASECAMP_CLIENT_SECRET` 故意不被 CLI 存储到磁盘上。