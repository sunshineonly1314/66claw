---
name: yahoo-finance
name_zh: 雅虎财经
description: 使用 Yahoo Finance 获取股票价格、行情、基本面、财报、期权、分红及分析师评级等数据。基于 yfinance 库实现，无需 API 密钥。
description_zh: 使用 Yahoo Finance 获取股票价格、行情、基本面、财报、期权、分红及分析师评级等数据。基于 yfinance 库实现，无需 API 密钥。
---
# Yahoo Finance CLI

一款基于 Python 的命令行工具，借助 yfinance 库从 Yahoo Finance 获取全面的股票数据。

## 要求

- Python 3.11+  
- uv（用于内联脚本依赖管理）  

## 安装 uv

该脚本依赖 `uv` —— 一款极快的 Python 包管理器。请检查是否已安装：

```bash
uv --version
```

若未安装，请任选以下方式之一进行安装：

### macOS / Linux  
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### macOS（Homebrew）  
```bash
brew install uv
```

### Windows  
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### pip（任意平台）  
```bash
pip install uv
```

安装完成后，请重启终端，或运行：  
```bash
source ~/.bashrc  # or ~/.zshrc on macOS
```

## 安装

`yf` 脚本采用 PEP 723 内联脚本元数据规范 —— 依赖项将在首次运行时自动安装。

```bash
# Make executable
chmod +x /path/to/skills/yahoo-finance/yf

# Optionally symlink to PATH for global access
ln -sf /path/to/skills/yahoo-finance/yf /usr/local/bin/yf
```

首次运行将把依赖（yfinance、rich）安装至 uv 缓存。后续运行则瞬时完成。

## 命令

### 价格（快速查看）  
```bash
yf AAPL              # shorthand for price
yf price AAPL
```

### 行情（详细）  
```bash
yf quote MSFT
```

### 基本面  
```bash
yf fundamentals NVDA
```  
显示：市盈率（PE）、每股收益（EPS）、市值、利润率、净资产收益率（ROE）/总资产收益率（ROA）、分析师目标价。

### 财报  
```bash
yf earnings TSLA
```  
显示：下次财报发布日期、每股收益（EPS）预期值、带盈利惊喜的历史财报记录。

### 公司概况  
```bash
yf profile GOOGL
```  
显示：所属行业、细分领域、员工人数、官网、地址、业务简介。

### 分红  
```bash
yf dividends KO
```  
显示：股息率/股息收益率、除息日、派息比率、近期分红历史。

### 分析师评级  
```bash
yf ratings AAPL
```  
显示：买入/持有/卖出分布、平均评级、近期上调/下调记录。

### 期权链  
```bash
yf options SPY
```  
显示：近平价认购（call）与认沽（put）期权，含行权价、买卖盘报价、成交量、未平仓合约量（OI）、隐含波动率（IV）。

### 历史行情  
```bash
yf history GOOGL 1mo     # 1 month history
yf history TSLA 1y       # 1 year
yf history BTC-USD 5d    # 5 days
```  
可选周期：1d、5d、1mo、3mo、6mo、1y、2y、5y、10y、ytd、max  

### 对比  
```bash
yf compare AAPL,MSFT,GOOGL
yf compare RELIANCE.NS,TCS.NS,INFY.NS
```  
并排对比：价格、涨跌幅、52 周区间、市值。

### 搜索  
```bash
yf search "reliance industries"
yf search "bitcoin"
yf search "s&p 500 etf"
```

## 代码格式说明

- **美国股票：** AAPL、MSFT、GOOGL、TSLA  
- **印度国家证券交易所（NSE）：** RELIANCE.NS、TCS.NS、INFY.NS  
- **印度孟买证券交易所（BSE）：** RELIANCE.BO、TCS.BO  
- **加密货币：** BTC-USD、ETH-USD  
- **外汇：** EURUSD=X、GBPUSD=X  
- **ETF：** SPY、QQQ、VOO  

## 示例

```bash
# Quick price check
yf AAPL

# Get valuation metrics
yf fundamentals NVDA

# Next earnings date + history
yf earnings TSLA

# Options chain for SPY
yf options SPY

# Compare tech giants
yf compare AAPL,MSFT,GOOGL,META,AMZN

# Find Indian stocks
yf search "infosys"

# Dividend info for Coca-Cola
yf dividends KO

# Analyst ratings for Apple
yf ratings AAPL
```

## 故障排查

### “command not found: uv”  
请按上方说明安装 uv。

### 请求限频 / 连接错误  
Yahoo Finance 可能对高频请求实施限频。请等待几分钟后重试。

### 某代码返回“无数据”  
- 请确认代码有效：`yf search "company name"`  
- 部分数据（如期权、分红）并非所有证券均提供  

## 技术说明

- 使用 PEP 723 内联脚本元数据管理 uv 依赖项  
- Rich 库提供带颜色、格式化的表格输出  
- 首次运行安装依赖至 uv 缓存（约 5 秒）  
- 后续运行瞬时完成（缓存环境）  
- 对 NaN / None 值做健壮处理，并提供合理回退机制  