---
name: withings-health
name_zh: Withings健康
description: 从 Withings API 获取健康数据，包括体重、身体成分（脂肪、肌肉、骨骼、水分）、活动量和睡眠数据。当用户询问其 Withings 数据、体重历史、身体指标、每日步数、睡眠质量或任何来自 Withings 设备的健康测量值时，请使用此 skill。
description_zh: 从 Withings API 获取健康数据，包括体重、身体成分（脂肪、肌肉、骨骼、水分）、活动量和睡眠数据。当用户询问其 Withings 数据、体重历史、身体指标、每日步数、睡眠质量或任何来自 Withings 设备的健康测量值时，请使用此 skill。
version: 1.1.0
homepage: https://developer.withings.com/
metadata: {"clawdbot":{"emoji":"⚖️","requires":{"bins":["node"],"env":["WITHINGS_CLIENT_ID","WITHINGS_CLIENT_SECRET"]}}}
---
该 skill 允许你与用户的 Withings 账户交互，以从 Withings 设备（智能体脂秤、睡眠分析仪、活动追踪器等）获取全面的健康指标。

## 使用此 skill 的场景

当用户：
- 询问其 **体重** 或体重历史
- 想查看其 **身体成分**（体脂率、肌肉质量、骨骼质量、含水量）
- 请求其 **每日活动量**（步数、距离、消耗卡路里）
- 询问其 **睡眠数据**（时长、质量、深度睡眠、快速眼动期 REM）
- 提及 “Withings” 或任意 Withings 设备（如 Body+、Sleep Analyzer、ScanWatch 等）
- 希望长期跟踪其健康进展

## 设置：创建 Withings 开发者应用

在使用此 skill 前，你需要创建一个免费的 Withings 开发者应用，以获取 API 凭据。

### 步骤 1：创建 Withings 开发者账户

1. 访问 [Withings 开发者门户](https://developer.withings.com/)
2. 点击 **注册**，或若已有 Withings 账户则点击 **登录**
3. 接受开发者服务条款

### 步骤 2：创建你的应用

1. 导航至 **My Apps** → **Create an Application**
2. 填写应用信息：
   - **Application Name**（应用名称）：自定义名称（例如 “My Clawdbot Health”）
   - **Description**（描述）：简要说明你的使用场景
   - **Contact Email**（联系邮箱）：你的电子邮箱地址
   - **Callback URL**（回调 URL）：`http://localhost:8080`（OAuth 所需）
   - **Application Type**（应用类型）：选择 “Personal Use”（个人用途）或其他合适类型
3. 提交应用

### 步骤 3：获取凭据

应用创建成功后：
1. 进入 **My Apps** 并选择你的应用
2. 你将看到：
   - **Client ID**（客户端 ID）→ 设为 `WITHINGS_CLIENT_ID` 环境变量
   - **Client Secret**（客户端密钥）→ 设为 `WITHINGS_CLIENT_SECRET` 环境变量

### 步骤 4：配置环境变量

将以下内容添加至你的 Clawdbot 环境中：
```bash
export WITHINGS_CLIENT_ID="your_client_id_here"
export WITHINGS_CLIENT_SECRET="your_client_secret_here"
```

或在 skill 目录下创建 `.env` 文件（该文件将被 git 忽略）：
```
WITHINGS_CLIENT_ID=your_client_id_here
WITHINGS_CLIENT_SECRET=your_client_secret_here
```

## 配置

该 skill 使用位于 `{baseDir}` 的 `wrapper.js` 脚本。

在任何数据获取操作前，请先检查用户是否已认证。若错误提示 “No token found”（未找到令牌），请引导用户完成初始认证流程。

## 可用命令

### 1. 认证

首次设置 —— 生成 OAuth URL：
```bash
node {baseDir}/wrapper.js auth
```

用户访问该 URL 并获得授权码后：
```bash
node {baseDir}/wrapper.js auth YOUR_CODE_HERE
```

### 2. 获取体重数据

检索最新的体重测量记录：
```bash
node {baseDir}/wrapper.js weight
```

以 JSON 格式返回最近 5 条体重记录。

**示例输出：**
```json
[
  { "date": "2026-01-17T08:30:00.000Z", "weight": "75.40 kg" },
  { "date": "2026-01-16T08:15:00.000Z", "weight": "75.65 kg" }
]
```

### 3. 获取身体成分数据

检索全面的身体指标（脂肪、肌肉、骨骼、水分、BMI）：
```bash
node {baseDir}/wrapper.js body
```

返回最近 5 条身体成分测量记录。

**示例输出：**
```json
[
  {
    "date": "2026-01-17T08:30:00.000Z",
    "weight": "75.40 kg",
    "fat_percent": "18.5%",
    "fat_mass": "13.95 kg",
    "muscle_mass": "35.20 kg",
    "bone_mass": "3.10 kg",
    "hydration": "55.2%"
  }
]
```

### 4. 获取活动数据

检索每日活动数据（步数、距离、卡路里）：
```bash
node {baseDir}/wrapper.js activity
```

可选指定天数（默认为 7 天）：
```bash
node {baseDir}/wrapper.js activity 30
```

**示例输出：**
```json
[
  {
    "date": "2026-01-17",
    "steps": 8542,
    "distance": "6.23 km",
    "calories": 2150,
    "active_calories": 450,
    "soft_activity": "45 min",
    "moderate_activity": "22 min",
    "intense_activity": "8 min"
  }
]
```

### 5. 获取睡眠数据

检索睡眠数据与质量评估：
```bash
node {baseDir}/wrapper.js sleep
```

可选指定天数（默认为 7 天）：
```bash
node {baseDir}/wrapper.js sleep 14
```

**示例输出：**
```json
[
  {
    "date": "2026-01-17",
    "start": "23:15",
    "end": "07:30",
    "duration": "8h 15min",
    "deep_sleep": "1h 45min",
    "light_sleep": "4h 30min",
    "rem_sleep": "1h 30min",
    "awake": "30min",
    "sleep_score": 82
  }
]
```

## 错误处理

常见错误及其解决方法：

| 错误 | 原因 | 解决方案 |
|-------|-------|----------|
| "No token found"（未找到令牌） | 首次使用，尚未认证 | 运行 `node wrapper.js auth` 并按 OAuth 流程操作 |
| "Failed to refresh token"（刷新令牌失败） | 令牌已过期且刷新失败 | 使用 `node wrapper.js auth` 重新认证 |
| "API Error Status: 401"（API 错误状态：401） | 凭据无效或已过期 | 检查 CLIENT_ID 和 CLIENT_SECRET，重新认证 |
| "API Error Status: 503"（API 错误状态：503） | Withings API 暂不可用 | 稍候重试 |
| 数据为空 | 所请求时间段内无测量记录 | 用户需同步其 Withings 设备 |

## 注意事项

- 令牌将在过期时自动刷新
- 使用的 Withings API 权限范围：`user.metrics`、`user.activity`
- 数据可用性取决于用户所拥有的 Withings 设备类型
- 某些指标（如身体成分）需要兼容的智能体脂秤支持