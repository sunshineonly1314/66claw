---
name: model-router
name_zh: 模型路由
description: 一套综合性的 AI 模型路由系统，可自动为任意任务选择最优模型。支持配置多个 AI 提供商（Anthropic、OpenAI、Gemini、Moonshot、Z.ai、GLM），具备安全的 API 密钥存储能力，并能基于任务类型、复杂度和成本优化目标，将任务路由至最佳模型。包含交互式配置向导、任务分类器及成本效益导向的委派模式。当用户提出“为此任务使用 X 模型”、“切换模型”、“最优模型是哪个”或需在多个 AI 提供商间权衡质量与成本时，即可启用本 skill。
description_zh: 一套综合性的 AI 模型路由系统，可自动为任意任务选择最优模型。支持配置多个 AI 提供商（Anthropic、OpenAI、Gemini、Moonshot、Z.ai、GLM），具备安全的 API 密钥存储能力，并能基于任务类型、复杂度和成本优化目标，将任务路由至最佳模型。包含交互式配置向导、任务分类器及成本效益导向的委派模式。当用户提出“为此任务使用 X 模型”、“切换模型”、“最优模型是哪个”或需在多个 AI 提供商间权衡质量与成本时，即可启用本 skill。
version: 1.1.0
---
# Model Router（模型路由器）

**面向多个 AI 提供商的智能模型路由系统，实现成本与性能的最佳平衡。**

可根据任务复杂度、任务类型及用户偏好，自动为任意任务选择最合适的模型。支持 6 大主流 AI 提供商，配备安全的 API 密钥管理与交互式配置功能。

## 🎯 功能说明

- **分析任务** 并按类型（编程、调研、创意、简单等）进行分类  
- **将任务路由至** 您已配置提供商中的最优模型  
- **优化成本** —— 对简单任务使用更廉价的模型  
- **保障 API 密钥安全** —— 通过文件权限（600）与独立存储实现  
- **提供带置信度评分与推理依据的推荐结果**

## 🚀 快速入门

### 步骤 1：运行配置向导

```bash
cd skills/model-router
python3 scripts/setup-wizard.py
```

向导将引导您完成以下步骤：  
1. **提供商配置** —— 添加您的 API 密钥（Anthropic、OpenAI、Gemini 等）  
2. **任务映射配置** —— 为每类任务指定默认模型  
3. **偏好设置** —— 设定成本优化等级  

### 步骤 2：使用分类器

```bash
# Get model recommendation for a task
python3 scripts/classify_task.py "Build a React authentication system"

# Output:
# Recommended Model: claude-sonnet
# Confidence: 85%
# Cost Level: medium
# Reasoning: Matched 2 keywords: build, system
```

### 步骤 3：借助 Session 实现任务路由

```bash
# Spawn with recommended model
sessions_spawn --task "Debug this memory leak" --model claude-sonnet

# Use aliases for quick access
sessions_spawn --task "What's the weather?" --model haiku
```

## 📊 支持的提供商

| 提供商 | 模型 | 最适用场景 | 密钥格式 |
|--------|------|------------|----------|
| **Anthropic** | claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5 | 编程、推理、创意生成 | `sk-ant-...` |
| **OpenAI** | gpt-4o, gpt-4o-mini, o1-mini, o1-preview | 工具调用、深度推理 | `sk-proj-...` |
| **Gemini** | gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash | 多模态任务、超大上下文（200 万 token） | `AIza...` |
| **Moonshot** | moonshot-v1-8k/32k/128k | 中文语言任务 | `sk-...` |
| **Z.ai** | glm-4.5-air, glm-4.7 | 成本最低、响应最快 | 多种格式 |
| **GLM** | glm-4-flash, glm-4-plus, glm-4-0520 | 中文、编程 | `ID.secret` |

## 🎛️ 任务类型映射关系

默认路由策略（可通过向导自定义）：

| 任务类型 | 默认模型 | 原因 |
|----------|----------|------|
| `simple` | glm-4.5-air | 快速查询场景下最快、最廉价 |
| `coding` | claude-sonnet-4-5 | 出色的代码理解能力 |
| `research` | claude-sonnet-4-5 | 深度与速度兼顾的均衡之选 |
| `creative` | claude-opus-4-5 | 创意能力最强 |
| `math` | o1-mini | 专精于推理任务 |
| `vision` | gemini-1.5-flash | 快速多模态处理 |
| `chinese` | glm-4.7 | 针对中文任务优化 |
| `long_context` | gemini-1.5-pro | 最高支持 200 万 token |

## 💰 成本优化策略

### 激进模式（Aggressive Mode）  
始终选用满足能力要求的最廉价模型：  
- 简单任务 → glm-4.5-air（成本约降低 90%）  
- 编程任务 → claude-haiku-4.5（成本约降低 75%）  
- 调研任务 → claude-sonnet-4-5（成本约降低 50%）  

**节省幅度：** 相比始终使用高端模型，成本可降低 50–90%

### 平衡模式（Balanced Mode，缺省）  
兼顾成本与质量：  
- 简单任务 → 低价模型  
- 关键任务 → 高端模型  
- 若低价模型失败，则自动升级  

### 质量优先模式（Quality Mode）  
无论成本如何，始终选用最佳模型  

## 🔒 安全机制

### API 密钥存储  
```
~/.model-router/
├── config.json       # Model mappings (chmod 600)
└── .api-keys         # API keys (chmod 600)
```  

