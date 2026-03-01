---
name: garmin-health-analysis
name_zh: Garmin健康分析
description: 以自然语言与您的 Garmin 数据交互——例如：“我单板滑雪时的最快速度是多少？”、“我昨晚睡得如何？”、“下午 3 点我的心率是多少？”。支持访问 20 多项指标（睡眠阶段、Body Battery、HRV、VO2 最大值、训练准备度、身体成分、血氧饱和度 SPO2），下载 FIT/GPX 文件用于路线分析，查询任意时间点的海拔/配速，并生成交互式健康仪表盘。从简单的“显示我本周的训练”到深入的“分析我的恢复情况与训练负荷对比”。
description_zh: 以自然语言与您的 Garmin 数据交互——例如：“我单板滑雪时的最快速度是多少？”、“我昨晚睡得如何？”、“下午 3 点我的心率是多少？”。支持访问 20 多项指标（睡眠阶段、Body Battery、HRV、VO2 最大值、训练准备度、身体成分、血氧饱和度 SPO2），下载 FIT/GPX 文件用于路线分析，查询任意时间点的海拔/配速，并生成交互式健康仪表盘。从简单的“显示我本周的训练”到深入的“分析我的恢复情况与训练负荷对比”。
version: 1.2.2
author: EversonL & Claude
homepage: https://github.com/eversonl/ClawdBot-garmin-health-analysis
metadata: {"clawdbot":{"emoji":"⌚","requires":{"env":["GARMIN_EMAIL","GARMIN_PASSWORD"]},"install":[{"id":"garminconnect","kind":"uv","package":"garminconnect","label":"Install garminconnect (pip)"},{"id":"fitparse","kind":"uv","package":"fitparse","label":"Install fitparse (pip)"},{"id":"gpxpy","kind":"uv","package":"gpxpy","label":"Install gpxpy (pip)"}]}}
---
# Garmin 健康分析

从 Garmin Connect 查询健康指标，并生成交互式 HTML 图表。

## 两种安装路径

本 skill 支持 **两种不同配置方式**：

1. **Clawdbot Skill**（本指南）—— 与 Clawdbot 配合使用，实现自动化及主动式健康监测  
2. **MCP Server**（[参见 MCP 配置指南](references/mcp_setup.md)）—— 作为标准 Claude Desktop 的 MCP 服务器使用  

请根据您的实际使用场景选择对应路径。您也可以同时启用两种方式！

---

## Clawdbot Skill 配置（仅首次需执行）

### 1. 安装依赖项

```bash
pip3 install garminconnect
```

### 2. 配置凭据

您有三种方式提供 Garmin Connect 登录凭据：

#### 方式 A：Clawdbot 配置（推荐 —— 可通过 UI 配置）

在 `~/.clawdbot/clawdbot.json` 中添加凭据：

```json
{
  "skills": {
    "entries": {
      "garmin-health-analysis": {
        "enabled": true,
        "env": {
          "GARMIN_EMAIL": "your-email@example.com",
          "GARMIN_PASSWORD": "your-password"
        }
      }
    }
  }
}
```

**提示**：您也可通过 Clawdbot UI 的 Skills 设置面板设置这些凭据。

#### 方式 B：本地配置文件

在 skill 目录中创建配置文件：

```bash
cd ~/.clawdbot/skills/garmin-health-analysis
# or: cd <workspace>/skills/garmin-health-analysis
cp config.example.json config.json
# Edit config.json and add your email and password
```

**config.json：**  
```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**注意**：`config.json` 已被 .gitignore 排除，以保障您的凭据安全。

#### 方式 C：命令行传入

认证时直接通过命令行传入凭据：  
```bash
python3 scripts/garmin_auth.py login \
  --email YOUR_EMAIL@example.com \
  --password YOUR_PASSWORD
