# PRD：用户调研问卷（使用次日触发）

> **版本**: v2.0  
> **日期**: 2026-02-06  
> **作者**: Product & UX Team  
> **状态**: Draft  
> **变更说明**: v2.0 重大调整 —— 问卷从 Setup 流程中移出，改为「用户使用次日」在主 UI 触发

---

## 一、需求背景与目标

### 1.1 业务背景

ClawdbotCN 面向的用户群体 AI 水平参差不齐，从完全零基础的小白到有一定 AI 使用经验的进阶用户都有。为了：

- **精准了解用户画像**：掌握用户的 AI 认知水平、工具使用经验
- **课程设计参考**：为后续 AI 培训课程提供数据支撑，设计适配不同层级的教学内容
- **产品迭代方向**：了解用户对 ClawdbotCN 的核心期待，指导功能优先级
- **社群运营**：基于用户水平分层，提供差异化的社群服务

### 1.2 为什么不放在 Setup 流程里

| 维度 | Setup 中弹出 | 次日弹出（本方案） |
|------|-------------|-------------------|
| 用户心态 | "让我赶紧用！" → 烦躁 | "昨天试了下，还行" → 平和 |
| 回答质量 | 基于想象和营销文案 | **基于真实使用体验** |
| 产品期待题 | 没用过，只能猜 | **用过了，答得准** |
| 对品牌好感度 | 有损（阻塞激活流程） | **无损，甚至加分** |
| 样本价值 | 包含不回来的用户 | **只采集留存用户，更精准** |

### 1.3 产品目标

| 目标 | 衡量指标 | 目标值 |
|------|---------|--------|
| 问卷曝光率 | 看到问卷的用户 / 次日回访用户 | 100%（满足条件必触发） |
| 问卷完成率 | 完成 / 看到 | ≥ 60% |
| 数据有效率 | 有效填写（非全默认）/ 总提交 | ≥ 85% |
| 填写时长 | 从弹出到提交 | ≤ 30 秒 |
| 用户满意度 | 不因问卷产生负面反馈 | 0 投诉 |

### 1.4 核心原则

- **不阻塞使用**：问卷以非模态面板出现，用户可以直接关闭继续用
- **基于真实体验**：用户已使用过产品再作答，数据更有价值
- **极致精简**：3 道选择题 + 1 道可选开放题，< 30 秒
- **一次性触发**：每个授权码每台设备仅触发一次
- **优雅不突兀**：从页面顶部温和滑入，不遮挡核心内容

---

## 二、功能范围

### 2.1 In Scope（本期范围）

- 在主控制面板（Control UI）中加入调研问卷组件
- 次日触发条件判断（时间 + 状态双重校验）
- 问卷内容：3 道选择题 + 1 道可选开放题
- 一次性控制：本地标记 + 服务器上报
- 跳过/关闭机制
- 问卷数据上报 API

### 2.2 Out of Scope（本期不做）

- 问卷管理后台（本期人工导出分析）
- 问卷 A/B 测试
- 问卷内容动态下发
- 根据问卷结果定制 UI（可作为 v2.1 迭代）

---

## 三、触发机制

### 3.1 触发条件（全部满足才弹出）

```typescript
function shouldShowSurvey(config: ClawdbotConfig, now: number): boolean {
  const license = config.license;
  
  // 条件 1: 有有效授权码（已通过验证）
  if (!license?.key || !license?.validatedAt) return false;
  
  // 条件 2: 本地未标记过（未完成、未跳过）
  if (license.surveyStatus === 'completed' || license.surveyStatus === 'skipped') {
    return false;
  }
  
  // 条件 3: 距离首次验证 ≥ 18 小时（确保至少隔夜）
  const validatedAt = new Date(license.validatedAt).getTime();
  const hoursSinceValidation = (now - validatedAt) / (1000 * 60 * 60);
  if (hoursSinceValidation < 18) return false;
  
  // 条件 4: 距离首次验证 ≤ 7 天（超过 7 天不再打扰）
  if (hoursSinceValidation > 7 * 24) return false;
  
  return true;
}
```

### 3.2 为什么是 18 小时 + 7 天窗口

| 参数 | 值 | 理由 |
|------|---|------|
| 最小间隔 | 18 小时 | 晚上 10 点激活 → 第二天下午 4 点来才会看到（确保有真实使用经历） |
| 最大窗口 | 7 天 | 超过一周不来的用户，突然弹问卷体验很差；且记忆淡化，数据质量下降 |
| 窗口起点 | `license.validatedAt` | 复用现有字段，无需额外存储 |

