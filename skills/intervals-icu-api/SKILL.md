---
name: intervals-icu-api
name_zh: ICU 间隔 API
description: 完整指南：使用 intervals.icu API 访问与管理训练数据。当操作 Intervals.icu 运动员档案、活动、训练课程、日历事件、健康数据及训练计划时使用。涵盖身份验证、拉取带组合数据字段的活动、使用计划训练课程管理日历，以及创建/更新训练数据。所有主要操作均附带 curl 示例。
description_zh: 完整指南：使用 intervals.icu API 访问与管理训练数据。当操作 Intervals.icu 运动员档案、活动、训练课程、日历事件、健康数据及训练计划时使用。涵盖身份验证、拉取带组合数据字段的活动、使用计划训练课程管理日历，以及创建/更新训练数据。所有主要操作均附带 curl 示例。
---
# Intervals.icu API Skill

一份全面指南，用于通过 intervals.icu API 管理运动员训练数据、活动、训练课程及日历事件。

## 身份验证

### API 密钥方式

从 [intervals.icu 设置页面](https://intervals.icu/settings) 获取您的运动员 ID 和 API 密钥。

```bash
# Using API Key header
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID
```

### Bearer Token 方式（OAuth）

```bash
# Using Bearer token
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID
```

**基础 URL：** `https://intervals.icu/api/v1`  
**日期格式：** ISO-8601（例如 `2024-01-15` 或 `2024-01-15T10:30:00`）

---

## 核心概念

### 运动员 ID（Athlete ID）

您在 Intervals.icu 中的唯一标识符。所有 API 端点均将其作为 `{id}` 路径参数使用。

### 活动（Activities） vs 事件（Events）

- **活动（Activities）**：已完成的训练课程，含实际数据（GPS、功率、心率）。从 `/athlete/{id}/activities` 获取。  
- **事件（Events）**：您日历上计划的训练课程。从 `/athlete/{id}/events` 获取。

### 数据字段（Data Fields）

活动与事件可返回不同字段。使用 `fields` 查询参数包含/排除特定数据点，以提升查询效率。

---

## 获取活动（已完成的训练课程）

### 列出指定日期范围内的活动

按时间倒序（最新在前）检索两个日期之间的所有活动。

```bash
# Basic activity list
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities?oldest=2024-01-01&newest=2024-01-31"

# With limit
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities?oldest=2024-01-01&limit=10"

# Specific fields only (more efficient)
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities?oldest=2024-01-01&fields=id,name,start_date_local,type,distance,moving_time,icu_training_load"

# For specific activity type (Ride, Run, Swim, etc.)
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities?oldest=2024-01-01&newest=2024-01-31" | jq '.[] | select(.type == "Ride")'
```

### 组合活动与外部数据

使用 `fields` 参数将活动数据与上下文信息合并：

```bash
# Power, HR, and load data
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities?oldest=2024-01-01&fields=name,icu_weighted_avg_watts,average_heartrate,icu_training_load,icu_atl,icu_ctl"

# Include fatigue and fitness metrics
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities?oldest=2024-01-01&fields=id,name,type,icu_training_load,icu_atl,icu_ctl,perceived_exertion"

# Combine power zones and zone times
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities?oldest=2024-01-01&fields=id,name,distance,moving_time,icu_zone_times,icu_weighted_avg_watts"

# HR zones + intensity data
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities?oldest=2024-01-01&fields=id,name,type,average_heartrate,max_heartrate,icu_hr_zone_times,trimp"
```

### 获取单个活动的完整详情

```bash
# Get activity by ID with all data
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/activity/ACTIVITY_ID"

# Get activity with intervals
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/activity/ACTIVITY_ID?intervals=true"
```

### 导出活动数据流（CSV 或 JSON）

```bash
# Get activity streams as JSON
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/activity/ACTIVITY_ID/streams.json"

# Get activity streams as CSV (includes time, power, heart_rate, cadence, etc.)
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/activity/ACTIVITY_ID/streams.csv" \
  --output activity_streams.csv

# Get specific stream types
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/activity/ACTIVITY_ID/streams.json?types=watts,heart_rate,cadence"
```

---

## 日历与计划训练课程

### 列出日历事件（计划训练课程）

从您的日历中检索计划的训练课程、备注及训练目标。

```bash
# Get all events in date range
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events?oldest=2024-02-01&newest=2024-02-29"

# Get with specific fields
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events?oldest=2024-02-01&newest=2024-02-29&fields=id,name,category,start_date_local,description"

# Filter by category (WORKOUT, NOTE, TARGET, FITNESS_DAYS, etc.)
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events?oldest=2024-02-01&category=WORKOUT"

# Get workout targets for date range
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events?oldest=2024-02-01&category=TARGET"
```

### 获取单个事件的详情

```bash
# Get specific planned workout
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events/EVENT_ID"
```

### 下载计划训练课程文件

将计划的训练课程导出为多种格式，适配您的训练设备。

```bash
# Download as .zwo (Zwift format)
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events/EVENT_ID/download.zwo" \
  --output workout.zwo

# Download as .mrc (TrainerRoad format)
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events/EVENT_ID/download.mrc" \
  --output workout.mrc

# Download as .erg (Wahoo format)
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events/EVENT_ID/download.erg" \
  --output workout.erg

# Download as .fit (Garmin format)
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events/EVENT_ID/download.fit" \
  --output workout.fit

# Download multiple workouts as zip
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/workouts.zip?oldest=2024-02-01&newest=2024-02-29&ext=zwo" \
  --output workouts.zip
```

---

## 创建与写入数据

### 创建手动活动

向您的训练历史中添加一条手动记录的训练活动。

```bash
# Basic manual activity
curl -X POST \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Run",
    "type": "Run",
    "start_date_local": "2024-01-15T06:00:00",
    "distance": 10000,
    "moving_time": 3600,
    "description": "Easy morning run"
  }' \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities/manual

# With power (cycling activity)
curl -X POST \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Indoor Zwift",
    "type": "Ride",
    "start_date_local": "2024-01-15T18:00:00",
    "moving_time": 3600,
    "icu_joules": 900000,
    "icu_weighted_avg_watts": 250,
    "average_heartrate": 155,
    "trainer": true
  }' \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities/manual

# With external ID (for syncing with external systems)
curl -X POST \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Strava Activity",
    "type": "Run",
    "start_date_local": "2024-01-15T07:00:00",
    "distance": 5000,
    "moving_time": 1800,
    "external_id": "strava_12345"
  }' \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities/manual
```

### 批量创建多个活动

```bash
# Bulk create activities
curl -X POST \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "name": "Monday Easy Run",
      "type": "Run",
      "start_date_local": "2024-01-15T06:00:00",
      "distance": 10000,
      "moving_time": 3600
    },
    {
      "name": "Tuesday Interval Ride",
      "type": "Ride",
      "start_date_local": "2024-01-16T18:00:00",
      "moving_time": 5400,
      "icu_weighted_avg_watts": 280
    }
  ]' \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/activities/manual/bulk
```

### 创建计划训练课程（日历事件）

在您的日历中添加一项未来训练的预定课程。

```bash
# Basic planned workout
curl -X POST \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Vo2Max Intervals",
    "category": "WORKOUT",
    "start_date_local": "2024-02-15T18:00:00",
    "description": "6x 4min at 110% FTP with 3min recovery"
  }' \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events?upsertOnUid=true"

# Planned workout with Intervals.icu format description
curl -X POST \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sweet Spot Build",
    "category": "WORKOUT",
    "start_date_local": "2024-02-16T18:00:00",
    "description": "[Workout \"Sweet Spot\" \"\" Bike 300\n  [SteadyState 600 88 92 \"\"]\n  [SteadyState 600 88 92 \"\"]\n  [SteadyState 600 88 92 \"\"]\n]"
  }' \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events?upsertOnUid=true"

# Create workout from .zwo file contents
curl -X POST \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Zwift Structured Workout",
    "category": "WORKOUT",
    "start_date_local": "2024-02-17T19:00:00",
    "file_contents": "<Workout_Instruction version=\"1\">\n<author></author>\n<name>My Workout</name>\n<description></description>\n<sportType>Bike</sportType>\n<tags></tags>\n<workout>\n<Warmup Duration=\"600\" PowerLow=\"0.5\" PowerHigh=\"0.75\"/>\n<SteadyState Duration=\"1200\" Power=\"0.85\"/>\n</workout>\n</Workout_Instruction>"
  }' \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events?upsertOnUid=true"
```

### 批量创建多个事件

```bash
# Bulk create planned workouts
curl -X POST \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "name": "Easy Spin",
      "category": "WORKOUT",
      "start_date_local": "2024-02-15T18:00:00",
      "description": "60min at 60-65% FTP"
    },
    {
      "name": "Threshold Work",
      "category": "WORKOUT",
      "start_date_local": "2024-02-17T19:00:00",
      "description": "3x 10min at 95-105% FTP"
    },
    {
      "name": "Long Run",
      "category": "WORKOUT",
      "start_date_local": "2024-02-18T07:00:00",
      "description": "90min easy run at conversational pace"
    }
  ]' \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events/bulk?upsertOnUid=true&updatePlanApplied=true"
```

### 创建训练目标（某日目标）

为指定日期设定一项具体的训练目标。

```bash
# Create power target
curl -X POST \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FTP Test Target",
    "category": "TARGET",
    "start_date_local": "2024-02-20T18:00:00",
    "description": "Target power: 300W"
  }' \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events?upsertOnUid=true"

# Create duration target
curl -X POST \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Volume Target",
    "category": "TARGET",
    "start_date_local": "2024-02-21T00:00:00",
    "description": "Target: 2 hours training"
  }' \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events?upsertOnUid=true"
```

---

## 更新数据

### 更新活动

修改已存在的已完成活动。

```bash
# Update activity notes and tags
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Recovery Ride - Updated",
    "description": "Felt great, good recovery",
    "commute": false
  }' \
  https://intervals.icu/api/v1/activity/ACTIVITY_ID

# Update activity perceived exertion and feel
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "perceived_exertion": 7,
    "feel": 8,
    "description": "Good session, felt strong"
  }' \
  https://intervals.icu/api/v1/activity/ACTIVITY_ID
```

### 更新计划训练课程（事件）

修改您日历上已安排的事件。

```bash
# Update workout details
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Modified VO2Max Session",
    "description": "8x 3min at 130% FTP with 2min recovery - UPDATED"
  }' \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events/EVENT_ID

# Hide event from athlete view
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "hide_from_athlete": true
  }' \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events/EVENT_ID

# Prevent athlete from editing event
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "athlete_cannot_edit": true
  }' \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events/EVENT_ID
```

### 批量更新多个事件（日期范围）

```bash
# Hide all workouts for a week
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "hide_from_athlete": true
  }' \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/events?oldest=2024-02-15&newest=2024-02-22"
```

---

## 健康与恢复数据

### 获取健康记录

追踪睡眠、疲劳度、静息心率及其他健康指标。

```bash
# Get wellness data for date range
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/wellness?oldest=2024-01-01&newest=2024-01-31"

# Get wellness data as CSV
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/wellness.csv?oldest=2024-01-01&newest=2024-01-31" \
  --output wellness.csv

# Get specific wellness fields
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/wellness?oldest=2024-01-01&fields=id,sleep_secs,soreness,fatigue,resting_hr,notes"
```

### 更新健康记录

为指定日期记录健康数据。

```bash
# Add sleep, HRV, and fatigue
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "2024-01-15",
    "sleep_secs": 28800,
    "resting_hr": 52,
    "fatigue": 3,
    "soreness": 2
  }' \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/wellness/2024-01-15

# Add notes
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "2024-01-15",
    "notes": "Great sleep, feeling recovered"
  }' \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/wellness/2024-01-15
```

### 批量更新健康记录

```bash
# Update multiple wellness days at once
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": "2024-01-15",
      "sleep_secs": 28800,
      "resting_hr": 52
    },
    {
      "id": "2024-01-16",
      "sleep_secs": 30600,
      "resting_hr": 50
    },
    {
      "id": "2024-01-17",
      "sleep_secs": 27000,
      "resting_hr": 54
    }
  ]' \
  https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/wellness-bulk
```

---

## 运动设置与区间（Zones）

### 获取运动设置

检索某项运动的功率区间、心率区间及 FTP 设置。

```bash
# Get Ride settings
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/sport-settings/Ride"

# Get Run settings
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/sport-settings/Run"

# List all sport settings
curl -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/sport-settings"
```

### 更新运动设置

修改功率区间、FTP 或心率区间。

```bash
# Update FTP and power zones
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ftp": 310,
    "power_zones": [0, 114, 152, 191, 229, 267, 310]
  }' \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/sport-settings/Ride?recalcHrZones=false"

# Update LTHR and HR zones
curl -X PUT \
  -H "Authorization: ApiKey API_KEY:YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lthr": 165,
    "hr_zones": [0, 123, 142, 160, 178, 197, 220]
  }' \
  "https://intervals.icu/api/v1/athlete/YOUR_ATHLETE_ID/sport-settings/Ride?recalcHrZones=true"
```

---

## 常见应用场景

### 工作流：与外部系统同步训练数据

```bash
#!/bin/bash

ATHLETE_ID="YOUR_ATHLETE_ID"
API_KEY="YOUR_API_KEY"
DATE="2024-01-15"

# 1. Get completed activities
ACTIVITIES=$(curl -s -H "Authorization: ApiKey $ATHLETE_ID:$API_KEY" \
  "https://intervals.icu/api/v1/athlete/$ATHLETE_ID/activities?oldest=$DATE&newest=$DATE&fields=id,name,type,distance,icu_training_load")

# 2. Get planned workouts for today
EVENTS=$(curl -s -H "Authorization: ApiKey $ATHLETE_ID:$API_KEY" \
  "https://intervals.icu/api/v1/athlete/$ATHLETE_ID/events?oldest=$DATE&newest=$DATE&category=WORKOUT")

# 3. Get wellness data
WELLNESS=$(curl -s -H "Authorization: ApiKey $ATHLETE_ID:$API_KEY" \
  "https://intervals.icu/api/v1/athlete/$ATHLETE_ID/wellness/$DATE")

echo "Activities: $ACTIVITIES"
echo "Events: $EVENTS"
echo "Wellness: $WELLNESS"
```

### 工作流：创建周训练计划

```bash
#!/bin/bash

ATHLETE_ID="YOUR_ATHLETE_ID"
API_KEY="YOUR_API_KEY"

# Define workouts for the week
WORKOUTS='[
  {
    "name": "Monday - Easy Spin",
    "category": "WORKOUT",
    "start_date_local": "2024-02-19T18:00:00",
    "description": "60min at 60-65% FTP"
  },
  {
    "name": "Tuesday - VO2Max",
    "category": "WORKOUT",
    "start_date_local": "2024-02-20T18:00:00",
    "description": "6x 4min at 110% FTP with 3min recovery"
  },
  {
    "name": "Wednesday - Recovery",
    "category": "WORKOUT",
    "start_date_local": "2024-02-21T18:00:00",
    "description": "45min easy"
  },
  {
    "name": "Thursday - Threshold",
    "category": "WORKOUT",
    "start_date_local": "2024-02-22T19:00:00",
    "description": "2x 15min at 95-105% FTP"
  },
  {
    "name": "Friday - Rest Day",
    "category": "NOTE",
    "start_date_local": "2024-02-23T00:00:00",
    "description": "Rest and recovery"
  },
  {
    "name": "Saturday - Long Ride",
    "category": "WORKOUT",
    "start_date_local": "2024-02-24T09:00:00",
    "description": "150min at Zone 2"
  },
  {
    "name": "Sunday - Easy Recovery",
    "category": "WORKOUT",
    "start_date_local": "2024-02-25T10:00:00",
    "description": "60min easy spin"
  }
]'

# Create all workouts at once
curl -X POST \
  -H "Authorization: ApiKey $ATHLETE_ID:$API_KEY" \
  -H "Content-Type: application/json" \
  -d "$WORKOUTS" \
  "https://intervals.icu/api/v1/athlete/$ATHLETE_ID/events/bulk?upsertOnUid=true&updatePlanApplied=true"
```

### 工作流：分析周数据

```bash
#!/bin/bash

ATHLETE_ID="YOUR_ATHLETE_ID"
API_KEY="YOUR_API_KEY"

# Get activities with load and zone data for the week
curl -s -H "Authorization: ApiKey $ATHLETE_ID:$API_KEY" \
  "https://intervals.icu/api/v1/athlete/$ATHLETE_ID/activities?oldest=2024-01-08&newest=2024-01-14&fields=name,type,distance,icu_training_load,icu_zone_times,average_heartrate" | \
  jq '[.[] | {name: .name, load: .icu_training_load, zones: .icu_zone_times, hr: .average_heartrate}]'
```

---

## 重要注意事项

### 请求频率限制（Rate Limiting）

请尊重 API 调用限制。避免连续高频发送请求。

### 字段选择（Field Selection）

使用 `fields` 参数仅请求所需数据。此举可提升性能并减小响应负载。

### 日期格式

始终使用 ISO-8601 格式：`YYYY-MM-DD` 或 `YYYY-MM-DDTHH:MM:SS`

### 更新插入（Upsert）参数

创建事件时，使用 `upsertOnUid=true` 更新具有匹配 UID 的现有事件，而非重复创建。

### 外部 ID（External IDs）

在与其他系统同步数据时，使用 `external_id`，以避免重新同步时产生重复数据。

### 论坛讨论

更多详细 API 信息，请参阅：[API 接入论坛帖](https://forum.intervals.icu/t/api-access-to-intervals-icu/609)

---

## 响应状态码

- **200**：成功  
- **201**：创建成功（活动、事件）  
- **400**：请求错误（参数无效）  
- **401**：未授权（API 密钥或令牌无效）  
- **404**：未找到（ID 无效）  
- **429**：请求频率超限（请求过多）  
- **500**：服务器错误  

请检查响应头以获取错误详情及速率限制相关信息。