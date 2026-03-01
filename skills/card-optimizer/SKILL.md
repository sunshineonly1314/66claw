---
name: card-optimizer  
name_zh: 卡片优化
description: "信用卡返现/积分/里程优化器——针对每一类消费，推荐最优信用卡，以最大化现金返还、积分与里程收益。自动追踪年度返现上限、计算年费投资回报率（ROI）、管理季度轮换类别，并基于用户消费模式推荐新卡。"  
description_zh: 信用卡返现/积分/里程优化器——针对每一类消费，推荐最优信用卡，以最大化现金返还、积分与里程收益。自动追踪年度返现上限、计算年费投资回报率（ROI）、管理季度轮换类别，并基于用户消费模式推荐新卡。
homepage: https://github.com/ScotTFO/card-optimizer-skill  
metadata: {"clawdbot":{"emoji":"💳"}}  
---
# Card Optimizer  

通过为每一笔消费精准匹配最合适的信用卡，最大化信用卡奖励收益。

## 数据位置  

- **skill 逻辑：** `skills/card-optimizer/`（本文件）  
- **用户数据：** `data/card-optimizer/`  
  - `cards.json` — 卡片定义、奖励比率、消费估算值、类别映射表  

## 卡片数据库结构  

`cards.json` 中每张卡片均遵循以下结构：  

```json
{
  "id": "unique_id",
  "name": "Card Name",
  "issuer": "Issuer Name",
  "network": "visa|mastercard|amex|discover",
  "annual_fee": 95,
  "reward_type": "cashback|points|miles",
  "point_valuation_cpp": null,
  "transfer_partners": [],
  "notes": "Optional notes",
  "signup_bonus": {
    "amount": 200,
    "type": "cashback",
    "spend_requirement": 3000,
    "timeframe_months": 3,
    "earned": false
  },
  "categories": [
    {
      "category": "groceries",
      "rate": 6.0,
      "cap_amount": 6000,
      "cap_period": "yearly",
      "rate_after_cap": 1.0
    },
    {
      "category": "rotating",
      "rate": 5.0,
      "cap_amount": 1500,
      "cap_period": "quarterly",
      "rate_after_cap": 1.0,
      "quarterly_categories": {
        "Q1": ["gas", "ev_charging"],
        "Q2": ["groceries", "home_improvement"],
        "Q3": ["restaurants", "paypal"],
        "Q4": ["amazon", "target", "walmart"]
      },
      "activation_required": true
    },
    {
      "category": "everything_else",
      "rate": 1.0
    }
  ]
}
```  

### 积分/里程估值（Point Valuations）  

对于积分/里程类卡片，需存储 `point_valuation_cpp`（每点价值，单位：美分）：  
- Chase Ultimate Rewards：基础 1.0 cpp；Sapphire Preferred 持卡人 1.25 cpp；Sapphire Reserve 持卡人 1.5 cpp  
- Amex Membership Rewards：基础 1.0 cpp；具体数值依转点合作方而异  
- 在比较不同卡片时，将奖励比率 × point_valuation_cpp，即可换算为等效现金返还率  

### 类别映射表（Category Map）  

`cards.json` 中的 `category_map` 将每个消费类别映射至该类别下最优卡片 ID。这是**预计算得出的最优分配方案**——当新增或删除卡片时需重新计算。  

### 消费估算值（Spending Estimates）  

为支撑 ROI 计算、缺口分析（gap analysis）及新卡推荐，用户可选择在 `cards.json` 中按月填写各主要消费类别的预估支出：  

```json
{
  "estimated_monthly_spending": {
    "groceries": 600,
    "gas": 200,
    "restaurants": 300,
    "amazon": 150,
    "streaming": 50,
    "everything_else": 500
  }
}
```  

若未提供任何估算值，本 skill 仍可针对单笔消费进行卡片推荐，但无法执行 ROI 分析或缺口分析。请在首次设置时引导用户提供估算值。  

**注意：** 本 skill **不追踪具体交易明细**。如用户需要详细消费数据，应通过记账工具连接其银行账户。此处的估算值仅为优化计算所用的粗略参考值。  

