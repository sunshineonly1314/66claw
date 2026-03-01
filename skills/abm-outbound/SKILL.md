---
name: ABM Outbound
name_zh: ABM外呼
description: 多渠道 ABM 自动化工具，可将 LinkedIn 链接转化为协同式外呼营销活动。自动抓取个人资料，通过 Apollo（补全邮箱与电话）增强数据，再借助 Skip Trace 获取邮寄地址，最终协调执行邮件序列、LinkedIn 触达及 Scribeless 手写信函。这是在信息过载收件箱中脱颖而出的制胜法宝。
description_zh: 多渠道 ABM 自动化工具，可将 LinkedIn 链接转化为协同式外呼营销活动。自动抓取个人资料，通过 Apollo（补全邮箱与电话）增强数据，再借助 Skip Trace 获取邮寄地址，最终协调执行邮件序列、LinkedIn 触达及 Scribeless 手写信函。这是在信息过载收件箱中脱颖而出的制胜法宝。
---
# ABM Outbound

将 LinkedIn 潜在客户列表转化为多渠道外呼：邮件序列、LinkedIn 触达与手写信函。

## 前置条件

| 服务 | 用途 | 注册地址 |
|---------|---------|---------|
| **Apify** | LinkedIn 资料抓取、Skip Trace | [apify.com](https://apify.com) |
| **Apollo** | 邮箱与电话号码补全 | [apollo.io](https://apollo.io) |
| **Scribeless** | 手写信函 | [platform.scribeless.co](https://platform.scribeless.co) |
| **Instantly** *(可选)* | 专用冷邮件发送 | [instantly.ai](https://instantly.ai) |

```bash
export APIFY_API_KEY="your_key"
export APOLLO_API_KEY="your_key"
export SCRIBELESS_API_KEY="your_key"
```

## 流水线

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. INPUT   │───▶│  2. SCRAPE  │───▶│  3. ENRICH  │───▶│  4. ADDRESS │───▶│ 5. OUTREACH │
│  LinkedIn   │    │  Profiles   │    │ Email/Phone │    │ Skip Trace  │    │             │
│    URLs     │    │             │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
   Your list          Apify             Apollo            Apify PFI        Email +
                                                                          LinkedIn +
                                                                          Scribeless
```

## 第一步：收集 LinkedIn URL

请提供以下来源的 LinkedIn 个人资料链接：
- LinkedIn Sales Navigator 导出数据
- LinkedIn 搜索爬虫结果
- CRM 系统导出数据
- 手动筛选的潜在客户

```csv
linkedin_url
https://linkedin.com/in/johndoe
https://linkedin.com/in/janesmith
```

## 第二步：抓取 LinkedIn 个人资料

```bash
curl -X POST "https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items" \
  -H "Authorization: Bearer $APIFY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "profileUrls": [
      "https://linkedin.com/in/johndoe",
      "https://linkedin.com/in/janesmith"
    ]
  }'
```

**返回内容：** 名字、姓氏、公司、职位、所在地。

## 第三步：通过 Apollo 补全邮箱与电话

```bash
curl -X POST "https://api.apollo.io/api/v1/people/bulk_match" \
  -H "X-Api-Key: $APOLLO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reveal_personal_emails": true,
    "reveal_phone_number": true,
    "details": [{
      "first_name": "John",
      "last_name": "Doe",
      "organization_name": "Acme Corp",
      "linkedin_url": "https://linkedin.com/in/johndoe"
    }]
  }'
```

**返回内容：** 工作邮箱、电话号码。

## 第四步：获取邮寄地址（Skip Trace）

```bash
curl -X POST "https://api.apify.com/v2/acts/one-api~skip-trace/run-sync-get-dataset-items" \
  -H "Authorization: Bearer $APIFY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": ["John Doe"]}'
