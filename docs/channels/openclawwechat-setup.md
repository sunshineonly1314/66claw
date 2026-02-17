# 个人微信渠道配置指南 (WeChat Personal via ClawChat Bridge)

## 概述

通过 **ClawChat** 桥接服务，将个人微信号接入 OpenClawCN AI 助手。

**核心优势：**
- 无需 VPN / 翻墙
- 无需企业微信 / 企业认证
- 个人微信号直接使用
- 支持文本、图片、视频、文档
- 2 秒内响应

**工作原理：**

```
用户在微信中发消息 → ClawChat 桥接服务器 → OpenClawCN AI → 回复到微信
```

> ClawChat 桥接服务使用 Telegram Bot API 兼容格式进行通信，OpenClawCN 通过 HTTP 轮询获取消息。

---

## 完整配置流程

整个配置分为两部分：**上游 ClawChat 端**（桥接服务）和 **OpenClawCN 端**（AI 网关）。

### 第一部分：上游 ClawChat 桥接服务配置

> ClawChat 是一个将个人微信消息转发到第三方 API 的桥接服务。你需要先在 ClawChat 完成注册和绑定，才能在 OpenClawCN 中接入。

#### 步骤 1：注册 ClawChat 账号

1. 在微信中搜索 **「ClawChat」** 小程序，或访问 ClawChat 官网
2. 使用微信扫码注册 / 登录 ClawChat 账号
3. 完成账号注册

#### 步骤 2：绑定个人微信号

1. 进入 ClawChat 小程序或后台
2. 按照引导完成个人微信号的绑定
3. 绑定成功后，你的个人微信收到的消息会被转发到 ClawChat 桥接服务器

> **说明：** 绑定后，当其他用户给你的个人微信发消息时，ClawChat 会将消息转发到 OpenClawCN 进行 AI 处理，再把回复通过微信发回给对方。

#### 步骤 3：生成 API Key

1. 进入 ClawChat 的 **「我的」** 页面
2. 点击 **「APIKey 管理」**
3. 点击 **「生成 APIKey」** 按钮
4. 复制生成的 API Key

**API Key 格式说明：**

```
bot_id:secret
```

- 格式为 `bot_id:secret`，**中间包含冒号 `:`**
- 示例：`12345:abcdef1234567890`
- 请完整复制，不要遗漏冒号及其后面的部分
- 系统会自动处理 URL 编码（冒号 → `%3A`），无需手动修改

> **安全提示：** API Key 等同于你的账号密码，请妥善保管，不要泄露给他人。

---

### 第二部分：OpenClawCN 端配置

完成 ClawChat 端配置后，需要在 OpenClawCN 中配置 API Key 以建立连接。

#### 方式 A：使用配置向导（推荐新手使用）

```bash
openclawcn setup
```

1. 启动向导后，在渠道选择中选择 **「个人微信 (WeChat Personal)」**
2. 按照提示粘贴你的 ClawChat API Key
3. 确认轮询间隔（默认 2 秒即可）
4. 配置完成

#### 方式 B：手动编辑配置文件

编辑 `~/.openclawcn/config.json5`，在 `plugins` 区块添加：

```json5
{
  plugins: {
    enabled: [
      "openclawwechat",  // 添加这一行
      // ... 其他已启用的插件
    ],
    entries: {
      openclawwechat: {
        enabled: true,
        config: {
          apiKey: "你的_BOT_ID:你的_SECRET",  // 替换为你的 ClawChat API Key
        },
      },
    },
  },
}
```

#### 方式 C：通过 Web UI 配置

1. 启动 OpenClawCN 网关
2. 在浏览器中打开管理界面（默认 `http://localhost:18789`）
3. 进入 **「渠道」** 标签页
4. 找到 **「微信 (个人号)」** 卡片
5. 点击展开，在配置表单中填入 API Key
6. 保存配置

---

### 第三部分：启动并验证

#### 启动网关

```bash
openclawcn gateway run
```

#### 验证配置

1. 在微信中给绑定的个人号发送一条消息（例如「你好」）
2. 约 2 秒后收到 AI 回复即为配置成功

#### 如果没有收到回复

按以下顺序排查：

