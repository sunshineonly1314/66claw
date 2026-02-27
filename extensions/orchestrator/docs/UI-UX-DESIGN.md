# Agent Team Orchestrator — UI/UX 交互设计文档

> **版本**: 2.0
> **日期**: 2026-02-22
> **模块**: `extensions/orchestrator/`
> **前置**: 基于 `docs/AGENT-TEAM-GUIDED-ORCHESTRATION.md` 方案
> **视觉基调**: Magic — 大气、克制、高级感。不用 emoji 堆砌，用光影、渐变、动效说话。

---

## 一、视觉语言

### 1.1 设计基调

**关键词**：`克制` `高级` `Magic` `暗夜中的光`

不是 AI 产品常见的 emoji 乐园，而是像 Linear / Vercel / Raycast 那样——

- **色彩不是装饰，是信号**。只在关键时刻用渐变和光晕
- **空间即层次**。用留白和间距建立视觉呼吸感
- **动效是功能**。shimmer 表示加载，glow 表示聚焦，不是花活
- **文字排版即设计**。用字重、字号、letter-spacing 构建层次，不靠图标

### 1.2 色彩系统

延续项目已有的 indigo → violet 渐变体系，但更收敛地使用：

```
品牌渐变（仅用于入口、标题、关键 CTA）:
  linear-gradient(135deg, #6366f1, #8b5cf6)

光晕（仅用于 hover/focus 状态）:
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.15)

文字渐变（仅用于主标题）:
  background: linear-gradient(135deg, #a78bfa, #818cf8, #6366f1)
  background-clip: text

状态色:
  完成  → var(--ok)      不加装饰，一个色块足够
  进行  → var(--accent)  带 shimmer 光扫
  等待  → var(--muted)   最低存在感
  失败  → var(--danger)  不用红色背景，只用红色文字
```

### 1.3 排版层次

```
H1 场景标题  20px / 700 / -0.03em / gradient text
H2 区块标题  15px / 600 / -0.02em / var(--text-strong)
正文        14px / 400 / normal  / var(--text)
辅助说明     13px / 400 / normal  / var(--muted)
标签/徽章    11px / 600 / 0.04em  / uppercase / var(--muted)
等宽数据     13px / mono / var(--text)
```

### 1.4 图标策略

**不用 emoji**。用三种方式替代：

| 场景 | 方案 | 示例 |
|------|------|------|
| Agent 头像 | **纯字母首字符** + 渐变背景 | `P` (Project Manager) 在 indigo 渐变圆上 |
| 状态指示 | **CSS 伪元素** 圆点/线条 | `::before` 绿点 = 在线 |
| 操作按钮 | **纯文字** 或项目已有 SVG icon | `部署` 而不是 `🚀 部署` |
| 分类标识 | **色彩编码** | 不同角色用不同渐变色 |

Agent 头像的渐变色板（按角色自动分配）：

```css
/* 6 档渐变，按 agent index 轮替 */
.orch-avatar--0 { background: linear-gradient(135deg, #6366f1, #8b5cf6); }  /* indigo-violet */
.orch-avatar--1 { background: linear-gradient(135deg, #0ea5e9, #6366f1); }  /* sky-indigo */
.orch-avatar--2 { background: linear-gradient(135deg, #8b5cf6, #ec4899); }  /* violet-pink */
.orch-avatar--3 { background: linear-gradient(135deg, #14b8a6, #0ea5e9); }  /* teal-sky */
.orch-avatar--4 { background: linear-gradient(135deg, #f59e0b, #ef4444); }  /* amber-red */
.orch-avatar--5 { background: linear-gradient(135deg, #22c55e, #14b8a6); }  /* green-teal */
```

---

## 二、入口设计

### 2.1 入口位置

Agents 页面侧边栏底部，「+ 添加智能体」按钮下方。

