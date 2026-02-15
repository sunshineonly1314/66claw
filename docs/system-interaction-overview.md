# OpenClawCN 系统交互逻辑全景 — 用户视角 + 技术视角

> 本文档从**用户**和**技术**两个视角，完整介绍 OpenClawCN Web 管理界面的交互逻辑。
> 适合：产品经理理解功能、开发者理解架构、新团队成员快速上手。

---

## 目录

- [一、整体架构一句话说清](#一整体架构一句话说清)
- [二、用户看到的：完整使用旅程](#二用户看到的完整使用旅程)
  - [2.1 第一次打开：我看到了什么？](#21-第一次打开我看到了什么)
  - [2.2 日常使用：5 个核心页面做什么？](#22-日常使用5-个核心页面做什么)
  - [2.3 聊天：跟 AI 对话的完整体验](#23-聊天跟-ai-对话的完整体验)
  - [2.4 技能管理：让 AI 学会新本领](#24-技能管理让-ai-学会新本领)
  - [2.5 配置修改：想调参数怎么办？](#25-配置修改想调参数怎么办)
  - [2.6 多渠道对话：钉钉飞书企微 QQ](#26-多渠道对话钉钉飞书企微-qq)
  - [2.7 省钱功能：免费模型轮转](#27-省钱功能免费模型轮转)
- [三、技术架构：代码怎么跑的](#三技术架构代码怎么跑的)
  - [3.1 整体技术栈](#31-整体技术栈)
  - [3.2 前端架构图](#32-前端架构图)
  - [3.3 WebSocket 通信协议](#33-websocket-通信协议)
  - [3.4 状态管理机制](#34-状态管理机制)
  - [3.5 认证与安全](#35-认证与安全)
  - [3.6 数据持久化](#36-数据持久化)
  - [3.7 实时事件系统](#37-实时事件系统)
  - [3.8 容错与恢复机制](#38-容错与恢复机制)
- [四、核心交互流程详解（用户+技术双视角）](#四核心交互流程详解用户技术双视角)
  - [4.1 连接流程](#41-连接流程)
  - [4.2 发送消息流程](#42-发送消息流程)
  - [4.3 切换 AI 模型流程](#43-切换-ai-模型流程)
  - [4.4 安装技能流程](#44-安装技能流程)
  - [4.5 修改配置流程](#45-修改配置流程)
  - [4.6 许可证激活流程](#46-许可证激活流程)
- [五、页面与文件对应关系](#五页面与文件对应关系)

---

## 一、整体架构一句话说清

**用户视角**：OpenClawCN 是一个装在你电脑上的 AI 助手，你通过浏览器网页管理它，通过钉钉/飞书/网页跟它聊天。

**技术视角**：OpenClawCN 由一个 Node.js Gateway 服务 + 一个 Lit Web Components 前端组成，前后端通过 WebSocket 全双工通信，前端状态由 Lit 响应式系统驱动。

```
┌──────────────────────────────────────────────────────────────┐
│                          用户                                 │
│                                                              │
│    浏览器（Web 管理页面）   钉钉/飞书/企微/QQ（聊天渠道）      │
└────────────┬─────────────────────────┬───────────────────────┘
             │ WebSocket                │ WebSocket/HTTP
             │                          │
┌────────────▼──────────────────────────▼───────────────────────┐
│                     Gateway 服务（Node.js）                    │
│                                                               │
│  ┌─────────┐  ┌───────────┐  ┌────────┐  ┌───────────────┐   │
│  │ 路由分发 │  │ 会话管理   │  │ 安全层 │  │ 配置管理       │   │
│  └─────────┘  └───────────┘  └────────┘  └───────────────┘   │
│                                                               │
│  ┌─────────┐  ┌───────────┐  ┌────────┐  ┌───────────────┐   │
│  │ AI 调用 │  │ 技能引擎   │  │ 命令执行│  │ 许可证验证     │   │
│  └─────────┘  └───────────┘  └────────┘  └───────────────┘   │
└───────────────────────────────────────────────────────────────┘
             │
             ▼
┌───────────────────────────────────┐
│  AI 厂商 API                      │
│  硅基流动 / DeepSeek / 通义 / ... │
└───────────────────────────────────┘
```

---

## 二、用户看到的：完整使用旅程

### 2.1 第一次打开：我看到了什么？

用户在浏览器输入 `http://localhost:18789`（本机）或 `https://服务器IP:18789?token=xxx`（远程），看到的第一个画面取决于系统状态：

**场景 A：服务已启动、已连接**

```
┌───────────────────────────────────────────────────────┐
│ ☰ ClawbotCN 全栈国内运行    [✅ 已连接]  [🌙/☀️/💻] │
├────────┬──────────────────────────────────────────────┤
│        │                                              │
│ 💬 对话│  📊 系统状态                                  │
│ 📊 概览│  ✅ 系统正常运行  运行时长: 2小时             │
│ ⚡ 技能│  活跃实例: 2  活跃会话: 5                     │
│ 📱 渠道│                                              │
│ ⚙️ 设置│  🤖 当前模型                                 │
│        │  DeepSeek V3 · 硅基流动                      │
│ ▸ 高级 │  [切换模型]  [配置 API Key]                   │
│        │                                              │
│        │  🛡️ 安全模式                                 │
│        │  ● 家庭模式（推荐）                           │
│        │  ○ 办公模式  ○ 只聊天                         │
│        │                                              │
│        │  📈 今日用量                                  │
│        │  Token: 12,450  费用: ¥0.12                  │
│        │                                              │
└────────┴──────────────────────────────────────────────┘
```

用户一眼就能看到：系统正常、用的什么模型、今天花了多少钱。

**场景 B：服务已启动、但需要输入令牌**

```
┌───────────────────────────────────────────────────────┐
│ ☰ ClawbotCN 全栈国内运行    [❌ 未连接]              │
├────────┬──────────────────────────────────────────────┤
│        │                                              │
│        │  ❌ 未连接到 AI 服务                          │
│        │                                              │
│        │  WebSocket 地址: [ws://localhost:18789    ]   │
│        │  令牌:          [____________________    ]   │
│        │  密码（可选）:   [____________________    ]   │
│        │                                              │
│        │  [连接]  [刷新]                               │
│        │                                              │
│        │  💡 不知道令牌？在终端运行：                   │
│        │  openclawcn dashboard --no-open    [复制]      │
│        │                                              │
└────────┴──────────────────────────────────────────────┘
```

**场景 C：首次使用（新用户引导 — 设计方案）**

系统检测到是第一次访问（localStorage 无标记），展示欢迎引导 → 三步配置（激活码 → AI厂商 → 渠道）→ 自动完成几十个默认参数 → 直接开始聊天。

---

### 2.2 日常使用：5 个核心页面做什么？

| 页面 | 用户一句话理解 | 使用频率 |
|------|--------------|---------|
| **💬 对话** | 跟 AI 聊天的地方 | 每天用 |
| **📊 概览** | 看系统状态、切模型、调安全等级 | 经常看 |
| **⚡ 技能** | 给 AI 开关能力（搜索、截图、天气...） | 偶尔调 |
| **📱 渠道** | 管理钉钉/飞书/企微/QQ 的连接 | 配一次 |
| **⚙️ 设置** | 修改所有配置参数 | 很少用 |

还有更多页面（用量统计、定时任务、会话管理、免费模型、体验场、节点、调试、日志）折叠在"高级功能"里，日常不需要打开。

---

### 2.3 聊天：跟 AI 对话的完整体验

**用户视角的完整聊天过程**：

```
1. 用户在输入框打字："帮我写一个 Python 爬虫"
   │
2. 点击发送（或按回车）
   │
3. 立即看到自己的消息出现在聊天区（右对齐，蓝色气泡）
   │
4. AI 开始回复（左对齐，灰色气泡），有三种情况：
   │
   ├─ 情况一：纯文字回复
   │  AI 的文字一个字一个字地"打"出来（流式输出），
   │  就像对方在实时打字一样。
   │
   ├─ 情况二：AI 需要执行操作（比如创建文件）
   │  先显示"⏳ AI 正在思考..."
   │  → 显示工具调用卡片："🔧 执行命令: mkdir ~/project"
   │  → 工具执行完毕："✅ 已完成"
   │  → AI 继续回复文字
   │
   └─ 情况三：AI 回复很慢（超过 30 秒）
      显示友好的等待提示：
      0-10秒: "AI 正在思考..."
      10-30秒: "AI 正在执行命令，请稍候..."
      30-90秒: "操作比较复杂，还在处理中（45秒）"
```

**聊天页的辅助功能**：

| 功能 | 怎么用 | 效果 |
|------|--------|------|
| 新对话 | 点击 ➕ 按钮 | 清空上下文，开始全新对话 |
| 切换会话 | 顶部下拉框 | 在不同对话之间切换 |
| 显示思考 | 点击 🧠 图标 | 看到 AI 的推理过程 |
| 专注模式 | 点击 ⊞ 图标 | 隐藏侧边栏，全屏聊天 |
| 附件 | 点击 📎 | 发送图片/文件给 AI |
| 中断 | AI 回复时点击"停止" | 立即停止 AI 回复 |

**免费模型切换通知**：

如果用户开启了免费模型轮转，AI 回复时可能自动切换厂商。这时聊天区会出现一个小卡片："ℹ️ 已切换到 DeepSeek（硅基流动今日额度已用完）"。

---

### 2.4 技能管理：让 AI 学会新本领

**用户视角**：技能就像手机里的 App。AI 本身只会聊天，装上"技能"后才能做更多事情。

```
技能页打开后看到：

┌─ 搜索框 ─────────────────────────────────────────────┐
│ 🔍 输入你想做的事，比如：天气、截图、写代码...          │
└──────────────────────────────────────────────────────┘

┌─ 分类标签 ──────────────────────────────────────────┐
│ [✨全部] [🌤️生活] [💰财经] [🖥️电脑] [🚀效率]        │
│ [🎨创意] [💬通讯] [💻开发]                            │
└─────────────────────────────────────────────────────┘

┌─ 技能概况卡片 ──────────────────────────────────────┐
│ 可以使用: 28  │  需要设置: 8  │  不适用本系统: 6     │
└─────────────────────────────────────────────────────┘

┌─ 技能列表 ──────────────────────────────────────────┐
│                                                     │
│  ── 可以使用的技能 (28) ──                           │
│                                                     │
│  🛡️ 天气查询        ✅ 可以使用    [禁用]           │
│      查询实时天气预报                                │
│                                                     │
│  🛡️ 网页搜索        ✅ 可以使用    [禁用]           │
│      联网搜索最新信息                                │
│                                                     │
│  ── 需要简单设置的技能 (8) ──                        │
│                                                     │
│  🔧 图片生成         ⚠️ 需要设置   [安装] [配密钥]  │
│      需要: 配置密钥「OPENAI_API_KEY」               │
│      API Key: [________] [保存]                     │
│                                                     │
│  ── 不适用于本系统的技能 (6) ▸ 点击展开 ──           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**关键交互**：

- **搜索是"语义"搜索**：输入"截图"能找到名叫 "camsnap" 的技能，输入"天气"能找到 "weather"，输入"股票"能找到所有财经类技能
- **三区分组**：可用的在上面（绿色）、需设置的在中间（黄色）、不兼容当前系统的折叠在底部（灰色）
- **一键安装**：缺工具时显示蓝色"安装"按钮，点击后自动下载安装
- **API Key 填写**：需要密钥的技能会展示密码输入框，填完点保存
- **技能市场**：切换到"市场"Tab，可以浏览和安装更多技能

---

### 2.5 配置修改：想调参数怎么办？

用户有 7 种方式修改配置（从简单到复杂）：

```
难度从低到高：

1️⃣ 概览页快捷操作 ──→ 切模型、改安全模式（3秒搞定）

2️⃣ 技能页开关     ──→ 打开/关闭某个能力（1秒搞定）

3️⃣ 安装向导       ──→ 重新走一遍配置流程

4️⃣ 聊天命令       ──→ 发送 /config set xxx=yyy

5️⃣ 配置编辑器     ──→ 完整的可视化表单 + 原始 JSON 编辑

6️⃣ 命令行工具     ──→ openclawcn config / configure / setup

7️⃣ 直接改文件     ──→ 编辑 ~/.openclawcn/openclawcn.json
```

**配置编辑器的操作流程**：

```
用户打开配置页
  │
  ├─ 左侧：导航面板，列出 12+ 个配置分类
  │         （智能体、认证、渠道、消息、工具、网关...）
  │
  ├─ 中间：编辑区域
  │    │
  │    ├─ 表单模式（推荐小白）
  │    │   每个参数 = 一个输入控件
  │    │   温度: [滑块]  模型: [下拉框]  压缩: [开关]
  │    │
  │    └─ 原始模式（给高级用户）
  │        直接编辑 JSON5 文本
  │
  ├─ 右侧/底部：变更预览
  │    "你修改了 2 项：temperature 0.7→0.5, contextTokens 65536→128000"
  │
  └─ 底部操作栏：
       [重载] ──→ 丢弃修改，重新加载
       [保存] ──→ 写入文件，部分参数立即生效
       [保存并重启] ──→ 写入文件 + 重启服务（所有参数都生效）
       [检查更新] ──→ 检查软件新版本
```

---

### 2.6 多渠道对话：钉钉飞书企微 QQ

用户可以通过 4 种聊天工具跟 AI 对话（除了网页）：

```
网页聊天 ──→ 直接在浏览器里聊（内置）
钉钉     ──→ 在钉钉群里 @AI助手 对话
飞书     ──→ 在飞书群里 @AI助手 对话
企业微信 ──→ 在企微群里 @AI助手 对话
QQ Bot   ──→ 在QQ群里 @AI助手 对话
```

**渠道配置过程**（以钉钉为例）：

```
1. 用户在钉钉开放平台创建机器人 → 获得 AppKey 和 AppSecret
2. 在 OpenClawCN 渠道页面 → 找到"钉钉"卡片 → 填入 AppKey 和 AppSecret
3. 点击"保存" → 系统自动建立 WebSocket 长连接到钉钉服务器
4. 在钉钉群里添加机器人 → 群成员就可以 @机器人 跟 AI 对话了
```

**群聊与私聊的区别**：

- **群聊**：必须 @ 机器人才会回复（避免 AI 对每条消息都回复）
- **私聊**：直接发消息就会回复

---

### 2.7 省钱功能：免费模型轮转

国内多家 AI 厂商提供每日免费额度。OpenClawCN 可以自动管理多个免费账号：

```
用户配置了 3 个免费账号：

  硅基流动 ──→ 每天免费 10 次 ──→ ⭐ 首选
  DeepSeek ──→ 每天免费 5 次
  智谱GLM  ──→ 每天免费 5 次

使用过程（用户无感）：

  08:00  用户发消息 → 使用硅基流动（首选）
  09:30  用户发消息 → 使用硅基流动
  ...
  15:00  硅基流动今日额度用完 → 自动切换到 DeepSeek
         聊天区显示通知："ℹ️ 已切换到 DeepSeek"
  ...
  20:00  DeepSeek 也用完 → 自动切换到智谱GLM
  ...
  00:00  新的一天 → 所有额度重置 → 回到首选硅基流动
```

---

## 三、技术架构：代码怎么跑的

### 3.1 整体技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| **前端框架** | Lit (lit-html + LitElement) | Web Components，轻量响应式 |
| **语言** | TypeScript | 全栈 TypeScript |
| **后端运行时** | Node.js | Gateway 服务 |
| **前后端通信** | WebSocket (JSON-RPC) | 全双工、实时推送 |
| **状态管理** | Lit @state() 装饰器 | 无额外状态库，属性变化自动触发渲染 |
| **持久化** | localStorage + JSON5 文件 | 前端设置存浏览器，后端配置存文件 |
| **国际化** | 自实现 i18n（t() 函数） | 支持 zh-CN / en 两个 locale |
| **样式** | 原生 CSS（非 CSS-in-JS） | 独立 CSS 文件，支持暗色/亮色主题 |
| **构建** | TypeScript 编译 | 无 bundler 中间层 |

---

### 3.2 前端架构图

```
┌─ openclawcn-app (LitElement 自定义元素) ─────────────────────────┐
│                                                                │
│  ┌─ @state() 响应式属性 ─────────────────────────────────────┐  │
│  │ connected, tab, chatMessages, configForm, skillsReport,   │  │
│  │ licenseState, modelsProviders, securityModes, ...         │  │
│  │ （共 100+ 个响应式属性，任何一个变化都触发 re-render）       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ 渲染层 ─────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  app-render.ts ──→ 外壳（顶栏 + 侧边栏 + 内容区）        │  │
│  │       │                                                   │  │
│  │       ├── views/overview.ts  ──→ 概览页                   │  │
│  │       ├── views/chat.ts      ──→ 聊天页                   │  │
│  │       ├── views/skills.ts    ──→ 技能页                   │  │
│  │       ├── views/config.ts    ──→ 配置页                   │  │
│  │       ├── views/channels.ts  ──→ 渠道页                   │  │
│  │       ├── views/free-models.ts ──→ 免费模型页             │  │
│  │       ├── views/usage.ts     ──→ 用量统计页               │  │
│  │       ├── views/cron.ts      ──→ 定时任务页               │  │
│  │       ├── views/sessions.ts  ──→ 会话管理页               │  │
│  │       ├── views/debug.ts     ──→ 调试页                   │  │
│  │       ├── views/logs.ts      ──→ 日志页                   │  │
│  │       └── ... (playground, nodes, instances, docs)        │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ 控制层 ─────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  controllers/chat.ts      ──→ 聊天历史加载               │  │
│  │  controllers/skills.ts    ──→ 技能增删改查               │  │
│  │  controllers/config.ts    ──→ 配置读写                   │  │
│  │  controllers/models.ts    ──→ 模型选择/认证              │  │
│  │  controllers/security.ts  ──→ 安全模式切换               │  │
│  │  controllers/free-models.ts ──→ 免费模型管理             │  │
│  │  controllers/devices.ts   ──→ 设备配对                   │  │
│  │  controllers/capability-detect.ts ──→ 首次访问检测        │  │
│  │  ...                                                      │  │
│  │                                                           │  │
│  │  每个 controller 通过 state.client.request(method, params)│  │
│  │  调用 Gateway API                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ 通信层 ─────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  gateway.ts (GatewayBrowserClient)                        │  │
│  │  │                                                        │  │
│  │  ├── WebSocket 连接管理                                   │  │
│  │  ├── JSON-RPC 请求/响应                                   │  │
│  │  ├── 服务端事件推送                                        │  │
│  │  ├── 设备密钥认证（WebCrypto API）                        │  │
│  │  └── 指数退避重连                                         │  │
│  │                                                           │  │
│  │  app-gateway.ts（应用层网关集成）                          │  │
│  │  │                                                        │  │
│  │  ├── 连接初始化 + 握手                                    │  │
│  │  ├── 3 层认证恢复策略                                     │  │
│  │  ├── 启动优雅等待（120 秒）                               │  │
│  │  └── 事件分发 → 聊天/存在/定时/审批/技能安装              │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ 基础设施层 ─────────────────────────────────────────────┐  │
│  │  storage.ts     ──→ localStorage 读写                    │  │
│  │  theme.ts       ──→ 主题系统（system/light/dark）        │  │
│  │  navigation.ts  ──→ 路由定义（14 Tab + URL 映射）        │  │
│  │  i18n/          ──→ 国际化（zh-CN / en）                 │  │
│  │  icons.ts       ──→ SVG 图标库                           │  │
│  │  format.ts      ──→ 格式化工具（时间、数字等）            │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

### 3.3 WebSocket 通信协议

前后端所有交互都通过一个 WebSocket 连接完成，使用 JSON-RPC 风格的帧格式：

**请求帧**（前端 → Gateway）：

```json
{
  "id": "req-42",
  "method": "skills.list",
  "params": {}
}
```

**响应帧**（Gateway → 前端）：

```json
{
  "id": "req-42",
  "result": { "skills": [...] }
}
```

**事件帧**（Gateway → 前端，单向推送）：

```json
{
  "event": "chat",
  "payload": { "type": "stream", "text": "你好" },
  "seq": 156
}
```

**常用 API 方法举例**：

| 方法 | 用途 | 调用场景 |
|------|------|---------|
| `chat.send` | 发送聊天消息 | 用户点击发送 |
| `chat.abort` | 中断 AI 回复 | 用户点击停止 |
| `chat.history` | 获取聊天历史 | 切换会话/刷新 |
| `config.get` | 读取配置 | 打开配置页 |
| `config.save` | 保存配置 | 点击保存按钮 |
| `config.apply` | 保存并重启 | 点击保存并重启 |
| `skills.list` | 获取技能列表 | 打开技能页 |
| `skills.toggle` | 启用/禁用技能 | 点击开关 |
| `skills.install` | 安装技能依赖 | 点击安装按钮 |
| `models.list` | 获取模型列表 | 打开概览页 |
| `models.set` | 切换模型 | 选择新模型并确认 |
| `security.modes` | 获取安全模式 | 打开概览页 |
| `security.set` | 切换安全模式 | 点击安全选项 |
| `license.activate` | 激活许可证 | 输入激活码 |
| `capability.detect.quick` | 快速检测系统能力 | 首次访问 |

**连接握手流程**：

```
前端                              Gateway
  │                                  │
  │── WebSocket 连接 ──────────────→│
  │                                  │
  │←── connect.challenge { nonce } ──│  ← 服务端发挑战
  │                                  │
  │── connect {                  ──→│  ← 前端签名回复
  │     device: { publicKey, sig },  │
  │     auth: { token/password }     │
  │   }                              │
  │                                  │
  │←── hello-ok {                ──│  ← 握手成功
  │     snapshot, deviceToken,       │
  │     serverVersion                │
  │   }                              │
  │                                  │
  │   （双向通信开始）                │
```

---

### 3.4 状态管理机制

OpenClawCN 前端没有使用 Redux/Vuex/MobX 等外部状态库，而是直接用 Lit 框架的响应式属性系统：

**原理**：

```typescript
// app.ts 中声明响应式属性
@state() connected = false;
@state() chatMessages: ChatMessage[] = [];
@state() skillsReport: SkillStatusReport | null = null;

// 任何对这些属性的赋值都会自动触发 render() 重新执行
// 例如：
this.connected = true;  // → 自动触发 UI 更新
this.chatMessages = [...this.chatMessages, newMsg];  // → 聊天区自动刷新
```

**数据流**：

```
用户操作（点击/输入）
    │
    ▼
Controller 函数被调用
    │
    ├─ 通过 state.client.request() 调用 Gateway API
    │
    ▼
收到 API 响应
    │
    ├─ 更新 @state() 属性
    │
    ▼
Lit 检测到属性变化
    │
    ├─ 自动调用 render()
    │
    ▼
UI 更新（只更新变化的 DOM 部分）
```

**状态分类**：

| 类别 | 属性示例 | 存储位置 |
|------|---------|---------|
| 连接状态 | `connected`, `hello`, `startupWaiting` | 内存（不持久化） |
| UI 偏好 | `theme`, `navCollapsed`, `chatFocusMode` | localStorage |
| 认证信息 | `token`, `password` | localStorage |
| 业务数据 | `chatMessages`, `skillsReport`, `configForm` | 内存（每次从 Gateway 加载） |
| 临时状态 | `chatSending`, `configSaving`, `modelsLoading` | 内存（操作进行中 = true） |

---

### 3.5 认证与安全

**三层认证体系**：

```
第一层：Token 认证
  │  用户在 URL 或输入框提供 token
  │  token 是一串随机字符（如 a3f8b2c1d5e7...）
  │  Gateway 验证 token 匹配后允许连接
  │
第二层：设备密钥认证（增强安全）
  │  浏览器用 WebCrypto API 生成 ECDSA 密钥对
  │  首次连接时注册公钥到 Gateway
  │  后续连接用私钥签名 nonce 证明身份
  │  条件：仅在 HTTPS 或 localhost 安全上下文可用
  │
第三层：会话管理
     每个连接绑定一个 sessionKey
     默认 "main"，可通过 URL 或设置切换
     不同 sessionKey 有独立的对话上下文
```

**认证失败恢复策略**（3 层自动恢复）：

```
认证失败
  │
  ├─ L1：HTTP Token 刷新
  │   请求 /api/auth/discover 获取新 token（~100ms）
  │   场景：token 过期但服务在运行
  │
  ├─ L2：页面重载
  │   完整刷新页面以获取服务端注入的新 token
  │   限制：5 分钟内最多重载 2 次
  │   场景：服务重启后 token 变了
  │
  └─ L3：延迟重试
      暂停后重新连接
      限制：最多 6 次连续失败后断路
      场景：服务正在重启中
```

---

### 3.6 数据持久化

**前端持久化（localStorage）**：

```typescript
// 存储 key: "openclawcn-ui-settings"
{
  gatewayUrl: "ws://localhost:18789",    // WebSocket 地址
  token: "a3f8b2c1...",                  // 认证令牌
  sessionKey: "main",                    // 当前会话
  lastActiveSessionKey: "main",          // 上次活跃会话
  theme: "system",                       // 主题偏好
  chatFocusMode: false,                  // 专注模式
  chatShowThinking: false,               // 显示思考
  splitRatio: 0.6,                       // 侧边栏分割比例
  navCollapsed: false,                   // 导航栏折叠
  navGroupsCollapsed: {},                // 各导航组折叠状态
}

// 首次访问标记
"openclawcn:discovery:firstVisit": "2025-02-08T..."
"openclawcn:discovery:completed": "true"
```

**Token 来源优先级**：

```
1. window.__OPENCLAWCN_GATEWAY_TOKEN__  ← 服务端注入（同源页面）
2. URL ?token=xxx                     ← URL 参数
3. localStorage 存储的 token           ← 之前保存的
4. 空（需要用户手动输入）
```

**后端持久化（JSON5 文件）**：

```
~/.openclawcn/openclawcn.json
  │
  ├─ 所有配置参数（几十个）
  ├─ AI 厂商 API Key
  ├─ 渠道凭证（钉钉 AppKey 等）
  ├─ 安全模式设置
  └─ 定时任务定义
```

---

### 3.7 实时事件系统

Gateway 通过 WebSocket 主动推送事件给前端：

| 事件 | 触发时机 | 前端处理 |
|------|---------|---------|
| `chat` | AI 回复产生新内容 | 追加到聊天流，实现打字机效果 |
| `agent` | AI 执行工具/命令 | 更新工具调用卡片状态 |
| `presence` | 实例上下线 | 更新概览页实例计数 |
| `cron` | 定时任务执行 | 刷新定时任务页 |
| `device.pair.request` | 新设备请求配对 | 弹出审批弹窗（15秒过期） |
| `exec.approval.request` | AI 请求执行危险命令 | 弹出确认弹窗（60秒过期） |
| `skill.install.request` | 技能请求安装依赖 | 弹出安装确认弹窗 |
| `skill.install.progress` | 安装进度更新 | 更新进度条 |

**事件序列号追踪**：

```
每个事件帧携带 seq（自增序列号）。
前端记录 lastSeq，如果收到的 seq 不连续（有间隔），
说明中间丢了事件 → 记录错误日志（但不做重发，因为大部分事件是幂等的）。
```

---

### 3.8 容错与恢复机制

| 场景 | 处理方式 |
|------|---------|
| **WebSocket 断开** | 指数退避重连（800ms → 15s），成功后重置为 800ms |
| **Gateway 重启** | 关闭码 1012 视为预期断开，平滑重连 |
| **首次启动慢** | 120 秒启动优雅期，期间显示"⏳ 启动中"而非"❌ 连接失败" |
| **Token 过期** | 3 层恢复：HTTP 刷新 → 页面重载 → 延迟重试 |
| **配置保存冲突** | 基于 hash 的乐观并发控制，检测到冲突提示"配置已被修改" |
| **AI 回复超时** | 分阶段提示（10s/30s/90s），不自动断开 |
| **技能安装失败** | 显示错误信息 + 重试按钮 |
| **审批请求过期** | 60 秒定时器，过期自动清理弹窗 |
| **localStorage 不可用** | 回退到内存存储，不报错 |

---

## 四、核心交互流程详解（用户+技术双视角）

### 4.1 连接流程

```
用户视角：                           技术视角：
────────                           ────────
打开浏览器输入地址                   页面加载 → app.ts connectedCallback()
    │                                   │
看到加载动画                         loadSettings() 从 localStorage 读 token
    │                                   │
    │                               connectGateway() 创建 GatewayBrowserClient
    │                                   │
    │                               WebSocket.open → connect.challenge
    │                                   │
    │                               签名 nonce + 发送 token
    │                                   │
看到"✅ 已连接"                      收到 hello-ok → connected = true
    │                                   │
页面自动加载数据                     并行加载: overview, skills, channels,
                                    agents, models, security, presence
```

### 4.2 发送消息流程

```
用户视角：                           技术视角：
────────                           ────────
在输入框打字                        chatMessage 状态更新（@state）
    │                                   │
点击发送                            handleSendChat() 调用
    │                                   │
看到自己的消息                       chatMessages.push(userMsg) → 触发渲染
出现在聊天区                             │
    │                               client.request("chat.send", { text, sessionKey })
    │                                   │
看到"AI 正在思考..."                 收到 event:agent { type: "thinking" }
    │                                   │
看到 AI 的文字                       收到 event:chat { type: "stream", text: "..." }
一个字一个字出来                     chatStream 逐步追加文本 → 触发渲染
    │                                   │
AI 回复完成                          收到 event:chat { type: "final" }
    │                               loadChatHistory() 加载完整历史记录
    │                                   │
可以继续输入                        chatSending = false → 输入框恢复可用
```

### 4.3 切换 AI 模型流程

```
用户视角：                           技术视角：
────────                           ────────
在概览页点击                        modelsProviders 已在页面加载时获取
"切换模型"                              │
    │                                   │
看到厂商下拉框                       renderModelCard() 渲染 <select>
选择"DeepSeek"                          │
    │                               onChange → 检查 authConfigured
    │                                   │
  ┌─ 如果该厂商已配 Key ──→            setModelPending(provider, model)
  │  看到模型下拉框                     显示"保存"按钮
  │  选择 "DeepSeek V3"                    │
  │  点击"保存"                      confirmModelPending()
  │      │                           → client.request("models.set", {...})
  │  看到"✓ 已切换"                  modelsCurrent 更新 → 渲染
  │
  └─ 如果该厂商没配 Key ──→            setConfiguringProvider(providerId)
     看到 API Key 输入框                  │
     填入 Key                             │
     点击"验证"                      onVerifyApiKey() → API 验证
     看到"✓ 验证成功"                    │
     点击"保存"                      onSaveProviderAuth() → 写入配置
     看到"✓ 已保存"                  → 回到模型选择流程
```

### 4.4 安装技能流程

```
用户视角：                           技术视角：
────────                           ────────
在技能页找到                        skillsReport 包含所有技能状态
"天气查询"                              │
    │                                   │
看到"安装 weather"                  skill.install[0] 存在 → 显示安装按钮
蓝色按钮                                │
    │                                   │
点击安装                            installSkill(state, skillKey, name, installId)
    │                               → client.request("skills.install", {...})
    │                                   │
看到按钮变成                         收到 event:skill.install.request
进度条和旋转图标                     弹出确认弹窗（如需用户确认）
    │                                   │
进度条推进                           收到 event:skill.install.progress
"正在下载..."                        installProgress 更新 → 渲染进度条
"即将完成..."                            │
    │                                   │
看到"✅ 安装成功！"                  收到 event:skill.install.done
按钮变成"✓ 已安装"                  loadSkills(state) 刷新技能列表
```

### 4.5 修改配置流程

```
用户视角：                           技术视角：
────────                           ────────
打开配置页                          loadConfig(state)
    │                               → client.request("config.get")
看到当前配置                         configForm + configSchema 加载完成
                                    configFormOriginal 保存原始值
    │                                   │
修改某个参数                        updateConfigFormValue(state, path, value)
（比如温度改为 0.5）                 configForm 深层更新
    │                                   │
底部显示变更预览                    computeChanges() 对比 original vs current
"temperature: 0.7 → 0.5"               │
    │                                   │
点击"保存"                          saveConfig(state)
    │                               → client.request("config.save", { form, hash })
    │                               hash 用于乐观并发检测
    │                                   │
  ┌─ 成功                           configFormOriginal = 新的 form
  │  看到"✓ 已保存"                 configSaving = false
  │
  └─ hash 冲突                      服务端返回 conflict 错误
     看到"配置已被修改"              提示用户重载
```

### 4.6 许可证激活流程

```
用户视角：                           技术视角：
────────                           ────────
看到激活弹窗                        licenseState.valid = false
    │                               showLicenseDialog = "activation"
    │                                   │
输入激活码                              │
点击"激活"                          client.request("license.activate", { key })
    │                                   │
  ┌─ 成功                           licenseState.valid = true
  │  弹窗关闭                        showLicenseDialog = null
  │  开始正常使用                        │
  │
  ├─ 设备数超限 (1010)              showLicenseDialog = "device-switch"
  │  看到"该激活码已绑定              显示设备切换确认弹窗
  │  到另一台设备"                       │
  │  点击"切换到本设备"              client.request("license.switch")
  │
  ├─ 切换冷却期 (1011)              showLicenseDialog = "device-switch-cooldown"
  │  看到"请等待 24 小时后            显示冷却期倒计时
  │  再切换设备"                         │
  │
  └─ 激活码无效                      licenseActivationError = "激活码无效"
     看到红色错误提示                    │
     重新输入                            │
```

---

## 五、页面与文件对应关系

方便开发者快速定位代码：

| 页面 | 视图文件 | 控制器文件 | 样式文件 |
|------|---------|-----------|---------|
| 外壳（顶栏+侧边栏） | `ui/app-render.ts` + `app-render.helpers.ts` | — | `styles/components.css` |
| 概览 | `ui/views/overview.ts` | `controllers/models.ts`, `controllers/security.ts` | `styles/components.css` |
| 聊天 | `ui/views/chat.ts` + `chat/grouped-render.ts` | `controllers/chat.ts` | `styles/chat/grouped.css`, `chat/layout.css` |
| 技能 | `ui/views/skills.ts` | `controllers/skills.ts` | `styles/skills.css` |
| 配置 | `ui/views/config.ts` | `controllers/config.ts` | `styles/components.css` |
| 渠道 | `ui/views/channels.ts` | `controllers/channels.ts` | — |
| 免费模型 | `ui/views/free-models.ts` | `controllers/free-models.ts` | — |
| 用量统计 | `ui/views/usage.ts` | `controllers/usage.ts` | — |
| 定时任务 | `ui/views/cron.ts` | `controllers/cron.ts` | — |
| 会话管理 | `ui/views/sessions.ts` | `controllers/sessions.ts` | — |
| 体验场 | `ui/views/playground.ts` | `controllers/playground.ts` | — |
| 节点 | `ui/views/nodes.ts` | `controllers/nodes.ts`, `controllers/devices.ts` | — |
| 调试 | `ui/views/debug.ts` | `controllers/debug.ts` | — |
| 日志 | `ui/views/logs.ts` | `controllers/logs.ts` | — |
| 文档 | `ui/views/docs.ts` | 内嵌 | — |
| — | — | — | — |
| 通信层 | `ui/gateway.ts` | `ui/app-gateway.ts` | — |
| 状态定义 | `ui/app-view-state.ts` | — | — |
| 入口组件 | `ui/app.ts` | — | — |
| 设置存储 | `ui/storage.ts` | — | — |
| 主题 | `ui/theme.ts` | — | — |
| 导航路由 | `ui/navigation.ts` | — | — |
| 国际化 | `ui/i18n/locales/zh-CN.ts`, `en.ts` | — | — |
| 图标 | `ui/icons.ts` | — | — |

---

> **文档版本**: v1.0
> **最后更新**: 2026-02-08
> **配套文档**:
> - `docs/config-defaults-guide.md` — 全参数配置指南（10 章 + 3 附录）
> - `docs/uiux-interaction-design.md` — UI/UX 交互设计方案（7 部分）
