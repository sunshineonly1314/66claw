---
name: self-improving-agent
description: "记录学习所得、错误及修正措施，以实现持续改进。在以下情形中使用：(1) 命令或操作意外失败；(2) 用户纠正 Claude（例如‘不对，那是错的……’‘实际上……’）；(3) 用户提出当前尚不支持的能力需求；(4) 外部 API 或工具调用失败；(5) Claude 意识到自身知识已过时或不准确；(6) 针对重复性任务发现了更优方法。此外，在执行重大任务前也应复盘已有学习记录。"
---

# 自我改进技能

将学习所得与错误日志记录至 Markdown 文件，以支持持续改进。编码智能体后续可据此生成修复方案，重要学习项则会被提升至项目记忆中。

## 快速参考

| 情形 | 操作 |
|------|------|
| 命令/操作失败 | 记录至 `.learnings/ERRORS.md` |
| 用户纠正你 | 记录至 `.learnings/LEARNINGS.md`，类别设为 `correction` |
| 用户需要缺失功能 | 记录至 `.learnings/FEATURE_REQUESTS.md` |
| API/外部工具失败 | 记录至 `.learnings/ERRORS.md`，并附上集成细节 |
| 知识已过时 | 记录至 `.learnings/LEARNINGS.md`，类别设为 `knowledge_gap` |
| 发现更优方法 | 记录至 `.learnings/LEARNINGS.md`，类别设为 `best_practice` |
| 与现有条目相似 | 使用 `**See Also**` 建立关联，并考虑提升优先级 |
| 具有广泛适用性的学习 | 提升至 `CLAUDE.md`、`AGENTS.md` 和/或 `.github/copilot-instructions.md` |
| 工作流改进 | 提升至 `AGENTS.md`（clawdbot 工作区） |
| 工具陷阱（gotchas） | 提升至 `TOOLS.md`（clawdbot 工作区） |
| 行为模式 | 提升至 `SOUL.md`（clawdbot 工作区） |

## 初始化设置

若项目根目录下尚不存在 `.learnings/` 目录，请创建之：

```bash
mkdir -p .learnings
```

从 `assets/` 复制模板，或手动创建带标题的文件。

## 日志格式

### 学习条目

追加至 `.learnings/LEARNINGS.md`：

```markdown
## [LRN-YYYYMMDD-XXX] category

**Logged**: ISO-8601 timestamp
**Priority**: low | medium | high | critical
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Summary
One-line description of what was learned

### Details
Full context: what happened, what was wrong, what's correct

### Suggested Action
Specific fix or improvement to make

### Metadata
- Source: conversation | error | user_feedback
- Related Files: path/to/file.ext
- Tags: tag1, tag2
- See Also: LRN-20250110-001 (if related to existing entry)

---
```

### 错误条目

追加至 `.learnings/ERRORS.md`：

```markdown
## [ERR-YYYYMMDD-XXX] skill_or_command_name

**Logged**: ISO-8601 timestamp
**Priority**: high
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Summary
Brief description of what failed

### Error
```  
实际错误消息或输出  
```

### Context
- Command/operation attempted
- Input or parameters used
- Environment details if relevant

### Suggested Fix
If identifiable, what might resolve this

### Metadata
- Reproducible: yes | no | unknown
- Related Files: path/to/file.ext
- See Also: ERR-20250110-001 (if recurring)

---
```

### 功能请求条目

追加至 `.learnings/FEATURE_REQUESTS.md`：

```markdown
## [FEAT-YYYYMMDD-XXX] capability_name

**Logged**: ISO-8601 timestamp
**Priority**: medium
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Requested Capability
What the user wanted to do

### User Context
Why they needed it, what problem they're solving

### Complexity Estimate
simple | medium | complex

### Suggested Implementation
How this could be built, what it might extend

### Metadata
- Frequency: first_time | recurring
- Related Features: existing_feature_name

---
```

## ID 生成规则

格式：`TYPE-YYYYMMDD-XXX`  
- TYPE：`LRN`（学习）、`ERR`（错误）、`FEAT`（功能）  
- YYYYMMDD：当前日期  
- XXX：三位顺序编号或随机字符（如 `001`、`A7B`）

示例：`LRN-20250115-001`、`ERR-20250115-A3F`、`FEAT-20250115-002`

## 条目问题解决流程

当问题被修复后，请更新对应条目：

1. 将 `**Status**: pending` 改为 `**Status**: resolved`  
2. 在元数据（Metadata）之后添加 resolution 区块：