```
┌────────────────────────────────┐
│  智能体              [刷新]    │
│  3 个已配置                    │
├────────────────────────────────┤
│                                │
│  ┌──────────────────────────┐  │
│  │ [P] 默认助手              │  │   ← .agent-row
│  │     default     默认      │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ [W] 工作助手              │  │
│  │     work                  │  │
│  └──────────────────────────┘  │
│                                │
│  [+ 添加智能体]                │   ← 现有按钮
│                                │
│  ┌──────────────────────────┐  │
│  │ ◆ 智能组队                │  │   ← 新按钮
│  │   AI 规划 · 一键部署       │  │      渐变顶线 + 微光
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

### 2.2 入口按钮样式

不用虚线边框，不用 emoji。用一条 **渐变顶线** + **微妙光晕** 表达 magic 感：

```css
.orch-entry {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: calc(100% - 16px);
  margin: 8px 8px 0;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--card);
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: left;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

/* 顶部渐变装饰线 — 唯一的彩色元素 */
.orch-entry::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa, #6366f1);
  background-size: 200% 100%;
  opacity: 0.8;
}

.orch-entry:hover {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.08);
}

.orch-entry:hover::before {
  animation: shimmer-line 2s ease-in-out infinite;
  opacity: 1;
}

@keyframes shimmer-line {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* 左侧渐变菱形标识 */
.orch-entry-mark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transform: rotate(0deg);
  transition: transform 0.3s ease;
}

.orch-entry:hover .orch-entry-mark {
  transform: rotate(3deg) scale(1.05);
}

.orch-entry-mark-inner {
  width: 10px;
  height: 10px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 2px;
  transform: rotate(45deg);
}

.orch-entry-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}

.orch-entry-sub {
  font-size: 11px;
  color: var(--muted);
  margin-top: 1px;
  letter-spacing: 0.01em;
}
```

**HTML 结构**：

```html
<button class="orch-entry" @click=${onOpenOrchestrator}>
  <div class="orch-entry-mark">
    <div class="orch-entry-mark-inner"></div>
  </div>
  <div>
    <div class="orch-entry-title">${t("orch.entryTitle")}</div>
    <div class="orch-entry-sub">${t("orch.entrySub")}</div>
  </div>
</button>
```

---

## 三、编排器主界面

### 3.1 布局结构

占据 `agents-main` 整个区域。三段式，大量留白：

```
┌─────────────────────────────────────────────────────────────┐
│  [← 返回]                        智能组队                    │  ← 顶栏
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ← 渐变分割线
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│              （对话区 / 欢迎页 / 结果页）                     │  ← 主内容
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐  [↑]   │  ← 输入栏
│  │                                                 │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 顶栏

```css
.orch-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 24px 16px;
  flex-shrink: 0;
  position: relative;
}

/* 顶栏底部的渐变分割线 */
.orch-header::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 24px;
  right: 24px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--border) 20%,
    rgba(99, 102, 241, 0.3) 50%,
    var(--border) 80%,
    transparent
  );
}

.orch-header-back {
  font: inherit;
  font-size: 13px;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.15s ease;
}

.orch-header-back:hover {
  color: var(--text-strong);
}

.orch-header-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-strong);
  flex: 1;
  text-align: center;
}
```

### 3.3 对话区

```css
.orch-thread {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scrollbar-width: thin;
}
```

### 3.4 消息气泡

克制的气泡，不区分左右对齐（不像微信聊天），统一布局更大气：

```css
/* AI 消息 — 无背景色，用排版说话 */
.orch-msg--ai {
  max-width: 680px;
  animation: rise 0.3s var(--ease-out) backwards;
}

.orch-msg--ai .orch-msg-content {
  font-size: 14px;
  line-height: 1.75;
  color: var(--text);
  letter-spacing: 0.005em;
}

/* 用户消息 — 极淡背景，区分身份 */
.orch-msg--user {
  max-width: 680px;
  align-self: flex-end;
}

.orch-msg--user .orch-msg-content {
  padding: 12px 18px;
  border-radius: var(--radius-lg);
  background: var(--secondary);
  border: 1px solid var(--border);
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-strong);
}
```

