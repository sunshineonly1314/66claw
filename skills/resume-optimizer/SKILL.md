---
name: resume-optimizer
name_zh: 简历优化器
description: 具备 PDF 导出、ATS 优化与分析能力的专业简历构建工具。当用户需要（1）从零创建新简历，（2）针对特定岗位定制/优化现有简历，（3）分析简历并提供改进建议，（4）将简历转换为 ATS 友好的 PDF 格式时，请使用本工具。支持时间顺序型、功能型及组合型三种简历格式。
description_zh: 具备 PDF 导出、ATS 优化与分析能力的专业简历构建工具。当用户需要（1）从零创建新简历，（2）针对特定岗位定制/优化现有简历，（3）分析简历并提供改进建议，（4）将简历转换为 ATS 友好的 PDF 格式时，请使用本工具。支持时间顺序型、功能型及组合型三种简历格式。
---
# 简历优化器

构建专业、适配 ATS 的简历，并支持 PDF 导出功能。

## 能力

1. **创建简历** —— 基于用户提供的信息，以专业排版方式生成新简历  
2. **定制简历** —— 针对特定岗位或按用户需求，调整优化现有简历  
3. **分析简历** —— 审阅简历内容，并提供切实可行的改进建议  
4. **导出为 PDF** —— 生成可供下载、适配 ATS 的 PDF 文档  

## 工作流决策树

### 创建新简历
1. 收集用户信息（工作经历、教育背景、skills、目标岗位）  
2. 选择合适格式（参见下方格式选择指南）  
3. 阅读 `references/templates.md` 获取所选模板内容  
4. 按照 `references/best-practices.md` 构建简历正文  
5. 使用 `scripts/generate_resume_pdf.py` 生成 PDF  

### 定制现有简历
1. 审阅所提供简历内容  
2. 明确目标岗位或用户提出的修改需求  
3. 阅读 `references/ats-optimization.md` 了解关键词整合方法  
4. 遵循最佳实践实施修改  
5. 生成更新后的 PDF  

### 分析简历
1. 解析简历内容  
2. 对照 `references/analysis-checklist.md` 中的评估标准进行核查  
3. 识别优势与待改进之处  
4. 提供具体、可操作的改进建议  
5. （可选）主动提出代为实施修改  

## 格式选择指南

**时间顺序型（最常用）**  
- 适用场景：同一领域内工作经历连贯、职业发展路径清晰  
- 最适合：长期深耕本领域的大多数专业人士  
- 参考：`references/templates.md` → 时间顺序型模板章节  

**功能型**  
- 适用场景：职业转型者、存在就业空窗期者、强调可迁移 skills 者  
- 最适合：重返职场者、跨领域经验丰富者  
- 参考：`references/templates.md` → 功能型模板章节  

**组合型**  
- 适用场景：中年职场人士，需兼顾 skills 与职业发展轨迹  
- 最适合：技能组合多元者、具备相关经验的职业转型者  
- 参考：`references/templates.md` → 组合型模板章节  

## PDF 生成

使用所提供的脚本生成专业 PDF：

```bash
python3 scripts/generate_resume_pdf.py \
  --input resume_content.json \
  --output resume.pdf \
  --format chronological
```

该脚本基于 reportlab 生成简洁、适配 ATS 的 PDF，具备以下特性：  
- 专业字体排印（Helvetica）  
- 规范边距与行间距（四边均为 0.75 英寸）  
- 清晰的章节标题  
- 项目符号格式化  
- 一致的视觉层级结构  

## 关键参考资料

创建任何简历前，请务必阅读：  
1. `references/best-practices.md` —— 简历撰写核心原则  
2. `references/ats-optimization.md` —— ATS 兼容性要求  
3. `references/templates.md` —— 各格式专用模板  

分析简历前，请务必阅读：  
1. `references/analysis-checklist.md` —— 评估标准与评分细则  

## 快速上手示例

**创建简历：**  
```
User: "Help me build a resume. I have 5 years in marketing."

Steps:
1. Gather: Current role, key achievements, education, certifications
2. Format: Chronological (clear progression in same field)
3. Build: Use template from references/templates.md
4. Keywords: Integrate from job description per ats-optimization.md
5. Export: Generate PDF to /mnt/user-data/outputs/
```  

**针对岗位定制：**  
```
User: "Tailor my resume for this job [job description]"

Steps:
1. Parse job description for required skills/keywords
2. Identify gaps between resume and requirements
3. Reorder bullets to lead with relevant achievements
4. Integrate keywords naturally throughout
5. Update summary to mirror key requirements
6. Generate updated PDF
```  

**分析简历：**  
```
User: "Review my resume and tell me how to improve it"

Steps:
1. Read references/analysis-checklist.md
2. Evaluate each section against criteria
3. Score: Content, Format, ATS-compatibility
4. Identify top 3-5 priority improvements
5. Provide specific rewrite examples
6. Offer to implement changes
```  

## 输出要求

所有生成的简历必须满足：  
- 保存至 `/mnt/user-data/outputs/` 供用户下载  
- 使用描述性文件名：`FirstName_LastName_Resume.pdf`  
- 通过 `computer://` 协议提供下载链接  
- 遵循 ATS 友好格式（禁用表格、文本框及图形元素）  

## 代码风格

生成用于 PDF 创建的 Python 脚本时：  
- 使用 reportlab 进行 PDF 生成  
- 保持代码简洁、功能明确  
- 妥善处理异常  
- 在交付用户前验证输出效果  