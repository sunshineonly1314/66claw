---
name: skillcraft
name_zh: 技能工坊
description: 创建、设计并打包 Clawdbot skills。当用户要求“为 X 制作/构建/打造一个 skill”或提取临时功能（例如：“将我的脚本/agent 指令/库转化为一个 skill”）时使用。应用 Clawdbot 特有的集成关注点（工具调用、记忆、消息路由等），构建可复用的 skills，以实现组合式开发。
description_zh: 创建、设计并打包 Clawdbot skills。当用户要求“为 X 制作/构建/打造一个 skill”或提取临时功能（例如：“将我的脚本/agent 指令/库转化为一个 skill”）时使用。应用 Clawdbot 特有的集成关注点（工具调用、记忆、消息路由等），构建可复用的 skills，以实现组合式开发。
metadata: {"clawdbot":{"emoji":"🧶"}}
---
# Skillcraft — Clawdbot Skill 创建器

一种有明确立场、面向 AI 原生的设计指南，专用于 Clawdbot skills。聚焦于 **Clawdbot 特有的集成模式** —— 消息路由、定时调度（cron）、记忆持久化、频道格式化 —— 而非通用编程建议。

**前提假设：** agent 熟悉代码编写、项目结构组织及错误处理。本 skill 教授的是 *Clawdbot 特有的* 关注点。

## 先决条件

**请先加载 `clawddocs`（或其等效 skill）。** 本 skill 依赖 Clawdbot 文档获取权威的功能细节。clawddocs skill 提供以下能力：

- 文档分类导航（参见下方分类列表）
- 用于查找特定文档的搜索脚本
- 常见模式的配置代码片段

**文档分类**（通过 clawddocs 获取）：

| 分类 | 路径 | 用途 |
| -------- | ---- | ------- |
| 网关与配置 | `/gateway/` | 配置、安全、健康检查 |
| 工具 | `/tools/` | Skills、浏览器、bash、subagents |
| 自动化 | `/automation/` | 定时任务（cron）、Webhook、轮询 |
| 概念 | `/concepts/` | 会话（sessions）、模型（models）、队列（queues）、流式传输（streaming） |
| 提供商 | `/providers/` | Discord、Telegram、WhatsApp 等 |

当本 skill 提及“查阅文档”时，请使用 clawddocs 获取对应文档。

## 核心理念

**Skills 是 Clawdbot 实现自我扩展的方式。** 它们能突破上下文长度限制，可干净地组合，并可通过 ClawdHub 共享。

**大多数优秀的 skills 最初都源于零散的笔记，之后才被正式化。** 本 skill 正是为此类正式化过程提供一套协议——将“记得做 X”这一模糊提醒，转化为可组合、可共享的实体。

---

## 设计流程

请按顺序执行以下阶段。每个阶段产出的成果将作为下一阶段的输入。

**两种入口模式：**

- **新建 skill：** 从第 1 阶段开始  
- **提取已有功能：** 从第 0 阶段开始  

---

### 第 0 阶段：清点（仅适用于提取场景）

**若从零开始构建新 skill，请跳过本阶段。**

当已有功能尚未被打包为 skill 时，使用本阶段。常见来源包括：

- 存在于 `<workspace>/scripts/` 中、但未归属任何 skill 的脚本  
- 埋藏在 TOOLS.md 或 AGENTS.md 中的指令  
- 在多轮对话中反复出现的模式  
- 应被正式化的“记得做 X”类笔记  

**收集相关产物：**

请思考并回答以下问题：

- **它位于何处？**（脚本、TOOLS.md 的某节、记忆笔记、对话模式）  
- **它的功能是什么？**（描述该能力）  
- **当前如何触发？**（手动请求、心跳检查、临时触发）  
- **它使用了哪些 Clawdbot 功能？**（exec、cron、message、memory 等）  

示例清点清单：

```
- scripts/mail/check.py — fetches and processes emails
- TOOLS.md ## Mail Rules — documents the mail command syntax  
- HEARTBEAT.md — includes "run mail heartbeat" instruction
- mail-rules.yaml — configuration file
```

**评估当前状态：**

- **哪些部分运行良好？**（予以保留）  
- **哪些部分脆弱或不清晰？**（加以改进）  
- **缺失了什么？**（予以补充）  
- **哪些部分过度设计？**（予以简化）  

**输出：** 带评估备注的现有产物清单。随后进入第 1 阶段。

---

### 第 1 阶段：问题理解

