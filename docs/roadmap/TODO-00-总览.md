# 待办事项总览

> 基于全量代码 Review 筛选出的**未修复**改进项。
> 已修复的 5 项见 `docs/bugs/` 目录（标记为 DONE）。

## 已完成 (本次稳定版)

| # | 问题 | 文件 | 状态 |
|---|------|------|------|
| 1 | 设备指纹回退使用随机UUID不稳定 | device-id.ts | DONE |
| 2 | 授权缓存损坏后无法恢复离线模式 | offline.ts | DONE |
| 3 | 心跳连续失败无升级告警 | heartbeat.ts | DONE |
| 4 | 设备ID同步失败静默吞没错误 | device-id.ts | DONE |
| 5 | CLI JSON.parse 无友好报错 | gateway-cli/register.ts | DONE |

## 未完成待办（按优先级排列）

### P1 — 建议下个迭代修复

| # | 文件 | 说明 |
|---|------|------|
| T-01 | TODO-01-缓存治理.md | 去重缓存、Webhook缓存、模型目录缓存等无 TTL |
| T-02 | TODO-02-国际化统一.md | 错误消息中英混用、i18n默认语言硬编码 |
| T-03 | TODO-03-大文件拆分.md | setup-wizard 2155行等多个文件超标 |
| T-10 | TODO-10-MCP-hotload-context-optimization.md | MCP 热加载：按任务动态启停 MCP server，节省上下文 ~17k tokens |

### P2 — 后续迭代逐步改善

| # | 文件 | 说明 |
|---|------|------|
| T-04 | TODO-04-安全加固.md | 路径遍历防护、Token弃用清理、License key格式校验 |
| T-05 | TODO-05-扩展插件改进.md | 企微提及检测、插件ID校验、Bundled列表硬编码 |
| T-06 | TODO-06-前端UI改进.md | localStorage保护、剪贴板兼容、状态管理拆分 |
| T-07 | TODO-07-可观测性增强.md | 魔法数字提取、全局错误日志标志、诊断日志优化 |


### P0 — 核心基础设施

| # | 文件 | 说明 |
|---|------|------|
| T-12 | TODO-12-daily-upstream-merge-automation.md | 每日上游合并自动化：Git merge driver + GitHub Actions 流水线 + CN CI 验证 |
