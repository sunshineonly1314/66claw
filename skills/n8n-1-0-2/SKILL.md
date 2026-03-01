---
name: n8n-1-0-2
name_zh: n8n 1.0.2
description: 通过 API 管理 n8n 工作流与自动化任务。适用于处理 n8n 工作流、执行实例或自动化任务的场景——例如：列举工作流、启用/停用工作流、检查执行状态、手动触发工作流，或调试自动化问题。
description_zh: 通过 API 管理 n8n 工作流与自动化任务。适用于处理 n8n 工作流、执行实例或自动化任务的场景——例如：列举工作流、启用/停用工作流、检查执行状态、手动触发工作流，或调试自动化问题。
---
# n8n 工作流管理

通过 REST API 与 n8n 自动化平台交互。

## 设置

**首次设置：**

1. 安装依赖项（推荐使用虚拟环境）：

```bash
cd skills/n8n-1.0.2
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. 在 `~/.zshrc`（或 `~/.bashrc`）中配置环境变量：

```bash
export N8N_API_KEY="your-api-key-here"
export N8N_BASE_URL="https://your-n8n-instance.com"
```

3. 重新加载 shell 并验证连接：

```bash
source ~/.zshrc
./skills/n8n-1.0.2/scripts/n8n.sh list-workflows --pretty
```

> **Tip**: Get your API key from n8n UI: Settings → API

## 快速参考

### 列举工作流

```bash
./scripts/n8n.sh list-workflows --pretty
./scripts/n8n.sh list-workflows --active true --pretty
```

### 获取工作流详情

```bash
./scripts/n8n.sh get-workflow --id <workflow-id> --pretty
```

### 启用/停用工作流

```bash
./scripts/n8n.sh activate --id <workflow-id>
./scripts/n8n.sh deactivate --id <workflow-id>
```

### 执行实例

```bash
# List recent executions
./scripts/n8n.sh list-executions --limit 10 --pretty

# Get execution details
./scripts/n8n.sh get-execution --id <execution-id> --pretty

# Filter by workflow
./scripts/n8n.sh list-executions --id <workflow-id> --limit 20 --pretty
```

### 手动执行

```bash
# Trigger workflow
./scripts/n8n.sh execute --id <workflow-id>

# With data
./scripts/n8n.sh execute --id <workflow-id> --data '{"key": "value"}'
```

## Python API

用于程序化访问：

```python
from scripts.n8n_api import N8nClient

client = N8nClient()

# List workflows
workflows = client.list_workflows(active=True)

# Get workflow
workflow = client.get_workflow('workflow-id')

# Activate/deactivate
client.activate_workflow('workflow-id')
client.deactivate_workflow('workflow-id')

# Executions
executions = client.list_executions(workflow_id='workflow-id', limit=10)
execution = client.get_execution('execution-id')

# Execute workflow
result = client.execute_workflow('workflow-id', data={'key': 'value'})
```

## 常见任务

### 调试失败的工作流

1. 列出最近发生失败的执行实例  
2. 获取执行详情以查看错误信息  
3. 检查工作流配置  
4. 如有必要，停用该工作流  

### 监控工作流健康状况

1. 列出所有启用中的工作流  
2. 检查最近执行的状态  
3. 审查错误模式  

### 工作流管理

1. 列出全部工作流  
2. 查看各工作流的启用/停用状态  
3. 根据需要启用或停用工作流  
4. 删除过期工作流  

## API 参考文档

详细 API 文档请参阅 [references/api.md](references/api.md)。

## 故障排除

**认证错误：**

- 验证 N8N_API_KEY 是否已设置：`echo $N8N_API_KEY`  
- 在 n8n UI 中确认 API 密钥是否有效  

**连接错误：**

- 若使用自定义 URL，请检查 N8N_BASE_URL  

**命令错误：**

- 使用 `--pretty` 标志获取可读性更强的输出  
- 在必要时确保已提供 `--id`  
- 验证 `--data` 参数的 JSON 格式是否正确  