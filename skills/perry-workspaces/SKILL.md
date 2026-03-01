---
name: perry-workspaces
name_zh: Perry 工作区
description: 在您的 tailnet 上创建并管理隔离的 Docker 工作区，其中已预装 Claude Code 和 OpenCode。适用于操作 Perry 工作区、连接编码 agent 或管理远程开发环境。
description_zh: 在您的 tailnet 上创建并管理隔离的 Docker 工作区，其中已预装 Claude Code 和 OpenCode。适用于操作 Perry 工作区、连接编码 agent 或管理远程开发环境。
---
# Perry 工作区

在您的 tailnet 上运行的隔离式 Docker 工作区，已预装编码 agent。

## 命令
```bash
perry start <name> --clone git@github.com:user/repo.git  # Create
perry ls                                                  # List
perry stop <name>                                         # Stop
perry remove <name>                                       # Delete
perry shell <name>                                        # Interactive shell
```

## SSH 访问
```bash
ssh workspace@<name>        # User is always 'workspace'
ssh workspace@<IP>          # Use IP if MagicDNS fails
```

## 编码 agent
- **OpenCode**: `http://<workspace>:4096`（Web 界面）或通过 CLI 连接
- **Claude Code**: 在工作区 shell 中运行（`perry shell` 后执行 `claude`）

## 项目位置
项目克隆至 `~/<name>`，而非 `/workspace`：
```bash
cd ~/my-project  # Correct
```

## 故障排查
- **无法访问**：检查 `tailscale status`，改用 IP 地址而非主机名
- **SSH 失败**：用户必须为 `workspace`，而非您的本地用户
- **启动缓慢**：请通过 Web 界面查看进度