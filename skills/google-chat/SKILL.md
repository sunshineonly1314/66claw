---
name: google-chat
name_zh: Google Chat
description: 通过 Webhook 或 OAuth 向 Google Chat 的群组（spaces）和用户发送消息。当需要向 Google Chat 频道（spaces）或特定用户发送通知、告警或普通消息时使用。同时支持入站 Webhook（适用于预定义频道）和 OAuth 2.0（适用于向任意群组或用户动态发送消息）。
description_zh: 通过 Webhook 或 OAuth 向 Google Chat 的群组（spaces）和用户发送消息。当需要向 Google Chat 频道（spaces）或特定用户发送通知、告警或普通消息时使用。同时支持入站 Webhook（适用于预定义频道）和 OAuth 2.0（适用于向任意群组或用户动态发送消息）。
---
# Google Chat 消息发送

支持两种方式向 Google Chat 发送消息：

1. **Webhook** —— 快速、预配置的频道（消息以 bot 形式显示）  
2. **OAuth** —— 动态向任意群组或用户发送消息（需身份验证）

## 快速开始

### 方法 1：Webhook（推荐用于已知频道）

向预配置频道发送消息：

```bash
python3 scripts/send_webhook.py "$WEBHOOK_URL" "Your message here"
```

带线程（threading）的示例：
```bash
python3 scripts/send_webhook.py "$WEBHOOK_URL" "Reply message" --thread_key "unique-thread-id"
```

**配置方式：** 将 Webhook 地址存于 `google-chat-config.json` 中：

```json
{
  "webhooks": {
    "acs_engineering_network": "https://chat.googleapis.com/v1/spaces/...",
    "general": "https://chat.googleapis.com/v1/spaces/..."
  }
}
```

读取配置并发送：
```bash
WEBHOOK_URL=$(jq -r '.webhooks.acs_engineering_network' google-chat-config.json)
python3 scripts/send_webhook.py "$WEBHOOK_URL" "Deploy completed ✅"
```

### 方法 2：OAuth（适用于动态消息）

**首次设置：**

1. 将 OAuth 凭据保存为文件（例如：`google-chat-oauth-credentials.json`）  
2. 运行初始身份验证（将自动打开浏览器并保存令牌）：

```bash
python3 scripts/send_oauth.py \
  --credentials google-chat-oauth-credentials.json \
  --token google-chat-token.json \
  --space "General" \
  "Test message"
```

**按群组名称发送：**  
```bash
python3 scripts/send_oauth.py \
  --credentials google-chat-oauth-credentials.json \
  --token google-chat-token.json \
  --space "Engineering Network" \
  "Deploy completed"
```

**注意：** OAuth 消息默认自动添加 `🤖` emoji 前缀。如需禁用，请使用 `--no-emoji`：  
```bash
python3 scripts/send_oauth.py \
  --credentials google-chat-oauth-credentials.json \
  --token google-chat-token.json \
  --space "Engineering Network" \
  "Message without emoji" \
  --no-emoji
```

**列出可用群组：**  
```bash
python3 scripts/send_oauth.py \
  --credentials google-chat-oauth-credentials.json \
  --token google-chat-token.json \
  --list-spaces
```

**向私聊（DM）发送（需已有 space ID）：**  
```bash
# Note: Google Chat API doesn't support creating new DMs by email
# You need the space ID of an existing DM conversation
python3 scripts/send_oauth.py \
  --credentials google-chat-oauth-credentials.json \
  --token google-chat-token.json \
  --space-id "spaces/xxxxx" \
  "The report is ready"
```

**按 space ID 发送（速度更快）：**  
```bash
python3 scripts/send_oauth.py \
  --credentials google-chat-oauth-credentials.json \
  --token google-chat-token.json \
  --space-id "spaces/AAAALtlqgVA" \
  "Direct message to space"
```

## 依赖项

安装所需 Python 包：

```bash
pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

**必需的 OAuth 权限范围（Scopes）：**  
- `https://www.googleapis.com/auth/chat.messages` —— 发送消息  
- `https://www.googleapis.com/auth/chat.spaces` —— 访问群组信息  
- `https://www.googleapis.com/auth/chat.memberships.readonly` —— 列出群组成员（用于识别私聊）  

