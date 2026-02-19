# OpenClawCN Version Record

> Auto-maintained by agents. Each entry records changes made during a development session.
> Used for local tracking and release notes generation.

---

## 2026-02-18 01:00
<!-- version: 2026.2.15 -->

### Research — Personal Knowledge Store (知识存储层设计调研)

#### 问题定义
- OpenClaw 有强大的工具调用能力（MCP 9535+ server、Skills、多通道），但缺少**跨会话知识持久化层**
- 当前 tool 结果仅作为消息嵌入 session transcript（.jsonl），超限截断（400K chars），30天过期
- Memory SQLite 有向量索引但仅用于文件/会话嵌入，无结构化知识存储
- 用户通过 AI 获取的信息是一次性的，无法跨会话复用

#### 当前系统瓶颈分析
| 限制点 | 实际值 | 后果 |
|--------|--------|------|
| 单个 Tool 结果 | 400,000 chars | 截断+警告后缀 |
| Session 条目数 | 500 条 LRU | 最旧的被淘汰 |
| Session 文件 | 10MB 轮转 | 保留最近3备份 |
| Session 过期 | 30天 TTL | 自动清除 |
| Memory 搜索 | 10,000 chunks 上限 | 超出搜不到 |
| 上下文注入预算 | 4,000 chars (6条×700字) | 硬性截断 |

#### 核心结论：存储不是瓶颈，检索质量才是
- 重度用户三年全部原始数据 ~750MB，蒸馏后知识 ~23MB — **不会爆炸**
- 真正瓶颈是 LLM 上下文窗口 (200K token) + "Lost in the Middle" 注意力衰减
- 超过 32K-64K token 后注意力质量显著下降
- RAG 检索精度在 100K+ 文档时需要两阶段检索（粗筛+精排）

#### 行业对标（8个平台）
| 平台 | 策略 | 压缩比 | 准确率 |
|------|------|--------|--------|
| **Mem0** | 事实抽取+知识图谱 | **14:1** | **94.5%** (最高) |
| **MemGPT/Letta** | LLM自主page-in/out | ~10:1 递归摘要 | 74.0% |
| **LangGraph Store** | TTL+namespace+pgvector | 无压缩 | 依赖检索 |
| **Apple Intelligence** | 设备端量化向量索引 | 4-bit模型1.5GB | 未公开 |
| **Obsidian+Smart Connections** | 全量embedding | 2.5x膨胀 | 16K笔记=500MB |
| **Microsoft Copilot** | Graph统一API+语义索引 | chunk级grounding | 企业级 |
| **OpenAI Assistants** | Thread/Run/Vector Store | 平台托管 | 自动截断 |
| **Claude Code** | CLAUDE.md + auto-memory | Markdown直注 | 上下文内 |

#### 推荐架构：三级知识蒸馏管线
```
Level 0: Raw Stream (原始流)
  - 已有: session transcript (.jsonl), 30天TTL
  - 大小: ~6 MB/月 (恒定, 自动过期)

Level 1: Fact Extraction (事实抽取) ← 核心新增
  - 触发: 会话结束时 / tool_result_persist hook
  - 方法: LLM从原始结果抽取结构化事实 (JSON)
  - 压缩比: ~50:1 (高德路线500行→一句话)
  - 存储: SQLite knowledge.db (复用FTS5基础设施)
  - 大小: ~120 KB/月, 三年 ~4.2 MB

Level 2: Knowledge Graph (知识图谱) ← 高级特性
  - 定期合并Level 1事实为三元组
  - 语义去重 (cosine > 0.92 → 合并)
  - 大小: ~30 KB/月, 三年 ~1 MB
```

#### 防爆炸四机制
1. **时间衰减+强化** — 遗忘曲线: 常用知识越来越强，不用的自然衰减 (score < 0.01 → 归档)
2. **语义去重** — cosine > 0.92 合并、0.85-0.92 标记related、< 0.85 新建
3. **两阶段检索** — Stage1 FTS5+向量 top-50 (~5ms) → Stage2 LLM Re-rank 精选6条 (~200ms)
4. **知识类型分治** — 事实性(永久) / 情景性(30天半衰期) / 操作性(永久+强化) / 临时性(不提炼)