```

**返回内容：** 街道地址、城市、州/省、邮政编码。

**重要提示：** 请确认 Skip Trace 所得州/省信息与 LinkedIn 上显示的所在地一致。

## 第五步：多渠道外呼触达

### 5a：邮件序列

**选项 1：Apollo 序列（推荐）**  
```bash
curl -X POST "https://api.apollo.io/api/v1/emailer_campaigns/add_contact_ids" \
  -H "X-Api-Key: $APOLLO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "emailer_campaign_id": "YOUR_SEQUENCE_ID",
    "contact_ids": ["CONTACT_ID_1", "CONTACT_ID_2"],
    "send_email_from_email_account_id": "YOUR_EMAIL_ACCOUNT_ID"
  }'
```

**选项 2：Instantly.ai**  
```bash
curl -X POST "https://api.instantly.ai/api/v1/lead/add" \
  -H "Authorization: Bearer $INSTANTLY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "YOUR_CAMPAIGN_ID",
    "email": "john@acme.com",
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Acme Corp",
    "personalization": "Saw Acme just expanded to UK"
  }'
```

**选项 3：CSV 文件上传**  
```csv
email,first_name,last_name,company,title,phone,personalization
john@acme.com,John,Doe,Acme Corp,VP Marketing,555-1234,Saw Acme just expanded to UK
```

### 5b：LinkedIn 序列
- 第 1 天：浏览对方个人资料  
- 第 2 天：发送附个性化备注的加好友请求  
- 第 4 天：若已通过好友请求，则发送跟进消息  
- 第 7 天：互动评论其发布的内容  

### 5c：手写信函（Scribeless）

请前往 [platform.scribeless.co](https://platform.scribeless.co) 创建活动，然后添加收件人：

```bash
curl -X POST "https://platform.scribeless.co/api/recipients" \
  -H "X-API-Key: $SCRIBELESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "data": {
      "firstName": "John",
      "lastName": "Doe",
      "company": "Acme Corp",
      "address": {
        "address1": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "postalCode": "94102",
        "country": "US"
      },
      "variables": {
        "custom1": "Saw Acme just expanded to the UK — congrats!"
      }
    }
  }'
```

完整 API 细节请参阅 [references/scribeless-api.md](references/scribeless-api.md)。

## 协同触达时间安排

| 天数 | 邮件 | LinkedIn | 手写信函 |
|-----|-------|----------|--------|
| 1 | — | 浏览个人资料 | 信函寄出 |
| 3 | — | 发送加好友请求 | — |
| 5 | “收到我的留言了吗？” | — | 信函送达 |
| 7 | 传递价值的邮件 | 若已加好友则发送消息 | — |
| 10 | 案例研究 | — | — |
| 14 | 分手信（Break-up email） | 互动其发布的内容 | — |

**核心策略：** 手写信函先行抵达 → 邮件内容呼应该信函 → LinkedIn 触达进一步强化印象。

## 完整工作流

```python
# 1. Start with LinkedIn URLs
linkedin_urls = load_csv("prospects.csv")

# 2. Scrape profiles
profiles = apify_linkedin_scrape(linkedin_urls)

# 3. Enrich with Apollo
for profile in profiles:
    enriched = apollo_bulk_match(profile)
    profile['email'] = enriched['email']
    profile['phone'] = enriched['phone']

# 4. Get mailing addresses
for profile in profiles:
    address = skip_trace(profile['name'])
    if address['state'] == profile['linkedin_state']:
        profile['address'] = address
        profile['mailable'] = True

# 5. Push to channels
push_to_email_tool(profiles)
push_to_scribeless(profiles, campaign_id)
export_for_linkedin(profiles)
```

## 输出格式

```csv
first_name,last_name,email,phone,company,title,address1,city,state,postal,country,linkedin,mailable
John,Doe,john@acme.com,555-1234,Acme Corp,VP Marketing,123 Main St,San Francisco,CA,94102,US,linkedin.com/in/johndoe,TRUE
```

## 最佳实践

1. **核验地址** — Skip Trace 所得州/省须与 LinkedIn 所示所在地一致  
2. **全面个性化** — 结合公司动态、职位变动、共同联系人等信息  
3. **协调各渠道时间点** — 手写信函须在“你收到我的留言了吗？”类邮件发出前送达  
4. **从小规模起步** — 先用 20–50 名潜在客户测试，再逐步扩大规模  
5. **按渠道分别追踪效果** — 明确哪一渠道带来最多回复  