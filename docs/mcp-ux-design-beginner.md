# MCP 小白用户交互设计方案

> 文档版本: 1.0
> 最后更新: 2026-02-08
> 角色: 顶级交互设计专家
> 核心原则: **MCP 是空气，用户只感受到风**
> 配套文档: `docs/uiux-interaction-design.md`（全局 UI/UX 重设计方案）

---

## 设计哲学

> 用户不需要知道 MCP 是什么。
> 用户不需要打开 MCP 页面。
> 用户只需要说一句话，AI 就能做到之前做不到的事。
> 这就是 MCP 对小白用户的全部意义。

**类比**: 你用微信发语音消息时，不需要知道 AMR 编码是什么。
MCP 对用户来说，就是"AI 的手"——看不见，但能帮你做事。

---

## 目录

1. [用户认知模型](#一用户认知模型)
2. [核心交互原则](#二核心交互原则)
3. [竞品调研结论与最佳实践](#三竞品调研结论与最佳实践)
4. [场景一: 首次使用 — 无感知初始化](#四场景一-首次使用--无感知初始化)
5. [场景二: 对话中 — AI 自动调用 MCP](#五场景二-对话中--ai-自动调用-mcp)
6. [场景三: 需要配置 — 按需引导](#六场景三-需要配置--按需引导)
7. [场景四: 出错了 — 静默降级](#七场景四-出错了--静默降级)
8. [场景五: 好奇心 — 扩展工具管理页](#八场景五-好奇心--扩展工具管理页)
9. [场景六: 增量更新 — 完全后台](#九场景六-增量更新--完全后台)
10. [Chat 页面中的 MCP 可视化](#十chat-页面中的-mcp-可视化)
11. [文案设计规范](#十一文案设计规范)
12. [与现有 Skills 流程的关系](#十二与现有-skills-流程的关系)
13. [组件级实现指引](#十三组件级实现指引)
14. [反模式清单 — 绝对不要做的事](#十四反模式清单--绝对不要做的事)
15. [完整用户旅程地图](#十五完整用户旅程地图)

---

## 一、用户认知模型

### 1.1 小白用户的心理模型

小白用户对 AI 助手的理解：

```
"这是一个聊天机器人，我说话它回答"
         |
         | 使用一段时间后
         v
"这个机器人好像还能帮我查东西、做事情"
         |
         | 不需要知道的
         v
"什么是 MCP？什么是 JSON-RPC？什么是 stdio？"  <-- 永远不要让用户到这一步
```

### 1.2 正确的用户认知路径

```
第 1 天:  "我问它天气，它居然真的能查！"          (Aha Moment)
第 3 天:  "它还能帮我搜文件、查地图"              (能力发现)
第 7 天:  "这些能力是哪来的？好像有个扩展工具页面"   (好奇探索 - 可选)
第 30 天: "哦更新了新能力，我什么都没做就能用了"     (无感更新)
```

### 1.3 关键认知: 用户不需要学习任何新概念

| 传统做法 (错误) | 我们的做法 (正确) |
|-----------------|------------------|
| "请配置 MCP Server" | AI 直接帮你做事，不需要配置 |
| "MCP 是一种协议..." | 不提 MCP 这个词 |
| "请选择要安装的 MCP" | 预装好了，直接能用 |
| "MCP Server 启动失败" | "正在换个方式帮你..." |
| "请打开 MCP 管理页面" | 你什么都不用打开 |

---

## 二、核心交互原则

### 原则 1: 零步骤可用

```
用户安装 Clawdbot -> 打开 Chat -> 说"帮我查天气" -> 直接得到结果
                                                    ^
                                           中间发生了什么？
                                           1. MCP 预装包随安装包一起就位
                                           2. Gateway 启动时自动初始化 MCP
                                           3. Agent 发现天气工具并调用
                                           4. 结果返回给用户

                                           用户感知: 0 步骤
```

### 原则 2: 渐进式披露 (只在用户需要时才展示)

```
Level 0 (默认):  用户在 Chat 中对话，AI 自动使用 MCP，用户完全无感
Level 1 (轻触):  工具调用时，聊天流中出现一行小字"正在使用 天气查询..."
Level 2 (好奇):  用户点击小字，展开看到工具名和简要说明
Level 3 (探索):  用户主动去"扩展工具"页面，看到所有能力列表
Level 4 (高级):  用户想添加自定义 MCP，打开高级配置区域
```

**99% 的小白用户停留在 Level 0-1，这是设计成功的标志。**

### 原则 3: 用"能力"替代"工具"

对外文案中:
- 不说"MCP"，说"AI 能力"或"扩展能力"
- 不说"工具"，说"帮你做这件事"
- 不说"安装 MCP Server"，说"开启能力"
- 不说"MCP 运行中"，说"就绪"

### 原则 4: 失败时用户应该感知不到

```
MCP 崩了:
  错误做法: 弹窗 "MCP Server mcp-server-filesystem 已停止运行 (exit code 1)"
  正确做法: AI 静默切换到 Skill 降级方案，用户看到正常结果
```

---

## 三、竞品调研结论与最佳实践

### 3.1 竞品对比分析

| 产品 | MCP/插件交互方式 | 小白友好度 | 借鉴点 | 反面教材 |
|------|-----------------|-----------|--------|---------|
| **Claude Desktop** | 一键安装 .mcpb 桌面扩展包；Settings → Extensions → Browse | 7/10 | 一键安装、策展目录、企业管理 | 早期需手动编辑 JSON 配置文件 |
| **Cherry Studio** | 内置 MCP 配置面板；需手动添加 server | 5/10 | 支持 npx/docker/http 三种模式 | 需要用户理解 MCP 概念才能配置 |
| **Cursor** | Settings → MCP → 添加 server；工具调用需用户审批 | 6/10 | 工具审批白名单机制 | 审批 UI 卡 bug、allowlist 失效 |
| **VSCode 扩展市场** | 侧边栏 Extensions → 搜索 → 安装 | 9/10 | 搜索/分类/推荐/一键安装/星级评分 | 对小白来说扩展太多、选择困难 |
| **飞书应用市场** | 管理员统一安装 → 用户直接用 | 8/10 | 管理员预装、用户无感、权限管控 | 过度依赖管理员、自助能力弱 |

### 3.2 关键发现

**Claude Desktop 的演进方向值得关注**:
- 2024-11 发布时：需要手动编辑 `claude_desktop_config.json`（开发者才能用）
- 2025-05 开始：支持 Web Integrations（远程 MCP，更简单）
- 2026 现在：`.mcpb` 桌面扩展包 + Browse 目录 = **一键安装**
- 演进轨迹：手动配置 → 策展目录 → 一键安装 → 对我们的启示：**直接跳到终态**

**飞书模式最适合中国小白用户**:
- 管理员（= 我们的安装包/Gateway）预装好一切
- 用户打开就能用，不需要自己安装任何东西
- 权限管理在后台，用户不感知
- **这正是我们要做的**: 安装包 = 管理员，用户 = 飞书员工

**Cursor 的教训**:
- 工具审批机制 (Waiting for Approval) 频繁出 bug
- Auto-run 设置经常不生效
- Allowlist 不工作导致每次都要手动批准
- **启示**: 预装 MCP 不应该需要任何审批，直接可用

### 3.3 最佳实践清单（面向中国小白用户）

| # | 实践 | 来源 | 我们的落地方式 |
|---|------|------|-------------|
| 1 | 预装核心能力，开箱即用 | 飞书管理员预装 | 安装包内置 MCP 离线包 |
| 2 | 一键安装，无需理解技术概念 | Claude Desktop .mcpb | 用户永远不接触安装流程 |
| 3 | 用"能力"而非"工具/插件"描述 | 自研（优于所有竞品） | 全文案避免 MCP 字样 |
| 4 | 策展目录替代开放市场 | Claude Desktop Browse | "扩展工具"页展示策展内容 |
| 5 | 失败静默降级，不抛技术错误 | 自研（优于所有竞品） | MCP 崩 → Skill 替补 |
| 6 | 配置在对话流内完成 | 自研（ChatGPT GPTs 有类似思路） | API Key 输入不跳页 |
| 7 | 增量更新完全后台 | VSCode 自动更新扩展 | Gateway 启动时静默同步 |
| 8 | 分层信息架构（小白/高级） | VSCode 设置 UI vs JSON | "扩展工具"页 + 折叠"高级设置" |
| 9 | 示例语句驱动发现 | ChatGPT GPTs "Conversation Starters" | 每个能力卡配"试试说" |
| 10 | 本地化第一（中文友好名、中文描述） | 飞书中文化 | 技术名 → 友好名映射表 |

### 3.4 我们的差异化优势

相比所有竞品，ClawdbotCN 的 MCP 方案有三个独特优势：

1. **完全无感** — Cherry Studio/Cursor 都需要用户打开 MCP 设置页；我们不需要
2. **静默降级** — 所有竞品 MCP 崩了就直接报错；我们 MCP → Skill 双轨热备
3. **离线预装** — Claude Desktop 需联网下载扩展；我们安装包自带，0 网络依赖

---

## 四、场景一: 首次使用 — 无感知初始化

### 4.1 用户视角

```
用户安装完 Clawdbot，第一次打开

Chat 页面显示:
+-------------------------------------------------------------+
|                                                             |
|              欢迎使用 ClawbotCN                               |
|         我可以帮助你完成各种任务                                 |
|                                                             |
|  试着问我:                                                    |
|  +-------------------+  +------------------+                |
|  | 今天天气怎么样      |  | 帮我搜个文件      |                |
|  +-------------------+  +------------------+                |
|  +-------------------+  +------------------+                |
|  | 帮我总结这个网页    |  | 附近有什么餐厅     |                |
|  +-------------------+  +------------------+                |
|                                                             |
+-------------------------------------------------------------+
```

**注意: 没有任何 MCP 相关的提示、Banner、弹窗。**

### 4.2 后台发生了什么

```
安装包已内置:
  mcp/mcp-index.json          <- 预装 MCP 索引
  mcp/packages/*.tgz          <- 预打包的 npm 包

首次启动 Gateway:
  1. 检测 ~/.clawdbot/mcp-install-state.json 不存在
  2. 从 {app}/mcp/ 复制到 ~/.clawdbot/mcp/
  3. 本地离线安装 (npm install from .tgz, 0 网络)
  4. spawn MCP 进程 (filesystem, sqlite, fetch, time, sequential-thinking)
  5. 写入 mcp-install-state.json
  6. 全部完成，约 5-8 秒

用户此时还在看欢迎页面或输入第一句话，完全无感知。
```

### 4.3 与现有 Welcome Discovery 的关系

现有 `welcome-discovery.ts` 在首次进入时扫描用户设备能力，有 4 个阶段:
- `idle` → `scanning` → `done` / `error`
- 扫描过程显示进度条 + 阶段文案（"检测 CLI 工具..." → "生成个性化建议..."）

MCP 初始化应融入此流程：

```
现有扫描阶段 (capability-detect.ts):
  检测 CLI 工具...     (20%)    <- 现有
  检测已配置渠道...    (40%)    <- 现有
  检测浏览器...        (60%)    <- 现有
  扫描工作空间...      (80%)    <- 现有
  生成个性化建议...    (100%)   <- 现有

新增 (对用户不可见):
  ↑ 在 scanning 阶段，后台并行初始化 MCP 进程
  ↑ 不新增进度阶段、不新增文案、用户完全无感

扫描完成 (done 状态) 的能力卡片中:
  如果 MCP 工具就绪，对应能力状态显示为 "ready" (绿色)
  例如: "文件操作 ✓ 就绪" — 这个 ✓ 来自 MCP filesystem 已启动
  用户不知道这是 MCP 提供的，只知道 "AI 会帮我操作文件"

  如果 MCP 需要 API Key，显示为 "needs_config" (黄色)
  例如: "网络搜索 ⚙ 需配置" + [配置] 按钮
  用户不知道这是 MCP，只知道 "搜索功能需要配一下"
```

### 4.4 技术实现要点

```typescript
// 在 capability-detect.ts 的 scanning 阶段并行触发 MCP 初始化
// 不修改 DetectedCapability 类型，复用现有 status 枚举:
//   "ready" | "needs_config" | "can_install"

// MCP 能力映射到 DetectedCapability:
const mcpCapabilities: DetectedCapability[] = [
  {
    icon: "📁",
    text: t("discovery.capability.filesystem"),  // "文件操作"
    status: mcpState.filesystem === "running" ? "ready" : "can_install",
    prompt: "帮我看看桌面有什么文件",
  },
  {
    icon: "🌤",
    text: t("discovery.capability.weather"),     // "天气查询"
    status: mcpState.weather === "running" ? "ready" : "needs_config",
    prompt: "今天北京天气怎么样",
  },
  // ...
];
```

---

## 五、场景二: 对话中 — AI 自动调用 MCP

### 5.1 用户说了一句话

```
用户: "今天北京天气怎么样"
```

### 5.2 Chat 中的展示 (Level 0 - 最简模式)

```
+-------------------------------------------------------------+
|  [用户]  今天北京天气怎么样                                     |
|                                                             |
|  [AI]    北京今天晴，气温 5°C ~ 15°C，北风 3 级。              |
|          建议穿厚外套，紫外线较强注意防晒。                       |
+-------------------------------------------------------------+
```

**用户看到的就是一个正常的问答。** 不显示任何"工具调用"信息。

### 5.3 Chat 中的展示 (Level 1 - 轻微感知)

对于**非即时返回**的调用（需要几秒等待），在 AI 思考过程中显示：

```
+-------------------------------------------------------------+
|  [用户]  今天北京天气怎么样                                     |
|                                                             |
|  [AI]    正在查询天气...                                       |
|          ~~~~~~~~~~~                                         |
|          (1-2秒后替换为结果)                                    |
|                                                             |
|          北京今天晴，气温 5°C ~ 15°C，北风 3 级。              |
|          建议穿厚外套，紫外线较强注意防晒。                       |
+-------------------------------------------------------------+
```

"正在查询天气..." 这行文字:
- 字号: 12px
- 颜色: `var(--muted-strong)` 即 `#6b7d91`（比正文浅很多）
- 结果返回后: 替换为正式回答，这行消失
- **不显示**: MCP Server 名称、工具名称、JSON 参数

### 5.4 Chat 中的展示 (Level 2 - 可交互感知)

如果用户想了解 AI 怎么做到的，在工具调用行旁边放一个极其轻量的可展开指示器:

```
+-------------------------------------------------------------+
|  [AI]    北京今天晴，气温 5°C ~ 15°C，北风 3 级。              |
|                                                             |
|       [已使用: 天气查询 ▸]     <-- 可点击展开                   |
+-------------------------------------------------------------+

点击后展开:
+-------------------------------------------------------------+
|       [已使用: 天气查询 ▾]                                     |
|       +---------------------------------------------------+  |
|       | 能力: 天气查询                                      |  |
|       | 做了什么: 查询了北京的实时天气                         |  |
|       | 耗时: 0.8 秒                                       |  |
|       +---------------------------------------------------+  |
+-------------------------------------------------------------+
```

设计要点:
- 默认折叠，**绝大多数用户永远不会点开**
- 展开内容用**用户语言**，不用技术术语
- 不显示: tool name (`mcp_amap_weather`)、JSON 参数、server ID
- 复用现有 `tool-cards.css` 的卡片样式，但内容大幅简化

### 5.5 与现有 Skills 工具调用卡片的差异

```
现有 Skills 工具调用卡片 (开发者风格, chat.ts 中):
+-----------------------------------------------------+
| [bash] ls -la /Users/Desktop                        |
| exit code: 0                                        |
| output: drwxr-xr-x  5 user  staff  160 Feb  8 ...  |
+-----------------------------------------------------+

MCP 工具调用 (小白风格):
+-----------------------------------------------------+
| 查询了北京的天气                              0.8 秒  |
+-----------------------------------------------------+
```

**实现策略**: 不改现有 tool card，而是根据调用来源区分:
- 来自 MCP 的调用 → 使用简化展示（仅人话描述 + 耗时）
- 来自 Skill/bash 的调用 → 保持现有开发者风格展示

---

## 六、场景三: 需要配置 — 按需引导

### 6.1 什么时候需要配置？

只有一种情况: **某个 MCP 需要 API Key**

```
用户: "帮我搜索一下 Python 教程"
AI:   需要用到搜索能力，但需要先配置一个搜索 API Key

     这不是必须的 — 我也可以用其他方式帮你搜索。
     但如果你配置了，搜索结果会更准确。

     [配置搜索 Key]    [用其他方式搜索]
```

### 6.2 配置流程 — 内嵌在对话中

**不要跳转到设置页面。** 所有配置在 Chat 对话流内完成:

```
用户点击 [配置搜索 Key]

+-------------------------------------------------------------+
|  [AI]    好的，配置搜索 Key 只需要 3 步:                        |
|                                                             |
|          1. 打开百度搜索 API 页面                               |
|             [点击打开] (链接)                                   |
|                                                             |
|          2. 注册并获取 API Key (免费)                           |
|                                                             |
|          3. 把 Key 粘贴到这里:                                 |
|             [________________] [确认]                          |
|                                                             |
|          你的 Key 只保存在你自己电脑上，不会上传到任何地方。        |
+-------------------------------------------------------------+
```

用户粘贴 Key 并确认后:

```
+-------------------------------------------------------------+
|  [AI]    搜索能力已开启!                                       |
|          现在帮你搜索 "Python 教程"...                          |
|                                                             |
|          搜索到以下结果:                                       |
|          1. 菜鸟教程 - Python 基础                             |
|          2. ...                                              |
+-------------------------------------------------------------+
```

### 6.3 设计要点

- **配置在对话流中完成**，不跳转页面（竞品中只有 ChatGPT GPTs 有类似思路，其他全部跳设置页）
- **先降级执行**，不因为缺 Key 而完全拒绝（区别于 Cursor 的 "Waiting for Approval" 阻塞模式）
- **明确免费**，中国用户对付费敏感
- **隐私保证**，Key 只存本地（对标飞书"数据不出企业"的信任策略）
- **配置完立即使用**，不需要重启（区别于 Claude Desktop 早期需完全退出重启）

---

## 七、场景四: 出错了 — 静默降级

### 7.1 MCP 进程崩溃

```
场景: 用户问"帮我看桌面有什么文件"
       此时 filesystem MCP 已崩溃

用户看到:                          后台发生:
                                  1. 检测到 filesystem MCP 不可用
                                  2. 触发自动重启 (尝试 1/3)
                                  3. 同时降级到 Skill 方案
"正在查看你的文件..."              4. 通过 bash + ls 命令获取文件列表
                                  5. 返回结果
"桌面上有以下文件:                  6. 用户完全不知道 MCP 崩了
 - report.pdf
 - photo.jpg
 - ..."
```

**用户永远不会看到:**
- "MCP Server 已停止"
- "正在重启进程..."
- "工具调用失败 (EPIPE)"
- 任何包含 "MCP" 字样的错误

### 7.2 降级策略矩阵

| MCP 能力 | 降级方案 | 用户感知 |
|----------|---------|---------|
| 文件系统 MCP 崩溃 | Skill: 用 bash ls/cat 替代 | 无 (结果可能格式略不同) |
| SQLite MCP 崩溃 | Skill: 用 bash sqlite3 命令 | 无 |
| 天气 MCP 崩溃 | Skill: 用 curl 调 API | 无 |
| 搜索 MCP 崩溃 | Skill: 用 curl + 解析 | 轻微 ("搜索结果可能不太完整") |
| 所有 MCP 全崩 | 纯 Skill 模式 | 轻微 (某些能力暂时受限) |

### 7.3 与竞品的差异

| 竞品 | MCP 崩溃处理 | 我们的做法 |
|------|-------------|-----------|
| **Cursor** | 红色错误："tool call failed"，需用户重试 | 静默降级到 Skill，用户无感 |
| **Cherry Studio** | 弹窗："Server disconnected" | 后台重启 + 降级，0 弹窗 |
| **Claude Desktop** | 错误提示 + 建议检查配置 | MCP→Skill 双轨热备 |

### 7.4 唯一需要告知用户的场景

只有当**降级方案也失败**，且**无法完成用户请求**时:

```
+-------------------------------------------------------------+
|  [AI]    抱歉，这个功能暂时遇到了点问题。                        |
|          我已经在尝试修复，你可以稍后再试。                       |
|                                                             |
|          或者你可以换个方式告诉我你想做什么？                     |
+-------------------------------------------------------------+
```

注意: 不说"MCP 崩了"，说"功能暂时遇到了点问题"。
复用现有 i18n key 风格: `"mcpError.tempIssue"` → `"这个功能暂时遇到了点问题"`

---

## 八、场景五: 好奇心 — 扩展工具管理页

### 8.1 入口设计

这个页面是**给好奇用户准备的**，不是核心流程。

根据现有导航结构 (`navigation.ts`，4 组 Tab)，新增一个 Tab：

```
现有导航 (getTabGroups):
├── 聊天组: chat
├── 控制面板组: overview, free-models, usage, channels, instances, sessions, cron
├── 智能体组: playground, skills, nodes
├── 设置组: config, debug, logs

新增 (在"智能体组"中):
├── 智能体组: playground, skills, extensions, nodes
                                    ^^^^^^^^
                                    新增 Tab
```

侧边栏展示：
```
+-------------------+
|  Agent / 智能体    |
|  +-- Playground   |
|  +-- Skills       |
|  +-- 扩展工具      | <-- 标签名用 t("nav.extensions") → "扩展工具"
|  +-- Nodes        |
+-------------------+
```

### 8.2 页面设计 — "你的 AI 有这些本领"

**核心理念**: 这不是一个管理页面，这是一个**能力展示页面**。
用户来这里是为了"看看 AI 都能做什么"，不是来"管理 MCP 进程"。

```
+---------------------------------------------------------------+
|                                                               |
|  你的 AI 助手有这些本领                                          |
|                                                               |
|  全部已就绪，直接在对话中使用即可                                  |
|                                                               |
|  +--- 文件操作 -------------------------------------------+    |
|  | [绿点] 已就绪                                          |    |
|  |                                                        |    |
|  | 可以帮你:                                               |    |
|  | - 查看电脑上的文件和文件夹                                |    |
|  | - 读取文件内容                                          |    |
|  | - 创建、移动、搜索文件                                    |    |
|  |                                                        |    |
|  | 试试说: "帮我看看桌面有什么文件"                           |    |
|  +--------------------------------------------------------+    |
|                                                               |
|  +--- 数据分析 -------------------------------------------+    |
|  | [绿点] 已就绪                                          |    |
|  |                                                        |    |
|  | 可以帮你:                                               |    |
|  | - 查询和分析数据库                                       |    |
|  | - 执行 SQL 查询                                        |    |
|  | - 导出数据报表                                          |    |
|  |                                                        |    |
|  | 试试说: "分析这个数据库里有什么表"                         |    |
|  +--------------------------------------------------------+    |
|                                                               |
|  +--- 天气查询 -------------------------------------------+    |
|  | [绿点] 已就绪                                          |    |
|  |                                                        |    |
|  | 可以帮你:                                               |    |
|  | - 查询全国各城市的实时天气                                |    |
|  | - 获取天气预报                                          |    |
|  |                                                        |    |
|  | 试试说: "今天北京天气怎么样"                               |    |
|  +--------------------------------------------------------+    |
|                                                               |
|  +--- 网络搜索 -------------------------------------------+    |
|  | [黄点] 需要配置                                         |    |
|  |                                                        |    |
|  | 可以帮你:                                               |    |
|  | - 搜索互联网上的最新信息                                  |    |
|  |                                                        |    |
|  | 需要: 百度搜索 API Key (免费)                            |    |
|  |                                                        |    |
|  | [配置并开启]                                             |    |
|  +--------------------------------------------------------+    |
|                                                               |
|                                                               |
|  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈        |
|  [高级设置]    <-- 折叠区域，默认隐藏                            |
|  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈        |
+---------------------------------------------------------------+
```

### 8.3 高级设置 (折叠区域 — 开发者才会看)

点击 [高级设置] 展开:

```
+---------------------------------------------------------------+
|  高级设置                                          [收起]       |
|                                                               |
|  [添加自定义扩展]                                               |
|                                                               |
|  运行状态:                                                     |
|  +----------------------------------------------------------+ |
|  | 名称              状态      内存    工具数    操作           | |
|  | 文件系统           运行中    35MB    11      [重启] [禁用]  | |
|  | SQLite 数据库      运行中    28MB    6       [重启] [禁用]  | |
|  | 网页抓取           运行中    22MB    3       [重启] [禁用]  | |
|  | 天气查询           运行中    18MB    2       [重启] [禁用]  | |
|  | 逻辑思维           运行中    15MB    1       [重启] [禁用]  | |
|  +----------------------------------------------------------+ |
|                                                               |
|  系统信息:                                                     |
|  总内存占用: 118MB / 200MB 上限                                 |
|  最后同步: 2 小时前 (版本 42)                                   |
|  [手动检查更新]                                                 |
+---------------------------------------------------------------+
```

### 8.4 关键设计决策

| 决策 | 选择 | 理由 | 竞品对比 |
|------|------|------|---------|
| 页面标题 | "你的 AI 助手有这些本领" | 用户视角，不是技术视角 | VSCode 用"Extensions"（技术化）|
| 卡片展示什么 | "可以帮你做什么" + 示例语句 | 功能导向，不是技术导向 | Cherry Studio 展示 server 配置（技术化）|
| 状态表述 | "已就绪" / "需要配置" | 不说"运行中"/"已停止" | Cursor 显示 "running"/"error" |
| 版本号/PID/内存 | 藏在"高级设置"里 | 小白不需要看 | Claude Desktop 完全不显示 |
| 卡片可操作按钮 | 只有"需要配置"的才显示按钮 | 已就绪的不需要任何操作 | VSCode 每个扩展都有 Disable/Uninstall |
| 示例语句 | 可点击直接跳转 Chat 发送 | 降低使用门槛到零 | ChatGPT GPTs 的 "Conversation Starters" |

---

## 九、场景六: 增量更新 — 完全后台

### 9.1 更新流程

```
Gateway 启动 5 秒后:
  -> 静默调用 GET /api/mcp/sync?sinceVersion=42
  -> 服务端返回 2 个新增 + 1 个更新
  -> 后台下载并安装
  -> 更新本地索引
  -> 新 MCP 进程启动
  -> 完成

用户感知: 无
```

### 9.2 什么时候告知用户？

**几乎不需要。** 唯一例外:

```
场景: 服务端因安全漏洞移除了一个用户正在使用的 MCP

用户下次使用相关功能时:
+-------------------------------------------------------------+
|  [AI]    抱歉，之前用的某个工具因为安全升级已更新。               |
|          我已经用新版本帮你完成了请求。                          |
+-------------------------------------------------------------+
```

### 9.3 "扩展工具"页面的更新感知

如果用户恰好打开了"扩展工具"页面:

```
页面顶部出现轻量提示条 (使用 var(--ok) 颜色，自动消失):
+---------------------------------------------------------------+
| [绿色条] 新增了 2 个能力: PDF 阅读、邮件管理            [查看]     |
+---------------------------------------------------------------+
```

点击 [查看] 滚动到新增的能力卡片，卡片带一个 "NEW" 小标签 (7 天后自动消失)。

样式复用现有 Skills batch 的成功提示条模式（`skills-batch-complete.ts` 中的绿色统计栏风格）。

---

## 十、Chat 页面中的 MCP 可视化

### 10.1 工具调用的视觉层级

复用现有 `tool-cards.css` 的组件模式，但**大幅简化**:

```
当前 Skills 工具调用卡片 (开发者风格):
+-----------------------------------------------------+
| [bash] ls -la /Users/Desktop                        |
| exit code: 0                                        |
| output: drwxr-xr-x  5 user  staff  160 Feb  8 ...  |
+-----------------------------------------------------+

MCP 工具调用 (小白风格):
+-----------------------------------------------------+
| 查询了北京的天气                              0.8 秒  |
+-----------------------------------------------------+
```

**差异**:
- 不显示工具 ID (`mcp_amap_weather`)
- 不显示 JSON 参数
- 不显示原始返回值
- 只用一句人话描述"做了什么"
- 右侧显示耗时 (给用户心理预期管理)

### 10.2 等待状态

```
AI 正在调用 MCP 工具时:

+-----------------------------------------------------+
| [转圈动画] 正在查询天气...                              |
+-----------------------------------------------------+
```

动画规格 (复用现有 CSS 变量和动画):
- 加载色: `var(--accent-2)` 即 `#20d5bc`
- 字号: 12px
- 颜色: `var(--muted-strong)` 即 `#6b7d91`
- 动画: 复用现有 `@keyframes` 模式（如 batch progress 中的 `batchShimmer`）
- 超过 5 秒: 切换文案为 `t("mcpChat.slowHint")` → "稍等一下，正在努力获取中..."
- 这与现有 chat.ts 的分阶段等待指示器 (0-10s/10-30s/30-90s) 保持一致

### 10.3 多工具串联调用

当 AI 在一次回答中调用多个 MCP 工具时:

```
用户: "帮我看看桌面有什么 PDF，然后总结第一个"

AI 回答中:
+-----------------------------------------------------+
| 查找了桌面上的文件                            0.3 秒   |
| 读取了 report.pdf 的内容                      1.2 秒   |
+-----------------------------------------------------+
| (折叠状态，点击可展开每一步的细节)                       |

下方是 AI 的正式回答:
"你桌面上有 3 个 PDF 文件，第一个是 report.pdf，
 内容摘要如下: ..."
```

---

## 十一、文案设计规范

### 11.1 中文文案对照表

| 场景 | 技术说法 (不用) | 小白说法 (用这个) |
|------|----------------|------------------|
| MCP 页面标题 | MCP 管理 | 扩展工具 |
| 页面副标题 | MCP Server 列表 | 你的 AI 助手有这些本领 |
| 工具状态 | running | 已就绪 |
| 工具状态 | stopped | 已暂停 |
| 工具状态 | error | 暂时不可用 |
| 工具状态 | circuit_open | 正在修复 |
| 安装 MCP | npm install | 开启能力 |
| 卸载 MCP | uninstall | 关闭能力 |
| 重启 MCP | restart process | 刷新 |
| 需要 API Key | requiresApiKey=true | 需要配置 |
| 同步更新 | sync from server | 检查新能力 |
| 工具调用 | tools/call | 正在帮你... |
| 调用成功 | result: success | (不显示，直接给结果) |
| 调用失败 | error: ETIMEDOUT | 这个功能暂时不太顺畅 |
| 进程 PID | PID: 12345 | (不显示) |
| 内存占用 | 35MB RSS | (高级设置中才显示) |

### 11.2 "试试说" 示例语句模板

每个能力卡片都配一句"试试说"，格式统一:

```
文件操作:   "帮我看看桌面有什么文件"
数据分析:   "分析这个数据库里有什么表"
天气查询:   "今天北京天气怎么样"
网页抓取:   "帮我总结一下这个网页的内容"
网络搜索:   "搜索 Python 入门教程"
地图导航:   "从公司到家怎么走最快"
时间日期:   "现在纽约几点了"
逻辑思维:   "帮我分析一下这个问题的利弊"
```

规则:
- 用日常口语，不用书面语
- 用具体场景，不用抽象描述
- 可直接点击发送到 Chat（复用 `welcome-discovery.ts` 中的 `onSuggestionClick(prompt)` 机制）

### 11.3 MCP 友好名映射表

复用现有 Skills 的友好名映射模式 (`skills-batch-confirm.ts` 中的 `friendlyNames`):

```typescript
// 技术名 → 友好名
const mcpFriendlyNames: Record<string, string> = {
  "mcp-server-filesystem": "文件操作",
  "mcp-server-sqlite":    "数据分析",
  "mcp-server-fetch":     "网页抓取",
  "mcp-server-time":      "时间日期",
  "mcp-server-sequential-thinking": "逻辑思维",
  "mcp-server-amap":      "天气查询",
  "mcp-server-brave-search": "网络搜索",
};
```

### 11.4 i18n 新增翻译键

```typescript
// ui/src/ui/i18n/locales/zh-CN.ts 新增
// 遵循现有命名空间约定: "section.subsection.key"

// 导航
"nav.extensions": "扩展工具",

// 扩展工具页面
"extensions.title": "扩展工具",
"extensions.subtitle": "你的 AI 助手有这些本领",
"extensions.allReady": "全部已就绪，直接在对话中使用即可",
"extensions.status.ready": "已就绪",
"extensions.status.needsConfig": "需要配置",
"extensions.status.paused": "已暂停",
"extensions.status.fixing": "正在修复",
"extensions.canHelp": "可以帮你:",
"extensions.trySay": "试试说:",
"extensions.configAndEnable": "配置并开启",
"extensions.newBadge": "新",

// 高级设置
"extensions.advanced": "高级设置",
"extensions.advanced.addCustom": "添加自定义扩展",
"extensions.advanced.status": "运行状态",
"extensions.advanced.memory": "总内存占用",
"extensions.advanced.lastSync": "最后同步",
"extensions.advanced.checkUpdate": "手动检查更新",

// Chat 中的工具调用
"mcpChat.querying": "正在查询...",
"mcpChat.reading": "正在读取...",
"mcpChat.searching": "正在搜索...",
"mcpChat.analyzing": "正在分析...",
"mcpChat.writing": "正在写入...",
"mcpChat.slowHint": "稍等一下，正在努力获取中...",
"mcpChat.used": "已使用:",

// 配置流程 (Chat 内嵌)
"mcpConfig.needKey": "需要先配置一下才能使用",
"mcpConfig.notRequired": "这不是必须的",
"mcpConfig.alternative": "用其他方式",
"mcpConfig.keyLocal": "你的 Key 只保存在你自己电脑上，不会上传到任何地方",
"mcpConfig.enabled": "已开启!",
"mcpConfig.free": "(免费)",

// 更新提示
"mcpUpdate.newAbilities": "新增了 {{count}} 个能力",
"mcpUpdate.view": "查看",

// 错误降级
"mcpError.tempIssue": "这个功能暂时遇到了点问题",
"mcpError.tryingAlternative": "正在换个方式帮你...",
"mcpError.tryLater": "你可以稍后再试",

// 能力名称
"mcpCapability.filesystem": "文件操作",
"mcpCapability.sqlite": "数据分析",
"mcpCapability.fetch": "网页抓取",
"mcpCapability.time": "时间日期",
"mcpCapability.thinking": "逻辑思维",
"mcpCapability.weather": "天气查询",
"mcpCapability.search": "网络搜索",
"mcpCapability.maps": "地图导航",
```

---

## 十二、与现有 Skills 流程的关系

### 12.1 Skills Batch Banner 是否还需要？

**需要，但逻辑独立。**

```
用户视角:
  Skills Batch Banner: "X 个 AI 技能待配置" -> 安装 CLI 依赖 (brew/npm/go 包)
  MCP:                  (无 Banner，后台自动) -> 安装 MCP Server 进程

这是两个独立系统:
  - Skills: 安装底层 CLI 工具 (git, jq, ffmpeg 等) + 注入知识文档
  - MCP:    安装标准化的工具 Server (filesystem, sqlite 等) + 提供 API

它们互补:
  - Skill "天气查询" 告诉 AI: "用 curl 调高德 API"
  - MCP "天气查询" 给 AI: 一个直接调用的 weather 工具
  - Agent 优先用 MCP (更可靠)，MCP 崩了降级到 Skill 方案
```

### 12.2 现有 Skills Batch 5 屏流程对 MCP 的启示

现有 Skills batch 安装有一套完善的 5 屏流程:
1. **Banner** (`skills-batch-banner.ts`) — 非阻塞通知
2. **Confirm** (`skills-batch-confirm.ts`) — 分层选择（核心/推荐/可选）
3. **Progress** (`skills-batch-progress.ts`) — 实时下载进度
4. **Result** (`skills-batch-result.ts`) — 成功/失败分组展示
5. **Complete** (`skills-batch-complete.ts`) — 庆祝 + 引导使用

**MCP 不需要这 5 屏中的任何一屏**，因为:
- Banner: MCP 预装，不需要提示
- Confirm: 没有选择，全部自动安装
- Progress: 离线安装 5 秒完成，不需要进度条
- Result/Complete: 无安装动作，无需展示结果

但我们可以**复用其组件模式**:
- 能力卡片的视觉风格 → 用在"扩展工具"页
- 统计栏的 3-cell 布局 → 用在高级设置的运行状态
- "试试这样说"的示例语句 → 用在能力卡片底部
- 成功/失败的颜色编码 (green/red pills) → 用在状态指示器

### 12.3 在 Skills 完成页中提及 MCP

现有 `skills-batch-complete.ts` 的"试试这样说"区域，可以自然地包含 MCP 能力:

```
试试这样说:
  "今天天气怎么样？" — 天气查询        <- 可能走 MCP 也可能走 Skill
  "帮我总结这个网页" — 网页摘要        <- 同上
  "搜索附近的咖啡店" — 地点搜索        <- 同上
```

用户不需要知道背后是 Skill 还是 MCP。

---

## 十三、组件级实现指引

### 13.1 复用现有设计系统

基于源码调研，以下是实现时应复用的现有资源:

**CSS 变量** (from `base.css`):
```css
/* 状态颜色 */
--ok: #34d399;        /* 已就绪 - 绿色 */
--warn: #fbbf24;      /* 需配置 - 黄色 */
--danger: #f87171;    /* 不可用 - 红色 */
--info: #60a5fa;      /* 信息 - 蓝色 */
--accent-2: #20d5bc;  /* 加载中 - 青色 */

/* 卡片 */
--card: (dark) #1c242e / (light) #ffffff;
--border: rgba(255,255,255,0.06);
--radius-lg: 12px;
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);

/* 动画 */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--duration-normal: 200ms;
```

**组件类** (from `components.css`):
```css
.card          /* 标准卡片容器 */
.stat          /* 统计数字单元格 */
.stat-value    /* 统计数字样式 */
.stat-value.ok /* 绿色数字 */
```

**状态 Pills** (from `skills-batch-*.ts` 内联样式):
```css
/* 绿色状态 pill */
background: rgba(0,230,118,0.06);
border: 1px solid rgba(0,230,118,0.1);
color: #00e676;

/* 黄色状态 pill */
background: rgba(255,171,0,0.15);
border: 1px solid rgba(255,171,0,0.2);
color: #ffab00;
```

### 13.2 新增组件结构

```
ui/src/ui/views/
  ├── extensions-page.ts        <- 扩展工具页面（能力展示 + 高级设置）
  ├── extensions-card.ts        <- 单个能力卡片组件
  └── mcp-tool-card.ts          <- Chat 中的 MCP 工具调用卡片（简化版）

ui/src/ui/controllers/
  └── mcp-lifecycle.ts          <- MCP 生命周期管理（初始化/降级/重启）
```

### 13.3 组件 Props 设计

```typescript
// extensions-page.ts
export type ExtensionsPageProps = {
  capabilities: McpCapability[];
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  onConfigClick: (capabilityId: string) => void;
  onTrySay: (prompt: string) => void;  // 跳转 Chat 并填入 prompt
  onRestart: (serverId: string) => void;
  onDisable: (serverId: string) => void;
  onCheckUpdate: () => void;
  updateNotice?: { count: number; names: string[] } | null;
};

export type McpCapability = {
  id: string;                    // "filesystem", "sqlite", etc.
  friendlyName: string;          // t("mcpCapability.filesystem") → "文件操作"
  status: "ready" | "needs_config" | "paused" | "fixing";
  description: string[];         // ["查看电脑上的文件", "读取文件内容", ...]
  examplePrompt: string;         // "帮我看看桌面有什么文件"
  configNeeded?: string;         // "百度搜索 API Key (免费)"
  isNew?: boolean;               // 7 天内新增
};

// mcp-tool-card.ts (Chat 内简化工具卡片)
export type McpToolCardProps = {
  description: string;           // "查询了北京的天气" (人话)
  durationMs: number;            // 800
  status: "loading" | "done" | "error";
  expanded: boolean;
  onToggle: () => void;
  detail?: {                     // 展开后的细节 (Level 2)
    capabilityName: string;      // "天气查询"
    action: string;              // "查询了北京的实时天气"
  };
};
```

### 13.4 状态管理扩展

在现有 `AppViewState` 中新增:

```typescript
// app-view-state.ts 扩展
export type AppViewState = {
  // ... 现有字段 ...

  // MCP 状态 (新增)
  mcpCapabilities: McpCapability[];
  mcpAdvancedOpen: boolean;
  mcpUpdateNotice: { count: number; names: string[] } | null;
  mcpProcesses: McpProcessInfo[];  // 高级设置中的进程列表
};

export type McpProcessInfo = {
  id: string;
  friendlyName: string;
  status: "running" | "stopped" | "error";
  memoryMB: number;
  toolCount: number;
};
```

### 13.5 路由扩展

在 `navigation.ts` 中:

```typescript
// Tab 类型扩展
export type Tab =
  | "overview" | "free-models" | "usage" | "channels" | "instances"
  | "sessions" | "cron" | "playground" | "skills" | "extensions" // <- 新增
  | "nodes" | "chat" | "config" | "debug" | "logs" | "docs";

// Tab 分组更新
export function getTabGroups() {
  return [
    { label: t("nav.chat"), tabs: ["chat"] },
    { label: t("nav.control"), tabs: ["overview", "free-models", "usage", "channels", "instances", "sessions", "cron"] },
    { label: t("nav.agent"), tabs: ["playground", "skills", "extensions", "nodes"] },
    //                                                         ^^^^^^^^^^^^ 新增
    { label: t("nav.settings"), tabs: ["config", "debug", "logs"] },
  ];
}
```

---

## 十四、反模式清单 — 绝对不要做的事

| # | 反模式 | 为什么不行 | 竞品中的反例 |
|---|--------|-----------|-------------|
| 1 | 首次打开弹窗"发现 X 个 MCP 可安装" | 用户不知道 MCP 是什么，只会恐慌关闭 | — |
| 2 | 在 Chat 中显示 `mcp_amap_weather({"city":"beijing"})` | 这是给开发者看的，不是给小白看的 | Cursor 的 tool call 展示 |
| 3 | "MCP Server 启动失败 (exit code 1)" | 用户会以为系统坏了 | Cherry Studio 的 error dialog |
| 4 | 让用户在 MCP 页面"选择要安装的 MCP" | 这是应用商店模式，我们不是应用商店 | Claude Desktop 早期策展目录 |
| 5 | 安装需要用户确认 | 预装 MCP 应该自动完成，不问用户 | Cursor 的 "Waiting for Approval" |
| 6 | 在侧边栏显示 MCP 角标/红点/数字 | 制造不必要的焦虑 | — |
| 7 | MCP 更新时弹通知 | 更新应该完全后台完成 | — |
| 8 | 显示 MCP Server 的 npm 包名 | `@anthropic/mcp-server-filesystem` 对小白没有意义 | Cherry Studio 配置页 |
| 9 | 让用户编辑 JSON 配置文件 | 这是 Claude Desktop 早期的做法，不适合小白 | Claude Desktop 2024 版 |
| 10 | MCP 页面默认显示运行状态表格 | 进程管理是开发者关心的，不是用户关心的 | — |
| 11 | 把 MCP 页面做成"MCP 商店" | 我们不是商店，我们是预装能力 | VSCode 扩展市场 (选择过多) |
| 12 | MCP 更新需要用户手动触发 | 应该自动增量同步 | — |
| 13 | 工具审批每次弹窗确认 | 严重打断对话流 | Cursor 的 tool approval bug |

---

## 十五、完整用户旅程地图

```
时间线 ───────────────────────────────────────────────────────→

Day 0: 安装
  用户: 下载安装包 → 安装 → 打开
  后台: 安装包释放 → 预装 MCP 包就位
  感知: 无 MCP 相关信息

Day 0: 首次打开
  用户: 看到欢迎页 → 能力扫描 (welcome-discovery) → "开始使用"
  后台: Welcome Discovery 扫描 + MCP 初始化并行
  感知: 扫描结果中看到"文件操作 ✓ 就绪"等 (不知道这是 MCP)

Day 0: 第一次对话
  用户: "今天天气怎么样"
  后台: Agent 发现 mcp_amap_weather → 调用 → 返回
  感知: "北京今天晴..." (Aha! AI 真的能查天气!)

Day 1-3: 日常使用
  用户: 各种对话 → AI 自动使用各种 MCP 工具
  后台: MCP 工具静默工作，偶尔重启
  感知: "这个 AI 好像什么都能做"

Day 3: 遇到需要 Key 的功能
  用户: "帮我搜索 xxx"
  后台: 搜索 MCP 需要 API Key
  感知: Chat 中引导配置 Key → 完成 → 搜索成功

Day 7: 好奇探索 (可选)
  用户: 点击侧边栏"扩展工具"
  感知: "原来有这些能力在帮我" → 看看 → 关掉 → 继续聊天

Day 14: 自动更新
  后台: 增量同步 → 新增 2 个能力 → 安装完成
  感知: 无 (下次用到时自然就能用)

Day 30: 稳定使用
  用户: 习惯了 AI 能帮自己做各种事
  感知: 从不知道 MCP 这个词，也不需要知道
```

---

## 附录 A: 与 PRD 的对应关系

本交互设计文档对应 `docs/prd-mcp-integration.md` 中的以下章节:

| PRD 章节 | 本文档对应 |
|---------|-----------|
| 第十二章 UI/UX 交互设计 | 本文档全部 (更详细的交互方案) |
| US-01 小白首次使用 | 场景一 + 场景二 |
| US-02 自动增量更新 | 场景六 |
| US-03 查看管理 MCP | 场景五 |
| US-04 自定义 MCP | 场景五高级设置区 |
| US-05 调用失败降级 | 场景四 |

## 附录 B: 竞品调研来源

- Claude Desktop Extensions: https://www.anthropic.com/engineering/desktop-extensions
- Claude Desktop MCP Setup: https://support.claude.com/en/articles/10949351
- Cherry Studio MCP 配置: https://docs.cherry-ai.com/advanced-basic/mcp/buildin
- Cursor MCP 文档: https://docs.cursor.com/en/context/mcp
- VSCode Extensions Marketplace: https://code.visualstudio.com/docs/configure/extensions/extension-marketplace
- Cursor Tool Approval Bug: https://forum.cursor.com/t/mcp-tool-stuck-on-waiting-for-approval/150574

## 附录 C: 与 uiux-interaction-design.md 的关系

本文档是 `docs/uiux-interaction-design.md`（全局 UI/UX 重设计方案）的 **MCP 专项子文档**。

两者的关系:
- `uiux-interaction-design.md`: 覆盖所有页面的通用交互设计（导航、概览、聊天、配置、渠道等）
- `mcp-ux-design-beginner.md` (本文档): 专注 MCP 能力如何**无感集成**到各页面

关键衔接点:
| 全局文档章节 | 本文档对应 |
|------------|-----------|
| 2.1 导航结构重构 | 13.5 路由扩展 (新增 extensions Tab) |
| 3.3 功能发现引导 | 4.3 与 Welcome Discovery 的融合 |
| 4.2 聊天页 | 第十章 Chat 中的 MCP 可视化 |
| 4.3 技能页 | 第十二章 与现有 Skills 流程的关系 |
| 5 i18n 修复清单 | 11.4 MCP 相关 i18n 新增键 |

---

> **设计总结**
>
> MCP 对小白用户来说不是一个"功能"，而是 AI 能力的**隐形基础设施**。
> 用户唯一需要感知到的是: "我的 AI 助手变得更强了"。
> 如何变强的？不需要知道。谁让它变强的？不需要知道。MCP 是什么？不需要知道。
>
> **一句话总结: 最好的 MCP 交互就是没有 MCP 交互。**
>
> ---
>
> 文档版本: v1.0
> 最后更新: 2026-02-08
> 基于源码: `ui/src/ui/` 全部 UI 组件、`src/gateway/` 网关模块、i18n locale 文件
> 配套文档: `docs/uiux-interaction-design.md`（全局 UI/UX 方案）、`docs/prd-mcp-integration.md`（PRD）