## 消费推荐引擎（Purchase Optimizer）  

### 如何推荐卡片  

当用户提问“[类别]该用哪张卡？”或“我要买[商品]”时：  

1. **识别消费类别**（参见下方“类别匹配”）  
2. **遍历所有卡片**，查找该类别对应的奖励比率  
3. **纳入上限（caps）因素**：若某卡片在该类别设有年度返现上限，且用户预估年消费额超出该上限，则注明该上限及预计耗尽时间  
4. **纳入支付网络接受度因素**：若最优卡片为 Amex，需提示部分商户不接受 Amex，并提供 Visa/MC 备选方案  
5. **比较等效收益率**：对积分类卡片，使用 point_valuation_cpp 换算为等效现金返还率  
6. **返回推荐结果并附带推理说明**  

### 响应格式  

```
💳 Use: [Card Name] ([Issuer])
💰 Reward: [X]% [cashback/points/miles] on [category]
⚠️ Note: [any caps, network warnings, or caveats]
🔄 Fallback: [Next best card if merchant doesn't accept primary]
```  

### 上限感知型推荐（Cap-Aware Recommendations）  

当某卡片存在消费上限时：  
- **远低于上限**：照常推荐  
- **可能触及上限**（依据预估消费判断）：注明预计触达时间，以及触达后应切换的替代卡片  
- **存在上限**：始终向用户明确提示该上限  

示例：“您的 Amex BCP 在杂货消费上享 6% 返现，但年度上限为 6,000 美元。按每月约 600 美元估算，您将在 10 月左右用尽该额度。此后返现率降至 1%——建议改用 Wells Fargo Active Cash（2% 返现）。”  

## 季度轮换类别管理（Quarterly Category Management）  

### 季度轮换类别（Rotating Categories）  

部分卡片（如 Chase Freedom Flex、Discover It）提供季度轮换的 5% 返现类别，需用户主动激活方可享受。  

### 季度提醒（Quarterly Alerts）  

每季度首日（1 月 1 日、4 月 1 日、7 月 1 日、10 月 1 日）：  
- 检查是否存在 `activation_required: true` 的卡片  
- 若尚未为本季度激活，提醒用户  
- 列出本季度的返现加成类别  
- 注：如需自动化执行，可添加季度 cron 任务，或集成至里程检查心跳机制中  

按卡片分别记录激活状态：  
```json
{
  "quarterly_activations": {
    "chase_freedom_flex": {
      "2026-Q1": {"activated": true, "date": "2026-01-02"}
    }
  }
}
```  

## 年费 ROI 分析（Annual Fee ROI Analysis）  

针对每张收取年费的卡片，基于 `estimated_monthly_spending` 判断其是否值得续持：  

1. **计算加成奖励**：对每个加成类别，按加成比率计算年度奖励总额  
2. **计算基准线**：同额消费下，一张无年费、2% 固定返现卡所能获得的收益  
3. **加成价值**：加成奖励 − 基准线奖励  
4. **净 ROI**：加成价值 − 年费  
5. **结论**：若净 ROI > 0，则值得保留  

### 报告格式  

```
💳 [Card Name] — Annual Fee: $[fee]

Bonus rewards earned:     $[amount]
vs. 2% flat card:         $[amount]
Bonus value:              $[amount]
Annual fee:              -$[fee]
━━━━━━━━━━━━━━━━━━━━━━━━
Net value:                $[amount] ✅ Worth it / ❌ Consider downgrading

Break-even: Need $[X]/yr in bonus categories to justify the fee
```  

## 优化与缺口分析（Optimization & Gap Analysis）  

### 消费缺口分析（Spending Gap Analysis）  

借助 `estimated_monthly_spending`，识别以下四类问题：  

1. **薄弱类别（Weak categories）**：用户高消费但当前最优卡片仅提供 1–2% 返现  
2. **低效年费卡（Underperforming fee cards）**：年费卡片所获加成奖励不足以覆盖年费成本  
3. **上限耗尽风险（Cap exhaustion）**：预估消费超出加成上限的类别——可能需配置第二张卡分摊  
4. **覆盖空白（Missing coverage）**：常见消费类别尚无任一卡片提供加成返现  