**目标：** 明确、具体地厘清该 skill 的功能及其适用场景。

与用户共同梳理以下问题：

1. **该 skill 的作用是什么？**（一句话概括）

2. **应在何时加载该 skill？**  
   - 用户可能说什么？（列举 3–5 个典型短语）  
   - 哪些任务中途需求会导向此 skill？（例如：“需要天气数据”、“需要发送一条消息”）  
   - 是否存在定时/周期性触发机制？（如心跳检查、cron）

3. **成功的表现是什么？** 对每个示例短语，明确其预期结果。

*若为提取场景：* 须基于实际使用情况推导，而非仅凭假设。若用户希望泛化问题，亦可接受。

**输出：** 包含触发示例与成功标准的问题陈述。

---

### 第 2 阶段：能力发现

**目标：** 理解该 skill 所需交互的各类能力。

#### 泛化性（Generalisability）

向用户提问：**该 skill 是专为您的环境定制，还是应适配任意 Clawdbot 实例？**

| 选项 | 影响 |
|--------|--------------|
| **通用型（Universal）** | 使用泛化路径（`<workspace>/`），不假设已安装的工具，极少引用用户特定配置，适合发布至 ClawdHub |
| **专用型（Particular）** | 可引用特定本地路径、skills、工具、TOOLS.md 条目；深度适配用户工作流 |

该选择将影响大量下游决策，请尽早确认。

*若为提取场景：* 还需决定哪些内容保留在 workspace（用户配置、状态），哪些移入 skill（脚本、指令、引用）。

#### Skill 协同搜索（仅限专用型）

**若构建通用型 skill，请跳过本节。**

在为特定环境构建时，应充分利用 workspace 中已有的能力：

1. **扫描可用的 skills** —— 查阅系统提示词中 `<available_skills>` 所列的 skill 描述  
2. **识别潜在协同项** —— 寻找具备以下特性的 skills：  
   - 可为本 skill 提供数据源（如日历、联系人、位置）  
   - 提供互补能力（如通知、存储、呈现）  
   - 覆盖邻近领域，天然易于集成  
3. **深度阅读高潜力 skills** —— 对每个明显具备协同性的 skill，研读其 SKILL.md，以了解：  
   - 具体能力与调用模式  
   - 可被消费的输出格式  
   - 可共享的状态或配置  
   - 组合或委托的机会  

优先选择依赖已满足且正在活跃使用的 skills。

**示例：** 构建“每日简报”skill？可扫描：日历 skills（事件数据）、天气 skills（预报）、邮件 skills（未读数）、位置 skills（上下文感知内容）。逐一研读，理解如何组合。

**本步骤输出：** 协同 skills 清单，附简要整合说明。

#### 外部依赖

- 是否封装 CLI 工具？是哪一个？是否已安装？基本使用模式是什么？  
- 是否封装 Web API？基础 URL 是什么？认证机制？速率限制？  
- 是否处理本地文件？支持哪些格式？需进行何种转换？

#### Clawdbot 功能

Clawdbot has powerful built-in features with deep semantics and rich configurability. They can be combined in unexpected ways to solve user problems.

**以创造性思维审阅文档**，紧密围绕本 skill 的需求展开。使用 **clawddocs** 进行探索 —— 从 `/concepts/` 和 `/tools/` 分类入手。以元程序员（meta-programmer）视角思考：Clawdbot 的各项功能是可组合的基础构件。一个 skill 可能以单一功能未曾预设的方式，组合 cron 调度、canvas 呈现与 node 摄像头访问。若解决方案需修改配置，请查阅 `/gateway/configuration` 并向用户提出建议。

**值得探索的文档分类：**

| 需求 | 文档分类 | 工具/功能 |
|------|--------------|----------------|
| 发送消息 | `/concepts/messages` | `message` 工具 |
| 定时任务 | `/automation/cron-jobs` | `cron` 工具 |
| 持久化记忆 | `/concepts/` | 记忆系统、状态文件 |
| 后台任务 | `/tools/subagents` | `sessions_spawn` |
| 设备交互 | `/nodes/` | `nodes` 工具（摄像头、屏幕、位置） |
| UI 呈现 | `/tools/` | `canvas` 工具 |
| 网页浏览 | `/tools/browser` | `browser` 工具 |
| 网络研究 | `/tools/` | `web_search`、`web_fetch` |
| 图像分析 | `/tools/` | `image` 工具 |

**依据文档验证功能使用方式。** 切勿想当然 —— 功能持续演进，且存在细微差别。使用 clawddocs 核查：

