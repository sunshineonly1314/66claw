---
name: value-tracker
description: 追踪并量化您的 AI assistant 所创造的价值。统计节省的工时，按类别应用差异化费率计算 ROI，并切实证明其影响。
description_zh: 追踪并量化您的 AI assistant 所创造的价值。统计节省的工时，按类别应用差异化费率计算 ROI，并切实证明其影响。
---
# Value Tracker Skill

追踪并量化您的 AI assistant 所创造的价值。统计节省的工时，按类别应用差异化费率计算 ROI，并切实证明其影响。

## 为何这至关重要

AI assistant 能节省时间，但具体节省多少？本 skills 可追踪：
- **每项任务节省的工时**
- **按类别应用特定费率所计算出的价值**（战略类工作 ≠ 运营类工作）
- **随时间推移的 ROI**（支持按日/周/月汇总）

## 快速上手

```bash
# Log a task manually
./tracker.py log tech "Set up Toast API integration" -H 2

# Auto-detect category from description
./tracker.py log auto "Researched competitor pricing strategies" -H 1.5

# View summaries
./tracker.py summary today
./tracker.py summary week
./tracker.py summary month

# Generate markdown report
./tracker.py report week > weekly-value-report.md

# Export JSON for dashboards
./tracker.py export --format json
```

## 类别与默认费率

| 类别 | 默认费率 | 适用场景 |
|----------|--------------|---------|
| strategy | $150/小时 | 规划、决策、高层级思考 |
| research | $100/小时 | 市场调研、分析、深度研究 |
| finance | $100/小时 | 财务分析、报表、预测 |
| tech | $85/小时 | 集成、自动化、脚本编写 |
| sales | $75/小时 | CRM 管理、销售漏斗、外联 |
| marketing | $65/小时 | 内容创作、社交媒体、营销活动 |
| ops | $50/小时 | 邮件分拣、日程安排、常规事务 |

编辑 `config.json` 以根据您的实际场景自定义费率。

## 自动识别关键词

使用 `log auto` 时，skills 将基于关键词自动识别任务所属类别：

- **strategy**: plan（规划）、strategy（战略）、decision（决策）、roadmap（路线图）、vision（愿景）
- **research**: research（调研）、analyze（分析）、competitor（竞品）、market（市场）、study（研究）
- **finance**: financial（财务）、budget（预算）、forecast（预测）、revenue（收入）、cost（成本）
- **tech**: api（API）、integration（集成）、script（脚本）、automation（自动化）、code（代码）、setup（配置）
- **sales**: crm（客户关系管理）、pipeline（销售漏斗）、deal（交易）、lead（潜在客户）、prospect（目标客户）、outreach（外联）
- **marketing**: content（内容）、social（社交）、campaign（活动）、post（帖子）、newsletter（简报）
- **ops**: email（邮件）、calendar（日历）、schedule（日程）、meeting（会议）、triage（分拣）

## 配置方法

请编辑 `config.json`：

```json
{
  "currency": "$",
  "default_rate": 75,
  "rates_by_category": {
    "strategy": 150,
    "research": 100,
    "finance": 100,
    "tech": 85,
    "sales": 75,
    "marketing": 65,
    "ops": 50
  }
}
```

## 数据存储

所有任务数据均保存在 skills 目录下的 `data.json` 文件中。请定期备份该文件。

## 与仪表盘集成

使用 `tracker.py export` 可获取适用于 Web 仪表盘或其他工具的 JSON 格式输出。

## 使用提示

1. **保持一致性** — 完成任务后立即记录  
2. **善用自动识别** — 比手动选择类别更快捷  
3. **每周回顾** — 累积的价值增长速度远超您的预期  
4. **自定义费率** — 匹配您真实的每小时成本或价值  

## 示例输出

```
📊 Value Summary (This Week)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Hours:  12.5h
Total Value:  $1,087
Avg Rate:     $87/hr

By Category:
  🎯 strategy    2.0h    $300
  🔍 research    3.5h    $350
  ⚙️ tech        4.0h    $340
  🔧 ops         3.0h    $150

Top Tasks:
  • Competitor analysis deep dive (3.5h)
  • Toast API integration (2.0h)
  • Q2 planning session (2.0h)
```

---

*交付价值，追踪价值，证实价值。*