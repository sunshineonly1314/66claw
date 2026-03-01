---
name: simmer-weather
name_zh: 天气简报
description: 通过 Simmer API 利用 NOAA 天气预报交易 Polymarket 天气市场。灵感源自 gopfan2 的超 200 万美元策略。
description_zh: 通过 Simmer API 利用 NOAA 天气预报交易 Polymarket 天气市场。灵感源自 gopfan2 的超 200 万美元策略。
metadata: {"clawdbot":{"emoji":"🌡️","requires":{"env":["SIMMER_API_KEY"]},"cron":"0 */2 * * *"}}
authors:
  - Simmer (@simmer_markets)
attribution: "策略灵感源自 gopfan2"
---
# Simmer 天气交易

利用 NOAA 天气预报数据交易 Polymarket 上的气温市场。

## 何时使用本 skill

当用户希望执行以下操作时，请使用本 skill：
- 自动交易天气市场
- 搭建类似 gopfan2 的气温交易策略
- 在天气预测价格低位时买入
- 查询其天气交易头寸
- 自定义交易阈值或目标城市

## 配置流程

当用户请求安装或配置本 skill 时：

1. **索取 Simmer API 密钥**
   - 用户可从 simmer.markets/dashboard → SDK 标签页获取
   - 将密钥存入环境变量 `SIMMER_API_KEY`

2. **询问配置项（或确认默认值）**
   - 入场阈值：买入时机（默认 15¢）
   - 离场阈值：卖出时机（默认 45¢）
   - 单笔头寸上限：每笔交易金额（默认 $2.00）
   - 目标城市：参与交易的城市列表（默认 NYC）

3. **将配置保存至环境变量**
   - `SIMMER_WEATHER_ENTRY` — 入场阈值（例如 "0.15" 表示 15¢）
   - `SIMMER_WEATHER_EXIT` — 离场阈值（例如 "0.45" 表示 45¢）
   - `SIMMER_WEATHER_MAX_POSITION` — 单笔交易上限（例如 "2.00"）
   - `SIMMER_WEATHER_LOCATIONS` — 逗号分隔的城市列表（例如 "NYC,Chicago"）

4. **配置定时任务（cron）**
   - 默认每 2 小时运行一次
   - 用户可按需调整运行频率

## 配置说明

所有设置均可通过环境变量自定义：

| 设置项 | 环境变量 | 默认值 | 描述 |
|---------|---------------------|---------|-------------|
| 入场阈值 | `SIMMER_WEATHER_ENTRY` | 0.15 | 当市场价格低于该值时买入（0.15 = 15¢） |
| 离场阈值 | `SIMMER_WEATHER_EXIT` | 0.45 | 当市场价格高于该值时卖出（0.45 = 45¢） |
| 单笔头寸上限 | `SIMMER_WEATHER_MAX_POSITION` | 2.00 | 每笔交易最高美元金额 |
| 目标城市 | `SIMMER_WEATHER_LOCATIONS` | NYC | 逗号分隔的城市列表（例如：NYC,Chicago,Miami,Seattle,Dallas,Atlanta） |

**支持的城市：**
- NYC（纽约 — 拉瓜迪亚机场）
- Chicago（芝加哥 — 奥黑尔机场）
- Seattle（西雅图 — 波音机场）
- Atlanta（亚特兰大 — 哈茨菲尔德机场）
- Dallas（达拉斯 — 达拉斯/沃斯堡机场）
- Miami（迈阿密 — 迈阿密国际机场）

查看当前配置，请运行：
```bash
python weather_trader.py --config
```

## 工作原理

