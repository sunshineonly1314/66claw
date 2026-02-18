# MCP Marketplace SQLite 数据库系统

## 概述

为了解决 21MB 的 `mcp-index-enhanced.json` 加载性能问题，我们实现了基于 SQLite 的轻量级搜索系统：

- **目标用户**：前端页面通过 SQLite 数据库实现分页和关键词搜索
- **原始 JSON**：保留给用户本地维护，用于 embedding 等高级功能
- **零侵入设计**：所有新增文件均为 CN-only，不影响上游 OpenClaw 合并

## 架构设计

### 数据流

```
data/mcp-index-enhanced.json (21MB, AI 增强后)
         ↓
  scripts/mcp-sync-to-db.ts (同步脚本)
         ↓
   data/mcp-index.db (14MB, SQLite)
         ↓
  Gateway API (4 个接口)
         ↓
     前端 UI (分页、搜索)
```

### 文件清单

**CN-Only 新增文件**（已加入 `cn-protected-files.json`）：

| 文件 | 说明 | 是否加密 |
|------|------|----------|
| `src/mcp/marketplace/db-schema.ts` | 数据库 schema 定义 | ✅ Bytecode |
| `src/mcp/marketplace/db.ts` | 数据库封装层（CRUD + 搜索） | ✅ Bytecode |
| `src/mcp/marketplace/db.test.ts` | 单元测试（25 个测试） | ❌ |
| `src/gateway/server-methods/mcp-marketplace-search.ts` | Gateway API 实现 | ✅ Bytecode |
| `scripts/mcp-sync-to-db.ts` | JSON → SQLite 同步脚本 | ❌ |

**修改的文件**：

| 文件 | 变更 | 冲突风险 |
|------|------|----------|
| `src/gateway/cn-handlers.ts` | 增加 4 个 MCP 搜索 handler | ⚠️ 低 |
| `config/cn-protected-files.json` | 新增 5 个保护文件 | ✅ 无 |

## 数据库设计

### 主表：mcp_items

存储所有 MCP 元数据（9,535 条记录）：

```sql
CREATE TABLE mcp_items (
  server_id TEXT PRIMARY KEY,           -- @modelcontextprotocol-fetch
  friendly_name TEXT NOT NULL,          -- Fetch
  friendly_name_cn TEXT,                -- 网页抓取器
  description TEXT,
  description_cn TEXT,                  -- 专为LLM设计的...
  category TEXT,                        -- network
  tags TEXT,                            -- JSON: ["fetch", "http"]
  tags_cn TEXT,                         -- JSON: ["网页抓取", "HTML转Markdown"]

  -- AI 增强字段
  china_friendly_score INTEGER,        -- 0-100
  requires_vpn INTEGER DEFAULT 0,      -- 0/1
  china_block_reasons TEXT,            -- JSON: ["依赖境外CDN"]
  runtime_deps TEXT,                   -- JSON: ["Node.js >=18"]
  system_deps TEXT,                    -- JSON: ["Puppeteer"]
  category_enhanced TEXT,              -- JSON: [{"category":"network","confidence":98}]

  -- 推荐评分
  beginner_friendly INTEGER,           -- 0-100
  enterprise_ready INTEGER,            -- 0-100
  community_activity INTEGER,          -- 0-100

  -- 元数据
  enhanced_at TEXT,                    -- 2026-02-17T10:00:00Z
  ai_model TEXT,                       -- qwen-plus
  ai_version INTEGER,                  -- 1
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

### FTS5 搜索表：mcp_search

中文全文搜索（使用 unicode61 分词器）：

```sql
CREATE VIRTUAL TABLE mcp_search USING fts5(
  server_id UNINDEXED,
  friendly_name_cn,
  description_cn,
  tags_cn,
  tokenize='unicode61 remove_diacritics 2'
)
```

**自动同步触发器**：INSERT/UPDATE/DELETE 时自动更新 FTS 表

### 索引优化

```sql
CREATE INDEX idx_category ON mcp_items(category);
CREATE INDEX idx_china_friendly ON mcp_items(china_friendly_score);
CREATE INDEX idx_requires_vpn ON mcp_items(requires_vpn);
CREATE INDEX idx_is_official ON mcp_items(is_official);
CREATE INDEX idx_updated_at ON mcp_items(updated_at DESC);
```

## API 接口

### 1. `mcp_marketplace.search`

**搜索 MCP（支持分页、过滤、排序）**

```typescript
// 请求
{
  keyword?: string;           // 关键词（全文搜索）
  category?: string;          // 分类过滤
  minChinaScore?: number;     // 国内友好度最低分
  requiresVPN?: boolean;      // 是否需要 VPN
  isOfficial?: boolean;       // 是否官方
  orderBy?: "updated_at" | "china_friendly_score" | "tool_count";
  orderDirection?: "ASC" | "DESC";
  page?: number;              // 页码（从 1 开始）
  pageSize?: number;          // 每页数量（最大 100）
}

