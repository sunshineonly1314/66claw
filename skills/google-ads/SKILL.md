---
name: google-ads
name_zh: Google广告
description: "查询、审核与优化 Google Ads 广告系列。支持两种模式：（1）API 模式，适用于通过 google-ads Python SDK 执行批量操作；（2）浏览器自动化模式，面向无 API 访问权限的用户——只需将浏览器标签页连接至 ads.google.com。当被要求检查广告效果、暂停广告系列/关键词、识别无效支出、审核转化跟踪，或优化 Google Ads 账户时使用。"
description_zh: 查询、审核与优化 Google Ads 广告系列。支持两种模式：（1）API 模式，适用于通过 google-ads Python SDK 执行批量操作；（2）浏览器自动化模式，面向无 API 访问权限的用户——只需将浏览器标签页连接至 ads.google.com。当被要求检查广告效果、暂停广告系列/关键词、识别无效支出、审核转化跟踪，或优化 Google Ads 账户时使用。
---
# Google Ads 技能

通过 API 或浏览器自动化方式管理 Google Ads 账户。

## 模式选择

**判断应使用哪种模式：**

1. **API 模式** —— 若用户已配置 `google-ads.yaml` 或设置了 `GOOGLE_ADS_*` 环境变量  
2. **浏览器模式** —— 若用户声明“我没有 API 访问权限”，或仅需快速检查  

```bash
# Check for API config
ls ~/.google-ads.yaml 2>/dev/null || ls google-ads.yaml 2>/dev/null
```

若未找到任何配置，请询问：“您是否拥有 Google Ads API 凭据？还是我应改用浏览器自动化方式？”

---

## 浏览器自动化模式（通用）

**前提条件：** 用户已在浏览器中登录 ads.google.com  

### 设置步骤
1. 用户打开 ads.google.com 并完成登录  
2. 用户点击 Clawdbot Browser Relay 工具栏图标（确保徽章处于开启状态）  
3. 使用 `browser` 工具，并传入 `profile="chrome"`  

### 常见工作流

#### 获取广告系列效果数据
```
1. Navigate to: ads.google.com/aw/campaigns
2. Set date range (top right date picker)
3. Snapshot the campaigns table
4. Parse: Campaign, Status, Budget, Cost, Conversions, Cost/Conv
```

#### 查找零转化关键词（识别无效支出）
```
1. Navigate to: ads.google.com/aw/keywords
2. Click "Add filter" → Conversions → Less than → 1
3. Click "Add filter" → Cost → Greater than → [threshold, e.g., $500]
4. Sort by Cost descending
5. Snapshot table for analysis
```

#### 暂停关键词 / 广告系列
```
1. Navigate to keywords or campaigns view
2. Check boxes for items to pause
3. Click "Edit" dropdown → "Pause"
4. Confirm action
```

#### 下载报告
```
1. Navigate to desired view (campaigns, keywords, etc.)
2. Click "Download" icon (top right of table)
3. Select format (CSV recommended)
4. File downloads to user's Downloads folder
```

**如需详细的浏览器选择器说明，请参阅：** `references/browser-workflows.md`

---

## API 模式（高级用户）

**前提条件：** 已具备 Google Ads API 开发者令牌 + OAuth 凭据  

### 设置检查
```bash
# Verify google-ads SDK
python -c "from google.ads.googleads.client import GoogleAdsClient; print('OK')"

# Check config
cat ~/.google-ads.yaml
```

### 常见操作

#### 查询广告系列效果
```python
from google.ads.googleads.client import GoogleAdsClient

client = GoogleAdsClient.load_from_storage()
ga_service = client.get_service("GoogleAdsService")

query = """
    SELECT campaign.name, campaign.status,
           metrics.cost_micros, metrics.conversions,
           metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.cost_micros DESC
"""

response = ga_service.search(customer_id=CUSTOMER_ID, query=query)
```

#### 查找零转化关键词
```python
query = """
    SELECT ad_group_criterion.keyword.text,
           campaign.name, metrics.cost_micros
    FROM keyword_view
    WHERE metrics.conversions = 0
      AND metrics.cost_micros > 500000000
      AND segments.date DURING LAST_90_DAYS
    ORDER BY metrics.cost_micros DESC
"""
```

#### 暂停关键词
```python
operations = []
for keyword_id in keywords_to_pause:
    operation = client.get_type("AdGroupCriterionOperation")
    operation.update.resource_name = f"customers/{customer_id}/adGroupCriteria/{ad_group_id}~{keyword_id}"
    operation.update.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
    operations.append(operation)

service.mutate_ad_group_criteria(customer_id=customer_id, operations=operations)
```

**如需完整 API 参考文档，请参阅：** `references/api-setup.md`

---

## 审核检查清单

对任意 Google Ads 账户执行的快速健康检查：

| 检查项 | 浏览器路径 | 应关注内容 |
|-------|--------------|------------------|
| 零转化关键词 | 关键词 → 筛选：转化<1，花费>$500 | 无效支出 |
| 空广告组 | 广告组 → 筛选：广告数=0 | 无创意素材正在投放 |
| 政策违规 | 广告系列 → 状态列 | 黄色警告图标 |
| 优化得分（Optimization Score） | 概览页面（右上角） | 低于 70% 即需采取行动 |
| 转化跟踪 | 工具 → 转化 | 未启用 / 无近期数据 |

---

## 输出格式

汇报发现结果时，请使用表格形式：

```markdown
## Campaign Performance (Last 30 Days)
| Campaign | Cost | Conv | CPA | Status |
|----------|------|------|-----|--------|
| Branded  | $5K  | 50   | $100| ✅ Good |
| SDK Web  | $10K | 2    | $5K | ❌ Pause |

## Recommended Actions
1. **PAUSE**: SDK Web campaign ($5K CPA)
2. **INCREASE**: Branded budget (strong performer)
```

---

## 故障排除

### 浏览器模式问题
- **无法看到数据**：检查用户是否位于正确账户（右上角账户选择器）  
- **加载缓慢**：Google Ads UI 较为繁重；请等待表格完全加载完毕  
- **会话过期**：用户需重新登录 ads.google.com  

### API 模式问题
- **认证失败**：刷新 OAuth 令牌，并检查 `google-ads.yaml`  
- **开发者令牌被拒绝**：确认令牌已获批准（非测试模式）  
- **客户 ID 错误**：请使用不含短横线的 10 位数字 ID  