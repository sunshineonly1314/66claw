---
name: plaid
name_zh: Plaid
description: plaid-cli a cli for interacting with the plaid finance platform. link accounts from various institutions, query balances, and transactions by date range listing accounts/balances.
description_zh: plaid-cli a cli for interacting with the plaid finance platform. link accounts from various institutions, query balances, and transactions by date range listing accounts/balances.
metadata: {"clawdis":{"emoji":"💳","requires":{"bins":["plaid-cli"]},"install":[{"id":"go","kind":"go","module":"github.com/jverdi/plaid-cli@0.0.2","bins":["plaid-cli"],"label":"Install plaid-cli (go)"}]}}
---
# Plaid

使用 `plaid-cli` 连接金融机构、获取账户余额，并通过 Plaid 查询指定日期范围内的交易记录。  
切勿打印或记录任何密钥（客户端 ID、密钥、访问令牌）。

安装  
- `go install github.com/jverdi/plaid-cli@0.0.2`

配置  
- 导出环境变量 `PLAID_CLIENT_ID`、`PLAID_SECRET` 和 `PLAID_ENVIRONMENT`（沙箱环境或生产环境）。  
- 可选：设置 `PLAID_LANGUAGE`（支持 en、fr、es、nl），`PLAID_COUNTRIES`（支持 US、CA、GB、IE、ES、FR、NL）。  
- 可选配置文件：`~/.plaid-cli/config.toml`。  
  ```toml
  [plaid]
  client_id = "..."
  secret = "..."
  environment = "sandbox"
  ```  
- 数据目录：`~/.plaid-cli`（用于存储令牌和别名）。

连接机构 + 别名  
- 连接一家金融机构：`plaid-cli link`（将打开浏览器），并可选设置别名。  
- 重新连接：`plaid-cli link <item-id-or-alias>`。  
- 设置别名：`plaid-cli alias <item-id> <name>`，使用 `plaid-cli aliases` 列出全部别名。

账户 + 余额  
- 列出账户及余额：`plaid-cli accounts <item-id-or-alias>`。

查询交易  
- 拉取指定日期范围的交易数据（JSON 格式），然后在本地进行筛选：  
  - `plaid-cli transactions <item-id-or-alias> --from 2024-01-01 --to 2024-01-31 --output-format json`  
  - `jq -r '.[] | select(.name | test("grocery"; "i")) | [.date, .name, .amount] | @tsv'`  
- 使用 `--account-id`（来自 `accounts` 输出）进一步缩小结果范围。  
- 输出格式支持：`json` 或 `csv`。

监控交易  
- 轮询滚动时间窗口，并比对交易 ID 以检测新活动：  
  ```bash
  state=/tmp/plaid.txids
  next=/tmp/plaid.txids.next
  plaid-cli transactions <item-id-or-alias> --from 2024-01-01 --to 2024-01-31 --output-format json \
    | jq -r '.[].transaction_id' | sort > "$next"
  if [ -f "$state" ]; then comm -13 "$state" "$next"; fi
  mv "$next" "$state"
  ```  
- 可配合 cron 进行定时调度。

注意事项  
- 除非明确要求，否则请避免使用 `plaid-cli tokens`（该命令会打印访问令牌）。  
- 当出现 `ITEM_LOGIN_REQUIRED` 错误时，系统将自动触发重新连接流程。

可识别的请求示例：  
- “查询上个月星巴克的交易记录”  
- “显示我的 Chase 账户余额”