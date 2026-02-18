# Personal Knowledge Store PRD

> **项目代号**: KnowledgeFabric
> **版本**: v1.0
> **日期**: 2026-02-18
> **作者**: AI Architecture & Product Team
> **优先级**: P1
> **核心原则**: 蒸馏优于堆积 — 存得精比存得多更重要

---

## 一、项目背景与目标

### 1.1 背景

OpenClawCN 拥有强大的工具调用能力（MCP 9535+ server、Skills、多通道通信），但缺少一个关键的**跨会话知识持久化层**：

- **MCP/Skill 结果是一次性的**: 工具调用结果仅作为消息嵌入 session transcript（.jsonl），会话结束后难以检索复用
- **30天自动过期**: session transcript 有 30 天 TTL，用户积累的信息会丢失
- **上下文窗口是真正的瓶颈**: LLM 一次只能看 ~200K token，当前注入预算仅 4,000 字符（6条×700字）
- **跨通道上下文断裂**: 飞书/钉钉/Discord 各通道的交互知识彼此隔离

### 1.2 目标

1. 构建三级知识蒸馏管线（Raw → Facts → Graph），从工具结果中自动提炼结构化知识
2. 实现跨会话、跨通道的知识积累与检索
3. 通过时间衰减、语义去重、类型分治防止存储膨胀
4. 三年全量知识 < 25 MB，不增加用户运维负担
5. 复用现有 SQLite + FTS5 基础设施，最小化新增依赖

### 1.3 非目标

- 不做云端同步（本地优先）
- 不替换现有 session transcript / memory 系统（叠加层）
- 不做多用户共享知识库（单用户单实例）
- V1 不做 Knowledge Graph（Level 2），聚焦 Fact Extraction（Level 1）

---

## 二、核心调研结论

### 2.1 "会不会爆炸？" — 不会

**重度用户容量估算**（每天 100 次 tool 调用，每次结果 ~2KB）：

```
              30天后    1年后     3年后
Level 0 (原始)  6 MB    6 MB     6 MB   ← 30天滚动窗口，恒定
Level 1 (事实)  120 KB  1.4 MB   4.2 MB ← 永久保留，50:1 压缩
Level 2 (图谱)  30 KB   360 KB   1 MB   ← 去重合并（V2）
向量索引         500 KB  6 MB     18 MB  ← Level 1 embedding
─────────────────────────────────────────
总计 (持久)     ~650 KB  ~8 MB    ~23 MB
```

**对比参考**：
- Obsidian 16K 笔记 = 500 MB 向量（我们三年 18 MB）
- tool-index.sqlite 当前已 ~5 MB（9535 条 MCP 索引）
- 一张手机照片 ≈ 3-5 MB（我们三年全部知识 ≈ 5张照片）

### 2.2 真正的瓶颈：检索质量

| 瓶颈 | 现象 | 数据 |
|------|------|------|
| **上下文窗口** | 200K token 窗口，但注入预算仅 4,000 字 | 存了 100MB 知识只能用 0.001% |
| **Lost in the Middle** | 上下文中间的信息被 LLM 忽略 | 超过 32K-64K token 注意力显著下降 |
| **检索精度衰减** | 知识库越大，top-K 越容易偏 | 100K+ 文档需两阶段检索 |

**核心洞察**：Mem0 实测 14:1 压缩 → 94.5% 准确率，优于全量存储的 68.5%。**压缩后反而更准，因为噪音被去掉了。**

### 2.3 当前系统硬限制

| 限制点 | 实际值 | 代码位置 |
|--------|--------|---------|
| 单个 Tool 结果 | 400,000 chars → 截断 | `tool-result-truncation.ts:19` |
| Session 条目数 | 500 条 LRU | `store.ts DEFAULT_SESSION_MAX_ENTRIES` |
| Session 文件 | 10 MB → 轮转 | `store.ts DEFAULT_SESSION_ROTATE_BYTES` |
| Session 过期 | 30 天 TTL | `store.ts DEFAULT_SESSION_PRUNE_AFTER_MS` |
| Memory 搜索 | 10,000 chunks | `manager-search.ts:117` |
| 上下文注入 | 4,000 chars (6条×700字) | `backend-config.ts:76-81` |
| 媒体文件 | 5MB/个，2分钟 TTL | `store.ts:15` |
| Context pruning | 软裁30% / 硬清50% | `context-pruning/settings.ts` |

---

## 三、行业对标

### 3.1 八大平台方案对比

