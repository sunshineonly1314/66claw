---
name: watch-my-money
name_zh: 财务追踪
description: 分析银行交易流水、自动归类消费、跟踪月度预算、识别超支及异常行为。输出交互式 HTML 报告。
description_zh: 分析银行交易流水、自动归类消费、跟踪月度预算、识别超支及异常行为。输出交互式 HTML 报告。
triggers:
  - "track spending"（跟踪支出）
  - "check my budget"（检查我的预算）
  - "analyze transactions"（分析交易流水）
  - "what did I spend on"（我在哪方面花了钱）
  - "am I overspending"（我是否超支了）
  - "budget tracker"（预算追踪器）
  - "spending analysis"（支出分析）
  - "monthly expenses"（月度开销）
formats:
  - CSV 银行导出文件
  - 纯文本交易列表
outputs:
  - 交互式 HTML 报告
  - JSON 数据导出
  - 控制台摘要
privacy: local-only（仅限本地处理）
---
# watch-my-money

分析交易流水、归类消费、跟踪预算、标记超支行为。

## 工作流程

### 1. 获取交易数据

向用户索取银行/信用卡 CSV 导出文件，或粘贴纯文本交易列表。

常见来源：
- 从银行网上银行门户下载 CSV 文件
- 从记账类 App 导出数据
- 复制粘贴账单中的交易记录

支持格式：
- 任意含日期、描述、金额三列的 CSV 文件
- 纯文本格式示例："2026-01-03 Starbucks -5.40 CHF"

### 2. 解析与标准化

读取输入数据，并统一转换为标准格式：
- 自动识别分隔符（逗号、分号、制表符）
- 解析日期（支持 YYYY-MM-DD、DD/MM/YYYY、MM/DD/YYYY 等格式）
- 标准化金额（支出为负值，收入为正值）
- 从描述中提取商户名称
- 识别周期性交易（如订阅服务）

### 3. 交易归类

为每笔交易分配所属类别：

**可用类别：**
- rent（房租）、utilities（公用事业）、subscriptions（订阅服务）、groceries（食品杂货）、eating_out（外出就餐）
- transport（交通）、travel（旅行）、shopping（购物）、health（医疗）
- income（收入）、transfers（转账）、other（其他）

归类顺序如下：
1. 查找已保存的商户覆盖规则
2. 应用确定性关键词规则（参见 [common-merchants.md](references/common-merchants.md)）
3. 模式匹配（如订阅服务、公用事业类特征）
4. 启发式兜底规则

对模糊商户（每次批量 5–10 笔），向用户发起确认请求；确认后保存覆盖规则供后续使用。

### 4. 预算核查

将实际支出与用户自定义预算进行比对。

预警阈值：
- 80% — 接近限额（黄色）
- 100% — 达到限额（红色）
- 120% — 超出预算（红色，紧急）

参见 [budget-templates.md](references/budget-templates.md) 获取推荐预算模板。

### 5. 异常检测

标记异常消费行为：
- 类别突增：某类支出 > 基线值 1.5 倍，且绝对增量 > 50 CHF
- 订阅增长：订阅类支出同比上升 > 20%
- 新出现高价商户：首次出现且单笔支出 > 30 CHF
- 潜在订阅：固定金额、周期性重复扣款

基线值 = 过去 3 个月平均值（若无历史数据，则采用当月值）。

### 6. 生成 HTML 报告

创建本地 HTML 文件，包含以下内容：
- 月度概览（收入、支出、净额）
- 按类别划分的支出明细及预算执行状态
- 消费金额最高的商户 Top 列表
- 预警信息汇总区
- 已识别的周期性交易
- 隐私开关（可模糊显示金额/商户名）

基于 [template.html](assets/template.html) 模板注入数据生成。

### 7. 保存状态

持久化存储至 `~/.watch_my_money/`：
- `state.json` — 预算设置、商户覆盖规则、历史记录
- `reports/YYYY-MM.json` — 机器可读的月度数据
- `reports/YYYY-MM.html` — 交互式 HTML 报告

## CLI 命令

```bash
# Analyze CSV
python -m watch_my_money analyze --csv path/to/file.csv --month 2026-01

# Analyze from stdin
cat transactions.txt | python -m watch_my_money analyze --stdin --month 2026-01 --default-currency CHF

# Compare months
python -m watch_my_money compare --months 2026-01 2025-12

# Set budget
python -m watch_my_money set-budget --category groceries --amount 500 --currency CHF

# View budgets
python -m watch_my_money budgets

# Export month data
python -m watch_my_money export --month 2026-01 --out summary.json

# Reset all state
python -m watch_my_money reset-state
```

## 输出结构

控制台输出内容包括：
- 月度概览（收入/支出/净额）
- 各类别支出 vs 预算对照表
- 已识别的周期性交易
- 消费金额最高的前 5 名商户
- 预警信息（以项目符号形式列出）

生成的文件包括：
- `~/.watch_my_money/state.json`
- `~/.watch_my_money/reports/2026-01.json`
- `~/.watch_my_money/reports/2026-01.html`

## HTML 报告功能特性

- 可折叠的类别分区
- 预算进度条
- 周期性交易列表
- 月度环比对比图表
- 隐私开关（模糊敏感信息）
- 暗色模式（适配系统偏好设置）
- 悬浮操作按钮（FAB）
- 截图友好型布局
- 自动隐藏空类别区块

## 隐私保护

所有数据均保留在本地，不发起任何网络请求，不调用外部 API。  
交易数据仅在本地完成分析，并仅存储于 `~/.watch_my_money/`。