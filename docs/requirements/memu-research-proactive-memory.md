# memU 项目调研报告：主动式记忆系统

> 调研日期: 2026-02-04
> 项目地址: https://github.com/NevaMind-AI/memU
> 调研目的: 分析 memU 的主动式记忆机制，评估对 OpenClawCN 记忆功能的借鉴价值

---

## 一、memU 项目概述

### 1.1 基本信息

| 项目 | 信息 |
|------|------|
| 名称 | memU |
| 定位 | 24/7 Always-On Proactive Memory for AI Agents |
| Star | 7.3k |
| 语言 | Python + Rust |
| 协议 | Apache 2.0 |
| 官网 | https://memu.pro |

### 1.2 核心卖点

1. **24/7 主动式记忆** - 后台持续运行，主动捕获和理解用户意图
2. **降低 Token 成本** - 通过记忆缓存减少 LLM 调用
3. **记忆即文件系统** - 层级化、结构化的记忆组织方式

---

## 二、架构分析

### 2.1 三层记忆架构

```
memory/
├── preferences/           # Category Layer (自动分类)
│   ├── communication_style.md
│   └── topic_interests.md
├── relationships/
│   ├── contacts/
│   └── interaction_history/
├── knowledge/            # Item Layer (提取的记忆项)
│   ├── domain_expertise/
│   └── learned_skills/
└── context/              # Resource Layer (原始资源)
    ├── recent_conversations/
    └── pending_tasks/
```

| 层级 | 内容 | 被动用途 | 主动用途 |
|------|------|----------|----------|
| Resource | 原始数据 (对话/文档/图像) | 直接访问 | 后台监控新模式 |
| Item | 提取的记忆项 (事实/偏好/技能) | 精准检索 | 实时交互提取 |
| Category | 自动分类主题 | 概览浏览 | 自动上下文组装 |

### 2.2 主动记忆生命周期

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         USER QUERY                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                 │                                                           │
                 ▼                                                           ▼
