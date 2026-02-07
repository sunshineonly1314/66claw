# ClawdbotCN 用户体验优化方案

> **创建日期**：2026-01-30  
> **最后更新**：2026-01-30（融合代码实现细节）  
> **状态**：待实施  
> **目标用户**：普通用户（70%了解API Key，30%纯小白）  
> **核心原则**：保留常见术语、简化晦涩概念、减少选择负担、提供合理默认值

---

## 文档约定

> ⚠️ **重要**：本文档中的配置值已与代码实现对齐，以下是关键术语映射：

### 安全模式术语映射（前端 ↔ 后端）

| 前端模式 ID | 显示名称 | sandbox.mode | tools.exec.security | 适用场景 |
|------------|---------|-------------|---------------------|---------|
| `full` | 安全模式 (Full Sandbox) | `"all"` | `"deny"` | 有重要文件、共用电脑 |
| `standard` | 智能模式 (Standard Mode) | `"non-main"` | `"allowlist"` | 日常工作电脑（**推荐**） |
| `trust` | 专家模式 (Trust Mode) | `"off"` | `"full"` | 独立设备、技术高手 |

### 关联源码文件

| 文件 | 描述 |
|------|------|
| `src/gateway/setup-page.ts` | 前端 HTML/CSS/JS（安装向导页面） |
| `src/gateway/setup-wizard.ts` | 后端 API 处理器 |
| `src/config/region-cn.ts` | 中国区配置（服务商、默认值） |
| `src/agents/bash-tools.exec.ts` | 审批超时配置 |
| `src/gateway/config-reload.ts` | 配置热更新规则 |

---

## 零、设计原则

### 用户画像（更准确的定位）

**按技术水平划分**：

| 用户类型 | 比例 | 特征 | 设计策略 |
|---------|------|------|---------|
| **入门用户** | 70% | 知道API Key是什么，用过ChatGPT | 保持专业术语，优化流程 |
| **纯小白** | 20% | 不懂技术，只想用AI | 提供括号说明和默认值 |
| **开发者** | 10% | 懂技术，需要高级功能 | 保留高级选项入口 |

**按服务偏好划分**（产品经理补充 2026-01-30）：

| 用户类型 | 占比 | 特征 | 需求 |
|---------|------|------|------|
| **国产模型用户** | 85% | 普通用户、无海外网络 | 硅基流动、阿里云等 |
| **国际模型用户** | 10% | 开发者、有代理、公司付费 | OpenAI、Anthropic、Google |
| **自建/私有部署** | 5% | 企业用户、本地部署 | 兼容 OpenAI 协议的私有端点 |

**为什么要支持国际服务和自定义端点**：
- ❌ **不做会流失高端用户**：开发者往往已有 OpenAI/Anthropic API Key，强迫他们用国产模型会直接放弃
- ✅ **协议开放是刚需**：很多用户用 OneAPI、New API 等聚合网关，需要自定义端点
- ✅ **差异化竞争**：国内同类产品大多只支持固定几家，我们支持「任意 OpenAI 兼容端点」是卖点

### 设计原则

```
1. 常见术语保留（API Key、模型、配置）
2. 晦涩术语简化（沙盒→工作范围，提示词注入→删除）
3. 提供合理默认值，减少必选项
4. 复杂配置折叠，但保留入口
5. 括号补充说明，而非完全替换
6. 不显示价格信息（token价格），只显示推荐原因
```

### ⚠️ 禁止事项

- **不要显示模型价格**：token 价格对普通用户没有意义，且价格会变动
- **不要显示技术参数**：如上下文长度、参数量等
- **只展示推荐原因**：如"速度快"、"性价比高"、"免费额度多"

---

## 零-B、服务商 API Key 格式规范（前端校验用）

> 根据实际 API Key 格式，前端需要进行格式校验

| 服务商 | API Key 格式 | 正则校验 | 示例 |
|-------|-------------|---------|------|
| **硅基流动** | `sk-` 前缀 | `/^sk-[a-zA-Z0-9]{20,}$/` | `sk-xxxxxxxxxxxxxx` |
| **阿里云百炼** | `sk-` 前缀 | `/^sk-[a-zA-Z0-9]{20,}$/` | `sk-xxxxxxxxxxxxxx` |
| **DeepSeek** | `sk-` 前缀 | `/^sk-[a-zA-Z0-9]{20,}$/` | `sk-xxxxxxxxxxxxxx` |
| **智谱 GLM** | 两段式（中间有点） | `/^[a-zA-Z0-9]{32}\.[a-zA-Z0-9]{16,}$/` | `4ddd4ab6a37d41e0ac445e8a3646db0a.Hg5KLqcnOT8EVKSq` |
| **豆包** | UUID 格式 | `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` | `0baa0583-1300-40ec-88fc-13df830b0e08` |
| **腾讯混元** | `sk-` 前缀（但需双字段） | `/^sk-[a-zA-Z0-9]{20,}$/` | `sk-0K0QNzcseXoEYk6UfyBO7X9SzV59p2TIRPfSmgFJ2kBnbhD6` |
| **MiniMax** | 长字符串（JWT格式） | `/^[a-zA-Z0-9_-]{50,}$/` | 很长的字符串 |

### 特殊配置说明

1. **豆包（火山引擎）**：
   - API Key 是 UUID 格式
   - **模型 ID 不是固定值**，是用户创建的「推理接入点 ID」（格式：`ep-xxxxxxxxxx`）
   - 需要在 UI 中特别提示用户

2. **腾讯混元**：
   - 需要 **两个字段**：SecretId + SecretKey
   - 前端需要双输入框 UI

3. **智谱 GLM**：
   - API Key 是两段式，中间有点号 `.` 分隔
   - 校验时需要检查格式

---

## 一、当前配置向导的致命问题

### 逐步分析（基于 setup-page.ts 代码审查）

#### 🟡 步骤1：选择AI服务 - 选择过多

**当前页面内容**：
```
第一步：选择 AI 服务
选择你要使用的 AI 平台，或者注册一个新账号

[硅基流动] [阿里云百炼] [智谱GLM] [腾讯混元] ...

API Key: [________________]
选择模型: [deepseek-ai/DeepSeek-V3 ▼]
```

**问题清单**：

| 问题 | 影响 | 严重度 |
|-----|------|--------|
| 7个AI平台并列展示 | 选择困难，不知道哪个好 | 🟡 |
| 模型选择20+选项 | 大部分用户不知道区别 | 🟡 |
| 没有明确的推荐默认值 | 用户犹豫 | 🟡 |

**注意**：API Key 是常见术语，70%用户理解，无需替换。

---

#### 🟡 步骤2：安全设置 - 术语需简化

**当前页面内容**：
```
第二步：安全设置
选择 AI 助手的权限级别，保护你的数据安全

🛡️ 什么是「沙盒」？
沙盒 = AI 的「活动范围」。超出范围的文件，AI 碰不到、改不了。

⚠️ 安全提示
AI 存在「提示词注入」风险 —— 恶意文档可能诱导 AI 执行危险操作。

[安全模式] [智能模式] [专家模式]
```

**问题清单**：

| 问题 | 影响 | 严重度 |
|-----|------|--------|
| "沙盒"术语 | 部分用户不理解 | 🟡 |
| "提示词注入"术语 | 大部分用户不理解，且造成恐惧 | 🔴 |
| 风险声明过长 | 影响阅读体验 | 🟡 |
| 三个模式差异不够直观 | 选择困难 | 🟡 |

**优化方向**：
- "沙盒"可保留，但加括号说明"（AI的工作范围）"
- "提示词注入"建议删除或改为更通俗的说法
- 风险声明精简为1-2句话

---

#### 🟢 步骤3：工作目录 - 基本OK

**当前页面内容**：
```
第三步：设置工作目录
指定 AI 可以操作的文件夹范围

📁 选择 AI 的工作目录
[C:\Clawdbot\workspace] [浏览选择]

💡 建议：创建一个专用文件夹（如 D:\AI工作区）
```

**问题清单**：

| 问题 | 影响 | 严重度 |
|-----|------|--------|
| "信任目录"术语不够直观 | 部分用户困惑 | 🟢 |
| 没有自动创建默认目录 | 需要用户手动操作 | 🟢 |

**优化方向**：提供合理的默认值，大部分用户直接下一步即可。

---

#### 🔴🔴 步骤4：配置指挥渠道 - 最大流失点！

**当前页面内容**：
```
第四步：配置指挥渠道
选择并配置你的聊天应用，让 AI 助手可以接收指令

[钉钉] [飞书] [企业微信-即将支持]

📱 钉钉机器人配置
在钉钉开放平台创建企业内部应用获取以下信息 [配置教程]

App Key *     [dingxxxxxxxx        ]
App Secret *  [******************** ]
机器人 Token  [如有单聊机器人，填写Token]
```

**核心问题**：
- **没有简单选项**：强制要求配置钉钉/飞书机器人
- **门槛过高**：需要企业管理员权限、开放平台操作
- **个人用户无法完成**：没有企业版账号的用户直接卡死

**这是导致用户流失的最大原因！**

**问题清单**：

| 问题 | 影响 | 严重度 |
|-----|------|--------|
| 没有「跳过」按钮 | 个人用户无法继续 | 🔴🔴 |
| 需要企业管理员权限 | 普通员工做不了 | 🔴 |
| 配置流程复杂（开放平台→创建应用→获取凭证） | 即使是开发者也嫌麻烦 | 🔴 |
| 没有提示可以用 Web 界面 | 用户不知道跳过后还能用 | 🔴 |

**注意**：App Key、App Secret 是开发者熟悉的术语，问题不在术语，而在于**没有提供更简单的替代方案**。

---

## 二、用户流失漏斗推测

```
100人 下载安装
  │
  ├── 20人 WSL安装失败/虚拟化未开启 → 放弃
  │
80人 进入配置向导
  │
  ├── 15人 步骤1 不知道选哪个AI/不会获取API Key → 放弃
  │
65人 到达步骤2
  │
  ├── 10人 被风险声明吓到 → 放弃
  │
55人 到达步骤4
  │
  ├── 30人 不会配置钉钉/飞书机器人 → 放弃  ← 最大流失点！
  │
25人 完成配置
  │
  ├── 5人 使用中遇到错误看不懂 → 放弃
  │
20人 成功使用

转化率：20%（极低！）
```

---

## 三、优化方案（按优先级）

### 🔴🔴 最高优先级：步骤4 - 渠道配置可跳过

**当前问题**：配置流程要求钉钉/飞书机器人，普通用户可能没有企业管理员权限。

