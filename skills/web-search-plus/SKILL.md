---
name: web-search-plus  
version: 2.1.5  
description: 具备智能自动路由功能的统一搜索技能。通过多信号分析，自动在 Serper（Google）、Tavily（研究型搜索）与 Exa（神经语义搜索）之间择优选择，并附带置信度评分。  
tags: [search, web-search, serper, tavily, exa, google, research, semantic-search, auto-routing, multi-provider, shopping, free-tier]  
---

# Web Search Plus

支持多服务商的网络搜索，具备 **智能自动路由** 功能：Serper（Google）、Tavily（研究型搜索）、Exa（神经语义搜索）。

**v2.1.0 版本新增**：支持智能多信号分析及置信度评分！

---

## ⚠️ 重要提示：请勿修改 Clawdbot 核心配置

**Tavily、Serper 和 Exa 并非 Clawdbot 的核心内置服务商。**

❌ **切勿** 将此配置添加至 `~/.clawdbot/clawdbot.json`：  
```json
"tools": {
  "web": {
    "search": {
      "provider": "tavily"  // WRONG - will cause errors!
    }
  }
}
```

✅ **请** 通过环境变量方式使用本技能提供的脚本：  
```bash
export TAVILY_API_KEY="your-key"
python3 scripts/search.py -q "your query"
```

Clawdbot 核心仅原生支持 `brave` 或 `perplexity` 作为内置服务商。本技能通过其独立脚本，将 Serper、Tavily 和 Exa 作为**额外可选服务商**引入。

---

## 🧠 智能自动路由

无需手动指定服务商——直接搜索即可！该技能采用 **多信号分析** 技术，精准识别您的查询意图：

```bash
# These queries are intelligently routed with confidence scoring:
python3 scripts/search.py -q "how much does iPhone 16 cost"     # → Serper (68% MEDIUM)
python3 scripts/search.py -q "how does quantum entanglement work"  # → Tavily (86% HIGH)
python3 scripts/search.py -q "startups similar to Notion"       # → Exa (76% HIGH)
python3 scripts/search.py -q "MacBook Pro M3 specs review"      # → Serper (70% HIGH)
python3 scripts/search.py -q "explain pros and cons of React"   # → Tavily (85% HIGH)
python3 scripts/search.py -q "companies like stripe.com"        # → Exa (100% HIGH)
```

### 工作原理

路由引擎会综合分析多种信号：

#### 🛒 购物意图 → Serper
| 信号类型 | 示例 | 权重 |
|----------|------|------|
| 价格相关模式 | “多少钱”、“XX 的价格”、“XX 的成本” | 高 |
| 购买意图 | “购买”、“买”、“下单”、“哪里可以买到” | 高 |
| 优惠信号 | “优惠”、“折扣”、“便宜”、“最优惠价格” | 中 |
| 产品 + 品牌组合 | “iPhone 16”、“索尼耳机” + 参数/评测 | 高 |
| 本地商家 | “附近”、“餐厅”、“酒店” | 高 |

#### 📚 研究意图 → Tavily
| 信号类型 | 示例 | 权重 |
|----------|------|------|
| 解释类提问 | “如何运作”、“为何如此”、“解释一下”、“什么是” | 高 |
| 对比分析 | “对比”、“优缺点”、“两者区别” | 高 |
| 学习导向 | “教程”、“指南”、“理解”、“学习” | 中 |
| 深度要求 | “深入探讨”、“全面”、“详细” | 中 |
| 复杂查询 | 长句、多分句疑问 | 额外加权 |

#### 🔍 发现阶段意图 → Exa
| 信号类型 | 示例 | 权重 |
|----------|------|------|
| 相似性需求 | “类似……的”、“……的替代方案”、“竞争对手” | 极高 |
| 公司发现 | “类似……的公司”、“从事……的初创公司”、“还有谁” | 高 |
| URL 检测 | 任意 URL 或域名（如 stripe.com） | 极高 |
| 学术场景 | “arxiv”、“研究论文”、“GitHub 项目” | 高 |
| 融资信息 | “A 轮融资”、“YC 孵化”、“已获融资的初创公司” | 高 |

