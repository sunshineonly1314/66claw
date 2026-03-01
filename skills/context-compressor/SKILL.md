---
name: context-compressor
description: 面向长时间运行的 Clawdbot 会话的自动化上下文管理。检测上下文用量临近上限时，自动压缩历史对话，并无缝切换至新会话。
description_zh: 面向长时间运行的 Clawdbot 会话的自动化上下文管理。检测上下文用量临近上限时，自动压缩历史对话，并无缝切换至新会话。
---
# Context Compressor Skill

面向长时间运行的 Clawdbot 会话的自动化上下文管理。检测上下文用量临近上限时，自动压缩历史对话，并无缝切换至新会话。

## 适用场景

- 上下文持续累积的长时间编码会话  
- 迭代与优化次数较多的项目  
- 观察到 Claude 出现重复回应或遗漏细节的情况  
- 主动在触及硬性上下文限制前进行干预  
- 在“心跳”周期或用户未主动等待的空闲时段

## 工作原理

1. **监控**：通过会话元数据持续追踪上下文使用量  
2. **压缩**：当用量达阈值（可配置，默认为 80%）时，对早期消息进行摘要  
3. **保留**：提取关键决策、代码变更、文件状态及待办事项  
4. **交接**：以压缩后的上下文为基础，启动新会话  
5. **连续性**：用户感知为无缝过渡，所有重要上下文均被保留  

## 核心特性

- **智能摘要**：保留决策、代码、文件状态等语义信息，而非仅原始文本  
- **可配置阈值**：自定义触发压缩的上下文占用比例（70–90%）  
- **后台运行**：于心跳周期或低活跃度时段执行  
- **选择性保留**：保留关键文件、决策、TODO 项；压缩冗余内容（chaff）  
- **会话状态迁移**：新会话自动继承全部关键上下文  

## 核心概念

### 上下文退化模式

随着会话延长，请关注以下迹象：  
- 回应重复（如“如我之前所提……”）  
- 忽略早先做出的决策  
- 遗忘文件修改记录  
- 要求用户重复已提供信息  
- 整体连贯性下降  

### 压缩策略

1. **提取核心智能**：  
   - 所有已做决策及其依据（rationale）  
   - 文件路径及其当前状态  
   - 待办任务及其进展状态  
   - 值得保留的重要代码片段或配置  
   - 用户偏好与行为模式  

2. **压缩历史记录**：  
   - 移除填充内容、回溯讨论、无效尝试  
   - 仅保留高信息密度的对话轮次（turns）  
   - 将相关迭代合并为摘要  
   - 内联保留关键代码片段  

3. **高效格式化**：  
   - 使用紧凑表达形式  
   - 引用文件路径而非转储全部内容  
   - 以项目符号罗列各项决策  
   - 仅包含相关代码上下文  

## 使用方式

### 自动模式（推荐）

该 skill 在心跳周期及空闲时段自动运行。配置阈值如下：

```bash
# Set compression to trigger at 75% context usage
context-compressor set-threshold 75

# Check current status
context-compressor status
```

### 手动触发

```bash
# Force compression and session reset
context-compressor compress --force
```

### 配置

```bash
# View all settings
context-compressor config

# Adjust summarization depth
context-compressor set-depth brief|detailed|comprehensive

# Set quiet hours (compression won't run)
context-compressor set-quiet-hours 23:00-07:00
```

## 输出内容

发生压缩时，该 skill 生成以下输出：

1. **摘要文件**：`memory/compressed-{session-id}.md`  
   - 会话概览（Executive summary）  
   - 关键决策汇总  
   - 已修改文件及其状态  
   - 待办任务列表  
   - 值得保留的代码片段  

2. **会话交接**：自动启动新会话，包含以下内容：  
   - 用户上下文（USER.md）  
   - 项目记忆（MEMORY.md）  
   - 压缩后的会话摘要  
   - 当前工作状态  

## 最佳实践

1. **定期压缩**：勿等到临界点；建议每数小时主动压缩一次  
2. **保留代码**：始终保存实际代码片段，而非仅作引用  
3. **追踪决策**：明确记录决策“原因”（WHY），而不仅是“内容”（WHAT）  
4. **维护 TODO**：清晰标记未完成工作，保障上下文连续性  
5. **引用文件**：指向文件路径，避免嵌入完整文件内容  

## 集成点

- **心跳机制（Heartbeats）**：在心跳周期内执行压缩检查  
- **记忆系统（Memory System）**：将压缩摘要写入记忆文件  
- **会话管理（Session Management）**：协同会话创建（spawn）完成交接  
- **文件追踪（File Tracking）**：准确记录当前各文件状态  

## 技术细节

### 压缩算法

1. 将会话转录文本解析为原子级对话轮次（atomic turns）  
2. 为每一轮次按重要性打分（决策类 = 高分，闲聊类 = 低分）  
3. 按重要性得分保留前 N% 的轮次  
4. 对其余轮次生成执行摘要（executive summary）  
5. 单独提取并保留代码块  
6. 生成会话迁移包（session transfer package）  

### 阈值选项

- **保守型（70%）**：提前触发，保留更多上下文  
- **均衡型（80%）**：默认设置，适用于大多数工作流  
- **激进型（90%）**：逼近极限，最大化单一会话时长  
- **仅手动**：禁用自动触发，仅按需压缩  

### 文件引用

压缩器追踪以下内容：  
- 已修改文件及其路径  
- 配置变更  
- 新建文件  
- 已删除文件  
- 目录结构变更  

## 故障排查

### 压缩过于频繁

```bash
# Increase threshold
context-compressor set-threshold 85
```

### 交接后丢失上下文

请核查：  
1. 是否已成功生成压缩摘要（`memory/compressed-*.md`）  
2. 新会话是否已加载记忆文件  
3. 关键文件是否被误判为冗余内容（chaff）而被丢弃  

### 性能影响

压缩在后台运行，典型会话下应在 <30 秒内完成。若耗时更长：  
- 降低摘要深度（summarization depth）  
- 提高阈值以减少压缩频次  
- 将大型文件排除在压缩范围之外  

## 示例

### 典型工作流

```
User: Working on notes app sidebar
[Session runs 2 hours, many iterations]

Heartbeat triggers → Context at 78% → Auto-compress → New session
User: (no interruption, seamless continuation)
New session has: executive summary, key decisions, file states, TODOs
```

### 手动恢复

```
User notices Claude repeating itself
User: "context-compressor compress --force"
Compressor summarizes → New session starts → User continues seamlessly
```

## 相关 Skills

- **memory-system**：底层记忆基础设施  
- **self-improving-agent**：基于会话模式实现自我优化  
- **sessions-spawn**：负责新会话创建  

## 参见

- [Context Engineering Skills Collection](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering)  
- 关于大语言模型上下文窗口中“中间遗忘”（lost-in-the-middle）现象的研究