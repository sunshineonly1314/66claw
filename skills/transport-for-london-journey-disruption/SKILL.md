---
name: tfl-journey-disruption
name_zh: 伦敦交通行程中断
description: 规划伦敦交通局（TfL）行程（起始地/目的地/时间），解析地点（优先使用邮编），并预警行程中断情况；遇中断时建议替代路线。
description_zh: 规划伦敦交通局（TfL）行程（起始地/目的地/时间），解析地点（优先使用邮编），并预警行程中断情况；遇中断时建议替代路线。
---
# TfL行程规划 + 中断预警

当用户需要TfL行程规划并关注中断信息时，请使用本skills。

参考文档：https://tfl.gov.uk/info-for/open-data-users/api-documentation

## 脚本辅助工具

使用 `scripts/tfl_journey_disruptions.py` 快速获取行程+中断检查结果。

示例：

```bash
python3 scripts/tfl_journey_disruptions.py \"940GZZLUSTD\" \"W1F 9LD\" --depart-at 0900
python3 scripts/tfl_journey_disruptions.py --from \"Stratford\" --to \"W1F 9LD\" --arrive-by 1800
```

注意事项：  
- 若API返回歧义选项，请任选其一，并使用其 `parameterValue` 参数重试。  
- 若您拥有TfL API密钥，请在环境中设置 `TFL_APP_ID` 和 `TFL_APP_KEY`。

## 需收集的输入项  

- 出发地：邮编、车站/站点名称、地点名称，或经纬度（lat,lon）  
- 目的地：邮编、车站/站点名称、地点名称，或经纬度（lat,lon）  
- 时间与意图：“出发于”或“到达于”（若未明确说明日期，则需额外询问）  
- 可选：若用户提及，需收集交通方式或无障碍通行限制条件  

若上述任一项缺失或存在歧义，请向用户请求澄清。

## 地点解析  

优先使用邮编；否则解析地点名称与车站：  

- 若输入形如英国邮编，则直接作为 `{from}` 或 `{to}` 使用。  
- 若输入为经纬度，则直接使用。  
- 若输入为车站或站点名称，请调用 `StopPoint/Search/{query}`，并选择枢纽站或对应的NaPTAN ID。  
- 若搜索或行程结果返回歧义选项，请展示顶部几个选项（通用名称 + parameterValue），并请用户选择。  
- 不确定时，请提问澄清，切勿自行猜测。

## 行程规划  

调用接口：  

`/Journey/JourneyResults/{from}/to/{to}?date=YYYYMMDD&time=HHMM&timeIs=Depart|Arrive`  

规范：  
- 若用户说“到达于”，则使用 `timeIs=Arrive`；否则默认使用 `Depart`。  
- 若未提供日期，请主动询问；若用户暗示“现在”，则可省略日期/时间参数。

## 提取候选路线  

从响应中选取前1–3条行程。对每条行程，提取：  
- 总耗时与预计到达时间  
- 公共交通段（交通方式、线路名称、方向）  
- 用于中断检查的线路ID  

线路ID通常出现在 `leg.routeOptions[].lineIdentifier.id` 或 `leg.line.id` 中。步行段请忽略。

## 中断检查  

对每条行程，收集唯一线路ID，并调用：  

`/Line/{ids}/Status`  

若任一线路状态非“正常运营”或包含中断原因，则判定该路线受中断影响。汇总中断严重程度与原因。

必要时，可针对具体车站调用 `/StopPoint/{id}/Disruption` 检查车站专属问题。

## 响应策略  

- 若首选路线无中断，推荐该路线，并说明“当前未发现活跃中断”。  
- 若首选路线中断，首先发出警告，再从其余行程中推荐1–2条替代路线。  
- 若所有路线均中断，仍推荐最优路线，但需列出中断警告与替代方案。  
- 若行程计划在未来（今日稍晚或其他日期），需注明中断状态为当前状态，出行时可能变化（例如：“当前轻微延误；早间出行时可能已改变”）。  
- 始终邀请用户确认所选路线或提供进一步澄清。