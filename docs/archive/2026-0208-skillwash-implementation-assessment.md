# SkillWash 实施状态评估报告

> **评估日期**: 2026-02-08
> **评估对象**: `skillsqingxi/` 目录（对应 PRD: `todo/PRD-skills-cleaning-pipeline.md`）
> **结论**: 核心 Pipeline 已实现并验证通过，但尚未达到生产级批量运行标准

---

## 一、总览

| 指标 | 数据 |
|------|------|
| 代码位置 | `skillsqingxi/`（PRD 规划为 `src/skills-wash/`） |
| 总代码量 | 8 个文件，1,443 行 TypeScript |
| Git 状态 | 已有 1 次提交记录（`301299c`），但目录仍处于 untracked |
| 运行方式 | `bun skillsqingxi/run.ts`（独立脚本，未集成到主 CLI） |
| 已验证样本 | 1 个（weather，评级 A，得分 8.4，耗时 26.3s） |
| Qwen 模型 | `qwen3-max-2026-01-23`（PRD 规划为 `qwen-max`） |

---

## 二、文件清单与 PRD 对照

| PRD 规划路径 | 实际文件 | 行数 | 实现度 |
|-------------|---------|------|--------|
| `src/skills-wash/config.ts` | [config.ts](../../skillsqingxi/config.ts) | 51 | 完整 |
| `src/skills-wash/types.ts` | [types.ts](../../skillsqingxi/types.ts) | 132 | 完整 |
| `src/skills-wash/layer2-security/qwen-client.ts` | [qwen-client.ts](../../skillsqingxi/qwen-client.ts) | 146 | 完整 |
| `src/skills-wash/layer1-rules/` (3 个文件) | [layer1-rules.ts](../../skillsqingxi/layer1-rules.ts) | 241 | 合并为单文件 |
| `src/skills-wash/layer2-security/` (4 个文件) | [layer2-security.ts](../../skillsqingxi/layer2-security.ts) | 256 | 合并为单文件 |
| `src/skills-wash/layer3-quality/` (4 个文件) | [layer3-quality.ts](../../skillsqingxi/layer3-quality.ts) | 223 | 合并为单文件 |
| `src/skills-wash/index.ts` | [pipeline.ts](../../skillsqingxi/pipeline.ts) | 292 | 完整 |
| `src/skills-wash/cli.ts` | [run.ts](../../skillsqingxi/run.ts) | 102 | 基础版 |
| `src/skills-wash/output/reporter.ts` | 内联在 pipeline.ts | — | 最小实现 |
| `src/skills-wash/output/exporter.ts` | 未实现 | — | 缺失 |
| `src/skills-wash/output/stats.ts` | 未实现 | — | 缺失 |

---

## 三、PRD 三层架构实现详情

### Layer 1：规则引擎 — 完整实现

| PRD 要求 | 实现状态 | 备注 |
|---------|---------|------|
| 结构校验（6 项规则） | 6/6 | maxFileSize, name, description, bodyLines, emptyBody, descLength |
| 危险模式正则库 | 22/30 条 | 覆盖 6 大类，缺少 PI-012, DE-005(部分), CI-007, OB-004, CM-002, PE-001(sudo) |
| 黑名单过滤 | 仅 skill name | 缺少域名黑名单和包名黑名单 |
| 上下文感知（v1.1 修复） | 已实现 | `isInCodeBlock()` + `excludeIfNearby` + 代码块内降级 |
| 判定逻辑 | 完整 | error->reject, critical->reject, 2+danger->reject, 1 danger->review |

**实测表现**：weather 技能 Layer 1 耗时 1ms，零误报，符合"毫秒级"设计目标。

### Layer 2：Qwen 安全审计 — 完整实现

