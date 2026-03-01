---
name: servicenow-agent
name_zh: ServiceNow 代理
description: 只读 CLI 接口，支持 ServiceNow 表（Table）、附件（Attachment）、聚合（Aggregate）及服务目录（Service Catalog）API；包含模式（schema）检查与历史记录检索（只读）。
description_zh: 只读 CLI 接口，支持 ServiceNow 表（Table）、附件（Attachment）、聚合（Aggregate）及服务目录（Service Catalog）API；包含模式（schema）检查与历史记录检索（只读）。
read_when:
  - 需要读取 ServiceNow 表（Table）API 记录
  - 需要查询某张表或根据 sys_id 获取单条记录
  - 需要下载附件内容或元数据
  - 需要获取聚合统计信息或服务目录变量
metadata: {"clawdbot":{"emoji":"🧾","requires":{"bins":["node"]}}}
---
# ServiceNow 表（Table）API 只读访问

使用本 skill 通过 Table API 读取 ServiceNow 数据。禁止创建、更新或删除记录。

## 配置

在本文件夹下的 .env 文件中设置以下环境变量：

- SERVICENOW_DOMAIN 实例域名，例如 myinstance.service-now.com  
- SERVICENOW_USERNAME 基本认证用户名  
- SERVICENOW_PASSWORD 基本认证密码  

若您的域名已包含 https://，请直接使用；否则请求应发送至：

```
https://$SERVICENOW_DOMAIN
```

## 允许的操作：仅 GET

仅使用以下文件中的 GET 接口：

- openapi.yaml（Table API）  
- references/attachment.yaml（Attachment API）  
- references/aggregate-api.yaml（Aggregate API）  
- references/service-catalog-api.yaml（Service Catalog API）  

### 列出记录  
- GET /api/now/table/{tableName}  

### 根据 sys_id 获取单条记录  
- GET /api/now/table/{tableName}/{sys_id}  

严禁使用 POST、PUT、PATCH 或 DELETE。

## Table API 常用查询参数

- sysparm_query 已编码的查询条件，例如 active=true^priority=1  
- sysparm_fields 以逗号分隔的需返回字段列表  
- sysparm_limit 限制返回记录数，确保安全（建议设为较小值）  
- sysparm_display_value true、false 或 all  
- sysparm_exclude_reference_link 设为 true 可减少冗余引用链接  

完整参数列表请参阅 openapi.yaml。

## CLI 工具

使用内置 CLI 执行所有只读操作。默认从 .env 加载认证信息，也可通过命令行标志覆盖。

### 命令概览

- list table 列出某张表的记录  
- get table sys_id 根据 sys_id 获取单条记录  
- batch file.json 一次性执行多个只读请求  
- attach 读取附件及其文件内容  
- stats table 获取聚合统计信息  
- schema table 列出有效字段名及对应类型  
- history table sys_id 读取完整的评论（comment）与工作日志（work note）时间线  
- sc endpoint Service Catalog 的 GET 接口  

### 认证相关标志

- --domain domain instance domain  
- --username user  
- --password pass  

### 查询参数标志（均以 --sysparm_* 形式使用）

- --sysparm_query  
- --sysparm_fields  
- --sysparm_limit  
- --sysparm_display_value  
- --sysparm_exclude_reference_link  
- --sysparm_suppress_pagination_header  
- --sysparm_view  
- --sysparm_query_category  
- --sysparm_query_no_domain  
- --sysparm_no_count  

### Attachment API 参数

- --sysparm_query  
- --sysparm_suppress_pagination_header  
- --sysparm_limit  
- --sysparm_query_category  

### Aggregate API 参数

- --sysparm_query  
- --sysparm_avg_fields  
- --sysparm_count  
- --sysparm_min_fields  
- --sysparm_max_fields  
- --sysparm_sum_fields  
- --sysparm_group_by  
- --sysparm_order_by  
- --sysparm_having  
- --sysparm_display_value  
- --sysparm_query_category  

### Service Catalog 参数

- --sysparm_view  
- --sysparm_limit  
- --sysparm_text  
- --sysparm_offset  
- --sysparm_category  
- --sysparm_type  
- --sysparm_catalog  
- --sysparm_top_level_only  
- --record_id  
- --template_id  
- --mode  

### 输出格式

- --pretty pretty print JSON output  
- --out path save binary attachment content to a file  

### 示例

列出最近的事件（incidents）：

```bash
node cli.mjs list incident --sysparm_limit 5 --sysparm_fields number,short_description,priority,sys_id
```  

带过滤条件的查询：

```bash
node cli.mjs list cmdb_ci --sysparm_query "operational_status=1^install_status=1" --sysparm_limit 10
```  

获取单条记录：

```bash
node cli.mjs get incident <sys_id> --sysparm_fields number,short_description,opened_at
```  

动态覆盖认证信息：

```bash
node cli.mjs list incident --domain myinstance.service-now.com --username admin --password "***" --sysparm_limit 3
```  

附件元数据及文件下载：

```bash
node cli.mjs attach list --sysparm_query "table_name=incident" --sysparm_limit 5
node cli.mjs attach file <sys_id> --out /tmp/attachment.bin
```  

聚合统计：

```bash
node cli.mjs stats incident --sysparm_query "active=true^priority=1" --sysparm_count true
```  

