---
name: swarm
description: 使用轻量级 LLM 工作节点启用并行任务执行。这将显著加速研究、批量处理及多步骤任务。
description_zh: 使用轻量级 LLM 工作节点启用并行任务执行。这将显著加速研究、批量处理及多步骤任务。
---
# Node Scaling Skill

使用轻量级 LLM 工作节点启用并行任务执行。这将显著加速研究、批量处理及多步骤任务。

## ⚡ 关键：即时确认模式

在使用 Swarm 时，**务必在调用 exec 之前先输出一条确认消息**：

```
🐝 **Swarm initializing...** researching 6 companies in parallel
```

随后再调用 exec。此举可确保用户立即获得反馈，并明确知晓 Swarm 正在加速您的工作，而非造成延迟。

**正确做法：**
```
Me: "🐝 Swarm initializing... researching 6 AI startups in parallel"
[exec call]
Me: "Here are the results..."
```

**错误做法：**
```
[exec call with no prior message]  ← User sees nothing, thinks you froze
Me: "Here are the results..."
```

## 适用场景

当出现以下情况时，启用节点扩展（Node Scaling）：

1. **多个独立主题** —— 例如：“调研全球前 5 家人工智能公司”
2. **批量处理** —— 例如：“分析以下 10 个 URL”
3. **多步骤流水线任务** —— 例如需依次执行搜索 → 抓取 → 分析的任务
4. **用户明确要求提速** —— 例如含“快速”、“并行”、“尽快”等表述
5. **检测到 3 个及以上独立子任务**

请勿在以下情况下使用：
- 单一、原子性问题
- 存在严格顺序依赖关系的任务
- 极短任务（<1 秒）

## 使用方法

### 检查是否已配置

```bash
cat ~/.config/clawdbot/node-scaling.yaml
```

若尚未配置，请引导用户：
```
Node scaling isn't set up yet. Would you like me to help you configure it?

You'll need an API key from one of these providers:
• Google Gemini (cheapest): https://aistudio.google.com/apikey
• Groq (free tier): https://console.groq.com/keys
• OpenAI: https://platform.openai.com/api-keys
```

### 执行初始化设置

```bash
cd ~/clawd/skills/node-scaling && node bin/setup.js
```

### 执行并行任务

针对类似“调研全球前 5 家人工智能公司”的研究类任务：

```javascript
// 1. Load the dispatcher
const { Dispatcher } = require('~/clawd/skills/node-scaling/lib/dispatcher');
const dispatcher = new Dispatcher();

// 2. Define parallel tasks
const subjects = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'Microsoft'];

// 3. Phase 1: Search (parallel)
const searchTasks = subjects.map(s => ({
  nodeType: 'search',
  tool: 'web_search',
  input: `${s} AI products 2024`,
}));
const searchResults = await dispatcher.executeParallel(searchTasks);

// 4. Phase 2: Fetch (parallel)
const fetchTasks = searchResults.results
  .filter(r => r.success)
  .map(r => ({
    nodeType: 'fetch',
    tool: 'web_fetch',
    input: r.result.results[0].url,
  }));
const fetchResults = await dispatcher.executeParallel(fetchTasks);

// 5. Phase 3: Analyze (parallel)
const analyzeTasks = fetchResults.results
  .filter(r => r.success)
  .map((r, i) => ({
    nodeType: 'analyze',
    instruction: `Summarize ${subjects[i]}'s AI strategy`,
    input: r.result.content,
  }));
const analyses = await dispatcher.executeParallel(analyzeTasks);

// 6. Synthesize (you do this part)
// Combine the parallel results into a coherent response
```

## 配置

配置文件路径：`~/.config/clawdbot/node-scaling.yaml`

关键配置项：
```yaml
node_scaling:
  limits:
    max_nodes: 10        # Adjust based on system resources
  provider:
    name: gemini         # gemini, openai, anthropic, groq
    api_key_env: GEMINI_API_KEY
```

### 调整配置项

```bash
# View current config
cat ~/.config/clawdbot/node-scaling.yaml

