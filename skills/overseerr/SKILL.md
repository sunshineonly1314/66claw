---
name: overseerr
name_zh: Overseerr
description: 通过 Overseerr API 请求电影/电视剧并监控请求状态（面向稳定版 Overseerr，非测试版 Seerr 重写项目）。
description_zh: 通过 Overseerr API 请求电影/电视剧并监控请求状态（面向稳定版 Overseerr，非测试版 Seerr 重写项目）。
homepage: https://overseerr.dev/
metadata: {"clawdbot":{"emoji":"🍿","requires":{"bins":["node"],"env":["OVERSEERR_URL","OVERSEERR_API_KEY"]},"primaryEnv":"OVERSEERR_API_KEY"}}
---
# Overseerr

与本地/自托管的 Overseerr 实例交互（支持搜索、请求及状态查询）。

注意：本 skill 面向当前稳定项目 **Overseerr**，而非处于测试阶段的新版 “Seerr” 重写项目。

## 设置

配置环境变量（推荐通过 Clawdbot 配置文件设置）：

- `OVERSEERR_URL`（示例：`http://localhost:5055`）
- `OVERSEERR_API_KEY`（设置 → 常规 → API 密钥）

## 搜索

```bash
node {baseDir}/scripts/search.mjs "the matrix"
node {baseDir}/scripts/search.mjs "bluey" --type tv
node {baseDir}/scripts/search.mjs "dune" --limit 5
```

## 请求

```bash
# movie
node {baseDir}/scripts/request.mjs "Dune" --type movie

# tv (optionally all seasons, default)
node {baseDir}/scripts/request.mjs "Bluey" --type tv --seasons all

# request specific seasons
node {baseDir}/scripts/request.mjs "Severance" --type tv --seasons 1,2

# 4K request
node {baseDir}/scripts/request.mjs "Oppenheimer" --type movie --is4k
```

## 状态查询

```bash
node {baseDir}/scripts/requests.mjs --filter pending
node {baseDir}/scripts/requests.mjs --filter processing --limit 20
node {baseDir}/scripts/request-by-id.mjs 123
```

## 监控（轮询）

```bash
node {baseDir}/scripts/monitor.mjs --interval 30 --filter pending
```

备注：
- 本 skill 使用 `X-Api-Key` 认证方式。
- Overseerr 亦可通过 Webhook 推送更新；轮询是一种简易的基础实现方式。