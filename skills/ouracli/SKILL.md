---
name: oura-ring-data
name_zh: Oura CLI
description: 使用 ouracli CLI 工具访问 Oura Ring 健康数据。当用户询问“oura 数据”、“睡眠统计”、“活动数据”、“心率”、“准备度得分”、“压力水平”，或希望获取其 Oura Ring 的健康指标时启用此 skill。
description_zh: 使用 ouracli CLI 工具访问 Oura Ring 健康数据。当用户询问“oura 数据”、“睡眠统计”、“活动数据”、“心率”、“准备度得分”、“压力水平”，或希望获取其 Oura Ring 的健康指标时启用此 skill。
allowed-tools: Bash
---
# Oura Ring 数据访问

通过 ouracli 命令行接口检索 Oura Ring 的健康与健身数据。

## 关键提示：必须完成身份验证

**执行 any ouracli 命令前，务必确认已通过身份验证。** 该工具要求设置 `PERSONAL_ACCESS_TOKEN` 环境变量。

- 令牌位置：`secrets/oura.env` 或 `~/.secrets/oura.env`
- 若命令因身份验证失败而报错，请告知用户前往以下地址获取令牌：https://cloud.ouraring.com/personal-access-tokens

## 可用数据类型

### 核心健康指标
- `activity` - 每日活动（步数、MET 值、卡路里）
- `sleep` - 睡眠数据（睡眠阶段、效率、心率）
- `readiness` - 准备度得分及其影响因子（contributors）
- `heartrate` - 心率时间序列数据（5 分钟粒度）
- `spo2` - 血氧饱和度（SpO₂）数据
- `stress` - 每日压力水平

### 其他数据
- `workout` - 锻炼会话
- `session` - 活动会话
- `tag` - 用户自定义标签
- `rest-mode` - 休息模式时段
- `personal-info` - 用户档案信息
- `all` - 所有可用数据类型

## 日期范围指定方式

### ✅ 支持的格式（请仅使用这些！）

```bash
# Single date (no quotes needed)
ouracli activity 2025-12-25
ouracli sleep today
ouracli heartrate yesterday

# Relative ranges from today (MUST use quotes)
ouracli activity "7 days"      # Last 7 days including today
ouracli sleep "30 days"        # Last 30 days
ouracli readiness "2 weeks"    # Last 2 weeks
ouracli stress "1 month"       # Last month

# Date + duration (MUST use quotes)
ouracli activity "2025-12-01 28 days"    # 28 days starting Dec 1
ouracli sleep "2025-09-23 7 days"        # Week starting Sept 23
```

**⚠️ 关键提示：若日期范围含空格，请务必使用英文引号包裹！**

### ❌ 不支持的格式（禁止使用）

```bash
# ❌ WRONG - Two separate dates
ouracli activity 2025-09-23 2025-09-30

# ❌ WRONG - "to" syntax
ouracli activity "2025-09-23 to 2025-09-30"

# ❌ WRONG - Range operators
ouracli activity "2025-09-23..2025-09-30"

# ❌ WRONG - Relative past expressions
ouracli activity "3 months ago"
```

### 日期范围转换

若用户请求两个特定日期之间的数据：

**步骤 1**：计算天数（含首尾两日）
```
Example: Sept 23 to Sept 30 = 7 days
         Dec 1 to Dec 31 = 30 days
```

**步骤 2**：使用“起始日期 + 时间段”格式
```bash
# ✅ CORRECT
ouracli activity "2025-09-23 7 days"
ouracli activity "2025-12-01 30 days"
```

## 输出格式

**始终使用 `--json` 进行程序化数据分析。** 此格式最可靠，便于解析。

```bash
# ✅ RECOMMENDED for AI analysis
ouracli activity "7 days" --json

# Other formats (human-readable)
ouracli activity today --tree        # Default: tree structure
ouracli activity "7 days" --markdown # Markdown with charts
ouracli activity "7 days" --html > activity.html  # Interactive HTML charts
ouracli activity "7 days" --dataframe  # Pandas DataFrame format
```

## 常见使用模式

