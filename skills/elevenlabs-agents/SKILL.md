---
name: elevenlabs-agents
name_zh: ElevenLabs智能体
description: 创建、管理和部署 ElevenLabs 对话式 AI agents。当用户希望操作语音 agents、列出其已有 agents、创建新 agents 或管理 agent 配置时使用。
description_zh: 创建、管理和部署 ElevenLabs 对话式 AI agents。当用户希望操作语音 agents、列出其已有 agents、创建新 agents 或管理 agent 配置时使用。
metadata: {"clawdbot":{"requires":{"bins":["elevenlabs"]}}}
---
# ElevenLabs Agents 管理

代表用户管理 ElevenLabs 对话式 AI agents。内部使用 `elevenlabs` CLI，但**绝不可**向用户直接暴露 CLI 命令或错误信息。

## 关键行为准则

1. **隐藏 CLI 细节**：切勿告知用户需运行任何命令；所有操作均须静默完成。
2. **优雅处理错误**：若某条命令执行失败，请自行修复，或以用户友好的语言解释当前状况。
3. **明确区分本地与远程**：始终清晰说明所展示的是本地（已同步）agents 还是远程（平台侧）agents。

## 执行任意操作前

在尝试任何 agent 操作前，须静默执行以下检查：

### 1. 检查身份认证
```bash
elevenlabs auth whoami
```
若未通过认证，则告知用户：“您尚未登录 ElevenLabs。我需要您的 API 密钥才能继续。”随后运行 `elevenlabs auth login` 并引导用户完成认证流程。

### 2. 检查项目初始化
检查工作目录中是否存在 `agents.json`。若缺失，则静默执行：
```bash
elevenlabs agents init
```
切勿向用户提及 `agents.json` 缺失——仅自动完成初始化即可。

## 操作说明

### 列出 agents

当用户请求查看其 agents 时：

1. 首先尝试执行 `elevenlabs agents list`（显示本地 agents）
2. 若无本地 agents，告知用户：“您当前没有已同步的本地 agents。是否需要我从 ElevenLabs 拉取您的 agents？”
3. 若用户确认，则运行 `elevenlabs agents pull`，再重新列出
4. 以整洁的表格/列表形式呈现结果，而非原始 CLI 输出

### 创建 agents

当用户希望创建一个 agent 时：

1. 向用户询问 agent 名称及其用途（**不要**提及“模板”一词）
2. 根据其描述选择合适模板：
   - 客户支持 → `customer-service`
   - 通用助手 → `assistant`
   - 语音优先 → `voice-only`
   - 简洁/极简 → `minimal`
   - 情况不明时默认 → `default`
3. 执行：`elevenlabs agents add "Name" --template <template>`
4. 告知用户该 agent 已在本地创建成功
5. 提问：“是否需要我现在将其部署至 ElevenLabs？”
6. 若用户回答“是”，则运行 `elevenlabs agents push`

### 同步 agents

**拉取（远程 → 本地）：**
```bash
elevenlabs agents pull                    # all agents
elevenlabs agents pull --agent <id>       # specific agent
elevenlabs agents pull --update           # overwrite local with remote
```
告知用户：“我已从 ElevenLabs 同步了您的 agents。”

**推送（本地 → 远程）：**
```bash
elevenlabs agents push --dry-run  # preview first, check for issues
elevenlabs agents push            # actual push
```
告知用户：“我已将您的变更部署至 ElevenLabs。”

### 检查状态

```bash
elevenlabs agents status
```
以如下格式呈现：“以下是您的 agents 同步状态：”，后接简洁摘要。

### 为 agents 添加工具（Tools）

当用户希望添加集成/工具时：
1. 询问该工具应实现何种功能
2. 询问 Webhook URL 或配置参数
3. 创建配置文件并执行：
```bash
elevenlabs agents tools add "Tool Name" --type webhook --config-path ./config.json
```
4. 推送变更：`elevenlabs agents push`

### 获取嵌入代码（Embed Code）

```bash
elevenlabs agents widget <agent_id>
```
整洁地呈现 HTML 片段，并说明应粘贴至何处。

## 用户友好化表达对照表

| 应避免的说法… | 推荐说法… |
|---------------------|--------|
| “运行 `elevenlabs auth login`” | “我需要连接您的 ElevenLabs 账户。” |
| “未找到 agents.json” | （静默初始化，不作任何说明） |
| “推送失败” | “我未能成功部署这些变更。让我检查一下出了什么问题……” |
| “您有 0 个 agents” | “您当前本地未同步任何 agents。需要我检查 ElevenLabs 上是否已有现有 agents 吗？” |
| “Agent 已在本地创建” | “我已为您创建了 agent。是否需要现在就部署？” |

## 项目文件（仅供内部参考）

初始化完成后，工作目录包含以下文件：
- `agents.json` —— Agent 注册表
- `agent_configs/` —— Agent 配置文件
- `tools.json` —— 工具（Tools）注册表
- `tool_configs/` —— 工具（Tools）配置

以上均为实现细节——除非用户明确询问项目结构，否则不得向用户提及。