**优化方案**：
1. 此步骤**可跳过**（最重要！）
2. 突出「手机控制」卖点，但不强制
3. 配置完成后用户默认可通过 Web 界面对话，无需渠道也能使用

**改造后的步骤4**：

```
┌─────────────────────────────────────────────────────────────────────┐
│  第四步：配置指挥渠道（可选）                          [可跳过此步]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📱 手机就能控制你的 Clawdbot！                                     │
│     配置后可随时随地发消息，AI 帮你在电脑上干活                      │
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────┐          │
│  │  📱 钉钉机器人          │  │  🪶 飞书机器人          │          │
│  │                         │  │                         │          │
│  │  通过钉钉对话控制 AI    │  │  通过飞书对话控制 AI    │          │
│  │                         │  │                         │          │
│  │  [选择]                 │  │  [选择]                 │          │
│  └─────────────────────────┘  └─────────────────────────┘          │
│                                                                     │
│  ┌─────────────────────────┐                                        │
│  │  💼 企业微信            │                                        │
│  │  [即将支持]             │  ← 灰色禁用                            │
│  └─────────────────────────┘                                        │
│                                                                     │
│  💡 不确定怎么配置？先跳过！                                         │
│     配置完成后你可以直接通过 Web 界面与 AI 对话                      │
│     后续可在「设置」→「渠道」中随时配置钉钉/飞书                    │
│                                                                     │
│  [跳过此步，稍后配置] [下一步]                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**前后端 API 对接**：
```
POST /api/setup/configure-channels
Content-Type: application/json

{
  "channels": ["dingtalk", "feishu"]  // 可为空数组表示跳过
}
```

**关键改动**：
1. 标题改为「配置指挥渠道（可选）」，明确是可选步骤
2. 突出「手机控制」卖点，但提示可跳过
3. **强调**：跳过后仍可通过 Web 界面对话
4. 后续可在设置中配置
5. ❌ **不增加"网页对话"选项**（因为配置完成后默认就有 Web 界面）

---

### 🟡 中优先级：步骤1 - 三层折叠结构（重大更新）

> **产品经理需求更新**：2026-01-30  
> 支持国际服务和自定义端点，满足不同用户群体需求

#### 整体架构：三层折叠结构

| 层级 | 默认状态 | 内容 | 目标用户 | 占比 |
|-----|---------|------|---------|-----|
| Layer 1 | **展开，占页面主体** | 国内推荐服务（硅基流动、阿里云百炼、智谱） | 普通用户 | **80%** |
| Layer 2 | 折叠 | 国际服务（OpenAI/Anthropic/Google） | 有海外网络的用户 | 10% |
| Layer 3 | 折叠 | 自定义端点（OpenAI协议/Anthropic协议） | 专业用户 | 10% |

#### 改造后的步骤1（完整UI结构）

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  第一步：选择 AI 服务                                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ══════════════════════ 🇨🇳 国内服务（推荐）══════════════════════              │
│                                        ↑ 占页面 80%，展开状态                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ 🔮 硅基流动                                              [🌟 首选推荐]  │    │
│  │ 免费送 2000万 tokens · DeepSeek等顶尖模型 · 国内极速                    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐        │
│  │ ☁️ 阿里云百炼（通义千问）[推荐] │  │ 🧠 智谱 GLM              [推荐] │        │
│  │ 大厂稳定 · 超长上下文          │  │ 国产自研 · 工具调用能力强      │        │
│  └────────────────────────────────┘  └────────────────────────────────┘        │
│                                                                                 │
│  ▸ 更多国内服务：豆包 · DeepSeek · 腾讯混元 · MiniMax                           │
│                                                                                 │
│  ══════════════════════════════════════════════════════════════════════════     │
│                                                                                 │
│  ▸ 🌐 国际服务（需科学上网 · 开源自带，与软件无关）         ← 折叠，占 10%       │
│                                                                                 │
│  ▸ 🔧 自定义端点（专业用户）                                ← 折叠，占 10%       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Layer 1 详细设计：国内服务区（占页面80%，主推3家）

**默认展开，突出主推的3家服务商**（硅基流动、阿里云百炼、智谱）：

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ════════════════════════ 🇨🇳 国内服务（推荐）════════════════════════          │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ 🔮 硅基流动                                              [🌟 首选推荐]  │    │
│  │                                                                         │    │
│  │ 免费送 2000万 tokens · DeepSeek等顶尖模型 · 国内极速访问               │    │
│  │                                                                         │    │
│  │ ✨ 新用户注册即送免费额度，无需绑卡                                    │    │
│  │                                                                         │    │
│  │                                      👆 点击整个卡片去注册（新窗口）   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌────────────────────────────────────┐  ┌────────────────────────────────┐    │
│  │ ☁️ 阿里云百炼（通义千问）  [推荐]  │  │ 🧠 智谱 GLM              [推荐] │    │
│  │                                    │  │                                │    │
│  │ 大厂稳定 · 超长上下文              │  │ 国产自研 · 工具调用能力强      │    │
│  │ 👆 点击注册                        │  │ 👆 点击注册                    │    │
│  └────────────────────────────────────┘  └────────────────────────────────┘    │
│                                                                                 │
│  ▸ 更多服务（点击展开）                                                         │
│    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                             │
│    │  豆包   │ │ DeepSeek│ │腾讯混元 │ │ MiniMax │  ← 小卡片                    │
│    └─────────┘ └─────────┘ └─────────┘ └─────────┘                             │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  📝 输入 API Key                                                               │
│                                                                                 │
│  已选择：硅基流动                                                               │
│                                                                                 │
│  API Key                                                                        │
│  ┌─────────────────────────────────────────────────────────────┬────────┐      │
│  │ sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx                         │ 📋粘贴 │      │
│  └─────────────────────────────────────────────────────────────┴────────┘      │
│                                                                                 │
│  💡 还没有 API Key？点击上方服务商卡片去注册获取                                │
│                                                                                 │
│  [验证并继续]                                                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

💡 **交互说明**：
1. 整个服务商卡片可点击，点击后新窗口打开对应的注册页面（使用返利链接）
2. 选中服务商后，下方显示 API Key 输入框
3. 点击「验证并继续」验证 Key 有效性后进入下一步
```

#### Layer 2 详细设计：国际服务区

**默认折叠，展开后显示网络提示**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🌐 国际服务                                                            │
│  ⚠️ 需要自行解决网络访问问题                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   OpenAI     │  │  Anthropic   │  │   Google     │                  │
│  │   GPT-4o     │  │   Claude     │  │   Gemini     │                  │
│  │   最强通用   │  │   最强代码   │  │   性价比高   │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
│  ▸ 更多：Mistral · Cohere · Groq · Together AI                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**关键交互**：
1. 点击服务商卡片后，展开对应的 API Key 输入框
2. 自动检测网络连通性，失败时显示友好提示
3. **不显示价格**，只显示特点（最强通用、最强代码等）

**网络检测逻辑**：
```
用户选择国际服务
    │
    ▼
检测 API 端点连通性（3秒超时）
    │
    ├── 成功 → 正常流程
    │
    └── 失败 → 显示提示：
              "无法连接到 api.openai.com
               请检查网络设置后重试
               [重试] [切换到国内服务]"
```

#### Layer 3 详细设计：自定义端点区

**两个按钮入口**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔧 自定义端点                                                          │
│  适合使用 OneAPI、New API、私有部署的用户                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────┐  ┌─────────────────────────┐              │
│  │  [+] OpenAI 协议        │  │  [+] Anthropic 协议     │              │
│  │  兼容大多数服务         │  │  Claude 原生协议        │              │
│  └─────────────────────────┘  └─────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**点击「OpenAI 协议」后展开**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│  OpenAI 兼容端点配置                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  API 地址 *                                                             │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │ https://your-api.com/v1                                    │        │
│  └────────────────────────────────────────────────────────────┘        │
│  💡 常见地址：                                                          │
│     • OpenAI 官方：https://api.openai.com/v1                           │
│     • OneAPI：http://localhost:3000/v1                                  │
│     • Cloudflare AI Gateway：https://gateway.ai.cloudflare.com/v1/...  │
│                                                                         │
│  API Key *                                                              │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │ sk-xxxx                                                    │        │
│  └────────────────────────────────────────────────────────────┘        │
│                                                                         │
│  模型名称                                                               │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │ gpt-4o                                          │ [获取列表]│        │
│  └────────────────────────────────────────────────────────────┘        │
│  💡 不确定填什么？点击「获取列表」自动查询可用模型                       │
│                                                                         │
│  [测试连接]                                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**点击「Anthropic 协议」后展开**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Anthropic 端点配置                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  API 地址                                                               │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │ https://api.anthropic.com                      │ [默认]    │        │
│  └────────────────────────────────────────────────────────────┘        │
│  💡 代理地址示例：https://your-proxy.com/anthropic                      │
│                                                                         │
│  API Key *                                                              │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │ sk-ant-xxxx                                                │        │
│  └────────────────────────────────────────────────────────────┘        │
│                                                                         │
│  模型                                                                   │
│  [claude-sonnet-4-20250514 ▼]                                          │
│    ├── claude-sonnet-4-20250514 （推荐）                               │
│    ├── claude-opus-4-20250514                                          │
│    └── claude-3-5-haiku-20241022                                        │
│                                                                         │
│  [测试连接]                                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 协议差异处理（技术参考）

| 特性 | OpenAI 协议 | Anthropic 协议 |
|-----|------------|---------------|
| 端点格式 | `/v1/chat/completions` | `/v1/messages` |
| 认证头 | `Authorization: Bearer sk-xxx` | `x-api-key: sk-ant-xxx` |
| 模型列表 | `GET /v1/models` 标准接口 | 需硬编码或手动输入 |
| 流式响应 | `data: {...}` SSE | `event: content_block_delta` SSE |

**技术建议**：
- 复用 Clawdbot 原版的 provider 代码（`src/providers/openai.ts`、`src/providers/anthropic.ts`）
- 自定义端点只需要覆盖 `baseUrl` 配置
- 「获取模型列表」功能仅 OpenAI 协议可用，Anthropic 协议需要预置列表

#### 配置存储结构

配置存储在 `~/.clawdbot/config.yaml` 或平台特定路径：

| 平台 | 配置文件路径 |
|------|-------------|
| **Windows** | `C:\Clawdbot\config\settings.json` |
| **macOS** | `~/.clawbotcn/config/settings.json` |
| **Linux** | `/opt/clawdbot/config/settings.json` |

**Provider 配置结构**（与代码对齐）：

