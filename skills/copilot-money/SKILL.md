---
name: copilot-money
name_zh: Copilot Money
description: 查询 Copilot Money 个人财务数据（账户、交易、净资产、持仓、资产配置），并刷新银行连接。当用户询问财务状况、账户余额、近期交易、净资产、投资配置，或希望同步/刷新银行数据时使用。
description_zh: 查询 Copilot Money 个人财务数据（账户、交易、净资产、持仓、资产配置），并刷新银行连接。当用户询问财务状况、账户余额、近期交易、净资产、投资配置，或希望同步/刷新银行数据时使用。
---
# Copilot Money CLI

[Copilot Money](https://copilot.money)（一款个人理财应用）的命令行接口。只需认证一次，即可在终端中查询账户、交易、持仓及资产配置数据。

> **Note:** This is an unofficial tool and is not affiliated with Copilot Money.

## 安装

```bash
pip install copilot-money-cli
```

## 快速上手

```bash
copilot-money config init
copilot-money accounts
copilot-money networth
```

## 命令

```bash
copilot-money refresh                     # Refresh all bank connections
copilot-money accounts                    # List accounts with balances
copilot-money accounts --type CREDIT      # Filter by type
copilot-money accounts --json             # Output as JSON
copilot-money transactions                # Recent transactions (default 20)
copilot-money transactions --count 50     # Specify count
copilot-money networth                    # Assets, liabilities, net worth
copilot-money holdings                    # Investment holdings (grouped by type)
copilot-money holdings --group account    # Group by account
copilot-money holdings --group symbol     # Group by symbol
copilot-money holdings --type ETF         # Filter by security type
copilot-money allocation                  # Stocks/bonds with US/Intl split
copilot-money config show                 # Show config and token status
copilot-money config init                 # Auto-detect token from browsers
copilot-money config init --source chrome # From specific browser
copilot-money config init --source manual # Manual token entry
```

## 认证

配置文件存储于 `~/.config/copilot-money/config.json`。CLI 可在 macOS 上自动检测您浏览器中保存的 Copilot Money 刷新令牌。

- 自动检测：`copilot-money config init`  
- 显式指定来源：`copilot-money config init --source arc|chrome|safari|firefox`  
- 手动输入：`copilot-money config init --source manual`  

使用浏览器自动检测时，CLI 会读取浏览器本地 IndexedDB 存储以查找您的 Copilot Money 会话令牌。该过程完全在本地执行 —— 除向 Copilot Money 的 API 发送外，不会将任何数据发送至其他地方。

## 要求

- Python 3.10+  
- macOS（用于浏览器令牌提取；手动输入令牌可在任意平台使用）  