# 开源项目学习记录

记录学习和参考的开源项目 GitHub 地址。

---

## 1. OpenClaw (源头项目)

- **GitHub**: https://github.com/openclaw/openclaw
- **描述**: 个人 AI 助手，支持多平台（macOS/Linux/Windows）、多渠道（WhatsApp、Telegram、Slack、Discord、Signal、iMessage 等）
- **特性**:
  - 本地优先的 Gateway 控制面
  - 多渠道收件箱
  - 语音唤醒 + 对话模式
  - 实时 Canvas
  - 浏览器控制、定时任务等工具
  - macOS/iOS/Android 应用
- **技术栈**: TypeScript (82.9%), Swift (13.0%), Kotlin (1.8%)
- **Star**: 154k+
- **许可证**: MIT

---

## 2. MoltBot China (中国插件)

- **GitHub**: https://github.com/BytePioneer-AI/moltbot-china
- **描述**: OpenClaw/Clawdbot 的中国 IM 平台扩展插件集合
- **支持平台**:
  | 平台 | 状态 |
  |------|------|
  | 钉钉 | ✅ 可用 |
  | 飞书 | ✅ 可用 |
  | 企业微信 | ✅ 可用 |
  | QQ 机器人 | 🚧 开发中 |
  | 微信 | PR 审查中 |
- **功能支持**:
  - 文本消息、Markdown
  - 流式响应（钉钉 AI Card、企业微信 stream 回调）
  - 图片/文件接收和发送
  - 私聊、群聊
  - @机器人检测
- **技术栈**: TypeScript (98.5%), JavaScript (1.5%)
- **Star**: 319
- **许可证**: MIT

---

## 关系说明

```
OpenClaw (源头)
    │
    └── MoltBot China (中国插件)
            ├── 钉钉 (DingTalk)
            ├── 飞书 (Feishu/Lark)
            ├── 企业微信 (WeCom)
            └── QQ (开发中)
```

---

## MoltBot China vs Clawdbot 对比分析

### 项目定位差异

| 维度 | MoltBot China | Clawdbot (我们) |
|------|---------------|-----------------|
| **定位** | 社区开源插件，轻量级 | 商业产品，功能完整 |
| **架构** | 独立 npm 包，可单独安装 | 内置 extensions，深度集成 |
| **安装方式** | `openclaw plugins install @openclaw-china/channels` | 随主程序分发 |
| **维护** | 社区驱动 | 产品团队维护 |

### 功能对比表

| 功能 | MoltBot China 钉钉 | Clawdbot 钉钉 | 优势方 |
|------|-------------------|---------------|--------|
| **连接方式** | Stream 长连接 | Webhook + Stream | 🟡 相同 |
| **文本消息** | ✅ | ✅ | 🟡 相同 |
| **Markdown** | ✅ | ✅ | 🟡 相同 |
| **AI Card 流式** | ✅ (enableAICard) | ✅ (完整实现) | 🟢 我们更完整 |
| **会话管理** | ❌ 无 | ✅ 完整实现 | 🟢 **我们优势** |
| **图片上传** | ❌ 无 | ✅ 自动识别上传 | 🟢 **我们优势** |
| **文件发送** | 声称支持但未见代码 | ⚠️ placeholder | 🟡 待确认 |
| **多账户** | ❌ 仅 default | ✅ 支持 | 🟢 **我们优势** |
| **测试覆盖** | ❌ 无测试文件 | ✅ 有测试 | 🟢 **我们优势** |

| 功能 | MoltBot China 飞书 | Clawdbot 飞书 | 优势方 |
|------|-------------------|---------------|--------|
| **连接方式** | WebSocket 长连接 | WebSocket + Webhook | 🟡 相同 |
| **Markdown 卡片** | ✅ sendMarkdownAsCard | ✅ renderMode 自动检测 | 🟢 我们更智能 |
| **图片/文件** | ✅ 接收 | ✅ 完整上传下载 | 🟢 **我们优势** |
| **@ 提及转发** | ❌ | ✅ mention.ts | 🟢 **我们优势** |
| **WebSocket 监控** | ❌ | ✅ monitor.ts | 🟢 **我们优势** |

| 功能 | MoltBot China 企微 | Clawdbot 企微 | 优势方 |
|------|-------------------|---------------|--------|
| **连接方式** | HTTPS 回调 | HTTPS 回调 | 🟡 相同 |
| **群聊支持** | ✅ | ✅ 完整支持 | 🟡 相同 |
| **多账户** | ✅ 支持 | ✅ 支持 (2026.2.4+) | 🟡 相同 |
| **主动发消息** | ❌ | ❌ | 🟡 相同 |

### 我们的核心优势

#### 1. **钉钉 AI Card 完整实现**
```typescript
// 我们的实现支持完整的状态管理
export async function createAICard(config, ctx, log): Promise<AICardInstance | null>
export async function streamAICard(card, content, finished, log): Promise<void>
export async function finishAICard(card, content, log): Promise<void>

// 状态流转: 创建 → INPUTING → streaming → FINISHED
```

#### 2. **会话管理模块**
```typescript
// 我们独有的会话超时和新会话命令支持
export function isNewSessionCommand(text: string): boolean  // 支持中英文命令
export function getSessionKey(senderId, forceNew, timeout, log)
// 支持: /new, /reset, /clear, 新会话, 重新开始, 清空对话
```

#### 3. **自动图片上传**
```typescript
// 自动识别 AI 回复中的本地图片路径并上传
export async function processLocalImages(content, oapiToken, log): Promise<string>
// 支持: file:///, MEDIA:, /tmp/, /Users/, C:\Users\ 等路径格式
```

#### 4. **飞书 @ 提及转发**
```typescript
// 我们支持解析 @ 提及并转发消息
// src/mention.ts - 检测机器人被 @ 的同时是否有其他用户被 @
```

### MoltBot China 的优势

#### 1. **独立安装包**
- 可以 `npm install @openclaw-china/channels` 单独使用
- 不依赖完整的 clawdbot 安装
- 适合只需要中国渠道的用户

#### 2. **更多平台计划**
- QQ 机器人 (开发中)
- 微信 (PR 审查中)

#### 3. **智能机器人模式**
- 他们支持企业微信「智能机器人」模式 (只需 token + encodingAESKey)
- 我们目前只支持「自建应用」模式 (需要 corpId + agentId + agentSecret)

### 代码质量对比

| 维度 | MoltBot China | Clawdbot |
|------|---------------|----------|
| 测试文件 | ❌ 无 | ✅ ai-card.test.ts, session-manager.test.ts, media-upload.test.ts |
| 文档注释 | 基础 | 完整中英双语 |
| 错误处理 | 基础 | 完整 try-catch + 日志 |
| 代码组织 | 单文件较大 | 模块化清晰 |

### 建议学习点

1. **企业微信群聊实现** - 可以参考他们的 WeCom group 支持
2. **独立包架构** - 如果要提供轻量级安装选项
3. **QQ/微信渠道** - 关注他们后续的实现

### 我们应该保持的优势

1. ✅ **会话管理** - 这是用户体验的关键差异点
2. ✅ **自动图片上传** - AI 生成图片自动发送到钉钉
3. ✅ **测试覆盖** - 代码质量保证
4. ✅ **完整文档** - 中英双语注释
5. ✅ **深度集成** - 与 Gateway/Agent 的无缝配合

---

*最后更新: 2026-02-03*