每次执行周期中，脚本将：
1. 从 Simmer API 获取当前活跃的天气市场（带 “weather” 标签）
2. 按事件（event）对市场进行分组（每个气温日期构成一个事件，含多个温度区间 bucket）
3. 解析事件名称以提取城市和日期信息
4. 获取对应城市/日期的 NOAA 天气预报
5. 找出与预报气温最匹配的温度区间（bucket）
6. **入场逻辑**：若该区间价格低于入场阈值，则通过 Simmer SDK 执行 BUY 操作
7. **离场逻辑**：检查当前持仓，若价格高于离场阈值则执行卖出
8. 向用户报告执行结果

## 运行 skill

**执行一次扫描：**
```bash
python weather_trader.py
```

**模拟运行（不执行真实交易）：**
```bash
python weather_trader.py --dry-run
```

**仅查询当前持仓：**
```bash
python weather_trader.py --positions
```

**查看当前配置：**
```bash
python weather_trader.py --config
```

## 结果报告

每次运行结束后，向用户发送如下信息：
- 当前配置
- 发现的天气市场数量
- 各城市的 NOAA 天气预报
- 入场机会（及已执行的交易）
- 离场机会（及已执行的卖出）
- 当前持仓情况

可供分享的示例输出：
```
🌤️ Weather Trading Scan Complete

Configuration: Entry <15¢, Exit >45¢, Max $2.00, Locations: NYC

Found 12 active weather markets across 4 events

NYC Jan 28: NOAA forecasts 34°F (high)
→ Bucket "34-35°F" trading at $0.12
→ Below 15¢ threshold - BUY opportunity!
→ Executed: Bought 16.6 shares @ $0.12 ($2.00)

Checked 2 open positions:
→ NYC Jan 27 "32-33°F" @ $0.52 - SELL opportunity!
→ Executed: Sold 15.0 shares @ $0.52

Summary: 1 buy, 1 sell executed
Next scan in 2 hours.
```

## 示例对话

**用户：“设置天气交易”**  
→ 引导用户完成配置流程：  
1. 索取 API 密钥  
2. 索取入场阈值（建议默认值 15¢）  
3. 索取离场阈值（建议默认值 45¢）  
4. 索取单笔头寸上限（建议默认值 $2）  
5. 索取目标城市（默认 NYC，可追加其他城市）  
6. 保存配置并设置定时任务  

**用户：“运行我的天气 skill”**  
→ 立即执行脚本并汇报结果  

**用户：“我的天气交易目前如何？”**  
→ 使用 `--positions` 参数运行脚本并汇总结果  

**用户：“让策略更激进些”**  
→ 解释当前阈值，并提供如下选项：  
- 将入场阈值提高至 20¢（增加交易机会）  
- 将单笔头寸上限提高至 $5（扩大单笔交易规模）  
→ 更新对应环境变量  

**用户：“在我的天气交易中加入芝加哥”**  
→ 将 SIMMER_WEATHER_LOCATIONS 更新为包含 Chicago  
→ 示例："NYC,Chicago"  

**用户：“我当前的设置是什么？”**  
→ 使用 `--config` 参数运行脚本并展示配置  

**用户：“将我的离场阈值改为 50 美分”**  
→ 将 SIMMER_WEATHER_EXIT 更新为 "0.50"  

## 故障排查

**“未找到天气市场”**  
- 天气市场可能尚未开放（具有季节性）  
- 请访问 simmer.markets 查看是否存在天气市场  

**“API 密钥无效”**  
- 请确认已正确设置 SIMMER_API_KEY 环境变量  
- 可前往 simmer.markets/dashboard → SDK 标签页重新获取密钥  

**“NOAA 请求失败”**  
- NOAA API 可能触发了速率限制，请等待几分钟后重试  
- 请检查 weather.gov 是否可正常访问  

**“单笔头寸过小，不足以购买 5 份合约”**  
- Polymarket 要求每笔订单至少 5 份合约  
- 请增大 SIMMER_WEATHER_MAX_POSITION 数值，或等待市场价格进一步降低  

**“价格低于最小报价单位”**  
- 市场价格处于极端水平（接近 0% 或 100%）  
- 此类市场将被自动跳过，以避免异常  