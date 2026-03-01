---
name: cpc-mpqc-competence-tracker-compliance-uk
name_zh: 英国合规追踪器
description: 规划 CPC/MPQC 胜任力跟踪，含提醒、证据清单及合规性报告。在维护培训/认证就绪状态时使用。
description_zh: 规划 CPC/MPQC 胜任力跟踪，含提醒、证据清单及合规性报告。在维护培训/认证就绪状态时使用。
---
# CPC/MPQC 培训与胜任力跟踪（英国）

## 目的
维护可供审计的培训与胜任力证据：包括一个矩阵、一份提醒计划，以及一份合规性报告视图。

## 使用时机
- “培训与胜任力跟踪：CPC/MPQC 规划、提醒、认证证据、合规性报告。”
- “为下周编写一份关于驾驶员工时与休息时间的工具箱会议材料。”（当该任务与胜任力证据相关联时）
- “生成本月/本季度的合规性培训报告。”

**切勿在以下情形中使用……**
- 与合规性证据无关的通用学习内容。
- 对 PowerPoint 演示文稿或公司价值观手册等资料的请求。

## 输入项
- **必需项：**
  - 驾驶员名单（姓名/ID）、角色、车队基地
  - 所需培训类型（CPC 模块、MPQC、内部工具箱会议）
- **可选项：**
  - 到期日期、证书、提供商、过往完成记录
  - 关于培训频次/必修模块的内部政策（粘贴文本）
- **示例：**
  - “需要一份月度报告及即将到期的 MPQC 提醒。”

## 输出项
- `training-matrix.md`（可直接导入 Excel）
- `reminders-plan.md`
- `compliance-training-report.md`
- 成功标准：
  - 具备完备的证据字段（何人/何事/何时/证据）
  - 明确标出即将到期事项及其责任人

## 工作流
1. 确认所需培训集及报告周期。
   - 若信息缺失 → **立即中止并询问用户**。
2. 使用 `assets/training-matrix-template.md` 创建或更新培训矩阵。
3. 使用 `assets/reminder-plan-template.md` 构建提醒日程。
4. 使用 `assets/compliance-report-template.md` 起草合规性报告。
5. 证据标准：
   - 参考 `references/competence-evidence-standard.md`，并映射至贵司内部存储位置。
6. 若被要求更新现有跟踪器 → **务必先征得用户确认**。

## 输出格式
```text
# training-matrix.md
| Driver | Role | CPC due | CPC last completed | MPQC expiry | Last toolbox talk | Evidence link/location | Status (RAG) | Notes |
|--------|------|---------|-------------------|-------------|-------------------|------------------------|--------------|------|
```

## 安全性与边界情况
- 不得虚构证书编号或日期；对未知信息须明确标注。
- 若不同客户/站点的培训要求存在差异，请创建“客户/站点差异”章节，并向用户索要具体细节。

## 示例
- 输入：“为 MPQC 到期日规划提醒”
  - 输出：矩阵 + 提醒计划 + 月度报告草稿