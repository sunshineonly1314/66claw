# PRD：CN 场景模板与使用案例展示体系

> **版本**: v1.0
> **日期**: 2026-02-23
> **作者**: Product Team
> **状态**: Draft
> **灵感来源**: [awesome-openclaw-usecases](https://github.com/hesamsheikh/awesome-openclaw-usecases)（6.1k Stars，29 个验证案例）

---

## 一、需求背景与目标

### 1.1 业务背景

[awesome-openclaw-usecases](https://github.com/hesamsheikh/awesome-openclaw-usecases) 用社区驱动 + 验证优先的方式，收集了 29 个真实 OpenClaw 使用案例，涵盖效率、社交媒体、基础设施、创意构建等 6 大类目，获得了 6,100+ Stars。

**但该项目对中国用户几乎不可用：**

| 问题 | 说明 |
|------|------|
| 服务不可达 | 29 个案例中 ~80% 依赖 Reddit/YouTube/X/Gmail/Discord/Todoist |
| 场景不贴合 | 中国用户日常用微信、飞书、钉钉、B站、小红书，不用 Reddit/Slack |
| 技术门槛高 | 多数案例需要配置 MCP servers、SSH、n8n、多 API keys |
| 语言障碍 | 详细文档全是英文，`README_CN.md` 只是概览翻译 |

**机会点：** 该项目验证了"使用案例展示"这一形式的巨大需求（6k+ Stars），但中国市场完全空白。OpenClawCN 应该做自己的中国版本，并深度集成到产品中。

### 1.2 产品目标

| 目标 | 衡量指标 | 目标值 |
|------|---------|--------|
| 降低小白用户使用门槛 | Setup Wizard 中选择场景模板的用户比例 | ≥ 40% |
| 提升用户留存 | 使用场景模板的用户 7 日留存 vs 未使用 | 提升 20% |
| 社区活跃 | 社区提交的使用案例数（月） | ≥ 5 |
| 产品差异化 | awesome-openclawcn-usecases 仓库 Stars | 3 月内 ≥ 500 |

### 1.3 核心原则

- **中国场景优先**：所有案例基于国内可达服务（微信/飞书/钉钉/B站/小红书/企微）
- **开箱即用**：小白用户选模板 → 自动配好 MCP servers + skills，无需手动配置
- **验证优先**：每个案例必须经过至少 1 天真实使用验证
- **渐进复杂度**：从"零配置"到"高级玩法"分层展示

---

## 二、功能范围

### 2.1 In Scope（本期范围）

| 模块 | 说明 |
|------|------|
| 产品内场景模板 | Setup Wizard 中新增"选择使用场景"步骤 |
| 场景模板引擎 | 选择模板后自动配置 MCP servers / skills / prompt 模板 |
| 产品内案例展示 | Control UI 中新增"使用灵感"页面 |
| 社区案例仓库 | GitHub 上建立 `awesome-openclawcn-usecases` 仓库 |
| 5 个首发案例 | 国产替代版核心案例（详见第四节） |

### 2.2 Out of Scope（本期不做）

| 功能 | 原因 |
|------|------|
| 案例市场（在线商店） | 先验证需求，后建平台 |
| 案例评分与排行 | 需要足够案例量才有意义 |
| 一键导入他人案例配置 | 安全风险高，需谨慎设计 |
| 案例内置 AI 教学 | 投入过大，先做案例展示 |

---

## 三、使用场景分类体系

### 3.1 分类设计

参考 awesome-openclaw-usecases 的 6 大类，结合中国用户场景重新设计：

| 类目 | 对标原项目 | CN 场景化改造 |
|------|-----------|-------------|
| **日常效率** | Productivity (13) | 微信消息整理、飞书日报、钉钉待办 |
| **内容消费** | Social Media (4) | B站/小红书/公众号每日摘要 |
| **知识管理** | Research & Learning (4) | 第二大脑（微信输入）、语义搜索 |
| **创意生产** | Creative & Building (3) | 公众号写作助手、小红书内容工厂 |
| **运维自动化** | Infrastructure & DevOps (2) | 服务器自愈、定时任务编排 |
| **企业协作** | 原项目无 | 企微客户管理、飞书会议纪要、钉钉审批 |

### 3.2 复杂度分层

| 等级 | 标签 | 技术要求 | 目标用户 |
|------|------|---------|---------|
| L1 | 零配置 | 无需额外 API keys，选即可用 | 完全小白 |
| L2 | 轻配置 | 需 1-2 个 API key（如 DeepSeek） | 入门用户 |
| L3 | 中等配置 | 需配置 MCP server + 渠道 Token | 进阶用户 |
| L4 | 高级玩法 | 需多服务联动、自定义 skill 开发 | 技术用户 |

---

## 四、首发 5 个案例设计

### 4.1 每日早报助手 [L2] — 对标 "Daily Reddit Digest"

**原版问题**: 依赖 Reddit API，中国不可用

**CN 版方案**:

| 维度 | 设计 |
|------|------|
| 信息源 | B站热门、微信公众号（RSS）、小红书热搜、知乎热榜、36氪 |
| 推送渠道 | 微信（通过企微应用）/ 飞书机器人 / 钉钉机器人 |
| 触发方式 | 定时 cron（每天早 8 点）或手动 `/早报` 命令 |
| 核心 MCP | `web-fetch`（抓取）+ 渠道推送 MCP |
| 输出格式 | Markdown 卡片，含摘要 + 原文链接 |
| 复杂度 | L2（需配置推送渠道 Token） |

**用户旅程**:

```
选择"每日早报"模板
  → 选择信息源（勾选：B站/知乎/36氪/...）
  → 选择推送渠道（飞书/钉钉/企微）
  → 输入渠道 Token
  → 自动配置 cron + MCP
  → 每天早上收到早报
```

---

### 4.2 微信消息管家 [L3] — 对标 "Email Declutter"

**原版问题**: 依赖 Gmail API，中国不可用

**CN 版方案**:

| 维度 | 设计 |
|------|------|
| 数据源 | 企业微信消息流（通过企微 API） |
| 核心能力 | 消息分类、重要消息提取、待办事项生成、自动标记已处理 |
| 触发方式 | 实时监听 + 每日汇总 |
| 核心 MCP | `wecom` MCP server |
| 输出格式 | 每日消息摘要 + 待办清单 |
| 复杂度 | L3（需配置企微应用 + MCP server） |

**核心场景**:

```
场景 1: 消息分类
  用户: "帮我整理今天的消息"
  Agent: 按 紧急/重要/知会/垃圾 分类，列出摘要

场景 2: 自动提取待办
  - 监听到"请在周五前提交报告" → 自动创建待办
  - 监听到"明天开会" → 自动创建日程提醒

场景 3: 每日汇总
  每天 18:00 推送: "今日收到 47 条消息，其中 3 条紧急、8 条重要"
```

---

### 4.3 家庭群管家 [L2] — 对标 "Family Calendar & Household Assistant"

**原版问题**: 依赖 Google Calendar + Discord，中国不可用

**CN 版方案**:

| 维度 | 设计 |
|------|------|
| 交互渠道 | 微信家庭群（通过企微）/ 飞书家庭群 |
| 核心能力 | 家庭日程提醒、采购清单、家务分配、快递提醒 |
| 触发方式 | 群消息 @AI + 定时提醒 |
| 核心 MCP | 渠道 MCP + `memory-core`（记住家庭偏好） |
| 复杂度 | L2 |

**核心场景**:

```
家人: "@AI 明天要买什么菜？"
Agent: "根据本周菜单，明天需要：鸡蛋、西红柿、豆腐。
        另外冰箱里的牛奶周三到期了，要不要加上？"

家人: "@AI 这周家务怎么分？"
Agent: "本周轮值：
        周一~周三 厨房：爸爸 | 客厅：妈妈
        周四~周日 厨房：妈妈 | 客厅：爸爸
        (上周是反过来的)"
```

---

### 4.4 第二大脑 [L3] — 对标 "Second Brain / Semantic Memory Search"

**原版问题**: 依赖 Telegram/iMessage/Discord，中国不可用

**CN 版方案**:

| 维度 | 设计 |
|------|------|
| 输入渠道 | 微信（企微）→ 随时发消息给 AI 记录 |
| 存储方式 | `memory-core` 扩展（本地 + 可选云同步） |
| 核心能力 | 语义搜索、自动分类打标、关联推荐、定期回顾 |
| 可视化 | Control UI "知识库"页面 |
| 复杂度 | L3（需配置 memory-core + 渠道） |

**与现有代码的关系**:

```
现有:   extensions/memory-core/index.ts  — 已有内存存储基础
现有:   src/auto-reply/reply/memory-extraction.ts — 已有记忆提取
需新增: 知识库可视化页面（Control UI）
需新增: 语义搜索 API 端点
需增强: memory-core 支持手动录入（非对话提取）
```

**用户旅程**:

```
用户(微信): "记一下：张总说下周三去上海出差，住浦东香格里拉"
Agent: "已记录 ✓ [出差/张总/上海/下周三]"

（一周后）
用户(微信): "张总上次说的出差是什么时候来着？"
Agent: "2月26日（周三），张总出差去上海，住浦东香格里拉。
        需要我帮你订酒店或查机票吗？"
```

---

### 4.5 睡前任务大师 [L1] — 对标 "Overnight Mini-App Builder"

**原版问题**: 概念好但太技术化，小白用不起来

**CN 版方案**:

| 维度 | 设计 |
|------|------|
| 交互方式 | 对话式（Control UI 或微信） |
| 核心能力 | 用户说目标 → AI 拆解任务 → 自主执行 → 次日展示成果 |
| 任务类型 | 文档整理、表格生成、报告撰写、数据分析、简单网页 |
| 技术方案 | 利用现有 Agent 能力 + skills |
| 复杂度 | L1（零配置，直接对话即可） |

**核心卖点**: "睡前下指令，早起看成果"

**场景示例**:

```
用户(22:30): "帮我把这周的会议纪要整理成一份周报，
              按项目分类，突出关键决策和待办事项"

Agent: "好的，我来处理。预计需要：
        1. 整理 5 份会议纪要
        2. 按项目分类汇总
        3. 提取关键决策和 Action Items
        4. 生成周报文档
        明天早上你就能看到结果了 ✓"

（次日 08:00）
Agent: "周报已生成 ✓
        - 涉及 3 个项目、12 条关键决策、8 条待办
        - [查看周报] [导出 PDF] [发送到飞书]"
```

---

## 五、产品内集成方案

### 5.1 Setup Wizard 新增"场景选择"步骤

在现有 Setup 流程的 Provider 配置之后，新增一步：

```
现有流程:  选择语言 → 配置 Provider → 配置渠道 → 完成
改造后:    选择语言 → 配置 Provider → ★选择使用场景★ → 配置渠道 → 完成
                                       ↑ 新增步骤
```

**文件位置**: `src/gateway/setup-wizard.ts`, `src/gateway/setup-wizard-state.ts`

**步骤 UI 设计**:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  你想用 AI 做什么？（可多选，也可以跳过）               │
│                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐    │
│  │ ☀️  每日早报          │  │ 💬  消息管家         │    │
│  │ 每天推送科技/行业资讯  │  │ 自动整理消息和待办    │    │
│  │ [L2 轻配置]          │  │ [L3 中等配置]        │    │
│  └─────────────────────┘  └─────────────────────┘    │
│                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐    │
│  │ 👨‍👩‍👧‍👦  家庭群管家     │  │ 🧠  第二大脑         │    │
│  │ 家庭日程/采购/家务    │  │ 随时记录，语义搜索    │    │
│  │ [L2 轻配置]          │  │ [L3 中等配置]        │    │
│  └─────────────────────┘  └─────────────────────┘    │
│                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐    │
│  │ 🌙  睡前任务大师      │  │ ➕  更多场景...       │    │
│  │ 睡前下指令，早起看成果 │  │ 浏览全部使用案例      │    │
│  │ [L1 零配置]          │  │                     │    │
│  └─────────────────────┘  └─────────────────────┘    │
│                                                      │
│            [ 跳过，我自己探索 ]    [ 下一步 → ]        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 5.2 场景模板引擎

**场景模板数据结构**:

```typescript
interface ScenarioTemplate {
  /** 模板 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 一句话描述 */
  summary: string;
  /** 复杂度等级 */
  level: 'L1' | 'L2' | 'L3' | 'L4';
  /** 分类 */
  category: 'daily' | 'content' | 'knowledge' | 'creative' | 'devops' | 'enterprise';
  /** 图标 */
  icon: string;

  /** 自动配置项 */
  setup: {
    /** 需要启用的 MCP servers */
    mcpServers?: Record<string, McpServerConfig>;
    /** 需要安装的 skills */
    skills?: string[];
    /** 预置的 prompt 模板 */
    promptTemplates?: PromptTemplate[];
    /** 需要的渠道配置（引导用户填写） */
    requiredChannels?: ('wecom' | 'feishu' | 'dingtalk')[];
    /** cron 任务配置 */
    crons?: CronConfig[];
  };

  /** 使用指南（Markdown） */
  guide: string;
  /** 示例对话 */
  exampleConversations: ExampleConversation[];
}
```

**模板应用逻辑**（新增文件）:

```
文件位置: src/gateway/scenario-templates.ts

applyScenarioTemplate(templateId)
  → 写入 MCP server 配置到 openclawcn.json
  → 安装所需 skills
  → 创建 cron 任务（如果有）
  → 引导用户完成渠道配置（如果需要）
  → 注入 prompt 模板
```

### 5.3 Control UI "使用灵感"页面

在 Control UI 导航栏中新增"灵感"入口，展示所有案例卡片：

```
文件位置:
  - ui/src/ui/views/scenarios.ts      — 新增页面
  - ui/src/ui/controllers/scenarios.ts — 新增控制器
  - ui/src/styles/scenarios.css        — 新增样式
```

**页面布局**:

```
┌──────────────────────────────────────────────────────────┐
│  导航: [对话] [设置] [技能] [★灵感★] [日志]               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  🎯 使用灵感 — 发现 AI 的更多可能                          │
│                                                          │
│  筛选: [全部] [日常效率] [内容消费] [知识管理]              │
│        [创意生产] [运维自动化] [企业协作]                   │
│                                                          │
│  难度: [全部] [L1 零配置] [L2 轻配置] [L3+]               │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ ☀️ 每日早报    │  │ 💬 消息管家   │  │ 👨‍👩‍👧‍👦 家庭管家 │    │
│  │              │  │              │  │              │    │
│  │ 每天推送行业  │  │ 自动整理消息  │  │ 家庭日程管理  │    │
│  │ 资讯精选      │  │ 提取待办事项  │  │ 采购/家务分配 │    │
│  │              │  │              │  │              │    │
│  │ L2 · 日常效率 │  │ L3 · 日常效率 │  │ L2 · 日常效率 │    │
│  │              │  │              │  │              │    │
│  │ [一键启用]    │  │ [查看详情]    │  │ [一键启用]    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ 🧠 第二大脑   │  │ 🌙 睡前大师   │  │ ➕ 贡献案例   │    │
│  │ ...          │  │ ...          │  │              │    │
│  │              │  │              │  │ 分享你的用法  │    │
│  │ L3 · 知识管理 │  │ L1 · 日常效率 │  │ 提交到社区    │    │
│  │ [查看详情]    │  │ [一键启用]    │  │ [去 GitHub]   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 六、社区案例仓库

### 6.1 仓库结构

```
awesome-openclawcn-usecases/
├── README.md                    # 中文主文档
├── README_EN.md                 # 英文版（可选）
├── CONTRIBUTING.md              # 贡献指南
├── LICENSE                      # MIT
├── usecases/
│   ├── daily-briefing.md        # 每日早报
│   ├── wechat-message-butler.md # 微信消息管家
│   ├── family-group-butler.md   # 家庭群管家
│   ├── second-brain.md          # 第二大脑
│   └── overnight-task-master.md # 睡前任务大师
└── templates/
    ├── usecase-template.md      # 案例模板
    └── scenario-config.json     # 场景配置模板
```

### 6.2 贡献标准（借鉴 awesome-openclaw-usecases）

| 标准 | 要求 |
|------|------|
| 真实验证 | 案例必须经过至少 1 天真实使用 |
| 中国可达 | 所有依赖服务必须在中国大陆可直接访问 |
| 复现性 | 提供完整配置步骤，他人可复现 |
| 安全声明 | 标注所有需要的 API 权限和数据风险 |
| 禁止项 | 不接受加密货币、赌博、翻墙相关案例 |

### 6.3 案例文档模板

```markdown
# 案例名称

> 复杂度: L2 | 分类: 日常效率 | 验证天数: 7 天

## 一句话介绍
（50 字以内）

## 效果展示
（截图或对话记录）

## 需要什么
- [ ] OpenClawCN 已安装
- [ ] DeepSeek API Key
- [ ] 飞书机器人 Webhook URL

## 配置步骤
（带截图的 step-by-step）

## 日常使用
（典型场景和对话示例）

## 常见问题
（FAQ）

## 作者
（GitHub ID + 联系方式）
```

---

## 七、技术实现方案

### 7.1 改动范围

| 文件 | 改动内容 | 复杂度 | 阶段 |
|------|---------|--------|------|
| `src/gateway/setup-wizard.ts` | 新增"场景选择"步骤 | 中 | P1 |
| `src/gateway/setup-wizard-state.ts` | 新增场景选择状态 | 低 | P1 |
| `src/gateway/setup-page-components.ts` | 新增场景卡片组件 | 中 | P1 |
| `src/gateway/scenario-templates.ts` | **新增** 场景模板引擎 | 高 | P1 |
| `src/gateway/scenario-data.ts` | **新增** 5 个首发模板数据 | 中 | P1 |
| `ui/src/ui/views/scenarios.ts` | **新增** 灵感页面 | 高 | P2 |
| `ui/src/ui/controllers/scenarios.ts` | **新增** 灵感页控制器 | 中 | P2 |
| `ui/src/styles/scenarios.css` | **新增** 灵感页样式 | 中 | P2 |
| `ui/src/ui/app.ts` | 导航栏增加"灵感"入口 | 低 | P2 |
| `ui/src/ui/i18n/locales/zh-CN.ts` | 新增灵感页 i18n 文案 | 低 | P2 |
| `ui/src/ui/i18n/locales/en.ts` | 新增灵感页 i18n 文案 | 低 | P2 |

### 7.2 场景模板应用流程

```
用户在 Setup Wizard 选择场景
  │
  ├─ 前端发送 POST /api/scenario/apply { templateId: "daily-briefing" }
  │
  ├─ 后端 applyScenarioTemplate()
  │   ├─ 读取模板定义（scenario-data.ts）
  │   ├─ 写入 MCP server 配置
  │   ├─ 安装所需 skills（调用 skills-install）
  │   ├─ 配置 cron 任务（如果有）
  │   └─ 返回"需要用户补充的配置"（如渠道 Token）
  │
  ├─ 前端显示补充配置表单（如果有）
  │   ├─ 用户填入飞书 Webhook URL / 企微 Token 等
  │   └─ POST /api/scenario/configure { templateId, channelConfig }
  │
  └─ 完成，跳转到对话页面，显示场景引导消息
```

### 7.3 API 端点

```
POST /api/scenario/apply      — 应用场景模板
POST /api/scenario/configure   — 补充渠道配置
GET  /api/scenario/list        — 获取所有可用模板
GET  /api/scenario/status      — 获取当前启用的场景
POST /api/scenario/disable     — 禁用场景
```

---

## 八、TODO 清单

### 第一阶段：MVP — Setup Wizard 场景选择（P1，预计 5 天）

- [ ] **TODO-SC-001**: 定义 ScenarioTemplate 类型和 5 个首发模板数据
  - 文件：`src/gateway/scenario-data.ts`（新增）
  - 包含：模板 ID、名称、描述、复杂度、分类、配置项

- [ ] **TODO-SC-002**: 实现场景模板引擎
  - 文件：`src/gateway/scenario-templates.ts`（新增）
  - 功能：读取模板 → 写入配置 → 安装 skills → 配置 cron

- [ ] **TODO-SC-003**: Setup Wizard 新增"场景选择"步骤
  - 文件：`src/gateway/setup-wizard.ts`, `setup-wizard-state.ts`, `setup-page-components.ts`
  - 改动：在 Provider 配置后插入场景选择卡片 UI

- [ ] **TODO-SC-004**: 场景相关 API 端点
  - 文件：`src/gateway/setup-wizard.ts` 或 `src/gateway/cn-handlers.ts`
  - 端点：`/api/scenario/apply`, `/api/scenario/configure`, `/api/scenario/list`

- [ ] **TODO-SC-005**: 编写 5 个首发案例文档
  - 目录：仓库 `usecases/` 下 5 个 Markdown 文件
  - 内容：配置步骤 + 使用示例 + 截图 + FAQ

### 第二阶段：产品内灵感页面（P2，预计 4 天）

- [ ] **TODO-SC-006**: Control UI 新增"灵感"页面
  - 文件：`ui/src/ui/views/scenarios.ts`（新增）
  - 功能：场景卡片展示、分类筛选、复杂度筛选

- [ ] **TODO-SC-007**: 灵感页控制器
  - 文件：`ui/src/ui/controllers/scenarios.ts`（新增）
  - 功能：获取模板列表、一键启用、查看详情

- [ ] **TODO-SC-008**: 灵感页样式与响应式
  - 文件：`ui/src/styles/scenarios.css`（新增）
  - 适配：桌面 / 平板 / 移动端

- [ ] **TODO-SC-009**: 导航栏与 i18n
  - 文件：`ui/src/ui/app.ts`, `ui/src/ui/i18n/locales/zh-CN.ts`, `en.ts`
  - 改动：新增"灵感"导航入口 + 全部文案中英文

### 第三阶段：社区与迭代（P2，预计 3 天）

- [ ] **TODO-SC-010**: 创建 awesome-openclawcn-usecases GitHub 仓库
  - 内容：README + CONTRIBUTING + 5 个案例 + 模板
  - 运营：提交到 awesome 列表、社群推广

- [ ] **TODO-SC-011**: 产品内"贡献案例"入口
  - 灵感页中增加"贡献你的案例"卡片，跳转 GitHub
  - 简化贡献流程：提供 Issue Template

- [ ] **TODO-SC-012**: 案例使用数据追踪
  - 追踪：模板启用次数、活跃天数、用户反馈
  - 用于：优化推荐排序、发现热门场景

---

## 九、关键设计决策

### 决策 1：场景模板存储位置

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| A. 代码内置 | 部署简单，离线可用 | 更新需要发版 | ✅ 本期 |
| B. 远程拉取 | 动态更新 | 需要服务器，离线不可用 | 后期 |
| C. 混合模式 | 兼顾 | 复杂度高 | 后期 |

**采用方案 A**：首期 5 个模板内置，后期增加远程拉取能力。

### 决策 2：场景模板与现有 Skills 的关系

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| A. 模板是 skill 的组合 | 复用现有机制 | skill 粒度可能不匹配 | ❌ |
| B. 模板是独立实体 | 灵活 | 新概念，增加认知负担 | ❌ |
| C. 模板是配置预设 | 轻量，不引入新概念 | 能力受限于配置 | ✅ |

**采用方案 C**：场景模板本质是一组配置预设（MCP servers + skills + prompts + crons），不引入新的运行时概念。

### 决策 3：社区仓库是否独立

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| A. 放在主仓库 docs/ 下 | 集中管理 | 社区贡献门槛高 | ❌ |
| B. 独立仓库 | 低门槛贡献，独立 Star 指标 | 需要同步 | ✅ |

**采用方案 B**：独立仓库 `OpenClawCN/awesome-openclawcn-usecases`，产品内定期同步。

---

## 十、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 模板配置出错导致系统不可用 | 高 | 模板应用增加 dry-run 验证步骤 |
| 渠道 API 变更导致模板失效 | 中 | 模板版本化，定期验证 |
| 社区贡献数量不足 | 中 | 核心团队持续输出，降低贡献门槛 |
| 场景模板与用户已有配置冲突 | 中 | 应用前检查冲突，给出合并建议 |
| 小白用户仍然不会配置渠道 Token | 高 | L1 场景完全零配置；L2+ 提供详细截图引导 |

---

## 十一、里程碑

| 阶段 | 内容 | 工期 | 优先级 |
|------|------|------|--------|
| Phase 1 | 场景模板引擎 + Setup Wizard 集成 | 5 天 | P1 |
| Phase 2 | Control UI 灵感页面 | 4 天 | P2 |
| Phase 3 | 社区仓库 + 运营启动 | 3 天 | P2 |
| **合计** | | **12 天** | |

---

## 十二、参考资料

- [awesome-openclaw-usecases](https://github.com/hesamsheikh/awesome-openclaw-usecases) — 6.1k Stars，29 个验证案例
- [awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills) — Skills 合集
- 现有中国区支持代码：`src/config/region-cn.ts`
- 现有 Setup Wizard：`src/gateway/setup-wizard.ts`
- 现有 Memory Core：`extensions/memory-core/index.ts`
- 现有渠道扩展：`extensions/feishu/`, `extensions/dingtalk/`, `extensions/wecom/`
- CN 用户体验 TODO：`docs/requirements/cn-user-experience-todo.md`

---

## 更新记录

| 日期 | 更新内容 |
|------|---------|
| 2026-02-23 | v1.0 初始版本，基于 awesome-openclaw-usecases 调研 |