```json
{
  "providers": {
    "siliconflow": {
      "apiKey": "sk-xxx"
    }
  },
  "largeModelProvider": "siliconflow",
  "smallModelProvider": "siliconflow"
}
```

支持4种方式：
1. **预置服务商（国内）**：type=preset, name=siliconflow/alibaba/doubao等
2. **预置服务商（国际）**：type=preset, name=openai/anthropic/google
3. **自定义 OpenAI 协议**：type=custom-openai, baseUrl=xxx
4. **自定义 Anthropic 协议**：type=custom-anthropic, baseUrl=xxx

#### 关键改动总结

1. **保留 "API Key" 术语**（70%用户理解）
2. **三层折叠结构**：国内服务展开、国际/自定义折叠
3. **网络检测**：国际服务自动检测连通性
4. **自定义端点**：支持 OpenAI 协议 + Anthropic 协议
5. **模型列表获取**：OpenAI 协议支持自动获取
6. **测试连接按钮**：实时验证配置正确性
7. **添加"粘贴"按钮**方便操作

**⚠️ 禁止显示的信息**：
- ❌ Token 价格（如 ¥0.001/1K tokens、$2.5/1M）
- ❌ 技术参数（如 128K 上下文、175B 参数）
- ✅ 只显示推荐原因（免费额度、速度快、最强代码）

#### 风险与规避

| 风险 | 等级 | 应对策略 |
|-----|-----|---------|
| 网络访问失败 | 中 | 检测连通性，失败时提示「需要自行解决网络问题」 |
| 合规敏感 | 低 | 不主动推荐，放在折叠区，用户自行选择 |
| 增加维护成本 | 低 | OpenAI/Anthropic 协议稳定，复用原版 Clawdbot 代码 |
| 用户误选国际服务后网络不通 | 中 | 网络检测 + 明确提示「需自行解决网络问题」 |
| 自定义端点配置错误 | 中 | 「测试连接」按钮，实时验证 |
| 增加选项导致选择困难 | 低 | 默认折叠，只有主动点开才显示 |
| 模型名称输错 | 低 | OpenAI 协议提供「获取列表」；Anthropic 提供下拉选择 |

---

### 🟡 中优先级：步骤2 - 三种模式同等展示，术语增加括号说明

**优化方案**：三种模式同等大小展示（不折叠），专业术语增加括号说明体现专业性

**改造后的步骤2**：

```
┌─────────────────────────────────────────────────────────────────────┐
│  第二步：安全设置                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  选择 AI 的权限范围（Sandbox Level）                                │
│                                                                     │
│  ┌───────────────────────────────────────────────────────┐          │
│  │ 🛡️ 安全模式（Full Sandbox）              data-security="full"  │
│  │                                                       │          │
│  │ AI 可以：                                             │          │
│  │ ✅ 对话、回答问题、浏览网页                          │          │
│  │ ❌ 不能执行系统命令                                  │          │
│  │ ❌ 不能读写本地文件                                  │          │
│  │                                                       │          │
│  │ 适合：有重要数据、追求极致安全的用户                 │          │
│  │                                                       │          │
│  │ 后端配置: sandbox.mode="all", tools.exec.security="deny"        │
│  └───────────────────────────────────────────────────────┘          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────┐          │
│  │ 🔒 智能模式（Standard Mode）  [推荐]  data-security="standard" │
│  │                                                       │          │
│  │ AI 可以：                                             │          │
│  │ ✅ 执行常用操作（打开软件、浏览网页）                │          │
│  │ ✅ 读写指定的工作目录（Workspace）                   │          │
│  │ ⚠️ 敏感操作会先询问你（Approval Required）           │          │
│  │                                                       │          │
│  │ 适合：日常工作电脑、大部分用户                       │          │
│  │                                                       │          │
│  │ 后端配置: sandbox.mode="non-main", tools.exec.security="allowlist"
│  └───────────────────────────────────────────────────────┘          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────┐          │
│  │ ⚡ 专家模式（Trust Mode）  🎮 玩家首选  data-security="trust"  │
│  │                                        ═══════════════│  ← 高亮  │
│  │ AI 可以：                                             │          │
│  │ ✅ 执行任何系统操作（Full System Access）            │          │
│  │ ✅ 读写任意目录                                      │          │
│  │ ✅ 无需审批，直接执行（Auto Approve）                │          │
│  │                                                       │          │
│  │ 🚀 探索更多好玩用法！让 AI 真正帮你干活               │          │
│  │    自动化脚本 · 批量处理 · 系统管理 · 无限可能       │          │
│  │                                                       │          │
│  │ 适合：独立设备、技术高手、想要释放 AI 全部潜力的你   │          │
│  │ ⚠️ 风险自担                                          │          │
│  │                                                       │          │
│  │ 后端配置: sandbox.mode="off", tools.exec.security="full"        │
│  └───────────────────────────────────────────────────────┘          │
│                                                                     │
│  ────────────────────────────────────────────────────────────       │
│                                                                     │
│  📜 使用条款                                                        │
│                                                                     │
│  使用本服务即表示您同意以下条款：                                   │
│  • Clawdbot 可以在您的计算机上执行代码和命令                        │
│  • 您理解 AI 可能会犯错，建议在执行前检查命令                       │
│  • 您同意对使用本服务产生的任何后果负责                             │
│  • 建议在虚拟机或测试环境中首次使用                                 │
│  • 重要数据请提前备份                                               │
│                                                                     │
│  ☑️ 我已阅读并同意上述使用条款                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**前后端配置映射（关键！）**：

| 前端 data-security | sandbox.mode | tools.exec.security | 显示名称 |
|-------------------|--------------|---------------------|---------|
| `"full"` | `"all"` | `"deny"` | 安全模式 |
| `"standard"` | `"non-main"` | `"allowlist"` | 智能模式 |
| `"trust"` | `"off"` | `"full"` | 专家模式 |

**后端 API 调用**：
```
POST /api/setup/configure-security
Content-Type: application/json

{
  "mode": "standard",  // "full" | "standard" | "trust"
  "trustedDirs": []
}
```

**后端配置生成逻辑**（`setup-wizard.ts`）：
```typescript
function mapSecurityModeToConfig(mode: string) {
  switch (mode) {
    case "full":
      return { sandbox: { mode: "all" }, tools: { exec: { security: "deny" } } };
    case "standard":
      return { sandbox: { mode: "non-main" }, tools: { exec: { security: "allowlist" } } };
    case "trust":
      return { sandbox: { mode: "off" }, tools: { exec: { security: "full" } } };
  }
}
```

**关键改动**：
1. **三种模式同等大小展示**，不折叠，用户可以直观对比
2. **专业术语增加括号英文说明**：Sandbox Level、Full Sandbox、Standard Mode、Trust Mode、Workspace、Approval Required、Auto Approve 等
3. 每种模式明确列出「可以做什么」和「不能做什么」
4. **专家模式高亮显示**，增加「玩家首选」标签，引导用户探索更多好玩用法
5. 删除「提示词注入」等吓人术语
6. **使用条款直接显示在页面上**，内容与现有 web 页面一致
7. 保持专业性的同时让小白也能看懂
8. **新增**：明确标注 `data-security` 属性值和后端配置映射

---

### 🟢 低优先级：步骤3 - 提供合理默认值

**优化方案**：自动创建默认目录，减少必填操作

**改造后的步骤3**：

```
┌─────────────────────────────────────────────────────────────────────┐
│  第三步：设置工作目录                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AI 只能读写这个目录内的文件                                        │
│                                                                     │
│  📁 D:\Clawdbot\workspace                    [修改]                 │
│                                                                     │
│  💡 把需要AI处理的文件放到这个目录                                  │
│                                                                     │
│  ▸ 添加更多目录（可选）                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**关键改动**：
1. 提供合理的默认值，大部分用户直接下一步
2. 修改路径作为可选操作
3. 简化说明文字

---

## 四、实施优先级

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          实施路线图                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔴🔴 紧急（堵住最大流失点）                                                 │
│  ├── S-1 步骤4：渠道配置改为可选（不加网页对话）    [2小时]  ✅ 简化       │
│  └── S-2 审批超时 120s → 300s                       [已完成] ✅ 代码已实现  │
│                                                                             │
│  🔴 本周完成（步骤1 三层折叠重构）                                           │
│  ├── S-3a 步骤1：UI 三层折叠结构                    [2小时]   P1            │
│  ├── S-3b 步骤1：国际服务卡片（OpenAI/Anthropic）   [3小时]   P1            │
│  ├── S-3c 步骤1：自定义端点 - OpenAI 协议           [2小时]   P1            │
│  ├── S-3d 步骤1：自定义端点 - Anthropic 协议        [2小时]   P1            │
│  ├── S-4 步骤2：删除"提示词注入"，简化风险说明      [2小时]                 │
│  ├── S-5 错误信息人性化                             [4小时]                 │
│  └── S-6 baseUrl 继承修复（核心Bug）                [2小时]                 │
│                                                                             │
│  🟡 下周完成                                                                 │
│  ├── S-3e 步骤1：网络连通性检测 + 错误提示          [1小时]   P2            │
│  ├── S-3f 步骤1：「获取模型列表」功能               [1小时]   P3            │
│  ├── S-7 步骤3：提供合理默认值                      [1小时]                 │
│  ├── S-8 添加"粘贴"按钮（API Key输入框）            [1小时]                 │
│  └── S-9 API Key 获取视频教程                       [运营]                  │
│                                                                             │
│  🟢 后续迭代                                                                 │
│  ├── S-10 新手引导页面                              [6小时]                 │
│  ├── S-11 系统托盘通知                              [2天]                   │
│  └── S-12 匿名错误上报                              [需后端]                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 步骤1 三层折叠实施计划（产品经理 2026-01-30）

| 阶段 | 任务 | 工作量 | 优先级 |
|-----|------|-------|--------|
| Phase 1 | UI 三层折叠结构 | 2h | P1 |
| Phase 2 | 国际服务卡片（OpenAI/Anthropic/Google） | 3h | P1 |
| Phase 3 | 自定义端点 - OpenAI 协议 | 2h | P1 |
| Phase 4 | 自定义端点 - Anthropic 协议 | 2h | P1 |
| Phase 5 | 网络连通性检测 + 错误提示 | 1h | P2 |
| Phase 6 | 「获取模型列表」功能 | 1h | P3 |

**总工作量**：约 11 小时

**实施顺序建议**（产品经理）：
1. **今天**：先做 UI 折叠结构
2. **明天**：再做自定义 OpenAI 协议端点
3. **后天**：最后补充国际服务卡片和 Anthropic 协议

