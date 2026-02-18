# AI 自动化上游合并流水线 — 需求及完成归档

> **归档日期**: 2026-02-17
> **对应规划**: [TODO-12: 每日上游合并自动化 Agent](../roadmap/TODO-12-daily-upstream-merge-automation.md)
> **状态**: ✅ 全部实现，待配置 Secrets 后即可生效

---

## 一、需求演进

### 需求 1：AI 分析上游变更（2026-02-16）

> **原话**: "我希望整体的只要是新下拉的代码，都要用AI来过一遍，然后进行分析保存"

**核心诉求**: 每次上游拉取后，AI 必须完整分析变更内容，并将分析结果持久化保存。

### 需求 2：全流程 AI 自动化（2026-02-16）

> **原话**: "我希望全部由AI来完成，包括拉取、分析、融合、代码review、单元测试、修复、测试、全量测试，整个流程都由AI自己来解决"

**核心诉求**: 100% 自治闭环 —— 从拉取到合并到修复到测试，全部由 AI 自动完成，零人工介入。

### 需求 3：脚本组织（2026-02-17）

> **原话**: "这些脚本放到一个 autopipeline 文件夹下，目前还没有生效"

**核心诉求**: 统一管理所有流水线脚本，集中到 `scripts/autopipeline/` 目录。

---

## 二、实现清单

### 2.1 新增文件（7 个脚本 + 1 文档）

| 文件路径 | 行数 | 用途 |
|---------|------|------|
| `scripts/autopipeline/ai-merge-pipeline.sh` | 448 | **主编排器** — 一条命令完成全部 8 个阶段 |
| `scripts/autopipeline/analyze-upstream-diff.sh` | 488 | **数据采集** — 12 步结构化分析，输出 JSON manifest |
| `scripts/autopipeline/ai-analyze-upstream.sh` | 366 | **AI 报告** — 调用 Claude API 生成深度分析报告 |
| `scripts/autopipeline/agent-resolve-conflicts.sh` | 378 | **冲突解决** — 3 级策略自动解决合并冲突 |
| `scripts/autopipeline/agent-fix-failures.sh` | 376 | **故障修复** — AI 自动修复 lint/build/test 失败 |
| `scripts/autopipeline/apply-cn-brand.sh` | 332 | **品牌重命名** — OpenClaw → OpenClawCN 幂等转换 |
| `scripts/autopipeline/REPORT_SCHEMA.md` | 81 | 分析报告格式定义 |
| `docs/upstream-reports/` | — | AI 报告持久化目录（按日期命名） |

**总代码量**: 2,469 行 shell 脚本

### 2.2 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `scripts/merge-upstream.sh` | 新增 `--analyze` / `--analyze-only` 参数，集成 AI 分析（Step 3.5）和品牌重命名（Step 4.5） |
| `.github/workflows/daily-upstream-sync.yml` | 新增 `analyze` Job，merge Job 中集成 AI 冲突解决，validate Job 中集成 AI 故障修复，report Job 包含风险等级和 AI 摘要 |
| `config/cn-protected-files.json` | 新增 6 个脚本到 Section I 保护列表 + `scripts/autopipeline/` 目录保护 |
| `.gitattributes` | 新增 6 条 `merge=ours` 规则 + `scripts/autopipeline/**` 目录规则 |
| `.gitignore` | 新增 `.upstream-analysis/` 和 `merge-*.log` |

---

## 三、系统架构

### 3.1 流水线 8 阶段

```
阶段 1: 环境检查      → 验证 git remote、claude CLI、pnpm
阶段 2: 拉取上游      → git fetch upstream main
阶段 3: AI 分析       → 结构化数据采集 + Claude 深度分析
阶段 4: 合并          → git merge（.gitattributes merge=ours 保护 Section I）
阶段 5: AI 冲突解决   → 3 级策略：自动/AI标记/人工
阶段 6: 品牌重命名    → OpenClaw → OpenClawCN（7 条规则）
阶段 7: 验证+自动修复 → lint → build → test（每步最多 N 轮 AI 修复）
阶段 8: 推送+报告     → git push + 生成报告
```

