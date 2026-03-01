---
name: ui-audit
name_zh: UI审计
description: "AI skill for automated UI audits. Evaluate interfaces against proven UX principles for visual hierarchy, accessibility, cognitive load, navigation, and more. Based on Making UX Decisions by Tommy Geoco."
description_zh: AI skill for automated UI audits. Evaluate interfaces against proven UX principles for visual hierarchy, accessibility, cognitive load, navigation, and more. Based on Making UX Decisions by Tommy Geoco.
author: Tommy Geoco
homepage: https://audit.uxtools.co
logo: logo-light.png
logoDark: logo-dark.png
---
# UI 审查技能（UI Audit Skill）

依据经验证的用户体验（UX）原则评估界面。该技能基于 Tommy Geoco 所著《Making UX Decisions》（《做出 UX 决策》）一书。

## 何时使用本技能

- 在时间压力下制定 UI/UX 设计决策  
- 结合业务背景权衡设计取舍  
- 针对特定问题选择合适的 UI 模式  
- 审查设计方案的完整性与质量  
- 为新界面构建结构化的设计思维框架  

## 核心理念

**速度 ≠ 草率。** 快速设计本身并非草率；草率地快速设计才是草率。二者之别在于是否具备明确意图。

## “极速决策”的三大支柱

1. **脚手架（Scaffolding）** —— 用于自动化重复性决策的规则  
2. **决策流程（Decisioning）** —— 用于制定新决策的过程  
3. **精工实践（Crafting）** —— 用于执行决策的检查清单  

## 快速参考结构

### 基础框架
- `references/00-core-framework.md` —— 三大支柱、决策流程、宏观押注（macro bets）  
- `references/01-anchors.md` —— 支撑设计韧性的七大基础思维模式  
- `references/02-information-scaffold.md` —— 心理学、经济学、无障碍性、默认值  

### 检查清单（执行层面）
- `references/10-checklist-new-interfaces.md` —— 设计新界面的六步流程  
- `references/11-checklist-fidelity.md` —— 组件状态、交互、可扩展性、反馈  
- `references/12-checklist-visual-style.md` —— 间距、色彩、层级、排版、动效  
- `references/13-checklist-innovation.md` —— 原创性光谱的五个层级  

### 模式（可复用方案）
- `references/20-patterns-chunking.md` —— 卡片、标签页、手风琴、分页、轮播图  
- `references/21-patterns-progressive-disclosure.md` —— 工具提示、弹出框、抽屉、模态框  
- `references/22-patterns-cognitive-load.md` —— 步骤条、向导、极简导航、简化表单  
- `references/23-patterns-visual-hierarchy.md` —— 排版、色彩、留白、尺寸、邻近性  
- `references/24-patterns-social-proof.md` —— 用户评价、用户生成内容（UGC）、徽章、社交集成  
- `references/25-patterns-feedback.md` —— 进度条、通知、验证、上下文帮助  
- `references/26-patterns-error-handling.md` —— 表单验证、撤销/重做、对话框、自动保存  
- `references/27-patterns-accessibility.md` —— 键盘导航、ARIA、替代文本（alt text）、对比度、缩放  
- `references/28-patterns-personalization.md` —— 仪表盘、自适应内容、用户偏好、本地化（l10n）  
- `references/29-patterns-onboarding.md` —— 引导游览、上下文提示、教程、检查清单  
- `references/30-patterns-information.md` —— 面包屑、站点地图、标签、多维筛选搜索  
- `references/31-patterns-navigation.md` —— 优先级导航、抽屉式导航、粘性导航、底部导航  

## 使用说明

### 针对设计决策
1. 阅读 `00-core-framework.md` 了解决策流程  
2. 判断该决策是否为重复性决策（使用脚手架）或全新决策（使用流程）  
3. 运用三步权衡法：机构知识 → 用户熟悉度 → 研究证据  

### 针对新界面
1. 遵循 `10-checklist-new-interfaces.md` 中的六步检查清单  
2. 参考相关模式文件，获取具体 UI 组件指导  
3. 使用保真度与视觉风格检查清单提升质量  

### 针对模式选择
1. 明确核心问题（如信息分块、内容披露、认知负荷等）  
2. 加载对应模式参考文档  
3. 评估其优势、适用场景、心理学原理及实施指南  

## 决策流程摘要

面对 UI 决策时：

