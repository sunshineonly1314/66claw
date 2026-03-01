# OpenClawCN 记忆系统全景分析 (Memory System Full Landscape)

> 分析时间: 2026-03-01 | 分析范围: 完整代码库 | 分析类型: 架构 + 问题 + 修复

---

## 一、记忆分层架构总览

```
┌──────────────────────────────────────────────────────────────────────┐
│                      OpenClawCN 记忆全景                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  L0: Session Context (短期记忆 / Working Memory)              │    │
│  │  ├─ Chat JSONL 会话记录                                       │    │
│  │  ├─ Memory Flush (压缩前刷盘 → memory/YYYY-MM-DD.md)         │    │
│  │  ├─ Conversation Compactor (multi-agent 活动摘要, 500char)    │    │
│  │  └─ Context Window Token 管理                                 │    │
│  └───────────────────────────┬─────────────────────────────────┘    │
│                               │ 提取 / 淘汰                         │
│  ┌───────────────────────────▼─────────────────────────────────┐    │
│  │  L1: Hot Profile (热记忆 / Structured Facts)                  │    │
│  │  ├─ memory/profile.json (≤80 条, 每轮注入 system prompt)     │    │
│  │  ├─ 分类: identity/correction/procedure/preference/fact/todo  │    │
│  │  ├─ 评分公式: weight + 0.15*hits^0.7 + 0.3*0.5^(age/14)     │    │
│  │  ├─ 保护机制: identity/correction 各保 15 个槽位              │    │
│  │  ├─ 淘汰策略: 超 80 条 → evictByScore → archive             │    │
│  │  ├─ 工具: memory_upsert / memory_forget (agent 自主写入)      │    │
│  │  └─ 共享: memory_share (multi-agent 跨 agent 同步)            │    │
│  └───────────────────────────┬─────────────────────────────────┘    │
│                               │ 淘汰归档 (hits≥1, score≥0.5)       │
│  ┌───────────────────────────▼─────────────────────────────────┐    │
│  │  L2: Cold Archive (冷记忆 / Searchable Archive)               │    │
│  │  ├─ memory/profile-archive.md (200KB × 10 旋转 ≈ 2MB)        │    │
│  │  ├─ MEMORY.md + memory/*.md (用户手写笔记)                    │    │
│  │  ├─ Session Transcripts (JSONL 历史对话)                      │    │
│  │  ├─ 索引: SQLite + FTS5 (trigram/CJK) + sqlite-vec (向量)    │    │
│  │  ├─ 嵌入: OpenAI / Gemini / Voyage / Local (node-llama-cpp)  │    │
│  │  ├─ 搜索: Hybrid (BM25 + Vector cosine) + MMR 多样性重排     │    │
│  │  ├─ 冷热分层: Hot(7d) → Warm(30d) → Cold(120d) → Full       │    │
│  │  └─ 检索注入: profile-retrieval.ts (max 5条, 600chars)        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Media Memory (媒体记忆 / 独立存储)                            │    │
│  │  ├─ media-metadata.sqlite (图片/视频元数据索引)                │    │
│  │  ├─ chat-image-store.ts (磁盘文件 + manifest + SQLite双写)    │    │
│  │  ├─ chat-video-store.ts (磁盘文件 + manifest + SQLite双写)    │    │
│  │  ├─ TTL: 图片7天/AI图30天/视频365天                           │    │
│  │  └─ 维护: 过期删除 + 1000条上限 + incremental vacuum          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Multi-Agent Memory (多 agent 协作记忆)                       │    │
│  │  ├─ shared-profile-store.ts (跨 agent 共享 profile)           │    │
│  │  ├─ learning-engine.ts (监督者自学习, 路由模式/特长画像)       │    │
│  │  ├─ soul-optimizer.ts (SOUL 配置自优化)                       │    │
│  │  ├─ conversation-compactor.ts (活动摘要压缩)                  │    │
│  │  └─ supervisor-soul.ts (监督者上下文注入)                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Skills/MCP Memory (技能入库)                                  │    │
│  │  ├─ skills/triple-memory/ (三级记忆技能)                       │    │
│  │  ├─ skills/shared-memory/ (共享记忆技能)                       │    │
│  │  ├─ skills/lancedb-memory/ (LanceDB 向量存储, Python)          │    │
│  │  ├─ skills/context-compressor/ (上下文压缩技能)                │    │
│  │  ├─ skills/context-manager/ (上下文管理技能)                   │    │
│  │  └─ skills/context-recovery/ (上下文恢复技能)                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Desktop Repair (桌面端修复)                                   │    │
│  │  └─ content_vault.rs (Rust 安全内容保险库)                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Backup & Recovery (备份恢复)                                  │    │
│  │  ├─ backup-rotation.ts (配置备份轮转)                          │    │
│  │  ├─ config-rollback.ts (配置回滚)                              │    │
│  │  └─ backup-utils.ts (备份工具集)                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 二、核心数据流路径

### 2.1 写入路径 (Input → Storage)

```
用户消息 ────────────────────────────────────────────────────────┐
  │                                                               │
  ├─→ 自动提取 (memory-extraction.ts)                             │
  │     条件: 关键词匹配 / 长消息≥300字 / 每5轮定期                │
  │     LLM: ant-ling → meituan-longcat → Qwen3-8B → 主模型      │
  │     去重: isSimilarValue() 过滤已有值                          │
  │     写入: withProfileLock → upsertProfileEntryFull             │
  │                                                               │
  ├─→ Agent 工具写入 (memory-upsert-tool.ts)                      │
  │     工具: memory_upsert(category, key, value)                 │
  │     写入: withProfileLock → upsertProfileEntryFull             │
  │                                                               │
  ├─→ 跨 Agent 共享 (memory-share-tool.ts)                        │
  │     工具: memory_share(category, key, value)                  │
  │     写入: withSharedProfileLock → upsertSharedEntry            │
  │                                                               │
  ├─→ 压缩前刷盘 (memory-flush.ts)                                │
  │     触发: context window 即将压缩时                             │
  │     写入: MEMORY/YYYY-MM-DD.md (追加不覆盖)                    │
  │                                                               │
  └─→ 媒体存储 (chat-image-store / chat-video-store)              │
        触发: AI 生图/生视频完成                                    │
        写入: 磁盘文件 + manifest.json + SQLite media-metadata      │
