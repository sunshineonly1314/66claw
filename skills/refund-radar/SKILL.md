---
name: refund-radar
name_zh: 退款雷达
description: 扫描银行对账单以识别循环扣款、标记可疑交易，并借助交互式 HTML 报告草拟退款请求。
description_zh: 扫描银行对账单以识别循环扣款、标记可疑交易，并借助交互式 HTML 报告草拟退款请求。
---
# refund-radar  

扫描银行对账单，识别循环扣款、标记可疑交易、发现重复项与费用项、草拟退款请求模板，并生成交互式 HTML 审计报告。

## 触发词  

- “扫描我的银行对账单以查找可退款项”  
- “分析我的信用卡交易”  
- “在我的对账单中查找循环扣款”  
- “检查是否存在重复或可疑扣款”  
- “协助我申诉某笔扣款”  
- “生成退款请求”  
- “审计我的订阅服务”  

## 工作流程  

### 1. 获取交易数据  

请用户提供银行/信用卡 CSV 导出文件或粘贴的纯文本。常见来源包括：  

- Apple Card：钱包 → 卡余额 → 导出  
- Chase：账户 → 下载活动 → CSV  
- Mint：交易 → 导出  
- 任意银行：从交易历史中下载为 CSV  

或接受粘贴文本格式：  
```
2026-01-03 Spotify -11.99 USD
2026-01-15 Salary +4500 USD
```  

### 2. 解析与标准化  

在其数据上运行解析器：  

```bash
python -m refund_radar analyze --csv statement.csv --month 2026-01
```  

或对粘贴文本：  
```bash
python -m refund_radar analyze --stdin --month 2026-01 --default-currency USD
```  

解析器自动识别：  
- 分隔符（逗号、分号、制表符）  
- 日期格式（YYYY-MM-DD、DD/MM/YYYY、MM/DD/YYYY）  
- 金额格式（单列或借/贷分离）  
- 币种  

### 3. 审查循环扣款  

工具通过以下方式识别循环订阅：  
- 同一商户在 90 天内出现 ≥ 2 次  
- 金额相近（误差 ≤ 5% 或 $2）  
- 扣款周期稳定（每周、每月、每年）  
- 包含已知订阅关键词（如 Netflix、Spotify 等）  

输出内容包括：  
- 商户名称  
- 平均金额与扣款周期  
- 最近一次扣款日期  
- 下一次预计扣款日期  

### 4. 标记可疑扣款  

工具自动标记以下类型：  

| 标记类型 | 触发条件 | 严重性 |  
|----------|-----------|---------|  
| 重复扣款 | 同一商户 + 相同金额，间隔 ≤ 2 天 | HIGH |  
| 金额激增 | 超过基线 1.8 倍，且差额 > $25 | HIGH |  
| 新商户 | 首次出现 + 金额 > $30 | MEDIUM |  
| 类费用扣款 | 关键词（FEE、ATM、OVERDRAFT）+ 金额 > $3 | LOW |  
| 币种异常 | 不常见币种或含 DCC | LOW |  

### 5. 与用户确认  

对已标记项目，按每批 5–10 条向用户提问：  

- 此笔扣款是否属实？  
- 是否应将该商户标记为预期商户？  
- 是否需要为此笔扣款生成退款模板？  

根据用户回答更新状态：  
```bash
python -m refund_radar mark-expected --merchant "Costco"
python -m refund_radar mark-recurring --merchant "Netflix"
```  

### 6. 生成 HTML 报告  

报告保存至 `~/.refund_radar/reports/YYYY-MM.html`  

复制 [template.html](assets/template.html) 的结构。各章节包括：  
- **摘要**：交易总数、总支出、循环扣款数、已标记数  
- **循环扣款**：含商户、金额、周期、下次预计扣款的表格  
- **异常扣款**：已标记项目，含严重性与原因  
- **重复扣款**：同日重复扣款  
- **类费用扣款**：ATM 手续费、外汇手续费、服务费等  
- **退款模板**：可一键复制的邮件/在线客服/银行争议消息  

功能特性：  
- 隐私开关（一键模糊商户名称）  
- 深色/浅色模式  
- 可折叠章节  
- 模板旁设复制按钮  
- 自动隐藏空章节  

### 7. 草拟退款请求  

对每笔已标记扣款，生成三类模板：  
- **邮件**：正式退款请求  
- **在线客服消息**：面向实时支持的简短消息  
- **银行争议申请**：银行争议表单文本  

每类模板提供三种语气变体：  
- 简洁型（默认）  
- 坚定型（assertive）  
- 友好型（polite）  

模板包含：  
- 商户名称与日期  
- 扣款金额  
- 基于标记类型的争议理由  
- 卡号后四位、参考编号等占位符  

**重要提示**：所有生成文本中均不得出现撇号（'）。  

## CLI 参考  

```bash
# Analyze statement
python -m refund_radar analyze --csv file.csv --month 2026-01

# Analyze from stdin
python -m refund_radar analyze --stdin --month 2026-01 --default-currency CHF

# Mark merchant as expected
python -m refund_radar mark-expected --merchant "Amazon"

# Mark merchant as recurring
python -m refund_radar mark-recurring --merchant "Netflix"

# List expected merchants
python -m refund_radar expected

# Reset learned state
python -m refund_radar reset-state

# Export month data
python -m refund_radar export --month 2026-01 --out data.json
```  

## 生成文件  

| 路径 | 用途 |  
|------|------|  
| `~/.refund_radar/state.json` | 存储学习到的偏好设置与商户历史 |  
| `~/.refund_radar/reports/YYYY-MM.html` | 交互式审计报告 |  
| `~/.refund_radar/reports/YYYY-MM.json` | 原始分析数据 |  

## 隐私保护  

- **无网络调用**：全部本地运行。  
- **无外部 API**：不使用 Plaid，不连接任何云服务。  
- **您的数据始终保留在本地设备上**。  
- **报告中内置隐私开关**：一键模糊商户名称。  

## 系统要求  

- Python 3.9+  
- 无需外部依赖  

## 代码仓库  

https://github.com/andreolf/refund-radar  