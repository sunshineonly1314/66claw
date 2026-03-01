---
name: withings-family
name_zh: Withings家庭
description: 从 Withings API 获取多位家庭成员的健康数据，包括体重、身体成分（脂肪、肌肉、骨骼、水分）、活动量和睡眠。当用户询问其本人或家庭成员的 Withings 数据、体重历史、身体指标、每日步数、睡眠质量，或任何来自 Withings 设备的健康测量值时，请使用本 skill。
description_zh: 从 Withings API 获取多位家庭成员的健康数据，包括体重、身体成分（脂肪、肌肉、骨骼、水分）、活动量和睡眠。当用户询问其本人或家庭成员的 Withings 数据、体重历史、身体指标、每日步数、睡眠质量，或任何来自 Withings 设备的健康测量值时，请使用本 skill。
version: 1.0.1
homepage: https://developer.withings.com/
metadata: {"clawdbot":{"emoji":"⚖️","requires":{"bins":["python3"],"env":["WITHINGS_CLIENT_ID","WITHINGS_CLIENT_SECRET"]}}}
---
本 skill 支持与 **多位家庭成员** 的 Withings 账户交互，从而全面获取来自 Withings 设备（智能体重秤、睡眠分析仪、活动追踪器等）的健康指标。

## 多用户支持

本 skill 原生支持多用户，为每位用户单独管理令牌文件：

```
tokens-alice.json
tokens-bob.json
tokens-charlie.json
```

每位家庭成员只需通过 OAuth 认证一次。其令牌被独立存储并自动刷新。无需复制或切换令牌 —— 只需将用户 ID 作为第一个参数传入即可。

```bash
python3 scripts/withings.py alice weight
python3 scripts/withings.py bob sleep
python3 scripts/withings.py charlie activity
```

## 适用场景

当用户：
- 询问其 **体重** 或体重变化历史  
- 想查看其 **身体成分**（体脂率、肌肉质量、骨量、水分含量）  
- 请求其 **日常活动数据**（步数、距离、消耗卡路里）  
- 询问其 **睡眠数据**（时长、质量、深睡时长、REM 睡眠）  
- 提及 “Withings” 或任一 Withings 设备（Body+、Sleep Analyzer、ScanWatch 等）  
- 想追踪其本人或 **家庭成员** 的长期健康进展  

## 配置：创建 Withings 开发者应用

使用本 skill 前，需免费创建一个 Withings 开发者应用以获取 API 凭据。

### 步骤 1：注册 Withings 开发者账户

