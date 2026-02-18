# 工具索引 CRUD API

## 概述

`tool-index.ts` 提供了完整的 CRUD（增删改查）接口，支持动态管理 Skills 和 MCP 工具。

---

## ✅ 已支持的功能

| 操作 | 函数 | 自动同步 | 向量化 |
|------|------|----------|--------|
| **增** (Create) | `incrementalUpdate(db, added, [])` | ✅ FTS5 | ✅ 自动向量化新增条目 |
| **删** (Delete) | `incrementalUpdate(db, [], removedIds)` | ✅ FTS5 + Vec | ✅ 清理向量数据 |
| **改** (Update) | `incrementalUpdate(db, [updated], [oldId])` | ✅ FTS5 + Vec | ✅ 重新向量化 |
| **查** (Read) | `hybridSearch(db, query, opts)` | ✅ | ✅ |
| **全量重建** | `buildIndex(db, entries)` | ✅ | ❌ 需手动调用 `ensureVectors()` |

---

## 核心 API

### 1. incrementalUpdate() - 增量更新

**签名**:
```typescript
export function incrementalUpdate(
  db: DatabaseSync,
  added: ToolIndexEntry[],
  removedIds: string[],
): void
```

**说明**:
- 原子操作（事务保护）
- 自动同步 `tools` 主表 + `tools_fts` 索引 + `tool_vec` 向量表
- FTS5 安全删除（逐行 DELETE，避免 UNINDEXED 列限制）

**示例**:

#### 添加新工具
```typescript
import { openToolIndex, incrementalUpdate } from "./src/dispatch/tool-index.js";

const db = openToolIndex();

const newTool: ToolIndexEntry = {
  id: "skill:my-custom-skill",
  type: "skill",
  name: "My Custom Skill",
  description: "A custom skill for my workflow",
  descriptionCn: "我的自定义技能",
  tags: ["custom", "workflow", "自定义"],
  metadataJson: JSON.stringify({
    author: "OpenClawCN",
    version: "1.0.0",
    availability: { china: { status: "available", confidence: 1.0 } }
  })
};

incrementalUpdate(db, [newTool], []);
console.log("✅ Added new skill!");
```

#### 删除工具
```typescript
const skillToRemove = "skill:outdated-skill";

incrementalUpdate(db, [], [skillToRemove]);
console.log("✅ Removed skill!");
```

#### 更新工具（先删后加）
```typescript
const updatedTool: ToolIndexEntry = {
  id: "skill:my-custom-skill",
  type: "skill",
  name: "My Custom Skill v2",  // ← 更新名称
  description: "Updated with new features",
  descriptionCn: "升级版自定义技能",
  tags: ["custom", "workflow", "v2", "自定义"],
};

// 删除旧版本，添加新版本
incrementalUpdate(db, [updatedTool], ["skill:my-custom-skill"]);
console.log("✅ Updated skill!");
```

---

### 2. buildIndex() - 全量重建

**签名**:
```typescript
export function buildIndex(
  db: DatabaseSync,
  entries: ToolIndexEntry[],
): void
```

**说明**:
- 清空所有表（tools, tools_fts, tool_vec）
- 批量插入新数据
- **不自动向量化** - 需手动调用 `ensureVectors()`

**示例**:
```typescript
import { openToolIndex, buildIndex, ensureVectors } from "./src/dispatch/tool-index.js";

// 1. 加载所有工具
const allTools: ToolIndexEntry[] = [
  ...loadCoreTools(),
  ...loadMcpTools(),
  ...loadSkills(),
];

// 2. 全量重建索引
const db = openToolIndex();
buildIndex(db, allTools);

// 3. 可选：向量化
if (process.env.SILICONFLOW_API_KEY) {
  await ensureVectors(db, {
    model: "BAAI/bge-m3",
    baseUrl: "https://api.siliconflow.cn/v1",
    apiKey: process.env.SILICONFLOW_API_KEY,
    dimensions: 1024,
  });
}

console.log("✅ Index rebuilt!");
```

