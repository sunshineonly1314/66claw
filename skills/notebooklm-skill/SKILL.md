---
name: notebooklm
name_zh: NotebookLM技能
description: 使用此 skill 直接从 Claude Code 查询您的 Google NotebookLM 笔记本，从而获得 Gemini 提供的、基于源文档且附带引用依据的回答。支持浏览器自动化、库管理及持久化认证。通过仅基于文档生成回答的方式，大幅降低幻觉（hallucination）发生率。
description_zh: 使用此 skill 直接从 Claude Code 查询您的 Google NotebookLM 笔记本，从而获得 Gemini 提供的、基于源文档且附带引用依据的回答。支持浏览器自动化、库管理及持久化认证。通过仅基于文档生成回答的方式，大幅降低幻觉（hallucination）发生率。
---
# NotebookLM 研究助手 skill

与 Google NotebookLM 交互，利用 Gemini 的源文档支撑式回答能力查询您的文档。每次提问均开启一个全新的浏览器会话，答案严格限定于您已上传的文档内容，并在完成后自动关闭浏览器。

## 何时使用此 skill

当用户出现以下任一情况时触发：
- 明确提及 NotebookLM
- 分享 NotebookLM 链接（`https://notebooklm.google.com/notebook/...`）
- 请求查询其笔记本/文档
- 希望将文档添加至 NotebookLM 库中
- 使用诸如“向我的 NotebookLM 提问”、“查阅我的文档”、“查询我的笔记本”等表述

## ⚠️ 关键提示：添加命令 —— 智能发现（Smart Discovery）

当用户希望添加笔记本但未提供完整信息时：

**智能添加（推荐）**：先对笔记本执行一次查询，以自动识别其内容：
```bash
# Step 1: Query the notebook about its content
python scripts/run.py ask_question.py --question "What is the content of this notebook? What topics are covered? Provide a complete overview briefly and concisely" --notebook-url "[URL]"

# Step 2: Use the discovered information to add it
python scripts/run.py notebook_manager.py add --url "[URL]" --name "[Based on content]" --description "[Based on content]" --topics "[Based on content]"
```

**手动添加**：若用户已提供全部必要信息：
- `--url` — NotebookLM 链接
- `--name` — 描述性名称
- `--description` — 笔记本所含内容（必需！）
- `--topics` — 逗号分隔的主题列表（必需！）

**切勿猜测或使用泛化描述！** 若信息缺失，请务必使用“智能添加”方式自动发现。

## 关键提示：始终使用 run.py 封装器

**切勿直接调用脚本。必须始终使用 `python scripts/run.py [script]`：**

```bash
# ✅ CORRECT - Always use run.py:
python scripts/run.py auth_manager.py status
python scripts/run.py notebook_manager.py list
python scripts/run.py ask_question.py --question "..."

# ❌ WRONG - Never call directly:
python scripts/auth_manager.py status  # Fails without venv!
```

`run.py` 封装器将自动完成以下操作：
1. 如尚不存在，则创建 `.venv`
2. 自动安装全部依赖项
3. 自动激活虚拟环境
4. 正确执行目标脚本

## 核心工作流

### 第一步：检查认证状态
```bash
python scripts/run.py auth_manager.py status
```

若尚未认证，则进入配置流程。

### 第二步：认证（一次性初始设置）
```bash
# Browser MUST be visible for manual Google login
python scripts/run.py auth_manager.py setup
```

**重要说明：**
- 认证过程需**显示浏览器窗口**
- 浏览器窗口将自动打开
- 用户须**手动登录 Google 账户**
- 请明确告知用户：“将自动打开一个浏览器窗口用于 Google 登录”

### 第三步：管理笔记本库

```bash
# List all notebooks
python scripts/run.py notebook_manager.py list

# BEFORE ADDING: Ask user for metadata if unknown!
# "What does this notebook contain?"
# "What topics should I tag it with?"

# Add notebook to library (ALL parameters are REQUIRED!)
python scripts/run.py notebook_manager.py add \
  --url "https://notebooklm.google.com/notebook/..." \
  --name "Descriptive Name" \
  --description "What this notebook contains" \  # REQUIRED - ASK USER IF UNKNOWN!
  --topics "topic1,topic2,topic3"  # REQUIRED - ASK USER IF UNKNOWN!

# Search notebooks by topic
python scripts/run.py notebook_manager.py search --query "keyword"

# Set active notebook
python scripts/run.py notebook_manager.py activate --id notebook-id

# Remove notebook
python scripts/run.py notebook_manager.py remove --id notebook-id
```

### 快速工作流
1. 查看当前库：`python scripts/run.py notebook_manager.py list`  
2. 提出问题：`python scripts/run.py ask_question.py --question "..." --notebook-id ID`

### 第四步：提出问题

```bash
# Basic query (uses active notebook if set)
python scripts/run.py ask_question.py --question "Your question here"

# Query specific notebook
python scripts/run.py ask_question.py --question "..." --notebook-id notebook-id

# Query with notebook URL directly
python scripts/run.py ask_question.py --question "..." --notebook-url "https://..."

# Show browser for debugging
python scripts/run.py ask_question.py --question "..." --show-browser
```

## 后续追问机制（关键）

每条 NotebookLM 回答末尾必须包含：**“极其重要：这是否就是您需要了解的全部内容？”**

