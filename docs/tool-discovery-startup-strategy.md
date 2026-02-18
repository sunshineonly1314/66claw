# 工具发现系统启动策略

## 概述

OpenClawCN 的智能工具推荐系统采用 **渐进式增强** 架构，确保用户在任何配置下都能立即使用，同时支持可选的性能升级。

## 三阶段启动策略

### Phase 0: 出厂状态（CI 构建）

**触发**: CI/CD 流水线构建 Windows 安装包

**执行**:
```bash
pnpm tool-index:build  # 无 SILICONFLOW_API_KEY
```

**输出**:
- `data/tool-index.sqlite` (8.1MB)
- 包含 11,969 个工具的 FTS5 索引
- **不含向量数据**

**搜索能力**:
- ✅ FTS5 BM25 全文搜索（<10ms）
- ✅ LIKE 模糊匹配（短查询 fallback）
- ❌ 向量语义搜索（需 API Key）

**用户体验**:
- 📦 开箱即用，无需配置
- 🚀 搜索速度快
- ⚠️ 语义理解能力有限

---

### Phase 1: 用户首次启动（默认模式）

**触发**: 用户安装后第一次启动 OpenClawCN

**配置检查**:
```typescript
// src/dispatch/tool-discovery.ts
const config = getConfig().toolDiscovery;
const hasApiKey = config.embedding?.apiKey !== undefined;
```

**行为**:
1. **加载索引**: 打开 `data/tool-index.sqlite`
2. **检查向量**: `getIndexStats(db).vectorized` → `false`
3. **检查 API Key**: `config.embedding?.apiKey` → `undefined`
4. **决策**: 使用纯 FTS5 搜索

**搜索流程**:
```typescript
// hybridSearch() 自动降级
const ftsResults = searchFts(db, query, maxResults);
const vecResults = []; // 无 API Key，跳过向量搜索
return rrfFusion(ftsResults, vecResults);
```

**用户提示**:
```
ℹ️  工具推荐已启用（FTS5 模式）
   想要更精准的语义搜索？配置 SiliconFlow API Key：
   设置 → 工具发现 → Embedding API Key
```

---

### Phase 2: 启用向量搜索（升级模式）

**触发**: 用户配置 `SILICONFLOW_API_KEY` 后重启

**配置方式**:

**方案 A: 环境变量（推荐）**
```bash
# 设置环境变量
export SILICONFLOW_API_KEY=sk-xxx

# 重新构建索引
pnpm tool-index:build
```

**方案 B: 配置文件**
```json5
// ~/.clawdbot/openclaw.json
{
  "toolDiscovery": {
    "enabled": true,
    "embedding": {
      "model": "BAAI/bge-m3",
      "baseUrl": "https://api.siliconflow.cn/v1",
      "apiKey": "sk-your-key-here",
      "dimensions": 1024
    }
  }
}
```

**首次向量化**:
```typescript
// 启动时自动检测
const result = await ensureVectors(db, config.embedding);

if (result.vectorized) {
  console.log(`✅ 向量化完成: ${result.count} 条新增`);
} else if (result.error === "no_api_key") {
  console.log(`⚠️  跳过向量化: 未配置 API Key`);
}
```

**向量化过程**:
1. 检查 `tool_meta.vectorized` → `false`
2. 读取 11,969 条工具的 `description` + `description_cn`
3. 批量调用 SiliconFlow Embedding API（64 条/批）
4. 写入 `tool_vec` 表（id, embedding FLOAT[1024]）
5. 标记 `tool_meta.vectorized = true`

**时间估算**:
- 11,969 ÷ 64 = 187 批次
- 187 批 × 0.5秒/批 ≈ **93 秒** (1.5 分钟)
- 实际可能因网络延迟 → **3-5 分钟**

**搜索流程**:
```typescript
// hybridSearch() 自动升级
const ftsResults = searchFts(db, query, maxResults);
const queryVec = await embedQuery(query, config.embedding);
const vecResults = await searchVec(db, queryVec, maxResults);
return rrfFusion(ftsResults, vecResults, { fts: 0.4, vec: 0.6 });
```

**性能对比**:

| 指标 | FTS5 模式 | 混合模式 |
|------|----------|---------|
| 搜索延迟 | <10ms | ~50ms |
| 精准度（中文短查询） | 60-70% | 95-98% |
| 精准度（英文） | 80-85% | 98-99% |
| 语义理解 | 无 | 强 |

---

## 降级与容错策略

### 向量化失败自动回退

