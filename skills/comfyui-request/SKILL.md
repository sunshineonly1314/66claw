---
name: comfyui-request
name_zh: ComfyUI请求
description: 向 ComfyUI 发送工作流请求，并返回图像结果。
description_zh: 向 ComfyUI 发送工作流请求，并返回图像结果。
metadata: {"clawdbot":{"emoji":"🧩","requires":{"bins":["node","curl"]},"entry":"bin/cli.js"}}
---
# comfyui-request

## 用途
向正在运行的 ComfyUI 实例发送工作流请求，并返回生成图像的 URL 或 base64 数据。

## 配置
- `COMFYUI_HOST`：ComfyUI 服务器的主机名/IP（默认值为 `192.168.179.111`）。
- `COMFYUI_PORT`：ComfyUI 服务器的端口（默认值为 `28188`）。
- `COMFYUI_USER`：可选的基本认证用户名。
- `COMFYUI_PASS`：可选的基本认证密码。

这些配置可通过环境变量或技能目录下的 `.env` 文件进行设置。

## 使用方法
```json
{
  "action": "run",
  "workflow": { ... }   // JSON workflow object
}
```

该 skill 将向 `http://{host}:{port}/run` 发起 POST 请求，并返回响应 JSON。

## 示例
```json
{
  "action": "run",
  "workflow": {
    "nodes": [ ... ],
    "edges": [ ... ]
  }
}
```

## 注意事项
该 skill 假定 ComfyUI 服务器已暴露 `/run` 端点，且返回的 JSON 对象中包含一个 `image` 字段，其值为图像 URL 或 base64 字符串。