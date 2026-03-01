---
name: fizzy-cli
name_zh: Fizzy CLI
description: 使用 fizzy-cli 工具进行身份认证，并通过命令行管理 Fizzy 看板、卡片、评论、标签、列、用户及通知。当需要列出、创建、更新或删除 Fizzy 资源，或编写 Fizzy 自动化脚本时，请启用本 skill。
description_zh: 使用 fizzy-cli 工具进行身份认证，并通过命令行管理 Fizzy 看板、卡片、评论、标签、列、用户及通知。当需要列出、创建、更新或删除 Fizzy 资源，或编写 Fizzy 自动化脚本时，请启用本 skill。
metadata:
  author: tobiasbischoff
  version: "1.0"
---
# Fizzy CLI Skill

使用本 skill 通过 `fizzy-cli` 命令操作 Fizzy 看板。涵盖身份认证、配置及常见 CRUD 工作流。

## 快速入门（Quick Start）

1) 身份认证  
- Token 方式：  
  - `fizzy-cli auth login --token $FIZZY_TOKEN`  
- 魔法链接（Magic link）方式：  
  - `fizzy-cli auth login --email user@example.com`  
  - 若为非交互式环境，请传入 `--code ABC123` 参数。

2) 设置默认值  
- 仅设置账户：`fizzy-cli account set 897362094`  
- 持久化保存基础 URL + 账户：`fizzy-cli config set --base-url https://app.fizzy.do --account 897362094`  

3) 验证访问权限  
- `fizzy-cli auth status`  
- `fizzy-cli account list`  

## 常见任务（Common Tasks）

### 看板（Boards）  
- 列出：`fizzy-cli board list`  
- 创建：`fizzy-cli board create --name "Roadmap"`  
- 更新：`fizzy-cli board update <board-id> --name "New name"`  
- 删除：`fizzy-cli board delete <board-id>`  

### 卡片（Cards）  
- 列出某看板上的卡片：  
  - `fizzy-cli card list --board-id <board-id>`  
- 创建卡片：  
  - `fizzy-cli card create --board-id <board-id> --title "Add dark mode" --description "Switch theme"`  
- 上传图片：  
  - `fizzy-cli card create --board-id <board-id> --title "Add hero" --image ./hero.png`  
- 更新卡片：  
  - `fizzy-cli card update <card-number> --title "Updated" --tag-id <tag-id>`  
- 移至“暂不处理”（Not Now）：  
  - `fizzy-cli card not-now <card-number>`  
- 关闭 / 重新打开：  
  - `fizzy-cli card close <card-number>`  
  - `fizzy-cli card reopen <card-number>`  
- 分类（Triage）/ 取消分类：  
  - `fizzy-cli card triage <card-number> --column-id <column-id>`  
  - `fizzy-cli card untriage <card-number>`  

### 评论（Comments）  
- 列出评论：  
  - `fizzy-cli comment list <card-number>`  
- 创建评论：  
  - `fizzy-cli comment create <card-number> --body "Looks good"`  

### 标签、列、用户、通知（Tags, Columns, Users, Notifications）  
- 标签：`fizzy-cli tag list`  
- 列：`fizzy-cli column list --board-id <board-id>`  
- 用户：`fizzy-cli user list`  
- 通知：`fizzy-cli notification list --unread`  

## 输出模式（Output Modes）  
- 默认：人类可读的表格形式。  
- 机器可读输出：  
  - `--json` 输出原始 API JSON。  
  - `--plain` 输出稳定、按行分隔的格式。  

## 配置与认证说明（Config & Auth Notes）  
- 配置文件：`~/.config/fizzy/config.json`。  
- 环境变量：`FIZZY_BASE_URL`、`FIZZY_TOKEN`、`FIZZY_ACCOUNT`、`FIZZY_CONFIG`。  
- 优先级顺序：命令行标志 > 环境变量 > 配置文件 > 默认值。  

## 故障排查（Troubleshooting）  
- 若请求因认证失败而报错，请运行 `fizzy-cli auth status` 并重新登录。  
- 若缺少账户信息，请通过 `fizzy-cli account set <slug>` 或 `fizzy-cli config set --account <slug>` 设置。  
- 使用 `fizzy-cli --help` 或 `fizzy-cli help <command>` 查看完整帮助信息。  