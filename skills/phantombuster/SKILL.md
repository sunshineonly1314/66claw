---
name: phantombuster
name_zh: PhantomBuster
description: 通过 API 控制 PhantomBuster 自动化 agents。支持列出 agents、启动自动化任务、获取输出/结果、检查状态以及中止正在运行的 agents。当用户需要运行 LinkedIn 数据抓取、Twitter 自动化、潜在客户生成 phantoms 或任意 PhantomBuster 工作流时使用。
description_zh: 通过 API 控制 PhantomBuster 自动化 agents。支持列出 agents、启动自动化任务、获取输出/结果、检查状态以及中止正在运行的 agents。当用户需要运行 LinkedIn 数据抓取、Twitter 自动化、潜在客户生成 phantoms 或任意 PhantomBuster 工作流时使用。
version: 1.0.0
author: captmarbles
---
# PhantomBuster Skill

通过命令行控制你的 [PhantomBuster](https://phantombuster.com) 自动化 agents。

## 设置步骤

1. 从 [工作区设置页面](https://phantombuster.com/workspace-settings) 获取你的 API 密钥；  
2. 设置环境变量：  
   ```bash
   export PHANTOMBUSTER_API_KEY=your-api-key-here
   ```

## 使用方法

所有命令均调用本 skill 目录下打包的 `pb.py` 脚本。

### 列出 Agents

查看你已配置的所有 PhantomBuster agents。

```bash
python3 pb.py list
python3 pb.py list --json  # JSON output
```

### 启动一个 Agent

通过 ID 或名称启动某个 phantom。

```bash
python3 pb.py launch <agent-id>
python3 pb.py launch <agent-id> --argument '{"search": "CEO fintech"}'
```

### 获取 Agent 输出

获取最近一次运行的结果/输出。

```bash
python3 pb.py output <agent-id>
python3 pb.py output <agent-id> --json  # Raw JSON
```

### 查询 Agent 状态

查看某个 agent 当前是否正在运行、已完成或发生错误。

```bash
python3 pb.py status <agent-id>
```

### 中止正在运行的 Agent

停止当前正在运行的 agent。

```bash
python3 pb.py abort <agent-id>
```

### 获取 Agent 详情

获取特定 agent 的完整信息。

```bash
python3 pb.py get <agent-id>
```

### 获取结果数据

下载某个 agent 最近一次运行的实际结果数据（CSV 格式）。

```bash
python3 pb.py fetch-result <agent-id>
python3 pb.py fetch-result <agent-id> > output.csv
```

此命令将从 agent 的 S3 存储中下载 `result.csv` 文件，完美适配将 PhantomBuster 数据集成至你的工作流场景。

## 示例提示语

- “列出我的 PhantomBuster agents”  
- “启动我的 LinkedIn Sales Navigator 抓取器”  
- “获取 agent 12345 的输出结果”  
- “检查我的 Twitter 关注者 phantom 是否仍在运行”  
- “中止当前正在运行的 agent”

## 常用 Phantoms

PhantomBuster 提供多种预建自动化工具：  
- **LinkedIn Sales Navigator 搜索** —— 从搜索结果中提取潜在客户；  
- **LinkedIn 个人资料抓取器** —— 获取个人资料数据；  
- **Twitter 关注者采集器** —— 抓取关注者列表；  
- **Instagram 个人资料抓取器** —— 获取 Instagram 个人资料数据；  
- **Google Maps 搜索导出** —— 提取企业名录。

## 速率限制

PhantomBuster 的执行时长限制取决于你的订阅计划。API 本身未设严格限频，但 agent 的执行会消耗你计划所含的分钟数。