- 工具参数与能力（获取对应 `/tools/` 文档）  
- 频道特定约束（查阅目标频道的 `/providers/`）  
- 配置要求与默认值（`/gateway/configuration`）  
- 已知陷阱或限制  

**输出：** 能力映射图，列出外部依赖、拟用 Clawdbot 功能及泛化性选择。

---

### 第 3 阶段：架构设计

**目标：** 识别适用的设计模式，并提出初步架构。

基于第 1–2 阶段结果，识别适用模式。加载相应模式参考：

| 若该 skill… | 加载模式 |
|-----------------|--------------|
| 封装 CLI 工具 | `patterns/cli-wrapper.md` |
| 封装 Web API | `patterns/api-wrapper.md` |
| 监控并通知 | `patterns/monitor.md` |

Skills 常融合多种模式。请加载所有适用模式并综合考量。

#### 脚本 vs. Agent 指令

一个关键设计分岔点：如何在 SKILL.md 中组合可执行脚本与 agent 指令？

**使用脚本的场景：**

- 操作具有确定性且可重复  
- 逻辑复杂，每次重新推导易出错  
- 性能敏感（脚本执行快于 AI 推理）  
- 需与外部工具交互，且语法严格  
- 需精确文件格式的状态管理  

**使用 agent 指令的场景：**

- 需要判断力（如解读结果、选择方法）  
- 任务随上下文而变化  
- 主要交互为自然语言  
- 灵活性比一致性更重要  
- “如何做”取决于“做什么”（无法预先确定）  

分工原则：脚本处理 *机械性操作*，指令处理 *判断性任务*。

#### 示例：上下文简报 skill

一个在会议前准备简报的 skill。该示例完整展现了 agent→脚本→agent 流程。

**用户消息：**  
> "Brief me on Acme Corp before my 2pm call"

**第一阶段：Agent 解析与路由（SKILL.md 指令）**  

```markdown
## Handling Briefing Requests

When user requests a briefing:
1. Extract the **subject** (company, person, project, topic)
2. Extract **context** if provided (meeting, call, presentation, general)
3. Check calendar for related upcoming events
4. Run the appropriate gather script based on subject type:
   - Company/org → `scripts/gather.py --type company --name "..."`
   - Person → `scripts/gather.py --type person --name "..."`
   - Project → `scripts/gather.py --type project --name "..."`
5. Analyze results and compose briefing (see Phase 3)
```  

agent 将 “Acme Corp” 解析为公司名，“2pm call” 解析为会议上下文。它查询日历，找到 “Call with Acme Corp re: Q2 partnership” 于下午 2 点举行。

**第二阶段：脚本获取外部数据**  

```bash
scripts/gather.py --type company --name "Acme Corp" --context meeting
```  

```python
# scripts/gather.py - deterministic data gathering
def gather_company(name: str, context: str) -> dict:
    return {
        "emails": search_emails(f"from:{domain} OR to:{domain}", days=30),
        "calendar": get_related_events(name, days=14),
        "web": search_web(f"{name} news", recent=True),
        "contacts": find_contacts(name),
        "history": load_prior_briefings(name)  # from state
    }
    # Output: structured JSON with all gathered data
```  

**第三阶段：Agent 综合与执行（SKILL.md 指令）**  

```markdown
## Composing the Briefing

With gathered data, synthesize: key context, recent activity, news, relationship history, suggested talking points, and warnings.

If meeting is <1 hour away, send immediately. If >1 hour, offer to set a reminder.

After delivery: log to `<workspace>/memory/`, update `<skill>/state.json`.
```  

agent 基于结构化数据生成简报，并运用判断力对信息进行优先级排序与框架构建。

若用户确认提醒 → **动态选择合适的提醒系统**。该 skill 不硬编码 “使用 Apple Reminders”，而是检查可用选项（Apple Reminders skill？Google Calendar？基于 cron 的方案？），再据此路由。这是 agent 的判断，而非脚本逻辑。

---

#### 可组合模式示例

Skills 常以非显而易见的方式组合多个 Clawdbot 原语。详见 **[patterns/composable-examples.md](patterns/composable-examples.md)** 中的 7 个详细示例：

1. 视觉监控流水线（nodes + image + canvas + message）  
2. 并行研究聚合器（sessions_spawn + web_search + browser）  
3. 位置感知上下文切换器（nodes + cron + memory）  
4. 跨频道线索追踪器（message + memory_search + sessions_send）  
5. 定时报告生成器（cron + exec + browser + canvas）  
6. 交互式审批工作流（message + cron + memory + gateway）  
7. 自适应学习循环（image + memory + cron）  

