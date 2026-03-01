---
name: gevety  
version: 1.4.0  
description: 访问您的 Gevety 健康数据——生物标志物、健康寿命评分、生理年龄、补充剂、活动、每日行动项、90 天健康方案，以及即将进行的检测  
homepage: https://gevety.com  
user-invocable: true  
command: gevety  
metadata:  
  clawdbot:  
    primaryEnv: GEVETY_API_TOKEN  
    requires:  
      env:  
        - GEVETY_API_TOKEN  
---  

# Gevety 健康助手  

您可通过 REST API 访问用户在 Gevety 平台上的健康数据。使用 `web_fetch` 获取其生物标志物、健康寿命评分及可穿戴设备统计数据。  

## 首次设置  

若用户首次使用 Gevety，请引导其完成以下设置步骤：  

1. **注册 Gevety 账户**：如尚未注册，请访问 https://gevety.com 完成注册  
2. **上传血液检测报告**：需上传实验室报告，方可获得生物标志物数据  
3. **生成 API 令牌**：  
   - 访问 https://gevety.com/settings  
   - 点击“开发者 API”标签页  
   - 点击“生成令牌”  
   - 复制该令牌（以 `gvt_` 开头）  
4. **配置 Clawdbot**：将令牌添加至 `~/.clawdbot/clawdbot.json`：  

```json
{
  "skills": {
    "entries": {
      "gevety": {
        "apiKey": "gvt_your_token_here"
      }
    }
  }
}
```  

添加令牌后，需重启 Clawdbot 以使更改生效。  

## 认证  

所有请求均需 Bearer 认证。请使用 `GEVETY_API_TOKEN` 环境变量：  

```
Authorization: Bearer $GEVETY_API_TOKEN
```  

基础 URL：`https://api.gevety.com`  

## 标准化生物标志物名称  

API 在所有端点中统一使用标准化的生物标志物名称。查询或展示生物标志物时，请始终使用以下标准名称：  

| 常用名称 | API 返回值 |  
|----------|------------|  
| CRP、C-反应蛋白、hsCRP、高敏 CRP | **hs-CRP** |  
| 血糖、空腹血糖 | **空腹血糖** |  
| 胰岛素、空腹胰岛素 | **空腹胰岛素** |  
| IG | **未成熟粒细胞** |  
| 维生素 D、25-羟基维生素 D | **维生素 D** |  
| LDL、LDL 胆固醇 | **LDL 胆固醇** |  
| HDL、HDL 胆固醇 | **HDL 胆固醇** |  

**提示**：您可使用任意常用名称搜索（例如“CRP”或“glucose”），API 将自动匹配并返回对应的标准名称。  

## 可用端点  

### 1. 列出可用数据（请从此处开始）  

**务必首先调用此接口**，以探查用户当前已追踪的健康数据类型。  

```
GET /api/v1/mcp/tools/list_available_data
```  

返回内容：  
- `biomarkers`：已追踪生物标志物列表，含检测次数与最新检测日期  
- `wearables`：已连接设备及其支持的指标  
- `insights`：是否已计算健康寿命评分，以及各维度评分是否可用  
- `data_coverage`：已追踪推荐生物标志物的覆盖率（0–100%）  

### 2. 获取健康概览  

用户整体健康状况的综合视图。  

```
GET /api/v1/mcp/tools/get_health_summary
```  

返回内容：  
- `overall_score`：健康寿命评分（0–100）  
- `overall_status`：OPTIMAL（最优）、GOOD（良好）、SUBOPTIMAL（欠佳）或 NEEDS_ATTENTION（需关注）  
- `trend`：IMPROVING（改善中）、STABLE（稳定）或 DECLINING（下降中）  
- `axis_scores`：各健康维度（代谢、心血管等）的评分  
- `top_concerns`：需重点关注的生物标志物  
- `scoring_note`：当总体评分与各维度评分不一致时的解释说明（例如：“整体健康寿命评分较高，但炎症维度需重点关注”）  

**关于评分的说明**：总体健康寿命评分为加权综合得分。可能出现总体评分较高而某一维度评分偏低（或反之）的情况。`scoring_note` 字段将对此类情形作出解释。  

### 3. 查询生物标志物  

获取某特定生物标志物的详细历史记录。  

```
GET /api/v1/mcp/tools/query_biomarker?biomarker={name}&days={days}
```  

参数：  
- `biomarker`（必填）：名称或别名（例如 “vitamin d”、“ldl”、“hba1c”、“crp”）  
- `days`（可选）：历史时间范围（1–730 天），默认为 365 天  

返回内容：  
- `canonical_name`：标准化生物标志物名称（参见上表）  
- `history`：含日期、数值、单位及异常标记的检测结果数组  
- `latest`：最近一次检测结果  
- `trend`：变化趋势（IMPROVING、STABLE 或 DECLINING）及百分比变化  
- `optimal_range`：基于循证医学的最优参考区间  

