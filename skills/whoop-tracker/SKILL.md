---
name: whoop-tracker
name_zh: WHOOP追踪器
description: 通过官方 API 访问 WHOOP 健身追踪器数据，包括恢复分数、睡眠指标、训练统计、每日负荷及身体测量数据。当用户询问其 WHOOP 数据、健身指标、恢复状态、睡眠质量、训练表现，或希望追踪健康趋势时使用。
description_zh: 通过官方 API 访问 WHOOP 健身追踪器数据，包括恢复分数、睡眠指标、训练统计、每日负荷及身体测量数据。当用户询问其 WHOOP 数据、健身指标、恢复状态、睡眠质量、训练表现，或希望追踪健康趋势时使用。
---
# WHOOP API

通过官方 REST API 检索并分析 WHOOP 可穿戴设备的健身数据。

## 使用示例  
```bash
# Install (if using Clawdhub)
clawdhub install whoop-tracker

# From the skill root:
python3 scripts/get_recovery.py --today
python3 scripts/get_sleep.py --last
python3 scripts/get_workouts.py --days 7
python3 scripts/get_profile.py
```

## 前置条件  

- Python 3.7+  
- `requests` 库：`pip3 install requests`  
  （或运行 `bash scripts/install.sh`）

## 快速入门  

### 1. 注册应用  
- 访问 https://developer.whoop.com  
- 创建新应用，并记下您的 `client_id` 和 `client_secret`  
- 设置重定向 URI（例如：`http://localhost:8080/callback`）  

### 2. 保存凭据  
```bash
mkdir -p ~/.whoop
cat > ~/.whoop/credentials.json <<EOF
{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET"
}
EOF
chmod 600 ~/.whoop/credentials.json
```

### 3. 授权（详见 [references/oauth.md](references/oauth.md) 完整指南）  
- 在浏览器中打开授权 URL  
- 用户授予权限 → 被重定向并附带授权码  
- 通过 `WhoopClient.authenticate(code, redirect_uri)` 将授权码兑换为令牌  

### 4. 获取数据  
所有脚本均需在 skill 根目录下运行：

```bash
# Today's recovery
python3 scripts/get_recovery.py --today

# Last night's sleep
python3 scripts/get_sleep.py --last

# Recent workouts
python3 scripts/get_workouts.py --days 7

# User profile
python3 scripts/get_profile.py
```

## 核心数据类型  

### 恢复（Recovery）  
- **恢复分数（Recovery Score）**（0–100）：应对负荷的准备度  
- **HRV（RMSSD）**：心率变异性（毫秒）  
- **静息心率（Resting Heart Rate）**：晨间基础心率  
- **SpO₂**：血氧饱和度百分比  
- **皮肤温度（Skin Temperature）**：相对于基线的偏差（℃）  

### 睡眠（Sleep）  
- **表现百分比（Performance %）**：实际睡眠质量相对于睡眠需求的达成度  
- **时长（Duration）**：总卧床时间及各阶段（REM、SWS、浅睡、清醒）时长  
- **效率百分比（Efficiency %）**：实际入睡时长 / 卧床总时长  
- **规律性百分比（Consistency %）**：睡眠作息的稳定性  
- **呼吸频率（Respiratory Rate）**：每分钟呼吸次数  
- **所需睡眠/睡眠负债（Sleep Needed/Debt）**：基础需求与累积负债  

### 周期（Cycle，即每日负荷）  
- **负荷分数（Strain Score）**：心血管负荷（0–21 分制）  
- **千焦耳（Kilojoules）**：能量消耗  
- **平均/最高心率（Average/Max Heart Rate）**：每日心率指标  

### 训练（Workout）  
- **负荷（Strain）**：特定活动的负荷分数  
- **运动类型（Sport）**：活动种类（跑步、骑行等）  
- **心率区间（Heart Rate Zones）**：在 6 个心率区间中各自停留的时间  
- **距离/海拔（Distance/Altitude）**：GPS 相关指标（如适用）  

## API 端点  

基础 URL：`https://api.prod.whoop.com`  

完整端点文档（含响应结构）请参阅 [references/api-reference.md](references/api-reference.md)。

