---
name: solana-trader-v2
description: 通过 Jupiter 聚合器进行 Solana 钱包管理与代币交易。查询余额、查看交易历史、兑换代币，并管理您的 Solana 投资组合。  
metadata: {"clawdbot":{"emoji":"🚀","requires":{"bins":["solana","spl-token","curl","jq"],"env":["SOLANA_KEYPAIR_PATH"]}}}  
---

# Solana Trader 🚀

Clawdbot 的一款功能完备的 Solana 钱包管理与交易技能。可管理您的 Solana 投资组合、查询余额、查看交易历史，并借助 Jupiter DEX 聚合器兑换代币。

## 环境变量

| 变量 | 描述 | 是否必需 |
|----------|-------------|----------|
| `SOLANA_KEYPAIR_PATH` | 钱包密钥对 JSON 文件路径 | 是 |
| `SOLANA_RPC_URL` | 自定义 RPC 端点（默认：mainnet-beta） | 否 |
| `JUPITER_API_KEY` | Jupiter API 密钥（用于身份认证请求） | 否 |
| `HELIUS_API_KEY` | Helius API 密钥（用于增强型交易数据） | 否 |
| `SHYFT_API_KEY` | Shyft API 密钥（用于交易历史查询） | 否 |
| `QUICKNODE_RPC_URL` | QuickNode RPC 端点 | 否 |
| `ALCHEMY_RPC_URL` | Alchemy Solana RPC 端点 | 否 |

## 🌐 免费公共 RPC 端点（无需 API 密钥）

| 提供方 | 端点 | 备注 |
|----------|----------|-------|
| Solana 基金会 | `https://api.mainnet-beta.solana.com` | 官方端点，存在速率限制 |
| PublicNode | `https://solana-rpc.publicnode.com` | 注重隐私，响应迅速 |
| Ankr | `https://rpc.ankr.com/solana` | 免费公共端点 |
| Project Serum | `https://solana-api.projectserum.com` | 社区维护 |

> ⚠️ **Rate Limits**: Public endpoints typically limit to ~100 requests/10 seconds. For production or high-frequency trading, use a paid RPC provider.

### RPC 选择策略

**默认行为（未配置任何 API 密钥时）：**  
1. 若已设置 `SOLANA_RPC_URL`，则优先尝试该端点  
2. 否则按顺序回退至以下免费公共端点：  
   - `https://api.mainnet-beta.solana.com`  
   - `https://solana-rpc.publicnode.com`  
   - `https://rpc.ankr.com/solana`  

**建议升级至付费 RPC 的场景：**  
- 出现速率限制错误（HTTP 429 Too Many Requests）  
- 高频交易或 MEV 相关操作  
- 需要增强型交易数据（例如 Helius 提供的服务）  
- 对可用性要求极高的生产环境应用（需保障 99.9% 正常运行时间）  
- 需使用 WebSocket 订阅以获取实时更新  

**若遭遇速率限制**，请向用户询问：“是否需要配置付费 RPC 服务提供商？可选方案：Helius、QuickNode、Alchemy、Shyft”

## 💎 推荐奖励费配置

本技能在每次代币兑换操作中收取小额平台费用（0.2%），用于支持项目持续开发。该费用将在每次兑换前向用户明确披露。

| 变量 | 值 | 描述 |
|----------|-------|-------------|
| `PLATFORM_FEE_BPS` | 20 | 平台费用为 0.2%（即 20 个基点） |
| `FEE_ACCOUNT` | `8KDDpruBwpTzJLKEcfv8JefKSVYWYE53FV3B2iLD6bNN` | 接收费用的 Solana 钱包地址 |

**费用分配明细：**  
- 用户支付：兑换输出金额的 0.2%  
- 开发者获得：费用总额的 97.5%（即 0.195%）  
- Jupiter 获得：费用总额的 2.5%（即 0.005%）  

**示例**：当兑换输出为 100 USDC 时：  
- 总费用：0.20 USDC  
- 您获得：约 0.195 USDC  
- Jupiter 获得：约 0.005 USDC  

## 初始化验证

```bash
# Check wallet address
solana address --keypair "$SOLANA_KEYPAIR_PATH"

# Check Solana CLI config
solana config get

# Test RPC connection
solana cluster-version
```

### 导入私钥

若您仅持有私钥（base58 字符串或字节数组），请先将其转换为密钥对 JSON 格式：

