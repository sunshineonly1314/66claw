# TODO-12: 每日上游合并自动化 Agent

> **优先级**: P0 (核心基础设施)
> **状态**: 待实施
> **创建日期**: 2026-02-15
> **预计周期**: 3 周渐进式交付

---

## 一、当前代码实况 vs 原方案假设

| 维度 | 原方案假设 | 代码实况 |
|------|-----------|---------|
| **合并自动化** | 有 sync-agent、merge-agent 等 | **零自动化**。只有手动脚本 `scripts/merge-upstream-files.sh` |
| **CN 文件保护** | 有 `cn-protected-files.json` | **没有机器可读的保护配置**。只有 `CN_CUSTOMIZATIONS.md` Markdown 文档 |
| **Git Merge Driver** | `.gitattributes` 有 merge 规则 | **没有**。`.gitattributes` 只有二进制文件和换行符规则 |
| **CI CN 验证** | CI 包含 CN 区域测试 | **没有**。`ci.yml` 只有标准 lint/test/build，无 CN 特定 job |
| **通知机制** | 飞书/钉钉 webhook CI 集成 | **没有 CI 通知**。飞书/钉钉代码是消息渠道功能，非 CI 通知 |
| **版本管理** | 有自动化版本同步 | **完全手动**。版本分散在 8+ 文件，无自动同步 |
| **独立 CI 仓库** | 设计了 `openclawcn-ci` 仓库 | **不存在**。所有 workflow 在主仓库 `.github/workflows/` |
| **上游 remote** | 需要配置 | **已配置** `upstream -> github.com/openclaw/openclaw.git` |

### 现有合并脚本分析 (`scripts/merge-upstream-files.sh`)

**能力**:
- 从 stdin 读取文件列表，逐个从 upstream/main 拉取
- 用正则 `china|wechat|xiaohongshu|openclawcnCN|OpenClawCN|tauri` 检测 CN 代码
- 干净文件: 替换为上游版本 + 品牌名替换 (OpenClawConfig -> OpenClawCNConfig)
- CN 文件: 跳过，输出手动处理清单

**缺陷**:
- 需要手动提供文件列表
- 基于正则的 CN 检测，无法理解语义
- 没有冲突预测/自动解决
- 没有回滚机制
- 没有 post-merge 测试验证
- 没有结构化报告输出

---

## 二、优化目标

| 编号 | 目标 | 衡量标准 |
|------|------|---------|
| G1 | 自动化率达到 90% | 无冲突情况下 0 人工介入完成每日合并 |
| G2 | 冲突检测前置 | 在合并前预测冲突，而非合并时发现 |
| G3 | CN 定制文件 100% 保护 | 145+ 文件永不被上游覆盖，工具级强制 |
| G4 | 合并后 CI 自动验证 | 包含 CN 区域测试、品牌一致性、API 端点验证 |
| G5 | 5 分钟内通知 | 合并结果推送到飞书 |
| G6 | 1 分钟内回滚 | 合并出问题时一键恢复 |

---

## 三、4 层渐进式实施方案

### 第 1 层：Git 原生保护（Week 0，Day 1 可交付）

#### 交付物 1：改造 `.gitattributes`

在现有 `.gitattributes` 末尾追加 CN merge driver 规则：

