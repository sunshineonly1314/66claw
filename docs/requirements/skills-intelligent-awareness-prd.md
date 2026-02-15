# Skills 智能感知需求文档

> 状态：📋 TODO（待实施）
> 创建日期：2026-02-04
> 优先级：P1

## 一、需求背景

当前 OpenClawCN 的 Skills 系统虽然功能完善，但用户难以主动感知和发现可用技能。需要实现智能推荐机制，让用户能够：
1. 自动感知已安装的 skills
2. 收到"你可能想用哪个 skill"的智能推荐
3. 了解每个 skill 的能力（自我介绍）
4. 对于未安装的 skill，获得自动下载引导

## 二、现状分析

### 已具备的能力

| 能力 | 状态 | 说明 |
|------|------|------|
| Skills 加载机制 | ✅ 完善 | 支持 bundled/managed/workspace/plugin 多源加载 |
| 状态检测 | ✅ 完善 | 检测依赖(bins/env/config/os)、判断可用性 |
| CLI 管理 | ✅ 完善 | `skills list/info/check/install` 等命令 |
| Web UI | ✅ 完善 | 本地技能 + 技能市场双Tab、搜索、分类、安装进度 |
| System Prompt 集成 | ✅ 基础 | 引导 AI 扫描 skills，但不介绍具体 skill |

### 缺失的能力

| 需求 | 缺失程度 | 说明 |
|------|----------|------|
| 智能推荐 | 🔴 完全缺失 | 无法根据用户意图推荐 skill |
| 主动自我介绍 | 🔴 完全缺失 | Agent 不知道每个 skill 能做什么 |
| 未安装 skill 引导 | 🟡 部分缺失 | UI 有市场，但 Agent 不会主动引导 |
| 首次使用引导 | 🟡 部分缺失 | onboard 有 skills 步骤，但缺乏后续引导 |

## 三、功能需求

### 3.1 Skills 智能感知与推荐

**目标：** 当用户表达某种意图时，Agent 能主动推荐相关 skill

**技术方案：**

```
用户消息 → 意图识别 → 匹配可用 skills → 推荐提示
```

**实现路径：**

1. **在 System Prompt 中注入 skills 摘要信息**
   - 当前：只有 `<available_skills>` 列表
   - 改进：增加每个 skill 的**一句话能力描述 + 触发关键词**

2. **增加 skill 元数据字段**
   - 在 `SKILL.md` frontmatter 中增加：
     ```yaml
     triggers:
       - "天气"
       - "weather"
       - "温度"
     capabilities_summary: "查询全球天气、温度、空气质量"
     ```

3. **Agent 推荐逻辑**
   - 在 system prompt 中增加推荐指令

### 3.2 Skills 主动自我介绍

**目标：** 用户可以问"你有什么技能？"，Agent 能清晰介绍

**实现：**

1. 增强 system prompt 的 skills section，动态生成每个 skill 的一行介绍
2. 新增 `/skills` 斜杠命令，返回可用 skills 卡片

### 3.3 未安装 Skill 智能引导

**目标：** 当用户需要某个功能但对应 skill 未安装时，引导安装

**实现：**

1. 在 system prompt 中增加**热门未安装 skills** 列表（top 5）
2. 增加 `skills_install` Agent 工具

## 四、TODO 清单

### 第一阶段：MVP（预计 3-4 天）

- [ ] **TODO-SKILL-001**: 增强 system prompt，注入 skills 摘要
  - 文件：`src/agents/system-prompt.ts`
  - 修改 `buildSkillsSection` 函数，增加 skills 摘要参数
  - 生成格式：`- <name>: <capabilities_summary> [triggers: xxx, yyy]`

- [ ] **TODO-SKILL-002**: SKILL.md frontmatter 增加新字段
  - 文件：`src/agents/skills/frontmatter.ts`
  - 新增字段：`triggers: string[]`, `capabilities_summary: string`
  - 更新类型定义

- [ ] **TODO-SKILL-003**: 调整 AI 推荐逻辑（prompt 工程）
  - 文件：`src/agents/system-prompt.ts`
  - 增加 "Skill Discovery" section
  - 引导 Agent 根据用户意图推荐 skill

- [ ] **TODO-SKILL-004**: 更新现有 bundled skills 的 frontmatter
  - 目录：`skills/` 下所有 `SKILL.md`
  - 为每个 skill 添加 `triggers` 和 `capabilities_summary`

