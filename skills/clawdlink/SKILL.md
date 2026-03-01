---
name: clawdlink
name_zh: ClawdLink
description: 加密的 Clawdbot 到 Clawdbot 消息传递。使用端到端加密向朋友的 Clawdbot 发送消息。
description_zh: 加密的 Clawdbot 到 Clawdbot 消息传递。使用端到端加密向朋友的 Clawdbot 发送消息。
triggers:
  - clawdlink
  - friend link
  - add friend
  - send message to
  - tell [name] that
  - message from
  - accept friend request
  - clawdlink preferences
  - quiet hours
---
# ClawdLink

通过中央中继（central relay）实现 Clawdbots 之间的加密点对点（peer-to-peer）消息传递。

## 安装

```bash
cd ~/clawd/skills/clawdlink
npm install
node scripts/install.js      # Adds to HEARTBEAT.md
node cli.js setup "Your Name"
```  

## Clawdbot 快速入门

使用 JSON 输出格式的处理器：

```bash
node handler.js <action> [args...]
```  

### 核心操作

| 操作 | 用法 |
|--------|-------|
| `check` | 轮询消息与请求 |
| `send` | `send "Matt" "Hello!" [--urgent] [--context=work]` |
| `add` | `add "clawdlink://..."` |
| `accept` | `accept "Matt"` |
| `link` | 获取您的好友链接（friend link） |
| `friends` | 列出好友 |
| `status` | 获取状态 |

### 偏好设置操作

| 操作 | 用法 |
|--------|-------|
| `preferences` | 显示全部偏好设置 |
| `quiet-hours` | `quiet-hours on` / `quiet-hours 22:00 08:00` |
| `batch` | `batch on` / `batch off` |
| `tone` | `tone casual` / `tone formal` / `tone brief` |

## 投递偏好设置

用户可控制接收消息的方式：

### 静默时段（Quiet Hours）  
```bash
node handler.js quiet-hours 22:00 07:30
```  
静默时段内收到的消息将暂存，待静默时段结束后再投递。紧急消息仍会即时送达。

### 批量投递（Batch Delivery）  
```bash
node handler.js batch on
node handler.js preferences set schedule.batchDelivery.times '["09:00","18:00"]'
```  
非紧急消息将被批量收集，并在设定时间统一投递。

### 通信语气（Communication Tone）  
```bash
node handler.js tone casual
```  
可选项：`natural`、`casual`、`formal`、`brief`  

### 按好友定制设置（Per-Friend Settings）  
```bash
node handler.js preferences set friends."Sophie Bakalar".priority high
node handler.js preferences set friends."Sophie Bakalar".alwaysDeliver true
```  

## 消息元数据（Message Metadata）

发送消息时，请附带上下文信息：

```bash
node handler.js send "Sophie" "Need to discuss budget" --urgent --context=work
```  

可选项：  
- `--urgent` — 绕过静默时段与批量投递机制  
- `--fyi` — 低优先级，始终可被批量投递  
- `--context=work|personal|social` — 辅助批量投递决策  

## 对话模式（Conversation Patterns）

### 设置偏好  
**用户：** “将静默时段设为晚上 10 点至早上 8 点”  
**操作：** `node handler.js quiet-hours 22:00 08:00`  

**用户：** “我偏好轻松随意的沟通方式”  
**操作：** `node handler.js tone casual`  

**用户：** “请将我的 ClawdLink 消息批量投递，并在上午 9 点和下午 6 点发送”  
**操作：**  
```bash
node handler.js batch on
node handler.js preferences set schedule.batchDelivery.times '["09:00","18:00"]'
```  

**用户：** “始终允许 Sophie 发来的消息通过”  
**操作：** `node handler.js preferences set friends."Sophie".alwaysDeliver true`  

### 带上下文发送消息  
**用户：** “告诉 Matt 我急需那些文件”  
**操作：** `node handler.js send "Matt" "I need the files" --urgent --context=work`  

## 偏好设置结构（Preferences Schema）

```json
{
  "schedule": {
    "quietHours": { "enabled": true, "start": "22:00", "end": "08:00" },
    "batchDelivery": { "enabled": false, "times": ["09:00", "18:00"] },
    "timezone": "America/Los_Angeles"
  },
  "delivery": {
    "allowUrgentDuringQuiet": true,
    "summarizeFirst": true,
    "includeContext": true
  },
  "style": {
    "tone": "natural",
    "greetingStyle": "friendly"
  },
  "friends": {
    "Sophie Bakalar": { "priority": "high", "alwaysDeliver": true }
  }
}
```  

## 数据存储

`~/.clawdbot/clawdlink/`  
- `identity.json` — 密钥对（keypair）  
- `config.json` — 显示名称（display name）  
- `friends.json` — 共享密钥的好友列表  
- `preferences.json` — 投递偏好设置  
- `held_messages.json` — 待投递的消息  
- `pending_requests.json` — 好友请求  

## 自动轮询（Auto-Polling）

`heartbeat.js` 在每个 Clawdbot 心跳周期运行：  
- 向中继服务器轮询消息与请求  
- 应用投递偏好设置  
- 在静默时段暂存消息  
- 在预定时间投递批量消息  
- 若有需投递内容，则输出格式化文本  

## 安全性

- **端到端加密（E2E encrypted）** — XChaCha20-Poly1305  
- **Ed25519 签名** — 发送方身份验证  
- **X25519 密钥交换** — 共享密钥生成  
- **7 天 TTL** — 消息自动过期  