```gitattributes
# ============================================================
# CN Merge Protection (from CN_CUSTOMIZATIONS.md)
# When merging upstream/main, these files keep the CN version.
# ============================================================

# --- Section I: CN-Only Files (always keep ours) ---
# 1.1 Core config
src/config/region-cn.ts merge=ours
src/config/cn-mirrors.ts merge=ours
src/config/zod-schema.providers-cn.ts merge=ours
src/config/defaults-cn.test.ts merge=ours
src/config/region-cn.test.ts merge=ours
# 1.2 CN auth
src/commands/auth-choice.apply.cn-providers.ts merge=ours
# 1.3 CN models
src/agents/siliconflow-models.ts merge=ours
# 1.4 WeChat tools
src/agents/tools/wechat-send.ts merge=ours
src/agents/tools/wechat-check.ts merge=ours
# 1.5 Dispatch system
src/dispatch/** merge=ours
dispatch.yaml merge=ours
# 1.6 DingTalk
src/dingtalk-moltbot-connector-main/** merge=ours
# 1.7 CN channel extensions
extensions/feishu/** merge=ours
extensions/dingtalk/** merge=ours
extensions/wecom/** merge=ours
extensions/qqbot/** merge=ours
# 1.8 CN UI views
ui/src/ui/views/channels.feishu.ts merge=ours
ui/src/ui/views/channels.dingtalk.ts merge=ours
ui/src/ui/views/channels.wecom.ts merge=ours
# 1.9 CN docs
docs/china-localization.md merge=ours
docs/channels/china-quickstart.md merge=ours
docs/channels/feishu.md merge=ours
docs/channels/dingtalk.md merge=ours
docs/channels/wecom.md merge=ours
docs/channels/qqbot.md merge=ours
docs/skills-china-mirrors.md merge=ours
docs/cn-defaults-requirements.md merge=ours
docs/macos-cn-packaging-plan.md merge=ours
docs/macos-cn-packaging-final.md merge=ours
# 1.10 CN config example
config.china.example.json5 merge=ours
# 1.11 Build & deploy
build/scripts/build-macos-cn.sh merge=ours
build/templates/macos/clawbotcn.template merge=ours
scripts/install-mac-cn.sh merge=ours
scripts/install-macos-cn.sh merge=ours
scripts/linux/install-china.sh merge=ours
scripts/fix-tags-cn.mjs merge=ours
scripts/translate-clawdhub-skills-cn.mjs merge=ours
scripts/translate-docs-cn.mjs merge=ours
.github/workflows/build-macos-cn.yml merge=ours
# 1.12 Tauri desktop
apps/desktop/** merge=ours
scripts/desktop/** merge=ours
DESKTOP_INSTALLATION.md merge=ours
# 1.13 Voice/ASR
src/agents/tools/asr-tool.ts merge=ours
src/agents/tools/tts-tool.ts merge=ours
src/gateway/server-methods/asr.ts merge=ours
src/gateway/server-methods/tts.ts merge=ours
src/gateway/server-methods/voicewake.ts merge=ours
src/infra/voicewake.ts merge=ours
# 1.14 Native plugins
native/** merge=ours
# 1.15 i18n
src/i18n/locales/zh-CN.ts merge=ours
ui/src/ui/i18n/locales/zh-CN.ts merge=ours
ui/src/docscn/** merge=ours
# 1.16 Dev temp
devTemp/** merge=ours
skillsqingqi/** merge=ours
# 1.17 Project docs
ITERATION.md merge=ours
upstream_changelog.md merge=ours
CN_CUSTOMIZATIONS.md merge=ours
```

#### 交付物 2：`scripts/setup-merge-drivers.sh`

```bash
#!/usr/bin/env bash
# Setup custom Git merge drivers for CN file protection
# Run once per clone: bash scripts/setup-merge-drivers.sh
set -euo pipefail

git config merge.ours.name "Always keep CN version"
git config merge.ours.driver true

echo "Merge drivers configured."
```

#### 交付物 3：升级版 `scripts/merge-upstream.sh`

完整合并工作流脚本，包含：
- 自动检测上游变更数量
- Section II 文件影响分析
- `--dry-run` 模式预览
- 合并后自动运行 `pnpm lint && pnpm build && pnpm test`
- CN 关键文件完整性检查
- 结构化摘要输出