**输出：** Clawdbot 系统功能的选择及其理由（如有），以及初步架构草图。

### 第 4 阶段：设计规范

**目标：** 经用户审阅、可用于实施的规范。

#### 状态需求

- **无状态（Stateless）：** 纯函数式输入输出，无需记忆  
- **会话状态化（Session-stateful）：** 在单次对话中保持记忆（使用上下文）  
- **持久化状态化（Persistent-stateful）：** 能跨重启存活（需基于文件的状态）  

若需持久化状态，应存放于何处？

- `<workspace>/memory/` —— 用于属于用户记忆的上下文  
- `<skill>/state.json` —— 用于 skill 内部状态（与 skill 共存）  
- `<workspace>/state/<skill>.json` —— 用于 skill 内部状态（公共 workspace 区域）  
- `<workspace>/TOOLS.md` —— 用于用户特定配置笔记  

默认情况下，skills 不应向 workspace 外写入状态。`~/.clawdbot/` 及其他系统级配置目录不适合用作状态存储。

#### 用户偏好与环境

询问用户现有设置：

- **脚本语言偏好？**（Python、Bash 等）  
- **编码风格偏好？**（类型标注、函数式惯用法等）  
- **是否存在共享运行环境？**（venv、uv、conda，脚本应复用）

查阅 USER.md 和 TOOLS.md 中记录的编码偏好。

#### 密钥处理（Secret Handling）

若 skill 需要 API 密钥或凭证：

1. **询问用户密钥管理方式** —— 用户可能已有既定模式  
2. **默认采用环境变量** —— `SERVICENAME_API_KEY`  
3. **文档化该需求** —— 在 SKILL.md 的 setup 部分说明  
4. **切勿硬编码密钥** —— 不得出现在脚本或 skill 文件中  

常见模式：

- 环境变量（最便携）  
- macOS Keychain，通过 `security` 命令访问  
- `~/.config/skillname/` 中的配置文件（已加入 .gitignore）  
- 1Password CLI（`op read`）

#### 拟议架构

呈现拟议架构：

1. **Skill 结构** —— 文件与目录  
2. **SKILL.md 大纲** —— 各节标题与核心内容  
3. **软件组件** —— 各软件组件（脚本、模块、包装器）的高层次需求  
4. **状态管理** —— 状态的存放位置与方式  
5. **Clawdbot 集成点** —— 所涉功能及其交互方式  

*若为提取场景：* 需包含迁移说明 —— 内容迁移路径、需更新的 workspace 文件。

**该规范是一个审查检查点。** 其目的在于让用户验证：

- 关于 Clawdbot 集成的假设是否正确  
- 设计是否契合其现有工作流  
- 是否与现有 workspace 文件或工具冲突  
- 泛化性是否符合其意图  

**对照需求验证：**

- 是否覆盖第 1 阶段的所有示例？  
- Clawdbot 功能是否被正确使用？（通过 clawddocs 验证）  
- 状态方案是否匹配访问模式？  
- 是否存在需处理的边缘情况或故障模式？  
- 拟议架构是否揭示了第 1 阶段需求中的矛盾？  

**迭代优化**，直至用户满意。此处是低成本暴露设计问题的关键环节。

**输出：** 设计规范，涵盖状态方案、用户偏好、密钥处理及 skill 结构。

---

### 第 5 阶段：实现

**目标：** 具备全部组件的可运行 skill。

**强默认策略：同会话内实现。** 逐项推进规范，并在每步后由用户审阅。此举确保用户全程参与集成决策。

**编码-agent 交接为可选操作**，且仅限于 **复杂的软件子组件** —— 而非整个 skills。SKILL.md 与集成逻辑应保留在主会话中，以便用户审阅。

#### 实现步骤

按顺序执行，每步均需用户审阅：

1. **创建 skill 目录**  
2. **SKILL.md 骨架** —— 前置元数据（frontmatter）+ 章节标题  
   → *审阅：结构是否合理？*  
3. **脚本**（如有）—— 使可执行部件正常运行  
   → *审阅：逐一测试各脚本*  
4. **SKILL.md 正文** —— 补全全部指令  
5. **针对第 1 阶段示例进行测试**  
   → *审阅：是否覆盖全部示例？*  