```

### 3. 认证登录

登录 Garmin Connect 并保存会话令牌：

```bash
python3 scripts/garmin_auth.py login
```

该命令按以下优先级顺序读取凭据：  
1. 命令行参数（`--email`、`--password`）  
2. 本地配置文件（`config.json`）  
3. 环境变量（`GARMIN_EMAIL`、`GARMIN_PASSWORD`）  
4. Clawdbot 配置（`skills.entries.garmin-health-analysis.env`）  

会话令牌将存储于 `~/.clawdbot/garmin-tokens.json` 并自动刷新。

检查认证状态：  
```bash
python3 scripts/garmin_auth.py status
```

## 获取数据

使用 `scripts/garmin_data.py` 获取 JSON 格式数据：

```bash
# Sleep (last 7 days default)
python3 scripts/garmin_data.py sleep --days 14

# Body Battery (Garmin's recovery metric)
python3 scripts/garmin_data.py body_battery --days 30

# HRV data
python3 scripts/garmin_data.py hrv --days 30

# Heart rate (resting, max, min)
python3 scripts/garmin_data.py heart_rate --days 7

# Activities/workouts
python3 scripts/garmin_data.py activities --days 30

# Stress levels
python3 scripts/garmin_data.py stress --days 7

# Combined summary with averages
python3 scripts/garmin_data.py summary --days 7

# Custom date range
python3 scripts/garmin_data.py sleep --start 2026-01-01 --end 2026-01-15

# User profile
python3 scripts/garmin_data.py profile
```

输出为发送至 stdout 的 JSON。请解析该输出以回答用户问题。

## 生成图表

使用 `scripts/garmin_chart.py` 生成交互式 HTML 可视化图表：

```bash
# Sleep analysis (hours + scores)
python3 scripts/garmin_chart.py sleep --days 30

# Body Battery recovery chart (color-coded)
python3 scripts/garmin_chart.py body_battery --days 30

# HRV & resting heart rate trends
python3 scripts/garmin_chart.py hrv --days 90

# Activities summary (by type, calories)
python3 scripts/garmin_chart.py activities --days 30

# Full dashboard (all 4 charts)
python3 scripts/garmin_chart.py dashboard --days 30