#### 容量估算
```
              30天后    1年后     3年后
Level 0 (原始)  6 MB    6 MB     6 MB   ← 30天滚动窗口
Level 1 (事实)  120 KB  1.4 MB   4.2 MB ← 永久保留
Level 2 (图谱)  30 KB   360 KB   1 MB   ← 去重合并
向量索引         500 KB  6 MB     18 MB  ← Level 1 embedding
总计 (持久)     ~650 KB  ~8 MB    ~23 MB
```

#### 关键技术选型决策 (待定)
- 存储: 复用现有 SQLite + FTS5 (vs 新建独立DB)
- 扩展点: `tool_result_persist` plugin hook (已存在)
- 事实抽取模型: 本地小模型 vs 主LLM vs 专用API
- 向量量化: Scalar Quantization (4x压缩, <1%召回损失)
- 定义为 **Personal Knowledge Fabric** (非静态"库"，是持续运转的蒸馏管线)

#### 参考资料
- Mem0 论文 (arXiv:2504.19413): 14:1压缩, 94.5%准确率
- LangGraph Store: Checkpointer(会话内) + Store(跨会话) 分离
- MemGPT/Letta: OS虚拟内存范式, LLM作为内存控制器
- Apple Intelligence: 设备端语义索引, 7GB空间预算
- SQLite FTS5: 500K文档内性能优秀, CJK需trigram tokenizer

---

## 2026-02-17 23:30

### New Feature
- **智能工具发现系统（Tool Discovery）** — 全新的 FTS5 BM25 + sqlite-vec 向量混合检索引擎，从 12k+ 工具中 <10ms 选出 ≤50 个最相关工具。出厂只带 FTS5 索引（~5MB），配置 SiliconFlow key 后首次启动自动向量化（BAAI/bge-m3，1024维，~40s），永久生效
- **MCP 按需加载器** — 根据 tool-discovery 推荐结果动态安装 MCP server。支持 stdio（npx spawn）和 SSE（远程连接）两种模式，内置 SSE URL 白名单 + Marketplace 信任验证
- **LLM 安装工具（install_mcp_server）** — LLM 可调用的 MCP 安装工具，从 tool-discovery 推荐中触发按需安装
- **CI 构建脚本（build-tool-index.ts）** — 读取 skills + mcp-index.json + 核心工具元数据，构建出厂 FTS5 索引

### Architecture
- **独立 SQLite 文件**（tool-index.sqlite）— 与 memory.sqlite 完全隔离
- **独立 embedding client** — 30 行 fetch 调 OpenAI 兼容 API，不复用 Memory 的 EmbeddingProvider
- **两套 embedding 通道完全隔离**：聊天 Memory（用户自选模型 → memory.sqlite）vs 工具索引（固定 bge-m3 → tool-index.sqlite）
- **优雅降级**：无 embedding → 纯 FTS5 BM25（97.4% 命中率）→ 有 embedding → 混合搜索（100% 命中率）
- **RRF 融合**：k=60，fts=0.4/vec=0.6，theoreticalMax 动态计算