┌────────────────────────────────────────┐         ┌────────────────────────────────────────────────┐
│         🤖 MAIN AGENT                  │         │              🧠 MEMU BOT                       │
│                                        │         │                                                │
│  Handle user queries & execute tasks   │  ◄───►  │  Monitor, memorize & proactive intelligence   │
├────────────────────────────────────────┤         ├────────────────────────────────────────────────┤
│  1. RECEIVE USER INPUT                 │   ───►  │  1. MONITOR INPUT/OUTPUT                      │
│  2. PLAN & EXECUTE                     │   ◄───  │  2. MEMORIZE & EXTRACT                        │
│  3. RESPOND TO USER                    │   ───►  │  3. PREDICT USER INTENT                       │
│  4. LOOP                               │   ◄───  │  4. RUN PROACTIVE TASKS                       │
└────────────────────────────────────────┘         └────────────────────────────────────────────────┘
```

### 2.3 核心 API

#### memorize() - 持续学习管道

```python
result = await service.memorize(
    resource_url="path/to/file.json",
    modality="conversation",  # conversation | document | image | video | audio
    user={"user_id": "123"}
)
# 返回: resource, items, categories
```

#### retrieve() - 双模式检索

- **RAG模式**: 快速向量检索，适合实时上下文组装
- **LLM模式**: 深度推理，适合复杂意图预测

```python
result = await service.retrieve(
    queries=[...],
    where={"user_id": "123"},
    method="rag"  # or "llm"
)
# 返回: categories, items, resources, next_step_query
```

---

## 三、与 OpenClawCN 对比

### 3.1 存储架构对比

| 维度 | memU | OpenClawCN |
|------|------|----------|
| 存储后端 | PostgreSQL + pgvector | SQLite + sqlite-vec |
| 文件格式 | 结构化数据库 | Markdown 文件 |
| 分类机制 | 自动分类 | 按日期文件 (约定式) |
| 交叉引用 | 自动建立 | 无 |
| 可移植性 | 需导出 | 直接复制文件 |
| 人类可读 | 需工具 | 直接编辑 |

### 3.2 检索能力对比

| 维度 | memU | OpenClawCN |
|------|------|----------|
| 向量搜索 | ✅ | ✅ |
| 关键词搜索 | ❓ | ✅ BM25 FTS5 |
| 混合搜索 | ❓ | ✅ (70% 向量 + 30% BM25) |
| 意图预测 | ✅ next_step_query | ❌ |
| 检索模式 | RAG + LLM | 单一混合模式 |

### 3.3 主动性对比

| 维度 | memU | OpenClawCN |
|------|------|----------|
| 24/7 后台监控 | ✅ | ❌ |
| 自动记忆提取 | ✅ | ❌ |
| 用户意图预测 | ✅ | ❌ |
| 主动任务执行 | ✅ | ❌ |
| 预压缩记忆保存 | ❌ | ✅ Memory Flush |
| 文件监视同步 | ❌ | ✅ chokidar watcher |

### 3.4 OpenClawCN 现有优势

1. **本地优先**: 无需外部数据库依赖
2. **透明可控**: Markdown 文件用户可直接编辑
3. **混合搜索**: BM25 + 向量对中文友好
4. **嵌入缓存**: 减少重复计算
5. **批量嵌入**: OpenAI/Gemini Batch API 降本增效
6. **国内模型支持**: 已有完善的 provider 配置

---

## 四、中国用户适用性评估

### 4.1 memU 的问题

1. **基础设施复杂**: PostgreSQL + pgvector 需额外部署
2. **模型支持有限**: 主要支持 OpenAI/Gemini/OpenRouter，缺少国内模型原生支持
3. **云服务依赖**: 主推 memu.so，可能存在网络访问问题
4. **自托管门槛**: Python 环境 + 数据库配置

### 4.2 结论

**memU 不建议直接引入**，但其**主动式记忆理念值得借鉴**。

---

## 五、可借鉴功能点

### 5.1 自动记忆提取 ⭐⭐⭐⭐⭐

**现状**: OpenClawCN 仅在预压缩时触发 Memory Flush，被动等待用户主动写入记忆。

**借鉴点**: 在会话结束或空闲时自动分析对话，提取重要事实。

**实现思路**:
```typescript
// 在 session 结束时触发
async function extractMemoriesFromSession(sessionTranscript: string) {
  const prompt = `分析以下对话，提取需要长期记住的信息:
    - 用户偏好
    - 重要决策
    - 待办事项
    - 关键事实
  返回 JSON 格式...`;
  
  const memories = await llm.complete(prompt, sessionTranscript);
  await appendToMemoryFile(memories);
}
```

### 5.2 三层记忆架构 ⭐⭐⭐⭐

**现状**: OpenClawCN 使用扁平的 `memory/YYYY-MM-DD.md` 结构。

**借鉴点**: 增加结构化层，便于分类检索。

**实现思路**:
```
memory/
├── daily/              # 保持现有日志
│   └── 2026-02-04.md
├── items/              # 新增: 结构化记忆项
│   ├── preferences.md
│   ├── people.md
│   └── decisions.md
├── categories.json     # 新增: 分类索引
└── MEMORY.md           # 保持: 长期记忆
```

### 5.3 自动分类系统 ⭐⭐⭐⭐

**现状**: 记忆无分类，检索依赖语义匹配。

**借鉴点**: 使用 LLM 对记忆进行自动分类标签。

**实现思路**:
```typescript
interface MemoryItem {
  content: string;
  categories: string[];  // 新增: 自动分类标签
  relatedTo: string[];   // 新增: 关联记忆ID
  createdAt: Date;
  source: 'auto' | 'user';
}
```

### 5.4 用户意图预测 ⭐⭐⭐

**现状**: `capability-manager.ts` 有基础意图检测 (关键词匹配)。

**借鉴点**: 基于历史行为的意图预测。

**实现思路**:
```typescript
// 扩展现有 detectRequiredCapabilities
async function predictUserIntent(params: {
  currentMessage: string;
  recentHistory: Message[];
  userProfile: UserProfile;
}): Promise<{
  likelyIntent: string;
  suggestedContext: MemoryItem[];
  confidence: number;
}> {
  // 基于历史模式预测用户下一步可能需要什么
}
```

### 5.5 记忆交叉引用 ⭐⭐⭐

**现状**: 记忆项独立存储，无关联关系。

**借鉴点**: 检测记忆间语义相关性，建立链接。

**实现思路**:
- 在索引时计算记忆间的语义相似度
- 相似度高于阈值的建立 `related_to` 关系
- `memory_search` 返回相关记忆

### 5.6 多模态记忆 ⭐⭐

**现状**: 仅支持文本记忆。

**借鉴点**: 支持图像、文档等多模态输入。

**实现思路**:
- 图像: 存储描述/OCR文本
- 文档: PDF/Office 文本提取后索引

---

## 六、实施优先级

| 优先级 | 功能 | 工作量 | 收益 | 依赖 |
|--------|------|--------|------|------|
| P0 | 自动记忆提取 | 中 | 高 | 无 |
| P1 | 记忆自动分类 | 中 | 高 | P0 |
| P2 | 用户偏好学习 | 高 | 高 | P0, P1 |
| P3 | 预测性上下文加载 | 高 | 中 | P2 |
| P4 | 多模态记忆 | 中 | 中 | 无 |
| P5 | 记忆交叉引用 | 中 | 中 | P0 |

---

## 七、参考资源

- memU GitHub: https://github.com/NevaMind-AI/memU
- memU 文档: https://memu.pro
- memU API 文档: (需注册云服务)
- Locomo Benchmark: memU 在该基准测试中达到 92.09% 准确率

---

## 八、附录：memU 使用场景示例

### 信息推荐场景
```python
# MemU 跟踪: 阅读历史, 保存文章, 搜索查询
# 当新内容到达时:
Agent: "我发现了3篇关于RAG优化的新论文，
        与你最近对检索系统的研究相关。
        其中一位作者(陈博士)你之前引用过。"
```

### 邮件管理场景
```python
# MemU 观察邮件模式:
# - 常见场景的回复模板
# - 优先联系人和紧急关键词
# - 日程偏好和可用性

Agent: "你有12封新邮件。我已为3封常规请求起草了回复，
        标记了2封来自优先联系人的紧急邮件。
        需要我根据John提到的冲突重新安排明天的会议吗？"
```

### 交易监控场景
```python
# MemU 学习交易偏好:
# - 风险承受能力
# - 偏好行业和资产类别
# - 对市场事件的反应模式

Agent: "NVDA 盘后下跌5%。根据你过去的行为，
        你通常在科技股跌幅超过3%时买入。
        你当前的配置允许额外投入$2,000..."
```