> 📌 这样即使只完成前两步，专业用户就已经可以通过「自定义 OpenAI 协议」接入任何服务了。

---

## 五、详细实施方案

### S-1 🔴🔴 步骤4优化：渠道配置改为可选

**文件**：`src/gateway/setup-page.ts` 第2453-2579行

**改动要点**：
1. 标题改为「配置指挥渠道（可选）」
2. 突出「手机控制 Clawdbot」卖点，但明确可跳过
3. **不增加"网页对话"选项**（配置完成后默认就有 Web 界面）
4. 增加「跳过此步，稍后配置」按钮
5. 提示跳过后仍可通过 Web 界面对话

**验收标准**：
- [ ] 钉钉/飞书可选择，不强制
- [ ] 有明显的「跳过此步，稍后配置」按钮
- [ ] 提示文字说明跳过后仍可使用 Web 界面
- [ ] API 调用支持空数组 `{ "channels": [] }`

---

### S-2 ✅ 审批超时延长（已完成）

**文件**：`src/agents/bash-tools.exec.ts` 第75行

**当前代码状态**：
```typescript
const DEFAULT_APPROVAL_TIMEOUT_MS = 300_000; // 默认 5 分钟
```

**热更新配置**（`src/gateway/config-reload.ts`）：
```typescript
{ prefix: "tools.exec.approvalTimeoutMs", kind: "hot" }
```

✅ **已实现**：代码中已改为 5 分钟，且支持热更新

---

### S-3 🔴 步骤1简化

**文件**：`src/gateway/setup-page.ts` 第2114-2239行

**改动要点**：
1. 默认展示3个主推服务商（硅基流动、通义千问、豆包）
2. 整个卡片可点击去注册（新窗口）
3. 其他服务商折叠
4. API Key 输入框增加「粘贴」按钮

---

### S-4 🔴 步骤2安全模式优化

**文件**：`src/gateway/setup-page.ts` 第2241-2370行

**改动要点**：
1. 三种模式同等大小展示（不折叠）
2. 删除「沙盒」「提示词注入」术语
3. 专业术语增加括号英文说明（体现专业性）
4. 精简风险声明

---

### S-5 🔴 错误信息人性化

**新建文件**：`src/infra/user-friendly-error.ts`

**改动要点**：
1. 通过正则匹配常见错误类型
2. 提供友好的中文错误标题、原因、下一步操作
3. 覆盖网络问题、API Key问题、安装问题、权限问题等常见场景

**错误类型覆盖**：
- 网络问题：ECONNREFUSED / ENOTFOUND / ETIMEDOUT
- API Key 问题：401 / quota / 余额
- 安装问题：ERR_MODULE_NOT_FOUND / 虚拟化
- 权限问题：EPERM / EACCES

---

### S-6 🔴🔴 baseUrl 继承修复（核心Bug）

**文件**：`src/providers/*.ts`、`src/gateway/setup-page.ts`

**问题描述**：自定义端点的 baseUrl 配置未正确传递给 provider 实例，导致所有自定义端点请求仍然发送到默认地址。

**改动要点**：
1. 检查 provider 初始化时 baseUrl 参数的传递链路
2. 确保 config.yaml 中的 baseUrl 正确读取并应用
3. 添加 baseUrl 配置的单元测试

**验收标准**：
- [ ] 自定义 OpenAI 端点请求发送到用户配置的地址
- [ ] 自定义 Anthropic 端点请求发送到用户配置的地址
- [ ] 预置服务商不受影响

---

### S-7 🔴 API Key 验证流程完善

**文件**：`src/gateway/setup-page.ts`、`src/providers/*.ts`

**当前问题**：文档提到「验证并继续」，但缺少完整的验证流程设计。

**验证流程设计**：

```
用户输入 API Key
    │
    ▼
前端格式校验（正则匹配）
    │
    ├── 硅基流动：sk-xxx（32位+）
    ├── 阿里云：sk-xxx
    ├── OpenAI：sk-xxx 或 sk-proj-xxx
    ├── Anthropic：sk-ant-xxx
    │
    ├── 格式错误 → 即时提示「格式不正确，请检查是否复制完整」
    │
    ▼
后端验证请求（10秒超时）
    │
    ├── 网络超时 → 提示「网络连接超时，请检查网络后重试」[重试]
    ├── 网络错误 → 提示「无法连接服务器」[重试] [切换服务商]
    ├── 401/403 → 提示「API Key 无效，请检查是否正确」[重新输入]
    ├── 429 → 提示「API 额度已用完，请充值或更换服务商」[充值教程] [切换]
    ├── 500+ → 提示「服务商暂时不可用，请稍后重试」[重试]
    └── 200 → 验证成功，进入下一步
```

**重试策略**：
- 最多重试 2 次
- 重试间隔：1秒、3秒
- 超过重试次数后显示「多次验证失败」并提供切换服务商选项

**改动要点**：
1. 前端增加 API Key 格式正则校验
2. 后端验证接口增加超时控制（10秒）
3. 错误分类和友好提示
4. 重试机制实现

**验收标准**：
- [ ] 格式错误即时提示，不发请求
- [ ] 验证超时有明确提示和重试按钮
- [ ] 401/429 等错误有对应的友好提示
- [ ] 重试次数限制生效

---

### S-8 🔴 config.yaml 配置结构规范化

**文件**：`src/config/schema.ts`（新建）、`src/config/loader.ts`

**当前问题**：配置结构描述过于简略，缺少类型定义和校验。

**规范化 Schema 定义**：

```yaml
# ~/.clawdbot/config.yaml 完整 Schema

# ========== Provider 配置 ==========
provider:
  # 类型：preset（预置服务商）| custom-openai | custom-anthropic
  type: "preset" | "custom-openai" | "custom-anthropic"
  
  # 预置服务商名称（type=preset 时必填）
  # 可选值：siliconflow, alibaba, zhipu, doubao, deepseek, tencent, minimax
  #         openai, anthropic, google
  name: string
  
  # 自定义端点地址（type=custom-* 时必填）
  baseUrl: string
  
  # API Key（必填）
  apiKey: string
  
  # 模型名称（必填）
  model: string
  
  # 验证状态（系统写入）
  verified: boolean
  verifiedAt: string  # ISO 时间戳

# ========== 安全模式配置 ==========
security:
  # 模式：full（安全）| standard（智能）| trust（专家）
  mode: "full" | "standard" | "trust"
  
  # 工作目录列表
  workspace:
    - "D:\\Clawdbot\\workspace"
  
  # 额外信任目录（可选）
  trustedDirs: []
  
  # 审批超时（毫秒），默认 300000（5分钟）
  approvalTimeout: 300000

# ========== 渠道配置 ==========
channels:
  # 已启用的渠道
  enabled:
    - "web"
  
  # 钉钉配置（可选）
  dingtalk:
    appKey: string
    appSecret: string
    robotToken: string  # 可选
  
  # 飞书配置（可选）
  feishu:
    appId: string
    appSecret: string

# ========== 用户偏好 ==========
preferences:
  # 语言
  language: "zh-CN"
  
  # 主题
  theme: "system" | "light" | "dark"
```

**TypeScript 类型定义**：

```typescript
// src/config/schema.ts

export type ProviderType = 'preset' | 'custom-openai' | 'custom-anthropic';
export type PresetProvider = 
  | 'siliconflow' | 'alibaba' | 'zhipu' | 'doubao' 
  | 'deepseek' | 'tencent' | 'minimax'
  | 'openai' | 'anthropic' | 'google';
export type SecurityMode = 'full' | 'standard' | 'trust';

export interface ProviderConfig {
  type: ProviderType;
  name?: PresetProvider;
  baseUrl?: string;
  apiKey: string;
  model: string;
  verified?: boolean;
  verifiedAt?: string;
}

export interface SecurityConfig {
  mode: SecurityMode;
  workspace: string[];
  trustedDirs?: string[];
  approvalTimeout?: number;
}

export interface ChannelConfig {
  enabled: string[];
  dingtalk?: { appKey: string; appSecret: string; robotToken?: string };
  feishu?: { appId: string; appSecret: string };
}

export interface ClawdbotConfig {
  provider: ProviderConfig;
  security: SecurityConfig;
  channels: ChannelConfig;
  preferences?: { language?: string; theme?: string };
}
```

**改动要点**：
1. 新建 `src/config/schema.ts` 定义类型
2. 配置加载时进行 schema 校验
3. 配置写入时确保符合 schema
4. 迁移脚本处理旧配置格式

**验收标准**：
- [ ] 配置文件有完整的类型定义
- [ ] 加载时校验配置有效性
- [ ] 无效配置给出明确错误提示
- [ ] 旧配置自动迁移

---

### S-9 🔴 错误边界处理体系

**文件**：`src/infra/error-boundary.ts`（新建）、`src/infra/user-friendly-error.ts`

**当前问题**：缺少全局错误边界、错误上报机制、错误恢复策略。

#### 9.1 全局错误边界

```typescript
// src/infra/error-boundary.ts

export class ErrorBoundary {
  private static instance: ErrorBoundary;
  private errorHandlers: Map<string, ErrorHandler> = new Map();
  
  // 注册错误处理器
  register(type: string, handler: ErrorHandler): void;
  
  // 捕获并处理错误
  catch(error: Error, context?: string): FriendlyError;
  
  // 尝试恢复
  tryRecover(error: Error): boolean;
}

// 错误恢复策略
export const recoveryStrategies = {
  // 网络错误：重试
  network: async (retry: () => Promise<any>) => {
    for (let i = 0; i < 3; i++) {
      try { return await retry(); }
      catch { await sleep(1000 * (i + 1)); }
    }
    throw new Error('多次重试失败');
  },
  
  // 配置错误：重置到默认值
  config: () => resetToDefaultConfig(),
  
  // 状态错误：刷新页面
  state: () => location.reload(),
};
```

#### 9.2 错误上报机制（匿名）

```typescript
// src/infra/error-reporter.ts

export interface ErrorReport {
  // 不包含任何用户信息
  errorType: string;
  errorMessage: string;  // 脱敏后的消息
  stackTrace: string;    // 脱敏后的堆栈
  context: string;       // 发生位置（如 "setup-step1"）
  timestamp: string;
  appVersion: string;
  platform: string;      // win32/darwin/linux
}

export class ErrorReporter {
  // 是否启用（用户可关闭）
  enabled: boolean = true;
  
  // 上报地址
  endpoint: string = 'https://api.tecbinai.com/error-report';
  
  // 脱敏处理
  private sanitize(error: Error): ErrorReport;
  
  // 批量上报（每5分钟或累积10条）
  report(error: Error, context: string): void;
}
```

