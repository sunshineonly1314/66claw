# 统一工具查询系统使用指南

## 概述

OpenClawCN 包含 **11,969 个工具**的统一索引系统，支持中英文混合搜索。

### 🚀 智能推荐策略

系统采用 **FTS5 + 向量** 混合搜索架构，分两个阶段启用：

| 阶段 | 条件 | 搜索方式 | 性能 |
|------|------|----------|------|
| **Phase 1: 纯 FTS5** | 默认（无需配置） | BM25 全文搜索 + LIKE fallback | 快速 (<10ms) |
| **Phase 2: 混合搜索** | 配置硅基流动 API Key | FTS5 (40%) + 向量 (60%) + RRF 融合 | 精准 (~50ms) |

**用户刚启动时**：
1. ✅ **立即可用** - 使用 FTS5 BM25，无需任何配置
2. 🔧 **可选升级** - 配置 `SILICONFLOW_API_KEY` 后自动升级为混合搜索
3. 📊 **降级策略** - 向量化失败时自动回退到 FTS5

### 工具分类

| 类型 | 数量 | 说明 |
|------|------|------|
| Core | 18 | 核心工具（文件操作、网络、桌面控制等） |
| MCP  | 9,535 | Model Context Protocol 服务器 |
| Skills | 2,416 | Agent 技能库（已汉化） |
| **总计** | **11,969** | - |

## 命令行查询工具

### 安装与构建

```bash
# 1. 构建工具索引（FTS5 索引，立即可用）
pnpm tool-index:build

# 输出: data/tool-index.sqlite (8.1MB)
# 状态: 纯 FTS5 搜索

# 2. 【可选】启用向量化（需要硅基流动 API Key）
export SILICONFLOW_API_KEY=sk-xxx
pnpm tool-index:build

# 输出: data/tool-index.sqlite (增加向量数据，~12MB)
# 状态: FTS5 + 向量混合搜索
```

### 🔑 获取硅基流动 API Key

1. 访问 https://cloud.siliconflow.cn/
2. 注册账号（免费）
3. 创建 API Key
4. 设置环境变量：
   ```bash
   # Linux/Mac
   export SILICONFLOW_API_KEY=sk-your-key-here

   # Windows (PowerShell)
   $env:SILICONFLOW_API_KEY="sk-your-key-here"

   # Windows (CMD)
   set SILICONFLOW_API_KEY=sk-your-key-here
   ```

### 向量化配置

**默认模型**：`BAAI/bge-m3` (1024维)
**API 端点**：`https://api.siliconflow.cn/v1/embeddings`
**批量大小**：64 条/批次
**预计时间**：11,969 条 × 1024 维 ≈ 5-10 分钟

### 查询命令

```bash
# 基本用法
pnpm tool-index:query <查询词> [选项]

# 或使用 npm/yarn
npm run tool-index:query -- <查询词> [选项]
yarn tool-index:query <查询词> [选项]
```

### 选项

| 选项 | 说明 | 示例 |
|------|------|------|
| `--limit <n>` | 限制结果数量（默认20） | `--limit 10` |
| `--type <type>` | 过滤类型：`core`, `mcp`, `skill` | `--type mcp` |
| `--china` | 仅显示中国可用的工具 | `--china` |
| `--json` | 输出 JSON 格式 | `--json` |
| `--help` | 显示帮助信息 | `--help` |

### 使用示例

```bash
# 1. 搜索微信相关工具
pnpm tool-index:query 微信 --limit 5

# 2. 搜索地图服务（仅 MCP）
pnpm tool-index:query 地图 --type mcp --limit 10

# 3. 搜索搜索引擎（仅中国可用）
pnpm tool-index:query search --china

# 4. 搜索文件管理工具（仅 Skills）
pnpm tool-index:query 文件管理 --type skill --limit 3

# 5. 输出 JSON 格式（用于脚本）
pnpm tool-index:query AI助手 --json > results.json
```

### 输出格式

```
📊 Found 5 results:

1. ⚙️ wechat_send (core)
   ID: core:wechat_send
   通过桌面自动化发送微信消息
   标签: wechat, send, 微信, 发送, 消息, 聊天

2. 🔌 微信读书 (mcp)
   ID: mcp:@package-mcp-server-weread
   一个为微信读书提供MCP服务的工具，支持将微信读书的书籍...
   标签: ai

3. 🎯 wechat-bot (skill)
   ID: skill:wechat-bot
   微信机器人技能，支持自动回复和消息管理。
   标签: 微信, 机器人, 自动化, 消息管理
   ✅ 中国可用性: available
```

### 图标说明

- ⚙️ **Core** - 核心工具
- 🔌 **MCP** - MCP 服务器
- 🎯 **Skills** - Agent 技能

### 可用性标记

- ✅ **available** - 中国可直接使用
- 🌐 **vpn_required** - 需要 VPN
- ⚠️ **platform_restricted** - 平台限制（如仅 macOS）

## 搜索原理

### FTS5 全文搜索

- **英文查询**：直接使用 FTS5 BM25 算法
- **中文查询（≥3字）**：使用 3-gram 滑窗分词
  - 示例："地图导航" → "地图导", "图导航", "地图导航"
- **中文查询（<3字）**：自动回退到 LIKE 模糊匹配
  - 示例："微信" → LIKE '%微信%'

### 搜索字段

查询会匹配以下字段：
- **name** - 工具名称
- **description** - 英文描述
- **description_cn** - 中文描述
- **tags** - 标签列表

