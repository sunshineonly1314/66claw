---
name: clawd-docs-v2
name_zh: Clawd文档v2
description: 具备本地搜索索引、缓存片段及按需获取功能的智能 ClawdBot 文档访问服务。高效利用 token，且具备时效感知能力。
description_zh: 具备本地搜索索引、缓存片段及按需获取功能的智能 ClawdBot 文档访问服务。高效利用 token，且具备时效感知能力。
homepage: https://docs.clawd.bot/
metadata: {"clawdbot":{"emoji":"📚"}}
version: 2.2.0
---
# Clawd-Docs v2.0 — 智能文档访问

本技能提供**智能文档访问**能力，具备以下特性：
- **本地搜索索引** —— 即时关键词查找（0 token）
- **缓存片段** —— 预取常见答案（约 300–500 token）
- **按需获取** —— 需要时调取完整页面（约 8–12k token）
- **时效性追踪** —— 按页面类型设定 TTL（生存时间）

---

## 快速入门

### 步骤 1：优先检查“黄金片段”

在获取任何内容前，先检查是否存在**黄金片段（Golden Snippet）**：

```bash
ls ~/clawd/data/docs-snippets/
```

**可用片段（请先查缓存！）：**  
| 片段 | 匹配查询关键词 |
|------|----------------|
| `telegram-setup.md` | “ako nastaviť telegram”、“telegram setup” |
| `telegram-allowfrom.md` | “allowFrom”、“kto mi môže písať”、“access control” |
| `oauth-troubleshoot.md` | “token expired”、“oauth error”、“credentials” |
| `update-procedure.md` | “ako updatnuť”、“update clawdbot” |
| `restart-gateway.md` | “restart”、“reštart”、“stop/start” |
| `config-basics.md` | “config”、“nastavenie”、“konfigurácia” |
| `config-providers.md` | “pridať provider”、“discord setup”、“nový kanál” |
| `memory-search.md` | “memory”、“vector search”、“pamäť”、“embeddings” |

**读取片段：**  
```bash
cat ~/clawd/data/docs-snippets/telegram-setup.md
```

### 步骤 2：搜索索引（若无黄金片段）

检查 `~/clawd/data/docs-index.json` 获取页面建议。

**关键词匹配示例：**  
- “telegram” → channels/telegram  
- “oauth” → concepts/oauth, gateway/troubleshooting  
- “update” → install/updating  
- “config” → gateway/configuration  

### 步骤 3：检查完整页面缓存

**在通过 brightdata 获取前**，请先确认该页面是否已在本地缓存：

```bash
# Convert path: concepts/memory → concepts_memory.md
ls ~/clawd/data/docs-cache/ | grep "concepts_memory"
```

**若存在，直接本地读取（0 token！）：**  
```bash
cat ~/clawd/data/docs-cache/concepts_memory.md
```

### 步骤 4：获取页面（仅当未缓存时）

使用原生 **web_fetch** 工具（Clawdbot 核心组件 —— 免费且快速！）：

```javascript
web_fetch({ url: "https://docs.clawd.bot/{path}", extractMode: "markdown" })
```

**示例：**  
```javascript
web_fetch({ url: "https://docs.clawd.bot/tools/skills", extractMode: "markdown" })
```

**web_fetch 优势对比：**  
| | web_fetch | brightdata |
|---|-----------|------------|
| **成本** | $0（免费！） | ~$0.003/次 |
| **速度** | ~400ms | 2–5 秒 |
| **质量** | Markdown ✅ | Markdown ✅ |

---

## 搜索索引结构

**位置：** `~/clawd/data/docs-index.json`  

```json
{
  "pages": [
    {
      "path": "channels/telegram",
      "ttl_days": 7,
      "keywords": ["telegram", "tg", "bot", "allowfrom"]
    }
  ],
  "synonyms": {
    "telegram": ["tg", "telegrambot"],
    "configuration": ["config", "nastavenie", "settings"]
  }
}
```  

**支持同义词扩展**，实现模糊匹配。

---

## TTL 策略（时效性管理）

