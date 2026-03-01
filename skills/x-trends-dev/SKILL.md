---
name: x-trends-dev
name_zh: X趋势开发版
description: "利用公开聚合服务，获取任意国家当前 X（Twitter）热门话题榜。"
description_zh: 利用公开聚合服务，获取任意国家当前 X（Twitter）热门话题榜。
version: 1.2.0
author: Ani
license: MIT
---
# X 热门趋势爬虫 📉

一款专业命令行工具，无需账号即可获取 X（Twitter）热门话题。  
由 [getdaytrends.com](https://getdaytrends.com) 提供支持。

## 安装

```bash
clawdhub install x-trends
```

## 使用方法

直接运行该工具：

```bash
# Default (India, Top 20, Table View)
x-trends

# JSON Output (for scripts)
x-trends --json

# Specific Country & Limit
x-trends --country us --limit 5
```

## 功能特性
- **无需登录**：依赖公开聚合服务。  
- **热度数据**：显示推文数量（如 <10K、50K 等）。  
- **多国支持**：涵盖 'us'、'uk'、'india'、'world' 等。  
- **JSON 模式**：便于其他工具解析。

## 输出结果
呈现整洁、彩色编码的表格，或原始 JSON 数据。