### 第二阶段：完善（预计 4-5 天）

- [ ] **TODO-SKILL-005**: 增加 `skills_install` Agent 工具
  - 文件：`src/agents/tools/` 新建文件
  - 允许 Agent 调用 API 安装 skill
  - 需要用户确认机制

- [ ] **TODO-SKILL-006**: 实现 `/skills` 斜杠命令
  - 文件：`src/commands/` 或相关处理逻辑
  - 返回格式化的 skills 列表卡片
  - 支持 `/skills market` 查看市场

- [ ] **TODO-SKILL-007**: 首次使用引导优化
  - 检测用户是否首次使用 skills
  - 弹出引导卡片推荐热门 skills

### 第三阶段：体验优化（预计 3 天）

- [ ] **TODO-SKILL-008**: UI 智能推荐卡片
  - 文件：`ui/src/ui/views/skills.ts`
  - 根据用户历史行为推荐 skills
  - 显示"您可能需要"区块

- [ ] **TODO-SKILL-009**: 未安装 skill 感知
  - 在 system prompt 中注入热门未安装 skills 列表
  - 限制 top 5，避免 token 膨胀

- [ ] **TODO-SKILL-010**: 使用数据分析
  - 记录 skill 使用频率
  - 优化推荐算法

## 五、关键设计决策

### 决策 1：Skills 信息如何进入 Agent 上下文？

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| A. 全量注入 system prompt | 信息完整 | token 消耗大 | ❌ |
| B. 摘要注入 + 按需读取 SKILL.md | 平衡 | 需两步 | ✅ |
| C. 工具调用获取 | 灵活 | 延迟高 | ❌ |

**采用方案 B**

### 决策 2：如何处理未安装 skills？

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| A. 不感知未安装 skill | 简单 | 功能受限 | ❌ |
| B. 注入热门 top N | 平衡 | 需维护热门列表 | ✅ |
| C. 实时查询市场 | 完整 | 性能差 | ❌ |

**采用方案 B**

## 六、用户体验设计

### 场景 1：用户首次使用

```
[系统消息] 🎉 欢迎使用 OpenClawCN！我发现你还没有安装任何技能。
以下是一些推荐的技能：
• 📍 天气查询 - 获取全球天气信息
• 🔍 网页搜索 - 搜索互联网内容  
• 📝 笔记管理 - 管理你的笔记和待办

点击安装，或发送 /skills 查看全部技能
```

### 场景 2：用户意图触发推荐

```
用户: 明天北京天气怎么样？

Agent: 我注意到你在询问天气信息。我有「天气查询」技能可以帮你：
       [一键使用天气技能]
       
       或者，我也可以通过网页搜索为你查找。
```

### 场景 3：用户主动询问

```
用户: 你有什么技能？

Agent: 📦 我当前已安装 3 个技能：

✅ **天气查询** - 查询全球天气、温度、空气质量
✅ **计算器** - 数学运算、单位换算、汇率转换  
✅ **日程管理** - 创建提醒、管理日程

💡 **推荐安装：**
• 图像生成 - 根据描述创建图像
• 代码执行 - 运行 Python/JS 代码

发送 /skills market 浏览更多技能
```

## 七、相关文件

- `src/agents/system-prompt.ts` - System Prompt 构建
- `src/agents/skills/` - Skills 核心逻辑
- `src/agents/skills-status.ts` - 状态检测
- `src/agents/skills-install.ts` - 安装逻辑
- `src/cli/skills-cli.ts` - CLI 命令
- `ui/src/ui/views/skills.ts` - UI 展示
- `ui/src/ui/controllers/skills.ts` - UI 控制器

## 八、工作量评估

| 阶段 | 预计工时 | 说明 |
|------|----------|------|
| 第一阶段 MVP | 3-4 天 | 核心功能 |
| 第二阶段完善 | 4-5 天 | 工具和命令 |
| 第三阶段优化 | 3 天 | 体验提升 |
| **总计** | **10-12 天** | |

## 九、风险与依赖

1. **Token 消耗风险**：Skills 摘要注入会增加 system prompt 长度，需控制
2. **向后兼容**：新增 frontmatter 字段需确保旧 SKILL.md 兼容
3. **市场数据依赖**：热门 skills 列表需要 ClawdSkillsProxy 服务支持
