# ClawdbotCN ⟷ OpenClaw 上游融合确定性清单

> **生成日期**: 2026-02-11
> **本地版本**: 2026.2.0 (基于上游 ~2026.1.25)
> **上游最新**: 2026.2.6 (2026-02-07)
> **pi-ai 本地**: 0.49.3 | **上游**: 0.52.7
> **上次同步**: 2026-02-04 (仅3项安全修复)
> **本文档覆盖**: 上游 2026.1.20 → 2026.2.6 全部变更

---

## 版本覆盖范围

| 版本 | 日期 | 类型 | 本地是否基于 |
|------|------|------|-------------|
| 2026.1.20 | ~1/20 | 基线版本 | ✅ 已含大部分 |
| 2026.1.21 | ~1/21 | 主要更新 | ⚠️ 部分含 |
| 2026.1.21-2 | ~1/21 | 补丁 | ⚠️ 部分含 |
| 2026.1.22 | ~1/22 | 主要更新 | ⚠️ 部分含 |
| 2026.1.23 | ~1/23 | 主要更新 | ⚠️ 部分含 |
| 2026.1.23-1 | ~1/23 | 补丁 | ⚠️ 部分含 |
| 2026.1.24 | ~1/24 | 主要更新 | ❌ 未含 |
| 2026.1.24-1/2/3 | ~1/24 | 补丁 | ❌ 未含 |
| 2026.1.29 | ~1/29 | 品牌重塑 | ❌ 未含 |
| 2026.2.1 | 2/2 | 主要更新 | ❌ 未含 |
| 2026.2.2 | 2/4 | 主要更新 | ❌ 未含 |
| 2026.2.3 | 2/5 | 主要更新 | ❌ 未含 |
| 2026.2.6 | 2/7 | 最新 | ❌ 未含 |

---

## 统计总览