### 3.5 输入栏

```css
.orch-compose {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 16px 24px 20px;
  flex-shrink: 0;
}

.orch-input {
  flex: 1;
  min-height: 44px;
  max-height: 120px;
  padding: 11px 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--card);
  font: inherit;
  font-size: 14px;
  color: var(--text);
  resize: none;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.orch-input:focus {
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.06);
}

.orch-input::placeholder {
  color: var(--muted);
}

.orch-send {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  /* SVG arrow icon via inline, not emoji */
}

.orch-send:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.orch-send:disabled {
  opacity: 0.3;
  cursor: default;
  transform: none;
}
```

---

## 四、欢迎页

不用聊天机器人的口吻，用产品化的大气排版：

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                    智 能 组 队                               │  ← 渐变大标题
│                                                             │
│           描述你的场景，AI 为你规划最佳团队配置               │  ← 副标题
│                                                             │
│                                                             │
│    ┌──────────────────────────────────────────────────┐     │
│    │  从模板开始                                      │     │  ← 区块标题
│    │                                                  │     │
│    │  ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │     │
│    │  │ [顶部渐变线] │ │ [顶部渐变线] │ │ [顶部渐变] │ │     │  ← 模板卡片
│    │  │             │ │             │ │            │ │     │
│    │  │ 日常助手    │ │ 理财顾问    │ │ 学习教练   │ │     │
│    │  │             │ │             │ │            │ │     │
│    │  │ 日程管理、  │ │ 记账分析、  │ │ 学习计划、 │ │     │
│    │  │ 提醒待办    │ │ 预算建议    │ │ 答疑辅导   │ │     │
│    │  │             │ │             │ │            │ │     │
│    │  │ 2 个智能体  │ │ 2 个智能体  │ │ 3 个智能体 │ │     │
│    │  │             │ │             │ │            │ │     │
│    │  │ [一键部署]  │ │ [一键部署]  │ │ [一键部署] │ │     │
│    │  └─────────────┘ └─────────────┘ └────────────┘ │     │
│    └──────────────────────────────────────────────────┘     │
│                                                             │
│    ┌──────────────────────────────────────────────────┐     │
│    │  或者直接描述                                     │     │
│    │                                                  │     │
│    │  "帮我组建一个研发团队助手"                        │     │  ← 示例提示
│    │  "我想要一个客服+运营的 AI 团队"                   │     │
│    │  "搭建一个自媒体内容创作工作流"                    │     │
│    └──────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```css
/* 欢迎页容器 — 垂直居中 */
.orch-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px 24px;
  text-align: center;
  max-width: 720px;
  margin: 0 auto;
}

/* 渐变大标题 */
.orch-welcome-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, #a78bfa, #818cf8, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 10px;
}

.orch-welcome-sub {
  font-size: 15px;
  color: var(--muted);
  margin-bottom: 40px;
  letter-spacing: 0.01em;
}

/* 区块 */
.orch-section {
  width: 100%;
  text-align: left;
  margin-bottom: 24px;
}

.orch-section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 14px;
  padding-left: 2px;
}
```

### 4.1 模板卡片

不用 emoji icon，用 **渐变顶线色彩编码** + **纯文字排版**：

```css
.orch-tpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.orch-tpl {
  position: relative;
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: 20px 18px 16px;
  cursor: default;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
  box-shadow: var(--shadow-sm);
}

/* 每张卡片顶部有不同色的渐变线，区分模板 */
.orch-tpl::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.orch-tpl--0::before { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
.orch-tpl--1::before { background: linear-gradient(90deg, #0ea5e9, #6366f1); }
.orch-tpl--2::before { background: linear-gradient(90deg, #8b5cf6, #ec4899); }
.orch-tpl--3::before { background: linear-gradient(90deg, #14b8a6, #0ea5e9); }
.orch-tpl--4::before { background: linear-gradient(90deg, #f59e0b, #ef4444); }

.orch-tpl:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.orch-tpl-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 6px;
  letter-spacing: -0.01em;
}

.orch-tpl-desc {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  margin-bottom: 14px;
}

.orch-tpl-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.orch-tpl-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0.02em;
}

.orch-tpl-action {
  width: 100%;
}
```