```
1. WEIGH INFORMATION
   ├─ What does institutional knowledge say? (existing patterns, brand, tech constraints)
   ├─ What are users familiar with? (conventions, competitor patterns)
   └─ What does research say? (user testing, analytics, studies)

2. NARROW OPTIONS
   ├─ Eliminate what conflicts with constraints
   ├─ Prioritize what aligns with macro bets
   └─ Choose based on JTBD support

3. EXECUTE
   └─ Apply relevant checklist + patterns
```

## 宏观押注（Macro Bet）类别

企业通过以下一项或多项赢得竞争：

| 押注 | 描述 | 设计启示 |
|-----|-------------|-------------------|
| **速度（Velocity）** | 更快地将功能推向市场 | 复用已有模式，借鉴其他领域的隐喻 |
| **效率（Efficiency）** | 更好地管理浪费 | 构建设计系统，减少在制品（WIP） |
| **准确性（Accuracy）** | 更频繁地做出正确决策 | 强化研究能力，加强数据埋点 |
| **创新（Innovation）** | 发掘尚未开发的潜力 | 探索新颖模式，跨领域汲取灵感 |

始终确保微观设计决策与企业的宏观押注保持一致。

## 关键原则：优秀的设计决策是相对的

一项设计决策是否“优秀”，取决于它是否：
- 支持产品的“待办任务（jobs-to-be-done）”  
- 与公司宏观押注相一致  
- 尊重现实约束（时间、技术、团队）  
- 在用户熟悉度与差异化需求之间取得平衡  

不存在普适正确的 UI 解决方案——只有情境恰当的方案。

---

## 生成审查报告

当被要求审查某设计时，请生成一份全面的报告。以下部分必须包含：

### 必含部分（始终包含）
1. **视觉层级（Visual Hierarchy）** —— 标题、主行动按钮（CTA）、分组、阅读流、字号体系、色彩层级、留白  
2. **视觉风格（Visual Style）** —— 间距一致性、色彩运用、层级/深度表现、排版、动效/动画  
3. **无障碍性（Accessibility）** —— 键盘导航、焦点状态、对比度比率、屏幕阅读器支持、触控目标大小  

### 情境相关部分（按需包含）
4. **导航（Navigation）** —— 针对多页应用：寻路、面包屑、菜单结构、信息架构  
5. **可用性（Usability）** —— 针对交互流程：可发现性、反馈、错误处理、认知负荷  
6. **新手引导（Onboarding）** —— 针对新用户：首次运行体验、教程、渐进式披露  
7. **社会认同（Social Proof）** —— 针对落地页/营销页：用户评价、信任信号、社交集成  
8. **表单（Forms）** —— 针对数据录入：标签、验证、错误信息、字段类型  

### 审查输出格式

```json
{
  "title": "Design Name — Screen/Flow",
  "project": "Project Name",
  "date": "YYYY-MM-DD",
  "figma_url": "optional",
  "screenshot_url": "optional - URL to screenshot",
  
  "macro_bets": [
    { "category": "velocity|efficiency|accuracy|innovation", "description": "...", "alignment": "strong|moderate|weak" }
  ],
  
  "jtbd": [
    { "user": "User Type", "situation": "context without 'When'", "motivation": "goal without 'I want to'", "outcome": "benefit without 'so I can'" }
  ],
  
  "visual_hierarchy": {
    "title": "Visual Hierarchy",
    "checks": [
      { "label": "Check name", "status": "pass|warn|fail|na", "notes": "Details" }
    ]
  },
  "visual_style": { ... },
  "accessibility": { ... },
  
  "priority_fixes": [
    { "rank": 1, "title": "Fix title", "description": "What and why", "framework_reference": "XX-filename.md → Section Name" }
  ],
  
  "notes": "Optional overall observations"
}
```

### 各部分检查项（每部分建议 6–10 条）

**视觉层级**：标题区分度、主行动清晰度、分组/邻近性、阅读流、字号体系、色彩层级、留白使用、视觉权重平衡  

**视觉风格**：间距一致性、配色方案遵循度、层级/阴影效果、排版系统、边框/圆角一致性、图标风格、动效原则  

**无障碍性**：键盘可操作性、可见焦点、色彩对比度（≥4.5:1）、触控目标（≥44px）、替代文本（alt text）、语义化标记、减少运动支持  

**导航**：当前位置清晰、菜单行为可预期、面包屑存在性、搜索可访问性、移动端导航模式  

**可用性**：功能可发现性、操作反馈、错误预防、恢复选项、认知负荷管理、加载状态  