---

### 3. ensureVectors() - 增量向量化

**签名**:
```typescript
export async function ensureVectors(
  db: DatabaseSync,
  embeddingConfig: ToolDiscoveryEmbeddingConfig,
): Promise<{ vectorized: boolean; count: number; error?: string }>
```

**说明**:
- **增量处理**: 只向量化尚未有向量的工具
- **断点续传**: 中途失败后可重新运行，不会重复工作
- **模型变更检测**: 切换模型时自动全量重建

**示例**:
```typescript
import { openToolIndex, ensureVectors } from "./src/dispatch/tool-index.js";

const db = openToolIndex();

const result = await ensureVectors(db, {
  model: "BAAI/bge-m3",
  baseUrl: "https://api.siliconflow.cn/v1",
  apiKey: "sk-your-key",
  dimensions: 1024,
});

if (result.vectorized) {
  console.log(`✅ Vectorized ${result.count} new entries`);
} else {
  console.error(`❌ Vectorization failed: ${result.error}`);
}
```

---

## 实际场景示例

### 场景 1: 添加自定义 Skill

```typescript
// scripts/add-custom-skill.ts
import { openToolIndex, incrementalUpdate, ensureVectors } from "../src/dispatch/tool-index.js";
import type { ToolIndexEntry } from "../src/config/types.tool-discovery.js";

async function addCustomSkill(skillData: {
  id: string;
  name: string;
  description: string;
  tags: string[];
}) {
  const db = openToolIndex();

  // 1. 构建工具条目
  const entry: ToolIndexEntry = {
    id: `skill:${skillData.id}`,
    type: "skill",
    name: skillData.name,
    description: skillData.description,
    descriptionCn: skillData.description, // 可选：调用翻译 API
    tags: skillData.tags,
    metadataJson: JSON.stringify({
      custom: true,
      createdAt: new Date().toISOString(),
    }),
  };

  // 2. 添加到索引
  incrementalUpdate(db, [entry], []);
  console.log(`✅ Added skill: ${entry.name}`);

  // 3. 可选：向量化
  if (process.env.SILICONFLOW_API_KEY) {
    const result = await ensureVectors(db, {
      model: "BAAI/bge-m3",
      baseUrl: "https://api.siliconflow.cn/v1",
      apiKey: process.env.SILICONFLOW_API_KEY,
      dimensions: 1024,
    });
    console.log(`✅ Vectorized: ${result.count} new entries`);
  }
}

// 使用
await addCustomSkill({
  id: "my-workflow",
  name: "My Workflow",
  description: "Automate my daily tasks",
  tags: ["automation", "workflow", "custom"],
});
```

---

### 场景 2: 批量删除过时的 MCP

```typescript
// scripts/cleanup-deprecated-mcps.ts
import { openToolIndex, incrementalUpdate } from "../src/dispatch/tool-index.js";
import { hybridSearch } from "../src/dispatch/tool-index.js";

async function cleanupDeprecatedMcps() {
  const db = openToolIndex();

  // 1. 搜索所有标记为 deprecated 的 MCP
  const results = await hybridSearch(db, "deprecated", {
    maxResults: 1000,
    minScore: 0.0,
  });

  const deprecatedIds = results
    .filter(r => r.entry.type === "mcp")
    .filter(r => {
      const meta = JSON.parse(r.entry.metadataJson || "{}");
      return meta.deprecated === true;
    })
    .map(r => r.entry.id);

  if (deprecatedIds.length === 0) {
    console.log("✅ No deprecated MCPs found");
    return;
  }

  // 2. 批量删除
  incrementalUpdate(db, [], deprecatedIds);
  console.log(`✅ Removed ${deprecatedIds.length} deprecated MCPs`);
}

await cleanupDeprecatedMcps();
```

---