### 4.2 示例提示

点击即填入输入框：

```css
.orch-examples {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.orch-example {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--card);
  font: inherit;
  font-size: 13px;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.orch-example:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.orch-example::before {
  content: "→ ";
  color: var(--muted);
}
```

---

## 五、引导式对话 — 交互组件

### 5.1 问题卡片

不用 emoji 前缀，用 **编号 + 渐变左边线** 区分：

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  了解几个关键信息，帮你精准规划：                      │
│                                                     │
│  ┃ 1  团队主要做什么工作？                           │
│  ┃                                                  │
│  ┃    ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  ┃    │ 项目管理  │ │ 内容创作  │ │ 客户服务  │       │
│  ┃    └──────────┘ └──────────┘ └──────────┘       │
│  ┃    ┌──────────┐ ┌──────────┐                    │
│  ┃    │ 研究分析  │ │ 数据处理  │                    │
│  ┃    └──────────┘ └──────────┘                    │
│                                                     │
│  ┃ 2  团队大概几个人？                               │
│  ┃                                                  │
│  ┃    ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  ┃    │ 2-3 人   │ │ 4-6 人   │ │ 7+ 人    │       │
│  ┃    └──────────┘ └──────────┘ └──────────┘       │
│                                                     │
│  ┃ 3  有什么特别偏好？                               │
│  ┃                                                  │
│  ┃    ┌──────────────┐ ┌──────────────┐            │
│  ┃    │ 注重隐私安全  │ │ 尽量省钱      │            │
│  ┃    └──────────────┘ └──────────────┘            │
│  ┃    ┌──────────────┐ ┌──────────────┐            │
│  ┃    │ 追求最快响应  │ │ 需要最强推理  │            │
│  ┃    └──────────────┘ └──────────────┘            │
│                                                     │
│  也可以直接输入你的具体描述                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

```css
.orch-question {
  position: relative;
  padding: 14px 16px 14px 20px;
  margin-top: 10px;
  /* 左侧渐变装饰线 */
  border-left: 2px solid;
  border-image: linear-gradient(to bottom, #6366f1, #8b5cf6) 1;
}

.orch-question-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.orch-question-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 12px;
}

.orch-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.orch-chip {
  padding: 8px 16px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--card);
  font: inherit;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.orch-chip:hover {
  background: var(--bg-hover);
  border-color: rgba(99, 102, 241, 0.3);
}

.orch-chip.selected {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.4);
  color: var(--accent);
  font-weight: 500;
}

.orch-question-hint {
  font-size: 12px;
  color: var(--muted);
  margin-top: 14px;
}
```

### 5.2 团队方案卡片