### 报告格式  

```
📊 Card Optimization Report

✅ Well covered:
- Groceries → Amex BCP (6%) — earning ~$360/yr
- Amazon → Chase Prime (5%) — earning ~$90/yr

⚠️ Gaps identified:
- Dining: $300/mo at 2% (Chase Prime) — a 4% dining card would save $72/yr
- Travel: $200/mo at 1% — a 3x travel card would earn $48 more/yr

❌ Fee card alert:
- [Card] costs $95/yr but only generates $60 in bonus rewards — net loss of $35

💡 Recommendations:
- Adding [Card Name] would earn ~$[X] more per year on [categories]
- Consider downgrading [Card] to the no-fee version
```  

### 新卡推荐（New Card Recommendations）  

基于用户消费估算值，推荐能带来增量价值的卡片：  

1. 找出用户消费额最高的若干薄弱类别  
2. 匹配主流卡片中在这些类别具有高返现率的产品  
3. 计算新卡带来的预估年度奖励  
4. 扣除年费影响  
5. 提及开卡礼（signup bonus）作为首年额外激励  

**切勿推荐具体联盟链接（affiliate links）**——仅需列出卡片名称并说明推荐理由。  

**按类别推荐的主流卡片参考：**  

| 类别 | 推荐卡片 | 备注 |  
|------|----------|------|  
| 餐饮 | Chase Sapphire Preferred（3×）、Amex Gold（4×）、Capital One SavorOne（3%） | Sapphire 与 Gold 均收取年费 |  
| 杂货 | Amex BCP（6%）、Amex Gold（4× MR） | BCP 年度上限 6,000 美元 |  
| 旅行 | Chase Sapphire Reserve（3×）、Amex Platinum（5× 航班）、Capital One Venture X（2×） | 全部收取显著年费 |  
| 加油 | Citi Custom Cash（5% 顶流类别）、PenFed Platinum Rewards（5× 加油） | Custom Cash 类别灵活可调 |  
| 固定返现 | Citi Double Cash（2%）、Wells Fargo Active Cash（2%）、Fidelity Visa（2%） | 无年费保底方案 |  
| 季度轮换 | Chase Freedom Flex（5% 季度轮换）、Discover It（5% 季度轮换 + 首年返现匹配） | 需手动激活 |  

## 类别匹配（Category Matching）  

### 商户 → 类别映射（Merchant → Category Mapping）  

当用户提及具体商户时，映射至对应卡片类别：  

| 商户 / 关键词 | 类别 | 备注 |  
|---------------|------|------|  
| Kroger、Publix、Safeway、HEB、Aldi、Trader Joe's | groceries | 超市 |  
| Costco、Sam's Club | groceries OR warehouse | Costco 美国门店仅支持 Visa；Sam's Club 上 Amex 可能被归类为 groceries |  
| Target、Walmart | varies | 可能被归类为 “superstore” 而非 “groceries”——取决于发卡行判定逻辑 |  
| Amazon、amazon.com | amazon | 部分卡片设独立 Amazon 类别 |  
| Whole Foods | whole_foods OR groceries | Chase Prime 设有专属 Whole Foods 类别 |  
| Shell、Exxon、BP、Chevron | gas | 加油站 |  
| Uber、Lyft、subway、bus | transit | 公共交通与网约车 |  
| Netflix、Hulu、Spotify、Disney+、HBO Max、YouTube TV | streaming | 流媒体订阅服务 |  
| Chipotle、McDonald's、DoorDash、Grubhub | restaurants | 餐饮及外卖 |  
| CVS、Walgreens、Rite Aid | drugstores | 药店 |  
| Hilton、Marriott、Airbnb | hotels/travel | 住宿/旅行 |  
| United、Delta、Southwest | airlines/travel | 航空机票 |  

### 模糊类别匹配（Fuzzy Category Matching）  