#### 9.3 setup-page 错误处理集成

```typescript
// 在 setup-page.ts 中集成

// 步骤级别的错误边界
async function withErrorBoundary<T>(
  step: string,
  action: () => Promise<T>
): Promise<T | null> {
  try {
    return await action();
  } catch (error) {
    const friendly = ErrorBoundary.catch(error, step);
    showErrorDialog(friendly);
    ErrorReporter.report(error, step);
    return null;
  }
}

// 使用示例
async function verifyApiKey() {
  return withErrorBoundary('verify-api-key', async () => {
    const result = await provider.verify(apiKey);
    if (!result.success) throw new ApiKeyError(result.reason);
    return result;
  });
}
```

**改动要点**：
1. 新建 `src/infra/error-boundary.ts` 全局错误边界
2. 新建 `src/infra/error-reporter.ts` 匿名错误上报
3. setup-page 各步骤集成错误边界
4. 用户可在设置中关闭错误上报

**验收标准**：
- [ ] 任何未捕获错误都有友好提示
- [ ] 错误上报不包含用户隐私信息
- [ ] 网络错误自动重试
- [ ] 用户可关闭错误上报

---

### S-10 🟡 网络层抽象（Provider 统一接口）

**文件**：`src/providers/base.ts`（新建）、`src/providers/*.ts`

**当前问题**：三层服务商（国内/国际/自定义）缺少统一的网络层抽象。

**Provider 抽象层设计**：

```typescript
// src/providers/base.ts

export interface IProvider {
  readonly name: string;
  readonly protocol: 'openai' | 'anthropic';
  
  // 验证 API Key
  verify(apiKey: string): Promise<VerifyResult>;
  
  // 获取模型列表（OpenAI 协议支持，Anthropic 返回预置列表）
  listModels(): Promise<Model[]>;
  
  // 聊天接口
  chat(messages: Message[], options?: ChatOptions): AsyncIterable<ChatChunk>;
  
  // 测试连接
  testConnection(): Promise<ConnectionResult>;
}

export interface VerifyResult {
  success: boolean;
  reason?: 'invalid_key' | 'quota_exceeded' | 'network_error' | 'unknown';
  balance?: number;  // 可选：剩余额度
}

export interface ConnectionResult {
  success: boolean;
  latency?: number;  // 毫秒
  error?: string;
}

// 基类实现公共逻辑
export abstract class BaseProvider implements IProvider {
  protected baseUrl: string;
  protected apiKey: string;
  protected timeout: number = 10000;
  
  // 公共的请求方法（含超时、重试）
  protected async request<T>(
    path: string, 
    options: RequestOptions
  ): Promise<T>;
  
  // 公共的错误处理
  protected handleError(error: Error): VerifyResult;
}
```

**具体实现**：

```typescript
// src/providers/openai-protocol.ts
export class OpenAIProvider extends BaseProvider {
  readonly protocol = 'openai';
  
  async verify(apiKey: string): Promise<VerifyResult> {
    const response = await this.request('/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return { success: true };
  }
  
  async listModels(): Promise<Model[]> {
    const response = await this.request<ModelListResponse>('/v1/models');
    return response.data.map(m => ({ id: m.id, name: m.id }));
  }
}

// src/providers/anthropic-protocol.ts
export class AnthropicProvider extends BaseProvider {
  readonly protocol = 'anthropic';
  
  // Anthropic 不支持 listModels，返回预置列表
  async listModels(): Promise<Model[]> {
    return [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    ];
  }
}

// src/providers/preset/*.ts
// 预置服务商继承对应的协议 Provider，只需覆盖 baseUrl
export class SiliconFlowProvider extends OpenAIProvider {
  readonly name = 'siliconflow';
  protected baseUrl = 'https://api.siliconflow.cn/v1';
}
```

**Provider 工厂**：

```typescript
// src/providers/factory.ts

export function createProvider(config: ProviderConfig): IProvider {
  switch (config.type) {
    case 'preset':
      return createPresetProvider(config.name!, config.apiKey);
    case 'custom-openai':
      return new OpenAIProvider(config.baseUrl!, config.apiKey);
    case 'custom-anthropic':
      return new AnthropicProvider(config.baseUrl!, config.apiKey);
  }
}

function createPresetProvider(name: PresetProvider, apiKey: string): IProvider {
  const providers: Record<PresetProvider, new (apiKey: string) => IProvider> = {
    siliconflow: SiliconFlowProvider,
    alibaba: AlibabaProvider,
    // ... 其他预置服务商
  };
  return new providers[name](apiKey);
}
```

**改动要点**：
1. 新建 `src/providers/base.ts` 定义接口和基类
2. 重构现有 provider 继承基类
3. 新建 `src/providers/factory.ts` 工厂方法
4. setup-page 使用工厂创建 provider

**验收标准**：
- [ ] 所有 provider 实现统一接口
- [ ] 自定义端点和预置服务商使用相同的调用方式
- [ ] 错误处理统一
- [ ] 新增服务商只需继承基类

---

### 技术债务清单

| 技术债务 | 影响 | 当前状态 | 建议处理时间 | 工作量 |
|---------|-----|---------|-------------|-------|
| `setup-page.ts` 单文件 3000+ 行 | 维护困难、难以测试 | 未处理 | Week 3 | 8h |
| 全局变量状态管理 | 状态混乱、难以调试 | 未处理 | Week 3 | 6h |
| 无组件化 | 复用性差、代码重复 | 未处理 | Week 4 | 8h |
| 无单元测试 | 回归风险高 | 未处理 | 持续补充 | 持续 |
| Provider 代码重复 | 维护成本高 | S-10 解决 | Week 2 | 4h |

### 技术债务处理计划

#### Week 3：setup-page.ts 重构

**目标**：将 3000+ 行的单文件拆分为模块化结构

```
src/gateway/setup/
├── index.ts              # 主入口
├── state.ts              # 状态管理
├── steps/
│   ├── step1-provider.ts # 步骤1：选择服务商
│   ├── step2-security.ts # 步骤2：安全设置
│   ├── step3-workspace.ts# 步骤3：工作目录
│   ├── step4-channel.ts  # 步骤4：渠道配置
│   ├── step5-activate.ts # 步骤5：激活
│   └── step6-complete.ts # 步骤6：完成
├── components/
│   ├── provider-card.ts  # 服务商卡片
│   ├── api-key-input.ts  # API Key 输入框
│   ├── mode-selector.ts  # 模式选择器
│   └── error-dialog.ts   # 错误弹窗
└── utils/
    ├── validation.ts     # 表单校验
    └── storage.ts        # localStorage 操作
```

#### Week 3：引入状态管理

**目标**：用状态机替代全局变量

```typescript
// src/gateway/setup/state.ts

export interface SetupState {
  currentStep: number;
  provider: ProviderConfig | null;
  security: SecurityConfig | null;
  channels: ChannelConfig | null;
  errors: Record<string, string>;
  isLoading: boolean;
}

export type SetupAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_PROVIDER'; provider: ProviderConfig }
  | { type: 'SET_SECURITY'; security: SecurityConfig }
  | { type: 'SET_ERROR'; field: string; message: string }
  | { type: 'CLEAR_ERROR'; field: string }
  | { type: 'SET_LOADING'; loading: boolean };

export function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    // ... 其他 action
  }
}

// 状态持久化到 localStorage
export function persistState(state: SetupState): void {
  const draft = { ...state, provider: { ...state.provider, apiKey: undefined } };
  localStorage.setItem('clawdbot_setup_draft', JSON.stringify(draft));
}
```

---

## 六、商业化设计与品牌推广

> **重要**：所有用户均为付费用户，产品定价 ¥26（内测价），只通过闲鱼销售

### 5.0 商业化核心原则

| 原则 | 说明 |
|-----|------|
| **只有一个版本** | 没有免费版/付费版之分，全部付费 |
| **购买入口在步骤5** | 让用户先完成麻烦的配置流程，完成后再展示购买（此时用户已投入时间成本，转化率更高） |
| **只有闲鱼链接** | 目前只通过闲鱼销售，定价 ¥26 |
| **整个卡片可点击** | 购买卡片整个区域可点击跳转闲鱼，不用小按钮 |

**❌ 禁止使用的文案**：
- ~~「日均X毛钱」~~ 营销话术
- ~~「稍后再说」「暂时跳过」~~ 没有免费选项
- ~~「1v1 微信答疑」~~ 交付太重
- ~~「从入门到进阶」~~ 只承诺快速入门
- ~~「视频教程」~~ 不一定有视频，改为「全套教程」

### 5.1 ClawdbotCN 核心价值主张（3个卖点）

**用户花 ¥26 买的是什么？**

| 卖点 | 文案 | 展示位置 |
|-----|------|---------|
| ⏱️ **省时间** | 节省至少 30 分钟安装配置时间（原生版需要 WSL + 命令行 + 英文界面摸索） | 步骤5 |
| 🌐 **全生态** | 全链路玩转 Clawdbot 的生态：预置中文 Skills · 全套教程 · 使用案例 · 持续更新+安全加固 | 步骤5 |
| 🤝 **学习搭子** | 强力 AI 学习搭子：加入用户社群，交流心得 | 步骤5 |

**价格锚点**：
```
⏰ 内测价 ¥26
   正式版发布后涨价，现在购买提前锁定
```

### 5.2 ClawdbotCN 产品优势（完整列表）

| 优势 | 说明 | 展示位置 |
|-----|------|---------|
| 🇨🇳 全链路中文汉化 | 界面、提示、错误信息全中文 | 欢迎页、完成页 |
| 📦 小白友好安装包 | 一键安装，无需命令行，节省30分钟 | 步骤5 |
| 🛠️ 预置中文 Skills | 开箱即用的实用技能 | 步骤5、完成页 |
| 📚 全套教程 | 教你快速入门 + 使用案例分享 | 步骤5、完成页 |
| 🔄 持续迭代更新 | 跟进上游 + 本地化优化 + **安全加固** | 步骤5、完成页 |
| 🤝 用户社群 | 加入社群交流心得，强力 AI 学习搭子 | 步骤5 |
| 🌐 官网支持 | www.tecbinai.com | 全局页脚、完成页 |

---

### 5.3 各页面品牌植入方案

#### 📍 步骤1（选择AI服务）- 顶部提示

**设计要点**：顶部增加品牌提示条，包含 ClawdbotCN 品牌信息和官网链接