大气的方案展示，不用 emoji，用 **渐变头像 + 角色标签 + 留白**：

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  推荐以下方案：                                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │  研发团队助手                    3 个智能体协作       │    │
│  │  ──────────────────────────────────────────────────  │    │
│  │                                                     │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │  [P]  项目经理                              │     │    │
│  │  │       任务分解、进度跟踪、会议纪要            │     │    │
│  │  │                                            │     │    │
│  │  │       MODEL gpt-4o    TOOLS 日历·文件·记忆   │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  │                                                     │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │  [R]  代码审查员                            │     │    │
│  │  │       代码审查、Bug 分析、最佳实践建议        │     │    │
│  │  │                                            │     │    │
│  │  │       MODEL claude-sonnet  TOOLS 代码·文件   │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  │                                                     │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │  [D]  文档专员                              │     │    │
│  │  │       API 文档、需求文档、知识库维护          │     │    │
│  │  │                                            │     │    │
│  │  │       MODEL deepseek    TOOLS 文件·搜索     │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  │                                                     │    │
│  │  预估日均成本  约 ¥15                                │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐                │
│  │  确认     │ │  调整     │ │  重新规划     │                │
│  └──────────┘ └──────────┘ └──────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```css
.orch-proposal {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  overflow: hidden;
  margin-top: 16px;
  box-shadow: var(--shadow-sm);
}

.orch-proposal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 0;
}

.orch-proposal-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.02em;
}

.orch-proposal-badge {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0.02em;
}

.orch-proposal-divider {
  height: 1px;
  background: var(--border);
  margin: 16px 22px;
}

.orch-proposal-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 22px;
}

/* 单个 Agent 预览行 */
.orch-agent-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.orch-agent-row:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

/* Agent 渐变头像 — 纯字母 */
.orch-avatar {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  letter-spacing: 0;
}

.orch-agent-body {
  flex: 1;
  min-width: 0;
}

.orch-agent-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 3px;
}

.orch-agent-desc {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
  margin-bottom: 10px;
}

/* 标签行 — model / tools 用上标签名小字 */
.orch-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.orch-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 11px;
  letter-spacing: 0.01em;
  border: 1px solid var(--border);
  background: var(--secondary);
  color: var(--muted);
}

.orch-tag-label {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.orch-tag--model {
  background: rgba(99, 102, 241, 0.06);
  border-color: rgba(99, 102, 241, 0.15);
  color: var(--accent);
}

.orch-proposal-footer {
  padding: 16px 22px 20px;
  font-size: 13px;
  color: var(--muted);
}

.orch-proposal-cost {
  font-weight: 500;
}

/* 操作按钮组 */
.orch-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.orch-actions .btn {
  min-width: 80px;
}
```

### 5.3 SOUL 预览

折叠式，展开后是 monospace 预览 + 编辑按钮。克制的设计：

```css
.orch-soul {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-top: 10px;
  background: var(--card);
}

.orch-soul-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.orch-soul-head:hover {
  background: var(--bg-hover);
}

.orch-soul-head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.orch-soul-head-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}

.orch-soul-toggle {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
}

.orch-soul-body {
  border-top: 1px solid var(--border);
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.orch-soul-body.collapsed {
  display: none;
}

.orch-soul-content {
  padding: 14px 16px;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  font-family: var(--font-mono, "SF Mono", "Fira Code", monospace);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
}

.orch-soul-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

/* 编辑模式 */
.orch-soul-editor {
  width: 100%;
  min-height: 200px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  font-family: var(--font-mono, "SF Mono", "Fira Code", monospace);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
  resize: vertical;
  outline: none;
  transition: border-color 0.2s ease;
}

.orch-soul-editor:focus {
  border-color: rgba(99, 102, 241, 0.4);
}
```

---

## 六、部署进度

### 6.1 进度条

用项目已有的 **shimmer 光扫** 动画表示进行中：

```css
.orch-deploy {
  margin-top: 16px;
}

.orch-deploy-bar {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--secondary);
  overflow: hidden;
  margin-bottom: 18px;
}

.orch-deploy-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  transition: width 0.5s var(--ease-out);
  position: relative;
  overflow: hidden;
}

/* shimmer 光扫 */
.orch-deploy-fill::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer-sweep 1.5s infinite;
}

@keyframes shimmer-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* 步骤列表 */
.orch-deploy-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.orch-step {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

/* 步骤状态指示 — 不用 emoji，用 CSS 圆点 */
.orch-step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.orch-step--done .orch-step-dot {
  background: var(--ok);
}

.orch-step--active .orch-step-dot {
  background: var(--accent);
  animation: pulse-subtle 1.2s ease-in-out infinite;
}

.orch-step--pending .orch-step-dot {
  background: var(--muted);
  opacity: 0.3;
}

.orch-step--done .orch-step-text {
  color: var(--text);
}

.orch-step--active .orch-step-text {
  color: var(--text-strong);
  font-weight: 500;
}

.orch-step--pending .orch-step-text {
  color: var(--muted);
}
```