### 3.2 冲突解决 3 级策略

| 级别 | 范围 | 策略 | 自动化率 |
|------|------|------|---------|
| Level 1 | Section I 文件（145+） | `git checkout --ours` | 100% |
| Level 2 | Section II 有标记的文件（5） | Claude AI 识别 `// ===== OpenClawCN:` 标记并保留 | ~90% |
| Level 3 | Section II 无标记的文件（9） | 报告给人工 | 0%（待标记） |

### 3.3 CI 工作流（5 个 Job）

```
[1] detect    → 检测上游变更、统计 Section II 影响
      ↓
[2] analyze   → 结构化数据采集 + AI 分析报告（可选）
      ↓
[3] merge     → 尝试合并 → 失败时 AI 冲突解决 → 品牌重命名
      ↓
[4] validate  → CN 完整性检查 → lint/build/test（失败时 AI 修复）
      ↓
[5] report    → 成功创建 PR / 失败创建 Issue + 飞书通知
```

**触发方式**:
- 定时: 每天 UTC 02:00（北京时间 10:00）
- 手动: `workflow_dispatch` 支持参数覆盖

### 3.4 数据流

```
.upstream-analysis/YYYY-MM-DD/
├── manifest.json          ← 主清单（commit 数、风险等级、Section II 影响）
├── commits.jsonl          ← 每条上游 commit 的 JSON 记录
├── diff-stat.txt          ← git diff --stat 统计
├── section2-diffs/        ← Section II 各文件独立 diff
├── new-files.txt          ← 上游新增文件
├── package-diff.txt       ← 依赖变更
└── brand-scan.txt         ← 含 OpenClaw 模式的新文件

docs/upstream-reports/
└── YYYY-MM-DD.md          ← Claude 生成的深度分析报告
```

---

## 四、风险等级计算

| 等级 | 条件 | 建议 |
|------|------|------|
| `critical` | Section II ≥ 5 文件受影响 或 有破坏性变更 | 人工审查后再合并 |
| `high` | Section II ≥ 3 文件受影响 | AI 合并 + 人工复核 |
| `medium` | Section II 1-2 文件受影响 | AI 自动合并 |
| `low` | 无 Section II 影响 | 完全自动 |

---

## 五、品牌重命名规则

| 查找 | 替换 | 说明 |
|------|------|------|
| `OpenClawConfig` | `OpenClawCNConfig` | PascalCase 复合名（优先匹配） |
| `OpenClawSchema` | `OpenClawCNSchema` | PascalCase 复合名 |
| `OpenClawPaths` | `OpenClawCNPaths` | PascalCase 复合名 |
| `OpenClaw` | `OpenClawCN` | PascalCase 通用 |
| `OPENCLAW_` | `OPENCLAWCN_` | 大写蛇形 |
| `openclaw` | `openclawcn` | 小写 |
| `x-openclaw-` | `x-openclawcn-` | HTTP 头 |

**排除项**: `github.com/openclaw/openclaw`、`@openclaw/`、`openclaw.ai`、`openclaw.com`
**后置修复**: 误改的上游 URL 和域名自动回退

---

## 六、配置依赖（部署前必须完成）

| Secret | 用途 | 是否必须 |
|--------|------|---------|
| `SYNC_TOKEN` | GitHub PAT（contents:write + pull-requests:write） | ✅ 是 |
| `ANTHROPIC_API_KEY` | Claude API 调用（冲突解决、分析、故障修复） | ✅ 是（AI 功能） |
| `FEISHU_WEBHOOK` | 飞书机器人通知 | ❌ 可选 |

---

## 七、对照 TODO-12 目标达成