---

#### 📍 步骤5（激活页）- 最关键的转化页面！

**设计原则**：
1. 用户已完成所有配置（投入了时间成本），此时展示购买入口转化率最高
2. **整个购买卡片可点击**，跳转闲鱼，不用小按钮
3. 突出3个核心卖点：省时间 / 全生态 / 学习搭子

**UI 结构**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│  第五步：激活 ClawdbotCN                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📦 你已经完成了所有配置！                                               │
│                                                                         │
│  最后一步：输入服务凭证，激活 ClawdbotCN                                  │
│                                                                         │
│  服务凭证                                                               │
│  ┌─────────────────────────────────────────────┬────────┐              │
│  │                                             │ 📋粘贴 │              │
│  └─────────────────────────────────────────────┴────────┘              │
│  [激活]                                                                 │
│                                                                         │
│  ────────────── 还没有服务凭证？──────────────                           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                   ← 整个卡片    │    │
│  │  🎯 你买的不只是一个汉化版 Clawdbot                可点击跳转   │    │
│  │                                                   闲鱼购买     │    │
│  │  ✅ 节省至少 30 分钟安装配置时间                                │    │
│  │     （原生版需要 WSL + 命令行 + 英文界面摸索）                   │    │
│  │                                                                 │    │
│  │  ✅ 全链路玩转 Clawdbot 的生态                                  │    │
│  │     预置中文 Skills · 全套教程 · 使用案例 · 持续更新+安全加固   │    │
│  │                                                                 │    │
│  │  ✅ 强力 AI 学习搭子                                            │    │
│  │     加入用户社群，交流心得                                      │    │
│  │                                                                 │    │
│  │  ─────────────────────────────────────────────────────────      │    │
│  │                                                                 │    │
│  │  ⏰ 内测价 ¥26                                                  │    │
│  │     正式版发布后涨价，现在购买提前锁定                          │    │
│  │                                                                 │    │
│  │                    👆 点击购买                                   │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  <!-- 官网链接 -->                                                      │
│  更多信息请访问官网：www.tecbinai.com                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

#### 📍 步骤6（完成页）- 品牌强化

**设计要点**：
1. 欢迎标题：「欢迎加入 ClawdbotCN！」
2. 后续资源链接：全套教程、Skills 仓库、使用案例、官网
3. 页脚品牌：ClawdbotCN + slogan + 官网链接

---

#### 📍 全局页脚

**所有步骤页面底部**：Powered by ClawdbotCN - www.tecbinai.com

---

### 5.5 商业化 + 品牌推广检查清单

**步骤1（AI服务选择）商业化**：
- [ ] 硅基流动、通义千问、豆包 → 大卡片，带「推荐」标签，**使用返利链接**
- [ ] DeepSeek、智谱GLM、腾讯混元、MiniMax → 小卡片，折叠在「更多服务」里
- [ ] 每个主推服务商添加「注册教程」链接
- [ ] 顶部添加"全中文界面"提示 + 官网链接

**步骤5（激活页）商业化 - 最重要**：
- [ ] 凭证输入框 + 激活按钮
- [ ] **购买卡片整个区域可点击**，跳转闲鱼
- [ ] 3个核心卖点：省时间(30分钟) / 全生态 / 学习搭子
- [ ] 全生态描述：预置中文 Skills · **全套教程** · 使用案例 · **持续更新+安全加固**
- [ ] 价格：**内测价 ¥26，正式版发布后涨价，现在购买提前锁定**
- [ ] 卡片 hover 效果明显，提示「点击购买」
- [ ] 底部添加 www.tecbinai.com 官网链接

**步骤6（完成页）品牌**：
- [ ] 添加"继续探索"资源卡片（全套教程/Skills/案例/官网）
- [ ] 添加品牌 footer

**❌ 禁止出现的内容**：
- [ ] 不要「日均X毛钱」营销话术
- [ ] 不要「稍后再说」「暂时跳过」（没有免费选项）
- [ ] 不要「1v1 微信答疑」（交付太重）
- [ ] 不要「从入门到进阶」（只承诺快速入门）
- [ ] 不要「视频教程」（改为「全套教程」）
- [ ] 全局：页面底部添加 "Powered by ClawdbotCN - www.tecbinai.com"

---

## 七、交互细节补充（技术评审补充）

### 6.1 选中状态视觉反馈

**问题**：步骤4选中钉钉/飞书后，用户不确定是否选中成功

**解决方案**：选中时边框颜色变化 + 对勾图标动画

**验收标准**：
- [ ] 选中时有明显的边框颜色变化
- [ ] 显示对勾图标，带缩放动画
- [ ] 取消选中时对勾消失

---

### 6.2 配置数据持久化

**问题**：用户关闭页面或刷新后，已填写的配置丢失

**解决方案**：每步完成后自动保存到 localStorage（24小时过期）

**验收标准**：
- [ ] 每步完成自动保存草稿到 localStorage
- [ ] 刷新页面后询问是否恢复
- [ ] 草稿24小时过期自动清除
- [ ] 配置完成后清除草稿

---

### 6.3 浏览器后退拦截

**问题**：用户点击浏览器后退按钮可能丢失已填写的配置

**解决方案**：拦截 `popstate` 事件，提示用户确认；`beforeunload` 保存草稿

**验收标准**：
- [ ] 点击浏览器后退按钮弹出确认框
- [ ] 确认离开时自动保存草稿
- [ ] 取消则停留在当前页面
- [ ] 关闭标签页前提示（beforeunload）

---

## 八、术语处理策略

### 保留的术语（用户普遍理解）

| 术语 | 原因 | 处理方式 |
|-----|------|---------|
| API Key | 70%用户了解，是行业通用术语 | 保留，无需解释 |
| 模型 | 常见概念 | 保留，但提供推荐默认值 |
| 配置 | 通用词汇 | 保留 |
| App Key / App Secret | 开发者熟悉 | 保留，在高级选项中 |

### 简化的术语

| 原术语 | 简化为 | 原因 |
|-------|-------|------|
| 沙盒 | 工作范围 / 权限范围 | "沙盒"是技术术语，部分用户不理解 |
| 提示词注入 | （删除） | 过于专业，且造成不必要的恐惧 |
| 信任目录 | 额外目录 | "信任"概念不直观 |
| 指挥渠道 | 对话方式 | 更直白 |

### 模式命名（与代码 `setup-page.ts` 一致）

**前端代码**：
```typescript
const securityModeNames = { full: '安全模式', standard: '智能模式', trust: '专家模式' };
```

| 前端 data-security | sandbox.mode | tools.exec.security | 显示名称 | 说明 |
|-------------------|--------------|---------------------|---------|------|
| `full` | `"all"` | `"deny"` | 安全模式 | 所有会话启用沙盒，禁止执行 |
| `standard` | `"non-main"` | `"allowlist"` | 智能模式 | 推荐，非主会话沙盒，允许列表内执行 |
| `trust` | `"off"` | `"full"` | 专家模式 | 无沙盒，完整权限 |

---

## 九、代码编写规划（按工作量拆分）

### 总工作量概览

| 阶段 | 时间 | 核心任务 | 总工时 |
|-----|-----|---------|-------|
| **Week 1** | Day 1-3 | 核心Bug修复 + 基础架构 | **16h** |
| **Week 2** | Day 4-7 | UI重构 + Provider抽象 | **20h** |
| **Week 3** | Day 8-12 | 技术债务清理 + 状态管理 | **14h** |
| **Week 4** | Day 13-15 | 商业化 + 品牌推广 | **10h** |

**总计**：约 **60h**（3周密集开发）

---

### 🔴🔴 Week 1：核心Bug修复 + 基础架构（16h）

#### Day 1（3h）- 紧急修复

| 任务 | 文件 | 工时 | 验收标准 |
|-----|-----|-----|---------|
| S-2 审批超时 | `src/agents/bash-tools.exec.ts` | ✅ 已完成 | 代码已改为5分钟 |
| S-6 baseUrl修复 | `src/agents/pi-embedded-runner/model.ts` | 2h | 自定义端点请求正确 |
| S-14 localStorage持久化 | `src/gateway/setup-page.ts` | 1h | 刷新不丢失配置 |

**Day 1 交付物**：
- [x] 审批超时 120s → 300s ✅ 已完成
- [ ] baseUrl 配置正确传递给 provider
- [ ] 配置草稿自动保存（API Key 除外）

#### Day 2-3（12h）- 基础架构

| 任务 | 文件 | 工时 | 验收标准 |
|-----|-----|-----|---------|
| S-8 config.yaml Schema | `src/config/schema.ts`（新建） | 3h | TypeScript 类型完整 |
| S-7 API Key验证流程 | `src/gateway/setup-page.ts` | 4h | 格式校验+超时+重试 |
| S-9 错误边界 | `src/infra/error-boundary.ts`（新建） | 3h | 全局错误捕获 |
| S-9 错误上报 | `src/infra/error-reporter.ts`（新建） | 2h | 匿名上报机制 |

**Day 2-3 交付物**：
- [ ] `src/config/schema.ts` - 完整的配置类型定义
- [ ] `src/infra/error-boundary.ts` - 全局错误边界
- [ ] `src/infra/error-reporter.ts` - 匿名错误上报
- [ ] API Key 验证：格式校验 → 10s超时 → 最多重试2次

---

### 🔴 Week 2：UI重构 + Provider抽象（20h）

#### Day 4-5（8h）- Provider 网络层抽象

| 任务 | 文件 | 工时 | 验收标准 |
|-----|-----|-----|---------|
| Provider 基类 | `src/providers/base.ts`（新建） | 3h | IProvider 接口定义 |
| OpenAI 协议实现 | `src/providers/openai-protocol.ts` | 2h | verify/listModels/chat |
| Anthropic 协议实现 | `src/providers/anthropic-protocol.ts` | 2h | verify/chat |
| Provider 工厂 | `src/providers/factory.ts`（新建） | 1h | createProvider 统一入口 |

**Day 4-5 交付物**：
```
src/providers/
├── base.ts              # IProvider 接口 + BaseProvider 基类
├── openai-protocol.ts   # OpenAI 协议实现
├── anthropic-protocol.ts# Anthropic 协议实现
├── factory.ts           # Provider 工厂
└── preset/
    ├── siliconflow.ts   # 硅基流动
    ├── alibaba.ts       # 阿里云
    └── zhipu.ts         # 智谱
```

#### Day 6-7（12h）- 步骤1 UI 三层折叠重构

