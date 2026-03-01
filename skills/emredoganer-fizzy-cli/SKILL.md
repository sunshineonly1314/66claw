---
name: emredoganer-fizzy-cli
name_zh: Fizzy CLI
description: 通过 TypeScript 编写的 CLI 工具，结合 Personal Access Token 管理 Fizzy 看板（boards）、卡片（cards）、评论（comments）、标签（tags）和步骤（steps）。适用于需在终端中创建或管理 Fizzy 卡片，或将 Fizzy 自动化集成至 Clawdbot 工作流的场景。
description_zh: 通过 TypeScript 编写的 CLI 工具，结合 Personal Access Token 管理 Fizzy 看板（boards）、卡片（cards）、评论（comments）、标签（tags）和步骤（steps）。适用于需在终端中创建或管理 Fizzy 卡片，或将 Fizzy 自动化集成至 Clawdbot 工作流的场景。
---
# Fizzy CLI

本仓库包含一个独立运行的 CLI 工具。

## 安装

```bash
npm i -g @emredoganer/fizzy-cli
```

## 认证（Auth）

在 Fizzy 中生成 Personal Access Token：

```bash
fizzy auth login
```

（系统将提示您输入令牌。）