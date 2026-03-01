---
name: pr-commit-workflow
name_zh: PR 提交工作流
description: 当创建提交或拉取请求（PR）、强制实施人工撰写的 PR 结构、意图捕获及 agentic 工作流中的证据留存时，应使用本 skills。
description_zh: 当创建提交或拉取请求（PR）、强制实施人工撰写的 PR 结构、意图捕获及 agentic 工作流中的证据留存时，应使用本 skills。
---
# PR 与提交工作流

## 概述
强制实施高信噪比的提交工作流及人工撰写的 PR 格式。以全局流程规则为唯一权威依据，并确保 PR 可供人类与 agent 审阅。

## 工作流决策树
- 若任务仅涉及提交（commits），请遵循 `references/workflow-commit.md`。
- 若任务涉及 PR 创建或 PR 更新，请遵循 `references/workflow-pr.md`。

## 全局规则
- 若仓库中存在 `AGENTS.md` 或 `docs/agents/PROCESS.md`，请先阅读其中定义的仓库特定规则。
- 每个 PR 均须由用户提供人工撰写的意图说明；严禁生成或转述该文本。
- 使用 `/tmp` 撰写 PR 正文初稿，使用 `gh pr edit --body-file` 进行后续更新。

## 提交工作流（入口点）
- 执行 `references/workflow-commit.md` 中所列步骤。
- 采用 `references/commit-format.md` 规定的消息格式。

## PR 工作流（入口点）
- 执行 `references/workflow-pr.md` 中所列步骤。
- 严格按字面使用 `references/pr-human-template.md` 所提供的模板。
- 如可用，使用 `scripts/build_pr_body.sh` 收集环境元数据。

## 资源
- `references/workflow-commit.md`：提交检查清单及证据留存要求。
- `references/workflow-pr.md`：PR 创建/更新流程、评论检查项及证据规则。
- `references/pr-human-template.md`：人工撰写的 PR 结构（必须原样使用）。
- `references/commit-format.md`：提交信息格式及示例。
- `scripts/build_pr_body.sh`：用于 PR 提示词历史记录章节的环境元数据收集器。