| 任务 | 文件 | 工时 | 验收标准 |
|-----|-----|-----|---------|
| 三层折叠结构 | `src/gateway/setup-page.ts` | 4h | 国内80%/国际10%/自定义10% |
| 国内服务卡片 | 同上 | 2h | 硅基/阿里/智谱 大卡片 |
| 国际服务区 | 同上 | 2h | 折叠+网络提示 |
| 自定义端点 | 同上 | 3h | OpenAI/Anthropic 配置表单 |
| 测试连接 | 同上 | 1h | 实时验证按钮 |

**Day 6-7 交付物**：
- [ ] 国内服务区占页面80%，硅基流动首选
- [ ] 国际服务默认折叠
- [ ] 自定义端点支持 OpenAI/Anthropic 两种协议
- [ ] 「测试连接」按钮实时验证

---

### 🟡 Week 3：技术债务清理（14h）

#### Day 8-10（8h）- setup-page.ts 拆分重构

| 任务 | 目标文件 | 工时 | 说明 |
|-----|---------|-----|-----|
| 拆分步骤模块 | `src/gateway/setup/steps/*.ts` | 4h | 6个步骤独立文件 |
| 抽取公共组件 | `src/gateway/setup/components/*.ts` | 2h | 卡片/输入框/弹窗 |
| 工具函数 | `src/gateway/setup/utils/*.ts` | 2h | 校验/存储 |

**重构后目录结构**：
```
src/gateway/setup/
├── index.ts              # 主入口（原 setup-page.ts 精简版）
├── state.ts              # 状态管理
├── steps/
│   ├── step1-provider.ts # 选择服务商
│   ├── step2-security.ts # 安全设置
│   ├── step3-workspace.ts# 工作目录
│   ├── step4-channel.ts  # 渠道配置
│   ├── step5-activate.ts # 激活
│   └── step6-complete.ts # 完成
├── components/
│   ├── provider-card.ts  # 服务商卡片
│   ├── api-key-input.ts  # API Key 输入框
│   ├── mode-selector.ts  # 模式选择器
│   └── error-dialog.ts   # 错误弹窗
└── utils/
    ├── validation.ts     # 表单校验
    └── storage.ts        # localStorage 操作
```

#### Day 11-12（6h）- 状态管理引入

| 任务 | 文件 | 工时 | 说明 |
|-----|-----|-----|-----|
| 状态定义 | `src/gateway/setup/state.ts` | 2h | SetupState + SetupAction |
| Reducer 实现 | 同上 | 2h | 状态转换逻辑 |
| 持久化集成 | 同上 | 2h | localStorage 自动保存 |

**状态管理验收标准**：
- [ ] 全局变量替换为 state 对象
- [ ] 所有状态变更通过 dispatch
- [ ] 状态自动持久化（API Key 除外）
- [ ] 刷新页面可恢复状态

---

### 🟢 Week 4：商业化 + 收尾（10h）

#### Day 13-14（6h）- 步骤2/5 优化

| 任务 | 文件 | 工时 | 验收标准 |
|-----|-----|-----|---------|
| 步骤2 安全模式优化 | `setup/steps/step2-security.ts` | 2h | 三模式同等展示+使用条款 |
| 步骤4 飞书/钉钉 | `setup/steps/step4-channel.ts` | 2h | 手机控制卖点+可跳过 |
| 步骤5 商业化 | `setup/steps/step5-activate.ts` | 2h | 购买卡片可点击 |

#### Day 15（4h）- 品牌 + 交互细节

| 任务 | 文件 | 工时 | 验收标准 |
|-----|-----|-----|---------|
| 全局页脚 | 各步骤文件 | 1h | Powered by ClawdbotCN |
| 选中动画 | `components/*.ts` | 1h | 对勾缩放动画 |
| 后退拦截 | `setup/index.ts` | 1h | popstate 确认框 |
| 最终测试 | - | 1h | 全流程走通 |

---

### 实施检查清单（按天）

#### ✅ Day 1 Checklist
- [x] `src/agents/bash-tools.exec.ts` - 超时改为 300000 ✅ 已完成
- [ ] `src/agents/pi-embedded-runner/model.ts` - baseUrl 正确传递到内联模型
- [ ] `src/gateway/setup-page.ts` - localStorage 草稿保存

#### ✅ Day 2-3 Checklist
- [ ] 新建 `src/config/schema.ts` - 配置类型定义
- [ ] 新建 `src/infra/error-boundary.ts` - 全局错误边界
- [ ] 新建 `src/infra/error-reporter.ts` - 匿名错误上报
- [ ] API Key 验证流程完善（格式校验+超时+重试）

#### ✅ Day 4-5 Checklist
- [ ] 新建 `src/providers/base.ts` - IProvider 接口
- [ ] 新建 `src/providers/openai-protocol.ts`
- [ ] 新建 `src/providers/anthropic-protocol.ts`
- [ ] 新建 `src/providers/factory.ts`
- [ ] 预置服务商继承基类

#### ✅ Day 6-7 Checklist
- [ ] 步骤1 三层折叠结构
- [ ] 国内服务大卡片（硅基/阿里/智谱）
- [ ] 国际服务折叠区
- [ ] 自定义端点配置表单
- [ ] 测试连接按钮

#### ✅ Day 8-10 Checklist
- [ ] `setup-page.ts` 拆分为模块
- [ ] 公共组件抽取
- [ ] 工具函数独立

#### ✅ Day 11-12 Checklist
- [ ] 状态管理 state.ts
- [ ] Reducer 实现
- [ ] 状态持久化

#### ✅ Day 13-15 Checklist
- [ ] 步骤2 安全模式优化
- [ ] 步骤4 飞书/钉钉
- [ ] 步骤5 商业化
- [ ] 品牌页脚
- [ ] 交互动画
- [ ] 全流程测试

---

### ❌ 禁止事项

**商业化禁止**：
- ❌ 不要「日均X毛钱」营销话术
- ❌ 不要「稍后再说」「暂时跳过」（没有免费选项）
- ❌ 不要「1v1 微信答疑」（交付太重）
- ❌ 不要「从入门到进阶」（只承诺快速入门）
- ❌ 不要「视频教程」（改为「全套教程」）

**技术禁止**：
- ❌ 不要在 localStorage 存储 API Key
- ❌ 不要在错误上报中包含用户隐私
- ❌ 不要硬编码服务商链接（使用配置）

---

## 十、设计参考

### 同类产品对比

| 产品 | 配置复杂度 | 做得好的地方 |
|-----|-----------|-------------|
| **ChatGPT** | 低 | 登录即用，无需配置模型/API |
| **Cursor** | 中 | 默认配置合理，高级选项折叠 |
| **Raycast AI** | 低 | 一个API Key搞定，自动选模型 |

### 我们可以借鉴的点

1. **提供"开箱即用"选项**：配置完成后默认可用 Web 界面对话，渠道配置可跳过
2. **合理的默认值**：推荐服务（硅基流动）、推荐模型，减少决策负担
3. **渐进式复杂度**：基础功能简单，高级功能折叠
4. **保留专业术语**：API Key 是行业通用，无需替换

### ClawdbotCN 的差异化竞争优势

| 竞品 | 支持范围 | ClawdbotCN 优势 |
|-----|---------|----------------|
| 国内同类产品 | 只支持固定几家国产模型 | ✅ 支持「任意 OpenAI 兼容端点」 |
| 原版 Clawdbot | 主要面向国际用户 | ✅ 全链路中文汉化 + 国内服务优先 |

**差异化卖点总结**：
1. 🇨🇳 **全链路中文**：界面、提示、错误信息全中文
2. 🔓 **协议开放**：支持 OneAPI、New API 等聚合网关
3. 🌐 **国际服务可选**：满足有海外网络的开发者
4. 📦 **小白友好**：三层折叠，85%用户只需关注第一层

---

## 十一、关联文档

| 文档 | 描述 | 注意事项 |
|-----|------|---------|
| [task-assignment.md](./task-assignment.md) | 开发任务分配 | 4人并行开发方案 |
| [todofinal.md](./todofinal.md) | 完整需求文档 | 包含上游 Bug 修复同步 |
| [setup-wizard-flow.md](./setup-wizard-flow.md) | 安装向导流程文档 | **主要参考**，含完整 API 定义 |
| [windows-security-modes.md](./windows-security-modes.md) | 安全模式详解 | Lite/Pro 版本差异 |
| `src/config/region-cn.ts` | 中国区配置 | 服务商配置、API 端点 |
| `src/gateway/setup-page.ts` | 前端页面代码 | 安全模式映射 |
| `src/gateway/setup-wizard.ts` | 后端 API 处理 | 配置保存逻辑 |

---

## 附录：产品经理需求评估（2026-01-30）

### 为什么要做国际服务和自定义端点

| 不做的风险 | 影响程度 |
|-----------|---------|
| 流失高端用户：开发者已有 OpenAI/Anthropic API Key，强迫用国产会放弃 | 高 |
| 无法满足企业私有部署需求 | 中 |
| 缺乏差异化竞争力 | 中 |

### 风险评估

| 风险 | 等级 | 应对策略 |
|-----|-----|---------|
| 网络访问失败 | 中 | 检测连通性，失败时提示「需要自行解决网络问题」 |
| 合规敏感 | 低 | 不主动推荐，放在折叠区，用户自行选择 |
| 增加维护成本 | 低 | OpenAI/Anthropic 协议稳定，复用原版 Clawdbot 代码 |

### 最终建议

✅ **这个需求值得做**，理由：
- **低成本高收益**：复用原版代码，约 1.5 天工作量
- **满足高端用户**：防止开发者流失
- **差异化竞争**：「支持任意 OpenAI 兼容端点」是卖点
- **无合规风险**：折叠隐藏 + 用户自主选择

---

## 十二、前后端 API 对接完整规范

> 本章节详细描述所有前后端 API 接口，确保前后端开发人员可以独立并行开发。

### 12.1 API 总览

| 方法 | 接口 | 描述 | 步骤 |
|-----|------|------|-----|
| GET | `/api/setup/state` | 获取向导状态（含平台信息） | 全局 |
| GET | `/api/setup/providers` | 获取 AI 平台列表 | Step 1 |
| POST | `/api/setup/validate-api-key` | 验证 API Key | Step 1 |
| POST | `/api/setup/configure-provider` | 保存 AI 平台配置 | Step 1 |
| POST | `/api/setup/fetch-models` | 获取模型列表 | Step 1 |
| POST | `/api/setup/configure-security` | 保存安全设置 | Step 2 |
| POST | `/api/setup/browse-directory` | 浏览文件夹 | Step 3 |
| POST | `/api/setup/validate-path` | 验证路径 | Step 3 |
| POST | `/api/setup/configure-workspace` | 保存工作目录 | Step 3 |
| POST | `/api/setup/configure-channels` | 保存渠道配置 | Step 4 |
| POST | `/api/setup/validate-license` | 验证许可证 | Step 5 |
| POST | `/api/setup/complete` | 标记向导完成 | Step 6 |
| POST | `/api/setup/restart` | 重启 Gateway | Step 6 |

