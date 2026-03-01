---
name: garmin-connect
name_zh: Garmin Connect
description: "Garmin Connect 与 Clawdbot 的集成：使用 OAuth 每 5 分钟同步健身数据（步数、心率、卡路里、运动记录、睡眠）。"
description_zh: Garmin Connect 与 Clawdbot 的集成：使用 OAuth 每 5 分钟同步健身数据（步数、心率、卡路里、运动记录、睡眠）。
---
# Garmin Connect 技能（Skill）

将您的全部 Garmin 健身数据同步至 Clawdbot：
- 🚶 **日常活动**：步数、心率、卡路里、活跃分钟数、距离  
- 😴 **睡眠**：时长、质量、深度/快速眼动/浅睡分解  
- 🏋️ **运动记录**：近期活动（含距离、时长、卡路里、心率）  
- ⏱️ **实时同步**：通过 cron 每 5 分钟同步一次  

## 快速入门

### 1. 安装依赖项

```bash
pip install -r requirements.txt
```

### 2. OAuth 认证（一次性）

```bash
python3 scripts/garmin-auth.py your-email@gmail.com your-password
```

该操作将您的 OAuth 会话保存至 `~/.garth/session.json` —— 完全本地化且安全。

### 3. 测试同步

```bash
python3 scripts/garmin-sync.py
```

您应看到包含今日统计数据的 JSON 输出。

### 4. 配置 5 分钟 Cron 任务

添加至您的 crontab：

```bash
*/5 * * * * /home/user/garmin-connect-clawdbot/scripts/garmin-cron.sh
```

或手动执行：

```bash
*/5 * * * * python3 /home/user/garmin-connect-clawdbot/scripts/garmin-sync.py ~/.clawdbot/.garmin-cache.json
```

### 5. 在 Clawdbot 中使用

在脚本中导入并使用：

```python
from scripts.garmin_formatter import format_all, get_as_dict

# Get all formatted data
print(format_all())

# Or get raw dict
data = get_as_dict()
print(f"Steps today: {data['summary']['steps']}")
```

## 功能特性

✅ 基于 OAuth（安全，不存储密码）  
✅ 全部指标：活动、睡眠、运动记录  
✅ 本地缓存（快速访问）  
✅ 支持 cron（5 分钟间隔）  
✅ 便捷的 Clawdbot 集成  
✅ 支持多用户  

## 采集数据

### 日常活动（`summary`）  
- `steps`：日步数  
- `heart_rate_resting`：静息心率（bpm）  
- `calories`：总消耗卡路里  
- `active_minutes`：高强度活动分钟数  
- `distance_km`：行进距离  

### 睡眠（`sleep`）  
- `duration_hours`：总睡眠时长  
- `duration_minutes`：以分钟为单位的睡眠时长  
- `quality_percent`：睡眠质量评分（0–100）  
- `deep_sleep_hours`：深度睡眠时长  
- `rem_sleep_hours`：快速眼动（REM）睡眠时长  
- `light_sleep_hours`：浅睡时长  
- `awake_minutes`：睡眠期间清醒时长  

### 运动记录（`workouts`）  
每项近期运动包含：  
- `type`：运动类型（跑步、骑行等）  
- `name`：运动名称  
- `distance_km`：行进距离  
- `duration_minutes`：运动时长  
- `calories`：消耗卡路里  
- `heart_rate_avg`：平均心率  
- `heart_rate_max`：最高心率  

## 缓存位置

默认缓存路径为：`~/.clawdbot/.garmin-cache.json`

可通过以下方式自定义：
```bash
python3 scripts/garmin-sync.py /custom/path/cache.json
```

## 文件说明

| 文件 | 用途 |
|------|------|
| `garmin-auth.py` | OAuth 初始化（仅需运行一次） |
| `garmin-sync.py` | 主同步逻辑（每 5 分钟运行） |
| `garmin-formatter.py` | 格式化数据以便展示 |
| `garmin-cron.sh` | Cron 包装器脚本 |
| `requirements.txt` | Python 依赖项清单 |

## 故障排查

### OAuth 认证失败

- 检查邮箱与密码  
- 在 Garmin 账户中禁用双因素认证（2FA）（或使用应用密码）  
- Garmin 服务器可能正在限流 —— 请等待 5 分钟  

### 无数据显示

1. 将 Garmin 设备与 Garmin Connect 应用同步  
2. 等待 2–3 分钟让数据同步完成  
3. 确认数据已在 Garmin Connect 网页版/应用中显示  
4. 再次运行 `garmin-sync.py`  

### Cron 权限被拒绝

```bash
chmod +x scripts/garmin-cron.sh
chmod +x scripts/garmin-sync.py
chmod +x scripts/garmin-auth.py
```

### 缓存文件未找到

至少运行一次 `garmin-sync.py` 以创建缓存：
```bash
python3 scripts/garmin-sync.py
```

## 使用示例

```python
from scripts.garmin_formatter import format_all, get_as_dict

# Get formatted output
print(format_all())

# Get raw data
data = get_as_dict()
if data:
    print(f"Sleep: {data['sleep']['duration_hours']}h")
    print(f"Steps: {data['summary']['steps']:,}")
```

## 许可证

MIT — 可自由使用、派生、修改。

---

专为 [Clawdbot](https://clawd.bot) 构建 | 可在 [ClawdHub](https://clawdhub.com) 获取