| 平台 | 存储策略 | 压缩比 | 准确率 | 适用场景 |
|------|---------|--------|--------|---------|
| **Mem0** | 事实抽取 + 知识图谱 | **14:1** | **94.5%** | 通用AI记忆 |
| **MemGPT/Letta** | LLM自主page-in/out | ~10:1 | 74.0% | 长对话agent |
| **LangGraph Store** | TTL + namespace + pgvector | 无压缩 | 依赖检索 | 开发框架 |
| **Apple Intelligence** | 设备端量化语义索引 | 4-bit | 未公开 | 端侧隐私 |
| **Obsidian+AI** | 全量 embedding | 2.5x膨胀 | 大库变慢 | 个人笔记 |
| **Microsoft Copilot** | Graph统一API + 语义索引 | chunk级 | 企业级 | 企业数据 |
| **OpenAI Assistants** | Thread/Run/Vector Store | 平台托管 | 自动截断 | SaaS |
| **Claude Code** | CLAUDE.md + auto-memory | Markdown直注 | 上下文内 | 开发工具 |

### 3.2 关键设计模式

1. **分层存储**（LangGraph）: Checkpointer(会话内) + Store(跨会话) 显式分离
2. **自主记忆**（Windsurf/MemGPT）: AI 自己决定记什么
3. **事实蒸馏**（Mem0）: 从原始对话中提炼结构化事实，14:1 压缩
4. **时间衰减**（LangGraph Store TTL）: 未被访问的知识自动过期
5. **文件透明**（Claude Code/Obsidian）: 知识以人类可读格式存储

### 3.3 技术选型参考数据

**SQLite + FTS5 扩展能力**:
- 10K-100K 文档: 性能优秀，OpenClaw 的甜蜜区
- 500K 文档: 仍然舒适
- 1M+: 排序查询开始变慢
- CJK: 需要 trigram tokenizer（已有）

**向量量化压缩**:
| 技术 | 压缩比 | 召回损失 |
|------|--------|---------|
| Scalar Quantization (float32→int8) | 4x | <1% |
| Binary Quantization | 32x | 需rescoring |
| Matryoshka (1024→128维) | 8x | ~2% |
| MRL + Binary | 256x | 需rescoring |

---

## 四、系统架构

### 4.1 总体架构

```
                     OpenClaw Knowledge Pipeline

 ┌─────────────────────────────────────────────────────────┐
 │                    用户交互层                             │
 │  飞书 │ 钉钉 │ Discord │ 微信 │ Web UI │ CLI            │
 └───┬───┴───┬───┴────┬────┴───┬──┴────┬───┴────┬──────────┘
     │       │        │        │       │        │
     ▼       ▼        ▼        ▼       ▼        ▼
 ┌─────────────────────────────────────────────────────────┐
 │                   Session Manager                        │
 │  transcript.jsonl (Level 0 — 已有，30天TTL)               │
 └───────────────────────┬─────────────────────────────────┘
                         │ tool_result_persist hook
                         ▼
 ┌─────────────────────────────────────────────────────────┐
 │              Fact Extractor (Level 1 — 新增)              │
 │                                                          │
 │  ┌──────────────┐    ┌──────────────┐                    │
 │  │ Tool Result   │───▶│ LLM 事实抽取  │                    │
 │  │ (原始 JSON)   │    │ (结构化 Fact) │                    │
 │  └──────────────┘    └──────┬───────┘                    │
 │                             │                            │
 │  ┌──────────────┐           │     ┌──────────────────┐   │
 │  │ 语义去重      │◀──────────┼────▶│ knowledge.db     │   │
 │  │ cosine>0.92   │           │     │ (SQLite+FTS5)    │   │
 │  │ → 合并        │           │     │ facts 表         │   │
 │  └──────────────┘           │     │ facts_fts 表     │   │
 │                             │     │ embeddings 表    │   │
 │  ┌──────────────┐           │     └──────────────────┘   │
 │  │ 时间衰减      │◀──────────┘                            │
 │  │ 遗忘曲线      │                                        │
 │  └──────────────┘                                        │
 └─────────────────────────────────────────────────────────┘
                         │
                         │ 检索请求
                         ▼
 ┌─────────────────────────────────────────────────────────┐
 │              Knowledge Retriever (新增)                   │
 │                                                          │
 │  Stage 1: 粗筛 (~5ms)                                    │
 │  ├── FTS5 关键词匹配 top-25                               │
 │  └── 向量相似度 top-25                                    │
 │  ↓ RRF 融合 top-50                                       │
 │                                                          │
 │  Stage 2: 精排 (~200ms)                                   │
 │  └── LLM Re-rank → 精选 6 条                              │
 │  ↓                                                       │
 │  注入 Agent 上下文 (≤4,000 chars)                          │
 └─────────────────────────────────────────────────────────┘
```

