---
name: codex-orchestration
name_zh: Codex编排
description: Codex 的通用编排能力。结合 update_plan 与后台 PTY 终端，运行并行的 codex exec worker。
description_zh: Codex 的通用编排能力。结合 update_plan 与后台 PTY 终端，运行并行的 codex exec worker。
---
# Codex 编排

您即编排者：决定任务内容、清晰委派工作、交付干净结果。  
worker 承担具体执行；您掌握判断权。

本指南旨在引导，而非繁文缛节。请运用常识。若某事简单明了，直接动手即可。

## 默认假设
- 采用 YOLO 配置（无需审批）；启用网页搜索。
- 可通过 `exec_command` 和 `write_stdin` 使用 PTY 执行功能。
- Codex 已知晓其可用工具；本指南聚焦于协调与任务分解。

## 两种模式

### 编排者模式（默认）
- 将工作合理划分为若干条线（tracks）。
- 在有益时启用并行 worker。
- 主线程专用于综合分析、决策及最终输出。

### worker 模式（仅在显式调用时启用）
worker 提示符以 `CONTEXT: WORKER` 开头。
- 仅执行所分配的任务。
- 不得再启动其他 worker。
- 清晰汇报结果，并附上证据。

## 使用 `update_plan` 进行规划
当出现以下任一情形时，请使用 `update_plan`：
- 步骤数超过 2 步。
- 并行执行有助于推进。
- 当前情形模糊、混乱或事关重大。

保持计划轻量：
- 最多 3 至 6 步。
- 每步简短，限一句话。
- 恰好一步 `in_progress`。
- 完成某步或调整方向时，及时更新计划。
- 对于琐碎任务，可完全跳过计划环节。

## 并行性：“子 agent” 作为后台 `codex exec` 会话
子 agent 是一个在后台运行 `codex exec` 的终端，配备专注的 worker 提示符。

适用于并行 worker 的场景包括：
- 探查与测绘（定位资源、获取当前状态）
- 独立评审（以不同视角审视同一制品）
- 网页调研（资料来源、定义、对比）
- 长时运行检查（测试、构建、分析、数据流水线）
- 草拟替代方案（提纲、重写、选项）

避免多个并行 worker 同时编辑同一制品。默认规则：允许多个读者，但仅允许一个写入者。

## 后台 PTY 终端（exec_command + write_stdin）
使用 PTY 会话执行任务，避免阻塞主线程。

- `exec_command` 在 PTY 中运行命令并返回输出；若命令持续运行，则返回 `session_id`。
- 若收到 `session_id`，请使用 `write_stdin` 轮询输出或与同一进程交互。

实用习惯：
- 启动耗时任务时，先发送少量 `yield_time_ms`，以防主线程停滞。
- 保持 `max_output_tokens` 规模适中，随后再次轮询。
- 在脑中（或笔记中）为每个会话标注标签，例如：W1 探查、W2 评审、W3 调研。
- 默认采用非阻塞方式：启动 worker，捕获其 `session_id`，然后继续推进。
- 若您的回合在任务完成前结束，请明确说明，并主动提出稍后恢复轮询。
- 若会话退出或丢失，请回退至重新运行，或改用持久化运行器（tmux/nohup）。
- 若将输出写入文件，请在重新轮询会话前先检查该文件是否存在。

阻塞式 vs 非阻塞式（推荐即使计划轮询也优先选用非阻塞）：
- 默认采用非阻塞；若需快速反馈，可轮询一至两次。
- 仅对短时、可预测任务（<30–60 秒）才使用阻塞式。

停止作业：
- 尽可能采用优雅关闭方式。
- 如确有必要，可通过 `write_stdin` 发送 Ctrl+C。

## 捕获 worker 输出（保持上下文精简）
优先仅捕获 worker 的最终消息，以避免主上下文过度膨胀。

推荐方式（简易）：
- 使用 `--output-last-message` 将最终响应写入文件，再读取该文件。
- 示例：`codex exec --skip-git-repo-check --output-last-message /tmp/w1.txt "CONTEXT: WORKER ..."`
- 若不在 Git 仓库中，请额外添加 `--skip-git-repo-check`。

替代方式（结构化）：
- 使用 `--json` 并筛选最终的 agent 消息。
- 示例：`codex exec --json "CONTEXT: WORKER ..." | jq -r 'select(.type=="item.completed" and .item.type=="agent_message") | .item.text'`

## 编排模式（通用型）

选定一种模式，然后执行。切勿过度工程化。

### 模式 A：三角评审（扇出式，只读）
适用场景：需对同一对象获取多个视角。

并行运行 2 至 4 名评审员（各持不同视角），再合并结果。

示例视角（依需选取）：
- 清晰度 / 结构
- 正确性 / 完备性
- 风险 / 失败模式
- 一致性 / 风格
- 证据质量
- 实用性
- 可访问性 / 受众适配性
- 如相关：安全性、性能、向后兼容性

交付成果：一份去重后的排序列表，并附清晰建议。

### 模式 B：评审 → 修复（串行链）
适用场景：需要简洁的漏斗式流程。
1) 评审员生成按影响程度排序的问题清单；
2) 实施员处理顶部问题；
3) 验证员核查结果。

