---
name: polymarket
name_zh: Polymarket
description: 查询 Polymarket 预测市场 —— 查看赔率、热门市场、搜索事件、追踪价格  
description_zh: 查询 Polymarket 预测市场 —— 查看赔率、热门市场、搜索事件、追踪价格
homepage: https://polymarket.com  
metadata: {"clawdbot":{"emoji":"📊"}}  
---
# Polymarket

查询 [Polymarket](https://polymarket.com) 预测市场。查看赔率、发现热门市场、搜索相关事件。

## 支持命令

```bash
# Trending/active markets
python3 {baseDir}/scripts/polymarket.py trending

# Search markets
python3 {baseDir}/scripts/polymarket.py search "trump"
python3 {baseDir}/scripts/polymarket.py search "bitcoin"

# Get specific market by slug
python3 {baseDir}/scripts/polymarket.py event "fed-decision-in-october"

# Get markets by category
python3 {baseDir}/scripts/polymarket.py category politics
python3 {baseDir}/scripts/polymarket.py category crypto
python3 {baseDir}/scripts/polymarket.py category sports
```

## 示例对话用法

- “特朗普赢得 2028 年大选的概率是多少？”  
- “Polymarket 上有哪些热门市场？”  
- “在 Polymarket 中搜索比特币”  
- “美联储利率决议的价差是多少？”  
- “有哪些值得关注的加密货币市场？”  

## 输出内容

市场信息包含：  
- 问题/标题  
- 当前赔率（Yes/No 价格）  
- 成交量  
- 结算日期  

## API

使用公开的 Gamma API（读取无需身份验证）：  
- 基础 URL：`https://gamma-api.polymarket.com`  
- 文档：https://docs.polymarket.com  

## 注意事项

本技能为只读模式。交易需通过钱包身份验证（当前未实现）。  