**从 Base58 私钥转换：**  
```bash
# Install solana-keygen if needed
# Your private key looks like: 5K1gR...xyz (base58 string)

echo "Enter your base58 private key:"
read -s PRIVATE_KEY

# Convert to keypair JSON (requires Node.js)
node -e "
const bs58 = require('bs58');
const key = bs58.decode('$PRIVATE_KEY');
console.log(JSON.stringify(Array.from(key)));
" > ~/.config/solana/imported-wallet.json

export SOLANA_KEYPAIR_PATH=~/.config/solana/imported-wallet.json
```

**从字节数组导入（例如 Phantom 导出格式）：**  
```bash
# If you have a byte array like [12,34,56,...]
echo '[12,34,56,78,...]' > ~/.config/solana/imported-wallet.json
export SOLANA_KEYPAIR_PATH=~/.config/solana/imported-wallet.json
```

**从助记词（种子短语）导入：**  
```bash
# Use solana-keygen to recover
solana-keygen recover -o ~/.config/solana/recovered-wallet.json
# Enter your 12/24 word seed phrase when prompted

export SOLANA_KEYPAIR_PATH=~/.config/solana/recovered-wallet.json
```

> ⚠️ **Security**: Never share your private key or seed phrase. Store keypair files with restricted permissions: `chmod 600 ~/.config/solana/*.json`

---

## 💰 余额查询命令

### 查询 SOL 余额

```bash
solana balance --keypair "$SOLANA_KEYPAIR_PATH"
```

### 列出全部代币账户

```bash
spl-token accounts --owner $(solana address --keypair "$SOLANA_KEYPAIR_PATH")
```

### 查询指定代币余额

```bash
# Replace <MINT_ADDRESS> with token mint
spl-token balance <MINT_ADDRESS> --owner $(solana address --keypair "$SOLANA_KEYPAIR_PATH")
```

### 获取投资组合概览

```bash
# Get wallet address
WALLET=$(solana address --keypair "$SOLANA_KEYPAIR_PATH")

# Get SOL balance
SOL_BALANCE=$(solana balance --keypair "$SOLANA_KEYPAIR_PATH" | awk '{print $1}')

# Get all token accounts
spl-token accounts --owner $WALLET
```

---

## 📜 交易历史

### 查看近期交易

支持多种 RPC 提供商。默认使用原生 Solana RPC（无需 API 密钥）。

**选项 1：Solana RPC（默认，无需 API 密钥）**  
```bash
WALLET=$(solana address --keypair "$SOLANA_KEYPAIR_PATH")
RPC_URL="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"

curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getSignaturesForAddress\",\"params\":[\"$WALLET\",{\"limit\":10}]}" | jq '.result[] | {signature: .signature, slot: .slot, blockTime: .blockTime}'
```

**选项 2：Helius（提供增强型数据，推荐用于详细交易历史）**  
```bash
WALLET=$(solana address --keypair "$SOLANA_KEYPAIR_PATH")

curl -s "https://api.helius.xyz/v0/addresses/${WALLET}/transactions?api-key=${HELIUS_API_KEY:-demo}&limit=10" | jq '.[] | {signature: .signature, type: .type, timestamp: .timestamp, fee: .fee}'
```

**选项 3：Shyft（提供免费额度）**  
```bash
WALLET=$(solana address --keypair "$SOLANA_KEYPAIR_PATH")

curl -s "https://api.shyft.to/sol/v1/transaction/history?network=mainnet-beta&account=${WALLET}&tx_num=10" \
  -H "x-api-key: ${SHYFT_API_KEY}" | jq '.result.transactions'
```

**选项 4：QuickNode**  
```bash
WALLET=$(solana address --keypair "$SOLANA_KEYPAIR_PATH")

curl -s -X POST "$QUICKNODE_RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getSignaturesForAddress\",\"params\":[\"$WALLET\",{\"limit\":10}]}" | jq '.result'
```

**选项 5：Alchemy**  
```bash
WALLET=$(solana address --keypair "$SOLANA_KEYPAIR_PATH")

curl -s -X POST "$ALCHEMY_RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getSignaturesForAddress\",\"params\":[\"$WALLET\",{\"limit\":10}]}" | jq '.result[] | {signature: .signature, slot: .slot, blockTime: .blockTime}'
```

> 💡 **Provider Selection**: AI will auto-detect available API keys and use the best provider. If no keys configured, defaults to native Solana RPC.

### 查看交易详情

```bash
# Replace <SIGNATURE> with transaction signature
solana confirm -v <SIGNATURE>

# Or via RPC for more details
RPC_URL="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getTransaction\",\"params\":[\"<SIGNATURE>\",{\"encoding\":\"jsonParsed\",\"maxSupportedTransactionVersion\":0}]}" | jq '.result'
```

---

## 🪙 常用代币地址

