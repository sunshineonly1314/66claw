---
name: solana
name_zh: Solana 技能
description: Solana wallet operations - create wallets, check balances, send SOL/tokens, swap via Jupiter, launch tokens on Pump.fun
description_zh: Solana wallet operations - create wallets, check balances, send SOL/tokens, swap via Jupiter, launch tokens on Pump.fun
triggers:
  - solana
  - wallet
  - sol balance
  - send sol
  - send token
  - swap
  - jupiter
  - pumpfun
  - pump.fun
  - launch token
metadata:
  clawdbot:
    emoji: "◎"
    requires:
      env:
        - SOLANA_PRIVATE_KEY
        - JUPITER_API_KEY
    primaryEnv: SOLANA_PRIVATE_KEY
---
# Solana 钱包 ◎

面向 AI agents 的 Solana 钱包管理与代币操作工具。

## 配置

```bash
pip install -r requirements.txt
```

## 初始化钱包

首先，新建一个钱包，并将私钥保存至您的 `.env` 文件中：

```bash
python3 {baseDir}/scripts/initialize.py
```

该操作将：
- 生成新的 Solana 密钥对  
- 显示公钥（即钱包地址）  
- 以 base58 格式将私钥保存至 `.env`，键名为 `SOLANA_PRIVATE_KEY`  

**重要提示**：运行 initialize.py 后，请将私钥导出至您的环境变量：  
```bash
export SOLANA_PRIVATE_KEY=$(grep SOLANA_PRIVATE_KEY .env | cut -d '=' -f2)
```  

或加载 .env 文件：  
```bash
source .env
```  

## 钱包操作

### 查询 SOL 余额  
```bash
python3 {baseDir}/scripts/wallet.py balance
python3 {baseDir}/scripts/wallet.py balance <wallet_address>
```  

### 查询代币余额  
```bash
python3 {baseDir}/scripts/wallet.py token-balance <token_mint_address>
python3 {baseDir}/scripts/wallet.py token-balance <token_mint_address> --owner <wallet_address>
```  

### 发送 SOL  
```bash
python3 {baseDir}/scripts/wallet.py send <recipient_address> <amount_in_sol>
```  

### 发送 SPL 代币  
```bash
python3 {baseDir}/scripts/wallet.py send-token <token_mint_address> <recipient_address> <amount>
```  

### 获取钱包地址  
```bash
python3 {baseDir}/scripts/wallet.py address
```  

## Jupiter 代币兑换

### 获取兑换报价  
```bash
python3 {baseDir}/scripts/jup_swap.py quote <input_token> <output_token> <amount>
python3 {baseDir}/scripts/jup_swap.py quote SOL USDC 1
```  

### 执行兑换  
```bash
python3 {baseDir}/scripts/jup_swap.py swap <input_token> <output_token> <amount>
python3 {baseDir}/scripts/jup_swap.py swap SOL USDC 0.1
```  

### 列出已知代币  
```bash
python3 {baseDir}/scripts/jup_swap.py tokens
```  

代币符号：SOL、USDC、USDT、BONK、JUP、RAY、PYTH（也可使用完整 mint 地址）

## Pump.fun 代币发行

### 发行代币  
```bash
python3 {baseDir}/scripts/pumpfun.py launch --name "Token Name" --symbol "TKN" --image ./logo.png
```  

### 发行并执行开发者买入（Dev Buy）  
```bash
python3 {baseDir}/scripts/pumpfun.py launch --name "Token Name" --symbol "TKN" --image ./logo.png --buy 0.5
```  

### 使用自定义 mint（个性化地址）发行  
```bash
python3 {baseDir}/scripts/pumpfun.py launch --name "Token Name" --symbol "TKN" --image ./logo.png --mint-key <base58_key>
```  

建议使用以 'pump' 结尾的个性化地址，使代币更具可信度。生成方法如下：  
```bash
solana-keygen grind --ends-with pump:1
```  

### 选项说明  
- `--name` — 代币名称（必需）  
- `--symbol` — 代币符号（必需）  
- `--image` — 代币图片路径（必需）  
- `--description` 或 `-d` — 代币描述  
- `--buy` 或 `-b` — 开发者买入金额（以 SOL 计）  
- `--mint-key` 或 `-m` — 自定义 mint 私钥（base58 格式）  

## 网络配置

默认钱包操作运行于 **主网（mainnet）**。使用 `--network` 可切换网络：

```bash
python3 {baseDir}/scripts/wallet.py balance --network devnet
python3 {baseDir}/scripts/wallet.py balance --network testnet
```

## 环境变量

| 变量 | 描述 |
|------|------|
| `SOLANA_PRIVATE_KEY` | base58 编码的私钥（必需） |
| `JUPITER_API_KEY` | Jupiter API 密钥（用于兑换，必需） |
| `SOLANA_RPC_URL` | 自定义 RPC 端点（可选） |

## 示例

```bash
# Initialize new wallet
python3 {baseDir}/scripts/initialize.py

# Check your SOL balance
python3 {baseDir}/scripts/wallet.py balance

# Send 0.1 SOL to another wallet
python3 {baseDir}/scripts/wallet.py send 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU 0.1

# Check USDC balance (mainnet USDC mint)
python3 {baseDir}/scripts/wallet.py token-balance EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Send 10 USDC to another wallet
python3 {baseDir}/scripts/wallet.py send-token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU 10

# Quote swap: 1 SOL to USDC
python3 {baseDir}/scripts/jup_swap.py quote SOL USDC 1

# Swap 0.5 SOL to USDC
python3 {baseDir}/scripts/jup_swap.py swap SOL USDC 0.5

# Launch token on Pump.fun
python3 {baseDir}/scripts/pumpfun.py launch --name "My Token" --symbol "MTK" --image ./logo.png

# Launch with dev buy
python3 {baseDir}/scripts/pumpfun.py launch --name "My Token" --symbol "MTK" --image ./logo.png --buy 1
```

## 常见代币 Mint 地址（主网）

| 代币 | Mint 地址 |
|------|-----------|
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` |

## 适用场景

- **创建钱包**：为新 Solana 账户生成钱包  
- **查询余额**：查询 SOL 或任意 SPL 代币余额  
- **发送 SOL**：用于支付或转账  
- **发送代币**：进行 SPL 代币转账  
- **代币兑换**：通过 Jupiter 聚合器兑换代币  
- **发行代币**：在 Pump.fun 上发布带自定义图片及开发者买入的代币  
- **开发网测试**：使用 `--network devnet` 进行 devnet 测试  