### 快速数据检查
```bash
# Today's activity
ouracli activity today --json

# Recent sleep data
ouracli sleep "7 days" --json

# Current readiness
ouracli readiness today --json
```

### 详细分析
```bash
# Weekly health summary
ouracli all "7 days" --json

# Monthly activity report
ouracli activity "30 days" --json

# Heart rate for specific date
ouracli heartrate "2025-12-15 1 days" --json
```

### 多日报告
```bash
# All data grouped by day (HTML report)
ouracli all "7 days" --by-day --html > weekly-report.html

# All data grouped by type
ouracli all "7 days" --by-method --json
```

## 关键注意事项

### 准备度影响因子（Readiness Contributors）警告
⚠️ **重要提示**：准备度数据中的 `contributors.resting_heart_rate` 字段是一个 **得分（0–100）**，**并非** 实际心率（BPM）：
- 得分偏低（如 19、47）= 静息心率（RHR）高于基线（负面影响）
- 得分偏高（如 95、100）= 静息心率（RHR）处于基线最优水平（正面影响）
- 实际 BPM 数值可在 `heartrate` 命令输出中查看

**切勿将影响因子得分解读为实际心率测量值。**

### Oura API 特性说明
- 单日查询有时因时区问题返回空结果
- 推荐使用日期范围（例如 "YYYY-MM-DD 2 days"）以获得更稳定的结果
- 查询特定日期时，建议额外增加缓冲日（buffer day）

### 数据可用性
- Oura Ring 需近期同步，方可获取最新数据
- 历史数据的可用性取决于用户的 Oura 订阅等级
- 若未返回任何数据，建议尝试扩大日期范围，或检查设备同步状态

## 故障排查

### 错误：“Got unexpected extra argument”（收到意外的额外参数）
**原因**：使用了两个独立的日期参数，而非一个带引号的日期范围
```bash
# ❌ WRONG
ouracli activity 2025-09-23 2025-09-30

# ✅ CORRECT
ouracli activity "2025-09-23 7 days"
```

### 错误：“Invalid date specification”（无效的日期规格）
**原因**：使用了不支持的语法，例如 “to”、“..” 或相对表达式
```bash
# ❌ WRONG
ouracli activity "2025-09-23 to 2025-09-30"

# ✅ CORRECT
ouracli activity "2025-09-23 7 days"
```

### 无数据返回
**解决方案**：
1. 尝试扩大日期范围：`ouracli activity "7 days" --json`
2. 增加缓冲日：`ouracli activity "2025-12-25 2 days" --json`
3. 检查 Oura Ring 是否已近期同步
4. 确认所查日期是否在可用数据范围内

## 用户查询示例响应

### “展示我上周的活动数据”
```bash
ouracli activity "7 days" --json
```

### “昨晚我的睡眠情况如何？”
```bash
ouracli sleep today --json
```

### “我十二月的准备度如何？”
```bash
ouracli readiness "2025-12-01 30 days" --json
```

### “获取我从 9 月 23 日到 9 月 30 日的所有数据”
```bash
# Calculate: Sept 30 - Sept 23 = 7 days
ouracli all "2025-09-23 7 days" --json
```

### “展示我昨日的心率数据”
```bash
ouracli heartrate yesterday --json
```

## 快速参考

| 用户意图 | 命令 |
|-------------|---------|
| 今日活动 | `ouracli activity today --json` |
| 上周睡眠 | `ouracli sleep "7 days" --json` |
| 当前准备度 | `ouracli readiness today --json` |
| 今日心率 | `ouracli heartrate today --json` |
| 月度汇总 | `ouracli all "30 days" --json` |
| 特定日期范围 | `ouracli [TYPE] "YYYY-MM-DD N days" --json` |
| 所有数据类型 | `ouracli all "7 days" --json` |

## 注意事项

- AI 分析时，始终优先选用 `--json` 格式
- 所有含空格的日期范围均需加英文引号
- 对于特定日期范围，请先计算天数
- 若命令执行失败，请检查身份验证状态
- 查询特定日期时，请留意时区相关特性