---
name: rlm
name_zh: RLM
description: 利用 RLM（递归语言模型）执行经验证的代码运行、计算、数据分析与任务分解。通过迭代执行 Python 代码直至产出经验证结果——杜绝大语言模型（LLM）猜测。
description_zh: 利用 RLM（递归语言模型）执行经验证的代码运行、计算、数据分析与任务分解。通过迭代执行 Python 代码直至产出经验证结果——杜绝大语言模型（LLM）猜测。
metadata: {"clawdbot":{"emoji":"🔄","requires":{"bins":["mcporter"]},"install":[{"id":"node","kind":"node","package":"mcporter","bins":["mcporter"],"label":"Install mcporter (npm)"}]}}
---
# RLM —— 递归语言模型

通过 mcporter MCP 桥接器实现 **经验证的代码执行**。

RLM 迭代编写并执行 Python 代码，直至产出经验证的正确答案。与直接调用大语言模型（LLM）不同，RLM 的计算结果 **100% 准确**，适用于各类数值运算。

## 前置条件

### 1. 安装 mcporter（MCP 桥接器）  
```bash
npm install -g mcporter
```  

### 2. 安装 RLM MCP 服务器  

**方案 A：克隆并配置（推荐）**  
```bash
# Clone RLM project
git clone https://github.com/alexzhang13/rlm.git $HOME/rlm
cd $HOME/rlm
pip install -e .

# Create MCP server directory
mkdir -p $HOME/.claude/mcp-servers/rlm/src

# Download MCP server files
curl -o $HOME/.claude/mcp-servers/rlm/src/server.py \
  https://raw.githubusercontent.com/eesb99/rlm-mcp/main/src/server.py
curl -o $HOME/.claude/mcp-servers/rlm/run_server.sh \
  https://raw.githubusercontent.com/eesb99/rlm-mcp/main/run_server.sh
curl -o $HOME/.claude/mcp-servers/rlm/setup.sh \
  https://raw.githubusercontent.com/eesb99/rlm-mcp/main/setup.sh
curl -o $HOME/.claude/mcp-servers/rlm/requirements.txt \
  https://raw.githubusercontent.com/eesb99/rlm-mcp/main/requirements.txt

# Setup venv and install dependencies
chmod +x $HOME/.claude/mcp-servers/rlm/*.sh
cd $HOME/.claude/mcp-servers/rlm
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```  

**方案 B：手动配置**  
```bash
# Create server directory
mkdir -p $HOME/.claude/mcp-servers/rlm/src

# Create venv and install dependencies
cd $HOME/.claude/mcp-servers/rlm
python3 -m venv venv
venv/bin/pip install mcp litellm

# Create run_server.sh
cat > $HOME/.claude/mcp-servers/rlm/run_server.sh << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
export PYTHONPATH="$HOME/rlm:$PYTHONPATH"
export RLM_MODEL="${RLM_MODEL:-openrouter/x-ai/grok-code-fast-1}"
export RLM_SUBTASK_MODEL="${RLM_SUBTASK_MODEL:-openrouter/openai/gpt-4o-mini}"
export RLM_MAX_DEPTH="${RLM_MAX_DEPTH:-2}"
export RLM_MAX_ITERATIONS="${RLM_MAX_ITERATIONS:-20}"
exec "$SCRIPT_DIR/venv/bin/python" -m src.server
EOF
chmod +x $HOME/.claude/mcp-servers/rlm/run_server.sh
```  

### 3. 配置 MCP（适用于 Claude Code）

在 `~/.mcp.json` 中添加以下配置（请将 `YOUR_HOME` 替换为您的实际主目录路径，例如 `/Users/john` 或 `/home/john`）：  
```json
{
  "mcpServers": {
    "rlm": {
      "command": "bash",
      "args": ["YOUR_HOME/.claude/mcp-servers/rlm/run_server.sh"]
    }
  }
}
```  

**获取主目录路径：** `echo $HOME`  

### 4. 设置 API 密钥

RLM 需要 OpenRouter API 密钥：  
```bash
export OPENROUTER_API_KEY="your-key-here"
```  

### 5. 验证安装

```bash
# Check mcporter sees RLM
mcporter list | grep rlm

# Test RLM
mcporter call 'rlm.rlm_status()'
```  

## 可用工具

