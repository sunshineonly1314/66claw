---
name: Azure CLI
name_zh: Azure CLI
description: 通过命令行界面全面管理 Azure 云平台
description_zh: 通过命令行界面全面管理 Azure 云平台
license: MIT
metadata:
  author: Dennis de Vaal <d.devaal@gmail.com>
  version: "1.0.0"
  keywords: "azure,cloud,infrastructure,devops,iac,management,scripting"
repository: https://github.com/Azure/azure-cli
compatibility:
  - platform: macOS
    min_version: "10.12"
  - platform: Linux
    min_version: "Ubuntu 18.04"
  - platform: Windows
    min_version: "Windows 10"
---
# Azure CLI 技能

**掌握 Azure 命令行接口，用于云基础设施管理、自动化及 DevOps 工作流。**

Azure CLI 是微软推出的强大跨平台命令行工具，用于管理 Azure 资源。本技能涵盖 Azure CLI 命令、身份验证、资源管理及自动化模式的全面知识。

## 您将学到的内容

### 核心概念
- Azure 订阅与资源组架构
- 身份验证方法与凭据管理
- 资源提供程序的组织结构与注册
- 全局参数、输出格式化与查询语法
- 自动化脚本编写与错误处理

### 主要服务领域（共 66 个命令模块）
- **计算（Compute）：** 虚拟机、规模集、Kubernetes（AKS）、容器
- **网络（Networking）：** 虚拟网络、负载均衡器、CDN、流量管理器
- **存储与数据（Storage & Data）：** 存储账户、Data Lake、Cosmos DB、数据库
- **应用服务（Application Services）：** 应用服务（App Service）、函数（Functions）、容器应用（Container Apps）
- **数据库（Databases）：** SQL Server、MySQL、PostgreSQL、CosmosDB
- **集成与消息传递（Integration & Messaging）：** 事件中心（Event Hubs）、服务总线（Service Bus）、逻辑应用（Logic Apps）
- **监控与管理（Monitoring & Management）：** Azure Monitor、策略（Policy）、基于角色的访问控制（RBAC）、成本管理（Cost Management）
- **人工智能与机器学习（AI & Machine Learning）：** 认知服务（Cognitive Services）、机器学习（Machine Learning）
- **DevOps：** Azure DevOps、流水线（Pipelines）、扩展（Extensions）

## 快速入门

### 安装

**macOS：**
```bash
brew install azure-cli
```

**Linux（Ubuntu/Debian）：**
```bash
curl -sL https://aka.ms/InstallAzureCliLinux | bash
```

**Windows：**
```powershell
choco install azure-cli
# Or download MSI from https://aka.ms/InstallAzureCliWindowsMSI
```

**验证安装：**
```bash
az --version          # Show version
az --help             # Show general help
```

### 初步操作

```bash
# 1. Login to Azure (opens browser for authentication)
az login

# 2. View your subscriptions
az account list

# 3. Set default subscription (optional)
az account set --subscription "My Subscription"

# 4. Create a resource group
az group create -g myResourceGroup -l eastus

# 5. List your resource groups
az group list
```

## 核心命令

### 身份验证与账户管理

```bash
az login                                    # Interactive login
az login --service-principal -u APP_ID -p PASSWORD -t TENANT_ID
az login --identity                         # Managed identity
az logout                                   # Sign out
az account show                             # Current account
az account list                             # All accounts
az account set --subscription SUBSCRIPTION  # Set default
```

### 全局标志（可与任意命令配合使用）

```bash
--subscription ID       # Target subscription
--resource-group -g RG  # Target resource group
--output -o json|table|tsv|yaml  # Output format
--query JMESPATH_QUERY  # Filter/extract output
--verbose -v            # Verbose output
--debug                 # Debug mode
--help -h               # Command help
```

### 资源组

```bash
az group list           # List all resource groups
az group create -g RG -l LOCATION  # Create
az group delete -g RG   # Delete
az group show -g RG     # Get details
az group update -g RG --tags key=value  # Update tags
```

### 虚拟机（计算）

```bash
az vm create -g RG -n VM_NAME --image UbuntuLTS
az vm list -g RG
az vm show -g RG -n VM_NAME
az vm start -g RG -n VM_NAME
az vm stop -g RG -n VM_NAME
az vm restart -g RG -n VM_NAME
az vm delete -g RG -n VM_NAME
```

### 存储操作

```bash
az storage account create -g RG -n ACCOUNT --sku Standard_LRS
az storage account list
az storage container create --account-name ACCOUNT -n CONTAINER
az storage blob upload --account-name ACCOUNT -c CONTAINER -n BLOB -f LOCAL_FILE
az storage blob download --account-name ACCOUNT -c CONTAINER -n BLOB -f LOCAL_FILE
```

### Azure Kubernetes 服务（AKS）

```bash
az aks create -g RG -n CLUSTER --node-count 2
az aks get-credentials -g RG -n CLUSTER
az aks list
az aks show -g RG -n CLUSTER
az aks delete -g RG -n CLUSTER
```