### 4.2 数据模型

#### facts 表（核心）

```sql
CREATE TABLE facts (
  id          TEXT PRIMARY KEY,     -- nanoid
  type        TEXT NOT NULL,        -- 'factual'|'episodic'|'operational'|'temporal'
  category    TEXT NOT NULL,        -- 'travel/route'|'code/project'|'user/preference'|...
  content     TEXT NOT NULL,        -- 蒸馏后的事实文本
  entities    TEXT,                 -- JSON array: ["北京","上海"]
  source_tool TEXT,                 -- 'amap-mcp'|'feishu-bitable'|...
  source_session TEXT,              -- session ID
  channel     TEXT,                 -- 'feishu'|'dingtalk'|'web'|...
  confidence  REAL DEFAULT 0.8,    -- 0.0-1.0
  relevance   REAL DEFAULT 1.0,    -- 时间衰减分数
  access_count INTEGER DEFAULT 0,  -- 被检索命中次数
  created_at  INTEGER NOT NULL,    -- unix timestamp ms
  updated_at  INTEGER NOT NULL,    -- unix timestamp ms
  last_accessed INTEGER             -- 上次被检索的时间
);
```

#### facts_fts 虚拟表

```sql
CREATE VIRTUAL TABLE facts_fts USING fts5(
  content,
  category,
  entities,
  tokenize='trigram'   -- CJK 支持
);
```

#### fact_embeddings 表

```sql
CREATE TABLE fact_embeddings (
  fact_id    TEXT PRIMARY KEY REFERENCES facts(id),
  embedding  BLOB NOT NULL,        -- float32 或 int8 量化
  model      TEXT NOT NULL,        -- embedding 模型标识
  dimensions INTEGER NOT NULL      -- 向量维度
);
```

### 4.3 Fact 结构定义

```typescript
interface KnowledgeFact {
  id: string;
  type: 'factual' | 'episodic' | 'operational' | 'temporal';
  category: string;          // 层级分类 e.g. "travel/route"
  content: string;           // 蒸馏后的事实，简洁自然语言
  entities: string[];        // 关键实体
  sourceTool: string;        // 来源工具
  sourceSession: string;     // 来源会话
  channel?: string;          // 来源通道
  confidence: number;        // 0-1
  relevance: number;         // 时间衰减后的相关性分数
  accessCount: number;       // 检索命中次数
  createdAt: number;
  updatedAt: number;
  lastAccessed?: number;
}
```

### 4.4 知识类型生命周期

| 类型 | 定义 | 举例 | 衰减策略 |
|------|------|------|---------|
| **factual** | 用户/项目的持久事实 | "张三的项目用 React 18" | **永久**，不衰减 |
| **operational** | 常用工作流/命令 | "部署用 pnpm build:secure" | **永久+强化**，每次使用 ×1.3 |
| **episodic** | 某次交互的具体结果 | "2月17日查的北京→上海路线" | **30天半衰期** |
| **temporal** | 实时/时效性数据 | "今天北京 PM2.5 = 45" | **不提炼**，仅留在 Level 0 |

---

## 五、核心流程

### 5.1 写入流程：Tool Result → Fact

```
1. Tool 执行完成，结果写入 session transcript (已有)
2. tool_result_persist hook 触发 (已有扩展点)
3. Fact Extractor 判断是否值得提炼:
   ├── 临时性数据 (天气/实时价格) → 跳过
   ├── 纯错误信息 → 跳过
   ├── 结果太短 (<50 chars) → 跳过
   └── 其他 → 进入提炼
4. LLM 事实抽取 (system prompt + tool result → structured facts)
5. 语义去重检查:
   ├── cosine > 0.92 → 合并到已有 fact，更新时间戳
   ├── 0.85-0.92 → 新建，标记 related
   └── < 0.85 → 新建独立 fact
6. 写入 knowledge.db (facts + facts_fts + embeddings)
```

### 5.2 读取流程：Query → Context Injection

