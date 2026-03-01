# 记忆系统设计文档 (Memory System Design)

> 最后更新: 2026-02-24 | 版本: v2.0 (容量扩展 + 安全加固)

## 一、架构总览

三层记忆架构，灵感来自 ChatGPT Memory / Mem0 / MemGPT：

```
┌─────────────────────────────────────────────────┐
│  L0: Session Archive (JSONL)                     │
│  ← 压缩前自动归档原始对话                         │
│  路径: memory/sessions/*.jsonl                    │
│  容量: 5MB LRU 旋转                              │
└────────────────────┬────────────────────────────┘
                     │ 淘汰时归档
┌────────────────────▼────────────────────────────┐
│  L1: Hot Profile (JSON)                          │
│  ← 每轮注入系统提示词                             │
│  路径: memory/profile.json                        │
│  容量: 80 条目, 8000 字符提示词上限               │
│  淘汰: 评分排序, 分类保护                         │
└────────────────────┬────────────────────────────┘
                     │ 淘汰时归档 (hits≥1, score≥0.5)
┌────────────────────▼────────────────────────────┐
│  L2: Cold Archive (Markdown → SQLite FTS5)       │
│  ← 按需语义检索, 不注入系统提示词                  │
│  路径: memory/profile-archive.md                  │
│  容量: 200KB × 10 旋转文件 ≈ 2MB                 │
│  检索: chokidar 文件监视 → SQLite FTS5 索引       │
└─────────────────────────────────────────────────┘
```

## 二、核心评分公式

```
score = categoryWeight + 0.15 × hits^0.7 + 0.3 × 0.5^(ageDays/14)
```

### 分类权重

| 分类 | 权重 | 设计意图 |
|------|------|----------|
| identity | 1.00 | 用户身份 — 最高优先级 |
| correction | 0.95 | 用户纠正 — 代理准确性依赖 |
| procedure | 0.70 | 规则/流程 — 工作方式 |
| preference | 0.60 | 偏好 — 个性化体验 |
| fact | 0.50 | 项目事实 — 可能过时 |
| todo | 0.30 | 待办 — 天然短命 |

### 评分组件

| 组件 | 公式 | 说明 |
|------|------|------|
| 分类基础分 | `categoryWeight` | 固定值, 决定天花板 |
| Hits 强化 | `0.15 × hits^0.7` | 递减收益, 防止 hits 膨胀 |
| 时间衰减 | `0.3 × 0.5^(ageDays/14)` | 14 天半衰期, 90 天后≈0 |

### 衰减时间表 (零 hits)

| 天数 | identity | correction | procedure | preference | fact | todo |
|------|----------|------------|-----------|------------|------|------|
| 0 | 1.30 | 1.25 | 1.00 | 0.90 | 0.80 | 0.60 |
| 14 | 1.15 | 1.10 | 0.85 | 0.75 | 0.65 | 0.45 |
| 28 | 1.08 | 1.03 | 0.78 | 0.68 | 0.58 | 0.38 |
| 56 | 1.02 | 0.97 | 0.72 | 0.62 | 0.52 | 0.32 |
| 90 | 1.00 | 0.95 | 0.70 | 0.60 | 0.50 | 0.30 |

## 三、记忆有效期

| 分类 | 零 hits 有效期 | 1 hit 后 | 保护槽位 |
|------|---------------|---------|---------|
| identity | **永久** | 永久 | 15 个 |
| correction | **永久** | 永久 | 15 个 |
| procedure | **永久** | 永久 | 无 |
| preference | **永久** | 永久 | 无 |
| fact | **~22 天** | **永久** | 无 |
| todo | 立即可被淘汰 + 30 天自动清理 | 永久 | 无 |

关键: fact 只要被访问过 1 次 (hits=1) 就永久安全。

## 四、关键常量

