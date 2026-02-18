# 自动发现系统 (Auto-Discovery)

## 概述

OpenClawCN 的自动发现系统能够从 **3000+ Skills** + **9535+ MCP服务器** + **30+ 核心工具** 中，根据用户输入**自动推荐**最匹配的能力。

### 核心特性

- ✅ **零配置**：无需手动维护 dispatch.yaml 的 hints
- ✅ **实时搜索**：每次对话都从全量索引中搜索
- ✅ **极速响应**：< 50ms（纯内存计算 + 现有缓存）
- ✅ **智能匹配**：关键词 + 标签 + 描述三重匹配
- ✅ **中英双语**：支持中文分词和英文单词边界识别
- ✅ **无依赖**：不需要向量数据库或 embedding 模型
- ✅ **自动降级**：当手动 hints 存在时，自动跳过 auto-discovery

---

## 工作流程

```
用户："帮我查一下北京天气"
    ↓
【1. Dispatch 分类】
    规则引擎识别：general (置信度 0.3，无精确匹配)
    ↓
【2. Auto-Discovery】(自动触发，因为 skills: [] 为空)
    从 3000 skills 中搜索 → 匹配："weather-cn", "openweathermap"
    从 9535 MCP 中搜索 → 匹配："mcp_weather_*", "mcp_homeassistant_*"
    从 30 tools 中搜索 → 匹配："web_search", "web_fetch"
    耗时：38ms
    ↓
【3. Skills 重排序】
    applySkillHints(["weather-cn", "openweathermap"])
    → 前置 + 标注 [推荐/Recommended]
    ↓
【4. Tools 重排序】
    applyToolHints(["web_search", "web_fetch"])
    → 前置推荐的工具
    ↓
【5. AI 推理】
    看到推荐标签，优先选择 weather-cn skill
    (因为有 [推荐] 标记，且国内友好)
    ↓
【6. 执行】
    启动 weather-cn skill，查询天气
```

---

## 匹配算法

### 关键词提取

```typescript
// 中文：按 2-3 字词组合
"帮我查一下北京天气" → ["查一", "一下", "下北", "北京", "京天", "天气", "查一下", "一下北", "下北京", ...]

// 英文：按空格分隔 + 去停用词
"search for weather in Beijing" → ["search", "weather", "beijing"]
```

### 评分规则

1. **名称/描述包含关键词** → +1 分
2. **标签完全匹配** → +2 分（更精准）
3. **官方服务器加权** → ×1.1
4. **高安全评分加权** → ×1.05

**归一化**：`score = min(1.0, matched / total_keywords)`

### Top-N 筛选

- Skills：Top 5
- MCP：Top 5
- Tools：Top 3

---

## 示例场景

### 场景 1：微信发消息

**输入**：`"发微信给张三，告诉他会议延期"`

**Auto-Discovery 结果**：
```json
{
  "skillHints": ["wechat-desktop"],
  "mcpToolHints": [],
  "toolHints": ["wechat_send", "wechat_check"],
  "confidence": 0.85,
  "matchDetails": "skills:[wechat-desktop(0.90)] tools:[wechat_send(0.95),wechat_check(0.70)] latency:42ms"
}
```

**最终选择**：`wechat-desktop` skill + `wechat_send` tool

---

### 场景 2：数据库查询

**输入**：`"SELECT * FROM users WHERE age > 25"`

**Auto-Discovery 结果**：
```json
{
  "skillHints": ["database", "postgres", "redis"],
  "mcpToolHints": ["mcp_database_*", "mcp_postgres_*"],
  "toolHints": [],
  "confidence": 0.92,
  "matchDetails": "skills:[database(0.95),postgres(0.88),redis(0.65)] mcps:[mcp_database_query(0.98)] latency:35ms"
}
```

**最终选择**：`database` skill 或 `mcp_database_query` tool

---

### 场景 3：图像生成

**输入**：`"画一只猫"`

**Auto-Discovery 结果**：
```json
{
  "skillHints": ["openai-image-gen", "stable-diffusion"],
  "mcpToolHints": ["mcp_dalle_*", "mcp_seeddance_*"],
  "toolHints": ["image_gen"],
  "confidence": 0.88,
  "matchDetails": "skills:[openai-image-gen(0.90)] tools:[image_gen(0.95)] latency:40ms"
}
```

**最终选择**：`image_gen` tool（内置 DALL-E / DashScope）

---

## 性能指标

