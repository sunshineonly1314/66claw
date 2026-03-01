---
name: expense-tracker-pro
name_zh: 费用追踪专业版
description: 通过自然语言记录支出、获取消费汇总、设定预算
description_zh: 通过自然语言记录支出、获取消费汇总、设定预算
author: clawd-team
version: 1.0.0
triggers:
  - "log expense"
  - "track spending"
  - "what did I spend"
  - "budget check"
  - "expense report"
---
# Expense Tracker Pro（高级记账工具）

以自然对话方式追踪您的支出。无需安装 App，也无需电子表格——只需告诉 Clawd 您花了多少钱。

## 功能说明

从自然语言输入中解析并记录支出（例如：“在杂货店花了 $45”），自动归类、按预算跟踪，并按需提供消费汇总报告。所有数据均持久化保存在您本地的 Clawd 内存中。

## 使用方法

**记录一笔支出：**  
```
"Spent $23.50 on lunch"
"$150 for electricity bill"
"Coffee $4.75"
```

**查询消费情况：**  
```
"What did I spend this week?"
"Show my food expenses this month"
"Am I over budget on entertainment?"
```

**设定预算：**  
```
"Set grocery budget to $400/month"
"Budget $100 for entertainment"
```

**获取报表：**  
```
"Monthly expense breakdown"
"Compare spending to last month"
"Export expenses to CSV"
```

## 分类体系

根据上下文自动识别以下类别：
- 食品与餐饮（Food & Dining）
- 交通出行（Transportation）
- 公共事业（Utilities）
- 娱乐休闲（Entertainment）
- 购物消费（Shopping）
- 医疗健康（Health）
- 订阅服务（Subscriptions）
- 其他（Other）

如需手动指定分类，请使用格式：  
“花了 $50 在 [物品]，分类：[类别]”

## 使用提示

- 金额请尽量明确，以确保统计准确  
- 对于订阅类支出，请注明“recurring”（例如：“$15 Netflix，每月 recurring”）  
- 可询问 “spending trends”（消费趋势）以获取长期消费洞察  
- 所有数据均仅保存在您的本地设备上，绝不上传