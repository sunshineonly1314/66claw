---
name: vibetunnel
name_zh: Vibetunnel
description: 管理 VibeTunnel 终端会话。创建、列出、监控和控制在 VibeTunnel 网页仪表板中可见的终端会话。
description_zh: 管理 VibeTunnel 终端会话。创建、列出、监控和控制在 VibeTunnel 网页仪表板中可见的终端会话。
homepage: https://github.com/AugmentedMomentum/vibetunnel
metadata: {"clawdbot":{"emoji":"🖥️","requires":{"bins":["vibetunnel","curl","jq"]},"primaryEnv":"VT_URL","install":[{"id":"vibetunnel","kind":"node","package":"vibetunnel","bins":["vibetunnel"],"label":"Install VibeTunnel (npm)"}]}}
---
# VibeTunnel

通过 REST API 管理 [VibeTunnel](https://github.com/AugmentedMomentum/vibetunnel) 终端会话。创建、列出、监控和控制在网页仪表板中可见的会话。

## 设置

VibeTunnel 必须处于运行状态。默认地址：`http://localhost:8080`。可通过 `VT_URL` 环境变量覆盖。

## 健康检查
```bash
curl -s ${VT_URL:-http://localhost:8080}/api/health | jq .
```

## 列出会话
```bash
curl -s ${VT_URL:-http://localhost:8080}/api/sessions | jq .
```

精简视图：
```bash
curl -s ${VT_URL:-http://localhost:8080}/api/sessions | jq -r '.[] | "\(.status | if . == "running" then "●" else "○" end) \(.name) [\(.id | .[0:8])]"'
```

## 创建会话
```bash
curl -s -X POST ${VT_URL:-http://localhost:8080}/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"command": ["zsh", "-l", "-i"], "name": "my-session", "workingDir": "/path/to/dir"}' | jq .
```

参数：
- `command`：数组 — 命令及其参数（默认值：`["zsh", "-l", "-i"]`）
- `name`：字符串 — 显示名称
- `workingDir`：字符串 — 工作目录
- `cols`：数字 — 终端宽度（默认值：120）
- `rows`：数字 — 终端高度（默认值：30）

## 获取会话
```bash
curl -s ${VT_URL:-http://localhost:8080}/api/sessions/<id> | jq .
```

## 删除会话
```bash
curl -s -X DELETE ${VT_URL:-http://localhost:8080}/api/sessions/<id> | jq .
```

## 发送输入
```bash
curl -s -X POST ${VT_URL:-http://localhost:8080}/api/sessions/<id>/input \
  -H "Content-Type: application/json" \
  -d '{"text": "ls -la\n"}' | jq .
```

注意：需包含 `\n` 以执行命令。

## 调整会话尺寸
```bash
curl -s -X POST ${VT_URL:-http://localhost:8080}/api/sessions/<id>/resize \
  -H "Content-Type: application/json" \
  -d '{"cols": 150, "rows": 40}' | jq .
```

## 示例

**启动 Claude Code 会话：**
```bash
curl -s -X POST ${VT_URL:-http://localhost:8080}/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"command": ["claude"], "name": "claude-code", "workingDir": "~/repos/my-project"}' | jq .
```

**启动 tmux 会话：**
```bash
curl -s -X POST ${VT_URL:-http://localhost:8080}/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"command": ["tmux", "new", "-A", "-s", "work"], "name": "tmux-work"}' | jq .
```

**清理已退出的会话：**
```bash
curl -s ${VT_URL:-http://localhost:8080}/api/sessions | jq -r '.[] | select(.status == "exited") | .id' | \
  xargs -I {} curl -s -X DELETE ${VT_URL:-http://localhost:8080}/api/sessions/{}
```

## 环境变量

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `VT_URL` | `http://localhost:8080` | VibeTunnel 服务器 URL |