---

### 12.2 GET `/api/setup/state` - 获取向导状态

**响应示例**：
```json
{
  "ok": true,
  "data": {
    "step": 1,
    "completed": false,
    "region": "cn",
    "platform": {
      "os": "win32",
      "arch": "x64",
      "variant": "lite",
      "sandboxType": "soft",
      "osVersion": "10.0.22631",
      "dockerAvailable": false
    },
    "defaults": {
      "workspace": "C:\\Clawdbot\\workspace",
      "configPath": "C:\\Clawdbot\\config\\settings.json"
    }
  }
}
```

**平台默认工作目录**：
| 平台 | 默认工作目录 |
|------|-------------|
| Windows | `C:\Clawdbot\workspace` |
| macOS | `~/.clawbotcn/workspace` |
| Linux | `/opt/clawdbot/workspace` |

---

### 12.3 POST `/api/setup/configure-provider` - 保存 AI 平台配置

**请求**：
```json
{
  "provider": "siliconflow",
  "apiKey": "sk-xxxxxxxxxxxxxxxx",
  "model": "deepseek-ai/DeepSeek-V3"
}
```

**响应**：
```json
{
  "ok": true,
  "data": {
    "verified": true,
    "message": "API Key 验证成功"
  }
}
```

**验证错误响应**：
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API Key 无效，请检查是否正确"
  }
}
```

**服务商 ID 列表**（与 `region-cn.ts` 对齐）：
| 服务商 ID | 名称 | API 端点 |
|----------|------|---------|
| `siliconflow` | 硅基流动 | `https://api.siliconflow.cn/v1` |
| `glm` | 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` |
| `aliyun-bailian` | 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `deepseek` | DeepSeek | `https://api.deepseek.com` |
| `volcengine-ark` | 豆包 | `https://ark.cn-beijing.volces.com/api/v3` |
| `minimax` | MiniMax | `https://api.minimaxi.com/anthropic` |
| `tencent-hunyuan` | 腾讯混元 | `https://hunyuan.tencentcloudapi.com` |

---

### 12.4 POST `/api/setup/configure-security` - 保存安全设置

**请求**：
```json
{
  "mode": "standard",
  "trustedDirs": ["D:\\apps", "D:\\tools"]
}
```

**mode 值映射**：
| mode | sandbox.mode | tools.exec.security | 说明 |
|------|-------------|---------------------|------|
| `"full"` | `"all"` | `"deny"` | 安全模式：所有会话启用沙盒 |
| `"standard"` | `"non-main"` | `"allowlist"` | 智能模式：非主会话启用沙盒（推荐） |
| `"trust"` | `"off"` | `"full"` | 专家模式：无沙盒限制 |

**Lite 版生成的配置**：
```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main",
        "allowedPaths": ["D:\\clawdbot-workspace", "D:\\apps", "D:\\tools"]
      }
    }
  },
  "tools": {
    "exec": {
      "security": "allowlist"
    }
  }
}
```

**Pro 版生成的配置**：
```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main",
        "docker": {
          "image": "clawdbot-sandbox:bookworm-slim",
          "binds": [
            "D:\\clawdbot-workspace:/workspace:rw",
            "D:\\apps:/trusted/apps:rw"
          ]
        }
      }
    }
  },
  "tools": {
    "exec": {
      "security": "allowlist"
    }
  }
}
```

---

### 12.5 POST `/api/setup/validate-license` - 验证许可证

**请求**：
```json
{
  "token": "clawd-1706500000000-a1b2c3d4"
}
```

**后端调用 Tecbinai 外部 API**：
```
POST https://www.tecbinai.com/api/api/verify-key
Content-Type: application/json

{
  "key": "clawd-1706500000000-a1b2c3d4"
}
```

**成功响应**：
```json
{
  "ok": true,
  "data": {
    "valid": true,
    "status": "active",
    "expiresAt": "2026-12-31T23:59:59",
    "message": "秘钥有效"
  }
}
```

**失败响应示例**：
| Tecbinai 返回 message | 用户看到 |
|----------------------|----------|
| `秘钥有效` | ✅ 验证成功！感谢支持 ClawbotCN！ |
| `秘钥不存在，请检查输入是否正确` | ❌ 验证失败: 秘钥不存在... |
| `秘钥已过期` | ❌ 验证失败: 秘钥已过期 |
| `秘钥已被撤销` | ❌ 验证失败: 秘钥已被撤销 |

---

### 12.6 POST `/api/setup/configure-channels` - 保存渠道配置

**请求**：
```json
{
  "channels": ["dingtalk", "feishu"]
}
```

**说明**：
- 向导只标记渠道为 `enabled: true`
- 详细配置（Token、Webhook 等）需要在渠道页面完成
- 此步骤**可跳过**

**响应**：
```json
{
  "ok": true,
  "data": {
    "enabled": ["dingtalk", "feishu"]
  }
}
```

---

### 12.7 审批超时配置（已实现）

**当前代码状态**（`src/agents/bash-tools.exec.ts`）：
```typescript
const DEFAULT_APPROVAL_TIMEOUT_MS = 300_000; // 默认 5 分钟
```

**配置热更新**已支持（`src/gateway/config-reload.ts`）：
```typescript
{ prefix: "tools.exec.approvalTimeoutMs", kind: "hot" }
```

**配置示例**：
```yaml
# ~/.clawdbot/config.yaml
tools:
  exec:
    approvalTimeoutMs: 300000  # 5 分钟
```

---

### 12.8 前端状态管理参考

```javascript
// 与代码 setup-page.ts 对齐
const securityModeNames = {
  full: '安全模式',
  standard: '智能模式', 
  trust: '专家模式'
};

// 全局状态变量
let currentStep = 1;               // 当前步骤 (1-6)
let selectedProvider = null;       // 选中的 AI 平台 ID
let selectedChannels = [];         // 选中的渠道 ID 数组
let selectedSecurity = 'standard'; // 安全模式: "full" | "standard" | "trust"
let trustedDirs = [];              // 额外信任目录列表
let workspace = '';                // 主工作目录

// 服务商默认模型
const defaultModels = {
  'siliconflow': 'deepseek-ai/DeepSeek-V3',
  'aliyun-bailian': 'qwen-plus-latest',
  'deepseek': 'deepseek-chat',
  'glm': 'glm-4-plus',
  'volcengine-ark': 'Doubao-Seed-1.8',  // 注意：需要用户替换为接入点 ID
  'tencent-hunyuan': 'hunyuan-pro',
  'minimax': 'MiniMax-M2.1'
};
```

---

## 十三、豆包（火山引擎）特殊处理

> ⚠️ 豆包的模型 ID 不是固定值，需要特殊 UI 处理

### 13.1 问题说明

豆包与其他服务商不同：
1. **API Key** 是 UUID 格式：`0baa0583-1300-40ec-88fc-13df830b0e08`
2. **模型 ID** 是用户在控制台创建的「推理接入点 ID」，格式：`ep-xxxxxxxxxx`
3. 用户必须先在火山引擎控制台创建接入点，获取 ID 后填入

### 13.2 UI 设计

选择豆包后，显示特殊提示：
```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️ 豆包需要额外配置                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1️⃣ 获取 API Key                                                    │
│     前往 console.volcengine.com/ark 获取 API Key                    │
│                                                                     │
│  API Key                                                            │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │ 0baa0583-1300-40ec-88fc-13df830b0e08                      │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                     │
│  2️⃣ 创建推理接入点                                                  │
│     在控制台「模型推理」→「推理接入点」中创建，获取接入点 ID          │
│                                                                     │
│  推理接入点 ID                                                       │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │ ep-20250130xxxxxxxx                                       │      │
│  └───────────────────────────────────────────────────────────┘      │
│  💡 格式：ep-xxxxxxxxxxxx（在控制台创建后复制）                       │
│                                                                     │
│  [查看配置教程]                                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 13.3 后端配置生成

```json
{
  "providers": {
    "volcengine-ark": {
      "apiKey": "0baa0583-1300-40ec-88fc-13df830b0e08"
    }
  },
  "largeModelProvider": "volcengine-ark",
  "models": {
    "providers": {
      "volcengine-ark": {
        "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
        "models": [
          { "id": "ep-20250130xxxxxxxx", "name": "豆包 1.8" }
        ]
      }
    }
  }
}
```

---

## 十四、腾讯混元特殊处理

> ⚠️ 腾讯混元需要两个字段：SecretId + SecretKey

### 14.1 UI 设计

选择腾讯混元后，显示双输入框：
```
┌─────────────────────────────────────────────────────────────────────┐
│  📝 腾讯混元配置                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  在腾讯云 CAM 控制台获取 SecretId 和 SecretKey                       │
│  https://console.cloud.tencent.com/cam/capi                         │
│                                                                     │
│  SecretId *                                                         │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │ AKIDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx                      │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                     │
│  SecretKey *                                                        │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │ ****************************************                  │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 14.2 后端配置生成

```json
{
  "providers": {
    "tencent-hunyuan": {
      "secretId": "AKIDxxxxxxxx",
      "secretKey": "xxxxxxxx"
    }
  }
}
```

---

## 十五、智谱 GLM API Key 格式说明

### 15.1 格式特点

智谱 GLM 的 API Key 是两段式，中间有点号 `.` 分隔：
- 第一段：32位十六进制（小写）
- 第二段：16位以上的混合字符

**示例**：`4ddd4ab6a37d41e0ac445e8a3646db0a.Hg5KLqcnOT8EVKSq`

### 15.2 前端校验正则

```javascript
const GLM_API_KEY_REGEX = /^[a-f0-9]{32}\.[a-zA-Z0-9]{16,}$/;

function validateGlmApiKey(key) {
  if (!GLM_API_KEY_REGEX.test(key)) {
    return {
      valid: false,
      message: '智谱 API Key 格式不正确，应为两段式（如：xxxxxxxx.xxxxxxxx）'
    };
  }
  return { valid: true };
}
```

---

*文档创建：2026-01-30*  
*最后更新：2026-01-30（融合代码实现细节，补充前后端 API 对接规范）*