# Edit max nodes (example)
sed -i 's/max_nodes: .*/max_nodes: 20/' ~/.config/clawdbot/node-scaling.yaml
```

## 性能预期

| 任务类型 | 单节点耗时 | 启用扩展后耗时 | 加速比 |
|----------|------------|----------------|--------|
| 5 次搜索 | 6 秒 | 1.6 秒 | 3.8 倍 |
| 10 篇摘要生成 | 7 秒 | 1 秒 | 7 倍 |
| 5 家公司深度调研 | 18 秒 | 6 秒 | 3 倍 |
| 10 次深度分析 | 166 秒 | 9 秒 | 18 倍 |

## 成本追踪

调度器（dispatcher）会追踪 token 使用量。请向用户报告如下信息：

```javascript
const stats = dispatcher.getNodeStats();
// Returns cost estimates per provider
```

## 诊断与故障排除

### 运行诊断命令

当 Swarm 无法正常工作时，请首先运行诊断：

```bash
cd ~/clawd/skills/node-scaling && npm run diagnose
```

如需 JSON 格式输出（更便于解析）：
```bash
cd ~/clawd/skills/node-scaling && npm run diagnose:json
```

### 理解诊断输出

JSON 报告包含以下内容：
```json
{
  "status": "ok|warning|error",
  "machine": { /* CPU, memory, OS info */ },
  "tests": { /* unit, integration, e2e results */ },
  "issues": [ /* problems found */ ],
  "recommendations": [ /* suggested fixes */ ]
}
```

### 自动修复常见问题

#### 问题：`no_config_dir`
```bash
mkdir -p ~/.config/clawdbot
```

#### 问题：`no_api_key`  
选项 1 —— 设置环境变量：
```bash
export GEMINI_API_KEY="your-key-here"
```

选项 2 —— 创建密钥文件：
```bash
echo "your-key-here" > ~/.config/clawdbot/gemini-key.txt
chmod 600 ~/.config/clawdbot/gemini-key.txt
```

选项 3 —— 运行配置向导：
```bash
cd ~/clawd/skills/node-scaling && node bin/setup.js
```

#### 问题：`node_version`  
Swarm 要求 Node.js 版本 ≥ 18。请升级：
```bash
# Using nvm
nvm install 20
nvm use 20

# Or direct install
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 问题：`test_failure`（单元测试 / 集成测试）  
此类失败通常表明存在 bug 或安装已损坏。请尝试：
```bash
cd ~/clawd/skills/node-scaling
rm -rf node_modules
npm install
npm run test:unit
npm run test:integration
```

若仍失败，请查看具体测试输出以获取详细信息。

#### 问题：`test_failure`（端到端测试）  
端到端（E2E）测试失败通常意味着：
1. API 密钥无效 → 使用新密钥重新运行 setup  
2. 触发了速率限制 → 等待数分钟后重试  
3. 网络异常 → 检查网络连通性  

### 机器特定优化

完成诊断后，请检查当前机器配置档案：
```bash
cat ~/.config/clawdbot/swarm-profile.json
```

请参考 `recommendations.optimalWorkers` 的值：
```bash
# Update config with optimal worker count
OPTIMAL=$(cat ~/.config/clawdbot/swarm-profile.json | jq '.recommendations.optimalWorkers // 10')
sed -i "s/max_nodes: .*/max_nodes: $OPTIMAL/" ~/.config/clawdbot/node-scaling.yaml
```

### 内存受限系统

若 `memory.freeGb` < 2：
```yaml
# In node-scaling.yaml, reduce workers
limits:
  max_nodes: 3
  max_concurrent_api: 3
```

### Docker / 容器环境

请确保容器具备充足资源：
```bash
# Check limits
docker stats --no-stream

# Recommended minimums
# Memory: 512MB per worker
# CPU: 0.5 cores per worker
```

### 速率限制应对

若遭遇 API 速率限制：
```yaml
# In node-scaling.yaml
limits:
  max_concurrent_api: 5  # Reduce this
```

### 彻底重装（终极方案）

若其他方法均无效，请执行彻底重装：
```bash
cd ~/clawd/skills/node-scaling
rm -rf node_modules
rm ~/.config/clawdbot/node-scaling.yaml
rm ~/.config/clawdbot/gemini-key.txt
npm install
node bin/setup.js
```

## 触发 Node Scaling 的典型提示词示例

- “调研全球前 10 种编程语言并进行对比”
- “并行分析以下 5 个 URL 并分别生成摘要”
- “查找有关以下公司的信息：X、Y、Z”
- “并行处理以下文档”
- “快速收集以下主题的相关数据”

## 集成注意事项

在使用 node scaling 时，请注意：

1. 务必向用户报告加速效果（例如：“5 项调研任务耗时 6 秒，较单节点的 18 秒提升 3 倍”）  
2. 若成本显著，请同步提供预估成本  
3. 若 node scaling 执行失败，请优雅降级至单节点模式  
4. 切勿对简单单一问题启用 node scaling