---

## 七、成功页

大气的完成状态，不堆 emoji：

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                      团队已上线                              │  ← 渐变标题
│                                                             │
│              日常助手 — 包含以下成员                          │
│                                                             │
│  ┌─────────────────────┐ ┌─────────────────────┐            │
│  │  [T] 任务管家        │ │  [R] 提醒助手        │            │  ← 卡片
│  │  管理日程和待办      │ │  智能提醒重要事件    │            │
│  │                     │ │                     │            │
│  │  [开始对话]         │ │  [开始对话]          │            │
│  └─────────────────────┘ └─────────────────────┘            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  试试这样说                                         │    │
│  │                                                     │    │
│  │  → 帮我安排明天的工作日程                             │    │
│  │  → 提醒我下午3点开会                                 │    │
│  │  → 看看本周有什么待办事项                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│         [返回智能体列表]    [继续创建]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```css
.orch-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 0;
}

/* 成功标记 — 渐变圆 + 对勾 */
.orch-success-mark {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #14b8a6);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scale-in {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.orch-success-mark svg {
  width: 28px;
  height: 28px;
  color: #fff;
}

.orch-success-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #a78bfa, #818cf8, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 6px;
}

.orch-success-sub {
  font-size: 14px;
  color: var(--muted);
  margin-bottom: 28px;
}

/* 已部署 Agent 卡片网格 */
.orch-deployed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  width: 100%;
  max-width: 520px;
  margin-bottom: 28px;
  text-align: left;
}

.orch-deployed-card {
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: 18px;
  box-shadow: var(--shadow-sm);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.orch-deployed-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.orch-deployed-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.orch-deployed-card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}

.orch-deployed-card-desc {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
  margin-bottom: 14px;
}

/* 使用指南 */
.orch-guide {
  width: 100%;
  max-width: 520px;
  text-align: left;
  margin-bottom: 24px;
}

.orch-guide-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 10px;
}

.orch-guide-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.orch-guide-item {
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s ease;
}

.orch-guide-item:hover {
  background: var(--bg-hover);
}

.orch-guide-item::before {
  content: "→ ";
  color: var(--muted);
}

/* 底部操作 */
.orch-success-actions {
  display: flex;
  gap: 12px;
}
```

---

## 八、Thinking 状态

不用 emoji 动画，用 **极简的脉冲条**：

```css
.orch-thinking {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  max-width: 680px;
}

.orch-thinking-bar {
  width: 48px;
  height: 3px;
  border-radius: var(--radius-full);
  background: var(--secondary);
  overflow: hidden;
}

.orch-thinking-bar-inner {
  width: 40%;
  height: 100%;
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  animation: thinking-slide 1.2s ease-in-out infinite;
}

@keyframes thinking-slide {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(180%); }
  100% { transform: translateX(-100%); }
}

.orch-thinking-text {
  font-size: 13px;
  color: var(--muted);
}
```

---

## 九、错误状态

```css
.orch-error {
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(239, 68, 68, 0.15);
  background: rgba(239, 68, 68, 0.04);
  margin-top: 12px;
}

.orch-error-text {
  font-size: 13px;
  color: var(--danger, #ef4444);
  line-height: 1.5;
  margin-bottom: 10px;
}

.orch-error-actions {
  display: flex;
  gap: 8px;
}
```

---

## 十、响应式

```css
@media (max-width: 900px) {
  .orch-welcome {
    padding: 24px 16px;
  }

  .orch-welcome-title {
    font-size: 22px;
    letter-spacing: 0.04em;
  }

  .orch-tpl-grid {
    grid-template-columns: 1fr;
  }

  .orch-thread {
    padding: 20px 16px;
  }

  .orch-msg--ai,
  .orch-msg--user {
    max-width: 100%;
  }

  .orch-compose {
    padding: 12px 16px 16px;
  }

  .orch-deployed-grid {
    grid-template-columns: 1fr;
  }

  .orch-chip {
    padding: 6px 12px;
    font-size: 12px;
  }
}
```