```

### 2.2 读取路径 (Storage → Output)

```
Agent Turn 开始
  │
  ├─→ L1 热注入: readProfile() → formatProfileForSystemPrompt()
  │     缓存: 5秒 TTL 内存缓存
  │     预算: contextWindow ≤32K→3000 / ≤64K→5000 / >64K→8000 chars
  │
  ├─→ L2 冷检索: retrieveColdMemories()
  │     查询: FTS5 keyword search (latency < 50ms)
  │     时间衰减: 90天后半衰期90天
  │     去重: 排除已在热 profile 中的条目
  │     预算: max 5条 / 600 chars
  │
  ├─→ L2 语义搜索: memory_search tool (agent 主动调用)
  │     查询: Hybrid (vector + FTS5) 或 vector-only
  │     MMR: Jaccard 相似度多样性重排 (lambda=0.7)
  │     冷热分层: Hot(7d)→Warm(30d)→Cold(120d)→Full
  │     降级: model 切换后 FTS-only (score×0.5)
  │     预算: max 4000 chars (builtin) / configurable (QMD)
  │
  └─→ Media 查询: queryBySession() → SQLite → 磁盘文件
```

### 2.3 同步路径 (File → Index)

```
Memory Files (MEMORY.md, memory/*.md)
  │
  ├─→ chokidar 文件监视 → debounce → dirty=true
  ├─→ 搜索触发同步 (onSearch=true)
  ├─→ 定时同步 (intervalMinutes)
  └─→ 会话开始同步 (onSessionStart=true)
        │
        ▼
  MemoryIndexManager.sync()
    ├─→ 增量: hash 对比, 只索引变化文件
    ├─→ 全量: model/provider/chunking 变化时
    │     安全重建: temp DB → swap (原子操作)
    │     WAL checkpoint → close → rename
    └─→ Session: delta-based (bytes/messages 阈值)
          │
          ▼
    indexFile()
      ├─→ chunkMarkdown() (tokens × 4 chars, overlap)
      ├─→ enforceEmbeddingMaxInputTokens()
      ├─→ embedChunksInBatches() (cache + retry + batch API)
      ├─→ SQLite: chunks table + FTS5 table + vec0 table
      └─→ 事务包装 (BEGIN/COMMIT 原子写入)
```

---

## 三、存储引擎详解

### 3.1 SQLite 数据库分布

| 数据库 | 路径 | 用途 | WAL | 维护 |
|--------|------|------|-----|------|
| memory.sqlite | `~/.openclawcn/agents/{id}/memory.sqlite` | L2 冷记忆索引 | Yes | 自动 reindex |
| media-metadata.sqlite | `~/.openclawcn/data/media-metadata.sqlite` | 媒体元数据 | Yes | 每日维护 |
| tool-index.sqlite | `data/tool-index.sqlite` | 工具能力索引 | Yes | 启动时构建 |

### 3.2 SQLite Schema (memory.sqlite)

```sql
-- 元数据
meta (key TEXT PK, value TEXT)

-- 文件追踪
files (path TEXT PK, source TEXT, hash TEXT, mtime INT, size INT)
  + UNIQUE INDEX idx_files_path_source ON files(path, source)

-- 内容块
chunks (id TEXT PK, path TEXT, source TEXT, start_line INT, end_line INT,
        hash TEXT, model TEXT, text TEXT, embedding TEXT, updated_at INT)
  + INDEX idx_chunks_path ON chunks(path)
  + INDEX idx_chunks_source ON chunks(source)

-- FTS5 全文索引 (trigram tokenizer for CJK)
chunks_fts USING fts5(text, id UNINDEXED, path UNINDEXED,
                       source UNINDEXED, model UNINDEXED,
                       start_line UNINDEXED, end_line UNINDEXED,
                       tokenize='trigram')

-- sqlite-vec 向量索引
chunks_vec USING vec0(id TEXT PK, embedding FLOAT[{dims}])

-- 嵌入缓存
embedding_cache (provider TEXT, model TEXT, provider_key TEXT,
                 hash TEXT, embedding TEXT, dims INT, updated_at INT,
                 PK(provider, model, provider_key, hash))

-- 提取重试队列
extraction_queue (id INT PK, user_msg TEXT, agent_reply TEXT,
                  created_at INT, attempts INT, last_error TEXT, status TEXT)

-- Profile 审计日志
profile_changelog (id INT PK, category TEXT, key TEXT,
                   old_value TEXT, new_value TEXT, operation TEXT,
                   reason TEXT, created_at INT)
```

### 3.3 嵌入后端

| 后端 | Model | 维度 | 速率限制 | Batch API |
|------|-------|------|---------|-----------|
| OpenAI | text-embedding-3-small | 1536 | Yes | Yes (File API) |
| Gemini | text-embedding-004 | 768 | Yes | Yes (asyncBatchEmbed) |
| Voyage | voyage-3-lite | 1024 | Yes | Yes |
| Local | embeddinggemma-300m (GGUF) | 768 | No | N/A |

---

## 四、发现的问题与修复方案

### 问题 P1: Media DB 缺少 WAL Checkpoint 导致数据丢失风险 ✅ 已修复

**位置**: [media-db.ts:139](src/media/media-db.ts#L139)

**问题**: `openMediaDb()` 启用了 WAL 模式但 `closeMediaDb()` 不执行 checkpoint。进程正常退出时 WAL 文件可能包含未写回主库的数据。如果 WAL 文件被意外删除（如手动清理），最近的媒体记录丢失。

**修复**: 在 `closeMediaDb()` 中添加 `PRAGMA wal_checkpoint(TRUNCATE)`。

### 问题 P2: Media DB 缺少完整性检查 ✅ 已修复

**位置**: [media-db.ts:110](src/media/media-db.ts#L110)

**问题**: `openMediaDb()` 没有像 memory.sqlite 那样执行 `PRAGMA quick_check`。损坏的媒体数据库会导致 silent 数据丢失。

**修复**: 在 `openMediaDb()` 中添加 `PRAGMA quick_check`，失败时 warn 但不阻塞。

### 问题 P3: profile-retrieval 冷检索与 memory_search 工具重复查询

**位置**: [profile-retrieval.ts:72](src/memory/profile-retrieval.ts#L72) 和 [memory-tool.ts:63](src/agents/tools/memory-tool.ts#L63)

**问题**: Agent turn 开始时 `retrieveColdMemories()` 会执行一次 FTS 搜索，之后 agent 又可能通过 `memory_search` 工具再执行一次搜索。两次搜索可能返回高度重叠的结果，浪费 context tokens。

**现状评估**: 这是 by-design 的分工（自动注入 vs 主动搜索），但缺少去重机制。

### 问题 P4: searchKeywordDegraded 的 score×0.5 衰减过于粗暴 ✅ 已修复

**位置**: [manager.ts:370](src/memory/manager.ts#L370)

**问题**: 当 embedding model 切换后，降级搜索统一将 score 减半。但如果 FTS 结果本身 score 就很高（文本完全匹配），减半后可能低于 `minScore` 被过滤掉，导致"明明搜到了但不显示"。

**修复**: 降级搜索保证至少返回 top-1 结果，无论 score 是否低于 minScore。同时 hybrid 模式也增加了同样的保护。

### 问题 P5: 冷热分层 HIGH_SCORE_PRESERVE_THRESHOLD 硬编码为 0.6 ✅ 已修复

**位置**: [search-tiering-cn.ts:27](src/memory/search-tiering-cn.ts#L27)

**问题**: `0.6` 是固定阈值。对于某些 embedding model（如 local GGUF 模型），最高分可能就在 0.5-0.6 区间，导致所有结果都被时间分层淘汰。

**修复**: 使用动态阈值 `min(maxScore × 0.8, 0.6)`，保证排名前列的结果始终被保留，无论绝对 score 值如何。

### 问题 P6: Media manifest 和 SQLite 双写不一致风险

**位置**: [chat-image-store.ts:157-183](src/media/chat-image-store.ts#L157-L183)

**问题**: `saveChatImage` 先写 manifest 再写 SQLite，SQLite 失败时 manifest 已写入。虽然标注了 "Non-fatal"，但 `loadChatImages` 优先查 SQLite — 如果 SQLite 写入永久失败，SQLite 中永远没有这条记录，而 manifest 有，导致行为不一致。

**修复**: 反转读取优先级：SQLite 为空时也检查 manifest（现有代码已做 fallback，确认逻辑正确）。

### 问题 P7: Learning Engine 路由模式学习缺少持久化

**位置**: [learning-engine.ts:433-490](extensions/agent-team/src/learning-engine.ts#L433-L490)

**问题**: `buildRoutingPatterns` 生成的路由模式只存在于内存中的 `LearningAnalysis` 对象。进程重启后所有学习成果丢失。

**现状评估**: 当前 `applyAutoOptimizations` 会将学习到的关键词写回 `project.members[].keywords`，但 project 配置本身的持久化取决于调用方。

### 问题 P8: 向量搜索 brute-force fallback 的 2000 条上限 ✅ 已修复

**位置**: [manager-search.ts:77](src/memory/manager-search.ts#L77)

**问题**: 当 sqlite-vec 不可用时，回退到内存中加载所有 chunks 做 cosine similarity。上限 2000 条是防 OOM 的保护，但大型项目可能有几千条 chunks，导致部分记忆永远搜不到。

**修复**:
1. 在 `searchVector()` brute-force 路径中添加截断检测和 `console.warn` 日志
2. 在 `MemoryProviderStatus.vector` 中添加 `bruteForceTruncated` 标志
3. `status()` 方法根据 chunk 数量自动计算并暴露截断状态

### 问题 P9: FTS5 trigram tokenizer 的 3 字符最小限制

**位置**: [hybrid.ts:74-76](src/memory/hybrid.ts#L74-L76)

**问题**: trigram tokenizer 要求 CJK token ≥ 3 字符。这意味着用户搜索"内存"（2 字符）时 FTS 完全不工作，只能依赖 vector search。这是一个已知限制但用户感知明显。

**现状评估**: 设计上依赖 vector search 兜底 2 字符查询，是合理的 trade-off。但应在 doctor 命令中提示。

### 问题 P10: Memory Flush 和自动提取的竞争条件

**位置**: [memory-flush.ts](src/auto-reply/reply/memory-flush.ts) 和 memory-extraction

**问题**: Memory Flush (压缩前刷盘) 和自动提取可能在同一个 turn 中同时运行。Flush 写入 `memory/YYYY-MM-DD.md`，提取写入 `profile.json`。两者独立运行没有冲突，但如果 flush 写入的内容恰好是提取应该捕获的 fact，会导致同一信息被存储两次（一次在 md，一次在 profile）。

**现状评估**: 不是 bug，是 redundancy（冗余存储）。实际上提供了更好的召回率。

### 问题 P11: Chunk 质量过滤不足导致向量噪音 ✅ 已修复

**位置**: [manager-embedding-ops.ts:691](src/memory/manager-embedding-ops.ts#L691)

**问题**: 原来只过滤 `text.trim().length > 0`，但仍然允许极短内容（如 `# `、`- `、`***`）和纯标点/语法符号进入 embedding 流水线。这些噪音 chunk 浪费 embedding API 调用，并且可能在向量搜索中产生虚假匹配。

**修复**:
1. 添加 `MIN_CHUNK_CHARS = 8` 最小长度过滤
2. 添加 `NOISE_PATTERN` 正则过滤纯标点/markdown 语法噪音
3. 确保只有语义上有意义的内容才能进入向量索引

### 问题 P12: 零向量 embedding 污染 vec0 索引 ✅ 已修复

**位置**: [manager-embedding-ops.ts:769](src/memory/manager-embedding-ops.ts#L769)

**问题**: 当 embedding provider 返回全零向量（网络错误静默降级、模型异常等），原代码只检查 `embedding.length > 0`，仍然将零向量写入 vec0 表。零向量的 L2 范数为 0，cosine distance 变为 NaN，导致搜索排名不可预测。

**修复**: 添加 `embedding.some((v) => v !== 0)` 检查，确保零向量不会被写入 vec0 表。

### 问题 P13: 入 vec 内容质量控制 ✅ 已修复

**位置**: [manager-embedding-ops.ts](src/memory/manager-embedding-ops.ts)

**问题**: memory/*.md 中可能包含 JSON 配置、base64 数据、hex dump、YAML frontmatter 等内容。直接入 vec 会产生低语义密度的 embedding，污染搜索结果。

**修复**: 将 `isLowQualityChunk()` 升级为 `cleanChunkText()`，不再简单丢弃，而是分类处理:

| 内容类型 | 处理方式 | 原因 |
|---------|---------|------|
| YAML frontmatter | **丢弃** | 元数据(tags/dates)对语义搜索无意义 |
| Base64 编码 | **丢弃** | 二进制噪音 |
| Hex dump / SHA hash | **丢弃** | 二进制噪音 |
| JSON 块 | **提取 string 值** | JSON 结构无用，但值里有有效信息 |
| 混合文本+JSON | **保留原文** | 自然语言部分有语义价值 |

**JSON 提取示例** (保留 key 名，类似 LlamaIndex JSONReader 的 key-value 展平):
- `{"name":"张三","age":30,"department":"工程部"}` → `"name: 张三\ndepartment: 工程部"` (age 是数字跳过，key 保留提供上下文)
- `{"id":"abc-123","url":"https://...","title":"项目计划"}` → `"title: 项目计划"` (id/URL 跳过)
- 嵌套 JSON 用点号展平: `{"user":{"name":"李四"}}` → `"user.name: 李四"`

**噪音 key 过滤**: id, uuid, hash, token, timestamp, created_at 等元数据 key 自动跳过。
**噪音值过滤**: UUID、URL、hex hash、base64、ISO 时间戳、纯数字等非语义值自动跳过。

### 问题 P14: minScore=0.35 太宽松导致低质量结果进入 context ✅ 已修复

**位置**: [memory-search.ts:82](src/agents/memory-search.ts#L82), [profile-retrieval.ts:61](src/memory/profile-retrieval.ts#L61)

**问题**: cosine similarity 0.35 意味着只有 ~35% 语义重叠就被认为"相关"。这允许大量弱相关/不相关结果进入 agent context，浪费 token 并降低回答质量。

**修复**: 默认 minScore 从 0.35 提升至 0.45，同时保持用户可配置。

### 问题 P15: snippet 截断在句子中间导致不可读 ✅ 已修复

**位置**: [memory-tool.ts:166-190](src/agents/tools/memory-tool.ts#L166-L190)

**问题**: `clampResultsByInjectedChars()` 按 char budget 截断 snippet 时，直接在任意位置切断，可能把 "To optimize database performance, consider using indexes." 截成 "To optimize database performance, consider us..."。

**修复**: 截断时优先在句子边界 (`. ` `。` `! ` `? `) 处断开，退而求其次在空格处断开。确保截断后的文本仍然可读。

### 问题 P16: Chunking 不尊重 markdown 语义边界 ✅ 已修复

**位置**: [internal.ts:chunkMarkdown](src/memory/internal.ts)

**问题**: `chunkMarkdown()` 纯按字符数切割，完全不管内容结构。markdown 的 `##` 标题不作为分割边界，两个不同话题可能被混在一个 chunk 里，导致 embedding 语义模糊、搜索精度下降。

**修复**: 改造 `chunkMarkdown()` 为语义边界感知:
- Markdown 标题 (`#`, `##`, `###` 等) 作为硬分割边界，遇到标题时强制 flush 当前 chunk
- 保留原有的 overlap 机制用于跨 chunk 上下文衔接

### 问题 P17: Session Q&A 对被切割到不同 chunk ✅ 已修复

**位置**: [internal.ts:chunkMarkdown](src/memory/internal.ts)

**问题**: Session transcript 格式为 `"User: xxx\nAssistant: yyy"`。当一个 Q&A 对超过 1600 字符时，问题和答案会被切到不同 chunk 里。搜索"如何优化数据库"只能找到问题那半段 chunk，答案丢失。

**修复**: 在 `chunkMarkdown()` 中识别 session turn 标记:
- `User:` 开头 → 新 Q&A 对的开始，强制 flush (新 chunk)
- `Assistant:` 开头 → 同一 Q&A 对的延续，优先保持在同一 chunk 中
- 当 chunk 已满 80%+ 时才在 `Assistant:` 处分割，避免溢出
- 效果：短 Q&A 对(问+答 < 1600 字符)保持原子性，长回答允许分割但不会把问题和答案撕裂

### 问题 P18: Hybrid 搜索权重不适应 query 长度 ✅ 已修复

**位置**: [manager.ts:search](src/memory/manager.ts)

**问题**: 固定 `0.7 × vector + 0.3 × keyword` 权重对所有查询一视同仁。但中文短查询("数据库优化"4 字)用 keyword 精确匹配更准，长查询("如何在高并发场景下优化 MySQL 索引策略"完整句子)用 vector 语义匹配更准。

**修复**: 根据 query 字符长度动态调整权重:

| Query 长度 | Vector 权重 | Keyword 权重 | 原因 |
|-----------|------------|-------------|------|
| ≤6 字符 | 0.45 | 0.55 | 短查询 keyword 精确匹配更可靠 |
| 7-20 字符 | 0.70 | 0.30 | 默认平衡 |
| >20 字符 | 0.85 | 0.15 | 长句子语义匹配更准 |

### 问题 P19: Session 文本折叠换行丢失对话结构 ✅ 已修复

**位置**: [session-files.ts:normalizeSessionText](src/memory/session-files.ts)

**问题**: `normalizeSessionText()` 把所有 `\n` 折叠成空格。assistant 回复中的列表、步骤、段落结构全部丢失。例如:
```
原始: "1. 创建索引\n2. 分析查询计划\n3. 优化连接池"
折叠后: "1. 创建索引 2. 分析查询计划 3. 优化连接池"
```
Embedding model 对保留结构的文本理解力更强。

**修复**: 改为保留结构的换行规范化:
- 3+ 连续换行 → 双换行（段落分隔）
- 单/双换行保留（保持列表、步骤结构）
- 只折叠行内水平空白

### 问题 P20: FTS5 短 CJK 查询完全失效 ✅ 已修复

**位置**: [manager-search.ts:searchKeyword](src/memory/manager-search.ts)

**问题**: FTS5 trigram tokenizer 要求 CJK token >= 3 字符。当用户搜索 2 字符词（如 "记忆"、"索引"、"优化"）时，`buildFtsQuery()` 返回 null，keyword 搜索直接返回空。这些是中文中非常常见的查询词。

**修复**: 当 FTS5 MATCH 查询无法构建时，fallback 到 SQL LIKE 搜索:
- `searchKeywordLikeFallback()`: 对 chunks 表执行 `WHERE text LIKE '%keyword%'`
- 所有 2+ 字符的 keyword 用 AND 连接（必须全部出现）
- 按 updated_at DESC 排序（优先返回近期结果）
- 固定分数 0.4（无 BM25 排名信息）
- 只在 FTS5 无法处理时触发，不影响正常查询性能

### 问题 P21: Session chunk 缺少时间上下文 ✅ 已修复

**位置**: [session-files.ts:buildSessionEntry](src/memory/session-files.ts)

**问题**: 个人助手场景中 "什么时候说的" 很重要。当用户问 "上周聊了什么"、"三月份的讨论"，搜索结果没有时间线索。虽然 chunk 有 `updatedAt` 用于排序，但 embedding 向量不包含时间语义。

**修复**: 从 JSONL 的 header 记录或消息 timestamp 提取日期，在 session 文本开头添加日期标签:
```
[Session: 2025-03-01]
User: 如何优化数据库性能？
Assistant: 建议从以下几个方面...
```
日期信息同时进入 FTS 和 embedding，使时间相关查询可匹配。

### 问题 P22: 搜索结果同文件相邻 chunk 重复 ✅ 已修复

**位置**: [manager.ts:coalesceAdjacentResults](src/memory/manager.ts)

**问题**: 当一个长回答被切成 2-3 个相邻 chunk 时，搜索可能同时命中多个片段。这浪费 token budget（6 个结果位中 3 个是同一段话的碎片），且用户看到的是不完整的片段重复。

**修复**: 在返回结果前执行相邻 chunk 合并:
- 按 path+source 分组
- 同文件内行号重叠或间隔 ≤ 3 行的 chunk 合并
- snippet 拼接、取最高分、扩展 line range
- 合并后重新按分数排序

**效果**: 6 个结果位可以覆盖 6 个不同话题，而不是同一段话的 3 个碎片。

---

## 五、短期记忆与长期记忆协同机制

### 5.1 协同流程

```
短期记忆 (Context Window)
  │
  ├─→ 自动提取 ──→ L1 Hot Profile (长期)
  │     触发: 关键词/长消息/定期
  │     提取: LLM 抽取 key facts
  │
  ├─→ Memory Flush ──→ L2 Cold Archive (长期)
  │     触发: 压缩前 (context window 即将满)
  │     写入: memory/YYYY-MM-DD.md
  │
  ├─→ Session Transcript ──→ L2 Cold Archive
  │     触发: delta-based (bytes/messages 阈值)
  │     索引: 增量 hash 对比
  │
  └─→ Agent 工具 ──→ L1 Hot Profile
        触发: memory_upsert / memory_forget
        写入: withProfileLock 原子操作

长期记忆 → 短期记忆
  │
  ├─→ L1 注入: 每轮自动注入 system prompt
  │     预算: 按 context window 动态调整
  │
  ├─→ L2 冷检索: 自动注入 (profile-retrieval)
  │     条件: query.length ≥ 4, score ≥ 0.35
  │
  └─→ L2 搜索: agent 主动调用 memory_search
        条件: agent 判断需要回忆
```

### 5.2 协同问题与建议

| 问题 | 描述 | 建议 |
|------|------|------|
| 冷热割裂 | L1 淘汰的条目只能通过 FTS 冷检索找回，语义搜索需 agent 主动调用 | P2优先级: 冷检索也走 vector search |
| Session → Profile 缺少桥梁 | Session transcript 被索引但不会自动提取为 profile fact | 考虑 session 级别的自动提取 |
| 跨工作区隔离 | identity/preference 不跨工作区共享 | P1优先级: 全局 user profile |
| 压缩后丢失 | 压缩后旧消息丢失，如果 memory flush 未触发则信息永久丢失 | 确保 flush 在每次压缩前都执行 |

---

## 六、向量入库有效性保障

### 6.1 入库前过滤

```
内容 → chunkMarkdown() → 质量过滤 → enforceEmbeddingMaxInputTokens()
  │
  ├─ 最小长度: chunk.text.trim().length ≥ 8 chars ← [P11 修复]
  ├─ 噪音过滤: 排除纯标点/markdown语法符号 ← [P11 修复]
  ├─ 语义质量: cleanChunkText() YAML丢弃/JSON提取值/base64+hex丢弃 ← [P13 修复]
  ├─ Token 限制: splitTextToUtf8ByteLimit(maxInputTokens)
  ├─ Hash 去重: 同 hash 的 chunk 复用缓存的 embedding
  ├─ 零向量拦截: embedding.some(v => v !== 0) ← [P12 修复]
  └─ 模型匹配: 只有当前 model 的 chunks 被搜索命中
```

### 6.2 入库后质量

```
向量搜索 → cosine similarity → minScore 过滤 → 时间分层 → MMR 多样性重排
  │
  ├─ minScore: 默认 0.1 (可配置)，过滤噪音
  ├─ 时间分层: 7d/30d/120d 递进，保护高分旧结果
  ├─ MMR: lambda=0.7, 避免同一文件多个相似 chunk 霸榜
  └─ 预算限制: 4000 chars 最大注入量
```

### 6.3 入库有效性问题

| 问题 | 影响 | 严重度 |
|------|------|--------|
| 空白行/纯标点被编入 embedding | ~~浪费向量空间 + embedding API 调用~~ | ✅ P11 已修复 |
| 零向量写入 vec0 表 | ~~cosine distance 变 NaN，排名不可预测~~ | ✅ P12 已修复 |
| 代码块中的注释被平等对待 | 代码注释和有意义文本混在一起 | 低 |
| 大文件单行超长截断 | 超过 maxChars 的行被分段，可能切断语义 | 中 |
| 向量维度不匹配时的 cosineSimilarity | ~~使用 Math.min 截断导致范数偏小~~ | ✅ BUG-R2-6 已修复 |

---

## 七、召回精准度分析

### 7.1 召回策略矩阵

| 场景 | 搜索方式 | 预期精准度 | 风险 |
|------|---------|-----------|------|
| 用户说"我叫什么" | L1 热注入 (identity) | 高 | 如果从未提取过则无法回答 |
| 用户说"之前讨论的方案" | L2 vector search | 中 | 取决于 embedding 质量 |
| 中文 2 字关键词 | L2 vector only (FTS 失效) | 中低 | trigram 3字符限制 |
| 英文短词 | L2 hybrid (FTS + vector) | 高 | FTS 精确匹配 + vector 语义 |
| 30 天前的信息 | L2 + 时间分层 | 中 | warm tier 需高分保护 |
| 120 天前的信息 | L2 cold tier | 低 | 需 score ≥ 0.6 或全量回退 |

### 7.2 精准度提升建议

1. ~~**动态 HIGH_SCORE_PRESERVE_THRESHOLD**: 使用 top-1 score 的 80% 而非固定 0.6~~ ✅ P5 已实现
2. **CJK 2字符降级**: 对 2 字符 CJK 查询，自动扩展为"前缀+当前+后缀" 3 字符组合 (待实现)
3. **冷检索加入 vector**: 当前冷检索只用 FTS5，应增加 vector fallback (待实现)
4. **Session 搜索权重**: 最近 session 的结果应有 recency boost (待实现)
5. ~~**Chunk 质量过滤**: 排除短于 8 字符和纯标点 chunk~~ ✅ P11 已实现
6. ~~**零向量拦截**: 防止零向量污染 vec0 索引~~ ✅ P12 已实现
7. ~~**Brute-force 截断告警**: 超 2000 chunk 时记录 warning 并暴露 status~~ ✅ P8 已实现
8. ~~**降级搜索保底**: 降级搜索保证返回 top-1 结果~~ ✅ P4 已实现

---

## 八、关键文件索引

### 核心记忆引擎
| 文件 | 职责 |
|------|------|
| `src/memory/manager.ts` | 记忆索引管理器 (入口) |
| `src/memory/manager-sync-ops.ts` | 同步操作 (文件监视/索引/reindex) |
| `src/memory/manager-embedding-ops.ts` | 嵌入操作 (batch/cache/retry) |
| `src/memory/manager-search.ts` | 搜索操作 (vector/keyword) |
| `src/memory/memory-schema.ts` | SQLite schema + FTS5 trigram |
| `src/memory/hybrid.ts` | 混合搜索 + BM25 评分 |
| `src/memory/mmr.ts` | MMR 多样性重排 |
| `src/memory/search-tiering-cn.ts` | 冷热分层策略 |
| `src/memory/embeddings.ts` | 嵌入后端 (OpenAI/Gemini/Voyage/Local) |
| `src/memory/sqlite-vec.ts` | sqlite-vec 扩展加载 |
| `src/memory/search-manager.ts` | 搜索管理器 (QMD fallback) |

### Profile 记忆
| 文件 | 职责 |
|------|------|
| `src/memory/profile-store.ts` | L1 热记忆: 评分/淘汰/读写/归档/强化 |
| `src/memory/profile-retrieval.ts` | L2 冷检索: FTS5 查询 + 时间衰减 |

### Agent 工具
| 文件 | 职责 |
|------|------|
| `src/agents/tools/memory-tool.ts` | memory_search / memory_get |
| `src/agents/tools/memory-upsert-tool.ts` | memory_upsert / memory_forget |

### 媒体存储
| 文件 | 职责 |
|------|------|
| `src/media/media-db.ts` | 媒体元数据 SQLite |
| `src/media/chat-image-store.ts` | 图片存储 (磁盘+manifest+SQLite) |
| `src/media/chat-video-store.ts` | 视频存储 (磁盘+manifest+SQLite) |

### 多 Agent 记忆
| 文件 | 职责 |
|------|------|
| `extensions/agent-team/src/memory-share-tool.ts` | 跨 agent 记忆共享工具 |
| `extensions/agent-team/src/shared-profile-store.ts` | 共享 profile 存储 |
| `extensions/agent-team/src/conversation-compactor.ts` | 活动摘要压缩 |
| `extensions/agent-team/src/learning-engine.ts` | 自学习引擎 |

### 压缩/刷盘
| 文件 | 职责 |
|------|------|
| `src/auto-reply/reply/memory-flush.ts` | 压缩前记忆刷盘 |
| `src/auto-reply/reply/memory-extraction.ts` | 自动记忆提取 |
| `src/auto-reply/reply/memory-consolidation.ts` | LLM 记忆整合 |
