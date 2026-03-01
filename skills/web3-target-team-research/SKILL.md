---
name: web3-target-team-research
name_zh: Web3目标团队研究
description: 查找获得 1000 万美元以上融资且 Telegram 联系方式已验证的加密/Web3 团队。适用于挖掘加密领域销售线索、构建联系人列表、调研已获融资初创公司，或对 Web3 公司开展潜在客户开发。该 skill 将并行启动多个 subagent（子 agent）执行猎手任务，以搜索风投机构投资组合并验证 Telegram 账号。
description_zh: 查找获得 1000 万美元以上融资且 Telegram 联系方式已验证的加密/Web3 团队。适用于挖掘加密领域销售线索、构建联系人列表、调研已获融资初创公司，或对 Web3 公司开展潜在客户开发。该 skill 将并行启动多个 subagent（子 agent）执行猎手任务，以搜索风投机构投资组合并验证 Telegram 账号。
---
# Web3 目标团队调研

查找融资额达 1000 万美元以上的优质加密团队，并确保其 Telegram 联系方式已验证，便于后续触达。

## 快速上手

```
Hunt for crypto teams from [SOURCE]
```

示例信息来源：Paradigm 投资组合、近期融资新闻、Solana 生态系统、DeFi 协议

## 工作原理

1. **启动猎手** —— 并行 subagent 分别搜索不同风投机构的投资组合/信息源  
2. **发现团队** —— 筛选融资额 ≥1000 万美元的团队，并检查是否已在追踪列表中  
3. **验证 Telegram 账号** —— 截图访问 t.me/{handle} 页面，要求账号具备头像（pfp）**或** 个人简介（bio）中明确提及所属公司/职位  
4. **写入 CSV** —— 将已验证的联系人追加至主 CSV 文件

## 命令

### 启动猎手任务
```
Start crypto hunters targeting [SOURCES]
```  
启动 3 个猎手 agent，并指定各自专注的领域。

### 检查状态
```
How many teams do we have?
```  
返回 crypto-master.csv 中的记录总数。

### 停止猎手任务
```
Stop the crypto hunters
```  
移除自动重启的 cron 任务。

## CSV 格式

**主 CSV 文件：** `crypto-master.csv`  
```
Name,Chain,Category,Website,X Link,Funding,Contacts
Uniswap,ETH,DEX,https://uniswap.org,https://x.com/Uniswap,$165M,"Hayden Adams (Founder) @haaboris"
```

**无联系方式 CSV 文件：** `crypto-no-contacts.csv`（已完成调研但未找到有效 Telegram 账号的团队）

**链类型取值：** ETH、SOL、BASE、ARB、OP、MATIC、AVAX、BTC、MULTI、N/A

## Telegram 验证规则

满足以下任一条件，即视为 Telegram 账号**有效**：
- 具备头像（pfp），或  
- 个人简介（bio）中提及公司名称或所任职位  

**无效情形包括：** 个人资料为空、账号归属错误人员、为频道（channel）而非个人账号（personal account）

## 猎手任务模板

完整 subagent 任务模板详见 [references/hunter-task.md](references/hunter-task.md)。

## 自动猎手配置

如需持续运行猎手任务，请按以下步骤设置：

1. 创建一个 cron 任务，每 10 分钟检查一次当前活跃猎手数量；  
2. 在 HEARTBEAT.md 中添加配置，当活跃猎手数 < 3 时自动重启。

cron 配置详情请参阅 [references/auto-hunt-setup.md](references/auto-hunt-setup.md)。

## 高效信息来源（按 Telegram 账号转化率排序）

**高产出（Telegram 转化率约 40%+）：**  
- 消费级/DeFi 协议（Paradigm、Dragonfly、Framework）  
- 跨链桥/互操作性项目  
- 安全审计公司  

**中等产出（Telegram 转化率约 20–30%）：**  
- 游戏/NFT 领域（Animoca、Immutable）  
- Layer 2 及基础设施项目  
- 聚焦亚洲市场的风投机构（Hashed、OKX Ventures）  

**低产出（Telegram 转化率 <20%）：**  
- 企业级/机构级项目（Point72、Tiger Global）  
- 预言机与数据服务商  
- 社交/社区平台  

## 实用提示

- 添加新记录前，务必 `grep -i "TeamName"` 两个 CSV 文件；  
- 团队成员在 X（原 Twitter）与 Telegram 上的账号往往不同；  
- 创始人使用 Telegram 的频率通常低于 BD 或市场岗位人员；  
- 最近发布的融资公告 = 更新鲜、更易获取的联系人信息。