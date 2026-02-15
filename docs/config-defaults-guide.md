# OpenClawCN 全参数配置指南 —— 开箱即用最大化价值

> 本文档面向产品经理、运维人员、以及需要理解"每个参数干什么"的开发者。
> 目标：让新装用户零配置（或最少配置）即可获得 OpenClawCN 最大能力。
>
> 配置文件位置：`~/.openclawcn/openclawcn.json`（Linux/Mac）或 `{安装目录}/data/openclawcn.json`（Windows）
> 文件格式：JSON5（支持注释、尾逗号）

---

## 目录

- [第一章：AI的"大脑"怎么选](#第一章ai的大脑怎么选)
- [第二章：AI能干什么、不能干什么](#第二章ai能干什么不能干什么)
- [第三章：怎么访问AI](#第三章怎么访问ai)
- [第四章：通过什么聊天工具跟AI对话](#第四章通过什么聊天工具跟ai对话)
- [第五章：对话怎么管理](#第五章对话怎么管理)
- [第六章：安全隔离与系统资源](#第六章安全隔离与系统资源)
- [第七章：省钱功能（CN专属）](#第七章省钱功能cn专属)
- [第八章：三平台差异总结](#第八章三平台差异总结)
- [第九章：安装向导引导流程](#第九章安装向导引导流程)
- [第十章：不满意默认配置？怎么改](#第十章不满意默认配置怎么改)
- [附录A：全参数技术速查表](#附录a全参数技术速查表)
- [附录B：三平台推荐配置模板](#附录b三平台推荐配置模板)
- [附录C：代码实查纠正记录](#附录c代码实查纠正记录)

---

## 第一章：AI的"大脑"怎么选

### 1.1 用哪家AI？（`auth.profiles[].provider`）

**这是什么？**

OpenClawCN 本身不是 AI，它是一个"管家"，需要接入一个真正的 AI 大脑才能工作。就像一个手机壳，你得选装什么牌子的手机进去。

**国内用户可以选的"大脑"有**：
- 硅基流动(SiliconFlow) — 聚合平台，一个 key 能用几十种模型，有免费额度
- 通义千问(阿里) — 阿里巴巴出品
- 豆包(字节跳动) — 火山引擎出品
- DeepSeek — 性价比极高
- 智谱GLM — 清华系
- Kimi(月之暗面) — 擅长长文
- 等十几家...

**不配会怎样？** AI 完全哑巴，发任何消息都不会回复。这是**唯一一个必须用户手动填的参数**。

**为什么推荐硅基流动？** 因为它是"聚合平台"，注册一个账号就能切换几十种模型，还有免费额度给你试。小白不用纠结"到底哪个模型好"，先用着，后面想换随时换。

---

### 1.2 AI 有多聪明？（`agents.defaults.model`）

**这是什么？**

选定了 AI 厂商后，每家厂商有好几个"型号"。就像买车，同一个品牌有低配、中配、高配。

- **型号越高级**：回答越聪明 → 但花钱越多、回答越慢
- **型号越低级**：回答速度快 → 但可能答不好复杂问题

**为什么不直接用最贵的？** 因为日常 80% 的对话（闲聊、简单问答、翻译）用中配就够了。高配留给写代码、分析数据这种难题。

---

### 1.3 AI 记性有多好？（`agents.defaults.contextTokens`）

**这是什么？**

想象 AI 有一个"记事本"，它把你说的每句话、它自己的每个回复都写在上面。这个记事本的**页数**就是 contextTokens。

| 值 | 大约相当于 | 适合场景 |
|---|---|---|
| 32000 | 记住最近约 50 轮对话 | 简单问答、闲聊 |
| **65536** | **记住最近约 100 轮对话** | **日常使用（推荐）** |
| 128000 | 记住最近约 200 轮对话 | 写长文、复杂项目 |

**记事本越大的代价**：每次 AI 回复时，它要"翻阅"整个记事本，页数越多 → API 调用费越高。

**为什么推荐 65536？** 对小白用户来说，100 轮对话已经很长了。多数人聊不到 50 轮就换话题了。选 65536 是**性价比最优的甜蜜点**——既不会太快"失忆"，也不会账单吓人。

---

### 1.4 AI 该正经还是活泼？（`temperature`）

**这是什么？**

控制 AI 回复的"随机性"。可以理解为 AI 的"性格开关"：

| 值 | AI 性格 | 举例 |
|---|---|---|
| 0 | 极度严谨，每次问同一个问题给完全一样的答案 | 适合写代码、做数学题 |
| 0.5 | 比较稳重，偶尔有变化 | 适合工作场景 |
| **0.7** | **自然流畅，有一定创意** | **推荐，最像真人对话** |
| 1.0 | 很发散，天马行空 | 适合写故事、头脑风暴 |

**为什么是 0.7？** 太低用户会觉得"这 AI 像复读机"；太高用户会觉得"这 AI 在胡说八道"。0.7 经过大量测试是最自然的平衡点。

---

### 1.5 聊久了会不会卡？（`compaction` 上下文压缩）

**这是什么？**

前面说 AI 有个"记事本"，聊天越多记事本越满。满了怎么办？有两种情况：

- **不开压缩**：记事本满了 → AI 直接报错或丢掉最早的对话 → 用户发现"它怎么突然不记得了"
- **开启压缩**：记事本快满时 → AI 自动把早期对话"总结成摘要" → 腾出空间继续聊

**`threshold: 0.8` 是什么意思？** 记事本用了 80% 的时候就开始压缩。为什么不等到 100%？因为压缩本身也需要空间，留 20% 余量防止来不及压缩就爆了。

**必须开启。** 不开的话，小白用户聊到一半突然 AI "失忆"了，这个体验是灾难级的。

---

## 第二章：AI能干什么、不能干什么

### 2.1 AI 能不能在你电脑上执行命令？（`tools.exec.security`）

**这是最最关键的安全参数。** 它决定了 AI 是一个"只会聊天的嘴"还是一个"能动手干活的助手"。

三个档位：

**"deny"（禁止模式）—— AI 是个哑巴助手**
- AI 能做什么：聊天、回答问题、写文字
- AI 不能做什么：不能执行任何命令、不能操作文件、不能装软件、不能跑代码
- 适合谁：极度怕 AI 搞破坏的人
- 体验如何：**非常受限**，用户说"帮我建个文件夹"，AI 只能回复"你可以运行 mkdir 命令"而不能真的去建

**"allowlist"（白名单模式）—— AI 是个有规矩的员工**
- AI 能做什么：只能执行你提前批准的命令（比如 python、git、ls 等）
- AI 不能做什么：白名单之外的一切
- 适合谁：团队/公司部署，需要管控
- 体验如何：中等。大部分日常操作能完成，偶尔会遇到"抱歉我没有权限执行这个命令"

**"full"（完全信任模式）—— AI 是你的全权代理人**
- AI 能做什么：**任何你本人能做的事情**
- AI 不能做什么：只受操作系统权限限制
- 适合谁：个人电脑、信任 AI 的开发者
- 体验如何：**最强大**。"帮我整理桌面"、"帮我装个 Python"、"帮我配置环境"全都能做

**为什么个人用户推荐 "full"？** 因为如果选了 deny 或 allowlist，用户的第一反应就是"这 AI 什么都做不了，废物"。OpenClawCN 的核心价值就是**能动手干活**，把这个能力阉割掉等于自废武功。

**会不会把电脑搞坏？** 有可能，就像你雇了一个很能干但偶尔犯错的助手。但对于个人电脑来说，这个风险可以接受——重要文件有备份就行。

---

### 2.2 AI 执行命令前要不要问你？（`tools.exec.ask`）

在 "full" 或 "allowlist" 模式下，AI 真的要去执行命令之前，要不要先弹个窗问你"我要执行 xxx，你同意吗？"

| 值 | 行为 | 体验 |
|---|---|---|
| "always" | 每次都问 | 安全但烦死了，每句话都弹确认 |
| "on-miss" | 遇到没见过的命令才问 | 平衡，常用命令不问，危险命令问 |
| **"off"** | **从不问，直接执行** | **最流畅，但需要信任 AI** |

**为什么个人用户推荐 "off"？** 想象你让 AI "帮我创建一个项目"，它需要执行 mkdir、git init、npm init 等 5 个命令。如果每个都弹窗问你确认，你要点 5 次"同意"，体验极差。

**团队/服务器用户推荐 "on-miss"**，因为有多人使用，需要安全管控。

---

### 2.3 命令跑太久怎么办？（`backgroundMs` 和 `timeoutSec`）

**场景想象**：你让 AI "帮我装一下 tensorflow"，pip install tensorflow 可能要跑 3 分钟。这 3 分钟里 AI 是卡住不动等它装完，还是一边装一边能回你话？

**backgroundMs = 10000（10秒）的意思是**：
命令开始执行后，如果 10 秒还没完 → AI 自动把这个命令"扔到后台"继续跑 → AI 可以回复你"正在安装中，请稍候"而不是卡在那里。

**timeoutSec = 1800（30分钟）的意思是**：
一个命令最多跑 30 分钟，超过了就强制停掉。防止有个命令卡死了永远跑不完，吃你的 CPU 和内存。

**还有一个 agents.defaults.timeoutSeconds = 600（10分钟）**：
这是智能体的整体超时——AI 从接到你的消息开始，整个"思考+执行"过程最多 10 分钟。这和单条命令的 30 分钟不矛盾：单条命令可以慢慢跑，但 AI 不能无限思考下去。

**10 秒够不够？** 绝大多数情况够了。你能想到的"快速命令"（ls、cat、mkdir）都是毫秒级完成的。需要超过 10 秒的（安装软件、编译代码）本来就应该转后台。

**30 分钟够不够？** 覆盖 99% 场景。常见操作的耗时参考：

| 操作 | 预估耗时 | 够不够 |
|------|---------|-------|
| pip install xxx | 10 秒~3 分钟 | 够 |
| npm install (大项目) | 1~5 分钟 | 够 |
| git clone 大仓库 | 1~10 分钟 | 够 |
| 编译 C++ 项目 | 1~30 分钟 | 临界 |
| Docker 构建镜像 | 5~30 分钟 | 临界 |
| 训练 ML 模型 | 数小时 | 不够（但不是小白场景） |

---

### 2.4 AI 能不能删你的文件？（`tools.write.allowDelete`）

**这是什么？** 字面意思——AI 是否有权限删除文件。

**重要发现**：经过代码审查，这个开关**目前在运行时并没有被代码实际检查**。也就是说不管设 true 还是 false，AI 目前都能通过命令行（rm 命令）删除文件。这是一个待完善的功能点。

**那还有必要设吗？** 有。因为：
1. 未来版本可能会加上运行时检查
2. 设为 true 是一种"意图声明"——告诉 AI "你可以删文件"
3. 真正的删除权限控制目前靠的是 `exec.security` 参数

**为什么推荐 true？** 用户说"帮我整理桌面，把那些临时文件删了"，如果 AI 不能删文件，这个需求就完成不了。

---

### 2.5 AI 能不能上网？（`tools.web.search` 和 `tools.web.fetch`）

**search（搜索）**：AI 能不能在遇到不懂的问题时去互联网搜索答案。就像一个员工遇到不会的事情能不能打开百度/谷歌查一下。

**fetch（抓取）**：AI 能不能打开一个具体的网页链接，读取里面的内容。比如你发给它一个新闻链接，它能不能点开看。

**为什么都要开启？**
- 不开 search → AI 的知识停留在它的训练日期，问它"今天天气怎么样"它答不了
- 不开 fetch → 你发个链接给它，它看不了内容

**有什么代价？** search 需要额外的 API Key（Brave Search 有免费额度），每次搜索消耗微量 API 调用。

---

### 2.6 AI 能不能操控你的浏览器？（`browser`）

**这是什么？**

AI 可以打开一个真实的 Chrome 浏览器，像一个人一样去点击、输入、截图。用途比如：
- "帮我截一下这个网页"
- "帮我在这个网站上填一下表单"
- "帮我看看这个网页长什么样"

**`allowHostBrowser: true` 是什么？**
- true = AI 用你电脑上已安装的 Chrome/Edge
- false = AI 只能用 Docker 容器里的浏览器（需要装 Docker）

**Windows/Mac 推荐 true**：小白大概率没装 Docker，而电脑上肯定有 Chrome/Edge。设 false 就等于这个功能废了。

**Linux 云服务器推荐 false**：云服务器没有桌面环境，没有可视化浏览器可以控制。

---

### 2.7 AI 有没有"长期记忆"？（`tools.memorySearch`）

**这是什么？**

默认情况下，AI 的记忆只在一次对话内有效。关掉对话窗口再开，它就忘了你之前说的一切。

开启 memorySearch 后，AI 会把重要的对话内容存进一个"记忆库"。下次你提到相关话题时，它会自动从记忆库里搜索，找回之前的信息。

**就像一个秘书**：
- 关闭记忆 → 每天上班像第一天来，什么都不记得
- 开启记忆 → 有一本笔记本，能翻之前的记录

**`hybrid: true`（混合搜索）是什么？**

搜索记忆时同时用两种方式：
1. **语义搜索**（理解你说的话的意思去找） — 比如你说"之前那个 Python 项目"，它能找到你上次讨论的 Django 项目
2. **关键词搜索**（精确匹配文字） — 比如你说 "tensorflow"，它精确找含这个词的记录

两种方式互补，搜索更准确。

**为什么推荐开启？** AI 有了记忆才像一个真正的长期助手，而不是一个"金鱼脑"。代价是占一点硬盘空间，几乎可以忽略。

---

## 第三章：怎么访问AI

### 3.1 服务开在哪个端口？（`gateway.port`）

OpenClawCN 启动后会开一个"服务窗口"，你的浏览器和各种聊天渠道都通过这个窗口跟 AI 通信。端口号就像门牌号。

**默认 18789**，没有特殊需求不用改。除非这个端口被其他软件占了（极小概率），才需要改成别的数字。

---

### 3.2 谁能连进来？（`gateway.bind`）

**这是整个配置里对小白影响最大的参数之一。**

把 OpenClawCN 想象成一家店铺，bind 决定了这家店铺的"大门朝向"：

**"loopback"（只开内门）**
- 店铺只有一个内部通道，只有在店里的人才能进来
- 翻译：只有你正在用的这台电脑能访问
- 你坐在电脑前打开浏览器输入 `localhost:18789` → 能用
- 别人的电脑、你的手机 → 连不上
- **安全性**：最高，因为外人根本进不来

**"lan"（开街面大门）**
- 店铺面向整条街（你的局域网/公网），任何知道地址的人都能进来
- 翻译：同一个网络（或公网）的设备都能访问
- 你的手机、同事的电脑、甚至互联网上的人 → 都能连
- **安全性**：较低，必须配合密码/令牌使用

**为什么 Windows 和 Mac 推荐 "loopback"？**
因为你就坐在电脑前用，打开浏览器就能访问，没必要暴露给外部。越封闭越安全。

**为什么 Linux 云服务器必须用 "lan"？**
因为云服务器在机房里，你坐在家里/办公室，你的电脑和服务器不是同一台机器。如果设成 loopback，你永远打不开管理页面——**等于装了个寂寞**。

这就是为什么安装时必须**自动检测环境**：有桌面 → loopback，没桌面 → lan。

---

### 3.3 连进来要不要密码？（`gateway.auth`）

就是访问管理页面时需不需要验证身份。

**"token" 模式**：系统自动生成一串随机字符（像 `a3f8b2c1d5e7...`），你访问时 URL 里带上这串字符就能进。优点是不用记密码，缺点是这个链接被别人看到就等于泄密。

**"password" 模式**：你自己设一个密码，每次登录输入。优点是好理解，缺点是密码可能被猜到。

**为什么推荐 token？** 因为 token 是随机生成的长字符串，比用户自己设的 `123456` 安全得多。而且只要把带 token 的链接收藏到浏览器书签里，使用起来和无密码一样方便。

**什么时候 token 是"必须"的？**
当 bind 设为 "lan" 时。因为代码里有一条硬性规定：**如果服务面向网络开放但没有设任何密码/token → 服务直接拒绝启动**。这是防止你不小心把 AI 裸奔暴露在网上。

---

### 3.4 要不要加密？（`gateway.tls`）

你的浏览器和 OpenClawCN 之间传输的数据要不要加密。就像寄信：
- 不加密（HTTP） = 明信片，邮递员和路上的人都能看到内容
- 加密（HTTPS） = 密封信件，只有你和收件人能看到

**本机用的话**（loopback 模式）：
数据从你的浏览器到你电脑上的 OpenClawCN，走的是电脑内部通道，根本不经过网络。**不需要加密**，就像你在自己房间里自言自语，不需要加密。

**远程用的话**（lan 模式，尤其是云服务器）：
数据要经过互联网传输。你的 API Key、聊天内容、甚至 auth token 都在网络上裸奔。**必须加密**。

**`autoGenerate: true` 是什么？**
打开 TLS 加密后，需要一个"数字证书"。这个选项的意思是"帮我自动生成一个"。生成的是"自签名证书"——安全性是够的，但浏览器会弹一个警告说"此证书不受信任"。

**小白会被吓到吗？** 会。浏览器会显示一个红色大叉说"您的连接不是私密连接"。**安装引导必须提前告知用户**："首次打开会看到安全警告，这是正常的，点击'高级 → 继续前往'即可。"

---

## 第四章：通过什么聊天工具跟AI对话

### 4.1 为什么渠道默认应该全部关闭？

**直觉想法**：既然支持钉钉、飞书、企业微信、QQ，全部打开不是更方便？

**实际问题**：

| 问题 | 说明 |
|------|------|
| **启动报警** | 开了但没填 Key → 启动日志里一堆红色警告 → 小白以为出错了 |
| **认知负担** | 4 个渠道同时出现在设置页面 → "这么多东西要配，好复杂" |
| **消息重复** | 如果同时配了钉钉和飞书 → 在 Web 页面发的消息两边都弹出来 → 困惑 |
| **资源浪费** | 每个启用的渠道都维持一个后台连接 → 虽然单个很轻，但没用的连接没有意义 |

**正确做法**：全部默认关闭，在 Setup Wizard（安装向导）里让用户**选择**"你日常用什么聊天工具？"→ 选中的才开启。

---

### 4.2 各渠道的连接方式

| 渠道 | 连接方式 | 是否需要公网 IP | 资源消耗 |
|------|---------|---------------|---------|
| 钉钉 | WebSocket 长连接 | 不需要 | 约 2MB 内存 |
| 飞书 | WebSocket 长连接（推荐） | 不需要 | 约 2MB 内存 |
| 企业微信 | HTTP 回调 | 需要 | 约 1MB 内存 |
| QQ Bot | WebSocket 长连接 | 不需要 | 约 2MB 内存 |

**飞书为什么推荐 WebSocket？** 飞书有两种连接方式：Webhook 需要公网 IP + 开端口 + 配域名，小白用户大概率没有公网 IP（家庭宽带都是 NAT 内网），所以 WebSocket 是唯一可行方案。

---

## 第五章：对话怎么管理

### 5.1 多久不说话就"清空记忆"？（`session.resetIdleMinutes`）

你和 AI 聊了一会儿，然后去吃饭了。回来继续聊，AI 还记得之前的内容吗？

这个参数决定了"中间空闲多久算一次新对话"：

| 值 | 效果 | 适合场景 |
|---|---|---|
| 30 分钟 | 午饭回来就忘了 | 不推荐，太短 |
| **60 分钟** | **1 小时内回来还记得** | **Windows/Mac 推荐** |
| 120 分钟 | 2 小时内回来还记得 | 云服务器推荐（操作间隔更久） |
| 0 | 永不自动清空 | 不推荐，上下文越来越长，API 越来越贵 |

**为什么 Windows/Mac 推荐 60 分钟？** 正常人离开电脑通常不超过 1 小时（吃饭、开会）。1 小时回来还能继续之前的话题，体验自然。

**为什么云服务器推荐 120 分钟？** 云服务器场景下，你可能 SSH 连进去操作一下就去干别的了，过一两个小时再回来，2 小时更合理。

---

### 5.2 群聊里 AI 要不要每条消息都回？（`groupChat.requireMention`）

如果你把 AI 加到一个群里（钉钉群、飞书群），群里有人说话时 AI 要不要回复？

- **true（必须 @ 才回）**：有人在群里说"@AI助手 帮我查一下 xxx" → AI 回复。有人说"今天吃什么" → AI 不理。
- **false（每条都回）**：群里任何人说任何话 → AI 都回复。

**必须设为 true。** 原因：
1. 一个 20 人的群每天几百条消息 → 每条都触发 AI → API 费用爆炸
2. 群里讨论"今天中午吃什么" → AI 也来凑热闹说"我建议吃沙拉" → 尴尬
3. AI 回复速度比人慢 → 大量消息堆积 → 系统可能卡顿

---

### 5.3 消息排队策略（`messages.queue`）

如果同时有 10 个人给 AI 发消息，AI 一次只能处理一个，其他 9 条消息怎么办？排队。

- **`mode: "fifo"`（先来先服务）**：谁先发的先处理。最公平。
- **`maxSize: 50/100`**：队列最多排多少条。个人用 50 够了（你一个人发不了这么多），服务器用 100（多人场景）。
- **`dropPolicy: "oldest"`**：队列满了丢掉最旧的消息。因为等太久的消息回复了用户也不在意了。

**会不会撑爆系统？** 不会。50 条消息在内存中只占几 KB，微不足道。这个限制是为了防止消息无限堆积导致回复延迟越来越长。

---

## 第六章：安全隔离与系统资源

### 6.1 要不要用"沙箱"？（`sandbox.mode`）

"沙箱"就是在你的电脑里再建一个"虚拟小电脑"（Docker 容器），AI 在这个虚拟小电脑里执行命令。好处是就算 AI 搞坏了什么，也只是搞坏了虚拟小电脑，你的真实系统不受影响。就像给一个小孩一个围栏玩耍——栏内随便折腾，栏外没事。

**三种模式**：
- **"off"（关闭）**：AI 直接在你真实系统上操作。最快、功能最全，但如果 AI 犯错会直接影响你的系统。
- **"auto"（自动）**：检测到 Docker 就用沙箱，没有 Docker 就直接执行。
- **"always"（强制）**：必须用沙箱。如果没装 Docker 就直接报错。

**为什么 Windows 和 Mac 推荐 "off"？**
1. 绝大多数小白没有安装 Docker Desktop
2. Docker Desktop 在 Windows 和 Mac 上本身很吃资源（2-4GB 内存）
3. 设为 "always" 但没装 Docker → 启动直接报错 → 小白崩溃

**为什么 Linux 云服务器推荐 "auto"？**
1. Linux 服务器上安装 Docker 非常普遍
2. 云服务器可能多人使用，安全隔离更重要
3. "auto" 模式友好 — 有 Docker 就用，没有就降级直接执行，不报错

---

### 6.2 AI 能同时干几件事？（`maxConcurrent`）

AI 能同时处理的任务数。比如你让 AI "帮我写一个网页"，AI 可能需要同时创建 HTML 文件、写 CSS、查文档——这就是多个并发任务。

**设太高会怎样？**

| 你的电脑 | maxConcurrent=2 | =4 | =8 |
|---------|----------------|-----|-----|
| 4GB 内存 | 流畅 | 可能卡 | 很卡或崩溃 |
| 8GB 内存 | 流畅 | 流畅 | 可能卡 |
| 16GB 内存 | 流畅 | 流畅 | 流畅 |

**为什么 Windows 推荐 3，Mac 推荐 4？**
- Windows 系统本身的后台进程比 Mac 多，可用资源更少
- Mac 的内存管理效率比 Windows 高（尤其 M 系列芯片）
- 这是保守值，宁可 AI 慢一点，也不让用户电脑卡成幻灯片

---

### 6.3 哪些参数可能导致系统崩溃？

| 参数 | 危险值 | 后果 | 推荐防护 |
|------|--------|------|---------|
| `agents.maxConcurrent` | >8 (低配机) | CPU/内存爆满 | 默认 3~4 |
| `agents.subAgentMaxConcurrent` | >16 | 同上 | 默认 6~8 |
| `sandbox.docker.memory` | 不设限 | Docker 吃光内存 | 默认 2GB |
| `sandbox.docker.cpus` | 不设限 | Docker 吃光 CPU | 默认 2 核 |
| `tools.exec.timeoutSec` | 过大如 86400 | 命令卡住一天 | 保持 1800 |
| `messages.queue.maxSize` | 过大如 10000 | 消息积压吃内存 | 默认 50~100 |
| `groupChat.requireMention` | false | 群消息雪崩 | **必须 true** |

---

## 第七章：省钱功能（CN专属）

### 7.1 免费模型轮转（`freeModels`）

一些国内 AI 厂商提供每日免费额度。OpenClawCN 可以自动管理多个免费账号，当一个账号的今日额度用完了，自动切换到下一个。就像你有 3 张充值卡，一张用完自动换下一张。

**`strategy: "priority"`**：按你设定的优先级顺序使用。高优先级的号用完了才用低优先级的。

**`strategy: "round_robin"`**：轮着用，每次切换一个号，让额度消耗更均匀。

**为什么推荐 "priority"？** 因为不同厂商的模型质量不同。你希望优先用最好的那个，用完了才退而求其次。round_robin 会导致一部分回复质量好一部分差，体验不一致。

**`showNotification: true`**：切换了提供商时告诉用户。推荐开启，否则用户会疑惑"为什么这次回复的风格不一样了？"

---

## 第八章：三平台差异总结

### Windows 小白

| 事项 | 方案 | 为什么 |
|------|------|--------|
| 访问方式 | 本机浏览器直接开 | 有桌面环境 |
| 网络安全 | 不需要加密 | 数据不出本机 |
| Docker 沙箱 | 关掉 | 几乎没人装 Docker Desktop |
| 杀毒软件 | **安装时提醒加白名单** | Windows Defender 可能拦截 AI 执行的命令 |
| 并发数 | 3 个 | Windows 后台进程多，内存紧张 |
| 浏览器控制 | 用本机 Chrome/Edge | 有浏览器 |
| 空闲清空 | 60 分钟 | 正常使用间隔 |

### macOS 小白

| 事项 | 方案 | 为什么 |
|------|------|--------|
| 访问方式 | 本机浏览器直接开 | 有桌面环境 |
| 网络安全 | 不需要加密 | 数据不出本机 |
| Docker 沙箱 | 关掉 | Docker Desktop 在 Mac 上很吃资源 |
| 权限问题 | **首次可能弹权限请求** | macOS 安全策略严格 |
| 并发数 | 4 个 | Mac 资源管理更高效 |
| 包管理 | Homebrew 优先 | Mac 生态标准 |
| 空闲清空 | 60 分钟 | 正常使用间隔 |

### Linux 云服务器小白

| 事项 | 方案 | 为什么 |
|------|------|--------|
| 访问方式 | **远程浏览器通过 IP+端口** | 没有桌面，只能远程连 |
| 网络安全 | **必须加密+必须设 token** | 数据走公网，裸奔极危险 |
| Docker 沙箱 | 自动检测 | Linux 上 Docker 很常见 |
| 防火墙 | **安装时提醒开放 18789 端口** | 云服务器默认只开 22 和 80 |
| 自签证书 | **提醒浏览器警告是正常的** | 小白会被"不安全"吓到 |
| 并发数 | 4 个 | 服务器通常资源较充足 |
| 浏览器控制 | **禁用本机浏览器** | 没有可视化浏览器 |
| 空闲清空 | 120 分钟 | 远程操作间隔更长 |

---

## 第九章：安装向导引导流程

整个思路是：**小白不需要知道任何参数名**。安装向导用自然语言提问，背后自动配好参数。

```
第 1 步 [CN 用户]  填入你的许可证密钥
                    ↓
第 2 步  你想用哪家 AI？ （展示卡片列表，推荐硅基流动）
         → 输入 API Key → 系统自动验证能不能用
                    ↓
第 3 步  AI 的工作文件放哪？（默认: 用户目录/clawd，可改）
                    ↓
第 4 步  你信任 AI 执行操作吗？
         完全信任（推荐个人用户）→ security=full, ask=off
         需要确认（推荐团队）    → security=full, ask=on-miss
         只聊天不操作            → security=deny
                    ↓
第 5 步  你想通过什么聊天工具跟 AI 对话？
         [ ] 钉钉    [ ] 飞书    [ ] 企业微信    [ ] QQ Bot
         （勾选的才展开填写配置信息）
                    ↓
完成！系统根据你的操作系统 + 以上选择，
     自动生成完整配置，其余几十个参数全部用最优默认值。
```

**安装时自动检测逻辑**：

```
安装程序启动
  │
  ├─ 检测操作系统 → Windows / macOS / Linux
  │
  ├─ [Linux] 检测是否有桌面环境
  │     ├─ 有桌面 → 按 Mac 方案配置 (bind=loopback, tls=false)
  │     └─ 无桌面 → 按云服务器方案配置
  │           ├─ 自动生成随机 token (32字符)
  │           ├─ 自动生成 TLS 证书
  │           ├─ bind=lan
  │           └─ 打印: "请用以下地址访问: https://服务器IP:18789?token=xxx"
  │
  ├─ [Windows] 检测内存
  │     ├─ >=16GB → maxConcurrent=4
  │     ├─ 8~16GB → maxConcurrent=3
  │     └─ <8GB   → maxConcurrent=2, contextTokens=32000
  │
  ├─ [所有平台] 检测 Docker 是否安装
  │     ├─ 已安装 → sandbox.mode="auto"
  │     └─ 未安装 → sandbox.mode="off"
  │
  ├─ 检测区域 (已有 detectChinaRegion() 函数)
  │     ├─ CN → 加载 CN provider 列表 + freeModels.enabled=true
  │     └─ Global → 加载 Global provider 列表
  │
  └─ 写入 openclawcn.json → 启动 Setup Wizard
```

---

## 第十章：不满意默认配置？怎么改

系统提供了 **7 种修改配置的方式**，从"完全不懂技术"到"高级开发者"都有对应的工具。下面按**上手难度从低到高**排列。

---

### 10.1 最简单：概览页面快捷卡片（推荐小白首选）

**在哪？** 打开 OpenClawCN Web 管理页面，首页（`/`）就是。

**长什么样？** 首页有几张"卡片"，每张卡片负责一个最常用的设置：

**卡片一：AI 模型切换**
- 两个下拉框：选"厂商"和"型号"
- 一个密码框：填/改 API Key
- 一个"验证"按钮：点一下测试 Key 能不能用
- 选完自动保存，不用点额外的按钮

**卡片二：安全模式切换**
- 三个单选按钮：完全信任 / 需要确认 / 只聊天
- 点一下就切换，立即生效
- 每个选项下面有一行说明

**什么时候用？**
- "我想换一个AI模型试试" → 概览页，3 秒搞定
- "我想让AI更安全一些" → 概览页，点一下

**局限**：只能改最常用的几个设置，改不了高级参数。

---

### 10.2 技能页面：一个开关管一个能力

**在哪？** Web 管理页面的"技能"标签页（`/skills`）。

**长什么样？** 每个技能是一张卡片：

```
🌐 网页搜索
   [开/关 开关]  [设置按钮]
   状态：✓ 已配置

🎨 图片生成
   [开/关 开关]  [设置按钮]
   状态：⚠️ 需要填写 API Key
   API Key: [________] [保存]
```

**怎么用？**
1. 想开启某个能力 → 把开关打开
2. 需要 API Key 的 → 填进去，点"保存"
3. 想关闭某个能力 → 把开关关掉

**什么时候用？**
- "我想让AI能搜索网页" → 技能页，打开"网页搜索"
- "我不想让AI操控浏览器了" → 技能页，关掉"浏览器"

---

### 10.3 安装向导：重新走一遍流程

**在哪？** Web 管理页面可以重新进入安装向导（`/setup`）。

**这不是只有第一次安装才有吗？** 不是。任何时候你都可以重新打开向导，重新走一遍那 5 个步骤。

**什么时候用？**
- "我换了一家AI厂商，需要重新配" → 重走向导
- "我想加一个新的聊天渠道（比如飞书）" → 重走向导第5步
- "我想切换安全模式" → 重走向导第4步

**好处**：向导会帮你**验证**填的东西对不对（比如API Key能不能用、渠道凭证对不对）。

---

### 10.4 聊天命令：在对话中直接改

**在哪？** 在任何你和 AI 对话的地方（钉钉、飞书、Web 聊天框都行）。

**怎么用？** 直接发消息，就像跟AI说话一样：

| 你发的消息 | 效果 |
|-----------|------|
| `/config show` | 看当前全部配置 |
| `/config show agents.defaults.temperature` | 看某个具体参数 |
| `/config set agents.defaults.temperature=0.5` | 把 AI 创造力调低 |
| `/config unset tools.web.search.apiKey` | 删掉搜索的API Key |
| `/model` | 看当前用的什么模型 |
| `/model gpt-4` | 切换到 gpt-4 |
| `/models` | 看所有可用的模型列表 |

**举个例子**：

你在钉钉群里发：
```
/config set agents.defaults.temperature=0.3
```
AI 回复：
```
✓ 配置已更新: agents.defaults.temperature = 0.3
```
就这么简单。

**还有一个"调试模式"**：

| 命令 | 效果 |
|------|------|
| `/debug set agents.defaults.temperature=0.9` | 临时改成0.9，重启后恢复 |
| `/debug reset` | 清除所有临时修改 |

**"调试"和"正式"的区别**：
- `/config set` → 写入配置文件，永久生效
- `/debug set` → 只在内存中，重启就没了

**什么时候用"调试"？** 当你想"试试看把这个参数调高会怎样"但又不确定好不好用的时候。试完了觉得好再用 `/config set` 正式保存。

---

### 10.5 可视化配置编辑器：什么都能改

**在哪？** Web 管理页面的"配置"标签页（`/config`）。

**这是功能最全的修改方式。** 上面几种方式能改的，这里都能改。上面改不了的，这里也能改。

**长什么样？** 三栏布局：

```
┌──────────┬────────────────────┬──────────┐
│ 左侧导航 │   中间编辑区域      │ 右侧变更 │
│          │                    │ 预览     │
│ 环境变量  │  [表单模式/原始模式] │          │
│ 更新     │                    │ 你改了:  │
│ 智能体 ← │  智能体配置         │ 温度:    │
│ 认证     │  ┌──────────────┐  │ 0.7→0.5 │
│ 渠道     │  │ 温度: [0.7 ] │  │          │
│ 消息     │  │ 模型: [▼   ] │  │          │
│ 工具     │  │ 压缩: [开关] │  │          │
│ 网关     │  └──────────────┘  │          │
│ ...      │                    │          │
│          │  [重载] [保存] [应用]│          │
└──────────┴────────────────────┴──────────┘
```

**左侧**：12 个以上的分类（智能体、认证、渠道、消息、工具、网关...），点哪个就编辑哪个。

**中间**：两种编辑模式可以切换——

**表单模式（推荐小白）**：
- 每个参数都有对应的输入控件
- 开关类 → 切换按钮（开/关）
- 数字类 → 输入框带 +/- 按钮
- 选择类 → 下拉框或按钮组
- 密码类 → 自动遮掩显示（API Key、密码等）
- 不用懂 JSON，不用懂代码

**原始模式（给高级用户）**：
- 直接编辑 JSON5 文本
- 可以复制粘贴配置
- 适合批量修改

**右侧**：实时显示你改了什么——改之前是啥、改之后是啥，一目了然。

**底部三个按钮**：

| 按钮 | 作用 | 什么时候用 |
|------|------|----------|
| **重载** | 丢掉所有没保存的修改，重新从服务器加载 | 改乱了想重来 |
| **保存** | 写入配置文件，但不重启服务 | 改的东西不需要重启就能生效 |
| **应用** | 写入配置文件，并重启服务 | 改了需要重启的东西（比如网关端口、AI模型） |

**"保存"和"应用"有什么区别？**
- 有些设置改了立刻生效（比如渠道配置）→ 点"保存"就够了
- 有些设置需要重启才能生效（比如端口号、安全模式）→ 需要点"应用"
- 不确定的话，**点"应用"总是对的**，只是会有 1-2 秒的服务重启

**搜索功能**：顶部有搜索框，输入关键词就能快速定位参数。比如输入"温度"就能跳到 temperature 相关的设置。

---

### 10.6 命令行工具：终端操作

**在哪？** 打开终端/命令行窗口。

**适合谁？** 会用命令行的用户、需要批量修改的场景、没有桌面环境的 Linux 服务器。

**三个命令**：

#### 命令一：`openclawcn config`（直接读写某个参数）

```bash
# 看某个值
openclawcn config get agents.defaults.temperature
# 输出: 0.7

# 改某个值
openclawcn config set agents.defaults.temperature 0.5
# 输出: ✓ Updated

# 删某个值
openclawcn config unset tools.web.search.apiKey
# 输出: ✓ Removed
```

**支持的路径写法**：
- `agents.defaults.temperature` → 嵌套属性用点号分隔
- `agents.list[0].name` → 数组用方括号和序号
- `channels.feishu.appId` → 渠道下的子属性

#### 命令二：`openclawcn configure`（交互式菜单）

```bash
openclawcn configure
```

会出现一个菜单让你选：
```
请选择要配置的部分：
1. 凭证（API Key 等）
2. 设备绑定
3. 智能体
4. 模型
5. 渠道
6. 高级设置
```

选一个数字回车，然后跟着提示一步步填。**不用记任何参数名**。

也可以直接跳到某个部分：
```bash
openclawcn configure --section channels
```

#### 命令三：`openclawcn setup`（重新初始化）

```bash
openclawcn setup          # 重新走初始化流程
openclawcn setup --wizard  # 打开浏览器走可视化向导
```

---

### 10.7 直接编辑配置文件：最原始但最灵活

**文件在哪？**
- Windows: `C:\Users\你的用户名\.openclawcn\openclawcn.json`
- macOS: `~/.openclawcn/openclawcn.json`
- Linux: `~/.openclawcn/openclawcn.json`

**用什么打开？** 任何文本编辑器——记事本、VS Code、vim 都行。

**文件格式是 JSON5**——比标准 JSON 宽松，支持：
- 写注释（`// 这是注释`）
- 尾部逗号（最后一项后面可以有逗号）
- 不加引号的 key

**编辑完怎么生效？** 需要重启 OpenClawCN 服务。

**什么时候直接编辑文件？**
- 系统完全起不来，Web 页面打不开 → 只能改文件
- 想从别的机器复制配置过来 → 直接替换文件
- 批量修改大量参数 → 文件里改更快

**注意事项**：
- 改之前先备份！`cp openclawcn.json openclawcn.json.backup`
- JSON5 语法错误会导致服务起不来
- 改完后重启服务

---

### 10.8 七种方式对比：我该用哪个？

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| **我是纯小白，刚装好** | 安装向导 | 一步步引导，不用懂技术 |
| **我想换个AI模型** | 概览页面 | 3秒搞定，下拉框选一下 |
| **我想开/关某个能力** | 技能页面 | 一个开关的事 |
| **我在聊天时想临时调参数** | 聊天命令 `/config set` | 不用切页面 |
| **我想试试某个参数但不确定** | 聊天命令 `/debug set` | 临时生效，重启恢复 |
| **我想详细调整很多参数** | 可视化配置编辑器 | 功能最全，有表单 |
| **我在Linux服务器上没浏览器** | 命令行 `openclawcn configure` | 终端交互式菜单 |
| **我要写脚本批量部署** | 命令行 `openclawcn config set` | 可脚本化 |
| **系统起不来了** | 直接编辑配置文件 | 最后手段 |

---

### 10.9 小白快速上手路径

**第一天：** 安装时跟着向导走完 5 步 → 系统能用了

**第一周：** 通过概览页面和技能页面微调 → 换模型、开/关能力

**遇到问题时：** 在聊天框里问 AI "帮我看看当前配置" → AI 可以告诉你怎么改

**想深入调整时：** 打开可视化配置编辑器 → 用表单模式逐项调整

**进阶用户：** 学会聊天命令 `/config set`，随时随地改配置

> **核心原则**：从简单的工具开始用，遇到改不了的再升级到更高级的工具。不需要一上来就学会所有方式。

---

## 附录A：全参数技术速查表

### AI 大脑类

| 参数路径 | 类型 | 代码实际默认值 | 推荐值 | 一句话说明 |
|----------|------|-------------|--------|-----------|
| `auth.profiles[].provider` | string | 无 | `"siliconflow"` (CN) | AI 厂商，**必填** |
| `auth.profiles[].apiKey` | string | 无 | 用户填写 | API 密钥，**必填** |
| `agents.defaults.model` | string | 按 provider | 中配模型 | AI 型号 |
| `agents.defaults.contextTokens` | number | 由模型决定 | `65536` | 记忆长度（越大越贵） |
| `agents.defaults.temperature` | number | 无 | `0.7` | 创造力（0 严谨~1 发散） |
| `agents.defaults.topP` | number | 无 | `0.9` | 采样范围，配合 temperature |
| `agents.defaults.maxOutputTokens` | number | 无 | `4096` | 单次最大回复长度 |
| `agents.defaults.compaction.enabled` | boolean | 无 | `true` | 长对话自动压缩 |
| `agents.defaults.compaction.threshold` | number | 无 | `0.8` | 80% 满时开始压缩 |
| `agents.defaults.workspace` | string | `~/clawd` | 保持默认 | AI 工作目录 |
| `agents.defaults.timeoutSeconds` | number | `600` | `900` | 智能体整体超时 |
| `agents.maxConcurrent` | number | `4` | Win=3, Mac=4, Linux=4 | 最大并发任务数 |
| `agents.subAgentMaxConcurrent` | number | `8` | Win=6, 其他=8 | 子任务最大并发数 |

### 安全与权限类

| 参数路径 | 类型 | 代码实际默认值 | 推荐值 | 一句话说明 |
|----------|------|-------------|--------|-----------|
| `tools.exec.security` | string | `"deny"` | `"full"` (个人) | AI 命令执行权限 |
| `tools.exec.ask` | string | `"on-miss"` | `"off"` (个人) | 执行前是否确认 |
| `tools.exec.host` | string | `"sandbox"` | `"gateway"` | 在哪执行命令 |
| `tools.exec.backgroundMs` | number | `10000` | `10000` | 超时自动转后台（毫秒） |
| `tools.exec.timeoutSec` | number | `1800` | `1800` | 单命令超时（秒） |
| `tools.write.allowDelete` | boolean | `false` | `true` | 允许删除文件 |
| `sandbox.mode` | string | 无 | Win/Mac=`"off"`, Linux=`"auto"` | 沙箱隔离 |
| `sandbox.docker.memory` | string | 无 | `"2g"` | 沙箱内存上限 |
| `sandbox.docker.cpus` | number | 无 | `2` | 沙箱 CPU 上限 |

### 网关与访问类

| 参数路径 | 类型 | 代码实际默认值 | 推荐值 | 一句话说明 |
|----------|------|-------------|--------|-----------|
| `gateway.port` | number | `18789` | `18789` | 服务端口 |
| `gateway.bind` | string | `"loopback"` | 有桌面=`"loopback"`, 无桌面=`"lan"` | 谁能连进来 |
| `gateway.auth.mode` | string | `"token"` | `"token"` | 认证方式 |
| `gateway.auth.token` | string | 无 | 自动生成 | 访问令牌 |
| `gateway.controlUi.enabled` | boolean | `true` | `true` | Web 管理面板 |
| `gateway.tls.enabled` | boolean | `false` | 本机=`false`, 远程=`true` | HTTPS 加密 |
| `gateway.tls.autoGenerate` | boolean | `true` | `true` | 自动生成证书 |
| `gateway.reload.mode` | string | `"hybrid"` | `"hybrid"` | 配置热加载 |

### 网络工具类

| 参数路径 | 类型 | 代码实际默认值 | 推荐值 | 一句话说明 |
|----------|------|-------------|--------|-----------|
| `tools.web.search.enabled` | boolean | 有 key 时 true | `true` | AI 能搜索互联网 |
| `tools.web.search.maxResults` | number | 无 | `5` | 搜索结果数 |
| `tools.web.fetch.enabled` | boolean | `true` | `true` | AI 能抓取网页 |
| `tools.web.fetch.readability` | boolean | `true` | `true` | 提取正文去广告 |
| `browser.enabled` | boolean | 无 | `true` | AI 操控浏览器 |
| `browser.allowHostBrowser` | boolean | 无 | 有桌面=`true`, 无桌面=`false` | 用本机浏览器 |
| `browser.profile` | string | 无 | `"openclawcn"` | 浏览器配置隔离 |

### 记忆类

| 参数路径 | 类型 | 代码实际默认值 | 推荐值 | 一句话说明 |
|----------|------|-------------|--------|-----------|
| `tools.memorySearch.enabled` | boolean | `true` | `true` | 长期记忆 |
| `tools.memorySearch.sources` | string[] | `["memory"]` | `["memory","sessions"]` | 记忆来源 |
| `tools.memorySearch.provider` | string | 无 | `"local"` | 本地计算嵌入向量 |
| `tools.memorySearch.query.hybrid.enabled` | boolean | `true` | `true` | 混合搜索 |
| `tools.memorySearch.cache.enabled` | boolean | `true` | `true` | 缓存向量 |

### 对话管理类

| 参数路径 | 类型 | 代码实际默认值 | 推荐值 | 一句话说明 |
|----------|------|-------------|--------|-----------|
| `session.scope` | string | 无 | `"user"` | 会话隔离范围 |
| `session.resetOnIdle` | boolean | 无 | `true` | 空闲自动清空 |
| `session.resetIdleMinutes` | number | 无 | Win/Mac=`60`, Linux=`120` | 空闲多久清空 |
| `messages.queue.mode` | string | 无 | `"fifo"` | 消息排队方式 |
| `messages.queue.maxSize` | number | 无 | 个人=`50`, 服务器=`100` | 队列最大长度 |
| `messages.queue.dropPolicy` | string | 无 | `"oldest"` | 满了丢谁 |
| `messages.groupChat.requireMention` | boolean | 无 | `true` | 群聊必须 @ |
| `messages.dm.autoReply` | boolean | 无 | `true` | 私聊自动回 |
| `messages.commands.prefix` | string | 无 | `"/"` | 命令前缀 |
| `messages.commands.enabled` | boolean | 无 | `true` | 启用命令 |

### 渠道类

| 参数路径 | 类型 | 代码实际默认值 | 推荐值 | 一句话说明 |
|----------|------|-------------|--------|-----------|
| `channels.dingtalk.enabled` | boolean | 无 | `false`（向导中开） | 钉钉 |
| `channels.feishu.enabled` | boolean | 无 | `false`（向导中开） | 飞书 |
| `channels.feishu.connectionMode` | string | 无 | `"websocket"` | 飞书连接方式 |
| `channels.wecom.enabled` | boolean | 无 | `false`（向导中开） | 企业微信 |
| `channels.qqbot.enabled` | boolean | 无 | `false`（向导中开） | QQ Bot |

### 省钱类（CN）

| 参数路径 | 类型 | 代码实际默认值 | 推荐值 | 一句话说明 |
|----------|------|-------------|--------|-----------|
| `freeModels.enabled` | boolean | `false` | `true` (CN) | 免费模型轮转 |
| `freeModels.scheduling.strategy` | string | `"priority"` | `"priority"` | 优先级调度 |
| `freeModels.scheduling.showNotification` | boolean | `true` | `true` | 切换时通知 |
| `freeModels.scheduling.preCheck` | boolean | `true` | `true` | 预检额度 |

### 其他

| 参数路径 | 类型 | 代码实际默认值 | 推荐值 | 一句话说明 |
|----------|------|-------------|--------|-----------|
| `skills.load.watch` | boolean | 无 | `true` | 技能热加载 |
| `skills.install.preferBrew` | boolean | 无 | Mac=`true` | Homebrew 优先 |
| `cron.enabled` | boolean | 无 | `true` | 定时任务 |
| `hooks.enabled` | boolean | 无 | `false` | HTTP webhook API（需配 token，一般用户不需要） |
| `hooks.internal.enabled` | boolean | 无 | `true` | 内部事件钩子（session-memory 等） |
| `logging.level` | string | 无 | `"info"` | 日志级别 |
| `tts.enabled` | boolean | 无 | `false` | 语音合成（需 key） |
| `canvasHost.enabled` | boolean | 自动 | 保持自动 | 画布服务 |
| `canvasHost.liveReload` | boolean | `true` | `true` | 画布实时刷新 |

---

## 附录B：三平台推荐配置模板

### B.1 Windows 小白用户

```json5
{
  agents: {
    defaults: {
      workspace: "~/clawd",
      contextTokens: 65536,
      temperature: 0.7,
      compaction: { enabled: true, threshold: 0.8 },
      timeoutSeconds: 900
    },
    maxConcurrent: 3,
    subAgentMaxConcurrent: 6
  },
  tools: {
    exec: {
      security: "full",
      ask: "off",
      host: "gateway",
      backgroundMs: 10000,
      timeoutSec: 1800
    },
    write: { allowDelete: true },
    web: {
      search: { enabled: true, maxResults: 5 },
      fetch: { enabled: true, readability: true }
    },
    memorySearch: {
      enabled: true,
      sources: ["memory", "sessions"],
      provider: "local",
      query: { hybrid: { enabled: true } },
      cache: { enabled: true }
    },
    browser: { profile: "openclawcn", allowHostBrowser: true }
  },
  gateway: {
    port: 18789,
    bind: "loopback",
    auth: { mode: "token" },
    controlUi: { enabled: true },
    tls: { enabled: false },
    reload: { mode: "hybrid" }
  },
  sandbox: { mode: "off" },
  session: { scope: "user", resetOnIdle: true, resetIdleMinutes: 60 },
  messages: {
    queue: { mode: "fifo", maxSize: 50, dropPolicy: "oldest" },
    groupChat: { requireMention: true },
    dm: { autoReply: true },
    commands: { prefix: "/", enabled: true }
  },
  channels: {
    dingtalk: { enabled: false },
    feishu: { enabled: false },
    wecom: { enabled: false },
    qqbot: { enabled: false }
  },
  skills: { load: { watch: true } },
  cron: { enabled: true },
  hooks: { internal: { enabled: true } },
  freeModels: {
    enabled: true,
    scheduling: { strategy: "priority", showNotification: true, preCheck: true }
  },
  logging: { level: "info" }
}
```

### B.2 macOS 小白用户

```json5
{
  agents: {
    defaults: {
      workspace: "~/clawd",
      contextTokens: 65536,
      temperature: 0.7,
      compaction: { enabled: true, threshold: 0.8 },
      timeoutSeconds: 900
    },
    maxConcurrent: 4,
    subAgentMaxConcurrent: 8
  },
  tools: {
    exec: {
      security: "full",
      ask: "off",
      host: "gateway",
      backgroundMs: 10000,
      timeoutSec: 1800
    },
    write: { allowDelete: true },
    web: {
      search: { enabled: true, maxResults: 5 },
      fetch: { enabled: true, readability: true }
    },
    memorySearch: {
      enabled: true,
      sources: ["memory", "sessions"],
      provider: "local",
      query: { hybrid: { enabled: true } },
      cache: { enabled: true }
    },
    browser: { profile: "openclawcn", allowHostBrowser: true }
  },
  gateway: {
    port: 18789,
    bind: "loopback",
    auth: { mode: "token" },
    controlUi: { enabled: true },
    tls: { enabled: false },
    reload: { mode: "hybrid" }
  },
  sandbox: { mode: "off" },
  session: { scope: "user", resetOnIdle: true, resetIdleMinutes: 60 },
  messages: {
    queue: { mode: "fifo", maxSize: 50, dropPolicy: "oldest" },
    groupChat: { requireMention: true },
    dm: { autoReply: true },
    commands: { prefix: "/", enabled: true }
  },
  channels: {
    dingtalk: { enabled: false },
    feishu: { enabled: false },
    wecom: { enabled: false },
    qqbot: { enabled: false }
  },
  skills: { load: { watch: true }, install: { preferBrew: true } },
  cron: { enabled: true },
  hooks: { internal: { enabled: true } },
  freeModels: {
    enabled: true,
    scheduling: { strategy: "priority", showNotification: true, preCheck: true }
  },
  logging: { level: "info" }
}
```

### B.3 Linux 云服务器小白用户

```json5
{
  agents: {
    defaults: {
      workspace: "~/clawd",
      contextTokens: 65536,
      temperature: 0.7,
      compaction: { enabled: true, threshold: 0.8 },
      timeoutSeconds: 900
    },
    maxConcurrent: 4,
    subAgentMaxConcurrent: 8
  },
  tools: {
    exec: {
      security: "full",
      ask: "off",
      host: "gateway",
      backgroundMs: 10000,
      timeoutSec: 1800
    },
    write: { allowDelete: true },
    web: {
      search: { enabled: true, maxResults: 5 },
      fetch: { enabled: true, readability: true }
    },
    memorySearch: {
      enabled: true,
      sources: ["memory", "sessions"],
      provider: "local",
      query: { hybrid: { enabled: true } },
      cache: { enabled: true }
    },
    browser: { profile: "openclawcn", allowHostBrowser: false }
  },
  gateway: {
    port: 18789,
    bind: "lan",
    auth: { mode: "token" },
    controlUi: { enabled: true },
    tls: { enabled: true, autoGenerate: true },
    reload: { mode: "hybrid" }
  },
  sandbox: { mode: "auto", docker: { memory: "2g", cpus: 2 } },
  session: { scope: "user", resetOnIdle: true, resetIdleMinutes: 120 },
  messages: {
    queue: { mode: "fifo", maxSize: 100, dropPolicy: "oldest" },
    groupChat: { requireMention: true },
    dm: { autoReply: true },
    commands: { prefix: "/", enabled: true }
  },
  channels: {
    dingtalk: { enabled: false },
    feishu: { enabled: false },
    wecom: { enabled: false },
    qqbot: { enabled: false }
  },
  skills: { load: { watch: true } },
  cron: { enabled: true },
  hooks: { internal: { enabled: true } },
  freeModels: {
    enabled: true,
    scheduling: { strategy: "priority", showNotification: true, preCheck: true }
  },
  logging: { level: "info" }
}
```

---

## 附录C：代码实查纠正记录

以下是通过源码审查发现的、与直觉或文档不一致的重要事实：

| 参数 | 直觉/文档描述 | 代码实际行为 | 源文件 |
|------|-------------|-------------|--------|
| `backgroundMs` 默认值 | 30000ms | **10000ms (10秒)** | `src/agents/bash-tools.exec.ts` L723-728 |
| `timeoutSec` 默认值 | 300s | **1800s (30分钟)** | `src/agents/bash-tools.exec.ts` L730-733 |
| `agents.defaults.timeoutSeconds` | 未知 | **600s (10分钟)** | `src/agents/timeout.ts` |
| `tools.write.allowDelete` | 有运行时检查 | **无运行时检查，仅配置声明** | 全局搜索无引用 |
| `gateway.bind` 默认值 | 未明确 | **"loopback"** | `src/gateway/server-runtime-config.ts` L42 |
| `workspace` 默认值 | ~/clawd/workspace | **~/clawd** | `src/agents/workspace.ts` L10-21 |
| bind=lan 无 token | 可以启动 | **拒绝启动并报错** | `src/gateway/server-runtime-config.ts` L88-95 |

---

> **文档版本**: v1.1（新增第十章：配置修改方式全解）
> **最后更新**: 2025-02-08
> **数据来源**: 源码审查 + 用户体验分析
