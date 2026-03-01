---
name: ynab
name_zh: YNAB
description: 通过命令行界面（CLI）管理 YNAB 预算、账户、分类和交易。
description_zh: 通过命令行界面（CLI）管理 YNAB 预算、账户、分类和交易。
metadata: {"clawdbot":{"emoji":"💰","requires":{"bins":["ynab"],"env":["YNAB_API_KEY"]},"primaryEnv":"YNAB_API_KEY","install":[{"id":"node","kind":"node","package":"@stephendolan/ynab-cli","bins":["ynab"],"label":"安装 ynab-cli（npm）"}]}}
---
# YNAB CLI

安装  
```bash
npm i -g @stephendolan/ynab-cli
```

认证  
```bash
# Get API key from https://app.ynab.com/settings/developer
# Then set YNAB_API_KEY env var, or:
ynab auth login
ynab auth status
```

预算  
```bash
ynab budgets list
ynab budgets view [id]
ynab budgets set-default <id>
```

账户  
```bash
ynab accounts list
ynab accounts view <id>
ynab accounts transactions <id>
```

分类  
```bash
ynab categories list
ynab categories view <id>
ynab categories transactions <id>
ynab categories budget <id> --month <YYYY-MM> --amount <amount>
```

交易  
```bash
ynab transactions list
ynab transactions list --account <id> --since <YYYY-MM-DD>
ynab transactions list --approved=false --min-amount 100
ynab transactions search --memo "coffee"
ynab transactions search --payee-name "Amazon"
ynab transactions view <id>
ynab transactions create --account <id> --amount <amount> --date <YYYY-MM-DD>
ynab transactions update <id> --amount <amount>
ynab transactions delete <id>
ynab transactions split <id> --splits '[{"amount": -50.00, "category_id": "xxx"}]'
```

收款方（Payees）  
```bash
ynab payees list
ynab payees view <id>
ynab payees update <id> --name <name>
ynab payees transactions <id>
```

月份  
```bash
ynab months list
ynab months view <YYYY-MM>
```

计划交易（Scheduled）  
```bash
ynab scheduled list
ynab scheduled view <id>
ynab scheduled delete <id>
```

原始 API（Raw API）  
```bash
ynab api GET /budgets
ynab api POST /budgets/{budget_id}/transactions --data '{"transaction": {...}}'
```

注意事项  
- 金额单位为预算所用货币，而非 milliunits（千分之一单位）  
- 使用 `--compact` 获取压缩后的 JSON 输出  
- 速率限制：200 次请求/小时  
- 无法通过 API 创建分类、分组或收款方  