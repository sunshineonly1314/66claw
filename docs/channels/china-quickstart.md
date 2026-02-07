# 中国 IM 渠道快速上手

本文档帮助你快速配置 Clawdbot 连接国内主流 IM 平台。

## 一分钟选择指南

| 如果你的场景是... | 推荐渠道 | 原因 |
|-----------------|---------|------|
| 企业内部办公 | **飞书** 或 **钉钉** | 无需公网 IP，长连接模式 |
| 客户服务 | **企业微信** | 与微信生态打通 |
| 社区/游戏 | **QQ** | 用户基数大 |
| 开发者团队 | **飞书** | Markdown 支持最好 |

## 渠道对比

| 特性 | 飞书 | 钉钉 | 企业微信 | QQ |
|-----|------|------|---------|-----|
| 无需公网 IP | ✅ WebSocket | ✅ Stream | ❌ 需要 | ❌ 需要 |
| Markdown 支持 | ✅ 完整 | ✅ 支持 | ⚠️ 基础 | ⚠️ 基础 |
| 多账户支持 | ❌ | ❌ | ✅ | ❌ |
| AI Card 流式 | ✅ | ✅ | ❌ | ❌ |
| 配置复杂度 | 低 | 低 | 中 | 中 |

## Docker 快速部署

### 1. 准备配置文件

```bash
# 下载配置模板
curl -O https://raw.githubusercontent.com/clawdbot/clawdbot/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/clawdbot/clawdbot/main/.env.example

# 复制并编辑配置
cp .env.example .env
```

### 2. 编辑 .env 文件

根据你选择的渠道，填写对应配置：

```bash
# AI 模型配置（必填）
CLAWDBOT_API_KEY=sk-xxx
CLAWDBOT_BASE_URL=https://api.openai.com/v1
CLAWDBOT_MODEL_ID=gpt-4

# Gateway 配置（可选）
CLAWDBOT_GATEWAY_TOKEN=your-secure-token
CLAWDBOT_GATEWAY_PORT=18789

# === 选择以下渠道之一配置 ===

# 飞书（推荐）
CLAWDBOT_FEISHU_APP_ID=cli_xxxxx
CLAWDBOT_FEISHU_APP_SECRET=xxxxx

# 钉钉
CLAWDBOT_DINGTALK_APP_KEY=xxxxx
CLAWDBOT_DINGTALK_APP_SECRET=xxxxx

# 企业微信
CLAWDBOT_WECOM_CORP_ID=ww1234567890abcdef
CLAWDBOT_WECOM_AGENT_ID=1000002
CLAWDBOT_WECOM_AGENT_SECRET=xxxxx

# QQ 机器人
CLAWDBOT_QQBOT_APP_ID=xxxxx
CLAWDBOT_QQBOT_APP_SECRET=xxxxx
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 访问管理界面

打开浏览器访问 `http://localhost:18789`

---

## 飞书配置（5 分钟）

### 获取凭证

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 添加「机器人」能力
4. 获取 **App ID** 和 **App Secret**
5. 配置事件订阅（选择「使用长连接接收事件」）

### 必需权限

| 权限 | 说明 |
|------|------|
| `im:message` | 发送和接收消息 |
| `im:message.p2p_msg:readonly` | 读取私聊消息 |
| `im:message.group_at_msg:readonly` | 接收群内 @消息 |
| `contact:user.base:readonly` | 获取用户信息 |

### 配置

```bash
CLAWDBOT_FEISHU_APP_ID=cli_xxxxx
CLAWDBOT_FEISHU_APP_SECRET=xxxxx
CLAWDBOT_FEISHU_MODE=websocket  # 推荐，无需公网 IP
```

详细文档：[飞书配置指南](/channels/feishu)

---

## 钉钉配置（5 分钟）

### 获取凭证

1. 访问 [钉钉开发者后台](https://open-dev.dingtalk.com/)
2. 创建企业内部应用
3. 添加「机器人」能力
4. 获取 **Client ID (AppKey)** 和 **Client Secret (AppSecret)**
5. 配置消息接收模式为「**Stream 模式**」

### 配置

```bash
CLAWDBOT_DINGTALK_APP_KEY=xxxxx
CLAWDBOT_DINGTALK_APP_SECRET=xxxxx
CLAWDBOT_DINGTALK_MODE=stream  # 推荐，无需公网 IP
```

详细文档：[钉钉配置指南](/channels/dingtalk)

---

## 企业微信配置（10 分钟）

### 获取凭证

1. 访问 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/frame)
2. 创建自建应用
3. 获取 **企业 ID**、**Agent ID**、**Agent Secret**
4. 配置「接收消息」的 URL、Token 和 EncodingAESKey

### 注意事项

⚠️ 企业微信需要**公网可访问的服务器**或内网穿透工具。

### 配置

```bash
CLAWDBOT_WECOM_CORP_ID=ww1234567890abcdef
CLAWDBOT_WECOM_AGENT_ID=1000002
CLAWDBOT_WECOM_AGENT_SECRET=xxxxx
CLAWDBOT_WECOM_TOKEN=your-callback-token
CLAWDBOT_WECOM_ENCODING_AES_KEY=xxxxx
```

详细文档：[企业微信配置指南](/channels/wecom)

---

## QQ 机器人配置（10 分钟）

### 获取凭证

1. 访问 [QQ 开放平台](https://q.qq.com/)
2. 创建机器人应用
3. 获取 **AppID** 和 **AppSecret**
4. 配置 **IP 白名单**（重要！）
5. 配置消息接收地址

### 注意事项

⚠️ QQ 机器人需要：
- 公网可访问的服务器
- 服务器 IP 加入白名单

### 配置

```bash
CLAWDBOT_QQBOT_APP_ID=xxxxx
CLAWDBOT_QQBOT_APP_SECRET=xxxxx
CLAWDBOT_QQBOT_SANDBOX=false  # 正式环境设为 false
```

详细文档：[QQ 机器人配置指南](/channels/qqbot)

---

## 常见问题

### 1. 没有公网 IP 怎么办？

**推荐方案**：使用飞书或钉钉的长连接模式，无需公网 IP。

- 飞书：设置 `CLAWDBOT_FEISHU_MODE=websocket`
- 钉钉：设置 `CLAWDBOT_DINGTALK_MODE=stream`

**其他方案**：
- 使用内网穿透工具（如 frp、ngrok）
- 使用云服务器

### 2. 机器人能发消息但收不到消息

**常见原因**：
- 飞书/钉钉：未配置事件订阅
- 企业微信/QQ：Webhook URL 配置不正确
- 防火墙阻止了入站请求

### 3. 如何同时配置多个渠道？

在 `.env` 文件中填写多个渠道的配置即可，Clawdbot 会自动启用所有已配置的渠道。

### 4. 如何切换 AI 模型？

修改 `.env` 中的模型配置：

```bash
# OpenAI
CLAWDBOT_BASE_URL=https://api.openai.com/v1
CLAWDBOT_API_KEY=sk-xxx
CLAWDBOT_MODEL_ID=gpt-4

# 国内模型（如通义千问）
CLAWDBOT_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
CLAWDBOT_API_KEY=sk-xxx
CLAWDBOT_MODEL_ID=qwen-max
```

## 下一步

- [配置工作目录](/configuration#workspace)
- [配置技能插件](/skills)
- [安全最佳实践](/security)