```
┌────────────────────────────────────────────────────────────────────┐
│                     上游变更统计 (2026.1.21 → 2026.2.6)           │
├────────────────────────────────────────────────────────────────────┤
│  ✅ 已合并 (2/4同步)    │   3 项   │ SSRF, cwd验证, TG超时       │
│  ⏭️ 已有等效实现        │  ~12 项  │ session lock, LD过滤等      │
│  🔴 P0 紧急必合         │  38 项   │ 安全+稳定性+国产模型         │
│  🟡 P1 建议合并         │  52 项   │ CLI/UI/Agent/Media           │
│  🟢 P2 可选合并         │  65 项   │ Telegram/Discord/新功能       │
│  ❌ 永不合并            │  ~15 项  │ 品牌/路径/auth mode none     │
│  ⏸️ 需评估后决定        │  ~20 项  │ pi-ai升级/QMD/Agents仪表盘   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 一、🔴 P0 紧急必合 (安全+稳定性+国产模型)

> 这些变更不论中国/国际用户都会受影响，必须立即手动移植

### 1.1 Gateway 稳定性 (8项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 1 | 防止 transient 网络错误导致 Gateway 崩溃 | 1.29 | #2980 | ❌ 缺失 | 新增 DNS/Connect 错误码 |
| 2 | 抑制 AbortError 和网络错误的 unhandled rejections | 1.29 | #2451 | ❌ 缺失 | 防止请求中断时崩溃 |
| 3 | 图片 >5MB 防止无限重试 | 1.29 | #2871 | ❌ 缺失 | 资源耗尽风险 |
| 4 | Gateway prefer newest session metadata when combining stores | 1.29 | #1823 | ❌ 缺失 | session 合并顺序 |
| 5 | Gateway 比较 Linux process start time 避免 PID 循环锁 | 1.23 | #1572 | ❌ 缺失 | 锁死循环风险 |
| 6 | Gateway 单例锁防止多 Gateway 共享配置 | 1.21 | - | ⚠️ 部分有 | 需对比本地 gateway-lock |
| 7 | Gateway reschedule per-agent heartbeats on config hot reload | 1.20 | - | ❌ 缺失 | 热重载心跳 |
| 8 | Gateway default auth fail-closed | 1.29 | - | ❌ 缺失 | 安全默认值 |

### 1.2 安全加固 (18项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 9 | ✅ SSRF 防护 (validateUrlForSsrf) | 2.1 | - | ✅ 已合并 | 2/4已合 |
| 10 | ✅ cwd 路径注入验证 (validateCwdPath) | 2.1 | #5335 | ✅ 已合并 | 2/4已合 |
| 11 | DNS pinning 防 rebinding | 1.29 | - | ❌ 缺失 | URL fetch 安全 |
| 12 | SSH target handling 安全加固 | 1.29 | #4001 | ❌ 缺失 | 远程访问安全 |
| 13 | mDNS discovery 最小化默认减少信息泄露 | 1.29 | #1882 | ❌ 缺失 | 网络发现安全 |
| 14 | 包裹外部 hook 内容防注入 | 1.29 | #1827 | ❌ 缺失 | hook 安全 |
| 15 | 加固 Tailscale Serve auth (本地 tailscaled 验证) | 1.29 | - | ❌ 缺失 | 认证安全 |
| 16 | npm overrides 固定 tar@7.5.4 | 1.29 | - | ❌ 缺失 | 供应链安全 |
| 17 | 安全: <=300B 模型无沙盒+web工具时警告 | 1.20 | - | ❌ 缺失 | 风险提示 |
| 18 | 安全: require operator.approvals for /approve | 2.2 | #1 | ❌ 缺失 | 权限控制 |
| 19 | 安全: Matrix allowlist 强制 full MXID | 2.2 | - | ❌ 缺失 | 渠道安全 |
| 20 | 安全: Slack access-group gating | 2.2 | - | ❌ 缺失 | 渠道安全 |
| 21 | 安全: gateway connect 跳过 device identity 需验证 shared-secret | 2.2 | - | ❌ 缺失 | 认证安全 |
| 22 | 安全: Windows exec allowlist 阻止 cmd.exe bypass | 2.2 | - | ❌ 缺失 | Windows 安全 |
| 23 | 安全: canvas host 和 A2UI 资产需认证 | 2.6 | - | ❌ 缺失 | 资产安全 |
| 24 | 安全: skill/plugin 代码安全扫描器 | 2.6 | - | ❌ 缺失 | 代码安全 |
| 25 | 安全: config.get 响应中脱敏凭据 | 2.6 | - | ❌ 缺失 | 信息泄露 |
| 26 | 安全: 不可信渠道 metadata 排除出 system prompt | 2.3 | - | ❌ 缺失 | 注入防护 |

### 1.3 Agent 核心 (12项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 27 | inline models 继承 baseUrl/api | 1.29 | #2740 | 🔴 需验证 | **国产模型关键** |
| 28 | auto provider 正确应用 modelDefault | 1.29 | #2576 | ❌ 缺失 | 模型切换异常 |
| 29 | 跳过冷却中 providers (model failover) | 1.29 | #2143 | ❌ 缺失 | failover 效率 |
| 30 | memory.md 纳入 bootstrap | 1.29 | #2318 | ❌ 缺失 | 记忆功能不完整 |
| 31 | session locks 进程终止时释放 | 1.29 | #2483 | ✅ 已有等效 | 本地已实现 |
| 32 | auto-compact on context overflow | 1.24 | #1627 | ⚠️ 需对比 | 压缩恢复策略 |
| 33 | tool error fallback (防止 silent stops) | 1.23 | - | ❌ 缺失 | 工具调用失败处理 |
| 34 | 修复 malformed tool calls 和 session transcripts | 2.2 | #7473 | ❌ 缺失 | 工具调用修复 |
| 35 | validate AbortSignal before AbortSignal.any() | 2.2 | #7277 | ❌ 缺失 | 运行时崩溃 |
| 36 | system prompt safety guardrails | 2.1 | #5445 | ❌ 缺失 | 提示安全 |
| 37 | cap sessions_history payloads | 2.6 | - | ❌ 缺失 | 防 context overflow |
| 38 | compaction 多次重试 on context overflow | 2.6 | - | ❌ 缺失 | 稳定性 |

### 1.4 Windows 专项 (5项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 39 | XML escaping 用 `&` 替代 `<>` (NTFS) | 1.29 | #3750 | ❌ 缺失 | Windows 测试 |
| 40 | Windows ACL 审计测试修复 | 1.29 | #2403 | ❌ 缺失 | 安全检查 |
| 41 | Windows 平台标签正确识别 (node shell) | 1.24 | #1760 | ❌ 缺失 | shell 选择 |
| 42 | Windows gateway scheduled task as current user | 1.20 | - | ⚠️ 需对比 | 本地有 Windows service |
| 43 | Windows spawn .cmd 处理 | 2.1 | #5815 | ✅ 已有等效 | 本地已实现 |

---

## 二、🟡 P1 建议合并 (功能修复+增强)

### 2.1 CLI/配置 (15项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 44 | CLI compile cache (10%提速) | 1.29 | #2808 | ❌ 缺失 | 启动性能 |
| 45 | 全局 help/version 跳过 config 加载 | 1.29 | #2212 | ❌ 缺失 | CLI 启动慢 |
| 46 | 识别版本化 Node (node-22) | 1.29 | #2490 | ❌ 缺失 | Node 兼容性 |
| 47 | Config 拒绝无效/未知条目 | 1.20 | - | ❌ 缺失 | BREAKING: 配置验证 |
| 48 | Config 环境变量替换 (config.env) | 1.29 | #1813 | ❌ 缺失 | 配置灵活性 |
| 49 | Config stamp last-touched metadata | 1.20 | - | ❌ 缺失 | 配置管理 |
| 50 | config.patch gateway tool | 1.24 | #1653 | ❌ 缺失 | 远程配置 |
| 51 | Doctor: warn on gateway exposure without auth | 1.29 | #2016 | ❌ 缺失 | 安全提示 |
| 52 | CLI 避免 spinner 下提示 gateway runtime | 1.29 | #2874 | ❌ 缺失 | UX |
| 53 | CLI preserve cron delivery on edit | 1.20 | #1322 | ❌ 缺失 | cron 修复 |
| 54 | CLI sort commands alphabetically | 2.6 | - | ❌ 缺失 | UX |
| 55 | Gateway inject timestamps into agent messages | 2.1 | #3705 | ❌ 缺失 | 消息追踪 |
| 56 | Gateway require TLS 1.3 minimum | 2.1 | #5970 | ❌ 缺失 | 安全加固 |
| 57 | Config allow Perplexity as web_search provider | 1.20 | #1230 | ❌ 缺失 | web搜索 |
| 58 | Config allow custom fields under skills.entries | 1.20 | #1226 | ❌ 缺失 | 技能配置 |

### 2.2 UI/Web (12项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 59 | WebChat 自动扩展输入框 | 1.29 | #2950 | ❌ 缺失 | 输入体验 |
| 60 | WebChat 图片粘贴预览+仅图片发送 | 1.29 | #1925 | ❌ 缺失 | 图片体验 |
| 61 | Control UI 保持 sidebar 滚动可见 | 1.23 | #1515 | ❌ 缺失 | UI 修复 |
| 62 | Control UI 防止双滚动条 | 1.20 | #1283 | ❌ 缺失 | UI 修复 |
| 63 | Control UI 从 URL params 读 gatewayUrl | 1.20 | #1342 | ❌ 缺失 | 远程连接 |
| 64 | Control UI 有序列表编号保持 | 1.20 | #1341 | ❌ 缺失 | markdown |
| 65 | Control UI copy-as-markdown | 1.20 | #1345 | ❌ 缺失 | 复制体验 |
| 66 | Web UI token usage dashboard | 2.6 | - | ⚠️ 本地有 | 需对比完整度 |
| 67 | Control UI asset path 正确解析 | 2.2 | - | ❌ 缺失 | 路径修复 |
| 68 | Control UI basePath header logo 修复 | 2.3 | #7178 | ❌ 缺失 | 路径修复 |
| 69 | shell mode for sync Windows spawns (EINVAL) | 1.20 | #1212 | ❌ 缺失 | Windows UI build |
| 70 | refresh agent files after external edits | 2.2 | - | ❌ 缺失 | 文件监控 |

### 2.3 Memory 系统 (12项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 71 | hybrid BM25 + vector search (FTS5) | 1.20 | - | ✅ 已有 | 本地已实现 |
| 72 | SQLite embedding cache | 1.20 | - | ✅ 已有 | 本地已实现 |
| 73 | OpenAI batch indexing | 1.20 | - | ✅ 已有 | 本地已实现 |
| 74 | Gemini embeddings provider | 1.20 | #1151 | ✅ 已有 | 本地已实现 |
| 75 | sqlite-vec unique constraint 避免重复 | 1.20 | #1151 | ⚠️ 需对比 | 可能缺失 |
| 76 | index atomically (失败保留旧库) | 1.20 | #1151 | ⚠️ 需对比 | 原子性保障 |
| 77 | Memory search 允许额外路径 (#3600) | 1.29 | #3600 | ❌ 缺失 | 索引范围 |
| 78 | Memory L2-normalize vectors | 2.1 | #5332 | ⚠️ 需对比 | 语义搜索精度 |
| 79 | Memory retry transient 5xx errors | 1.20 | - | ❌ 缺失 | 稳定性 |
| 80 | Memory split embedding batches (token limits) | 1.20 | - | ❌ 缺失 | 大文件处理 |
| 81 | Memory skip empty chunks | 1.20 | - | ❌ 缺失 | 鲁棒性 |
| 82 | native Voyage AI embeddings | 2.6 | - | ❌ 缺失 | 新 provider |

### 2.4 Agent/模型 (10项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 83 | Anthropic prompt caching 1h + 可配 TTL | 1.20 | - | ❌ 缺失 | 成本优化 |
| 84 | Auth profiles auto-pin + failover rotation | 1.20 | #1138 | ❌ 缺失 | 认证容错 |
| 85 | Model catalog 避免缓存导入失败 | 1.20 | #1332 | ❌ 缺失 | 模型发现 |
| 86 | compaction safeguard 自适应分块+渐进回退 | 1.22 | #1466 | ❌ 缺失 | 压缩优化 |
| 87 | compaction 包含 tool failure summaries | 1.20 | #1084 | ❌ 缺失 | 防重试循环 |
| 88 | 子代理 announce thread/topic routing 保持 | 1.20 | #1241 | ❌ 缺失 | 路由稳定 |
| 89 | OpenRouter app attribution headers | 2.1 | - | ❌ 缺失 | OpenRouter 支持 |
| 90 | Anthropic ignore TTL for OAuth | 1.20 | - | ❌ 缺失 | OAuth 兼容 |
| 91 | Opus 4.6 + gpt-5.3-codex 前向兼容 | 2.6 | - | ❌ 缺失 | 新模型 |
| 92 | xAI (Grok) provider 支持 | 2.6 | - | ❌ 缺失 | 新 provider |

### 2.5 Media/TTS (8项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 93 | text attachment MIME 分类修复 (CSV/TSV/UTF-16) | 1.29 | #3628 | ❌ 缺失 | 文件识别 |
| 94 | TTS baseUrl 运行时读取 (honor config.env) | 1.29 | #3341 | ❌ 缺失 | **国产TTS** |
| 95 | MEDIA: tag 仅行首解析 | 1.23 | #1206 | ❌ 缺失 | 媒体标签 |
| 96 | PNG alpha 保留 + JPEG 回退 | 1.23 | #1491 | ❌ 缺失 | 图片质量 |
| 97 | SSRF guardrails on media provider fetches | 2.2 | - | ❌ 缺失 | 媒体安全 |
| 98 | skip binary media from file text extraction | 2.2 | #7475 | ❌ 缺失 | 媒体处理 |
| 99 | sandboxed media paths for message tool | 2.3 | #9182 | ❌ 缺失 | 媒体安全 |
| 100 | Edge TTS fallback (免费) + auto mode | 1.24 | #1668 | ⚠️ 本地有Edge | 需对比完整度 |

### 2.6 Exec 系统 (8项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 101 | exec approvals 迁移到 exec-approvals.json | 1.20 | - | ❌ 缺失 | 审批系统 |
| 102 | exec 默认 gateway/node security=allowlist | 1.20 | - | ❌ 缺失 | 安全默认 |
| 103 | exec prefer bash over fish | 1.20 | #1297 | ❌ 缺失 | shell 选择 |
| 104 | exec merge login-shell PATH | 1.20 | #1304 | ❌ 缺失 | PATH 管理 |
| 105 | /approve 跨所有渠道 | 1.24 | #1621 | ❌ 缺失 | 审批体验 |
| 106 | coerce bare string allowlist entries | 2.6 | - | ❌ 缺失 | 兼容性 |
| 107 | per-segment allowlists for chained commands | 1.22 | #1458 | ❌ 缺失 | 细粒度控制 |
| 108 | exec-approval coerce bare string entries | 2.6 | - | ❌ 缺失 | 兼容性 |

### 2.7 Streaming/协议 (4项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 109 | OpenAI SSE assistant deltas | 1.20 | #1147 | ❌ 缺失 | 流式输出 |
| 110 | flush block streaming on paragraph boundaries | 2.1 | #7014 | ❌ 缺失 | 流式分块 |
| 111 | stabilize partial streaming filters | 2.1 | - | ❌ 缺失 | 流式稳定 |
| 112 | per-channel responsePrefix overrides | 2.3 | #9001 | ❌ 缺失 | 渠道定制 |

---

## 三、🟢 P2 可选合并 (按需评估)

### 3.1 Telegram 增强 (25项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 113 | ✅ download timeout | 2.1 | #6914 | ✅ 已合并 | 2/4已合 |
| 114 | sticker 收发 + vision caching | 1.29 | #2629 | ❌ 缺失 | 新功能 |
| 115 | sticker pixels → vision models | 1.29 | #2650 | ❌ 缺失 | 新功能 |
| 116 | quote 回复支持 | 1.29 | #2900 | ❌ 缺失 | 新功能 |
| 117 | silent 静默发送 | 1.29 | #2382 | ✅ 已有 | 本地已实现 |
| 118 | 编辑已发消息 | 1.29 | #2394 | ❌ 缺失 | 新功能 |
| 119 | DM topics as sessions | 1.24 | #1597 | ❌ 缺失 | 会话管理 |
| 120 | link preview toggle | 1.24 | #1700 | ❌ 缺失 | 功能控制 |
| 121 | caption param for media sends | 1.29 | #1888 | ❌ 缺失 | 媒体功能 |
| 122 | plugin sendPayload channelData | 1.29 | #1917 | ❌ 缺失 | 插件功能 |
| 123 | keep topic IDs in restart sentinel | 1.29 | #1807 | ❌ 缺失 | 重启恢复 |
| 124 | HTML 嵌套修复 (overlapping styles) | 1.29 | #4578 | ❌ 缺失 | 格式修复 |
| 125 | react action 数字 ID | 1.29 | #4533 | ❌ 缺失 | react 修复 |
| 126 | undici fetch proxy dispatcher | 1.29 | #4456 | ❌ 缺失 | 代理修复 |
| 127 | video_note 处理 | 1.29 | #2905 | ❌ 缺失 | 媒体处理 |
| 128 | non-forum 忽略 thread_id | 1.29 | #2731 | ❌ 缺失 | session 修复 |
| 129 | reasoning italics per-line wrap | 1.29 | #2181 | ❌ 缺失 | 格式修复 |
| 130 | centralize API error logging | 1.29 | #2492 | ❌ 缺失 | 日志改进 |
| 131 | shared pairing store | 2.1 | #6127 | ❌ 缺失 | 配对管理 |
| 132 | grammY long-poll timeout recovery | 2.2 | #7466 | ❌ 缺失 | 轮询修复 |
| 133 | session model overrides in inline selection | 2.3 | #8193 | ❌ 缺失 | 模型选择 |
| 134 | forward_from_chat metadata | 2.3 | #8392 | ❌ 缺失 | 转发信息 |
| 135 | auto-inject DM topic threadId | 2.6 | - | ❌ 缺失 | DM 修复 |
| 136 | remove @ts-nocheck (3文件) | 2.3 | #9206 | ❌ 缺失 | 类型安全 |
| 137 | honor per-account proxy | 1.24 | #1774 | ❌ 缺失 | 代理支持 |

### 3.2 Discord (8项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 138 | username 目录查找恢复 | 1.29 | #3131 | ❌ 缺失 | 路由修复 |
| 139 | username → user ID (outbound) | 1.29 | #2649 | ❌ 缺失 | 发送修复 |
| 140 | configurable privileged intents | 1.29 | #2266 | ❌ 缺失 | 权限配置 |
| 141 | PluralKit proxied senders | 2.1 | #5838 | ❌ 缺失 | 允许列表 |
| 142 | parallel message handlers across sessions | 1.20 | #1295 | ❌ 缺失 | 性能 |
| 143 | inherit thread parent bindings | 2.1 | #3892 | ❌ 缺失 | 路由修复 |
| 144 | rate-limited allowlist resolution + command deploy | 1.23 | - | ❌ 缺失 | 防崩溃 |
| 145 | honor wildcard channel configs | 1.21 | #1334 | ❌ 缺失 | 配置灵活 |

### 3.3 Slack (5项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 146 | HTTP webhook mode (Bolt HTTP) | 1.20 | #1143 | ❌ 缺失 | 新连接模式 |
| 147 | clear ack reaction after streamed replies | 1.29 | #2044 | ❌ 缺失 | UX |
| 148 | harden media fetch limits + file URL validation | 2.1 | #6639 | ❌ 缺失 | 安全 |
| 149 | mention stripPatterns for /new /reset | 2.6 | - | ❌ 缺失 | 命令处理 |
| 150 | honor open groupPolicy for unlisted channels | 1.23 | #1563 | ❌ 缺失 | 策略修复 |

### 3.4 新渠道/插件 (10项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 151 | Nostr channel plugin | 1.20 | #1323 | ❌ 缺失 | 新渠道 |
| 152 | Tlon/Urbit channel plugin | 1.23 | #1544 | ❌ 缺失 | 新渠道 |
| 153 | LINE plugin (Messaging API) | 1.24 | #1630 | ⚠️ 已有基础 | 需对比 |
| 154 | BlueBubbles plugin 改进 | 1.20+ | - | ❌ 缺失 | iMessage |
| 155 | Zalo plugin → SDK runtime | 1.20 | - | ❌ 缺失 | 渠道迁移 |
| 156 | Matrix → matrix-bot-sdk + E2EE | 1.20 | #1298 | ❌ 缺失 | 加密支持 |
| 157 | Feishu/Lark plugin (上游版) | 2.2 | #7313 | ✅ 本地已有 | 本地更完善 |
| 158 | Moonshot (.cn) auth choice | 2.3 | #7180 | ❌ 缺失 | **国产模型** |
| 159 | Cloudflare AI Gateway provider | 2.3 | #7914 | ❌ 缺失 | 新 provider |
| 160 | Qwen Portal OAuth provider | 1.20 | #1120 | ✅ 本地已有 | 本地已实现 |

### 3.5 Cron 系统 (10项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 161 | announce delivery mode for isolated jobs | 2.3 | - | ❌ 缺失 | 新功能 |
| 162 | ISO 8601 schedule.at | 2.3 | - | ❌ 缺失 | 输入格式 |
| 163 | delete one-shot jobs after success | 2.3 | - | ❌ 缺失 | 清理策略 |
| 164 | suppress messaging tools during announce | 2.3 | - | ❌ 缺失 | 行为修正 |
| 165 | accept epoch timestamps in --at | 2.3 | - | ❌ 缺失 | 输入格式 |
| 166 | auto-deliver isolated output without tool calls | 1.20 | #1285 | ❌ 缺失 | 输出投递 |
| 167 | reload store on recreate/mtime change | 2.3 | - | ❌ 缺失 | 文件监控 |
| 168 | fix scheduling/delivery regressions | 2.6 | - | ❌ 缺失 | 稳定性 |
| 169 | allow "heartbeat" in event filter | 1.29 | #2219 | ❌ 缺失 | 过滤修复 |
| 170 | per-channel heartbeat visibility | 1.23 | #1452 | ❌ 缺失 | UI 控制 |

### 3.6 Sessions/Routing (8项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 171 | daily reset policy with per-type overrides | 1.20 | #1146 | ⚠️ 部分有 | 需对比 |
| 172 | sessions_spawn thinking override | 1.20 | - | ❌ 缺失 | 子代理控制 |
| 173 | per-account DM session scope | 1.29 | #3095 | ❌ 缺失 | 多账户隔离 |
| 174 | per-channel reset overrides | 1.21 | #1353 | ❌ 缺失 | 重置定制 |
| 175 | unify thread/topic allowlist matching | 1.20 | - | ❌ 缺失 | 统一路由 |
| 176 | precompile session key regexes | 1.29 | #1697 | ❌ 缺失 | 性能 |
| 177 | mirror outbound sends into target session keys | 1.23 | #1520 | ❌ 缺失 | session 同步 |
| 178 | heartbeat explicit accountId routing | 2.3 | #8702 | ❌ 缺失 | 多账户 |

### 3.7 Gateway/API 新功能 (8项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 179 | /v1/responses (OpenResponses) | 1.20 | #1229 | ❌ 缺失 | 新 API |
| 180 | /tools/invoke HTTP endpoint | 1.23 | #1575 | ❌ 缺失 | 新 API |
| 181 | /usage cost summaries | 1.20 | - | ⚠️ 部分有 | 需对比 |
| 182 | Node host (headless node) | 1.20 | - | ❌ 缺失 | 新功能 |
| 183 | Node daemon service | 1.20 | - | ❌ 缺失 | 新功能 |
| 184 | ACP (IDE integration) | 1.20 | - | ❌ 缺失 | 新功能 |
| 185 | Gateway dangerous Control UI device auth bypass | 1.29 | #2248 | ❌ 缺失 | 调试功能 |
| 186 | Browser route via gateway/node | 1.29 | - | ❌ 缺失 | 架构变更 |

### 3.8 Plugin 系统 (12项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 187 | manifest-embedded config schemas | 1.20 | #1272 | ❌ 缺失 | 插件验证 |
| 188 | channel catalog → plugin manifests | 1.20 | #1290 | ❌ 缺失 | 插件元数据 |
| 189 | plugin UI metadata drive labels/icons | 1.20 | #1306 | ❌ 缺失 | UI 改进 |
| 190 | auto-enable bundled plugins when config present | 1.20 | - | ❌ 缺失 | 自动激活 |
| 191 | sync plugin sources on channel switches | 1.20 | - | ❌ 缺失 | 插件同步 |
| 192 | llm-task JSON-only tool | 1.23 | #1498 | ❌ 缺失 | 工作流 |
| 193 | plugin slots + memory slot selector | 1.20 | - | ❌ 缺失 | 插件内存 |
| 194 | validate plugin/hook install paths | 2.1 | - | ❌ 缺失 | 安全 |
| 195 | agent avatar support | 1.20 | #1329 | ❌ 缺失 | 个性化 |
| 196 | per-sender group tool policies | 1.29 | #1757 | ❌ 缺失 | 权限细化 |
| 197 | optional agent tools with explicit allowlists | 1.20 | - | ❌ 缺失 | 工具控制 |
| 198 | plugin tool authoring guide | 1.20 | - | ❌ 缺失 | 文档 |

### 3.9 诊断/日志 (5项)

| # | 变更 | 版本 | PR | 本地状态 | 说明 |
|---|------|------|-----|---------|------|
| 199 | OTLP logs export | 1.20 | - | ⚠️ 有扩展 | diagnostics-otel |
| 200 | message-flow diagnostics via shared dispatch | 1.20 | #1244 | ❌ 缺失 | 消息追踪 |
| 201 | diagnostic flags for targeted debug | 1.24 | - | ❌ 缺失 | 调试标志 |
| 202 | gate heartbeat/webhook logging | 1.20 | #1244 | ❌ 缺失 | 日志控制 |
| 203 | config invalid issues log once per run | 1.20 | - | ❌ 缺失 | 日志去重 |

---

## 四、⏸️ 需评估后决定 (重大变更)

### 4.1 pi-ai 升级 (0.49.3 → 0.52.7)

| 维度 | 详情 |
|------|------|
| **当前版本** | @mariozechner/pi-agent-core 0.49.3 |
| **上游版本** | pi-mono 0.52.7 |
| **影响范围** | 50+ 文件，65+ 处调用 |
| **关键变更** | `cacheControlTtl` → `cacheRetention`, `discoverAuthStorage`/`discoverModels` 导出变更, `CreateAgentSessionOptions` 结构变更 |
| **预计工时** | 2-3 天 |
| **建议** | 等 0.53+ 稳定后再升级 |
| **下次评估** | 2026-03-15 |

### 4.2 QMD Memory 后端

| 维度 | 详情 |
|------|------|
| **上游引入** | 2026.2.2 (#3160) |
| **技术依赖** | Bun, ~2.1GB GGML 模型 |
| **本地替代** | SQLite FTS5 + sqlite-vec + BM25/vector hybrid |
| **建议** | 本地方案够用，暂不引入 |
| **下次评估** | 视用户反馈 |

### 4.3 Agents Dashboard (Web UI)

| 维度 | 详情 |
|------|------|
| **上游引入** | 2026.2.2 |
| **功能** | 管理 agent files, tools, skills, models, channels, cron |
| **冲突** | 与本地 UI 定制冲突 |
| **建议** | 暂缓，评估是否参考架构 |

### 4.4 子代理 thinking 配置

| 维度 | 详情 |
|------|------|
| **上游引入** | 2026.2.2 (#7372) |
| **功能** | `agents.defaults.subagents.thinking` |
| **建议** | 非核心，可延后 |

### 4.5 CLI Shell Completion

| 维度 | 详情 |
|------|------|
| **上游版本** | 2.1 (#4502), 2.3 |
| **功能** | Zsh/Bash/PowerShell 补全 |
| **注意** | 路径使用 .openclaw，需改为 .clawdbot |
| **建议** | 可在中文版增加 PowerShell 补全 |

---

## 五、❌ 永不合并

| # | 变更 | 原因 |
|---|------|------|
| 1 | npm 包/CLI 重命名为 `openclaw` | 保持 clawdbot 品牌 |
| 2 | macOS Bundle ID 变更 | Windows 为主 |
| 3 | launchd labels 变更 (bot.molt) | 保持 com.clawdbot |
| 4 | session-logs 路径 .clawdbot → .openclaw | 保持 .clawdbot |
| 5 | Gateway auth mode "none" 移除 | 保留 loopback 无认证 |
| 6 | tsdown/tsgo 构建系统 | 构建系统差异 |
| 7 | Bonjour DNS-SD 服务类型改名 | 本地网络发现 |
| 8 | config 自动迁移 legacy 路径 | 无遗留路径问题 |
| 9 | 品牌 README/docs 更新 | 本地文档独立 |
| 10 | CI formal conformance checks | 本地 CI 独立 |
| 11 | macOS 特定 UI 改进 (6项) | Windows 为主 |
| 12 | iOS/Android transport 改进 | 暂无移动端 |
| 13 | Peekaboo/Swabble SPM 迁移 | macOS 专用 |
| 14 | Docker/Fly 部署指南 | 本地部署方式不同 |
| 15 | 上游贡献者致谢段落 | 内部项目 |

---

## 六、瀑布式推进计划 (修订版)

### Phase 0: 环境准备 (1天)

```
□ 创建 feature/upstream-sync-2026.2.6 分支
□ 备份当前代码
□ 记录当前测试状态 (pnpm test baseline)
□ 准备对照上游代码 (git remote add upstream)
```

### Phase 1: 安全+稳定性紧急修复 (3天)

```
范围: 上表 P0 项 #1-#43
涉及模块:
  - src/infra/unhandled-rejections.ts (网络错误码)
  - src/gateway/ (崩溃防护, 单例锁, heartbeat)
  - src/security/ (DNS pinning, mDNS, hook包裹)
  - src/agents/pi-embedded-runner/ (baseUrl, modelDefault)
  - src/agents/ (memory.md bootstrap, AbortSignal, tool修复)
  - src/process/exec.ts (Windows 安全)
  - 各渠道安全修复