### 场景 3: 更新 Skill 描述（批量翻译）

```typescript
// scripts/translate-skills.ts
import { openToolIndex, incrementalUpdate } from "../src/dispatch/tool-index.js";
import { hybridSearch } from "../src/dispatch/tool-index.js";

async function translateAllSkills(translationFn: (text: string) => Promise<string>) {
  const db = openToolIndex();

  // 1. 获取所有未翻译的 Skills
  const allSkills = await hybridSearch(db, "", {
    maxResults: 10000,
    minScore: 0.0,
  });

  const needsTranslation = allSkills
    .filter(r => r.entry.type === "skill")
    .filter(r => !r.entry.descriptionCn);

  console.log(`Found ${needsTranslation.length} skills needing translation`);

  // 2. 批量翻译
  const updated: ToolIndexEntry[] = [];
  for (const r of needsTranslation) {
    const descriptionCn = await translationFn(r.entry.description);
    updated.push({
      ...r.entry,
      descriptionCn,
    });
  }

  // 3. 批量更新
  const updatedIds = updated.map(e => e.id);
  incrementalUpdate(db, updated, updatedIds);
  console.log(`✅ Updated ${updated.length} skills`);
}

await translateAllSkills(async (text) => {
  // 调用翻译 API
  return `翻译: ${text}`;
});
```

---

### 场景 4: 同步外部 MCP 注册表

```typescript
// scripts/sync-mcp-registry.ts
import { openToolIndex, incrementalUpdate } from "../src/dispatch/tool-index.js";
import type { ToolIndexEntry } from "../src/config/types.tool-discovery.js";

async function syncExternalRegistry(registryUrl: string) {
  const db = openToolIndex();

  // 1. 从外部注册表拉取最新数据
  const response = await fetch(registryUrl);
  const registry = await response.json();

  // 2. 构建新的 MCP 条目
  const newMcps: ToolIndexEntry[] = registry.servers.map((server: any) => ({
    id: `mcp:${server.id}`,
    type: "mcp" as const,
    name: server.name,
    description: server.description,
    descriptionCn: server.descriptionCn || "",
    tags: server.tags || [],
    metadataJson: JSON.stringify({
      npmPackage: server.npmPackage,
      version: server.version,
      lastUpdated: new Date().toISOString(),
    }),
  }));

  // 3. 查找需要删除的旧条目
  const existingMcps = await hybridSearch(db, "", {
    maxResults: 10000,
    minScore: 0.0,
  });

  const existingIds = new Set(existingMcps.filter(r => r.entry.type === "mcp").map(r => r.entry.id));
  const newIds = new Set(newMcps.map(e => e.id));
  const toRemove = [...existingIds].filter(id => !newIds.has(id));

  // 4. 增量更新
  incrementalUpdate(db, newMcps, toRemove);
  console.log(`✅ Synced: +${newMcps.length} added, -${toRemove.length} removed`);
}

await syncExternalRegistry("https://registry.example.com/mcp-servers.json");
```

---

## 注意事项

### ✅ DO

1. **使用事务** - `incrementalUpdate()` 已内置事务，无需手动管理
2. **增量向量化** - 调用 `ensureVectors()` 会自动检测新增条目
3. **批量操作** - 一次 `incrementalUpdate()` 可添加/删除多个条目
4. **验证 ID** - 确保 `id` 格式正确（`core:xxx`, `mcp:xxx`, `skill:xxx`）
5. **元数据结构化** - 使用 `metadataJson` 存储扩展信息

### ❌ DON'T

1. **不要直接操作数据库** - 使用 API 而非手动 SQL，避免破坏索引一致性
2. **不要跳过 FTS5 同步** - `incrementalUpdate()` 已自动同步，不要只更新主表
3. **不要忘记向量化** - 添加大量新条目后记得调用 `ensureVectors()`
4. **不要重复 ID** - `INSERT OR REPLACE` 会覆盖旧条目，小心 ID 冲突
5. **不要在事务外操作** - 多表操作必须用事务保证一致性

