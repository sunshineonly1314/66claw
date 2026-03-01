---
name: bots
name_zh: Towns协议
description: >-
description_zh: >-
  构建 Towns Protocol Bot 时使用 —— 涵盖 SDK 初始化、斜杠命令、消息处理器、表情反应、交互式表单、区块链操作及部署。
  触发词：“towns bot”、“makeTownsBot”、“onSlashCommand”、“onMessage”、“sendInteractionRequest”、“webhook”、“bot deployment”、“@towns-protocol/bot”
license: MIT
compatibility: 需 Bun 运行时、Base 网络 RPC 访问权限、@towns-protocol/bot SDK
metadata:
  author: towns-protocol
  version: "2.0.0"
---
# Towns Protocol Bot SDK 参考文档

## 关键规则

**必须遵守以下规则 —— 违反将导致静默失败：**

1. **用户 ID 为以太坊地址** —— 始终采用 `0x...` 格式，绝不可使用用户名  
2. **提及（mentions）需同时满足两项要求** —— 文本中需含 `<@{userId}>` 格式，且 options 中需提供 `mentions` 数组  
3. **双钱包架构**：  
   - `bot.viem.account.address` = Gas 钱包（用于签名并支付手续费）—— **必须充值 Base ETH**  
   - `bot.appAddress` = 国库钱包（可选，用于资金转账）  
4. **斜杠命令不会触发 onMessage** —— 二者为互斥的处理器  
5. **交互式表单使用 `type` 属性** —— 非 `case`（例如：`type: 'form'`）  
6. **切勿仅凭 txHash 授予访问权限** —— 在授予权限时，务必先验证 `receipt.status === 'success'`  

## 快速参考

### 关键导入语句

```typescript
import { makeTownsBot, getSmartAccountFromUserId } from '@towns-protocol/bot'
import type { BotCommand, BotHandler } from '@towns-protocol/bot'
import { Permission } from '@towns-protocol/web3'
import { parseEther, formatEther, erc20Abi, zeroAddress } from 'viem'
import { readContract, waitForTransactionReceipt } from 'viem/actions'
import { execute } from 'viem/experimental/erc7821'
```

### 处理器方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `sendMessage` | `(channelId, text, opts?) → { eventId }` | opts：`{ threadId?, replyId?, mentions?, attachments? }` |
| `editMessage` | `(channelId, eventId, text)` | 仅处理 Bot 自身发送的消息 |
| `removeEvent` | `(channelId, eventId)` | 仅处理 Bot 自身发送的消息 |
| `sendReaction` | `(channelId, messageId, emoji)` | |
| `sendInteractionRequest` | `(channelId, payload)` | 用于表单、交易、签名等交互场景 |
| `hasAdminPermission` | `(userId, spaceId) → boolean` | |
| `ban` / `unban` | `(userId, spaceId)` | 需具备 ModifyBanning 权限 |

### Bot 属性

| 属性 | 描述 |
|------|------|
| `bot.viem` | 用于区块链操作的 Viem 客户端 |
| `bot.viem.account.address` | Gas 钱包 —— **必须充值 Base ETH** |
| `bot.appAddress` | 国库钱包（可选） |
| `bot.botId` | Bot 标识符 |

**详细指南请参阅 [references/](references/)：**  
- [消息 API](references/MESSAGING.md) —— 提及、线程、附件、格式化  
- [区块链操作](references/BLOCKCHAIN.md) —— 合约读写、交易验证  
- [交互式组件](references/INTERACTIVE.md) —— 表单、交易请求  
- [部署](references/DEPLOYMENT.md) —— 本地开发、Render、隧道配置  
- [调试](references/DEBUGGING.md) —— 故障排除指南  

---

## Bot 初始化

### 项目初始化

```bash
bunx towns-bot init my-bot
cd my-bot
bun install
```

### 环境变量

```bash
APP_PRIVATE_DATA=<base64_credentials>   # From app.towns.com/developer
JWT_SECRET=<webhook_secret>              # Min 32 chars
PORT=3000
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/KEY  # Recommended
```

### 基础 Bot 模板

