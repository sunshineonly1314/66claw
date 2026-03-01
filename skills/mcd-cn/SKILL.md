---
name: mcd-cn
name_zh: MCD-CN
description: 通过 mcd-cn CLI 查询麦当劳中国 MCP 服务器，获取活动日历、优惠券及自动申领功能。可用于面向人类的优惠券查询，或输出 JSON 格式供脚本调用。
description_zh: 通过 mcd-cn CLI 查询麦当劳中国 MCP 服务器，获取活动日历、优惠券及自动申领功能。可用于面向人类的优惠券查询，或输出 JSON 格式供脚本调用。
homepage: https://github.com/ryanchen01/mcd-cn
metadata: {"clawdbot":{"emoji":"🍟","requires":{"bins":["mcd-cn"],"env":["MCDCN_MCP_TOKEN"]},"primaryEnv":"MCDCN_MCP_TOKEN","install":[{"id":"brew","kind":"brew","formula":"ryanchen01/tap/mcd-cn","bins":["mcd-cn"],"label":"Install mcd-cn (brew)"}]}}

---
# mcd-cn

麦当劳中国 MCP 命令行工具（CLI）。默认输出面向人类可读格式，`--json` 用于脚本调用。

安装

- Homebrew：`brew install ryanchen01/tap/mcd-cn`

配置

- `MCDCN_MCP_TOKEN` 为必需项。请从麦当劳中国 MCP 控制台获取。
- 可选：`MCDCN_MCP_URL` 用于自定义服务器 URL。

常用命令

- 活动日历：`mcd-cn campaign-calender`
- 指定日期的日历：`mcd-cn campaign-calender --specifiedDate 2025-12-09`
- 可用优惠券：`mcd-cn available-coupons`
- 自动申领优惠券：`mcd-cn auto-bind-coupons`
- 我的优惠券：`mcd-cn my-coupons`
- 当前时间：`mcd-cn now-time-info`
- JSON 输出：`mcd-cn available-coupons --json`

注意事项

- Token 可通过 `MCDCN_MCP_TOKEN` 环境变量或 `.env` 文件设置。
- `--specifiedDate` 所用日期格式为 `yyyy-MM-dd`。
- 速率限制：每个 Token 每分钟最多 600 次请求。