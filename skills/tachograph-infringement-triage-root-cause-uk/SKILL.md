---
name: tachograph-infringement-triage-root-cause-uk
name_zh: 里程表违规根因分析（英国）
description: 对转速表（tachograph）违规行为进行分类排查，识别常见模式，并输出“下一步需核查事项”提示及周度审查备注。在执行周度转速表/WTD 审查时使用。
description_zh: 对转速表（tachograph）违规行为进行分类排查，识别常见模式，并输出“下一步需核查事项”提示及周度审查备注。在执行周度转速表/WTD 审查时使用。
---
# 转速表违规分类排查与根因提示（英国适用）

## 目的  
运行一项周度审查工作流，将违规输出转化为清晰的分类排查备注、根因提示以及“下一步需核查事项”。

## 使用时机  
- “为这些驾驶员开展本周转速表及工时指令（WTD）合规性审查。”  
- “对这些违规行为进行分类排查，并告知我下一步需核查什么。”  
- “将这份 PDF 违规报告摘要整理为具体行动项及驾驶员跟进事项。”

**切勿在以下情形中使用：**  
- 仅需向单个驾驶员发送消息（请使用 infringement coach skill）。  
- 仅需了解通用规则解释而无具体记录支撑。

## 输入项  
- **必需项：**  
  - 驾驶员名单 + 时间范围  
  - 违规摘要（CSV/PDF 提取内容或粘贴的文本行）  
- **可选项：**  
  - 任何已知运营背景信息（线路、延误、多点配送、轮渡/火车运输、人员配置等）  
  - 先前 RAG 历史记录  
- **示例：**  
  - “驾驶员 A–F，附上上周违规报告 PDF；需生成周度审查包。”

## 输出项  
- `weekly-tacho-wtd-review.md`（面向管理者）  
- `triage-actions-by-driver.md`  
- 成功标准：  
  - 每类违规均明确列出“下一步核查事项”  
  - 标注出可能接近调查/纪律处分阈值的情形（依贵司政策而定）

## 工作流  
1. 确认审查周期与驾驶员名单。  
   - 若缺失 → **立即中止并询问用户**。  
2. 将违规信息标准化为按驾驶员归类的列表（仅含事实性内容）。  
3. 使用 `references/common-infringement-patterns.md` 扫描违规模式。  
4. 针对每位驾驶员生成：  
   - 可能的根因提示（需提出的问题、需开展的运营核查）  
   - 使用 `assets/what-to-check-next-playbook.md` 制定“下一步需核查事项”  
5. 使用 `assets/weekly-review-pack-template.md` 生成周度审查包。  
6. 若 RAG 升级依赖于缺失的历史记录 → **立即中止并询问用户**，以获取相关数量统计或处理结果。

## 输出格式  
```text
# triage-actions-by-driver.md
Period:
Sources:

## Driver [X]
Infringements (facts):
- …

What to check next:
- …

Root-cause prompts:
- …

Proposed follow-up:
- Coaching / monitoring / investigation trigger (per policy)
```

## 安全性与边界情况  
- 若记录显示不完整（如缺漏日期、下载存在空档），应将其标记为风险/缺口，而非猜测原因。  
- 避免使用归咎性措辞；保持分类排查过程客观中立。

## 示例  
- 输入：“对 12 名驾驶员开展周度审查”  
  - 输出：周度审查包 + 每位驾驶员的分类排查行动项及“下一步核查”提示  