```
1. Agent 收到用户消息
2. Knowledge Retriever 被调用 (在 memory injection 之后)
3. Stage 1 粗筛 (~5ms):
   ├── FTS5: 用户消息关键词 → top-25 facts
   ├── Vector: 用户消息 embedding → top-25 facts
   └── RRF 融合 (k=60, fts=0.4, vec=0.6) → top-50
4. 过滤: relevance_score > 0.1 (过滤已衰减的)
5. Stage 2 精排 (~200ms, 可选):
   └── LLM 从 top-50 精选 6 条最相关 facts
6. 格式化注入 Agent 上下文:
   [Knowledge Context]
   - 张三的项目用 React 18 (来源: feishu, 2天前)
   - 部署命令: pnpm build:secure (来源: web, 使用12次)
   - 北京→上海驾车 1214km 约13小时 (来源: amap-mcp, 5天前)
7. 更新被命中 facts 的 access_count 和 last_accessed
```

### 5.3 维护流程：衰减 + 清理

```
触发: 每次应用启动 / 每 24 小时

1. 时间衰减:
   FOR EACH fact WHERE type IN ('episodic'):
     age_days = (now - updated_at) / 86400000
     half_life = 30  // 天
     decay = 0.5 ^ (age_days / half_life)
     new_relevance = base_confidence * decay * boost(access_count)
     UPDATE facts SET relevance = new_relevance

2. 归档:
   WHERE relevance < 0.01:
     → 标记为 archived (不参与默认检索，但可手动查)

3. 强化:
   WHERE type = 'operational' AND access_count > 0:
     boost = 1 + log2(access_count) * 0.1
     → 使用频率越高分数越高

4. 统计报告 (可选):
   → 总 facts 数 / 活跃 facts / 已归档 / 本月新增
```

---

## 六、防爆炸机制

### 6.1 四道防线

```
防线 1: 入口过滤
├── 临时性数据不提炼
├── 错误/空结果不提炼
├── <50 chars 不提炼
└── 预计过滤 60-70% 的 tool 结果

防线 2: 蒸馏压缩
├── LLM 事实抽取: 50:1 压缩 (500行→1句话)
├── 仅保留核心事实，去除格式/冗余
└── 月增量: 原始 6MB → 蒸馏后 120KB

防线 3: 语义去重
├── cosine > 0.92 → 合并 (不新增条目)
├── 相同实体+相同关系 → 覆盖更新
└── 预计去重 20-30% 的新 facts

防线 4: 时间衰减
├── episodic 类型: 30天半衰期
├── relevance < 0.01 → 归档 (不占检索资源)
├── 归档超 180 天 → 可选删除
└── factual/operational 类型: 不衰减，但仍可手动清理
```

### 6.2 最坏情况估算

```
假设: 无任何去重/衰减，所有 tool 结果都被提炼

每天 200 次 tool call × 每条 fact ~200 bytes × 365 天
= 200 × 200 × 365 = 14.6 MB/年 (纯文本)
+ 向量索引 ~3x = 43.8 MB/年
= ~60 MB/年 (绝对最坏)

实际 (有去重+衰减+过滤):
≈ 60 MB × 0.3 (入口过滤) × 0.7 (去重) × 0.5 (衰减归档)
≈ ~6.3 MB/年

三年 ≈ 19 MB (与估算的 23MB 吻合)
```

---

## 七、应用场景

### 7.1 MCP 工具结果的知识沉淀

```
用户: "帮我查一下高德地图上北京到上海的路线"
  ↓ MCP @amap-amap-maps 返回 500 行 JSON
  ↓ 事实提炼: {type: "episodic", content: "北京→上海 驾车 1214km 约13小时"}
  ↓
下一次会话:
用户: "上次查的那个路线多远来着？"
  ↓ Knowledge Retriever 命中
  ↓ Agent: "根据您之前查询的结果，北京到上海驾车约 1214km，预计 13 小时。"
```

### 7.2 跨通道知识共享

```
飞书群里:
张三: "我们项目的部署命令是什么？"
  ↓ Agent 回答: "pnpm build:secure"
  ↓ 事实提炼: {type: "operational", content: "部署命令: pnpm build:secure"}

Web UI 里 (同一用户):
用户: "帮我部署"
  ↓ Knowledge Retriever 命中
  ↓ Agent 直接使用正确的部署命令，无需再问
```

### 7.3 Skill 执行结果复用

```
用户通过 Skill 生成代码审查报告:
  ↓ 事实提炼: {type: "episodic", content: "审查发现3个问题: XSS注入/SQL注入/未加密存储"}
  ↓
后续对话:
用户: "上次审查的那些安全问题修了吗？"
  ↓ Agent: "根据之前的审查，发现了 3 个安全问题..."
```

### 7.4 用户偏好自动积累

```
多次交互中 Agent 观察到:
  - 用户总是要求中文回复
  - 用户偏好 TypeScript 而非 JavaScript
  - 用户的项目是 Vitest 测试框架
  ↓ 自动提炼为 factual 类型知识
  ↓ 后续会话自动应用这些偏好
```

