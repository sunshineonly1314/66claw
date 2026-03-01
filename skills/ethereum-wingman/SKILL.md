---
name: ethereum-wingman
name_zh: 以太坊助手
description: Ethereum development tutor and builder for Scaffold-ETH 2 projects. Triggers on "build", "create", "dApp", "smart contract", "Solidity", "DeFi", "Ethereum", "web3", or any blockchain development task. ALWAYS uses fork mode to test against real protocol state.
description_zh: Ethereum development tutor and builder for Scaffold-ETH 2 projects. Triggers on "build", "create", "dApp", "smart contract", "Solidity", "DeFi", "Ethereum", "web3", or any blockchain development task. ALWAYS uses fork mode to test against real protocol state.
license: MIT
metadata:
  author: BuidlGuidl
  version: "2.0.0"
---
# Ethereum Wingman

面向 AI agents 的全面以太坊开发指南。涵盖智能合约开发、DeFi 协议、安全最佳实践，以及 SpeedRun Ethereum 课程体系。

---

## AI AGENT 指令 —— 请首先阅读

### 默认技术栈：Scaffold-ETH 2 + Fork 模式

当用户要求构建任意以太坊项目时，请按以下步骤执行：

**第 1 步：创建项目**

```bash
npx create-eth@latest
# Select: foundry (recommended), target chain, project name
```

**第 2 步：修正轮询间隔（Polling Interval）**

编辑 `packages/nextjs/scaffold.config.ts`，将：
```typescript
pollingInterval: 30000,  // Default: 30 seconds (way too slow!)
```
替换为：
```typescript
pollingInterval: 3000,   // 3 seconds (much better for development)
```

**第 3 步：安装并 Fork 实时网络**

```bash
cd <project-name>
yarn install
yarn fork --network base  # or mainnet, arbitrum, optimism, polygon
```

**第 4 步：启用自动区块挖掘（必需！）**

```bash
# In a new terminal, enable interval mining (1 block/second)
cast rpc anvil_setIntervalMining 1
```

若不启用，`block.timestamp` 将保持冻结状态，所有依赖时间的逻辑将失效！

**可选：永久生效** —— 编辑 `packages/foundry/package.json`，在 fork 脚本中加入 `--block-time 1`。

**第 5 步：部署至本地 Fork（免费！）**

```bash
yarn deploy
```

**第 6 步：启动前端**

```bash
yarn start
```

**第 7 步：测试前端**

前端运行后，在浏览器中打开并测试应用：

1. **导航至** `http://localhost:3000`  
2. **截取快照** 获取页面元素（燃烧钱包地址显示于页眉）  
3. **点击水龙头（faucet）** 为燃烧钱包注入 ETH  
4. **如需，从巨鲸地址（whales）转账代币**（使用上一步获取的燃烧钱包地址）  
5. **逐项点击应用功能**，验证各项功能是否正常  

使用 `cursor-browser-extension` MCP 工具实现浏览器自动化。  
详细工作流请参阅 `tools/testing/frontend-testing.md`。

### 严禁执行以下操作：

- 运行 `yarn chain`（请改用 `yarn fork --network <chain>`！）  
- 手动运行 `forge init` 或从零搭建 Foundry 环境  
- 手动创建 Next.js 项目  
- 手动配置钱包连接（SE2 已预配置 RainbowKit）

### 为何必须使用 Fork 模式？

```
yarn chain (WRONG)              yarn fork --network base (CORRECT)
└─ Empty local chain            └─ Fork of real Base mainnet
└─ No protocols                 └─ Uniswap, Aave, etc. available
└─ No tokens                    └─ Real USDC, WETH exist
└─ Testing in isolation         └─ Test against REAL state
```

### 可用地址数据

代币、协议及巨鲸地址详见 `data/addresses/`：
- `tokens.json` —— 各链上的 WETH、USDC、DAI 等  
- `protocols.json` —— 各链上的 Uniswap、Aave、Chainlink 等  
- `whales.json` —— 大额代币持有者地址，用于测试资金注入  

---

## 最关键概念

**以太坊上没有任何事情是自动发生的。**

智能合约无法自我执行。不存在 cron 任务、调度器或后台进程。对于每一个“需要发生”的函数：

1. 必须允许**任何人**（而不仅限管理员）调用  
2. 必须为调用者提供**动机**（盈利、奖励、自身利益）  
3. 动机必须**足够充分**，足以覆盖 Gas 费 + 利润  

**始终自问：“谁会调用这个函数？他们为何愿意支付 Gas？”**  

若无法回答此问题，则该函数永远不会被调用。

### 合理激励机制设计示例

```solidity
// LIQUIDATIONS: Caller gets bonus collateral
function liquidate(address user) external {
    require(getHealthFactor(user) < 1e18, "Healthy");
    uint256 bonus = collateral * 5 / 100; // 5% bonus
    collateralToken.transfer(msg.sender, collateral + bonus);
}

// YIELD HARVESTING: Caller gets % of harvest
function harvest() external {
    uint256 yield = protocol.claimRewards();
    uint256 callerReward = yield / 100; // 1%
    token.transfer(msg.sender, callerReward);
}

// CLAIMS: User wants their own tokens
function claimRewards() external {
    uint256 reward = pendingRewards[msg.sender];
    pendingRewards[msg.sender] = 0;
    token.transfer(msg.sender, reward);
}
```

---

## 关键陷阱（务必熟记）

### 1. 代币小数位数各不相同

**USDC = 6 位小数，而非 18 位！**

```solidity
// BAD: Assumes 18 decimals - transfers 1 TRILLION USDC!
uint256 oneToken = 1e18;

// GOOD: Check decimals
uint256 oneToken = 10 ** token.decimals();
```