### 置信度评分

每次路由决策均附带置信度等级：

| 置信度 | 等级 | 含义 |
|--------|------|------|
| 70–100% | **高** | 信号匹配强烈，结果高度可靠 |
| 40–69% | **中** | 匹配良好，预期效果较佳 |
| 0–39% | **低** | 查询意图模糊，启用备用方案 |

### 调试路由决策

查看完整分析过程：

```bash
python3 scripts/search.py --explain-routing -q "how much does iPhone 16 Pro cost"
```

输出示例：
```json
{
  "query": "how much does iPhone 16 Pro cost",
  "routing_decision": {
    "provider": "serper",
    "confidence": 0.68,
    "confidence_level": "medium",
    "reason": "moderate_confidence_match"
  },
  "scores": {"serper": 7.0, "tavily": 0.0, "exa": 0.0},
  "top_signals": [
    {"matched": "how much", "weight": 4.0},
    {"matched": "brand + product detected", "weight": 3.0}
  ],
  "query_analysis": {
    "word_count": 7,
    "is_complex": false,
    "has_url": null,
    "recency_focused": false
  }
}
```

---

## 🔍 何时使用本技能 vs 内置 Brave 搜索

### 推荐使用 **内置 Brave 搜索** 的场景：
- ✅ 通用网页搜索（新闻、信息、问答等）  
- ✅ 注重隐私保护  
- ✅ 无需特定要求的快速查询  

### 推荐使用 **web-search-plus** 的场景：

#### → **Serper**（返回 Google 结果）：
- 🛍️ **产品参数、价格、购物类查询** —— 如：“对比 iPhone 16 与三星 S24”  
- 📍 **本地商家与地点** —— 如：“维也纳最佳披萨店”  
- 🎯 **明确要求 Google 搜索** —— 如用户明确说“Google 一下”  
- 📰 **购物/图片/新闻类搜索** —— 使用 `--type shopping/images/news`  
- 🏆 **知识图谱信息** —— 结构化数据（价格、评分等）  

#### → **Tavily**（AI 优化的研究型搜索）：
- 📚 **研究型问题** —— 如：“量子计算如何运作？”  
- 🔬 **深度探究** —— 复杂、多部分构成的问题  
- 📄 **全文内容提取** —— 不止于摘要（需使用 `--raw-content`）  
- 🎓 **学术研究** —— 提供综合归纳的答案  
- 🔒 **限定可信信源域** —— 使用 `--include-domains` 指定可信域名  

#### → **Exa**（神经语义搜索）：
- 🔗 **相似网页查找** —— 如：“类似 OpenAI.com 的网站”（使用 `--similar-url`）  
- 🏢 **公司发现** —— 如：“类似 Anthropic 的 AI 公司”  
- 📝 **研究论文检索** —— 使用 `--category "research paper"`  
- 💻 **GitHub 项目检索** —— 使用 `--category github`  
- 📅 **时间范围限定** —— 使用 `--start-date` / `--end-date`  

---

## 服务商能力对比

| 功能 | Serper | Tavily | Exa |
|------|:------:|:------:|:---:|
| 速度 | ⚡⚡⚡ | ⚡⚡ | ⚡⚡ |
| 事实准确性 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 语义理解能力 | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| 研究质量 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 全文内容支持 | ✗ | ✓ | ✓ |
| 购物/本地搜索 | ✓ | ✗ | ✗ |
| 相似网页查找 | ✗ | ✗ | ✓ |
| 知识图谱支持 | ✓ | ✗ | ✗ |

---

## 使用示例

### 自动路由（推荐方式）

```bash
python3 scripts/search.py -q "iPhone 16 Pro Max price"          # → Serper
python3 scripts/search.py -q "how does HTTPS encryption work"   # → Tavily
python3 scripts/search.py -q "startups similar to Notion"       # → Exa
```

### 显式指定服务商

```bash
python3 scripts/search.py -p serper -q "weather Vienna" --type weather
python3 scripts/search.py -p tavily -q "quantum computing" --depth advanced
python3 scripts/search.py -p exa --similar-url "https://stripe.com" --category company
```

---