| 目标 | 衡量标准 | 达成状态 |
|------|---------|---------|
| G1: 自动化率 90% | 无冲突时零人工 | ✅ Section I 100% 自动 + Section II AI 辅助 |
| G2: 冲突检测前置 | 合并前预测 | ✅ `analyze-upstream-diff.sh` 预分析 Section II 影响 |
| G3: CN 文件 100% 保护 | 145+ 文件不被覆盖 | ✅ `.gitattributes` merge=ours + `cn-protected-files.json` |
| G4: 合并后 CI 验证 | 含 CN 测试 | ✅ CN 完整性检查 + lint/build/test + AI 修复 |
| G5: 5 分钟内通知 | 飞书推送 | ✅ 飞书 webhook 集成 |
| G6: 1 分钟内回滚 | 一键恢复 | ⚠️ 部分（可 `git revert`，无专用回滚脚本） |

---

## 八、已修复的 Bug

| Bug | 文件 | 修复方式 |
|-----|------|---------|
| `REPO_ROOT` 路径错误 | 6 个 autopipeline 脚本 | `$(dirname "$0")/..` → `$(dirname "$0")/../..`（脚本从 `scripts/` 移到 `scripts/autopipeline/` 后需多跳一级） |
| `local` 关键字在函数外使用 | `agent-resolve-conflicts.sh:311` | 移除 `local` 关键字 |
| 旧路径引用未更新 | `daily-upstream-sync.yml`、`cn-protected-files.json`、`.gitattributes` | 全局替换为 `scripts/autopipeline/` 前缀 |

---

## 九、使用方法

### 本地手动执行全流程

```bash
# 配置 merge driver（首次）
bash scripts/setup-merge-drivers.sh

# 执行完整 AI 流水线
bash scripts/autopipeline/ai-merge-pipeline.sh

# 预览模式（不实际修改）
bash scripts/autopipeline/ai-merge-pipeline.sh --dry-run

# 不推送（本地验证）
bash scripts/autopipeline/ai-merge-pipeline.sh --no-push
```

### 单独执行各阶段

```bash
# 仅分析
bash scripts/autopipeline/analyze-upstream-diff.sh
bash scripts/autopipeline/ai-analyze-upstream.sh

# 仅解决冲突（需处于 merge 状态）
bash scripts/autopipeline/agent-resolve-conflicts.sh

# 仅修复失败
bash scripts/autopipeline/agent-fix-failures.sh --lint-only
bash scripts/autopipeline/agent-fix-failures.sh --build-only
bash scripts/autopipeline/agent-fix-failures.sh --test-only

# 仅品牌重命名
bash scripts/autopipeline/apply-cn-brand.sh --dry-run
bash scripts/autopipeline/apply-cn-brand.sh --stats
```

### CI 自动执行

GitHub Actions 每天 10:00 CST 自动触发，也可在 Actions 页面手动触发。

---

## 十、文件索引

```
scripts/
├── autopipeline/
│   ├── ai-merge-pipeline.sh         # 主编排器（448 行）
│   ├── analyze-upstream-diff.sh     # 结构化数据采集（488 行）
│   ├── ai-analyze-upstream.sh       # AI 深度分析（366 行）
│   ├── agent-resolve-conflicts.sh   # AI 冲突解决（378 行）
│   ├── agent-fix-failures.sh        # AI 故障修复（376 行）
│   ├── apply-cn-brand.sh            # 品牌重命名（332 行）
│   └── REPORT_SCHEMA.md             # 报告格式定义（81 行）
├── merge-upstream.sh                # 手动合并脚本（集成 AI 分析）
├── setup-merge-drivers.sh           # Git merge driver 配置
└── generate-gitattributes-merge.sh  # .gitattributes 生成器

.github/workflows/
└── daily-upstream-sync.yml          # CI 自动化工作流（686 行）

config/
└── cn-protected-files.json          # CN 保护配置（单一数据源）

docs/
└── upstream-reports/                # AI 分析报告持久化目录
```