```typescript
// 容量
PROFILE_MAX_ENTRIES = 200          // 热记忆条目上限
PROFILE_MAX_PROMPT_CHARS = 8000    // 系统提示词注入上限 (默认)
PROFILE_ARCHIVE_MAX_BYTES = 200_000 // 单个归档文件上限
ARCHIVE_MAX_ROTATIONS = 10         // 归档旋转上限 (~2MB 总量)

// 保护
PROTECTED_CATEGORY_MINIMUMS = { identity: 15, correction: 15 }

// 清理
STALE_TODO_DAYS = 30              // 零 hits todo 自动清理天数

// 归档门槛
ARCHIVE_MIN_HITS = 1              // 最低 hits 才有资格归档
ARCHIVE_MIN_SCORE = 0.5           // 最低评分才有资格归档

// 整合
CONSOLIDATION_PROFILE_THRESHOLD = 160  // 触发 LLM 整合的条目数
CONSOLIDATION_TURN_INTERVAL = 50       // 每 50 轮触发一次

// 提取
MAX_EXTRACTIONS_PER_TURN = 5      // 每轮最多提取 5 条
periodicTurnInterval = 5           // 每 5 轮定期提取

// 动态提示词预算
contextWindow ≤ 32K → maxChars = 3000
contextWindow ≤ 64K → maxChars = 5000
contextWindow > 64K → maxChars = 8000 (默认)
```

## 五、数据流

### 5.1 记忆提取流 (写入)

```
用户消息 → shouldRunMemoryExtraction() 判断触发条件
  ├─ 关键词匹配 ("记住", "我叫", "always", ...)
  ├─ 长消息 (≥300 字符)
  └─ 定期触发 (每 5 轮)
        ↓
callExtractionLLM() — 免费 CN LLM 提取 (fallback chain)
  ├─ ant-ling/ling-1t (首选)
  ├─ meituan-longcat/longcat-flash-chat
  ├─ siliconflow/Qwen3-8B
  └─ 用户主模型 (最后手段)
        ↓
parseExtractionResult() → 最多 5 条 ExtractionEntry
        ↓
代码级去重: isSimilarValue() 过滤已有相同值
        ↓
withProfileLock() → upsertProfileEntryFull()
  ├─ 已有条目: hits + 1 (强化)
  ├─ 新条目: hits = 0
  ├─ 过期 todo: 自动清理
  └─ 超容量: evictByScore() 淘汰低分条目
        ↓
archiveEvictedEntries() → profile-archive.md (fire-and-forget)
        ↓
runMemoryConsolidation() → LLM 整合重复/过时条目 (fire-and-forget)
```

### 5.2 记忆注入流 (读取)

```
Agent Turn 开始
  ↓
readProfile() → 内存缓存 (5 秒 TTL) 或磁盘读取
  ↓
formatProfileForSystemPrompt(maxChars) → 按评分排序, 截断
  ↓
[可选] coldMemoryRetrieval() → SQLite FTS5 查询 profile-archive
  ↓
buildEmbeddedSystemPrompt() → 注入 system prompt
  ↓
[可选] reinforceMatchingEntries() → 冷检索匹配的热条目 hits+1
```

## 六、安全机制

### 6.1 数据损坏防护

| 机制 | 实现 | 位置 |
|------|------|------|
| JSON 解析失败检测 | readProfile() 区分 ENOENT vs 损坏 | profile-store.ts:183 |
| 损坏文件备份 | `.corrupt.{timestamp}` 自动备份 | profile-store.ts:197 |
| 损坏标记阻止写入 | `_corruptedProfiles` Set 阻止 withProfileLock 写入 | profile-store.ts:300 |
| 写入前验证 | 写 tmp → 回读验证 → rename | profile-store.ts:235 |
| 目录删除检测 | 条目突然归零 + 文件不存在 → 拒绝写入 | profile-store.ts:312 |

### 6.2 并发安全

| 机制 | 实现 |
|------|------|
| 写锁序列化 | `_writeLocks` Map, Promise 链式排队 |
| 整合快照保护 | `snapshotTimestamp` — LLM 调用前快照, 之后写入的条目不被删除 |
| 时间戳单调递增 | `Math.max(Date.now(), maxExisting + 1)` |
| 强化 debounce | 60 秒内更新的条目不被 reinforceMatchingEntries 强化 |

### 6.3 注入防御

