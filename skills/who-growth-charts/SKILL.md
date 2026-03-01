---
name: who-growth-charts
name_zh: WHO生长曲线
description: 生成世卫组织（WHO）儿童生长图表（身高、体重、BMI），含百分位曲线。按需下载官方 WHO 参考数据。当用户询问儿童生长追踪、百分位数值，或希望为其孩子获取生长图表时使用。
description_zh: 生成世卫组织（WHO）儿童生长图表（身高、体重、BMI），含百分位曲线。按需下载官方 WHO 参考数据。当用户询问儿童生长追踪、百分位数值，或希望为其孩子获取生长图表时使用。
version: 1.0.0
homepage: https://www.who.int/tools/child-growth-standards
metadata: {"clawdbot":{"emoji":"📈","requires":{"bins":["python3"],"python":["pandas","matplotlib","scipy","openpyxl"]}}}
---
生成 WHO 儿童生长标准图表，含百分位曲线及儿童实测数据叠加显示。

## 功能特性

- **身高别年龄**（0–19 岁）
- **体重别年龄**（0–10 岁）
- **BMI 别年龄**（0–19 岁）
- 支持**男孩和女孩**
- **按需从 cdn.who.int 下载 WHO 数据**（本地缓存）
- 将儿童实际测量值叠加至图表，并绘制趋势线

## 示例

| 身高 | 体重 | BMI |
|--------|--------|-----|
| <img src="examples/anna_height.png" width="250"> | <img src="examples/anna_weight.png" width="250"> | <img src="examples/anna_bmi.png" width="250"> |

## 前置条件

安装 Python 依赖项：
```bash
pip install pandas matplotlib scipy openpyxl
```

## 使用方法

### 基础图表生成

```bash
python3 ./scripts/growth_chart.py "Child Name" "DD.MM.YYYY" --sex F --type all
```

参数说明：
- `name`：儿童姓名（用于图表标题）
- `birthdate`：出生日期，格式为 DD.MM.YYYY
- `--sex` / `-s`：`F`（女性）或 `M`（男性）——默认值：F
- `--type` / `-t`：`height`、`weight`、`bmi` 或 `all` —— 默认值：all（全部）
- `--data` / `-d`：含测量数据的 JSON 文件
- `--output` / `-o`：图表输出目录

### 使用测量数据

创建一个包含身高/体重测量值的 JSON 文件（身高单位为米，体重单位为千克）：
```json
{
  "heights": [ ["2024-01-15T10:00:00", 1.05] ],
  "weights": [ ["2024-01-15T10:00:00", 17.5] ]
}
```

```bash
python3 ./scripts/growth_chart.py "Emma" "06.07.2016" --sex F --data emma_data.json --type all
```

### 与 Withings 集成

结合 `withings-family` skill 自动获取体重数据：
```bash
# Get Withings weight data (assuming withings-family skill is installed)
python3 ../withings-family/scripts/withings.py emma body > /tmp/withings.json

# Parse and generate charts
# (The growth chart script handles Withings JSON format if implemented, otherwise transform it)
```

## 输出

图表默认保存为 PNG 文件至 `~/clawd/who-growth-charts/`（或指定的输出目录）。  
数据缓存与资源文件存储于 `~/clawd/who-growth-charts/cache/`。