// 响应
{
  success: true,
  data: {
    items: McpMarketplaceItem[],
    total: 9535,
    page: 1,
    pageSize: 20,
    totalPages: 477
  }
}
```

**示例**：

```javascript
// 搜索关键词 "网络"，只看国内可用的，按友好度排序
const result = await gateway.invoke("mcp_marketplace.search", {
  keyword: "网络",
  minChinaScore: 70,
  orderBy: "china_friendly_score",
  orderDirection: "DESC",
  page: 1,
  pageSize: 20
});
```

### 2. `mcp_marketplace.get_by_id`

**根据 serverId 获取单个 MCP**

```typescript
// 请求
{
  serverId: "@modelcontextprotocol-fetch"
}

// 响应
{
  success: true,
  data: McpMarketplaceItem
}
```

### 3. `mcp_marketplace.get_stats`

**获取数据库统计信息**

```typescript
// 响应
{
  success: true,
  data: {
    total: 9535,
    enhanced: 9381,        // AI 增强的数量
    requiresVPN: 3600,
    official: 1851,
    categories: {
      "other": 4033,
      "ai": 1503,
      "development": 1440,
      ...
    }
  }
}
```

### 4. `mcp_marketplace.get_categories`

**获取所有分类及计数**

```typescript
// 响应
{
  success: true,
  data: {
    "other": 4033,
    "ai": 1503,
    "development": 1440,
    "search": 919,
    ...
  }
}
```

## 使用指南

### 同步数据到数据库

```bash
# 首次同步（将 21MB JSON 转为 14MB SQLite）
node --import tsx scripts/mcp-sync-to-db.ts

# 输出示例
🚀 MCP Marketplace JSON → SQLite 同步脚本
============================================================
📂 读取文件: data/mcp-index-enhanced.json
✅ 读取到 9535 个 MCP 项目
📥 批量插入数据...
✅ 插入完成，耗时 0.60s
📊 数据库统计:
   总数: 9535
   AI 增强: 9381 (98.4%)
   需要 VPN: 3600
```

### 前端集成示例

```typescript
import { invoke } from "./gateway";

// 分页加载 MCP 列表
async function loadMcpList(page: number) {
  const { data } = await invoke("mcp_marketplace.search", {
    page,
    pageSize: 20,
    orderBy: "updated_at",
    orderDirection: "DESC"
  });

  renderMcpTable(data.items);
  renderPagination(data.totalPages, data.page);
}

// 搜索功能
async function searchMcp(keyword: string) {
  const { data } = await invoke("mcp_marketplace.search", {
    keyword,
    page: 1,
    pageSize: 20
  });

  renderSearchResults(data.items);
}

// 过滤国内可用的 MCP
async function filterChinaFriendly() {
  const { data } = await invoke("mcp_marketplace.search", {
    minChinaScore: 70,
    requiresVPN: false,
    orderBy: "china_friendly_score",
    orderDirection: "DESC"
  });

  renderMcpTable(data.items);
}
```

### 数据库操作（后端）

```typescript
import {
  searchItems,
  getItemById,
  insertItem,
  updateItem,
  deleteItem,
  getStats
} from "./src/mcp/marketplace/db";

// 搜索
const result = searchItems({
  keyword: "文件系统",
  category: "filesystem",
  page: 1,
  pageSize: 10
});

// 查询单个
const item = getItemById("@modelcontextprotocol-fetch");

// 更新
updateItem("@modelcontextprotocol-fetch", {
  friendlyNameCn: "更新后的名称",
  availability: {
    chinaFriendlyScore: 95,
    requiresVPN: false
  }
});

// 插入
insertItem({
  serverId: "@custom/my-mcp",
  friendlyName: "My Custom MCP",
  category: "other"
});

