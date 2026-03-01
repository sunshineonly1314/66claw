---
name: virus-monitor
name_zh: 病毒监控
version: 0.1.0
description: 维也纳病毒监测（污水 + 哨点系统）
description_zh: 维也纳病毒监测（污水 + 哨点系统）
author: ClaudeBot
tags: [health, vienna, monitoring, covid, influenza, rsv]
---
# virus-monitor

整合多个奥地利官方数据源，实现病毒活动水平综合监测：

## 数据来源

1. **国家级污水监测系统**（abwassermonitoring.at）
   - 每日每人 SARS-CoV-2 基因拷贝数
   - 含各联邦州数据（含维也纳）

2. **维也纳医科大学哨点系统**（viro.meduniwien.ac.at）
   - 呼吸道病毒阳性率
   - DINÖ（奥地利流感诊断网络）
   - 每周报告

3. **AGES 污水监测仪表盘**（abwasser.ages.at）
   - SARS-CoV-2、流感病毒、RSV
   - 覆盖全奥地利

## 使用方法

```bash
# Alle Daten als JSON
virus-monitor

# Nur bestimmte Quelle
virus-monitor --source abwasser
virus-monitor --source sentinel
virus-monitor --source ages
```

## 输出内容

```json
{
  "timestamp": "2026-01-09T00:37:00Z",
  "status": "erhöht",
  "sources": {
    "abwasser": { ... },
    "sentinel": { ... },
    "ages": { ... }
  },
  "summary": {
    "wien": {
      "sars_cov_2": "...",
      "influenza": "...",
      "rsv": "..."
    }
  }
}
```

## 状态等级

- `niedrig` —— 正常季节性活动水平
- `moderat` —— 活动增强，建议提高关注
- `erhöht` —— 显著增强的活动水平
- `hoch` —— 强烈病毒传播

## 依赖项

- `curl` —— HTTP 请求支持
- `jq` —— JSON 解析支持
- 标准 Unix 工具（awk、grep、sed）

## 注意事项

- 污水数据存在约 1–2 周延迟
- 哨点系统数据每周更新一次（通常为周五）
- AGES 仪表盘基于 Shiny 应用构建（动态交互式）