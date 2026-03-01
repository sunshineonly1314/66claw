---
name: plaud-api
name_zh: Plaud（非官方）
description: 在访问 Plaud 录音设备数据（录音、转录文本、AI 摘要）时使用——指导凭证配置，并为 plaud_client.py 提供调用模式
description_zh: 在访问 Plaud 录音设备数据（录音、转录文本、AI 摘要）时使用——指导凭证配置，并为 plaud_client.py 提供调用模式
aliases:
  - plaud
  - plaud-recordings
---
# Plaud API Skill

访问 Plaud 录音设备数据，包括录音、转录文本和 AI 生成的摘要。

## 概述

Plaud API 提供以下数据访问能力：
- **音频文件**：来自 Plaud 设备的 MP3 录音
- **转录文本**：带说话人区分（speaker diarization）的全文转录
- **AI 摘要**：自动生成的笔记与摘要

**核心原则**：使用 `plaud_client.py`（本 skill 中已包含），而非直接调用原始 API。客户端已封装认证、错误处理与响应解析。

## 何时使用本 skill

当出现以下情况时，请使用本 skill：
- 用户提及 “Plaud”、“Plaud 录音” 或 “Plaud 的转录文本”
- 需要访问录音设备数据
- 正在处理 Plaud 设备的录音、转录文本或 AI 笔记

## 交互式凭证配置教程

在使用 Plaud API 前，你需要从网页应用中提取凭证。

### 步骤 1：访问 Plaud 网页应用

打开 Chrome 浏览器，访问：https://web.plaud.ai

如尚未登录，请使用你的 Plaud 账户登录。

### 步骤 2：打开 Chrome 开发者工具

按 `F12`（Mac 上为 `Cmd+Option+I`）打开开发者工具。

### 步骤 3：查找 localStorage 值

1. 在开发者工具中点击 **Application（应用）** 标签页
2. 在左侧边栏中展开 **Local Storage**
3. 点击 `https://web.plaud.ai`

### 步骤 4：复制所需值

找到并复制以下两个值：

| 键 | 描述 |
|-----|-------------|
| `tokenstr` | 你的 bearer token（以 "bearer eyJ..." 开头） |
| `plaud_user_api_domain` | API 端点（例如："https://api-euc1.plaud.ai"） |

### 步骤 5：创建 .env 文件

在 skill 目录（`~/.claude/skills/plaud-api/`）中创建或更新 `.env` 文件：

```bash
# In the skill directory
cd ~/.claude/skills/plaud-api
cp .env.example .env
# Edit .env with your actual credentials
```

或直接创建：

```bash
cat > ~/.claude/skills/plaud-api/.env << 'EOF'
PLAUD_TOKEN=bearer eyJ...your_full_token_here...
PLAUD_API_DOMAIN=https://api-euc1.plaud.ai
EOF
```

**重要提示**：请包含完整的 token，含开头的 "bearer " 前缀。

### 步骤 6：验证配置

测试凭证是否有效：

```bash
cd ~/.claude/skills/plaud-api
python3 plaud_client.py list
```

若成功，你将看到一份录音列表，含文件 ID、时长与名称。

**首次配置**：如需，请先安装依赖项：
```bash
pip install -r ~/.claude/skills/plaud-api/requirements.txt
```

## .env 文件格式

```
PLAUD_TOKEN=bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PLAUD_API_DOMAIN=https://api-euc1.plaud.ai
```

**备注**：
- token 包含 "bearer " 前缀
- API 域名依区域而定（欧盟用户：`api-euc1`；美国用户可能不同）

## 快速参考

所有命令均需在 skill 目录（`~/.claude/skills/plaud-api`）下运行：

| 任务 | 命令 |
|------|---------|
| 列出全部录音 | `python3 plaud_client.py list` |
| 以 JSON 格式列出 | `python3 plaud_client.py list --json` |
| 获取文件详情 | `python3 plaud_client.py details <file_id>` |
| 以 JSON 格式获取详情 | `python3 plaud_client.py details <file_id> --json` |
| 下载音频 | `python3 plaud_client.py download <file_id>` |
| 下载至指定路径 | `python3 plaud_client.py download <file_id> -o output.mp3` |
| 下载全部文件 | `python3 plaud_client.py download-all -o ./recordings` |
| 获取文件标签/文件夹 | `python3 plaud_client.py tags` |

## 常用模式

### 获取近期转录文本

```bash
cd ~/.claude/skills/plaud-api

# List files to find IDs
python3 plaud_client.py list

# Get transcript for a specific file
python3 plaud_client.py details <file_id> --json | jq '.data.trans_result'
```

### 文件 ID 发现方法

文件 ID 是 32 位十六进制字符串。可通过以下方式获取：
1. **URL**：`https://web.plaud.ai/file/{file_id}`
2. **列表输出**：`python3 plaud_client.py list` 输出的第一列
3. **JSON 输出**：`python3 plaud_client.py list --json | jq '.[].id'`

### 获取 AI 摘要

```bash
python3 plaud_client.py details <file_id> --json | jq '.data.ai_content'
```

### 批量操作

```bash
# Download all recordings to a folder
python3 plaud_client.py download-all -o ./all_recordings

# Get all file IDs
python3 plaud_client.py list --json | jq -r '.[].id'
```

### 仅提取转录文本

```bash
# Get plain transcript text (all segments concatenated)
python3 plaud_client.py details <file_id> --json | jq -r '.data.trans_result.segments[].text' | tr '\n' ' '
```

## 错误处理

| 错误 | 原因 | 解决方法 |
|-------|-------|-----|
| `401 Unauthorized` | Token 已过期或无效 | 重新从 localStorage 中提取 token |
| `Empty response` | file_id 格式无效 | 确认 file_id 为 32 位十六进制字符 |
| `Connection error` | API 域名错误 | 检查 .env 中的 PLAUD_API_DOMAIN |
| `Token required` | 缺少 .env 或 PLAUD_TOKEN | 请按上述凭证配置教程操作 |

## Token 刷新

Plaud token 有效期很长（约 10 个月），但过期后请按以下步骤刷新：

1. 登录 https://web.plaud.ai
2. 打开开发者工具 > Application（应用）> Local Storage
3. 复制新的 `tokenstr` 值
4. 更新你的 `.env` 文件

## API 参考

详细 API 文档请参阅本 skill 目录中附带的 `PLAUD_API.md`。

plaud_client.py 所用关键端点：
- `GET /file/simple/web` —— 列出全部文件
- `GET /file/detail/{file_id}` —— 获取含转录文本的文件详情
- `GET /file/download/{file_id}` —— 下载 MP3 音频
- `GET /filetag/` —— 获取文件标签/文件夹

## 包含的文件

| 文件 | 用途 |
|------|---------|
| `plaud_client.py` | 用于全部 Plaud API 操作的命令行工具 |
| `PLAUD_API.md` | 详细的 API 端点文档 |
| `requirements.txt` | Python 依赖项清单 |
| `.env.example` | 凭证模板文件 |