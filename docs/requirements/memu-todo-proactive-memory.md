# TODO: 主动式记忆系统改进计划

> 基于 memU 调研的后续研究和实施计划
> 创建日期: 2026-02-04

---

## 研究任务

### 阶段一：深入调研

- [ ] **R1**: 本地运行 memU 进行实际测试
  - 克隆仓库: `git clone https://github.com/NevaMind-AI/memU.git`
  - 运行测试: `python tests/test_inmemory.py`
  - 评估实际效果

- [ ] **R2**: 分析 memU 核心代码实现
  - 重点文件: `src/memu/` 目录
  - 关注: memorize() 和 retrieve() 实现细节
  - 关注: 自动分类算法

- [ ] **R3**: 调研其他记忆系统
  - Mem0: https://github.com/mem0ai/mem0
  - LangChain Memory: https://python.langchain.com/docs/modules/memory/
  - LlamaIndex Memory: 相关模块

- [ ] **R4**: 研究用户意图预测技术
  - 基于历史的模式识别
  - 对话状态跟踪 (DST)
  - 用户画像建模

---

## 实施任务

### P0: 自动记忆提取 (高优先级)

- [ ] **T0.1**: 设计自动记忆提取 Prompt
  - 定义提取的记忆类型: 偏好、决策、待办、事实
  - 设计输出格式: JSON Schema
  - 测试不同模型的提取效果

- [ ] **T0.2**: 实现会话结束记忆提取
  - 位置: `src/auto-reply/reply/memory-flush.ts` 扩展
  - 触发时机: 会话压缩前、会话超时后
  - 输出: 追加到 `memory/YYYY-MM-DD.md`

- [ ] **T0.3**: 添加配置开关
  ```json5
  agents: {
    defaults: {
      memoryExtract: {
        enabled: true,
        onSessionEnd: true,
        onIdleTimeout: 300, // 秒
        categories: ["preference", "decision", "todo", "fact"]
      }
    }
  }
  ```

- [ ] **T0.4**: 编写测试用例
  - 单元测试: 提取逻辑
  - E2E测试: 完整流程

### P1: 记忆自动分类

- [ ] **T1.1**: 设计分类体系
  - 预定义类别: preferences, people, decisions, todos, facts, skills
  - 支持自定义类别

- [ ] **T1.2**: 扩展记忆索引 Schema
  ```sql
  ALTER TABLE chunks ADD COLUMN categories TEXT; -- JSON array
  ALTER TABLE chunks ADD COLUMN tags TEXT;       -- JSON array
  ```

- [ ] **T1.3**: 实现分类逻辑
  - 在 `indexFile()` 时调用 LLM 分类
  - 缓存分类结果避免重复调用

- [ ] **T1.4**: 扩展 memory_search 返回分类信息

### P2: 用户偏好学习

- [ ] **T2.1**: 设计用户画像数据结构
  ```typescript
  interface UserProfile {
    preferences: Record<string, any>;
    patterns: BehaviorPattern[];
    lastUpdated: Date;
  }
  ```

- [ ] **T2.2**: 实现偏好提取和更新逻辑
  - 从记忆中聚合偏好
  - 定期更新用户画像

- [ ] **T2.3**: 将用户画像注入系统提示

### P3: 预测性上下文加载

- [ ] **T3.1**: 实现意图预测模块
  - 基于: 当前消息 + 历史记录 + 用户画像
  - 输出: 可能相关的记忆

- [ ] **T3.2**: 在会话开始时预加载上下文
  - 预测用户可能询问的内容
  - 提前检索相关记忆

### P4: 多模态记忆扩展

- [ ] **T4.1**: 图像记忆支持
  - 调用视觉模型生成图像描述
  - 存储描述到记忆

- [ ] **T4.2**: 文档记忆支持
  - PDF 文本提取
  - Office 文档解析

### P5: 记忆交叉引用

- [ ] **T5.1**: 实现相似记忆检测
  - 索引时计算语义相似度
  - 建立 related_to 关系

- [ ] **T5.2**: 扩展 memory_search 返回相关记忆

---

## 技术调研清单

### 需要验证的技术点

- [ ] **Tech1**: LLM 记忆提取的准确性
  - 不同模型 (GPT-4, Claude, Qwen) 的提取效果对比
  - Prompt 工程优化

- [ ] **Tech2**: 自动分类的成本效益
  - 每条记忆调用 LLM 分类的成本
  - 批量分类 vs 实时分类

- [ ] **Tech3**: 增量索引性能
  - 大量记忆时的索引性能
  - 向量搜索的延迟

- [ ] **Tech4**: 中文记忆处理
  - 中文分词对 BM25 的影响
  - 中文嵌入模型选择

---

## 相关代码位置

| 功能 | 当前代码位置 | 备注 |
|------|-------------|------|
| 记忆索引管理 | `src/memory/manager.ts` | 核心，2000+ 行 |
| 混合搜索 | `src/memory/hybrid.ts` | BM25 + 向量合并 |
| 记忆工具 | `src/agents/tools/memory-tool.ts` | memory_search, memory_get |
| Memory Flush | `src/auto-reply/reply/memory-flush.ts` | 预压缩记忆保存 |
| 记忆配置 | `src/agents/memory-search.ts` | 配置解析 |
| 能力检测 | `src/capabilities/capability-manager.ts` | 意图->能力映射 |
| 会话存储 | `src/config/sessions/store.ts` | 会话元数据 |

---

## 里程碑

| 里程碑 | 目标 | 预计完成 |
|--------|------|----------|
| M1 | 完成深入调研 (R1-R4) | - |
| M2 | 实现自动记忆提取 (P0) | - |
| M3 | 实现自动分类 (P1) | - |
| M4 | 实现用户偏好学习 (P2) | - |
| M5 | 完成所有功能 (P0-P5) | - |

---

## 决策记录

### 2026-02-04: memU 调研结论

**决策**: 不直接引入 memU，借鉴其主动式记忆理念改进 OpenClawCN。

**原因**:
1. memU 依赖 PostgreSQL，与 OpenClawCN 本地优先策略不符
2. memU 缺少国内模型原生支持
3. OpenClawCN 现有 Markdown 存储方案用户友好度更高

**下一步**: 实施 P0 自动记忆提取功能

---

## 参考链接

- [memU GitHub](https://github.com/NevaMind-AI/memU)
- [调研报告](./memu-research-proactive-memory.md)
- [OpenClawCN 记忆文档](../concepts/memory.md)