**提示**：若未找到对应生物标志物，响应中将包含 `did_you_mean` 推荐项。  

### 4. 获取可穿戴设备统计信息  

来自已连接可穿戴设备（Garmin、Oura、Whoop 等）的每日指标。  

```
GET /api/v1/mcp/tools/get_wearable_stats?days={days}&metric={metric}
```  

参数：  
- `days`（可选）：历史时间范围（1–90 天），默认为 30 天  
- `metric`（可选）：聚焦特定指标（步数、HRV、睡眠等）  

返回内容：  
- `connected_sources`：已连接的可穿戴平台列表  
- `daily_metrics`：逐日数据（步数、静息心率、HRV、睡眠、恢复状态等）  
- `summaries`：聚合统计信息（含平均值、最小值、最大值及趋势）  

### 5. 获取健康改善机会  

获取按健康寿命提升潜力排序的健康改善机会列表。  

```
GET /api/v1/mcp/tools/get_opportunities?limit={limit}&axis={axis}
```  

参数：  
- `limit`（可选）：最多返回的机会数（1–50），默认为 10  
- `axis`（可选）：按健康维度筛选（代谢、心血管等）  

返回内容：  
- `opportunities`：按健康寿命影响排序的改善机会列表  
- `total_opportunity_score`：总计可提升的健康寿命分值  
- `total_years_estimate`：若全部优化，预计可延长的健康寿命年数  
- `healthspan_score`：当前健康寿命评分  

每个机会包含：  
- `biomarker`：标准化生物标志物名称  
- `current_value` / `optimal_value`：当前值与目标值对比  
- `opportunity_score`：若优化成功可获得的健康寿命分值  
- `years_estimate`：预计可延长的健康寿命年数  
- `priority`：优先级排名（1 = 影响最大）  

### 6. 获取生理年龄  

使用经验证算法（PhenoAge、Light BioAge）计算生理年龄。  

```
GET /api/v1/mcp/tools/get_biological_age
```  

返回内容：  
- `result`：生理年龄计算结果（如可用）  
  - `biological_age`：计算所得生理年龄  
  - `chronological_age`：实际日历年龄  
  - `age_acceleration`：差值（正值表示衰老加速）  
  - `algorithm`：所用算法名称  
  - `biomarkers_used`：参与计算的生物标志物  
  - `interpretation`：结果含义解读  
- `available`：计算是否可行  
- `reason`：不可用原因（如适用）  
- `upgrade_available`：是否可通过补充更多数据解锁更优算法  
- `upgrade_message`：建议补充哪些检测项目  

### 7. 列出补充剂  

获取用户的补充剂组合清单。  

```
GET /api/v1/mcp/tools/list_supplements?active_only={true|false}
```  

参数：  
- `active_only`（可选）：仅显示当前正在服用的补充剂，默认为 false  

返回内容：  
- `supplements`：补充剂列表（含剂量、频次、服用时长）  
- `active_count`：当前正在服用的补充剂数量  
- `total_count`：已追踪的补充剂总数  

每种补充剂包含：  
- `name`：补充剂名称  
- `dose_text`：格式化剂量（例如 “1000 mg 每日”、“200mg EPA + 100mg DHA 每日”）  
- `is_active`：当前是否正在服用  
- `duration_days`：已服用天数  

**注意**：对于多组分补充剂（如鱼油），`dose_text` 将完整列出所有组分（例如 “200mg EPA + 100mg DHA 每日”）。  

### 8. 获取活动记录  

从已连接可穿戴设备获取运动/活动历史记录。  

```
GET /api/v1/mcp/tools/get_activities?days={days}&activity_type={type}
```  

参数：  
- `days`（可选）：历史时间范围（1–90 天），默认为 30 天  
- `activity_type`（可选）：按活动类型筛选（跑步、骑行、力量训练等）  

返回内容：  
- `activities`：含各项指标的运动记录列表  
- `total_count`：活动总次数  
- `total_duration_minutes`：总运动时长（分钟）  
- `total_distance_km`：总运动距离（公里）  
- `total_calories`：总消耗卡路里  

每次活动包含：  
- `activity_type`：活动类型（跑步、骑行、游泳等）  
- `name`：活动名称  
- `start_time`：开始时间  
- `duration_minutes`：持续时长（分钟）  
- `distance_km`：运动距离（如适用）  
- `calories`：消耗卡路里  
- `avg_hr` / `max_hr`：心率数据  
- `source`：数据来源（garmin、strava 等）  

### 9. 获取今日行动项  

获取用户当日的行动检查清单。  

```
GET /api/v1/mcp/tools/get_today_actions?timezone={timezone}
```  

参数：  
- `timezone`（可选）：IANA 时区（例如 “America/New_York”），默认为 UTC  