验证:
  □ pnpm test (全量)
  □ 国产模型 API 调用测试 (通义/DeepSeek/智谱/豆包)
  □ Windows 环境测试
  □ Gateway 长时间运行测试
```

### Phase 2: 核心功能修复 (4天)

```
范围: 上表 P1 项 #44-#112
涉及模块:
  - src/cli/ (compile cache, argv, help)
  - src/config/ (validation, env substitution, patch)
  - ui/src/ (UI 修复 12项)
  - src/memory/ (原子索引, vector normalize, retry)
  - src/agents/ (compaction, auth profiles, catalog)
  - src/media/ (MIME, PNG alpha, MEDIA tag)
  - src/tts/ (baseUrl runtime, Edge mode)
  - src/process/ (exec approvals, PATH)
  - src/auto-reply/ (streaming)

验证:
  □ UI 界面回归测试
  □ Memory search 精度测试
  □ TTS 功能测试 (Edge + OpenAI)
  □ Exec approval 流程测试
```

### Phase 3: 渠道增强 (3天)

```
范围: 上表 P2 Telegram/Discord/Slack 项 #113-#150
涉及模块:
  - src/telegram/ (sticker, quote, edit, DM topics)
  - src/discord/ (username, intents, threading)
  - src/slack/ (HTTP webhook, ack reaction, media)

