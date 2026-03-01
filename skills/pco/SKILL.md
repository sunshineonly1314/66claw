---
name: pco
description: Planning Center Services API 的命令行接口（CLI）。专为 Shadow 的教会事工（FBC Gulfport）开发。
description_zh: Planning Center Services API 的命令行接口（CLI）。专为 Shadow 的教会事工（FBC Gulfport）开发。
---
# PCO CLI — Planning Center Services

Planning Center Services API 的命令行接口（CLI）。专为 Shadow 的教会事工（FBC Gulfport）开发。

## 代码仓库

https://github.com/rubysworld/pco-cli

## 安装位置

```
/Users/ruby/Projects/pco-cli/pco.ts
```

## 运行方式

```bash
tsx /Users/ruby/Projects/pco-cli/pco.ts <command>
```

或创建别名：
```bash
alias pco="tsx /Users/ruby/Projects/pco-cli/pco.ts"
```

## 认证方式

凭据保存在 `~/.config/pco-cli/config.json` 中。

```bash
# Check auth status
pco auth status

# Setup (interactive)
pco auth setup

# Logout
pco auth logout
```

## 全局选项

所有列表类命令均支持以下选项：
- `--json` —— 以 JSON 格式输出（默认）  
- `--table` —— 以表格格式输出  
- `--quiet` —— 仅输出 ID  
- `--limit <n>` —— 限制返回结果数量（默认：25）  
- `--offset <n>` —— 偏移结果（分页跳过）  
- `--all` —— 获取全部分页数据  

## 命令

### 组织（Organization）
```bash
pco org get                    # Get org info
```

### 服事类型（Service Types）
```bash
pco service-types list         # List all service types
pco st list                    # Alias
pco service-types get <id>     # Get specific service type
```

### 计划（Plans）
```bash
# List plans (service-type required)
pco plans list --service-type <id>
pco plans list --service-type <id> --filter future
pco plans list --service-type <id> --filter past

# Get specific plan
pco plans get <planId> --service-type <id>
pco plans get <planId> --service-type <id> --include items,team_members
```

筛选器：`future`、`past`、`after`、`before`、`no_dates`

### 计划条目（Plan Items）
```bash
pco items list --service-type <id> --plan <planId>
pco items get <itemId> --service-type <id> --plan <planId>
```

### 已排班人员（团队成员）（Scheduled People (Team Members)）
```bash
pco scheduled list --service-type <id> --plan <planId>
```

### 人员（People）
```bash
pco people list
pco people list --search "John Doe"
pco people get <id>
```

### 团队（Teams）
```bash
pco teams list --service-type <id>
pco teams get <teamId> --service-type <id>
```

### 歌曲（Songs）
```bash
pco songs list
pco songs list --search "Amazing Grace"
pco songs get <id>
pco songs arrangements <songId>
```

### 媒体（Media）
```bash
pco media list
pco media get <id>
```

### 文件夹（Folders）
```bash
pco folders list
pco folders get <id>
```

### 系列（Series）
```bash
pco series list
pco series get <id>
```

### 标签组（Tag Groups）
```bash
pco tag-groups list
pco tag-groups tags <groupId>
```

### 邮件模板（Email Templates）
```bash
pco email-templates list
```

### 附件类型（Attachment Types）
```bash
pco attachment-types list
```

### 报表模板（Report Templates）
```bash
pco report-templates list
```

### 原始 API（Raw API）
```bash
# Direct API access
pco api GET /service_types
pco api POST /endpoint --data '{"key": "value"}'
pco api PATCH /endpoint --file data.json
pco api DELETE /endpoint
```

## 常见工作流

### 获取本周日的礼拜计划
```bash
# 1. Find service type ID
pco st list --table

# 2. Get future plans
pco plans list --service-type <id> --filter future --limit 1

# 3. Get plan details with includes
pco plans get <planId> --service-type <id> --include items,team_members
```

### 本周有哪些人已排班？
```bash
pco scheduled list --service-type <id> --plan <planId> --table
```

### 搜索某首诗歌
```bash
pco songs list --search "Great Are You Lord"
```

## 注意事项

- 此工具仅适用于 **PCO Services**（不适用于 People、Giving 等其他模块）  
- API 文档：https://developer.planning.center/docs/#/apps/services  
- 使用背景：仅限教会事工 —— 请勿与 Buape 相关事务混用  

---

*最后更新：2026-01-08*