| 工具 | 用途 | 参数 |
|------|------|------|
| `rlm_execute` | 通用任务、数值计算 | `task`（必填）、`context`（可选） |
| `rlm_analyze` | 数据分析 | `data`、`question`（均必填） |
| `rlm_code` | 生成经测试的代码 | `description`（必填）、`language`（可选，默认为 python） |
| `rlm_decompose` | 复杂多步骤任务 | `complex_task`、`num_subtasks`（默认值：5） |
| `rlm_status` | 检查系统状态 | （无参数） |

## 快速命令

**简单计算：**  
```bash
mcporter call 'rlm.rlm_execute(task: "calculate 127 * 389")'
```  

**前 N 个质数：**  
```bash
mcporter call 'rlm.rlm_execute(task: "calculate the first 100 prime numbers")'
```  

**数据分析：**  
```bash
mcporter call 'rlm.rlm_analyze(data: "[23, 45, 67, 89, 12, 34]", question: "what is the mean, median, and standard deviation?")'
```  

**生成代码：**  
```bash
mcporter call 'rlm.rlm_code(description: "function to check if a number is prime")'
```  

**复杂任务（已分解）：**  
```bash
mcporter call 'rlm.rlm_decompose(complex_task: "analyze a $500K portfolio with 60/30/10 allocation, calculate risk metrics and 10-year projection", num_subtasks: 5)'
```  

**检查状态：**  
```bash
mcporter call 'rlm.rlm_status()'
```  

## 何时使用 RLM

**应使用 RLM 的场景：**  
- 需要高精度的数学计算  
- 统计分析（均值、标准差、相关性等）  
- 财务计算（复利、净现值 NPV、内部收益率 IRR）  
- 算法执行（质数判定、排序、搜索）  
- 数据转换与聚合  
- 带验证的代码生成  

**不应使用 RLM 的场景：**  
- 简单事实性问题（应使用直接响应）  
- 创意写作或头脑风暴  
- 需要网络搜索或实时数据的任务  
- 极其简单的计算（如 2+2）  

## 工作原理

```
1. You give RLM a task
2. RLM writes Python code to solve it
3. Code executes in sandbox
4. If not complete, RLM iterates
5. Returns verified final answer
```  

**所用模型：**  
- 主模型（Root）：`grok-code-fast-1`（快速代码执行）  
- 子任务模型（Subtasks）：`gpt-4o-mini`（低成本子查询）  

## 配置

**环境变量：**  
| 变量 | 默认值 | 描述 |  
|------|--------|------|  
| `RLM_MODEL` | `openrouter/x-ai/grok-code-fast-1` | 主执行模型 |  
| `RLM_SUBTASK_MODEL` | `openrouter/openai/gpt-4o-mini` | 子任务模型 |  
| `RLM_MAX_DEPTH` | `2` | 最大递归深度 |  
| `RLM_MAX_ITERATIONS` | `20` | 每项任务最大迭代次数 |  
| `OPENROUTER_API_KEY` | （必填） | OpenRouter API 密钥 |  

**服务器位置：** `$HOME/.claude/mcp-servers/rlm/`  

## 故障排查

**出现“服务器离线”或“No module named 'mcp'”：**  
```bash
# Reinstall dependencies
cd $HOME/.claude/mcp-servers/rlm
python3 -m venv venv
venv/bin/pip install mcp litellm
```  

**出现“mcporter: command not found”：**  
```bash
npm install -g mcporter
```  

**出现“rlm not in mcporter list”：**  
- 检查 `$HOME/.mcp.json` 是否存在且包含 rlm 配置  
- 验证 run_server.sh 是否具备可执行权限：`chmod +x $HOME/.claude/mcp-servers/rlm/run_server.sh`  

**响应缓慢：**  
- RLM 执行真实代码，通常耗时 10–30 秒  
- 含任务分解的复杂任务耗时更长  

## 参考资料

- **论文：** [Recursive Language Models](https://arxiv.org/abs/2512.24601)（Zhang, Kraska, Khattab，2025）  
- **RLM 库：** [github.com/alexzhang13/rlm](https://github.com/alexzhang13/rlm)  
- **MCP 服务器：** [github.com/eesb99/rlm-mcp](https://github.com/eesb99/rlm-mcp)  
- **MCP SDK：** [modelcontextprotocol.io](https://modelcontextprotocol.io)  
- **mcporter：** [mcporter.dev](http://mcporter.dev)  