```bash
# 1. 检查 API Key 是否已配置
openclawcn config show

# 2. 检查网关是否在运行
openclawcn gateway status

# 3. 开启调试模式查看详细日志
#    在配置中设置 debug: true，然后：
openclawcn logs --follow

# 4. 检查网络是否能连通桥接服务器
curl https://api.clawchat.mifengcdn.com
```

---

## 完整架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                     消息收发完整流程                              │
└──────────────────────────────────────────────────────────────────┘

  用户 A 发微信消息给你
        │
        ▼
  ┌─────────────────────┐
  │  你的个人微信号       │  ← 已绑定到 ClawChat
  └─────────┬───────────┘
            │
            ▼
  ┌─────────────────────────────────────────────┐
  │  ClawChat 桥接服务器                          │
  │  (api.clawchat.mifengcdn.com)               │
  │                                             │
  │  将微信消息转换为 Telegram Bot API 兼容格式    │
  │  存储在队列中等待拉取                         │
  └─────────────────────┬───────────────────────┘
                        │
          HTTP 轮询 (每 2 秒)
          GET /bot{apiKey}/getUpdates
                        │
                        ▼
  ┌─────────────────────────────────────────────┐
  │  OpenClawCN 网关                              │
  │                                             │
  │  1. 解析消息 (parseTelegramUpdate)            │
  │  2. 下载媒体 (图片/视频/文档)                  │
  │  3. 发送 typing 状态 → 用户看到「对方正在输入」  │
  │  4. 交给 AI 代理处理                          │
  │  5. POST /markProcessed 确认消息已处理         │
  └─────────────────────┬───────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────┐
  │  AI 代理 (Agent)                              │
  │                                             │
  │  理解消息内容 → 调用工具 → 生成回复            │
  └─────────────────────┬───────────────────────┘
                        │
          HTTP POST 发送回复
          /sendMessage, /sendPhoto, /sendVideo...
                        │
                        ▼
  ┌─────────────────────────────────────────────┐
  │  ClawChat 桥接服务器                          │
  │                                             │
  │  将回复转发回微信                              │
  └─────────────────────┬───────────────────────┘
                        │
                        ▼
  用户 A 在微信中收到 AI 回复
```

---

## 完整配置参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `apiKey` | string | **是** | - | ClawChat API Key，格式 `bot_id:secret` |
| `pollIntervalMs` | number | 否 | `2000` | 轮询间隔（毫秒），消息获取频率 |
| `sessionKey` | string | 否 | `agent:main:main` | 会话标识，格式 `agent:<agentId>:<rest>` |
| `debug` | boolean | 否 | `false` | 调试模式，开启详细日志 |

### 完整配置示例

```json5
{
  plugins: {
    enabled: ["openclawwechat"],
    entries: {
      openclawwechat: {
        enabled: true,
        config: {
          apiKey: "12345:abcdef1234567890",  // ClawChat API Key
          pollIntervalMs: 2000,              // 每 2 秒检查新消息
          sessionKey: "agent:main:main",     // 使用默认 AI 代理
          debug: false,                      // 生产环境关闭调试
        },
      },
    },
  },
}
```

---

## 支持的消息类型

### 接收（用户 → AI）

| 类型 | 支持 | 说明 |
|------|------|------|
| 文本 | Yes | 纯文本消息 |
| 图片 | Yes | JPG/PNG/GIF/WebP，自动下载 |
| 视频 | Yes | MP4/MOV，10MB 限制 |
| 文档 | Yes | PDF/Word/Excel/压缩包 |
| 语音 | Yes | 自动转文字处理 |

### 发送（AI → 用户）

| 类型 | 支持 | 说明 |
|------|------|------|
| 文本 | Yes | 支持长文本自动分段 |
| 图片 | Yes | URL 或本地文件上传 |
| 视频 | Yes | URL 或本地文件上传 |
| 文档 | Yes | URL 或本地文件上传 |

---

## 常见问题排查

### 发送消息后没有回复

1. **检查 ClawChat 绑定是否正常**
   - 回到 ClawChat 小程序，确认个人微信号已成功绑定
   - 确认绑定状态为「正常」

2. **检查 API Key 是否正确**
   ```bash
   openclawcn config show
   ```
   确认 `openclawwechat.config.apiKey` 存在且格式正确（包含冒号）

3. **检查网关是否运行中**
   ```bash
   openclawcn gateway status
   ```

4. **开启调试模式查看日志**
   在配置中设置 `debug: true`，然后：
   ```bash
   openclawcn logs --follow
   ```
   - 如果看到 `Polling #N: offset=X` → 轮询正常工作
   - 如果看到 `Polling failed: HTTP 401` → API Key 不正确
   - 如果看到 `API error` → ClawChat 服务端返回错误
   - 如果没有任何 Polling 日志 → 插件未启用或未加载