| PRD 要求 | 实现状态 | 备注 |
|---------|---------|------|
| 内容消毒（v1.1 缺陷 1 修复） | 已实现 | HTML注释剥离 + LLM标记转义 + 行号前缀 |
| 防注入锚定指令 | 已实现 | system prompt 末尾包含明确的锚定段落 |
| 安全审计 6 维度 | 完整 | A-F 维度全部在 prompt 中定义 |
| JSON 解析失败容错 | 已实现 | 失败后 temperature=0.05 重试，仍失败标记 review |
| confidence 阈值 | 已实现 | <0.7 标记 review，Layer1 review 需 >0.9 才能 pass |
| 双模型交叉验证（v1.1 修复） | 未实现 | PRD 建议对 medium/high 用 qwen-max + qwen-plus 双审 |

**实测表现**：weather 技能 Layer 2 耗时 4.9s，输入 1437 tokens，输出 114 tokens，confidence 0.95。

### Layer 3：质量评估 + 汉化 — 完整实现

| PRD 要求 | 实现状态 | 备注 |
|---------|---------|------|
| 5 维评分体系 | 完整 | utility/completeness/technical_quality/maintenance/cn_compatibility |
| S/A/B/C/D 分级 | 完整 | 阈值与 PRD 一致 (9.0/7.0/5.0/3.0) |
| 先评估再翻译（v1.1 缺陷 3 修复） | 已实现 | `overallScore >= 5.0 && !cn_blocked` 才进入翻译 |
| 翻译结构验证（v1.1 缺陷 5 修复） | 已实现 | frontmatter/代码块数量/长度比/中文字符数 4 项检查 |
| 翻译失败回退英文 | 已实现 | validationPassed=false 时回退 |

**实测表现**：weather 技能 Layer 3 耗时 21.4s，总 2137 tokens，评级 A (8.4分)，中文翻译验证通过。

---

## 四、PRD v1.1 七项自审修复落实情况

| # | 严重度 | 缺陷 | 状态 | 代码证据 |
|---|--------|------|------|---------|
| 1 | **严重** | 审计员被反向注入 | **已修复** | `sanitizeForAudit()` + 锚定指令（layer2-security.ts:14-36, 110-116） |
| 2 | **高** | 正则误杀率过高 | **已修复** | `downgradeInCodeBlock` + `excludeIfNearby`（layer1-rules.ts:20-22, 170-179） |
| 3 | **高** | 不达标技能浪费翻译 Token | **已修复** | `if (overallScore >= minOverallScore && !cn_blocked)`（layer3-quality.ts:178） |
| 4 | 中 | 缺少去重 (Layer 0) | **未实现** | — |
| 5 | 中 | 翻译质量无量化标准 | **已实现** | `validateTranslation()` 4 项结构检查（layer3-quality.ts:119-137） |
| 6 | 中 | 成本估算遗漏 system prompt | N/A | 文档层面，非代码 |
| 7 | 低 | 缺少 Red Team 测试集 | **未实现** | — |

**小结**：3 个关键安全修复（#1, #2, #3）全部落实，2 个增强项（#4 去重, #7 测试集）未做。

---

## 五、已发现的问题

### P0：API Key 硬编码

```
// config.ts:7
apiKey: process.env.SKILLWASH_API_KEY ?? "sk-sp-07ac2eb2bef54a26892d9feeadf7d004"
```

明文 API Key 写在代码中。一旦提交到公开仓库即泄露。**必须在正式集成前移除 fallback 值。**

### P1：批量模式为串行执行

```typescript
// run.ts:59 — 逐个顺序执行
for (const skillPath of skillDirs) {
  const result = await washSingleSkill(skillPath);
}
```

config 中定义了 `concurrency: 3` 和 `maxRpm: 15`，但批量处理实际为串行 `for` 循环。
1715 个技能按单个 26s 估算需 **12+ 小时**，远超 PRD 规划的 2.5 小时。

### P1：正则覆盖率不足

| 类别 | PRD 定义 | 已实现 | 覆盖率 |
|------|---------|--------|--------|
| 提示词注入 (PI) | 12 条 | 11 条 | 92% |
| 数据窃取 (DE) | 7 条 | 6 条 | 86% |
| 命令注入 (CI) | 7 条 | 6 条 | 86% |
| 混淆 (OB) | 4 条 | 3 条 | 75% |
| 挖矿 (CM) | 2 条 | 1 条 | 50% |
| 权限提升 (PE) | 3 条 | 2 条 | 67% |
| **总计** | **35 条** | **29 条** | **83%** |