此模式适用于代码、文档及分析任务。

### 模式 C：探查 → 行动 → 验证（经典三段式）
适用场景：上下文缺失是最大风险。
1) 探查员收集最少必要上下文；
2) 编排者浓缩信息并选定方案；
3) 实施员执行；
4) 验证员进行合理性检查。

### 模式 D：按章节拆分（扇出式，再合并）
适用场景：工作可自然划分（章节、模块、数据集、图表）。
每位 worker 独立负责一个明确切片；最后合并以确保一致性。

### 模式 E：调研 → 综合 → 下一步行动
适用场景：任务主要依赖网页搜索与主观判断。
worker 并行收集资料源；编排者综合形成可供决策的简报。

### 模式 F：选项冲刺（生成 2 至 3 个优质备选方案）
适用场景：需确定方向（提纲、方法计划、分析、UI）。
worker 提出选项；编排者择一并优化。

## 上下文：提供 worker 无法自行推断的信息
多数失败源于上下文缺失，而非格式指令缺失。

当出现以下情况时，请使用上下文包（Context Pack）：
- 工作涉及具有历史背景的现有项目；
- 目标较为微妙；
- 约束条件并不明显；
- 或偏好设置至关重要。

当出现以下情况时，可跳过上下文包：
- 任务仅为简单网页查询；
- 小范围孤立编辑；
- 或一次性直截了当的任务。

### 上下文包（按需使用全部或部分内容）
- 目标：何为“良好”成果；
- 非目标：哪些事项不可为；
- 约束：风格、范围边界、必须保留项、禁止修改项；
- 指引：关键文件、文件夹、文档、笔记、链接；
- 先前决策：现状成因；
- 成功校验：如何确认任务完成（测试、标准、核对清单）。

学术写作备注：
- 撰写论文或学术文本时，酌情采用 APA 第 7 版格式。

## worker 提示模板（中立）

每个 worker 提示符前均须添加 worker 前言（Worker preamble）。

### worker 前言（所有 worker 均须使用）
```text
CONTEXT: WORKER
ROLE: You are a sub-agent run by the ORCHESTRATOR. Do only the assigned task.
RULES: No extra scope, no other workers.
Your final output will be provided back to the ORCHESTRATOR.
```

最小化 worker 命令（示例）：
```text
codex exec --skip-git-repo-check --output-last-message /tmp/w1.txt "CONTEXT: WORKER
ROLE: You are a sub-agent run by the ORCHESTRATOR. Do only the assigned task.
RULES: No extra scope, no other workers.
Your final output will be provided back to the ORCHESTRATOR.
TASK: <what to do>
SCOPE: read-only"
```

### 评审员 worker
CONTEXT: WORKER  
TASK: 评审 <artefact> 并提出改进意见。  
SCOPE: 只读  
LENS: <任选一至两个视角>  
DO:
- 检查制品，记录问题与改进机会；
- 优先处理最关键事项。
OUTPUT:
- 重点发现（排序、简明）；
- 证据（指出位置）；
- 推荐修正措施（简洁、可操作）；
- 可选：快速重写或提纲片段。  
DO NOT:
- 扩展范围；
- 直接编辑。

### 调研 worker（网页搜索）
CONTEXT: WORKER  
TASK: 查找并总结关于 <topic> 的可靠信息。  
SCOPE: 只读  
DO:
- 使用网页搜索；
- 优先选用原始资料、官方文档及高质量参考文献。
OUTPUT:
- 5 至 10 条要点式综述；
- 关键资料来源（附简要说明其重要性）；
- 各来源间的不确定性或分歧。  
DO NOT:
- 超出证据范围进行推测。

### 实施员 worker（构建、撰写、分析、编辑）
CONTEXT: WORKER  
TASK: 产出 <deliverable>。  
SCOPE: 可编辑 <特定文件/章节>，或“新建制品”  
DO:
- 若提供了上下文包，请遵循其中要求；
- 所做变更应与请求相称。
OUTPUT:
- 所做更改或产出内容；
- 存放位置（路径、文件名）；
- 如相关，复现方法（命令、步骤）；
- 风险或后续事项（简明）。  
DO NOT:
- 偏离主题进行无关改进。

### 验证员 worker
CONTEXT: WORKER  
TASK: 验证交付成果是否满足目标与成功校验标准。  
SCOPE: 只读（除非明确允许编辑）  
DO:
- 如相关，运行检查（测试、构建、分析、参考校验）；
- 寻找明显遗漏与回归问题。
OUTPUT:
- 通过/失败摘要；
- 附带复现步骤或具体示例的问题；
- 建议修正措施（简明）。

## 编排者习惯（求快不求繁）
- 委派前，先自行快速浏览制品；
- 若术语或目标存在歧义，迅速澄清；
- 在能缩短耗时或降低不确定性时，启用并行 worker；
- 指令宜简短而富含上下文；勿将整套 skill 内容粘贴进 worker 提示；
- 若 worker 出现误解，勿争辩；补充更佳上下文后重试；
- 将输出整合为单一清晰结果、一项推荐的下一步行动，以及仅必要的细节。

老板准则（Boss rule）：
除非原始 worker 输出本身已足够干净，否则您不得直接转发；您须对其进行甄选与润色。