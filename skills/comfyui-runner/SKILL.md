---
name: comfyui-runner
name_zh: ComfyUI运行器
description: 启动/停止/查询 ComfyUI 实例的状态。
description_zh: 启动/停止/查询 ComfyUI 实例的状态。
metadata: {"clawdbot":{"emoji":"🧩","requires":{"bins":["node","curl"]},"entry":"bin/cli.js"}}
---
# comfyui-runner

## 用途
启动、停止并检查本地 ComfyUI 实例的运行状态。

## 配置
- `COMFYUI_HOST`：ComfyUI 服务器的主机名/IP（默认值为 `192.168.179.111`）。
- `COMFYUI_PORT`：ComfyUI 服务器的端口（默认值为 `28188`）。
- `COMFYUI_USER`：可选的基本认证用户名。
- `COMFYUI_PASS`：可选的基本认证密码。

这些配置可通过环境变量或技能目录下的 `.env` 文件进行设置。

## 使用方法
```json
{
  "action": "run" | "stop" | "status"
}
```

- `run`：若 ComfyUI 服务器尚未运行，则启动它。
- `stop`：停止 ComfyUI 服务器。
- `status`：返回服务器是否可达的结果。

## 示例
```json
{"action": "status"}
```

## 注意事项
本 skill 假设 ComfyUI 可执行文件已位于系统 PATH 中，或与该 skill 处于同一目录下。它使用 `curl` 向 `/health` 端点发起探测请求。