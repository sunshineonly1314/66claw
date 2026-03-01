---
name: solana-swaps
name_zh: Solana 交易
description: 通过 Jupiter 聚合器在 Solana 上兑换代币，并检查钱包余额。当用户希望兑换代币、查询 SOL/代币余额或获取兑换报价时使用。
description_zh: 通过 Jupiter 聚合器在 Solana 上兑换代币，并检查钱包余额。当用户希望兑换代币、查询 SOL/代币余额或获取兑换报价时使用。
metadata: {"clawdbot":{"emoji":"💰","requires":{"bins":["solana","spl-token","curl","jq","node"],"env":["SOLANA_KEYPAIR_PATH"]}}}
---
# Solana 兑换（Swaps）

管理您的 Solana 钱包：使用 Jupiter 聚合器查询余额并兑换代币。

## 环境变量

以下环境变量已预先配置，可直接使用：

| 变量 | 描述 |
|----------|-------------|
| `SOLANA_KEYPAIR_PATH` | 钱包密钥对 JSON 文件路径 |
| `JUPITER_API_KEY` | Jupiter API 密钥，用于身份验证请求（可避免平台费用；兑换 Token2022/pump.fun 代币时必需） |

**注意**：这些变量已在 skill 配置中设置完毕。您只需在命令中直接使用 `$SOLANA_KEYPAIR_PATH` 和 `$JUPITER_API_KEY` 即可。

### 验证设置

```bash
# Check wallet address
solana address --keypair "$SOLANA_KEYPAIR_PATH"

# Check Solana CLI config
solana config get
```

## 余额查询

### 查询 SOL 余额

```bash
solana balance --keypair "$SOLANA_KEYPAIR_PATH"
```

### 列出全部代币账户

```bash
spl-token accounts --owner $(solana address --keypair "$SOLANA_KEYPAIR_PATH")
```

### 查询特定代币余额

```bash
spl-token balance <TOKEN_MINT_ADDRESS> --owner $(solana address --keypair "$SOLANA_KEYPAIR_PATH")
```

## 常见代币 Mint 地址

| 代币 | 符号 | Mint 地址 | 小数位数 |
|-------|--------|-------------|----------|
| 封装 SOL（Wrapped SOL） | SOL | So11111111111111111111111111111111111111112 | 9 |
| USD Coin | USDC | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v | 6 |
| Tether | USDT | Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB | 6 |
| Bonk | BONK | DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 | 5 |
| Jupiter | JUP | JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN | 6 |
| Raydium | RAY | 4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R | 6 |

## 通过 Jupiter 进行代币兑换

**关键提示：执行任何兑换前，必须向用户展示完整兑换详情，并等待其明确确认。**

### 第一步：获取报价（Quote）

将人类可读的数量转换为原始单位：
- SOL：乘以 1,000,000,000（10⁹）
- USDC/USDT：乘以 1,000,000（10⁶）
- BONK：乘以 100,000（10⁵）

```bash
# Example: Get quote for swapping 1 SOL to USDC
INPUT_MINT="So11111111111111111111111111111111111111112"
OUTPUT_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
AMOUNT="1000000000"  # 1 SOL in lamports
SLIPPAGE_BPS="50"    # 0.5% slippage

# Get quote with API key authentication
curl -s -H "x-api-key: $JUPITER_API_KEY" \
  "https://api.jup.ag/swap/v1/quote?inputMint=${INPUT_MINT}&outputMint=${OUTPUT_MINT}&amount=${AMOUNT}&slippageBps=${SLIPPAGE_BPS}" | jq .
```

### 第二步：展示报价并请求确认

解析报价响应并呈现给用户：
- 输入：数量及代币名称
- 输出：预期获得数量及代币名称
- 价格影响百分比（Price impact percentage）
- 滑点容忍度（Slippage tolerance）
- 最低到账数量（otherAmountThreshold）

**重要**：须向用户提问：“您是否要执行此次兑换？”，并严格等待其明确答复（如 “yes”、“proceed” 或 “confirm”），方可继续。

### 第三步：构建兑换交易

用户确认后，请求生成兑换交易：

