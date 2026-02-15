---
summary: "企业微信自建应用设置指南"
read_when: "Setting up WeCom (WeChat Work) or debugging WeCom integration"
---

# 企业微信 (WeCom)

企业微信渠道支持通过自建应用接收和发送消息。

## 快速设置

1. 在企业微信管理后台创建自建应用
2. 获取 CorpID、AgentId、AgentSecret
3. 配置回调 URL 并获取 Token 和 EncodingAESKey
4. 配置 OpenClawCN 并启动网关

最小配置:
```json5
{
  channels: {
    wecom: {
      enabled: true,
      app: {
        corpId: "ww1234567890abcdef",
        agentId: 1000002,
        agentSecret: "your-agent-secret",
        token: "your-callback-token",
        encodingAESKey: "your-encoding-aes-key"
      }
    }
  }
}
```

## 详细设置步骤

### 1. 获取企业 ID (CorpID)

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/loginpage_wx)
2. 点击 **我的企业** → 在页面底部找到 **企业ID**
3. 复制企业 ID (格式如 `ww1234567890abcdef`)

### 2. 创建自建应用

1. 在管理后台点击 **应用管理** → **应用** → **自建**
2. 点击 **创建应用**
3. 填写应用信息:
   - 应用名称: 如 "OpenClawCN"
   - 应用 logo: 上传应用图标
   - 可见范围: 选择可以使用此应用的部门/成员
4. 创建完成后，进入应用详情页
5. 记录 **AgentId** (应用 ID，如 `1000002`)
6. 点击 **Secret** 旁的 **查看**，获取应用的 Secret

### 3. 配置接收消息 (回调)

1. 在应用详情页，找到 **接收消息** 设置
2. 点击 **设置API接收**
3. 填写回调配置:
   - **URL**: `https://your-gateway-host/wecom/webhook`
   - **Token**: 点击 **随机获取** 或自行设置 (用于签名验证)
   - **EncodingAESKey**: 点击 **随机获取** (用于消息加解密)
4. 点击 **保存** (此时企业微信会验证 URL，确保网关已启动)

### 4. 配置 OpenClawCN

```json5
{
  channels: {
    wecom: {
      enabled: true,
      app: {
        // 必填
        corpId: "ww1234567890abcdef",      // 企业 ID
        agentId: 1000002,                   // 应用 AgentId
        agentSecret: "your-agent-secret",   // 应用 Secret
        // 回调配置 (接收消息需要)
        token: "your-callback-token",
        encodingAESKey: "43位的EncodingAESKey"
      },
      // 可选配置
      webhookPath: "/wecom/webhook",        // 默认路径
      dmPolicy: "allowlist",                // 私聊策略
      allowFrom: ["user1", "user2"]         // 允许的用户 ID
    }
  }
}
```

### 5. 验证连接

启动网关后，使用以下命令验证连接:

```bash
openclawcn channels status --probe
```

在企业微信 App 中打开自建应用，发送消息测试。

## 配置参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `app.corpId` | string | 是 | 企业 ID |
| `app.agentId` | number | 是 | 应用 AgentId |
| `app.agentSecret` | string | 是 | 应用 Secret |
| `app.token` | string | 接收消息需要 | 回调 Token |
| `app.encodingAESKey` | string | 接收消息需要 | 回调加密 Key (43位) |
| `webhookPath` | string | 否 | Webhook 路径，默认 `/wecom/webhook` |
| `allowFrom` | string[] | 否 | 允许的用户 ID 列表 (私聊白名单) |
| `groupAllowFrom` | string[] | 否 | 允许的群 ID 列表 (群聊白名单) |
| `dmPolicy` | string | 否 | 私聊策略: `open`, `allowlist`, `pairing` |
| `groupPolicy` | string | 否 | 群聊策略: `open`, `allowlist`, `disabled` |
| `requireMention` | boolean | 否 | 群聊是否需要 @机器人 才响应，默认 `true` |
| `accounts` | object | 否 | 多账户配置 (见下文) |
| `defaultAccount` | string | 否 | 默认账户 ID |

## 群聊支持

企业微信渠道支持群聊消息接收和回复。

### 群聊配置