## 数据来源

### 1. Skills 数据 (2,696 个)

- **来源**: `data/skills-availability-dictionary-enriched.json`
- **汉化**: 智谱 GLM-4-Flash API（并发20，~9分钟）
- **字段**:
  - `nameZh` - 中文名称
  - `descriptionZh` - 中文描述
  - `tags` - 3-5 个标签
  - `keywords` - 6-10 个关键词
  - `useCases` - 3-5 个使用场景
  - `availability.china.status` - 中国可用性

### 2. MCP 数据 (9,535 个)

- **来源**: `data/mcp-index.json`
- **字段**:
  - `friendlyName` - 友好名称（已汉化）
  - `description` - 描述（已汉化）
  - `category` - 分类（ai, search, productivity 等）
  - `platforms` - 支持平台
  - `sourceUrl` - 来源地址

### 3. Core 工具 (18 个)

- **来源**: `scripts/build-tool-index.ts` 内置
- **包含**: web_search, web_fetch, image_gen, bash, read, write, edit, glob, grep, browser, canvas, message, tts, sessions_spawn, desktop_control, open_app, wechat_send, wechat_check

## 更新数据

### 重新汉化 Skills

```bash
# 使用智谱 GLM API
GLM_API_KEY=your_key pnpm tsx scripts/enrich-skills-metadata.ts

# 默认使用缓存，增量更新
# 输出: data/skills-availability-dictionary-enriched.json
```

### 重新构建索引

```bash
# 从最新的 JSON 数据构建索引
pnpm tool-index:build

# 输出: data/tool-index.sqlite
```

### 验证索引

```bash
# 检查索引统计
pnpm tsx scripts/check-tool-index.ts

# 输出示例:
# Total entries: 11969
# By type:
#   mcp        9,535
#   skill      2,416
#   core       18
```

## 已知限制

1. **FTS5 trigram 限制**
   - 中文查询 <3 字符无法使用 FTS5，自动回退到 LIKE
   - 性能: FTS5 < 10ms, LIKE ~50-100ms
   - 解决方案：启用向量搜索后，短查询也能准确匹配

2. **向量化可选**
   - 默认情况：纯 FTS5 搜索（无需配置，立即可用）
   - 升级方案：配置 SiliconFlow API Key 后自动升级为混合搜索
   - 降级策略：API Key 失效或限流时自动回退到 FTS5

3. **中国可用性检测**
   - 基于规则自动推断（域名、平台等）
   - 可能需要人工验证

## 集成到代码

### 使用 tool-discovery.ts

```typescript
import { discoverTools } from "./src/dispatch/tool-discovery.js";

const results = await discoverTools(
  db,
  "我想发送微信消息",
  {
    maxResults: 10,
    types: ["core", "mcp", "skill"],
  }
);

console.log(results.skillHints);  // ["wechat-bot", ...]
console.log(results.toolHints);   // ["core:wechat_send", ...]
```

### 使用 hybridSearch (底层 API)

```typescript
import { hybridSearch } from "./src/dispatch/tool-index.js";

const results = await hybridSearch(
  db,
  "地图导航",
  {
    maxResults: 20,
    minScore: 0.1,
    hybridWeight: { fts: 0.4, vector: 0.6 },
  }
);

for (const r of results) {
  console.log(r.id, r.type, r.name, r.score);
}
```

## 常见问题

### Q: 首次启动需要配置什么吗？

A: **不需要！** 系统默认使用 FTS5 BM25 搜索，立即可用。如果想要更精准的语义搜索，可以：

1. 获取硅基流动免费 API Key
2. 设置环境变量 `SILICONFLOW_API_KEY`
3. 重新运行 `pnpm tool-index:build`

### Q: 向量化需要多长时间？需要付费吗？

A:
- **时间**: 11,969 条工具 × 1024 维 ≈ 5-10 分钟（一次性）
- **费用**: 硅基流动提供免费额度，`BAAI/bge-m3` 模型免费
- **增量**: 后续只向量化新增的工具，速度更快

### Q: 为什么搜索"地图导航"找不到结果？

A:
1. **FTS5 限制**: "导航"这个词可能不在数据库中
2. **解决方案**:
   - 方案 1: 搜索单独的"地图" → `pnpm tool-index:query 地图 --type mcp`
   - 方案 2: 启用向量搜索，语义匹配"导航"相关工具

### Q: 如何只搜索中国可用的工具？

A: 使用 `--china` 选项：

```bash
pnpm tool-index:query 搜索引擎 --china
```

### Q: 如何导出所有 MCP 工具列表？

A: 使用 JSON 输出重定向：

```bash
pnpm tool-index:query "" --type mcp --limit 9999 --json > mcp-tools.json
```

### Q: 查询速度慢怎么办？

A:
1. 减少 `--limit` 参数
2. 使用 `--type` 过滤特定类型
3. **FTS5 模式** (默认): <10ms，非常快
4. **混合模式** (启用向量): ~50ms，稍慢但更准确

### Q: 向量化失败了怎么办？

A: 系统会自动回退到 FTS5 搜索，不影响使用。常见失败原因：
- API Key 无效或过期 → 重新获取
- 网络问题 → 检查代理设置
- sqlite-vec 扩展缺失 → 检查 `node_modules/.pnpm/sqlite-vec*/`

---

**更新时间**: 2026-02-18
**版本**: v1.0.0
**维护者**: OpenClawCN Team