**用户档案：**  
- `GET /v1/user/profile/basic` — 姓名、邮箱  
- `GET /v1/user/body_measurement` — 身高、体重、最大心率  

**恢复：**  
- `GET /v1/recovery` — 全部恢复数据（支持分页）  
- `GET /v1/cycle/{cycleId}/recovery` — 特定周期的恢复数据  

**睡眠：**  
- `GET /v1/sleep` — 全部睡眠记录（支持分页）  
- `GET /v1/sleep/{sleepId}` — 指定 ID 的睡眠记录  
- `GET /v1/cycle/{cycleId}/sleep` — 特定周期的睡眠数据  

**周期：**  
- `GET /v1/cycle` — 全部生理周期（支持分页）  
- `GET /v1/cycle/{cycleId}` — 指定 ID 的周期数据  

**训练：**  
- `GET /v1/workout` — 全部训练记录（支持分页）  
- `GET /v1/workout/{workoutId}` — 指定 ID 的训练记录  

所有集合端点均支持 `start`、`end`（ISO 8601 格式）、`limit`（最大值 25）及 `nextToken`（分页游标）。

## 所需 OAuth 权限（Scopes）  

- `read:profile` — 用户姓名与邮箱  
- `read:body_measurement` — 身高、体重、最大心率  
- `read:recovery` — 恢复分数与 HRV  
- `read:sleep` — 睡眠指标与阶段  
- `read:cycles` — 每日负荷数据  
- `read:workout` — 活动与训练数据  

## 脚本  

### `scripts/whoop_client.py`  
核心 API 客户端。特性包括：  
- OAuth 令牌存储与自动刷新  
- 令牌过期追踪（主动刷新）  
- 速率限制处理（429 错误并自动重试）  
- 自动分页迭代器（`iter_recovery`、`iter_sleep`、`iter_cycles`、`iter_workouts`）  

### `scripts/get_recovery.py`  
```bash
python3 scripts/get_recovery.py --today              # Today's recovery
python3 scripts/get_recovery.py --days 7             # Past week
python3 scripts/get_recovery.py --start 2026-01-20   # From date
python3 scripts/get_recovery.py --json               # Raw JSON output
```  

### `scripts/get_sleep.py`  
```bash
python3 scripts/get_sleep.py --last       # Last night
python3 scripts/get_sleep.py --days 7     # Past week
python3 scripts/get_sleep.py --json       # Raw JSON output
```  

### `scripts/get_workouts.py`  
```bash
python3 scripts/get_workouts.py --days 7             # Past week
python3 scripts/get_workouts.py --sport running       # Filter by sport
python3 scripts/get_workouts.py --json                # Raw JSON output
```  

### `scripts/get_profile.py`  
```bash
python3 scripts/get_profile.py            # Profile + body measurements
python3 scripts/get_profile.py --json     # Raw JSON output
```  

### `scripts/install.sh`  
```bash
bash scripts/install.sh                   # Install pip dependencies + setup guide
```  

## 故障排除  

### “ModuleNotFoundError: No module named 'requests'”  
安装依赖：`pip3 install requests` 或 `bash scripts/install.sh`  

### “Credentials not found at ~/.whoop/credentials.json”  
请按快速入门第二步创建该文件，并填入您的 OAuth client_id 与 client_secret。

### “Not authenticated”  
请完成 OAuth 授权流程（参见 [references/oauth.md](references/oauth.md)）。

### “401 Unauthorized” 且令牌刷新失败  
您的刷新令牌已过期。请重新从授权 URL 开始授权流程。

### “429 Too Many Requests”  
已达速率限制。客户端将自动在 `Retry-After` 时间间隔后重试。

### 返回空结果  
请检查日期范围 —— 建议使用 `--days 7` 或更宽泛的范围；同时确认您的 OAuth 权限已涵盖所请求的数据类型。

## 参考资料  

- [references/oauth.md](references/oauth.md) — OAuth 配置、令牌管理、授权流程  
- [references/api-reference.md](references/api-reference.md) — 完整 API 端点文档（含响应结构）  