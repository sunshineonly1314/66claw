---
name: vikunja-fast
name_zh: Vikunja快速版
description: 通过 Vikunja API 快速管理项目与任务（如逾期/即将到期/今日任务），标记任务为完成，并获取简明摘要。
description_zh: 通过 Vikunja API 快速管理项目与任务（如逾期/即将到期/今日任务），标记任务为完成，并获取简明摘要。
homepage: https://vikunja.io/
metadata: {"clawdbot":{"emoji":"📋","requires":{"bins":["curl","jq"],"env":["VIKUNJA_URL"],"optionalEnv":["VIKUNJA_TOKEN","VIKUNJA_USERNAME","VIKUNJA_PASSWORD"]},"primaryEnv":"VIKUNJA_TOKEN"}}
---
# ✅ Vikunja 快速 Skill

将 Vikunja 作为任务与完成状态的唯一可信源，并通过 Clawdbot 与其交互。

## 初始化设置

您可通过两种方式提供凭据：环境变量，或 Clawdbot 的 skills 配置。

### 方式 A：环境变量（推荐用于本地开发或调试）

请在网关（gateway）所运行的同一环境中设置以下环境变量：

```bash
export VIKUNJA_URL="https://vikunja.xyz"

# Recommended: use a JWT (starts with "eyJ")
export VIKUNJA_TOKEN="<jwt>"

# Alternative: login with username/password (the helper CLI will request a JWT)
export VIKUNJA_USERNAME="<username>"
export VIKUNJA_PASSWORD="<password>"
```

### 方式 B：Clawdbot skills 配置（推荐用于 agent）

编辑 `~/.clawdbot/clawdbot.json`：

```json5
{
  skills: {
    entries: {
      "vikunja-fast": {
        enabled: true,
        env: {
          VIKUNJA_URL: "https://vikunja.xyz",
          VIKUNJA_TOKEN: "<jwt>"
        }
      }
    }
  }
}
```

注意事项：
- `VIKUNJA_URL` 可填写基础 URL；辅助工具会自动规范化为 `/api/v1`。
- Vikunja 认证对大多数 API 调用要求 JWT Bearer Token（`Authorization: Bearer <jwt>`）。
- 若您仅有非 JWT 类型的 token（通常以 `tk_...` 开头），请使用 `/login` 获取 JWT。

## 快速检查

### 登录（获取 JWT）
```bash
curl -fsS -X POST "$VIKUNJA_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_USERNAME","password":"YOUR_PASSWORD","long_token":true}' | jq
```

### 当前身份查询（需 JWT）
```bash
curl -fsS "$VIKUNJA_URL/user" \
  -H "Authorization: Bearer $VIKUNJA_TOKEN" | jq
```

### 列出项目
```bash
curl -fsS "$VIKUNJA_URL/projects" \
  -H "Authorization: Bearer $VIKUNJA_TOKEN" | jq '.[] | {id, title}'
```

## 命令

本 skill 内置一个轻量 CLI 辅助工具：

- `{baseDir}/vikunja.sh`

示例：

```bash
# Overdue across all projects
{baseDir}/vikunja.sh overdue

# Due today
{baseDir}/vikunja.sh due-today

# Arbitrary filter (Vikunja filter syntax)
{baseDir}/vikunja.sh list --filter 'done = false && due_date < now'

# Show / complete a task
{baseDir}/vikunja.sh show 123
{baseDir}/vikunja.sh done 123
```

注意事项：
- 输出格式规范：
  - 每项任务应格式化为：`<EMOJI> <DUE_DATE> - #<ID> <TASK>`
  - Emoji 来源于项目标题开头的 Emoji（如有）；否则使用 `🔨`
  - 截止日期显示为 `Mon/D`（不含具体时间与年份）
- 本 skill 使用 `GET /tasks/all` 从全部项目中拉取任务

## 标记任务为完成

```bash
TASK_ID=123

curl -fsS -X POST "$VIKUNJA_URL/tasks/$TASK_ID" \
  -H "Authorization: Bearer $VIKUNJA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"done": true}' | jq
```