---

## 十一、状态机

（交互逻辑不变，参见 v1 文档第六节 — 9 个 phase 的完整状态机）

---

## 十二、i18n 新增 Key

```typescript
"orch.entryTitle": "智能组队",
"orch.entrySub": "AI 规划 · 一键部署",
"orch.headerTitle": "智能组队",
"orch.back": "返回",

"orch.welcomeTitle": "智 能 组 队",
"orch.welcomeSub": "描述你的场景，AI 为你规划最佳团队配置",
"orch.sectionTemplates": "从模板开始",
"orch.sectionCustom": "或者直接描述",
"orch.inputPlaceholder": "描述你的需求...",
"orch.send": "发送",

"orch.templateDeploy": "一键部署",
"orch.templateCount": "{{count}} 个智能体",

"orch.deploying": "部署中",
"orch.deployConfirm": "确认部署",

"orch.successTitle": "团队已上线",
"orch.successSub": "{{team}} — 包含以下成员",
"orch.startChat": "开始对话",
"orch.guideLabel": "试试这样说",
"orch.backToList": "返回智能体列表",
"orch.createMore": "继续创建",

"orch.confirm": "确认",
"orch.adjust": "调整",
"orch.redo": "重新规划",
"orch.costLabel": "预估日均成本",

"orch.soulExpand": "展开预览",
"orch.soulCollapse": "收起",
"orch.soulEdit": "编辑",
"orch.soulSave": "保存",
"orch.soulCancel": "取消",

"orch.thinking": "规划中...",
"orch.errorRetry": "重试",
"orch.errorBack": "返回",
```

---

## 十三、文件结构

（与 v1 相同，所有代码在 `extensions/orchestrator/` 模块内）

```
extensions/orchestrator/
├── src/
│   ├── ui/
│   │   ├── orchestrator-view.ts       # 主视图
│   │   ├── orchestrator-state.ts      # 视图状态
│   │   ├── orchestrator-styles.ts     # CSS（本文档所有样式）
│   │   └── components/
│   │       ├── welcome.ts             # 欢迎页
│   │       ├── template-card.ts       # 模板卡片
│   │       ├── question-card.ts       # 问题卡片
│   │       ├── proposal-card.ts       # 方案卡片
│   │       ├── soul-preview.ts        # SOUL 预览
│   │       ├── deploy-progress.ts     # 部署进度
│   │       ├── success-view.ts        # 完成页
│   │       └── message-list.ts        # 消息列表
│   ├── guided/
│   │   ├── capability-inference.ts    # 能力推断
│   │   ├── soul-generator.ts          # SOUL 生成
│   │   └── cost-estimator.ts          # 成本估算
│   └── actions/
│       ├── quick-deploy.ts            # 模板一键部署
│       ├── guided-propose.ts          # 引导提议
│       ├── guided-refine.ts           # 方案调整
│       └── guided-deploy.ts           # 最终部署
```

---

## 十四、设计原则总结

| 不做 | 做 |
|------|-----|
| emoji 堆砌 | 渐变头像 + CSS 圆点 + 纯文字 |
| 五颜六色的卡片 | 统一底色 + 渐变顶线色彩编码 |
| "你好！我是 AI 助手" 口吻 | 产品化大标题 + 简洁引导文案 |
| 圆角气泡左右对齐像微信 | 统一左对齐，用背景色区分 |
| 进度 "✅ 完成 ⏳ 进行中" | CSS 状态圆点（绿/紫/灰） |
| 按钮前加 emoji "🚀 部署" | 纯文字按钮 "确认部署" |
| 花活动画 | shimmer 光扫（功能性）、scale-in（反馈性） |
| 密集信息堆砌 | 大量留白 + 渐进披露（折叠/展开） |

**一句话**：让光影和排版做设计，不让 emoji 做设计。

---

*本文档 v2.0 — 去除 emoji 依赖，重建 magic 大气视觉语言。交互流程不变。*
