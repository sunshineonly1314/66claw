---
name: glab
name_zh: GitLab CLI
description: 使用 `glab` CLI 与 GitLab 交互。当 Claude 需要操作 GitLab 合并请求（MR）、CI/CD 流水线、议题（issues）、发布（releases）或发起 API 请求时使用。支持 gitlab.com 及自托管实例。
description_zh: 使用 `glab` CLI 与 GitLab 交互。当 Claude 需要操作 GitLab 合并请求（MR）、CI/CD 流水线、议题（issues）、发布（releases）或发起 API 请求时使用。支持 gitlab.com 及自托管实例。
---
# GitLab Skill

使用 `glab` CLI 与 GitLab 交互。若当前不在 Git 仓库目录中，请显式指定 `--repo owner/repo` 或 `--repo group/namespace/repo`。也支持传入完整 URL。

## 合并请求（MR）

列出待审核的合并请求：

```bash
glab mr list --repo owner/repo
```

查看 MR 详情：

```bash
glab mr view 55 --repo owner/repo
```

基于当前分支创建 MR：

```bash
glab mr create --fill --target-branch main
```

批准、合并或检出 MR：

```bash
glab mr approve 55
glab mr merge 55
glab mr checkout 55
```

查看 MR 差异（diff）：

```bash
glab mr diff 55
```

## CI/CD 流水线

检查当前分支的流水线状态：

```bash
glab ci status
```

交互式查看流水线（导航作业、查看日志）：

```bash
glab ci view
```

列出近期流水线：

```bash
glab ci list --repo owner/repo
```

实时追踪作业日志：

```bash
glab ci trace
glab ci trace 224356863  # specific job ID
glab ci trace lint       # by job name
```

重试失败的流水线：

```bash
glab ci retry
```

验证 `.gitlab-ci.yml`：

```bash
glab ci lint
```

## 议题（Issues）

列出并查看议题：

```bash
glab issue list --repo owner/repo
glab issue view 42
```

创建议题：

```bash
glab issue create --title "Bug report" --label bug
```

添加评论：

```bash
glab issue note 42 -m "This is fixed in !55"
```

## 高级查询：API 接口

对子命令未覆盖的端点，请使用 `glab api`。支持 REST 与 GraphQL。

获取项目发布版本：

```bash
glab api projects/:fullpath/releases
```

获取指定字段的 MR（可配合 jq 管道处理）：

```bash
glab api projects/owner/repo/merge_requests/55 | jq '.title, .state, .author.username'
```

分页遍历全部议题：

```bash
glab api issues --paginate
```

GraphQL 查询：

```bash
glab api graphql -f query='
  query {
    currentUser { username }
  }
'
```

## JSON 输出

可管道传递至 `jq` 进行筛选：

```bash
glab mr list --repo owner/repo | jq -r '.[] | "\(.iid): \(.title)"'
```

## 变量与发布（Variables and Releases）

管理 CI/CD 变量：

```bash
glab variable list
glab variable set MY_VAR "value"
glab variable get MY_VAR
```

创建发布版本：

```bash
glab release create v1.0.0 --notes "Release notes here"
```

## 与 GitHub CLI 的关键差异

| 概念                     | GitHub（`gh`） | GitLab（`glab`）                        |
| ------------------------ | ------------- | -------------------------------------- |
| 拉取/合并请求（PR/MR）   | `gh pr`       | `glab mr`                              |
| CI 执行                  | `gh run`      | `glab ci`                              |
| 仓库路径格式             | `owner/repo`  | `owner/repo` 或 `group/namespace/repo` |
| 交互式流水线视图         | 不支持          | `glab ci view`                         |