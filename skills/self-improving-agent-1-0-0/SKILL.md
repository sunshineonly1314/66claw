---
name: self-improving-agent-1-0-0
description: "记录所获经验、错误及修正措施，以实现持续改进。在以下情形中使用：(1) 命令或操作意外失败；(2) 用户纠正 Claude（例如‘不对，那是错的……’‘实际上……’）；(3) 用户提出当前尚不支持的能力需求；(4) 外部 API 或工具调用失败；(5) Claude 意识到自身知识已过时或不准确；(6) 针对重复性任务发现了更优方法。此外，在执行重大任务前也应复盘已有经验。"
---

# 自我改进技能

将所获经验与错误以 Markdown 文件形式记录下来，以支持持续改进。编码智能体后续可据此生成修复方案；重要经验则会被提升至项目级记忆中。

## 快速参考

| 场景 | 操作 |
|------|------|
| 命令/操作失败 | 记录至 `.learnings/ERRORS.md` |
| 用户纠正你 | 记录至 `.learnings/LEARNINGS.md`，并标注类别 `correction` |
| 用户请求缺失功能 | 记录至 `.learnings/FEATURE_REQUESTS.md` |
| API/外部工具失败 | 记录至 `.learnings/ERRORS.md`，并附上集成细节 |
| 知识已过时 | 记录至 `.learnings/LEARNINGS.md`，并标注类别 `knowledge_gap` |
| 发现更优方法 | 记录至 `.learnings/LEARNINGS.md`，并标注类别 `best_practice` |
| 与现有条目相似 | 使用 `**See Also**` 建立关联，并考虑提升优先级 |
| 具有广泛适用性的经验 | 提升至 `CLAUDE.md` 和/或 `AGENTS.md` |

## 初始化设置

若项目根目录下尚不存在 `.learnings/` 目录，请创建之：

```bash
mkdir -p .learnings
```

从 `assets/` 复制模板文件，或手动创建带标准头部的文件。

## 日志格式

### 经验条目

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
- TYPE：`LRN`（经验）、`ERR`（错误）、`FEAT`（功能）  
- YYYYMMDD：当前日期  
- XXX：三位顺序编号或随机字符（如 `001`、`A7B`）

示例：`LRN-20250115-001`、`ERR-20250115-A3F`、`FEAT-20250115-002`

## 条目问题解决

当某问题已被修复时，请更新对应条目：

1. 将 `**Status**: pending` 改为 `**Status**: resolved`  
2. 在元数据（Metadata）后添加解决说明区块：

```markdown
### Resolution
- **Resolved**: 2025-01-16T09:00:00Z
- **Commit/PR**: abc123 or #42
- **Notes**: Brief description of what was done
```

其他状态取值：  
- `in_progress` — 正在积极处理中  
- `wont_fix` — 决定不予修复（需在“解决说明”中注明原因）  
- `promoted` — 已提升至 CLAUDE.md 或 AGENTS.md

## 提升至项目级记忆

当某项经验具有广泛适用性（而非一次性修复）时，应将其提升为永久性项目记忆。

### 何时提升

- 该经验适用于多个文件/功能模块  
- 所有贡献者（人类或 AI）均应了解该知识  
- 可预防同类错误反复发生  
- 用于记录项目特有的约定规范  

### 提升目标文件

| 目标文件 | 应存放内容 |
|----------|------------|
| `CLAUDE.md` | 项目事实、交互惯例、Claude 使用注意事项等通用信息 |
| `AGENTS.md` | Agent 特定的工作流、工具使用模式、自动化规则等 |

### 如何提升

1. **提炼**：将经验凝练为一条简洁明确的规则或事实  
2. **添加**：写入目标文件的合适章节  
3. **更新原始条目**：  
   - 将 `**Status**: pending` 改为 `**Status**: promoted`  
   - 添加 `**Promoted**: CLAUDE.md` 或 `**Promoted**: AGENTS.md`  

### 提升示例

**原始经验条目**（详尽版）：  
> Project uses pnpm workspaces. Attempted `npm install` but failed.   
> Lock file is `pnpm-lock.yaml`. Must use `pnpm install`.