```json5
{
  channels: {
    wecom: {
      enabled: true,
      app: { /* ... */ },
      // 群聊配置
      groupPolicy: "allowlist",           // open=所有群, allowlist=白名单群, disabled=禁用
      groupAllowFrom: ["chatid1", "chatid2"], // 允许的群 ID 列表
      requireMention: true,               // 群聊中是否需要 @机器人 才响应
      // 按群单独配置
      groups: {
        "chatid1": {
          requireMention: false,          // 此群不需要 @机器人
          allowFrom: ["user1", "user2"]   // 此群只响应特定用户
        }
      }
    }
  }
}
```

### 获取群聊 ID

群聊 ID (ChatId) 可通过以下方式获取:
1. 在机器人收到群消息时，日志中会显示 ChatId
2. 通过企业微信 API 创建群聊时返回

## 多账户配置

如果需要同时接入多个企业微信应用（如客服机器人、内部助手），可以使用多账户配置:

```json5
{
  channels: {
    wecom: {
      enabled: true,
      defaultAccount: "customer-service",  // 默认使用的账户
      accounts: {
        "customer-service": {
          name: "客服机器人",
          webhookPath: "/wecom/cs",        // 独立的回调路径
          app: {
            corpId: "ww...",
            agentId: 1000002,
            agentSecret: "...",
            token: "...",
            encodingAESKey: "..."
          },
          dmPolicy: "open"
        },
        "internal": {
          name: "内部助手",
          webhookPath: "/wecom/internal",
          app: {
            corpId: "ww...",
            agentId: 1000003,
            agentSecret: "...",
            token: "...",
            encodingAESKey: "..."
          },
          allowFrom: ["admin1", "admin2"]
        }
      }
    }
  }
}
```

### 多账户说明

- 每个账户可以有独立的 `webhookPath`，需要在企业微信分别配置
- 账户配置会与顶层配置合并，账户配置优先
- `defaultAccount` 指定默认使用的账户 ID

## 消息类型

### 接收消息 (支持)
- 文本消息
- 事件消息 (关注/取消关注)

### 发送消息 (支持)
- 文本消息
- Markdown 消息
- 文本卡片消息

## 用户 ID 说明

企业微信中的用户 ID (UserId) 是企业内部的员工唯一标识，通常由管理员在通讯录中设置。

获取用户 ID:
1. 管理后台 → **通讯录** → 点击成员 → 查看 **账号**
2. 或通过企业微信 API 获取

在 `allowFrom` 中使用用户 ID 来控制访问权限。

## 安全建议

1. **限制可见范围**: 在创建应用时，只选择需要使用的部门/成员
2. **使用 allowlist**: 设置 `dmPolicy: "allowlist"` 并配置 `allowFrom`
3. **保护 Secret**: 不要在代码中硬编码 Secret，使用环境变量或配置文件
4. **HTTPS**: 确保回调 URL 使用 HTTPS

## 常见问题

### 回调验证失败

确保:
1. 网关已启动并可通过公网访问
2. `webhookPath` 配置正确
3. `token` 和 `encodingAESKey` 与企业微信后台一致

### 消息发送失败

检查:
1. `agentSecret` 是否正确
2. 目标用户是否在应用可见范围内
3. 运行 `openclawcn channels status --probe` 查看连接状态

### 获取 Access Token 失败

可能原因:
1. CorpID 或 AgentSecret 错误
2. IP 白名单限制 (在管理后台配置企业可信 IP)

## API 限制

- 文本消息最大长度: 2048 字节
- Markdown 消息最大长度: 2048 字节
- 消息发送频率: 每企业不超过帐号上限数*30人次/秒

详细限制请参考 [企业微信官方文档](https://developer.work.weixin.qq.com/document/path/90236)。

## 参考链接

- [企业微信开放平台](https://developer.work.weixin.qq.com/)
- [自建应用开发指南](https://developer.work.weixin.qq.com/document/path/90556)
- [应用消息 API](https://developer.work.weixin.qq.com/document/path/90236)
- [回调通知](https://developer.work.weixin.qq.com/document/path/90930)
- [消息加解密](https://developer.work.weixin.qq.com/document/path/90968)
