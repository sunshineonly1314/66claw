---
name: hevy
name_zh: Hevy
description: 查询 Hevy 中的训练数据，包括训练计划、常规训练、练习动作及其历史记录。当用户询问其训练内容、健身房锻炼、运动进展或健身常规时使用。
description_zh: 查询 Hevy 中的训练数据，包括训练计划、常规训练、练习动作及其历史记录。当用户询问其训练内容、健身房锻炼、运动进展或健身常规时使用。
homepage: https://hevy.com
metadata:
  clawdbot:
    emoji: "🏋️"
    requires:
      bins: ["hevy"]
      env: ["HEVY_API_KEY"]
---
# Hevy CLI

Hevy 训练追踪 API 的命令行接口。用于查询训练计划、常规训练、练习动作并追踪进展。

## 设置

需订阅 Hevy Pro 方可访问 API。

1. 从 https://hevy.com/settings?developer 获取 API 密钥
2. 设置环境变量： `export HEVY_API_KEY="your-key"`

## 命令

### 状态

```bash
# Check configuration and connection
hevy status
```

### 训练计划

```bash
# List recent workouts (default 5)
hevy workouts
hevy workouts --limit 10

# Fetch all workouts
hevy workouts --all

# Show detailed workout
hevy workout <workout-id>

# JSON output
hevy workouts --json
hevy workout <id> --json

# Show weights in kg (default is lbs)
hevy workouts --kg
```

### 常规训练

```bash
# List all routines
hevy routines

# Show detailed routine
hevy routine <routine-id>

# JSON output
hevy routines --json
```

### 练习动作

```bash
# List all exercise templates
hevy exercises

# Search by name
hevy exercises --search "bench press"

# Filter by muscle group
hevy exercises --muscle chest

# Show only custom exercises
hevy exercises --custom

# JSON output
hevy exercises --json
```

### 动作历史记录

```bash
# Show history for specific exercise
hevy history <exercise-template-id>
hevy history <exercise-template-id> --limit 50

# JSON output
hevy history <exercise-template-id> --json
```

### 创建常规训练

```bash
# Create routine from JSON (stdin)
echo '{"routine": {...}}' | hevy create-routine

# Create routine from file
hevy create-routine --file routine.json

# Create a routine folder
hevy create-folder "Push Pull Legs"

# Update existing routine
echo '{"routine": {...}}' | hevy update-routine <routine-id>

# Create custom exercise (checks for duplicates first!)
hevy create-exercise --title "My Exercise" --muscle chest --type weight_reps

# Force create even if duplicate exists
hevy create-exercise --title "My Exercise" --muscle chest --force
```

**⚠️ 重复预防**：`create-exercise` 会检查是否存在同名练习动作，若发现则报错。可使用 `--force` 强制创建（不推荐）。

**常规训练 JSON 格式**：
```json
{
  "routine": {
    "title": "Push Day 💪",
    "folder_id": null,
    "notes": "Chest, shoulders, triceps",
    "exercises": [
      {
        "exercise_template_id": "79D0BB3A",
        "notes": "Focus on form",
        "rest_seconds": 90,
        "sets": [
          { "type": "warmup", "weight_kg": 20, "reps": 15 },
          { "type": "normal", "weight_kg": 60, "reps": 8 }
        ]
      }
    ]
  }
}
```

### 其他

```bash
# Total workout count
hevy count

# List routine folders
hevy folders
```

## 使用示例

**用户提问：“我今天在健身房做了什么？”**
```bash
hevy workouts
```

**用户提问：“给我看看我最近一次胸部训练。”**
```bash
hevy workouts --limit 10  # Find relevant workout ID
hevy workout <id>         # Get details
```

**用户提问：“我的卧推进展如何？”**
```bash
hevy exercises --search "bench press"  # Get exercise template ID
hevy history <exercise-id>              # View progression
```

**用户提问：“我有哪些常规训练？”**
```bash
hevy routines
hevy routine <id>  # For details
```

**用户提问：“查找腿部训练动作。”**
```bash
hevy exercises --muscle quadriceps
hevy exercises --muscle hamstrings
hevy exercises --muscle glutes
```

**用户提问：“创建一个推类训练日常规。”**
```bash
# 1. Find exercise IDs
hevy exercises --search "bench press"
hevy exercises --search "shoulder press"
# 2. Create routine JSON with those IDs and pipe to create-routine
```

## 注意事项

- **重复预防**：`create-exercise` 在创建前会检查是否存在同名练习动作。可使用 `--force` 覆盖（不推荐）。
- **API 限制**：Hevy API 不支持删除或编辑练习模板——仅支持创建。请在应用中手动删除练习动作。
- **API 速率限制**：批量获取全部数据（使用 --all 标志）时请谨慎操作。
- **重量单位**：默认为磅（lbs），使用 --kg 切换为千克（kg）
- **分页**：大多数命令自动分页，但使用限制标志可减少 API 调用次数
- **ID**：训练计划/常规训练/练习动作的 ID 均为 UUID，在详细视图中显示

## API 参考

完整 API 文档：https://api.hevyapp.com/docs/

### 可用端点
- `GET /v1/workouts` - 列出训练计划（分页）
- `GET /v1/workouts/{id}` - 获取单个训练计划
- `GET /v1/workouts/count` - 训练计划总数
- `GET /v1/routines` - 列出常规训练
- `GET /v1/routines/{id}` - 获取单个常规训练
- `GET /v1/exercise_templates` - 列出练习动作
- `GET /v1/exercise_templates/{id}` - 获取单个练习动作
- `GET /v1/exercise_history/{id}` - 动作历史记录
- `GET /v1/routine_folders` - 列出文件夹

### 写入操作（支持但需谨慎使用）
- `POST /v1/workouts` - 创建训练计划
- `PUT /v1/workouts/{id}` - 更新训练计划
- `POST /v1/routines` - 创建常规训练
- `PUT /v1/routines/{id}` - 更新常规训练
- `POST /v1/exercise_templates` - 创建自定义练习动作
- `POST /v1/routine_folders` - 创建文件夹

CLI 主要聚焦于读取操作。写入操作可通过 API 客户端以编程方式调用。