| 页面类别 | TTL | 原因 |
|----------|-----|------|
| `install/updating` | 1 天 | 始终最新！ |
| `gateway/*` | 7 天 | 配置变更频繁 |
| `channels/*` | 7 天 | 提供方更新 |
| `tools/*` | 7 天 | 新增功能 |
| `concepts/*` | 14 天 | 很少变动 |
| `reference/*` | 30 天 | 稳定模板 |

**检查片段过期时间：**  
```bash
head -10 ~/clawd/data/docs-snippets/telegram-setup.md | grep expires
```

---

## 常见场景

### “Ako nastaviť Telegram?”（如何设置 Telegram？）  
1. ✅ 读取 `~/clawd/data/docs-snippets/telegram-setup.md`  

### “allowFrom nefunguje”（allowFrom 不生效）  
1. ✅ 读取 `~/clawd/data/docs-snippets/telegram-allowfrom.md`  

### “Token expired / oauth error”（令牌过期 / OAuth 错误）  
1. ✅ 读取 `~/clawd/data/docs-snippets/oauth-troubleshoot.md`  

### “Ako updatnúť ClawdBot?”（如何更新 ClawdBot？）  
1. ✅ 读取 `~/clawd/data/docs-snippets/update-procedure.md`  

### “Ako pridať nový skill?”（如何添加新技能？）（无对应片段）  
1. 搜索索引 → tools/skills  
2. 获取：`web_fetch({ url: "https://docs.clawd.bot/tools/skills", extractMode: "markdown" })`  

### “Multi-agent routing”（多-agent 路由）  
1. 搜索索引 → concepts/multi-agent  
2. 获取：`web_fetch({ url: "https://docs.clawd.bot/concepts/multi-agent", extractMode: "markdown" })`  

---

## 回退方案：完整索引刷新

若仍无法找到所需内容：

```javascript
web_fetch({ url: "https://docs.clawd.bot/llms.txt", extractMode: "markdown" })
```  

返回**全部文档页面列表**。

---

## Token 效率指南

| 方法 | Token 数量 | 使用时机 |
|------|------------|----------|
| 黄金片段 | ~300–500 | ✅ 总是首选！ |
| 搜索索引 | 0 | 关键词查找 |
| 完整页面获取 | ~8–12k | 最后手段 |
| 批量获取 | ~20–30k | 多个相关主题 |

**80–90% 的查询**应可通过片段解答！

---

## 数据位置

```
~/clawd/data/
├── docs-index.json       # Search index
├── docs-stats.json       # Usage tracking
├── docs-snippets/        # Cached Golden Snippets
│   ├── telegram-setup.md
│   ├── telegram-allowfrom.md
│   ├── oauth-troubleshoot.md
│   ├── update-procedure.md
│   ├── restart-gateway.md
│   └── config-basics.md
└── docs-cache/           # Full page cache (future)
```

---

## 版本信息

| 项目 | 值 |
|------|----|
| **技能版本** | 2.1.0 |
| **创建时间** | 2026-01-14 |
| **更新时间** | 2026-01-26 |
| **作者** | Claude Code + Clawd（协作开发） |
| **来源** | https://docs.clawd.bot/ |
| **依赖项** | web_fetch（Clawdbot 核心工具） |
| **索引页面数** | ~50 个核心页面 |
| **黄金片段数** | 7 个预缓存片段 |

---

## 更新日志

### v2.2.0（2026-01-26）  
- **迁移至 web_fetch** —— 以原生 Clawdbot 工具替代 brightdata MCP  
- 优势：免费（$0）、更快（~400ms 对比 2–5 秒）  
- 无外部依赖（不再需要 mcporter）  
- 协作成果：Claude Code 🦞 实现，Clawd 🐾 审核  

### v2.1.3（2026-01-25）— ClawdHub  
- 文档修正：明确“检查”与“刷新”的区别  

### v2.0.0（2026-01-14）  
- 三层架构：搜索索引 → 片段 → 按需获取  
- 黄金片段预缓存，覆盖常见查询  
- 基于 TTL 的时效性追踪  
- 支持同义词模糊匹配  
- 常见查询 token 消耗减少 80–90%  

### v1.0.0（2026-01-08）  
- 初始发布，仅支持 brightdata 获取  

---

*本技能提供智能文档访问服务——始终优先使用缓存片段，仅在必要时才发起网络获取。*