```bash
USER_PUBKEY=$(solana address --keypair "$SOLANA_KEYPAIR_PATH")

# Save quote response to file
QUOTE_FILE="/tmp/jupiter_quote.json"
curl -s -H "x-api-key: $JUPITER_API_KEY" \
  "https://api.jup.ag/swap/v1/quote?inputMint=${INPUT_MINT}&outputMint=${OUTPUT_MINT}&amount=${AMOUNT}&slippageBps=${SLIPPAGE_BPS}" > "$QUOTE_FILE"

# Request swap transaction
curl -s -X POST \
  -H "x-api-key: $JUPITER_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.jup.ag/swap/v1/swap" \
  -d "{
    \"quoteResponse\": $(cat $QUOTE_FILE),
    \"userPublicKey\": \"${USER_PUBKEY}\",
    \"dynamicComputeUnitLimit\": true,
    \"prioritizationFeeLamports\": {
      \"priorityLevelWithMaxLamports\": {
        \"maxLamports\": 5000000,
        \"priorityLevel\": \"high\"
      }
    }
  }" > /tmp/jupiter_swap.json

# Extract the swap transaction
SWAP_TX=$(cat /tmp/jupiter_swap.json | jq -r '.swapTransaction')
```

### 第四步：签名并提交交易

使用 `jupiter-swap.mjs` 脚本完成签名与提交：

```bash
node "$(dirname "$0")/scripts/jupiter-swap.mjs" \
  --keypair "$SOLANA_KEYPAIR_PATH" \
  --transaction "$SWAP_TX"
```

该脚本将输出交易签名（transaction signature）及对应的 Solscan 浏览链接。

## 安全规则

1. **始终**展示兑换详情，并在执行前**等待用户明确确认**
2. **绝不**在未经用户明确批准的情况下自动执行兑换
3. **始终**在尝试兑换前检查余额，确保资金充足
4. 若价格影响超过 1%，**必须**向用户发出警告
5. 若滑点设置高于 1%（即 100 bps），**必须**向用户发出警告
6. **绝不**记录、显示或传输私钥内容

## 错误处理

| 错误 | 原因 | 解决方案 |
|-------|-------|----------|
| “余额不足”（"Insufficient balance"） | 输入代币余额不足 | 查询余额，减少兑换数量 |
| “超出滑点容忍度”（"Slippage tolerance exceeded"） | 兑换过程中市场价格变动 | 获取最新报价；可考虑提高滑点设置 |
| “交易已过期”（"Transaction expired"） | Blockhash 过旧 | 立即获取最新报价并重试 |
| “账户未找到”（"Account not found"） | 缺少对应代币账户 | 代币账户将被自动创建 |
| “未找到路由”（"Route not found"） | 当前交易对无流动性 | 尝试减小兑换数量，或更换代币 |
| “平台费用不支持”（"Platform fee not supported"） | Token2022 类代币禁止平台收费 | 使用带 `$JUPITER_API_KEY` 请求头的身份验证 API |

### 重试逻辑

若因网络问题导致兑换失败：
1. 等待 2–3 秒
2. 获取最新报价（价格可能已变动）
3. 向用户重新展示新报价并再次确认
4. 重试兑换操作

## 示例交互

### 查询余额
用户：“我的 SOL 余额是多少？”  
1. 执行：`solana balance --keypair "$SOLANA_KEYPAIR_PATH"`  
2. 回复：“您的钱包当前有 X.XXX SOL”

### 兑换代币
用户：“把 0.5 SOL 兑换成 USDC”  
1. 获取钱包地址  
2. 向 Jupiter 请求 0.5 SOL（即 500,000,000 lamports）→ USDC 的报价  
3. 展示报价详情：  
   - 来源：0.5 SOL  
   - 目标：约 XX.XX USDC（预估）  
   - 价格影响：X.XX%  
   - 最低到账：XX.XX USDC  
4. 提问：“您是否要执行此次兑换？”  
5. 等待用户确认  
6. 若回复“yes”：执行兑换，并报告交易链接  
7. 若回复“no”：确认已取消操作  

### 列出全部代币
用户：“显示我所有的代币”  
1. 执行：`spl-token accounts --owner $(solana address --keypair "$SOLANA_KEYPAIR_PATH")`  
2. 格式化并展示含余额的代币列表