### 3.3 触发时机（在页面生命周期中的位置）

```
用户打开 Control UI
  │
  ├─ WebSocket 连接建立
  ├─ 接收 hello 消息 → 获取 license 状态
  ├─ 页面渲染完成
  │
  ├─ 延迟 3 秒（让用户先看到主界面，不要一进来就弹）
  │
  ├─ 检查 shouldShowSurvey()
  │   ├─ false → 正常使用，不做任何事
  │   └─ true  → 从顶部滑入问卷面板
  │
  └─ 用户正常使用（问卷不阻塞任何操作）
```

### 3.4 状态流转

```
                    ┌──────────────┐
                    │ 页面加载完成   │
                    └──────┬───────┘
                           │ (延迟 3s)
                    ┌──────▼───────┐
                    │ 检查触发条件   │
                    └──────┬───────┘
                           │
              ┌────────────┤
              │ 不满足      │ 满足
              │            │
              ▼            ▼
          (无动作)    ┌──────────────┐
                     │ 顶部滑入面板   │
                     └──────┬───────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
            填写提交      点击关闭     7天后过期
                │           │           │
                ▼           ▼           ▼
           ┌─────────┐ ┌─────────┐ ┌───────────┐
           │ 上报服务器│ │ 标记skip│ │ 自动不再展示│
           │ 标记done │ │         │ │（超出窗口） │
           │ 感谢提示  │ │ 面板收起 │ │           │
           └─────────┘ └─────────┘ └───────────┘
```

---

## 四、问卷内容设计

### 4.1 设计原则

> 用户已经用过产品至少一天了。利用这个优势，问题可以结合实际体验。
> 
> 3 道选择题 + 1 道开放题 = **真正的 30 秒**。没有翻页，没有进度条焦虑，一眼看完。

### 4.2 问卷标题与引导语

**标题**: 花 30 秒帮我们变得更好

**引导语**: 你的反馈将直接影响我们的 AI 课程设计和产品方向

> 注意：不叫「问卷」「调研」「调查」—— 这些词自带「好烦」的联想。
> 用「反馈」更平等，像朋友间聊天。

### 4.3 题目设计

---

#### Q1: 你目前的 AI 使用水平？（单选）

**分析目的**: 用户分层核心维度，决定课程起点

| 选项 | 值 | 说明 |
|------|----|----|
| 刚开始接触，还在摸索 | `beginner` | 需要基础教学 |
| 会基本对话，想学更多技巧 | `intermediate` | 需要进阶技巧 |
| 比较熟练，日常都在用 | `regular` | 需要高级场景 |
| 深度玩家，各种工具都试过 | `advanced` | 需要专业内容 |

> **设计说明**: 从 v1 的 5 个选项精简为 4 个。去掉了「完全零基础从未用过」——
> 用户既然已经用了一天 ClawdbotCN，就不是「从未用过 AI」了。
> 选项措辞用口语化表达，降低阅读负担。

---

#### Q2: 你最想用 AI 帮你做什么？（多选，最多 3 项）

**分析目的**: 课程场景设计 + 功能优先级

| 选项 | 值 |
|------|----|
| 写文章 / 文案 | `writing` |
| 写代码 / 技术开发 | `coding` |
| 办公提效（邮件、PPT、Excel） | `office` |
| 学习新知识 / 辅助备考 | `learning` |
| 数据分析 / 报表 | `data_analysis` |
| 翻译 / 多语言 | `translation` |
| 做图 / 设计 | `image_gen` |
| 自动化 / 工作流 | `automation` |

> **设计说明**: 从 v1 的 9 个选项精简为 8 个，去掉了「其他」—— 
> 开放题兜底即可。选项文案更短更口语。

---

#### Q3: 你最希望我们提供什么？（多选，最多 2 项）

**分析目的**: 产品路线图 + 课程形式

| 选项 | 值 |
|------|----|
| 手把手视频教程 | `video_tutorial` |
| 实用 Prompt 模板库 | `prompt_templates` |
| 特定场景教学（代码/写作/办公） | `scenario_courses` |
| 更多 AI 模型选择 | `more_models` |
| 用户交流社群 | `community` |
| 多端同步（手机/平板） | `multi_device` |

> **设计说明**: 把 v1 的 Q4（课程形式）和 Q5（产品期待）合并为一道题。
> 用户只需要做一次取舍决策，而不是两次。限选 2 项，聚焦最核心的诉求。

---

#### Q4: 还有什么想说的？（选填）

**分析目的**: 捕获定性反馈