```markdown
### Resolution
- **Resolved**: 2025-01-16T09:00:00Z
- **Commit/PR**: abc123 or #42
- **Notes**: Brief description of what was done
```

其他状态取值：  
- `in_progress` — 正在积极处理中  
- `wont_fix` — 决定不予修复（需在 Resolution 备注中说明原因）  
- `promoted` — 已提升至 CLAUDE.md、AGENTS.md 或 .github/copilot-instructions.md

## 提升至项目记忆

当某项学习具有广泛适用性（而非一次性修复）时，应将其提升至永久性项目记忆。

### 何时提升

- 该学习适用于多个文件/功能模块  
- 所有贡献者（人类或 AI）均应知晓该知识  
- 可预防同类错误反复发生  
- 用于记录项目特有规范与约定  

### 提升目标文件

| 目标文件 | 应存放内容 |
|----------|------------|
| `CLAUDE.md` | 项目事实、Claude 交互相关规范与陷阱（gotchas） |
| `AGENTS.md` | Agent 特定工作流、工具使用模式、自动化规则 |
| `.github/copilot-instructions.md` | GitHub Copilot 所需的项目上下文与规范 |
| `SOUL.md` | 行为准则、沟通风格、原则（clawdbot） |
| `TOOLS.md` | 工具能力、使用模式、集成陷阱（gotchas）（clawdbot） |

### 提升操作步骤

1. **提炼**：将学习内容凝练为简洁明确的规则或事实  
2. **添加**：写入目标文件的合适章节（如文件不存在则新建）  
3. **更新原始条目**：  
   - 将 `**Status**: pending` 改为 `**Status**: promoted`  
   - 添加 `**Promoted**: CLAUDE.md`、`AGENTS.md` 或 `.github/copilot-instructions.md`  

### 提升示例

**学习条目**（详述版）：  
> Project uses pnpm workspaces. Attempted `npm install` but failed.   
> Lock file is `pnpm-lock.yaml`. Must use `pnpm install`.

**在 CLAUDE.md 中**（精炼版）：  
```markdown
## Build & Dependencies
- Package manager: pnpm (not npm) - use `pnpm install`
```

**学习条目**（详述版）：  
> When modifying API endpoints, must regenerate TypeScript client.  
> Forgetting this causes type mismatches at runtime.

**在 AGENTS.md 中**（可执行版）：  
```markdown
## After API Changes
1. Regenerate client: `pnpm run generate:api`
2. Check for type errors: `pnpm tsc --noEmit`
```

## 重复模式识别

若所记录内容与已有条目相似，请执行以下操作：

1. **先搜索**：`grep -r "keyword" .learnings/`  
2. **建立关联**：在元数据中添加 `**See Also**: ERR-20250110-001`  
3. **提升优先级**：若问题反复出现  
4. **考虑系统性修复**：重复性问题常表明：  
   - 缺失文档（→ 提升至 CLAUDE.md 或 .github/copilot-instructions.md）  
   - 缺失自动化（→ 添加至 AGENTS.md）  
   - 架构缺陷（→ 创建技术债工单）

## 定期复盘

在自然节点处复盘 `.learnings/` 目录：

### 复盘时机
- 启动新重大任务前  
- 完成某项功能后  
- 在已有学习记录的相关领域开展工作时  
- 活跃开发期间每周一次  

### 快速状态检查
```bash
# Count pending items
grep -h "Status\*\*: pending" .learnings/*.md | wc -l

# List pending high-priority items
grep -B5 "Priority\*\*: high" .learnings/*.md | grep "^## \["

# Find learnings for a specific area
grep -l "Area\*\*: backend" .learnings/*.md
```

### 复盘操作
- 解决已修复事项  
- 提升适用的学习项  
- 关联相关条目  
- 升级反复出现的问题  

## 检测触发条件

当你察觉以下情形时，自动记录：

**纠正行为**（→ 归类为 `correction` 的学习条目）：  
- “不对，那不正确……”  
- “实际上，应该是……”  
- “你关于……的说法是错的”  
- “那已经过时了……”

**功能请求**（→ 功能请求条目）：  
- “你还能……吗？”  
- “我希望你能……”  
- “有没有办法……？”  
- “为什么你不能……？”

**知识缺口**（→ 归类为 `knowledge_gap` 的学习条目）：  
- 用户提供了你此前未知的信息  
- 你所引用的文档已过时  
- API 实际行为与你的理解不符  

**错误**（→ 错误条目）：  
- 命令返回非零退出码  
- 抛出异常或堆栈跟踪（stack trace）  
- 输出或行为异常  
- 超时或连接失败  