1. 访问 [Withings 开发者门户](https://developer.withings.com/)  
2. 点击 **注册**，或若您已有 Withings 账户则点击 **登录**  
3. 接受开发者服务条款  

### 步骤 2：创建您的应用

1. 进入 **My Apps（我的应用）** → **Create an Application（创建应用）**  
2. 填写应用信息：  
   - **Application Name（应用名称）**：自定义名称（例如 “My Clawdbot Health”）  
   - **Description（描述）**：简要说明您的使用场景  
   - **Contact Email（联系邮箱）**：您的邮箱地址  
   - **Callback URL（回调 URL）**：`http://localhost:18081`（OAuth 所必需）  
   - **Application Type（应用类型）**：选择 “Personal Use（个人用途）” 或其他合适类型  
3. 提交应用  

### 步骤 3：获取凭据

应用创建成功后：  
1. 进入 **My Apps（我的应用）** 并选择您的应用  
2. 您将看到：  
   - **Client ID（客户端 ID）** → 设置为环境变量 `WITHINGS_CLIENT_ID`  
   - **Client Secret（客户端密钥）** → 设置为环境变量 `WITHINGS_CLIENT_SECRET`  

### 步骤 4：配置环境变量

将以下内容添加至您的 Clawdbot 环境：  
```bash
export WITHINGS_CLIENT_ID="your_client_id_here"
export WITHINGS_CLIENT_SECRET="your_client_secret_here"
```

或在 `~/.clawdbot/withings-family/.env` 目录下创建 `.env` 文件：  
```
WITHINGS_CLIENT_ID=your_client_id_here
WITHINGS_CLIENT_SECRET=your_client_secret_here
```

## 配置说明

本 skill 提供两个脚本（位于 `scripts/`）：  
- **`scripts/withings_oauth_local.py`** —— 自动 OAuth，含本地回调服务器（推荐）  
- **`scripts/withings.py`** —— 主 CLI 工具 + 手动 OAuth  

**凭据存放位置：** `~/.clawdbot/withings-family/`  
- `.env` —— 客户端 ID / 密钥（可选；亦可直接使用环境变量）  
- `tokens-<userId>.json` —— 每位用户的 OAuth 令牌（权限模式 600）  

在任何数据获取操作前，请先确认用户是否已完成认证。若报错提示 “No token found（未找到令牌）”，请引导该用户完成针对其本人的初始认证流程。

## 认证方式

### 方式 A：自动 OAuth（推荐）

使用本地回调服务器自动捕获授权码：

```bash
python3 {baseDir}/scripts/withings_oauth_local.py <userId>
```

示例：  
```bash
python3 {baseDir}/scripts/withings_oauth_local.py alice
```

该脚本将执行以下操作：  
1. 打印授权 URL  
2. 在 localhost:18081 启动本地服务器  
3. 等待重定向响应  
4. 自动捕获授权码并换取令牌  
5. 将令牌保存至 `tokens-<userId>.json`  

### 方式 B：手动 OAuth  

传统两步式流程（参见下方“认证”命令说明）。

## 可用命令

所有命令均遵循如下格式：  
```bash
python3 {baseDir}/scripts/withings.py <userId> <command> [options]
```

### 1. 认证

用户首次设置 —— 生成 OAuth 授权 URL：  
```bash
python3 {baseDir}/scripts/withings.py alice auth
```

用户访问该 URL 并获取授权码后：  
```bash
python3 {baseDir}/scripts/withings.py alice auth YOUR_CODE_HERE
```

对每位需要访问权限的家庭成员均需重复此流程。

### 2. 获取体重数据

检索最新体重测量值：  
```bash
python3 {baseDir}/scripts/withings.py alice weight
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
python3 {baseDir}/scripts/withings.py alice body
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

检索日常活动数据（步数、距离、卡路里）：  
```bash
python3 {baseDir}/scripts/withings.py alice activity
```

可选指定天数（默认：7 天）：  
```bash
python3 {baseDir}/scripts/withings.py alice activity 30
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
python3 {baseDir}/scripts/withings.py alice sleep
```

可选指定天数（默认：7 天）：  
```bash
python3 {baseDir}/scripts/withings.py alice sleep 14
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
|------|------|----------|
| “No token found（未找到令牌）” | 用户尚未认证 | 运行 `python3 scripts/withings.py <userId> auth` 并完成 OAuth 流程 |
| “Failed to refresh token（令牌刷新失败）” | 令牌已过期且刷新失败 | 使用 `python3 scripts/withings.py <userId> auth` 重新认证 |
| “API Error Status: 401（API 错误状态：401）” | 凭据无效或已过期 | 检查 CLIENT_ID 和 CLIENT_SECRET，重新认证 |
| “API Error Status: 503（API 错误状态：503）” | Withings API 暂时不可用 | 稍候重试 |
| 返回空数据 | 所请求时间段内无测量记录 | 用户需同步其 Withings 设备 |

## 注意事项

- **多用户支持**：每位家庭成员拥有独立的令牌文件（`tokens-{userId}.json`）  
- **令牌刷新**：令牌将在过期时自动刷新  
- **作用域（Scopes）**：本 skill 使用的 Withings API 作用域为：`user.metrics`、`user.activity`  
- **设备兼容性**：数据可用性取决于用户所拥有的 Withings 设备类型  
- **身体成分数据**：需配备兼容的智能体重秤（例如 Body+、Body Comp）  