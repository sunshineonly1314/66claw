---
name: mcp-atlassian
name_zh: Atlassian MCP
description: 在 Docker 中运行 Model Context Protocol（MCP）Atlassian 服务端，实现与 Jira、Confluence 等 Atlassian 产品的集成。适用于需要查询 Jira 问题、搜索 Confluence 或以编程方式与 Atlassian 服务交互的场景。需具备 Docker 环境及有效的 Jira API 凭据。
description_zh: 在 Docker 中运行 Model Context Protocol（MCP）Atlassian 服务端，实现与 Jira、Confluence 等 Atlassian 产品的集成。适用于需要查询 Jira 问题、搜索 Confluence 或以编程方式与 Atlassian 服务交互的场景。需具备 Docker 环境及有效的 Jira API 凭据。
---
# MCP Atlassian

## 概述

MCP Atlassian 服务端通过 Model Context Protocol（模型上下文协议）为 Jira 及其他 Atlassian 服务提供程序化访问能力。使用你的 Jira 凭据在 Docker 中运行该服务，即可查询问题、管理项目，并与 Atlassian 工具交互。

## 快速启动

拉取并运行容器，同时传入你的 Jira 凭据：

```bash
docker pull ghcr.io/sooperset/mcp-atlassian:latest

docker run --rm -i \
  -e JIRA_URL=https://your-company.atlassian.net \
  -e JIRA_USERNAME=your.email@company.com \
  -e JIRA_API_TOKEN=your_api_token \
  ghcr.io/sooperset/mcp-atlassian:latest
```

**使用脚本（更便捷）：**

运行附带的脚本，并传入你的 API Token：

```bash
JIRA_API_TOKEN=your_token bash scripts/run_mcp_atlassian.sh
```

## 环境变量

- **JIRA_URL**：你的 Atlassian 实例地址（例如：`https://company.atlassian.net`）  
- **JIRA_USERNAME**：你的 Jira 邮箱地址  
- **JIRA_API_TOKEN**：你的 Jira API Token（请在 [账户设置 → 安全](https://id.atlassian.com/manage-profile/security/api-tokens) 中创建）

## 在 Clawdbot 中使用 MCP Atlassian

服务运行后，MCP 服务端将暴露 Jira 工具供调用。请在 Clawdbot 配置中将该容器注册为 MCP 数据源，即可直接从你的 agent 查询问题、创建任务或管理 Jira。

## 资源

### scripts/
- **run_mcp_atlassian.sh** —— 简化版运行脚本，内置凭据处理逻辑