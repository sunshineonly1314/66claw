---
name: track17
name_zh: Track17
description: 通过 17TRACK API 追踪包裹（本地 SQLite 数据库，支持轮询 + 可选 Webhook 接收）
description_zh: 通过 17TRACK API 追踪包裹（本地 SQLite 数据库，支持轮询 + 可选 Webhook 接收）
user-invocable: true
metadata: {"clawdbot":{"emoji":"📦","requires":{"anyBins":["python3","python"],"env":["TRACK17_TOKEN"]},"primaryEnv":"TRACK17_TOKEN"}}
---
# track17（17TRACK 包裹追踪）

该 skill 使 Clawdbot 能维护一份本地包裹清单，通过 **17TRACK 追踪 API v2.2** 追踪其状态，并汇总变更情况。

所有数据均存储于你的 **workspace** 下的一个小型 **SQLite 数据库** 中（默认路径：`<workspace>/packages/track17/track17.sqlite3`）。

`<workspace>` 会自动识别为距离本 skill 所在目录最近的 `skills/` 目录的父目录。  
例如，若你将其安装于 `/clawd/skills/track17/`，则数据将存储于 `/clawd/packages/track17/`。

## 要求

- 必须设置 `TRACK17_TOKEN`（17TRACK API token；用作 `17token` 请求头）。
- Python（推荐使用 `python3`）。

可选：
- 若需验证 Webhook 签名，请设置 `TRACK17_WEBHOOK_SECRET`。
- 若需自定义数据库/收件箱存放路径，请设置 `TRACK17_DATA_DIR`。
- 若需自定义本工具所认定的工作区（workspace）目录，请设置 `TRACK17_WORKSPACE_DIR`。

## 快速开始

1) 初始化存储（可安全多次执行）：

```bash
python3 {baseDir}/scripts/track17.py init
```

2) 添加一个包裹（向 17TRACK 注册并本地存储）：

```bash
python3 {baseDir}/scripts/track17.py add "RR123456789CN" --label "AliExpress headphones"
```

若承运商自动识别失败，请显式指定承运商代码：

```bash
python3 {baseDir}/scripts/track17.py add "RR123456789CN" --carrier 3011 --label "..."
```

3) 列出已追踪的包裹：

```bash
python3 {baseDir}/scripts/track17.py list
```

4) 轮询更新（如不使用 Webhook，则推荐此方式）：

```bash
python3 {baseDir}/scripts/track17.py sync
```

5) 查看单个包裹详情：

```bash
python3 {baseDir}/scripts/track17.py status 1
# or
python3 {baseDir}/scripts/track17.py status "RR123456789CN"
```

## Webhook（可选）

17TRACK 可将更新推送至 Webhook URL。本 skill 支持两种 Webhook 接收方式：

### A) 运行内置 Webhook 服务器

```bash
python3 {baseDir}/scripts/track17.py webhook-server --bind 127.0.0.1 --port 8789
```

然后将 17TRACK 的 Webhook URL 指向该服务器（建议通过反向代理或 Tailscale Funnel 实现）。

### B) 从标准输入/文件读取 Webhook 负载

```bash
cat payload.json | python3 {baseDir}/scripts/track17.py ingest-webhook
# or
python3 {baseDir}/scripts/track17.py ingest-webhook --file payload.json
```

若你已将 Webhook 投递内容保存至收件箱目录，请运行：

```bash
python3 {baseDir}/scripts/track17.py process-inbox
```

## 常用操作

- 停止追踪：

```bash
python3 {baseDir}/scripts/track17.py stop 1
```

- 重新追踪已停止的包裹：

```bash
python3 {baseDir}/scripts/track17.py retrack 1
```

- 从本地数据库中删除包裹（除非同时调用 `delete-remote`，否则不会在 17TRACK 平台删除）：

```bash
python3 {baseDir}/scripts/track17.py remove 1
```

- 查看 API 配额：

```bash
python3 {baseDir}/scripts/track17.py quota
```

## agent 的操作指南

- 除非用户明确要求 Webhook，否则优先采用 **同步**（轮询）方式以简化流程。
- 添加包裹后，请运行一次 `status`，确认返回了有效的承运商/状态信息。
- 汇总信息时，应优先关注以下几类状态：
  - 已妥投 / 派送中
  - 异常 / 派送失败
  - 海关扣留
  - 承运商交接
- 切勿回显 `TRACK17_TOKEN` 或 `TRACK17_WEBHOOK_SECRET`。