---
name: exe-dev
name_zh: EXE开发
description: 管理 exe.dev 上的持久化虚拟机。创建 VM、配置 HTTP 代理、共享访问权限、设置自定义域名。适用于在 exe.dev VM 上进行托管、开发或运行持久化服务的场景。
description_zh: 管理 exe.dev 上的持久化虚拟机。创建 VM、配置 HTTP 代理、共享访问权限、设置自定义域名。适用于在 exe.dev VM 上进行托管、开发或运行持久化服务的场景。
author: Benjamin Jesuiter
---
> ⚠️ **Warning:** This skill was auto-built by clawdbot from the exe.dev markdown documentation. It's not tested yet — use with caution! I plan to test it soon. 🔜

# exe.dev 虚拟机管理

## 快捷命令

| 任务 | 命令 |
|------|------|
| 列出所有 VM | `ssh exe.dev ls --json` |
| 创建 VM | `ssh exe.dev new` |
| 设为公开 | `ssh exe.dev share set-public <vm>` |
| 更改端口 | `ssh exe.dev share port <vm> <port>` |
| 添加用户 | `ssh exe.dev share add <vm> <email>` |
| 生成共享链接 | `ssh exe.dev share add-link <vm>` |

## 访问地址

- **VM 地址**：`https://<vmname>.exe.xyz/`
- **Shelley agent**：`https://<vmname>.exe.xyz:9999/`
- **VSCode 远程连接**：`vscode://vscode-remote/ssh-remote+<vmname>.exe.xyz/home/exedev`

## 代理配置

默认端口由 Dockerfile 中的 EXPOSE 指令自动选取；如需修改，请使用：
```bash
ssh exe.dev share port <vmname> <port>
```

可通过 `https://vmname.exe.xyz:<port>/` 访问 3000–9999 范围内的端口。

## 身份认证请求头（Authentication Headers）

当用户通过 exe.dev 完成身份认证时：
- `X-ExeDev-UserID` — 用户标识符
- `X-ExeDev-Email` — 用户邮箱

测试时，可使用 mitmproxy 注入请求头：
```bash
mitmdump --mode reverse:http://localhost:8000 --listen-port 3000 \
  --set modify_headers='/~q/X-ExeDev-Email/user@example.com'
```

## 自定义域名

- **子域名**：CNAME `app.example.com` → `vmname.exe.xyz`
- **根域名（Apex）**：ALIAS `example.com` → `exe.xyz` + CNAME `www` → `vmname.exe.xyz`

## 完整参考文档

详见 [references/exe-dev-vm-service.md](exe-dev-vm-service.md)，其中包含完整文档，涵盖定价信息、Shelley agent 配置、SSH 密钥设置及常见问题解答（FAQ）。