## 配置说明

### config.json

```json
{
  "auto_routing": {
    "enabled": true,
    "fallback_provider": "serper",
    "confidence_threshold": 0.3,
    "disabled_providers": []
  },
  "serper": {"country": "us", "language": "en"},
  "tavily": {"depth": "advanced"},
  "exa": {"type": "neural"}
}
```

---

## 输出格式

```json
{
  "provider": "serper",
  "query": "iPhone 16 price",
  "results": [{"title": "...", "url": "...", "snippet": "...", "score": 0.95}],
  "answer": "Synthesized answer...",
  "routing": {
    "auto_routed": true,
    "provider": "serper",
    "confidence": 0.78,
    "confidence_level": "high",
    "reason": "high_confidence_match",
    "top_signals": [{"matched": "price", "weight": 3.0}]
  }
}
```

---

## 环境搭建

```bash
# In your .env file (use 'export' prefix!):
export SERPER_API_KEY="your-key"   # https://serper.dev
export TAVILY_API_KEY="your-key"   # https://tavily.com  
export EXA_API_KEY="your-key"      # https://exa.ai

# Then load with: source .env
```

---

## 常见问题（FAQ）

### 通用问题

**Q：自动路由机制如何决定选用哪个服务商？**  
> Multi-signal analysis scores each provider based on: price patterns, explanation phrases, similarity keywords, URLs, product+brand combos, and query complexity. Highest score wins. Use `--explain-routing` to see the decision breakdown.

**Q：若选错了服务商怎么办？**  
> Override with `-p serper/tavily/exa`. Check `--explain-routing` to understand why it chose differently.

**Q：“低置信度”代表什么含义？**  
> Query is ambiguous (e.g., "Tesla" could be cars, stock, or company). Falls back to Serper. Results may vary.

**Q：能否禁用某个服务商？**  
> Yes! In config.json: `"disabled_providers": ["exa"]`

### API 密钥相关

**Q：我需要哪些 API 密钥？**  
> At minimum ONE key. You can use just Serper, just Tavily, or all three. Missing keys = that provider is skipped.

**Q：从何处获取这些 API 密钥？**  
> - Serper: https://serper.dev (100 free searches/month)  
> - Tavily: https://tavily.com (1000 free searches/month)  
> - Exa: https://exa.ai (limited free tier)

**Q：如何设置 API 密钥？**  
> Create `.env` in your workspace:
> ```bash
> export SERPER_API_KEY="your-key"
> export TAVILY_API_KEY="your-key"
> export EXA_API_KEY="your-key"
> ```
> Then `source .env` or add to your shell profile.
  

### 路由细节

**Q：如何确认本次搜索由哪个服务商执行？**  
> Check `routing.provider` in JSON output, or `[🔍 Searched with: Provider]` in chat responses.

**Q：为何有时对研究类问题也选择了 Serper？**  
> If the query has brand/product signals (e.g., "how does Tesla FSD work"), shopping intent may outweigh research intent. Override with `-p tavily`.

**Q：置信度阈值是多少？**  
> Default: 0.3 (30%). Below this = low confidence, uses fallback. Adjustable in config.json.

### 故障排查

**Q：“未找到 API 密钥”错误？**  
> Make sure keys are exported (not just set): `export SERPER_API_KEY="..."` and sourced.

**Q：返回空结果？**  
> 1. Check API key is valid  
> 2. Try a different provider with `-p`  
> 3. Some queries have no results (very niche topics)

**Q：遭遇速率限制（Rate limited）？**  
> Each provider has limits. Spread queries across providers or wait. Serper: 100/month free, Tavily: 1000/month free.

### Clawdbot 用户专属

**Q：如何在聊天中使用本技能？**  
> Just ask! Clawdbot auto-detects search intent. Or explicitly: "search with web-search-plus for..."

**Q：本技能是否会取代内置的 Brave 搜索？**  
> No, it's complementary. Use Brave for quick lookups, web-search-plus for research/shopping/discovery.

**Q：能否查看实际调用的服务商？**  
> Yes! SOUL.md can include attribution: `[🔍 Searched with: Serper/Tavily/Exa]`