- **类型**: 单行文本输入（非 textarea，降低心理负担）
- **placeholder**: "比如：希望出个 Prompt 教程..."
- **最大字数**: 100 字
- **高度**: 单行，可展开

> **设计说明**: 从 v1 的 200 字多行 textarea 改为 100 字单行输入。
> 心理暗示：这里不需要写长篇大论，一句话就够。

---

## 五、交互设计

### 5.1 展现形式：顶部滑入面板（非模态）

**为什么不用弹窗（Modal）？**

| 方案 | 问题 |
|------|------|
| 全屏 Modal | 遮挡内容，阻塞使用，用户第一反应是找关闭按钮 |
| 居中弹窗 | 比 Modal 好一点，但仍然打断用户 |
| **顶部滑入面板** | 不遮挡主内容区，用户可以选择忽略继续用，零打扰感 |
| Toast 通知 | 太小放不下问卷内容 |

### 5.2 面板布局（单页，不翻页）

```
┌────────────────────────────────────────────────────────────────────┐
│                           Control UI 主界面                        │
├────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │  ✕                                                            │ │
│ │                                                                │ │
│ │  花 30 秒帮我们变得更好                                         │ │
│ │  你的反馈将直接影响我们的 AI 课程设计和产品方向                     │ │
│ │                                                                │ │
│ │  ── ❶ 你目前的 AI 使用水平？────────────────────────            │ │
│ │                                                                │ │
│ │  ┌──────────────┐ ┌──────────────────────┐                     │ │
│ │  │ 刚开始接触     │ │ 会基本对话，想学更多   │                     │ │
│ │  └──────────────┘ └──────────────────────┘                     │ │
│ │  ┌──────────────────┐ ┌──────────────────────┐                 │ │
│ │  │ 比较熟练，日常在用 │ │ 深度玩家，各种都试过   │                 │ │
│ │  └──────────────────┘ └──────────────────────┘                 │ │
│ │                                                                │ │
│ │  ── ❷ 你最想用 AI 帮你做什么？（最多 3 项）──────────            │ │
│ │                                                                │ │
│ │  ┌─────────┐ ┌──────────┐ ┌───────────────┐ ┌──────────┐      │ │
│ │  │ 写文章   │ │ 写代码    │ │ 办公提效       │ │ 学新知识  │      │ │
│ │  └─────────┘ └──────────┘ └───────────────┘ └──────────┘      │ │
│ │  ┌─────────┐ ┌──────────┐ ┌───────────────┐ ┌──────────┐      │ │
│ │  │ 数据分析 │ │ 翻译      │ │ 做图/设计     │ │ 自动化    │      │ │
│ │  └─────────┘ └──────────┘ └───────────────┘ └──────────┘      │ │
│ │                                                                │ │
│ │  ── ❸ 你最希望我们提供什么？（最多 2 项）──────────              │ │
│ │                                                                │ │
│ │  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐        │ │
│ │  │ 视频教程      │ │ Prompt模板库  │ │ 场景教学         │        │ │
│ │  └──────────────┘ └──────────────┘ └─────────────────┘        │ │
│ │  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐        │ │
│ │  │ 更多模型      │ │ 交流社群      │ │ 多端同步         │        │ │
│ │  └──────────────┘ └──────────────┘ └─────────────────┘        │ │
│ │                                                                │ │
│ │  ── 💬 还有什么想说的？（选填）───────────────────              │ │
│ │  ┌──────────────────────────────────────────────────┐          │ │
│ │  │ 比如：希望出个 Prompt 教程...                       │          │ │
│ │  └──────────────────────────────────────────────────┘          │ │
│ │                                                                │ │
│ │                                          [ ✨ 提交反馈 ]       │ │
│ │                                                                │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│                        （下方正常主界面内容）                         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 5.3 关键交互细节

#### 面板出现

| 行为 | 细节 |
|------|------|
| 触发时机 | 页面加载 3 秒后 |
| 动画 | 从上方 `translateY(-100%)` 滑入，`400ms ease-out` |
| 主内容区 | 被面板推下（不是覆盖），用户仍可滚动查看 |
| 背景遮罩 | **无**（非模态，不遮挡任何东西） |

#### 关闭按钮

| 行为 | 细节 |
|------|------|
| 位置 | 面板右上角 `✕` 按钮 |
| 点击效果 | 面板向上滑出收起，标记为 `skipped` |
| 额外说明 | 无「确定要关闭吗？」确认弹窗 |

#### 选项交互

**单选（Q1）— Chip 样式**:

```
默认:   ┌─────────────────────┐  圆角胶囊，灰色边框，白色背景
        │  刚开始接触，还在摸索  │
        └─────────────────────┘