Service Catalog 的只读 GET 请求：

```bash
node cli.mjs sc catalogs --sysparm_text "laptop" --sysparm_limit 5
node cli.mjs sc items --sysparm_text "mac" --sysparm_limit 5
node cli.mjs sc item <sys_id>
node cli.mjs sc item-variables <sys_id>
```  

### Service Catalog 仅限 GET 的端点

- cart  
- delivery-address user_id  
- validate-categories  
- on-change-choices entity_id  
- catalogs  
- catalog sys_id  
- catalog-categories sys_id  
- category sys_id  
- items  
- item sys_id  
- item-variables sys_id  
- item-delegation item_sys_id user_sys_id  
- producer-record producer_id record_id  
- record-wizard record_id wizard_id  
- generate-stage-pool quantity  
- step-configs  
- wishlist  
- wishlist-item cart_item_id  
- wizard sys_id  

### 模式（Schema）检查

若您不确定字段名称，请使用此功能。

```bash
node cli.mjs schema incident
```  

### 读取工单（Ticket）历史记录

用于读取完整对话流，而非仅当前状态。

```bash
node cli.mjs history incident <sys_id>
```  

### 专家预设（Specialist presets）

在 specialists/ 目录下创建 JSON 批处理文件，可一次性执行多个只读请求。

- specialists/incidents.json  

每个条目支持 sysparm_* 字段，以及以下字段：

- name 批处理输出中的标签名  
- table 目标表名  
- sys_id （可选）单条记录获取  

运行批处理预设：

```bash
node cli.mjs batch specialists/incidents.json --pretty
```  

## 输出格式

Table API 默认返回 JSON。结果位于 result 字段下。

## 注意事项

- 使用 sysparm_limit 控制返回结果大小。  
- 使用 sysparm_fields 避免接收过大负载。  
- 本 skill 严格设计为只读。

## Agent 工具包功能概览

- list 和 get 展示记录的当前状态。  
- attach 展示文件与截图。  
- stats 展示分析数据与聚合结果。  
- sc 展示所请求项（requested item）的变量。  
- schema 展示数据库映射关系，有助于修正错误。  
- history 展示人工对话的时间线。

## 观察与说明（重要）

- Service Catalog 端点可能因目录内容或搜索关键词而返回空数组——尝试更具体的 `--sysparm_text` 关键词，或增大 `--sysparm_limit` 值。  
- `sysparm_display_value` 默认对表读取启用，以返回对用户友好的值（例如用户名而非 sys_id）。如需原始系统 ID，请传入 `--sysparm_display_value false`。  
- 对于 agent 发起的查询，请将 `--sysparm_limit` 设为较小值，避免大负载和超时。对于计数或聚合操作，请优先使用 `stats`，而非下载大量行数据。  
- 附件：元数据可通过 `attach list`/`attach get` 获取；使用 `attach file <sys_id> --out <path>` 下载二进制内容以供本地分析。  
- 模式检查（`schema`）可避免猜测字段名，是读取未知表前推荐的首要步骤。  
- 历史记录（`history`）从 `sys_journal_field` 获取日志条目（comments/work_notes），有助于读取工单的完整对话线程。  
- 使用 `--pretty` 可使 JSON 输出更易被人阅读，并协助 agent 概括长结果。

## 推荐的批处理预设

我推荐在 `specialists/` 下使用以下 specialist JSON 预设，以加速常见只读工作流。这些预设安全（只读）、保守（限制值设得较小），并演示了如何组合关联的只读操作。

1) `specialists/inspect_incident_schema.json` —— 针对 `incident` 的模式检查：

```json
[
  {
    "name": "schema-incident",
    "table": "sys_dictionary",
    "sysparm_query": "name=incident^elementISNOTEMPTY",
    "sysparm_fields": "element,column_label,internal_type,reference",
    "sysparm_limit": 500
  }
]
```  

2) `specialists/incident_history_template.json` —— 历史记录模板（运行前请将 `<SYS_ID>` 替换为目标 sys_id）：

```json
[
  {
    "name": "incident-history",
    "table": "sys_journal_field",
    "sysparm_query": "name=incident^element_id=<SYS_ID>",
    "sysparm_fields": "value,element,sys_created_on,sys_created_by",
    "sysparm_order_by": "sys_created_on",
    "sysparm_limit": 500
  }
]
```  

3) `specialists/attachments_incident.json` —— incident 表的近期附件：

```json
[
  {
    "name": "recent-incident-attachments",
    "table": "attachment",
    "sysparm_query": "table_name=incident",
    "sysparm_fields": "sys_id,file_name,content_type,table_sys_id,sys_created_on",
    "sysparm_limit": 20
  }
]
```  

使用方法：  
- 模式检查：`node cli.mjs batch specialists/inspect_incident_schema.json --pretty`  
- 历史记录：替换 `<SYS_ID>` 后再 `node cli.mjs batch specialists/incident_history_template.json --pretty`（或直接运行 `node cli.mjs history incident <SYS_ID> --pretty`）  
- 附件：`node cli.mjs batch specialists/attachments_incident.json --pretty`，然后 `node cli.mjs attach file <sys_id> --out /tmp/file` 下载文件  

这些预设均为刻意设计的只读且保守（限制值设得较小）。欢迎随时提出新增预设需求（例如 P1 看板、近期变更、升级记录等）。