当用户使用非正式表达时：  
- “food” / “eating out” / “dinner” → **restaurants**  
- “grocery run” / “supermarket” → **groceries**  
- “gas” / “fuel” / “fill up” → **gas**  
- “uber” / “lyft” / “ride” → **transit**  
- “stuff on amazon” / “prime order” → **amazon**  
- “pharmacy” / “meds” / “prescription” → **drugstores**  
- “subscription” / “monthly streaming” → **streaming**  
- “general” / “random purchase” → **everything_else**  

若语义模糊，请主动确认：“这是超市还是餐厅？”  

## 支付网络接受度警告（Network Acceptance Warnings）  

### Amex 接受度说明  

American Express 商户覆盖率低于 Visa/Mastercard：  
- 小型本地商户  
- 部分国际商户  
- Costco（美国门店仅接受 Visa）  
- 部分政府缴费渠道  

**凡推荐 Amex 卡片时，必须同步提供 Visa/MC 备选方案。**  

### Costco 特殊说明  

Costco 美国门店仅接受 **Visa** 信用卡（另支持借记卡与现金）：  
- 门店内消费：必须使用 Visa  
- 官网（costco.com）：支持 Visa、Mastercard、Discover（不支持 Amex）  

## 新增卡片流程（Adding a New Card）  

当用户希望添加新卡时：  

1. **收集信息：**  
   - 卡片名称与发卡行  
   - 支付网络（Visa/MC/Amex/Discover）  
   - 年费金额  
   - 奖励类型（cashback/points/miles）及适用的 point valuation（如为积分卡）  
   - 各类别的奖励比率（含加成类别与基础比率）  
   - 各类别是否设上限或限额  
   - 是否含季度轮换类别？对应哪些季度？是否需激活？  
   - 开卡礼详情（可选）  

2. **补充调研：** 若用户仅提供卡片名称，需通过网页搜索核实当前奖励比率、年费及类别规则  

3. **在 `cards.json` 中创建该卡片条目**  

4. **重新计算 `category_map`** —— 更新各消费类别的最优卡片归属  

5. **确认操作并展示更新后的推荐结果**  

### 删除卡片流程（Removing a Card）  

1. 从 `cards.json` 中的 `cards` 数组中移除该卡片  
2. 重新计算 `category_map`  
3. 确认操作，并指出因移除导致覆盖能力下降的类别  

## 首次设置流程（First-Time Setup）  

若 `data/card-optimizer/cards.json` 尚未存在：  

1. 询问用户当前持有的信用卡列表  
2. 对每张卡片，执行以下任一操作：  
   - 通过网页搜索查证其现行奖励结构，或  
   - 若为小众/区域性卡片，则直接向用户询问具体比率  
3. 构建 `cards.json`，包含全部卡片及预计算的类别映射表  
4. 请求用户提供**各主要类别的月度消费估算值**（如：杂货、加油、餐饮、Amazon、流媒体、通用消费等）——说明此举将驱动 ROI 与缺口分析，但属可选项  
5. 运行初始优化报告，展示用户在各消费类别下的最优卡片及现存缺口  

## 快速参考（Quick Reference）  

| 用户输入 | 执行动作 |  
|----------|----------|  
| “Which card for groceries?” | 推荐该类别下最优卡片 |  
| “I'm buying gas” | 按 gas 类别推荐卡片 |  
| “Best card for Amazon?” | 按 Amazon 类别推荐卡片 |  
| “Annual fee worth it?” | 对所有年费卡执行 ROI 分析 |  
| “Add a new card” | 引导完成新卡录入流程 |  
| “Remove a card” | 执行移除并重新计算 |  
| “Card optimization report” | 生成完整缺口分析 + 推荐报告 |  
| “What cards should I get?” | 提供新卡推荐 |  
| “Activate Q2 categories” | 更新季度轮换类别激活状态 |  
| “Does Costco take Amex?” | 提供支付网络接受度信息 |  
| “What are my cards?” | 列出全部卡片及其关键返现比率 |  
| “Update my spending estimates” | 修改月度消费估算值 |