5. **检查网络连通性**
   ```bash
   curl https://api.clawchat.mifengcdn.com
   ```
   如果无法连通，检查你的网络设置和防火墙

### 回复延迟较高

- 默认轮询间隔为 2 秒，可以适当降低：
  ```json5
  pollIntervalMs: 1000  // 每 1 秒检查一次
  ```
  注意：过低的间隔可能增加服务器负载，建议不低于 500ms

### API Key 失效

1. 回到 ClawChat → 我的 → APIKey 管理
2. 重新生成新的 API Key
3. 更新配置文件中的 `apiKey` 字段
4. 重启网关：`openclawcn gateway run`

### 媒体发送失败

- 检查日志中是否有 `Failed to download media` 错误
- 媒体文件大小限制为 10MB
- 确认 ClawChat 提供了 `upload_api_url`（日志中会显示）

---

## 与其他微信方案对比

| 方案 | 需要企业认证 | 需要 VPN | 个人微信 | 稳定性 | 部署难度 |
|------|------------|---------|---------|--------|---------|
| **ClawChat 桥接** (本方案) | 否 | 否 | Yes | 高 | 极低 |
| 企业微信 (WeCom) | 是 | 否 | 否（仅企微） | 高 | 中 |
| iPad 协议 | 否 | 视情况 | Yes | 低（易封号） | 高 |
| 桌面微信自动化 | 否 | 否 | Yes | 中 | 高 |

---

## 进阶配置

### 多代理模式

如果你运行了多个 AI 代理，可以通过 `sessionKey` 指定消息路由到哪个代理：

```json5
{
  config: {
    apiKey: "your-key",
    sessionKey: "agent:translator:main",  // 使用「translator」代理
  },
}
```

`sessionKey` 格式为 `agent:<agentId>:<rest>`：
- `agent:main:main` — 默认主代理
- `agent:translator:main` — 翻译代理
- `agent:coder:main` — 编程代理

### 调整轮询频率

```json5
{
  config: {
    pollIntervalMs: 1000,  // 1 秒（更实时，但服务器负载更高）
    // pollIntervalMs: 5000,  // 5 秒（更节省资源，适合低频场景）
  },
}
```

| 间隔 | 适用场景 | 说明 |
|------|---------|------|
| 500ms | 极低延迟需求 | 不推荐长期使用 |
| 1000ms | 实时对话 | 推荐高频使用场景 |
| 2000ms | 日常使用（默认） | 平衡响应速度和资源 |
| 5000-10000ms | 低频通知 | 节省资源 |

### 与其他渠道共存

个人微信渠道可以与飞书、钉钉等渠道同时启用，互不影响：

```json5
{
  plugins: {
    enabled: ["feishu", "dingtalk", "openclawwechat"],
    entries: {
      openclawwechat: {
        enabled: true,
        config: { apiKey: "your-key" },
      },
    },
  },
  channels: {
    feishu: { enabled: true, /* ... */ },
    dingtalk: { enabled: true, /* ... */ },
  },
}
```

---

## 技术细节

### API 端点

ClawChat 桥接服务器提供以下 Telegram Bot API 兼容端点：

| 端点 | 方法 | 用途 |
|------|------|------|
| `/bot{apiKey}/getUpdates` | GET | 轮询获取新消息 |
| `/bot{apiKey}/markProcessed` | POST | 标记消息已处理 |
| `/bot{apiKey}/sendMessage` | POST | 发送文本消息 |
| `/bot{apiKey}/sendPhoto` | POST | 发送图片 |
| `/bot{apiKey}/sendVideo` | POST | 发送视频 |
| `/bot{apiKey}/sendDocument` | POST | 发送文档 |
| `/bot{apiKey}/typing` | POST | 发送输入状态 |

### 错误重试机制

- 轮询失败时自动重试，重试间隔为正常轮询间隔的 5 倍
- 例如：`pollIntervalMs: 2000` → 失败后 10 秒重试
- 单个媒体下载失败不影响消息处理，仅跳过该媒体文件