## 常见模式

### 模式 1：输出格式化
```bash
# Get only specific fields
az vm list --query "[].{name: name, state: powerState}"

# Get just the names
az vm list --query "[].name" -o tsv

# Filter and extract
az vm list --query "[?powerState=='VM running'].name"
```

### 模式 2：自动化与脚本编写
```bash
#!/bin/bash
set -e  # Exit on error

# Get VM ID
VM_ID=$(az vm create \
  -g myRG \
  -n myVM \
  --image UbuntuLTS \
  --query id \
  --output tsv)

echo "Created VM: $VM_ID"

# Check provisioning state
az vm show --ids "$VM_ID" --query provisioningState
```

### 模式 3：批量操作
```bash
# Delete all VMs in a resource group
az vm list -g myRG -d --query "[].id" -o tsv | xargs az vm delete --ids

# List all resources by tag
az resource list --tag env=production
```

### 模式 4：使用默认值
```bash
# Set defaults to reduce typing
az configure --defaults group=myRG subscription=mySubscription location=eastus

# Now commands are simpler
az vm create -n myVM --image UbuntuLTS  # group, subscription, location inherited
```

## 辅助脚本

本技能包含若干常用操作的辅助 Bash 脚本：

- **azure-vm-status.sh** —— 检查整个订阅中所有虚拟机的状态
- **azure-resource-cleanup.sh** —— 识别并清理未使用的资源
- **azure-storage-analysis.sh** —— 分析存储账户的使用情况与成本
- **azure-subscription-info.sh** —— 获取订阅配额与限制信息
- **azure-rg-deploy.sh** —— 部署带监控功能的基础架构

**用法：**
```bash
./scripts/azure-vm-status.sh -g myResourceGroup
./scripts/azure-storage-analysis.sh --subscription mySubscription
```

## 高级主题

### 使用 JMESPath 进行输出查询
Azure CLI 支持使用 JMESPath 实现强大的输出筛选功能：

```bash
# Sort results
az vm list --query "sort_by([], &name)"

# Complex filtering
az vm list --query "[?location=='eastus' && powerState=='VM running'].name"

# Aggregation
az vm list --query "length([])"  # Count VMs
```

### 错误处理
```bash
# Check exit codes
az vm create -g RG -n VM --image UbuntuLTS
if [ $? -eq 0 ]; then
  echo "VM created successfully"
else
  echo "Failed to create VM"
  exit 1
fi
```

### 身份验证方法

**服务主体（Service Principal，适用于自动化场景）：**
```bash
az login --service-principal \
  --username $AZURE_CLIENT_ID \
  --password $AZURE_CLIENT_SECRET \
  --tenant $AZURE_TENANT_ID
```

**托管标识（Managed Identity，适用于 Azure 资源）：**
```bash
# On an Azure VM or Container Instance
az login --identity
```

**基于令牌的身份验证（Token-based，适用于 CI/CD 场景）：**
```bash
echo "$AZURE_ACCESS_TOKEN" | az login --service-principal -u $AZURE_CLIENT_ID --password-stdin --tenant $AZURE_TENANT_ID
```

## 关键资源

- **官方文档：** https://learn.microsoft.com/zh-cn/cli/azure/
- **命令参考：** https://learn.microsoft.com/zh-cn/cli/azure/reference-index
- **GitHub 仓库：** https://github.com/Azure/azure-cli
- **综合指南：** 参见 [references/REFERENCE.md](references/REFERENCE.md)
- **版本发布说明：** https://github.com/Azure/azure-cli/releases

## 提示与技巧

1. **启用 Tab 补全：**
   ```bash
   # macOS with Homebrew
   eval "$(az completion init zsh)"
   
   # Linux (bash)
   eval "$(az completion init bash)"
   ```

2. **快速查找命令：**
   ```bash
   az find "create virtual machine"  # Search for commands
   ```

3. **对耗时操作使用 --no-wait：**
   ```bash
   az vm create -g RG -n VM --image UbuntuLTS --no-wait
   # Check status later with az vm show
   ```

4. **保存常用参数：**
   ```bash
   az configure --defaults group=myRG location=eastus
   ```

5. **与其他工具结合使用：**
   ```bash
   # Use with jq for advanced JSON processing
   az vm list | jq '.[] | select(.powerState == "VM running") | .name'
   
   # Use with xargs for batch operations
   az storage account list --query "[].name" -o tsv | xargs -I {} az storage account show -g RG -n {}
   ```

## 后续步骤

- 查阅 [references/REFERENCE.md](references/REFERENCE.md) 获取完整命令文档
- 探索 `scripts/` 目录下的辅助脚本
- 首先在非生产环境中进行实践
- 复习 Azure 最佳实践与成本优化策略

---

**版本：** 1.0.0  
**许可证：** MIT  
**兼容性：** Azure CLI v2.50+、Azure 订阅