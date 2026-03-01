---
name: odds-api-io
name_zh: 赔率校验API
description: 查询 Odds-API.io 的体育赛事、博彩公司及投注赔率（例如：“国际米兰对阵阿森纳的赔率是多少？”、“Paddy the Baddie 对阵 Gaethje 的赔率”）。当你需要调用 Odds-API.io v3 API 或解析其响应时使用；需用户提供 API 密钥。
description_zh: 查询 Odds-API.io 的体育赛事、博彩公司及投注赔率（例如：“国际米兰对阵阿森纳的赔率是多少？”、“Paddy the Baddie 对阵 Gaethje 的赔率”）。当你需要调用 Odds-API.io v3 API 或解析其响应时使用；需用户提供 API 密钥。
---
# Odds-API.io

## 概述
Odds-API.io 可用于搜索赛事并根据赛事 ID 获取赔率。本 skill 包含一个轻量级命令行工具（CLI helper）及一份精简的端点参考文档。

## 快速工作流
1. 通过 `ODDS_API_KEY` 或 `--api-key` 提供 API 密钥（切勿将密钥存储于本 skill 中）。  
2. 如有需要，可查询体育项目和博彩公司列表。  
3. 搜索目标赛事以获取其 ID。  
4. 向指定博彩公司列表请求该赛事的赔率。

```bash
# 1) List sports and bookmakers
python3 odds-api-io/scripts/odds_api.py sports
python3 odds-api-io/scripts/odds_api.py bookmakers

# 2) Search for an event
python3 odds-api-io/scripts/odds_api.py search --query "Inter vs Arsenal" --sport football

# 3) Fetch odds for the chosen event ID
python3 odds-api-io/scripts/odds_api.py odds --event-id 123456 --bookmakers "Bet365,Unibet"

# Optional: one-step search + odds
python3 odds-api-io/scripts/odds_api.py matchup --query "Inter vs Arsenal" --sport football --bookmakers "Bet365,Unibet"
```

## CLI 工具
使用 `scripts/odds_api.py` 发起 API 请求。全局标志（如 `--api-key` 和 `--dry-run`）需置于子命令之前。建议使用 `--dry-run` 在无密钥测试时预览请求 URL。在 `odds` 或 `matchup` 上使用 `--summary` 可获得紧凑格式输出。

## 参考资料
加载 `references/odds-api-reference.md` 可查阅基础 URL、各端点摘要及响应字段说明。