| 指标 | 数值 |
|------|------|
| **Skills 索引加载** | ~6ms（文件缓存） |
| **MCP 索引加载** | ~2ms（内存缓存，5min TTL） |
| **关键词提取** | < 1ms |
| **匹配计算** | 15-40ms（取决于候选数量） |
| **总耗时** | **< 50ms** |
| **内存占用** | +8MB（索引缓存） |

---

## 调试

### 开启调试日志

```yaml
# config/dispatch.yaml
settings:
  debug: true
```

### 示例日志

```
[dispatch/engine] [auto-discovery] skills:[weather-cn(0.90),openweathermap(0.75)] mcps:[mcp_weather_get(0.85)] tools:[web_search(0.60)] latency:38ms
[dispatch/skill-hints] Reordered skills: weather-cn, openweathermap, ...
[dispatch/tool-hints] Reordered tools: web_search, ...
```

---

## 高级配置

### 禁用 Auto-Discovery

```yaml
# config/dispatch.yaml
intents:
  - id: "my_intent"
    skills: ["manual-skill"]  # ← 手动指定，跳过 auto-discovery
```

### 混合模式（手动 + 自动）

```yaml
# config/dispatch.yaml
intents:
  - id: "image_generation"
    skills: ["openai-image-gen"]  # ← 手动优先
    mcpTools: []                   # ← 空数组触发 auto-discovery for MCP
```

此时：
- Skills：使用手动配置 `["openai-image-gen"]`
- MCP：自动发现匹配的 MCP 服务器
- Tools：总是自动发现

---

## 技术细节

### 索引来源

1. **Skills Index**：`~/.openclawcn/skill-entries-cache-{hash}.json`
   - 来源：`src/agents/skills/file-index.ts`
   - 更新：文件 mtime 检测

2. **MCP Index**：`data/mcp-index.json`
   - 来源：ModelScope + Official Registry + Cloud Index
   - 更新：5 分钟缓存

3. **Tools Metadata**：硬编码元数据表
   - 位置：`src/dispatch/auto-discovery.ts:CORE_TOOLS_METADATA`

### 关键代码文件

| 文件 | 功能 |
|------|------|
| `src/dispatch/auto-discovery.ts` | 核心匹配算法 |
| `src/dispatch/tool-hints.ts` | Tools 重排序 |
| `src/dispatch/skill-hints.ts` | Skills 重排序（复用） |
| `src/dispatch/engine.ts` | 集成入口（Line 167-195） |
| `src/agents/clawdbot-tools.ts` | Tools 应用点（Line 196） |

---

## 常见问题

### Q: 为什么不用向量数据库？

A:
1. **性能**：关键词匹配 < 50ms，向量搜索 ~200ms
2. **依赖**：无需 ChromaDB / embedding 模型
3. **准确度**：对于结构化元数据（tags, keywords），关键词匹配已经足够精准

### Q: 如何提高匹配准确率？

A:
1. 完善 Skills/MCP 的元数据（description, tags, descriptionCn, tagsCn）
2. 在 `CORE_TOOLS_METADATA` 中增加工具的关键词
3. 调整评分权重（修改 `calculateTextScore` 函数）

### Q: Auto-Discovery 会覆盖手动配置吗？

A: **不会**。优先级：手动 hints > Auto-Discovery

```typescript
if (!hasManualSkillHints && discovered.skillHints.length > 0) {
  autoDiscoveryHints.skillHints = discovered.skillHints;
}
```

### Q: 能否禁用 Auto-Discovery？

A: 可以。在所有 intent 中手动配置 hints 即可：

```yaml
intents:
  - id: "general"
    skills: []      # ← 空数组也会触发 auto-discovery
    # 改为：
    skills: ["none"]  # ← 显式指定，跳过 auto-discovery
```

---

## 贡献指南

### 增强匹配算法

欢迎在 `src/dispatch/auto-discovery.ts` 中改进匹配逻辑：

1. **同义词支持**：参考 `intent-classifier.ts` 的 synonym-index.ts
2. **模糊匹配**：使用 Levenshtein 距离
3. **语义匹配**：集成轻量级 embedding（如 sentence-transformers.js）

### 增强元数据

1. **Skills**：在 SKILL.md 中完善 frontmatter
2. **MCP**：在 mcp-index.json 中增强 AI 增强字段
3. **Tools**：在 `CORE_TOOLS_METADATA` 中增加关键词

---

## 性能优化建议

1. **缓存关键词提取结果**（当前每次重新提取）
2. **预计算 Skills/MCP 关键词索引**（倒排索引）
3. **并行匹配**（当前串行）
4. **增量更新索引**（当前全量加载）

当前实现优先**简单可靠**，未来可根据实际性能瓶颈优化。

---

**版本**：1.0.0
**最后更新**：2026-02-17