```bash
#!/usr/bin/env bash
# Full upstream merge workflow
# Usage: bash scripts/merge-upstream.sh [--dry-run]
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

DATE=$(date +%Y-%m-%d)
BRANCH="merge/upstream-${DATE}"
UPSTREAM_REF="upstream/main"

# --- Step 1: Prerequisites ---
echo "=== Step 1: Prerequisites ==="
git remote get-url upstream >/dev/null 2>&1 || {
  echo "ERROR: upstream remote not configured"
  echo "Run: git remote add upstream https://github.com/openclaw/openclaw.git"
  exit 1
}

git config merge.ours.driver >/dev/null 2>&1 || {
  echo "Setting up merge drivers..."
  bash scripts/setup-merge-drivers.sh
}

# --- Step 2: Fetch & detect ---
echo "=== Step 2: Fetch upstream ==="
git fetch upstream main
LAST_MERGE=$(git merge-base HEAD upstream/main)
COMMIT_COUNT=$(git rev-list --count "${LAST_MERGE}..upstream/main")

if [ "$COMMIT_COUNT" -eq 0 ]; then
  echo "No new upstream commits. Nothing to do."
  exit 0
fi
echo "Found ${COMMIT_COUNT} new upstream commits."

# --- Step 3: Impact analysis ---
echo "=== Step 3: Impact analysis ==="
echo ""
echo "Changed files in upstream:"
git diff --stat "${LAST_MERGE}..upstream/main" | tail -30
echo ""

CN_SECTION2_FILES=(
  "src/config/defaults.ts"
  "src/config/auto-detect-env.ts"
  "src/agents/models-config.ts"
  "src/agents/models-config.providers.ts"
  "package.json"
  "AGENTS.md"
  "CHANGELOG.md"
  "src/auto-reply/reply/get-reply.ts"
  "src/agents/model-fallback.ts"
)

echo "--- CN Section II (manual merge) impact ---"
SECTION2_AFFECTED=0
for f in "${CN_SECTION2_FILES[@]}"; do
  if git diff --name-only "${LAST_MERGE}..upstream/main" | grep -q "^${f}$"; then
    echo "  AFFECTED: ${f}"
    SECTION2_AFFECTED=$((SECTION2_AFFECTED + 1))
  fi
done
echo "Total Section II files affected: ${SECTION2_AFFECTED}"

if $DRY_RUN; then
  echo ""
  echo "[DRY RUN] Would create branch ${BRANCH} and merge upstream/main"
  echo "[DRY RUN] ${COMMIT_COUNT} commits, ${SECTION2_AFFECTED} Section II conflicts expected"
  exit 0
fi

# --- Step 4: Create branch and merge ---
echo "=== Step 4: Merge ==="
git checkout -b "${BRANCH}"
git merge upstream/main --no-edit \
  -m "chore: merge upstream ${DATE} (${COMMIT_COUNT} commits)" || {
  echo ""
  echo "=== MERGE CONFLICTS ==="
  echo "Conflicting files:"
  git diff --name-only --diff-filter=U
  echo ""
  echo "Section I files should be auto-resolved by .gitattributes merge=ours."
  echo "Section II files need manual resolution. After resolving:"
  echo "  git add <resolved-files>"
  echo "  git merge --continue"
  exit 1
}

# --- Step 5: Validation ---
echo "=== Step 5: Validation ==="
pnpm lint || { echo "LINT FAILED"; exit 1; }
pnpm build || { echo "BUILD FAILED"; exit 1; }
pnpm test || { echo "TEST FAILED"; exit 1; }

# --- Step 6: CN integrity ---
echo "=== Step 6: CN integrity ==="
CN_CRITICAL=(
  "src/config/region-cn.ts"
  "src/config/cn-mirrors.ts"
  "src/dispatch/engine.ts"
  "extensions/feishu/package.json"
  "extensions/dingtalk/package.json"
)
MISSING=0
for f in "${CN_CRITICAL[@]}"; do
  [ -f "$f" ] || { echo "MISSING: $f"; MISSING=$((MISSING + 1)); }
done
[ "$MISSING" -gt 0 ] && { echo "ERROR: ${MISSING} critical CN files missing!"; exit 1; }
echo "All CN critical files present."

# --- Step 7: Summary ---
echo ""
echo "=== MERGE COMPLETE ==="
echo "Branch: ${BRANCH}"
echo "Upstream commits: ${COMMIT_COUNT}"
echo "Section II conflicts: ${SECTION2_AFFECTED}"
echo ""
echo "Next steps:"
echo "  1. git diff main..${BRANCH}"
echo "  2. Update upstream_changelog.md"
echo "  3. Update CN_CUSTOMIZATIONS.md date"
echo "  4. git push origin ${BRANCH}"
echo "  5. Create PR on GitHub"
```

---

### 第 2 层：GitHub Actions 自动化（Week 1）

#### 交付物：`.github/workflows/daily-upstream-sync.yml`

**4 个 Job 架构**（替代原方案的 3-Phase 10-Step）：

```
Job 1: detect     -> 检测上游变更，输出 commit_count、diff_stat、section2 影响
Job 2: merge      -> 配置 merge driver，尝试自动合并，推送分支
Job 3: validate   -> 在合并分支上运行完整 CI + CN 完整性检查
Job 4: report     -> 成功->创建 PR + 飞书通知 | 失败->创建 Issue + 飞书告警
```

**Cron 触发**: `0 2 * * *` (UTC 02:00 = CST 10:00)
**手动触发**: `workflow_dispatch` with `force` boolean input

**关键设计决策**：

