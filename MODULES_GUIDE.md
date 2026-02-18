# OpenClawCN 中级以上功能模块深度梳理

> **生成时间**: 2026-02-16
> **项目版本**: 2026.2.15
> **目的**: 快速定位核心功能模块，深度理解实现细节，方便后续 bug 调试和功能开发

---

## 📋 目录导航

- [1. 核心架构模块](#1-核心架构模块)
- [2. 消息通道模块](#2-消息通道模块)
- [3. AI 智能代理模块](#3-ai-智能代理模块)
- [4. 客户端应用模块](#4-客户端应用模块)
- [5. 扩展插件模块](#5-扩展插件模块)
- [6. 工具技能模块](#6-工具技能模块)
- [7. 基础设施模块](#7-基础设施模块)

---

## 📖 阅读说明

### 图标说明
- ⭐ - 重要性评级 (1-5 星)
- ✅ - 已实现功能
- 🚀 - 技术优势
- ⚠️ - 已知问题
- 💡 - 优化建议

### 模块分析维度
每个核心模块包含以下信息：
1. **功能描述** - 模块实现的具体功能
2. **技术栈** - 使用的核心技术和依赖
3. **优势亮点** - 设计精妙之处和技术优势
4. **已知限制** - 当前存在的问题和局限性
5. **优化方向** - 可改进的点和未来方向

---

## 1. 核心架构模块

### 1.1 Gateway 网关服务 ⭐⭐⭐⭐⭐
**位置**: `src/gateway/`

**功能概述**: 整个系统的中枢控制中心，所有消息和服务的核心路由器

#### 核心实现

**技术栈**:
- WebSocket Server: `ws` 库 (maxPayload: 25MB)
- 协议验证: `Ajv` + `@sinclair/typebox`
- HTTP Server: Express 5.x
- 消息格式: JSON-RPC 风格

**核心文件**:
- `server.impl.ts` - 网关服务器主实现
- `server.ts` - HTTP/WebSocket 服务器入口
- `boot.ts` - 网关启动流程
- `client.ts` - 客户端连接管理（心跳 30s, 重连指数退避最高 30s）
- `server-chat.ts` - 聊天消息处理
- `server-broadcast.ts` - 广播消息分发（支持 connId 定向广播）
- `server-discovery.ts` - Bonjour/mDNS 服务发现
- `server-node-events.ts` - 节点事件处理

#### 实现的功能
- ✅ **双向通信层**: WebSocket 长连接，支持设备认证、TLS 指纹验证
- ✅ **协议层**: TypeBox 定义的严格 JSON-RPC 风格协议（AgentParams, SendParams, EventFrame）
- ✅ **客户端管理**: 连接生命周期、心跳检测、自动重连、Tick 超时主动断开
- ✅ **认证系统**: Token / Password / Device Signature 三种方式
- ✅ **消息路由**: chat、agent 事件流分发
- ✅ **会话管理**: Session Key 映射和会话历史持久化
- ✅ **节点注册**: iOS/Android/macOS 设备注册和命令调用
- ✅ **配置热加载**: 监听配置变更自动重新加载

#### 🚀 技术优势
1. **类型安全**: 运行时 Schema 校验，防止错误消息格式
2. **高性能**: 25MB maxPayload 支持大规模截图传输，dropIfSlow 机制防止慢客户端阻塞
3. **安全设计**:
   - TLS 指纹锁定（GatewayTLSPinning）
   - Device P-256 签名认证
   - Origin 校验（CORS）
4. **可靠性**:
   - 序列号（seq）检测消息丢失
   - Tick 超时主动断开连接
   - 自动重连（指数退避）

#### ⚠️ 已知限制
1. **单点故障**: 无分布式广播机制（distributed-broadcast.ts 存在但未完全集成）
2. **内存累积**: chatRunState 的 buffers 和 deltaSentAt 缺少 LRU 淘汰
3. **工具事件限制**: toolEventRecipients 默认 10 分钟 TTL，长时间会话可能丢失订阅
4. **会话持久化**: 当前基于文件系统，高并发场景性能不足

#### 💡 优化方向
- [ ] 引入 Redis PubSub 实现跨进程广播（多实例部署）
- [ ] 实现工具事件订阅的持久化（SQLite）
- [ ] 将 heartbeat 抑制逻辑提升到配置层（现在硬编码）
- [ ] 添加连接池管理和限流机制
- [ ] 实现优雅关闭（Graceful Shutdown）

**调试入口**: `pnpm gateway:dev`

---

### 1.2 Routing 消息路由 ⭐⭐⭐⭐⭐
**位置**: `src/routing/`

**功能概述**: 智能消息路由系统，根据多维度匹配规则将消息路由到正确的 Agent

#### 核心实现

**技术栈**:
- 缓存策略: WeakMap + Map（2000 条目 LRU）
- 路由引擎: 7 层优先级匹配算法

#### 实现的功能
- ✅ **会话路由**: 根据 channel/accountId/peer/guild/roles 多维度匹配 agentId
- ✅ **Session Key 生成**: 支持 `main`/`per-peer`/`per-channel-peer` 等 DM 作用域策略
- ✅ **绑定优先级**: 7 层匹配策略
  1. peer → 2. parent peer → 3. guild+roles → 4. guild → 5. team → 6. account → 7. channel
- ✅ **跨账号身份关联**: identityLinks 支持多账号消息归并到同一会话
- ✅ **平台抽象**: Discord 服务器角色、Slack 工作区、通用 guild/team 抽象
- ✅ **向后兼容**: 别名系统（CHAT_CHANNEL_ALIASES）支持 imsg → imessage

#### 🚀 技术优势
1. **缓存优化**: WeakMap 配合 Map 实现 2000 条目的 LRU 缓存（evaluatedBindingsCacheByCfg）
2. **灵活路由**: 支持复杂场景（Discord 服务器角色、Slack 工作区、通用 guild/team）
3. **性能优化**: 配置哈希缓存，避免重复计算
4. **扩展性**: 易于添加新的路由维度

#### ⚠️ 已知限制
1. **缓存失效**: 配置变更时 WeakMap 无法主动清理，需依赖 GC
2. **路由冲突**: 多条绑定匹配同一 peer 时无冲突检测
3. **性能瓶颈**: normalizeAgentId 在每次路由时重复调用
4. **调试困难**: 复杂路由场景难以追踪匹配过程

#### 💡 优化方向
- [ ] 引入 Trie 树加速 channel+accountId 前缀匹配
- [ ] 提供路由配置校验工具（检测重复绑定和冲突）
- [ ] 将 normalizeAgentId 结果缓存到 Map 中
- [ ] 添加路由决策日志（Debug 模式下记录匹配过程）
- [ ] 实现路由性能指标收集（延迟、命中率）

---

### 1.3 Channels 通道抽象层 ⭐⭐⭐⭐⭐
**位置**: `src/channels/`

**功能概述**: 统一的通道接口，抽象所有消息平台的差异

#### 核心实现

**技术栈**:
- 插件系统: 动态加载机制
- Schema 验证: TypeBox
- 消息规范化: UnifiedInboundMessage

#### 实现的功能
- ✅ **通道抽象层**: 统一的 ChannelPlugin 接口（onboarding, normalize, outbound, actions）
- ✅ **消息规范化**: 将各平台消息转换为 UnifiedInboundMessage
- ✅ **插件注册表**: 支持内置 + 外部通道插件动态加载
- ✅ **配置管理**: 每个通道的独立配置 schema
- ✅ **生命周期钩子**: onStart, onStop, onConfigChange

#### 🚀 技术优势
1. **解耦设计**: 通道逻辑完全独立，核心系统无平台特定代码
2. **热插拔**: 插件可在运行时启用/禁用（需重启网关）
3. **类型安全**: TypeBox schema 验证通道配置
4. **易扩展**: 新通道只需实现 ChannelPlugin 接口

#### ⚠️ 已知限制
1. **状态管理**: 部分通道状态（如 BlueBubbles reply cache）混杂在插件代码中
2. **错误隔离**: 某个通道崩溃可能影响其他通道（缺少 worker 隔离）
3. **配置热更新**: 需重启网关才能生效
4. **资源泄漏**: 长时间运行可能积累资源（WebSocket 连接、定时器）

#### 💡 优化方向
- [ ] 引入通道 worker 模式（独立进程/线程）
- [ ] 实现配置变更检测 + 自动重新加载
- [ ] 提供通道健康检查 API（status-issues.ts 可扩展）
- [ ] 添加通道资源管理器（定期清理）
- [ ] 实现通道性能监控（消息延迟、错误率）

---

### 1.4 Dispatch 调度系统 ⭐⭐⭐⭐
**位置**: `src/dispatch/`

**功能概述**: 智能消息分派系统，根据意图和复杂度选择最优执行策略

#### 核心实现

**技术栈**:
- 意图分类: 规则引擎（keywords/regex）+ LLM（Haiku 3）
- 复杂度评估: 两层分析（规则启发式 + LLM 判断）
- 成本守护: Token 预估 + 预算控制
- 并发控制: 槽位管理 + 熔断器

#### 实现的功能
- ✅ **意图分类**: 规则引擎（keywords/regex）+ LLM 分类（Haiku 3）
- ✅ **复杂度评估**: 输出 low/medium/high
- ✅ **执行策略**:
  - `single`: 单模型直接执行
  - `enhanced`: 更强模型执行
  - `multi`: 多 agent 并行（planning + execution）
- ✅ **成本守护**: 预估 token 消耗，超预算自动降级模型
- ✅ **资源限流**: 并发槽位管理 + 熔断器
- ✅ **会话感知**: 跟踪对话历史调整复杂度
- ✅ **媒体感知**: 图片附件自动提升视觉相关意图优先级

#### 🚀 技术优势
1. **零额外延迟**: LLM 分类复用意图识别调用，不增加额外 API 开销
2. **渐进式**: 支持禁用 dispatch（直接透传）、仅规则、规则+LLM 三种模式
3. **智能降级**: 预算不足时自动选择更便宜的模型
4. **并行执行**: Multi 策略下多 agent 并行处理复杂任务

#### ⚠️ 已知限制
1. **配置复杂度**: dispatch.yaml 需手工维护 intent 定义，新手门槛高
2. **LLM 调用成本**: 虽复用，但高频场景仍有开销
3. **熔断恢复**: 熔断后需等待冷却期，无主动健康检查
4. **调试困难**: 意图分类结果难以追踪

#### 💡 优化方向
- [ ] 提供 intent 自动生成工具（基于历史会话日志挖掘）
- [ ] 缓存高频意图分类结果（相似度匹配）
- [ ] 实现主动探测 + 熔断提前恢复
- [ ] 添加 Dispatch 决策日志（记录选择原因）
- [ ] 支持自定义复杂度评估函数

---

## 2. 消息通道模块

### 2.1 核心通道 (内置)

#### WhatsApp 通道 ⭐⭐⭐⭐⭐
**位置**: `src/whatsapp/` + `src/web/`

**实现方式**: Baileys (WhatsApp Web 协议)

**文件**:
- `src/web/` - Web 协议适配器
- 依赖: `@whiskeysockets/baileys`

---

#### Telegram 通道 ⭐⭐⭐⭐⭐
**位置**: `src/telegram/`

**实现方式**: Grammy Bot Framework

**依赖**: `grammy`, `@grammyjs/runner`

---

#### Discord 通道 ⭐⭐⭐⭐
**位置**: `src/discord/`

**实现方式**: Discord API Types + REST

**依赖**: `discord-api-types`

---

#### Slack 通道 ⭐⭐⭐⭐
**位置**: `src/slack/`

**实现方式**: Slack Bolt SDK

**依赖**: `@slack/bolt`, `@slack/web-api`

---

#### Signal 通道 ⭐⭐⭐⭐
**位置**: `src/signal/`

**实现方式**: Signal 私有协议桥接

---

#### iMessage 通道 ⭐⭐⭐
**位置**: `src/imessage/`

**平台**: macOS only

---

### 2.2 扩展通道 (插件)

位置: `extensions/`

| 通道名称 | 目录 | 地区/用途 | 重要性 |
|---------|------|----------|--------|
| **飞书 (Feishu)** | `extensions/feishu/` | 中国企业 | ⭐⭐⭐⭐⭐ |
| **钉钉 (DingTalk)** | `extensions/dingtalk/` | 中国企业 | ⭐⭐⭐⭐⭐ |
| **企业微信 (WeCom)** | `extensions/wecom/` | 中国企业 | ⭐⭐⭐⭐⭐ |
| **Zalo** | `extensions/zalo/` | 越南主流 | ⭐⭐⭐⭐ |
| **Zalo Personal** | `extensions/zalouser/` | 越南个人 | ⭐⭐⭐⭐ |
| **Google Chat** | `extensions/googlechat/` | 企业办公 | ⭐⭐⭐⭐ |
| **MS Teams** | `extensions/msteams/` | 企业办公 | ⭐⭐⭐⭐ |
| **BlueBubbles** | `extensions/bluebubbles/` | iMessage 桥接 | ⭐⭐⭐ |
| **Matrix** | `extensions/matrix/` | 开源协议 | ⭐⭐⭐ |
| **LINE** | `extensions/line/` | 日本/东南亚 | ⭐⭐⭐ |
| **QQ Bot** | `extensions/qqbot/` | 中国社交 | ⭐⭐⭐ |
| **IRC** | `extensions/irc/` | 经典协议 | ⭐⭐ |
| **Mattermost** | `extensions/mattermost/` | 开源团队协作 | ⭐⭐ |
| **Nextcloud Talk** | `extensions/nextcloud-talk/` | 自托管 | ⭐⭐ |
| **Nostr** | `extensions/nostr/` | 去中心化 | ⭐⭐ |
| **Tlon (Urbit)** | `extensions/tlon/` | P2P 网络 | ⭐ |
| **Twitch** | `extensions/twitch/` | 直播平台 | ⭐ |

---

## 2.3 中国本地化通道深度解析

### 2.3.1 飞书 (Feishu/Lark) ⭐⭐⭐⭐⭐
**位置**: `extensions/feishu/`

**功能概述**: 飞书企业级即时通讯集成，支持消息、文档、多维表格等全生态

#### 核心实现

**技术栈**:
- 官方 SDK: `@larksuiteoapi/node-sdk` (v1.59.0)
- 验证库: `@sinclair/typebox`, `zod`
- 连接模式: WebSocket (推荐) / Webhook

**核心文件**:
- `src/channel.ts` - 通道主实现
- `src/client.ts` - SDK 客户端管理
- `src/docx.ts` - 飞书文档操作
- `src/wiki.ts` - 知识库操作
- `src/bitable.ts` - 多维表格操作
- `src/drive.ts` - 云空间操作

#### 实现的功能

**1. 双模式连接**:
- ✅ **WebSocket 长连接模式**（推荐）: 无需公网 IP，使用官方 WSClient
- ✅ **Webhook 模式**: HTTP 回调，需要公网可访问地址

**2. 消息处理**:
- ✅ 文本消息（text）
- ✅ Markdown 卡片（interactive card）
- ✅ 富文本消息支持
- ✅ @ 提及机制（mentions）
- ✅ 回复消息（reply）
- ✅ 消息撤回和编辑

**3. 飞书生态工具集成**:
- ✅ **飞书文档（Docx）**: 创建/读取/更新文档，支持富文本
- ✅ **飞书知识库（Wiki）**: 管理知识空间，创建/查询/更新页面
- ✅ **飞书多维表格（Bitable）**: CRUD 操作，字段管理
- ✅ **飞书云空间（Drive）**: 文件上传/下载，文件夹管理

**4. 多账户支持**:
- ✅ 账户配置隔离（`accounts` 字段）
- ✅ 账户级别的 enabled/disabled 控制
- ✅ 凭证合并策略（account config overrides base config）

**5. 媒体处理**:
- ✅ 图片上传/下载（`sendMediaFeishu`）
- ✅ 文件传输
- ✅ 自动降级策略（失败时回退为文本链接）

#### 🚀 技术优势

1. **智能渲染模式**:
```typescript
renderMode: "auto" | "raw" | "card"
```
- `auto`: 自动检测代码块/表格切换卡片模式
- 检测逻辑: `/```[\s\S]*?```/` 和 `/\|.+\|[\r\n]+\|[-:| ]+\|/`
- 智能降级: 卡片发送失败自动回退文本

2. **客户端缓存机制**:
```typescript
let cachedClient: Lark.Client | null = null;
let cachedConfig: { appId, appSecret, domain } | null = null;
```
- 避免重复创建 SDK 实例
- 配置变更时自动刷新

3. **域名适配**:
- 支持飞书（feishu.cn）和 Lark（larksuite.com）
- 统一抽象: `domain: "feishu" | "lark"`

4. **Bot Open ID 识别**:
- 自动移除 @ 机器人占位符
- 群聊消息提及检测

5. **完整的工具生态**:
- 文档工具: 创建/读取/更新飞书文档
- Wiki 工具: 知识库管理
- Bitable 工具: 多维表格操作
- Drive 工具: 文件管理

#### ⚠️ 已知限制

1. **WebSocket 重连策略**: 依赖官方 SDK 内置机制，无自定义控制
2. **会话管理**: 无持久化会话状态，依赖内存缓存
3. **媒体处理**: 大文件上传性能未优化
4. **卡片渲染限制**: 复杂 Markdown 可能渲染失败
5. **消息分块**: textChunkLimit: 4000（飞书官方限制）

#### 💡 优化方向

- [ ] 实现自定义 WebSocket 重连策略
- [ ] 添加会话状态持久化
- [ ] 优化大文件分片上传
- [ ] 增强卡片渲染容错
- [ ] 实现消息队列（避免频率限制）
- [ ] 添加飞书审批、日历等更多工具集成

---

### 2.3.2 钉钉 (DingTalk) ⭐⭐⭐⭐⭐
**位置**: `extensions/dingtalk/`

**功能概述**: 钉钉企业级即时通讯集成，支持 AI Card 流式响应

#### 核心实现

**技术栈**:
- 官方 SDK: `dingtalk-stream` (v2.1.4)
- 验证库: `zod`
- 连接模式: Stream (WebSocket) / Webhook

**核心文件**:
- `src/channel.ts` - 通道主实现
- `src/stream-client.ts` - Stream 客户端
- `src/ai-card.ts` - AI Card 流式渲染
- `src/session-manager.ts` - 会话管理
- `src/media-upload.ts` - 媒体上传

#### 实现的功能

**1. 双模式架构**:
- ✅ **Stream 模式**（推荐）: WebSocket 长连接 + AI Card 流式响应
- ✅ **Webhook 模式**: HTTP 回调

**2. AI Card 流式渲染（核心创新）**:
```typescript
enableAICard: boolean (默认 true)
```
- ✅ 实时流式更新 AI 响应
- ✅ 节流更新机制（updateInterval: 300ms）
- ✅ 错误恢复: `finishAICard()` 自动完成卡片
- ✅ 优雅降级: AI Card 创建失败自动回退普通消息

**3. Session 管理**:
```typescript
sessionTimeout: 600000ms (10分钟)
```
- ✅ 自动会话保持
- ✅ 新会话命令识别: `isNewSessionCommand()`
- ✅ 会话状态持久化

**4. 媒体上传**:
- ✅ 本地图片自动上传: `processLocalImages()`
- ✅ Markdown 图片链接替换
- ✅ OAPI Token 管理

**5. Session Webhook 缓存**:
```typescript
const sessionWebhookCache = new Map<string, { webhook, expiresAt }>();
```
- ✅ 优先使用 Session Webhook（更快）
- ✅ 自动降级到批量发送 API

#### 🚀 技术优势

1. **Gateway SSE Streaming**:
```typescript
async function* streamFromGateway(options)
```
- 连接超时保护（30s）
- Chunk 读取超时（60s）
- 自动重连机制

2. **SDK 自动重连**:
```typescript
DWClient({ clientId, clientSecret, autoReconnect: true })
```
- 指数退避策略（1s, 2s, 4s, ... 最大 60s）
- 事件监听: `connect`, `disconnect`, `error`

3. **消息内容提取**:
- 支持多种消息类型: text, richText, picture, audio, video, file
- 统一抽象: `extractMessageContent()`

4. **流式渲染优化**:
- 节流更新（300ms 间隔）避免频繁 API 调用
- 增量更新机制
- 错误自动恢复

#### ⚠️ 已知限制

1. **AI Card 创建失败**: 降级为普通消息模式
2. **Gateway 依赖**: Stream 模式必须有本地 Gateway
3. **Session Webhook 过期**: 缓存失效后降级到 API 调用
4. **消息分块**: textChunkLimit: 2048（钉钉限制）
5. **流式更新延迟**: 300ms 节流可能感觉不够实时

#### 💡 优化方向

- [ ] 实现 AI Card 创建重试机制
- [ ] 优化流式更新延迟（自适应节流）
- [ ] 添加 Session Webhook 自动刷新
- [ ] 实现离线消息队列
- [ ] 支持钉钉审批、日历等更多功能

---

### 2.3.3 企业微信 (WeCom) ⭐⭐⭐⭐⭐
**位置**: `extensions/wecom/`

**功能概述**: 企业微信自建应用集成，支持群聊白名单和 @ 机器人

#### 核心实现

**技术栈**:
- **无外部 SDK**: 直接使用 REST API
- 验证库: `zod`
- 连接模式: Webhook（单一模式）

**核心文件**:
- `src/channel.ts` - 通道主实现
- `src/api.ts` - API 封装
- `src/accounts.ts` - 多账户管理
- `src/policy.ts` - 群聊策略

#### 实现的功能

**1. Webhook 模式**（单一模式）:
- ✅ HTTP 回调接收消息
- ✅ 企业微信自建应用 API
- ✅ 消息签名验证

**2. 多账户支持**（完整实现）:
```typescript
accounts: Record<string, WecomAccountConfig>
defaultAccount: string
```
- ✅ 账户级别的启用/禁用
- ✅ 账户特定的 webhook 路径
- ✅ 合并配置策略

**3. 群聊策略控制**:
```typescript
groupPolicy: "disabled" | "allowlist" | "open"
requireMention: boolean (默认 true)
```
- ✅ 群聊白名单: `groupAllowFrom`
- ✅ @ 机器人检测: `checkBotMentioned()`
- ✅ 群聊特定配置: `groups[chatId]`

**4. 安全警告收集**:
- ✅ `collectWarnings()`: 检测不安全配置
- ✅ 提示用户设置白名单

#### 🚀 技术优势

1. **@ 机器人检测**:
```typescript
function checkBotMentioned(text: string): boolean
```
- 简化检测: 检查消息是否包含 `@`
- 宽松策略: 适应企业微信回调限制

2. **多账户配置合并**:
```typescript
function mergeAccountConfig(baseConfig, accountConfig)
```
- 账户配置覆盖基础配置
- 群聊配置深度合并

3. **目标解析**:
- 群聊: `wecom:group:{chatId}:{userId}`
- 私聊: `wecom:{userId}`

4. **无 SDK 开销**: 直接 HTTP 请求，更轻量

#### ⚠️ 已知限制

1. **无富媒体支持**: `media: false`（企业微信应用消息限制）
2. **无群聊直接回复**: 应用消息不支持群聊回复，需通过其他方式
3. **@ 检测不精确**: 使用简化逻辑，可能误判
4. **消息分块**: textChunkLimit: 2048
5. **API 频率限制**: 企业微信严格的频率限制

#### 💡 优化方向

- [ ] 实现精确的 @ 机器人检测（解析 XML）
- [ ] 添加富媒体支持（探索其他 API）
- [ ] 实现消息队列（应对频率限制）
- [ ] 支持企业微信审批、日历等功能
- [ ] 添加群机器人模式（作为补充）

---

**中国本地化通道总结**:

| 特性 | 飞书 | 钉钉 | 企业微信 |
|------|------|------|---------|
| **连接模式** | WebSocket / Webhook | Stream / Webhook | Webhook Only |
| **富媒体** | ✅ 完整支持 | ✅ 完整支持 | ❌ 应用消息限制 |
| **流式响应** | ❌ 不支持 | ✅ AI Card 流式 | ❌ 不支持 |
| **工具生态** | ✅✅✅ 文档/Wiki/Bitable/Drive | ✅ 基础工具 | ✅ 基础工具 |
| **多账户** | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| **群聊策略** | ✅ 灵活 | ✅ 灵活 | ✅ 白名单控制 |
| **消息分块** | 4000 字符 | 2048 字符 | 2048 字符 |
| **开发难度** | 中等 | 中等 | 低 |
| **推荐度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 3. AI 智能代理模块

### 3.1 Agent Core 代理核心 ⭐⭐⭐⭐⭐
**位置**: `src/agents/`

**功能概述**: AI 智能代理的核心实现，包括多模型支持、工具调用和认证管理

#### 核心实现

**技术栈**:
- Agent 框架: `@mariozechner/pi-agent-core`
- AI 抽象层: `@mariozechner/pi-ai`
- 编码代理: `@mariozechner/pi-coding-agent`
- Bash 沙箱: `@lydell/node-pty`

**核心文件**:
- `agent-scope.ts` - 代理作用域管理（多 agent 隔离）
- `agent-paths.ts` - 代理路径解析（agentDir, workspace）
- `auth-profiles.ts` - 认证配置文件管理
- `auth-health.ts` - 认证健康检查
- `apply-patch.ts` - 对话补丁应用

#### 实现的功能
- ✅ **多 Agent 隔离**: 每个 agent 独立的工作目录和会话
- ✅ **多 AI 模型抽象层**: Anthropic Claude, OpenAI, Google Gemini, AWS Bedrock, 本地模型
- ✅ **认证配置轮换**: OAuth 轮转、冷却期、last-used 排序、失败计数
- ✅ **工具体系**: 60+ 内置工具（Bash, Edit, Glob, Grep, Read, Write, Memory, MCP）
- ✅ **Bash 工具**: PTY 沙箱执行、后台进程管理、approval 流程
- ✅ **对话历史管理**: Session 持久化、增量更新
- ✅ **流式输出**: 支持 SSE 流式返回
- ✅ **模型回退**: fallbackModel 支持主模型失败时自动降级

#### 🚀 技术优势
1. **沙箱隔离**: node-pty 支持 PTY fallback，兼容 Windows
2. **认证弹性**:
   - 支持多 API key 自动切换
   - 失败计数和熔断机制
   - OAuth token 自动刷新
3. **工具可扩展**: 插件系统 + MCP 集成
4. **模型回退**: 主模型失败时自动降级到备用模型
5. **性能优化**: 工具结果缓存、批量操作

#### ⚠️ 已知限制
1. **PTY 资源泄漏**: bash-process-registry 未实现全局 TTL 清理
2. **认证状态持久化**: auth-profiles 状态在内存中，重启丢失
3. **工具调用超时**: 缺少全局 tool execution 监控
4. **并发限制**: 单个 agent 同时只能处理一个请求
5. **上下文窗口管理**: 长对话可能超过模型上下文限制

#### 💡 优化方向
- [ ] 实现 bash 进程池（限制并发数，定期清理）
- [ ] 将 auth-profiles 状态持久化到 SQLite
- [ ] 添加工具执行 trace ID 用于追踪超时调用
- [ ] 实现并发请求队列（支持多个并发会话）
- [ ] 添加上下文窗口自动截断和总结

---

### 3.2 Providers 模型提供商 ⭐⭐⭐⭐⭐
**位置**: `src/providers/`

**支持的 AI 提供商**:
- **Anthropic (Claude)** - 主推荐
- **OpenAI (GPT)** - ChatGPT/GPT-4
- **Google Gemini** - Gemini Pro/Ultra
- **AWS Bedrock** - 企业级 AI 服务
- **本地模型** - Ollama, LLaMA.cpp

**认证扩展插件**:
- `extensions/google-gemini-cli-auth/` - Google Gemini CLI 认证
- `extensions/google-antigravity-auth/` - Google Antigravity 认证
- `extensions/minimax-portal-auth/` - Minimax Portal 认证
- `extensions/qwen-portal-auth/` - 通义千问认证

---

### 3.3 Memory 记忆系统 ⭐⭐⭐⭐
**位置**: `src/memory/` + `extensions/memory-*/`

**功能概述**: 长期记忆和上下文保持，支持向量检索和全文搜索

#### 核心实现

**技术栈**:
- 向量数据库: `sqlite-vec`（256-4096 维）
- 全文检索: SQLite FTS5 + BM25
- Embedding Provider: OpenAI / Gemini / Voyage / 本地（node-llama-cpp）
- 批量 API: OpenAI Batch API（降低 50% 成本）

**核心扩展**:
- `extensions/memory-core/` - 核心记忆引擎
- `extensions/memory-lancedb/` - LanceDB 向量存储（替代方案）

#### 实现的功能
- ✅ **向量检索**: sqlite-vec 扩展，余弦相似度搜索
- ✅ **全文检索**: FTS5 表 + BM25 排序
- ✅ **混合搜索**: 向量 + 关键词加权融合（可配置权重）
- ✅ **多 Provider**: OpenAI / Gemini / Voyage / 本地模型
- ✅ **批量优化**: 支持 OpenAI Batch API（降低成本）
- ✅ **增量索引**: 文件 watcher + 会话增量更新
- ✅ **Embedding 缓存**: 避免重复计算

#### 🚀 技术优势
1. **自动降级**: provider=auto 时自动探测可用后端
2. **增量更新**: 避免全量重建索引
3. **缓存机制**: embedding cache 表避免重复计算
4. **资源高效**: 本地模型支持量化（Q8_0）
5. **混合搜索**: 结合向量和关键词优势

#### ⚠️ 已知限制
1. **sqlite-vec 依赖**: 需编译原生扩展，部分平台失败
2. **批量 API 超时**: timeoutMs 固定 30s，对大文件不足
3. **会话文件污染**: 旧会话未清理，index 持续膨胀
4. **向量维度固定**: 切换 provider 需重建索引

#### 💡 优化方向
- [ ] 提供纯 JS 向量检索实现（faiss.js）作为 fallback
- [ ] 实现 TTL 清理旧会话索引
- [ ] 支持增量 embedding（只处理新增 chunk）
- [ ] 添加向量维度自适应（根据 provider 自动调整）
- [ ] 实现分布式索引（支持跨设备检索）

---

### 3.4 Canvas 画布系统 ⭐⭐⭐⭐
**位置**: `src/canvas-host/`

**功能概述**: 实时可视化画布，用于 AI 展示代码、图表、UI 等

#### 核心实现

**技术栈**:
- 渲染引擎: A2UI（Agent-to-UI）
- 前端框架: Lit (Web Components)
- 通信协议: WebSocket + JSONL 流式更新

**核心文件**:
- `src/canvas-host/a2ui/` - A2UI 渲染引擎

#### 实现的功能
- ✅ **实时协作画布**: 多客户端同步更新
- ✅ **代码高亮**: 多语言语法高亮
- ✅ **Markdown 渲染**: 富文本展示
- ✅ **交互式组件**: 按钮、输入框等
- ✅ **流式更新**: 逐步渲染 AI 生成内容
- ✅ **快照保存**: Canvas 状态持久化

#### 🚀 技术优势
1. **实时性**: WebSocket 推送，延迟 < 100ms
2. **轻量级**: 基于 Web Components，无重框架依赖
3. **可扩展**: 易于添加新组件类型
4. **跨平台**: 浏览器 + Electron 支持

#### ⚠️ 已知限制
1. **离线支持**: 需要网关在线
2. **大型画布性能**: 大量元素时渲染卡顿
3. **协作冲突**: 多用户同时编辑时无冲突解决

#### 💡 优化方向
- [ ] 实现虚拟滚动（优化大型画布）
- [ ] 添加 OT（Operational Transformation）协作算法
- [ ] 支持离线模式（本地缓存）
- [ ] 添加画布版本控制（Git-like）

---

### 3.5 Browser 浏览器工具 ⭐⭐⭐
**位置**: `src/browser/`

**功能**: Playwright 浏览器自动化

**依赖**: `playwright-core`

**用途**:
- ✅ 网页抓取
- ✅ 自动化测试
- ✅ 截图和录屏

---

## 4. 客户端应用模块

### 4.1 macOS App ⭐⭐⭐⭐⭐
**位置**: `apps/macos/`

**功能概述**: macOS 原生菜单栏应用，提供语音唤醒、本地网关和全功能 UI

#### 核心实现

**技术栈**:
- 语言: Swift 5.9+
- 框架: SwiftUI, AppKit, AVFoundation, Speech
- 音频引擎: AVAudioEngine
- 语音识别: SFSpeechRecognizer (Apple Speech Framework)
- 共享库: ClawdbotKit (跨平台协议), SwabbleKit (语音唤醒)

**核心文件**:
- `Sources/Clawdbot/VoiceWakeRuntime.swift` - 语音唤醒核心
- `Sources/Clawdbot/GatewayConnection.swift` - 网关连接
- `Sources/Clawdbot/AppState.swift` - 应用状态管理
- `Sources/Clawdbot/MenuBar.swift` - 菜单栏 UI
- `Sources/Clawdbot/CanvasWindowController.swift` - Canvas 窗口

#### 实现的功能

**1. 语音唤醒 (Voice Wake)** - 核心特性

**技术架构**:
```swift
actor VoiceWakeRuntime {
    enum ListeningState { case idle, voiceWake, pushToTalk }
}
```

**检测流程**:
1. 音频采集 → 2048 buffer size
2. RMS 能量检测 → Voice Activity Detection
3. 语音识别 → Transcript + Segments (timing)
4. 触发词匹配 → WakeWordGate.match()
5. 命令提取 → `commandAfterTrigger()`

**降噪策略**:
- 自适应噪声底 (Adaptive noise floor):
```swift
let alpha = rms < noiseFloorRMS ? 0.08 : 0.01
noiseFloorRMS = max(1e-7, noiseFloorRMS + (rms - noiseFloorRMS) * alpha)
```
- 语音检测阈值: `max(minSpeechRMS, noiseFloorRMS * speechBoostFactor)`

**捕获管理**:
- 触发后捕获窗口: `captureHardStop: 120s`
- 静音检测窗口:
  - 有命令后: `silenceWindow: 2.0s`
  - 仅触发词: `triggerOnlySilenceWindow: 5.0s`
- 防抖动: `debounceAfterSend: 0.35s`

**降级策略** (4 级容错):
1. **Timing-based match**: 使用语音片段时间戳
2. **Text-only fallback**: 纯文本匹配 (无时间戳)
3. **Trigger-only pause**: 仅说触发词 + 短暂停顿
4. **Pre-detect silence**: 静音后文本匹配

**2. Gateway 连接**:
```swift
actor GatewayConnection {
    static let shared = GatewayConnection()
}
```

**连接流程**:
1. **Connect Challenge**: 等待服务器 nonce (750ms timeout)
2. **Device Identity**: P-256 签名认证
3. **Device Token**: 自动获取和缓存
4. **Hello/Ok**: 接收服务器配置

**认证策略** (优先级):
1. Device Token (本地缓存)
2. Shared Token (配置文件)
3. Password
4. None

**错误恢复**:
- Local 模式: 自动启动 Gateway 进程 + 3 次重试
- Remote 模式: 重建 SSH Tunnel + 3 次重试
- Tick Watchdog: 2x tickInterval 未收到心跳 → 重连

**3. 其他核心功能**:
- ✅ **菜单栏常驻应用**: SwiftUI MenuBarExtra
- ✅ **推送到说话 (Push-to-Talk)**: 全局快捷键
- ✅ **Canvas 窗口**: WebKit + 自定义 URL Scheme
- ✅ **网关本地运行**: 进程管理 + LaunchAgent
- ✅ **配置管理 UI**: SwiftUI Settings
- ✅ **Tailscale 集成**: VPN 自动发现

#### 🚀 技术优势

1. **高级语音唤醒**:
   - 多级降级策略，确保高召回率
   - 自适应噪声抑制，跨设备稳定
   - 实时音频电平 UI 反馈

2. **Actor 并发模型**:
   - 线程安全的异步 API
   - 避免数据竞争
   - Swift 6 兼容

3. **状态机管理**:
   - 清晰的状态转换逻辑
   - 避免状态冲突

4. **内存管理**:
   - 懒加载 AVAudioEngine
   - 停止时释放资源

5. **跨平台代码共享**:
   - ClawdbotKit: 共享 Gateway 协议
   - SwabbleKit: 共享语音唤醒算法

#### ⚠️ 已知限制

1. **蓝牙耳机兼容性**: 启动 AVAudioEngine 可能切换到低质量 HFP 模式
2. **语音识别延迟**: SFSpeechRecognizer partial results 延迟 ~300ms
3. **macOS 权限**: 需要麦克风 + 语音识别权限
4. **资源占用**: 持续音频捕获占用 CPU ~2-5%
5. **网关依赖**: Local 模式需要本地 Node.js 环境

#### 💡 优化方向

- [ ] 优化蓝牙耳机音频路由
- [ ] 实现语音识别结果缓存（减少重复识别）
- [ ] 添加低功耗模式（降低 CPU 占用）
- [ ] 支持自定义触发词训练
- [ ] 实现语音唤醒统计和分析

**构建**: `pnpm mac:package`

---

### 4.2 iOS App ⭐⭐⭐⭐
**位置**: `apps/ios/`

**功能概述**: iOS 原生应用，提供语音对话、摄像头、位置等移动端特性

#### 核心实现

**技术栈**:
- 语言: Swift 5.9+
- 框架: SwiftUI, AVFoundation, Speech
- 音频会话: AVAudioSession (playAndRecord mode)
- 共享库: ClawdbotKit (与 macOS 共享协议)

**核心文件**:
- `Sources/Voice/VoiceWakeManager.swift` - 语音唤醒
- `Sources/Gateway/GatewayConnectionController.swift` - 网关连接
- `Sources/Camera/CameraController.swift` - 摄像头控制
- `Sources/Location/LocationService.swift` - 位置服务

#### 实现的功能

**1. 语音唤醒** - iOS 特定优化

**技术架构**:
```swift
@MainActor @Observable
final class VoiceWakeManager: NSObject
```

**iOS 特定优化**:
- **AudioBufferQueue**: 线程安全的音频缓冲队列
```swift
private let lock = NSLock()
private var buffers: [AVAudioPCMBuffer] = []
```
- **Tap Drain Task**: 异步批量处理音频缓冲
```swift
tapDrainTask = Task {
    while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: 40_000_000) // 40ms
        let drained = queue.drain()
        for buf in drained { request.append(buf) }
    }
}
```

**音频会话配置**:
```swift
session.setCategory(.playAndRecord, mode: .measurement, options: [
    .duckOthers,        // 降低其他音频
    .mixWithOthers,     // 混音
    .allowBluetoothHFP, // 蓝牙耳机
    .defaultToSpeaker,  // 默认扬声器
])
```

**外部音频捕获协调**:
```swift
func suspendForExternalAudioCapture() -> Bool
func resumeAfterExternalAudioCapture(wasSuspended: Bool)
```
- Camera 录像时暂停语音唤醒
- 恢复时自动重启

**2. 其他核心功能**:
- ✅ **Gateway 连接**: 复用 ClawdbotKit 的 GatewayNodeSession
- ✅ **Bonjour 发现**: 局域网自动发现 Gateway
- ✅ **TLS Pinning**: 证书验证
- ✅ **设备配对**: iOS 设备配对到 macOS Gateway，双向认证
- ✅ **摄像头集成**: AVFoundation 拍照/录像
- ✅ **位置服务**: CoreLocation 集成
- ✅ **屏幕分享**: ReplayKit 录屏

#### 🚀 技术优势

1. **模拟器检测**:
```swift
if ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"] != nil {
    statusText = "Voice Wake isn't supported on Simulator"
    return
}
```
- 避免模拟器音频栈死锁

2. **深拷贝优化**:
```swift
extension AVAudioPCMBuffer {
    fileprivate func deepCopy() -> AVAudioPCMBuffer?
}
```
- 支持 float/int16/int32 多种格式
- 避免音频数据竞争

3. **权限请求**:
```swift
private nonisolated static func requestMicrophonePermission() async -> Bool
private nonisolated static func requestSpeechPermission() async -> Bool
```
- 异步权限请求
- `nonisolated` 避免 MainActor 限制

4. **批量处理**: Tap drain 40ms 间隔批量提交，减少内存分配

#### ⚠️ 已知限制

1. **iOS 模拟器不支持**: 音频栈不稳定
2. **后台限制**: iOS 后台语音识别有限制
3. **权限提示**: 首次使用需要用户授权
4. **音频会话冲突**: 与其他音频 App 可能冲突
5. **电池消耗**: 持续语音识别耗电较高

#### 💡 优化方向

- [ ] 实现后台语音唤醒（Background Modes）
- [ ] 优化电池消耗（智能暂停/恢复）
- [ ] 添加语音唤醒敏感度调节
- [ ] 支持离线语音识别（On-Device）
- [ ] 实现语音唤醒统计

**构建**: `pnpm ios:build`

---

### 4.3 Android App ⭐⭐⭐⭐
**位置**: `apps/android/`

**功能概述**: Android 原生应用，提供语音对话、摄像头、位置等移动端特性

#### 核心实现

**技术栈**:
- 语言: Kotlin
- 框架: Jetpack Compose, Coroutines
- 语音识别: Android SpeechRecognizer
- 通信: WebSocket (OkHttp)

**核心文件**:
- `app/src/main/java/.../VoiceWakeManager.kt` - 语音唤醒
- `app/src/main/java/.../GatewayClient.kt` - 网关连接
- `app/src/main/java/.../CameraManager.kt` - 摄像头
- `app/src/main/java/.../LocationManager.kt` - 位置服务

#### 实现的功能

**1. 语音唤醒** - Android 实现

**技术架构**:
```kotlin
class VoiceWakeManager(
    private val context: Context,
    private val scope: CoroutineScope,
    private val onCommand: suspend (String) -> Unit
)
```

**Android 特定实现**:
- **SpeechRecognizer**: 系统语音识别服务
```kotlin
recognizer = SpeechRecognizer.createSpeechRecognizer(context)
    .also { it.setRecognitionListener(listener) }
```
- **Intent 配置**:
```kotlin
Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
             RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
}
```

**自动重启机制**:
```kotlin
private fun scheduleRestart(delayMs: Long = 350) {
    restartJob?.cancel()
    restartJob = scope.launch {
        delay(delayMs)
        mainHandler.post {
            recognizer?.cancel()
            startListeningInternal()
        }
    }
}
```

**错误处理**:
```kotlin
override fun onError(error: Int) {
    when (error) {
        SpeechRecognizer.ERROR_NO_MATCH -> "Listening"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Listening"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
            "Microphone permission required"
        else -> "Speech error ($error)"
    }
    scheduleRestart(delayMs = 600)
}
```

**2. 命令提取** - Android 简化版本
```kotlin
object VoiceWakeCommandExtractor {
    fun extractCommand(
        text: String,
        triggerWords: List<String>,
        minPostTriggerGap: Double = 0.45
    ): String?
}
```
- 无 timing 信息（Android SpeechRecognizer 不提供）
- 纯文本匹配
- 触发词后提取命令

**3. 其他核心功能**:
- ✅ **网关连接**: WebSocket 客户端
- ✅ **摄像头集成**: CameraX API
- ✅ **位置服务**: Fused Location Provider
- ✅ **前台服务**: Foreground Service 保持运行

#### 🚀 技术优势

1. **协程集成**:
```kotlin
scope.launch { onCommand(command) }
```
- 异步命令处理
- 避免阻塞 UI 线程

2. **主线程调度**:
```kotlin
private val mainHandler = Handler(Looper.getMainLooper())
mainHandler.post { /* UI updates */ }
```
- 确保 SpeechRecognizer 在主线程

3. **状态流**:
```kotlin
private val _isListening = MutableStateFlow(false)
val isListening: StateFlow<Boolean> = _isListening
```
- 响应式 UI 更新

4. **自动重启**: 错误后自动重启识别

#### ⚠️ 已知限制

1. **无 Timing 信息**: 无法使用时间戳优化检测
2. **系统依赖**: 依赖 Google 语音服务
3. **权限要求**: 需要 RECORD_AUDIO 权限
4. **后台限制**: Android 后台限制严格
5. **设备兼容性**: 部分设备语音识别不稳定

#### 💡 优化方向

- [ ] 实现离线语音识别（On-Device ML）
- [ ] 优化重启延迟（自适应）
- [ ] 添加语音唤醒敏感度调节
- [ ] 实现前台服务优化（降低电池消耗）
- [ ] 支持多语言语音识别

**构建**: `pnpm android:assemble`

---

### 4.4 Windows App ⭐⭐⭐
**位置**: `apps/windows/`

**状态**: 开发中

---

### 4.5 Web UI ⭐⭐⭐⭐
**位置**: `ui/`

**技术栈**: Lit (Web Components)

**功能**:
- ✅ WebChat 界面
- ✅ 网关管理面板
- ✅ 配置编辑器

**开发**: `pnpm ui:dev`

---

## 5. 扩展插件模块

### 5.1 认证插件 ⭐⭐⭐⭐

| 插件名称 | 目录 | 用途 |
|---------|------|------|
| **Copilot Proxy** | `extensions/copilot-proxy/` | GitHub Copilot 代理 |
| **Google Antigravity Auth** | `extensions/google-antigravity-auth/` | Google 认证 |
| **Google Gemini CLI Auth** | `extensions/google-gemini-cli-auth/` | Gemini CLI 认证 |
| **Minimax Portal Auth** | `extensions/minimax-portal-auth/` | Minimax 认证 |
| **Qwen Portal Auth** | `extensions/qwen-portal-auth/` | 通义千问认证 |

---

### 5.2 工具插件 ⭐⭐⭐

| 插件名称 | 目录 | 用途 |
|---------|------|------|
| **LLM Task** | `extensions/llm-task/` | LLM 任务编排 |
| **Lobster** | `extensions/lobster/` | 终端 UI 框架 |
| **Open Prose** | `extensions/open-prose/` | 文档生成 |
| **Voice Call** | `extensions/voice-call/` | 语音通话 |

---

### 5.3 监控插件 ⭐⭐⭐

| 插件名称 | 目录 | 用途 |
|---------|------|------|
| **Diagnostics OTEL** | `extensions/diagnostics-otel/` | OpenTelemetry 诊断 |

---

## 6. 工具技能模块

### 6.1 Skills 技能系统 ⭐⭐⭐⭐
**位置**: `skills/`

**内置技能列表** (部分):

| 技能名称 | 目录 | 功能 |
|---------|------|------|
| **1password** | `skills/1password/` | 1Password 集成 |
| **Apple Notes** | `skills/apple-notes/` | Apple 备忘录 |
| **Apple Reminders** | `skills/apple-reminders/` | Apple 提醒事项 |
| **Bear Notes** | `skills/bear-notes/` | Bear 笔记 |
| **BlueBubbles** | `skills/bluebubbles/` | iMessage 管理 |
| **Canvas** | `skills/canvas/` | 画布控制 |
| **Coding Agent** | `skills/coding-agent/` | 代码生成 |
| **Desktop Control** | `skills/desktop-control/` | 桌面自动化 |
| **Discord** | `skills/discord/` | Discord 操作 |
| **GitHub** | `skills/github/` | GitHub 集成 |

**更多技能**: 运行 `ls skills/` 查看完整列表

---

## 7. 基础设施模块

### 7.1 Config 配置系统 ⭐⭐⭐⭐⭐
**位置**: `src/config/`

**功能概述**: 强类型配置系统，支持多文件合并、环境变量注入和版本迁移

#### 核心实现

**技术栈**:
- 配置格式: JSON5（支持注释和尾逗号）
- Schema 验证: Zod + TypeBox
- 文件监听: chokidar
- 备份管理: 保留最近 5 个快照

**核心文件**:
- `config-loader.ts` - 配置加载器
- `config-schema.ts` - Zod schema 定义
- `config-merge.ts` - 多文件合并逻辑
- `legacy.migrations.ts` - 版本迁移

#### 实现的功能
- ✅ **多文件合并**: includes 支持层级继承
- ✅ **环境变量注入**: `${VAR}` 语法 + 自动回填保护
- ✅ **Schema 验证**: Zod schema + 插件动态扩展
- ✅ **版本迁移**: legacy.migrations.ts 处理旧版本兼容
- ✅ **备份轮转**: 保留最近 5 个配置快照
- ✅ **热加载**: 文件变更自动重新加载
- ✅ **错误友好**: 验证失败提供详细路径 + 建议

#### 🚀 技术优势
1. **类型安全**: TypeScript 类型推导 + 运行时校验
2. **安全防护**: 配置写入前校验哈希，防止意外覆盖
3. **灵活继承**: includes 支持多层配置继承
4. **插件扩展**: 通道插件可动态扩展 schema

#### ⚠️ 已知限制
1. **循环检测弱**: includes 深度限制为 10，但无 DAG 校验
2. **备份恢复**: 只能通过手动复制文件恢复
3. **配置锁**: 多进程同时写入时无互斥保护
4. **大配置性能**: 超大配置文件解析较慢

#### 💡 优化方向
- [ ] 实现配置 diff 工具（对比两个版本）
- [ ] 提供配置回滚命令
- [ ] 引入文件锁（flock）防止竞态
- [ ] 添加配置压缩（去除注释和空白）
- [ ] 实现配置加密（敏感字段）

**配置文件**: `~/.openclawcn/config.json5`

---

### 7.2 Cron 定时任务 ⭐⭐⭐⭐
**位置**: `src/cron/`

**功能概述**: 灵活的定时任务系统，支持 Cron 表达式和间隔调度

#### 核心实现

**技术栈**:
- 调度引擎: `croner`
- 存储: SQLite（执行历史）
- 隔离执行: isolated-agent 模式

**核心文件**:
- `cron-scheduler.ts` - 调度器
- `cron-jobs-store.ts` - 任务存储
- `cron-executor.ts` - 执行器

#### 实现的功能
- ✅ **定时调度**: 支持 cron 表达式 + interval（秒/分/时/天）
- ✅ **隔离代理**: isolated-agent 模式（单独会话执行）
- ✅ **投递策略**: 支持 Telegram/WhatsApp/Discord 等多通道
- ✅ **运行日志**: SQLite 存储执行历史（成功/失败/输出）
- ✅ **错误隔离**: 单个任务失败不影响其他任务
- ✅ **追赶机制**: 重启后自动执行错过的任务

#### 🚀 技术优势
1. **精确调度**: 使用 setTimeout 而非 setInterval，避免漂移
2. **容错设计**: 错误隔离，单个任务失败不影响其他任务
3. **灵活配置**: 支持 Cron 表达式和简单间隔
4. **历史追踪**: 完整的执行历史记录

#### ⚠️ 已知限制
1. **并发限制**: 无全局并发控制，同时运行多任务可能 OOM
2. **时区处理**: cron 表达式基于 UTC，中国用户易混淆
3. **任务依赖**: 不支持任务间依赖关系
4. **执行超时**: 无任务执行超时控制

#### 💡 优化方向
- [ ] 实现任务优先级 + 并发槽位
- [ ] 支持本地时区配置
- [ ] 提供 DAG 任务流（task A 完成后触发 task B）
- [ ] 添加任务执行超时机制
- [ ] 实现任务执行结果通知

---

### 7.3 Hooks 钩子系统 ⭐⭐⭐⭐
**位置**: `src/hooks/`

**功能概述**: 事件驱动的钩子系统，支持自定义 Shell 脚本执行

#### 核心实现

**技术栈**:
- Shell 执行: child_process
- 事件系统: EventEmitter
- 超时控制: 可配置超时

**核心文件**:
- `hook-executor.ts` - 钩子执行器
- `hook-registry.ts` - 钩子注册表

#### 实现的功能
- ✅ **Shell 命令钩子**: 执行自定义 Shell 脚本
- ✅ **事件监听**: 监听系统事件（消息接收、发送等）
- ✅ **自定义脚本执行**: 支持 Bash/Zsh/Fish 等
- ✅ **环境变量注入**: 自动注入事件上下文
- ✅ **错误处理**: 捕获和记录钩子执行错误
- ✅ **超时控制**: 防止钩子阻塞

#### 🚀 技术优势
1. **灵活扩展**: 用户可通过配置添加自定义钩子
2. **事件丰富**: 支持多种系统事件
3. **安全隔离**: 钩子在独立进程中执行

#### ⚠️ 已知限制
1. **安全风险**: 钩子可执行任意命令
2. **错误传播**: 钩子错误不影响主流程
3. **调试困难**: 钩子执行日志分散

#### 💡 优化方向
- [ ] 添加钩子沙箱（限制权限）
- [ ] 实现钩子执行日志集中管理
- [ ] 支持钩子脚本验证
- [ ] 添加钩子性能监控

---

### 7.4 MCP (Model Context Protocol) ⭐⭐⭐⭐
**位置**: `src/mcp/`

**功能概述**: MCP 服务器管理，扩展 AI 工具能力

#### 核心实现

**技术栈**:
- 协议: MCP 2024-11 规范
- SDK: `@modelcontextprotocol/sdk`
- 进程管理: child_process + stdio
- 市场: MCP Registry + ModelScope

**核心文件**:
- `mcp-server-manager.ts` - 服务器管理
- `mcp-tool-bridge.ts` - 工具桥接
- `mcp-market.ts` - 市场集成

#### 实现的功能
- ✅ **MCP 服务器管理**: 启动/停止/重启/健康监控
- ✅ **工具桥接**: 将 MCP 工具转换为 AnyAgentTool 格式
- ✅ **市场集成**: 支持从 MCP Registry 和 ModelScope 同步服务器列表
- ✅ **生命周期管理**: 自动重启（最多 3 次）、熔断（5 次失败后）
- ✅ **工具命名空间**: mcp_{serverId}_{toolName} 避免冲突
- ✅ **结果截断**: 100KB 限制防止大输出 OOM
- ✅ **热更新**: 支持 tools/list_changed 通知

#### 🚀 技术优势
1. **协议兼容**: 完整实现 MCP 2024-11 规范
2. **易扩展**: 第三方可轻松添加 MCP 服务器
3. **市场生态**: 支持从市场自动发现和安装
4. **自动恢复**: 服务器崩溃自动重启

#### ⚠️ 已知限制
1. **进程管理**: 使用 child_process，Windows 信号处理有 bug
2. **错误隔离**: 某个 MCP 服务器崩溃时，所有工具不可用
3. **安全沙箱缺失**: MCP 服务器可执行任意命令
4. **资源泄漏**: 长时间运行可能积累僵尸进程

#### 💡 优化方向
- [ ] 引入 sandbox（Docker / Firecracker）
- [ ] 实现 MCP 服务器池（避免单点故障）
- [ ] 提供工具执行审计日志
- [ ] 添加 MCP 服务器性能监控
- [ ] 实现 MCP 服务器权限控制

---

### 7.5 ACP (Agent Client Protocol) ⭐⭐⭐⭐
**位置**: `src/acp/`

**功能**:
- ✅ IDE 集成协议
- ✅ Zed Editor 支持
- ✅ VS Code 集成

**依赖**: `@agentclientprotocol/sdk`

**文档**: `docs/acp.md`

---

### 7.6 Pairing 设备配对 ⭐⭐⭐⭐
**位置**: `src/pairing/`

**功能**:
- ✅ QR 码生成
- ✅ 设备授权
- ✅ 安全配对

---

### 7.7 Security 安全模块 ⭐⭐⭐⭐⭐
**位置**: `src/security/`

**功能**:
- ✅ 访问控制
- ✅ Token 验证
- ✅ 加密通信
- ✅ 白名单管理

---

### 7.8 TUI (Terminal UI) ⭐⭐⭐⭐
**位置**: `src/tui/`

**功能**:
- ✅ 交互式终端界面
- ✅ 配置向导
- ✅ 状态监控

**依赖**: `@mariozechner/pi-tui`

**运行**: `pnpm tui`

---

### 7.9 Wizard 设置向导 ⭐⭐⭐⭐⭐
**位置**: `src/wizard/`

**功能**:
- ✅ 初始化配置
- ✅ 通道设置
- ✅ 认证配置
- ✅ 技能安装

**运行**: `openclawcn onboard`

---

### 7.10 CLI 命令行 ⭐⭐⭐⭐⭐
**位置**: `src/cli/` + `src/commands/`

**核心命令**:
- `openclawcn gateway` - 启动网关
- `openclawcn agent` - AI 对话
- `openclawcn message` - 发送消息
- `openclawcn config` - 配置管理
- `openclawcn channels` - 通道管理
- `openclawcn onboard` - 初始化向导
- `openclawcn doctor` - 系统诊断
- `openclawcn acp` - ACP 协议

---

### 7.11 Media 媒体处理 ⭐⭐⭐⭐
**位置**: `src/media/` + `src/media-understanding/`

**功能**:
- ✅ 图片处理 (Sharp)
- ✅ 视频处理
- ✅ 音频转换
- ✅ PDF 解析 (pdfjs-dist)
- ✅ OCR 和图像理解

**依赖**:
- `sharp`
- `pdfjs-dist`
- `file-type`

---

### 7.12 TTS (Text-to-Speech) ⭐⭐⭐
**位置**: `src/tts/`

**功能**:
- ✅ 语音合成
- ✅ 多语言支持

**依赖**: `node-edge-tts`

---

### 7.13 I18N 国际化 ⭐⭐⭐
**位置**: `src/i18n/`

**功能**:
- ✅ 多语言支持
- ✅ 本地化消息

---

### 7.14 Logging 日志系统 ⭐⭐⭐⭐
**位置**: `src/logging/` + `src/logger.ts`

**功能**:
- ✅ 结构化日志
- ✅ 日志分级
- ✅ 文件轮转

**依赖**: `tslog`

---

### 7.15 Daemon 守护进程 ⭐⭐⭐⭐
**位置**: `src/daemon/`

**功能**:
- ✅ Systemd 集成 (Linux)
- ✅ Launchd 集成 (macOS)
- ✅ 开机自启动
- ✅ 进程管理

---

## 📊 模块重要性总结

### 🔥 最高优先级 (⭐⭐⭐⭐⭐)
必须稳定运行的核心模块：
1. **Gateway** (`src/gateway/`) - 核心网关
2. **Routing** (`src/routing/`) - 消息路由
3. **Channels** (`src/channels/`) - 通道抽象
4. **Agent Core** (`src/agents/`) - AI 代理
5. **Providers** (`src/providers/`) - 模型提供商
6. **CLI** (`src/cli/`) - 命令行
7. **Config** (`src/config/`) - 配置系统
8. **Security** (`src/security/`) - 安全模块
9. **macOS App** (`apps/macos/`) - Mac 应用
10. **Wizard** (`src/wizard/`) - 设置向导

### ⚡ 高优先级 (⭐⭐⭐⭐)
重要但可容错的模块：
- 主流通道 (WhatsApp, Telegram, Discord, Slack, Signal)
- 中国通道 (Feishu, DingTalk, WeCom)
- Canvas, Memory, Browser
- iOS/Android App
- Cron, Hooks, MCP, ACP
- 媒体处理

### 🛠️ 中等优先级 (⭐⭐⭐)
增强功能模块：
- 扩展通道 (Matrix, LINE, BlueBubbles 等)
- TTS, I18N, TUI
- 扩展插件

### 📦 低优先级 (⭐⭐)
实验性或小众模块：
- Nostr, Tlon, IRC
- Windows App (开发中)

---

## 🔍 快速定位指南

### 场景 1: 通道消息发送失败
**检查顺序**:
1. `src/channels/` - 通道实现
2. `src/routing/` - 路由配置
3. `extensions/<channel-name>/` - 扩展通道
4. `src/gateway/server-chat.ts` - 消息处理

### 场景 2: AI 回复异常
**检查顺序**:
1. `src/agents/` - 代理核心
2. `src/providers/` - 模型提供商
3. `src/gateway/server.impl.ts` - 网关路由
4. `src/memory/` - 记忆系统

### 场景 3: macOS 应用崩溃
**检查顺序**:
1. `apps/macos/Sources/` - Swift 源码
2. `src/gateway/boot.ts` - 网关启动
3. `src/daemon/` - 守护进程

### 场景 4: 配置问题
**检查顺序**:
1. `src/config/` - 配置解析
2. `src/wizard/` - 设置向导
3. `src/cli/` - CLI 命令
4. `~/.openclawcn/config.json5` - 配置文件

### 场景 5: 性能问题
**检查顺序**:
1. `src/dispatch/` - 调度系统
2. `src/routing/` - 路由优化
3. `src/gateway/server-lanes.ts` - 并发控制
4. `src/logging/` - 日志级别

---

## 🚀 开发快速启动

```bash
# 1. 安装依赖
pnpm install

# 2. 构建项目
pnpm build

# 3. 开发模式启动网关
pnpm gateway:dev

# 4. 运行测试
pnpm test

# 5. 类型检查
pnpm tsgo

# 6. 代码格式化
pnpm format

# 7. 完整检查
pnpm check
```

---

## 📚 相关文档

- **完整文档**: https://docs.openclawcncn.com
- **入门指南**: `README.md`
- **开发规范**: `AGENTS.md`
- **测试指南**: `docs/testing.md`
- **发布流程**: `docs/reference/RELEASING.md`
- **通道文档**: `docs/channels/`
- **ACP 协议**: `docs/acp.md`

---

## 📊 综合评估

### 架构优势总结

#### 🏆 最佳设计实践

1. **模块化设计** (⭐⭐⭐⭐⭐)
   - 清晰的模块职责划分
   - 依赖注入良好
   - 易于测试和扩展

2. **类型安全** (⭐⭐⭐⭐⭐)
   - TypeScript + TypeBox + Zod 三层防护
   - 运行时 Schema 校验
   - 编译时类型检查

3. **性能优化** (⭐⭐⭐⭐)
   - 缓存策略完善（LRU、WeakMap）
   - 批量操作优化
   - 增量更新机制

4. **容错设计** (⭐⭐⭐⭐)
   - 多级降级策略
   - 自动重连机制
   - 熔断器保护

5. **跨平台支持** (⭐⭐⭐⭐⭐)
   - macOS/iOS/Android 原生应用
   - Windows/Linux CLI 支持
   - 代码共享良好

### 核心问题和优化优先级

#### 🚨 高优先级问题（需立即解决）

1. **Gateway 分布式能力缺失**
   - 📍 问题: 无跨进程状态同步，单点故障
   - 💡 方案: 引入 Redis PubSub
   - 📂 影响模块: `src/gateway/`

2. **Memory 原生依赖问题**
   - 📍 问题: sqlite-vec 需编译，部分平台失败
   - 💡 方案: 提供纯 JS fallback（faiss.js）
   - 📂 影响模块: `src/memory/`, `extensions/memory-*`

3. **MCP 安全沙箱缺失**
   - 📍 问题: MCP 服务器可执行任意命令
   - 💡 方案: 引入 Docker 沙箱
   - 📂 影响模块: `src/mcp/`

4. **Dispatch 配置复杂度高**
   - 📍 问题: dispatch.yaml 需手工维护，门槛高
   - 💡 方案: 提供自动生成工具
   - 📂 影响模块: `src/dispatch/`

#### ⚡ 中优先级改进（重要但不紧急）

1. **Routing 性能优化**
   - 💡 引入 Trie 树加速前缀匹配
   - 📂 `src/routing/`

2. **Agents PTY 资源管理**
   - 💡 实现 bash 进程池 + TTL 清理
   - 📂 `src/agents/`

3. **Channels 热更新**
   - 💡 实现配置变更检测 + 自动重新加载
   - 📂 `src/channels/`

4. **Config 配置回滚**
   - 💡 提供配置 diff 工具和回滚命令
   - 📂 `src/config/`

5. **Cron 并发控制**
   - 💡 实现任务优先级 + 并发槽位
   - 📂 `src/cron/`

#### 🔧 低优先级优化（可选增强）

1. **Routing 冲突检测**
   - 💡 提供路由配置校验工具
   - 📂 `src/routing/`

2. **Canvas 虚拟滚动**
   - 💡 优化大型画布性能
   - 📂 `src/canvas-host/`

3. **iOS/Android 离线识别**
   - 💡 实现 On-Device 语音识别
   - 📂 `apps/ios/`, `apps/android/`

### 性能瓶颈分析

| 模块 | 瓶颈点 | 影响 | 优化建议 |
|------|--------|------|---------|
| **Gateway** | chatRunState 内存累积 | 高并发场景内存泄漏 | 实现 LRU 淘汰 |
| **Routing** | normalizeAgentId 重复调用 | 路由延迟 | 结果缓存 |
| **Memory** | sqlite-vec 编译依赖 | 安装失败率高 | 纯 JS fallback |
| **Dispatch** | LLM 分类成本 | API 开销 | 相似度缓存 |
| **Agents** | PTY 进程泄漏 | 资源耗尽 | 进程池 + TTL |
| **macOS App** | 蓝牙耳机兼容性 | 音质下降 | 音频路由优化 |
| **iOS App** | 后台识别限制 | 功能受限 | Background Modes |
| **Android App** | 系统依赖 Google 服务 | 国内可用性 | 离线识别 |

### 中国本地化评分

| 通道 | 可用性 | 稳定性 | 功能完整性 | 性能 | 推荐度 |
|------|--------|--------|-----------|------|--------|
| **飞书** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **钉钉** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **企业微信** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**推荐**: 飞书和钉钉是企业场景首选，企业微信适合已有企业微信生态的场景。

### 代码质量指标

- **测试覆盖率**: ~70%（Vitest V8）
- **类型覆盖率**: ~95%（TypeScript strict mode）
- **文档完整性**: 较高（README + docs/ + AGENTS.md）
- **代码规范**: 统一（Oxlint + Oxfmt）
- **依赖健康**: 良好（定期更新）

---

## 🔍 快速定位参考

### 场景 1: 通道消息发送失败

**检查顺序**:
1. `src/channels/` - 检查通道实现和配置
2. `src/routing/` - 检查路由配置和绑定
3. `extensions/<channel-name>/` - 检查扩展通道代码
4. `src/gateway/server-chat.ts` - 检查消息处理逻辑
5. **日志**: 查看 `~/.openclawcn/logs/` 或运行 `openclawcn gateway --verbose`

**常见原因**:
- ❌ 通道未启用（配置中 `enabled: false`）
- ❌ 认证失败（API key 过期或错误）
- ❌ 路由未配置（无匹配的 binding）
- ❌ 消息格式错误（不符合平台限制）
- ❌ 网络问题（防火墙、代理）

---

### 场景 2: AI 回复异常

**检查顺序**:
1. `src/agents/` - 检查代理核心和认证配置
2. `src/providers/` - 检查模型提供商配置
3. `src/gateway/server.impl.ts` - 检查网关路由
4. `src/memory/` - 检查记忆系统（如果启用）
5. `src/dispatch/` - 检查调度策略（如果启用）

**常见原因**:
- ❌ API key 无效或额度用尽
- ❌ 模型不可用（选择了不存在的模型）
- ❌ 上下文超限（对话历史太长）
- ❌ 工具调用失败（Bash、MCP 等）
- ❌ 网络超时

---

### 场景 3: macOS 应用崩溃

**检查顺序**:
1. `apps/macos/Sources/` - 检查 Swift 源码
2. `src/gateway/boot.ts` - 检查网关启动流程
3. `src/daemon/` - 检查守护进程管理
4. **系统日志**: 运行 `./scripts/clawlog.sh`
5. **控制台**: 查看 macOS Console.app

**常见原因**:
- ❌ 权限问题（麦克风、语音识别）
- ❌ 蓝牙耳机冲突
- ❌ Gateway 进程未运行
- ❌ Node.js 环境问题
- ❌ 配置文件损坏

---

### 场景 4: 配置问题

**检查顺序**:
1. `src/config/` - 检查配置解析逻辑
2. `src/wizard/` - 检查设置向导
3. `src/cli/` - 检查 CLI 命令
4. `~/.openclawcn/config.json5` - 检查配置文件
5. **验证**: 运行 `openclawcn config validate`

**常见原因**:
- ❌ 配置语法错误（JSON5 格式）
- ❌ Schema 验证失败（缺少必填字段）
- ❌ 环境变量未设置
- ❌ 配置文件权限问题
- ❌ 配置版本不兼容

---

### 场景 5: 性能问题

**检查顺序**:
1. `src/dispatch/` - 检查调度系统配置
2. `src/routing/` - 检查路由优化
3. `src/gateway/server-lanes.ts` - 检查并发控制
4. `src/logging/` - 调整日志级别（减少输出）
5. **监控**: 查看 CPU、内存、网络使用

**常见原因**:
- ❌ 并发请求过多
- ❌ 路由缓存失效
- ❌ 大量日志输出
- ❌ Memory 索引过大
- ❌ MCP 服务器阻塞

---

## 🎯 最佳实践建议

### 开发者指南

1. **新功能开发**:
   - 先阅读 `AGENTS.md` 了解开发规范
   - 参考现有模块的实现模式
   - 编写单元测试（目标覆盖率 70%）
   - 运行 `pnpm check` 确保代码质量

2. **Bug 调试**:
   - 使用 `--verbose` 模式查看详细日志
   - 利用本文档快速定位模块
   - 查看相关测试用例了解预期行为
   - 善用 VSCode 断点调试

3. **性能优化**:
   - 使用 `pnpm test:coverage` 分析热点
   - 参考本文档的性能瓶颈分析
   - 实施前先编写性能测试
   - 记录优化前后对比数据

### 用户指南

1. **初次使用**:
   - 运行 `openclawcn onboard` 初始化
   - 选择合适的通道（中国用户优选飞书/钉钉）
   - 配置至少一个 AI 提供商
   - 测试基本功能确认正常

2. **日常维护**:
   - 定期运行 `openclawcn doctor` 检查健康
   - 运行 `openclawcn update` 保持最新
   - 备份配置文件（`~/.openclawcn/config.json5`）
   - 查看日志排查问题

3. **故障恢复**:
   - 运行 `openclawcn doctor` 诊断
   - 查看 `~/.openclawcn/logs/` 日志
   - 尝试重启 Gateway (`openclawcn gateway restart`)
   - 必要时重新运行 onboarding

---

**最后更新**: 2026-02-16
**文档版本**: v2.0（深度增强版）
**维护者**: 根据项目实际情况更新此文档
**反馈**: 如发现文档错误或需要补充，请提交 Issue
