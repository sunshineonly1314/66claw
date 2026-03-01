---
name: jira
name_zh: Jira
description: 通过 jira-cli 管理 Jira 问题、看板、冲刺和项目。可直接从命令行搜索、创建、更新及流转问题。
description_zh: 通过 jira-cli 管理 Jira 问题、看板、冲刺和项目。可直接从命令行搜索、创建、更新及流转问题。
homepage: https://github.com/ankitpokhrel/jira-cli
metadata: {"clawdbot":{"emoji":"🎫","requires":{"bins":["jira"]},"install":[{"id":"brew","kind":"brew","formula":"jira-cli","bins":["jira"],"label":"Install jira-cli (brew)"}]}}
---
# jira

使用 `jira` 管理 Jira 问题、冲刺和看板。需预先完成 API token 配置。

## 设置（仅需一次）

1. 生成 API token：https://id.atlassian.com/manage-profile/security/api-tokens  
2. 导出环境变量：`export JIRA_API_TOKEN="your-token"`（建议添加至 ~/.zshrc 以持久生效）  
3. 初始化：`jira init --server https://your-org.atlassian.net --login you@email.com --installation cloud`

## 常用命令

### 问题（Issues）
- 列出问题：`jira issue list -p PROJECT`  
- 查看问题详情：`jira issue view PROJ-123`  
- 创建问题：`jira issue create -p PROJECT -t "Task" -s "Summary" -b "Description"`  
- 编辑问题：`jira issue edit PROJ-123 -s "New summary"`  
- 指派问题：`jira issue assign PROJ-123 "user@email.com"`  
- 流转问题状态：`jira issue move PROJ-123 "In Progress"`  
- 添加评论：`jira issue comment add PROJ-123 "My comment"`  
- 搜索（JQL 查询）：`jira issue list -q "project = MKT AND status = 'To Do'"`  

### 冲刺（Sprints）
- 列出冲刺：`jira sprint list -p PROJECT`  
- 查看当前活跃冲刺：`jira sprint list -p PROJECT --state active`  
- 查看冲刺内所有问题：`jira sprint list -p PROJECT --state active --plain`  

### 看板（Boards）
- 列出看板：`jira board list -p PROJECT`  

### 故事群（Epics）
- 列出故事群：`jira epic list -p PROJECT`  
- 查看故事群详情：`jira epic view PROJ-100`  

### 项目（Projects）
- 列出项目：`jira project list`  

## 输出格式
- `--plain` —— 制表符分隔，无颜色（最适合脚本调用）  
- `--columns key,summary,status` —— 自定义显示列  
- `--no-truncate` —— 不截断长字段  

## 使用技巧
- 在配置中设置默认项目：`~/.config/.jira/.config.yml`  
- 使用 JQL 实现复杂查询：`-q "assignee = currentUser() AND status != Done"`  
- 在浏览器中打开：`jira open PROJ-123`  

## 注意事项
- 创建/编辑/流转问题前，须获得用户确认  
- 执行批量操作前，应先展示将要变更的内容  