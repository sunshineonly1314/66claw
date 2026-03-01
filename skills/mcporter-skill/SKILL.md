---
name: mcporter-skill
description: 使用 mcporter CLI 直接列出、配置、认证并调用 MCP 服务器/工具（HTTP 或 stdio 协议），包括临时服务器、配置编辑以及 CLI/类型生成。
description_zh: 使用 mcporter CLI 直接列出、配置、认证并调用 MCP 服务器/工具（HTTP 或 stdio 协议），包括临时服务器、配置编辑以及 CLI/类型生成。
homepage: https://github.com/pdxfinder/mcporter
metadata: {"clawdbot":{"emoji":"🔌","os":["darwin","linux","windows"],"requires":{"bins":["mcporter"]},"install":[{"id":"brew","kind":"brew","formula":"pdxfinder/tap/mcporter","bins":["mcporter"],"label":"安装 mcporter（Homebrew）"}]}}
---

# mcporter

使用 `mcporter` 管理 MCP（Model Context Protocol）服务器和工具。

## 要求
- 已安装 `mcporter` CLI（通过 Homebrew 安装：`brew install pdxfinder/tap/mcporter`）
- MCP 服务器配置位于 `~/.config/mcporter/`

## 常用命令

### 列出已配置的服务器
```bash
mcporter list
```

### 认证
```bash
mcporter auth --help
```

### 调用 MCP 工具
```bash
mcporter call <server-name> <tool-name> [arguments...]
```

### 生成 CLI / 类型
```bash
mcporter generate cli <server-name>
mcporter generate types <server-name>
```

### 配置管理
```bash
mcporter config --help
```

## 备注
- mcporter 支持 HTTP 和 stdio 两种协议的 MCP 服务器
- 支持创建临时服务器
- CLI 生成会为 MCP 工具创建带类型的封装器
- 使用 `exec` 工具运行 mcporter 命令