*若为提取场景：*  
6. 更新 workspace 文件（移除已迁移内容，添加 skill 引用）  
7. 清理旧位置  
8. 验证 skill 可独立运行  

#### 编写 Skill 前置元数据（Frontmatter）

SKILL.md 的前置元数据决定其可发现性，并提供结构化元信息。`description` 字段至关重要 —— 当 agent 扫描可用 skills 时，该字段决定 skill 是否被加载。

参见 <https://docs.clawd.bot/tools/skills> 获取 Clawdbot 特定元数据文档。

**前置元数据格式：**

```yaml
---
name: my-skill
description: [description optimized for discovery]
homepage: https://github.com/user/repo  # optional
metadata: {"clawdbot": {"emoji": "🔧", "requires": {"bins": ["tool"], "env": ["API_KEY"]}, "install": [...]}}
---
```

**描述（description）字段 —— 为关键词匹配与上下文识别而撰写：**

- **功能** —— 核心能力  
- **关键词** —— 用户可能说出、应触发本 skill 的术语  
- **上下文** —— 本 skill 适用的情境  
- **触发短语** —— 表明相关性的自然语言模式  

**示例（优质）：**

```yaml
description: Download videos/audio from YouTube and other sites with interactive quality selection, learned preferences, and recent directory tracking. Use when user shares a video URL or asks to download video/audio.
```

**示例（过于简略）：**

```yaml
description: YouTube downloader.
```

**元数据（metadata）字段**（可选，但推荐用于可发布的 skills）

参见格式规范 <https://docs.clawd.bot/tools/skills>。

简单示例：

```json
{
  "clawdbot": {
    "emoji": "📍",
    "requires": {
      "bins": ["goplaces"],
      "env": ["GOOGLE_PLACES_API_KEY"]
    },
    "primaryEnv": "GOOGLE_PLACES_API_KEY",
    "install": [
      {
        "id": "brew",
        "kind": "brew",
        "formula": "steipete/tap/goplaces",
        "bins": ["goplaces"],
        "label": "Install goplaces (brew)"
      }
    ]
  }
}
```

**测试描述字段：** 若用户说出第 1 阶段的任一示例短语，agent 是否会选择本 skill？若否，则补充缺失关键词。

**输出：** 完整的 skill 目录，可立即投入使用。

---

## 路径约定

Skills 必须谨慎处理路径，尤其关注可移植性与多-agent 上下文。

### 符号说明

| 前缀 | 含义 | 示例 |
|--------|---------|---------|
| `<workspace>/` | Agent 的 workspace 根目录 | `<workspace>/TOOLS.md` |
| `<skill>/` | 本 skill 的目录 | `<skill>/scripts/check.py` |
| （无前缀） | 相对于 skill 的路径 | `scripts/helper.sh` |

**规则：**

- **workspace 文件：** 始终使用 `<workspace>/` 前缀  
- **skill 组件：** 可使用相对路径（指向 skill 目录）  
- **切勿硬编码** `~/clawd` 或类似路径 —— workspaces 具备可移植性  
- **状态文件：** 使用 `<workspace>/` 路径，而非 `~/.clawdbot/`（skills 不拥有用户家目录）

### 子-Agent 考量

通过 `sessions_spawn` 启动的 sub-agents 可能在沙箱容器中运行，挂载点不同。使用 **clawddocs** 查询 `/tools/subagents`，了解当前沙箱配置与路径转换要求。当启动需访问 workspace 文件的 sub-agent 时，应在任务描述中包含路径上下文。

## Workspace 意识

Skills 可能与 workspace 结构交互：

| 文件 | 用途 | 何时引用 |
|------|---------|-------------------|
| `<workspace>/TOOLS.md` | 本地工具笔记 | CLI 封装器中存储用户特定配置 |
| `<workspace>/MEMORY.md` | 长期记忆 | Skills 中贡献于记忆的内容 |
| `<workspace>/memory/` | 日志 | Skills 中记录活动的日志 |
| `<workspace>/HEARTBEAT.md` | 周期性检查 | 由心跳驱动的 skills |
| `<workspace>/USER.md` | 用户上下文 | Skills 中需要的用户信息 |

**原则：** Skills 应明确记录 *触及哪些 workspace 文件* 及 *原因*。

---

## 参考资料

常见 skill 类型的模式参考：

- `patterns/cli-wrapper.md` —— 封装 CLI 工具  
- `patterns/api-wrapper.md` —— 封装 Web API  
- `patterns/monitor.md` —— 监控条件并通知  