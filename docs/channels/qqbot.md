# QQ 机器人配置指南

QQ 机器人渠道支持通过 QQ 开放平台官方机器人与用户交互。

## 快速开始

最小配置：

```json5
{
  channels: {
    qqbot: {
      enabled: true,
      app: {
        appId: "你的AppID",
        appSecret: "你的AppSecret",
      },
    },
  },
}
```

或使用环境变量：

```bash
OPENCLAWCN_QQBOT_APP_ID=你的AppID
OPENCLAWCN_QQBOT_APP_SECRET=你的AppSecret
```

## 平台配置步骤

### 1. 登录 QQ 开放平台

访问 [q.qq.com](https://q.qq.com/)，使用 QQ 账号登录开发者后台。

### 2. 创建机器人应用

1. 进入「应用管理」
2. 点击「创建应用」
3. 选择「机器人」类型
4. 填写应用信息并提交

### 3. 获取应用凭证

在应用详情页获取：

- **AppID**：应用唯一标识
- **AppSecret (ClientSecret)**：应用密钥

### 4. 配置 IP 白名单（重要！）

QQ 开放平台要求配置 IP 白名单才能调用 API：

1. 进入应用的「开发设置」
2. 找到「IP 白名单」配置
3. 添加你服务器的公网 IP 地址

> ⚠️ **注意**：未配置 IP 白名单会导致 API 调用失败，错误码 100002。

### 5. 配置消息接收地址

在「开发设置」→「消息接收配置」中：

1. 填写 Webhook URL：`https://your-domain.com/qqbot/webhook`
2. 配置验证 Token（可选）

### 6. 发布机器人

完成配置后，提交审核并发布机器人。

## 配置参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|-----|------|-----|-------|------|
| `enabled` | boolean | 否 | `true` | 是否启用 |
| `sandbox` | boolean | 否 | `false` | 是否使用沙箱环境 |
| `app.appId` | string | 是 | - | QQ 机器人 AppID |
| `app.appSecret` | string | 是 | - | QQ 机器人 AppSecret |
| `app.token` | string | 否 | - | 回调验证 Token |
| `webhookPath` | string | 否 | `/qqbot/webhook` | Webhook 接收路径 |
| `dmPolicy` | string | 否 | `pairing` | 私聊策略 |
| `groupPolicy` | string | 否 | `allowlist` | 群聊策略 |
| `allowFrom` | string[] | 否 | - | 允许的用户 ID 列表 |

## 完整配置示例

```json5
{
  channels: {
    qqbot: {
      enabled: true,
      sandbox: false,
      app: {
        appId: "1234567890",
        appSecret: "your-app-secret",
        token: "your-callback-token", // 可选
      },
      webhookPath: "/qqbot/webhook",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      allowFrom: ["user-open-id-1", "user-open-id-2"],
    },
  },
}
```

## 环境变量配置

支持通过环境变量配置：

```bash
# 必填
OPENCLAWCN_QQBOT_APP_ID=1234567890
OPENCLAWCN_QQBOT_APP_SECRET=your-app-secret

# 可选
OPENCLAWCN_QQBOT_TOKEN=your-callback-token
OPENCLAWCN_QQBOT_SANDBOX=false
```

## 消息类型支持

| 消息类型 | 发送 | 接收 |
|---------|-----|------|
| 文本 | ✅ | ✅ |
| 图片 | ⚠️ 需上传 | ✅ |
| 文件 | ⚠️ 需上传 | ✅ |
| Markdown | ✅ | - |

## 常见问题

### 1. API 调用失败，错误码 100002

**原因**：服务器 IP 未加入白名单。

**解决**：
1. 查看服务器的公网 IP
2. 在 QQ 开放平台的「开发设置」→「IP 白名单」中添加

### 2. 无法接收消息

**可能原因**：
- Webhook URL 配置不正确
- 服务器无法被 QQ 开放平台访问
- 机器人未发布

**解决**：
1. 确保服务器有公网 IP 或域名
2. 检查防火墙是否允许 HTTP/HTTPS 入站
3. 确保机器人已通过审核并发布

### 3. 沙箱模式和正式模式的区别

- **沙箱模式**：用于开发测试，API 地址为 `sandbox.api.sgroup.qq.com`
- **正式模式**：用于生产环境，API 地址为 `api.sgroup.qq.com`

配置 `sandbox: true` 启用沙箱模式。

### 4. 私聊和群聊策略

- `dmPolicy: "open"` - 任何人都可以私聊机器人
- `dmPolicy: "allowlist"` - 只有白名单用户可以私聊
- `dmPolicy: "pairing"` - 需要配对审批后才能私聊（推荐）

- `groupPolicy: "open"` - 机器人响应所有群消息
- `groupPolicy: "allowlist"` - 只响应白名单群的消息

## 参考链接

- [QQ 开放平台](https://q.qq.com/)
- [QQ 机器人 API 文档](https://q.qq.com/wiki/develop/api-v2/)
- [消息类型说明](https://q.qq.com/wiki/develop/api-v2/server-inter/message/send-receive/send.html)