**在 CLAUDE.md 中的呈现**（精炼版）：  
```markdown
## Build & Dependencies
- Package manager: pnpm (not npm) - use `pnpm install`
```

**原始经验条目**（详尽版）：  
> When modifying API endpoints, must regenerate TypeScript client.  
> Forgetting this causes type mismatches at runtime.

**在 AGENTS.md 中的呈现**（可操作版）：  
```markdown
## After API Changes
1. Regenerate client: `pnpm run generate:api`
2. Check for type errors: `pnpm tsc --noEmit`
```

## 重复模式识别

若所记录内容与已有条目相似，请执行以下步骤：

1. **先搜索**：`grep -r "keyword" .learnings/`  
2. **建立关联**：在元数据中添加 `**See Also**: ERR-20250110-001`  
3. **提升优先级**：若问题反复出现  
4. **考虑系统性修复**：重复性问题往往表明：  
   - 缺少必要文档（→ 提升至 CLAUDE.md）  
   - 缺少自动化支持（→ 补充至 AGENTS.md）  
   - 存在架构层面问题（→ 创建技术债工单）

## 定期复盘

在自然的时间节点对 `.learnings/` 目录进行复盘：

### 复盘时机
- 启动新重大任务前  
- 完成某项功能后  
- 在已有经验涉及的代码区域开展工作时  
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
- 提升适用的经验条目  
- 关联相关条目  
- 升级反复出现的问题  

## 触发检测条件

当你察觉以下情形时，应自动记录：

**用户纠正**（→ 归类为 `correction` 类型的经验）：  
- “不对，那不正确……”  
- “实际上，应该是……”  
- “你关于……的说法是错的”  
- “那已经过时了……”

**功能请求**（→ 记录为功能请求）：  
- “你还能……吗？”  
- “我希望你能……”  
- “有没有办法……？”  
- “为什么你不能……？”

**知识缺口**（→ 归类为 `knowledge_gap` 类型的经验）：  
- 用户提供了你此前未知的信息  
- 你所引用的文档已过时  
- API 实际行为与你的理解不符  

**错误事件**（→ 记录为错误条目）：  
- 命令返回非零退出码  
- 抛出异常或堆栈跟踪  
- 输出或行为异常  
- 超时或连接失败  

## 优先级指南

| 优先级 | 使用场景 |
|--------|----------|
| `critical` | 阻塞核心功能、存在数据丢失风险或安全问题 |
| `high` | 影响显著，波及常用工作流，或属反复出现的问题 |
| `medium` | 中等影响，存在临时解决方案 |
| `low` | 微小不便、边缘情况或锦上添花型需求 |

## 区域标签

用于按代码库区域筛选经验条目：

| 区域 | 范围 |
|------|------|
| `frontend` | 用户界面、组件、客户端代码 |
| `backend` | API、服务、服务端代码 |
| `infra` | CI/CD、部署、Docker、云平台配置 |
| `tests` | 测试文件、测试工具、覆盖率相关 |
| `docs` | 文档、注释、README 文件 |
| `config` | 配置文件、环境变量、系统设置 |

## 最佳实践

1. **立即记录** —— 问题刚发生时上下文最清晰  
2. **力求具体** —— 便于后续智能体快速理解  
3. **包含复现步骤** —— 尤其针对错误条目  
4. **关联相关文件** —— 加快修复进程  
5. **提出具体修复建议** —— 不仅限于“需调查”  
6. **统一使用标准类别** —— 支持高效筛选  
7. **积极提升经验** —— 若存疑，优先加入 CLAUDE.md  
8. **定期复盘** —— 过时的经验将失去价值  

## Gitignore 配置选项

**本地保存经验**（按开发者隔离）：  
```gitignore
.learnings/
```

**在仓库中追踪经验**（团队共享）：  
不添加至 .gitignore —— 经验将成为团队共享知识。

**混合模式**（追踪模板，忽略具体条目）：  
```gitignore
.learnings/*.md
!.learnings/.gitkeep
```