## 优先级指南

| 优先级 | 使用场景 |
|--------|----------|
| `critical` | 阻塞核心功能、存在数据丢失风险或安全问题 |
| `high` | 影响显著、波及常用工作流、问题反复出现 |
| `medium` | 中等影响、存在临时解决方案 |
| `low` | 微小不便、边缘情况、锦上添花型需求 |

## 区域标签（Area Tags）

用于按代码库区域筛选学习记录：

| 区域 | 范围 |
|------|------|
| `frontend` | UI、组件、客户端代码 |
| `backend` | API、服务、服务端代码 |
| `infra` | CI/CD、部署、Docker、云平台 |
| `tests` | 测试文件、测试工具、覆盖率 |
| `docs` | 文档、注释、README 文件 |
| `config` | 配置文件、环境变量、设置项 |

## 最佳实践

1. **立即记录** —— 问题刚发生时上下文最清晰  
2. **力求具体** —— 后续智能体需能快速理解  
3. **包含复现步骤** —— 尤其针对错误  
4. **关联相关文件** —— 便于定位与修复  
5. **提出具体修复建议** —— 不仅限于“需调查”  
6. **统一使用分类标签** —— 支持高效过滤  
7. **积极提升** —— 若存疑，优先加入 CLAUDE.md 或 .github/copilot-instructions.md  
8. **定期复盘** —— 过时的学习记录将失去价值  

## .gitignore 配置选项

**本地保留学习记录**（按开发者隔离）：  
```gitignore
.learnings/
```

**在仓库中追踪学习记录**（团队共享）：  
不添加至 .gitignore —— 学习记录成为共享知识。

**混合模式**（追踪模板，忽略具体条目）：  
```gitignore
.learnings/*.md
!.learnings/.gitkeep
```

## Hook 集成

通过 agent hook 启用自动提醒功能。此功能为**可选启用**——你必须显式配置 hook。

### 快速配置（Claude Code / Codex）

在项目中创建 `.claude/settings.json`：

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "./skills/self-improvement/scripts/activator.sh"
      }]
    }]
  }
}
```

该配置将在每次 prompt 后注入学习评估提醒（约增加 50–100 token 开销）。

### 完整配置（含错误检测）

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "./skills/self-improvement/scripts/activator.sh"
      }]
    }],
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "./skills/self-improvement/scripts/error-detector.sh"
      }]
    }]
  }
}
```

### 可用 Hook 脚本

| 脚本 | Hook 类型 | 用途 |
|------|-----------|------|
| `scripts/activator.sh` | UserPromptSubmit | 任务完成后提醒评估学习记录 |
| `scripts/error-detector.sh` | PostToolUse (Bash) | 命令执行出错时触发 |

详见 `references/hooks-setup.md` 获取详细配置与故障排查指南。

## 自动化技能抽取

当某项学习足够重要、可复用为通用技能时，请使用提供的辅助工具进行抽取。

### 技能抽取判定标准

满足以下任一条件即可启动技能抽取：

| 判定标准 | 描述 |
|----------|------|
| **重复出现** | 已通过 `See Also` 关联 2 个及以上相似问题 |
| **已验证** | 状态为 `resolved`，且修复方案经实测有效 |
| **非显而易见** | 需经真实调试/调查方可发现 |
| **广泛适用** | 非项目专属，可在不同代码库复用 |
| **用户标记** | 用户明确要求“将此保存为技能”或类似表述 |

### 抽取工作流

1. **识别候选条目**：确认该学习符合抽取标准  
2. **运行辅助工具**（或手动创建）：  
   ```bash
   ./skills/self-improvement/scripts/extract-skill.sh skill-name --dry-run
   ./skills/self-improvement/scripts/extract-skill.sh skill-name
   ```  
3. **定制 SKILL.md**：按模板填充学习内容  
4. **更新原学习条目**：设状态为 `promoted_to_skill`，并添加 `Skill-Path`  
5. **验证**：在全新会话中阅读该技能，确保其自包含、无需上下文  

### 手动抽取方式

如倾向手动创建：