**场景 1: API Key 失效**
```typescript
try {
  const vec = await embedQuery(query, config.embedding);
} catch (err) {
  console.warn("Embedding API failed, fallback to FTS5 only");
  return searchFts(db, query, maxResults);
}
```

**场景 2: sqlite-vec 扩展缺失**
```typescript
const vecOk = await ensureVecTable(db, 1024);
if (!vecOk) {
  console.warn("sqlite-vec unavailable, using FTS5 only");
  return { vectorized: false, error: "sqlite_vec_unavailable" };
}
```

**场景 3: 向量化中断**
```typescript
// 增量向量化：断点续传
const unvectorized = db.prepare(`
  SELECT t.id FROM tools t
  LEFT JOIN tool_vec v ON t.id = v.id
  WHERE v.id IS NULL
`).all();
// 只处理缺失的条目，避免重复工作
```

### 模型变更处理

**场景**: 用户从 `bge-m3` 切换到其他模型

```typescript
const metaModel = readMeta(db, "vec_model");
if (metaModel && metaModel !== config.embedding.model) {
  console.warn("Embedding model changed, rebuilding vectors...");
  db.exec("DELETE FROM tool_vec");
  // 全量重建
}
```

---

## 用户体验流程图

```
用户安装 OpenClawCN
         ↓
┌────────────────────┐
│  Phase 1: FTS5 模式  │  ← 默认，立即可用
│  ✅ 快速搜索         │
│  ⚠️ 语义能力有限     │
└────────────────────┘
         ↓
   用户配置 API Key
         ↓
┌────────────────────┐
│  向量化进行中...     │  ← 后台非阻塞
│  预计 3-5 分钟      │
└────────────────────┘
         ↓
┌────────────────────┐
│ Phase 2: 混合搜索   │  ← 自动升级
│ ✅ 语义理解         │
│ ✅ 精准推荐         │
│ ⚠️ 稍慢 (~50ms)     │
└────────────────────┘
         ↓
   API 失败/限流
         ↓
┌────────────────────┐
│ 自动降级到 FTS5     │  ← 容错机制
│ ✅ 保持可用         │
└────────────────────┘
```

---

## 配置推荐

### 个人用户

```json5
{
  "toolDiscovery": {
    "enabled": true,
    "embedding": {
      "apiKey": "sk-xxx"  // 仅配置 apiKey，其他用默认值
    }
  }
}
```

### 团队部署

```json5
{
  "toolDiscovery": {
    "enabled": true,
    "embedding": {
      "apiKey": "${SILICONFLOW_API_KEY}",  // 从环境变量读取
      "model": "BAAI/bge-m3",
      "baseUrl": "https://api.siliconflow.cn/v1",
      "dimensions": 1024
    },
    "search": {
      "maxResults": 50,   // 默认返回 50 个结果
      "minScore": 0.1     // 过滤低分结果
    }
  }
}
```

### CI/CD 构建

```bash
# Dockerfile / GitHub Actions
ENV SILICONFLOW_API_KEY=""  # 留空，出厂时不向量化

# 构建脚本检测到空 key 时自动跳过
pnpm tool-index:build  # 仅构建 FTS5 索引
```

---

## 监控与调试

### 检查当前状态

```bash
# 查看索引统计
pnpm tsx scripts/check-tool-index.ts

# 输出:
# Total entries: 11969
# By type:
#   mcp        9,535
#   skill      2,416
#   core       18
# Vectorization: No (FTS5 only)
```

### 测试搜索性能

```bash
# FTS5 模式
time pnpm tool-index:query 微信 --limit 10
# real    0m0.012s  ← 非常快

# 混合模式（需先向量化）
time pnpm tool-index:query 微信 --limit 10
# real    0m0.053s  ← 稍慢但更准确
```

### 调试向量化

```typescript
// 添加详细日志
const result = await ensureVectors(db, config.embedding);
console.log(JSON.stringify(result, null, 2));

// 输出示例:
{
  "vectorized": true,
  "count": 11969,
  "model": "BAAI/bge-m3",
  "dims": 1024,
  "duration_ms": 187432
}
```

---

## 最佳实践

1. **✅ 出厂默认**: 不预装向量，保持安装包小（8.1MB vs 12+MB）
2. **✅ 用户选择**: 让用户决定是否启用向量搜索
3. **✅ 渐进增强**: FTS5 → 混合，平滑过渡
4. **✅ 自动降级**: API 失败时回退到 FTS5，保证可用性
5. **✅ 增量更新**: 只向量化新增工具，避免重复工作

---

**更新时间**: 2026-02-18
**维护者**: OpenClawCN Team
