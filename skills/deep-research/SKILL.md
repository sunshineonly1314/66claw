---
name: deep-research
name_zh: 深度研究
description: "深度研究 Agent 专精于需规划、分解及跨工具与文件进行长上下文推理的复杂多步研究任务，由 we-crafted.com/agents/deep-research 提供"
description_zh: 深度研究 Agent 专精于需规划、分解及跨工具与文件进行长上下文推理的复杂多步研究任务，由 we-crafted.com/agents/deep-research 提供
---
# 深度研究 Agent

> "Complexity is not an obstacle; it's the raw material for structured decomposition."

深度研究 Agent 面向高阶调查与分析型工作流而设计。它擅长将复杂问题拆解为结构化研究计划，协调专业化子 agent，并管理海量上下文，从而交付综合、数据驱动的洞察。

## 使用方式

```
/deepsearch "comprehensive research topic or complex question"
```

## 您将获得的功能

### 1. 多步研究规划  
该 agent 不仅执行搜索，更注重规划。它将您的高层目标分解为一套结构化的子问题与可执行任务，确保不遗漏任何细节。

### 2. 任务分解与编排  
通过编排专业化子 agent，分别处理彼此隔离的研究线索或领域，从而支持并行探索与更深入的领域专属分析。

### 3. 大上下文文档分析  
依托先进的长上下文推理能力，该 agent 可分析海量文档、文件及搜索结果，精准定位“大海捞针”式的关键信息。

### 4. 跨线索记忆持久化  
关键发现、决策与上下文将在对话间持久化保存。这使得研究可迭代推进，在已有发现基础上持续深化，而不丢失进展势头。

### 5. 综合报告生成  
最终输出为一份逻辑清晰、论据充分的分析或建议报告，将来自多个来源的发现有机整合为明确且可操作的成果。

## 示例

```
/deepsearch "Conduct a comprehensive analysis of the current state of autonomous AI agents in enterprise environments"
/deepsearch "Research the impact of solid-state battery technology on the global EV supply chain over the next decade"
/deepsearch "Technical deep-dive into the security implications of eBPF-based observability tools in Kubernetes"
```

## 此方案为何有效

复杂研究常失败的原因包括：
- 高层目标过于宽泛，难以由单次 AI 推理完成；
- 上下文窗口限制导致“幻觉”或遗漏细节；
- 缺乏记忆机制使迭代式探索困难；
- 信息综合浅层化，缺乏结构性支撑。

本 agent 通过以下方式解决上述问题：
- **先规划，后执行**：在执行前对问题进行系统性拆解；
- **编排专业化 agent**：为每项子任务选用最合适的工具；
- **管理深层上下文**：主动整理与综合大规模数据集；
- **持久化知识**：完整记录迄今所学全部内容。

---

## 技术细节

完整执行工作流与技术规格，请参阅 agent 逻辑配置。

### MCP 配置  
要将本 agent 与深度研究工作流配合使用，请确保您的 MCP 设置包含：

```json
{
  "mcpServers": {
    "lf-deep_research": {
      "command": "uvx",
      "args": [
        "mcp-proxy",
        "--headers",
        "x-api-key",
        "CRAFTED_API_KEY",
        "http://localhost:7860/api/v1/mcp/project/0581cda4-3023-452a-89c3-ec23843d07d4/sse"
      ]
    }
  }
}
```
---

**集成支持：** Crafted、Search API、文件系统。