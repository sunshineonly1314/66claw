---
name: otter
name_zh: Otter
description: Otter.ai 转录命令行工具 — 列出、搜索、下载及同步会议转录稿至 CRM。
description_zh: Otter.ai 转录命令行工具 — 列出、搜索、下载及同步会议转录稿至 CRM。
version: 1.0.0
author: dbhurley
homepage: https://otter.ai
metadata:
  clawdis:
    emoji: "🦦"
    requires:
      bins: ["python3", "uv"]
      env:
        - OTTER_EMAIL
        - OTTER_PASSWORD
    optionalEnv:
      - TWENTY_API_URL
      - TWENTY_API_TOKEN
    primaryEnv: OTTER_EMAIL
---
# Otter.ai 转录命令行工具（CLI）

与 Otter.ai 交互，以管理会议转录稿：列出、搜索、下载、上传、生成 AI 摘要，以及同步至 CRM。

## 🔑 必需密钥

| 变量 | 描述 | 获取方式 |
|----------|-------------|------------|
| `OTTER_EMAIL` | 您的 Otter.ai 账户邮箱 | 您的登录邮箱 |
| `OTTER_PASSWORD` | 您的 Otter.ai 密码 | 在 Otter 账户设置中设定 |

## 🔐 可选密钥（用于 CRM 同步）

| 变量 | 描述 | 获取方式 |
|----------|-------------|------------|
| `TWENTY_API_URL` | Twenty CRM API 端点 | 您的 Twenty 实例 URL |
| `TWENTY_API_TOKEN` | Twenty API 密钥 | Twenty → 设置 → 开发者 → API 密钥 |

## ⚙️ 配置

在 `~/.clawdis/clawdis.json` 中配置：
```json
{
  "skills": {
    "otter": {
      "env": {
        "OTTER_EMAIL": "you@company.com",
        "OTTER_PASSWORD": "your-password",
        "TWENTY_API_URL": "https://api.your-twenty.com",
        "TWENTY_API_TOKEN": "your-token"
      }
    }
  }
}
```

## 📋 命令

### 列出近期转录稿
```bash
uv run {baseDir}/scripts/otter.py list [--limit 10]
```

### 获取完整转录稿
```bash
uv run {baseDir}/scripts/otter.py get <speech_id>
```

### 搜索转录稿
```bash
uv run {baseDir}/scripts/otter.py search "quarterly review"
```

### 下载转录稿
```bash
uv run {baseDir}/scripts/otter.py download <speech_id> [--format txt|pdf|docx|srt]
```

### 上传音频进行转录
```bash
uv run {baseDir}/scripts/otter.py upload /path/to/audio.mp3
```

### 获取 AI 摘要
```bash
uv run {baseDir}/scripts/otter.py summary <speech_id>
```

### 同步至 Twenty CRM
```bash
uv run {baseDir}/scripts/otter.py sync-twenty <speech_id>
uv run {baseDir}/scripts/otter.py sync-twenty <speech_id> --company "Client Name"
```

## 📤 输出格式

所有命令均支持 `--json` 以输出机器可读格式：
```bash
uv run {baseDir}/scripts/otter.py list --json
```

## 🔗 Twenty CRM 集成

同步至 Twenty 时，将创建：
- **备注（Note）**，包含转录稿标题、日期、时长及全文
- 若 `--company` 匹配，则自动关联至对应互动（engagement）

## ⚠️ 注意事项

- 需拥有 Otter.ai 账户（推荐使用 Business 版本以获取 API 访问权限）
- 使用非官方 Otter.ai API
- 使用单点登录（SSO）的用户：请在 Otter 账户设置中创建密码
- 可能存在调用频率限制（rate limits）

## 📦 安装

```bash
clawdhub install otter
```