**特性：**  
- 文件权限严格限制为所有者可读写（600）  
- 与版本控制系统完全隔离  
- 静态加密（依赖操作系统级文件系统加密）  
- 密钥永不记录日志，也绝不打印输出  

### 最佳实践  
1. **切勿提交** `.api-keys` 至版本控制系统  
2. **生产环境部署时** 使用环境变量  
3. **定期轮换密钥** —— 可通过向导便捷完成  
4. **审计访问权限** —— 使用 `ls -la ~/.model-router/`  

## 📖 使用示例

### 示例 1：成本优化型工作流  
```bash
# Classify task first
python3 scripts/classify_task.py "Extract prices from this CSV"

# Result: simple task → use glm-4.5-air
sessions_spawn --task "Extract prices" --model glm-4.5-air

# Then analyze with better model if needed
sessions_spawn --task "Analyze price trends" --model claude-sonnet
```  

### 示例 2：渐进式升级  
```bash
# Try cheap model first (60s timeout)
sessions_spawn --task "Fix this bug" --model glm-4.5-air --runTimeoutSeconds 60

# If fails, escalate to premium
sessions_spawn --task "Fix complex architecture bug" --model claude-opus
```  

### 示例 3：并行处理  
```bash
# Batch simple tasks in parallel with cheap model
sessions_spawn --task "Summarize doc A" --model glm-4.5-air &
sessions_spawn --task "Summarize doc B" --model glm-4.5-air &
sessions_spawn --task "Summarize doc C" --model glm-4.5-air &
wait
```  

### 示例 4：结合 Gemini 的多模态任务  
```bash
# Vision task with 2M token context
sessions_spawn --task "Analyze these 100 images" --model gemini-1.5-pro
```  

## 🛠️ 配置文件  

### `~/.model-router/config.json`  
```json
{
  "version": "1.1.0",
  "providers": {
    "anthropic": {
      "configured": true,
      "models": ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"]
    },
    "openai": {
      "configured": true,
      "models": ["gpt-4o", "gpt-4o-mini", "o1-mini", "o1-preview"]
    }
  },
  "task_mappings": {
    "simple": "glm-4.5-air",
    "coding": "claude-sonnet-4-5",
    "research": "claude-sonnet-4-5",
    "creative": "claude-opus-4-5"
  },
  "preferences": {
    "cost_optimization": "balanced",
    "default_provider": "anthropic"
  }
}
```  

### `~/.model-router/.api-keys`  
```bash
# Generated by setup wizard - DO NOT edit manually
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIza...
```  

## 🔄 版本 1.1 更新说明  

### 新增功能  
- ✅ **交互式配置向导**，提供引导式配置体验  
- ✅ **安全的 API 密钥存储**，含文件权限控制  
- ✅ **任务到模型映射关系** 的自定义能力  
- ✅ **多提供商支持**（共 6 家）  
- ✅ **成本优化等级设置**（激进 / 平衡 / 质量优先）  

### 改进项  
- ✅ 增强任务分类能力，附带置信度评分  
- ✅ 按提供商定制化模型推荐  
- ✅ 提升安全性，采用隔离式存储  
- ✅ 提供全面详尽的文档  

### 从 1.0 版本迁移  
运行配置向导以重新配置：  
```bash
python3 scripts/setup-wizard.py
```  

## 📚 命令参考  

### 配置向导  
```bash
python3 scripts/setup-wizard.py
```  
用于交互式配置提供商、映射关系与偏好设置。  

### 任务分类器  
```bash
python3 scripts/classify_task.py "your task description"
python3 scripts/classify_task.py "your task" --format json
```  
获取模型推荐结果，并附带推理依据。  

### 列出可用模型  
```bash
python3 scripts/setup-wizard.py --list
```  
显示所有可用模型及其当前状态。  

## 🤝 与其他 Skills 的集成  

| Skill | 集成方式 |  
|-------|----------|  
| **model-usage** | 按提供商追踪成本，以优化路由决策 |  
| **sessions_spawn** | 模型委派的主要工具 |  
| **session_status** | 查看当前模型及使用情况 |  

## ⚡ 性能优化建议  

1. **由简入繁** —— 优先尝试低价模型  
2. **批量处理** —— 将多个简单任务合并执行  
3. **及时清理** —— 一次性任务结束后删除对应 session  
4. **设置超时** —— 防止子 agent 无限运行  
5. **监控用量** —— 按提供商追踪成本  

## 🐛 故障排查  

### “未找到合适模型”  
- 运行配置向导以配置提供商  
- 检查 API 密钥是否有效  
- 验证 `.api-keys` 文件的权限设置  

### “模块未找到”  
```bash
pip3 install -r requirements.txt  # if needed
```  

### “选中了错误模型”  
1. 通过向导自定义任务映射关系  
2. 在 `sessions_spawn --model` 中显式指定模型  
3. 调整成本优化偏好设置  

## 📖 补充资源  

- **提供商文档：**  
  - [Anthropic](https://docs.anthropic.com)  
  - [OpenAI](https://platform.openai.com/docs)  
  - [Gemini](https://ai.google.dev/docs)  
  - [Moonshot](https://platform.moonshot.cn/docs)  
  - [Z.ai](https://api.z.ai/docs)  
  - [GLM](https://open.bigmodel.cn/dev/api)  

- **配置启动：** 运行 `python3 scripts/setup-wizard.py`  
- **技术支持：** 查阅 `references/` 文件夹中的详细指南  