---

## 性能优化

### 批量添加
```typescript
// ❌ 低效：逐个添加
for (const skill of newSkills) {
  incrementalUpdate(db, [skill], []);
}

// ✅ 高效：批量添加
incrementalUpdate(db, newSkills, []);
```

### 批量删除
```typescript
// ❌ 低效：逐个删除
for (const id of skillIds) {
  incrementalUpdate(db, [], [id]);
}

// ✅ 高效：批量删除
incrementalUpdate(db, [], skillIds);
```

### 向量化策略
```typescript
// ✅ 增量向量化（推荐）
incrementalUpdate(db, newSkills, []);
await ensureVectors(db, embeddingConfig); // 只向量化新增的

// ❌ 全量重建（慢，不推荐）
buildIndex(db, allSkills);
await ensureVectors(db, embeddingConfig); // 重新向量化所有 11,969 条
```

---

## 监控与调试

### 检查更新结果
```typescript
import { getIndexStats } from "./src/dispatch/tool-index.js";

const beforeStats = getIndexStats(db);
incrementalUpdate(db, added, removed);
const afterStats = getIndexStats(db);

console.log(`Entry count: ${beforeStats.entryCount} → ${afterStats.entryCount}`);
console.log(`Vectorized: ${afterStats.vectorized}`);
```

### 验证工具是否存在
```typescript
import { hybridSearch } from "./src/dispatch/tool-index.js";

const results = await hybridSearch(db, "my-custom-skill", {
  maxResults: 1,
  minScore: 0.0,
});

if (results.length > 0 && results[0].entry.id === "skill:my-custom-skill") {
  console.log("✅ Skill exists in index");
} else {
  console.log("❌ Skill not found");
}
```

---

## 集成到 UI

### REST API 示例

```typescript
// src/gateway/server-methods/tool-index-crud.ts
import { openToolIndex, incrementalUpdate, ensureVectors } from "../../dispatch/tool-index.js";
import type { GatewayMethod } from "../types.js";

export const addCustomSkill: GatewayMethod = async (req, operator) => {
  const { name, description, tags } = req.params;

  const db = openToolIndex();
  const entry: ToolIndexEntry = {
    id: `skill:custom-${Date.now()}`,
    type: "skill",
    name,
    description,
    tags,
  };

  incrementalUpdate(db, [entry], []);

  // 可选：自动向量化
  const config = operator.getConfig().toolDiscovery;
  if (config?.embedding?.apiKey) {
    await ensureVectors(db, config.embedding);
  }

  return { success: true, id: entry.id };
};

export const deleteSkill: GatewayMethod = async (req, operator) => {
  const { id } = req.params;

  const db = openToolIndex();
  incrementalUpdate(db, [], [id]);

  return { success: true };
};
```

---

## 总结

| 操作 | 推荐方法 | 自动同步 | 性能 |
|------|----------|----------|------|
| **添加单个工具** | `incrementalUpdate(db, [entry], [])` | ✅ | 快 (~1ms) |
| **批量添加** | `incrementalUpdate(db, entries, [])` | ✅ | 快 (~10ms for 100) |
| **删除单个工具** | `incrementalUpdate(db, [], [id])` | ✅ | 快 (~1ms) |
| **批量删除** | `incrementalUpdate(db, [], ids)` | ✅ | 快 (~10ms for 100) |
| **更新工具** | `incrementalUpdate(db, [updated], [oldId])` | ✅ | 快 (~2ms) |
| **全量重建** | `buildIndex(db, all)` | ✅ | 中 (~100ms for 11k) |
| **向量化** | `ensureVectors(db, config)` | ✅ | 慢 (~3-5 min for 11k) |

---

**更新时间**: 2026-02-18
**版本**: v1.0.0
**维护者**: OpenClawCN Team