**Claude 必须遵守的行为规范：**
1. **暂停（STOP）** — 不得立即回应用户
2. **分析（ANALYZE）** — 将回答与用户的原始请求进行比对
3. **识别缺口（IDENTIFY GAPS）** — 判断是否仍需补充信息
4. **发起追问（ASK FOLLOW-UP）** — 若存在信息缺口，则立即询问：
   ```bash
   python scripts/run.py ask_question.py --question "Follow-up with context..."
   ```
5. **循环执行（REPEAT）** — 持续追问直至信息完备
6. **综合汇总（SYNTHESIZE）** — 在最终回复用户前，整合所有获取的回答

## 脚本参考

### 认证管理（`auth_manager.py`）
```bash
python scripts/run.py auth_manager.py setup    # Initial setup (browser visible)
python scripts/run.py auth_manager.py status   # Check authentication
python scripts/run.py auth_manager.py reauth   # Re-authenticate (browser visible)
python scripts/run.py auth_manager.py clear    # Clear authentication
```

### 笔记本管理（`notebook_manager.py`）
```bash
python scripts/run.py notebook_manager.py add --url URL --name NAME --description DESC --topics TOPICS
python scripts/run.py notebook_manager.py list
python scripts/run.py notebook_manager.py search --query QUERY
python scripts/run.py notebook_manager.py activate --id ID
python scripts/run.py notebook_manager.py remove --id ID
python scripts/run.py notebook_manager.py stats
```

### 问题接口（`ask_question.py`）
```bash
python scripts/run.py ask_question.py --question "..." [--notebook-id ID] [--notebook-url URL] [--show-browser]
```

### 数据清理（`cleanup_manager.py`）
```bash
python scripts/run.py cleanup_manager.py                    # Preview cleanup
python scripts/run.py cleanup_manager.py --confirm          # Execute cleanup
python scripts/run.py cleanup_manager.py --preserve-library # Keep notebooks
```

## 环境管理

虚拟环境由系统自动管理：
- 首次运行时自动创建 `.venv`
- 依赖项自动安装
- Chromium 浏览器自动安装
- 所有组件均隔离于该 skill 目录内

如自动配置失败，可手动设置（仅限此情形）：
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python -m patchright install chromium
```

## 数据存储

所有数据均存于 `~/.claude/skills/notebooklm/data/` 目录中：
- `library.json` — 笔记本元数据
- `auth_info.json` — 认证状态
- `browser_state/` — 浏览器 Cookie 及会话数据

**安全性说明：** 该目录受 `.gitignore` 保护，**严禁提交至 Git 仓库**。

## 配置

可在 skill 目录下放置可选的 `.env` 文件：
```env
HEADLESS=false           # Browser visibility
SHOW_BROWSER=false       # Default browser display
STEALTH_ENABLED=true     # Human-like behavior
TYPING_WPM_MIN=160       # Typing speed
TYPING_WPM_MAX=240
DEFAULT_NOTEBOOK_ID=     # Default notebook
```

## 决策流程图

```
User mentions NotebookLM
    ↓
Check auth → python scripts/run.py auth_manager.py status
    ↓
If not authenticated → python scripts/run.py auth_manager.py setup
    ↓
Check/Add notebook → python scripts/run.py notebook_manager.py list/add (with --description)
    ↓
Activate notebook → python scripts/run.py notebook_manager.py activate --id ID
    ↓
Ask question → python scripts/run.py ask_question.py --question "..."
    ↓
See "Is that ALL you need?" → Ask follow-ups until complete
    ↓
Synthesize and respond to user
```

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| ModuleNotFoundError | 使用 `run.py` 封装器 |
| 认证失败 | 设置过程中浏览器必须可见！请添加 `--show-browser` 参数 |
| 达到调用频率限制（50 次/天） | 等待重置，或切换 Google 账户 |
| 浏览器崩溃 | `python scripts/run.py cleanup_manager.py --preserve-library` |
| 找不到笔记本 | 使用 `notebook_manager.py list` 进行核查 |

## 最佳实践

1. **始终使用 run.py** — 自动处理环境配置  
2. **优先检查认证状态** — 所有操作前必做  
3. **主动发起后续追问** — 切勿止步于首次回答  
4. **认证时保持浏览器可见** — 手动登录所必需  
5. **确保上下文完整** — 每次提问均为独立会话  
6. **整合多轮回答** — 在最终回复前合并全部结果  

## 局限性

- 不支持会话持久化（每次提问均启动全新浏览器实例）  
- 免费 Google 账户存在调用频率限制（每日最多 50 次）  
- 文档需手动上传（用户须自行将资料添加至 NotebookLM）  
- 浏览器开销明显（每次提问耗时数秒）  

## 资源（skill 结构）

**重要目录与文件：**

- `scripts/` — 所有自动化脚本（如 `ask_question.py`、`notebook_manager.py` 等）  
- `data/` — 本地存储目录（用于保存认证信息与笔记本库）  
- `references/` — 扩展文档：  
  - `api_reference.md` — 所有脚本的详细 API 文档  
  - `troubleshooting.md` — 常见问题与解决方案  
  - `usage_patterns.md` — 最佳实践与工作流示例  
- `.venv/` — 隔离的 Python 虚拟环境（首次运行时自动创建）  
- `.gitignore` — 防止敏感数据被意外提交至版本控制