// 统计
const stats = getStats();
console.log(`总数: ${stats.total}, 增强: ${stats.enhanced}`);
```

## 性能指标

### 文件大小对比

| 格式 | 大小 | 压缩率 |
|------|------|--------|
| JSON (原始) | 21 MB | - |
| SQLite | 14 MB | **33% 减少** |

### 查询性能

| 操作 | 时间 | 说明 |
|------|------|------|
| 全量同步（9,535 条） | 0.60s | INSERT OR REPLACE |
| 分页查询（20 条/页） | < 5ms | 使用索引 |
| 关键词搜索 | < 10ms | FTS5 全文索引 |
| 按分类过滤 | < 3ms | idx_category 索引 |
| 获取统计信息 | < 15ms | 聚合查询 |

### 测试覆盖率

```bash
npx vitest run src/mcp/marketplace/db.test.ts

✓ Database Initialization (2 tests)
✓ CRUD Operations (7 tests)
✓ Search Functionality (8 tests)
✓ Full-Text Search (3 tests)
✓ Statistics (2 tests)
✓ Data Integrity (2 tests)
✓ Transaction Support (2 tests)

Test Files  1 passed (1)
     Tests  25 passed (25)
  Duration  28ms
```

## 注意事项

### 数据库隔离

- **MCP 数据库**：`data/mcp-index.db`（MCP 市场搜索）
- **Memory 数据库**：`~/.clawdbot/memory.db`（向量搜索，使用 sqlite-vec）
- **完全隔离**：两者互不影响

### 上游兼容性

所有新增文件均为 CN-only，已加入 `cn-protected-files.json` 保护：

```json
{
  "section1_cn_only": {
    "files": [
      "src/mcp/marketplace/db-schema.ts",
      "src/mcp/marketplace/db.ts",
      "src/mcp/marketplace/db.test.ts",
      "src/gateway/server-methods/mcp-marketplace-search.ts",
      "scripts/mcp-sync-to-db.ts"
    ]
  },
  "cn_encryption": {
    "bytecode": {
      "files": [
        "src/mcp/marketplace/db-schema.ts",
        "src/mcp/marketplace/db.ts",
        "src/gateway/server-methods/mcp-marketplace-search.ts"
      ]
    }
  }
}
```

### 维护建议

1. **定期同步**：每次更新 `mcp-index-enhanced.json` 后运行同步脚本
2. **备份策略**：定期备份 `data/mcp-index.db`
3. **性能优化**：SQLite WAL 模式已启用，支持并发读
4. **FTS5 限制**：中文分词依赖 unicode61，可能无法匹配单字

## 后续扩展

### 计划中的功能

- [ ] **自动同步**：监听 JSON 文件变化，自动触发同步
- [ ] **增量更新**：只同步变更的 MCP（对比 serverId 和 version）
- [ ] **用户收藏**：扩展 schema 支持用户收藏列表
- [ ] **使用统计**：记录 MCP 安装次数、使用频率
- [ ] **标签推荐**：基于用户行为推荐相关 MCP

### 高级搜索

```typescript
// 组合查询示例
const advancedSearch = await invoke("mcp_marketplace.search", {
  keyword: "文件",                    // 关键词匹配
  category: "filesystem",            // 分类过滤
  minChinaScore: 80,                // 国内友好度 ≥80
  requiresVPN: false,               // 不需要梯子
  isOfficial: true,                 // 官方认证
  orderBy: "china_friendly_score",  // 按友好度排序
  orderDirection: "DESC",
  page: 1,
  pageSize: 20
});
```

## 故障排查

### Q: 同步脚本报错 "Transform failed"

**A**: 检查 `scripts/mcp-sync-to-db.ts` 语法错误，确保使用 `node --import tsx` 运行。

### Q: 搜索中文关键词无结果

**A**: FTS5 的 unicode61 分词器可能无法匹配单字，尝试使用 2-3 个字的词组。

### Q: 数据库文件损坏

**A**: 删除 `data/mcp-index.db` 后重新运行同步脚本：
```bash
rm data/mcp-index.db
node --import tsx scripts/mcp-sync-to-db.ts
```

### Q: 性能下降

**A**: 检查索引是否存在，重建索引：
```sql
REINDEX;
ANALYZE;
```

## 相关文档

- [MCP Marketplace AI 增强](./mcp-marketplace-ai-enhancement.md)
- [CN 文件保护机制](./cn-protected-files.md)
- [数据库加密策略](./cn-encryption.md)