```typescript
import { makeTownsBot } from '@towns-protocol/bot'
import type { BotCommand } from '@towns-protocol/bot'

const commands = [
  { name: 'help', description: 'Show help' },
  { name: 'ping', description: 'Check if alive' }
] as const satisfies BotCommand[]

const bot = await makeTownsBot(
  process.env.APP_PRIVATE_DATA!,
  process.env.JWT_SECRET!,
  { commands }
)

bot.onSlashCommand('ping', async (handler, event) => {
  const latency = Date.now() - event.createdAt.getTime()
  await handler.sendMessage(event.channelId, 'Pong! ' + latency + 'ms')
})

export default bot.start()
```

### 配置校验

```typescript
import { z } from 'zod'

const EnvSchema = z.object({
  APP_PRIVATE_DATA: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url().optional()
})

const env = EnvSchema.safeParse(process.env)
if (!env.success) {
  console.error('Invalid config:', env.error.issues)
  process.exit(1)
}
```

---

## 事件处理器

### onMessage

在普通消息（非斜杠命令）时触发。

```typescript
bot.onMessage(async (handler, event) => {
  // event: { userId, spaceId, channelId, eventId, message, isMentioned, threadId?, replyId? }

  if (event.isMentioned) {
    await handler.sendMessage(event.channelId, 'You mentioned me!')
  }
})
```

### onSlashCommand

在 `/command` 时触发。**不会**触发 onMessage。

```typescript
bot.onSlashCommand('weather', async (handler, { args, channelId }) => {
  // /weather San Francisco → args: ['San', 'Francisco']
  const location = args.join(' ')
  if (!location) {
    await handler.sendMessage(channelId, 'Usage: /weather <location>')
    return
  }
  // ... fetch weather
})
```

### onReaction

```typescript
bot.onReaction(async (handler, event) => {
  // event: { reaction, messageId, channelId }
  if (event.reaction === '👋') {
    await handler.sendMessage(event.channelId, 'I saw your wave!')
  }
})
```

### onTip

需在开发者门户中启用“全部消息”模式。

```typescript
bot.onTip(async (handler, event) => {
  // event: { senderAddress, receiverAddress, amount (bigint), currency }
  if (event.receiverAddress === bot.appAddress) {
    await handler.sendMessage(event.channelId,
      'Thanks for ' + formatEther(event.amount) + ' ETH!')
  }
})
```

### onInteractionResponse

```typescript
bot.onInteractionResponse(async (handler, event) => {
  switch (event.response.payload.content?.case) {
    case 'form':
      const form = event.response.payload.content.value
      for (const c of form.components) {
        if (c.component.case === 'button' && c.id === 'yes') {
          await handler.sendMessage(event.channelId, 'You clicked Yes!')
        }
      }
      break
    case 'transaction':
      const tx = event.response.payload.content.value
      if (tx.txHash) {
        // IMPORTANT: Verify on-chain before granting access
        // See references/BLOCKCHAIN.md for full verification pattern
        await handler.sendMessage(event.channelId,
          'TX: https://basescan.org/tx/' + tx.txHash)
      }
      break
  }
})
```

### 事件上下文校验

使用前务必校验上下文：

```typescript
bot.onSlashCommand('cmd', async (handler, event) => {
  if (!event.spaceId || !event.channelId) {
    console.error('Missing context:', { userId: event.userId })
    return
  }
  // Safe to proceed
})
```

---

## 常见错误

| 错误 | 修复方法 |
|------|----------|
| `insufficient funds for gas` | 为 `bot.viem.account.address` 充值 Base ETH |
| 提及未高亮显示 | 文本中需含 `<@userId>`，且 options 中需提供 `mentions` 数组 |
| 斜杠命令不生效 | 将其加入 makeTownsBot 的 `commands` 数组中 |
| 处理器未触发 | 检查开发者门户中的消息转发模式 |
| `writeContract` 失败 | 对外部合约请使用 `execute()` |
| 仅凭 txHash 授予访问权限 | 首先验证 `receipt.status === 'success'` |
| 消息行重叠 | 使用 `\n\n`（双换行），而非 `\n` |
| 缺失事件上下文 | 使用前请校验 `spaceId` / `channelId` |

---

## 资源

- **开发者门户**：https://app.towns.com/developer  
- **文档**：https://docs.towns.com/build/bots  
- **SDK**：https://www.npmjs.com/package/@towns-protocol/bot  
- **链 ID**：8453（Base 主网）  