| 原方案 | 新方案 | 原因 |
|--------|--------|------|
| 3 Phase, 10 Step | 4 个 GitHub Actions Job | `needs` 依赖就是编排引擎 |
| 独立 `openclawcn-ci` 仓库 | 放主仓库 `.github/workflows/` | 减少仓库同步开销 |
| Claude Code CLI 每日分析 | 脚本分析 + PR 人工 review | 常规合并是确定性操作 |
| 自建 merge-report.json 通信 | GitHub Actions outputs | 原生 Job 间通信 |
| SQLite 状态追踪 | GitHub Issues + PR labels | 天然持久化 + 搜索 + 通知 |

**所需 GitHub Secrets**：
- `SYNC_TOKEN`: 具有 `contents:write` + `pull-requests:write` 权限的 PAT
- `FEISHU_WEBHOOK`（可选）: 飞书机器人 Webhook URL

---

### 第 3 层：CI CN 验证增强（Week 1）

#### 交付物：在 `ci.yml` 追加 `cn-validation` job

验证内容：
1. **CN 文件完整性** - 11 个关键文件必须存在
2. **品牌一致性** - CN 文件中不能出现 `OpenClawConfig`（应为 `OpenClawCNConfig`）
3. **API 端点检查** - 5 个国产 AI 端点必须存在于代码中
4. **CN 区域测试** - `pnpm test -- --grep "cn|china|region"`

---

### 第 4 层：机器可读保护配置（Week 2）

#### 交付物 1：`config/cn-protected-files.json`

将 `CN_CUSTOMIZATIONS.md` 中的保护清单转为 JSON，包含：
- `section1_cn_only`: 文件列表 + 目录列表，策略 = `ours`
- `section2_modified_upstream`: 文件列表 + CN 注入点说明，策略 = `manual`
- `cn_api_endpoints`: 7 个必须存在的端点
- `cn_env_vars`: 必须保留的环境变量

#### 交付物 2：`scripts/generate-gitattributes-merge.sh`

从 `cn-protected-files.json` 自动生成 `.gitattributes` 中的 merge 规则。

---

## 四、被砍掉的原方案组件

| 原方案组件 | 处理 | 原因 |
|-----------|------|------|
| 独立 `openclawcn-ci` 仓库 | 砍掉 | 增加仓库同步复杂度 |
| 4 个自定义 Agent | 砍掉 | GitHub Actions 4 个 Job 等价 |
| Claude Code CLI 每日分析 | 降级为按需 | AI 在有冲突时按需调用 |
| SQLite 状态追踪 | 替换为 GitHub Issues | 天然持久化 |
| 增量 patch 国内分发 | 推迟 | 早期不需要 |
| NPM Mirror 发布 | 推迟 | 先稳定主流程 |
| merge-strategy.json + mirrors.json | 合并为 cn-protected-files.json | 减少配置文件 |
| Review 报告模板 + Changelog 模板 | PR body 模板替代 | PR description 就是 review 报告 |

---

## 五、实施路线图

```
Week 0 (Day 1)
  [ ] .gitattributes 添加 merge=ours 规则
  [ ] scripts/setup-merge-drivers.sh
  [ ] scripts/merge-upstream.sh (升级版)

Week 1
  [ ] .github/workflows/daily-upstream-sync.yml
  [ ] ci.yml 增加 cn-validation job
  [ ] GitHub Secrets 配置 (SYNC_TOKEN, FEISHU_WEBHOOK)
  [ ] 首次手动触发验证

Week 2
  [ ] config/cn-protected-files.json
  [ ] scripts/generate-gitattributes-merge.sh
  [ ] 合并脚本改为读取 JSON 配置

Week 3+
  [ ] 观察运行情况，调优 cron 时间
  [ ] 根据冲突频率决定是否引入 Claude Code CLI 做 AI 辅助
  [ ] 根据用户量决定是否启动国内分发
```

---

## 六、参考资料

- **Brave Browser Chromium Rebase**: 补丁系统，不用传统 fork merge
- **Claude Code Subagent Model**: 独立 200k context，最多 10 并发，不能嵌套
- **GitHub Actions Fork Sync**: `peter-evans/create-pull-request`, `aormsby/Fork-Sync-With-Upstream-action`
- **Git Custom Merge Driver**: `.gitattributes` + `git config merge.ours.driver true`
- **release-please**: Google 出品的基于 Conventional Commits 的版本管理