# Save to specific file
python3 scripts/garmin_chart.py dashboard --days 90 --output ~/Desktop/garmin-health.html
```

图表将在默认浏览器中自动打开。图表基于 Chart.js 构建，采用现代渐变设计，包含统计卡片及交互式工具提示。

## 回答用户问题

| 用户提问 | 执行操作 |
|-----------|--------|
| “我昨晚睡得如何？” | `garmin_data.py summary --days 1`，报告睡眠时长 + 睡眠得分 |
| “我这周的恢复状况如何？” | `garmin_data.py body_battery --days 7`，报告平均值 + 趋势 |
| “显示我上个月的健康数据” | `garmin_chart.py dashboard --days 30` |
| “我的 HRV 是否在提升？” | `garmin_data.py hrv --days 30`，分析趋势 |
| “我这周做了哪些训练？” | `garmin_data.py activities --days 7`，列出含详细信息的活动 |
| “我的静息心率如何？” | `garmin_data.py heart_rate --days 7`，报告平均值 + 趋势 |

## 关键指标

### Body Battery（0–100）
Garmin 专有的恢复指标，基于 HRV、压力、睡眠和活动综合计算：
- **高（75–100）**：完全充满，适合高强度训练  
- **中（50–74）**：中等能量，适合常规活动  
- **低（25–49）**：能量有限，需注重恢复  
- **极低（0–24）**：已耗尽，应优先休息  

### 睡眠得分（0–100）
基于睡眠时长、各睡眠阶段及干扰因素得出的整体睡眠质量评分：
- **优秀（90–100）**：最佳恢复性睡眠  
- **良好（80–89）**：高质量睡眠，仅有轻微问题  
- **一般（60–79）**：基本充足，但仍有提升空间  
- **较差（0–59）**：存在显著睡眠缺陷  

### HRV（心率变异性）
单位为毫秒（ms），数值越高通常越好：
- 反映自主神经系统平衡状态及恢复能力  
- 应关注**长期趋势**（上升 = 恢复能力增强）  
- 受睡眠、压力、训练负荷及疾病影响  
- 正常范围因人而异（20–200+ ms）  

### 静息心率（bpm）
数值越低通常表示心血管健康水平越高：
- **运动员**：40–60 bpm  
- **体能良好成年人**：60–70 bpm  
- **普通成年人**：70–80 bpm  
- 突然升高可能提示压力、疾病或过度训练  

### 压力水平
基于全天 HRV 分析得出：
- **低压力**：休息与恢复时段  
- **中压力**：日常正常活动  
- **高压力**：身体活动或精神压力  

## 健康分析

当用户请求深度洞察或希望理解自身健康趋势时，请使用 `references/health_analysis.md` 进行如下分析：
- 所有指标的科学依据充分的解读  
- 按年龄与体能水平划分的正常参考范围  
- 模式识别（周趋势、恢复周期、训练负荷平衡）  
- 基于数据的可执行建议  
- 提示需休息或就医的预警信号  

### 分析工作流程  
1. 获取数据：`python3 scripts/garmin_data.py summary --days N`  
2. 阅读 `references/health_analysis.md` 了解解读框架  
3. 应用分析框架：现状 → 趋势 → 模式 → 洞察 → 建议  
4. 始终注明免责声明：本分析仅为信息参考，不构成医疗建议  

## 故障排查

### 认证问题  
- **“凭据无效”**：请再次核对邮箱/密码，并尝试登录 Garmin Connect 网页版  
- **“令牌已过期”**：重新运行登录命令：`python3 scripts/garmin_auth.py login ...`  
- **“请求过于频繁”**：Garmin 存在速率限制；请等待几分钟后重试  

### 数据缺失  
- 部分指标需特定 Garmin 设备支持（如 Body Battery 需支持 HRV 的设备）  
- 若设备未持续佩戴，历史数据可能存在空白  
- 新账户的历史数据可能有限  

### 库依赖问题  
- 若 `garminconnect` 导入失败：`pip3 install --upgrade garminconnect`  
- Garmin 偶尔会调整其 API；若请求失败，请更新相关库  

## 隐私说明  

- 凭据仅本地存储于 `~/.clawdbot/garmin-tokens.json`  
- 会话令牌自动刷新  
- 除向 Garmin 官方服务器发送外，无任何数据外传  
- 您可通过删除令牌文件随时撤销访问权限  

## 对比：Garmin vs Whoop  

| 功能 | Garmin | Whoop |  
|---------|--------|-------|  
| **恢复指标** | Body Battery（0–100） | Recovery Score（0–100%） |  
| **HRV 追踪** | 是（夜间平均值） | 是（详细追踪） |  
| **睡眠阶段** | 浅睡、深睡、REM、清醒 | 浅睡、慢波睡眠（SWS）、REM、清醒 |  
| **活动追踪** | 内置 GPS，多种运动模式 | Strain 得分（0–21） |  
| **压力监测** | 全天压力水平 | 未直接追踪 |  
| **API** | 非官方（garminconnect） | 官方 OAuth |  
| **设备类型** | 手表、健身追踪器 | 仅可穿戴手环 |  

## 参考资料  

- `references/api.md` — Garmin Connect API 详情（非官方）  
- `references/health_analysis.md` — 基于科学依据的健康数据解读  
- [garminconnect 库](https://github.com/cyberjunky/python-garminconnect) — Python API 封装库  
- [Garmin Connect](https://connect.garmin.com) — 官方网页界面  

## 版本信息  

- **创建时间**：2026-01-25  
- **作者**：EversonL & Claude  
- **版本**：1.2.0  
- **依赖项**：garminconnect、fitparse、gpxpy（Python 库）  
- **许可证**：MIT  