---
name: whoop-health-analysis
name_zh: WHOOP健康分析
description: 访问 Whoop 可穿戴设备健康数据（睡眠、恢复、负荷、HRV、训练），并生成交互式图表。当用户询问睡眠质量、恢复分数、负荷水平、HRV 趋势、训练数据，或希望从其 Whoop 手环获取健康可视化图表/图形时使用。
description_zh: 访问 Whoop 可穿戴设备健康数据（睡眠、恢复、负荷、HRV、训练），并生成交互式图表。当用户询问睡眠质量、恢复分数、负荷水平、HRV 趋势、训练数据，或希望从其 Whoop 手环获取健康可视化图表/图形时使用。
---
# Whoop

查询 Whoop API 健康指标，并生成交互式 HTML 图表。

## 设置（仅首次需要）

### 1. 创建 Whoop 开发者应用

1. 访问 [developer-dashboard.whoop.com](https://developer-dashboard.whoop.com)  
2. 使用您的 Whoop 账户凭据登录  
3. 如提示，请创建一个 Team（名称任意）  
4. 点击 **Create App**（或访问 [apps/create](https://developer-dashboard.whoop.com/apps/create)）  
5. 填写以下内容：  
   - **App name**（应用名称）：任意名称（例如，“Clawdbot”）  
   - **Scopes**（权限范围）：全选：`read:recovery`, `read:cycles`, `read:workout`, `read:sleep`, `read:profile`, `read:body_measurement`  
   - **Redirect URI**（重定向 URI）：`http://localhost:9876/callback`  
6. 点击 **Create**（创建）——您将获得 **Client ID**（客户端 ID）和 **Client Secret**（客户端密钥）

### 2. 认证

使用您的凭据运行 OAuth 登录流程：

```bash
python3 scripts/whoop_auth.py login \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET
```

此操作将在浏览器中打开 Whoop 授权页面。请登录并批准访问权限。令牌将保存在 `~/.clawdbot/whoop-tokens.json` 中，并自动刷新。

检查状态：`python3 scripts/whoop_auth.py status`

## 获取数据

使用 `scripts/whoop_data.py` 获取 JSON 格式数据：

```bash
# Sleep (last 7 days default)
python3 scripts/whoop_data.py sleep --days 14

# Recovery scores
python3 scripts/whoop_data.py recovery --days 30

# Strain/cycles
python3 scripts/whoop_data.py cycles --days 7

# Workouts
python3 scripts/whoop_data.py workouts --days 30

# Combined summary with averages
python3 scripts/whoop_data.py summary --days 7

# Custom date range
python3 scripts/whoop_data.py sleep --start 2026-01-01 --end 2026-01-15

# User profile / body measurements
python3 scripts/whoop_data.py profile
python3 scripts/whoop_data.py body
```

输出为发送至标准输出（stdout）的 JSON。请解析该 JSON 以回答用户问题。

## 生成图表

使用 `scripts/whoop_chart.py` 生成交互式 HTML 可视化图表：

```bash
# Sleep analysis (performance + stages)
python3 scripts/whoop_chart.py sleep --days 30

# Recovery bars (color-coded green/yellow/red)
python3 scripts/whoop_chart.py recovery --days 30

# Strain & calories trend
python3 scripts/whoop_chart.py strain --days 90

# HRV & resting heart rate trend
python3 scripts/whoop_chart.py hrv --days 90

# Full dashboard (all 4 charts)
python3 scripts/whoop_chart.py dashboard --days 30

# Save to specific file
python3 scripts/whoop_chart.py dashboard --days 90 --output ~/Desktop/whoop.html
```

图表将自动在默认浏览器中打开。它们基于 Chart.js 构建，采用深色主题，包含统计卡片与悬停提示。

## 回答问题

| 用户提问 | 操作 |
|-----------|--------|
| “我昨晚睡得怎么样？” | `whoop_data.py summary --days 7`，报告睡眠表现 + 睡眠时长 |
| “我的恢复状况如何？” | `whoop_data.py recovery --days 7`，报告分数 + 趋势 |
| “给我展示过去一个月的图表” | `whoop_chart.py dashboard --days 30` |
| “我的 HRV 在提升吗？” | `whoop_data.py recovery --days 30`，分析趋势 |
| “我这周训练量有多大？” | `whoop_data.py workouts --days 7`，列出各项活动 |

## 关键指标

- **恢复（Recovery）**（0–100%）：绿色 ≥67%，黄色 34–66%，红色 <34%  
- **负荷（Strain）**（0–21）：基于心率（HR）计算的每日运动强度得分  
- **睡眠表现（Sleep Performance）**：实际睡眠时长 vs. 所需睡眠时长  
- **HRV（毫秒）**：数值越高表示恢复越好，需长期追踪趋势  
- **静息心率（RHR）（bpm）**：数值越低表示心血管健康水平越高  

## 健康分析

当用户询问其健康状况、趋势或寻求洞察建议时，请使用 `references/health_analysis.md` 进行如下分析：  
- 基于科学依据解读 HRV、RHR、睡眠阶段、恢复、负荷、SpO₂  
- 按年龄与体能水平提供正常参考范围  
- 检测模式（如星期几效应、睡眠负债、过度训练信号）  
- 基于数据提供可执行建议  
- 标识需就医咨询的警示信号（red flags）

### 分析工作流  
1. 获取数据：`python3 scripts/whoop_data.py summary --days N`  
2. 阅读 `references/health_analysis.md` 了解解读框架  
3. 应用五步分析法：现状 → 趋势 → 模式 → 洞察 → 警示信号  
4. 始终注明免责声明：“本分析不构成医疗建议”

## 参考资料

- `references/api.md` — 接口详情、响应结构、分页机制  
- `references/health_analysis.md` — 基于科学依据的健康数据解读指南  