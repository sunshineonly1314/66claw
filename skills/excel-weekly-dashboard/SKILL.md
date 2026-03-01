---
name: excel-weekly-dashboard
name_zh: Excel周报看板
description: 构建可刷新的 Excel 仪表板（基于 Power Query + 结构化表格 + 数据校验 + 数据透视报表）。适用于需要每周重复更新 KPI 报表、且人工干预极少的场景。
description_zh: 构建可刷新的 Excel 仪表板（基于 Power Query + 结构化表格 + 数据校验 + 数据透视报表）。适用于需要每周重复更新 KPI 报表、且人工干预极少的场景。
---
# 大规模 Excel 周度仪表板构建

## 目的  
构建可刷新的 Excel 仪表板（集成 Power Query + 结构化表格 + 数据校验 + 数据透视报表）。

## 适用场景  
- 触发条件（满足任一即适用）：  
  - “为该文件构建一条 Power Query 流水线，使其能每周自动刷新，无需任何人工操作。”  
  - “将该数据转为结构化表格，并配置下拉校验列表与规范的数据录入规则。”  
  - “创建一个基于数据透视表的周度仪表板，并配备年份与 ISO 周筛选器（Slicers）。”  
  - “修复当前 Excel 模型，确保新增列后刷新不会中断。”  
  - “设计一套可复用的 KPI 模板包，支持从一个 CSV 文件夹自动更新。”  
- 不适用场景（请勿使用）：  
  - 需要高级预测/估值建模（本 skill 专为可复用报表流水线设计）。  
  - 需要构建 BI 工具（如 Power BI / Tableau），而非 Excel 解决方案。  
  - 主要数据采集方式为网页抓取（Web Scraping）。

## 输入要求  
- 必需输入：  
  - 源数据文件（CSV / XLSX / DOCX 导出表格 / PDF 导出表格），由用户提供。  
  - “周”的定义（推荐使用 ISO 周）及所需 KPI 字段。  
- 可选输入：  
  - 数据字典或字段定义说明。  
  - 已知的“脏数据”模式（例如 PayNumber 为空、日期格式非法等），用于校验。  
  - 待重构的现有工作簿。  
- 示例输入：  
  - 每周导出的 CSV 文件夹：`exports/2026-W02/*.csv`  
  - 单个 XLSX 数据快照，每月列结构可能变动  

## 输出内容  
- 若仅请求 **方案（默认）**：提供分步构建计划 + Power Query 实现步骤 + 工作表布局 + 校验规则。  
- 若明确要求 **生成制品（artifacts）**：  
  - `workbook_spec.md`（工作簿结构与命名表格）  
  - `power_query_steps.pq`（M 语言代码模板）  
  - `refresh-checklist.md`（源自 `assets/`）  
成功标准：添加新一周文件后，无需人工修改即可完成刷新；且校验机制能准确捕获异常数据行。

## 工作流程  
1. 识别源类型（CSV/XLSX/DOCX/PDF 导出）及稳定业务主键（如 PayNumber）。  
2. 定义标准数据表结构（canonical schema）：  
   - 必填列、数据类型、允许值范围、以及“未知值”的处理策略。  
3. 设计 Power Query 数据接入方案：  
   - 优先采用 **文件夹批量接入 + 合并**，并加入防御性“缺失列”处理逻辑。  
   - 统一规范化列名（去除首尾空格、统一大小写、合并连续空格）。  
4. 设计清洗与校验流程：  
   - 创建 **Data_Staging** 查询（原始数据 → 标准化）与 **Data_Clean** 查询（经校验后数据）。  
   - 添加校验列（例如 `IsValidPayNumber`、`IsValidDate`、`IssueReason`）。  
5. 构建报表层：  
   - 基于 **Data_Clean** 构建数据透视表。  
   - 添加筛选器（Slicers）：年份、ISO 周；以及运营维度字段。  
6. 添加“刷新状态”工作表（Refresh Status）：  
   - 最近刷新时间戳、各表行数统计、查询错误标志、最新 ISO 周是否存在等。  
7. 出现以下情况时，**立即暂停并询问用户**：  
   - 所需 KPI 或字段未明确说明；  
   - 源文件中不存在任何稳定业务主键；  
   - “周”的定义或时区规则不清晰；  
   - PDF/DOCX 表格无法可靠提取（除非用户已提供导出后的 CSV/XLSX 文件）。

## 输出格式  
当输出 **方案** 时，请严格使用如下模板：

```text
WORKBOOK PLAN
- Sheets:
  - Data_Staging (query output)
  - Data_Clean (query output + validation flags)
  - Dashboard (pivots/charts)
  - Refresh_Status (counts + health checks)
- Canonical Schema:
  - <Column>: <Type> | Required? | Validation
- Power Query:
  - Query 1: Ingest_<name> (Folder/File)
  - Query 2: Clean_<name>
  - Key transforms: <bullets>
- Validation rules:
  - <rule> -> <action>
- Pivot design:
  - Rows/Columns/Values
  - Slicers
```

若用户明确要求生成制品，则额外输出：  
- `assets/power-query-folder-ingest-template.pq`（已适配）  
- `assets/refresh-checklist.md`

## 安全性与边界情况处理  
- 默认只读：除非用户明确要求生成文件，否则仅提供方案与代码片段。  
- 绝不删除或覆盖用户原始文件；所有输出均建议使用新文件名。  
- 坚持“不静默失败”原则：包含行数校验与可见错误标记。  
- 对 PDF/DOCX 类源，必须要求用户提供导出后的 CSV/XLSX 表格；或明确标注提取风险。

## 示例  
- 输入：“含 PayNumber/Name/Date 字段的每周 CSV 文件夹。”  
  输出：文件夹接入 Power Query 模板 + 数据结构定义 + 刷新状态校验 + 数据透视仪表板设计方案。  

- 输入：“新增列后刷新即失败。”  
  输出：防御性缺失列处理逻辑 + 列名标准化方案 + 强类型 Schema 设计方案。  