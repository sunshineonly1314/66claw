---
name: oura-ring
name_zh: Oura手环技能
description: 通过 Oura Cloud API V2 获取 Oura Ring 的准备度/睡眠数据及 7 日准备度趋势，并生成晨间准备度简报。
description_zh: 通过 Oura Cloud API V2 获取 Oura Ring 的准备度/睡眠数据及 7 日准备度趋势，并生成晨间准备度简报。
---
# Oura Ring（V1）

该 skill 提供了一个轻量、面向公众的参考实现，用于从 **Oura V2 API** (`/v2/usercollection/*`) 拉取 **准备度（Readiness）**、**睡眠（Sleep）** 及 **7 日准备度趋势（7-day Readiness trends）**。

## 快速参考

- CLI（原始数据）：
  - `python3 skills/oura-ring/cli.py --format json --pretty readiness`
  - `python3 skills/oura-ring/cli.py --format json --pretty sleep`
  - `python3 skills/oura-ring/cli.py --format json --pretty trends`
  - `python3 skills/oura-ring/cli.py --format json --pretty resilience`
  - `python3 skills/oura-ring/cli.py --format json --pretty stress`

- 晨间简报（格式化输出）：
  - `./skills/oura-ring/scripts/morning_brief.sh`

## 功能

- **晨间准备度简报（Morning Readiness Brief）**：基于最新得分生成战术性建议。
- **趋势分析（Trend Analysis）**：洞察过去 7 天各项得分的变化情况。
- **韧性追踪（Resilience Tracking）**：实时映射压力管理能力。

## 设置

### 1) 安装依赖项（推荐使用 venv）

macOS/Homebrew Python 常会阻止系统级 `pip install`（PEP 668），因此请使用虚拟环境：

```bash
python3 -m venv skills/oura-ring/.venv
source skills/oura-ring/.venv/bin/activate
python -m pip install -r skills/oura-ring/requirements.txt
```

### 2) 创建您的 `.env`

创建 `skills/oura-ring/.env`：

```bash
cp skills/oura-ring/.env.example skills/oura-ring/.env
# then edit skills/oura-ring/.env
```

CLI 将读取以下配置项：
- `OURA_TOKEN`（必需）
- `OURA_BASE_URL`（可选；默认为 `https://api.ouraring.com/v2/usercollection`）

## 获取 Oura 访问令牌（OAuth2）

Oura V2 使用 OAuth2 Bearer Token。

1. 创建 Oura API 应用程序：
   - https://cloud.ouraring.com/oauth/applications
2. 设置重定向 URI（本地测试时可设为类似 `http://localhost:8080/callback` 的地址）。
3. 打开授权 URL（请将 `CLIENT_ID`、`REDIRECT_URI` 和 `scope` 替换为实际值）：

```text
https://cloud.ouraring.com/oauth/authorize?response_type=code&client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&scope=readiness%20sleep
```

4. 授权后，您将被重定向至您的重定向 URI，并附带一个 `code=...` 查询参数。
5. 使用该 code 换取访问令牌：

```bash
curl -X POST https://api.ouraring.com/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d grant_type=authorization_code \
  -d client_id=CLIENT_ID \
  -d client_secret=CLIENT_SECRET \
  -d redirect_uri=REDIRECT_URI \
  -d code=AUTH_CODE
```

6. 将返回的 `access_token` 写入 `skills/oura-ring/.env` 文件，键名为 `OURA_TOKEN=...`。

注意事项：
- 访问令牌可能过期；您可能需要使用 `refresh_token` 刷新令牌。
- **切勿** 将您的 `.env` 文件提交至版本控制。

## 使用方法

### 准备度（Readiness）

```bash
python3 skills/oura-ring/cli.py --env-file skills/oura-ring/.env --format json --pretty readiness
```

### 睡眠（Sleep）

```bash
python3 skills/oura-ring/cli.py --env-file skills/oura-ring/.env --format json --pretty sleep
```

### 趋势（最近 7 天；分页返回）

```bash
python3 skills/oura-ring/cli.py --env-file skills/oura-ring/.env --format json --pretty trends
```

## 封装器：晨间准备度简报（Morning Readiness Brief）

```bash
./skills/oura-ring/scripts/morning_brief.sh
```

覆盖环境文件路径：

```bash
OURA_ENV_FILE=/path/to/.env ./skills/oura-ring/scripts/morning_brief.sh
```

以模拟模式运行（无需令牌）：

```bash
OURA_MOCK=1 ./skills/oura-ring/scripts/morning_brief.sh
```

## 验证（无需令牌）

```bash
python3 skills/oura-ring/cli.py --mock readiness --format json
python3 skills/oura-ring/cli.py --mock sleep --format json
python3 skills/oura-ring/cli.py --mock trends --format json
```