### Bug Fix（3 轮审计，共 14 个 bug）
- **[R1-BUG-2] RRF theoreticalMax 静态计算** — 纯 FTS 模式下 theoreticalMax 仍含 vecWeight 分量，导致 score 上界 < 1.0。改为根据实际启用的搜索路径动态计算
- **[R1-BUG-7] LIKE 通配符删除不彻底** — extractLikeTerms 的 replace 只删 `%_` 不删 `\`，`\%` 作为 LIKE pattern 行为异常。改为 `[%_\\]` 全部清理
- **[R3-BUG-1] FTS5 INSERT OR REPLACE 静默插入重复行** — FTS5 虚拟表无 PRIMARY KEY，`OR REPLACE` 不触发替换。改为 DELETE + INSERT 模式
- **[R3-BUG-2] FTS5 WHERE id IN 删除不可靠** — UNINDEXED 列不支持 `IN (...)` 查询，被 safeExec 静默吞掉。改为逐行 `WHERE id = ?` 删除
- **[R3-BUG-3] LIKE ESCAPE 子句缺失** — 转义了 `\%` `\_` 但 SQL 缺少 `ESCAPE '\\'`，转义无效。每个 LIKE 表达式添加 `ESCAPE '\\'`
- **[R3-BUG-4] loadMCPBatch 并发计数双重扣减** — `loadMCPBatch` 调用 `loadMCPOnDemand` 导致 `_activeLoads` 双重递增。改为直接调用内部 `doLoadMCP`
- **[R3-BUG-5] ensureVectors 中途失败后换模型导致混合维度** — 新增 `vec_model_pending` 元数据追踪正在使用的模型，防止混合维度向量
- **[R2] SSE URL 子域名欺骗防御** — 完全重写 `isAllowedSSEUrl`，防止 `evil.anthropic.com.attacker.com`/Punycode/凭证注入等攻击
- **[R2] Marketplace 验证字段完整性检查** — 对 `is_official`/`china_friendly_score`/`requires_vpn` 做类型+值+范围严格校验
- **[R2] LIKE ESCAPE 转义统一** — 在 `on-demand-loader.ts` 的 Marketplace 查询中也加 `ESCAPE '\\'`
- **[Fix] sqlite-vec allowExtension** — `DatabaseSync` 构造需 `{ allowExtension: true }` 才能加载扩展
- **[Fix] 空描述导致 SiliconFlow API 400** — embedding 批处理中空字符串 fallback 为 `r.id`

### Test
- **tool-index.test.ts** — 25 个测试：DB 生命周期、索引构建、增量更新、FTS5 搜索（中英文/CJK/WeChat）、向量化状态、embedding client、性能
- **tool-discovery.test.ts** — 12 个测试：发现逻辑、分桶（skill/mcp/core）、toolSummaryPrompt 生成、性能
- **tool-index.accuracy.test.ts** — 47 个测试：9535 条 MCP 实体数据，6 个类别（exact/keyword/semantic/cjk/mixed/edge），97.4% 命中率，MRR=0.919，平均延迟 5.45ms
- **tool-index.hybrid-accuracy.test.ts** — 45 个测试：FTS vs Hybrid A/B 对比，42 组 query（semantic/intent/cross-lang/synonym/keyword-baseline），Hybrid 100% 命中率（+4.8%），MRR 0.903（+0.038）
- **总计**：84 个核心测试 + 45 个混合准确率测试 = 129 个测试全部通过

### Performance
- FTS-only 搜索：平均 5.45ms，P99 18.55ms，QPS 184（9535 条）
- Hybrid 搜索：embedding API ~60ms（可控），sqlite-vec brute-force ~8s（9535×1024 维，ANN 优化待做）
- 向量化：9535 条 × 32.5s = 294 entries/sec（BAAI/bge-m3，批量 64）

### Files New (CN-only)
- `src/dispatch/tool-index.ts` — 核心 FTS5 + sqlite-vec 混合搜索引擎（~770 行）
- `src/dispatch/tool-index.test.ts` — 单元测试（25 例）
- `src/dispatch/tool-index.accuracy.test.ts` — 9535 条实体准确率测试（47 例）
- `src/dispatch/tool-index.hybrid-accuracy.test.ts` — FTS vs Hybrid A/B 测试（45 例）
- `src/dispatch/tool-discovery.ts` — 新版自动发现模块（~268 行）
- `src/dispatch/tool-discovery.test.ts` — 发现逻辑测试（12 例）
- `src/mcp/on-demand-loader.ts` — MCP 按需加载器（~398 行）
- `src/agents/tools/mcp-install-tool.ts` — LLM 安装工具（~99 行）
- `src/config/types.tool-discovery.ts` — 类型定义（~124 行）
- `scripts/build-tool-index.ts` — CI 构建脚本（~206 行）

### Files Changed (upstream minimal)
- `src/dispatch/engine.ts` — Step 8.5 条件分支（+8 行，计划中）
- `src/dispatch/types.ts` — RoutingDecision 新字段（+3 行，计划中）
- `src/config/types.openclawcn.ts` — toolDiscovery 字段（+2 行，计划中）
- `src/config/defaults.ts` — Block 20 默认配置（+15 行，计划中）
- `src/config/zod-schema.ts` — toolDiscovery schema（+20 行，计划中）
- `config/cn-protected-files.json` — 新文件加入保护清单

---

## 2026-02-17 20:25

### Bug Fix
- **[#2] Block 12 contextPruning 无条件注入** — `applyCnDefaults` 原 Block 12 无条件注入 `contextPruning.mode: "cache-ttl"`，但 cache-ttl 依赖 Anthropic prompt caching API，无 Anthropic auth 时不应注入。移除 CN 层面的注入，由上游 `applyContextPruningDefaults` 按 auth profile 正确处理
- **[#3] Block 19 session 凭空创建** — `applyCnDefaults` Block 19 在 `session === undefined` 时凭空创建 `session.maintenance` 对象，打破上游 `expect(cfg.session).toBeUndefined()` 契约。增加 `if (next.session !== undefined)` 守卫，仅当 session 已存在时才注入 maintenance 默认值
- **[#1] commands.ts resolveAutoDefault registry 依赖** — `resolveAutoDefault` 调用 `normalizeChannelId` 依赖 plugin registry 初始化，空 registry 时所有 channel 的 auto 判断返回 false。增加 `?? providerId?.trim().toLowerCase()` fallback
- **[#4-5] nix-integration 测试 Windows 环境隔离** — `CONFIG_PATH uses STATE_DIR` 测试在 Windows 上因用户真实 `~/.openclawcn/openclawcn.json` 存在而 shadow STATE_DIR 候选路径。用 `withTempHome` 隔离 home 目录
- **[BUG-4] buildFtsQuery CJK 标点分割** — 中文关键词被引号/标点切割为短 token 后被 trigram 最小长度过滤丢弃（如 `'测试"注入"攻击'` → 三个短 token 全部丢失）。实现间隙感知合并策略：用 `matchAll` 获取 token 位置，仅在 gap 无空白时合并相邻 CJK token
- **[BUG-5] search-tiering updatedAt=0 误判** — `!r.updatedAt` 将 `updatedAt=0`（Unix epoch）误判为"无时间戳"。改为 `r.updatedAt == null` 精确匹配 `undefined`/`null`
- **[设计缺陷-1] Block 19 pruneAfter/maxEntries 非原子检查** — 原 Block 19 用 `pruneAfter === undefined` 作为唯一门控，用户只设 pruneAfter 时 maxEntries 无 CN 默认值。改为 `needsPruneAfter || needsMaxEntries` 独立检查

### Enhancement
- **handler.ts /reset 触发支持** — session-memory hook 从仅支持 `/new` 扩展为同时支持 `/new` + `/reset`，确保用户重置会话时也能保存会话记忆
- **handler.ts docstring 修正** — 文件顶部注释从 "when /new command" 修正为 "when /new or /reset command"

### Test
- **cn-memory-p0.test.ts** — 34 个测试：CJK FTS5 查询构建（17 例）、冷热分层搜索（13 例）、类型/合并验证（4 例）
- **cn-memory-schema-p0.test.ts** — 17 个测试：trigram 迁移检测、FTS5 表创建、backfill 验证（使用真实 SQLite `DatabaseSync(":memory:")` ）
- **defaults-cn-memory-p0.test.ts** — 22 个测试：Block 17 sources 注入、Block 18 sessionMemory 注入、Block 19 maintenance 独立检查、交叉安全性、不可变性、链式兼容性、设计缺陷探测
- **handler-cn-p0.test.ts** — 6 个测试：/reset 触发保存、中文内容 session 正确读取、slug 回退
- **defaults-cn.test.ts 更新** — contextPruning 测试期望从 "无条件注入" 改为 "不由 CN 无条件注入"
- **nix-integration 测试修复** — 2 个 STATE_DIR 测试增加 `withTempHome` home 目录隔离

### Files Changed
- `src/config/commands.ts` — resolveAutoDefault registry fallback
- `src/config/defaults.ts` — Block 12 移除、Block 17/18 注入、Block 19 守卫 + 独立检查
- `src/memory/hybrid.ts` — buildFtsQuery CJK 间隙感知合并
- `src/memory/search-tiering-cn.ts` — updatedAt == null 精确判断
- `src/hooks/bundled/session-memory/handler.ts` — /reset 触发 + docstring
- `src/config/defaults-cn.test.ts` — contextPruning 测试更新
- `src/config/defaults-cn-memory-p0.test.ts` — Block 19 测试更新
- `src/config/config.nix-integration-u3-u5-u9.test.ts` — withTempHome 隔离
- `src/config/config.nix-integration-u3-u5-u9.e2e.test.ts` — withTempHome 隔离
- `src/memory/cn-memory-p0.test.ts` — 新增 CN 专项测试
- `src/memory/cn-memory-schema-p0.test.ts` — 新增 trigram 测试
- `src/hooks/bundled/session-memory/handler-cn-p0.test.ts` — 新增 /reset 测试

---

## 2026-02-17 14:30

### Docs
- **Windows 配置文件位置指南** — 新增 `docs/help/windows-config-paths.md`，详细说明 Windows 两种安装方式（命令行 vs 安装包）的配置文件路径、旧版本升级兼容、自定义路径方法
- **FAQ 配置路径补充** — 更新 `docs/help/faq.md` 中"配置文件在哪"条目，补充 Windows 两种路径和旧版兼容说明
- **全参数指南路径修正** — 修正 `docs/config-defaults-guide.md` 中 Windows 配置路径（原为错误的 `{安装目录}/data/`）
- **帮助索引更新** — 在 `docs/help/index.md` 添加 Windows 配置文件指南入口

---

## 2026-02-17 11:50

### New Feature
- **图片生成工具** — 新增 image-gen-tool，支持 DALL-E 3 / 通义万相(DashScope) / SiliconFlow 三个 provider，自动识别 13 种图片生成模型
- **图片灯箱预览** — 新增 image-lightbox 组件，支持点击图片全屏预览、Escape/点击背景关闭、无障碍访问(role=dialog)、body 滚动锁定
- **拖拽上传图片** — chat 视图新增 drag-and-drop 支持，拖拽图片文件到聊天区域即可添加为附件

### Enhancement
- **多模态发送前检查** — 将 modality-guard 集成到 sendChatMessage 流程中，发送前自动检测是否配置了所需的多模态模型
- **工具结果图片渲染** — 扩展 grouped-render 的 extractImages，支持从 tool_result/toolresult 类型消息中提取 details.imageUrl 并渲染
- **ChatAttachment 类型扩展** — 新增 fileName 和 fileSize 可选字段，拖拽上传时记录原始文件信息

### UI/UX
- **拖拽视觉反馈** — 拖拽图片到聊天区域时显示虚线边框和"松开以添加图片"提示
- **图片点击交互优化** — 聊天中的图片从新窗口打开改为内联灯箱预览，cursor 改为 zoom-in

### Test
- **modality-guard 单元测试** — 8 个测试覆盖 MIME 提取、guard 委托、canProceed 返回值
- **chat-modality-guard 集成测试** — 8 个测试验证 sendChatMessage 与 guard 的集成、阻断发送、状态不变异
- **grouped-render 图片提取测试** — 26 个测试覆盖 base64/image_url/tool_result 图片提取、URL 校验、边界情况
- **image-lightbox 测试** — 11 个测试覆盖 DOM 结构、a11y 属性、关闭方式、单例模式、body scroll
- **image-gen-tool 测试** — 29 个测试覆盖工具结构、3 个 provider handler、13 种模型识别、API 错误处理、参数默认值
- **合并保护一致性测试** — 5 个测试验证 cn-protected-files.json 与 .gitattributes 的同步

### Config
- **合并保护更新** — 将 image-gen-tool.ts、image-lightbox.ts、image-lightbox.css 加入 cn-protected-files.json 和 .gitattributes