1. 创建 `⟦skills`/<skill-name>/SKILL.md⟧  
2. 参照 `assets/SKILL-TEMPLATE.md` 中的模板  
3. 遵循 [Agent Skills 规范](https://agentskills.io/specification)：  
   - YAML 前置元数据须含 `name` 与 `description`  
   - 名称须与所在文件夹名一致  
   - 技能文件夹内不得包含 README.md  

### 抽取触发信号

留意以下迹象，提示某项学习应升级为技能：

**对话中出现**：  
- “将此保存为技能”  
- “我总遇到这个问题”  
- “这对其他项目也有用”  
- “记住这个模式”  

**学习条目中体现**：  
- 多个 `See Also` 链接（表明重复性问题）  
- 高优先级 + 已解决状态  
- 类别为 `best_practice` 且具备广泛适用性  
- 用户反馈对该解决方案表示认可  

### 技能质量关卡（Quality Gates）

抽取前请确认以下各项均已满足：

- [ ] 解决方案已测试且运行正常  
- [ ] 描述脱离原始上下文仍清晰易懂  
- [ ] 代码示例完全自包含  
- [ ] 无硬编码的项目专属值  
- [ ] 符合技能命名规范（小写、使用短横线分隔）  

## 多 Agent 支持

本技能兼容各类 AI 编码智能体，支持 agent 特定激活机制。

### Claude Code

**激活方式**：Hook（UserPromptSubmit、PostToolUse）  
**配置方式**：在 `.claude/settings.json` 中配置 hook  
**检测方式**：通过 hook 脚本自动触发  

### Codex CLI

**激活方式**：Hook（模式同 Claude Code）  
**配置方式**：在 `.codex/settings.json` 中配置 hook  
**检测方式**：通过 hook 脚本自动触发  

### GitHub Copilot

**激活方式**：手动（暂不支持 hook）  
**配置方式**：添加至 `.github/copilot-instructions.md`：

```markdown
## Self-Improvement

After solving non-obvious issues, consider logging to `.learnings/`:
1. Use format from self-improvement skill
2. Link related entries with See Also
3. Promote high-value learnings to skills

Ask in chat: "Should I log this as a learning?"
```

**检测方式**：会话结束时人工复核  

### Clawdbot

**激活方式**：工作区注入 + 智能体间消息传递  
**配置方式**：在 `~/.clawdbot/clawdbot.json` 中配置工作区路径  
**检测方式**：通过会话工具及工作区文件（`AGENTS.md`、`SOUL.md`、`TOOLS.md`）  

Clawdbot uses a workspace-based model with injected prompt files. See `references/clawdbot-integration.md` for detailed setup.

### Agent 无关指导原则（Agent-Agnostic Guidance）

无论使用何种 agent，当出现以下情形时，均应启动自我改进流程：

1. **发现非显而易见的内容** —— 解决方案并非立竿见影  
2. **自我纠正** —— 初始方案有误  
3. **习得项目规范** —— 发现未文档化的模式  
4. **遭遇意外错误** —— 尤其诊断过程困难时  
5. **找到更优解法** —— 对原始方案进行了实质性优化  

### Copilot Chat 集成

Copilot 用户可在相关 prompt 中加入以下内容：

> After completing this task, evaluate if any learnings should be logged to `.learnings/` using the self-improvement skill format.

或使用快捷指令：  
- “将此记录至 learnings”  
- “从此方案创建一项技能”  
- “检查 .learnings/ 中的关联问题”  

## Clawdbot 集成

Clawdbot uses workspace-based prompt injection with specialized files for different concerns.

### 工作区结构

```
~/clawd/                    # Default workspace (configurable)
├── AGENTS.md              # Multi-agent workflows, delegation patterns
├── SOUL.md                # Behavioral guidelines, communication style
├── TOOLS.md               # Tool capabilities, MCP integrations
└── sessions/              # Session transcripts (auto-managed)
```

### Clawdbot 提升目标

| 学习类型 | 提升至 | 示例 |
|----------|--------|------|
| Agent 协作协调 | `AGENTS.md` | “将文件搜索任务委派给 explore agent” |
| 沟通风格 | `SOUL.md` | “保持简洁，避免免责声明” |
| 工具陷阱（gotchas） | `TOOLS.md` | “MCP 服务器 X 需定期刷新认证” |
| 项目事实 | `CLAUDE.md` | 项目标准规范 |

### 智能体间学习（Inter-Agent Learning）

Clawdbot supports session-based communication:  
- **sessions_list** — 查看活跃/近期会话  
- **sessions_history** — 读取另一会话的完整记录  
- **sessions_send** — 向另一会话发送消息  

### 混合配置（Claude Code + Clawdbot）

同时使用两者时：  
1. 用 `.learnings/` 存储项目专属学习记录  
2. 用 clawdbot 工作区文件存储跨项目通用模式  
3. 将高价值学习同步至两个系统  

详见 `references/clawdbot-integration.md` 获取完整配置说明、提升格式规范及故障排查指南。