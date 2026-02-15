# PRD-08: 渠道与通讯系统

## 1. 模块概述

渠道系统是 OpenClawCN 的消息传输层，负责与各即时通讯平台的对接、消息路由、会话管理和状态监控。

## 2. 渠道注册中心 (src/channels/registry.ts)

### 2.1 渠道 ID 标准化

- `normalizeAnyChannelId()`: 统一渠道 ID 格式
- 插件注册表查找
- 渠道元数据管理
- 支持核心渠道 + 扩展渠道

### 2.2 渠道列表

**核心渠道**:
| 渠道 | 模块 | 协议/SDK |
|------|------|----------|
| Telegram | src/telegram/ | grammy |
| WhatsApp | src/whatsapp/, src/web/ | Baileys (Web) |
| Discord | src/discord/ | @buape/carbon |
| Slack | src/slack/ | @slack/bolt |
| Signal | src/signal/ | Signal CLI |
| iMessage | src/imessage/ | macOS AppleScript |
| LINE | src/line/ | @line/bot-sdk |

**扩展渠道**:
| 渠道 | 模块 | 说明 |
|------|------|------|
| DingTalk | extensions/dingtalk/ | 钉钉企业机器人 |
| Feishu | extensions/feishu/ | 飞书企业机器人 |
| WeCom | extensions/wecom/ | 企业微信 |
| MS Teams | extensions/msteams/ | Microsoft Teams |
| Matrix | extensions/matrix/ | Matrix 协议 |
| Zalo | extensions/zalo/ | Zalo 官方 API |
| ZaloUser | extensions/zalouser/ | Zalo 用户模式 |
| Voice Call | extensions/voice-call/ | 语音通话 |
| QQ | - | QQ 机器人 |
| Google Chat | - | Google Chat |
| Nostr | - | Nostr 协议 |

## 3. 会话管理 (src/channels/session.ts)

### 3.1 会话记录

- `recordInboundSession()`: 记录入站消息会话元数据
- 会话键(SessionKey)生成
- 会话时间戳更新

### 3.2 会话标识

- 每个渠道 + 用户/群组组合 = 唯一会话
- 会话键格式: `{channelId}:{targetId}`
- 群组会话与私聊会话区分

## 4. 目标路由 (src/channels/targets.ts)

### 4.1 目标标准化

- `normalizeTargetId()`: 目标 ID 格式化
- `requireTargetKind()`: 目标类型检查（user/group/channel）

### 4.2 路由规则

- 私聊消息 → 直接回复
- 群组消息 → 检查激活条件（@提及、关键词、allowFrom）
- 广播消息 → 多目标分发

## 5. 消息发送

### 5.1 发送者身份 (sender-identity.ts)

- 发送者标识解析
- 显示名称生成
- 渠道特有标识处理

### 5.2 发送者标签 (sender-label.ts)

- 消息发送者标签
- 角色标记（管理员、用户、系统）

### 5.3 打字指示器 (typing.ts)

- 定时发送打字状态
- 可配置间隔（默认 6秒）
- 渠道适配

### 5.4 回复前缀 (reply-prefix.ts)

- 自定义回复前缀
- 群组回复标记
- @提及回复

## 6. Web 渠道 (src/channels/web/)

- WebSocket 实时通信
- 管理 UI 嵌入式聊天
- 会话管理
- 文件传输

## 7. 渠道适配器接口

### 7.1 标准接口

```typescript
interface ChannelAdapter {
  start(config: ChannelConfig): Promise<void>;
  stop(): Promise<void>;
  send(target: Target, message: Message): Promise<void>;
  status(): Promise<ChannelStatus>;
  probe?(): Promise<ProbeResult>;
}
```

### 7.2 状态监控

- 在线/离线状态
- 连接质量
- 消息发送成功率
- 错误追踪

## 8. 消息格式

### 8.1 入站消息

```typescript
interface InboundMessage {
  channelId: string;
  sessionKey: string;
  body: string;
  sender: SenderInfo;
  isGroup: boolean;
  media?: MediaAttachment[];
  replyTo?: string;
  timestamp: number;
}
```

### 8.2 出站消息

```typescript
interface OutboundMessage {
  text?: string;
  media?: MediaAttachment[];
  replyToMessageId?: string;
  formatting?: "markdown" | "plain";
}
```

## 9. 非功能性需求

### 9.1 可靠性
- 消息重试机制
- 连接自动重连
- 消息去重

### 9.2 性能
- 消息队列缓冲
- 连接复用
- 批量发送（如果渠道支持）

### 9.3 安全性
- 消息加密传输
- Token 安全存储
- 输入清理
