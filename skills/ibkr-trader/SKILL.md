---
name: ibkr-trading
name_zh: IBKR交易员
description: 通过 Client Portal API 实现 Interactive Brokers（IBKR）交易自动化。适用于配置 IBKR 账户访问、认证会话、查询投资组合/持仓，或构建交易机器人。支持 IBeam 自动登录及 IBKR Key 双因素认证（2FA）。
description_zh: 通过 Client Portal API 实现 Interactive Brokers（IBKR）交易自动化。适用于配置 IBKR 账户访问、认证会话、查询投资组合/持仓，或构建交易机器人。支持 IBeam 自动登录及 IBKR Key 双因素认证（2FA）。
---
# IBKR 交易技能

使用 Client Portal 网关 API 实现 Interactive Brokers 交易自动化。

## 概述

本 skill 支持：
- 通过 IBeam + IBKR Key 实现 IBKR 自动化认证  
- 投资组合与持仓监控  
- 订单提交与管理  
- 自定义交易策略开发  

## 先决条件

- IBKR 账户（实盘或模拟盘）  
- 手机已安装 IBKR Key 应用（用于双因素认证）  
- Linux 服务器，已安装 Java 11+ 及 Chrome/Chromium  

## 快速设置

### 1. 安装依赖项

```bash
# Java (for Client Portal Gateway)
sudo apt-get install -y openjdk-17-jre-headless

# Chrome + ChromeDriver (for IBeam)
sudo apt-get install -y chromium-browser chromium-chromedriver

# Virtual display (headless auth)
sudo apt-get install -y xvfb

# Python venv
python3 -m venv ~/trading/venv
source ~/trading/venv/bin/activate
pip install ibeam requests
```

### 2. 下载 Client Portal 网关

```bash
cd ~/trading
wget https://download2.interactivebrokers.com/portal/clientportal.gw.zip
unzip clientportal.gw.zip -d clientportal
```

### 3. 配置凭据

创建 `~/trading/.env`：
```bash
IBEAM_ACCOUNT=your_username
IBEAM_PASSWORD='your_password'
IBEAM_GATEWAY_DIR=/path/to/trading/clientportal
IBEAM_CHROME_DRIVER_PATH=/usr/bin/chromedriver
IBEAM_TWO_FA_SELECT_TARGET="IB Key"
```

## 认证

### 启动网关并认证

```bash
# 1. Start Client Portal Gateway
cd ~/trading/clientportal && bash bin/run.sh root/conf.yaml &

# 2. Wait for startup (~20 sec)
sleep 20

# 3. Run IBeam authentication
cd ~/trading
source venv/bin/activate
source .env
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 &
python -m ibeam --authenticate
```

**重要提示：** 用户须在约 2 分钟内于手机上批准 IBKR Key 推送通知！

### 检查认证状态

```bash
curl -sk https://localhost:5000/v1/api/iserver/auth/status
```

认证成功响应中包含 `"authenticated": true`。

## API 使用

### 账户信息

```bash
# List accounts
curl -sk https://localhost:5000/v1/api/portfolio/accounts

# Account summary
curl -sk "https://localhost:5000/v1/api/portfolio/{accountId}/summary"
```

### 持仓

```bash
# Current positions
curl -sk "https://localhost:5000/v1/api/portfolio/{accountId}/positions/0"
```

### 市场数据

```bash
# Search for symbol
curl -sk "https://localhost:5000/v1/api/iserver/secdef/search?symbol=AAPL"

# Get quote (after searching)
curl -sk "https://localhost:5000/v1/api/iserver/marketdata/snapshot?conids=265598&fields=31,84,86"
```

### 下单

```bash
curl -sk -X POST "https://localhost:5000/v1/api/iserver/account/{accountId}/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [{
      "conid": 265598,
      "orderType": "MKT",
      "side": "BUY",
      "quantity": 1,
      "tif": "DAY"
    }]
  }'
```

## 会话管理

会话有效期约为 24 小时。可选方案如下：

1. **保活定时任务（keepalive cron）** —— 每 5 分钟向 `/v1/api/tickle` 发送一次 ping  
2. **自动重认证（auto re-auth）** —— 会话过期时运行 IBeam（需手机批准）

### 保活脚本

```python
import requests
import urllib3
urllib3.disable_warnings()

def keepalive():
    try:
        r = requests.post("https://localhost:5000/v1/api/tickle", verify=False, timeout=10)
        status = requests.get("https://localhost:5000/v1/api/iserver/auth/status", verify=False, timeout=10)
        return status.json().get("authenticated", False)
    except:
        return False
```

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| 网关无响应 | 检查 Java 进程是否运行：`ps aux \| grep GatewayStart` |
| 登录超时 | 用户未及时批准 IBKR Key —— 请重试认证 |
| 连接被拒绝 | 网关未启动 —— 运行 `bin/run.sh root/conf.yaml` |
| Chrome 错误 | 确保 Xvfb 正在运行：`Xvfb :99 &` 和 `export DISPLAY=:99` |

## 文件参考

完整 API 文档请参阅 `references/api-endpoints.md`。  
开箱即用的自动化脚本请参阅 `scripts/`。