| 代币 | 符号 | Mint 地址 | 小数位数 |
|-------|--------|--------------|----------|
| 封装 SOL | SOL | So11111111111111111111111111111111111111112 | 9 |
| USD Coin | USDC | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v | 6 |
| Tether | USDT | Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB | 6 |
| Bonk | BONK | DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 | 5 |
| Jupiter | JUP | JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN | 6 |
| Raydium | RAY | 4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R | 6 |
| Pyth | PYTH | HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3 | 6 |
| Jito | JTO | jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL | 9 |

---

## 🔄 通过 Jupiter 进行代币兑换

**⚠️ 关键提示：执行任何兑换操作前，必须向用户完整展示兑换详情，并等待其明确确认。**

### 第一步：获取兑换报价

将人类可读的数量转换为原始单位：  
- SOL：乘以 1,000,000,000（10⁹）  
- USDC / USDT / JUP：乘以 1,000,000（10⁶）  
- BONK：乘以 100,000（10⁵）  

```bash
# Example: Quote for swapping 1 SOL to USDC
INPUT_MINT="So11111111111111111111111111111111111111112"
OUTPUT_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
AMOUNT="1000000000"  # 1 SOL in lamports
SLIPPAGE_BPS="50"    # 0.5% slippage
PLATFORM_FEE_BPS="20"  # 0.2% platform fee

# Get quote with platform fee
QUOTE=$(curl -s "https://api.jup.ag/swap/v1/quote?inputMint=${INPUT_MINT}&outputMint=${OUTPUT_MINT}&amount=${AMOUNT}&slippageBps=${SLIPPAGE_BPS}&platformFeeBps=${PLATFORM_FEE_BPS}")

echo "$QUOTE" | jq '{
  inputAmount: .inAmount,
  outputAmount: .outAmount,
  priceImpact: .priceImpactPct,
  minimumReceived: .otherAmountThreshold,
  platformFee: .platformFee
}'
```

### 第二步：展示报价并请求用户确认

解析后向用户展示以下信息：  
- 输入：数量及代币名称  
- 输出：预期获得数量及代币名称  
- 价格影响百分比  
- 滑点容忍度  
- 最低可获数量  
- **平台费用：0.2%（用于支持本技能开发）**  

**重要提示**：务必向用户提问“是否确认执行本次兑换？”，并仅在收到明确肯定答复（如“是”、“继续”、“确认”等）后才继续执行。

**展示格式示例：**  
```
📊 Swap Preview:
├─ From: 1.0 SOL
├─ To: ~150.25 USDC (estimated)
├─ Price Impact: 0.01%
├─ Slippage: 0.5%
├─ Minimum Received: 149.50 USDC
├─ Platform Fee: 0.2% (~0.30 USDC)
└─ Network Fee: ~0.000005 SOL

⚠️ Confirm swap? (yes/no)
```

### 第三步：构建兑换交易

用户确认后：

```bash
USER_PUBKEY=$(solana address --keypair "$SOLANA_KEYPAIR_PATH")

# Fee account for referral rewards
FEE_ACCOUNT="8KDDpruBwpTzJLKEcfv8JefKSVYWYE53FV3B2iLD6bNN"

# Save quote to file
echo "$QUOTE" > /tmp/jupiter_quote.json

# Request swap transaction with fee account
SWAP_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  "https://api.jup.ag/swap/v1/swap" \
  -d "{
    \"quoteResponse\": $(cat /tmp/jupiter_quote.json),
    \"userPublicKey\": \"${USER_PUBKEY}\",
    \"feeAccount\": \"${FEE_ACCOUNT}\",
    \"dynamicComputeUnitLimit\": true,
    \"prioritizationFeeLamports\": {
      \"priorityLevelWithMaxLamports\": {
        \"maxLamports\": 5000000,
        \"priorityLevel\": \"high\"
      }
    }
  }")

# Extract transaction
SWAP_TX=$(echo "$SWAP_RESPONSE" | jq -r '.swapTransaction')
```

> 💡 **Note**: The `feeAccount` receives the platform fee in the output token. Make sure you have token accounts for common tokens (USDC, USDT, etc.) to receive fees.

### 第四步：签名并提交交易

```bash
# Decode base64 transaction
echo "$SWAP_TX" | base64 -d > /tmp/swap_tx.bin

# Sign with keypair (requires solana-cli)
solana transfer --from "$SOLANA_KEYPAIR_PATH" \
  --blockhash $(solana block-height) \
  --sign-only \
  /tmp/swap_tx.bin

# Or use the raw transaction submission
curl -s -X POST "https://api.mainnet-beta.solana.com" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"sendTransaction\",
    \"params\": [\"${SWAP_TX}\", {\"encoding\": \"base64\"}]
  }"
```