| 攻击面 | 防御 |
|--------|------|
| key/value 换行注入 | `\r\n` → 空格/分号替换 |
| 提示词预算溢出 | maxChars 截断 + UTF-16 代理对安全 |
| 单字符 key 误匹配 | reinforceMatchingEntries 要求 key.length ≥ 2 |

## 七、归档与冷检索

### 归档条件

被淘汰的条目必须同时满足:
1. `hits ≥ 1` (至少被强化过 1 次)
2. `score ≥ 0.5` (非垃圾条目)
3. `category ≠ "todo"` (todo 不归档)

### 归档旋转

```
profile-archive.md (200KB) → 满 → rename → profile-archive-001.md
profile-archive.md (新) → 满 → rename → profile-archive-002.md
...
最多 10 个旋转文件, 总量 ~2MB
超出后写入 .evicted-recovery.jsonl (100KB 兜底)
```

### 冷检索

- 触发: Agent Turn 开始时, 用户消息 + 最近助手回复作为查询
- 方式: SQLite FTS5 全文搜索 (chokidar 监视 memory/**/*.md 自动索引)
- 结果: 注入 system prompt 的 `coldMemoryBlock`
- 跳过: ≤32K 模型不做冷检索 (节省上下文空间)
- 正反馈: 冷检索匹配的热条目 hits+1

## 八、性能指标

| 操作 | 耗时 |
|------|------|
| 1000 次 upsert (含排序+淘汰) | 17ms |
| 1000 次 computeEntryScore | < 1ms |
| 10 次满容量 formatProfileForSystemPrompt | 1ms |
| 满容量 evictByScore | < 1ms |

## 九、关键文件索引

| 文件 | 职责 |
|------|------|
| `src/memory/profile-store.ts` | 核心: 评分、淘汰、读写、归档、强化 |
| `src/memory/profile-retrieval.ts` | 冷检索: SQLite FTS5 查询 |
| `src/auto-reply/reply/memory-extraction.ts` | 自动提取: LLM 提取 + 去重 + 写入 |
| `src/auto-reply/reply/memory-consolidation.ts` | 自动整合: LLM 合并重复/过时条目 |
| `src/auto-reply/reply/memory-key-resolver.ts` | Provider 解析: API key + baseUrl |
| `src/auto-reply/reply/memory-flush.ts` | 压缩前记忆刷盘 (L0) |
| `src/agents/pi-embedded-runner/system-prompt.ts` | 提示词注入: 动态预算 |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Agent Turn: 冷检索 + 强化 |
| `src/agents/tools/memory-upsert-tool.ts` | 手动 upsert 工具 |
| `src/infra/state-migrations.ts` | 迁移: mergeProfileEntries |

## 十、测试覆盖

| 测试文件 | 用例数 | 覆盖 |
|---------|--------|------|
| `profile-store.score.test.ts` | 12 | 评分公式、淘汰、保护、hits 强化 |
| `profile-store.attack.test.ts` | ~15 | 安全: 注入、溢出、跨分类 |
| `profile-store.stress.test.ts` | 45 | 压力: 衰减曲线、容量饱和、60天模拟、性能 |
| `memory-extraction.saturation.test.ts` | ~10 | 提取饱和、噪声抵抗 |
| `proactive-compaction.test.ts` | ~8 | 压缩触发、阈值 |
| `state-migrations.memory-merge.test.ts` | ~5 | 迁移合并 |

## 十一、已知限制与未来方向

### 已知限制

1. **冷检索质量**: FTS5 关键词匹配, 不支持语义搜索 (同义词/隐含意图)
2. **跨工作区隔离**: 每个工作区独立 profile, 用户身份不共享
3. **时间推理**: 不理解 "上周说的" "之前提到的" 等时间引用
4. **Stale todo 清理时机**: 只在 upsert 时触发, 不主动扫描

### 未来方向 (优先级排序)

| 优先级 | 方向 | 说明 |
|--------|------|------|
| P1 | 全局用户 Profile | identity/preference 跨工作区共享 |
| P2 | Embedding 混合搜索 | FTS5 + 向量搜索, 提升冷检索召回率 |
| P3 | 时间推理 | 解析时间引用, 按时间窗口检索 |
| P4 | LLM 记忆整合 v2 | 定期深度整合, 生成摘要性记忆 |