Hover:  ┌─────────────────────┐  浅蓝背景，蓝色边框
        │  刚开始接触，还在摸索  │
        └─────────────────────┘

选中:   ╔═════════════════════╗  蓝色背景，白色文字，✓ 图标
        ║ ✓ 刚开始接触，还在摸索 ║
        ╚═════════════════════╝
```

**多选（Q2、Q3）— Tag 样式**:

```
默认:   ┌─────────┐  圆角小标签，灰色边框
        │  写文章   │
        └─────────┘

选中:   ╔═════════╗  蓝色边框 + 浅蓝背景，左侧 ✓
        ║ ✓ 写文章 ║
        ╚═════════╝

已满额: ┌─────────┐  灰色半透明，cursor: not-allowed
        │  翻译    │  hover tooltip: "最多选 X 项"
        └─────────┘
```

**多选计数器**（Q2、Q3 题目旁边）:

```
你最想用 AI 帮你做什么？  已选 2/3
                          ─────
                          动态更新，满额变绿色
```

#### 提交按钮

| 状态 | 表现 |
|------|------|
| 未答任何题 | 灰色禁用，文字「至少选一项～」 |
| 已答 ≥ 1 题 | 蓝色可点击，文字「✨ 提交反馈」 |
| 提交中 | Loading spinner，文字「提交中...」 |
| 提交成功 | 绿色对勾，文字「谢谢！」→ 1.5s 后面板自动滑出收起 |

### 5.4 提交成功后

不做单独的「感谢页」，太重了。而是：

1. 提交按钮变绿 + 文字变为「谢谢你的反馈！」
2. 1.5 秒后面板整体向上滑出收起
3. 主界面恢复正常

```
  点击「提交反馈」
       │
       ▼
  [按钮变 loading] ─→ [按钮变绿 ✓ 谢谢！] ─→ (1.5s) ─→ [面板上滑消失]
```

简洁，不打断，用户几乎无感地回到正常使用状态。

### 5.5 视觉风格：融入现有 UI

面板不应该看起来像「外来的弹窗」，而是像产品自身的一个通知条/引导条：

| 元素 | 设计 |
|------|------|
| 面板背景 | `var(--bg-card)` + 底部细线分割 |
| 面板阴影 | `0 2px 12px rgba(0,0,0,0.08)` — 微妙，不突兀 |
| 标题 | 16px semi-bold，不用大字号 |
| 选项标签 | Chip/Tag 样式，紧凑排列 |
| 整体高度 | 尽量控制在 **380-420px**，不要占满屏幕 |
| 间距 | 题目间 16px，选项间 8px，整体紧凑 |

---

## 六、一次性触发机制

### 6.1 本地标记

```typescript
// 扩展 LicenseConfig
interface LicenseConfig {
  // ... 现有字段 ...
  
  /** 问卷状态 */
  surveyStatus?: 'completed' | 'skipped';
  /** 问卷操作时间 (ISO 8601) */
  surveyCompletedAt?: string;
}
```

### 6.2 标记时机

| 操作 | 标记值 | 时机 |
|------|--------|------|
| 用户提交问卷 | `surveyStatus: 'completed'` | 服务器上报成功后（失败也标记，不反复骚扰） |
| 用户关闭面板 | `surveyStatus: 'skipped'` | 点击 ✕ 后立即标记 |
| 7 天窗口过期 | 不主动标记 | `shouldShowSurvey()` 自然返回 false |

### 6.3 边界场景

| 场景 | 处理 |
|------|------|
| 同一授权码不同设备 | 各设备独立判断，服务器用 `licenseKey` 聚合 |
| 用户重装系统 | 本地标记丢失，可能再次弹出（可接受） |
| 用户在面板打开时刷新页面 | 3s 后重新判断，未标记则再次弹出 |
| 上报失败 | 本地仍标记 completed，数据丢失可接受 |
| 开发/测试模式 | 可通过 `?survey=force` URL 参数强制展示 |

---

## 七、数据结构

### 7.1 问卷数据

```typescript
interface SurveyData {
  /** 问卷版本 */
  version: '2.0';
  
  /** 授权码（脱敏：前4+后4） */
  licenseKeyMasked: string;
  
  /** 设备 ID */
  deviceId: string;
  
  /** 操作系统 */
  osInfo: string;
  
  /** 应用版本 */
  appVersion: string;
  
  /** 使用天数（从 validatedAt 到现在） */
  daysSinceActivation: number;