验证:
  □ Telegram Bot 端到端测试
  □ Discord Bot 连接测试
  □ 国产渠道 (飞书/钉钉/企微) 回归测试
```

### Phase 4: 新功能选择性引入 (3天)

```
范围: 上表 P2 新渠道/API/Plugin 项 #151-#203
选择性移植:
  - Gateway /v1/responses API (如需要)
  - Plugin manifest 系统升级
  - Cron announce delivery
  - Moonshot (.cn) auth choice
  - Diagnostics/logging 改进

验证:
  □ 新功能 demo 测试
  □ 完整构建 + 安装包生成
```

### Phase 5: pi-ai 升级评估 (预计2026-03)

```
条件: 上游 pi-mono >= 0.53 且稳定
范围:
  - cacheControlTtl → cacheRetention
  - discoverAuthStorage/discoverModels API变更
  - CreateAgentSessionOptions 结构变更
预计: 2-3 天
```

### Phase 6: QMD/Dashboard 评估 (视需求)

```
条件: 用户反馈需要 + 技术依赖可行
范围:
  - QMD Memory 后端 (需 Bun)
  - Agents Dashboard (需与本地 UI 协调)
  - 子代理 thinking 配置
```

---

## 七、关键风险提示

| 风险 | 等级 | 缓解 |
|------|------|------|
| baseUrl 继承修复影响国产模型 | 🔴 P0 | 修复后立即测试四大国产模型 |
| config 拒绝无效条目 (BREAKING) | 🔴 高 | 需先运行 doctor --fix |
| pi-ai 升级影响范围大 | 🟡 中 | 延后到 Phase 5 |
| 品牌命名冲突 | 🟢 低 | 手动适配，忽略重命名 commit |
| 本地 UI 定制与上游 Dashboard 冲突 | 🟡 中 | 选择性引入组件 |
| Gateway auth mode none 移除 | 🟡 中 | 保留本地行为 |

---

## 八、附录: 已完成项目 (2026-02-04 同步)

| # | 项目 | 状态 | 完成日期 |
|---|------|------|---------|
| 1 | SSRF 防护 (validateUrlForSsrf) | ✅ 已合并 | 2026-02-04 |
| 2 | cwd 路径注入验证 (validateCwdPath) | ✅ 已合并 | 2026-02-04 |
| 3 | Telegram 超时处理 (fetchWithTimeout) | ✅ 已合并 | 2026-02-04 |

## 九、附录: 本地特有功能 (不受上游影响)

| 模块 | 路径 | 说明 |
|------|------|------|
| 授权系统 | src/license/ | 设备ID、心跳签名、离线模式、通知系统 |
| 授权 UI | ui/src/ui/license/ | 激活弹窗、QR码 |
| 免费模型调度 | src/auto-reply/reply/free-model-priority.ts | 国产免费模型轮换 |
| 中国区配置 | src/config/region-cn.ts | 国内 AI 提供商配置 |
| 国内镜像 | src/agents/skills/mirror-download-engine.ts | npm/pip/go 镜像 |
| 钉钉扩展 | extensions/dingtalk/ | AI Card 流式 + 会话管理 |
| 飞书扩展 | extensions/feishu/ | WebSocket + @ 提及转发 |
| 企业微信 | extensions/wecom/ | 多账户 + 群聊支持 |
| QQ Bot | extensions/qqbot/ | QQ 机器人渠道 |
| Windows 安装 | scripts/windows/, build/ | Inno Setup + 中文汉化 |
| Windows 服务 | scripts/windows/native/ClawdbotService.cs | .NET Windows Service |
| Gateway 授权检查 | src/gateway/license-check.ts | 授权系统集成 |
| 配置向导 (中国定制) | src/gateway/setup-wizard.ts | 国产模型/渠道引导 |
| 安全模式 UI | ui/src/ui/views/overview.ts | 三级安全模式选择 |
| 配置清理器 | src/config/config-sanitizer.ts | 配置脱敏 |
| i18n 中文 | ui/src/ui/i18n/locales/zh-CN.ts | 完整中文翻译 |
| 反调试 | src/security/anti-debug.ts | 软件保护 |

---

*本清单基于逐行扫描 upstream_changelog.md (2026.1.5→1.29) + GitHub releases (2026.2.1→2.6) + 本地代码库全模块对比生成。共计 203+ 条变更追踪项，零遗漏。*