## OAuth 设置指南

若尚未配置 OAuth 凭据：

1. 访问 [Google Cloud Console](https://console.cloud.google.com)  
2. 选择已有项目或新建项目  
3. 启用 **Google Chat API**  
4. 进入 **API 和服务 → 凭据**  
5. 创建 **OAuth 2.0 客户端 ID**（类型为“桌面应用”）  
6. 下载 JSON 文件并保存为 `google-chat-oauth-credentials.json`  

该凭据 JSON 文件应形如：  
```json
{
  "installed": {
    "client_id": "...apps.googleusercontent.com",
    "client_secret": "GOCSPX-...",
    "redirect_uris": ["http://localhost"],
    ...
  }
}
```

## Webhook 设置指南

为 Google Chat 群组创建 Webhook：

1. 在浏览器中打开 Google Chat  
2. 进入目标群组  
3. 点击群组名称 → **应用与集成（Apps & integrations）**  
4. 点击 **管理 Webhook（Manage webhooks）** → **添加 Webhook（Add webhook）**  
5. 输入名称（例如：“Agustin Networks”）  
6. 复制 Webhook URL  
7. 将其添加至 `google-chat-config.json`  

## 如何选择合适的方法

**选用 Webhook 的场景：**  
- 需反复向相同频道发送消息  
- 消息应以 bot / 服务身份显示  
- 速度至关重要（无需 OAuth 握手）  
- 配置为静态  

**选用 OAuth 的场景：**  
- 需动态向不同群组发送消息  
- 消息应以您配置的 Google Chat 应用身份显示  
- 群组名称在运行时才确定  
- 需要列出并发现可用群组  

**OAuth 限制说明：**  
- 无法通过邮箱地址创建新的私聊（DM）（Google Chat API 限制）  
- 若要发送私聊消息，您必须已知一个现有对话的 space ID  
- 使用 `--list-spaces` 查找可用的私聊 space ID  

## 消息格式

两种方式均支持纯文本。如需高级格式（卡片、按钮等），请构造 JSON 负载：

**带卡片的 Webhook 示例：**  
```python
import json
import urllib.request

payload = {
    "cardsV2": [{
        "cardId": "unique-card-id",
        "card": {
            "header": {"title": "Deploy Status"},
            "sections": [{
                "widgets": [{
                    "textParagraph": {"text": "Production deploy completed successfully"}
                }]
            }]
        }
    }]
}

data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(webhook_url, data=data, headers={"Content-Type": "application/json"})
urllib.request.urlopen(req)
```

## 故障排除

**Webhook 错误：**  
- 验证 Webhook URL 是否正确且有效  
- 检查群组是否仍存在，且 Webhook 未被删除  
- 确保消息内容不为空  

**OAuth 错误：**  
- 若令牌过期，请重新运行身份验证流程  
- 验证 Google Chat API 是否已在 Cloud Console 中启用  
- 检查用户是否拥有目标群组的访问权限  
- 对于私聊，请确认用户邮箱地址正确且属于同一 Workspace  

**权限错误：**  
- Webhook：您必须是该群组的成员  
- OAuth：您必须拥有目标群组或用户的访问权限  
- 企业 Workspace：部分功能可能受管理员策略限制  

## 示例

**向工程频道部署通知：**  
```bash
WEBHOOK=$(jq -r '.webhooks.acs_engineering_network' google-chat-config.json)
python3 scripts/send_webhook.py "$WEBHOOK" "🚀 Production deploy v2.1.0 completed"
```

**向特定用户发送任务告警：**  
```bash
python3 scripts/send_oauth.py \
  --credentials google-chat-oauth-credentials.json \
  --token google-chat-token.json \
  --dm juan@empresa.com \
  "Your report is ready for review: https://docs.company.com/report"
```

**将多条消息组织为同一线程（Webhook）：**  
```bash
WEBHOOK=$(jq -r '.webhooks.general' google-chat-config.json)
THREAD_KEY="deploy-$(date +%s)"

python3 scripts/send_webhook.py "$WEBHOOK" "Starting deploy..." --thread_key "$THREAD_KEY"
# ... deployment happens ...
python3 scripts/send_webhook.py "$WEBHOOK" "Deploy completed ✅" --thread_key "$THREAD_KEY"
```