---

## 💸 发送代币

### 发送 SOL

```bash
# ALWAYS confirm with user before sending!
RECIPIENT="<RECIPIENT_ADDRESS>"
AMOUNT="0.1"  # SOL amount

# Display and confirm
echo "Sending ${AMOUNT} SOL to ${RECIPIENT}"
echo "Confirm? (yes/no)"

# After confirmation:
solana transfer --keypair "$SOLANA_KEYPAIR_PATH" "$RECIPIENT" "$AMOUNT"
```

### 发送 SPL 代币

```bash
# ALWAYS confirm with user before sending!
RECIPIENT="<RECIPIENT_ADDRESS>"
TOKEN_MINT="<TOKEN_MINT_ADDRESS>"
AMOUNT="100"  # Token amount

# Display and confirm
echo "Sending ${AMOUNT} tokens (${TOKEN_MINT}) to ${RECIPIENT}"
echo "Confirm? (yes/no)"

# After confirmation:
spl-token transfer --keypair "$SOLANA_KEYPAIR_PATH" "$TOKEN_MINT" "$AMOUNT" "$RECIPIENT"
```

---

## 📊 价格查询

### 从 Jupiter 获取代币价格

```bash
# Get SOL price in USDC
curl -s "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112" | jq '.data.So11111111111111111111111111111111111111112.price'

# Get multiple token prices
curl -s "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112,JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" | jq '.data'
```

### 获取代币信息

```bash
# Search token by symbol or name
curl -s "https://tokens.jup.ag/token/<MINT_ADDRESS>" | jq '{name: .name, symbol: .symbol, decimals: .decimals}'
```

---

## 🛡️ 安全规则

1. **始终**向用户展示交易详情，并在执行前等待其明确确认  
2. **绝不**在未经用户明确批准的情况下自动执行兑换或转账  
3. **始终**在发起交易前检查账户余额  
4. 若价格影响超过 1%，**必须**向用户发出警告  
5. 若滑点设置高于 1%（即 100 个基点），**必须**向用户发出警告  
6. **绝不**记录、显示或传输私钥内容  
7. 交易执行完成后，**始终**向用户展示交易签名及区块链浏览器链接  

---

## ⚠️ 错误处理

| 错误 | 原因 | 解决方案 |
|-------|-------|----------|
| “余额不足” | 代币余额不足 | 查询余额，减少发送/兑换数量 |
| “超出滑点容忍范围” | 兑换过程中市场价格变动 | 获取最新报价，适当提高滑点容忍值 |
| “交易已过期” | 区块哈希（blockhash）已失效 | 获取最新报价并重试 |
| “账户未找到” | 缺少对应代币账户 | 系统将自动为您创建 |
| “未找到兑换路径” | 当前缺乏流动性 | 尝试减小兑换数量，或更换交易对 |

### 重试逻辑

若交易失败：  
1. 等待 2–3 秒  
2. 获取最新报价（价格可能已变动）  
3. 向用户重新展示新报价并再次确认  
4. 重试交易  

---

## 📝 示例交互

### 查询余额  
```
User: "What's my SOL balance?"
→ Run: solana balance --keypair "$SOLANA_KEYPAIR_PATH"
→ Report: "Your wallet has X.XXX SOL"
```

### 兑换代币  
```
User: "Swap 0.5 SOL for USDC"
→ Get Jupiter quote for 0.5 SOL → USDC (with platformFeeBps=20)
→ Display:
   "📊 Swap Preview:
    ├─ From: 0.5 SOL
    ├─ To: ~75.50 USDC (estimated)
    ├─ Price Impact: 0.01%
    ├─ Minimum Received: 75.12 USDC
    ├─ Platform Fee: 0.2% (~0.15 USDC)
    └─ Network Fee: ~0.000005 SOL
    
    Confirm swap? (yes/no)"
→ Wait for "yes"
→ Execute swap with feeAccount
→ Report: "✅ Swap successful! TX: https://solscan.io/tx/..."
```

### 发送代币  
```
User: "Send 10 USDC to ABC123..."
→ Display:
   "Transfer Preview:
    - Amount: 10 USDC
    - To: ABC123...
    - Network Fee: ~0.000005 SOL
    
    Confirm transfer? (yes/no)"
→ Wait for "yes"
→ Execute transfer
→ Report: "✅ Transfer successful! TX: https://solscan.io/tx/..."
```

---

## 🔗 实用链接

- [Solscan 浏览器](https://solscan.io/)  
- [Jupiter 聚合器](https://jup.ag/)  
- [Solana 官方文档](https://docs.solana.com/)  
- [SPL 代币文档](https://spl.solana.com/token)