返回内容：  
- `effective_date`：按用户所在时区计算的查询日期  
- `timezone`：用于计算的时区  
- `window_start` / `window_end`：当日时间边界（ISO 格式日期时间）  
- `actions`：今日行动项列表  
- `completed_count` / `total_count`：完成情况统计  
- `completion_pct`：完成率数值（0–100）  
- `last_updated_at`：缓存新鲜度指示器  

每项行动包含：  
- `action_id`：用于深度链接的稳定 ID  
- `title`：行动标题  
- `action_type`：类型（补充剂、习惯、饮食、药物、检测、医疗程序）  
- `completed`：今日是否已完成  
- `scheduled_window`：计划时段（早晨、下午、晚上、任意时段）  
- `dose_text`：如适用，显示剂量信息（例如 “1000 mg 每日”）  

### 10. 获取健康方案  

获取用户的 90 天健康方案及核心优先事项。  

```
GET /api/v1/mcp/tools/get_protocol
```  

返回内容：  
- `protocol_id`：稳定的方案 ID  
- `phase`：当前阶段（week1、month1、month3）  
- `days_remaining`：方案到期剩余天数  
- `generated_at` / `last_updated_at`：时间戳  
- `top_priorities`：前 5 项健康优先事项及理由说明  
- `key_recommendations`：饮食与生活方式行动建议  
- `total_actions`：方案中总行动项数  

每项优先事项包含：  
- `priority_id`：稳定 ID（与 rank 相同）  
- `rank`：优先级排名（1 = 最高）  
- `biomarker`：标准化生物标志物名称  
- `status`：当前状态（critical、concerning、suboptimal、optimal）  
- `target`：目标值及单位  
- `current_value` / `unit`：当前实测值  
- `measured_at`：该生物标志物最近一次检测时间  
- `why_prioritized`：此项被列为优先事项的原因说明  

**注意**：若尚无健康方案，将返回友好错误提示，并建议用户前往 gevety.com/protocol 创建方案。  

### 11. 获取即将进行的检测  

根据生物标志物历史记录及 AI 推荐，获取待执行或推荐的检测项目。  

```
GET /api/v1/mcp/tools/get_upcoming_tests
```  

返回内容：  
- `tests`：按紧急程度排序的待检项目列表  
- `overdue_count`：已逾期检测项目数  
- `due_soon_count`：30 天内到期的检测项目数  
- `recommended_count`：AI 推荐的检测项目数  
- `total_count`：待检项目总数  

每项检测包含：  
- `test_id`：用于深度链接的稳定 ID（格式为 `panel_{id}` 或 `recommended_{id}`）  
- `name`：检测或检测组合名称  
- `test_type`：类型（panel、biomarker、recommended）  
- `urgency`：优先级（overdue、due_soon、recommended）  
- `due_reason`：需执行该检测的原因（例如 “已于 2 周前逾期”、“AI 推荐”）  
- `last_tested_at`：该项检测最近一次执行时间（如适用）  
- `biomarkers`：所含生物标志物列表（适用于组合检测）  

## 评分解读  

### 健康寿命评分（0–100）  
| 区间 | 状态 | 含义 |  
|------|------|------|  
| 80–100 | OPTIMAL | 健康优化表现极佳 |  
| 65–79 | GOOD | 高于平均水平，尚有小幅提升空间 |  
| 50–64 | SUBOPTIMAL | 存在明显改善空间 |  
| <50 | NEEDS_ATTENTION | 多个方面亟需关注 |  

### 维度评分  
各健康维度独立评分：  
- **代谢维度**：血糖、胰岛素、血脂  
- **心血管维度**：心脏健康相关指标  
- **炎症维度**：hs-CRP、同型半胱氨酸  
- **激素维度**：甲状腺功能、睾酮、皮质醇  
- **营养维度**：维生素、矿物质  
- **肝/肾维度**：器官功能相关指标  

**重要提示**：可能出现总体评分高而某一维度评分低（或反之）的情形。`get_health_summary` 中的 `scoring_note` 字段将对此类情形作出解释。  

### 生物标志物状态标签  
| 标签 | 含义 |  
|------|------|  
| OPTIMAL | 处于循证医学定义的理想区间内 |  
| NORMAL | 处于实验室参考区间内 |  
| SUBOPTIMAL | 存在改善空间 |  
| HIGH/LOW | 超出实验室参考区间 |  
| CRITICAL | 需立即寻求医疗干预 |  

## 常见工作流  

### “我目前健康状况如何？”  
1. 调用 `list_available_data` 查看已追踪数据类型  
2. 调用 `get_health_summary` 获取整体健康概况  
3. 突出显示首要关注项及近期趋势  
4. 若存在 `scoring_note`，则解释评分差异原因  

