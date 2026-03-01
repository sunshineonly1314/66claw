---
name: dvsa-tc-audit-readiness-operator-licence-uk
name_zh: 英国运输牌照审计准备
description: 生成 DVSA/交通事务专员（Traffic Commissioner）“请出示”式审计就绪检查清单与证据索引。在准备接受审计或运营商执照审查时使用。
description_zh: 生成 DVSA/交通事务专员（Traffic Commissioner）“请出示”式审计就绪检查清单与证据索引。在准备接受审计或运营商执照审查时使用。
---
# DVSA 与交通事务专员（Traffic Commissioner）审计就绪（英国）

## 目的
生成“请出示”式就绪材料：当日检查清单、证据索引，以及一份与运营商执照敏感性及审计预期相一致的差距登记表。

## 使用时机
- “为我准备 DVSA 实地访问，并提供今日可用的检查清单。”
- “为客户 [CUSTOMER] 创建客户审计响应包，并列出差距项。”
- “构建一份运营商执照合规性证据索引。”
- “今天我们需要准备好向审核员出示哪些材料？”

**以下情形请勿使用：**
- 请求仅为泛泛而谈的合规性讨论，且无需交付具体成果物。
- 纯运营类/客户服务类请求（如路线、定价、绩效等），不以合规为导向。

## 输入项
- **必需项：**
  - 审计背景（DVSA 实地访问 / 交通事务专员问询准备 / 客户审计）及日期
  - 范围：涉及的车场/运营中心/车队，以及时间范围（例如最近 28 天或 90 天）
- **可选项：**
  - 贵方内部标准操作规程（SOP）/政策（可粘贴文本）及记录保存规则
  - 此前审计发现的问题及整改措施
- **示例：**
  - “今日 DVSA 将赴 X 车场进行实地访问；需提供‘请出示’检查清单及证据索引。”

## 输出项
- `dvsa-visit-today-checklist.md`
- `audit-evidence-index.md`（适用于 Excel 的表格格式）
- `gaps-register.md`
- 成功标准：
  - 条目切实可行、可核查
  - 明确标注“何处可查”
  - 突出运营商执照敏感点（但不得超出贵方政策文本范围作法律主张）

## 工作流
1. 确认审计类型与范围。  
   - 若信息缺失 → **立即暂停并询问用户**，获取审计类型、车场/车队及时间范围。
2. 基于 `assets/dvsa-visit-today-checklist-template.md` 生成今日“请出示”检查清单。
3. 基于 `assets/audit-evidence-index-template.md` 构建证据索引（含内容、存储位置、责任人、保存期限、最后更新时间）。
4. 识别潜在差距：  
   - 将未知项标记为“差距——待确认来源/责任人”。  
   - 通过 `assets/gaps-register-template.md` 输出 `gaps-register.md`。
5. 运营商执照敏感性处理：  
   - 新增简短章节，引用 `references/operator-licence-sensitivity-placeholders.md`，并与贵方内部政策映射。
6. 若用户希望编辑现有文件 → **务必先征得用户同意**。

## 输出格式
```text
# dvsa-visit-today-checklist.md
Audit type:
Scope:
Date:

## Immediate readiness (today)
- …

## Documents to pull (and where)
- …

## People/process readiness (“show me”)
- …

## Known risks / sensitivities
- …
```

## 安全性与边界情况
- 不得自行编造记录保存期限或法定义务；如有需要，请向用户索取内部政策文本。
- 若被问及“这是否合法？”，应立即暂停，并要求用户提供具体记录及期望输出的成果物。

## 示例
- 输入：“今日 DVSA 访问”  
  - 输出：用于快速响应的检查清单 + 证据索引 + 差距登记表