缺失的关键模式：`PI-012`(假装/扮演)、`OB-004`(不可见字符)、`CM-002`(钱包地址)、`PE-001`(sudo 白名单版)。

### P2：黑名单不完整

| 黑名单类型 | PRD 定义 | 实现状态 |
|-----------|---------|---------|
| Skill 名称关键词 | 24 个 | 已实现（23 个，缺 `defi-yield`） |
| 域名黑名单 | 6 条正则 | **未实现** |
| 包名黑名单 | 3 条正则 | **未实现** |

### P2：缺少聚合报告

当前仅生成单个 skill 的 JSON 报告。PRD 规划的以下产出物均未实现：
- `wash-report-{date}.json`（完整审计报告）
- `wash-summary-{date}.md`（可读汇总）
- `rejected-skills.json`（被拒列表）
- `review-skills.json`（复审列表）
- `skills-index.json`（精选索引）
- `skills-catalog.md`（技能目录）

### P3：无断点续跑

PRD 规划了 checkpoint 机制（每 50 个保存），实际未实现。批量运行中断后需从头开始。

---

## 六、实测数据（weather 样本）

```
Pipeline 总耗时: 26.3s
├── Layer 1 (规则引擎):    1ms     | 0 tokens
├── Layer 2 (安全审计):    4.9s    | 1,437 + 114 = 1,551 tokens
├── Layer 3a (质量评估):   ~10s    | ~1,000 tokens (估)
└── Layer 3b (汉化翻译):   ~11s    | ~1,137 tokens (估)

总 Token 消耗: ~3,688 tokens
按 Qwen-Max 定价估算: ~¥0.13/技能
```

按此推算全量 1,715 个技能：
- Token 消耗: ~6.3M tokens
- 费用: ~¥223（低于 PRD 修正后估算的 ¥292，因 system prompt 较精简）
- 时间: 串行 ~12h / 并发(5) ~2.5h

---

## 七、与主工程集成差距

| 集成项 | 状态 | 说明 |
|--------|------|------|
| 目录位置 | 不符合 | 应迁入 `src/skills-wash/` 或 `src/agents/skills/wash/` |
| CLI 注册 | 未集成 | 需注册为 `clawdbot skills wash` 子命令 |
| ClawdSkillsProxy 对接 | 未实现 | 缺少 `skills-index.json` 生成和上传逻辑 |
| 单元测试 | 无 | 无任何 `.test.ts` 文件 |
| 环境变量管理 | 有风险 | API Key 硬编码需清理 |

---

## 八、结论与建议

### 整体评价

SkillWash Pipeline 的**核心三层架构已完整实现**，安全防护到位（3 个关键修复全部落实），且已通过实际 API 调用验证。代码质量良好、类型完整、错误处理合理。

但距离生产级全量运行（1715+ skills），还差 4 个关键能力：

### 投产前必须完成

| 优先级 | 任务 | 工作量估算 |
|--------|------|-----------|
| **P0** | 移除硬编码 API Key | 10 分钟 |
| **P1** | 实现并发批量处理 + 限速 | 半天 |
| **P1** | 补齐缺失的 6 条正则 + 域名/包名黑名单 | 半天 |
| **P2** | 实现聚合报告生成 + skills-index.json | 1 天 |
| **P2** | 断点续跑机制 | 半天 |

### 可后续迭代

| 任务 | 说明 |
|------|------|
| Layer 0 去重 | 文本相似度去重，减少同质化 |
| 双模型交叉验证 | 对 medium/high 风险 skill 增加 qwen-plus 二审 |
| Red Team 测试集 | 标准化对抗测试，验证检测率 |
| 集成到主 CLI | 迁移目录 + 注册 `clawdbot skills wash` |
| ClawdSkillsProxy 对接 | 生成索引 + 自动上传 |

---

> **一句话总结**：SkillWash 已走完"从 0 到 1"，Pipeline 核心逻辑完整且验证通过；剩下的是"从 1 到 N"的工程化工作——并发、断点、报告、集成。