### “我的维生素 D 情况如何？”  
1. 调用 `query_biomarker?biomarker=vitamin d`  
2. 展示历史记录、当前状态及变化趋势  
3. 对比最优参考区间与当前值  

### “我的 CRP 是多少？” / “我的炎症水平如何？”  
1. 调用 `query_biomarker?biomarker=crp`（返回为 “hs-CRP”）  
2. 展示数值及趋势  
3. 解释 hs-CRP 的临床意义（炎症标志物）  

### “我的睡眠/HRV 如何？”  
1. 调用 `get_wearable_stats?metric=sleep` 或 `?metric=hrv`  
2. 展示近期趋势与平均值  
3. 与健康基准值进行对比  

### “我应重点关注什么？”  
1. 调用 `get_opportunities?limit=5`  
2. 按健康寿命影响潜力排序，呈现前几项机会  
3. 解释每项生物标志物的功能及优化意义  

### “我的生理年龄是多少？”  
1. 调用 `get_biological_age`  
2. 若结果可用，对比生理年龄与日历年龄  
3. 解释“年龄加速”的含义  
4. 若结果不可用，说明所需补充的检测项目  

### “我正在服用哪些补充剂？”  
1. 调用 `list_supplements?active_only=true`  
2. 列出当前服用的补充剂及其剂量（使用 `dose_text` 字段）  
3. 注明每种补充剂的已服用时长  

### “我最近完成了哪些锻炼？”  
1. 调用 `get_activities?days=30`  
2. 汇总总运动量（时长、卡路里、距离）  
3. 列出近期锻炼及关键指标  

### “我今天该做什么？”  
1. 调用 `get_today_actions?timezone=America/New_York`（如已知用户时区，请使用该时区）  
2. 按计划时段（早晨、下午、晚上）对行动项分组  
3. 展示完成进度  
4. 突出显示未完成的行动项  

### “我应重点关注什么？” / “我的健康优先事项是什么？”  
1. 调用 `get_protocol`  
2. 呈现核心优先事项，含当前值与目标值对比  
3. 解释每项优先事项的依据  
4. 列出关键建议  
5. 注明当前方案阶段及剩余天数  

### “我接下来该做哪些检测？” / “我是否该复查血液指标？”  
1. 调用 `get_upcoming_tests`  
2. 优先突出已逾期的检测项目（紧急）  
3. 列出即将到期的检测项目及具体时限  
4. 提及 AI 推荐的优化类检测项目  
5. 注明各检测组合所覆盖的生物标志物  

## 示例 API 调用  

```javascript
// Using web_fetch
web_fetch({
  url: "https://api.gevety.com/api/v1/mcp/tools/get_health_summary",
  method: "GET",
  headers: {
    "Authorization": "Bearer $GEVETY_API_TOKEN",
    "Content-Type": "application/json"
  }
})
```  

## 重要准则  

1. **切勿诊断**——清晰呈现数据，但始终建议用户就医疗决策咨询专业医护人员  
2. **趋势比单次数值更重要**——一次略高的读数若呈改善趋势，优于一次正常读数却呈下降趋势  
3. **注意数据时效性**——实验室结果可能滞后数周或数月；可穿戴设备数据通常为每日更新  
4. **上下文至关重要**——主动询问补充剂、药物或生活方式改变等可能影响趋势的因素  
5. **隐私优先**——健康数据高度敏感；切勿在本对话之外分享或引用具体数值  

## 错误处理  

| 错误码 | 含义 | 应对措施 |  
|--------|------|----------|  
| 401 | 令牌无效或已过期 | 用户需前往 gevety.com/settings 重新生成令牌 |  
| 404 + `did_you_mean` | 未找到生物标志物 | 根据响应中的建议提供替代名称 |  
| 404 | 未找到数据 | 用户可能尚未上传实验室报告 |  
| 429 | 请求频率超限 | 稍候片刻后重试 |  

## 获取令牌  

用户可在以下地址生成其 API 令牌：  
**https://gevety.com/settings** → 开发者 API → 生成令牌  

令牌格式为 `gvt_` 后接随机字符。  

## 检查更新  

每次会话首次使用时，可选择性检查更新：  

```
GET https://api.gevety.com/api/v1/mcp/tools/status
```  

无需认证。若请求失败或超时，则跳过检查并正常继续。  

成功响应如下：  
```json
{
  "clawdbot_skill": { "latest": "1.4.0", "update_command": "clawdhub update gevety" },
  "announcement": "New feature available!"
}
```  

**若 `clawdbot_skill.latest` > 1.4.0**（即本技能当前版本），请告知用户：  
> "A Gevety skill update is available. Run: `clawdhub update gevety`"  

**若响应中包含 `announcement`**，则每会话仅提示一次。  

**若状态检查失败**，请勿提及——直接处理用户当前请求即可。  

手动更新方法：  
```bash
clawdhub update gevety
```