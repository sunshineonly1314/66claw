---
name: whoopskill
name_zh: WHOOP技能
description: 具备健康洞察、趋势分析与数据获取能力（睡眠、恢复、HRV、压力值）的 WHOOP CLI 工具。
description_zh: 具备健康洞察、趋势分析与数据获取能力（睡眠、恢复、HRV、压力值）的 WHOOP CLI 工具。
homepage: https://github.com/koala73/whoopskill
metadata: {"clawdis":{"emoji":"💪","requires":{"bins":["node"],"env":["WHOOP_CLIENT_ID","WHOOP_CLIENT_SECRET","WHOOP_REDIRECT_URI"]},"install":[{"id":"npm","kind":"node","package":"whoopskill","bins":["whoopskill"],"label":"Install whoopskill (node/npm)"}]}}
---
# whoopskill

使用 `whoopskill` 获取 WHOOP 健康指标（睡眠、恢复、HRV、压力值、训练）。

安装方式：`npm install -g whoopskill` | [GitHub](https://github.com/koala73/whoopskill)

快速开始
- `whoopskill summary` —— 一行摘要：恢复：52% | HRV：39ms | 睡眠：40% | 压力值：6.7  
- `whoopskill summary --color` —— 彩色编码摘要，含 🟢🟡🔴 状态指示符  
- `whoopskill trends` —— 7 日趋势分析（含平均值与方向箭头 ↑↓→）  
- `whoopskill trends --days 30 --pretty` —— 30 日趋势分析  
- `whoopskill insights --pretty` —— 类 AI 风格健康建议  
- `whoopskill --pretty` —— 含表情符号的人类可读输出  
- `whoopskill recovery` —— 恢复分数、HRV、静息心率（RHR）  
- `whoopskill sleep` —— 睡眠表现、睡眠阶段  
- `whoopskill workout` —— 含压力值的训练记录  
- `whoopskill --date 2025-01-03` —— 指定日期的数据  

分析类命令
- `summary` —— 快速健康快照（添加 `--color` 可显示状态指示符）  
- `trends` —— 多日平均值与趋势箭头（↑↓→）  
- `insights` —— 基于您个人数据的个性化建议  

数据类型
- `profile` —— 用户信息（姓名、邮箱）  
- `body` —— 身高、体重、最大心率  
- `sleep` —— 睡眠阶段、效率、呼吸频率  
- `recovery` —— 恢复百分比、HRV、静息心率（RHR）、血氧饱和度（SpO₂）、皮肤温度  
- `workout` —— 压力值、心率区间、卡路里  
- `cycle` —— 日常压力值、卡路里  

组合多种数据类型
- `whoopskill --sleep --recovery --body`

认证
- `whoopskill auth login` —— OAuth 流程（自动打开浏览器）  
- `whoopskill auth status` —— 检查令牌状态  
- `whoopskill auth logout` —— 清除令牌  

注意事项
- 默认输出为 JSON 至标准输出（stdout）（使用 `--pretty` 可切换为人类可读格式）  
- 令牌存储于 `~/.whoop-cli/tokens.json`（支持自动刷新）  
- 使用 WHOOP API v2  
- 日期按 WHOOP 日界线计算（凌晨 4 点为当日起始）  
- 用户数 <10 的 WHOOP 应用无需审核（可立即使用）  

示例：`whoopskill summary --color`  
```
📅 2026-01-25
🟢 Recovery: 85% | HRV: 39ms | RHR: 63bpm
🟡 Sleep: 79% | 6.9h | Efficiency: 97%
🔴 Strain: 0.1 (optimal: ~14) | 579 cal
```

示例：`whoopskill trends`  
```
📊 7-Day Trends

💚 Recovery: 62.1% avg (34-86) →
💓 HRV: 33.8ms avg (26-42) →
❤️ RHR: 63.8bpm avg (60-68) →
😴 Sleep: 75.4% avg (69-79) →
🛏️ Hours: 6.5h avg (5.7-7.8) ↓
🔥 Strain: 5.9 avg (0.1-9.0) ↓
```

示例：`whoopskill insights`  
```
💡 Insights & Recommendations

✅ Green Recovery
   Recovery at 85% — body is primed for high strain.
   → Great day for intense training or competition.

✅ HRV Above Baseline
   Today's HRV (39ms) is 21% above your 7-day average.
   → Excellent recovery. Good day for peak performance.

⚠️ Mild Sleep Debt
   You have 2.0 hours of sleep debt.
   → Consider an earlier bedtime tonight.

✅ Strain Capacity Available
   Current strain: 0.1. Optimal target: ~14.
   → Room for 13.9 more strain today.
```

示例：`whoopskill --sleep --recovery`（JSON 格式）  
```json
{
  "date": "2026-01-05",
  "fetched_at": "2026-01-05T13:49:22.782Z",
  "body": {
    "height_meter": 1.83,
    "weight_kilogram": 82.5,
    "max_heart_rate": 182
  },
  "sleep": [
    {
      "id": "4c311bd4-370f-49ff-b58c-0578d543e9d2",
      "cycle_id": 1236731435,
      "user_id": 245199,
      "created_at": "2026-01-05T00:23:34.264Z",
      "updated_at": "2026-01-05T02:23:54.686Z",
      "start": "2026-01-04T19:51:57.280Z",
      "end": "2026-01-05T01:30:48.660Z",
      "timezone_offset": "+04:00",
      "nap": false,
      "score_state": "SCORED",
      "score": {
        "stage_summary": {
          "total_in_bed_time_milli": 20331380,
          "total_awake_time_milli": 4416000,
          "total_light_sleep_time_milli": 6968320,
          "total_slow_wave_sleep_time_milli": 4953060,
          "total_rem_sleep_time_milli": 3994000,
          "sleep_cycle_count": 4,
          "disturbance_count": 4
        },
        "sleep_needed": {
          "baseline_milli": 26783239,
          "need_from_sleep_debt_milli": 6637715,
          "need_from_recent_strain_milli": 148919
        },
        "respiratory_rate": 14.12,
        "sleep_performance_percentage": 40,
        "sleep_consistency_percentage": 60,
        "sleep_efficiency_percentage": 78.28
      }
    }
  ],
  "workout": [
    {
      "id": "4279883e-3d23-45cd-848c-3afa28dca3f8",
      "user_id": 245199,
      "start": "2026-01-05T03:14:13.417Z",
      "end": "2026-01-05T04:06:45.532Z",
      "sport_name": "hiit",
      "score_state": "SCORED",
      "score": {
        "strain": 6.19,
        "average_heart_rate": 108,
        "max_heart_rate": 144,
        "kilojoule": 819.38,
        "zone_durations": {
          "zone_zero_milli": 167000,
          "zone_one_milli": 1420000,
          "zone_two_milli": 1234980,
          "zone_three_milli": 330000,
          "zone_four_milli": 0,
          "zone_five_milli": 0
        }
      }
    }
  ],
  "profile": {
    "user_id": 245199,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe"
  },
  "recovery": [
    {
      "cycle_id": 1236731435,
      "sleep_id": "4c311bd4-370f-49ff-b58c-0578d543e9d2",
      "user_id": 245199,
      "score_state": "SCORED",
      "score": {
        "recovery_score": 52,
        "resting_heart_rate": 60,
        "hrv_rmssd_milli": 38.87,
        "spo2_percentage": 96.4,
        "skin_temp_celsius": 33.19
      }
    }
  ],
  "cycle": [
    {
      "id": 1236731435,
      "user_id": 245199,
      "start": "2026-01-04T19:51:57.280Z",
      "end": null,
      "score_state": "SCORED",
      "score": {
        "strain": 6.66,
        "kilojoule": 6172.94,
        "average_heart_rate": 71,
        "max_heart_rate": 144
      }
    }
  ]
}
```