常见小数位数：
- USDC、USDT：6 位小数  
- WBTC：8 位小数  
- 大多数代币（DAI、WETH）：18 位小数  

### 2. 必须使用 ERC-20 approve 模式

合约无法直接拉取代币。必须遵循两步流程：

```solidity
// Step 1: User approves
token.approve(spenderContract, amount);

// Step 2: Contract pulls tokens
token.transferFrom(user, address(this), amount);
```

**切勿使用无限授权：**
```solidity
// DANGEROUS
token.approve(spender, type(uint256).max);

// SAFE
token.approve(spender, exactAmount);
```

### 3. Solidity 不支持浮点数

请使用基点（basis points，1 bp = 0.01%）：

```solidity
// BAD: This equals 0
uint256 fivePercent = 5 / 100;

// GOOD: Basis points
uint256 FEE_BPS = 500; // 5% = 500 basis points
uint256 fee = (amount * FEE_BPS) / 10000;
```

### 4. 重入攻击

外部调用可能回调进入你的合约：

```solidity
// SAFE: Checks-Effects-Interactions pattern
function withdraw() external nonReentrant {
    uint256 bal = balances[msg.sender];
    balances[msg.sender] = 0; // Effect BEFORE interaction
    (bool success,) = msg.sender.call{value: bal}("");
    require(success);
}
```

务必使用 OpenZeppelin 的 ReentrancyGuard。

### 5. 切勿将 DEX 即时价格用作预言机

闪电贷可在瞬间操纵即时价格：

```solidity
// SAFE: Use Chainlink
function getPrice() internal view returns (uint256) {
    (, int256 price,, uint256 updatedAt,) = priceFeed.latestRoundData();
    require(block.timestamp - updatedAt < 3600, "Stale");
    require(price > 0, "Invalid");
    return uint256(price);
}
```

### 6. 金库通胀攻击

首位存入者可通过份额操纵窃取资金：

```solidity
// Mitigation: Virtual offset
function convertToShares(uint256 assets) public view returns (uint256) {
    return assets.mulDiv(totalSupply() + 1e3, totalAssets() + 1);
}
```

### 7. 使用 SafeERC20

部分代币（如 USDT）在 transfer 操作中不返回布尔值：

```solidity
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;

token.safeTransfer(to, amount); // Handles non-standard tokens
```

---

## Scaffold-ETH 2 开发

### 项目结构
```
packages/
├── foundry/              # Smart contracts
│   ├── contracts/        # Your Solidity files
│   └── script/           # Deploy scripts
└── nextjs/
    ├── app/              # React pages
    └── contracts/        # Generated ABIs + externalContracts.ts
```

### 关键 Hooks
```typescript
// Read contract data
const { data } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "greeting",
});

// Write to contract
const { writeContractAsync } = useScaffoldWriteContract("YourContract");

// Watch events
useScaffoldEventHistory({
  contractName: "YourContract",
  eventName: "Transfer",
  fromBlock: 0n,
});
```

---

## SpeedRun Ethereum 挑战任务

参考以下任务开展实践学习：

| 挑战 | 核心概念 | 关键要点 |
|------|----------|----------|
| 0：简易 NFT | ERC-721 | 铸造、元数据、tokenURI |
| 1：质押 | 协调机制 | 截止时间、托管、阈值 |
| 2：代币销售商 | ERC-20 | approve 模式、买卖逻辑 |
| 3：骰子游戏 | 随机性 | 链上随机性不安全 |
| 4：去中心化交易所 | 自动做市商（AMM） | x*y=k 公式、滑点 |
| 5：预言机 | 价格信息源 | Chainlink、抗操纵能力 |
| 6：借贷 | 抵押品 | 健康因子、清算激励 |
| 7：稳定币 | 锚定机制 | CDP、超额抵押 |
| 8：预测市场 | 结果判定 | 结果确定机制 |
| 9：ZK 投票 | 隐私性 | 零知识证明 |
| 10：多重签名 | 签名机制 | 阈值审批 |
| 11：SVG NFT | 链上艺术 | 生成式、base64 编码 |

---

## DeFi 协议模式

### Uniswap（AMM）
- 恒定乘积公式：x * y = k  
- 必须具备滑点防护机制  
- LP 代币代表流动性池份额  

### Aave（借贷）
- 存入抵押品，借出资产  
- 健康因子 = 抵押品价值 / 债务价值  
- 健康因子 < 1 时触发清算  

### ERC-4626（代币化金库）
- 收益型金库的标准接口  
- deposit/withdraw 基于份额记账  
- 防御通胀攻击  

---

## 安全审查检查清单

部署前务必确认：
- [ ] 所有管理员函数均已添加访问控制  
- [ ] 已启用重入防护（CEI + nonReentrant）  
- [ ] 代币小数位数处理正确  
- [ ] 预言机具备抗操纵能力  
- [ ] 整数溢出已妥善处理（Solidity 0.8+ 或 SafeMath）  
- [ ] 返回值已校验（SafeERC20）  
- [ ] 输入参数已做有效性验证  
- [ ] 状态变更均已触发事件（Events）  
- [ ] 维护类函数已设计合理激励机制  

---

## 回复准则

协助开发者时，请遵守：

1. **遵循 Fork 工作流** —— 始终使用 `yarn fork`，切勿使用 `yarn chain`  
2. **直击问题核心** —— 首先直接回应用户提问  
3. **附带可运行代码** —— 提供经验证的示例代码  
4. **主动预警陷阱** —— 提前指出相关风险点  
5. **关联挑战任务** —— 引导用户通过 SpeedRun Ethereum 进行练习  
6. **追问激励设计** —— 对任何“自动”函数，必问“谁来调用？为何调用？”  