---

## 八、实现路径

### Phase 1: MVP (P1, ~2周)

- [ ] `knowledge.db` 数据库初始化（facts + facts_fts 表）
- [ ] Fact Extractor 基础版（tool_result_persist hook → LLM 抽取）
- [ ] 入口过滤器（temporal/error/short 跳过）
- [ ] Knowledge Retriever 基础版（FTS5 单阶段检索）
- [ ] Gateway API: `knowledge.search` / `knowledge.stats`
- [ ] 基础单元测试（≥30 例）

### Phase 2: 智能检索 (P2, ~1周)

- [ ] 向量 embedding 支持（复用 SiliconFlow / bge-m3）
- [ ] RRF 混合检索（FTS5 + 向量）
- [ ] 语义去重（cosine > 0.92 合并）
- [ ] 两阶段检索（粗筛 + LLM re-rank）
- [ ] 准确率测试（参考 tool-index.accuracy.test.ts 模式）

### Phase 3: 生命周期管理 (P2, ~1周)

- [ ] 时间衰减引擎（遗忘曲线）
- [ ] 访问强化（常用知识提权）
- [ ] 归档/清理策略
- [ ] 知识统计面板（Web UI）
- [ ] 用户手动管理（查看/删除/编辑 facts）

### Phase 4: Knowledge Graph — V2 (P3, 未定)

- [ ] 实体关系三元组抽取
- [ ] 图结构存储
- [ ] 多跳推理检索
- [ ] 知识合并/冲突消解

---

## 九、技术选型

| 决策点 | 选型 | 理由 |
|--------|------|------|
| **存储引擎** | SQLite (独立 knowledge.db) | 复用现有基础设施；与 memory.db / tool-index.sqlite 隔离 |
| **全文搜索** | FTS5 + trigram tokenizer | 已有 CJK 支持经验；500K 文档内性能优秀 |
| **向量索引** | sqlite-vec (已集成) | 与 tool-index 共用扩展；小规模 (<100K) 足够 |
| **扩展点** | `tool_result_persist` hook | 已存在，零侵入 |
| **事实抽取** | 主 LLM (会话结束时批量) | 避免新增模型依赖；可选 Haiku 降低成本 |
| **向量模型** | bge-m3 via SiliconFlow | 与 tool-index 一致；无 key 时降级为纯 FTS5 |
| **ID 生成** | nanoid | 与现有系统一致 |

---

## 十、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| LLM 事实抽取质量不稳定 | 中 | 中 | 设 confidence 阈值；低置信度标记待确认 |
| 事实抽取消耗额外 token | 中 | 低 | 会话结束时批量处理；可选 Haiku 模型 |
| 语义去重误合并不同知识 | 低 | 中 | 0.92 阈值保守；合并前保留原始引用 |
| 用户隐私敏感信息被提炼 | 中 | 高 | 提炼 prompt 中加入隐私过滤指令；用户可手动删除 |
| SQLite 文件损坏 | 极低 | 高 | WAL 模式；定期 PRAGMA integrity_check |

---

## 十一、成功指标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 知识命中率 | 用户追问"上次..."时 >80% 命中 | 手动测试 + 日志统计 |
| 蒸馏压缩比 | ≥10:1 | 原始 tool result size / fact size |
| 检索延迟 | P99 < 300ms (含 re-rank) | benchmark |
| 存储增长 | < 10 MB/年 (正常使用) | 监控 knowledge.db 文件大小 |
| 去重率 | ≥20% 新 facts 被合并 | 统计 merge vs create 比例 |
| 三年存储 | < 25 MB | 容量估算验证 |

---

## 十二、参考资料

- **Mem0 论文** (arXiv:2504.19413) — 14:1 压缩，94.5% 准确率，事实抽取+图谱合并
- **LangGraph Store** — Checkpointer(会话内) + Store(跨会话) 分层，TTL sweeper
- **MemGPT/Letta** — OS 虚拟内存范式，LLM 作为内存控制器，递归摘要
- **Apple Intelligence** — 设备端语义索引，7GB 空间预算，4-bit 量化
- **Microsoft Copilot** — Graph 统一 API + 语义索引，权限感知检索
- **OpenAI Assistants** — Thread/Run/Vector Store，服务端托管
- **SQLite FTS5** — 500K 文档内性能优秀，trigram tokenizer 支持 CJK
- **"Lost in the Middle"** (Stanford, arXiv:2307.03172) — LLM 注意力 U 型曲线