  /** 答案 */
  answers: {
    /** Q1: AI 使用水平（单选） */
    aiLevel: 'beginner' | 'intermediate' | 'regular' | 'advanced';
    
    /** Q2: 最想用 AI 做什么（多选，≤3） */
    aiUseCases: string[];
    
    /** Q3: 最希望我们提供什么（多选，≤2） */
    desiredFeatures: string[];
    
    /** Q4: 开放反馈（选填） */
    openFeedback?: string;
  };
  
  /** 填写耗时（秒） */
  durationSeconds: number;
  
  /** 提交时间 */
  completedAt: string;
  
  /** 来源 */
  source: 'control-ui';
}
```

### 7.2 API 端点

#### 提交问卷

```
POST /api/survey/submit
```

**Request**: `SurveyData`

**Response**:
```json
{ "ok": true, "data": { "recorded": true } }
```

#### 跳过问卷（标记本地）

```
POST /api/survey/skip
```

**Response**:
```json
{ "ok": true, "data": { "skipped": true } }
```

#### 问卷状态检查（UI 启动时调用）

```
GET /api/survey/status
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "shouldShow": true,
    "surveyStatus": null,
    "validatedAt": "2026-02-05T22:00:00.000Z"
  }
}
```

### 7.3 服务端存储

```sql
CREATE TABLE user_surveys (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  license_key     VARCHAR(64)  NOT NULL,
  device_id       VARCHAR(64)  NOT NULL,
  os_info         VARCHAR(128),
  app_version     VARCHAR(32),
  survey_version  VARCHAR(16)  NOT NULL DEFAULT '2.0',
  
  -- 答案
  ai_level           VARCHAR(32),
  ai_use_cases       JSON,
  desired_features   JSON,
  open_feedback      TEXT,
  
  -- 元数据
  days_since_activation INT,
  duration_seconds      INT,
  completed_at          DATETIME NOT NULL,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_license_device (license_key, device_id)
);
```

---

## 八、技术实现方案

### 8.1 改动范围

| 文件 | 改动内容 | 复杂度 |
|------|---------|--------|
| `src/config/types.license.ts` | 新增 `surveyStatus`, `surveyCompletedAt` 字段 | 低 |
| `src/gateway/setup-wizard.ts` | 新增 `/api/survey/*` 路由（submit、skip、status） | 中 |
| `ui/src/ui/views/survey.ts` | **新增** 问卷面板组件（Lit 模板） | 高 |
| `ui/src/ui/app.ts` | 引入 survey 组件，3s 延迟触发检查 | 低 |
| `ui/src/styles/survey.css` | **新增** 问卷面板样式 | 中 |
| `ui/src/ui/controllers/survey.ts` | **新增** 问卷控制器（状态、提交、跳过） | 中 |

### 8.2 后端路由处理

```typescript
// src/gateway/setup-wizard.ts（或新建 src/gateway/survey.ts）

// 路由注册
case "/survey/status":
  await handleSurveyStatus(req, res);
  return true;
case "/survey/submit":
  await handleSurveySubmit(req, res);
  return true;
case "/survey/skip":
  await handleSurveySkip(req, res);
  return true;
```

#### handleSurveyStatus

```typescript
async function handleSurveyStatus(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const config = loadConfig();
  const license = config.license;
  
  const shouldShow = shouldShowSurvey(config, Date.now());
  
  sendJson(res, 200, {
    ok: true,
    data: {
      shouldShow,
      surveyStatus: license?.surveyStatus ?? null,
      validatedAt: license?.validatedAt ?? null,
    },
  });
}
```

#### handleSurveySubmit

```typescript
async function handleSurveySubmit(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody<SurveyData>(req);
  if (!body?.answers) {
    sendJson(res, 400, { ok: false, error: "问卷数据无效" });
    return;
  }

  // 1. 上报到统计服务器（失败不阻塞）
  try {
    await reportSurveyToServer(body);
  } catch (e) {
    console.warn("[survey] Remote report failed:", e);
  }

  // 2. 本地标记完成
  const config = loadConfig();
  await writeConfigFile({
    ...config,
    license: {
      ...config.license,
      surveyStatus: 'completed',
      surveyCompletedAt: new Date().toISOString(),
    },
  });

  sendJson(res, 200, { ok: true, data: { recorded: true } });
}
```

### 8.3 前端组件（Lit 模板概要）

```typescript
// ui/src/ui/views/survey.ts

import { html, nothing } from "lit";

export function renderSurveyPanel(opts: {
  visible: boolean;
  onSubmit: (data: SurveyAnswers) => void;
  onClose: () => void;
}) {
  if (!opts.visible) return nothing;
  
  return html`
    <div class="survey-panel slide-in">
      <button class="survey-close" @click=${opts.onClose}>✕</button>
      
      <h3>花 30 秒帮我们变得更好</h3>
      <p class="survey-subtitle">你的反馈将直接影响我们的 AI 课程设计和产品方向</p>
      
      <!-- Q1: 单选 Chips -->
      <div class="survey-question">
        <label>❶ 你目前的 AI 使用水平？</label>
        <div class="survey-chips single">
          ${renderChips(Q1_OPTIONS, 'aiLevel', 1)}
        </div>
      </div>
      
      <!-- Q2: 多选 Tags -->
      <div class="survey-question">
        <label>❷ 你最想用 AI 帮你做什么？<span class="survey-counter">已选 0/3</span></label>
        <div class="survey-chips multi">
          ${renderChips(Q2_OPTIONS, 'aiUseCases', 3)}
        </div>
      </div>
      
      <!-- Q3: 多选 Tags -->
      <div class="survey-question">
        <label>❸ 你最希望我们提供什么？<span class="survey-counter">已选 0/2</span></label>
        <div class="survey-chips multi">
          ${renderChips(Q3_OPTIONS, 'desiredFeatures', 2)}
        </div>
      </div>
      
      <!-- Q4: 开放题 -->
      <div class="survey-question">
        <label>💬 还有什么想说的？<span class="survey-optional">选填</span></label>
        <input type="text" class="survey-input" 
               placeholder="比如：希望出个 Prompt 教程..." 
               maxlength="100" />
      </div>
      
      <div class="survey-footer">
        <button class="survey-submit" @click=${handleSubmit}>
          ✨ 提交反馈
        </button>
      </div>
    </div>
  `;
}
```

### 8.4 前端触发逻辑

```typescript
// ui/src/ui/controllers/survey.ts

export function initSurveyCheck(client: GatewayBrowserClient) {
  // 延迟 3 秒再检查，让用户先看到主界面
  setTimeout(async () => {
    try {
      const res = await fetch('/api/survey/status');
      const data = await res.json();
      
      if (data.ok && data.data.shouldShow) {
        showSurveyPanel();
        recordSurveyStartTime();  // 用于计算填写耗时
      }
    } catch (e) {
      // 静默失败，不影响正常使用
      console.debug('[survey] Status check failed:', e);
    }
  }, 3000);
}
```

---

## 九、视觉规范

### 9.1 配色（复用现有 UI 设计系统）

| 元素 | 颜色 |
|------|------|
| 面板背景 | `var(--bg-card)` |
| 面板底边 | `1px solid var(--border-default)` |
| 标题文字 | `var(--text-primary)` 16px semi-bold |
| 副标题 | `var(--text-secondary)` 13px |
| 选项默认 | `var(--bg-subtle)` 背景 + `var(--border-default)` 边框 |
| 选项选中 | `#3c83f6` 背景 + 白色文字 |
| 选项满额灰 | `opacity: 0.4` + `cursor: not-allowed` |
| 提交按钮 | `#3c83f6` → 成功变 `#22c55e` |
| 关闭按钮 | `var(--text-tertiary)` 灰色 |
| 计数器 | `var(--text-tertiary)` → 满额变 `#22c55e` |

### 9.2 动画

| 动画 | 参数 |
|------|------|
| 面板滑入 | `transform: translateY(-100%) → 0`, `400ms ease-out` |
| 面板滑出 | `transform: 0 → translateY(-100%)`, `300ms ease-in` |
| 选项选中 | `scale(0.95) → scale(1)`, `150ms ease-out` |
| 提交成功 | 按钮 `background: blue → green`, `200ms` |

### 9.3 响应式

| 屏幕宽度 | 适配 |
|----------|------|
| ≥ 1024px | Chips 每行 4 个，面板最大宽度 720px 居中 |
| 768-1024px | Chips 每行 3 个 |
| < 768px | Chips 每行 2 个，面板全宽 |

---

## 十、数据分析维度

### 10.1 核心报表

| 报表 | 分析维度 | 价值 |
|------|---------|------|
| 用户水平分布 | Q1 饼图 | 课程起点设计 |
| 使用场景 TOP3 | Q2 柱状图 | 课程场景优先级 |
| 需求偏好 | Q3 柱状图 | 产品路线图 & 课程形式 |
| 水平×场景交叉 | Q1 × Q2 矩阵 | 不同层级的核心诉求 |
| 开放题词云 | Q4 文本分析 | 发现盲区需求 |
| 填写时长分布 | durationSeconds | 问卷体验监控 |
| 使用天数分布 | daysSinceActivation | 触发时机优化参考 |

### 10.2 新增分析维度

由于改为「次日触发」，比 v1 多了一个有价值的维度：

- **`daysSinceActivation`** —— 用户是第 2 天回来的还是第 5 天？
  - 第 2 天回来的是高活跃用户，其反馈权重更高
  - 第 5-7 天回来的可能是低频用户，诉求可能不同

---

## 十一、测试要点

### 11.1 触发条件测试

| 用例 | 预期 |
|------|------|
| 激活后 < 18 小时打开 UI | 不弹出 |
| 激活后 20 小时打开 UI | 弹出 |
| 激活后 8 天打开 UI | 不弹出（超出 7 天窗口） |
| 已提交过问卷 | 不弹出 |
| 已关闭过问卷 | 不弹出 |
| 未激活授权码 | 不弹出 |
| `?survey=force` 参数 | 强制弹出（开发测试） |

### 11.2 交互测试

| 用例 | 预期 |
|------|------|
| 页面加载后 | 3 秒后面板滑入 |
| 不选任何选项点提交 | 按钮禁用，提示「至少选一项」 |
| Q2 选满 3 项后再选 | 不可选，视觉灰化 |
| Q3 选满 2 项后再选 | 不可选 |
| 点击 ✕ 关闭 | 面板上滑消失 |
| 提交成功 | 按钮变绿 → 1.5s 后面板消失 |
| 提交时网络断开 | 本地标记完成，不反复弹 |
| 面板展示中刷新页面 | 3s 后重新判断是否展示 |

### 11.3 兼容性

- Windows Chrome / Edge ≥ 90
- macOS Safari ≥ 15 / Chrome
- 最小分辨率: 1024×768

---

## 十二、里程碑

| 阶段 | 内容 | 工期 |
|------|------|------|
| Phase 1 | 后端 API（status/submit/skip）+ 类型定义 | 0.5 天 |
| Phase 2 | 前端问卷面板组件 + 样式 | 1 天 |
| Phase 3 | 触发逻辑 + 本地标记 + 联调 | 0.5 天 |
| Phase 4 | 服务端上报接口 + 数据存储 | 0.5 天 |
| Phase 5 | 测试 + 边界场景 | 0.5 天 |
| **合计** | | **3 天** |

---

## 十三、v1 → v2 变更对照

| 维度 | v1（Setup 内） | v2（次日触发） |
|------|---------------|---------------|
| 触发位置 | `setup-page.ts` Step 4 | Control UI 主界面 |
| 触发时机 | 授权码验证成功后立即 | 首次验证 ≥ 18h 后，页面加载 3s 后 |
| 题量 | 6 题 | **3 + 1 可选** |
| 预计时长 | 60-90s（实际 2-3min） | **< 30s** |
| 展现形式 | 卡片翻页（阻塞 Setup） | **顶部滑入面板（非模态）** |
| 布局 | 一题一屏 | **单页全展示** |
| 关闭 | 灰色「跳过问卷」文字 | **右上角 ✕，一键关闭** |
| 提交后 | 2s 感谢页 | **按钮变绿 → 1.5s 滑出** |
| 数据来源标记 | `source: 'setup-wizard'` | `source: 'control-ui'` |
| 新增字段 | 无 | `daysSinceActivation`（使用天数）|
| 有效窗口 | 无限（每次验证都可能触发） | **7 天窗口，过期不再骚扰** |

---

## 附录 A：完整交互原型

### 未选中状态

```
┌────────────────────────────────────────────────────────────┐
│  ✕                                                        │
│                                                            │
│  花 30 秒帮我们变得更好                                      │
│  你的反馈将直接影响我们的 AI 课程设计和产品方向                  │
│                                                            │
│  ❶ 你目前的 AI 使用水平？                                   │
│                                                            │
│  ┌───────────────┐ ┌────────────────────┐                  │
│  │ 刚开始接触      │ │ 会基本对话，想学更多 │                  │
│  └───────────────┘ └────────────────────┘                  │
│  ┌─────────────────┐ ┌────────────────────┐                │
│  │ 比较熟练，日常在用│ │ 深度玩家，各种都试过 │                │
│  └─────────────────┘ └────────────────────┘                │
│                                                            │
│  ❷ 你最想用 AI 帮你做什么？              已选 0/3            │
│                                                            │
│  ┌────────┐ ┌──────┐ ┌──────────┐ ┌────────┐              │
│  │ 写文章  │ │ 写代码│ │ 办公提效  │ │ 学新知识│              │
│  └────────┘ └──────┘ └──────────┘ └────────┘              │
│  ┌────────┐ ┌──────┐ ┌──────────┐ ┌────────┐              │
│  │ 数据分析│ │ 翻译  │ │ 做图/设计 │ │ 自动化  │              │
│  └────────┘ └──────┘ └──────────┘ └────────┘              │
│                                                            │
│  ❸ 你最希望我们提供什么？                已选 0/2            │
│                                                            │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐                  │
│  │ 视频教程  │ │ Prompt模板库│ │ 场景教学  │                  │
│  └──────────┘ └───────────┘ └──────────┘                  │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐                  │
│  │ 更多模型  │ │ 交流社群   │ │ 多端同步  │                  │
│  └──────────┘ └───────────┘ └──────────┘                  │
│                                                            │
│  💬 还有什么想说的？（选填）                                  │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 比如：希望出个 Prompt 教程...                       │      │
│  └──────────────────────────────────────────────────┘      │
│                                                            │
│                             [ 至少选一项～ ] (灰色禁用)      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 已选中状态（Q1 + Q2 满额 + Q3 进行中）

```
┌────────────────────────────────────────────────────────────┐
│  ✕                                                        │
│                                                            │
│  花 30 秒帮我们变得更好                                      │
│  你的反馈将直接影响我们的 AI 课程设计和产品方向                  │
│                                                            │
│  ❶ 你目前的 AI 使用水平？                                   │
│                                                            │
│  ┌───────────────┐ ╔════════════════════╗                  │
│  │ 刚开始接触      │ ║ ✓ 会基本对话想学更多║ ← 选中(蓝底白字)  │
│  └───────────────┘ ╚════════════════════╝                  │
│  ┌─────────────────┐ ┌────────────────────┐                │
│  │ 比较熟练，日常在用│ │ 深度玩家，各种都试过 │                │
│  └─────────────────┘ └────────────────────┘                │
│                                                            │
│  ❷ 你最想用 AI 帮你做什么？              已选 3/3 ✓         │
│                                                            │
│  ╔════════╗ ╔══════╗ ┌──────────┐ ╔════════╗              │
│  ║✓ 写文章 ║ ║✓写代码║ │ 办公提效  │ ║✓学新知识║              │
│  ╚════════╝ ╚══════╝ └──────────┘ ╚════════╝              │
│  ┌────────┐ ┌──────┐ ┌──────────┐ ┌────────┐              │
│  │ 数据分析│ │ 翻译  │ │ 做图/设计 │ │ 自动化  │  ← 灰化     │
│  └────────┘ └──────┘ └──────────┘ └────────┘              │
│                                                            │
│  ❸ 你最希望我们提供什么？                已选 1/2            │
│                                                            │
│  ┌──────────┐ ╔═══════════╗ ┌──────────┐                  │
│  │ 视频教程  │ ║✓Prompt模板库║ │ 场景教学  │                  │
│  └──────────┘ ╚═══════════╝ └──────────┘                  │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐                  │
│  │ 更多模型  │ │ 交流社群   │ │ 多端同步  │                  │
│  └──────────┘ └───────────┘ └──────────┘                  │
│                                                            │
│  💬 还有什么想说的？（选填）                                  │
│  ┌──────────────────────────────────────────────────┐      │
│  │                                                    │      │
│  └──────────────────────────────────────────────────┘      │
│                                                            │
│                              [ ✨ 提交反馈 ] (蓝色可点击)    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 附录 B：问卷数据示例

```json
{
  "version": "2.0",
  "licenseKeyMasked": "CB-2****8x7z",
  "deviceId": "a1b2c3d4e5f6...",
  "osInfo": "Windows 10.0.26200",
  "appVersion": "2026.2.6",
  "daysSinceActivation": 1,
  "answers": {
    "aiLevel": "intermediate",
    "aiUseCases": ["writing", "coding", "learning"],
    "desiredFeatures": ["prompt_templates", "scenario_courses"],
    "openFeedback": "希望出个系统性的 Prompt 编写教程"
  },
  "durationSeconds": 24,
  "completedAt": "2026-02-07T10:15:00.000Z",
  "source": "control-ui"
}
```

---

## 附录 C：风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 次日不回访 | 问卷零曝光 | 可接受：不回来的用户数据价值本就低 |
| 用户直接关闭 | 完成率低 | 极简设计（30s） + 不做二次弹出 |
| 上报失败 | 数据丢失 | 本地标记不受影响，可尝试下次启动补传 |
| 问卷版本迭代 | 数据对比 | `version` 字段区分，向后兼容 |
| 面板高度过大 | 小屏挤压 | 响应式适配，选项自动换行 |
